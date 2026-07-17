#!/usr/bin/env python3
"""Create a clean Cloudflare Pages upload folder for the R2-backed static catalog website.

The project keeps PDFs, conversion tools, virtual environments, setup files and
other work files locally. The Cloudflare Pages upload folder should contain only what the
browser needs for the public site. Catalog page images are not copied into the
Cloudflare Pages upload folder; they are served from Cloudflare R2/CDN through
catalog-assets.config.js.

Default output:
    dist/site-upload-r2

Examples:
    python tools/build_deploy_bundle.py
    python tools/build_deploy_bundle.py --out dist/my-site-r2
    python tools/build_deploy_bundle.py --zip
    python tools/build_deploy_bundle.py --include-json
    python tools/build_deploy_bundle.py --external-assets-url https://cdn.example.com

The deploy bundle renders all public HTML documents from site.template.html,
fingerprints browser-loaded CSS/JS files, and rewrites every page to reference
the hashed filenames. This makes each new site
version a new URL in the browser cache, so users get updates without clearing
cookies, manually purging Cloudflare, or relying on every browser to revalidate
same-name files correctly.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import sys
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from build_site_pages import PAGE_DOCUMENTS, render_site_pages
from verify_remote_catalog_assets import load_catalogs as load_remote_catalogs, verify_remote_assets

BIG_PAGES_VIEWER_FILE = "catalog-big-pages-viewer-netfree/catalog-big-pages-viewer.html"

DEPLOY_FILES = [
    "_headers",
    "_redirects",
    "404.html",
    "404.css",
    "https-redirect.js",
    "styles.css",
    "app.js",
    "catalog-search.js",
    "tooltip-manager.js",
    "favorites-store.js",
    "site-routes.js",
    "catalog-snapshot.js",
    "catalog-assets.config.js",
    "brand-logo.svg",
    "brand-logo-header.svg",
    "favicon-loader.js",
    "catalogs.generated.js",
    "catalogs.search.js",
]

OPTIONAL_DEPLOY_FILES = [
    "robots.txt",
    "site.webmanifest",
    "manifest.webmanifest",
]

WEB_APP_ICON_PATTERNS = (
    "favicon*.ico",
    "favicon*.png",
    "favicon*.svg",
    "favicon*.webp",
    "apple-touch-icon*.png",
    "android-chrome-*.png",
    "mstile-*.png",
    "safari-pinned-tab.svg",
)

JSON_DEPLOY_FILES = [
    "catalogs.generated.json",
    "catalogs.search.json",
]

HTML_ASSET_RE = re.compile(r"<(?:script|link)\b[^>]*(?:src|href)=[\"']([^\"']+)[\"']", re.IGNORECASE)
HTML_ASSET_ATTR_RE = re.compile(
    r"(?P<prefix><(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*[\"'])(?P<url>[^\"']+)(?P<suffix>[\"'])",
    re.IGNORECASE,
)
CSS_URL_RE = re.compile(
    r"url\(\s*(?P<quote>[\"']?)(?P<url>[^\"')]+)(?P=quote)\s*\)",
    re.IGNORECASE,
)
GENERATED_ASSIGNMENT_RE = re.compile(r"window\.BARGIG_CATALOGS\s*=\s*(\[.*?\])\s*;\s*$", re.DOTALL)
DEFAULT_R2_ASSET_BASE_URL = "https://cdn.bargig-furniture.com"
FINGERPRINTED_ASSET_DIR = "static"
FINGERPRINTED_EXTENSIONS = {".css", ".js"}
FINGERPRINT_HTML_FILES = tuple(page.filename for page in PAGE_DOCUMENTS) + ("404.html",)
HASHED_ASSET_FILENAME_RE = re.compile(
    r"^(?P<stem>.+)\.(?P<digest>[0-9a-f]{12})\.(?P<extension>css|js)$"
)
SEARCH_INDEX_RUNTIME_RE = re.compile(r'const SEARCH_INDEX_SCRIPT_SRC = "(?P<url>[^"]+)";')


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
        raise ValueError("R2/CDN asset URL is required.")
    if not re.match(r"^[a-z][a-z0-9+.-]*://", value, flags=re.IGNORECASE):
        raise ValueError(f"R2/CDN asset URL must start with http:// or https://: {url}")
    return value if value.endswith("/") else f"{value}/"


def asset_config_content(base_url: str) -> str:
    return (
        "// Runtime catalog image storage configuration.\n"
        "// R2 deployment mode: catalog page images stay outside the Cloudflare Pages upload folder.\n"
        "// Relative image paths from catalogs.generated.* are resolved against this CDN/R2 base URL.\n"
        f"window.BARGIG_CATALOG_ASSET_BASE_URL = {json.dumps(base_url, ensure_ascii=False)};\n"
    )


def write_asset_config(out_dir: Path, base_url: str) -> CopyStats:
    target = out_dir / "catalog-assets.config.js"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(asset_config_content(base_url), encoding="utf-8")
    return CopyStats(files=1, bytes=target.stat().st_size)


def content_hash(path: Path, length: int = 12) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:length]


def split_url_reference(reference: str) -> tuple[str, str]:
    """Return (path, suffix) while preserving query/hash when rewriting HTML."""

    for index, character in enumerate(reference):
        if character in "?#":
            return reference[:index], reference[index:]
    return reference, ""


def hashed_asset_name(path: Path) -> str:
    digest = content_hash(path)
    return f"{path.stem}.{digest}{path.suffix}"


def rebase_css_asset_urls(source: Path, target_dir: Path, bundle_root: Path) -> None:
    """Rebase local CSS ``url(...)`` references before moving CSS into ``static/``.

    CSS-relative URLs are resolved from the stylesheet location, not from the
    HTML document. Fingerprinting moves the stylesheet into a child folder, so
    every local dependency must be rewritten relative to that new folder before
    the content hash is calculated. Remote, data, blob, fragment and root-relative
    URLs are intentionally left untouched.
    """

    text = source.read_text(encoding="utf-8", errors="replace")
    changed = False

    def replace_url(match: re.Match[str]) -> str:
        nonlocal changed
        raw_reference = match.group("url").strip()
        if (
            not raw_reference
            or raw_reference.startswith(("http://", "https://", "//", "data:", "blob:", "#", "/"))
        ):
            return match.group(0)

        reference_path, suffix = split_url_reference(raw_reference)
        dependency = (source.parent / reference_path).resolve()
        try:
            dependency.relative_to(bundle_root.resolve())
        except ValueError as exc:
            raise ValueError(
                f"CSS asset reference escapes the deploy bundle: {source.name} -> {raw_reference}"
            ) from exc
        if not dependency.is_file():
            raise FileNotFoundError(
                f"CSS references a missing local asset: {source.name} -> {raw_reference}"
            )

        rebased = os.path.relpath(dependency, target_dir.resolve()).replace(os.sep, "/")
        quote = match.group("quote") or '"'
        changed = changed or rebased != reference_path
        return f"url({quote}{rebased}{suffix}{quote})"

    rewritten = CSS_URL_RE.sub(replace_url, text)
    if changed:
        source.write_text(rewritten, encoding="utf-8")


def fingerprint_search_index(out_dir: Path) -> str:
    """Fingerprint the dynamically loaded search index and rewrite app.js."""

    search_source = out_dir / "catalogs.search.js"
    app_source = out_dir / "app.js"
    if not search_source.is_file() or not app_source.is_file():
        raise FileNotFoundError("app.js and catalogs.search.js are required before fingerprinting")

    normalize_fingerprinted_text(search_source)
    target_relative = Path(FINGERPRINTED_ASSET_DIR) / hashed_asset_name(search_source)
    target = out_dir / target_relative
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists():
        target.unlink()
    shutil.move(str(search_source), str(target))

    app_text = app_source.read_text(encoding="utf-8", errors="replace")
    rewritten, replacements = SEARCH_INDEX_RUNTIME_RE.subn(
        f'const SEARCH_INDEX_SCRIPT_SRC = "{target_relative.as_posix()}";',
        app_text,
        count=1,
    )
    if replacements != 1:
        raise ValueError("app.js does not contain one searchable SEARCH_INDEX_SCRIPT_SRC constant")
    app_source.write_text(rewritten, encoding="utf-8")
    return target_relative.as_posix()


def fingerprint_bundle_assets(out_dir: Path) -> dict[str, str]:
    """Fingerprint shared CSS/JS once and rewrite every public HTML document."""

    html_paths = [out_dir / filename for filename in FINGERPRINT_HTML_FILES]
    missing = [path.name for path in html_paths if not path.is_file()]
    if missing:
        raise FileNotFoundError(f"Cannot fingerprint bundle because HTML documents are missing: {', '.join(missing)}")

    references: list[str] = []
    for html_path in html_paths:
        html = html_path.read_text(encoding="utf-8", errors="replace")
        for match in HTML_ASSET_ATTR_RE.finditer(html):
            raw_reference = match.group("url").strip()
            reference_path, _suffix = split_url_reference(raw_reference)
            if (
                not reference_path
                or reference_path.startswith(("http://", "https://", "//", "#", "mailto:"))
                or Path(reference_path).suffix.lower() not in FINGERPRINTED_EXTENSIONS
            ):
                continue
            if reference_path not in references:
                references.append(reference_path)

    static_dir = out_dir / FINGERPRINTED_ASSET_DIR
    rewrite_map: dict[str, str] = {}
    for reference in references:
        source = out_dir / reference
        if not source.is_file():
            raise FileNotFoundError(f"Cannot fingerprint missing referenced asset in bundle: {reference}")
        normalize_fingerprinted_text(source)
        target_directory = (out_dir / FINGERPRINTED_ASSET_DIR)
        if source.suffix.lower() == ".css":
            rebase_css_asset_urls(source, target_directory, out_dir)
        target_relative = Path(FINGERPRINTED_ASSET_DIR) / hashed_asset_name(source)
        target = out_dir / target_relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if target.exists():
            target.unlink()
        shutil.move(str(source), str(target))
        rewrite_map[Path(reference).as_posix()] = target_relative.as_posix()

    if rewrite_map:
        def replace_reference(match: re.Match[str]) -> str:
            raw_reference = match.group("url")
            reference_path, suffix = split_url_reference(raw_reference)
            replacement = rewrite_map.get(reference_path)
            if not replacement:
                return match.group(0)
            return f"{match.group('prefix')}{replacement}{suffix}{match.group('suffix')}"

        for html_path in html_paths:
            html = html_path.read_text(encoding="utf-8", errors="replace")
            html_path.write_text(HTML_ASSET_ATTR_RE.sub(replace_reference, html), encoding="utf-8")

    if static_dir.exists() and not any(static_dir.iterdir()):
        static_dir.rmdir()
    return rewrite_map


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


def staging_output_dir(out_dir: Path) -> Path:
    """Return a sibling staging folder used to build a complete bundle before publish."""

    return out_dir.with_name(f".{out_dir.name}.building")


def replace_output_dir(staging_dir: Path, out_dir: Path) -> None:
    """Replace the previous bundle only after the new bundle is fully built and validated.

    The build happens in a separate sibling directory. The old output is moved aside,
    the complete staging directory is promoted, and only then is the old output removed.
    This prevents a partially-written ``dist`` folder from ever becoming deployable.
    """

    backup_dir = out_dir.with_name(f".{out_dir.name}.previous")
    if backup_dir.exists():
        shutil.rmtree(backup_dir)

    moved_previous = False
    try:
        if out_dir.exists():
            out_dir.rename(backup_dir)
            moved_previous = True
        staging_dir.rename(out_dir)
    except Exception:
        if moved_previous and not out_dir.exists() and backup_dir.exists():
            backup_dir.rename(out_dir)
        raise
    else:
        if backup_dir.exists():
            shutil.rmtree(backup_dir)


def normalize_fingerprinted_text(path: Path) -> None:
    """Normalize CSS/JS line endings so hashes are reproducible on Windows and Linux."""

    content = path.read_bytes()
    normalized = content.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    if normalized != content:
        path.write_bytes(normalized)


def validate_fingerprinted_bundle(out_dir: Path) -> int:
    """Validate a single, self-contained asset generation in the completed bundle."""

    referenced_assets: set[str] = set()
    missing_assets: list[str] = []
    invalid_assets: list[str] = []

    for html_name in FINGERPRINT_HTML_FILES:
        html_path = out_dir / html_name
        if not html_path.is_file():
            raise FileNotFoundError(f"Public HTML document is missing from bundle: {html_name}")
        html = html_path.read_text(encoding="utf-8", errors="replace")
        for match in HTML_ASSET_ATTR_RE.finditer(html):
            raw_reference = match.group("url").strip()
            reference_path, _suffix = split_url_reference(raw_reference)
            if (
                not reference_path
                or reference_path.startswith(("http://", "https://", "//", "#", "mailto:", "data:", "blob:"))
                or Path(reference_path).suffix.lower() not in FINGERPRINTED_EXTENSIONS
            ):
                continue

            relative = Path(reference_path)
            if relative.is_absolute() or ".." in relative.parts:
                invalid_assets.append(f"{html_name} -> {reference_path} (unsafe path)")
                continue
            asset_path = out_dir / relative
            if not asset_path.is_file():
                missing_assets.append(f"{html_name} -> {reference_path}")
                continue
            if not relative.parts or relative.parts[0] != FINGERPRINTED_ASSET_DIR:
                invalid_assets.append(f"{html_name} -> {reference_path} (not fingerprinted under static/)")
                continue

            match_name = HASHED_ASSET_FILENAME_RE.fullmatch(relative.name)
            if match_name is None:
                invalid_assets.append(f"{html_name} -> {reference_path} (invalid fingerprinted filename)")
                continue
            actual_digest = content_hash(asset_path)
            if match_name.group("digest") != actual_digest:
                invalid_assets.append(
                    f"{html_name} -> {reference_path} (filename hash does not match file contents)"
                )
                continue
            referenced_assets.add(relative.as_posix())

    app_assets = sorted(asset for asset in referenced_assets if Path(asset).name.startswith("app."))
    if len(app_assets) != 1:
        invalid_assets.append(f"expected one fingerprinted app.js reference, found {len(app_assets)}")
    else:
        app_text = (out_dir / app_assets[0]).read_text(encoding="utf-8", errors="replace")
        match = SEARCH_INDEX_RUNTIME_RE.search(app_text)
        if match is None:
            invalid_assets.append("fingerprinted app.js is missing SEARCH_INDEX_SCRIPT_SRC")
        else:
            dynamic_reference = match.group("url")
            dynamic_relative = Path(dynamic_reference)
            dynamic_path = out_dir / dynamic_relative
            if not dynamic_path.is_file():
                missing_assets.append(f"app.js -> {dynamic_reference}")
            elif not dynamic_relative.parts or dynamic_relative.parts[0] != FINGERPRINTED_ASSET_DIR:
                invalid_assets.append(f"app.js -> {dynamic_reference} (not fingerprinted under static/)")
            else:
                dynamic_name = HASHED_ASSET_FILENAME_RE.fullmatch(dynamic_relative.name)
                if dynamic_name is None or dynamic_name.group("stem") != "catalogs.search":
                    invalid_assets.append(f"app.js -> {dynamic_reference} (invalid search-index fingerprint)")
                elif dynamic_name.group("digest") != content_hash(dynamic_path):
                    invalid_assets.append(f"app.js -> {dynamic_reference} (filename hash does not match file contents)")
                else:
                    referenced_assets.add(dynamic_relative.as_posix())

    if missing_assets:
        raise FileNotFoundError(
            "Bundle HTML references missing CSS/JS assets: " + ", ".join(sorted(set(missing_assets)))
        )
    if invalid_assets:
        raise ValueError(
            "Bundle contains invalid CSS/JS references: " + ", ".join(sorted(set(invalid_assets)))
        )

    static_dir = out_dir / FINGERPRINTED_ASSET_DIR
    deployed_assets = {
        path.relative_to(out_dir).as_posix()
        for path in static_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in FINGERPRINTED_EXTENSIONS
    } if static_dir.is_dir() else set()
    unreferenced = sorted(deployed_assets - referenced_assets)
    if unreferenced:
        raise ValueError(
            "Bundle contains stale or unreferenced fingerprinted assets: " + ", ".join(unreferenced)
        )
    if referenced_assets - deployed_assets:
        raise FileNotFoundError("Validated asset set is incomplete.")
    return len(referenced_assets)


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


def normalize_local_public_asset(reference: str) -> Path | None:
    """Resolve a manifest asset URL to a safe project-relative path.

    Remote/data URLs are intentionally ignored. Root-relative manifest paths
    (``/icon.png``) are normalized to the static bundle root, while path
    traversal is rejected instead of silently copying outside the project.
    """

    raw = str(reference or "").strip()
    if not raw or raw.startswith(("http://", "https://", "//", "data:", "blob:")):
        return None

    path_part = raw.split("?", 1)[0].split("#", 1)[0].lstrip("/")
    if not path_part:
        return None

    relative = Path(path_part)
    if relative.is_absolute() or ".." in relative.parts:
        raise ValueError(f"Unsafe local asset reference in web app manifest: {reference}")
    return relative


def iter_manifest_asset_references(payload: object) -> Iterable[str]:
    """Yield local-file candidates from all manifest ``src`` fields."""

    if isinstance(payload, dict):
        for key, value in payload.items():
            if key == "src" and isinstance(value, str):
                yield value
            else:
                yield from iter_manifest_asset_references(value)
    elif isinstance(payload, list):
        for value in payload:
            yield from iter_manifest_asset_references(value)


def discover_web_app_assets(root: Path) -> list[Path]:
    """Discover custom icons plus every local asset referenced by a manifest."""

    assets: set[Path] = set()
    for pattern in WEB_APP_ICON_PATTERNS:
        for source in root.glob(pattern):
            if source.is_file():
                assets.add(source.relative_to(root))

    for manifest_name in ("site.webmanifest", "manifest.webmanifest"):
        manifest_path = root / manifest_name
        if not manifest_path.is_file():
            continue
        try:
            payload = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise ValueError(f"Could not parse {manifest_name}: {exc}") from exc

        for reference in iter_manifest_asset_references(payload):
            relative = normalize_local_public_asset(reference)
            if relative is not None:
                assets.add(relative)

    return sorted(assets, key=lambda path: path.as_posix())


def copy_web_app_assets(root: Path, out_dir: Path) -> CopyStats:
    stats = CopyStats(files=0, bytes=0)
    for relative in discover_web_app_assets(root):
        source = root / relative
        if not source.is_file():
            raise FileNotFoundError(
                f"Web app manifest references a missing local asset: {relative.as_posix()}"
            )
        stats = add_stats(stats, copy_file(root, out_dir, relative))
    return stats


def iter_files(directory: Path) -> Iterable[Path]:
    if not directory.is_dir():
        return
    for path in directory.rglob("*"):
        if path.is_file():
            yield path


def add_stats(left: CopyStats, right: CopyStats) -> CopyStats:
    return CopyStats(files=left.files + right.files, bytes=left.bytes + right.bytes)


def referenced_html_assets(root: Path) -> set[str]:
    references: set[str] = set()
    for html_name in FINGERPRINT_HTML_FILES:
        path = root / html_name
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
    known_files.update(page.filename for page in PAGE_DOCUMENTS)
    for reference in sorted(referenced_html_assets(root)):
        if reference in known_files:
            continue
        if not (root / reference).exists():
            warnings.append(f"HTML references a missing local file: {reference}")
    return warnings


def validate_catalog_assets(root: Path) -> list[str]:
    """Validate local generated images before syncing them to R2, when present.

    The R2 bundle never copies assets/pages into the Cloudflare Pages upload folder. This validation only
    helps catch a stale or incomplete local assets/pages folder before the user
    syncs it to Cloudflare R2.
    """
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
    parser = argparse.ArgumentParser(description="Create a clean Cloudflare Pages upload folder for the R2-backed catalog website.")
    parser.add_argument("--out", default="dist/site-upload-r2", help="Output folder, relative to the project root by default")
    parser.add_argument("--zip", action="store_true", help="Also create a .zip file next to the output folder")
    parser.add_argument("--include-json", action="store_true", help="Also copy catalogs.generated.json and catalogs.search.json")
    parser.add_argument(
        "--external-assets-url",
        default=DEFAULT_R2_ASSET_BASE_URL,
        help=(
            "Public CDN/R2 base URL for catalog images. The Cloudflare Pages bundle is site-only and does not copy assets/pages. "
            f"Default: {DEFAULT_R2_ASSET_BASE_URL}"
        ),
    )
    parser.add_argument(
        "--verify-remote-assets",
        action="store_true",
        help="Fail the bundle when any required catalog page/thumbnail is missing from the public R2/CDN URL.",
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
    try:
        args.external_assets_url = normalize_base_url(args.external_assets_url)
    except ValueError as exc:
        parser.error(str(exc))
    return args


def main() -> int:
    args = parse_args()
    root = project_root()
    out_dir = ensure_safe_output_dir(root, root / args.out)
    staging_dir = ensure_safe_output_dir(root, staging_output_dir(out_dir))

    try:
        clean_output_dir(staging_dir)

        deploy_files = list(DEPLOY_FILES)
        if args.include_big_pages_viewer:
            deploy_files.append(BIG_PAGES_VIEWER_FILE)
            print(
                f"[warn] Including local-only diagnostic page in deploy bundle: {BIG_PAGES_VIEWER_FILE}",
                file=sys.stderr,
            )

        rendered_pages = render_site_pages(root, staging_dir)
        stats = CopyStats(
            files=len(rendered_pages),
            bytes=sum(path.stat().st_size for path in rendered_pages),
        )
        for relative in deploy_files:
            if relative == "catalog-assets.config.js":
                continue
            stats = add_stats(stats, copy_file(root, staging_dir, relative))
        for relative in OPTIONAL_DEPLOY_FILES:
            stats = add_stats(stats, copy_optional_file(root, staging_dir, relative))
        stats = add_stats(stats, copy_web_app_assets(root, staging_dir))
        if args.include_json:
            for relative in JSON_DEPLOY_FILES:
                stats = add_stats(stats, copy_optional_file(root, staging_dir, relative))

        stats = add_stats(stats, write_asset_config(staging_dir, args.external_assets_url))
        fingerprinted_search_index = fingerprint_search_index(staging_dir)
        fingerprinted_assets = fingerprint_bundle_assets(staging_dir)
        fingerprinted_assets["catalogs.search.js"] = fingerprinted_search_index
        validated_asset_count = validate_fingerprinted_bundle(staging_dir)

        print(f"[assets] R2/CDN catalog images: {args.external_assets_url}")
        print("[assets] assets/pages was intentionally not copied into the Cloudflare Pages upload folder.")
        if fingerprinted_assets:
            print(
                f"[cache] Built and validated one current asset generation: "
                f"{validated_asset_count} fingerprinted CSS/JS files under {FINGERPRINTED_ASSET_DIR}/"
            )

        warnings = validate_static_references(root)
        pages_dir = root / "assets" / "pages"
        if pages_dir.is_dir():
            warnings += validate_catalog_assets(root)
        else:
            warnings.append(
                "Local assets/pages does not exist, so the script could not verify local images before R2 sync. "
                "This is OK if the R2 bucket already contains the generated catalog images."
            )
        for warning in warnings:
            print(f"[warn] {warning}", file=sys.stderr)

        if args.verify_remote_assets:
            print("[publish-gate] Verifying every catalog page and thumbnail on the public R2/CDN...")
            remote_catalogs = load_remote_catalogs(root / "catalogs.generated.json")
            total_assets, remote_failures = verify_remote_assets(remote_catalogs, args.external_assets_url)
            if remote_failures:
                sample = "; ".join(f"{item.url}: {item.reason}" for item in remote_failures[:12])
                extra = f"; and {len(remote_failures) - 12} more" if len(remote_failures) > 12 else ""
                raise RuntimeError(
                    f"Remote asset publication gate failed for {len(remote_failures)} of {total_assets} objects: {sample}{extra}"
                )
            print(f"[publish-gate] Passed: {total_assets} required page/thumbnail objects are available.")

        replace_output_dir(staging_dir, out_dir)

        print("\nDone.")
        print(f"Upload folder: {rel_to_root(out_dir)}")
        print(f"Copied: {stats.files} files, {format_bytes(stats.bytes)}")
        excluded_note = (
            "assets/pages catalog images stored in R2, PDFs, conversion tools, setup scripts, "
            "virtualenv, README, config, and other project-only files"
        )
        if not args.include_big_pages_viewer:
            excluded_note += ", including the local diagnostic big-pages viewer"
        print(f"Excluded: {excluded_note}.")
        print(f"Images: R2/CDN mode, loaded from {args.external_assets_url}")
        if fingerprinted_assets:
            print(
                "Cache: HTML is not stored; CSS/JS use one current content-hashed generation "
                "and can be cached immutably."
            )
        print("Runtime: direct contact links stay static; the privacy-first telemetry endpoint is deployed separately from functions/ by Wrangler.")

        if args.zip:
            zip_path = out_dir.with_suffix(".zip")
            zip_stats = create_zip_from_folder(out_dir, zip_path)
            print(f"ZIP: {rel_to_root(zip_path)} ({zip_stats.files} files, {format_bytes(zip_path.stat().st_size)})")

        if warnings:
            print("\nBundle was created, but review the warnings above before uploading.")
        return 0
    except Exception as exc:
        if staging_dir.exists():
            shutil.rmtree(staging_dir, ignore_errors=True)
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
