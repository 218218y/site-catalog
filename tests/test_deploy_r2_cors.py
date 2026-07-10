from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "deploy_cloudflare_pages",
    ROOT / "tools" / "deploy_cloudflare_pages.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_r2_cors_policy_allows_public_canvas_reads() -> None:
    policy_path = ROOT / "r2-cors.json"
    MODULE.validate_r2_cors_file(policy_path)
    payload = json.loads(policy_path.read_text(encoding="utf-8"))
    allowed = payload["rules"][0]["allowed"]
    assert allowed["origins"] == ["*"]
    assert allowed["methods"] == ["GET", "HEAD"]


def test_wrangler_cors_commands_are_fixed_purpose() -> None:
    set_command, list_command = MODULE.build_r2_cors_commands(
        "npx",
        "bargig-catalog",
        "r2-cors.json",
    )
    assert set_command == [
        "npx",
        "--yes",
        "wrangler",
        "r2",
        "bucket",
        "cors",
        "set",
        "bargig-catalog",
        "--file",
        "r2-cors.json",
    ]
    assert list_command == [
        "npx",
        "--yes",
        "wrangler",
        "r2",
        "bucket",
        "cors",
        "list",
        "bargig-catalog",
    ]


def test_cors_only_dry_run_does_not_require_site_bundle(capsys) -> None:
    assert MODULE.main(["--cors-only", "--dry-run"]) == 0
    output = capsys.readouterr().out
    assert "wrangler r2 bucket cors set" in output
    assert "wrangler r2 bucket cors list" in output
    assert "wrangler pages deploy" not in output
