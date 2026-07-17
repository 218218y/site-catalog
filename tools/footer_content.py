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

# Ordered deliberately: the JSON file and the control panel follow this layout.
FOOTER_FIELD_LIMITS: "OrderedDict[str, int]" = OrderedDict(
    (
        ("visitTitle", 120),
        ("address", 240),
        ("addressFloor", 80),
        ("visitingHours", 160),
        ("visitNote", 240),
        ("contactTitle", 120),
        ("mobileLabel", 80),
        ("mobile", 80),
        ("phoneLabel", 80),
        ("phone", 80),
        ("emailLabel", 80),
        ("email", 254),
        ("emailMailtoTitle", 160),
        ("gmailTitle", 160),
        ("gmailSubject", 240),
        ("responseTitle", 120),
        ("responseHours", 160),
        ("responseNote", 240),
        ("linksTitle", 120),
        ("termsLabel", 120),
        ("privacyLabel", 120),
        ("accessibilityLabel", 120),
        ("topLabel", 120),
        ("businessName", 160),
        ("registrationLabel", 80),
        ("registrationNumber", 80),
        ("rightsText", 160),
        ("bottomNote", 240),
    )
)

# The control panel consumes this schema directly. Keeping the field presentation
# next to the validated model prevents the editor from drifting away from the
# actual footer structure when cards or labels change.
_FOOTER_EDITOR_GROUPS: tuple[dict[str, Any], ...] = (
    {
        "id": "visit",
        "title": "כרטיס 1 · כתובת וביקור",
        "description": "מקביל לכרטיס הכתובת והשעות שמופיע ראשון בפוטר.",
        "fields": (
            {"key": "visitTitle", "label": "כותרת הכרטיס"},
            {"key": "address", "label": "כתובת עד לפני מספר הקומה"},
            {
                "key": "addressFloor",
                "label": "מספר הקומה",
                "dir": "ltr",
                "help": "נשמר בנפרד כדי שמספר שלילי יוצג נכון בתוך טקסט עברי.",
            },
            {"key": "visitingHours", "label": "ימי ושעות ביקור"},
            {"key": "visitNote", "label": "הערה מתחת לשעות הביקור"},
        ),
    },
    {
        "id": "contact",
        "title": "כרטיס 2 · יצירת קשר",
        "description": "כל מה שמופיע בכרטיס הקשר, כולל שורת המייל והקישור ל־Gmail.",
        "fields": (
            {"key": "contactTitle", "label": "כותרת הכרטיס"},
            {"key": "mobileLabel", "label": "תווית מספר הנייד"},
            {
                "key": "mobile",
                "label": "מספר נייד",
                "type": "tel",
                "dir": "ltr",
                "help": "קישור החיוג נבנה אוטומטית מהמספר.",
            },
            {"key": "phoneLabel", "label": "תווית מספר הטלפון"},
            {
                "key": "phone",
                "label": "מספר טלפון",
                "type": "tel",
                "dir": "ltr",
                "help": "קישור החיוג נבנה אוטומטית מהמספר.",
            },
            {"key": "emailLabel", "label": "תווית כתובת המייל"},
            {
                "key": "email",
                "label": "כתובת מייל",
                "type": "email",
                "dir": "ltr",
                "help": "מתעדכנת גם בקישור לתוכנת הדואר וגם בקישור ל־Gmail.",
            },
            {
                "key": "emailMailtoTitle",
                "label": "כיתוב צף לכתובת המייל",
                "help": "מופיע בריחוף על כתובת המייל ומסביר שהיא נפתחת בתוכנת הדואר.",
            },
            {
                "key": "gmailTitle",
                "label": "טקסט הקישור ל־Gmail",
                "help": "זהו הטקסט שמופיע מתחת לכתובת המייל בתוך כרטיס יצירת הקשר.",
            },
            {
                "key": "gmailSubject",
                "label": "נושא הודעת Gmail",
                "help": "נכנס לשדה הנושא בחלון Gmail ואינו מוצג כטקסט בפוטר עצמו.",
            },
        ),
    },
    {
        "id": "response",
        "title": "כרטיס 3 · שעות מענה",
        "description": "מקביל לכרטיס שעות המענה וההסבר שמתחתיהן.",
        "fields": (
            {"key": "responseTitle", "label": "כותרת הכרטיס"},
            {"key": "responseHours", "label": "שעות מענה", "dir": "ltr"},
            {"key": "responseNote", "label": "הסבר מתחת לשעות המענה"},
        ),
    },
    {
        "id": "links",
        "title": "כרטיס 4 · מידע שימושי",
        "description": "מקביל לכרטיס הקישורים שמופיע אחרון ברשת הכרטיסים.",
        "fields": (
            {"key": "linksTitle", "label": "כותרת הכרטיס"},
            {"key": "termsLabel", "label": "טקסט קישור תנאי שימוש"},
            {"key": "privacyLabel", "label": "טקסט קישור מדיניות פרטיות"},
            {"key": "accessibilityLabel", "label": "טקסט קישור הצהרת נגישות"},
            {"key": "topLabel", "label": "טקסט הקישור חזרה למעלה"},
        ),
    },
    {
        "id": "bottom",
        "title": "השורה התחתונה",
        "description": "שתי שורות הסיום שמתחת לארבעת הכרטיסים בפוטר.",
        "fields": (
            {"key": "businessName", "label": "שם העסק"},
            {"key": "registrationLabel", "label": "תווית מספר העסק"},
            {"key": "registrationNumber", "label": "מספר העסק", "dir": "ltr"},
            {"key": "rightsText", "label": "טקסט זכויות"},
            {
                "key": "bottomNote",
                "label": "טקסט הסיום",
                "help": "מופיע בשורה הנפרדת בצד השני של השורה התחתונה.",
            },
        ),
    },
)


def footer_editor_schema() -> dict[str, list[dict[str, Any]]]:
    """Return the validated footer-editor structure consumed by the control panel."""

    groups: list[dict[str, Any]] = []
    seen_fields: list[str] = []
    allowed_input_types = {"text", "email", "tel"}

    for group in _FOOTER_EDITOR_GROUPS:
        group_id = str(group.get("id", "")).strip()
        title = str(group.get("title", "")).strip()
        description = str(group.get("description", "")).strip()
        raw_fields = group.get("fields")
        if not group_id or not title or not description or not isinstance(raw_fields, tuple) or not raw_fields:
            raise RuntimeError("Invalid footer editor group definition")

        fields: list[dict[str, Any]] = []
        for raw_field in raw_fields:
            key = str(raw_field.get("key", "")).strip()
            label = str(raw_field.get("label", "")).strip()
            input_type = str(raw_field.get("type", "text")).strip()
            direction = str(raw_field.get("dir", "")).strip()
            help_text = str(raw_field.get("help", "")).strip()
            if key not in FOOTER_FIELD_LIMITS:
                raise RuntimeError(f"Unknown footer editor field: {key}")
            if key in seen_fields:
                raise RuntimeError(f"Duplicate footer editor field: {key}")
            if not label or input_type not in allowed_input_types:
                raise RuntimeError(f"Invalid footer editor metadata for: {key}")
            if direction not in {"", "ltr", "rtl"}:
                raise RuntimeError(f"Invalid footer editor direction for: {key}")

            field = {
                "key": key,
                "label": label,
                "type": input_type,
                "maxLength": FOOTER_FIELD_LIMITS[key],
                "required": True,
            }
            if direction:
                field["dir"] = direction
            if help_text:
                field["help"] = help_text
            fields.append(field)
            seen_fields.append(key)

        groups.append(
            {
                "id": group_id,
                "title": title,
                "description": description,
                "fields": fields,
            }
        )

    expected_order = list(FOOTER_FIELD_LIMITS)
    if set(seen_fields) != set(expected_order):
        missing = [field for field in expected_order if field not in seen_fields]
        raise RuntimeError(f"Footer editor schema is missing fields: {', '.join(missing)}")

    return {"groups": groups}

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
        "{{FOOTER_ACCESSIBILITY_LABEL}}": escaped["accessibilityLabel"],
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
