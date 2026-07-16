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
        "catalog",
        "search",
        "contact",
        "favorite",
        "error",
    ]

    for item in queries:
        query = item.sql
        assert query.startswith("SELECT ")
        assert query.count("SELECT ") == 1
        assert "INTERVAL '90' DAY" in query
        assert "FROM bargig_catalog_telemetry" in query
        assert "SUM(_sample_interval) AS count" in query
        assert query.endswith("FORMAT JSON")
        assert "UNION" not in query
        assert "WITH recent" not in query
        assert "page_load" not in query
        assert "first_catalog_image" not in query
        assert "ip" not in query.lower()
        assert "user_agent" not in query.lower()

    search_query = next(item.sql for item in queries if item.section == "search")
    assert "sumIf(_sample_interval, double1 = 0) AS metric" in search_query
    error_query = next(item.sql for item in queries if item.section == "error")
    assert "blob1 AS event_name, blob9 AS error_code" in error_query
    assert "GROUP BY blob1, blob9" in error_query
    assert "if(" not in error_query.lower()



def test_error_rows_are_labeled_locally_without_group_by_expression() -> None:
    coded = MODULE.normalize_report_row(
        "error",
        {"event_name": "js_error", "error_code": "TypeError", "count": 3},
    )
    fallback = MODULE.normalize_report_row(
        "error",
        {"event_name": "image_error", "error_code": "", "count": 2},
    )

    assert coded == {
        "section": "error",
        "label": "TypeError",
        "count": 3,
        "metric": 0,
    }
    assert fallback == {
        "section": "error",
        "label": "image_error",
        "count": 2,
        "metric": 0,
    }


def test_fetch_report_rows_normalizes_error_section(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_query_api(_account_id: str, _token: str, query: str) -> dict[str, object]:
        if "blob1 AS event_name, blob9 AS error_code" in query:
            return {
                "data": [
                    {"event_name": "js_error", "error_code": "ReferenceError", "count": 4},
                    {"event_name": "image_error", "error_code": "", "count": 1},
                ]
            }
        return {"data": []}

    monkeypatch.setattr(MODULE, "query_api", fake_query_api)
    rows = MODULE.fetch_report_rows("account", "token", "dataset", 30)

    assert rows == [
        {"section": "error", "label": "ReferenceError", "count": 4, "metric": 0},
        {"section": "error", "label": "image_error", "count": 1, "metric": 0},
    ]

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

    assert len(calls) == 6
    assert all("UNION" not in query for query in calls)
    assert rows == [
        {"label": "opening-test", "count": 4, "section": "catalog", "metric": 0},
        {"label": "ארון", "count": 3, "metric": 1, "section": "search"},
    ]


def test_fetch_report_rows_names_the_failed_section(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_query_api(_account_id: str, _token: str, query: str) -> dict[str, object]:
        if "blob5 AS label" in query:
            raise RuntimeError("invalid query")
        return {"data": []}

    monkeypatch.setattr(MODULE, "query_api", fake_query_api)
    with pytest.raises(RuntimeError, match="section 'search'.*invalid query"):
        MODULE.fetch_report_rows("account", "token", "dataset", 7)


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
