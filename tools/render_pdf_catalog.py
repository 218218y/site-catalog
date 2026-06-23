#!/usr/bin/env python3
"""Render one PDF into page images and thumbnails.

For normal use, prefer:
    python tools/build_catalogs.py

Manual one-file use:
    python tools/render_pdf_catalog.py assets/pdfs/catalog.pdf assets/pages/catalog-id
    python tools/render_pdf_catalog.py assets/pdfs/catalog.pdf assets/pages/catalog-id --format webp --dpi 240
"""
from __future__ import annotations

import argparse
from pathlib import Path

from build_catalogs import RenderOptions, load_manual_search_overrides, project_root, render_pdf


def main() -> int:
    parser = argparse.ArgumentParser(description="Render one PDF catalog to high-quality image pages.")
    parser.add_argument("pdf", type=Path, help="Path to source PDF")
    parser.add_argument("out_dir", type=Path, help="Output folder, e.g. assets/pages/my-catalog")
    parser.add_argument("--dpi", type=int, default=220)
    parser.add_argument("--max-width", type=int, default=3200)
    parser.add_argument("--max-height", type=int, default=3200)
    parser.add_argument("--thumb-size", type=int, default=520)
    parser.add_argument("--quality", type=int, default=90)
    parser.add_argument("--thumb-quality", type=int, default=80)
    parser.add_argument("--format", choices=["webp", "jpg", "png"], default="webp")
    parser.add_argument("--sharpen", type=float, default=0.8)
    parser.add_argument("--ocr", choices=["auto", "always", "never"], default="auto")
    parser.add_argument("--ocr-lang", default="heb+eng")
    parser.add_argument("--ocr-dpi", type=int, default=260)
    parser.add_argument("--ocr-min-chars", type=int, default=16)
    parser.add_argument("--tesseract-cmd", default="tesseract")
    parser.add_argument("--require-ocr", action="store_true")
    parser.add_argument("--no-clean", action="store_true")
    parser.add_argument("--skip-existing", action="store_true")
    parser.add_argument("--catalog-id", help="Catalog id for optional catalogs.search-overrides.json manual search text")
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
        ocr_mode=args.ocr,
        ocr_lang=args.ocr_lang,
        ocr_dpi=args.ocr_dpi,
        ocr_min_chars=args.ocr_min_chars,
        tesseract_cmd=args.tesseract_cmd,
        require_ocr=args.require_ocr,
    )
    manual_pages = {}
    if args.catalog_id:
        manual_pages = load_manual_search_overrides(project_root()).get(str(args.catalog_id), {})

    pages, search_pages, _page_sizes = render_pdf(args.pdf.resolve(), args.out_dir.resolve(), options, manual_pages)
    print(f"Done. Pages: {pages}. Searchable pages: {len(search_pages)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
