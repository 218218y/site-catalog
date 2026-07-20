#!/usr/bin/env python3
"""Render public HTML, clean SEO routes and indexing controls from one source of truth.

Normal source builds keep the project in ``private`` mode and refresh only the
checked-in root documents. Deploy builds additionally generate clean category,
catalog and per-page sharing routes. A ``public`` build is deliberately guarded
by an explicit confirmation flag so changing a config value cannot accidentally
open the site to search engines.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

from build_frontend_assets import build_frontend_assets
from footer_content import read_footer_content, render_footer_template, validate_footer_content
from seo_site import (
    SeoConfig,
    Taxonomy,
    TaxonomyCategory,
    TaxonomySubcategory,
    absolute_url,
    breadcrumb_json_ld,
    build_taxonomy_asset,
    catalog_cover_url,
    catalog_page_dimensions,
    catalog_page_image_url,
    catalog_page_path,
    catalog_path,
    category_path,
    create_seo_page,
    default_share_image_url,
    load_seo_config,
    load_taxonomy,
    local_business_json_ld,
    render_headers,
    render_robots,
    render_sitemap,
    resolve_seo_mode,
    social_metadata,
    structured_data,
    subcategory_path,
    validate_taxonomy_catalog_coverage,
    web_page_json_ld,
)

TOKEN_RE = re.compile(r"\{\{[A-Z0-9_]+\}\}")
HTML_ASSET_ATTR_RE = re.compile(
    r"(?P<prefix><(?:script|link)\b[^>]*?\b(?:src|href)\s*=\s*[\"'])(?P<url>[^\"']+)(?P<suffix>[\"'])",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class PageDocument:
    filename: str
    mode: str
    title: str
    description: str
    canonical_path: str
    indexable_public: bool = False
    template_filename: str = "site.template.html"
    content_filename: str | None = None
    legal_eyebrow: str = ""
    legal_heading: str = ""
    legal_updated: str = ""
    legal_summary: str = ""


PAGE_DOCUMENTS = (
    PageDocument(
        "index.html",
        "home",
        "קטלוגים | רהיטי ברגיג",
        "גלריית הקטלוגים של רהיטי ברגיג — בחירת קטלוג, חיפוש מהיר ופתיחה נוחה.",
        "",
        indexable_public=True,
    ),
    PageDocument(
        "catalog.html",
        "catalog",
        "קטלוג | רהיטי ברגיג",
        "עמודי קטלוג מלאים של רהיטי ברגיג עם מעבר מהיר לצפייה מוגדלת.",
        "catalog.html",
    ),
    PageDocument(
        "favorites.html",
        "favorites",
        "המועדפים שלי | רהיטי ברגיג",
        "עמודי הקטלוג ששמרת במועדפים, עם הערות, סינון ושיתוף מרוכז.",
        "favorites.html",
    ),
    PageDocument(
        "viewer.html",
        "viewer",
        "צפייה בקטלוג | רהיטי ברגיג",
        "צפייה במסך מלא בעמודי הקטלוגים של רהיטי ברגיג.",
        "viewer.html",
    ),
    PageDocument(
        "terms.html",
        "terms",
        "תנאי שימוש | רהיטי ברגיג",
        "תנאי השימוש באתר הקטלוגים של רהיטי ברגיג.",
        "terms.html",
        indexable_public=True,
        template_filename="legal.template.html",
        content_filename="legal/terms.content.html",
        legal_eyebrow="שימוש הוגן וברור",
        legal_heading="תנאי שימוש",
        legal_updated="15 ביולי 2026",
        legal_summary="התנאים מותאמים לאתר קטלוגים המציג ריהוט ומאפשר שמירת בחירות ויצירת קשר, ללא רכישה או תשלום מקוונים.",
    ),
    PageDocument(
        "privacy.html",
        "privacy",
        "מדיניות פרטיות | רהיטי ברגיג",
        "מדיניות הפרטיות באתר הקטלוגים של רהיטי ברגיג.",
        "privacy.html",
        indexable_public=True,
        template_filename="legal.template.html",
        content_filename="legal/privacy.content.html",
        legal_eyebrow="שקיפות ושמירה על מידע",
        legal_heading="מדיניות פרטיות",
        legal_updated="15 ביולי 2026",
        legal_summary="המדיניות מתארת את המידע שנשמר במכשיר, מידע שנמסר בפנייה והשימוש בספקי התשתית הנדרשים להפעלת האתר.",
    ),
    PageDocument(
        "accessibility.html",
        "accessibility",
        "הצהרת נגישות | רהיטי ברגיג",
        "מידע על התאמות הנגישות באתר הקטלוגים של רהיטי ברגיג ודרכי פנייה בנושא נגישות.",
        "accessibility.html",
        indexable_public=True,
        template_filename="legal.template.html",
        content_filename="legal/accessibility.content.html",
        legal_eyebrow="שימוש שוויוני ונוח",
        legal_heading="הצהרת נגישות",
        legal_updated="17 ביולי 2026",
        legal_summary="הצהרה זו מפרטת את התאמות הנגישות באתר, מגבלות ידועות, חלופות נגישות ודרכי פנייה לקבלת סיוע.",
    ),
)

TECHNICAL_SHELL_FILENAMES = frozenset({"catalog.html", "viewer.html"})


def read_required_text(root: Path, relative_path: str) -> str:
    path = root / relative_path
    if not path.is_file():
        raise FileNotFoundError(f"Required site source is missing: {relative_path}")
    return path.read_text(encoding="utf-8")


def split_url_reference(reference: str) -> tuple[str, str]:
    """Return the path and preserved query/fragment suffix of an asset URL."""

    for index, character in enumerate(reference):
        if character in "?#":
            return reference[:index], reference[index:]
    return reference, ""


def rewrite_html_asset_references(document: str, rewrites: Mapping[str, str] | None) -> str:
    """Apply already-computed deploy asset fingerprints before writing HTML.

    Deployment builds can fingerprint the shared CSS/JavaScript files before
    rendering the hundreds of catalog-page documents. Rendering the final URLs
    directly avoids writing every HTML file once and then reopening it solely
    to replace ``app.js``/``styles.css`` references.
    """

    if not rewrites:
        return document

    def replace_reference(match: re.Match[str]) -> str:
        raw_reference = match.group("url")
        reference_path, suffix = split_url_reference(raw_reference)
        replacement = rewrites.get(reference_path)
        if not replacement:
            return match.group(0)
        return f"{match.group('prefix')}{replacement}{suffix}{match.group('suffix')}"

    return HTML_ASSET_ATTR_RE.sub(replace_reference, document)


def read_template(
    root: Path,
    relative_path: str,
    asset_rewrites: Mapping[str, str] | None = None,
) -> str:
    return rewrite_html_asset_references(
        read_required_text(root, relative_path),
        asset_rewrites,
    )


def read_catalogs(root: Path) -> list[dict[str, Any]]:
    path = root / "catalogs.generated.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError as exc:
        raise FileNotFoundError("Required generated catalog data is missing: catalogs.generated.json") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Could not parse catalogs.generated.json: {exc}") from exc
    if not isinstance(payload, list) or not payload:
        raise ValueError("catalogs.generated.json must contain at least one catalog")
    catalogs = [item for item in payload if isinstance(item, dict)]
    if len(catalogs) != len(payload):
        raise ValueError("Every generated catalog entry must be a JSON object")
    return catalogs


def normalize_text(value: str) -> str:
    return value.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n"


def write_generated_text(path: Path, content: str) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(normalize_text(content), encoding="utf-8", newline="\n")
    return path


def replace_tokens(template: str, replacements: Mapping[str, str], *, label: str) -> str:
    rendered = template
    for token, value in replacements.items():
        rendered = rendered.replace(token, value)
    unresolved = sorted(set(TOKEN_RE.findall(rendered)))
    if unresolved:
        raise ValueError(f"Unresolved template tokens in {label}: {', '.join(unresolved)}")
    return normalize_text(rendered)


def image_preload(image_url: str, *, image_type: str = "image/webp") -> str:
    return (
        f'<link rel="preload" href="{html.escape(image_url, quote=True)}" '
        f'as="image" type="{html.escape(image_type, quote=True)}" fetchpriority="high" />'
    )


def web_site_json_ld(config: SeoConfig) -> dict[str, Any]:
    return {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "@id": f"{config.site_url}/#website",
        "url": f"{config.site_url}/",
        "name": config.site_name,
        "inLanguage": "he",
        "publisher": {"@id": f"{config.site_url}/#business"},
    }


def page_seo(
    config: SeoConfig,
    taxonomy: Taxonomy,
    footer_content: Mapping[str, str],
    page: PageDocument,
    mode: str,
    catalogs: Sequence[Mapping[str, Any]],
) -> Any:
    canonical = absolute_url(config, page.canonical_path)
    image = default_share_image_url(config)
    json_ld: list[Mapping[str, Any]] = [
        web_page_json_ld(
            config,
            title=page.title,
            description=page.description,
            canonical_url=canonical,
            image_url=image,
        )
    ]
    if page.mode == "home":
        json_ld = [web_site_json_ld(config), local_business_json_ld(config, footer_content, taxonomy, catalogs), *json_ld]
    return create_seo_page(
        config,
        mode=mode,
        title=page.title,
        description=page.description,
        canonical_path_value=page.canonical_path,
        image_url=image,
        image_alt=f"{config.site_name} — גלריית קטלוגים",
        indexable_public=page.indexable_public,
        json_ld=json_ld,
    )


def common_page_replacements(seo: Any, config: SeoConfig, *, base_tag: str = "", route_preload: str = "") -> dict[str, str]:
    return {
        "{{BASE_TAG}}": base_tag,
        "{{ROBOTS_CONTENT}}": html.escape(seo.robots, quote=True),
        "{{ROUTE_PRELOAD}}": route_preload,
        "{{PAGE_TITLE}}": html.escape(seo.title),
        "{{PAGE_DESCRIPTION}}": html.escape(seo.description, quote=True),
        "{{CANONICAL_URL}}": html.escape(seo.canonical_url, quote=True),
        "{{SOCIAL_METADATA}}": social_metadata(seo, config),
        "{{STRUCTURED_DATA}}": structured_data(seo),
    }


def catalogs_for_category(
    catalogs: Sequence[Mapping[str, Any]],
    category_name: str,
    subcategory_name: str | None = None,
) -> list[Mapping[str, Any]]:
    selected = [
        item for item in catalogs
        if str(item.get("category", "")).strip() == category_name
    ]
    if subcategory_name is not None:
        selected = [
            item for item in selected
            if str(item.get("subcategory", "")).strip() == subcategory_name
        ]
    return selected


def active_categories(
    taxonomy: Taxonomy,
    catalogs: Sequence[Mapping[str, Any]],
) -> tuple[TaxonomyCategory, ...]:
    return tuple(
        category for category in taxonomy.categories
        if catalogs_for_category(catalogs, category.name)
    )


def active_subcategories(
    taxonomy: Taxonomy,
    catalogs: Sequence[Mapping[str, Any]],
    category: TaxonomyCategory,
) -> tuple[TaxonomySubcategory, ...]:
    return tuple(
        subcategory for subcategory in taxonomy.subcategories
        if subcategory.category == category.name
        and catalogs_for_category(catalogs, category.name, subcategory.name)
    )


def static_home_navigation(
    taxonomy: Taxonomy,
    catalogs: Sequence[Mapping[str, Any]],
    *,
    mobile: bool = False,
) -> str:
    role = ' role="menuitem"' if mobile else ""
    return "\n".join(
        f'<a href="/{category_path(category)}" '
        f'data-category="{html.escape(category.name, quote=True)}"{role}>'
        f'{html.escape(category.name)}</a>'
        for category in active_categories(taxonomy, catalogs)
    )


def static_home_catalog_grid(
    catalogs: Sequence[Mapping[str, Any]],
    taxonomy: Taxonomy,
    config: SeoConfig,
) -> str:
    sections: list[str] = []
    eager_catalog_ids = {
        str(item.get("id", "")).strip()
        for item in catalogs[:2]
    }
    for category in active_categories(taxonomy, catalogs):
        category_catalogs = catalogs_for_category(catalogs, category.name)
        cards = "\n".join(
            catalog_card(
                item,
                config,
                eager=str(item.get("id", "")).strip() in eager_catalog_ids,
            )
            for item in category_catalogs
        )
        category_href = f"/{category_path(category)}"
        sections.append(
            '<section class="catalog-category-section" '
            f'data-category-section="{html.escape(category.name, quote=True)}">'
            '<div class="catalog-category-heading">'
            f'<h2><a href="{html.escape(category_href, quote=True)}">{html.escape(category.name)}</a></h2>'
            f'<a class="catalog-category-all-link" href="{html.escape(category_href, quote=True)}">לכל הקטלוגים בקטגוריה</a>'
            '</div>'
            f'<div class="catalog-grid">{cards}</div>'
            '</section>'
        )
    return "\n".join(sections)


def default_site_shell_replacements(
    page: PageDocument,
    site_footer: str,
    *,
    taxonomy: Taxonomy | None = None,
    catalogs: Sequence[Mapping[str, Any]] = (),
    config: SeoConfig | None = None,
) -> dict[str, str]:
    home_ready = page.mode == "home" and taxonomy is not None and config is not None
    return {
        "{{PAGE_MODE}}": page.mode,
        "{{BODY_DATA_ATTRIBUTES}}": "",
        "{{SITE_FOOTER}}": site_footer,
        "{{INITIAL_CATEGORY_NAV}}": static_home_navigation(
            taxonomy, catalogs
        ) if home_ready else "",
        "{{INITIAL_MOBILE_CATEGORY_NAV}}": static_home_navigation(
            taxonomy, catalogs, mobile=True
        ) if home_ready else "",
        "{{CATALOGS_SECTION_EXTRA_CLASS}}": "" if page.mode == "home" else " hidden",
        "{{CATALOG_GRID_BUSY}}": "false" if home_ready else "true",
        "{{INITIAL_CATALOG_GRID}}": static_home_catalog_grid(
            catalogs, taxonomy, config
        ) if home_ready else "",
        "{{CATALOG_DETAIL_EXTRA_CLASS}}": "" if page.mode == "catalog" else " hidden",
        "{{CATALOG_DETAIL_TITLE}}": "קטלוג",
        "{{CATALOG_DETAIL_DESCRIPTION}}": "בחרו קטלוג לצפייה בעמודים.",
        "{{CATALOG_MENU_LABEL}}": "בחירת קטלוג",
        "{{INITIAL_PAGE_GRID}}": "",
        "{{NOSCRIPT_CONTENT}}": '<noscript><p class="noscript-message">יש להפעיל JavaScript כדי להשתמש במציג הקטלוגים.</p></noscript>',
    }

def render_base_document(
    root: Path,
    target_root: Path,
    templates: dict[str, str],
    page: PageDocument,
    *,
    config: SeoConfig,
    taxonomy: Taxonomy,
    footer_content: Mapping[str, str],
    site_footer: str,
    mode: str,
    catalogs: Sequence[Mapping[str, Any]],
    asset_rewrites: Mapping[str, str] | None = None,
) -> Path:
    if page.template_filename not in templates:
        templates[page.template_filename] = read_template(
            root,
            page.template_filename,
            asset_rewrites,
        )
    template = templates[page.template_filename]
    seo = page_seo(config, taxonomy, footer_content, page, mode, catalogs)
    replacements = common_page_replacements(seo, config)
    replacements.update({"{{SITE_FOOTER}}": site_footer})

    if page.template_filename == "site.template.html":
        replacements.update(
            default_site_shell_replacements(
                page,
                site_footer,
                taxonomy=taxonomy,
                catalogs=catalogs,
                config=config,
            )
        )
    else:
        legal_content = read_required_text(root, page.content_filename).strip() if page.content_filename else ""
        replacements.update(
            {
                "{{PAGE_MODE}}": page.mode,
                "{{LEGAL_EYEBROW}}": page.legal_eyebrow,
                "{{LEGAL_HEADING}}": page.legal_heading,
                "{{LEGAL_UPDATED}}": page.legal_updated,
                "{{LEGAL_SUMMARY}}": page.legal_summary,
                "{{LEGAL_CONTENT}}": legal_content,
            }
        )

    target = target_root / page.filename
    return write_generated_text(target, replace_tokens(template, replacements, label=page.filename))


def category_navigation(taxonomy: Taxonomy, catalogs: Sequence[Mapping[str, Any]], *, active_slug: str = "") -> str:
    links = []
    for category in active_categories(taxonomy, catalogs):
        current = ' aria-current="page"' if category.slug == active_slug else ""
        links.append(
            f'<a href="/{category_path(category)}"{current}>{html.escape(category.name)}</a>'
        )
    return "\n".join(links)


def catalog_card(
    catalog: Mapping[str, Any],
    config: SeoConfig,
    *,
    eager: bool = False,
) -> str:
    catalog_id = str(catalog.get("id", "")).strip()
    title = str(catalog.get("title", "קטלוג")).strip()
    description = str(catalog.get("description", "")).strip()
    page_count = max(0, int(catalog.get("pages", 0) or 0))
    image = catalog_cover_url(config, catalog)
    width, height = catalog_page_dimensions(catalog, 1)
    loading = "eager" if eager else "lazy"
    priority = "high" if eager else "low"
    href = f"/{catalog_path(catalog_id)}"
    escaped_href = html.escape(href, quote=True)
    return f"""
<article class="catalog-card seo-catalog-card">
  <a class="catalog-cover-frame" href="{escaped_href}" aria-label="פתיחת {html.escape(title, quote=True)}">
    <img src="{html.escape(image, quote=True)}" alt="שער {html.escape(title, quote=True)}" width="{width}" height="{height}" loading="{loading}" decoding="async" fetchpriority="{priority}" />
    <span class="catalog-page-count">{page_count} עמודים</span>
  </a>
  <div class="catalog-card-body">
    <h3><a href="{escaped_href}">{html.escape(title)}</a></h3>
    <p>{html.escape(description)}</p>
    <a class="button soft seo-catalog-open" href="{escaped_href}">לצפייה בקטלוג</a>
  </div>
</article>""".strip()


def breadcrumb_markup(items: Sequence[tuple[str, str]]) -> str:
    rendered: list[str] = []
    for index, (label, href) in enumerate(items):
        if index == len(items) - 1:
            rendered.append(f'<span aria-current="page">{html.escape(label)}</span>')
        else:
            rendered.append(f'<a href="{html.escape(href, quote=True)}">{html.escape(label)}</a><span aria-hidden="true">/</span>')
    return "\n".join(rendered)


def render_category_route(
    root: Path,
    target_root: Path,
    template: str,
    *,
    config: SeoConfig,
    taxonomy: Taxonomy,
    footer_content: Mapping[str, str],
    site_footer: str,
    mode: str,
    category: TaxonomyCategory,
    subcategory: TaxonomySubcategory | None,
    catalogs: Sequence[Mapping[str, Any]],
) -> tuple[Path, dict[str, str]]:
    if subcategory:
        selected = catalogs_for_category(catalogs, category.name, subcategory.name)
        route_path = subcategory_path(category, subcategory)
        title = f"{subcategory.name} — {category.name} | {config.site_name}"
        heading = subcategory.name
        description = subcategory.description
        eyebrow = category.name
        breadcrumbs = [("כל הקטלוגים", "/"), (category.name, f"/{category_path(category)}"), (subcategory.name, f"/{route_path}")]
    else:
        selected = catalogs_for_category(catalogs, category.name)
        route_path = category_path(category)
        title = f"{category.name} — קטלוגים | {config.site_name}"
        heading = category.name
        description = category.description
        eyebrow = "קטגוריית קטלוגים"
        breadcrumbs = [("כל הקטלוגים", "/"), (category.name, f"/{route_path}")]

    if not selected:
        raise ValueError(f"SEO route {route_path} has no matching catalogs")
    canonical = absolute_url(config, route_path)
    image = catalog_cover_url(config, selected[0])
    image_width, image_height = catalog_page_dimensions(selected[0], 1)
    list_items = [
        {
            "@type": "ListItem",
            "position": index,
            "url": absolute_url(config, catalog_path(str(item.get("id", "")))),
            "name": str(item.get("title", "")),
        }
        for index, item in enumerate(selected, 1)
    ]
    json_ld = [
        web_page_json_ld(
            config,
            title=title,
            description=description,
            canonical_url=canonical,
            image_url=image,
            page_type="CollectionPage",
        ),
        breadcrumb_json_ld([(name, absolute_url(config, href.lstrip("/"))) for name, href in breadcrumbs]),
        {
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": heading,
            "numberOfItems": len(list_items),
            "itemListElement": list_items,
        },
    ]
    seo = create_seo_page(
        config,
        mode=mode,
        title=title,
        description=description,
        canonical_path_value=route_path,
        image_url=image,
        image_width=image_width,
        image_height=image_height,
        image_alt=f"{heading} — {config.site_name}",
        indexable_public=True,
        json_ld=json_ld,
    )
    subcategories = list(active_subcategories(taxonomy, catalogs, category))
    if not subcategory and subcategories:
        subnav = '<nav class="seo-subcategory-nav" aria-label="תתי קטגוריות"><strong>סינון לפי סוג:</strong>' + "".join(
            f'<a href="/{subcategory_path(category, item)}">{html.escape(item.name)}</a>' for item in subcategories
        ) + "</nav>"
    else:
        subnav = ""

    replacements = common_page_replacements(seo, config, base_tag='<base href="/" />')
    replacements.update(
        {
            "{{CATEGORY_NAVIGATION}}": category_navigation(taxonomy, catalogs, active_slug=category.slug),
            "{{BREADCRUMBS}}": breadcrumb_markup(breadcrumbs),
            "{{PAGE_EYEBROW}}": html.escape(eyebrow),
            "{{PAGE_HEADING}}": html.escape(heading),
            "{{PAGE_INTRO}}": html.escape(description),
            "{{CATALOG_COUNT}}": str(len(selected)),
            "{{PAGE_COUNT}}": str(sum(int(item.get("pages", 0) or 0) for item in selected)),
            "{{SUBCATEGORY_NAVIGATION}}": subnav,
            "{{CATALOG_CARDS}}": "\n".join(
                catalog_card(item, config, eager=index < 2)
                for index, item in enumerate(selected)
            ),
            "{{SITE_FOOTER}}": site_footer,
        }
    )
    target = target_root / route_path / "index.html"
    write_generated_text(target, replace_tokens(template, replacements, label=target.relative_to(target_root).as_posix()))
    return target, {"loc": seo.canonical_url, "image": image, "imageTitle": heading}


def static_page_grid(catalog: Mapping[str, Any], config: SeoConfig) -> str:
    catalog_id = str(catalog.get("id", "")).strip()
    title = str(catalog.get("title", "קטלוג")).strip()
    cards: list[str] = []
    for page in range(1, int(catalog.get("pages", 0) or 0) + 1):
        image = catalog_page_image_url(config, catalog, page, thumb=True)
        width, height = catalog_page_dimensions(catalog, page)
        cards.append(f"""
<article class="page-card">
  <a class="page-button" data-open-page="{page}" href="/{catalog_page_path(catalog_id, page)}">
    <div class="page-thumb-wrap" style="--page-thumb-aspect-ratio:{width} / {height}">
      <img class="page-thumb" src="{html.escape(image, quote=True)}" alt="{html.escape(title, quote=True)} - עמוד {page}" width="{width}" height="{height}" loading="lazy" decoding="async" fetchpriority="low" />
      <span class="page-number-badge">{page}</span>
    </div>
    <div class="page-card-body"><span class="page-card-title">עמוד {page}</span><span class="page-card-hint">לחץ להגדלה</span></div>
  </a>
</article>""".strip())
    return "\n".join(cards)


def render_catalog_route(
    target_root: Path,
    template: str,
    *,
    config: SeoConfig,
    taxonomy: Taxonomy,
    site_footer: str,
    mode: str,
    catalog: Mapping[str, Any],
) -> tuple[Path, dict[str, str]]:
    catalog_id = str(catalog.get("id", "")).strip()
    title_text = str(catalog.get("title", "קטלוג")).strip()
    description_text = str(catalog.get("description", "")).strip()
    pages = int(catalog.get("pages", 0) or 0)
    category = taxonomy.category_by_name(str(catalog.get("category", "")).strip())
    if category is None:
        raise ValueError(f"Catalog {catalog_id} has no valid taxonomy category")
    route_path = catalog_path(catalog_id)
    title = f"{title_text} | קטלוג ריהוט | {config.site_name}"
    description = f"{description_text}. צפייה נוחה ב־{pages} עמודי הקטלוג, חיפוש דגמים וקישורים ישירים לכל עמוד."
    image = catalog_cover_url(config, catalog)
    width, height = catalog_page_dimensions(catalog, 1)
    canonical = absolute_url(config, route_path)
    breadcrumbs = [("כל הקטלוגים", f"{config.site_url}/"), (category.name, absolute_url(config, category_path(category))), (title_text, canonical)]
    seo = create_seo_page(
        config,
        mode=mode,
        title=title,
        description=description,
        canonical_path_value=route_path,
        image_url=image,
        image_width=width,
        image_height=height,
        image_alt=f"שער {title_text}",
        og_type="website",
        indexable_public=True,
        json_ld=(
            web_page_json_ld(config, title=title, description=description, canonical_url=canonical, image_url=image, page_type="CollectionPage"),
            breadcrumb_json_ld(breadcrumbs),
        ),
    )
    synthetic_page = PageDocument("", "catalog", title, description, route_path)
    replacements = common_page_replacements(seo, config, base_tag='<base href="/" />', route_preload=image_preload(image))
    replacements.update(default_site_shell_replacements(synthetic_page, site_footer, taxonomy=taxonomy, catalogs=(), config=config))
    replacements.update(
        {
            "{{BODY_DATA_ATTRIBUTES}}": f' data-catalog-id="{html.escape(catalog_id, quote=True)}"',
            "{{CATALOGS_SECTION_EXTRA_CLASS}}": " hidden",
            "{{CATALOG_GRID_BUSY}}": "false",
            "{{CATALOG_DETAIL_EXTRA_CLASS}}": "",
            "{{CATALOG_DETAIL_TITLE}}": html.escape(title_text),
            "{{CATALOG_DETAIL_DESCRIPTION}}": html.escape(description_text),
            "{{CATALOG_MENU_LABEL}}": html.escape(title_text),
            "{{INITIAL_PAGE_GRID}}": static_page_grid(catalog, config),
            "{{NOSCRIPT_CONTENT}}": f'<noscript><p class="noscript-message">הקטלוג כולל {pages} עמודים. ניתן לפתוח כל עמוד מהקישורים המוצגים.</p></noscript>',
        }
    )
    target = target_root / route_path / "index.html"
    write_generated_text(target, replace_tokens(template, replacements, label=target.relative_to(target_root).as_posix()))
    return target, {"loc": seo.canonical_url, "image": image, "imageTitle": title_text}


def render_catalog_page_route(
    target_root: Path,
    template: str,
    *,
    config: SeoConfig,
    site_footer: str,
    mode: str,
    catalog: Mapping[str, Any],
    page_number: int,
) -> Path:
    catalog_id = str(catalog.get("id", "")).strip()
    title_text = str(catalog.get("title", "קטלוג")).strip()
    pages = int(catalog.get("pages", 0) or 0)
    route_path = catalog_page_path(catalog_id, page_number)
    image = catalog_page_image_url(config, catalog, page_number)
    width, height = catalog_page_dimensions(catalog, page_number)
    title = f"{title_text} — עמוד {page_number} | {config.site_name}"
    description = f"צפייה בעמוד {page_number} מתוך {pages} בקטלוג {title_text}, עם קישור ישיר לשיתוף ולבירור על הדגם."
    canonical = absolute_url(config, route_path)
    seo = create_seo_page(
        config,
        mode=mode,
        title=title,
        description=description,
        canonical_path_value=route_path,
        image_url=image,
        image_width=width,
        image_height=height,
        image_alt=f"{title_text} — עמוד {page_number}",
        og_type="website",
        indexable_public=False,
        page_share=True,
        json_ld=(web_page_json_ld(config, title=title, description=description, canonical_url=canonical, image_url=image),),
    )
    synthetic_page = PageDocument("", "viewer", title, description, route_path)
    replacements = common_page_replacements(seo, config, base_tag='<base href="/" />', route_preload=image_preload(image))
    replacements.update(default_site_shell_replacements(synthetic_page, site_footer))
    replacements.update(
        {
            "{{BODY_DATA_ATTRIBUTES}}": (
                f' data-catalog-id="{html.escape(catalog_id, quote=True)}" data-catalog-page="{page_number}"'
            ),
            "{{CATALOGS_SECTION_EXTRA_CLASS}}": " hidden",
            "{{CATALOG_GRID_BUSY}}": "false",
            "{{CATALOG_DETAIL_EXTRA_CLASS}}": " hidden",
            "{{NOSCRIPT_CONTENT}}": (
                '<noscript><section class="seo-share-fallback">'
                f'<h1>{html.escape(title_text)} — עמוד {page_number}</h1>'
                f'<img src="{html.escape(image, quote=True)}" width="{width}" height="{height}" alt="{html.escape(title_text, quote=True)} — עמוד {page_number}" />'
                f'<p><a class="button primary" href="/{catalog_path(catalog_id)}">לכל עמודי הקטלוג</a></p>'
                '</section></noscript>'
            ),
        }
    )
    target = target_root / route_path / "index.html"
    return write_generated_text(target, replace_tokens(template, replacements, label=target.relative_to(target_root).as_posix()))


def render_seo_routes(
    root: Path,
    target_root: Path,
    *,
    config: SeoConfig,
    taxonomy: Taxonomy,
    footer_content: Mapping[str, str],
    site_footer: str,
    mode: str,
    catalogs: Sequence[Mapping[str, Any]],
    asset_rewrites: Mapping[str, str] | None = None,
) -> tuple[list[Path], list[dict[str, str]]]:
    site_template = read_template(root, "site.template.html", asset_rewrites)
    category_template = read_template(root, "seo-page.template.html", asset_rewrites)
    written: list[Path] = []
    sitemap_entries: list[dict[str, str]] = []

    for category in active_categories(taxonomy, catalogs):
        path, entry = render_category_route(
            root,
            target_root,
            category_template,
            config=config,
            taxonomy=taxonomy,
            footer_content=footer_content,
            site_footer=site_footer,
            mode=mode,
            category=category,
            subcategory=None,
            catalogs=catalogs,
        )
        written.append(path)
        sitemap_entries.append(entry)
        for subcategory in active_subcategories(taxonomy, catalogs, category):
            path, entry = render_category_route(
                root,
                target_root,
                category_template,
                config=config,
                taxonomy=taxonomy,
                footer_content=footer_content,
                site_footer=site_footer,
                mode=mode,
                category=category,
                subcategory=subcategory,
                catalogs=catalogs,
            )
            written.append(path)
            sitemap_entries.append(entry)

    for catalog in catalogs:
        path, entry = render_catalog_route(
            target_root,
            site_template,
            config=config,
            taxonomy=taxonomy,
            site_footer=site_footer,
            mode=mode,
            catalog=catalog,
        )
        written.append(path)
        sitemap_entries.append(entry)
        for page_number in range(1, int(catalog.get("pages", 0) or 0) + 1):
            written.append(
                render_catalog_page_route(
                    target_root,
                    site_template,
                    config=config,
                    site_footer=site_footer,
                    mode=mode,
                    catalog=catalog,
                    page_number=page_number,
                )
            )
    return written, sitemap_entries


def assert_public_confirmation(mode: str, confirmed: bool) -> None:
    if mode == "public" and not confirmed:
        raise ValueError(
            "Public SEO mode requires --confirm-public-indexing. "
            "This guard prevents an accidental Google launch."
        )


def render_site_pages(
    root: Path,
    output_dir: Path | None = None,
    *,
    build_assets: bool = True,
    build_taxonomy: bool = True,
    footer_content: dict[str, str] | None = None,
    seo_mode: str | None = None,
    include_seo_routes: bool = False,
    include_technical_shells: bool | None = None,
    clean_output: bool = False,
    confirm_public_indexing: bool = False,
    include_indexing_files: bool = True,
    asset_rewrites: Mapping[str, str] | None = None,
) -> list[Path]:
    if build_assets:
        build_frontend_assets(root)
    if build_taxonomy:
        build_taxonomy_asset(root)

    config = load_seo_config(root)
    mode = resolve_seo_mode(root, seo_mode)
    assert_public_confirmation(mode, confirm_public_indexing)
    taxonomy = load_taxonomy(root)
    catalogs = read_catalogs(root)
    validate_taxonomy_catalog_coverage(taxonomy, catalogs)

    target_root = output_dir or root
    if clean_output:
        if output_dir is None or target_root.resolve() == root.resolve():
            raise ValueError("Refusing to clean the project source root")
        if target_root.exists():
            shutil.rmtree(target_root)
    target_root.mkdir(parents=True, exist_ok=True)
    footer_template = read_required_text(root, "partials/site-footer.html").strip()
    normalized_footer_content = (
        validate_footer_content(footer_content) if footer_content is not None else read_footer_content(root)
    )
    site_footer = render_footer_template(footer_template, normalized_footer_content)
    templates: dict[str, str] = {}
    written: list[Path] = []
    emit_technical_shells = (not include_seo_routes) if include_technical_shells is None else include_technical_shells

    for page in PAGE_DOCUMENTS:
        if not emit_technical_shells and page.filename in TECHNICAL_SHELL_FILENAMES:
            continue
        written.append(
            render_base_document(
                root,
                target_root,
                templates,
                page,
                config=config,
                taxonomy=taxonomy,
                footer_content=normalized_footer_content,
                site_footer=site_footer,
                mode=mode,
                catalogs=catalogs,
                asset_rewrites=asset_rewrites,
            )
        )

    if include_indexing_files:
        written.extend((render_headers(root, target_root, mode), render_robots(target_root, config, mode)))

    sitemap_entries: list[dict[str, str]] = [
        {"loc": absolute_url(config, page.canonical_path), "image": default_share_image_url(config), "imageTitle": page.title}
        for page in PAGE_DOCUMENTS if page.indexable_public
    ]
    if include_seo_routes:
        route_paths, route_entries = render_seo_routes(
            root,
            target_root,
            config=config,
            taxonomy=taxonomy,
            footer_content=normalized_footer_content,
            site_footer=site_footer,
            mode=mode,
            catalogs=catalogs,
            asset_rewrites=asset_rewrites,
        )
        written.extend(route_paths)
        sitemap_entries.extend(route_entries)

    sitemap = render_sitemap(target_root, config, sitemap_entries, mode) if include_indexing_files else None
    if sitemap is not None:
        written.append(sitemap)
    return written


def staging_output_dir(out_dir: Path) -> Path:
    return out_dir.with_name(f".{out_dir.name}.building")


def replace_output_dir(staging_dir: Path, out_dir: Path) -> None:
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


def render_site_pages_atomic(
    root: Path,
    output_dir: Path,
    **kwargs: Any,
) -> list[Path]:
    if output_dir.resolve() == root.resolve():
        raise ValueError("Refusing to replace the project source root")
    staging = staging_output_dir(output_dir)
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True, exist_ok=True)
    try:
        staged_paths = render_site_pages(root, staging, clean_output=False, **kwargs)
        relative_paths = [path.relative_to(staging) for path in staged_paths]
        replace_output_dir(staging, output_dir)
        return [output_dir / relative for relative in relative_paths]
    except Exception:
        if staging.exists():
            shutil.rmtree(staging)
        raise


def check_site_pages(root: Path) -> tuple[Path, ...]:
    build_frontend_assets(root, check=True)
    build_taxonomy_asset(root, check=True)
    checked_relatives = [Path(page.filename) for page in PAGE_DOCUMENTS] + [Path("_headers"), Path("robots.txt")]
    stale: list[Path] = []
    with tempfile.TemporaryDirectory(prefix="site-catalog-pages-") as temporary_dir:
        generated_root = Path(temporary_dir)
        render_site_pages(root, generated_root, build_assets=False, seo_mode="private")
        for relative in checked_relatives:
            expected_path = generated_root / relative
            current_path = root / relative
            if not current_path.is_file() or current_path.read_bytes() != expected_path.read_bytes():
                stale.append(relative)

        # Also render the complete private route graph to catch invalid taxonomy,
        # broken route metadata or unresolved nested templates during every check.
        complete_root = generated_root / "complete"
        complete = render_site_pages(
            root,
            complete_root,
            build_assets=False,
            seo_mode="private",
            include_seo_routes=True,
        )
        current_catalogs = read_catalogs(root)
        current_taxonomy = load_taxonomy(root)
        expected_route_count = sum(int(item.get("pages", 0) or 0) for item in current_catalogs)
        expected_route_count += len(current_catalogs)
        expected_route_count += len(active_categories(current_taxonomy, current_catalogs))
        expected_route_count += sum(
            len(active_subcategories(current_taxonomy, current_catalogs, category))
            for category in active_categories(current_taxonomy, current_catalogs)
        )
        generated_route_html = [path for path in complete if path.suffix == ".html" and path.parent != complete_root]
        if len(generated_route_html) != expected_route_count:
            raise RuntimeError(
                f"SEO route build is incomplete: expected {expected_route_count} nested HTML routes, "
                f"found {len(generated_route_html)}"
            )
        if (complete_root / "sitemap.xml").exists():
            raise RuntimeError("Private SEO build must not emit sitemap.xml")

    if stale:
        names = ", ".join(path.as_posix() for path in stale)
        raise RuntimeError(f"Generated site pages are stale: {names}. Run: python tools/build_site_pages.py")
    return tuple(root / relative for relative in checked_relatives)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify checked-in private root documents.")
    parser.add_argument("--out", help="Render into another directory instead of the project root.")
    parser.add_argument("--include-seo-routes", action="store_true", help="Generate clean category/catalog/page routes.")
    parser.add_argument("--seo-mode", choices=("private", "public"), help="Override seo.config.json defaultMode.")
    parser.add_argument(
        "--confirm-public-indexing",
        action="store_true",
        help="Required safety confirmation for a public/indexable build.",
    )
    args = parser.parse_args(argv)

    root = Path(__file__).resolve().parents[1]
    output = (root / args.out).resolve() if args.out else None
    try:
        if args.check:
            paths = check_site_pages(root)
        elif output and args.include_seo_routes:
            paths = tuple(render_site_pages_atomic(
                root,
                output,
                seo_mode=args.seo_mode,
                include_seo_routes=True,
                confirm_public_indexing=args.confirm_public_indexing,
            ))
        else:
            paths = tuple(render_site_pages(
                root,
                output,
                seo_mode=args.seo_mode,
                include_seo_routes=args.include_seo_routes,
                confirm_public_indexing=args.confirm_public_indexing,
            ))
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        print(f"ERROR: {exc}")
        return 1

    base = output or root
    status = "verified" if args.check else "rendered"
    for path in paths:
        try:
            relative = path.relative_to(base).as_posix()
        except ValueError:
            relative = path.as_posix()
        print(f"{relative}: {status}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
