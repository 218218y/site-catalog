#!/usr/bin/env python3
"""Validated, text-only content model for the shared public-site footer."""
from __future__ import annotations

import html
import json
import re
from collections import OrderedDict
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import quote

FOOTER_CONTENT_RELATIVE_PATH = "partials/site-footer.content.json"
FOOTER_TEMPLATE_RELATIVE_PATH = "partials/site-footer.html"

# The footer editor is generated from this schema. The same schema also drives
# validation order and JSON serialization, so the control panel cannot silently
# drift away from the public footer structure.
FOOTER_EDITOR_GROUPS: tuple[dict[str, Any], ...] = (
    {
        "key": "visit",
        "title": "כרטיס: כתובת וביקור",
        "description": "השדות מופיעים בכרטיס הכתובת הראשון בפוטר, לפי הסדר המוצג כאן.",
        "fields": (
            {"name": "visitTitle", "label": "כותרת הכרטיס", "maxLength": 120},
            {"name": "address", "label": "כתובת עד לפני מספר הקומה", "maxLength": 240},
            {
                "name": "addressFloor",
                "label": "מספר קומה",
                "maxLength": 80,
                "dir": "ltr",
                "help": "נשמר בנפרד כדי שמספר שלילי יוצג נכון בתוך טקסט עברי.",
            },
            {"name": "visitingHours", "label": "ימי ושעות ביקור", "maxLength": 160},
            {"name": "visitNote", "label": "הערה מתחת לשעות", "maxLength": 240},
        ),
    },
    {
        "key": "contact",
        "title": "כרטיס: יצירת קשר",
        "description": "כולל נייד, טלפון ושתי פעולות המייל כפי שהן מופיעות יחד בפוטר.",
        "fields": (
            {"name": "contactTitle", "label": "כותרת הכרטיס", "maxLength": 120},
            {"name": "mobileLabel", "label": "תווית הנייד", "maxLength": 80},
            {
                "name": "mobile",
                "label": "מספר נייד",
                "maxLength": 80,
                "type": "tel",
                "dir": "ltr",
                "autocomplete": "tel",
                "help": "קישור החיוג נבנה אוטומטית מהמספר.",
            },
            {"name": "phoneLabel", "label": "תווית הטלפון", "maxLength": 80},
            {
                "name": "phone",
                "label": "מספר טלפון",
                "maxLength": 80,
                "type": "tel",
                "dir": "ltr",
                "autocomplete": "tel",
            },
            {"name": "emailLabel", "label": "תווית המייל", "maxLength": 80},
            {
                "name": "email",
                "label": "כתובת המייל",
                "maxLength": 254,
                "type": "email",
                "dir": "ltr",
                "autocomplete": "email",
                "help": "הכתובת מעדכנת יחד את קישור תוכנת הדואר ואת יעד כפתור Gmail.",
            },
            {
                "name": "emailMailtoTitle",
                "label": "כיתוב צף מעל כתובת המייל",
                "maxLength": 160,
                "help": "מופיע רק בריחוף על קישור כתובת המייל.",
            },
            {
                "name": "gmailTitle",
                "label": "טקסט כפתור Gmail",
                "maxLength": 160,
                "help": "מופיע בכפתור שמתחת לכתובת המייל, ללא כיתוב צף.",
            },
            {
                "name": "gmailSubject",
                "label": "נושא הודעת Gmail",
                "maxLength": 240,
                "help": "ממולא אוטומטית בשדה הנושא כאשר פותחים Gmail.",
            },
        ),
    },
    {
        "key": "response",
        "title": "כרטיס: שעות מענה",
        "description": "השדות מופיעים בכרטיס שעות המענה השלישי בפוטר.",
        "fields": (
            {"name": "responseTitle", "label": "כותרת הכרטיס", "maxLength": 120},
            {"name": "responseHours", "label": "שעות מענה", "maxLength": 160, "dir": "ltr"},
            {"name": "responseNote", "label": "הסבר מתחת לשעות", "maxLength": 240},
        ),
    },
    {
        "key": "links",
        "title": "כרטיס: מידע שימושי",
        "description": "טקסט הקישורים בכרטיס המידע השימושי בפוטר.",
        "fields": (
            {"name": "linksTitle", "label": "כותרת הכרטיס", "maxLength": 120},
            {"name": "termsLabel", "label": "טקסט קישור תנאי שימוש", "maxLength": 120},
            {"name": "privacyLabel", "label": "טקסט קישור פרטיות", "maxLength": 120},
            {"name": "topLabel", "label": "טקסט חזרה למעלה", "maxLength": 120},
        ),
    },
    {
        "key": "bottom",
        "title": "השורה התחתונה",
        "description": "פרטי העסק ושני המשפטים שמופיעים מתחת לארבעת הכרטיסים.",
        "fields": (
            {"name": "businessName", "label": "שם העסק", "maxLength": 160},
            {"name": "registrationLabel", "label": "תווית מספר העסק", "maxLength": 80},
            {"name": "registrationNumber", "label": "מספר העסק", "maxLength": 80, "dir": "ltr"},
            {"name": "rightsText", "label": "טקסט זכויות", "maxLength": 160},
            {"name": "bottomNote", "label": "הטקסט האחרון בפוטר", "maxLength": 240},
        ),
    },
)


def _footer_field_limits() -> "OrderedDict[str, int]":
    limits: "OrderedDict[str, int]" = OrderedDict()
    for group in FOOTER_EDITOR_GROUPS:
        for field in group["fields"]:
            name = str(field["name"])
            if name in limits:
                raise RuntimeError(f"Duplicate footer editor field: {name}")
            limits[name] = int(field["maxLength"])
    return limits


FOOTER_FIELD_LIMITS = _footer_field_limits()


def footer_editor_schema() -> list[dict[str, Any]]:
    """Return a JSON-safe copy of the editor schema used by the control panel."""
    return [
        {
            "key": str(group["key"]),
            "title": str(group["title"]),
            "description": str(group.get("description", "")),
            "fields": [dict(field) for field in group["fields"]],
        }
        for group in FOOTER_EDITOR_GROUPS
    ]

EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
FOOTER_TOKEN_RE = re.compile(r"\{\{FOOTER_[A-Z0-9_]+\}\}")


def _normalize_text(field: str, value: Any, max_length: int) -> str:
    if not isinstance(value, str):
        raise ValueError(f"Footer field {field} must be text")
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"Footer field {field} cannot be empty")
    if "\n" in normalized or "\r" in normalized:
        raise ValueError(f"Footer field {field} must be a single line")
    if len(normalized) > max_length:
        raise ValueError(f"Footer field {field} is longer than {max_length} characters")
    return normalized


def validate_footer_content(value: Any) -> dict[str, str]:
    if not isinstance(value, Mapping):
        raise ValueError("footer content must be a JSON object")

    expected = set(FOOTER_FIELD_LIMITS)
    actual = {str(key) for key in value}
    missing = [field for field in FOOTER_FIELD_LIMITS if field not in actual]
    unknown = sorted(actual - expected)
    if missing:
        raise ValueError(f"Footer content is missing fields: {', '.join(missing)}")
    if unknown:
        raise ValueError(f"Footer content has unknown fields: {', '.join(unknown)}")

    normalized = {
        field: _normalize_text(field, value[field], max_length)
        for field, max_length in FOOTER_FIELD_LIMITS.items()
    }
    if not EMAIL_RE.fullmatch(normalized["email"]):
        raise ValueError("Footer email is not a valid email address")
    # Validate both phone strings by ensuring the generated tel: target is useful.
    phone_href(normalized["mobile"])
    phone_href(normalized["phone"])
    return normalized


def read_footer_content(root: Path) -> dict[str, str]:
    path = root / FOOTER_CONTENT_RELATIVE_PATH
    if not path.is_file():
        raise FileNotFoundError(f"Required footer content is missing: {FOOTER_CONTENT_RELATIVE_PATH}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {FOOTER_CONTENT_RELATIVE_PATH}: {exc}") from exc
    return validate_footer_content(payload)


def serialize_footer_content(content: Mapping[str, Any]) -> bytes:
    normalized = validate_footer_content(content)
    return (json.dumps(normalized, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def phone_href(display_value: str) -> str:
    value = str(display_value or "").strip()
    leading_plus = value.startswith("+")
    digits = "".join(character for character in value if character.isdigit())
    if len(digits) < 5:
        raise ValueError(f"Footer phone number is too short: {display_value}")
    if leading_plus:
        return f"+{digits}"
    if digits.startswith("0"):
        return f"+972{digits[1:]}"
    return digits


def gmail_compose_href(email: str, subject: str) -> str:
    return (
        "https://mail.google.com/mail/?view=cm&fs=1"
        f"&to={quote(email, safe='._+-')}"
        f"&su={quote(subject, safe='')}"
    )


def render_footer_template(template: str, content: Mapping[str, Any]) -> str:
    values = validate_footer_content(content)
    escaped = {field: html.escape(value, quote=True) for field, value in values.items()}
    gmail_url = gmail_compose_href(values["email"], values["gmailSubject"])

    replacements = {
        "{{FOOTER_VISIT_TITLE}}": escaped["visitTitle"],
        "{{FOOTER_ADDRESS}}": escaped["address"],
        "{{FOOTER_ADDRESS_FLOOR}}": escaped["addressFloor"],
        "{{FOOTER_VISITING_HOURS}}": escaped["visitingHours"],
        "{{FOOTER_VISIT_NOTE}}": escaped["visitNote"],
        "{{FOOTER_CONTACT_TITLE}}": escaped["contactTitle"],
        "{{FOOTER_MOBILE_LABEL}}": escaped["mobileLabel"],
        "{{FOOTER_MOBILE}}": escaped["mobile"],
        "{{FOOTER_MOBILE_TEL_HREF}}": html.escape(phone_href(values["mobile"]), quote=True),
        "{{FOOTER_PHONE_LABEL}}": escaped["phoneLabel"],
        "{{FOOTER_PHONE}}": escaped["phone"],
        "{{FOOTER_PHONE_TEL_HREF}}": html.escape(phone_href(values["phone"]), quote=True),
        "{{FOOTER_EMAIL_LABEL}}": escaped["emailLabel"],
        "{{FOOTER_EMAIL}}": escaped["email"],
        "{{FOOTER_EMAIL_MAILTO_HREF}}": html.escape(values["email"], quote=True),
        "{{FOOTER_EMAIL_MAILTO_TITLE}}": escaped["emailMailtoTitle"],
        "{{FOOTER_EMAIL_MAILTO_ARIA_LABEL}}": html.escape(
            f"{values['emailMailtoTitle']}: {values['email']}", quote=True
        ),
        "{{FOOTER_RESPONSE_TITLE}}": escaped["responseTitle"],
        "{{FOOTER_RESPONSE_HOURS}}": escaped["responseHours"],
        "{{FOOTER_RESPONSE_NOTE}}": escaped["responseNote"],
        "{{FOOTER_LINKS_TITLE}}": escaped["linksTitle"],
        "{{FOOTER_TERMS_LABEL}}": escaped["termsLabel"],
        "{{FOOTER_PRIVACY_LABEL}}": escaped["privacyLabel"],
        "{{FOOTER_TOP_LABEL}}": escaped["topLabel"],
        "{{FOOTER_BUSINESS_NAME}}": escaped["businessName"],
        "{{FOOTER_REGISTRATION_LABEL}}": escaped["registrationLabel"],
        "{{FOOTER_REGISTRATION_NUMBER}}": escaped["registrationNumber"],
        "{{FOOTER_RIGHTS_TEXT}}": escaped["rightsText"],
        "{{FOOTER_GMAIL_HREF}}": html.escape(gmail_url, quote=True),
        "{{FOOTER_GMAIL_ARIA_LABEL}}": html.escape(
            f"פתיחת הודעה חדשה ב-Gmail אל {values['businessName']}", quote=True
        ),
        "{{FOOTER_GMAIL_TITLE}}": escaped["gmailTitle"],
        "{{FOOTER_BOTTOM_NOTE}}": escaped["bottomNote"],
    }

    rendered = template
    for token, replacement in replacements.items():
        rendered = rendered.replace(token, replacement)

    unresolved = sorted(set(FOOTER_TOKEN_RE.findall(rendered)))
    if unresolved:
        raise ValueError(f"Unresolved footer template tokens: {', '.join(unresolved)}")
    return rendered
