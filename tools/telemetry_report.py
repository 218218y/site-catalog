#!/usr/bin/env python3
"""Print a privacy-first operational report from Cloudflare Analytics Engine.

Credentials are read from telemetry.env by default. The file is intentionally
ignored by Git and must never be uploaded with the public site.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Sequence

DEFAULT_ENV_FILE = "telemetry.env"
DEFAULT_DATASET = "bargig_catalog_telemetry"
API_URL = "https://api.cloudflare.com/client/v4/accounts/{account_id}/analytics_engine/sql"


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


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
        raise RuntimeError(f"Cloudflare Analytics query failed ({exc.code}): {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not reach Cloudflare Analytics API: {exc.reason}") from exc


def report_query(dataset: str, days: int) -> str:
    interval_days = max(1, min(90, int(days)))
    return f"""
WITH recent AS (
  SELECT
    blob1 AS event_name,
    blob2 AS page_name,
    blob4 AS catalog_id,
    blob5 AS search_query,
    blob7 AS action_name,
    blob9 AS error_code,
    double1 AS value,
    double2 AS duration_ms,
    _sample_interval AS sample_interval
  FROM {dataset}
  WHERE timestamp >= NOW() - INTERVAL '{interval_days}' DAY
)
SELECT 'event' AS section, event_name AS label, SUM(sample_interval) AS count, 0 AS metric
FROM recent GROUP BY event_name
UNION ALL
SELECT 'catalog', catalog_id, SUM(sample_interval), 0
FROM recent WHERE event_name = 'catalog_open' AND catalog_id != '' GROUP BY catalog_id
UNION ALL
SELECT 'search', search_query, SUM(sample_interval),
       SUM(if(value = 0, sample_interval, 0))
FROM recent WHERE event_name = 'search' AND search_query != '' GROUP BY search_query
UNION ALL
SELECT 'contact', action_name, SUM(sample_interval), 0
FROM recent WHERE event_name = 'contact' GROUP BY action_name
UNION ALL
SELECT 'favorite', action_name, SUM(sample_interval), 0
FROM recent WHERE event_name = 'favorite' GROUP BY action_name
UNION ALL
SELECT 'error', if(error_code = '', event_name, error_code), SUM(sample_interval), 0
FROM recent WHERE event_name IN ('js_error', 'image_error') GROUP BY error_code, event_name
ORDER BY section, count DESC
FORMAT JSON
""".strip()


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
    parser.add_argument("--days", type=int, default=7, help="Report window in days (1-90). Default: 7")
    parser.add_argument("--env-file", default=DEFAULT_ENV_FILE, help=f"Credential file. Default: {DEFAULT_ENV_FILE}")
    parser.add_argument("--json", action="store_true", help="Print the raw normalized rows as JSON.")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    days = max(1, min(90, int(args.days)))
    try:
        env_file = (project_root() / args.env_file).resolve(strict=False)
        account_id, api_token, dataset = settings(env_file)
        payload = query_api(account_id, api_token, report_query(dataset, days))
        rows = extract_rows(payload)
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
