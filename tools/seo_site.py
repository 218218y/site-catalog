#!/usr/bin/env python3
"""Shared SEO configuration, route generation helpers and indexing controls.

The website is deliberately built in one of two explicit modes:

``private``
    Every public HTML response is noindex. Rich sharing metadata and clean
    routes are still generated so links can be tested before search launch.

``public``
    Only stable landing pages become indexable. Utility pages, favorites,
    technical application shells and per-page sharing routes remain noindex.

The default mode comes from ``seo.config.json`` and must remain ``private``
until a public build is explicitly confirmed by the caller.
"""
from __future__ import annotations

import html
import json
import mimetypes
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence
from urllib.parse import quote, urlparse
from xml.etree import ElementTree as ET

SEO_CONFIG_FILE = "seo.config.json"
TAXONOMY_CONFIG_FILE = "catalog-taxonomy.config.json"
TAXONOMY_GENERATED_JS = "catalog-taxonomy.generated.js"
HEADERS_TEMPLATE_FILE = "_headers.template"
VALID_SEO_MODES = {"private", "public"}
CATALOG_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")


@dataclass(frozen=True)
class SeoConfig:
    default_mode: str
    site_url: str
    asset_base_url: str
    site_name: str
    locale: str
    default_share_image: str
    business: Mapping[str, Any]


@dataclass(frozen=True)
class TaxonomyCategory:
    name: str
    slug: str
    description: str


@dataclass(frozen=True)
class TaxonomySubcategory:
    category: str
    name: str
    slug: str
    description: str


@dataclass(frozen=True)
class Taxonomy:
    categories: tuple[TaxonomyCategory, ...]
    subcategories: tuple[TaxonomySubcategory, ...]

    def category_by_name(self, name: str) -> TaxonomyCategory | None:
        normalized = str(name or "").strip()
        return next((item for item in self.categories if item.name == normalized), None)

    def category_by_slug(self, slug: str) -> TaxonomyCategory | None:
        normalized = str(slug or "").strip().lower()
        return next((item for item in self.categories if item.slug == normalized), None)

    def subcategory_by_name(self, category: str, name: str) -> TaxonomySubcategory | None:
        normalized_category = str(category or "").strip()
        normalized_name = str(name or "").strip()
        return next(
            (
                item
                for item in self.subcategories
                if item.category == normalized_category and item.name == normalized_name
            ),
            None,
        )


@dataclass(frozen=True)
class SeoPage:
    title: str
    description: str
    canonical_url: str
    robots: str
    image_url: str
    image_width: int
    image_height: int
    image_alt: str
    og_type: str = "website"
    json_ld: tuple[Mapping[str, Any], ...] = ()


def _read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Required SEO configuration is missing: {path.name}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Could not parse {path.name}: {exc}") from exc


def _require_text(payload: Mapping[str, Any], key: str, *, label: str) -> str:
    value = str(payload.get(key, "")).strip()
    if not value:
        raise ValueError(f"{label} must define a non-empty '{key}' value")
    return value


def normalize_site_url(value: str) -> str:
    url = str(value or "").strip().rstrip("/")
    if not re.match(r"^https://[A-Za-z0-9.-]+(?::\d+)?$", url):
        raise ValueError("SEO siteUrl must be one HTTPS origin without a path")
    return url


def normalize_asset_base_url(value: str) -> str:
    url = str(value or "").strip().rstrip("/")
    if not re.match(r"^https://", url, flags=re.IGNORECASE):
        raise ValueError("SEO assetBaseUrl must start with https://")
    return url


def load_seo_config(root: Path) -> SeoConfig:
    payload = _read_json(root / SEO_CONFIG_FILE)
    if not isinstance(payload, dict):
        raise ValueError(f"{SEO_CONFIG_FILE} must contain one JSON object")

    default_mode = str(payload.get("defaultMode", "private")).strip().lower()
    if default_mode not in VALID_SEO_MODES:
        raise ValueError("seo.config.json defaultMode must be 'private' or 'public'")
    default_share_image = _require_text(payload, "defaultShareImage", label=SEO_CONFIG_FILE).lstrip("/")
    if Path(default_share_image).is_absolute() or ".." in Path(default_share_image).parts:
        raise ValueError("defaultShareImage must be a safe project-relative path")
    business = payload.get("business")
    if not isinstance(business, dict):
        raise ValueError("seo.config.json must define a business object")

    return SeoConfig(
        default_mode=default_mode,
        site_url=normalize_site_url(_require_text(payload, "siteUrl", label=SEO_CONFIG_FILE)),
        asset_base_url=normalize_asset_base_url(_require_text(payload, "assetBaseUrl", label=SEO_CONFIG_FILE)),
        site_name=_require_text(payload, "siteName", label=SEO_CONFIG_FILE),
        locale=_require_text(payload, "locale", label=SEO_CONFIG_FILE),
        default_share_image=default_share_image,
        business=business,
    )


def resolve_seo_mode(root: Path, requested: str | None = None) -> str:
    mode = str(requested or load_seo_config(root).default_mode).strip().lower()
    if mode not in VALID_SEO_MODES:
        raise ValueError(f"Unknown SEO build mode: {requested}")
    return mode


def load_taxonomy(root: Path) -> Taxonomy:
    payload = _read_json(root / TAXONOMY_CONFIG_FILE)
    if not isinstance(payload, dict):
        raise ValueError(f"{TAXONOMY_CONFIG_FILE} must contain one JSON object")

    categories_raw = payload.get("categories")
    subcategories_raw = payload.get("subcategories", [])
    if not isinstance(categories_raw, list) or not categories_raw:
        raise ValueError("catalog taxonomy must define at least one category")
    if not isinstance(subcategories_raw, list):
        raise ValueError("catalog taxonomy subcategories must be a JSON array")

    categories: list[TaxonomyCategory] = []
    names: set[str] = set()
    slugs: set[str] = set()
    for index, item in enumerate(categories_raw, 1):
        if not isinstance(item, dict):
            raise ValueError(f"taxonomy category #{index} must be an object")
        name = _require_text(item, "name", label=f"taxonomy category #{index}")
        slug = _require_text(item, "slug", label=f"taxonomy category #{index}").lower()
        description = _require_text(item, "description", label=f"taxonomy category #{index}")
        if not SLUG_RE.fullmatch(slug):
            raise ValueError(f"Invalid category slug: {slug}")
        if name in names or slug in slugs:
            raise ValueError(f"Duplicate taxonomy category name or slug: {name} / {slug}")
        names.add(name)
        slugs.add(slug)
        categories.append(TaxonomyCategory(name=name, slug=slug, description=description))

    subcategories: list[TaxonomySubcategory] = []
    sub_keys: set[tuple[str, str]] = set()
    sub_paths: set[tuple[str, str]] = set()
    for index, item in enumerate(subcategories_raw, 1):
        if not isinstance(item, dict):
            raise ValueError(f"taxonomy subcategory #{index} must be an object")
        category = _require_text(item, "category", label=f"taxonomy subcategory #{index}")
        name = _require_text(item, "name", label=f"taxonomy subcategory #{index}")
        slug = _require_text(item, "slug", label=f"taxonomy subcategory #{index}").lower()
        description = _require_text(item, "description", label=f"taxonomy subcategory #{index}")
        if category not in names:
            raise ValueError(f"Subcategory '{name}' references unknown category '{category}'")
        if not SLUG_RE.fullmatch(slug):
            raise ValueError(f"Invalid subcategory slug: {slug}")
        key = (category, name)
        category_slug = next(entry.slug for entry in categories if entry.name == category)
        path_key = (category_slug, slug)
        if key in sub_keys or path_key in sub_paths:
            raise ValueError(f"Duplicate taxonomy subcategory: {category} / {name}")
        sub_keys.add(key)
        sub_paths.add(path_key)
        subcategories.append(
            TaxonomySubcategory(category=category, name=name, slug=slug, description=description)
        )

    return Taxonomy(categories=tuple(categories), subcategories=tuple(subcategories))


def validate_taxonomy_catalog_coverage(taxonomy: Taxonomy, catalogs: Sequence[Mapping[str, Any]]) -> None:
    failures: list[str] = []
    catalog_ids: set[str] = set()
    for catalog in catalogs:
        catalog_id = str(catalog.get("id", "")).strip()
        if not CATALOG_ID_RE.fullmatch(catalog_id):
            failures.append(f"catalog has invalid SEO id: {catalog_id or '<empty>'}")
        if catalog_id in catalog_ids:
            failures.append(f"duplicate catalog id: {catalog_id}")
        catalog_ids.add(catalog_id)

        category = str(catalog.get("category", "")).strip()
        subcategory = str(catalog.get("subcategory", "")).strip()
        if taxonomy.category_by_name(category) is None:
            failures.append(f"{catalog_id}: category is missing from taxonomy: {category}")
        if subcategory and taxonomy.subcategory_by_name(category, subcategory) is None:
            failures.append(f"{catalog_id}: subcategory is missing from taxonomy: {category} / {subcategory}")

    if failures:
        raise ValueError("Catalog taxonomy validation failed: " + "; ".join(failures))


def taxonomy_browser_payload(taxonomy: Taxonomy) -> dict[str, Any]:
    return {
        "categories": [
            {"name": item.name, "slug": item.slug, "description": item.description}
            for item in taxonomy.categories
        ],
        "subcategories": [
            {
                "category": item.category,
                "name": item.name,
                "slug": item.slug,
                "description": item.description,
            }
            for item in taxonomy.subcategories
        ],
    }


def taxonomy_generated_js(taxonomy: Taxonomy) -> str:
    payload = json.dumps(taxonomy_browser_payload(taxonomy), ensure_ascii=False, separators=(",", ":"))
    return (
        "// GENERATED FILE — edit catalog-taxonomy.config.json and rebuild instead.\n"
        f"window.BARGIG_CATALOG_TAXONOMY = {payload};\n"
    )


def build_taxonomy_asset(root: Path, *, check: bool = False) -> Path:
    taxonomy = load_taxonomy(root)
    target = root / TAXONOMY_GENERATED_JS
    expected = taxonomy_generated_js(taxonomy).encode("utf-8")
    current = target.read_bytes() if target.is_file() else None
    if check and current != expected:
        raise RuntimeError(
            f"Generated taxonomy asset is stale: {TAXONOMY_GENERATED_JS}. "
            "Run: python tools/build_site_pages.py"
        )
    if not check and current != expected:
        target.write_bytes(expected)
    return target


def absolute_url(config: SeoConfig, path: str = "") -> str:
    normalized = "/" + str(path or "").lstrip("/")
    return config.site_url + ("/" if normalized == "/" else normalized)


def catalog_path(catalog_id: str) -> str:
    return f"catalog/{quote(str(catalog_id), safe='-')}/"


def catalog_page_path(catalog_id: str, page: int) -> str:
    return f"catalog/{quote(str(catalog_id), safe='-')}/page/{max(1, int(page))}/"


def category_path(category: TaxonomyCategory) -> str:
    return f"category/{category.slug}/"


def subcategory_path(category: TaxonomyCategory, subcategory: TaxonomySubcategory) -> str:
    return f"category/{category.slug}/{subcategory.slug}/"


CATALOG_ASSET_URL_SCHEMA_VERSION = 2


def catalog_asset_version_for_tier(catalog: Mapping[str, Any], tier: str) -> str:
    normalized_tier = str(tier or "full").strip() or "full"
    variants = catalog.get("imageVariants") if isinstance(catalog.get("imageVariants"), Mapping) else {}
    variant = variants.get(normalized_tier) if isinstance(variants.get(normalized_tier), Mapping) else {}
    base_version = str(variant.get("version") or catalog.get("assetVersion") or "").strip()
    if not base_version:
        return ""
    return f"{base_version}-{normalized_tier}-u{CATALOG_ASSET_URL_SCHEMA_VERSION}"


def catalog_asset_url(config: SeoConfig, relative_path: str, version: str = "") -> str:
    raw = str(relative_path or "").strip()
    if raw.startswith(("https://", "http://")):
        base = raw
    else:
        base = f"{config.asset_base_url}/{raw.lstrip('/')}"
    version_text = str(version or "").strip()
    if version_text:
        separator = "&" if "?" in base else "?"
        return f"{base}{separator}v={quote(version_text, safe='')}"
    return base


def catalog_cover_url(config: SeoConfig, catalog: Mapping[str, Any]) -> str:
    relative = str(catalog.get("cover") or "").strip()
    if not relative:
        catalog_id = str(catalog.get("id", "")).strip()
        extension = str(catalog.get("imageExt", "webp")).strip().lstrip(".") or "webp"
        relative = f"assets/pages/{catalog_id}/page-001.{extension}"
    return catalog_asset_url(config, relative, catalog_asset_version_for_tier(catalog, "full"))


def catalog_page_image_url(config: SeoConfig, catalog: Mapping[str, Any], page: int, *, thumb: bool = False) -> str:
    safe_page = max(1, int(page))
    directory = str(catalog.get("dir") or f"assets/pages/{catalog.get('id', '')}").strip().rstrip("/")
    extension = str(catalog.get("imageExt", "webp")).strip().lstrip(".") or "webp"
    segment = "thumbs/" if thumb else ""
    relative = f"{directory}/{segment}page-{safe_page:03d}.{extension}"
    return catalog_asset_url(
        config,
        relative,
        catalog_asset_version_for_tier(catalog, "thumb" if thumb else "full"),
    )


def catalog_page_dimensions(catalog: Mapping[str, Any], page: int) -> tuple[int, int]:
    sizes = catalog.get("pageSizes")
    if isinstance(sizes, list) and 0 < page <= len(sizes):
        value = sizes[page - 1]
        if isinstance(value, list) and len(value) >= 2:
            try:
                width, height = int(value[0]), int(value[1])
                if width > 0 and height > 0:
                    return width, height
            except (TypeError, ValueError):
                pass
    return 1200, 630


def robots_content(mode: str, *, indexable_public: bool, page_share: bool = False) -> str:
    if mode == "private":
        return "noindex, nofollow, noimageindex, nosnippet, noarchive"
    if indexable_public:
        return "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    if page_share:
        return "noindex, follow, noimageindex, noarchive"
    return "noindex, nofollow, noimageindex, noarchive"


def _json_ld_script(payload: Mapping[str, Any]) -> str:
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    return f'<script type="application/ld+json">{serialized}</script>'


def social_metadata(page: SeoPage, config: SeoConfig) -> str:
    image_type = mimetypes.guess_type(urlparse(page.image_url).path)[0] or "image/jpeg"
    values = {
        "title": html.escape(page.title, quote=True),
        "description": html.escape(page.description, quote=True),
        "url": html.escape(page.canonical_url, quote=True),
        "image": html.escape(page.image_url, quote=True),
        "image_alt": html.escape(page.image_alt, quote=True),
        "site_name": html.escape(config.site_name, quote=True),
        "locale": html.escape(config.locale, quote=True),
        "og_type": html.escape(page.og_type, quote=True),
    }
    return "\n".join(
        (
            f'<meta property="og:type" content="{values["og_type"]}" />',
            f'<meta property="og:site_name" content="{values["site_name"]}" />',
            f'<meta property="og:locale" content="{values["locale"]}" />',
            f'<meta property="og:title" content="{values["title"]}" />',
            f'<meta property="og:description" content="{values["description"]}" />',
            f'<meta property="og:url" content="{values["url"]}" />',
            f'<meta property="og:image" content="{values["image"]}" />',
            f'<meta property="og:image:secure_url" content="{values["image"]}" />',
            f'<meta property="og:image:type" content="{html.escape(image_type, quote=True)}" />',
            f'<meta property="og:image:width" content="{max(1, int(page.image_width))}" />',
            f'<meta property="og:image:height" content="{max(1, int(page.image_height))}" />',
            f'<meta property="og:image:alt" content="{values["image_alt"]}" />',
            '<meta name="twitter:card" content="summary_large_image" />',
            f'<meta name="twitter:title" content="{values["title"]}" />',
            f'<meta name="twitter:description" content="{values["description"]}" />',
            f'<meta name="twitter:image" content="{values["image"]}" />',
            f'<meta name="twitter:image:alt" content="{values["image_alt"]}" />',
        )
    )


def structured_data(page: SeoPage) -> str:
    return "\n".join(_json_ld_script(item) for item in page.json_ld)


def default_share_image_url(config: SeoConfig) -> str:
    return absolute_url(config, config.default_share_image)


def _telephone_href(value: str) -> str:
    return re.sub(r"[^0-9+]", "", str(value or ""))


def local_business_json_ld(
    config: SeoConfig,
    footer: Mapping[str, str],
    taxonomy: Taxonomy,
    catalogs: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    business = config.business
    schema_type = str(business.get("schemaType", "LocalBusiness")).strip() or "LocalBusiness"
    opening_days = business.get("openingDays", [])
    if not isinstance(opening_days, list) or not all(isinstance(item, str) and item.strip() for item in opening_days):
        raise ValueError("seo business openingDays must be a list of Schema.org day names")

    description = (
        "גלריית קטלוגים של רהיטי ברגיג לצפייה בדגמי ריהוט וליצירת קשר. "
        "הביקור במקום מתקיים בתיאום מראש."
    )
    telephone = _telephone_href(footer.get("mobile", ""))
    alternate_telephone = _telephone_href(footer.get("phone", ""))
    contact_points: list[dict[str, Any]] = []
    for number in (telephone, alternate_telephone):
        if not number:
            continue
        contact_points.append(
            {
                "@type": "ContactPoint",
                "telephone": number,
                "contactType": "customer service",
                "availableLanguage": ["he"],
            }
        )

    active_category_names = {
        str(item.get("category", "")).strip()
        for item in catalogs
        if str(item.get("category", "")).strip()
    }
    offer_catalog = {
        "@type": "OfferCatalog",
        "name": "קטלוגי ריהוט",
        "itemListElement": [
            {
                "@type": "OfferCatalog",
                "name": category.name,
                "url": absolute_url(config, category_path(category)),
            }
            for category in taxonomy.categories
            if category.name in active_category_names
        ],
    }
    result: dict[str, Any] = {
        "@context": "https://schema.org",
        "@type": schema_type,
        "@id": f"{config.site_url}/#business",
        "name": footer.get("businessName", config.site_name),
        "url": f"{config.site_url}/",
        "logo": absolute_url(config, "brand-logo.svg"),
        "image": default_share_image_url(config),
        "description": description,
        "email": footer.get("email", ""),
        "telephone": telephone,
        "taxID": str(footer.get("registrationNumber", "")).strip(),
        "address": {
            "@type": "PostalAddress",
            "streetAddress": str(business.get("streetAddress", "")).strip(),
            "addressLocality": str(business.get("addressLocality", "")).strip(),
            "addressCountry": str(business.get("addressCountry", "IL")).strip(),
        },
        "openingHoursSpecification": {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": opening_days,
            "opens": str(business.get("opens", "")).strip(),
            "closes": str(business.get("closes", "")).strip(),
        },
        "contactPoint": contact_points,
        "hasOfferCatalog": offer_catalog,
    }
    properties: list[dict[str, Any]] = []
    if alternate_telephone:
        properties.append({
            "@type": "PropertyValue",
            "name": "טלפון נוסף",
            "value": alternate_telephone,
        })
    if bool(business.get("appointmentOnly", False)):
        properties.append({
            "@type": "PropertyValue",
            "name": "קבלת קהל",
            "value": "בתיאום מראש בלבד",
        })
    if properties:
        result["additionalProperty"] = properties
    return {key: value for key, value in result.items() if value not in ("", [], None)}


def web_page_json_ld(
    config: SeoConfig,
    *,
    title: str,
    description: str,
    canonical_url: str,
    image_url: str,
    page_type: str = "WebPage",
) -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": page_type,
        "@id": f"{canonical_url}#webpage",
        "url": canonical_url,
        "name": title,
        "description": description,
        "inLanguage": "he",
        "isPartOf": {"@id": f"{config.site_url}/#website"},
        "primaryImageOfPage": {"@type": "ImageObject", "url": image_url},
    }


def breadcrumb_json_ld(items: Sequence[tuple[str, str]]) -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        "itemListElement": [
            {"@type": "ListItem", "position": index, "name": name, "item": url}
            for index, (name, url) in enumerate(items, 1)
        ],
    }


def create_seo_page(
    config: SeoConfig,
    *,
    mode: str,
    title: str,
    description: str,
    canonical_path_value: str,
    image_url: str | None = None,
    image_width: int = 1200,
    image_height: int = 630,
    image_alt: str = "רהיטי ברגיג",
    og_type: str = "website",
    indexable_public: bool,
    page_share: bool = False,
    json_ld: Iterable[Mapping[str, Any]] = (),
) -> SeoPage:
    canonical_url = absolute_url(config, canonical_path_value)
    return SeoPage(
        title=title,
        description=description,
        canonical_url=canonical_url,
        robots=robots_content(mode, indexable_public=indexable_public, page_share=page_share),
        image_url=image_url or default_share_image_url(config),
        image_width=image_width,
        image_height=image_height,
        image_alt=image_alt,
        og_type=og_type,
        json_ld=tuple(json_ld),
    )


def render_headers(root: Path, output_dir: Path, mode: str) -> Path:
    template_path = root / HEADERS_TEMPLATE_FILE
    if not template_path.is_file():
        raise FileNotFoundError(f"Required SEO headers template is missing: {HEADERS_TEMPLATE_FILE}")
    private_header = "  X-Robots-Tag: noindex, nofollow, noimageindex, nosnippet, noarchive\n" if mode == "private" else ""
    rendered = template_path.read_text(encoding="utf-8").replace("{{GLOBAL_INDEXING_HEADER}}", private_header)
    if "{{" in rendered or "}}" in rendered:
        raise ValueError("Unresolved token in _headers.template")
    target = output_dir / "_headers"
    target.write_text(rendered.replace("\r\n", "\n").replace("\r", "\n"), encoding="utf-8", newline="\n")
    return target


def render_robots(output_dir: Path, config: SeoConfig, mode: str) -> Path:
    lines = [
        "# Generated from seo.config.json. Do not edit this deployed copy by hand.",
        "User-agent: *",
        "Allow: /",
    ]
    if mode == "private":
        lines.insert(1, "# Private mode: crawlers may fetch pages so they can observe the noindex response.")
    else:
        lines.extend(("", f"Sitemap: {config.site_url}/sitemap.xml"))
    target = output_dir / "robots.txt"
    target.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8", newline="\n")
    return target


def render_sitemap(output_dir: Path, config: SeoConfig, entries: Sequence[Mapping[str, Any]], mode: str) -> Path | None:
    target = output_dir / "sitemap.xml"
    if mode != "public":
        target.unlink(missing_ok=True)
        return None

    ET.register_namespace("", "http://www.sitemaps.org/schemas/sitemap/0.9")
    ET.register_namespace("image", "http://www.google.com/schemas/sitemap-image/1.1")
    root_element = ET.Element("{http://www.sitemaps.org/schemas/sitemap/0.9}urlset")
    seen: set[str] = set()
    for entry in entries:
        location = str(entry.get("loc", "")).strip()
        if not location or location in seen:
            continue
        if not location.startswith(f"{config.site_url}/") and location != f"{config.site_url}/":
            raise ValueError(f"Sitemap URL is outside the configured site origin: {location}")
        seen.add(location)
        url_element = ET.SubElement(root_element, "{http://www.sitemaps.org/schemas/sitemap/0.9}url")
        ET.SubElement(url_element, "{http://www.sitemaps.org/schemas/sitemap/0.9}loc").text = location
        image_url = str(entry.get("image", "")).strip()
        if image_url:
            image_element = ET.SubElement(url_element, "{http://www.google.com/schemas/sitemap-image/1.1}image")
            ET.SubElement(image_element, "{http://www.google.com/schemas/sitemap-image/1.1}loc").text = image_url
            image_title = str(entry.get("imageTitle", "")).strip()
            if image_title:
                ET.SubElement(image_element, "{http://www.google.com/schemas/sitemap-image/1.1}title").text = image_title

    tree = ET.ElementTree(root_element)
    ET.indent(tree, space="  ")
    tree.write(target, encoding="utf-8", xml_declaration=True)
    with target.open("ab") as handle:
        handle.write(b"\n")
    return target
