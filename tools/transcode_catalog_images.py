#!/usr/bin/env python3
"""Transcode already-rendered catalog page images to a browser-friendly format.

This is useful when a site already has assets/pages rendered as JPG/PNG and the
source PDFs are missing or you do not want to render them again.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageOps

SUPPORTED_OUTPUT_FORMATS = {"webp", "jpg", "png"}
SOURCE_FORMATS = {".jpg", ".jpeg", ".png", ".webp"}


@dataclass(frozen=True)
class Stats:
    converted: int = 0
    skipped: int = 0
    failed: int = 0

    def add(self, other: "Stats") -> "Stats":
        return Stats(
            converted=self.converted + other.converted,
            skipped=self.skipped + other.skipped,
            failed=self.failed + other.failed,
        )


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def rel_to_root(path: Path) -> str:
    try:
        return path.relative_to(project_root()).as_posix()
    except ValueError:
        return path.as_posix()


def iter_source_images(root: Path, output_format: str) -> Iterable[Path]:
    pages_dir = root / "assets" / "pages"
    if not pages_dir.is_dir():
        return

    for path in sorted(pages_dir.rglob("page-*.*")):
        if not path.is_file():
            continue
        if path.suffix.lower() not in SOURCE_FORMATS:
            continue
        if path.suffix.lower().lstrip(".") == output_format:
            continue
        yield path


def output_path_for(source: Path, output_format: str) -> Path:
    return source.with_suffix(f".{output_format}")


def save_image(image: Image.Image, output_path: Path, output_format: str, quality: int) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_format == "webp":
        image.save(output_path, "WEBP", quality=quality, method=6)
    elif output_format == "jpg":
        image.save(output_path, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=0)
    elif output_format == "png":
        image.save(output_path, "PNG", optimize=True, compress_level=2)
    else:
        raise ValueError(f"Unsupported output format: {output_format}")


def transcode_one(source: Path, output_format: str, quality: int, skip_existing: bool) -> Stats:
    target = output_path_for(source, output_format)
    if skip_existing and target.is_file():
        print(f"[skip] {rel_to_root(target)} already exists")
        return Stats(skipped=1)

    try:
        with Image.open(source) as image:
            image = ImageOps.exif_transpose(image)
            if image.mode not in ("RGB", "RGBA"):
                image = image.convert("RGB")
            if output_format in {"jpg", "webp"} and image.mode == "RGBA":
                background = Image.new("RGB", image.size, (255, 255, 255))
                background.paste(image, mask=image.getchannel("A"))
                image = background
            save_image(image, target, output_format, quality)
        print(f"[convert] {rel_to_root(source)} -> {rel_to_root(target)}")
        return Stats(converted=1)
    except Exception as exc:  # noqa: BLE001 - command-line tool should report and continue
        print(f"[error] Could not convert {rel_to_root(source)}: {exc}")
        return Stats(failed=1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert existing assets/pages JPG/PNG/WebP catalog images to another format.")
    parser.add_argument("--format", choices=sorted(SUPPORTED_OUTPUT_FORMATS), default="webp", help="Output image format")
    parser.add_argument("--quality", type=int, default=90, help="Quality for full pages when writing JPG/WebP")
    parser.add_argument("--thumb-quality", type=int, default=80, help="Quality for files inside thumbs folders")
    parser.add_argument("--skip-existing", action="store_true", help="Do not overwrite existing target files")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = project_root()
    pages_dir = root / "assets" / "pages"
    if not pages_dir.is_dir():
        print("[warn] assets/pages does not exist. Nothing to transcode.")
        return 0

    stats = Stats()
    for source in iter_source_images(root, args.format):
        quality = max(1, min(100, int(args.thumb_quality if "thumbs" in source.parts else args.quality)))
        stats = stats.add(transcode_one(source, args.format, quality, args.skip_existing))

    print("\nDone.")
    print(f"Converted: {stats.converted}")
    print(f"Skipped: {stats.skipped}")
    print(f"Failed: {stats.failed}")
    return 1 if stats.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
