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
    assert "SUM(sample_interval * duration_ms) / SUM(sample_interval)" in query
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
