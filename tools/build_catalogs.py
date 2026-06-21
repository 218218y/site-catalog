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
    python tools/build_catalogs.py --force
    python tools/build_catalogs.py --format png
    python tools/build_catalogs.py --dpi 240 --quality 96
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
import tempfile
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
from PIL import Image, ImageFilter

SUPPORTED_FORMATS = {"webp", "jpg", "png"}
PAGE_FILE_RE = re.compile(r"^page-(\d{3})\.(webp|jpg|png)$", re.IGNORECASE)


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


@dataclass(frozen=True)
class ExistingCatalogOutput:
    pages: int
    image_format: str
    is_complete: bool
    reason: str = ""


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def rel_to_root(path: Path) -> str:
    try:
        return path.relative_to(project_root()).as_posix()
    except ValueError:
        return path.as_posix()


def _collect_page_numbers(directory: Path) -> dict[str, set[int]]:
    """Return page numbers grouped by image extension from page-001.jpg style files."""
    numbers_by_ext: dict[str, set[int]] = {ext: set() for ext in SUPPORTED_FORMATS}
    if not directory.is_dir():
        return numbers_by_ext

    for file_path in directory.iterdir():
        if not file_path.is_file():
            continue
        match = PAGE_FILE_RE.match(file_path.name)
        if not match:
            continue
        page_number = int(match.group(1))
        image_format = match.group(2).lower()
        numbers_by_ext.setdefault(image_format, set()).add(page_number)
    return numbers_by_ext


def _format_output_status(out_dir: Path, image_format: str, page_count: int) -> str:
    page_word = "page" if page_count == 1 else "pages"
    return f"{rel_to_root(out_dir)} ({page_count} {page_word}, {image_format.upper()})"


def inspect_existing_catalog_output(out_dir: Path, preferred_format: str) -> ExistingCatalogOutput | None:
    """Check whether a catalog output folder is complete enough to reuse safely.

    A reusable catalog must have a consecutive page sequence starting at 1, and a
    matching thumbnail for every page. This prevents the site from pointing to
    broken/missing page images when a previous conversion was interrupted.
    """
    if not out_dir.is_dir():
        return None

    page_numbers = _collect_page_numbers(out_dir)
    thumb_numbers = _collect_page_numbers(out_dir / "thumbs")
    formats = [preferred_format, *sorted(SUPPORTED_FORMATS - {preferred_format})]
    incomplete: list[ExistingCatalogOutput] = []

    for image_format in formats:
        pages = page_numbers.get(image_format, set())
        thumbs = thumb_numbers.get(image_format, set())
        if not pages:
            continue

        expected = set(range(1, max(pages) + 1))
        missing_pages = sorted(expected - pages)
        missing_thumbs = sorted(expected - thumbs)
        page_count = len(pages)

        if 1 in pages and not missing_pages and not missing_thumbs:
            return ExistingCatalogOutput(max(pages), image_format, True)

        reason_parts = []
        if 1 not in pages:
            reason_parts.append("page-001 is missing")
        if missing_pages:
            preview = ", ".join(f"page-{number:03d}" for number in missing_pages[:5])
            suffix = "..." if len(missing_pages) > 5 else ""
            reason_parts.append(f"missing pages: {preview}{suffix}")
        if missing_thumbs:
            preview = ", ".join(f"page-{number:03d}" for number in missing_thumbs[:5])
            suffix = "..." if len(missing_thumbs) > 5 else ""
            reason_parts.append(f"missing thumbnails: {preview}{suffix}")
        incomplete.append(ExistingCatalogOutput(page_count, image_format, False, "; ".join(reason_parts)))

    if incomplete:
        return max(incomplete, key=lambda output: output.pages)
    return None


def collect_page_sizes(out_dir: Path, image_format: str, page_count: int) -> list[list[int]]:
    """Read rendered page image dimensions for stable browser layout."""
    sizes: list[list[int]] = []
    for page_number in range(1, max(0, int(page_count)) + 1):
        page_file = out_dir / f"page-{page_number:03d}.{image_format}"
        try:
            with Image.open(page_file) as image:
                sizes.append([int(image.width), int(image.height)])
        except (OSError, ValueError):
            sizes.append([0, 0])
    return sizes


def catalog_asset_version(out_dir: Path, image_format: str, page_count: int) -> str:
    """Create a compact cache-busting version from generated catalog assets."""
    digest = hashlib.sha1()
    for page_number in range(1, max(0, int(page_count)) + 1):
        for relative in (
            Path(f"page-{page_number:03d}.{image_format}"),
            Path("thumbs") / f"page-{page_number:03d}.{image_format}",
        ):
            file_path = out_dir / relative
            if not file_path.is_file():
                continue
            stat = file_path.stat()
            digest.update(relative.as_posix().encode("utf-8"))
            digest.update(str(stat.st_size).encode("ascii"))
            digest.update(str(stat.st_mtime_ns).encode("ascii"))
    return digest.hexdigest()[:12]


def load_previous_search_pages(root: Path) -> dict[str, list[dict[str, Any]]]:
    """Load the last generated OCR/search index so skipped catalogs keep search."""
    search_json = root / "catalogs.search.json"
    if not search_json.exists():
        return {}

    try:
        payload = json.loads(search_json.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[warn] Could not read previous search index: {exc}", file=sys.stderr)
        return {}

    if not isinstance(payload, list):
        return {}

    result: dict[str, list[dict[str, Any]]] = {}
    for entry in payload:
        if not isinstance(entry, dict):
            continue
        catalog_id = str(entry.get("catalogId", "")).strip()
        pages = entry.get("pages", [])
        if catalog_id and isinstance(pages, list):
            result[catalog_id] = [page for page in pages if isinstance(page, dict)]
    return result


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

    def recognize(self, image: Image.Image, label: str, *, psm: int = 6) -> str:
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
                    str(max(0, int(psm))),
                ],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                encoding="utf-8",
                errors="replace",
                check=False,
                timeout=60,
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
        except subprocess.TimeoutExpired:
            message = f"Tesseract timed out on {label}"
            if self.options.require_ocr:
                raise RuntimeError(message)
            if not self._warned_failure:
                print(f"[ocr-warn] {message}", file=sys.stderr)
                self._warned_failure = True
            return ""
        finally:
            try:
                tmp_path.unlink(missing_ok=True)
            except OSError:
                pass


def _looks_like_teal_banner_pixel(pixel: tuple[int, int, int]) -> bool:
    """Return true for the semi-transparent green/teal title ribbons used in photo catalog pages.

    Tesseract is good at dark text on plain paper, but it often ignores white
    letters sitting on a tinted translucent rectangle inside a full-page photo.
    Detecting the ribbon lets us OCR only that local text block instead of asking
    Tesseract to understand the whole photograph as one text paragraph.
    """
    red, green, blue = pixel
    luminance = (red + green + blue) / 3
    return (
        green - red >= 14
        and green - blue >= -12
        and luminance < 165
        and 85 <= green <= 190
        and red < 170
        and blue < 170
    )




def _has_light_text_pixels(image: Image.Image, box: tuple[int, int, int, int]) -> bool:
    """Check that a detected ribbon contains enough bright neutral pixels to be white text."""
    x0, y0, x1, y1 = box
    if x1 <= x0 or y1 <= y0:
        return False
    crop = image.crop(box)
    sample_width = max(1, min(180, crop.width // 8 or crop.width))
    sample_height = max(1, round(crop.height * sample_width / max(1, crop.width)))
    sample = crop.resize((sample_width, sample_height), Image.Resampling.BILINEAR).convert("RGB")
    total = max(1, sample_width * sample_height)
    bright_neutral = 0
    pixels = sample.get_flattened_data() if hasattr(sample, "get_flattened_data") else sample.getdata()
    for pixel in pixels:
        red, green, blue = pixel[:3]
        if red > 210 and green > 210 and blue > 210 and max(red, green, blue) - min(red, green, blue) < 35:
            bright_neutral += 1
    return bright_neutral / total >= 0.015


def _find_teal_banner_regions(image: Image.Image) -> list[tuple[int, int, int, int]]:
    """Find large horizontal green title ribbons and return crop boxes in image pixels."""
    source = image.convert("RGB")
    width, height = source.size
    if width <= 0 or height <= 0:
        return []

    sample_width = min(420, max(180, width // 5))
    sample_height = max(1, round(height * sample_width / width))
    sample = source.resize((sample_width, sample_height), Image.Resampling.BILINEAR)
    pixels = sample.load()

    mask = [[False] * sample_width for _ in range(sample_height)]
    for y in range(sample_height):
        for x in range(sample_width):
            mask[y][x] = _looks_like_teal_banner_pixel(pixels[x, y])

    visited = [[False] * sample_width for _ in range(sample_height)]
    regions: list[tuple[int, int, int, int, int]] = []
    min_component_pixels = max(80, int(sample_width * sample_height * 0.0015))

    for start_y in range(sample_height):
        for start_x in range(sample_width):
            if visited[start_y][start_x] or not mask[start_y][start_x]:
                continue

            queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
            visited[start_y][start_x] = True
            min_x = max_x = start_x
            min_y = max_y = start_y
            count = 0

            while queue:
                x, y = queue.popleft()
                count += 1
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)

                for next_x, next_y in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                    if (
                        next_x < 0
                        or next_x >= sample_width
                        or next_y < 0
                        or next_y >= sample_height
                        or visited[next_y][next_x]
                        or not mask[next_y][next_x]
                    ):
                        continue
                    visited[next_y][next_x] = True
                    queue.append((next_x, next_y))

            if count < min_component_pixels:
                continue

            box_width = max_x - min_x + 1
            box_height = max_y - min_y + 1
            rel_width = box_width / sample_width
            rel_height = box_height / sample_height
            fill_ratio = count / max(1, box_width * box_height)

            # A title ribbon is a broad, relatively shallow block. This filters out
            # large colored walls/backgrounds and tiny decorative icons.
            if not (0.18 <= rel_width <= 0.72 and 0.045 <= rel_height <= 0.34 and fill_ratio >= 0.25):
                continue

            pad_x = max(8, int(width * 0.015))
            pad_y = max(8, int(height * 0.015))
            x0 = max(0, int(min_x * width / sample_width) - pad_x)
            y0 = max(0, int(min_y * height / sample_height) - pad_y)
            x1 = min(width, int((max_x + 1) * width / sample_width) + pad_x)
            y1 = min(height, int((max_y + 1) * height / sample_height) + pad_y)
            if not _has_light_text_pixels(source, (x0, y0, x1, y1)):
                continue
            regions.append((count, x0, y0, x1, y1))

    # Prefer the most ribbon-like regions first and avoid near-duplicate crops.
    regions.sort(reverse=True)
    result: list[tuple[int, int, int, int]] = []
    for _, x0, y0, x1, y1 in regions:
        candidate = (x0, y0, x1, y1)
        if any(_boxes_overlap_ratio(candidate, existing) > 0.65 for existing in result):
            continue
        result.append(candidate)
        if len(result) >= 4:
            break
    return result


def _boxes_overlap_ratio(a: tuple[int, int, int, int], b: tuple[int, int, int, int]) -> float:
    left = max(a[0], b[0])
    top = max(a[1], b[1])
    right = min(a[2], b[2])
    bottom = min(a[3], b[3])
    if right <= left or bottom <= top:
        return 0.0
    intersection = (right - left) * (bottom - top)
    area_a = max(1, (a[2] - a[0]) * (a[3] - a[1]))
    area_b = max(1, (b[2] - b[0]) * (b[3] - b[1]))
    return intersection / min(area_a, area_b)


def _prepare_ocr_crop(crop: Image.Image, *, scale: int = 3) -> Image.Image:
    """Upscale small title ribbons before OCR without changing the site images."""
    if scale <= 1:
        return crop.convert("RGB")
    width, height = crop.size
    return crop.convert("RGB").resize((width * scale, height * scale), Image.Resampling.LANCZOS)


def _stack_ocr_crops(crops: list[Image.Image]) -> Image.Image | None:
    if not crops:
        return None
    separator = 60
    width = max(crop.width for crop in crops)
    height = sum(crop.height for crop in crops) + separator * (len(crops) - 1)
    canvas = Image.new("RGB", (width, height), "white")
    y = 0
    for crop in crops:
        canvas.paste(crop, (0, y))
        y += crop.height + separator
    return canvas


def _banner_ocr_crops(image: Image.Image) -> list[Image.Image]:
    crops: list[Image.Image] = []
    for box in _find_teal_banner_regions(image):
        x0, y0, x1, y1 = box
        box_height = y1 - y0

        # The translucent rectangle can include a lot of empty background above or
        # below the word. Several vertical trims are stacked into one OCR image so
        # Tesseract sees clean text candidates without paying for many OCR calls.
        vertical_windows = ((0.0, 1.0), (0.25, 0.85), (0.30, 0.75), (0.35, 0.95))
        region_crops: list[Image.Image] = []
        for start, end in vertical_windows:
            crop_y0 = y0 + int(box_height * start)
            crop_y1 = y0 + int(box_height * end)
            if crop_y1 - crop_y0 < 24:
                continue
            region_crops.append(_prepare_ocr_crop(image.crop((x0, crop_y0, x1, crop_y1))))
        stacked = _stack_ocr_crops(region_crops)
        if stacked is not None:
            crops.append(stacked)
    return crops


def _combine_search_texts(parts: list[str]) -> str:
    seen: set[str] = set()
    output: list[str] = []
    for part in parts:
        normalized = normalize_search_text(part)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        output.append(normalized)
    return normalize_search_text(" ".join(output))


def build_page_search_text(page: fitz.Page, ocr: OcrRunner, options: RenderOptions, label: str) -> str:
    embedded_text = extract_embedded_text(page)
    if not ocr.should_run(embedded_text):
        return embedded_text

    ocr_image = render_page_image(page, options.ocr_dpi)
    text_parts = [embedded_text, ocr.recognize(ocr_image, label, psm=6)]

    banner_crops = _banner_ocr_crops(ocr_image)
    for index, crop in enumerate(banner_crops, start=1):
        text_parts.append(ocr.recognize(crop, f"{label} title ribbon {index}", psm=6))

    return _combine_search_texts(text_parts)


def render_pdf(pdf_path: Path, out_dir: Path, options: RenderOptions) -> tuple[int, list[dict[str, Any]], list[list[int]]]:
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
        page_sizes: list[list[int]] = []

        for page_number, page in enumerate(doc, start=1):
            page_file = out_dir / f"page-{page_number:03d}.{ext}"
            thumb_file = thumb_dir / f"page-{page_number:03d}.{ext}"
            label = f"{pdf_path.name} page {page_number}/{len(doc)}"

            page_text = build_page_search_text(page, ocr, options, label)
            if page_text:
                search_pages.append({"page": page_number, "text": page_text})

            if options.skip_existing and page_file.exists() and thumb_file.exists():
                try:
                    with Image.open(page_file) as existing_image:
                        page_sizes.append([int(existing_image.width), int(existing_image.height)])
                except (OSError, ValueError):
                    page_sizes.append([0, 0])
                print(f"[skip] {pdf_path.name}: page {page_number}/{len(doc)} already exists")
                continue

            image = render_page_image(page, options.dpi)

            if image.width > options.max_width or image.height > options.max_height:
                image.thumbnail((options.max_width, options.max_height), Image.Resampling.LANCZOS)

            image = maybe_sharpen(image, options.sharpen)
            page_sizes.append([int(image.width), int(image.height)])
            save_image(image, page_file, ext, options.quality)

            thumb = image.copy()
            thumb.thumbnail((options.thumb_size, options.thumb_size), Image.Resampling.LANCZOS)
            thumb = maybe_sharpen(thumb, max(0, options.sharpen * 0.65))
            save_image(thumb, thumb_file, ext, options.thumb_quality if ext != "png" else options.quality)

            print(f"[render] {pdf_path.name}: page {page_number}/{len(doc)} -> {rel_to_root(page_file)}")

        return len(doc), search_pages, page_sizes


def build_generated_entry(
    item: dict[str, Any],
    pages: int,
    out_dir: Path,
    image_format: str,
    page_sizes: list[list[int]] | None = None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "id": item["id"],
        "title": item["title"],
        "description": item.get("description", ""),
        "category": item.get("category", "קטלוג"),
        "pages": pages,
        "dir": rel_to_root(out_dir),
        "cover": f"{rel_to_root(out_dir)}/page-001.{image_format}",
        "imageExt": image_format,
        "assetVersion": catalog_asset_version(out_dir, image_format, pages),
    }

    if page_sizes and len(page_sizes) >= pages:
        entry["pageSizes"] = page_sizes[:pages]

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
    parser.add_argument(
        "--force",
        "--rebuild-all",
        action="store_true",
        help="Render every configured catalog again, even when assets/pages/<id> already exists",
    )
    parser.add_argument("--no-clean", action="store_true", help="When rendering, do not delete the old output folder first")
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
        previous_search_pages = load_previous_search_pages(root)

        for item in config:
            catalog_id = str(item["id"])
            pdf_path = (root / str(item["pdf"])).resolve()
            out_dir = (root / "assets" / "pages" / catalog_id).resolve()
            existing_output = inspect_existing_catalog_output(out_dir, options.image_format)

            print(f"\n=== {item['title']} ===")
            if existing_output and existing_output.is_complete and not args.force:
                print(f"[skip-catalog] Already converted: {_format_output_status(out_dir, existing_output.image_format, existing_output.pages)}")
                if not pdf_path.exists():
                    print(f"[keep] Source PDF is missing, keeping existing images: {rel_to_root(pdf_path)}")
                search_pages = previous_search_pages.get(catalog_id, [])
                if not search_pages:
                    print("[warn] No previous OCR/search text found for this skipped catalog; images will still be shown.")
                page_sizes = collect_page_sizes(out_dir, existing_output.image_format, existing_output.pages)
                generated.append(build_generated_entry(item, existing_output.pages, out_dir, existing_output.image_format, page_sizes))
                search_generated.append(build_search_entry(item, search_pages))
                continue

            if not pdf_path.exists():
                if existing_output and existing_output.is_complete:
                    print(f"[keep] Source PDF is missing, keeping existing images: {_format_output_status(out_dir, existing_output.image_format, existing_output.pages)}")
                    search_pages = previous_search_pages.get(catalog_id, [])
                    if not search_pages:
                        print("[warn] No previous OCR/search text found for this catalog; images will still be shown.")
                    page_sizes = collect_page_sizes(out_dir, existing_output.image_format, existing_output.pages)
                    generated.append(build_generated_entry(item, existing_output.pages, out_dir, existing_output.image_format, page_sizes))
                    search_generated.append(build_search_entry(item, search_pages))
                    continue

                if existing_output:
                    print(
                        f"[warn] Found an incomplete output folder at {rel_to_root(out_dir)} ({existing_output.reason}), "
                        "but the source PDF is missing. Skipping this catalog without deleting anything."
                    )
                else:
                    print(
                        f"[warn] Source PDF is missing and no converted images were found: {rel_to_root(pdf_path)}. "
                        "Skipping this catalog without deleting anything."
                    )
                continue

            if existing_output and not existing_output.is_complete:
                print(f"[warn] Existing output is incomplete ({existing_output.reason}); rebuilding from PDF.")
            elif existing_output and args.force:
                print(f"[force] Rebuilding existing output: {_format_output_status(out_dir, existing_output.image_format, existing_output.pages)}")

            pages, search_pages, page_sizes = render_pdf(pdf_path, out_dir, options)
            generated.append(build_generated_entry(item, pages, out_dir, options.image_format, page_sizes))
            search_generated.append(build_search_entry(item, search_pages))

        generated.sort(key=lambda row: row.get("sort", 9999))
        search_generated.sort(key=lambda row: next((item.get("sort", 9999) for item in config if item["id"] == row["catalogId"]), 9999))
        write_generated_files(generated, search_generated)

        print("\nDone.")
        print(f"Catalogs: {len(generated)}")
        print(f"Format: {options.image_format.upper()}")
        print("Generated: catalogs.generated.js")
        print("Generated: catalogs.search.js")
        print("Existing converted catalogs are kept and skipped by default. Use --force to rebuild all catalogs.")
        print("You may delete the PDFs after conversion if you only want to keep the images.")
        print("Open index.html or run: python -m http.server 8080")
        return 0
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
