#!/usr/bin/env python3
"""Render every public HTML document from shared templates and fragments."""
from __future__ import annotations

import argparse
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

from build_frontend_assets import build_frontend_assets
from footer_content import read_footer_content, render_footer_template, validate_footer_content


@dataclass(frozen=True)
class PageDocument:
    filename: str
    mode: str
    title: str
    description: str
    canonical_path: str
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
    PageDocument(
        "accessibility.html",
        "accessibility",
        "הצהרת נגישות | רהיטי ברגיג",
        "מידע על התאמות הנגישות באתר הקטלוגים של רהיטי ברגיג ודרכי פנייה בנושא נגישות.",
        "accessibility.html",
        template_filename="legal.template.html",
        content_filename="legal/accessibility.content.html",
        legal_eyebrow="שימוש שוויוני ונוח",
        legal_heading="הצהרת נגישות",
        legal_updated="17 ביולי 2026",
        legal_summary="הצהרה זו מפרטת את התאמות הנגישות באתר, מגבלות ידועות, חלופות נגישות ודרכי פנייה לקבלת סיוע.",
    ),
)



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


def render_site_pages(
    root: Path,
    output_dir: Path | None = None,
    *,
    build_assets: bool = True,
    footer_content: dict[str, str] | None = None,
) -> list[Path]:
    if build_assets:
        build_frontend_assets(root)

    target_root = output_dir or root
    target_root.mkdir(parents=True, exist_ok=True)

    footer_template = read_required_text(root, "partials/site-footer.html").strip()
    normalized_footer_content = (
        validate_footer_content(footer_content)
        if footer_content is not None
        else read_footer_content(root)
    )
    site_footer = render_footer_template(footer_template, normalized_footer_content)
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
        # Generated public pages use one canonical LF representation on every
        # platform. GitHub checks out text files with LF, while many Windows
        # worktrees use CRLF; writing CRLF here made byte-for-byte --check
        # verification report false stale-page failures in CI even when the
        # rendered HTML was otherwise identical.
        target.write_text(rendered, encoding="utf-8", newline="\n")
        written.append(target)
    return written


def check_site_pages(root: Path) -> tuple[Path, ...]:
    build_frontend_assets(root, check=True)
    stale: list[Path] = []
    with tempfile.TemporaryDirectory(prefix="site-catalog-pages-") as temporary_dir:
        generated_root = Path(temporary_dir)
        generated = render_site_pages(root, generated_root, build_assets=False)
        for expected_path in generated:
            relative = expected_path.relative_to(generated_root)
            current_path = root / relative
            if not current_path.is_file() or current_path.read_bytes() != expected_path.read_bytes():
                stale.append(relative)
    if stale:
        names = ", ".join(path.as_posix() for path in stale)
        raise RuntimeError(
            f"Generated site pages are stale: {names}. "
            "Run: python tools/build_site_pages.py"
        )
    return tuple(root / page.filename for page in PAGE_DOCUMENTS)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify that generated HTML pages match the templates without writing files.",
    )
    args = parser.parse_args(argv)

    root = Path(__file__).resolve().parents[1]
    try:
        paths = check_site_pages(root) if args.check else tuple(render_site_pages(root))
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        print(f"ERROR: {exc}")
        return 1

    status = "verified" if args.check else "rendered"
    for path in paths:
        print(f"{path.relative_to(root).as_posix()}: {status}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
