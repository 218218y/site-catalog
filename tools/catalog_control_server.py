#!/usr/bin/env python3
"""Local control panel for catalog maintenance.

The server binds to loopback by default. Explicit remote mode is protected by
an allowlist and per-session token. It exposes a small browser UI for editing
validated project sources and running fixed maintenance commands without giving
the browser arbitrary shell access.
"""
from __future__ import annotations

import argparse
import hmac
import ipaddress
import base64
import filecmp
import json
import os
import re
import signal
import secrets
import subprocess
import shutil
import sys
import tempfile
import threading
import time
import uuid
import webbrowser
from dataclasses import dataclass, field
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Mapping, Sequence, cast
from urllib.parse import parse_qs, unquote, urlparse

TOOLS_DIR = Path(__file__).resolve().parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from build_site_pages import PAGE_DOCUMENTS, render_site_pages
from seo_route_lock import LOCK_FILENAME, append_new_configured_routes_to_lock
from taxonomy_editor import (
    TAXONOMY_CONFIG_FILE,
    apply_taxonomy_renames_to_catalogs,
    normalize_taxonomy_draft,
    reconcile_taxonomy_with_catalogs,
    serialize_taxonomy,
    taxonomy_completion_issues,
    taxonomy_editor_state,
)
from footer_content import (
    FOOTER_CONTENT_RELATIVE_PATH,
    footer_editor_schema,
    read_footer_content,
    serialize_footer_content,
    validate_footer_content,
)
from project_mutation import (
    MutationBusyError,
    ProjectMutationLock,
    ProjectTransaction,
    read_lock_metadata,
    trigger_fault,
)
from catalog_compiler import (
    compile_and_write_catalog_data,
    compile_taxonomy_and_site_pages,
    load_build_state,
    rename_build_state_catalogs,
    retain_build_state_catalogs,
)

from catalog_conversion_profiles import conversion_profile_command
from catalog_page_numbering import page_number_start

from catalog_schema import CATALOG_CONFIG_SCHEMA, validate_against_schema

from control_panel_api_schema import ControlPanelSchemaError, validate_control_panel_payload

from catalog_control_api import (
    API_VERSION,
    MAX_PDF_UPLOAD_BYTES,
    ApiRequestError,
    CatalogSaveRequest,
    FooterSaveRequest,
    RunActionRequest,
    TaxonomySaveRequest,
    content_length,
    read_json_object,
    validate_request_payload,
)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = PROJECT_ROOT / "catalogs.config.json"
TAXONOMY_FILE = PROJECT_ROOT / TAXONOMY_CONFIG_FILE
SEARCH_OVERRIDES_FILE = PROJECT_ROOT / "catalogs.search-overrides.json"
FOOTER_CONTENT_FILE = PROJECT_ROOT / FOOTER_CONTENT_RELATIVE_PATH
PDF_DIR = PROJECT_ROOT / "assets" / "pdfs"
PAGES_DIR = PROJECT_ROOT / "assets" / "pages"
CATALOG_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
PAGE_RE = re.compile(r"^page-(\d{3})\.(webp|jpg|png)$", re.IGNORECASE)
CONTROL_PANEL_STATIC_ROOT = PROJECT_ROOT / "src" / "control-panel"
STATIC_FILES = {
    "/catalog-control-panel.html": PROJECT_ROOT / "catalog-control-panel.html",
    **{
        f"/{path.relative_to(PROJECT_ROOT).as_posix()}": path
        for path in CONTROL_PANEL_STATIC_ROOT.rglob("*")
        if path.is_file() and path.suffix.lower() in {".js", ".css"}
    },
}


@dataclass(frozen=True)
class Action:
    label: str
    description: str
    command: list[str]


ACTIONS: dict[str, Action] = {
    "sync_pdfs": Action(
        "הוסף PDFים חסרים לרשימה",
        "סורק assets/pdfs ומוסיף ל-catalogs.config.json קטלוגים שלא רשומים עדיין. לא ממיר ולא מריץ OCR.",
        ["tools/sync_catalog_pdfs.py"],
    ),
    "convert": Action(
        "המרה רגילה",
        "ממיר קטלוגים חסרים/שהשתנו לשלוש שכבות תמונה: thumbnail, medium ו-full. קטלוג שהוסר מהרשימה ינוקה; PDF חסר לעולם לא יגרום למחיקה בלי אישור מפורש. OCR במצב auto, אבל קטלוג עם ocr=false ידולג ב-OCR.",
        conversion_profile_command("production"),
    ),
    "convert_force": Action(
        "המרה מחדש לכל הקטלוגים",
        "מרנדר מחדש את כל הקטלוגים התקינים עם שכבות thumbnail, medium ו-full. PDF חסר עוצר את הפעולה, אלא אם המשתמש מאשר במפורש להסיר את הקטלוג החסר.",
        conversion_profile_command("force"),
    ),
    "refresh_ocr": Action(
        "רענון אינדקס חיפוש/OCR בלבד",
        "בונה מחדש את catalogs.search-index.json בלי לרנדר מחדש תמונות קיימות, ככל האפשר.",
        conversion_profile_command("ocr-refresh"),
    ),
    "r2_preview": Action(
        "בדיקת סנכרון R2 בלי שינוי",
        "מציג מה יועלה/יימחק ב-Cloudflare R2 בלי לבצע שינוי אמיתי.",
        ["tools/sync_r2_catalog_images.py", "--dry-run"],
    ),
    "r2_sync": Action(
        "סנכרון R2 בפועל",
        "מסנכרן assets/pages מול ה-bucket לפי r2.env.",
        ["tools/sync_r2_catalog_images.py"],
    ),
    "bundle_r2": Action(
        "יצירת באנדל R2",
        "בונה רק כשיש שינוי, ומעדכן מאותו תוצר את dist/site-upload-r2 ואת dist/site-local.",
        [
            "tools/build_deploy_bundle.py",
            "--out",
            "dist/site-upload-r2",
            "--seo-mode",
            "private",
            "--external-assets-url",
            "https://cdn.bargig-furniture.com",
            "--skip-if-current",
            "--mirror-to",
            "dist/site-local",
            "--clean-legacy-artifacts",
        ],
    ),
    "cloudflare_pages_deploy": Action(
        "העלאת באנדל ל-Cloudflare",
        "מאמת שהבאנדל הקיים שלם ותואם למקורות, ואז מעלה אותו ל-production בלי לבנות מחדש. אם היו שינויים יש להריץ קודם יצירת באנדל R2.",
        ["tools/deploy_cloudflare_pages.py"],
    ),
}

if os.environ.get("BARGIG_CONTROL_E2E") == "1":
    ACTIONS["_e2e_interruptible"] = Action(
        "בדיקת עצירה ושחזור",
        "פעולת בדיקה איטית שמוודאת עצירה ושחזור עסקה דרך הדפדפן.",
        ["tests/fixtures/control_panel_interruptible_job.py"],
    )


@dataclass
class Job:
    id: str
    action_key: str
    label: str
    started_at: float
    status: str = "running"
    returncode: int | None = None
    finished_at: float | None = None
    cancel_requested: bool = False
    cancel_requested_at: float | None = None
    process: subprocess.Popen[str] | None = field(default=None, repr=False, compare=False)
    log: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class AssetDeleteTarget:
    path: Path
    label: str
    kind: str


@dataclass(frozen=True)
class StagedAssetDelete:
    original_path: Path
    staged_path: Path
    label: str
    kind: str


jobs: dict[str, Job] = {}
jobs_lock = threading.Lock()
job_start_lock = threading.Lock()
native_dialog_lock = threading.Lock()
footer_save_lock = threading.Lock()
taxonomy_save_lock = threading.Lock()


def rel_to_root(path: Path) -> str:
    try:
        return path.resolve(strict=False).relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def read_json_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    """Backward-compatible name for the bounded typed JSON reader."""
    return read_json_object(handler)


def read_config() -> list[dict[str, Any]]:
    if not CONFIG_FILE.exists():
        return []
    payload = json.loads(CONFIG_FILE.read_text(encoding="utf-8-sig"))
    validate_against_schema(payload, PROJECT_ROOT, CATALOG_CONFIG_SCHEMA)
    result: list[dict[str, Any]] = []
    for index, item in enumerate(payload, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Catalog #{index} must be an object")
        result.append(dict(item))
    return result


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


def current_taxonomy_state(catalogs: Sequence[Mapping[str, Any]] | None = None) -> dict[str, Any]:
    return taxonomy_editor_state(PROJECT_ROOT, list(catalogs) if catalogs is not None else read_config())


def taxonomy_action_availability(action_key: str, taxonomy_state: Mapping[str, Any]) -> tuple[bool, str]:
    if action_key not in {"bundle_r2", "cloudflare_pages_deploy"}:
        return True, ""
    issues = taxonomy_state.get("issues", [])
    if not isinstance(issues, list) or not issues:
        return True, ""
    return False, f"יש להשלים {len(issues)} שדות בטקסונומיה לפני בנייה או העלאה."


def atomic_write_catalogs_and_taxonomy(
    catalogs: list[dict[str, Any]],
    taxonomy: Mapping[str, Sequence[Mapping[str, Any]]],
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
    route_lock_sync = {"added": [], "unresolved": []}
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
    taxonomy_value: Any,
    catalogs: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, list[dict[str, str]]], dict[str, list[str]]]:
    source = taxonomy_value if taxonomy_value is not None else current_taxonomy_state(catalogs)
    normalized = normalize_taxonomy_draft(source)
    catalogs_after_renames = apply_taxonomy_renames_to_catalogs(catalogs, normalized)
    reconciled, added = reconcile_taxonomy_with_catalogs(normalized, catalogs_after_renames)
    return catalogs_after_renames, reconciled, added


def save_footer_content_and_render_pages(
    value: Any,
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


def group_value(value: Any) -> str:
    return str(value or "").strip()


def group_catalogs_by_category_subcategory(config: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Stable grouping used before saving the control-panel edits.

    The first appearance of a category determines the category-block order.
    Inside each category, the first appearance of a subcategory determines the
    subcategory-block order. Catalogs inside the same subcategory keep their
    existing relative order. This matches the UI behavior: changing one catalog
    to an earlier category appends it to that category block on save, rather
    than alphabetically jumping around.
    """
    categories: list[dict[str, Any]] = []
    category_map: dict[str, dict[str, Any]] = {}

    for item in config:
        category_key = group_value(item.get("category"))
        category = category_map.get(category_key)
        if category is None:
            category = {"subcategories": [], "subcategory_map": {}}
            category_map[category_key] = category
            categories.append(category)

        subcategory_key = group_value(item.get("subcategory", ""))
        subcategory_map = category["subcategory_map"]
        subcategory = subcategory_map.get(subcategory_key)
        if subcategory is None:
            subcategory = []
            subcategory_map[subcategory_key] = subcategory
            category["subcategories"].append(subcategory)
        subcategory.append(item)

    grouped: list[dict[str, Any]] = []
    for category in categories:
        for subcategory in category["subcategories"]:
            grouped.extend(subcategory)
    return grouped


def is_safe_catalog_id(catalog_id: str) -> bool:
    return bool(CATALOG_ID_RE.fullmatch(str(catalog_id or "")))


def strip_control_panel_fields(item: dict[str, Any]) -> dict[str, Any]:
    row = dict(item)
    row.pop("status", None)
    row.pop("originalId", None)
    row.pop("_originalId", None)
    row.pop("__original_id", None)
    return row


def build_catalog_rename_map(config: list[dict[str, Any]]) -> dict[str, str]:
    rename_map: dict[str, str] = {}
    for item in config:
        original_id = str(item.get("__original_id", item.get("id", ""))).strip()
        catalog_id = str(item.get("id", "")).strip()
        if original_id and catalog_id and original_id != catalog_id:
            rename_map[original_id] = catalog_id
    return rename_map


def config_for_file(config: list[dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in config:
        row = strip_control_panel_fields(item)
        if page_number_start(row) == 1:
            row.pop("pageNumberStart", None)
        else:
            row["pageNumberStart"] = 0
        rows.append(row)
    validate_against_schema(rows, PROJECT_ROOT, CATALOG_CONFIG_SCHEMA)
    return rows


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


def merge_override_terms(existing: Any, incoming: Any) -> Any:
    if isinstance(existing, list) and isinstance(incoming, list):
        merged: list[Any] = []
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
    catalogs: list[dict[str, Any]],
    taxonomy: Mapping[str, Sequence[Mapping[str, Any]]],
    rename_map: Mapping[str, str],
    *,
    transaction: ProjectTransaction,
) -> list[str]:
    """Recompile every catalog-derived output through the shared compiler."""
    warnings: list[str] = []
    build_state = load_build_state(PROJECT_ROOT, allow_legacy_migration=False)
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


def normalize_catalog_for_ui(item: dict[str, Any]) -> dict[str, Any]:
    row = dict(item)
    row["originalId"] = str(row.get("id", ""))
    row["ocr"] = catalog_ocr_enabled(row)
    row["pageNumberStart"] = page_number_start(row)
    row["status"] = catalog_output_status(str(row.get("id", "")))
    return row


def catalog_ocr_enabled(item: dict[str, Any]) -> bool:
    value = item.get("ocr", True)
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() not in {"0", "false", "no", "off", "never", "none", "לא", "בלי", "ללא"}


def normalized_project_path(path_value: Any) -> str:
    raw = str(path_value or "").strip().replace("\\", "/")
    if not raw:
        return ""
    candidate = Path(raw)
    if not candidate.is_absolute():
        candidate = PROJECT_ROOT / candidate
    return candidate.resolve(strict=False).as_posix().casefold()


def iter_pdf_files() -> list[Path]:
    if not PDF_DIR.is_dir():
        return []
    return sorted(
        (path for path in PDF_DIR.rglob("*") if path.is_file() and path.suffix.lower() == ".pdf" and not path.name.startswith(".")),
        key=lambda path: path.relative_to(PDF_DIR).as_posix().casefold(),
    )


def normalize_pdf_for_config(path_value: Any) -> str:
    raw = str(path_value or "").strip().replace("\\", "/")
    if not raw:
        return ""
    candidate = Path(raw)
    if not candidate.is_absolute():
        candidate = PROJECT_ROOT / candidate

    project_root = PROJECT_ROOT.resolve(strict=False)
    pdf_dir = PDF_DIR.resolve(strict=False)
    resolved = candidate.resolve(strict=False)

    try:
        resolved.relative_to(pdf_dir)
    except ValueError as exc:
        raise ValueError(f"PDF must be inside {rel_to_root(PDF_DIR)}: {raw}") from exc

    if resolved.suffix.lower() != ".pdf":
        raise ValueError(f"PDF source must be a .pdf file: {raw}")

    return resolved.relative_to(project_root).as_posix()


def pdf_file_payload(path: Path) -> dict[str, Any]:
    stat = path.stat()
    relative_to_pdfs = path.relative_to(PDF_DIR).as_posix()
    folder = path.parent.relative_to(PDF_DIR).as_posix()
    return {
        "path": rel_to_root(path),
        "name": path.name,
        "folder": "" if folder == "." else folder,
        "label": relative_to_pdfs,
        "size": stat.st_size,
        "modifiedAt": stat.st_mtime,
    }


def pdf_files_payload() -> list[dict[str, Any]]:
    return [pdf_file_payload(path) for path in iter_pdf_files()]


WINDOWS_INVALID_FILENAME_RE = re.compile(r'[<>:"/\\|?*\x00-\x1f]')


def sanitize_uploaded_pdf_filename(filename: str) -> str:
    name = Path(str(filename or "").replace("\\", "/")).name.strip()
    name = WINDOWS_INVALID_FILENAME_RE.sub("_", name)
    name = re.sub(r"\s+", " ", name).strip(" .")
    if not name:
        raise ValueError("לא התקבל שם קובץ תקין")
    if Path(name).suffix.lower() != ".pdf":
        raise ValueError("אפשר לבחור רק קובץ PDF")
    if name in {".", ".."} or not Path(name).stem.strip(" ."):
        raise ValueError("שם קובץ ה-PDF אינו תקין")
    return name


def multipart_header_value(headers: str, name: str) -> str:
    for line in headers.splitlines():
        if line.lower().startswith(name.lower() + ":"):
            return line.split(":", 1)[1].strip()
    return ""


def multipart_disposition_param(disposition: str, key: str) -> str:
    starred_key = key + "*"
    for part in disposition.split(";"):
        part = part.strip()
        if part.lower().startswith(starred_key.lower() + "="):
            value = part.split("=", 1)[1].strip().strip('"')
            if "''" in value:
                _encoding, encoded = value.split("''", 1)
                from urllib.parse import unquote
                return unquote(encoded)
            return value
    for part in disposition.split(";"):
        part = part.strip()
        if part.lower().startswith(key.lower() + "="):
            return part.split("=", 1)[1].strip().strip('"')
    return ""


def read_multipart_pdf_upload(handler: BaseHTTPRequestHandler) -> tuple[str, bytes]:
    content_type = handler.headers.get("Content-Type", "")
    boundary_match = re.search(r'boundary=(?:"([^"]+)"|([^;]+))', content_type)
    if not boundary_match:
        raise ValueError("בקשת העלאת PDF חסרה boundary")
    boundary = (boundary_match.group(1) or boundary_match.group(2)).strip()
    if not boundary:
        raise ValueError("בקשת העלאת PDF חסרה boundary תקין")

    length = content_length(handler, maximum=MAX_PDF_UPLOAD_BYTES)
    if length <= 0:
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, "לא התקבל קובץ PDF")
    raw = handler.rfile.read(length)
    if len(raw) != length:
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, "בקשת העלאת ה-PDF נקטעה לפני סופה")
    delimiter = ("--" + boundary).encode("utf-8")

    # Do not use strip() here: binary PDFs can legitimately start or end with
    # CR/LF bytes. Multipart framing adds exactly one CRLF before the next
    # boundary, so remove only that framing CRLF and keep the file bytes intact.
    for part in raw.split(delimiter):
        if not part:
            continue
        if part.startswith(b"--"):
            continue
        if part.startswith(b"\r\n"):
            part = part[2:]
        if part.endswith(b"\r\n"):
            part = part[:-2]
        if b"\r\n\r\n" not in part:
            continue
        header_bytes, body = part.split(b"\r\n\r\n", 1)
        headers = header_bytes.decode("utf-8", errors="replace")
        disposition = multipart_header_value(headers, "Content-Disposition")
        if 'name="pdf"' not in disposition and "name=pdf" not in disposition:
            continue
        filename = multipart_disposition_param(disposition, "filename")
        if not filename:
            raise ValueError("לא התקבל שם קובץ PDF")
        if not body:
            raise ValueError("קובץ ה-PDF ריק")
        return filename, body

    raise ValueError("לא נמצא שדה קובץ בשם pdf בבקשה")


def target_pdf_path_for_filename(filename: str) -> tuple[str, Path]:
    safe_name = sanitize_uploaded_pdf_filename(filename)
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    target = (PDF_DIR / safe_name).resolve(strict=False)
    pdf_dir = PDF_DIR.resolve(strict=False)
    try:
        target.relative_to(pdf_dir)
    except ValueError as exc:
        raise ValueError("שם קובץ ה-PDF יוצר נתיב לא בטוח") from exc
    return safe_name, target


def save_uploaded_pdf(filename: str, content: bytes) -> dict[str, Any]:
    with ProjectMutationLock(PROJECT_ROOT, "העלאת PDF מלוח השליטה"):
        safe_name, target = target_pdf_path_for_filename(filename)

        if target.exists():
            existing = target.read_bytes()
            if existing != content:
                raise ValueError(
                    f"כבר קיים PDF בשם {safe_name} בתוך {rel_to_root(PDF_DIR)}. "
                    "אם הקובץ כבר נמצא שם — בחר אותו דרך חלון הבחירה המקומי. "
                    "אם זה קובץ אחר מחוץ לתיקייה — שנה לו שם כדי למנוע דריסה שקטה."
                )
            return {"path": rel_to_root(target), "name": safe_name, "status": "existing"}

        temp_path = target.with_name(f".upload-{uuid.uuid4().hex}-{safe_name}")
        try:
            temp_path.write_bytes(content)
            temp_path.replace(target)
        finally:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
        return {"path": rel_to_root(target), "name": safe_name, "status": "created"}


def selected_pdf_payload(source_path: Path) -> dict[str, Any]:
    source = source_path.resolve(strict=False)
    if not source.is_file():
        raise ValueError(f"קובץ ה-PDF לא נמצא: {source_path}")
    if source.suffix.lower() != ".pdf":
        raise ValueError("אפשר לבחור רק קובץ PDF")

    pdf_dir = PDF_DIR.resolve(strict=False)
    try:
        source.relative_to(pdf_dir)
    except ValueError:
        pass
    else:
        return {"path": rel_to_root(source), "name": source.name, "status": "selected"}

    with ProjectMutationLock(PROJECT_ROOT, "העתקת PDF מלוח השליטה"):
        safe_name, target = target_pdf_path_for_filename(source.name)
        try:
            if target.exists() and source.samefile(target):
                return {"path": rel_to_root(target), "name": safe_name, "status": "selected"}
        except OSError:
            pass

        if target.exists():
            try:
                identical = filecmp.cmp(source, target, shallow=False)
            except OSError:
                identical = False
            if identical:
                return {"path": rel_to_root(target), "name": safe_name, "status": "existing"}
            raise ValueError(
                f"כבר קיים PDF בשם {safe_name} בתוך {rel_to_root(PDF_DIR)}, אבל זה לא אותו קובץ. "
                "בחר את הקובץ הקיים מתוך assets/pdfs, או שנה שם לקובץ החיצוני כדי למנוע דריסה."
            )

        temp_path = target.with_name(f".copy-{uuid.uuid4().hex}-{safe_name}")
        try:
            shutil.copy2(source, temp_path)
            temp_path.replace(target)
        finally:
            if temp_path.exists():
                try:
                    temp_path.unlink()
                except OSError:
                    pass
        return {"path": rel_to_root(target), "name": safe_name, "status": "copied"}


def pick_pdf_with_powershell() -> str:
    powershell = shutil.which("powershell.exe") or shutil.which("powershell") or shutil.which("pwsh")
    if not powershell:
        raise RuntimeError("PowerShell is not available")
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    initial_dir = str(PDF_DIR.resolve(strict=False)).replace("'", "''")
    script = f"""
Add-Type -AssemblyName System.Windows.Forms
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'בחר קובץ PDF לקטלוג'
$dialog.InitialDirectory = '{initial_dir}'
$dialog.Filter = 'PDF files (*.pdf)|*.pdf|All files (*.*)|*.*'
$dialog.CheckFileExists = $true
$dialog.Multiselect = $false
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {{
    Write-Output $dialog.FileName
}}
"""
    command = [powershell, "-NoProfile", "-ExecutionPolicy", "Bypass"]
    if Path(powershell).name.lower() != "pwsh":
        command.append("-STA")
    encoded = base64.b64encode(script.encode("utf-16le")).decode("ascii")
    command.extend(["-EncodedCommand", encoded])
    completed = subprocess.run(
        command,
        cwd=PROJECT_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if completed.returncode != 0:
        raise RuntimeError(completed.stderr.strip() or "פתיחת חלון הבחירה נכשלה")
    return completed.stdout.strip().splitlines()[-1].strip() if completed.stdout.strip() else ""


def pick_pdf_with_tkinter() -> str:
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    try:
        import tkinter as tk
        from tkinter import filedialog
    except Exception as exc:
        raise RuntimeError("Tkinter is not available") from exc
    root = tk.Tk()
    root.withdraw()
    try:
        try:
            root.attributes("-topmost", True)
            root.update()
        except Exception:
            pass
        selected = filedialog.askopenfilename(
            parent=root,
            title="בחר קובץ PDF לקטלוג",
            initialdir=str(PDF_DIR.resolve(strict=False)),
            filetypes=(("PDF files", "*.pdf"), ("All files", "*.*")),
        )
        return str(selected or "")
    finally:
        root.destroy()


def pick_native_pdf_file() -> dict[str, Any]:
    if not native_dialog_lock.acquire(blocking=False):
        raise ValueError("חלון בחירת PDF כבר פתוח. סגור אותו לפני פתיחת חלון נוסף.")
    try:
        selected = ""
        errors: list[str] = []
        if sys.platform.startswith("win"):
            try:
                selected = pick_pdf_with_powershell()
            except Exception as exc:
                errors.append(str(exc))
        if not selected:
            try:
                selected = pick_pdf_with_tkinter()
            except Exception as exc:
                errors.append(str(exc))
        if not selected:
            return {"canceled": True, "errors": errors}
        return {"canceled": False, "pdf": selected_pdf_payload(Path(selected))}
    finally:
        native_dialog_lock.release()


def validate_asset_delete_requests(value: Any, remaining_config: list[dict[str, Any]]) -> tuple[list[AssetDeleteTarget], list[str]]:
    if value in (None, ""):
        return [], []
    if not isinstance(value, list):
        raise ValueError("assetDeletes must be an array")

    remaining_ids = {str(item.get("id", "")).strip().lower() for item in remaining_config}
    remaining_pdfs = {normalize_pdf_for_config(item.get("pdf")) for item in remaining_config if item.get("pdf")}
    targets: dict[str, AssetDeleteTarget] = {}
    warnings: list[str] = []

    for index, item in enumerate(value, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"assetDeletes #{index} must be an object")
        delete_pdf = bool(item.get("deletePdf"))
        delete_pages = bool(item.get("deletePages"))
        if not delete_pdf and not delete_pages:
            continue

        catalog_id = str(item.get("id", "")).strip().lower()
        original_id = str(item.get("originalId", catalog_id)).strip().lower() or catalog_id
        for value_id, label in ((catalog_id, "id"), (original_id, "originalId")):
            if value_id and not is_safe_catalog_id(value_id):
                raise ValueError(f"Unsafe {label} in delete request: {value_id}")
        if catalog_id and catalog_id in remaining_ids:
            raise ValueError(f"אי אפשר למחוק נכסים של {catalog_id}: הקטלוג עדיין קיים ברשימה שנשמרת")
        if original_id and original_id in remaining_ids:
            raise ValueError(f"אי אפשר למחוק נכסים של {original_id}: הקטלוג עדיין קיים ברשימה שנשמרת")

        if delete_pdf:
            normalized_pdf = normalize_pdf_for_config(item.get("pdf"))
            if not normalized_pdf:
                warnings.append(f"בקשת מחיקה #{index}: לא נמצא נתיב PDF למחיקה.")
            elif normalized_pdf in remaining_pdfs:
                raise ValueError(f"אי אפשר למחוק {normalized_pdf}: PDF זה עדיין משויך לקטלוג אחר שנשאר ברשימה")
            else:
                path = (PROJECT_ROOT / normalized_pdf).resolve(strict=False)
                key = path.as_posix().casefold()
                targets[key] = AssetDeleteTarget(path=path, label=normalized_pdf, kind="pdf")

        if delete_pages:
            for pages_id in dict.fromkeys([original_id, catalog_id]):
                if not pages_id:
                    continue
                if pages_id in remaining_ids:
                    raise ValueError(f"אי אפשר למחוק assets/pages/{pages_id}: ID זה עדיין קיים ברשימה שנשמרת")
                path = (PAGES_DIR / pages_id).resolve(strict=False)
                pages_dir = PAGES_DIR.resolve(strict=False)
                try:
                    path.relative_to(pages_dir)
                except ValueError as exc:
                    raise ValueError(f"נתיב תיקיית תמונות לא בטוח: {pages_id}") from exc
                key = path.as_posix().casefold()
                targets[key] = AssetDeleteTarget(path=path, label=rel_to_root(path), kind="pages")

    return list(targets.values()), warnings


def stage_asset_deletions(targets: list[AssetDeleteTarget]) -> tuple[list[StagedAssetDelete], list[str], Path | None]:
    staged: list[StagedAssetDelete] = []
    warnings: list[str] = []
    existing_targets = [target for target in targets if target.path.exists()]
    for target in targets:
        if not target.path.exists():
            warnings.append(f"לא נמצא למחיקה: {target.label}")
    if not existing_targets:
        return staged, warnings, None

    temp_root = PROJECT_ROOT / f".catalog-asset-delete-{uuid.uuid4().hex}"
    temp_root.mkdir(parents=True, exist_ok=False)
    try:
        for target in existing_targets:
            staged_path = temp_root / uuid.uuid4().hex
            target.path.rename(staged_path)
            staged.append(StagedAssetDelete(target.path, staged_path, target.label, target.kind))
    except Exception:
        restore_staged_deletions(staged, temp_root)
        raise
    return staged, warnings, temp_root


def restore_staged_deletions(staged: list[StagedAssetDelete], temp_root: Path | None) -> None:
    for item in reversed(staged):
        if item.staged_path.exists() and not item.original_path.exists():
            try:
                item.original_path.parent.mkdir(parents=True, exist_ok=True)
                item.staged_path.rename(item.original_path)
            except Exception:
                pass
    if temp_root and temp_root.exists():
        try:
            temp_root.rmdir()
        except OSError:
            pass


def finalize_staged_deletions(staged: list[StagedAssetDelete], temp_root: Path | None) -> list[str]:
    warnings: list[str] = []
    for item in staged:
        try:
            if item.staged_path.is_dir():
                shutil.rmtree(item.staged_path)
            elif item.staged_path.exists():
                item.staged_path.unlink()
        except Exception as exc:
            warnings.append(f"נכשל ניקוי סופי של {item.label}: {exc}")
    if temp_root and temp_root.exists():
        try:
            temp_root.rmdir()
        except OSError as exc:
            warnings.append(f"נכשל ניקוי תיקיית מחיקה זמנית {rel_to_root(temp_root)}: {exc}")
    return warnings


def missing_pdf_count(config: list[dict[str, Any]]) -> int:
    configured = {normalized_project_path(item.get("pdf")) for item in config if item.get("pdf")}
    return sum(1 for path in iter_pdf_files() if normalized_project_path(path) not in configured)


def catalog_output_status(catalog_id: str) -> dict[str, Any]:
    catalog_id = str(catalog_id or "").strip()
    out_dir = PAGES_DIR / catalog_id if catalog_id else PAGES_DIR / "__missing__"
    if not out_dir.is_dir():
        return {"state": "missing", "label": "לא הומר"}

    pages_by_ext: dict[str, set[int]] = {}
    medium_by_ext: dict[str, set[int]] = {}
    thumbs_by_ext: dict[str, set[int]] = {}
    for file_path in out_dir.iterdir():
        if file_path.is_file():
            match = PAGE_RE.match(file_path.name)
            if match:
                pages_by_ext.setdefault(match.group(2).lower(), set()).add(int(match.group(1)))
    thumb_dir = out_dir / "thumbs"
    medium_dir = out_dir / "medium"
    if medium_dir.is_dir():
        for file_path in medium_dir.iterdir():
            if file_path.is_file():
                match = PAGE_RE.match(file_path.name)
                if match:
                    medium_by_ext.setdefault(match.group(2).lower(), set()).add(int(match.group(1)))
    if thumb_dir.is_dir():
        for file_path in thumb_dir.iterdir():
            if file_path.is_file():
                match = PAGE_RE.match(file_path.name)
                if match:
                    thumbs_by_ext.setdefault(match.group(2).lower(), set()).add(int(match.group(1)))

    for ext in ("webp", "jpg", "png"):
        pages = pages_by_ext.get(ext, set())
        if not pages:
            continue
        expected = set(range(1, max(pages) + 1))
        missing_pages = expected - pages
        missing_medium = expected - medium_by_ext.get(ext, set())
        missing_thumbs = expected - thumbs_by_ext.get(ext, set())
        if 1 in pages and not missing_pages and not missing_medium and not missing_thumbs:
            return {"state": "ready", "label": f"מוכן · {max(pages)} עמודים · {ext.upper()}"}
        return {"state": "partial", "label": f"חלקי · {len(pages)} עמודים · {ext.upper()}"}
    return {"state": "empty", "label": "תיקייה קיימת בלי עמודים"}


def state_payload() -> dict[str, Any]:
    config = read_config()
    taxonomy = current_taxonomy_state(config)
    missing_configured = configured_missing_pdfs(config)
    mutation = read_lock_metadata(PROJECT_ROOT) or {}
    with jobs_lock:
        active_jobs = [job for job in jobs.values() if job.status in {"running", "canceling"}]
        job_summaries = [serialize_job(job, include_log=False) for job in sorted(jobs.values(), key=lambda item: item.started_at, reverse=True)[:10]]
    active_job = max(active_jobs, key=lambda item: item.started_at) if active_jobs else None
    mutation_active = bool(mutation.get("token") or active_job)
    mutation_action = str(mutation.get("action") or (active_job.label if active_job else ""))
    actions: list[dict[str, Any]] = []
    for key, action in ACTIONS.items():
        enabled, reason = taxonomy_action_availability(key, taxonomy)
        if enabled and mutation_active:
            enabled = False
            reason = f"פעולת תחזוקה אחרת פעילה כעת: {mutation_action or 'פעולה אחרת'}"
        actions.append({
            "key": key,
            "label": action.label,
            "description": action.description,
            "disabled": not enabled,
            "disabledReason": reason,
        })
    payload = {
        "apiVersion": API_VERSION,
        "catalogs": [normalize_catalog_for_ui(item) for item in config],
        "taxonomy": taxonomy,
        "footer": read_footer_content(PROJECT_ROOT),
        "footerEditor": footer_editor_schema(),
        "counts": {
            "catalogs": len(config),
            "pdfs": len(iter_pdf_files()),
            "missingPdfs": missing_pdf_count(config),
            "configuredMissingPdfs": len(missing_configured),
            "ocrDisabled": sum(1 for item in config if not catalog_ocr_enabled(item)),
            "converted": sum(1 for item in config if catalog_output_status(str(item.get("id", ""))).get("state") == "ready"),
            "taxonomyMissing": len(taxonomy.get("issues", [])),
        },
        "files": {
            "config": rel_to_root(CONFIG_FILE),
            "taxonomy": rel_to_root(TAXONOMY_FILE),
            "generated": (PROJECT_ROOT / "catalogs.generated.js").is_file(),
            "search": (PROJECT_ROOT / "catalogs.search-index.json").is_file(),
            "pdfDir": rel_to_root(PDF_DIR),
            "pagesDir": rel_to_root(PAGES_DIR),
            "footerContent": rel_to_root(FOOTER_CONTENT_FILE),
        },
        "pdfFiles": pdf_files_payload(),
        "configuredMissingPdfs": missing_configured,
        "mutation": {
            "active": mutation_active,
            "action": mutation_action,
            "startedAt": mutation.get("startedAt") or (active_job.started_at if active_job else None),
        },
        "actions": actions,
        "jobs": job_summaries,
    }
    validate_control_panel_payload("ControlPanelStateDto", payload)
    return payload


def validate_catalogs_for_save(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        raise ValueError("catalogs must be an array")
    seen: set[str] = set()
    seen_original: set[str] = set()
    result: list[dict[str, Any]] = []
    for index, item in enumerate(value, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Catalog #{index} must be an object")
        row = dict(item)
        catalog_id = str(row.get("id", "")).strip().lower()
        original_id = str(row.get("originalId", row.get("_originalId", catalog_id))).strip().lower() or catalog_id
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
        row.pop("shareSlug", None)
        row.pop("status", None)
        seen.add(catalog_id)
        seen_original.add(original_id)
        result.append(row)
    return result


def configured_missing_pdfs(config: Sequence[Mapping[str, Any]] | None = None) -> list[dict[str, str]]:
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
    catalogs_value: Any,
    taxonomy_value: Any,
    asset_deletes_value: Any,
) -> dict[str, Any]:
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


def save_taxonomy_transactionally(taxonomy_value: Any) -> dict[str, Any]:
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


def python_executable() -> str:
    venv = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"
    if venv.is_file():
        return str(venv)
    return sys.executable


CONVERSION_ACTION_KEYS = frozenset({"convert", "convert_force", "refresh_ocr"})


def validate_missing_pdf_confirmation(request: RunActionRequest) -> None:
    if not request.prune_missing_pdfs:
        return
    if request.action not in CONVERSION_ACTION_KEYS:
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, "Missing-PDF pruning is only valid for conversion actions")
    current_missing_ids = tuple(sorted(item["id"] for item in configured_missing_pdfs()))
    if request.confirmed_missing_pdf_ids != current_missing_ids:
        raise ApiRequestError(
            HTTPStatus.CONFLICT,
            "The missing-PDF list changed. Refresh the panel and confirm the current list.",
        )


def action_command_for_job(
    action_key: str,
    *,
    prune_missing_pdfs: bool = False,
    confirmed_missing_pdf_ids: Sequence[str] = (),
) -> list[str]:
    action = ACTIONS.get(action_key)
    if not action:
        raise ValueError(f"Unknown action: {action_key}")
    command = list(action.command)
    if prune_missing_pdfs:
        if action_key not in CONVERSION_ACTION_KEYS:
            raise ValueError("Missing-PDF pruning is only valid for conversion actions")
        command.append("--prune-missing-pdfs")
        for catalog_id in sorted({str(value).strip() for value in confirmed_missing_pdf_ids if str(value).strip()}):
            command.extend(("--confirmed-missing-pdf-id", catalog_id))
    elif confirmed_missing_pdf_ids:
        raise ValueError("Confirmed missing-PDF ids require pruning")
    return command


def start_job(
    action_key: str,
    *,
    prune_missing_pdfs: bool = False,
    confirmed_missing_pdf_ids: Sequence[str] = (),
) -> Job:
    action = ACTIONS.get(action_key)
    if not action:
        raise ValueError(f"Unknown action: {action_key}")
    enabled, reason = taxonomy_action_availability(action_key, current_taxonomy_state())
    if not enabled:
        raise ValueError(reason)

    with job_start_lock:
        with jobs_lock:
            running = [item for item in jobs.values() if item.status in {"running", "canceling"}]
        if running:
            current = max(running, key=lambda item: item.started_at)
            raise MutationBusyError(
                f"לא ניתן להתחיל פעולה חדשה משום ש-{current.label} עדיין פועלת."
            )

        # Probe the cross-process lock before registering the job.  The worker
        # then acquires and owns the lock inside its own process, so closing the
        # control panel cannot release protection while the worker continues.
        with ProjectMutationLock(PROJECT_ROOT, f"בדיקת זמינות לפני {action.label}"):
            pass

        job = Job(id=uuid.uuid4().hex[:12], action_key=action_key, label=action.label, started_at=time.time())
        command = action_command_for_job(
            action_key,
            prune_missing_pdfs=prune_missing_pdfs,
            confirmed_missing_pdf_ids=confirmed_missing_pdf_ids,
        )
        with jobs_lock:
            jobs[job.id] = job

        try:
            thread = threading.Thread(target=run_job, args=(job, command), daemon=True)
            thread.start()
        except Exception:
            with jobs_lock:
                jobs.pop(job.id, None)
            raise
        return job


def _signal_job_process(process: subprocess.Popen[str]) -> str:
    """Request cooperative cancellation for a worker process group."""
    if process.poll() is not None:
        return "already-exited"
    if os.name == "nt":
        ctrl_break = getattr(signal, "CTRL_BREAK_EVENT", None)
        if ctrl_break is not None:
            try:
                process.send_signal(ctrl_break)
                return "ctrl-break"
            except (OSError, ValueError):
                pass
    else:
        try:
            os.killpg(process.pid, signal.SIGINT)
            return "sigint-group"
        except (OSError, ProcessLookupError):
            pass
    process.terminate()
    return "terminate"


def _escalate_job_cancellation(job: Job, process: subprocess.Popen[str]) -> None:
    try:
        process.wait(timeout=8)
        return
    except subprocess.TimeoutExpired:
        append_job_log(job, "[cancel] graceful stop timed out; terminating process group")

    try:
        if os.name != "nt":
            os.killpg(process.pid, signal.SIGTERM)
        else:
            process.terminate()
        process.wait(timeout=4)
        return
    except (OSError, ProcessLookupError, subprocess.TimeoutExpired):
        pass

    append_job_log(job, "[cancel] termination timed out; forcing process exit")
    try:
        if os.name != "nt":
            os.killpg(process.pid, signal.SIGKILL)
        else:
            process.kill()
    except (OSError, ProcessLookupError):
        pass


def cancel_job(job_id: str) -> Job:
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            raise ValueError("Job not found")
        if job.status not in {"running", "canceling"}:
            return job
        if job.cancel_requested:
            return job
        job.cancel_requested = True
        job.cancel_requested_at = time.time()
        job.status = "canceling"
        job.log.append("[cancel] stop requested from the control panel")
        process = job.process

    if process is not None and process.poll() is None:
        try:
            method = _signal_job_process(process)
            append_job_log(job, f"[cancel] signal sent: {method}")
        except Exception as exc:
            append_job_log(job, f"[cancel] failed to signal worker: {exc}")
        threading.Thread(
            target=_escalate_job_cancellation,
            args=(job, process),
            daemon=True,
        ).start()
    return job


def _recover_after_canceled_job(job: Job) -> str:
    try:
        with ProjectMutationLock(PROJECT_ROOT, f"שחזור לאחר עצירת {job.label}") as lock:
            recovered = tuple(lock.recovered_transactions)
        if recovered:
            return f"[cancel] recovered {len(recovered)} interrupted transaction(s)"
        return "[cancel] no interrupted transaction required recovery"
    except Exception as exc:
        raise RuntimeError(f"failed to recover the project after cancellation: {exc}") from exc


def run_job(job: Job, action_command: Sequence[str]) -> None:
    command = [python_executable(), *action_command]
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    # Jobs are piped into the browser rather than attached to a terminal.
    # Python otherwise block-buffers stdout/stderr and the control panel only
    # receives progress after a large buffer fills or the process exits.  Keep
    # the direct worker and any Python subprocesses it starts unbuffered so the
    # existing 500 ms UI poll can display each completed line promptly.
    env["PYTHONUNBUFFERED"] = "1"
    append_job_log(job, f"$ {' '.join(action_command)}")
    try:
        with jobs_lock:
            if job.cancel_requested:
                job.returncode = 130
                job.finished_at = time.time()
                job.status = "canceled"
                job.log.append("[cancel] canceled before worker startup")
                return

        popen_options: dict[str, Any] = {}
        if os.name == "nt":
            popen_options["creationflags"] = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0)
        else:
            popen_options["start_new_session"] = True

        process = subprocess.Popen(
            command,
            cwd=PROJECT_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
            **popen_options,
        )
        with jobs_lock:
            job.process = process
            cancel_raced = job.cancel_requested

        if cancel_raced and process.poll() is None:
            method = _signal_job_process(process)
            append_job_log(job, f"[cancel] signal sent after startup race: {method}")
            threading.Thread(target=_escalate_job_cancellation, args=(job, process), daemon=True).start()

        assert process.stdout is not None
        for line in process.stdout:
            append_job_log(job, line.rstrip("\n"))
        returncode = process.wait()

        recovery_message = ""
        recovery_error = ""
        if job.cancel_requested:
            try:
                recovery_message = _recover_after_canceled_job(job)
            except Exception as exc:
                recovery_error = str(exc)

        with jobs_lock:
            job.process = None
            job.returncode = returncode
            job.finished_at = time.time()
            if job.cancel_requested and not recovery_error:
                job.status = "canceled"
                job.log.append(recovery_message)
                job.log.append(f"[done] canceled; return code: {returncode}")
            elif recovery_error:
                job.status = "failed"
                job.log.append(f"ERROR: {recovery_error}")
            else:
                job.status = "success" if returncode == 0 else "failed"
                job.log.append(f"[done] return code: {returncode}")
    except Exception as exc:
        with jobs_lock:
            job.process = None
            job.returncode = -1
            job.finished_at = time.time()
            job.status = "failed"
            job.log.append(f"ERROR: {exc}")


def append_job_log(job: Job, line: str) -> None:
    with jobs_lock:
        job.log.append(line)
        if len(job.log) > 3000:
            job.log = job.log[-3000:]


def serialize_job(job: Job, include_log: bool = True) -> dict[str, Any]:
    data = {
        "id": job.id,
        "actionKey": job.action_key,
        "label": job.label,
        "status": job.status,
        "returncode": job.returncode,
        "startedAt": job.started_at,
        "finishedAt": job.finished_at,
        "cancelRequested": job.cancel_requested,
        "cancelRequestedAt": job.cancel_requested_at,
    }
    if include_log:
        data["log"] = job.log
    return data


@dataclass(frozen=True)
class ControlServerSettings:
    bind_host: str
    port: int
    allowed_hosts: frozenset[str]
    remote_mode: bool
    token: str | None = None


class ControlHTTPServer(ThreadingHTTPServer):
    def __init__(self, address: tuple[str, int], settings: ControlServerSettings) -> None:
        super().__init__(address, ControlHandler)
        self.settings = settings


def _normalized_hostname(value: str) -> str:
    raw = value.strip().lower()
    if not raw:
        return ""
    literal = raw.strip("[]")
    try:
        return str(ipaddress.ip_address(literal))
    except ValueError:
        pass
    try:
        parsed = urlparse(f"//{raw}")
        return str(parsed.hostname or "").rstrip(".")
    except ValueError:
        return ""


def _is_loopback_host(host: str) -> bool:
    normalized = _normalized_hostname(host)
    if normalized == "localhost":
        return True
    try:
        return ipaddress.ip_address(normalized).is_loopback
    except ValueError:
        return False


def build_server_settings(
    host: str,
    port: int,
    *,
    allow_remote: bool = False,
    allowed_hosts: Sequence[str] = (),
    token: str | None = None,
) -> ControlServerSettings:
    normalized_bind = _normalized_hostname(host)
    local = _is_loopback_host(normalized_bind)
    if not local and not allow_remote:
        raise ValueError("Binding the control panel outside loopback requires --allow-remote")

    normalized_allowed = {_normalized_hostname(item) for item in allowed_hosts}
    normalized_allowed.discard("")
    if local:
        normalized_allowed.update({"localhost", "127.0.0.1", "::1"})
        if normalized_bind:
            normalized_allowed.add(normalized_bind)
    else:
        if normalized_bind not in {"0.0.0.0", "::"}:
            normalized_allowed.add(normalized_bind)
        if not normalized_allowed:
            raise ValueError("Remote mode requires at least one --allowed-host")

    remote_mode = not local
    normalized_token = str(token or "").strip() or None
    if remote_mode and normalized_token is not None and len(normalized_token) < 20:
        raise ValueError("Remote control token must contain at least 20 characters")
    if remote_mode and normalized_token is None:
        normalized_token = secrets.token_urlsafe(32)
    if not remote_mode:
        normalized_token = None

    return ControlServerSettings(
        bind_host=host,
        port=int(port),
        allowed_hosts=frozenset(normalized_allowed),
        remote_mode=remote_mode,
        token=normalized_token,
    )


class ControlHandler(BaseHTTPRequestHandler):
    server_version = "CatalogControlPanel/2.0"

    @property
    def control_settings(self) -> ControlServerSettings:
        server = cast(ControlHTTPServer, self.server)
        return server.settings

    def _request_token(self) -> str:
        header = str(self.headers.get("X-Control-Token", "") or "").strip()
        if header:
            return header
        cookie = SimpleCookie()
        try:
            cookie.load(str(self.headers.get("Cookie", "") or ""))
        except Exception:
            return ""
        morsel = cookie.get("catalog_control_token")
        return morsel.value if morsel else ""

    def _validate_request_security(self, *, require_origin: bool) -> None:
        settings = self.control_settings
        host = _normalized_hostname(str(self.headers.get("Host", "") or ""))
        if not host or host not in settings.allowed_hosts:
            raise ApiRequestError(HTTPStatus.FORBIDDEN, "Host is not allowed")

        fetch_site = str(self.headers.get("Sec-Fetch-Site", "") or "").lower()
        if fetch_site == "cross-site":
            raise ApiRequestError(HTTPStatus.FORBIDDEN, "Cross-site request is not allowed")

        origin = str(self.headers.get("Origin", "") or "").strip()
        if require_origin and settings.remote_mode and not origin:
            raise ApiRequestError(HTTPStatus.FORBIDDEN, "Origin header is required in remote mode")
        if origin:
            parsed_origin = urlparse(origin)
            if parsed_origin.scheme not in {"http", "https"}:
                raise ApiRequestError(HTTPStatus.FORBIDDEN, "Origin is not allowed")
            origin_host = str(parsed_origin.hostname or "").lower().rstrip(".")
            origin_port = parsed_origin.port or (443 if parsed_origin.scheme == "https" else 80)
            if origin_host not in settings.allowed_hosts or origin_port != settings.port:
                raise ApiRequestError(HTTPStatus.FORBIDDEN, "Origin is not allowed")

        if settings.token and not hmac.compare_digest(self._request_token(), settings.token):
            raise ApiRequestError(HTTPStatus.UNAUTHORIZED, "Control token is required")

    def _accept_token_bootstrap(self, parsed: Any) -> bool:
        settings = self.control_settings
        if not settings.token or parsed.path not in {"/", "", "/catalog-control-panel", "/catalog-control-panel/", "/catalog-control-panel.html"}:
            return False
        supplied = (parse_qs(parsed.query).get("token") or [""])[0]
        if not supplied or not hmac.compare_digest(supplied, settings.token):
            return False
        host = _normalized_hostname(str(self.headers.get("Host", "") or ""))
        if host not in settings.allowed_hosts:
            raise ApiRequestError(HTTPStatus.FORBIDDEN, "Host is not allowed")
        self.send_response(HTTPStatus.FOUND)
        self._send_security_headers()
        self.send_header("Location", "/catalog-control-panel.html")
        self.send_header(
            "Set-Cookie",
            f"catalog_control_token={settings.token}; HttpOnly; SameSite=Strict; Path=/",
        )
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.end_headers()
        return True

    def do_GET(self) -> None:  # noqa: N802
        try:
            parsed = urlparse(self.path)
            if self._accept_token_bootstrap(parsed):
                return
            self._validate_request_security(require_origin=False)
            path = unquote(parsed.path)
            if path in {"/", ""}:
                self.redirect("/catalog-control-panel.html")
                return
            if path in {"/catalog-control-panel", "/catalog-control-panel/"}:
                self.redirect("/catalog-control-panel.html")
                return
            if path == "/api/state":
                self.send_contract_json("ControlPanelStateDto", state_payload())
                return
            if path == "/api/pdfs":
                self.send_contract_json("PdfListResponseDto", {"pdfs": pdf_files_payload(), "pdfDir": rel_to_root(PDF_DIR)})
                return
            if path == "/api/jobs":
                with jobs_lock:
                    payload = [serialize_job(job, include_log=False) for job in sorted(jobs.values(), key=lambda item: item.started_at, reverse=True)]
                self.send_contract_json("JobListResponseDto", {"jobs": payload})
                return
            if path.startswith("/api/jobs/"):
                job_id = path.rsplit("/", 1)[-1]
                with jobs_lock:
                    job = jobs.get(job_id)
                    payload = serialize_job(job) if job else None
                if not payload:
                    self.send_error_json(HTTPStatus.NOT_FOUND, "Job not found")
                    return
                self.send_contract_json("ControlJobDto", payload)
                return
            self.serve_static(path)
        except ApiRequestError as exc:
            self.send_error_json(exc.status, str(exc))
        except Exception as exc:
            print(f"ERROR: GET {self.path}: {exc}", file=sys.stderr)
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "Internal server error")

    def do_POST(self) -> None:  # noqa: N802
        try:
            parsed = urlparse(self.path)
            self._validate_request_security(require_origin=True)
            path = unquote(parsed.path)
            if path == "/api/pdf-pick-native":
                pick_request = read_json_body(self)
                validate_request_payload("PdfPickRequestDto", pick_request)
                picked = pick_native_pdf_file()
                if picked.get("canceled"):
                    self.send_contract_json("PdfPickResponseDto", {"ok": True, "canceled": True, "errors": picked.get("errors", [])})
                    return
                self.send_contract_json("PdfPickResponseDto", {"ok": True, "pdf": picked["pdf"], "pdfFiles": pdf_files_payload(), "state": state_payload()})
                return
            if path == "/api/pdf-upload":
                filename, content = read_multipart_pdf_upload(self)
                upload = save_uploaded_pdf(filename, content)
                self.send_contract_json("PdfUploadResponseDto", {"ok": True, "pdf": upload, "pdfFiles": pdf_files_payload(), "state": state_payload()})
                return

            cancel_match = re.fullmatch(r"/api/jobs/([a-z0-9]+)/cancel", path)
            if cancel_match:
                cancel_request = read_json_body(self)
                validate_request_payload("EmptyRequestDto", cancel_request)
                job = cancel_job(cancel_match.group(1))
                self.send_contract_json("CancelJobResponseDto", {"ok": True, "job": serialize_job(job)})
                return

            payload = read_json_body(self)
            if path == "/api/footer":
                request = FooterSaveRequest.parse(payload)
                with footer_save_lock:
                    with ProjectMutationLock(PROJECT_ROOT, "שמירת הפוטר מלוח השליטה"):
                        footer = save_footer_content_and_render_pages(request.footer)
                self.send_contract_json("FooterSaveResponseDto", {"ok": True, "footer": footer, "state": state_payload(), "updatedPages": [page.filename for page in PAGE_DOCUMENTS]})
                return
            if path == "/api/catalogs":
                request = CatalogSaveRequest.parse(payload)
                with taxonomy_save_lock:
                    result = save_catalogs_transactionally(
                        request.catalogs,
                        request.taxonomy,
                        request.asset_deletes,
                    )
                self.send_contract_json("CatalogSaveResponseDto", {
                    "ok": True,
                    "state": state_payload(),
                    "warnings": result["warnings"],
                    "autoAddedTaxonomy": result["autoAddedTaxonomy"],
                    "grouped": True,
                    "deletedAssets": result["deletedAssets"],
                    "routeLockUpdates": result["routeLockUpdates"],
                })
                return
            if path == "/api/taxonomy":
                request = TaxonomySaveRequest.parse(payload)
                with taxonomy_save_lock:
                    result = save_taxonomy_transactionally(request.taxonomy)
                self.send_contract_json("TaxonomySaveResponseDto", {
                    "ok": True,
                    "state": state_payload(),
                    "warnings": result["warnings"],
                    "autoAddedTaxonomy": result["autoAddedTaxonomy"],
                    "routeLockUpdates": result["routeLockUpdates"],
                })
                return
            if path == "/api/run":
                request = RunActionRequest.parse(payload)
                validate_missing_pdf_confirmation(request)
                job = start_job(
                    request.action,
                    prune_missing_pdfs=request.prune_missing_pdfs,
                    confirmed_missing_pdf_ids=request.confirmed_missing_pdf_ids,
                )
                self.send_contract_json("RunActionResponseDto", {"ok": True, "job": serialize_job(job)})
                return
            self.send_error_json(HTTPStatus.NOT_FOUND, "Unknown API route")
        except ApiRequestError as exc:
            self.send_error_json(exc.status, str(exc))
        except (ValueError, MutationBusyError) as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
        except Exception as exc:
            print(f"ERROR: POST {self.path}: {exc}", file=sys.stderr)
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "Internal server error")

    def serve_static(self, url_path: str) -> None:
        file_path = STATIC_FILES.get(url_path)
        if file_path is None or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        content_types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
        }
        content_type = content_types.get(file_path.suffix.lower(), "application/octet-stream")
        raw = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self._send_security_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _send_security_headers(self) -> None:
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")

    def send_contract_json(self, contract: str, payload: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        try:
            validate_control_panel_payload(contract, payload)
        except ControlPanelSchemaError as exc:
            raise RuntimeError(f"Control-panel response violates {contract}: {exc}") from exc
        self.send_json(payload, status=status)

    def send_json(self, payload: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._send_security_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def send_error_json(self, status: HTTPStatus, message: str) -> None:
        self.send_contract_json("ErrorResponseDto", {"ok": False, "error": message}, status=status)

    def redirect(self, location: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self._send_security_headers()
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Open the local catalog control panel.")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Bind address. Default: 127.0.0.1")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Local port. Default: 8765")
    parser.add_argument("--no-open", action="store_true", help="Do not open the browser automatically")
    parser.add_argument("--allow-remote", action="store_true", help="Explicitly permit a non-loopback bind")
    parser.add_argument("--allowed-host", action="append", default=[], help="Host name/IP accepted in remote mode; repeat as needed")
    parser.add_argument("--token", default="", help="Remote access token; generated automatically when omitted")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        with ProjectMutationLock(PROJECT_ROOT, "בדיקת ושחזור מצב הפרויקט לפני פתיחת לוח השליטה") as lock:
            if lock.recovered_transactions:
                print(f"Recovered {len(lock.recovered_transactions)} interrupted project transaction(s).")
    except MutationBusyError:
        # Another valid worker may already be active.  The panel can still open,
        # display that operation and keep all mutation actions disabled.
        pass
    except Exception as exc:
        print(f"ERROR: Failed to recover the project before starting the control panel: {exc}", file=sys.stderr)
        return 1
    try:
        settings = build_server_settings(
            str(args.host),
            int(args.port),
            allow_remote=bool(args.allow_remote),
            allowed_hosts=tuple(args.allowed_host),
            token=str(args.token or ""),
        )
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    server = ControlHTTPServer((settings.bind_host, settings.port), settings)
    display_host = next(iter(sorted(settings.allowed_hosts))) if settings.remote_mode else settings.bind_host
    url = f"http://{display_host}:{settings.port}/catalog-control-panel.html"
    open_url = f"{url}?token={settings.token}" if settings.token else url
    print(f"Catalog control panel: {url}")
    if settings.remote_mode:
        print("WARNING: Remote control mode is enabled. Keep the token private and stop the server when finished.")
        print(f"One-time authenticated URL: {open_url}")
    print("Press Ctrl+C to stop.")
    if not args.no_open:
        threading.Timer(0.5, lambda: webbrowser.open(open_url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        return 0
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
