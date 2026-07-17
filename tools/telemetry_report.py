#!/usr/bin/env python3
"""Create privacy-first operational reports from Cloudflare Analytics Engine.

Credentials are read from telemetry.env by default. The file is intentionally
ignored by Git and must never be uploaded with the public site.

The default output is an RTL HTML report plus a UTF-8-BOM CSV file under
reports/telemetry/. This avoids bidirectional text problems in PowerShell and
creates an archive that can be opened later in a browser or spreadsheet.
"""
from __future__ import annotations

import argparse
import csv
import html
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import Any, NamedTuple, Sequence

DEFAULT_ENV_FILE = "telemetry.env"
DEFAULT_DATASET = "bargig_catalog_telemetry"
DEFAULT_OUTPUT_DIR = "reports/telemetry"
BIDI_ESCAPE_RE = re.compile(r"#u(?:200e|200f|202a|202b|202c|202d|202e|2066|2067|2068|2069)", re.IGNORECASE)
API_URL = "https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql"

SECTION_TITLES_HE = {
    "event": "סיכום פעולות",
    "catalog": "קטלוגים שנפתחו",
    "search": "חיפושים",
    "contact": "לחיצות ליצירת קשר",
    "favorite": "פעולות במועדפים",
    "js_error": "שגיאות JavaScript — פירוט לאבחון",
    "image_error": "כשלי טעינת תמונות — פירוט לאבחון",
}

EVENT_LABELS_HE = {
    "catalog_open": "פתיחת קטלוג",
    "search": "חיפוש",
    "favorite": "פעולה במועדפים",
    "contact": "לחיצה ליצירת קשר",
    "js_error": "שגיאת JavaScript",
    "image_error": "כשל בטעינת תמונה",
    "phone": "טלפון",
    "mobile": "נייד",
    "email": "דוא״ל רגיל",
    "gmail": "Gmail",
    "copy": "העתקת פרטי דגם",
    "add": "הוספה",
    "remove": "הסרה",
    "clear": "ניקוי הרשימה",
}


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def normalized_env_filename(name: str) -> str:
    """Normalize accidental bidirectional-control prefixes in copied filenames."""

    without_escaped_marks = BIDI_ESCAPE_RE.sub("", str(name))
    return "".join(
        character
        for character in without_escaped_marks
        if unicodedata.category(character) != "Cf"
    )


def resolve_env_file(path: Path) -> tuple[Path, bool]:
    """Return the requested credential file or one unambiguously misnamed copy."""

    if path.is_file():
        return path, False
    if path.name.casefold() != DEFAULT_ENV_FILE.casefold() or not path.parent.is_dir():
        return path, False

    candidates = [
        candidate
        for candidate in path.parent.iterdir()
        if candidate.is_file()
        and normalized_env_filename(candidate.name).casefold() == DEFAULT_ENV_FILE.casefold()
    ]
    if len(candidates) == 1:
        return candidates[0], True
    if len(candidates) > 1:
        raise ValueError(
            "Found multiple files that look like telemetry.env after removing hidden "
            "direction marks. Keep one credential file and name it exactly telemetry.env."
        )
    return path, False


def load_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values
    for raw_line in path.read_text(encoding="utf-8-sig").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def settings(env_file: Path) -> tuple[str, str, str]:
    file_values = load_env_file(env_file)
    account_id = os.getenv("CLOUDFLARE_ACCOUNT_ID") or file_values.get("CLOUDFLARE_ACCOUNT_ID", "")
    api_token = os.getenv("CLOUDFLARE_API_TOKEN") or file_values.get("CLOUDFLARE_API_TOKEN", "")
    dataset = (
        os.getenv("BARGIG_TELEMETRY_DATASET")
        or file_values.get("BARGIG_TELEMETRY_DATASET", "")
        or DEFAULT_DATASET
    )
    missing = [
        name
        for name, value in (
            ("CLOUDFLARE_ACCOUNT_ID", account_id),
            ("CLOUDFLARE_API_TOKEN", api_token),
        )
        if not value
    ]
    if missing:
        raise ValueError(
            f"Missing {', '.join(missing)}. Copy telemetry.env.example to telemetry.env "
            "and fill in a read-only Analytics token."
        )
    if not dataset.replace("_", "").isalnum():
        raise ValueError("BARGIG_TELEMETRY_DATASET contains unsupported characters.")
    return account_id, api_token, dataset


def query_api(account_id: str, api_token: str, query: str) -> dict[str, Any]:
    request = urllib.request.Request(
        API_URL.format(account_id=account_id),
        data=query.encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "text/plain; charset=utf-8",
            "Accept": "application/json",
            "User-Agent": "bargig-catalog-telemetry-report/1.2",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        if exc.code in (401, 403):
            raise RuntimeError(
                f"Cloudflare rejected the report credentials ({exc.code}). Verify that the "
                "Account ID matches the token scope and that the token has "
                "Account > Account Analytics > Read permission. "
                f"Cloudflare response: {detail}"
            ) from exc
        raise RuntimeError(f"Cloudflare Analytics query failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach Cloudflare Analytics API: {exc.reason}") from exc


class ReportQuery(NamedTuple):
    section: str
    sql: str


def report_queries(dataset: str, days: int) -> tuple[ReportQuery, ...]:
    """Build Analytics Engine-compatible report queries."""

    interval_days = max(1, min(90, int(days)))
    since = f"timestamp >= NOW() - INTERVAL '{interval_days}' DAY"

    def query(select: str, where: str, group_by: str, limit: int = 100) -> str:
        return (
            f"SELECT {select}\n"
            f"FROM {dataset}\n"
            f"WHERE {since} AND {where}\n"
            f"GROUP BY {group_by}\n"
            "ORDER BY count DESC\n"
            f"LIMIT {limit}\n"
            "FORMAT JSON"
        )

    return (
        ReportQuery(
            "event",
            query(
                "blob1 AS label, SUM(_sample_interval) AS count",
                "blob1 IN ('catalog_open', 'search', 'favorite', 'contact', 'js_error', 'image_error')",
                "blob1",
                20,
            ),
        ),
        ReportQuery(
            "catalog",
            query(
                "blob4 AS label, SUM(_sample_interval) AS count",
                "blob1 = 'catalog_open' AND blob4 != ''",
                "blob4",
            ),
        ),
        ReportQuery(
            "search",
            query(
                "blob5 AS label, SUM(_sample_interval) AS count, "
                "sumIf(_sample_interval, double1 = 0) AS metric",
                "blob1 = 'search' AND blob5 != ''",
                "blob5",
            ),
        ),
        ReportQuery(
            "contact",
            query(
                "blob7 AS label, SUM(_sample_interval) AS count",
                "blob1 = 'contact' AND blob7 != ''",
                "blob7",
            ),
        ),
        ReportQuery(
            "favorite",
            query(
                "blob7 AS label, SUM(_sample_interval) AS count",
                "blob1 = 'favorite' AND blob7 != ''",
                "blob7",
            ),
        ),
        ReportQuery(
            "js_error",
            query(
                "blob9 AS fingerprint, blob7 AS error_name, blob8 AS message, "
                "blob11 AS source, blob6 AS source_scope, blob2 AS app_page, "
                "blob3 AS path, blob4 AS catalog_id, double3 AS line, "
                "double4 AS column, SUM(_sample_interval) AS count",
                "blob1 = 'js_error'",
                "blob9, blob7, blob8, blob11, blob6, blob2, blob3, blob4, double3, double4",
                200,
            ),
        ),
        ReportQuery(
            "image_error",
            query(
                "blob9 AS fingerprint, blob4 AS catalog_id, double3 AS page_number, "
                "blob8 AS failure_stage, blob11 AS source, blob10 AS viewport, "
                "blob2 AS app_page, blob3 AS path, SUM(_sample_interval) AS count",
                "blob1 = 'image_error'",
                "blob9, blob4, double3, blob8, blob11, blob10, blob2, blob3",
                200,
            ),
        ),
    )


def fetch_report_rows(
    account_id: str,
    api_token: str,
    dataset: str,
    days: int,
) -> list[dict[str, Any]]:
    """Execute supported single-SELECT queries and merge their rows."""

    merged: list[dict[str, Any]] = []
    for report_query in report_queries(dataset, days):
        try:
            payload = query_api(account_id, api_token, report_query.sql)
            section_rows = extract_rows(payload)
        except Exception as exc:
            raise RuntimeError(
                f"Cloudflare query for report section '{report_query.section}' failed: {exc}"
            ) from exc

        for row in section_rows:
            merged.append(normalize_report_row(report_query.section, row))
    return merged


def normalize_report_row(section: str, row: dict[str, Any]) -> dict[str, Any]:
    """Normalize one Analytics Engine row while preserving diagnostic fields."""

    normalized = dict(row)
    normalized["section"] = section
    if section == "js_error":
        normalized["label"] = str(normalized.get("fingerprint") or normalized.get("error_name") or "unknown_js_error")
    elif section == "image_error":
        normalized["label"] = str(normalized.get("fingerprint") or normalized.get("source") or "unknown_image_error")
    else:
        normalized.setdefault("label", "")
    normalized.setdefault("count", 0)
    normalized.setdefault("metric", 0)
    return normalized

def extract_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    if isinstance(payload.get("data"), list):
        return [row for row in payload["data"] if isinstance(row, dict)]
    result = payload.get("result")
    if isinstance(result, dict) and isinstance(result.get("data"), list):
        return [row for row in result["data"] if isinstance(row, dict)]
    if isinstance(result, list):
        return [row for row in result if isinstance(row, dict)]
    raise RuntimeError(f"Unexpected Cloudflare Analytics response: {json.dumps(payload, ensure_ascii=False)[:500]}")


def load_catalog_titles(root: Path | None = None) -> dict[str, str]:
    path = (root or project_root()) / "catalogs.generated.json"
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(payload, list):
        return {}
    return {
        str(item.get("id") or "").strip(): str(item.get("title") or item.get("id") or "").strip()
        for item in payload
        if isinstance(item, dict) and str(item.get("id") or "").strip()
    }


def localized_label(section: str, label: Any, catalog_titles: dict[str, str]) -> str:
    raw = str(label or "").strip() or "(ריק)"
    if section == "catalog":
        return catalog_titles.get(raw, raw)
    return EVENT_LABELS_HE.get(raw, raw)


def numeric_value(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def format_count(value: Any) -> str:
    number = numeric_value(value)
    if number.is_integer():
        return f"{int(number):,}"
    return f"{number:,.2f}".rstrip("0").rstrip(".")


def rows_by_section(rows: list[dict[str, Any]]) -> dict[str, list[dict[str, Any]]]:
    grouped = {key: [] for key in SECTION_TITLES_HE}
    for row in rows:
        section = str(row.get("section") or "")
        grouped.setdefault(section, []).append(row)
    return grouped


def report_stamp(now: datetime | None = None) -> str:
    current = now or datetime.now().astimezone()
    return current.strftime("%Y-%m-%d_%H-%M-%S")


def resolve_output_dir(value: str | Path) -> Path:
    path = Path(value)
    if not path.is_absolute():
        path = project_root() / path
    path.mkdir(parents=True, exist_ok=True)
    return path.resolve()


def report_paths(output_dir: Path, stamp: str, formats: Sequence[str]) -> dict[str, Path]:
    return {
        report_format: output_dir / f"telemetry-report-{stamp}.{report_format}"
        for report_format in formats
    }


def write_csv_report(
    rows: list[dict[str, Any]],
    days: int,
    output_path: Path,
    catalog_titles: dict[str, str],
    generated_at: datetime,
) -> None:
    """Write an Excel-friendly CSV that keeps all diagnostic dimensions."""

    columns = [
        "סוג נתון", "פריט / טביעה", "כמות", "מדד נוסף", "סוג שגיאה", "הודעה",
        "קובץ", "מקור", "עמוד באתר", "נתיב", "קטלוג", "עמוד בקטלוג",
        "שורה", "עמודה", "שלב כשל", "גודל מסך",
    ]
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["דוח פעילות אתר רהיטי ברגיג"])
        writer.writerow(["טווח", f"{days} ימים אחרונים"])
        writer.writerow(["נוצר", generated_at.strftime("%d/%m/%Y %H:%M:%S %z")])
        writer.writerow([])
        writer.writerow(columns)
        for row in rows:
            section = str(row.get("section") or "")
            catalog_id = str(row.get("catalog_id") or "")
            writer.writerow([
                SECTION_TITLES_HE.get(section, section),
                localized_label(section, row.get("label"), catalog_titles),
                format_count(row.get("count")),
                format_count(row.get("metric")) if numeric_value(row.get("metric")) else "",
                row.get("error_name", ""),
                row.get("message", ""),
                row.get("source", ""),
                row.get("source_scope", ""),
                row.get("app_page", ""),
                row.get("path", ""),
                catalog_titles.get(catalog_id, catalog_id),
                row.get("page_number", ""),
                row.get("line", ""),
                row.get("column", ""),
                row.get("failure_stage", ""),
                row.get("viewport", ""),
            ])

def write_json_report(
    rows: list[dict[str, Any]],
    days: int,
    output_path: Path,
    generated_at: datetime,
) -> None:
    payload = {
        "generatedAt": generated_at.isoformat(),
        "days": days,
        "rows": rows,
    }
    output_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_html_report(
    rows: list[dict[str, Any]],
    days: int,
    output_path: Path,
    catalog_titles: dict[str, str],
    generated_at: datetime,
) -> None:
    grouped = rows_by_section(rows)
    event_counts = {
        str(row.get("label") or ""): numeric_value(row.get("count"))
        for row in grouped.get("event", [])
    }

    def card(label: str, value: Any, note: str = "") -> str:
        return (
            '<article class="summary-card">'
            f'<span class="summary-label">{html.escape(label)}</span>'
            f'<strong>{html.escape(format_count(value))}</strong>'
            f'<small>{html.escape(note)}</small>'
            "</article>"
        )

    summary_cards = "".join([
        card("פתיחות קטלוג", event_counts.get("catalog_open", 0), "עניין בקטלוגים"),
        card("חיפושים", event_counts.get("search", 0), "חיפושים שהושלמו באתר"),
        card("פעולות במועדפים", event_counts.get("favorite", 0), "הוספה, הסרה וניקוי"),
        card("פעולות ליצירת קשר", event_counts.get("contact", 0), "טלפון, דוא״ל והעתקת פרטים"),
        card(
            "שגיאות שנקלטו",
            event_counts.get("js_error", 0) + event_counts.get("image_error", 0),
            "JavaScript ותמונות",
        ),
    ])

    def empty_section(title: str) -> str:
        return (
            f'<section class="report-section"><h2>{html.escape(title)}</h2>'
            '<div class="empty">לא התקבלו נתונים בחלק זה בתקופה שנבחרה.</div></section>'
        )

    def section_table(section: str, section_rows: list[dict[str, Any]]) -> str:
        title = SECTION_TITLES_HE.get(section, section)
        if not section_rows:
            return empty_section(title)
        table_rows = []
        for row in section_rows:
            label = localized_label(section, row.get("label"), catalog_titles)
            count = format_count(row.get("count"))
            metric = format_count(row.get("metric")) if numeric_value(row.get("metric")) else "—"
            metric_cell = f'<td class="number">{html.escape(metric)}</td>' if section == "search" else ""
            table_rows.append(
                "<tr>"
                f'<td>{html.escape(label)}</td>'
                f'<td class="number">{html.escape(count)}</td>'
                f"{metric_cell}"
                "</tr>"
            )
        metric_header = "<th>חיפושים ללא תוצאה</th>" if section == "search" else ""
        body = (
            '<div class="table-wrap"><table><thead><tr>'
            "<th>פריט</th><th>כמות</th>"
            f"{metric_header}</tr></thead><tbody>{''.join(table_rows)}</tbody></table></div>"
        )
        return f'<section class="report-section"><h2>{html.escape(title)}</h2>{body}</section>'

    def js_error_table(section_rows: list[dict[str, Any]]) -> str:
        title = SECTION_TITLES_HE["js_error"]
        if not section_rows:
            return empty_section(title)
        rows_html = []
        for row in section_rows:
            catalog_id = str(row.get("catalog_id") or "")
            catalog_title = catalog_titles.get(catalog_id, catalog_id) or "—"
            location = ":".join(
                value for value in (str(row.get("line") or ""), str(row.get("column") or "")) if value
            ) or "—"
            rows_html.append(
                "<tr>"
                f'<td class="number"><code>{html.escape(str(row.get("fingerprint") or "—"))}</code></td>'
                f'<td>{html.escape(str(row.get("error_name") or "—"))}</td>'
                f'<td class="message">{html.escape(str(row.get("message") or "—"))}</td>'
                f'<td><code>{html.escape(str(row.get("source") or "—"))}</code></td>'
                f'<td>{html.escape(str(row.get("source_scope") or "—"))}</td>'
                f'<td class="number">{html.escape(location)}</td>'
                f'<td>{html.escape(str(row.get("app_page") or "—"))}<br><small>{html.escape(str(row.get("path") or ""))}</small></td>'
                f'<td>{html.escape(catalog_title)}</td>'
                f'<td class="number strong">{html.escape(format_count(row.get("count")))}</td>'
                "</tr>"
            )
        top = max(section_rows, key=lambda row: numeric_value(row.get("count")))
        callout = (
            '<div class="diagnostic-callout">'
            '<strong>הקבוצה החוזרת ביותר:</strong> '
            f'<code>{html.escape(str(top.get("fingerprint") or "ללא טביעה"))}</code> · '
            f'{html.escape(format_count(top.get("count")))} מופעים · '
            f'{html.escape(str(top.get("error_name") or "שגיאה"))}: '
            f'{html.escape(str(top.get("message") or "ללא הודעה היסטורית"))}'
            '</div>'
        )
        table = (
            '<div class="table-wrap diagnostic-table"><table><thead><tr>'
            '<th>טביעה</th><th>סוג</th><th>הודעה</th><th>קובץ</th><th>מקור</th>'
            '<th>שורה:עמודה</th><th>עמוד באתר</th><th>קטלוג</th><th>כמות</th>'
            f'</tr></thead><tbody>{"".join(rows_html)}</tbody></table></div>'
        )
        return f'<section class="report-section"><h2>{html.escape(title)}</h2>{callout}{table}</section>'

    def image_error_table(section_rows: list[dict[str, Any]]) -> str:
        title = SECTION_TITLES_HE["image_error"]
        if not section_rows:
            return empty_section(title)
        rows_html = []
        for row in section_rows:
            catalog_id = str(row.get("catalog_id") or "")
            catalog_title = catalog_titles.get(catalog_id, catalog_id) or "—"
            rows_html.append(
                "<tr>"
                f'<td class="number"><code>{html.escape(str(row.get("fingerprint") or "היסטורי — ללא טביעה"))}</code></td>'
                f'<td>{html.escape(catalog_title)}</td>'
                f'<td class="number">{html.escape(format_count(row.get("page_number"))) if numeric_value(row.get("page_number")) else "—"}</td>'
                f'<td>{html.escape(str(row.get("failure_stage") or "—"))}</td>'
                f'<td><code>{html.escape(str(row.get("source") or "—"))}</code></td>'
                f'<td>{html.escape(str(row.get("viewport") or "—"))}</td>'
                f'<td>{html.escape(str(row.get("app_page") or "—"))}<br><small>{html.escape(str(row.get("path") or ""))}</small></td>'
                f'<td class="number strong">{html.escape(format_count(row.get("count")))}</td>'
                "</tr>"
            )
        table = (
            '<div class="table-wrap diagnostic-table"><table><thead><tr>'
            '<th>טביעה</th><th>קטלוג</th><th>עמוד</th><th>שלב הכשל</th>'
            '<th>קובץ</th><th>מסך</th><th>עמוד באתר</th><th>כמות</th>'
            f'</tr></thead><tbody>{"".join(rows_html)}</tbody></table></div>'
        )
        return f'<section class="report-section"><h2>{html.escape(title)}</h2>{table}</section>'

    sections_html = "".join([
        *(section_table(section, grouped.get(section, [])) for section in ("catalog", "search", "contact", "favorite")),
        js_error_table(grouped.get("js_error", [])),
        image_error_table(grouped.get("image_error", [])),
    ])
    generated_text = generated_at.strftime("%d/%m/%Y בשעה %H:%M")

    document = f"""<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>דוח פעילות אתר רהיטי ברגיג</title>
  <style>
    :root {{ color-scheme: light; --ink:#172033; --muted:#667085; --line:#d9e0ea; --panel:#fff; --soft:#f4f7fb; --accent:#335f93; }}
    * {{ box-sizing:border-box; }}
    body {{ margin:0; background:#edf2f7; color:var(--ink); font-family:Arial,"Segoe UI",sans-serif; line-height:1.55; }}
    main {{ width:min(1120px,calc(100% - 32px)); margin:32px auto; }}
    .hero {{ background:linear-gradient(135deg,#173a63,#315f93); color:#fff; border-radius:22px; padding:28px 30px; box-shadow:0 18px 45px rgba(28,57,91,.18); }}
    .hero h1 {{ margin:0 0 6px; font-size:clamp(1.55rem,3vw,2.35rem); }}
    .hero p {{ margin:0; opacity:.88; }}
    .summary {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(175px,1fr)); gap:14px; margin:18px 0; }}
    .summary-card,.report-section {{ background:var(--panel); border:1px solid var(--line); border-radius:18px; box-shadow:0 10px 28px rgba(35,55,78,.08); }}
    .summary-card {{ padding:18px; min-height:126px; display:flex; flex-direction:column; justify-content:center; }}
    .summary-label {{ color:var(--muted); font-weight:700; }}
    .summary-card strong {{ font-size:2rem; line-height:1.2; margin:4px 0; direction:ltr; text-align:right; }}
    .summary-card small {{ color:var(--muted); }}
    .report-section {{ margin:16px 0; padding:20px; }}
    .report-section h2 {{ margin:0 0 14px; font-size:1.15rem; }}
    .table-wrap {{ overflow:auto; border:1px solid var(--line); border-radius:13px; }}
    table {{ width:100%; border-collapse:collapse; background:#fff; }}
    th,td {{ padding:11px 13px; text-align:right; border-bottom:1px solid #e8edf3; vertical-align:middle; }}
    th {{ background:var(--soft); color:#344054; font-size:.9rem; white-space:nowrap; }}
    tbody tr:last-child td {{ border-bottom:0; }}
    tbody tr:hover {{ background:#f8fbff; }}
    .number {{ direction:ltr; text-align:left; font-variant-numeric:tabular-nums; white-space:nowrap; }}
    .strong {{ font-weight:900; }}
    code {{ direction:ltr; unicode-bidi:embed; font-family:Consolas,"Courier New",monospace; font-size:.9em; }}
    td.message {{ min-width:260px; max-width:480px; overflow-wrap:anywhere; }}
    td small {{ color:var(--muted); direction:ltr; unicode-bidi:embed; }}
    .diagnostic-table table {{ min-width:980px; }}
    .diagnostic-callout {{ margin:0 0 14px; padding:13px 15px; border:1px solid #b8c8db; border-radius:13px; background:#eef5fd; overflow-wrap:anywhere; }}
    .empty {{ color:var(--muted); background:var(--soft); border-radius:12px; padding:16px; }}
    footer {{ color:var(--muted); text-align:center; padding:18px 0 5px; font-size:.9rem; }}
    @media print {{ body {{ background:#fff; }} main {{ width:100%; margin:0; }} .hero,.summary-card,.report-section {{ box-shadow:none; }} }}
  </style>
</head>
<body>
  <main>
    <header class="hero">
      <h1>דוח פעילות אתר רהיטי ברגיג</h1>
      <p>{days} הימים האחרונים · נוצר {html.escape(generated_text)}</p>
    </header>
    <section class="summary" aria-label="סיכום">{summary_cards}</section>
    {sections_html}
    <footer>הדוח מכיל נתונים מצטברים בלבד ואינו כולל מזהה משתמש קבוע.</footer>
  </main>
</body>
</html>
"""
    output_path.write_text(document, encoding="utf-8")


def create_report_files(
    rows: list[dict[str, Any]],
    days: int,
    output_dir: Path,
    formats: Sequence[str],
    *,
    generated_at: datetime | None = None,
    catalog_titles: dict[str, str] | None = None,
) -> dict[str, Path]:
    current = generated_at or datetime.now().astimezone()
    unique_formats = tuple(dict.fromkeys(formats))
    invalid = sorted(set(unique_formats) - {"html", "csv", "json"})
    if invalid:
        raise ValueError(f"Unsupported report format(s): {', '.join(invalid)}")
    paths = report_paths(output_dir, report_stamp(current), unique_formats)
    titles = catalog_titles if catalog_titles is not None else load_catalog_titles()
    for report_format, path in paths.items():
        if report_format == "html":
            write_html_report(rows, days, path, titles, current)
        elif report_format == "csv":
            write_csv_report(rows, days, path, titles, current)
        else:
            write_json_report(rows, days, path, current)
    return paths


def open_report(path: Path) -> bool:
    try:
        if os.name == "nt":
            os.startfile(str(path))  # type: ignore[attr-defined]
            return True
        return bool(webbrowser.open(path.as_uri()))
    except (OSError, webbrowser.Error):
        return False


def print_report(rows: list[dict[str, Any]], days: int) -> None:
    """Legacy plain-text console report. Prefer the RTL HTML export."""

    print(f"Bargig catalog telemetry - last {days} day(s)")
    print("=" * 54)
    if not rows:
        print("No telemetry events were returned for this period.")
        return

    section_titles = {
        "event": "Event totals",
        "catalog": "Catalogs opened",
        "search": "Searches (metric = no-result count)",
        "contact": "Contact clicks",
        "favorite": "Favorite actions",
        "js_error": "JavaScript errors",
        "image_error": "Image loading errors",
    }
    current = None
    for row in rows:
        section = str(row.get("section", "other"))
        if section != current:
            current = section
            print(f"\n{section_titles.get(section, section.title())}")
            print("-" * 54)
        label = str(row.get("label") or "(empty)")
        count = row.get("count", 0)
        metric = row.get("metric", 0)
        suffix = f" | metric: {metric}" if metric not in (0, 0.0, "0", None) else ""
        print(f"{label[:34]:34} {str(count):>8}{suffix}")


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "days_value",
        nargs="?",
        type=int,
        help="Optional report window in days. Useful with npm: npm run telemetry:report -- 30",
    )
    parser.add_argument(
        "--days",
        dest="days_option",
        type=int,
        help="Report window in days (1-90). Direct Python usage may use --days 30.",
    )
    parser.add_argument("--env-file", default=DEFAULT_ENV_FILE, help=f"Credential file. Default: {DEFAULT_ENV_FILE}")
    parser.add_argument(
        "--output-dir",
        default=DEFAULT_OUTPUT_DIR,
        help=f"Directory for generated reports. Default: {DEFAULT_OUTPUT_DIR}",
    )
    parser.add_argument(
        "--format",
        dest="formats",
        action="append",
        choices=("html", "csv", "json"),
        help="Output format. Repeat for multiple formats. Default: HTML and CSV.",
    )
    parser.add_argument("--open", action="store_true", help="Open the generated HTML report after writing it.")
    parser.add_argument("--console", action="store_true", help="Also print the legacy plain-text report.")
    parser.add_argument("--json", action="store_true", help="Legacy mode: print normalized rows as JSON to stdout.")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    requested_days = args.days_option if args.days_option is not None else args.days_value
    days = max(1, min(90, int(requested_days if requested_days is not None else 7)))
    try:
        requested_env_file = Path(args.env_file)
        if not requested_env_file.is_absolute():
            requested_env_file = project_root() / requested_env_file
        env_file, used_compatibility_name = resolve_env_file(requested_env_file.resolve(strict=False))
        if used_compatibility_name:
            print(
                "NOTICE: found the credential file under a name with hidden/escaped "
                "direction marks. It is being used now; rename it to telemetry.env.",
                file=sys.stderr,
            )
        account_id, api_token, dataset = settings(env_file)
        rows = fetch_report_rows(account_id, api_token, dataset, days)
        if args.json:
            print(json.dumps(rows, ensure_ascii=False, indent=2))
            return 0

        formats = tuple(args.formats or ("html", "csv"))
        output_dir = resolve_output_dir(args.output_dir)
        paths = create_report_files(rows, days, output_dir, formats)

        if args.console:
            print_report(rows, days)
        print(f"Telemetry report created for the last {days} day(s):")
        for report_format, path in paths.items():
            print(f"  {report_format.upper()}: {path}")

        html_path = paths.get("html")
        if args.open and html_path and not open_report(html_path):
            print("NOTICE: the HTML report was created but could not be opened automatically.", file=sys.stderr)
        return 0
    except Exception as exc:
        print(f"TELEMETRY REPORT FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
