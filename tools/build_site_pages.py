#!/usr/bin/env python3
"""Render every public HTML document from shared templates and fragments."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class PageDocument:
    filename: str
    mode: str
    title: str
    description: str
    canonical_path: str
    show_header_fullscreen: bool = False
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
        "עמודי הקטלוג ששמרת במועדפים לצפייה ולהשוואה נוחה.",
        "favorites.html",
    ),
    PageDocument(
        "viewer.html",
        "viewer",
        "צפייה בקטלוג | רהיטי ברגיג",
        "צפייה במסך מלא בעמודי הקטלוגים של רהיטי ברגיג.",
        "viewer.html",
        True,
    ),
    PageDocument(
        "terms.html",
        "terms",
        "תנאי שימוש | רהיטי ברגיג",
        "תנאי השימוש באתר הקטלוגים של רהיטי ברגיג.",
        "terms.html",
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
        template_filename="legal.template.html",
        content_filename="legal/privacy.content.html",
        legal_eyebrow="שקיפות ושמירה על מידע",
        legal_heading="מדיניות פרטיות",
        legal_updated="15 ביולי 2026",
        legal_summary="המדיניות מתארת את המידע שנשמר במכשיר, מידע שנמסר בפנייה והשימוש בספקי התשתית הנדרשים להפעלת האתר.",
    ),
)

HEADER_FULLSCREEN_BUTTON = """<button class="brand-copy-link brand-fullscreen-link" id="headerFullscreenToggle" type="button" aria-label="כניסה למסך מלא" title="מסך מלא" aria-pressed="false" data-fullscreen-active="false">
        <svg class="viewer-fullscreen-icon viewer-fullscreen-icon-enter" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M8.2 4.8H5.5a.7.7 0 0 0-.7.7v2.7M15.8 4.8h2.7a.7.7 0 0 1 .7.7v2.7M8.2 19.2H5.5a.7.7 0 0 1-.7-.7v-2.7M15.8 19.2h2.7a.7.7 0 0 0 .7-.7v-2.7" />
        </svg>
        <svg class="viewer-fullscreen-icon viewer-fullscreen-icon-exit" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9.2 5.4v2.9a.9.9 0 0 1-.9.9H5.4M14.8 5.4v2.9a.9.9 0 0 0 .9.9h2.9M9.2 18.6v-2.9a.9.9 0 0 0-.9-.9H5.4M14.8 18.6v-2.9a.9.9 0 0 1 .9-.9h2.9" />
        </svg>
      </button>"""


def read_required_text(root: Path, relative_path: str) -> str:
    path = root / relative_path
    if not path.is_file():
        raise FileNotFoundError(f"Required site source is missing: {relative_path}")
    return path.read_text(encoding="utf-8")


def render_page(template: str, page: PageDocument, *, site_footer: str, legal_content: str = "") -> str:
    replacements = {
        "{{PAGE_MODE}}": page.mode,
        "{{PAGE_TITLE}}": page.title,
        "{{PAGE_DESCRIPTION}}": page.description,
        "{{CANONICAL_PATH}}": page.canonical_path,
        "{{HEADER_FULLSCREEN_BUTTON}}": HEADER_FULLSCREEN_BUTTON if page.show_header_fullscreen else "",
        "{{SITE_FOOTER}}": site_footer,
        "{{LEGAL_EYEBROW}}": page.legal_eyebrow,
        "{{LEGAL_HEADING}}": page.legal_heading,
        "{{LEGAL_UPDATED}}": page.legal_updated,
        "{{LEGAL_SUMMARY}}": page.legal_summary,
        "{{LEGAL_CONTENT}}": legal_content,
    }
    rendered = template
    for token, value in replacements.items():
        rendered = rendered.replace(token, value)
    unresolved = sorted(set(part for part in replacements if part in rendered))
    if unresolved:
        raise ValueError(f"Unresolved page template tokens for {page.filename}: {unresolved}")
    return rendered


def render_site_pages(root: Path, output_dir: Path | None = None) -> list[Path]:
    target_root = output_dir or root
    target_root.mkdir(parents=True, exist_ok=True)

    site_footer = read_required_text(root, "partials/site-footer.html").strip()
    templates: dict[str, str] = {}
    written: list[Path] = []

    for page in PAGE_DOCUMENTS:
        template = templates.setdefault(
            page.template_filename,
            read_required_text(root, page.template_filename),
        )
        legal_content = read_required_text(root, page.content_filename).strip() if page.content_filename else ""
        target = target_root / page.filename
        rendered = render_page(
            template,
            page,
            site_footer=site_footer,
            legal_content=legal_content,
        ).replace("\r\n", "\n").replace("\r", "\n")
        target.write_bytes(rendered.replace("\n", "\r\n").encode("utf-8"))
        written.append(target)
    return written


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    for path in render_site_pages(root):
        print(path.relative_to(root).as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
