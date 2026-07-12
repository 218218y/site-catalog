from __future__ import annotations

import importlib.util
import json
import sys

import pytest
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


def test_pages_deploy_dry_run_never_reads_or_changes_r2_cors(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    monkeypatch.setattr(MODULE, "project_root", lambda: tmp_path)
    monkeypatch.setattr(MODULE, "find_npx", lambda: "npx")

    assert MODULE.main(["--dir", "bundle", "--dry-run"]) == 0
    output = capsys.readouterr().out
    assert "wrangler pages deploy" in output
    assert "wrangler r2 bucket cors" not in output
    assert "R2 CORS" not in output


def write_minimal_bundle(bundle_dir: Path, missing_reference: tuple[str, str] | None = None) -> None:
    bundle_dir.mkdir(parents=True, exist_ok=True)
    (bundle_dir / "_headers").write_text("/*\n  X-Robots-Tag: noindex\n", encoding="utf-8")
    static_dir = bundle_dir / "static"
    static_dir.mkdir()
    (static_dir / "app.test.js").write_text("window.test = true;\n", encoding="utf-8")
    (static_dir / "styles.test.css").write_text("body {}\n", encoding="utf-8")

    for html_name in MODULE.PUBLIC_HTML_FILES:
        script = "static/app.test.js"
        if missing_reference and missing_reference[0] == html_name:
            script = missing_reference[1]
        (bundle_dir / html_name).write_text(
            f'<link rel="stylesheet" href="static/styles.test.css"><script src="{script}"></script>',
            encoding="utf-8",
        )


def test_bundle_validation_checks_every_public_document(tmp_path: Path) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    MODULE.validate_bundle(bundle_dir)


def test_bundle_validation_rejects_missing_asset_in_non_index_page(tmp_path: Path) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir, ("viewer.html", "static/missing-transition.js"))

    with pytest.raises(FileNotFoundError, match=r"viewer\.html -> static/missing-transition\.js"):
        MODULE.validate_bundle(bundle_dir)
