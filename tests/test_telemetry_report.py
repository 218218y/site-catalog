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


def test_report_query_is_aggregate_and_bounded() -> None:
    query = MODULE.report_query("bargig_catalog_telemetry", 200)
    assert "INTERVAL '90' DAY" in query
    assert "GROUP BY event_name" in query
    assert "blob1 AS event_name" in query
    assert "FORMAT JSON" in query
    assert "_sample_interval AS sample_interval" in query
    assert "SUM(sample_interval) AS count" in query
    assert "SUM(if(value = 0, sample_interval, 0))" in query
    assert "page_load" not in query
    assert "first_catalog_image" not in query
    assert "ip" not in query.lower()
    assert "user_agent" not in query.lower()


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
