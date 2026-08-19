#!/usr/bin/env python3
"""PDF and project-asset boundary for the catalog control panel."""
from __future__ import annotations

import base64
import filecmp
import re
import shutil
import subprocess
import sys
import threading
import uuid
from dataclasses import dataclass
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler
from pathlib import Path
from typing import Mapping

from catalog_types import CatalogConfig

from catalog_control_api import MAX_PDF_UPLOAD_BYTES, ApiRequestError, content_length
from catalog_control_paths import CATALOG_ID_RE, PAGE_RE, PAGES_DIR, PDF_DIR, PROJECT_ROOT, rel_to_root
from project_mutation import ProjectMutationLock

native_dialog_lock = threading.Lock()

@dataclass(frozen=True)
class AssetDeleteTarget:
    path: Path
    label: str
    kind: str


def is_safe_catalog_id(catalog_id: str) -> bool:
    return bool(CATALOG_ID_RE.fullmatch(str(catalog_id or "")))

def normalized_project_path(path_value: object) -> str:
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


def normalize_pdf_for_config(path_value: object) -> str:
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


def pdf_file_payload(path: Path) -> dict[str, object]:
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


def pdf_files_payload() -> list[dict[str, object]]:
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


def save_uploaded_pdf(filename: str, content: bytes) -> dict[str, object]:
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


def selected_pdf_payload(source_path: Path) -> dict[str, object]:
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


def pick_native_pdf_file() -> dict[str, object]:
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


def validate_asset_delete_requests(value: object, remaining_config: list[dict[str, object]]) -> tuple[list[AssetDeleteTarget], list[str]]:
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


def missing_pdf_count(config: CatalogConfig) -> int:
    configured = {normalized_project_path(item.get("pdf")) for item in config if item.get("pdf")}
    return sum(1 for path in iter_pdf_files() if normalized_project_path(path) not in configured)


def catalog_output_status(catalog_id: str) -> dict[str, object]:
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
