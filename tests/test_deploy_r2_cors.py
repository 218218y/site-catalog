from __future__ import annotations

import hashlib
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
    assert "tools/build_deploy_bundle.py" in output
    assert "wrangler pages deploy" in output
    assert "--branch" not in output
    assert "environment: production" in output
    assert "wrangler r2 bucket cors" not in output
    assert "R2 CORS" not in output


def test_deploy_interface_does_not_allow_skipping_the_fresh_build() -> None:
    with pytest.raises(SystemExit):
        MODULE.parse_args(["--no-build"])


def test_production_pages_command_does_not_pass_branch() -> None:
    command = MODULE.build_pages_deploy_command(
        "npx",
        "dist/site-upload-r2",
        "bargig-catlog",
    )
    assert command == [
        "npx",
        "--yes",
        "wrangler",
        "pages",
        "deploy",
        "dist/site-upload-r2",
        "--project-name",
        "bargig-catlog",
    ]


def test_preview_pages_command_requires_explicit_preview_branch() -> None:
    command = MODULE.build_pages_deploy_command(
        "npx",
        "dist/site-upload-r2",
        "bargig-catlog",
        "feature-test",
    )
    assert command[-2:] == ["--branch", "feature-test"]


def test_production_deploy_verifies_only_the_allowed_custom_domain(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    monkeypatch.setattr(MODULE, "project_root", lambda: tmp_path)
    monkeypatch.setattr(MODULE, "find_npx", lambda: "npx")
    monkeypatch.setattr(MODULE, "build_bundle", lambda args: 0)

    captured_command: list[str] = []

    def fake_run(command: list[str], cwd: Path) -> int:
        captured_command.extend(command)
        return 0

    verified: list[str] = []

    def fake_verify(base_url: str, **kwargs: object) -> None:
        verified.append(base_url)

    monkeypatch.setattr(MODULE, "run_streamed", fake_run)
    monkeypatch.setattr(MODULE, "verify_public_deployment", fake_verify)

    assert MODULE.main(["--dir", "bundle"]) == 0
    assert "--branch" not in captured_command
    assert verified == ["https://bargig-furniture.com"]
    assert all("pages.dev" not in url for url in verified)


def test_preview_deploy_skips_network_verification_when_pages_dev_is_blocked(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    monkeypatch.setattr(MODULE, "project_root", lambda: tmp_path)
    monkeypatch.setattr(MODULE, "find_npx", lambda: "npx")
    monkeypatch.setattr(MODULE, "build_bundle", lambda args: 0)

    captured_command: list[str] = []

    def fake_run(command: list[str], cwd: Path) -> int:
        captured_command.extend(command)
        return 0

    verified: list[str] = []
    monkeypatch.setattr(MODULE, "run_streamed", fake_run)
    monkeypatch.setattr(
        MODULE,
        "verify_public_deployment",
        lambda base_url, **kwargs: verified.append(base_url),
    )

    assert MODULE.main(["--dir", "bundle", "--preview-branch", "test-change"]) == 0
    assert captured_command[-2:] == ["--branch", "test-change"]
    assert verified == []


def test_dry_run_does_not_schedule_pages_dev_verification(
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
    assert "https://bargig-furniture.com" in output
    assert "pages.dev" not in output

def write_minimal_bundle(bundle_dir: Path, missing_reference: tuple[str, str] | None = None) -> None:
    bundle_dir.mkdir(parents=True, exist_ok=True)
    (bundle_dir / "_headers").write_text("/*\n  X-Robots-Tag: noindex\n", encoding="utf-8")
    (bundle_dir / "404.html").write_text("<!doctype html><title>404</title>", encoding="utf-8")
    static_dir = bundle_dir / "static"
    static_dir.mkdir()

    app_content = b"window.test = true;\n"
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


def test_bundle_validation_rejects_missing_asset_in_non_index_page(tmp_path: Path) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir, ("viewer.html", "static/missing-transition.js"))

    with pytest.raises(FileNotFoundError, match=r"viewer\.html -> static/missing-transition\.js"):
        MODULE.validate_bundle(bundle_dir)


def test_bundle_validation_rejects_unreferenced_old_generation(tmp_path: Path) -> None:
    bundle_dir = tmp_path / "bundle"
    write_minimal_bundle(bundle_dir)
    (bundle_dir / "static" / "app.111111111111.js").write_text("window.old = true;\n", encoding="utf-8")

    with pytest.raises(ValueError, match="old generations must not be deployed"):
        MODULE.validate_bundle(bundle_dir)


def test_public_deployment_verifier_checks_root_static_assets_for_clean_routes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    requested: list[str] = []

    def fake_fetch(url: str, token: str) -> MODULE.PublicResponse:
        requested.append(url)
        if url.endswith(("/", "/catalog", "/favorites", "/viewer")):
            return MODULE.PublicResponse(
                200,
                "text/html",
                {"cache-control": "no-store"},
                b'<script src="static/app.123456789abc.js"></script>',
            )
        if url.endswith("/static/app.123456789abc.js"):
            return MODULE.PublicResponse(
                200,
                "application/javascript",
                {"cache-control": "public, max-age=31536000, immutable"},
                b"window.ok = true;\n",
            )
        if "/static/__deploy_missing_" in url:
            return MODULE.PublicResponse(404, "text/html", {}, b"<!doctype html><title>404</title>")
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(MODULE, "fetch_public_url", fake_fetch)
    MODULE.verify_public_deployment("https://example.com", attempts=1, delay_seconds=0)

    assert "https://example.com/static/app.123456789abc.js" in requested
    assert all("/catalog/static/" not in url for url in requested)


def test_public_deployment_verifier_rejects_html_returned_for_javascript(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_fetch(url: str, token: str) -> MODULE.PublicResponse:
        if url.endswith(("/", "/catalog", "/favorites", "/viewer")):
            return MODULE.PublicResponse(
                200,
                "text/html",
                {"cache-control": "no-store"},
                b'<script src="static/site-routes.123456789abc.js"></script>',
            )
        return MODULE.PublicResponse(200, "text/html", {}, b"<!doctype html><html><body>404</body></html>")

    monkeypatch.setattr(MODULE, "fetch_public_url", fake_fetch)
    with pytest.raises(RuntimeError, match="returned HTTP 200 and Content-Type 'text/html'.*instead of executable JavaScript"):
        MODULE.verify_public_deployment("https://example.com", attempts=1, delay_seconds=0)


def test_public_deployment_verifier_rejects_a_stale_asset_generation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_fetch(url: str, token: str) -> MODULE.PublicResponse:
        if url.endswith(("/", "/catalog", "/favorites", "/viewer")):
            return MODULE.PublicResponse(
                200,
                "text/html",
                {"cache-control": "no-store"},
                b'<script src="static/app.111111111111.js"></script>',
            )
        return MODULE.PublicResponse(
            200,
            "application/javascript",
            {"cache-control": "public, max-age=31536000, immutable"},
            b"window.old = true;\n",
        )

    monkeypatch.setattr(MODULE, "fetch_public_url", fake_fetch)
    with pytest.raises(RuntimeError, match="not serving the release that was just built"):
        MODULE.verify_public_deployment(
            "https://example.com",
            expected_asset_paths={"/static/app.222222222222.js"},
            attempts=1,
            delay_seconds=0,
        )


def test_public_deployment_verifier_rejects_missing_html_cache_headers(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_fetch(url: str, token: str) -> MODULE.PublicResponse:
        if url.endswith(("/", "/catalog", "/favorites", "/viewer")):
            return MODULE.PublicResponse(
                200,
                "text/html",
                {"cache-control": "public, max-age=14400"},
                b'<script src="static/app.123456789abc.js"></script>',
            )
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(MODULE, "fetch_public_url", fake_fetch)
    with pytest.raises(RuntimeError, match="must return Cache-Control: no-store"):
        MODULE.verify_public_deployment("https://example.com", attempts=1, delay_seconds=0)


def test_public_deployment_verifier_requires_real_404_for_missing_static_asset(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def fake_fetch(url: str, token: str) -> MODULE.PublicResponse:
        if url.endswith(("/", "/catalog", "/favorites", "/viewer")):
            return MODULE.PublicResponse(
                200,
                "text/html",
                {"cache-control": "no-store"},
                b'<script src="static/app.123456789abc.js"></script>',
            )
        if url.endswith("/static/app.123456789abc.js"):
            return MODULE.PublicResponse(
                200,
                "application/javascript",
                {"cache-control": "public, max-age=31536000, immutable"},
                b"window.ok = true;\n",
            )
        if "/static/__deploy_missing_" in url:
            return MODULE.PublicResponse(200, "text/html", {}, b"<!doctype html><html></html>")
        raise AssertionError(f"Unexpected URL: {url}")

    monkeypatch.setattr(MODULE, "fetch_public_url", fake_fetch)
    with pytest.raises(RuntimeError, match="must return a real 404"):
        MODULE.verify_public_deployment("https://example.com", attempts=1, delay_seconds=0)
