from __future__ import annotations

import hashlib
import importlib.util
import json
import sys

import pytest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))
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
        "wrangler-local",
        "bargig-catalog",
        "r2-cors.json",
    )
    assert set_command == [
        "wrangler-local",
        "r2",
        "bucket",
        "cors",
        "set",
        "bargig-catalog",
        "--file",
        "r2-cors.json",
    ]
    assert list_command == [
        "wrangler-local",
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
    monkeypatch.setattr(MODULE, "find_local_wrangler", lambda root=None: "wrangler-local")
    monkeypatch.setattr(MODULE, "validate_current_artifact", lambda *args, **kwargs: {})

    assert MODULE.main(["--dir", "bundle", "--dry-run"]) == 0
    output = capsys.readouterr().out
    assert "Validating the existing Cloudflare Pages bundle without rebuilding" in output
    assert "tools/build_deploy_bundle.py" not in output
    assert "wrangler-local pages deploy" in output
    assert "--verify-remote-assets" not in output
    assert "--branch" not in output
    assert "environment: production" in output
    assert "wrangler r2 bucket cors" not in output
    assert "R2 CORS" not in output


def test_deploy_interface_validates_existing_bundle_by_default() -> None:
    args = MODULE.parse_args([])
    assert args.build_first is False
    assert MODULE.parse_args(["--build-first"]).build_first is True


def test_production_pages_command_does_not_pass_branch() -> None:
    command = MODULE.build_pages_deploy_command(
        "wrangler-local",
        "dist/site-upload-r2",
        "bargig-catlog",
    )
    assert command == [
        "wrangler-local",
        "pages",
        "deploy",
        "dist/site-upload-r2",
        "--project-name",
        "bargig-catlog",
    ]


def test_preview_pages_command_requires_explicit_preview_branch() -> None:
    command = MODULE.build_pages_deploy_command(
        "wrangler-local",
        "dist/site-upload-r2",
        "bargig-catlog",
        "feature-test",
    )
    assert command[-2:] == ["--branch", "feature-test"]


def test_production_deploy_finishes_after_wrangler_success_without_public_check(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    monkeypatch.setattr(MODULE, "project_root", lambda: tmp_path)
    monkeypatch.setattr(MODULE, "find_local_wrangler", lambda root=None: "wrangler-local")
    monkeypatch.setattr(MODULE, "validate_current_artifact", lambda *args, **kwargs: {})

    captured_commands: list[list[str]] = []

    def fake_run(command: list[str], cwd: Path) -> int:
        captured_commands.append(list(command))
        return 0

    monkeypatch.setattr(MODULE, "run_streamed", fake_run)

    assert MODULE.main(["--dir", "bundle"]) == 0
    assert len(captured_commands) == 1
    assert captured_commands[0][:3] == ["wrangler-local", "pages", "deploy"]
    output = capsys.readouterr().out
    assert "Cloudflare Pages deploy finished successfully." in output
    assert "no public website comparison was performed" in output
    assert "https://bargig-furniture.com" not in output
    assert "pages.dev" not in output


def test_public_verification_interface_was_removed() -> None:
    assert not hasattr(MODULE, "verify_public_deployment")
    assert not hasattr(MODULE, "fetch_public_url")
    with pytest.raises(SystemExit):
        MODULE.parse_args(["--verify-url", "https://example.com"])
    with pytest.raises(SystemExit):
        MODULE.parse_args(["--no-verify"])


def test_dry_run_reports_no_post_deploy_website_comparison(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    monkeypatch.setattr(MODULE, "project_root", lambda: tmp_path)
    monkeypatch.setattr(MODULE, "find_local_wrangler", lambda root=None: "wrangler-local")
    monkeypatch.setattr(MODULE, "validate_current_artifact", lambda *args, **kwargs: {})

    assert MODULE.main(["--dir", "bundle", "--dry-run"]) == 0
    output = capsys.readouterr().out
    assert "Post-deploy website comparison: disabled" in output
    assert "https://bargig-furniture.com" not in output
    assert "pages.dev" not in output


def write_minimal_bundle(bundle_dir: Path, missing_reference: tuple[str, str] | None = None) -> None:
    bundle_dir.mkdir(parents=True, exist_ok=True)
    root = bundle_dir.parent
    (root / "functions" / "api").mkdir(parents=True, exist_ok=True)
    (root / "functions" / "api" / "telemetry.js").write_text("export function onRequest() {}\n", encoding="utf-8")
    (root / "wrangler.jsonc").write_text(
        json.dumps({
            "name": "bargig-catlog",
            "pages_build_output_dir": f"./{bundle_dir.name}",
            "compatibility_date": "2026-07-15",
            "analytics_engine_datasets": [
                {"binding": "SITE_TELEMETRY", "dataset": "bargig_catalog_telemetry"}
            ],
        }),
        encoding="utf-8",
    )
    (bundle_dir / "_headers").write_text("/*\n  X-Robots-Tag: noindex\n", encoding="utf-8")
    (bundle_dir / "robots.txt").write_text("User-agent: *\n", encoding="utf-8")
    (bundle_dir / "404.html").write_text("<!doctype html><title>404</title>", encoding="utf-8")
    static_dir = bundle_dir / "static"
    static_dir.mkdir()

    search_content = b"window.BARGIG_SEARCH = [];\n"
    search_name = f"catalogs.search.{hashlib.sha256(search_content).hexdigest()[:12]}.js"
    (static_dir / search_name).write_bytes(search_content)
    app_content = f'const SEARCH_INDEX_SCRIPT_SRC = "static/{search_name}";\nwindow.test = true;\n'.encode("utf-8")
    style_content = b"body {}\n"
    app_name = f"app.{hashlib.sha256(app_content).hexdigest()[:12]}.js"
    style_name = f"styles.{hashlib.sha256(style_content).hexdigest()[:12]}.css"
    (static_dir / app_name).write_bytes(app_content)
    (static_dir / style_name).write_bytes(style_content)

    for html_name in MODULE.PUBLIC_HTML_FILES:
        script = f"static/{app_name}"
        if missing_reference and missing_reference[0] == html_name:
            script = missing_reference[1]
        (bundle_dir / html_name).write_text(
            f'<link rel="stylesheet" href="static/{style_name}"><script src="{script}"></script>',
            encoding="utf-8",
        )


def test_bundle_validation_checks_every_public_document(tmp_path: Path) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    MODULE.validate_bundle(bundle_dir)


def test_bundle_validation_accepts_runtime_loaded_search_index(tmp_path: Path) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)

    MODULE.validate_bundle(bundle_dir)
    assert len(list((bundle_dir / "static").glob("catalogs.search.*.js"))) == 1


def test_bundle_validation_rejects_missing_asset_in_non_index_page(tmp_path: Path) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir, ("privacy.html", "static/missing-transition.js"))

    with pytest.raises(FileNotFoundError, match=r"privacy\.html -> static/missing-transition\.js"):
        MODULE.validate_bundle(bundle_dir)


def test_bundle_validation_rejects_unreferenced_old_generation(tmp_path: Path) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    (bundle_dir / "static" / "app.111111111111.js").write_text("window.old = true;\n", encoding="utf-8")

    with pytest.raises(ValueError, match="stale or unreferenced"):
        MODULE.validate_bundle(bundle_dir)


def test_normal_deploy_bundle_build_does_not_require_remote_r2_verification(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[list[str]] = []

    def fake_run(command: list[str], cwd: Path) -> int:
        captured.append(list(command))
        return 0

    monkeypatch.setattr(MODULE, "project_root", lambda: tmp_path)
    monkeypatch.setattr(MODULE, "run_streamed", fake_run)
    args = MODULE.parse_args(["--dir", "bundle"])

    assert MODULE.build_bundle(args) == 0
    assert len(captured) == 1
    assert "--verify-remote-assets" not in captured[0]
    assert "--skip-if-current" in captured[0]
    assert captured[0][captured[0].index("--mirror-to") + 1] == "dist/site-local"


def test_deploy_bundle_does_not_require_removed_technical_shells(tmp_path: Path) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    assert "catalog.html" not in MODULE.REQUIRED_BUNDLE_FILES
    assert "viewer.html" not in MODULE.REQUIRED_BUNDLE_FILES
    MODULE.validate_bundle(bundle_dir)


def test_default_deploy_does_not_call_builder(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    monkeypatch.setattr(MODULE, "project_root", lambda: tmp_path)
    monkeypatch.setattr(MODULE, "find_local_wrangler", lambda root=None: "wrangler-local")
    monkeypatch.setattr(MODULE, "validate_current_artifact", lambda *args, **kwargs: {})
    monkeypatch.setattr(MODULE, "run_streamed", lambda command, cwd: 0)
    monkeypatch.setattr(
        MODULE,
        "build_bundle",
        lambda args: (_ for _ in ()).throw(AssertionError("builder must not run")),
    )
    assert MODULE.main(["--dir", "bundle"]) == 0


def test_pages_runtime_config_requires_telemetry_binding(tmp_path: Path) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    config = MODULE.validate_pages_runtime_config(tmp_path, bundle_dir, "bargig-catlog")
    assert config["analytics_engine_datasets"][0]["binding"] == "SITE_TELEMETRY"

    (tmp_path / "wrangler.jsonc").write_text(
        json.dumps({
            "name": "bargig-catlog",
            "pages_build_output_dir": "./bundle",
            "analytics_engine_datasets": [],
        }),
        encoding="utf-8",
    )
    with pytest.raises(ValueError, match="SITE_TELEMETRY"):
        MODULE.validate_pages_runtime_config(tmp_path, bundle_dir, "bargig-catlog")


def test_pages_runtime_config_rejects_output_mismatch(tmp_path: Path) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    payload = json.loads((tmp_path / "wrangler.jsonc").read_text(encoding="utf-8"))
    payload["pages_build_output_dir"] = "./somewhere-else"
    (tmp_path / "wrangler.jsonc").write_text(json.dumps(payload), encoding="utf-8")
    with pytest.raises(ValueError, match="output mismatch"):
        MODULE.validate_pages_runtime_config(tmp_path, bundle_dir, "bargig-catlog")
