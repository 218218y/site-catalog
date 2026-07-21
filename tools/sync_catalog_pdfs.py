#!/usr/bin/env python3
"""Synchronize assets/pdfs with catalogs.config.json without converting PDFs.

This tool only appends default catalog records for PDF files that are not yet
listed in catalogs.config.json. It intentionally does not render pages, run OCR,
or write catalogs.generated.*.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

BIDI_CONTROL_RE = re.compile(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069]")
DEFAULT_CONFIG = "catalogs.config.json"
DEFAULT_PDF_DIR = "assets/pdfs"


@dataclass(frozen=True)
class PdfRename:
    old_path: Path
    new_path: Path


@dataclass(frozen=True)
class SyncResult:
    additions: list[dict[str, Any]]
    renamed_pdfs: list[PdfRename]
    updated_pdf_refs: int



def project_root() -> Path:
    return Path(__file__).resolve().parents[1]



def rel_to_root(path: Path) -> str:
    try:
        return path.relative_to(project_root()).as_posix()
    except ValueError:
        return path.as_posix()



def remove_bidi_controls(value: str) -> str:
    """Remove invisible Unicode direction markers from filenames/metadata.

    Windows and RTL editors can occasionally paste Right-To-Left/Left-To-Right
    marks into a filename. They are invisible, but JSON editors show them as
    [U+200F]/[U+200E] and they also make paths hard to compare by eye.
    """
    return BIDI_CONTROL_RE.sub("", value)



def read_config(config_path: Path) -> list[dict[str, Any]]:
    if not config_path.exists():
        return []

    payload = json.loads(config_path.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, list):
        raise ValueError(f"{rel_to_root(config_path)} must contain a JSON array")

    for index, item in enumerate(payload, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Catalog #{index} in {rel_to_root(config_path)} must be an object")
    return payload



def write_config(config_path: Path, config: list[dict[str, Any]]) -> None:
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")



def normalized_project_path(root: Path, path_value: Any) -> str:
    raw = str(path_value or "").strip().replace("\\", "/")
    if not raw:
        return ""

    candidate = Path(raw)
    if not candidate.is_absolute():
        candidate = root / candidate

    try:
        normalized = candidate.resolve(strict=False).as_posix()
    except OSError:
        normalized = candidate.absolute().as_posix()
    return normalized.casefold()



def configured_pdf_paths(root: Path, config: list[dict[str, Any]]) -> set[str]:
    configured: set[str] = set()
    for item in config:
        pdf_value = item.get("pdf")
        if not pdf_value:
            continue
        normalized = normalized_project_path(root, pdf_value)
        if normalized:
            configured.add(normalized)
    return configured



def pdf_reference_for_config(root: Path, pdf_path: Path) -> str:
    resolved = pdf_path.resolve(strict=False)
    try:
        return resolved.relative_to(root).as_posix()
    except ValueError:
        return resolved.as_posix()



def path_key(path: Path) -> str:
    try:
        return path.resolve(strict=False).as_posix().casefold()
    except OSError:
        return path.absolute().as_posix().casefold()



def safe_catalog_id_from_pdf(pdf_path: Path, used_ids: set[str]) -> str:
    # The id is later used as the output folder name under assets/pages, so it
    # must stay path-safe. Normal names remain unchanged except spaces become dashes.
    stem = remove_bidi_controls(pdf_path.stem).strip()
    base = re.sub(r"[\\/.:?*<>|\"\s]+", "-", stem).strip("-") or "catalog"

    candidate = base
    suffix = 2
    while candidate in used_ids:
        candidate = f"{base}-{suffix}"
        suffix += 1
    used_ids.add(candidate)
    return candidate



def iter_pdf_files(pdf_dir: Path) -> list[Path]:
    if not pdf_dir.is_dir():
        return []

    files: list[Path] = []
    for file_path in pdf_dir.rglob("*"):
        if not file_path.is_file():
            continue
        if file_path.name.startswith("."):
            continue
        if file_path.suffix.lower() == ".pdf":
            files.append(file_path)
    return sorted(files, key=lambda path: path.relative_to(pdf_dir).as_posix().casefold())



def unique_path_for_clean_name(target: Path, blocked_paths: set[str]) -> Path:
    if path_key(target) not in blocked_paths and not target.exists():
        return target

    stem = target.stem or "catalog"
    suffix = target.suffix
    counter = 2
    while True:
        candidate = target.with_name(f"{stem}-{counter}{suffix}")
        if path_key(candidate) not in blocked_paths and not candidate.exists():
            return candidate
        counter += 1



def plan_bidi_pdf_renames(pdf_dir: Path) -> list[PdfRename]:
    """Plan clean PDF filenames by removing hidden direction-control chars.

    The JSON should not need to contain U+200F/U+200E markers. If such markers
    are part of the actual filename, the correct fix is to rename the PDF first
    and only then write the clean path to catalogs.config.json.
    """
    pdf_files = iter_pdf_files(pdf_dir)
    existing_keys = {path_key(path) for path in pdf_files}
    planned: list[PdfRename] = []

    for old_path in pdf_files:
        rel_parts = old_path.relative_to(pdf_dir).parts
        clean_parts = tuple(remove_bidi_controls(part) for part in rel_parts)
        if clean_parts == rel_parts:
            continue

        if any(part in {"", ".", ".."} for part in clean_parts):
            raise ValueError(f"Cannot clean hidden direction markers from unsafe PDF path: {rel_to_root(old_path)}")

        desired_path = pdf_dir.joinpath(*clean_parts)
        existing_keys.discard(path_key(old_path))
        new_path = unique_path_for_clean_name(desired_path, existing_keys)
        existing_keys.add(path_key(new_path))
        planned.append(PdfRename(old_path=old_path, new_path=new_path))

    return planned



def cleanup_empty_parents(start: Path, stop_at: Path) -> None:
    current = start
    stop_at = stop_at.resolve(strict=False)
    while current != stop_at and current.exists():
        try:
            current.rmdir()
        except OSError:
            return
        current = current.parent



def apply_pdf_renames(renames: list[PdfRename], pdf_dir: Path) -> None:
    for rename in renames:
        rename.new_path.parent.mkdir(parents=True, exist_ok=True)
        rename.old_path.rename(rename.new_path)
        cleanup_empty_parents(rename.old_path.parent, pdf_dir)



def update_config_pdf_references(root: Path, config: list[dict[str, Any]], renames: list[PdfRename]) -> int:
    rename_lookup = {
        normalized_project_path(root, rename.old_path): pdf_reference_for_config(root, rename.new_path)
        for rename in renames
    }

    updated = 0
    for item in config:
        current_pdf = item.get("pdf")
        if not current_pdf:
            continue

        current_norm = normalized_project_path(root, current_pdf)
        clean_pdf = rename_lookup.get(current_norm)

        # Also repair an existing JSON value that contains a hidden marker if
        # the matching clean file already exists. This handles projects where
        # the PDF was renamed manually after a previous sync.
        if clean_pdf is None and BIDI_CONTROL_RE.search(str(current_pdf)):
            candidate_value = remove_bidi_controls(str(current_pdf))
            candidate_path = Path(candidate_value)
            if not candidate_path.is_absolute():
                candidate_path = root / candidate_path
            if candidate_path.exists():
                clean_pdf = pdf_reference_for_config(root, candidate_path)

        if clean_pdf is not None and str(current_pdf).replace("\\", "/") != clean_pdf:
            item["pdf"] = clean_pdf
            updated += 1

    return updated



def find_missing_pdf_catalogs(
    config: list[dict[str, Any]], pdf_dir: Path, pdf_files: list[Path] | None = None
) -> list[dict[str, Any]]:
    root = project_root()
    known_pdf_paths = configured_pdf_paths(root, config)
    used_ids = {
        str(item.get("id", "")).strip()
        for item in config
        if str(item.get("id", "")).strip()
    }

    additions: list[dict[str, Any]] = []
    for pdf_path in (pdf_files if pdf_files is not None else iter_pdf_files(pdf_dir)):
        normalized_pdf = normalized_project_path(root, pdf_path)
        if normalized_pdf in known_pdf_paths:
            continue

        catalog_id = safe_catalog_id_from_pdf(pdf_path, used_ids)
        additions.append(
            {
                "id": catalog_id,
                "title": remove_bidi_controls(pdf_path.stem).strip() or catalog_id,
                "description": "",
                "category": "",
                "subcategory": "",
                "pdf": pdf_reference_for_config(root, pdf_path),
                "ocr": True,
            }
        )
        known_pdf_paths.add(normalized_pdf)

    return additions



def sync_config(config_path: Path, pdf_dir: Path, dry_run: bool = False) -> SyncResult:
    root = project_root()
    config = read_config(config_path)

    planned_renames = plan_bidi_pdf_renames(pdf_dir)
    if planned_renames and not dry_run:
        apply_pdf_renames(planned_renames, pdf_dir)

    updated_refs = update_config_pdf_references(root, config, planned_renames)

    pdf_files_for_scan: list[Path] | None = None
    if dry_run and planned_renames:
        rename_lookup = {path_key(rename.old_path): rename.new_path for rename in planned_renames}
        pdf_files_for_scan = [rename_lookup.get(path_key(path), path) for path in iter_pdf_files(pdf_dir)]

    additions = find_missing_pdf_catalogs(config, pdf_dir, pdf_files=pdf_files_for_scan)

    if (additions or updated_refs) and not dry_run:
        config.extend(additions)
        write_config(config_path, config)

    return SyncResult(additions=additions, renamed_pdfs=planned_renames, updated_pdf_refs=updated_refs)



def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add missing PDF files from assets/pdfs to catalogs.config.json without converting them."
    )
    parser.add_argument("--config", default=DEFAULT_CONFIG, help="Path to config JSON, relative to the project root")
    parser.add_argument("--pdf-dir", default=DEFAULT_PDF_DIR, help="Folder to scan for PDF files, relative to the project root")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be added/renamed without changing files")
    return parser.parse_args()



def main() -> int:
    args = parse_args()
    root = project_root()
    config_path = (root / str(args.config)).resolve()
    pdf_dir = (root / str(args.pdf_dir)).resolve()

    try:
        result = sync_config(config_path, pdf_dir, dry_run=bool(args.dry_run))
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1

    if not pdf_dir.is_dir():
        print(f"[warn] PDF folder was not found: {rel_to_root(pdf_dir)}")

    action = "Would add" if args.dry_run else "Added"
    rename_action = "Would rename" if args.dry_run else "Renamed"
    update_action = "Would update" if args.dry_run else "Updated"

    for rename in result.renamed_pdfs:
        print(f"{rename_action} PDF filename: {rel_to_root(rename.old_path)} -> {rel_to_root(rename.new_path)}")

    if result.updated_pdf_refs:
        print(f"{update_action} {result.updated_pdf_refs} existing PDF reference(s) in {rel_to_root(config_path)}")

    if result.additions:
        print(f"{action} {len(result.additions)} PDF catalog(s) to {rel_to_root(config_path)}:")
        for item in result.additions:
            print(f"+ {item['id']} -> {item['pdf']}")
    elif not result.renamed_pdfs and not result.updated_pdf_refs:
        print(f"No missing PDF catalogs found. {rel_to_root(config_path)} was not changed.")

    if args.dry_run:
        print("Dry run only. No files were changed.")
    elif result.additions:
        print("Done. Edit title/description/category/subcategory/ocr in catalogs.config.json, then run .10-convert-catalogs.bat.")
    elif result.renamed_pdfs or result.updated_pdf_refs:
        print("Done. Hidden direction markers were cleaned from PDF filenames/references.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
