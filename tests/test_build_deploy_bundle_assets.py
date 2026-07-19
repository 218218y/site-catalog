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
    static = out / "static"
    static.mkdir()
    search = static / "catalogs.search.222222222222.js"
    search.write_text("window.search = true;\n", encoding="utf-8")
    valid_search_name = f"catalogs.search.{MODULE.content_hash(search)}.js"
    search.rename(static / valid_search_name)
    source = out / "app.js"
    source.write_text(
        f'const SEARCH_INDEX_SCRIPT_SRC = "static/{valid_search_name}";\nwindow.current = true;\n',
        encoding="utf-8",
    )
    current_name = f"app.{MODULE.content_hash(source)}.js"
    source.rename(static / current_name)
    for html_name in MODULE.FINGERPRINT_HTML_FILES:
        (out / html_name).write_text(
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
        "/favorites",
        "/favorites/",
        "/favorites.html",
        "/terms",
        "/terms/",
        "/terms.html",
        "/privacy",
        "/privacy/",
        "/privacy.html",
        "/404",
        "/404.html",
    ):
        assert f"{route}\n  Cache-Control: no-store, max-age=0, must-revalidate" in headers

    assert "/catalog/*\n  Cache-Control: no-store, max-age=0, must-revalidate" in headers
    assert "/catalog.html\n" not in headers
    assert "/viewer.html\n" not in headers
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


def test_css_asset_urls_are_rebased_before_fingerprinting(tmp_path: Path) -> None:
    out = tmp_path / "bundle"
    out.mkdir()
    write_asset(out, "brand-logo.svg", b"<svg></svg>")
    (out / "styles.css").write_text(
        ':root { --logo: url("brand-logo.svg"); }\n',
        encoding="utf-8",
    )
    for html_name in MODULE.FINGERPRINT_HTML_FILES:
        (out / html_name).write_text(
            '<link rel="stylesheet" href="styles.css">',
            encoding="utf-8",
        )

    rewrite_map = MODULE.fingerprint_bundle_assets(out)

    css_relative = Path(rewrite_map["styles.css"])
    css = (out / css_relative).read_text(encoding="utf-8")
    assert 'url("../brand-logo.svg")' in css
    assert (out / "brand-logo.svg").is_file()
    assert not (out / "static" / "brand-logo.svg").exists()
    assert MODULE.content_hash(out / css_relative) == css_relative.name.split(".")[-2]


def test_css_rebase_rejects_missing_local_dependencies(tmp_path: Path) -> None:
    root = tmp_path / "bundle"
    root.mkdir()
    css = root / "styles.css"
    css.write_text('.mark { background: url("missing.svg"); }\n', encoding="utf-8")

    with pytest.raises(FileNotFoundError, match="missing.svg"):
        MODULE.rebase_css_asset_urls(css, root / "static", root)


def test_search_index_is_fingerprinted_before_app_bundle(tmp_path: Path) -> None:
    out = tmp_path / "bundle"
    out.mkdir()
    (out / "catalogs.search.js").write_text("window.BARGIG_SEARCH = [];\n", encoding="utf-8")
    (out / "app.js").write_text('const SEARCH_INDEX_SCRIPT_SRC = "catalogs.search.js";\n', encoding="utf-8")

    relative = MODULE.fingerprint_search_index(out)

    assert relative.startswith("static/catalogs.search.")
    assert (out / relative).is_file()
    assert not (out / "catalogs.search.js").exists()
    assert f'const SEARCH_INDEX_SCRIPT_SRC = "{relative}";' in (out / "app.js").read_text(encoding="utf-8")


def test_search_index_validation_rejects_missing_dynamic_asset(tmp_path: Path) -> None:
    out = tmp_path / "bundle"
    out.mkdir()
    static = out / "static"
    static.mkdir()
    app = out / "app.js"
    app.write_text('const SEARCH_INDEX_SCRIPT_SRC = "static/catalogs.search.111111111111.js";\n', encoding="utf-8")
    app_name = f"app.{MODULE.content_hash(app)}.js"
    app.rename(static / app_name)
    for html_name in MODULE.FINGERPRINT_HTML_FILES:
        (out / html_name).write_text(f'<script src="static/{app_name}"></script>', encoding="utf-8")

    with pytest.raises(FileNotFoundError, match="catalogs.search"):
        MODULE.validate_fingerprinted_bundle(out)


def test_artifact_state_detects_source_changes_without_rebuilding(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    out = root / "dist" / "site-upload-r2"
    source = root / "src" / "input.js"
    write_asset(root, "src/input.js", b"one")
    write_asset(out, "index.html", b"<!doctype html>")

    monkeypatch.setattr(
        MODULE,
        "discover_build_input_paths",
        lambda project_root, include_big_pages_viewer=False: [source],
    )
    monkeypatch.setattr(MODULE, "validate_fingerprinted_bundle", lambda path: 0)
    options = MODULE.build_options_payload(
        external_assets_url="https://cdn.example.com",
        seo_mode="private",
    )
    inputs = MODULE.build_input_hashes(root)
    MODULE.write_artifact_state(root, out, inputs=inputs, options=options)

    current, reason = MODULE.artifact_is_current(root, out, options=options)
    assert current is True
    assert reason == "current"
    assert MODULE.artifact_state_path(out).parent == out.parent
    assert not (out / MODULE.artifact_state_path(out).name).exists()

    source.write_bytes(b"two")
    current, reason = MODULE.artifact_is_current(root, out, options=options)
    assert current is False
    assert "src/input.js" in reason


def test_mirror_artifact_reuses_one_validated_output(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    root = tmp_path / "project"
    source_dir = root / "dist" / "site-upload-r2"
    target_dir = root / "dist" / "site-local"
    source_input = root / "src" / "input.js"
    write_asset(root, "src/input.js", b"source")
    write_asset(source_dir, "index.html", b"<!doctype html><title>same</title>")

    monkeypatch.setattr(
        MODULE,
        "discover_build_input_paths",
        lambda project_root, include_big_pages_viewer=False: [source_input],
    )
    monkeypatch.setattr(MODULE, "validate_fingerprinted_bundle", lambda path: 0)
    options = MODULE.build_options_payload(
        external_assets_url="https://cdn.example.com",
        seo_mode="private",
    )
    MODULE.write_artifact_state(
        root,
        source_dir,
        inputs=MODULE.build_input_hashes(root),
        options=options,
    )

    assert MODULE.mirror_artifact(root, source_dir, target_dir) is True
    assert (target_dir / "index.html").read_bytes() == (source_dir / "index.html").read_bytes()
    assert MODULE.load_artifact_state(target_dir)["sourceSignature"] == MODULE.load_artifact_state(source_dir)["sourceSignature"]
    assert MODULE.mirror_artifact(root, source_dir, target_dir) is False


def test_legacy_seo_artifacts_are_removed_without_touching_canonical_outputs(tmp_path: Path) -> None:
    root = tmp_path / "project"
    write_asset(root, "dist/seo-private/old.html")
    write_asset(root, "dist/seo-public/old.html")
    write_asset(root, "dist/site-upload-r2/index.html")
    write_asset(root, "dist/site-local/index.html")

    removed = MODULE.clean_legacy_artifacts(root)

    assert removed == ["dist/seo-private", "dist/seo-public"]
    assert not (root / "dist/seo-private").exists()
    assert not (root / "dist/seo-public").exists()
    assert (root / "dist/site-upload-r2/index.html").is_file()
    assert (root / "dist/site-local/index.html").is_file()
