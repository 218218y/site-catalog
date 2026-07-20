from __future__ import annotations

import importlib.util
import json
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
        "event",
        "previous_event",
        "release",
        "catalog",
        "search",
        "contact",
        "favorite",
        "rum_raw",
        "js_error",
        "js_error_legacy",
        "resource_error",
        "search_index_error",
        "image_attempt",
        "image_recovered",
        "image_terminal",
        "image_legacy",
    ]

    for item in queries:
        query = item.sql
        assert query.startswith("SELECT ")
        assert query.count("SELECT ") == 1
        assert "INTERVAL '90' DAY" in query
        assert "FROM bargig_catalog_telemetry" in query
        assert "SUM(_sample_interval)" in query
        assert query.endswith("FORMAT JSON")
        assert "UNION" not in query
        assert "WITH recent" not in query
        assert "page_load" not in query
        assert "first_catalog_image" not in query
        assert "ip" not in query.lower()
        assert "user_agent" not in query.lower()

    search_query = next(item.sql for item in queries if item.section == "search")
    assert "sumIf(_sample_interval, double1 = 0) AS metric" in search_query
    js_query = next(item.sql for item in queries if item.section == "js_error")
    assert "blob9 AS fingerprint" in js_query
    assert "blob8 AS message" in js_query
    assert "double3 AS line" in js_query
    assert "GROUP BY blob9, blob7, blob8" in js_query
    assert "blob13 != ''" in js_query
    legacy_js_query = next(item.sql for item in queries if item.section == "js_error_legacy")
    assert "blob13 = ''" in legacy_js_query
    image_query = next(item.sql for item in queries if item.section == "image_terminal")
    assert "blob4 AS catalog_id" in image_query
    assert "blob8 AS failure_stage" in image_query
    assert "blob13 AS release_id" in image_query
    resource_query = next(item.sql for item in queries if item.section == "resource_error")
    assert "blob7 AS resource_tag" in resource_query
    search_index_query = next(item.sql for item in queries if item.section == "search_index_error")
    assert "blob7 AS failure_reason" in search_index_query
    release_query = next(item.sql for item in queries if item.section == "release")
    assert "blob13 AS label" in release_query
    rum_query = next(item.sql for item in queries if item.section == "rum_raw")
    assert "double1 AS metric_value" in rum_query
    assert "blob7 IN ('LCP', 'INP', 'CLS')" in rum_query
    previous_query = next(item.sql for item in queries if item.section == "previous_event")
    assert "timestamp < NOW() - INTERVAL '90' DAY" in previous_query


def test_diagnostic_rows_keep_error_context() -> None:
    js_row = MODULE.normalize_report_row(
        "js_error",
        {"fingerprint": "ef21e4fae", "error_name": "TypeError", "message": "boom", "count": 3},
    )
    image_row = MODULE.normalize_report_row(
        "image_terminal",
        {"fingerprint": "", "source": "page-004.webp", "count": 2},
    )
    resource_row = MODULE.normalize_report_row(
        "resource_error",
        {"fingerprint": "e-resource", "source": "optional.js", "count": 1},
    )

    assert js_row["label"] == "ef21e4fae"
    assert js_row["message"] == "boom"
    assert js_row["section"] == "js_error"
    assert image_row["label"] == "page-004.webp"
    assert image_row["section"] == "image_terminal"
    assert resource_row["label"] == "e-resource"


def test_fetch_report_rows_normalizes_diagnostic_sections(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_query_api(_account_id: str, _token: str, query: str) -> dict[str, object]:
        if "blob8 AS message" in query and "blob13 != ''" in query:
            return {"data": [{"fingerprint": "ef21e4fae", "error_name": "ReferenceError", "message": "missing", "count": 4}]}
        if "blob8 AS message" in query:
            return {"data": []}
        if "blob7 AS resource_tag" in query:
            return {"data": [{"fingerprint": "eresource", "source": "optional.js", "count": 2}]}
        if "blob7 AS failure_reason" in query:
            return {"data": [{"fingerprint": "esearch", "failure_reason": "network-error", "count": 1}]}
        if "blob1 = 'image_terminal_failure'" in query:
            return {"data": [{"fingerprint": "", "source": "page-001.webp", "count": 1}]}
        return {"data": []}

    monkeypatch.setattr(MODULE, "query_api", fake_query_api)
    rows = MODULE.fetch_report_rows("account", "token", "dataset", 30)

    assert rows[:4] == [
        {"fingerprint": "ef21e4fae", "error_name": "ReferenceError", "message": "missing", "count": 4, "section": "js_error", "label": "ef21e4fae", "metric": 0},
        {"fingerprint": "eresource", "source": "optional.js", "count": 2, "section": "resource_error", "label": "eresource", "metric": 0},
        {"fingerprint": "esearch", "failure_reason": "network-error", "count": 1, "section": "search_index_error", "label": "esearch", "metric": 0},
        {"fingerprint": "", "source": "page-001.webp", "count": 1, "section": "image_terminal", "label": "page-001.webp", "metric": 0},
    ]
    assert {row["label"] for row in rows[4:] if row["section"] == "trend"} == {
        "catalog_open", "search", "favorite", "contact", "js_error", "resource_error",
        "search_index_load_failed", "image_attempt_failed", "image_recovered",
        "image_terminal_failure", "image_error",
    }


def test_fetch_report_rows_executes_sections_independently(monkeypatch: pytest.MonkeyPatch) -> None:
    calls: list[str] = []

    def fake_query_api(account_id: str, token: str, query: str) -> dict[str, object]:
        assert account_id == "account"
        assert token == "token"
        calls.append(query)
        if "blob4 AS label" in query:
            return {"data": [{"label": "opening-test", "count": 4}]}
        if "blob5 AS label" in query:
            return {"data": [{"label": "ארון", "count": 3, "metric": 1}]}
        return {"data": []}

    monkeypatch.setattr(MODULE, "query_api", fake_query_api)
    rows = MODULE.fetch_report_rows("account", "token", "dataset", 30)

    assert len(calls) == 16
    assert all("UNION" not in query for query in calls)
    assert rows[:2] == [
        {"label": "opening-test", "count": 4, "section": "catalog", "metric": 0},
        {"label": "ארון", "count": 3, "metric": 1, "section": "search"},
    ]
    assert len([row for row in rows if row["section"] == "trend"]) == 11


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
        [{"section": "event", "label": "search", "count": 12}],
        {"search": 8},
    )
    search = next(row for row in rows if row["label"] == "search")
    assert search["previous"] == 8
    assert search["delta"] == 4
    assert search["metric"] == pytest.approx(50)


def test_settings_load_local_secret_file_without_committing_values(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    env_file = tmp_path / "telemetry.env"
    env_file.write_text(
        "CLOUDFLARE_ACCOUNT_ID=account\n"
        "CLOUDFLARE_API_TOKEN=secret\n"
        "BARGIG_TELEMETRY_DATASET=bargig_catalog_telemetry\n",
        encoding="utf-8",
    )
    monkeypatch.delenv("CLOUDFLARE_ACCOUNT_ID", raising=False)
    monkeypatch.delenv("CLOUDFLARE_API_TOKEN", raising=False)
    assert MODULE.settings(env_file) == ("account", "secret", "bargig_catalog_telemetry")


def test_extract_rows_accepts_cloudflare_json_shape() -> None:
    rows = MODULE.extract_rows({"data": [{"section": "event", "count": 3}]})
    assert rows == [{"section": "event", "count": 3}]
    with pytest.raises(RuntimeError, match="Unexpected Cloudflare"):
        MODULE.extract_rows({"success": True})


def test_example_env_contains_no_credentials() -> None:
    text = (ROOT / "telemetry.env.example").read_text(encoding="utf-8")
    assert "CLOUDFLARE_ACCOUNT_ID=\n" in text
    assert "CLOUDFLARE_API_TOKEN=\n" in text
    assert "secret" not in text.lower()
    assert "telemetry.env" in (ROOT / ".gitignore").read_text(encoding="utf-8")


def test_resolve_env_file_accepts_accidental_direction_mark_prefix(tmp_path: Path) -> None:
    malformed = tmp_path / "#U200f#U200ftelemetry.env"
    malformed.write_text("CLOUDFLARE_ACCOUNT_ID=a\nCLOUDFLARE_API_TOKEN=b\n", encoding="utf-8")
    resolved, compatibility = MODULE.resolve_env_file(tmp_path / "telemetry.env")
    assert resolved == malformed
    assert compatibility is True


def test_parse_args_supports_npm_positional_and_direct_option() -> None:
    positional = MODULE.parse_args(["30"])
    assert positional.days_value == 30
    assert positional.days_option is None

    option = MODULE.parse_args(["--days", "30"])
    assert option.days_option == 30
    assert option.days_value is None


def test_resolve_env_file_prefers_exact_name(tmp_path: Path) -> None:
    exact = tmp_path / "telemetry.env"
    exact.write_text("", encoding="utf-8")
    (tmp_path / "#U200ftelemetry.env").write_text("", encoding="utf-8")
    resolved, compatibility = MODULE.resolve_env_file(exact)
    assert resolved == exact
    assert compatibility is False


def sample_report_rows() -> list[dict[str, object]]:
    return [
        {"section": "event", "label": "catalog_open", "count": 12, "metric": 0},
        {"section": "event", "label": "search", "count": 7, "metric": 0},
        {"section": "event", "label": "resource_error", "count": 2, "metric": 0},
        {"section": "event", "label": "image_terminal_failure", "count": 1, "metric": 0},
        {"section": "release", "label": "app-61dd783bd3fa", "count": 20, "metric": 0},
        {"section": "catalog", "label": "opening-test", "count": 9, "metric": 0},
        {"section": "search", "label": "ארון הזזה", "count": 4, "metric": 2},
        {"section": "contact", "label": "phone", "count": 3, "metric": 0},
        {"section": "favorite", "label": "add", "count": 5, "metric": 0},
        {"section": "trend", "label": "search", "count": 7, "previous": 5, "delta": 2, "metric": 40},
        {"section": "rum", "label": "LCP", "count": 10, "metric": 2100, "good_percent": 80, "poor_percent": 10, "unit": "ms"},
        {
            "section": "js_error",
            "fingerprint": "ef21e4fae",
            "error_name": "TypeError",
            "message": "Cannot read properties of undefined",
            "source": "app.js",
            "line": 412,
            "column": 18,
            "release_id": "app-61dd783bd3fa",
            "count": 46,
            "metric": 0,
            "label": "ef21e4fae",
        },
        {
            "section": "image_terminal",
            "fingerprint": "",
            "catalog_id": "opening-test",
            "page_number": 4,
            "failure_stage": "viewer-single",
            "outcome_action": "fallback",
            "attempt_count": 2,
            "source": "page-004.webp",
            "release_id": "app-61dd783bd3fa",
            "count": 1,
            "metric": 0,
            "label": "page-004.webp",
        },
    ]


def test_create_report_files_writes_rtl_html_and_excel_friendly_csv(tmp_path: Path) -> None:
    generated_at = MODULE.datetime(2026, 7, 16, 10, 30).astimezone()
    paths = MODULE.create_report_files(
        sample_report_rows(),
        30,
        tmp_path,
        ("html", "csv", "json"),
        generated_at=generated_at,
        catalog_titles={"opening-test": "ארונות פתיחה לדוגמה"},
    )

    assert set(paths) == {"html", "csv", "json"}
    assert all(path.is_file() for path in paths.values())
    assert "2026-07-16_10-30-00" in paths["html"].name

    html_text = paths["html"].read_text(encoding="utf-8")
    assert '<html lang="he" dir="rtl">' in html_text
    assert "דוח פעילות אתר רהיטי ברגיג" in html_text
    assert "ארונות פתיחה לדוגמה" in html_text
    assert "ארון הזזה" in html_text
    assert "חיפושים ללא תוצאה" in html_text
    assert "ef21e4fae" in html_text
    assert "Cannot read properties of undefined" in html_text
    assert "viewer-single" in html_text
    assert "fallback" in html_text
    assert "app-61dd783bd3fa" in html_text
    assert "מדדי חוויית משתמש אמיתיים" in html_text
    assert "מגמות מול התקופה הקודמת" in html_text
    assert "2,100 ms" in html_text

    csv_bytes = paths["csv"].read_bytes()
    assert csv_bytes.startswith(b"\xef\xbb\xbf")
    csv_text = csv_bytes.decode("utf-8-sig")
    assert "סוג נתון,פריט / טביעה,כמות" in csv_text
    assert "ארונות פתיחה לדוגמה" in csv_text

    json_payload = json.loads(paths["json"].read_text(encoding="utf-8"))
    assert json_payload["days"] == 30
    assert len(json_payload["rows"]) == len(sample_report_rows())


def test_default_report_cli_prefers_files_over_rtl_console() -> None:
    args = MODULE.parse_args(["30", "--open"])
    assert args.days_value == 30
    assert args.open is True
    assert args.console is False
    assert args.formats is None
    assert args.output_dir == MODULE.DEFAULT_OUTPUT_DIR


def test_report_output_directory_is_created_under_project_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(MODULE, "project_root", lambda: tmp_path)
    resolved = MODULE.resolve_output_dir("reports/telemetry")
    assert resolved == (tmp_path / "reports" / "telemetry").resolve()
    assert resolved.is_dir()
