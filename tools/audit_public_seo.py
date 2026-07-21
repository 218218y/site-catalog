#!/usr/bin/env python3
"""Audit a generated public SEO bundle or the deployed site from an external view.

Local mode validates every generated HTML document, internal link, canonical,
Open Graph/Twitter field, JSON-LD block, robots policy and sitemap membership.
Live mode fetches a small representative route set through HTTP and verifies
that the metadata and share images are visible outside the build process.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from xml.etree import ElementTree as ET

from PIL import Image

from seo_route_lock import read_lock
from seo_site import load_seo_config

REQUIRED_OG = (
    "og:type",
    "og:site_name",
    "og:locale",
    "og:title",
    "og:description",
    "og:url",
    "og:image",
    "og:image:secure_url",
    "og:image:type",
    "og:image:width",
    "og:image:height",
    "og:image:alt",
)
REQUIRED_TWITTER = (
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
    "twitter:image:alt",
)
INDEX_TOKEN_RE = re.compile(r"(?:^|,)\s*index(?:\s|,|$)", re.IGNORECASE)
NOINDEX_TOKEN_RE = re.compile(r"(?:^|,)\s*noindex(?:\s|,|$)", re.IGNORECASE)


class SeoHtmlParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.title_parts: list[str] = []
        self.in_title = False
        self.h1_depth = 0
        self.current_h1: list[str] | None = None
        self.h1s: list[str] = []
        self.meta: dict[str, str] = {}
        self.links: list[dict[str, str]] = []
        self.anchors: list[str] = []
        self.base_href = ""
        self.ld_json: list[str] = []
        self.in_ld_json = False
        self.current_ld_json: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        attributes = {key.lower(): value or "" for key, value in attrs}
        if tag == "title":
            self.in_title = True
        elif tag == "h1":
            self.h1_depth += 1
            if self.h1_depth == 1:
                self.current_h1 = []
        elif tag == "meta":
            key = attributes.get("property") or attributes.get("name")
            if key:
                self.meta[key.lower()] = attributes.get("content", "").strip()
        elif tag == "link":
            self.links.append(attributes)
        elif tag == "base" and attributes.get("href"):
            self.base_href = attributes["href"].strip()
        elif tag == "a" and attributes.get("href"):
            self.anchors.append(attributes["href"].strip())
        elif tag == "script" and attributes.get("type", "").lower() == "application/ld+json":
            self.in_ld_json = True
            self.current_ld_json = []

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "title":
            self.in_title = False
        elif tag == "h1" and self.h1_depth:
            if self.h1_depth == 1 and self.current_h1 is not None:
                self.h1s.append(" ".join("".join(self.current_h1).split()))
                self.current_h1 = None
            self.h1_depth -= 1
        elif tag == "script" and self.in_ld_json:
            self.ld_json.append("".join(self.current_ld_json).strip())
            self.current_ld_json = []
            self.in_ld_json = False

    def handle_data(self, data: str) -> None:
        if self.in_title:
            self.title_parts.append(data)
        if self.current_h1 is not None:
            self.current_h1.append(data)
        if self.in_ld_json:
            self.current_ld_json.append(data)

    @property
    def title(self) -> str:
        return " ".join("".join(self.title_parts).split())

    def canonical(self) -> str:
        for link in self.links:
            rel = {value.lower() for value in link.get("rel", "").split()}
            if "canonical" in rel:
                return link.get("href", "").strip()
        return ""


@dataclass
class Document:
    path: Path
    route: str
    parser: SeoHtmlParser
    json_ld: list[Any] = field(default_factory=list)

    @property
    def robots(self) -> str:
        return self.parser.meta.get("robots", "")

    @property
    def indexable(self) -> bool:
        return bool(INDEX_TOKEN_RE.search(self.robots)) and not NOINDEX_TOKEN_RE.search(self.robots)


@dataclass(frozen=True)
class BundleInventory:
    """Single-pass inventory used by the local SEO audit.

    Public previews contain hundreds of generated route files. Walking that tree
    repeatedly is needlessly expensive on Windows and causes antivirus scanners
    to inspect the same files over and over. The inventory is deliberately built
    once and then shared by document parsing, route validation and asset checks.
    """

    files: frozenset[str]
    html_files: tuple[Path, ...]
    routes: frozenset[str]


class AuditFailure(RuntimeError):
    pass


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def route_for_file(bundle: Path, path: Path) -> str:
    relative = path.relative_to(bundle).as_posix()
    if relative == "index.html":
        return "/"
    if relative.endswith("/index.html"):
        return f"/{relative[:-10]}"
    return f"/{relative}"


def build_bundle_inventory(bundle: Path) -> BundleInventory:
    """Inventory bundle files, HTML documents and public routes in one walk."""

    relative_files: list[str] = []
    html_files: list[Path] = []
    routes: set[str] = {"/"}
    for directory, dirnames, filenames in os.walk(bundle):
        dirnames.sort()
        filenames.sort()
        base = Path(directory)
        for filename in filenames:
            path = base / filename
            relative = path.relative_to(bundle).as_posix()
            relative_files.append(relative)
            if filename.lower().endswith(".html"):
                html_files.append(path)
            routes.add(f"/{relative}")
            if relative.endswith("/index.html"):
                prefix = relative[:-10]
                routes.add(f"/{prefix}")
                routes.add(f"/{prefix.rstrip('/')}")
    return BundleInventory(
        files=frozenset(relative_files),
        html_files=tuple(html_files),
        routes=frozenset(routes),
    )


def local_route_candidates(bundle: Path) -> set[str]:
    """Compatibility wrapper for callers that only need route candidates."""

    return set(build_bundle_inventory(bundle).routes)


def normalized_internal_path(base_route: str, href: str, site_origin: str, base_href: str = "") -> str | None:
    value = href.strip()
    if not value or value.startswith(("#", "mailto:", "tel:", "javascript:", "data:", "blob:")):
        return None
    document_base = urllib.parse.urljoin(f"{site_origin}{base_route}", base_href) if base_href else f"{site_origin}{base_route}"
    absolute = urllib.parse.urljoin(document_base, value)
    parsed = urllib.parse.urlparse(absolute)
    origin = f"{parsed.scheme}://{parsed.netloc}"
    if origin != site_origin:
        return None
    path = urllib.parse.unquote(parsed.path or "/")
    return path or "/"


def iter_json_values(value: Any) -> Iterable[tuple[str, str]]:
    if isinstance(value, dict):
        for key, nested in value.items():
            if key in {"url", "@id", "item", "logo", "image"} and isinstance(nested, str):
                yield key, nested
            yield from iter_json_values(nested)
    elif isinstance(value, list):
        for nested in value:
            yield from iter_json_values(nested)


def parse_document(path: Path, bundle: Path, *, html: str | None = None) -> tuple[Document, list[str]]:
    parser = SeoHtmlParser()
    parser.feed(html if html is not None else path.read_text(encoding="utf-8"))
    document = Document(path=path, route=route_for_file(bundle, path), parser=parser)
    issues: list[str] = []
    for index, raw in enumerate(parser.ld_json, 1):
        try:
            document.json_ld.append(json.loads(raw))
        except json.JSONDecodeError as exc:
            issues.append(f"{document.route}: invalid JSON-LD block #{index}: {exc}")
    return document, issues


def load_documents(
    bundle: Path,
    html_files: Sequence[Path] | None = None,
) -> tuple[list[Document], list[str]]:
    issues: list[str] = []
    documents: list[Document] = []
    paths = html_files if html_files is not None else tuple(sorted(bundle.rglob("*.html")))
    for path in paths:
        document, document_issues = parse_document(path, bundle)
        documents.append(document)
        issues.extend(document_issues)
    return documents, issues


def audit_indexable_h1(document: Document) -> list[str]:
    if document.indexable and len(document.parser.h1s) != 1:
        return [
            f"{document.route}: indexable page must contain exactly one h1, "
            f"found {len(document.parser.h1s)}"
        ]
    return []


def audit_internal_links(
    document: Document,
    available_routes: set[str] | frozenset[str],
    site_origin: str,
) -> list[str]:
    issues: list[str] = []
    for href in document.parser.anchors:
        path = normalized_internal_path(
            document.route, href, site_origin, document.parser.base_href
        )
        if path is None:
            continue
        candidates = {path, path.rstrip("/") or "/", f"{path.rstrip('/')}/"}
        if not candidates.intersection(available_routes):
            issues.append(f"{document.route}: broken internal link: {href} -> {path}")
    return issues


def inspect_local_image(
    path: Path,
    cache: dict[Path, tuple[int, int, str] | OSError],
) -> tuple[int, int, str]:
    cached = cache.get(path)
    if isinstance(cached, OSError):
        raise cached
    if cached is not None:
        return cached
    try:
        with Image.open(path) as image_file:
            value = (
                int(image_file.size[0]),
                int(image_file.size[1]),
                Image.MIME.get(image_file.format or "", ""),
            )
    except OSError as exc:
        cache[path] = exc
        raise
    cache[path] = value
    return value

def audit_local_bundle(bundle: Path, root: Path) -> list[str]:
    config = load_seo_config(root)
    site_origin = config.site_url
    issues: list[str] = []
    if not bundle.is_dir():
        return [f"public bundle directory does not exist: {bundle}"]

    inventory = build_bundle_inventory(bundle)
    documents, parse_issues = load_documents(bundle, inventory.html_files)
    issues.extend(parse_issues)
    if not documents:
        return [f"public bundle contains no HTML documents: {bundle}"]

    available_routes = inventory.routes
    image_metadata_cache: dict[Path, tuple[int, int, str] | OSError] = {}
    canonicals: dict[str, str] = {}
    titles: dict[str, str] = {}
    descriptions: dict[str, str] = {}
    indexable_canonicals: set[str] = set()

    for document in documents:
        prefix = document.route
        parser = document.parser
        if prefix == "/404.html":
            issues.extend(audit_internal_links(document, available_routes, site_origin))
            continue
        title = parser.title
        description = parser.meta.get("description", "")
        canonical = parser.canonical()
        if not title:
            issues.append(f"{prefix}: missing title")
        if not description:
            issues.append(f"{prefix}: missing meta description")
        if not canonical:
            issues.append(f"{prefix}: missing canonical")
        else:
            expected_canonical = urllib.parse.urljoin(f"{site_origin}/", prefix.lstrip("/"))
            if canonical != expected_canonical:
                issues.append(
                    f"{prefix}: canonical does not match its generated route: "
                    f"{canonical} (expected {expected_canonical})"
                )
            parsed = urllib.parse.urlparse(canonical)
            if f"{parsed.scheme}://{parsed.netloc}" != site_origin:
                issues.append(f"{prefix}: canonical is outside site origin: {canonical}")
            if canonical in canonicals:
                issues.append(f"{prefix}: duplicate canonical also used by {canonicals[canonical]}: {canonical}")
            canonicals[canonical] = prefix

        if document.indexable:
            indexable_canonicals.add(canonical)
            issues.extend(audit_indexable_h1(document))
            if title in titles:
                issues.append(f"{prefix}: duplicate indexable title also used by {titles[title]}: {title}")
            titles[title] = prefix
            if description in descriptions:
                issues.append(
                    f"{prefix}: duplicate indexable description also used by {descriptions[description]}"
                )
            descriptions[description] = prefix

        for name in REQUIRED_OG:
            if not parser.meta.get(name):
                issues.append(f"{prefix}: missing {name}")
        for name in REQUIRED_TWITTER:
            if not parser.meta.get(name):
                issues.append(f"{prefix}: missing {name}")
        if parser.meta.get("og:title") != title:
            issues.append(f"{prefix}: og:title does not match title")
        if canonical and parser.meta.get("og:url") != canonical:
            issues.append(f"{prefix}: og:url does not match canonical")
        if parser.meta.get("twitter:title") != title:
            issues.append(f"{prefix}: twitter:title does not match title")
        if parser.meta.get("twitter:image") != parser.meta.get("og:image"):
            issues.append(f"{prefix}: twitter:image does not match og:image")
        image_type = parser.meta.get("og:image:type", "")
        if not image_type.startswith("image/"):
            issues.append(f"{prefix}: invalid og:image:type: {image_type}")
        try:
            width = int(parser.meta.get("og:image:width", "0"))
            height = int(parser.meta.get("og:image:height", "0"))
            if width <= 0 or height <= 0:
                raise ValueError
        except ValueError:
            issues.append(f"{prefix}: invalid Open Graph image dimensions")

        og_image = parser.meta.get("og:image", "")
        if og_image:
            image_url = urllib.parse.urlparse(og_image)
            if image_url.scheme != "https":
                issues.append(f"{prefix}: og:image must use HTTPS: {og_image}")
            if f"{image_url.scheme}://{image_url.netloc}" == site_origin:
                relative_image = image_url.path.lstrip("/")
                local_image = bundle / relative_image
                if relative_image not in inventory.files:
                    issues.append(f"{prefix}: local og:image does not exist: {image_url.path}")
                else:
                    try:
                        actual_width, actual_height, actual_type = inspect_local_image(
                            local_image, image_metadata_cache
                        )
                        if (actual_width, actual_height) != (width, height):
                            issues.append(
                                f"{prefix}: Open Graph image dimensions do not match the file: "
                                f"metadata {width}x{height}, file {actual_width}x{actual_height}"
                            )
                        if actual_type and actual_type != image_type:
                            issues.append(
                                f"{prefix}: og:image:type {image_type} does not match file type {actual_type}"
                            )
                    except OSError as exc:
                        issues.append(f"{prefix}: could not inspect local og:image: {exc}")

        types: set[str] = set()
        for payload in document.json_ld:
            if isinstance(payload, dict):
                raw_type = payload.get("@type")
                if isinstance(raw_type, str):
                    types.add(raw_type)
                elif isinstance(raw_type, list):
                    types.update(str(value) for value in raw_type)
            for key, url in iter_json_values(payload):
                if not url.startswith((site_origin, config.asset_base_url, "https://schema.org")):
                    issues.append(f"{prefix}: JSON-LD {key} uses unexpected URL: {url}")
        if document.indexable:
            if not types.intersection({"WebPage", "CollectionPage"}):
                issues.append(f"{prefix}: indexable page is missing WebPage/CollectionPage JSON-LD")
            if prefix == "/" and not ({"WebSite", "FurnitureStore"} <= types or {"WebSite", "LocalBusiness"} <= types):
                issues.append("/: home structured data must include WebSite and LocalBusiness/FurnitureStore")
            if prefix.startswith(("/category/", "/catalog/")) and "BreadcrumbList" not in types:
                issues.append(f"{prefix}: landing page is missing BreadcrumbList JSON-LD")

        issues.extend(audit_internal_links(document, available_routes, site_origin))

    headers = (bundle / "_headers").read_text(encoding="utf-8") if (bundle / "_headers").is_file() else ""
    if "X-Robots-Tag: noindex" in headers:
        issues.append("public _headers still contains global X-Robots-Tag: noindex")
    robots_path = bundle / "robots.txt"
    sitemap_path = bundle / "sitemap.xml"
    if not robots_path.is_file():
        issues.append("public bundle is missing robots.txt")
    elif f"Sitemap: {site_origin}/sitemap.xml" not in robots_path.read_text(encoding="utf-8"):
        issues.append("public robots.txt does not advertise the configured sitemap")
    if not sitemap_path.is_file():
        issues.append("public bundle is missing sitemap.xml")
    else:
        try:
            tree = ET.parse(sitemap_path)
            namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
            sitemap_urls = {
                (node.text or "").strip()
                for node in tree.findall("s:url/s:loc", namespace)
                if (node.text or "").strip()
            }
            if sitemap_urls != indexable_canonicals:
                missing = sorted(indexable_canonicals - sitemap_urls)
                extra = sorted(sitemap_urls - indexable_canonicals)
                if missing:
                    issues.append("sitemap is missing indexable canonicals: " + ", ".join(missing[:10]))
                if extra:
                    issues.append("sitemap contains non-indexable/unknown URLs: " + ", ".join(extra[:10]))
        except ET.ParseError as exc:
            issues.append(f"invalid sitemap.xml: {exc}")
    return issues


def http_get(url: str, *, timeout: float = 15.0) -> tuple[int, Mapping[str, str], bytes]:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "BargigSeoReleaseAudit/1.0 (+https://bargig-furniture.com/)",
            "Accept": "text/html,application/xhtml+xml,image/*;q=0.8,*/*;q=0.5",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, dict(response.headers.items()), response.read()


def live_sample_routes(root: Path) -> list[str]:
    lock = read_lock(root)
    routes = ["/"]
    categories = lock.get("categories", [])
    catalogs = lock.get("catalogs", [])
    if categories:
        routes.append(str(categories[0].get("route", "/")))
    if catalogs:
        routes.append(str(catalogs[0].get("route", "/")))
    return list(dict.fromkeys(routes))


def audit_live_site(root: Path, *, expected_mode: str, timeout: float) -> list[str]:
    config = load_seo_config(root)
    issues: list[str] = []
    for route in live_sample_routes(root):
        url = urllib.parse.urljoin(f"{config.site_url}/", route.lstrip("/"))
        try:
            status, headers, body = http_get(url, timeout=timeout)
        except (urllib.error.URLError, TimeoutError) as exc:
            issues.append(f"{route}: external fetch failed: {exc}")
            continue
        if status != 200:
            issues.append(f"{route}: external response status is {status}")
            continue
        parser = SeoHtmlParser()
        parser.feed(body.decode("utf-8", errors="replace"))
        robots = parser.meta.get("robots", "")
        header_robots = headers.get("X-Robots-Tag", headers.get("x-robots-tag", ""))
        if expected_mode == "public":
            if NOINDEX_TOKEN_RE.search(robots) or "noindex" in header_robots.lower():
                issues.append(f"{route}: live public route is still noindex")
        else:
            if not NOINDEX_TOKEN_RE.search(robots) or "noindex" not in header_robots.lower():
                issues.append(f"{route}: live private route is missing HTML/header noindex")
        for name in REQUIRED_OG:
            if not parser.meta.get(name):
                issues.append(f"{route}: live page is missing {name}")
        image = parser.meta.get("og:image", "")
        if image:
            try:
                image_status, image_headers, image_body = http_get(image, timeout=timeout)
                content_type = image_headers.get("Content-Type", image_headers.get("content-type", ""))
                if image_status != 200 or not content_type.lower().startswith("image/") or not image_body:
                    issues.append(f"{route}: external og:image is not publicly readable: {image}")
            except (urllib.error.URLError, TimeoutError) as exc:
                issues.append(f"{route}: external og:image fetch failed: {image}: {exc}")
    return issues


def print_result(label: str, issues: Sequence[str]) -> int:
    if not issues:
        print(f"{label}: PASS")
        return 0
    print(f"{label}: {len(issues)} issue(s)")
    for issue in issues:
        print(f"  - {issue}")
    return 1


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--bundle-dir", type=Path, help="Audit a generated public bundle directory.")
    group.add_argument("--live", action="store_true", help="Audit representative URLs on the configured live site.")
    parser.add_argument("--expected-mode", choices=("private", "public"), default="private")
    parser.add_argument("--timeout", type=float, default=15.0)
    args = parser.parse_args(argv)
    root = project_root()
    if args.live:
        return print_result(
            f"Live SEO/Open Graph audit ({args.expected_mode})",
            audit_live_site(root, expected_mode=args.expected_mode, timeout=args.timeout),
        )
    bundle = args.bundle_dir.resolve()
    return print_result("Public SEO bundle audit", audit_local_bundle(bundle, root))


if __name__ == "__main__":
    raise SystemExit(main())
