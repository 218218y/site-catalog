#!/usr/bin/env python3
"""Render the public page documents from one shared HTML template."""
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
)

HEADER_FULLSCREEN_BUTTON = """<button class="brand-copy-link brand-fullscreen-link" id="headerFullscreenToggle" type="button" aria-label="כניסה למסך מלא" title="מסך מלא" aria-pressed="false" data-fullscreen-active="false">
        <svg class="viewer-fullscreen-icon viewer-fullscreen-icon-enter" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M8.2 4.8H5.5a.7.7 0 0 0-.7.7v2.7M15.8 4.8h2.7a.7.7 0 0 1 .7.7v2.7M8.2 19.2H5.5a.7.7 0 0 1-.7-.7v-2.7M15.8 19.2h2.7a.7.7 0 0 0 .7-.7v-2.7" />
        </svg>
        <svg class="viewer-fullscreen-icon viewer-fullscreen-icon-exit" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M9.2 5.4v2.9a.9.9 0 0 1-.9.9H5.4M14.8 5.4v2.9a.9.9 0 0 0 .9.9h2.9M9.2 18.6v-2.9a.9.9 0 0 0-.9-.9H5.4M14.8 18.6v-2.9a.9.9 0 0 1 .9-.9h2.9" />
        </svg>
      </button>"""


def render_page(template: str, page: PageDocument) -> str:
    replacements = {
        "{{PAGE_MODE}}": page.mode,
        "{{PAGE_TITLE}}": page.title,
        "{{PAGE_DESCRIPTION}}": page.description,
        "{{CANONICAL_PATH}}": page.canonical_path,
        "{{HEADER_FULLSCREEN_BUTTON}}": HEADER_FULLSCREEN_BUTTON if page.show_header_fullscreen else "",
    }
    rendered = template
    for token, value in replacements.items():
        rendered = rendered.replace(token, value)
    unresolved = [token for token in replacements if token in rendered]
    if unresolved:
        raise ValueError(f"Unresolved page template tokens for {page.filename}: {unresolved}")
    return rendered


def render_site_pages(root: Path, output_dir: Path | None = None) -> list[Path]:
    template_path = root / "site.template.html"
    template = template_path.read_text(encoding="utf-8")
    target_root = output_dir or root
    target_root.mkdir(parents=True, exist_ok=True)

    written: list[Path] = []
    for page in PAGE_DOCUMENTS:
        target = target_root / page.filename
        rendered = render_page(template, page).replace("\r\n", "\n").replace("\r", "\n")
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
