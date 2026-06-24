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
from pathlib import Path
from typing import Any

BIDI_CONTROL_RE = re.compile(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069]")
DEFAULT_CONFIG = "catalogs.config.json"
DEFAULT_PDF_DIR = "assets/pdfs"


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def rel_to_root(path: Path) -> str:
    try:
        return path.relative_to(project_root()).as_posix()
    except ValueError:
        return path.as_posix()


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


def safe_catalog_id_from_pdf(pdf_path: Path, used_ids: set[str]) -> str:
    # The id is later used as the output folder name under assets/pages, so it
    # must stay path-safe. Normal names remain unchanged except spaces become dashes.
    stem = BIDI_CONTROL_RE.sub("", pdf_path.stem).strip()
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


def find_missing_pdf_catalogs(config: list[dict[str, Any]], pdf_dir: Path) -> list[dict[str, Any]]:
    root = project_root()
    known_pdf_paths = configured_pdf_paths(root, config)
    used_ids = {
        str(item.get("id", "")).strip()
        for item in config
        if str(item.get("id", "")).strip()
    }

    additions: list[dict[str, Any]] = []
    for pdf_path in iter_pdf_files(pdf_dir):
        normalized_pdf = normalized_project_path(root, pdf_path)
        if normalized_pdf in known_pdf_paths:
            continue

        catalog_id = safe_catalog_id_from_pdf(pdf_path, used_ids)
        additions.append(
            {
                "id": catalog_id,
                "title": BIDI_CONTROL_RE.sub("", pdf_path.stem).strip() or catalog_id,
                "description": "",
                "category": "",
                "pdf": pdf_reference_for_config(root, pdf_path),
            }
        )
        known_pdf_paths.add(normalized_pdf)

    return additions


def sync_config(config_path: Path, pdf_dir: Path, dry_run: bool = False) -> list[dict[str, Any]]:
    config = read_config(config_path)
    additions = find_missing_pdf_catalogs(config, pdf_dir)
    if additions and not dry_run:
        config.extend(additions)
        write_config(config_path, config)
    return additions


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add missing PDF files from assets/pdfs to catalogs.config.json without converting them."
    )
    parser.add_argument("--config", default=DEFAULT_CONFIG, help="Path to config JSON, relative to the project root")
    parser.add_argument("--pdf-dir", default=DEFAULT_PDF_DIR, help="Folder to scan for PDF files, relative to the project root")
    parser.add_argument("--dry-run", action="store_true", help="Print what would be added without changing catalogs.config.json")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = project_root()
    config_path = (root / str(args.config)).resolve()
    pdf_dir = (root / str(args.pdf_dir)).resolve()

    try:
        additions = sync_config(config_path, pdf_dir, dry_run=bool(args.dry_run))
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1

    if not pdf_dir.is_dir():
        print(f"[warn] PDF folder was not found: {rel_to_root(pdf_dir)}")

    if not additions:
        print(f"No missing PDF catalogs found. {rel_to_root(config_path)} was not changed.")
        return 0

    action = "Would add" if args.dry_run else "Added"
    print(f"{action} {len(additions)} PDF catalog(s) to {rel_to_root(config_path)}:")
    for item in additions:
        print(f"+ {item['id']} -> {item['pdf']}")

    if args.dry_run:
        print("Dry run only. No files were changed.")
    else:
        print("Done. Edit title/description/category in catalogs.config.json, then run convert-catalogs.bat.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
