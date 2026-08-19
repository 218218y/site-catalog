#!/usr/bin/env python3
"""Domain services and transactional catalog mutations for the control panel."""
from __future__ import annotations

import json
import os
import tempfile
import uuid
from pathlib import Path
from typing import Mapping, Sequence

from build_site_pages import PAGE_DOCUMENTS, render_site_pages
from catalog_compiler import (
    compile_and_write_catalog_data,
    compile_taxonomy_and_site_pages,
    load_build_state,
    rename_build_state_catalogs,
    retain_build_state_catalogs,
)
from catalog_control_files import (
    AssetDeleteTarget,
    catalog_output_status,
    is_safe_catalog_id,
    iter_pdf_files,
    normalize_pdf_for_config,
    normalized_project_path,
    validate_asset_delete_requests,
)
from catalog_control_paths import (
    CONFIG_FILE,
    FOOTER_CONTENT_FILE,
    PAGES_DIR,
    PDF_DIR,
    PROJECT_ROOT,
    SEARCH_OVERRIDES_FILE,
    TAXONOMY_FILE,
    rel_to_root,
)
from catalog_page_numbering import page_number_start
from catalog_schema import validate_catalog_config
from catalog_types import CatalogConfig, CatalogSource
from footer_content import FOOTER_CONTENT_RELATIVE_PATH, serialize_footer_content, validate_footer_content
from project_mutation import ProjectMutationLock, ProjectTransaction, trigger_fault
from seo_route_lock import LOCK_FILENAME, append_new_configured_routes_to_lock
from taxonomy_editor import (
    apply_taxonomy_renames_to_catalogs,
    normalize_taxonomy_draft,
    reconcile_taxonomy_with_catalogs,
    serialize_taxonomy,
    taxonomy_completion_issues,
    taxonomy_editor_state,
)

def read_config() -> CatalogConfig:
    if not CONFIG_FILE.exists():
        return []
    payload: object = json.loads(CONFIG_FILE.read_text(encoding="utf-8-sig"))
    return validate_catalog_config(payload, PROJECT_ROOT)


def atomic_write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    previous_mode = path.stat().st_mode if path.exists() else None
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        if previous_mode is not None:
            os.chmod(temporary, previous_mode)
        os.replace(temporary, path)
        if os.name != "nt":
            try:
                descriptor = os.open(path.parent, os.O_RDONLY)
            except OSError:
                descriptor = None
            if descriptor is not None:
                try:
                    os.fsync(descriptor)
                finally:
                    os.close(descriptor)
    finally:
        temporary.unlink(missing_ok=True)


def restore_file_bytes(path: Path, previous: bytes | None) -> None:
    if previous is None:
        path.unlink(missing_ok=True)
    else:
        atomic_write_bytes(path, previous)


def current_taxonomy_state(catalogs: Sequence[Mapping[str, object]] | None = None) -> dict[str, object]:
    return taxonomy_editor_state(PROJECT_ROOT, list(catalogs) if catalogs is not None else read_config())


def taxonomy_action_availability(action_key: str, taxonomy_state: Mapping[str, object]) -> tuple[bool, str]:
    if action_key not in {"bundle_r2", "cloudflare_pages_deploy"}:
        return True, ""
    issues = taxonomy_state.get("issues", [])
    if not isinstance(issues, list) or not issues:
        return True, ""
    return False, f"יש להשלים {len(issues)} שדות בטקסונומיה לפני בנייה או העלאה."


def atomic_write_catalogs_and_taxonomy(
    catalogs: CatalogConfig,
    taxonomy: Mapping[str, Sequence[Mapping[str, object]]],
    *,
    transaction: ProjectTransaction | None = None,
) -> dict[str, list[str]]:
    previous_catalogs = CONFIG_FILE.read_bytes() if CONFIG_FILE.is_file() else None
    previous_taxonomy = TAXONOMY_FILE.read_bytes() if TAXONOMY_FILE.is_file() else None
    save_root = CONFIG_FILE.parent if CONFIG_FILE.parent == TAXONOMY_FILE.parent else None
    route_lock_path = save_root / LOCK_FILENAME if save_root is not None else None
    should_sync_route_lock = bool(
        route_lock_path
        and route_lock_path.is_file()
        and not taxonomy_completion_issues(taxonomy)
    )
    previous_route_lock = (
        route_lock_path.read_bytes()
        if should_sync_route_lock and route_lock_path is not None
        else None
    )
    route_lock_sync: dict[str, list[str]] = {"added": [], "unresolved": []}
    write_bytes = transaction.write_bytes if transaction is not None else atomic_write_bytes
    if transaction is not None:
        transaction.track_files(
            path
            for path in (CONFIG_FILE, TAXONOMY_FILE, route_lock_path)
            if path is not None
        )
    try:
        write_bytes(
            CONFIG_FILE,
            (json.dumps(catalogs, ensure_ascii=False, indent=2) + "\n").encode("utf-8"),
        )
        trigger_fault("after-config-write")
        write_bytes(TAXONOMY_FILE, serialize_taxonomy(taxonomy))
        if should_sync_route_lock and save_root is not None:
            route_lock_sync = append_new_configured_routes_to_lock(save_root)
    except Exception:
        if transaction is not None:
            raise
        restore_file_bytes(CONFIG_FILE, previous_catalogs)
        restore_file_bytes(TAXONOMY_FILE, previous_taxonomy)
        if should_sync_route_lock and route_lock_path is not None:
            restore_file_bytes(route_lock_path, previous_route_lock)
        raise
    return route_lock_sync


def route_lock_sync_warnings(sync: Mapping[str, Sequence[str]]) -> list[str]:
    additions = list(sync.get("added", []))
    unresolved = list(sync.get("unresolved", []))
    if not unresolved:
        return []
    sample = " | ".join(unresolved[:4])
    extra = f" | ועוד {len(unresolved) - 4}" if len(unresolved) > 4 else ""
    prefix = (
        "כתובות חדשות נוספו לנעילת ה-SEO, אבל "
        if additions
        else "נעילת ה-SEO לא שונתה אוטומטית משום ש"
    )
    return [
        f"{prefix}שינוי או הסרה של כתובות קיימות דורשים בדיקה ידנית "
        f"לפני פרסום ציבורי: {sample}{extra}"
    ]


def prepare_taxonomy_and_catalogs_for_save(
    taxonomy_value: object,
    catalogs: list[dict[str, object]],
) -> tuple[list[dict[str, object]], dict[str, list[dict[str, str]]], dict[str, list[str]]]:
    source = taxonomy_value if taxonomy_value is not None else current_taxonomy_state(catalogs)
    normalized = normalize_taxonomy_draft(source)
    catalogs_after_renames = apply_taxonomy_renames_to_catalogs(catalogs, normalized)
    reconciled, added = reconcile_taxonomy_with_catalogs(normalized, catalogs_after_renames)
    return catalogs_after_renames, reconciled, added


def save_footer_content_and_render_pages(
    value: object,
    *,
    root: Path = PROJECT_ROOT,
) -> dict[str, str]:
    """Validate one footer edit, stage all pages, then commit with rollback."""

    normalized = validate_footer_content(value)
    content_path = root / FOOTER_CONTENT_RELATIVE_PATH
    page_paths = [root / page.filename for page in PAGE_DOCUMENTS]

    with tempfile.TemporaryDirectory(prefix="site-catalog-footer-") as temporary_dir:
        staged_root = Path(temporary_dir)
        staged_pages = render_site_pages(
            root,
            staged_root,
            build_assets=False,
            footer_content=normalized,
            include_indexing_files=False,
        )
        staged_bytes = {
            page.relative_to(staged_root): page.read_bytes()
            for page in staged_pages
        }

    previous_files: dict[Path, bytes | None] = {
        content_path: content_path.read_bytes() if content_path.is_file() else None
    }
    previous_files.update(
        {path: path.read_bytes() if path.is_file() else None for path in page_paths}
    )

    try:
        atomic_write_bytes(content_path, serialize_footer_content(normalized))
        for relative, data in staged_bytes.items():
            atomic_write_bytes(root / relative, data)
    except Exception:
        rollback_errors: list[str] = []
        for path, previous in previous_files.items():
            try:
                restore_file_bytes(path, previous)
            except Exception as rollback_error:  # pragma: no cover - exceptional disk failure
                rollback_errors.append(f"{rel_to_root(path)}: {rollback_error}")
        if rollback_errors:
            raise RuntimeError(
                "Footer save failed and rollback was incomplete: " + "; ".join(rollback_errors)
            )
        raise

    return normalized


def group_value(value: object) -> str:
    return str(value or "").strip()


def group_catalogs_by_category_subcategory(config: list[dict[str, object]]) -> list[dict[str, object]]:
    """Group edits stably without building heterogeneous nested dictionaries."""
    category_order: list[str] = []
    subcategory_order: dict[str, list[str]] = {}
    buckets: dict[tuple[str, str], list[dict[str, object]]] = {}

    for item in config:
        category = group_value(item.get("category"))
        subcategory = group_value(item.get("subcategory"))
        if category not in subcategory_order:
            category_order.append(category)
            subcategory_order[category] = []
        if subcategory not in subcategory_order[category]:
            subcategory_order[category].append(subcategory)
        buckets.setdefault((category, subcategory), []).append(item)

    return [
        item
        for category in category_order
        for subcategory in subcategory_order[category]
        for item in buckets[(category, subcategory)]
    ]

def strip_control_panel_fields(item: dict[str, object]) -> dict[str, object]:
    row = dict(item)
    row.pop("status", None)
    row.pop("originalId", None)
    row.pop("__original_id", None)
    return row


def build_catalog_rename_map(config: list[dict[str, object]]) -> dict[str, str]:
    rename_map: dict[str, str] = {}
    for item in config:
        original_id = str(item.get("__original_id", item.get("id", ""))).strip()
        catalog_id = str(item.get("id", "")).strip()
        if original_id and catalog_id and original_id != catalog_id:
            rename_map[original_id] = catalog_id
    return rename_map


def config_for_file(config: list[dict[str, object]]) -> CatalogConfig:
    rows: list[dict[str, object]] = []
    for item in config:
        row = strip_control_panel_fields(item)
        if page_number_start(row) == 1:
            row.pop("pageNumberStart", None)
        else:
            row["pageNumberStart"] = 0
        rows.append(row)
    return validate_catalog_config(rows, PROJECT_ROOT)


def apply_pages_dir_renames(
    rename_map: dict[str, str],
    *,
    transaction: ProjectTransaction | None = None,
) -> list[str]:
    warnings: list[str] = []
    if not rename_map:
        return warnings

    source_dirs = {old_id: PAGES_DIR / old_id for old_id in rename_map}
    target_dirs = {old_id: PAGES_DIR / new_id for old_id, new_id in rename_map.items()}
    existing_sources = {old_id: path for old_id, path in source_dirs.items() if path.is_dir()}

    if not existing_sources:
        for old_id, new_id in rename_map.items():
            warnings.append(f"לא נמצאה תיקיית assets/pages/{old_id}; עודכנו רק קבצי ההגדרות ל-{new_id}.")
        return warnings

    source_paths = {path.resolve(strict=False) for path in existing_sources.values()}
    for old_id, old_dir in existing_sources.items():
        new_id = rename_map[old_id]
        target_dir = target_dirs[old_id]
        if target_dir.exists() and target_dir.resolve(strict=False) not in source_paths:
            raise ValueError(
                f"אי אפשר לשנות id מ-{old_id} ל-{new_id}: התיקייה assets/pages/{new_id} כבר קיימת. "
                "מחק או שנה אותה ידנית לפני השמירה כדי למנוע דריסה."
            )

    if transaction is not None:
        transaction.rename_paths(
            {existing_sources[old_id]: target_dirs[old_id] for old_id in existing_sources}
        )
        trigger_fault("after-directory-rename")
        for old_id, new_id in rename_map.items():
            if old_id not in existing_sources:
                warnings.append(f"לא נמצאה תיקיית assets/pages/{old_id}; עודכנו רק קבצי ההגדרות ל-{new_id}.")
        return warnings

    temp_root = PAGES_DIR / f".catalog-id-rename-{uuid.uuid4().hex}"
    temp_root.mkdir(parents=True, exist_ok=False)
    staged: list[tuple[str, str, Path, Path]] = []
    try:
        for old_id, old_dir in existing_sources.items():
            temp_dir = temp_root / uuid.uuid4().hex
            old_dir.rename(temp_dir)
            staged.append((old_id, rename_map[old_id], temp_dir, target_dirs[old_id]))

        for old_id, new_id, temp_dir, target_dir in staged:
            if target_dir.exists():
                raise ValueError(
                    f"אי אפשר להשלים שינוי id מ-{old_id} ל-{new_id}: התיקייה assets/pages/{new_id} עדיין קיימת."
                )
            target_dir.parent.mkdir(parents=True, exist_ok=True)
            temp_dir.rename(target_dir)
    except Exception:
        for old_id, _new_id, temp_dir, _target_dir in reversed(staged):
            old_dir = source_dirs[old_id]
            if temp_dir.exists() and not old_dir.exists():
                try:
                    temp_dir.rename(old_dir)
                except Exception:
                    pass
        raise
    finally:
        try:
            temp_root.rmdir()
        except OSError:
            pass

    for old_id, new_id in rename_map.items():
        if old_id not in existing_sources:
            warnings.append(f"לא נמצאה תיקיית assets/pages/{old_id}; עודכנו רק קבצי ההגדרות ל-{new_id}.")
    return warnings


def merge_override_terms(existing: object, incoming: object) -> object:
    if isinstance(existing, list) and isinstance(incoming, list):
        merged: list[object] = []
        for value in [*existing, *incoming]:
            if value not in merged:
                merged.append(value)
        return merged
    return existing if existing not in (None, [], {}) else incoming


def sync_search_overrides_after_id_rename(
    rename_map: dict[str, str],
    *,
    transaction: ProjectTransaction | None = None,
) -> list[str]:
    warnings: list[str] = []
    if not rename_map or not SEARCH_OVERRIDES_FILE.is_file():
        return warnings
    payload = json.loads(SEARCH_OVERRIDES_FILE.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, dict):
        raise ValueError("catalogs.search-overrides.json must contain a JSON object")

    changed = False
    for old_id, new_id in rename_map.items():
        if old_id not in payload:
            continue
        old_value = payload.pop(old_id)
        if new_id in payload and isinstance(payload[new_id], dict) and isinstance(old_value, dict):
            for page_key, terms in old_value.items():
                if page_key in payload[new_id]:
                    payload[new_id][page_key] = merge_override_terms(payload[new_id][page_key], terms)
                else:
                    payload[new_id][page_key] = terms
            warnings.append(f"catalogs.search-overrides.json כבר הכיל מפתח {new_id}; המפתחות של {old_id} מוזגו לתוכו.")
        elif new_id in payload:
            warnings.append(f"catalogs.search-overrides.json כבר הכיל מפתח {new_id}; נשמר הערך הקיים ולא הועתק הערך של {old_id}.")
        else:
            payload[new_id] = old_value
        changed = True

    if changed:
        data = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
        if transaction is not None:
            transaction.write_bytes(SEARCH_OVERRIDES_FILE, data)
        else:
            atomic_write_bytes(SEARCH_OVERRIDES_FILE, data)
    return warnings


def compile_catalog_outputs_after_source_save(
    catalogs: CatalogConfig,
    taxonomy: Mapping[str, Sequence[Mapping[str, object]]],
    rename_map: Mapping[str, str],
    *,
    transaction: ProjectTransaction,
) -> list[str]:
    """Recompile every catalog-derived output through the shared compiler."""
    warnings: list[str] = []
    build_state = load_build_state(PROJECT_ROOT)
    build_state = rename_build_state_catalogs(build_state, rename_map)
    build_state = retain_build_state_catalogs(
        build_state,
        (str(item["id"]) for item in catalogs),
    )
    taxonomy_issues = taxonomy_completion_issues(taxonomy)
    compiler_taxonomy = json.loads(serialize_taxonomy(taxonomy).decode("utf-8"))
    trigger_fault("during-search-index")
    compile_and_write_catalog_data(
        catalogs,
        compiler_taxonomy,
        build_state,
        PROJECT_ROOT,
        writer=transaction.write_bytes,
        require_taxonomy_coverage=not taxonomy_issues,
        write_build_state=True,
    )
    if taxonomy_issues:
        warnings.append(
            f"הטקסונומיה נשמרה כטיוטה, אבל חסרים {len(taxonomy_issues)} שדות. "
            "תוצרי הקטלוג והחיפוש נבנו מה-Compiler המשותף; דפי הטקסונומיה יחודשו לאחר השלמת השדות."
        )
    else:
        compile_taxonomy_and_site_pages(
            PROJECT_ROOT,
            writer=transaction.write_bytes,
            staging_root=transaction.temp_root,
        )
    return warnings


def normalize_catalog_for_ui(item: CatalogSource) -> dict[str, object]:
    row = dict(item)
    row["originalId"] = str(row.get("id", ""))
    row["ocr"] = catalog_ocr_enabled(row)
    row["pageNumberStart"] = page_number_start(row)
    row["status"] = catalog_output_status(str(row.get("id", "")))
    return row


def catalog_ocr_enabled(item: Mapping[str, object]) -> bool:
    value = item.get("ocr", True)
    if not isinstance(value, bool):
        raise ValueError("Catalog ocr must be a boolean")
    return value

CONTROL_CATALOG_SAVE_FIELDS = frozenset({
    "id", "originalId", "title", "description", "category", "subcategory",
    "pdf", "ocr", "pageNumberStart", "sort", "badge", "status",
})


def validate_catalogs_for_save(value: object) -> list[dict[str, object]]:
    if not isinstance(value, list):
        raise ValueError("catalogs must be an array")
    seen: set[str] = set()
    seen_original: set[str] = set()
    result: list[dict[str, object]] = []
    for index, item in enumerate(value, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Catalog #{index} must be an object")
        row = dict(item)
        extras = sorted(str(key) for key in row if key not in CONTROL_CATALOG_SAVE_FIELDS)
        if extras:
            raise ValueError(
                f"Catalog #{index} contains unsupported properties: {', '.join(extras)}"
            )
        catalog_id = str(row.get("id", "")).strip().lower()
        original_id = str(row.get("originalId", catalog_id)).strip().lower() or catalog_id
        pdf = str(row.get("pdf", "")).strip()
        title = str(row.get("title", "")).strip()
        if not catalog_id:
            raise ValueError(f"Catalog #{index} is missing id")
        if catalog_id in seen:
            raise ValueError(f"Duplicate catalog id: {catalog_id}")
        if not is_safe_catalog_id(catalog_id):
            raise ValueError(f"Unsafe catalog id: {catalog_id}")
        if original_id and not is_safe_catalog_id(original_id):
            raise ValueError(f"Unsafe original catalog id: {original_id}")
        if original_id in seen_original:
            raise ValueError(f"Duplicate original catalog id: {original_id}")
        if not pdf:
            raise ValueError(f"Catalog {catalog_id} is missing pdf")
        normalized_pdf = normalize_pdf_for_config(pdf)
        row["id"] = catalog_id
        row["__original_id"] = original_id
        row["title"] = title or catalog_id
        row["description"] = str(row.get("description", ""))
        row["category"] = group_value(row.get("category", ""))
        row["subcategory"] = group_value(row.get("subcategory", ""))
        row["pdf"] = normalized_pdf
        row["ocr"] = catalog_ocr_enabled(row)
        row["pageNumberStart"] = page_number_start(row)
        row.pop("status", None)
        seen.add(catalog_id)
        seen_original.add(original_id)
        result.append(row)
    return result


def configured_missing_pdfs(config: Sequence[Mapping[str, object]] | None = None) -> list[dict[str, str]]:
    rows = list(config) if config is not None else read_config()
    missing: list[dict[str, str]] = []
    for item in rows:
        pdf_value = str(item.get("pdf", "")).strip()
        if not pdf_value:
            continue
        pdf_path = (PROJECT_ROOT / pdf_value).resolve(strict=False)
        if pdf_path.is_file():
            continue
        missing.append({
            "id": str(item.get("id", "")).strip(),
            "title": str(item.get("title", item.get("id", ""))).strip(),
            "pdf": normalized_project_path(pdf_value),
        })
    return missing


def _transactional_delete_assets(
    transaction: ProjectTransaction,
    targets: Sequence[AssetDeleteTarget],
) -> tuple[list[str], list[str]]:
    deleted: list[str] = []
    warnings: list[str] = []
    for target in targets:
        if transaction.delete_path(target.path):
            deleted.append(target.label)
        else:
            warnings.append(f"לא נמצא למחיקה: {target.label}")
    return deleted, warnings


def save_catalogs_transactionally(
    catalogs_value: object,
    taxonomy_value: object,
    asset_deletes_value: object,
) -> dict[str, object]:
    """Commit one complete control-panel catalog save or restore everything."""

    with ProjectMutationLock(PROJECT_ROOT, "שמירת קטלוגים מלוח השליטה"):
        catalogs = validate_catalogs_for_save(catalogs_value)
        catalogs, taxonomy, auto_added = prepare_taxonomy_and_catalogs_for_save(
            taxonomy_value, catalogs
        )
        catalogs = group_catalogs_by_category_subcategory(catalogs)
        delete_targets, delete_warnings = validate_asset_delete_requests(
            asset_deletes_value, catalogs
        )
        rename_map = build_catalog_rename_map(catalogs)
        file_catalogs = config_for_file(catalogs)
        warnings = list(delete_warnings)

        with ProjectTransaction(PROJECT_ROOT, prefix=".catalog-save-transaction-") as transaction:
            deleted_assets, staged_warnings = _transactional_delete_assets(
                transaction, delete_targets
            )
            warnings.extend(staged_warnings)
            route_lock_sync = atomic_write_catalogs_and_taxonomy(
                file_catalogs,
                taxonomy,
                transaction=transaction,
            )
            warnings.extend(route_lock_sync_warnings(route_lock_sync))
            warnings.extend(
                apply_pages_dir_renames(rename_map, transaction=transaction)
            )
            warnings.extend(
                sync_search_overrides_after_id_rename(
                    rename_map,
                    transaction=transaction,
                )
            )
            warnings.extend(
                compile_catalog_outputs_after_source_save(
                    file_catalogs,
                    taxonomy,
                    rename_map,
                    transaction=transaction,
                )
            )

        return {
            "warnings": warnings,
            "autoAddedTaxonomy": auto_added,
            "deletedAssets": deleted_assets,
            "routeLockUpdates": route_lock_sync.get("added", []),
        }


def save_taxonomy_transactionally(taxonomy_value: object) -> dict[str, object]:
    with ProjectMutationLock(PROJECT_ROOT, "שמירת טקסונומיה מלוח השליטה"):
        catalogs = validate_catalogs_for_save(read_config())
        catalogs, taxonomy, auto_added = prepare_taxonomy_and_catalogs_for_save(
            taxonomy_value, catalogs
        )
        catalogs = group_catalogs_by_category_subcategory(catalogs)
        file_catalogs = config_for_file(catalogs)
        warnings: list[str] = []
        with ProjectTransaction(PROJECT_ROOT, prefix=".taxonomy-save-transaction-") as transaction:
            route_lock_sync = atomic_write_catalogs_and_taxonomy(
                file_catalogs,
                taxonomy,
                transaction=transaction,
            )
            warnings.extend(route_lock_sync_warnings(route_lock_sync))
            warnings.extend(
                compile_catalog_outputs_after_source_save(
                    file_catalogs,
                    taxonomy,
                    {},
                    transaction=transaction,
                )
            )
        return {
            "warnings": warnings,
            "autoAddedTaxonomy": auto_added,
            "routeLockUpdates": route_lock_sync.get("added", []),
        }
