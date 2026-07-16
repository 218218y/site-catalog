#!/usr/bin/env python3
"""Print a privacy-first operational report from Cloudflare Analytics Engine.

Credentials are read from telemetry.env by default. The file is intentionally
ignored by Git and must never be uploaded with the public site.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, NamedTuple, Sequence

DEFAULT_ENV_FILE = "telemetry.env"
DEFAULT_DATASET = "bargig_catalog_telemetry"
BIDI_ESCAPE_RE = re.compile(r"#u(?:200e|200f|202a|202b|202c|202d|202e|2066|2067|2068|2069)", re.IGNORECASE)
API_URL = "https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql"


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]



def normalized_env_filename(name: str) -> str:
    """Normalize accidental bidirectional-control prefixes in copied filenames.

    Some Windows/archive tools render invisible direction marks as literal strings
    such as ``#U200f``. Credentials are never renamed automatically, but the report
    can safely discover the intended file and tell the user to fix its name.
    """

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
            "User-Agent": "bargig-catalog-telemetry-report/1.0",
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
    """Build Analytics Engine-compatible report queries.

    Analytics Engine accepts one SELECT statement per SQL API request. Keep each
    report section independent and merge the normalized rows in Python instead
    of relying on UNION/CTE features that are not part of the supported query
    grammar.
    """

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
            "error",
            query(
                "blob1 AS event_name, blob9 AS error_code, "
                "SUM(_sample_interval) AS count",
                "blob1 IN ('js_error', 'image_error')",
                "blob1, blob9",
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
            normalized = normalize_report_row(report_query.section, row)
            merged.append(normalized)
    return merged


def normalize_report_row(section: str, row: dict[str, Any]) -> dict[str, Any]:
    """Normalize one Analytics Engine row into the report's shared schema.

    Analytics Engine only accepts physical column names in ``GROUP BY``. Error
    rows are therefore grouped by ``blob1`` and ``blob9`` in SQL, and the
    user-facing fallback label is derived here instead of inside the query.
    """

    normalized = dict(row)
    normalized["section"] = section
    if section == "error":
        error_code = str(normalized.pop("error_code", "") or "").strip()
        event_name = str(normalized.pop("event_name", "") or "").strip()
        normalized["label"] = error_code or event_name or "unknown_error"
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


def print_report(rows: list[dict[str, Any]], days: int) -> None:
    print(f"Bargig catalog telemetry — last {days} day(s)")
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
        "error": "Runtime/image errors",
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
    parser.add_argument("--json", action="store_true", help="Print the raw normalized rows as JSON.")
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
        else:
            print_report(rows, days)
        return 0
    except Exception as exc:
        print(f"TELEMETRY REPORT FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
