#!/usr/bin/env python3
"""Build a static image-based catalog site from local PDF files.

The script reads catalogs.config.json, renders each PDF into high-quality page
images and thumbnails, and writes catalogs.generated.js for the website.

Defaults are tuned for fast catalog browsing:
- WebP output by default
- 220 DPI render, capped to 2800px on the long side for quick browsing
- separate lightweight thumbnails
- OCR prefers embedded PDF text and only falls back to full-page OCR for scanned/empty pages
- no PDF links in the site output

Examples:
    python tools/build_catalogs.py
    python tools/build_catalogs.py --force
    python tools/build_catalogs.py --format jpg
    python tools/build_catalogs.py --format webp --dpi 220 --quality 84
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
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
from PIL import Image, ImageFilter, ImageOps

SUPPORTED_FORMATS = {"webp", "jpg", "png"}
PAGE_FILE_RE = re.compile(r"^page-(\d{3})\.(webp|jpg|png)$", re.IGNORECASE)
BIDI_CONTROL_RE = re.compile(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069]")
MANUAL_SEARCH_FILE = "catalogs.search-overrides.json"
OCR_MAX_SIDE = 4600
MANIFEST_FILE = "catalog.render-manifest.json"
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


def source_pdf_metadata(pdf_path: Path) -> dict[str, Any]:
    stat = pdf_path.stat()
    return {
        "path": rel_to_root(pdf_path),
        "size": int(stat.st_size),
        "mtimeNs": int(stat.st_mtime_ns),
    }


def render_options_metadata(options: RenderOptions) -> dict[str, Any]:
    """Return only the settings that affect rendered page/thumbnail images."""
    return {
        "dpi": int(options.dpi),
        "maxWidth": int(options.max_width),
        "maxHeight": int(options.max_height),
        "thumbSize": int(options.thumb_size),
        "quality": int(options.quality),
        "thumbQuality": int(options.thumb_quality),
        "imageFormat": str(options.image_format),
        "sharpen": float(options.sharpen),
    }


def search_options_metadata(options: RenderOptions) -> dict[str, Any]:
    """Return settings that affect search text only and must not force image rebuilds."""
    return {
        "ocrMode": str(options.ocr_mode),
        "ocrLang": str(options.ocr_lang),
        "ocrDpi": int(options.ocr_dpi),
        "ocrMinChars": int(options.ocr_min_chars),
    }


def _image_render_options_from_manifest(value: Any) -> dict[str, Any] | None:
    """Read image-affecting render options from new or legacy manifests.

    Older manifests stored OCR settings inside ``renderOptions``. OCR only
    changes the search index, not the generated page images, so those legacy
    fields are deliberately ignored here. This keeps a catalog rendered with
    ``--ocr never`` from being rebuilt later only because a regular conversion
    is run with ``--ocr auto``.
    """
    if not isinstance(value, dict):
        return None

    keys = (
        "dpi",
        "maxWidth",
        "maxHeight",
        "thumbSize",
        "quality",
        "thumbQuality",
        "imageFormat",
        "sharpen",
    )
    result: dict[str, Any] = {}
    for key in keys:
        if key not in value:
            return None
        result[key] = value[key]
    return result


def render_manifest_path(out_dir: Path) -> Path:
    return out_dir / MANIFEST_FILE


def load_render_manifest(out_dir: Path) -> dict[str, Any] | None:
    manifest_path = render_manifest_path(out_dir)
    if not manifest_path.exists():
        return None

    try:
        payload = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[warn] Could not read {rel_to_root(manifest_path)}: {exc}", file=sys.stderr)
        return None

    return payload if isinstance(payload, dict) else None


def write_render_manifest(
    out_dir: Path,
    pdf_path: Path,
    options: RenderOptions,
    pages: int,
    image_format: str,
    page_sizes: list[list[int]],
) -> None:
    if not pdf_path.exists():
        return

    payload = {
        "version": 1,
        "sourcePdf": source_pdf_metadata(pdf_path),
        "renderOptions": render_options_metadata(options),
        "searchOptions": search_options_metadata(options),
        "pages": int(pages),
        "imageFormat": str(image_format),
        "pageSizes": page_sizes[: max(0, int(pages))],
    }
    manifest_path = render_manifest_path(out_dir)
    manifest_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def output_newest_mtime_ns(out_dir: Path, image_format: str, page_count: int) -> int:
    newest = 0
    for page_number in range(1, max(0, int(page_count)) + 1):
        for relative in (
            Path(f"page-{page_number:03d}.{image_format}"),
            Path("thumbs") / f"page-{page_number:03d}.{image_format}",
        ):
            file_path = out_dir / relative
            if not file_path.is_file():
                continue
            try:
                newest = max(newest, int(file_path.stat().st_mtime_ns))
            except OSError:
                continue
    return newest


def source_pdf_is_newer_than_output(pdf_path: Path, out_dir: Path, image_format: str, page_count: int) -> bool:
    try:
        pdf_mtime = int(pdf_path.stat().st_mtime_ns)
    except OSError:
        return False

    newest_output = output_newest_mtime_ns(out_dir, image_format, page_count)
    return bool(newest_output and pdf_mtime > newest_output)


def render_manifest_mismatch_reason(
    out_dir: Path,
    pdf_path: Path,
    options: RenderOptions,
    existing_output: ExistingCatalogOutput,
) -> str:
    if str(existing_output.image_format).lower() != str(options.image_format).lower():
        return "conversion settings changed since the previous conversion"

    manifest = load_render_manifest(out_dir)
    if not manifest:
        return "missing render manifest"

    source_pdf = manifest.get("sourcePdf")
    expected_pdf = source_pdf_metadata(pdf_path)
    if not isinstance(source_pdf, dict):
        return "render manifest has no source PDF data"
    if source_pdf.get("size") != expected_pdf.get("size") or source_pdf.get("mtimeNs") != expected_pdf.get("mtimeNs"):
        return "source PDF changed since the previous conversion"

    render_options = _image_render_options_from_manifest(manifest.get("renderOptions"))
    if render_options != render_options_metadata(options):
        return "image conversion settings changed since the previous conversion"

    if int(manifest.get("pages", 0) or 0) != int(existing_output.pages):
        return "page count changed since the previous conversion"
    if str(manifest.get("imageFormat", "")).lower() != str(existing_output.image_format).lower():
        return "image format changed since the previous conversion"

    return ""


def search_manifest_mismatch_reason(out_dir: Path, options: RenderOptions) -> str:
    """Return why the search/OCR text should be refreshed without re-rendering images."""
    manifest = load_render_manifest(out_dir)
    if not manifest:
        return "missing render manifest"

    search_options = manifest.get("searchOptions")
    if not isinstance(search_options, dict):
        return "render manifest has no search/OCR settings"
    if search_options != search_options_metadata(options):
        return "search/OCR settings changed since the previous conversion"

    return ""


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


def _read_config_payload(config_path: Path) -> list[dict[str, Any]]:
    if not config_path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")

    data = json.loads(config_path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, list):
        raise ValueError("catalogs.config.json must contain a JSON array")

    return data


def load_config(config_path: Path) -> list[dict[str, Any]]:
    data = _read_config_payload(config_path)

    required = {"id", "title", "pdf"}
    seen_ids: set[str] = set()
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
        if safe_id in seen_ids:
            raise ValueError(f"Catalog #{index} uses duplicate id: {safe_id!r}")
        seen_ids.add(safe_id)
    return data


def delete_unlisted_catalog_outputs(root: Path, configured_ids: set[str]) -> list[Path]:
    """Delete converted catalog output folders that are no longer listed in the config.

    Only direct subdirectories of assets/pages are considered. This keeps the
    cleanup scoped to generated catalog folders and prevents accidental deletion
    elsewhere in the project.
    """
    pages_root = root / "assets" / "pages"
    if not pages_root.is_dir():
        print(f"[cleanup] No converted catalog folder found: {rel_to_root(pages_root)}")
        return []

    deleted: list[Path] = []
    for output_dir in sorted(pages_root.iterdir(), key=lambda path: path.name.lower()):
        if not output_dir.is_dir():
            continue
        if output_dir.name in configured_ids:
            continue
        shutil.rmtree(output_dir)
        deleted.append(output_dir)
        print(f"[delete-unlisted] Removed converted catalog not listed in config: {rel_to_root(output_dir)}")

    if not deleted:
        print("[cleanup] No unlisted converted catalog folders were found.")
    return deleted


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


def render_ocr_page_image(page: fitz.Page, dpi: int) -> Image.Image:
    """Render an OCR input image, capped to avoid very large slow Tesseract jobs."""
    image = render_page_image(page, dpi)
    if max(image.size) > OCR_MAX_SIDE:
        image.thumbnail((OCR_MAX_SIDE, OCR_MAX_SIDE), Image.Resampling.LANCZOS)
    return image


def prepare_ocr_input_image(image: Image.Image) -> Image.Image:
    """Prepare catalog pages for OCR without changing the rendered site images.

    Catalog model names are often white/light text on muted colored ribbons or
    thin Hebrew letters on a beige background. Tesseract is noticeably more
    reliable when it receives a high-contrast grayscale image instead of the
    original full-color catalog page.
    """
    grayscale = ImageOps.grayscale(image)
    grayscale = ImageOps.autocontrast(grayscale, cutoff=1)
    return grayscale.filter(ImageFilter.UnsharpMask(radius=1.2, percent=180, threshold=2))


def normalize_search_text(value: str) -> str:
    """Normalize text before it is written to the client-side search index."""
    cleaned = BIDI_CONTROL_RE.sub("", str(value or "").replace("\u00ad", ""))
    return " ".join(cleaned.split())


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
            prepare_ocr_input_image(image).save(tmp_path, "PNG")
            command = [
                self.options.tesseract_cmd,
                str(tmp_path),
                "stdout",
                "-l",
                self.options.ocr_lang,
                "--psm",
                str(max(0, int(psm))),
                "-c",
                "preserve_interword_spaces=1",
            ]
            completed = subprocess.run(
                command,
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


def build_page_search_text(
    page: fitz.Page,
    ocr: OcrRunner,
    options: RenderOptions,
    label: str,
    manual_text: str = "",
) -> str:
    """Build clean searchable text for one page.

    The safe order is:
    1. use embedded PDF text when it exists;
    2. run one regular full-page OCR pass only for scanned/empty pages;
    3. append deliberate manual search overrides.

    Older versions also OCRed guessed title/photo regions and colored ribbons.
    That helped a few white-on-image captions, but it also interpreted furniture,
    shadows and decorative lines as letters, so it polluted the search index with
    false characters. The OCR input itself is still contrast-enhanced before it is
    sent to Tesseract, which improves thin Hebrew model names without adding
    guessed crop regions.
    """
    embedded_text = extract_embedded_text(page)
    text_parts = [embedded_text]

    if ocr.should_run(embedded_text):
        ocr_image = render_ocr_page_image(page, options.ocr_dpi)
        text_parts.append(ocr.recognize(ocr_image, label, psm=6))

    if manual_text:
        text_parts.append(manual_text)

    return _combine_search_texts(text_parts)


def _manual_text_from_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return normalize_search_text(value)
    if isinstance(value, (int, float)):
        return normalize_search_text(str(value))
    if isinstance(value, list):
        return _combine_search_texts([_manual_text_from_value(item) for item in value])
    if isinstance(value, dict):
        parts: list[str] = []
        for key in ("text", "search", "terms", "aliases", "model", "title"):
            if key in value:
                parts.append(_manual_text_from_value(value.get(key)))
        return _combine_search_texts(parts)
    return normalize_search_text(str(value))


def _page_number_from_key(key: Any) -> int | None:
    if isinstance(key, int):
        return key
    match = re.search(r"\d+", str(key or ""))
    if not match:
        return None
    try:
        return int(match.group(0))
    except ValueError:
        return None


def load_manual_search_overrides(root: Path) -> dict[str, dict[int, str]]:
    override_path = root / MANUAL_SEARCH_FILE
    if not override_path.exists():
        return {}

    try:
        payload = json.loads(override_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"[warn] Could not read {MANUAL_SEARCH_FILE}: {exc}", file=sys.stderr)
        return {}

    if not isinstance(payload, dict):
        print(f"[warn] {MANUAL_SEARCH_FILE} must contain an object keyed by catalog id.", file=sys.stderr)
        return {}

    result: dict[str, dict[int, str]] = {}
    for catalog_id, catalog_value in payload.items():
        catalog_key = str(catalog_id).strip()
        if not catalog_key:
            continue

        page_map: dict[int, str] = {}
        if isinstance(catalog_value, list):
            iterable = []
            for item in catalog_value:
                if not isinstance(item, dict):
                    continue
                page = _page_number_from_key(item.get("page"))
                iterable.append((page, item))
        elif isinstance(catalog_value, dict):
            iterable = [(_page_number_from_key(page_key), page_value) for page_key, page_value in catalog_value.items()]
        else:
            print(f"[warn] Ignoring {MANUAL_SEARCH_FILE} entry for {catalog_key}: expected object or list.", file=sys.stderr)
            continue

        for page_number, value in iterable:
            if not page_number or page_number < 1:
                continue
            manual_text = _manual_text_from_value(value)
            if not manual_text:
                continue
            page_map[page_number] = _combine_search_texts([page_map.get(page_number, ""), manual_text])

        if page_map:
            result[catalog_key] = page_map

    return result


def merge_manual_search_pages(
    search_pages: list[dict[str, Any]],
    manual_pages: dict[int, str] | None,
    page_count: int | None = None,
) -> list[dict[str, Any]]:
    if not manual_pages:
        return search_pages

    merged: dict[int, str] = {}
    for page in search_pages:
        if not isinstance(page, dict):
            continue
        page_number = _page_number_from_key(page.get("page"))
        if not page_number:
            continue
        text = normalize_search_text(str(page.get("text", "")))
        if text:
            merged[page_number] = _combine_search_texts([merged.get(page_number, ""), text])

    for page_number, manual_text in sorted(manual_pages.items()):
        if page_number < 1:
            continue
        if page_count is not None and page_number > page_count:
            print(f"[warn] Ignoring manual search text for page {page_number}; catalog has only {page_count} pages.", file=sys.stderr)
            continue
        merged[page_number] = _combine_search_texts([merged.get(page_number, ""), manual_text])

    return [{"page": page_number, "text": text} for page_number, text in sorted(merged.items()) if text]


def build_pdf_search_pages(
    pdf_path: Path,
    options: RenderOptions,
    manual_pages: dict[int, str] | None = None,
) -> tuple[int, list[dict[str, Any]]]:
    """Build the search index from a PDF without touching rendered page images.

    This is used when the catalog images are already complete but the previous
    OCR/search index is missing, empty, or was built with older search settings.
    """
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    with fitz.open(pdf_path) as doc:
        if len(doc) == 0:
            raise ValueError(f"PDF has no pages: {pdf_path}")

        ocr = OcrRunner(options)
        search_pages: list[dict[str, Any]] = []
        for page_number, page in enumerate(doc, start=1):
            label = f"{pdf_path.name} page {page_number}/{len(doc)}"
            page_text = build_page_search_text(page, ocr, options, label, (manual_pages or {}).get(page_number, ""))
            if page_text:
                search_pages.append({"page": page_number, "text": page_text})
        return len(doc), search_pages


def render_pdf(pdf_path: Path, out_dir: Path, options: RenderOptions, manual_pages: dict[int, str] | None = None) -> tuple[int, list[dict[str, Any]], list[list[int]]]:
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

            page_text = build_page_search_text(page, ocr, options, label, (manual_pages or {}).get(page_number, ""))
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
            save_image(image, page_file, ext, options.quality)
            try:
                with Image.open(page_file) as saved_image:
                    page_sizes.append([int(saved_image.width), int(saved_image.height)])
            except (OSError, ValueError):
                page_sizes.append([int(image.width), int(image.height)])

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

    subcategory = item.get("subcategory", item.get("subCategory", item.get("sub_category", item.get("subcategories", ""))))
    if "subcategory" in item or "subCategory" in item or "sub_category" in item or "subcategories" in item:
        entry["subcategory"] = subcategory

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
    parser.add_argument("--format", choices=sorted(SUPPORTED_FORMATS), default="webp", help="Output image format")
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
    parser.add_argument(
        "--delete-unlisted",
        action="store_true",
        help="Delete converted catalog folders under assets/pages whose id is not listed in the config",
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
        configured_ids = {str(item["id"]) for item in config}
        if args.delete_unlisted:
            delete_unlisted_catalog_outputs(root, configured_ids)

        generated: list[dict[str, Any]] = []
        search_generated: list[dict[str, Any]] = []
        previous_search_pages = load_previous_search_pages(root)
        manual_search_overrides = load_manual_search_overrides(root)

        for item in config:
            catalog_id = str(item["id"])
            manual_pages = manual_search_overrides.get(catalog_id, {})
            pdf_path = (root / str(item["pdf"])).resolve()
            out_dir = (root / "assets" / "pages" / catalog_id).resolve()
            existing_output = inspect_existing_catalog_output(out_dir, options.image_format)

            print(f"\n=== {item['title']} ===")
            rebuild_reason = ""
            adopt_legacy_manifest = False

            if existing_output and existing_output.is_complete and not args.force and pdf_path.exists():
                mismatch_reason = render_manifest_mismatch_reason(out_dir, pdf_path, options, existing_output)
                if mismatch_reason == "missing render manifest":
                    if source_pdf_is_newer_than_output(pdf_path, out_dir, existing_output.image_format, existing_output.pages):
                        rebuild_reason = "source PDF is newer than the existing converted images"
                    else:
                        adopt_legacy_manifest = True
                elif mismatch_reason:
                    rebuild_reason = mismatch_reason

            if existing_output and existing_output.is_complete and not args.force and not rebuild_reason:
                print(f"[skip-catalog] Already converted: {_format_output_status(out_dir, existing_output.image_format, existing_output.pages)}")

                previous_pages_for_catalog = previous_search_pages.get(catalog_id, [])
                search_refresh_reason = ""
                if not pdf_path.exists():
                    print(f"[keep] Source PDF is missing, keeping existing images: {rel_to_root(pdf_path)}")
                else:
                    if adopt_legacy_manifest:
                        print(f"[adopt] Existing images do not have {MANIFEST_FILE}; adopting them for future change detection.")
                    if not previous_pages_for_catalog:
                        search_refresh_reason = "no previous OCR/search text found"
                    else:
                        search_refresh_reason = search_manifest_mismatch_reason(out_dir, options)

                if search_refresh_reason and pdf_path.exists():
                    print(f"[search-refresh] {search_refresh_reason}; rebuilding search text from PDF without re-rendering images.")
                    search_page_count, search_pages = build_pdf_search_pages(pdf_path, options, manual_pages)
                    if int(search_page_count) != int(existing_output.pages):
                        print(
                            f"[warn] Search refresh read {search_page_count} PDF pages, "
                            f"but existing images contain {existing_output.pages} pages."
                        )
                else:
                    search_pages = merge_manual_search_pages(previous_pages_for_catalog, manual_pages, existing_output.pages)

                if not search_pages:
                    print("[warn] No previous OCR/search text found for this skipped catalog; images will still be shown.")
                page_sizes = collect_page_sizes(out_dir, existing_output.image_format, existing_output.pages)
                if pdf_path.exists() and (adopt_legacy_manifest or search_refresh_reason):
                    write_render_manifest(out_dir, pdf_path, options, existing_output.pages, existing_output.image_format, page_sizes)
                generated.append(build_generated_entry(item, existing_output.pages, out_dir, existing_output.image_format, page_sizes))
                search_generated.append(build_search_entry(item, search_pages))
                continue

            if rebuild_reason:
                print(f"[rebuild] {rebuild_reason}.")

            if not pdf_path.exists():
                if existing_output and existing_output.is_complete:
                    print(f"[keep] Source PDF is missing, keeping existing images: {_format_output_status(out_dir, existing_output.image_format, existing_output.pages)}")
                    search_pages = merge_manual_search_pages(previous_search_pages.get(catalog_id, []), manual_pages, existing_output.pages)
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

            pages, search_pages, page_sizes = render_pdf(pdf_path, out_dir, options, manual_pages)
            page_sizes = collect_page_sizes(out_dir, options.image_format, pages)
            write_render_manifest(out_dir, pdf_path, options, pages, options.image_format, page_sizes)
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
        print("Existing converted catalogs are skipped only when their source PDF and image conversion settings did not change. OCR/search settings can refresh the search index without re-rendering images. Use --force to rebuild all catalogs.")
        if args.delete_unlisted:
            print("Unlisted converted catalog folders under assets/pages were deleted before conversion.")
        print("You may delete the PDFs after conversion if you only want to keep the images.")
        print("Open index.html or run: python -m http.server 8080")
        return 0
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
