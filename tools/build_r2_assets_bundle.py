#!/usr/bin/env python3
"""Prepare the catalog image folder that should be uploaded to Cloudflare R2."""
from __future__ import annotations

import argparse
import json
import shutil
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

IMAGE_EXTENSIONS = {".webp", ".jpg", ".jpeg", ".png"}


@dataclass(frozen=True)
class CopyStats:
    files: int = 0
    bytes: int = 0

    def add(self, other: "CopyStats") -> "CopyStats":
        return CopyStats(self.files + other.files, self.bytes + other.bytes)


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def rel_to_root(path: Path) -> str:
    try:
        return path.relative_to(project_root()).as_posix()
    except ValueError:
        return path.as_posix()


def format_bytes(size: int) -> str:
    units = ["B", "KB", "MB", "GB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{int(value)} {unit}" if unit == "B" else f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"


def iter_files(directory: Path) -> Iterable[Path]:
    if not directory.is_dir():
        return
    for path in sorted(directory.rglob("*")):
        if path.is_file():
            yield path


def clean_output_dir(out_dir: Path) -> None:
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)


def copy_catalog_assets(source_dir: Path, out_dir: Path, preferred_format: str | None = "webp") -> CopyStats:
    files = 0
    total_bytes = 0
    target_pages_dir = out_dir / "assets" / "pages"

    for source_file in iter_files(source_dir):
        if source_file.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        if preferred_format and source_file.suffix.lower().lstrip(".") != preferred_format:
            # R2 should receive the optimized format only. Old JPG/PNG files can remain locally as backup.
            continue
        relative = source_file.relative_to(source_dir)
        target_file = target_pages_dir / relative
        target_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, target_file)
        files += 1
        total_bytes += source_file.stat().st_size

    return CopyStats(files, total_bytes)


def create_manifest(out_dir: Path, stats: CopyStats, preferred_format: str) -> None:
    manifest = {
        "assetRoot": "assets/pages",
        "preferredFormat": preferred_format,
        "files": stats.files,
        "bytes": stats.bytes,
        "note": "Upload this folder to the R2 bucket root, preserving object keys exactly. Example key: assets/pages/catalog-id/page-001.webp"
    }
    (out_dir / "r2-upload-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def create_zip_from_folder(folder: Path, zip_path: Path) -> CopyStats:
    files = 0
    total_bytes = 0
    if zip_path.exists():
        zip_path.unlink()
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in iter_files(folder):
            archive.write(file_path, file_path.relative_to(folder).as_posix())
            files += 1
            total_bytes += file_path.stat().st_size
    return CopyStats(files, total_bytes)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create dist/r2-assets for uploading catalog images to Cloudflare R2.")
    parser.add_argument("--out", default="dist/r2-assets", help="Output folder relative to project root")
    parser.add_argument("--format", choices=["webp", "jpg", "png"], default="webp", help="Only copy this image format to R2")
    parser.add_argument("--no-clean", action="store_true", help="Do not clear the output folder first")
    parser.add_argument("--zip", action="store_true", help="Also create a ZIP next to the output folder")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = project_root()
    source_dir = root / "assets" / "pages"
    out_dir = (root / args.out).resolve()

    if not source_dir.is_dir():
        print("ERROR: assets/pages does not exist. Run convert-catalogs.bat or build-r2-assets.bat first.")
        return 1

    if not args.no_clean:
        clean_output_dir(out_dir)
    else:
        out_dir.mkdir(parents=True, exist_ok=True)

    stats = copy_catalog_assets(source_dir, out_dir, args.format)
    create_manifest(out_dir, stats, args.format)

    print("\nDone.")
    print(f"R2 upload folder: {rel_to_root(out_dir)}")
    print(f"Copied: {stats.files} files, {format_bytes(stats.bytes)}")
    print("Upload the contents of this folder to the R2 bucket root, preserving paths under assets/pages/.")

    if stats.files == 0:
        print("[warn] No files were copied. Make sure assets/pages contains WebP files.")

    if args.zip:
        zip_path = out_dir.with_suffix(".zip")
        zip_stats = create_zip_from_folder(out_dir, zip_path)
        print(f"ZIP: {rel_to_root(zip_path)} ({zip_stats.files} files, {format_bytes(zip_path.stat().st_size)})")

    return 0 if stats.files else 1


if __name__ == "__main__":
    raise SystemExit(main())
