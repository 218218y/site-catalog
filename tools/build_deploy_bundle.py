#!/usr/bin/env python3
"""Create a clean Netlify upload folder for the static catalog website.

The working project can contain PDFs, conversion tools, virtual environments,
setup files and temporary folders. The Netlify upload folder should contain only
what the browser needs:

- the static site files
- the generated catalog/search JavaScript
- the catalog image storage runtime config
- the converted catalog images under assets/pages, unless an external asset URL is supplied

Default output:
    dist/site-upload

Examples:
    python tools/build_deploy_bundle.py
    python tools/build_deploy_bundle.py --out dist/my-site
    python tools/build_deploy_bundle.py --zip
    python tools/build_deploy_bundle.py --include-json
    python tools/build_deploy_bundle.py --external-assets-url https://cdn.example.com
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

BIG_PAGES_VIEWER_FILE = "catalog-big-pages-viewer-netfree/catalog-big-pages-viewer.html"

DEPLOY_FILES = [
    "_headers",
    "_redirects",
    "index.html",
    "styles.css",
    "app.js",
    "catalog-search.js",
    "tooltip-manager.js",
    "catalog-snapshot.js",
    "catalog-assets.config.js",
    "brand-logo.js",
    "favicon-loader.js",
    "wp_logo_data.js",
    "catalogs.generated.js",
    "catalogs.search.js",
]

OPTIONAL_DEPLOY_FILES = [
    "favicon.ico",
    "favicon.svg",
    "favicon.png",
    "apple-touch-icon.png",
    "robots.txt",
    "site.webmanifest",
    "manifest.webmanifest",
]

JSON_DEPLOY_FILES = [
    "catalogs.generated.json",
    "catalogs.search.json",
]

HTML_ASSET_RE = re.compile(r"<(?:script|link)\b[^>]*(?:src|href)=[\"']([^\"']+)[\"']", re.IGNORECASE)
GENERATED_ASSIGNMENT_RE = re.compile(r"window\.BARGIG_CATALOGS\s*=\s*(\[.*?\])\s*;\s*$", re.DOTALL)
DEFAULT_R2_ASSET_BASE_URL = "https://cdn.bargig-furniture.com"


@dataclass(frozen=True)
class CopyStats:
    files: int
    bytes: int


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
            if unit == "B":
                return f"{int(value)} {unit}"
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"


def normalize_base_url(url: str) -> str:
    value = str(url or "").strip()
    if not value:
        return ""
    if not re.match(r"^[a-z][a-z0-9+.-]*://", value, flags=re.IGNORECASE):
        raise ValueError(f"External asset URL must start with http:// or https://: {url}")
    return value if value.endswith("/") else f"{value}/"


def asset_config_content(base_url: str) -> str:
    return (
        "// Runtime catalog image storage configuration.\n"
        "// Empty value means: load images from the Netlify site upload folder.\n"
        "// Non-empty value means: load relative catalog image paths from this external base URL.\n"
        f"window.BARGIG_CATALOG_ASSET_BASE_URL = {json.dumps(base_url, ensure_ascii=False)};\n"
    )


def write_asset_config(out_dir: Path, base_url: str) -> CopyStats:
    target = out_dir / "catalog-assets.config.js"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(asset_config_content(base_url), encoding="utf-8")
    return CopyStats(files=1, bytes=target.stat().st_size)


def ensure_safe_output_dir(root: Path, out_dir: Path) -> Path:
    resolved = out_dir.resolve()
    forbidden = {
        root.resolve(),
        (root / "assets").resolve(),
        (root / "assets" / "pages").resolve(),
        (root / "assets" / "pdfs").resolve(),
        (root / "tools").resolve(),
    }
    if resolved in forbidden:
        raise ValueError(f"Refusing to use unsafe output folder: {rel_to_root(resolved)}")
    return resolved


def clean_output_dir(out_dir: Path) -> None:
    if out_dir.exists():
        shutil.rmtree(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)


def copy_file(root: Path, out_dir: Path, relative_path: str | Path) -> CopyStats:
    relative = Path(relative_path)
    source = root / relative
    target = out_dir / relative
    if not source.is_file():
        raise FileNotFoundError(f"Required deploy file is missing: {relative.as_posix()}")
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return CopyStats(files=1, bytes=source.stat().st_size)


def copy_optional_file(root: Path, out_dir: Path, relative_path: str | Path) -> CopyStats:
    relative = Path(relative_path)
    source = root / relative
    if not source.is_file():
        return CopyStats(files=0, bytes=0)
    return copy_file(root, out_dir, relative)


def iter_files(directory: Path) -> Iterable[Path]:
    if not directory.is_dir():
        return
    for path in directory.rglob("*"):
        if path.is_file():
            yield path


def copy_tree(source: Path, target: Path) -> CopyStats:
    files = 0
    total_bytes = 0
    target.mkdir(parents=True, exist_ok=True)
    for source_file in iter_files(source):
        relative = source_file.relative_to(source)
        target_file = target / relative
        target_file.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, target_file)
        files += 1
        total_bytes += source_file.stat().st_size
    return CopyStats(files=files, bytes=total_bytes)


def add_stats(left: CopyStats, right: CopyStats) -> CopyStats:
    return CopyStats(files=left.files + right.files, bytes=left.bytes + right.bytes)


def referenced_html_assets(root: Path) -> set[str]:
    references: set[str] = set()
    for html_file in ("index.html",):
        path = root / html_file
        if not path.is_file():
            continue
        content = path.read_text(encoding="utf-8", errors="replace")
        for match in HTML_ASSET_RE.finditer(content):
            reference = match.group(1).strip()
            if not reference or reference.startswith(("http://", "https://", "//", "#", "mailto:")):
                continue
            references.add(reference.split("?", 1)[0].split("#", 1)[0])
    return references


def load_generated_catalogs(root: Path) -> list[dict]:
    generated_json = root / "catalogs.generated.json"
    if generated_json.is_file():
        try:
            data = json.loads(generated_json.read_text(encoding="utf-8-sig"))
            if isinstance(data, list):
                return [item for item in data if isinstance(item, dict)]
        except json.JSONDecodeError as exc:
            print(f"[warn] Could not parse catalogs.generated.json: {exc}", file=sys.stderr)

    generated_js = root / "catalogs.generated.js"
    if not generated_js.is_file():
        return []
    content = generated_js.read_text(encoding="utf-8", errors="replace")
    match = GENERATED_ASSIGNMENT_RE.search(content)
    if not match:
        return []
    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError as exc:
        print(f"[warn] Could not parse catalogs.generated.js: {exc}", file=sys.stderr)
        return []
    return [item for item in data if isinstance(item, dict)] if isinstance(data, list) else []


def validate_static_references(root: Path) -> list[str]:
    warnings: list[str] = []
    known_files = {Path(path).as_posix() for path in DEPLOY_FILES + OPTIONAL_DEPLOY_FILES + JSON_DEPLOY_FILES}
    for reference in sorted(referenced_html_assets(root)):
        if reference in known_files:
            continue
        if not (root / reference).exists():
            warnings.append(f"HTML references a missing local file: {reference}")
    return warnings


def validate_catalog_assets(root: Path) -> list[str]:
    warnings: list[str] = []
    catalogs = load_generated_catalogs(root)
    if not catalogs:
        warnings.append("No generated catalogs were found. Run convert-catalogs.bat after adding PDFs.")
        return warnings

    for catalog in catalogs:
        catalog_id = str(catalog.get("id", "")).strip() or "unknown"
        cover = str(catalog.get("cover", "")).strip()
        catalog_dir = str(catalog.get("dir", "")).strip()
        image_ext = str(catalog.get("imageExt", "jpg")).strip().lstrip(".") or "jpg"
        pages = int(catalog.get("pages", 0) or 0)

        if cover and not (root / cover).is_file():
            warnings.append(f"Catalog {catalog_id}: missing cover image {cover}")
        if catalog_dir:
            dir_path = root / catalog_dir
            if not dir_path.is_dir():
                warnings.append(f"Catalog {catalog_id}: missing image folder {catalog_dir}")
                continue
            if pages > 0:
                first_page = dir_path / f"page-001.{image_ext}"
                first_thumb = dir_path / "thumbs" / f"page-001.{image_ext}"
                if not first_page.is_file():
                    warnings.append(f"Catalog {catalog_id}: missing first page image {rel_to_root(first_page)}")
                if not first_thumb.is_file():
                    warnings.append(f"Catalog {catalog_id}: missing first thumbnail {rel_to_root(first_thumb)}")
    return warnings


def create_zip_from_folder(folder: Path, zip_path: Path) -> CopyStats:
    files = 0
    total_bytes = 0
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    if zip_path.exists():
        zip_path.unlink()
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for file_path in sorted(iter_files(folder)):
            archive.write(file_path, file_path.relative_to(folder).as_posix())
            files += 1
            total_bytes += file_path.stat().st_size
    return CopyStats(files=files, bytes=total_bytes)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Create a clean Netlify upload folder for the catalog website.")
    parser.add_argument("--out", default=None, help="Output folder, relative to the project root by default")
    parser.add_argument("--no-clean", action="store_true", help="Do not clear the output folder before copying")
    parser.add_argument("--zip", action="store_true", help="Also create a .zip file next to the output folder")
    parser.add_argument("--include-json", action="store_true", help="Also copy catalogs.generated.json and catalogs.search.json")
    parser.add_argument(
        "--external-assets-url",
        nargs="?",
        const=DEFAULT_R2_ASSET_BASE_URL,
        default="",
        help=(
            "Create a site-only bundle that does not copy assets/pages, and load catalog images "
            "from the supplied external base URL. If no URL is supplied, the Bargig R2 custom-domain CDN URL is used."
        ),
    )
    parser.add_argument(
        "--allow-missing-pages",
        action="store_true",
        help="Create a local-images bundle even if assets/pages does not exist yet. The deployed viewer will need assets/pages to show catalog images.",
    )
    parser.add_argument(
        "--include-big-pages-viewer",
        action="store_true",
        help=(
            "Also copy the local diagnostic big-pages viewer into the deploy bundle. "
            "Do not use this for the public site unless you intentionally want that helper exposed."
        ),
    )
    args = parser.parse_args()
    args.external_assets_url = normalize_base_url(args.external_assets_url) if args.external_assets_url else ""
    if args.out is None:
        args.out = "dist/site-upload-r2" if args.external_assets_url else "dist/site-upload"
    return args


def main() -> int:
    args = parse_args()
    root = project_root()
    out_dir = ensure_safe_output_dir(root, root / args.out)

    try:
        if not args.no_clean:
            clean_output_dir(out_dir)
        else:
            out_dir.mkdir(parents=True, exist_ok=True)

        deploy_files = list(DEPLOY_FILES)
        if args.include_big_pages_viewer:
            deploy_files.append(BIG_PAGES_VIEWER_FILE)
            print(
                f"[warn] Including local-only diagnostic page in deploy bundle: {BIG_PAGES_VIEWER_FILE}",
                file=sys.stderr,
            )

        stats = CopyStats(files=0, bytes=0)
        for relative in deploy_files:
            if relative == "catalog-assets.config.js":
                continue
            stats = add_stats(stats, copy_file(root, out_dir, relative))
        for relative in OPTIONAL_DEPLOY_FILES:
            stats = add_stats(stats, copy_optional_file(root, out_dir, relative))
        if args.include_json:
            for relative in JSON_DEPLOY_FILES:
                stats = add_stats(stats, copy_optional_file(root, out_dir, relative))

        stats = add_stats(stats, write_asset_config(out_dir, args.external_assets_url))

        pages_dir = root / "assets" / "pages"
        using_external_assets = bool(args.external_assets_url)
        if using_external_assets:
            print(f"[assets] External catalog images: {args.external_assets_url}")
            print("[assets] assets/pages was not copied into the Netlify upload folder.")
        elif pages_dir.is_dir():
            pages_stats = copy_tree(pages_dir, out_dir / "assets" / "pages")
            stats = add_stats(stats, pages_stats)
            print(f"[copy] assets/pages -> {rel_to_root(out_dir / 'assets' / 'pages')} ({pages_stats.files} files)")
        elif args.allow_missing_pages:
            print("[warn] assets/pages does not exist. Bundle created without catalog images.", file=sys.stderr)
        else:
            raise FileNotFoundError("assets/pages does not exist. Run convert-catalogs.bat first, then run bundle-site.bat.")

        warnings = validate_static_references(root)
        if pages_dir.is_dir():
            warnings += validate_catalog_assets(root)
        elif using_external_assets:
            warnings.append("Local assets/pages does not exist, so the script could not verify that the R2 bucket contains every generated image.")
        for warning in warnings:
            print(f"[warn] {warning}", file=sys.stderr)

        print("\nDone.")
        print(f"Upload folder: {rel_to_root(out_dir)}")
        print(f"Copied: {stats.files} files, {format_bytes(stats.bytes)}")
        excluded_note = "PDFs, conversion tools, setup scripts, virtualenv, README, config, and other project-only files"
        if not args.include_big_pages_viewer:
            excluded_note += ", including the local diagnostic big-pages viewer"
        print(f"Excluded: {excluded_note}.")
        if args.external_assets_url:
            print(f"Images: external mode, loaded from {args.external_assets_url}")
        else:
            print("Images: local mode, assets/pages is included in the Netlify upload folder when it exists.")
        print("Contact: direct Gmail compose link only; no mailto fallback, form, or serverless function is required.")

        if args.zip:
            zip_path = out_dir.with_suffix(".zip")
            zip_stats = create_zip_from_folder(out_dir, zip_path)
            print(f"ZIP: {rel_to_root(zip_path)} ({zip_stats.files} files, {format_bytes(zip_path.stat().st_size)})")

        if warnings:
            print("\nBundle was created, but review the warnings above before uploading.")
        return 0
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
