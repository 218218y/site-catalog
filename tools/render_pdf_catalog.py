#!/usr/bin/env python3
"""Render one PDF into page images and thumbnails.

For normal use, prefer:
    python tools/build_catalogs.py

Manual one-file use:
    python tools/render_pdf_catalog.py assets/pdfs/catalog.pdf assets/pages/catalog-id
    python tools/render_pdf_catalog.py assets/pdfs/catalog.pdf assets/pages/catalog-id --format png --dpi 240
"""
from __future__ import annotations

import argparse
from pathlib import Path

from build_catalogs import RenderOptions, render_pdf


def main() -> int:
    parser = argparse.ArgumentParser(description="Render one PDF catalog to high-quality image pages.")
    parser.add_argument("pdf", type=Path, help="Path to source PDF")
    parser.add_argument("out_dir", type=Path, help="Output folder, e.g. assets/pages/my-catalog")
    parser.add_argument("--dpi", type=int, default=220)
    parser.add_argument("--max-width", type=int, default=2800)
    parser.add_argument("--max-height", type=int, default=2800)
    parser.add_argument("--thumb-size", type=int, default=420)
    parser.add_argument("--quality", type=int, default=94)
    parser.add_argument("--thumb-quality", type=int, default=88)
    parser.add_argument("--format", choices=["webp", "jpg", "png"], default="jpg")
    parser.add_argument("--sharpen", type=float, default=1.0)
    parser.add_argument("--no-clean", action="store_true")
    parser.add_argument("--skip-existing", action="store_true")
    args = parser.parse_args()

    options = RenderOptions(
        dpi=args.dpi,
        max_width=args.max_width,
        max_height=args.max_height,
        thumb_size=args.thumb_size,
        quality=args.quality,
        thumb_quality=args.thumb_quality,
        image_format=args.format,
        clean=not args.no_clean,
        skip_existing=args.skip_existing,
        sharpen=args.sharpen,
    )
    pages = render_pdf(args.pdf.resolve(), args.out_dir.resolve(), options)
    print(f"Done. Pages: {pages}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
