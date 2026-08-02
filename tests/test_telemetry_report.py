from __future__ import annotations

import importlib.util
import json
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("telemetry_report", ROOT / "tools" / "telemetry_report.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_report_queries_are_single_select_aggregate_and_bounded() -> None:
    queries = MODULE.report_queries("bargig_catalog_telemetry", 200)
    assert [item.section for item in queries] == [
        "event", "previous_event", "session_cohort", "release", "catalog", "search",
        "contact", "favorite", "rum", "rum_cohort", "reliability", "js_error",
        "js_error_legacy", "resource_summary", "resource_error", "search_index_error",
        "image_outcome", "image_attempt", "image_recovered", "image_terminal", "image_legacy",
    ]

    for item in queries:
        query = item.sql
        assert query.startswith("SELECT ")
        assert query.count("SELECT ") == 1
        assert "INTERVAL '90' DAY" in query
        assert "FROM bargig_catalog_telemetry" in query
        assert "_sample_interval" in query
        assert query.endswith("FORMAT JSON")
        assert "UNION" not in query
        assert "WITH recent" not in query
        assert "page_load" not in query
        assert "first_catalog_image" not in query
        assert "user_agent" not in query.lower()

    event_query = next(item.sql for item in queries if item.section == "event")
    assert "'app_session'" in event_query
    assert "sumIf(_sample_interval, blob1 != 'js_error' OR blob13 != '') AS count" in event_query
    session_query = next(item.sql for item in queries if item.section == "session_cohort")
    assert "blob1 = 'app_session'" in session_query
    assert "blob13 AS release_id" in session_query
    assert "blob3 AS route" in session_query
    release_query = next(item.sql for item in queries if item.section == "release")
    assert "blob13 AS release_id" in release_query
    assert "MIN(timestamp) AS first_seen" in release_query
    rum_query = next(item.sql for item in queries if item.section == "rum")
    assert "quantileExactWeighted(0.75)(double1, _sample_interval) AS metric" in rum_query
    assert "sumIf(_sample_interval" in rum_query
    rum_cohort = next(item.sql for item in queries if item.section == "rum_cohort")
    assert "blob14 AS component" in rum_cohort
    assert "blob13 AS release_id" in rum_cohort
    reliability = next(item.sql for item in queries if item.section == "reliability")
    assert "image_terminal_failure" in reliability
    image_outcome = next(item.sql for item in queries if item.section == "image_outcome")
    assert "blob15 AS surface" in image_outcome
    assert "blob17 AS visibility" in image_outcome
    image_detail = next(item.sql for item in queries if item.section == "image_terminal")
    assert "blob16 AS request_id" in image_detail
    previous_query = next(item.sql for item in queries if item.section == "previous_event")
    assert "timestamp < NOW() - INTERVAL '90' DAY" in previous_query


def test_diagnostic_rows_keep_error_and_image_context() -> None:
    js_row = MODULE.normalize_report_row(
        "js_error",
        {"fingerprint": "ef21e4fae", "error_name": "TypeError", "message": "boom", "count": 3},
    )
    image_row = MODULE.normalize_report_row(
        "image_terminal",
        {"fingerprint": "", "source": "page-004.webp", "route": "/viewer.html", "request_id": "ir-a1234567", "count": 2},
    )
    assert js_row["label"] == "ef21e4fae"
    assert js_row["message"] == "boom"
    assert image_row["label"] == "page-004.webp"
    assert image_row["path"] == "/viewer.html"
    assert image_row["request_id"] == "ir-a1234567"


def test_resource_diagnostics_canonicalize_cloudflare_beacon_version_paths() -> None:
    row = MODULE.normalize_report_row(
        "resource_summary",
        {
            "source_scope": "external", "resource_tag": "script", "resource_role": "script",
            "source": "v4513226cdae34746b4dedf0b4dfa099e1781791509496", "count": 392,
        },
    )
    assert row["source"] == "beacon.min.js"
    assert row["source_scope"] == "cloudflare-observability"
    assert row["label"] == "cloudflare-observability"


def test_enrich_report_rows_uses_real_session_denominators_and_release_statuses() -> None:
    rows = [
        {"section": "event", "label": "app_session", "count": 100},
        {"section": "session_cohort", "release_id": "deploy-0123456789abcdef", "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "count": 40},
        {"section": "session_cohort", "release_id": "app-12345678", "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "count": 10},
        {"section": "release", "release_id": "deploy-0123456789abcdef", "count": 80, "first_seen": "2026-08-01", "last_seen": "2026-08-02"},
        {"section": "release", "release_id": "deploy-fedcba9876543210", "count": 10},
        {"section": "release", "release_id": "app-12345678", "count": 10},
        {"section": "rum_cohort", "label": "CLS", "release_id": "deploy-0123456789abcdef", "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "component": "viewer-stage", "metric": 0.21, "count": 20, "good_count": 10, "poor_count": 5},
        {"section": "reliability", "label": "image_terminal_failure", "release_id": "deploy-0123456789abcdef", "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "count": 2},
        {"section": "image_outcome", "label": "image_recovered", "release_id": "deploy-0123456789abcdef", "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "catalog_id": "kids", "page_number": 1, "surface": "viewer-stage", "visibility": "visible", "count": 8},
        {"section": "image_outcome", "label": "image_terminal_failure", "release_id": "deploy-0123456789abcdef", "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "catalog_id": "kids", "page_number": 1, "surface": "viewer-stage", "visibility": "visible", "count": 2},
    ]
    enriched, current = MODULE.enrich_report_rows(rows, "deploy-0123456789abcdef")
    assert current == "deploy-0123456789abcdef"
    release_by_id = {row["release_id"]: row for row in enriched if row["section"] == "release"}
    assert release_by_id["deploy-0123456789abcdef"]["release_status"] == "current"
    assert release_by_id["deploy-fedcba9876543210"]["release_status"] == "historical"
    assert release_by_id["app-12345678"]["release_status"] == "fallback"
    assert release_by_id["deploy-0123456789abcdef"]["share_percent"] == pytest.approx(80)
    cls = next(row for row in enriched if row["section"] == "rum_cohort")
    assert cls["denominator"] == 40
    assert cls["coverage_percent"] == pytest.approx(50)
    assert cls["good_percent"] == pytest.approx(50)
    assert cls["poor_percent"] == pytest.approx(25)
    reliability = next(row for row in enriched if row["section"] == "reliability")
    assert reliability["rate_per_1000"] == pytest.approx(50)
    terminal = next(row for row in enriched if row["section"] == "image_outcome" and row["label"] == "image_terminal_failure")
    assert terminal["denominator"] == 10
    assert terminal["outcome_percent"] == pytest.approx(20)
    assert terminal["rate_per_1000"] == pytest.approx(50)


def test_enrichment_does_not_guess_current_release() -> None:
    rows = [
        {"section": "release", "release_id": "deploy-0123456789abcdef", "count": 10, "first_seen": "2026-08-02"},
        {"section": "release", "release_id": "deploy-fedcba9876543210", "count": 5, "first_seen": "2026-08-03"},
    ]
    enriched, current = MODULE.enrich_report_rows(rows)
    assert current == ""
    assert all(row["release_status"] == "historical" for row in enriched)


def test_fetch_report_rows_executes_all_sections_and_enriches(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    def fake_query_api(account_id: str, token: str, query: str) -> dict[str, object]:
        assert account_id == "account" and token == "token"
        calls.append(query)
        if "blob1 AS label" in query and "blob1 IN" in query and "timestamp <" not in query:
            return {"data": [{"label": "app_session", "count": 4}, {"label": "catalog_open", "count": 2}]}
        if "blob1 = 'app_session'" in query and "blob2 AS app_page" in query:
            return {"data": [{"release_id": "deploy-0123456789abcdef", "app_page": "catalog", "route": "/catalog.html", "viewport": "xs", "count": 4}]}
        if "blob1 = 'app_session'" in query:
            return {"data": [{"release_id": "deploy-0123456789abcdef", "count": 4, "first_seen": "2026-08-01", "last_seen": "2026-08-02"}]}
        if "blob4 AS label" in query:
            return {"data": [{"label": "opening-test", "count": 2}]}
        if "blob14 AS component" in query:
            return {"data": [{"label": "CLS", "release_id": "deploy-0123456789abcdef", "app_page": "catalog", "route": "/catalog.html", "viewport": "xs", "component": "catalog-grid", "metric": 0.2, "count": 2, "good_count": 1, "poor_count": 0}]}
        return {"data": []}

    monkeypatch.setattr(MODULE, "query_api", fake_query_api)
    rows = MODULE.fetch_report_rows(
        "account", "token", "dataset", 30, current_release_id="deploy-0123456789abcdef"
    )
    assert len(calls) == 21
    assert all("UNION" not in query for query in calls)
    catalog = next(row for row in rows if row["section"] == "catalog")
    assert catalog["label"] == "opening-test"
    cls = next(row for row in rows if row["section"] == "rum_cohort")
    assert cls["denominator"] == 4
    assert cls["component"] == "catalog-grid"
    assert cls["release_status"] == "current"
    assert {row["label"] for row in rows if row["section"] == "trend"} >= {"app_session", "catalog_open"}


def test_fetch_report_rows_names_the_failed_section(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_query_api(_account_id: str, _token: str, query: str) -> dict[str, object]:
        if "blob5 AS label" in query:
            raise RuntimeError("invalid query")
        return {"data": []}

    monkeypatch.setattr(MODULE, "query_api", fake_query_api)
    with pytest.raises(RuntimeError, match="section 'search'.*invalid query"):
        MODULE.fetch_report_rows("account", "token", "dataset", 7)


def test_rum_summary_uses_weighted_p75_and_quality_percentages() -> None:
    rows = MODULE.summarize_rum_rows([
        {"label": "LCP", "metric_value": 1200, "weight": 3},
        {"label": "LCP", "metric_value": 2800, "weight": 1},
        {"label": "LCP", "metric_value": 4800, "weight": 1},
        {"label": "CLS", "metric_value": 0.05, "weight": 4},
        {"label": "CLS", "metric_value": 0.3, "weight": 1},
    ])
    by_name = {row["label"]: row for row in rows}
    assert by_name["LCP"]["metric"] == 2800
    assert by_name["LCP"]["good_percent"] == pytest.approx(60)
    assert by_name["LCP"]["poor_percent"] == pytest.approx(20)
    assert by_name["CLS"]["metric"] == pytest.approx(0.05)


def test_trend_rows_compare_current_and_previous_periods() -> None:
    rows = MODULE.build_trend_rows(
        [{"section": "event", "label": "search", "count": 12}], {"search": 8}
    )
    search = next(row for row in rows if row["label"] == "search")
    assert search["previous"] == 8
    assert search["delta"] == 4
    assert search["metric"] == pytest.approx(50)


def test_settings_and_current_release_load_local_env(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    env_file = tmp_path / "telemetry.env"
    env_file.write_text(
        "CLOUDFLARE_ACCOUNT_ID=account\n"
        "CLOUDFLARE_API_TOKEN=secret\n"
        "BARGIG_TELEMETRY_DATASET=bargig_catalog_telemetry\n"
        "BARGIG_CURRENT_RELEASE_ID=deploy-0123456789abcdef\n",
        encoding="utf-8",
    )
    for key in ("CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN", "BARGIG_CURRENT_RELEASE_ID"):
        monkeypatch.delenv(key, raising=False)
    assert MODULE.settings(env_file) == ("account", "secret", "bargig_catalog_telemetry")
    assert MODULE.configured_current_release_id(env_file) == "deploy-0123456789abcdef"
    assert MODULE.configured_current_release_id(env_file, "deploy-fedcba9876543210") == "deploy-fedcba9876543210"


def test_local_build_release_uses_newest_valid_deploy_state(tmp_path: Path) -> None:
    dist = tmp_path / "dist"
    dist.mkdir()
    old = dist / "site-local.build.json"
    new = dist / "site-upload-r2.build.json"
    old.write_text(json.dumps({"releaseId": "deploy-0123456789abcdef"}), encoding="utf-8")
    new.write_text(json.dumps({"releaseId": "deploy-fedcba9876543210"}), encoding="utf-8")
    os.utime(old, (1, 1))
    os.utime(new, (2, 2))
    assert MODULE.local_build_release_id(tmp_path) == "deploy-fedcba9876543210"


def test_extract_rows_accepts_cloudflare_json_shape() -> None:
    assert MODULE.extract_rows({"data": [{"count": 3}]}) == [{"count": 3}]
    with pytest.raises(RuntimeError, match="Unexpected Cloudflare"):
        MODULE.extract_rows({"success": True})


def test_example_env_contains_no_credentials_and_current_release_slot() -> None:
    text = (ROOT / "telemetry.env.example").read_text(encoding="utf-8")
    assert "CLOUDFLARE_ACCOUNT_ID=\n" in text
    assert "CLOUDFLARE_API_TOKEN=\n" in text
    assert "BARGIG_CURRENT_RELEASE_ID=\n" in text
    assert "secret" not in text.lower()
    assert "telemetry.env" in (ROOT / ".gitignore").read_text(encoding="utf-8")


def test_resolve_env_file_accepts_accidental_direction_mark_prefix(tmp_path: Path) -> None:
    malformed = tmp_path / "#U200f#U200ftelemetry.env"
    malformed.write_text("CLOUDFLARE_ACCOUNT_ID=a\nCLOUDFLARE_API_TOKEN=b\n", encoding="utf-8")
    resolved, compatibility = MODULE.resolve_env_file(tmp_path / "telemetry.env")
    assert resolved == malformed and compatibility is True


def test_parse_args_supports_days_and_current_release() -> None:
    positional = MODULE.parse_args(["30", "--current-release", "deploy-0123456789abcdef"])
    assert positional.days_value == 30
    assert positional.current_release == "deploy-0123456789abcdef"
    option = MODULE.parse_args(["--days", "30"])
    assert option.days_option == 30 and option.days_value is None


def test_resolve_env_file_prefers_exact_name(tmp_path: Path) -> None:
    exact = tmp_path / "telemetry.env"
    exact.write_text("", encoding="utf-8")
    (tmp_path / "#U200ftelemetry.env").write_text("", encoding="utf-8")
    resolved, compatibility = MODULE.resolve_env_file(exact)
    assert resolved == exact and compatibility is False


def sample_report_rows() -> list[dict[str, object]]:
    current = "deploy-0123456789abcdef"
    rows: list[dict[str, object]] = [
        {"section": "event", "label": "app_session", "count": 20, "metric": 0},
        {"section": "event", "label": "catalog_open", "count": 12, "metric": 0},
        {"section": "event", "label": "search", "count": 7, "metric": 0},
        {"section": "event", "label": "resource_error", "count": 2, "metric": 0},
        {"section": "event", "label": "image_terminal_failure", "count": 1, "metric": 0},
        {"section": "session_cohort", "release_id": current, "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "count": 16, "first_seen": "2026-08-01", "last_seen": "2026-08-02"},
        {"section": "session_cohort", "release_id": "app-61dd783bd3fa", "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "count": 4},
        {"section": "release", "release_id": current, "count": 16, "first_seen": "2026-08-01", "last_seen": "2026-08-02"},
        {"section": "release", "release_id": "app-61dd783bd3fa", "count": 4, "first_seen": "2026-08-01", "last_seen": "2026-08-02"},
        {"section": "resource_summary", "label": "cloudflare-observability", "source_scope": "cloudflare-observability", "resource_tag": "script", "resource_role": "script", "source": "beacon.min.js", "count": 2, "metric": 0},
        {"section": "catalog", "label": "opening-test", "count": 9, "metric": 0},
        {"section": "search", "label": "ארון הזזה", "count": 4, "metric": 2},
        {"section": "contact", "label": "phone", "count": 3, "metric": 0},
        {"section": "favorite", "label": "add", "count": 5, "metric": 0},
        {"section": "trend", "label": "search", "count": 7, "previous": 5, "delta": 2, "metric": 40},
        {"section": "rum", "label": "LCP", "count": 10, "metric": 2100, "good_count": 8, "poor_count": 1},
        {"section": "rum_cohort", "label": "CLS", "release_id": current, "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "component": "viewer-stage", "count": 12, "metric": 0.246, "good_count": 5, "poor_count": 3, "first_seen": "2026-08-01"},
        {"section": "reliability", "label": "image_terminal_failure", "release_id": current, "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "count": 1},
        {"section": "image_outcome", "label": "image_recovered", "release_id": current, "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "catalog_id": "opening-test", "page_number": 4, "surface": "viewer-stage", "visibility": "visible", "count": 3},
        {"section": "image_outcome", "label": "image_terminal_failure", "release_id": current, "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "catalog_id": "opening-test", "page_number": 4, "surface": "viewer-stage", "visibility": "visible", "count": 1},
        {"section": "js_error", "fingerprint": "ef21e4fae", "error_name": "TypeError", "message": "Cannot read properties of undefined", "source": "app.js", "line": 412, "column": 18, "release_id": current, "count": 2, "metric": 0, "label": "ef21e4fae"},
        {"section": "image_terminal", "fingerprint": "eimage123", "request_id": "ir-abc12345", "catalog_id": "opening-test", "page_number": 4, "failure_stage": "viewer-single", "outcome_action": "fallback", "attempt_count": 2, "surface": "viewer-stage", "visibility": "visible", "source": "page-004.webp", "app_page": "viewer", "route": "/viewer.html", "viewport": "xs", "release_id": current, "count": 1, "metric": 0, "label": "eimage123"},
    ]
    MODULE.enrich_report_rows(rows, current)
    return rows


def test_create_report_files_writes_operational_html_csv_and_json(tmp_path: Path) -> None:
    generated_at = MODULE.datetime(2026, 8, 2, 10, 30).astimezone()
    rows = sample_report_rows()
    paths = MODULE.create_report_files(
        rows, 30, tmp_path, ("html", "csv", "json"), generated_at=generated_at,
        catalog_titles={"opening-test": "ארונות פתיחה לדוגמה"},
    )
    assert set(paths) == {"html", "csv", "json"}
    assert all(path.is_file() for path in paths.values())

    html_text = paths["html"].read_text(encoding="utf-8")
    for expected in (
        '<html lang="he" dir="rtl">', "שלמות גרסאות פריסה", "RUM לפי גרסה", "viewer-stage",
        "0.246", "שיעורי תקלות לכל 1,000", "גלויה למשתמש", "ir-abc12345",
        "app-61dd783bd3fa", "Fallback מקומי", "ארונות פתיחה לדוגמה",
        "Cannot read properties of undefined", "2,100 ms",
    ):
        assert expected in html_text

    csv_bytes = paths["csv"].read_bytes()
    assert csv_bytes.startswith(b"\xef\xbb\xbf")
    csv_text = csv_bytes.decode("utf-8-sig")
    for header in ("מכנה", "שיעור ל-1,000", "כיסוי באחוזים", "רכיב", "משטח תמונה", "נראות תמונה", "מזהה בקשת תמונה"):
        assert header in csv_text
    assert "ir-abc12345" in csv_text

    json_payload = json.loads(paths["json"].read_text(encoding="utf-8"))
    assert json_payload["schemaVersion"] == 3
    assert json_payload["currentReleaseId"] == "deploy-0123456789abcdef"
    assert json_payload["days"] == 30
    assert len(json_payload["rows"]) == len(rows)


def test_default_report_cli_prefers_files_over_rtl_console() -> None:
    args = MODULE.parse_args(["30", "--open"])
    assert args.days_value == 30 and args.open is True and args.console is False
    assert args.formats is None and args.output_dir == MODULE.DEFAULT_OUTPUT_DIR


def test_report_output_directory_is_created_under_project_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(MODULE, "project_root", lambda: tmp_path)
    resolved = MODULE.resolve_output_dir("reports/telemetry")
    assert resolved == (tmp_path / "reports" / "telemetry").resolve()
    assert resolved.is_dir()
