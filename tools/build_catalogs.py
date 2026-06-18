#!/usr/bin/env python3
"""Build a static image-based catalog site from local PDF files.

The script reads catalogs.config.json, renders each PDF into high-quality page
images and thumbnails, and writes catalogs.generated.js for the website.

Defaults are tuned for quality and compatibility:
- JPG output by default
- higher DPI rendering
- larger thumbnails
- no PDF links in the site output

Examples:
    python tools/build_catalogs.py
    python tools/build_catalogs.py --format png
    python tools/build_catalogs.py --dpi 240 --quality 96
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
from PIL import Image, ImageFilter

SUPPORTED_FORMATS = {"webp", "jpg", "png"}


@dataclass(frozen=True)
class RenderOptions:
    dpi: int
    max_width: int
    max_height: int
    thumb_size: int
    quality: int
    thumb_quality: int
    image_format: str
    clean: bool
    skip_existing: bool
    sharpen: float
    ocr_mode: str
    ocr_lang: str
    ocr_dpi: int
    ocr_min_chars: int
    tesseract_cmd: str
    require_ocr: bool


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def rel_to_root(path: Path) -> str:
    try:
        return path.relative_to(project_root()).as_posix()
    except ValueError:
        return path.as_posix()


def load_config(config_path: Path) -> list[dict[str, Any]]:
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    data = json.loads(config_path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, list):
        raise ValueError("catalogs.config.json must contain a JSON array")

    required = {"id", "title", "pdf"}
    for index, item in enumerate(data, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"Catalog #{index} must be an object")
        missing = required - set(item)
        if missing:
            raise ValueError(f"Catalog #{index} is missing: {', '.join(sorted(missing))}")
        safe_id = str(item["id"])
        if not safe_id or any(ch in safe_id for ch in "\\/.:?*<>|\" "):
            raise ValueError(
                f"Catalog #{index} has unsafe id: {safe_id!r}. Use english letters/numbers/dashes, e.g. qualita-2026"
            )
    return data


def prepare_output_dir(out_dir: Path, clean: bool) -> None:
    if clean and out_dir.exists():
        shutil.rmtree(out_dir)
    (out_dir / "thumbs").mkdir(parents=True, exist_ok=True)


def maybe_sharpen(image: Image.Image, amount: float) -> Image.Image:
    if amount <= 0:
        return image
    percent = max(50, min(220, int(amount * 100)))
    return image.filter(ImageFilter.UnsharpMask(radius=1.4, percent=percent, threshold=2))


def save_image(image: Image.Image, output_path: Path, image_format: str, quality: int) -> None:
    if image_format == "webp":
        image.save(output_path, "WEBP", quality=quality, method=6)
    elif image_format == "jpg":
        image.save(output_path, "JPEG", quality=quality, optimize=True, progressive=True, subsampling=0)
    elif image_format == "png":
        image.save(output_path, "PNG", optimize=True, compress_level=2)
    else:
        raise ValueError(f"Unsupported image format: {image_format}")


def render_page_image(page: fitz.Page, dpi: int) -> Image.Image:
    scale = max(1.0, dpi / 72.0)
    matrix = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=matrix, alpha=False, colorspace=fitz.csRGB)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def normalize_search_text(value: str) -> str:
    return " ".join(str(value or "").replace("\u00ad", "").split())


def extract_embedded_text(page: fitz.Page) -> str:
    return normalize_search_text(page.get_text("text", sort=True))


class OcrRunner:
    def __init__(self, options: RenderOptions) -> None:
        self.options = options
        self._available: bool | None = None
        self._warned_unavailable = False
        self._warned_failure = False

    def should_run(self, embedded_text: str) -> bool:
        if self.options.ocr_mode == "never":
            return False
        if self.options.ocr_mode == "always":
            return True
        return len(embedded_text) < self.options.ocr_min_chars

    def _is_available(self) -> bool:
        if self._available is not None:
            return self._available
        try:
            completed = subprocess.run(
                [self.options.tesseract_cmd, "--version"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                check=False,
            )
            self._available = completed.returncode == 0
        except OSError:
            self._available = False
        return self._available

    def recognize(self, image: Image.Image, label: str) -> str:
        if not self._is_available():
            message = (
                f"Tesseract OCR was not found by command {self.options.tesseract_cmd!r}. "
                "Images were rendered, but OCR search text was not created for scanned pages."
            )
            if self.options.require_ocr:
                raise RuntimeError(message)
            if not self._warned_unavailable:
                print(f"[ocr-warn] {message}", file=sys.stderr)
                self._warned_unavailable = True
            return ""

        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp:
            tmp_path = Path(tmp.name)
        try:
            image.save(tmp_path, "PNG")
            completed = subprocess.run(
                [
                    self.options.tesseract_cmd,
                    str(tmp_path),
                    "stdout",
                    "-l",
                    self.options.ocr_lang,
                    "--psm",
                    "6",
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
            )
            if completed.returncode != 0:
                message = completed.stderr.strip() or f"Tesseract failed on {label}"
                if self.options.require_ocr:
                    raise RuntimeError(message)
                if not self._warned_failure:
                    print(f"[ocr-warn] {message}", file=sys.stderr)
                    self._warned_failure = True
                return ""
            return normalize_search_text(completed.stdout)
        finally:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass


def build_page_search_text(page: fitz.Page, ocr: OcrRunner, options: RenderOptions, label: str) -> str:
    embedded_text = extract_embedded_text(page)
    if not ocr.should_run(embedded_text):
        return embedded_text

    ocr_image = render_page_image(page, options.ocr_dpi)
    ocr_text = ocr.recognize(ocr_image, label)
    if embedded_text and ocr_text:
        return normalize_search_text(f"{embedded_text} {ocr_text}")
    return normalize_search_text(ocr_text or embedded_text)


def render_pdf(pdf_path: Path, out_dir: Path, options: RenderOptions) -> tuple[int, list[dict[str, Any]]]:
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    with fitz.open(pdf_path) as doc:
        if len(doc) == 0:
            raise ValueError(f"PDF has no pages: {pdf_path}")

        prepare_output_dir(out_dir, options.clean)
        thumb_dir = out_dir / "thumbs"
        ext = options.image_format

        ocr = OcrRunner(options)
        search_pages: list[dict[str, Any]] = []

        for page_number, page in enumerate(doc, start=1):
            page_file = out_dir / f"page-{page_number:03d}.{ext}"
            thumb_file = thumb_dir / f"page-{page_number:03d}.{ext}"
            label = f"{pdf_path.name} page {page_number}/{len(doc)}"

            page_text = build_page_search_text(page, ocr, options, label)
            if page_text:
                search_pages.append({"page": page_number, "text": page_text})

            if options.skip_existing and page_file.exists() and thumb_file.exists():
                print(f"[skip] {pdf_path.name}: page {page_number}/{len(doc)} already exists")
                continue

            image = render_page_image(page, options.dpi)

            if image.width > options.max_width or image.height > options.max_height:
                image.thumbnail((options.max_width, options.max_height), Image.Resampling.LANCZOS)

            image = maybe_sharpen(image, options.sharpen)
            save_image(image, page_file, ext, options.quality)

            thumb = image.copy()
            thumb.thumbnail((options.thumb_size, options.thumb_size), Image.Resampling.LANCZOS)
            thumb = maybe_sharpen(thumb, max(0, options.sharpen * 0.65))
            save_image(thumb, thumb_file, ext, options.thumb_quality if ext != "png" else options.quality)

            print(f"[render] {pdf_path.name}: page {page_number}/{len(doc)} -> {rel_to_root(page_file)}")

        return len(doc), search_pages


def build_generated_entry(item: dict[str, Any], pages: int, out_dir: Path, image_format: str) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "id": item["id"],
        "title": item["title"],
        "description": item.get("description", ""),
        "category": item.get("category", "קטלוג"),
        "pages": pages,
        "dir": rel_to_root(out_dir),
        "cover": f"{rel_to_root(out_dir)}/page-001.{image_format}",
        "imageExt": image_format,
    }

    for key in ("sort", "badge"):
        if key in item:
            entry[key] = item[key]
    return entry


def build_search_entry(item: dict[str, Any], search_pages: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "catalogId": item["id"],
        "title": item["title"],
        "pages": search_pages,
    }


def write_generated_files(entries: list[dict[str, Any]], search_entries: list[dict[str, Any]]) -> None:
    root = project_root()
    payload = json.dumps(entries, ensure_ascii=False, indent=2)
    search_payload = json.dumps(search_entries, ensure_ascii=False, indent=2)
    (root / "catalogs.generated.json").write_text(payload + "\n", encoding="utf-8")
    (root / "catalogs.generated.js").write_text(
        "// הקובץ הזה נוצר אוטומטית על ידי tools/build_catalogs.py\n"
        "// לא מומלץ לערוך אותו ידנית. עריכה עושים בקובץ catalogs.config.json ואז מריצים שוב המרה.\n"
        f"window.BARGIG_CATALOGS = {payload};\n",
        encoding="utf-8",
    )
    (root / "catalogs.search.json").write_text(search_payload + "\n", encoding="utf-8")
    (root / "catalogs.search.js").write_text(
        "// הקובץ הזה נוצר אוטומטית על ידי tools/build_catalogs.py\n"
        "// כאן נמצא אינדקס החיפוש שנוצר מטקסט ה-PDF ומ-OCR.\n"
        f"window.BARGIG_CATALOG_SEARCH = {search_payload};\n",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert local PDF catalogs into high-quality website page images.")
    parser.add_argument("--config", default="catalogs.config.json", help="Path to config JSON, relative to project root")
    parser.add_argument("--dpi", type=int, default=220, help="Render DPI for PDF pages before optional downscale")
    parser.add_argument("--max-width", type=int, default=2800, help="Max rendered page width in pixels")
    parser.add_argument("--max-height", type=int, default=2800, help="Max rendered page height in pixels")
    parser.add_argument("--thumb-size", type=int, default=420, help="Max thumbnail width/height in pixels")
    parser.add_argument("--quality", type=int, default=94, help="Image quality for webp/jpg, 1-100")
    parser.add_argument("--thumb-quality", type=int, default=88, help="Thumbnail quality for webp/jpg, 1-100")
    parser.add_argument("--format", choices=sorted(SUPPORTED_FORMATS), default="jpg", help="Output image format")
    parser.add_argument("--sharpen", type=float, default=1.0, help="Sharpen amount after resize, 0 disables")
    parser.add_argument(
        "--ocr",
        choices=["auto", "always", "never"],
        default="auto",
        help="Create search text with OCR. auto uses embedded PDF text first and OCRs scanned/empty pages",
    )
    parser.add_argument("--ocr-lang", default="heb+eng", help="Tesseract OCR language, e.g. heb, eng or heb+eng")
    parser.add_argument("--ocr-dpi", type=int, default=260, help="DPI used only for OCR input images")
    parser.add_argument("--ocr-min-chars", type=int, default=16, help="In auto mode, OCR pages with less embedded text than this")
    parser.add_argument("--tesseract-cmd", default="tesseract", help="Tesseract executable path/name")
    parser.add_argument("--require-ocr", action="store_true", help="Fail conversion if OCR is needed but Tesseract cannot run")
    parser.add_argument("--no-clean", action="store_true", help="Do not delete old output folder before rendering")
    parser.add_argument("--skip-existing", action="store_true", help="Skip pages that already have image and thumbnail files")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = project_root()
    config_path = (root / args.config).resolve()
    options = RenderOptions(
        dpi=max(72, int(args.dpi)),
        max_width=max(600, int(args.max_width)),
        max_height=max(600, int(args.max_height)),
        thumb_size=max(80, int(args.thumb_size)),
        quality=max(1, min(100, int(args.quality))),
        thumb_quality=max(1, min(100, int(args.thumb_quality))),
        image_format=args.format,
        clean=not args.no_clean,
        skip_existing=args.skip_existing,
        sharpen=max(0.0, float(args.sharpen)),
        ocr_mode=args.ocr,
        ocr_lang=str(args.ocr_lang).strip() or "heb+eng",
        ocr_dpi=max(120, int(args.ocr_dpi)),
        ocr_min_chars=max(0, int(args.ocr_min_chars)),
        tesseract_cmd=str(args.tesseract_cmd).strip() or "tesseract",
        require_ocr=bool(args.require_ocr),
    )

    try:
        config = load_config(config_path)
        generated: list[dict[str, Any]] = []
        search_generated: list[dict[str, Any]] = []

        for item in config:
            catalog_id = str(item["id"])
            pdf_path = (root / str(item["pdf"])).resolve()
            out_dir = (root / "assets" / "pages" / catalog_id).resolve()

            print(f"\n=== {item['title']} ===")
            pages, search_pages = render_pdf(pdf_path, out_dir, options)
            generated.append(build_generated_entry(item, pages, out_dir, options.image_format))
            search_generated.append(build_search_entry(item, search_pages))

        generated.sort(key=lambda row: row.get("sort", 9999))
        search_generated.sort(key=lambda row: next((item.get("sort", 9999) for item in config if item["id"] == row["catalogId"]), 9999))
        write_generated_files(generated, search_generated)

        print("\nDone.")
        print(f"Catalogs: {len(generated)}")
        print(f"Format: {options.image_format.upper()}")
        print("Generated: catalogs.generated.js")
        print("Generated: catalogs.search.js")
        print("You may delete the PDFs after conversion if you only want to keep the images.")
        print("Open index.html or run: python -m http.server 8080")
        return 0
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
