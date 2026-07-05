#!/usr/bin/env python3
"""Local control panel for catalog maintenance.

This server is intentionally localhost-only. It exposes a small browser UI for
editing catalogs.config.json and for running the existing fixed maintenance
commands without giving the browser arbitrary shell access.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = PROJECT_ROOT / "catalogs.config.json"
GENERATED_JSON_FILE = PROJECT_ROOT / "catalogs.generated.json"
GENERATED_JS_FILE = PROJECT_ROOT / "catalogs.generated.js"
SEARCH_JSON_FILE = PROJECT_ROOT / "catalogs.search.json"
SEARCH_JS_FILE = PROJECT_ROOT / "catalogs.search.js"
SEARCH_OVERRIDES_FILE = PROJECT_ROOT / "catalogs.search-overrides.json"
PDF_DIR = PROJECT_ROOT / "assets" / "pdfs"
PAGES_DIR = PROJECT_ROOT / "assets" / "pages"
CATALOG_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
PAGE_RE = re.compile(r"^page-(\d{3})\.(webp|jpg|png)$", re.IGNORECASE)

BASE_CONVERT_ARGS = [
    "tools/build_catalogs.py",
    "--format", "webp",
    "--dpi", "220",
    "--max-width", "2800",
    "--max-height", "2800",
    "--thumb-size", "420",
    "--quality", "84",
    "--thumb-quality", "76",
    "--sharpen", "0.8",
    "--ocr-lang", "heb+eng",
    "--ocr-dpi", "260",
]


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
        "ממיר רק קטלוגים חסרים/שהשתנו. OCR במצב auto, אבל קטלוג עם ocr=false ידולג ב-OCR.",
        [*BASE_CONVERT_ARGS, "--ocr", "auto"],
    ),
    "convert_delete": Action(
        "המרה רגילה + מחיקת לא רשומים",
        "ממיר חסרים/שהשתנו ומוחק תיקיות assets/pages שלא קיימות יותר ב-catalogs.config.json.",
        ["tools/build_catalogs.py", "--delete-unlisted", *BASE_CONVERT_ARGS[1:], "--ocr", "auto"],
    ),
    "convert_force": Action(
        "המרה מחדש לכל הקטלוגים",
        "מרנדר מחדש את כל הקטלוגים הרשומים, בלי למחוק קטלוגים לא רשומים.",
        ["tools/build_catalogs.py", "--force", *BASE_CONVERT_ARGS[1:], "--ocr", "auto"],
    ),
    "convert_delete_force": Action(
        "המרה מחדש + מחיקת לא רשומים",
        "מרנדר הכל מחדש ומנקה תיקיות קטלוגים שאינן רשומות בקובץ ההגדרות.",
        ["tools/build_catalogs.py", "--force", "--delete-unlisted", *BASE_CONVERT_ARGS[1:], "--ocr", "auto"],
    ),
    "refresh_ocr": Action(
        "רענון אינדקס חיפוש/OCR בלבד",
        "בונה מחדש את catalogs.search.* בלי לרנדר מחדש תמונות קיימות, ככל האפשר.",
        ["tools/build_catalogs.py", "--force", "--no-clean", "--skip-existing", *BASE_CONVERT_ARGS[1:], "--ocr", "auto"],
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
        "יוצר dist/site-upload-r2 כשהתמונות נטענות מה-CDN הקבוע.",
        ["tools/build_deploy_bundle.py", "--external-assets-url", "https://cdn.bargig-furniture.com"],
    ),
}


@dataclass
class Job:
    id: str
    action_key: str
    label: str
    started_at: float
    status: str = "running"
    returncode: int | None = None
    finished_at: float | None = None
    log: list[str] = field(default_factory=list)


jobs: dict[str, Job] = {}
jobs_lock = threading.Lock()


def rel_to_root(path: Path) -> str:
    try:
        return path.resolve(strict=False).relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def read_json_body(handler: BaseHTTPRequestHandler) -> dict[str, Any]:
    length = int(handler.headers.get("Content-Length", "0") or "0")
    if length <= 0:
        return {}
    raw = handler.rfile.read(length)
    if not raw:
        return {}
    payload = json.loads(raw.decode("utf-8-sig"))
    if not isinstance(payload, dict):
        raise ValueError("JSON body must be an object")
    return payload


def read_config() -> list[dict[str, Any]]:
    if not CONFIG_FILE.exists():
        return []
    payload = json.loads(CONFIG_FILE.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, list):
        raise ValueError("catalogs.config.json must contain a JSON array")
    result: list[dict[str, Any]] = []
    for index, item in enumerate(payload, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Catalog #{index} must be an object")
        result.append(dict(item))
    return result


def write_config(config: list[dict[str, Any]]) -> None:
    CONFIG_FILE.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


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

        subcategory_key = group_value(item.get("subcategory", item.get("subCategory", "")))
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


def catalog_asset_path_for_renamed_id(value: Any, old_id: str, new_id: str) -> Any:
    if not isinstance(value, str) or old_id == new_id:
        return value
    normalized = value.replace("\\", "/")
    old_prefix = f"assets/pages/{old_id}"
    new_prefix = f"assets/pages/{new_id}"
    if normalized == old_prefix:
        return new_prefix
    if normalized.startswith(old_prefix + "/"):
        return new_prefix + normalized[len(old_prefix):]
    return value


def build_catalog_rename_map(config: list[dict[str, Any]]) -> dict[str, str]:
    rename_map: dict[str, str] = {}
    for item in config:
        original_id = str(item.get("__original_id", item.get("id", ""))).strip()
        catalog_id = str(item.get("id", "")).strip()
        if original_id and catalog_id and original_id != catalog_id:
            rename_map[original_id] = catalog_id
    return rename_map


def config_for_file(config: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [strip_control_panel_fields(item) for item in config]


def apply_pages_dir_renames(rename_map: dict[str, str]) -> list[str]:
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


def sync_search_overrides_after_id_rename(rename_map: dict[str, str]) -> list[str]:
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
        SEARCH_OVERRIDES_FILE.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return warnings


def read_json_array(path: Path) -> list[dict[str, Any]] | None:
    if not path.is_file():
        return None
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, list):
        raise ValueError(f"{rel_to_root(path)} must contain a JSON array")
    result: list[dict[str, Any]] = []
    for index, item in enumerate(payload, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"{rel_to_root(path)} item #{index} must be an object")
        result.append(dict(item))
    return result


def write_catalogs_generated_files(entries: list[dict[str, Any]]) -> None:
    payload = json.dumps(entries, ensure_ascii=False, indent=2)
    GENERATED_JSON_FILE.write_text(payload + "\n", encoding="utf-8")
    GENERATED_JS_FILE.write_text(
        "// הקובץ הזה נוצר אוטומטית על ידי tools/build_catalogs.py\n"
        "// לא מומלץ לערוך אותו ידנית. עריכה עושים בקובץ catalogs.config.json ואז מריצים שוב המרה.\n"
        f"window.BARGIG_CATALOGS = {payload};\n",
        encoding="utf-8",
    )


def write_catalogs_search_files(entries: list[dict[str, Any]]) -> None:
    payload = json.dumps(entries, ensure_ascii=False, indent=2)
    SEARCH_JSON_FILE.write_text(payload + "\n", encoding="utf-8")
    SEARCH_JS_FILE.write_text(
        "// הקובץ הזה נוצר אוטומטית על ידי tools/build_catalogs.py\n"
        "// כאן נמצא אינדקס החיפוש שנוצר מטקסט ה-PDF ומ-OCR.\n"
        f"window.BARGIG_CATALOG_SEARCH = {payload};\n",
        encoding="utf-8",
    )


def sync_generated_metadata_after_config_save(config: list[dict[str, Any]], rename_map: dict[str, str] | None = None) -> list[str]:
    """Keep the already-generated website metadata aligned after UI edits.

    Saving the control panel edits should immediately affect title,
    description, category, subcategory, deletion, ordering and catalog id
    changes for catalogs that already exist in catalogs.generated.*. New PDFs
    still require conversion to create page images and their first generated
    entry.
    """
    warnings: list[str] = []
    rename_map = rename_map or {}
    config_by_id = {str(item.get("id", "")): item for item in config}
    config_order = [str(item.get("id", "")) for item in config]
    order_index = {catalog_id: index for index, catalog_id in enumerate(config_order)}

    try:
        generated_entries = read_json_array(GENERATED_JSON_FILE)
    except Exception as exc:
        warnings.append(f"catalogs.config.json נשמר, אבל עדכון catalogs.generated.* נכשל: {exc}")
        generated_entries = None

    if generated_entries is not None:
        updated_generated: list[dict[str, Any]] = []
        generated_by_id: dict[str, dict[str, Any]] = {}
        generated_priority: dict[str, int] = {}
        for item in generated_entries:
            original_id = str(item.get("id", ""))
            effective_id = rename_map.get(original_id, original_id)
            if effective_id not in config_by_id:
                continue
            updated = dict(item)
            if effective_id != original_id:
                updated["id"] = effective_id
                updated["dir"] = catalog_asset_path_for_renamed_id(updated.get("dir"), original_id, effective_id)
                updated["cover"] = catalog_asset_path_for_renamed_id(updated.get("cover"), original_id, effective_id)
            priority = 1 if original_id in rename_map else 0
            if effective_id not in generated_by_id or priority >= generated_priority.get(effective_id, 0):
                generated_by_id[effective_id] = updated
                generated_priority[effective_id] = priority

        for catalog_id in config_order:
            entry = generated_by_id.get(catalog_id)
            source = config_by_id.get(catalog_id)
            if not entry or not source:
                continue
            updated = dict(entry)
            updated["id"] = catalog_id
            updated["title"] = str(source.get("title", catalog_id))
            updated["description"] = str(source.get("description", ""))
            updated["category"] = str(source.get("category", "קטלוג")) or "קטלוג"

            subcategory = str(source.get("subcategory", source.get("subCategory", "")))
            if subcategory or "subcategory" in updated:
                updated["subcategory"] = subcategory

            for key in ("sort", "badge"):
                if key in source:
                    updated[key] = source[key]
                elif key in updated and key not in source:
                    updated.pop(key, None)

            updated_generated.append(updated)

        try:
            write_catalogs_generated_files(updated_generated)
        except Exception as exc:
            warnings.append(f"catalogs.config.json נשמר, אבל כתיבת catalogs.generated.* נכשלה: {exc}")

    try:
        search_entries = read_json_array(SEARCH_JSON_FILE)
    except Exception as exc:
        warnings.append(f"catalogs.config.json נשמר, אבל עדכון catalogs.search.* נכשל: {exc}")
        search_entries = None

    if search_entries is not None:
        search_by_id: dict[str, dict[str, Any]] = {}
        search_priority: dict[str, int] = {}
        for item in search_entries:
            original_id = str(item.get("catalogId", ""))
            effective_id = rename_map.get(original_id, original_id)
            if effective_id not in config_by_id:
                continue
            entry = dict(item)
            entry["catalogId"] = effective_id
            priority = 1 if original_id in rename_map else 0
            if effective_id not in search_by_id or priority >= search_priority.get(effective_id, 0):
                search_by_id[effective_id] = entry
                search_priority[effective_id] = priority

        updated_search: list[dict[str, Any]] = []
        for catalog_id in sorted(search_by_id, key=lambda item: order_index.get(item, 10**9)):
            entry = search_by_id[catalog_id]
            source = config_by_id[catalog_id]
            entry["title"] = str(source.get("title", entry.get("title", "")))
            updated_search.append(entry)
        try:
            write_catalogs_search_files(updated_search)
        except Exception as exc:
            warnings.append(f"catalogs.config.json נשמר, אבל כתיבת catalogs.search.* נכשלה: {exc}")

    return warnings


def normalize_catalog_for_ui(item: dict[str, Any]) -> dict[str, Any]:
    row = dict(item)
    row["originalId"] = str(row.get("id", ""))
    row["ocr"] = catalog_ocr_enabled(row)
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


def missing_pdf_count(config: list[dict[str, Any]]) -> int:
    configured = {normalized_project_path(item.get("pdf")) for item in config if item.get("pdf")}
    return sum(1 for path in iter_pdf_files() if normalized_project_path(path) not in configured)


def catalog_output_status(catalog_id: str) -> dict[str, Any]:
    catalog_id = str(catalog_id or "").strip()
    out_dir = PAGES_DIR / catalog_id if catalog_id else PAGES_DIR / "__missing__"
    if not out_dir.is_dir():
        return {"state": "missing", "label": "לא הומר"}

    pages_by_ext: dict[str, set[int]] = {}
    thumbs_by_ext: dict[str, set[int]] = {}
    for file_path in out_dir.iterdir():
        if file_path.is_file():
            match = PAGE_RE.match(file_path.name)
            if match:
                pages_by_ext.setdefault(match.group(2).lower(), set()).add(int(match.group(1)))
    thumb_dir = out_dir / "thumbs"
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
        missing_thumbs = expected - thumbs_by_ext.get(ext, set())
        if 1 in pages and not missing_pages and not missing_thumbs:
            return {"state": "ready", "label": f"מוכן · {max(pages)} עמודים · {ext.upper()}"}
        return {"state": "partial", "label": f"חלקי · {len(pages)} עמודים · {ext.upper()}"}
    return {"state": "empty", "label": "תיקייה קיימת בלי עמודים"}


def state_payload() -> dict[str, Any]:
    config = read_config()
    with jobs_lock:
        job_summaries = [serialize_job(job, include_log=False) for job in sorted(jobs.values(), key=lambda item: item.started_at, reverse=True)[:10]]
    return {
        "catalogs": [normalize_catalog_for_ui(item) for item in config],
        "counts": {
            "catalogs": len(config),
            "pdfs": len(iter_pdf_files()),
            "missingPdfs": missing_pdf_count(config),
            "ocrDisabled": sum(1 for item in config if not catalog_ocr_enabled(item)),
            "converted": sum(1 for item in config if catalog_output_status(str(item.get("id", ""))).get("state") == "ready"),
        },
        "files": {
            "config": rel_to_root(CONFIG_FILE),
            "generated": (PROJECT_ROOT / "catalogs.generated.js").is_file(),
            "search": (PROJECT_ROOT / "catalogs.search.js").is_file(),
            "pdfDir": rel_to_root(PDF_DIR),
            "pagesDir": rel_to_root(PAGES_DIR),
        },
        "actions": [
            {"key": key, "label": action.label, "description": action.description}
            for key, action in ACTIONS.items()
        ],
        "jobs": job_summaries,
    }


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
        row["id"] = catalog_id
        row["__original_id"] = original_id
        row["title"] = title or catalog_id
        row["description"] = str(row.get("description", ""))
        row["category"] = group_value(row.get("category", ""))
        row["subcategory"] = group_value(row.get("subcategory", row.get("subCategory", "")))
        row["pdf"] = pdf.replace("\\", "/")
        row["ocr"] = catalog_ocr_enabled(row)
        row.pop("shareSlug", None)
        row.pop("status", None)
        seen.add(catalog_id)
        seen_original.add(original_id)
        result.append(row)
    return result


def python_executable() -> str:
    venv = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"
    if venv.is_file():
        return str(venv)
    return sys.executable


def start_job(action_key: str) -> Job:
    action = ACTIONS.get(action_key)
    if not action:
        raise ValueError(f"Unknown action: {action_key}")

    job = Job(id=uuid.uuid4().hex[:12], action_key=action_key, label=action.label, started_at=time.time())
    with jobs_lock:
        jobs[job.id] = job

    thread = threading.Thread(target=run_job, args=(job, action), daemon=True)
    thread.start()
    return job


def run_job(job: Job, action: Action) -> None:
    command = [python_executable(), *action.command]
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    append_job_log(job, f"$ {' '.join(action.command)}")
    try:
        process = subprocess.Popen(
            command,
            cwd=PROJECT_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
        )
        assert process.stdout is not None
        for line in process.stdout:
            append_job_log(job, line.rstrip("\n"))
        returncode = process.wait()
        with jobs_lock:
            job.returncode = returncode
            job.finished_at = time.time()
            job.status = "success" if returncode == 0 else "failed"
            job.log.append(f"[done] return code: {returncode}")
    except Exception as exc:
        with jobs_lock:
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
    }
    if include_log:
        data["log"] = job.log
    return data


class ControlHandler(BaseHTTPRequestHandler):
    server_version = "CatalogControlPanel/1.0"

    def do_GET(self) -> None:  # noqa: N802
        try:
            parsed = urlparse(self.path)
            path = unquote(parsed.path)
            if path in {"/", ""}:
                self.redirect("/catalog-control-panel.html")
                return
            if path in {"/catalog-control-panel", "/catalog-control-panel/"}:
                self.redirect("/catalog-control-panel.html")
                return
            if path == "/api/state":
                self.send_json(state_payload())
                return
            if path == "/api/jobs":
                with jobs_lock:
                    payload = [serialize_job(job, include_log=False) for job in sorted(jobs.values(), key=lambda item: item.started_at, reverse=True)]
                self.send_json({"jobs": payload})
                return
            if path.startswith("/api/jobs/"):
                job_id = path.rsplit("/", 1)[-1]
                with jobs_lock:
                    job = jobs.get(job_id)
                    payload = serialize_job(job) if job else None
                if not payload:
                    self.send_error_json(HTTPStatus.NOT_FOUND, "Job not found")
                    return
                self.send_json(payload)
                return
            self.serve_static(path)
        except Exception as exc:
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, str(exc))

    def do_POST(self) -> None:  # noqa: N802
        try:
            parsed = urlparse(self.path)
            path = unquote(parsed.path)
            payload = read_json_body(self)
            if path == "/api/catalogs":
                catalogs = validate_catalogs_for_save(payload.get("catalogs"))
                catalogs = group_catalogs_by_category_subcategory(catalogs)
                rename_map = build_catalog_rename_map(catalogs)
                warnings = apply_pages_dir_renames(rename_map)
                file_catalogs = config_for_file(catalogs)
                write_config(file_catalogs)
                try:
                    warnings.extend(sync_search_overrides_after_id_rename(rename_map))
                except Exception as exc:
                    warnings.append(f"catalogs.config.json נשמר, אבל עדכון catalogs.search-overrides.json נכשל: {exc}")
                warnings.extend(sync_generated_metadata_after_config_save(file_catalogs, rename_map))
                self.send_json({"ok": True, "state": state_payload(), "warnings": warnings, "grouped": True, "renamed": rename_map})
                return
            if path == "/api/run":
                job = start_job(str(payload.get("action", "")).strip())
                self.send_json({"ok": True, "job": serialize_job(job)})
                return
            self.send_error_json(HTTPStatus.NOT_FOUND, "Unknown API route")
        except Exception as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))

    def serve_static(self, url_path: str) -> None:
        relative = url_path.lstrip("/") or "catalog-control-panel.html"
        if "/" in relative or "\\" in relative:
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        file_path = (PROJECT_ROOT / relative).resolve(strict=False)
        if file_path.parent != PROJECT_ROOT.resolve() or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        content_type = "text/html; charset=utf-8" if file_path.suffix.lower() == ".html" else "text/plain; charset=utf-8"
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(file_path.read_bytes())

    def send_json(self, payload: Any, status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def send_error_json(self, status: HTTPStatus, message: str) -> None:
        self.send_json({"ok": False, "error": message}, status=status)

    def redirect(self, location: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self.send_header("Location", location)
        self.end_headers()

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Open the local catalog control panel.")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Bind address. Default: 127.0.0.1")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Local port. Default: 8765")
    parser.add_argument("--no-open", action="store_true", help="Do not open the browser automatically")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    server = ThreadingHTTPServer((str(args.host), int(args.port)), ControlHandler)
    url = f"http://{args.host}:{args.port}/catalog-control-panel.html"
    print(f"Catalog control panel: {url}")
    print("Press Ctrl+C to stop.")
    if not args.no_open:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
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
