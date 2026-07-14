from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location(
    "build_deploy_bundle",
    TOOLS / "build_deploy_bundle.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def write_asset(root: Path, relative: str, content: bytes = b"asset") -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def test_project_manifest_icons_are_discovered() -> None:
    assets = {path.as_posix() for path in MODULE.discover_web_app_assets(ROOT)}
    assert "android-chrome-192x192.png" in assets
    assert "android-chrome-512x512.png" in assets
    assert "apple-touch-icon.png" in assets
    assert "favicon-16x16.png" in assets
    assert "favicon-32x32.png" in assets
    assert "favicon.ico" in assets


def test_manifest_assets_and_custom_icon_family_are_copied(tmp_path: Path) -> None:
    root = tmp_path / "project"
    out = tmp_path / "bundle"
    root.mkdir()
    out.mkdir()

    for relative in (
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
        "images/install-shot.png",
    ):
        write_asset(root, relative)

    (root / "site.webmanifest").write_text(
        json.dumps(
            {
                "icons": [
                    {"src": "/android-chrome-192x192.png"},
                    {"src": "/android-chrome-512x512.png?v=2"},
                ],
                "screenshots": [{"src": "images/install-shot.png#preview"}],
            }
        ),
        encoding="utf-8",
    )

    discovered = {path.as_posix() for path in MODULE.discover_web_app_assets(root)}
    assert discovered == {
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
        "apple-touch-icon.png",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "favicon.ico",
        "images/install-shot.png",
    }

    stats = MODULE.copy_web_app_assets(root, out)
    assert stats.files == len(discovered)
    for relative in discovered:
        assert (out / relative).is_file()


def test_missing_manifest_asset_fails_the_bundle(tmp_path: Path) -> None:
    root = tmp_path / "project"
    out = tmp_path / "bundle"
    root.mkdir()
    out.mkdir()
    (root / "site.webmanifest").write_text(
        json.dumps({"icons": [{"src": "/missing-icon.png"}]}),
        encoding="utf-8",
    )

    with pytest.raises(FileNotFoundError, match="missing-icon.png"):
        MODULE.copy_web_app_assets(root, out)


def test_manifest_path_traversal_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unsafe local asset reference"):
        MODULE.normalize_local_public_asset("../outside.png")


def test_line_endings_are_normalized_before_hashing(tmp_path: Path) -> None:
    windows_asset = tmp_path / "app.js"
    unix_asset = tmp_path / "app-lf.js"
    windows_asset.write_bytes(b"const one = 1;\r\nconst two = 2;\r\n")
    unix_asset.write_bytes(b"const one = 1;\nconst two = 2;\n")

    MODULE.normalize_fingerprinted_text(windows_asset)

    assert windows_asset.read_bytes() == unix_asset.read_bytes()
    assert MODULE.content_hash(windows_asset) == MODULE.content_hash(unix_asset)


def test_atomic_output_replacement_publishes_only_complete_staging_bundle(tmp_path: Path) -> None:
    out = tmp_path / "bundle"
    staging = MODULE.staging_output_dir(out)
    write_asset(out, "static/old.111111111111.js", b"old")
    write_asset(staging, "static/new.222222222222.js", b"new")

    MODULE.replace_output_dir(staging, out)

    assert not staging.exists()
    assert not (out / "static/old.111111111111.js").exists()
    assert (out / "static/new.222222222222.js").read_bytes() == b"new"
    assert not out.with_name(f".{out.name}.previous").exists()


def test_bundle_validation_rejects_stale_hash_generation(tmp_path: Path) -> None:
    out = tmp_path / "bundle"
    out.mkdir()
    source = out / "app.js"
    source.write_text("window.current = true;\n", encoding="utf-8")
    current_name = f"app.{MODULE.content_hash(source)}.js"
    static = out / "static"
    static.mkdir()
    source.rename(static / current_name)
    for page in MODULE.PAGE_DOCUMENTS:
        (out / page.filename).write_text(
            f'<script src="static/{current_name}"></script>',
            encoding="utf-8",
        )
    (static / "app.111111111111.js").write_text("window.old = true;\n", encoding="utf-8")

    with pytest.raises(ValueError, match="stale or unreferenced"):
        MODULE.validate_fingerprinted_bundle(out)


def test_public_html_routes_keep_original_cache_policy_and_include_404() -> None:
    headers = (ROOT / "_headers").read_text(encoding="utf-8")
    for route in (
        "/",
        "/index",
        "/index.html",
        "/catalog",
        "/catalog/",
        "/catalog.html",
        "/favorites",
        "/favorites/",
        "/favorites.html",
        "/viewer",
        "/viewer/",
        "/viewer.html",
        "/404",
        "/404.html",
    ):
        assert f"{route}\n  Cache-Control: no-store, max-age=0, must-revalidate" in headers

    assert "/static/*\n  Cache-Control: public, max-age=31536000, immutable" in headers
    assert "/assets/pages/*\n  Cache-Control: public, max-age=31536000, immutable" in headers
    assert "Cloudflare-CDN-Cache-Control" not in headers
    assert "CDN-Cache-Control" not in headers


def test_top_level_404_disables_pages_spa_fallback() -> None:
    error_page = ROOT / "404.html"
    assert error_page.is_file()
    content = error_page.read_text(encoding="utf-8").lower()
    assert "<!doctype html>" in content
    assert "<script" not in content
    assert "404.html" in MODULE.DEPLOY_FILES
