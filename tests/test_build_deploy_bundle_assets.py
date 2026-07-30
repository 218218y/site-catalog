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


def test_image_delivery_policy_is_part_of_bundle_freshness_inputs() -> None:
    inputs = {path.relative_to(ROOT).as_posix() for path in MODULE.discover_build_input_paths(ROOT)}
    assert "catalog-assets.config.js" in inputs
    assert "tools/catalog_image_policy.py" in inputs
    assert "tools/optimize_deploy_assets.mjs" in inputs


def test_catalog_authoritative_sources_and_compiler_are_bundle_freshness_inputs() -> None:
    inputs = {path.relative_to(ROOT).as_posix() for path in MODULE.discover_build_input_paths(ROOT)}
    for relative in (
        "catalogs.config.json",
        "catalog-taxonomy.config.json",
        "catalogs.build-state.json",
        "schemas/catalogs.config.schema.json",
        "schemas/catalogs.build-state.schema.json",
        "tools/catalog_compiler.py",
        "tools/catalog_schema.py",
    ):
        assert relative in inputs


def test_catalog_snapshot_is_bundled_into_viewer_not_deployed_standalone() -> None:
    inputs = {path.relative_to(ROOT).as_posix() for path in MODULE.discover_build_input_paths(ROOT)}

    assert "catalog-snapshot.js" in inputs
    assert "catalog-snapshot.js" not in MODULE.DEPLOY_FILES
    assert "catalog-snapshot.js" not in MODULE.OPTIONAL_DEPLOY_FILES
    assert "catalog-snapshot.js" not in MODULE.JSON_DEPLOY_FILES


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


def test_runtime_asset_config_preserves_full_only_delivery_mode(tmp_path: Path) -> None:
    root = tmp_path / "project"
    out = tmp_path / "bundle"
    root.mkdir()
    out.mkdir()
    (root / "catalog-assets.config.js").write_text(
        'window.BARGIG_CATALOG_ASSET_BASE_URL = "";\n'
        'window.BARGIG_CATALOG_IMAGE_DELIVERY_MODE = "full-only";\n',
        encoding="utf-8",
    )

    stats = MODULE.write_asset_config(root, out, "https://cdn.example.test/")
    generated = (out / "catalog-assets.config.js").read_text(encoding="utf-8")

    assert stats.files == 1
    assert 'window.BARGIG_CATALOG_ASSET_BASE_URL = "https://cdn.example.test/";' in generated
    assert 'window.BARGIG_CATALOG_IMAGE_DELIVERY_MODE = "full-only";' in generated


def test_runtime_asset_config_rejects_unknown_delivery_mode(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    (root / "catalog-assets.config.js").write_text(
        'window.BARGIG_CATALOG_IMAGE_DELIVERY_MODE = "mystery";\n',
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="Unsupported catalog image delivery mode"):
        MODULE.catalog_image_delivery_mode(root)


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


def write_search_runtime_bundle(out: Path) -> dict[str, Path]:
    static = out / "static"
    static.mkdir(parents=True, exist_ok=True)

    worker = static / "catalog-search-worker.js"
    worker.write_text("self.onmessage = () => {};\n", encoding="utf-8")
    worker_name = f"catalog-search-worker.{MODULE.content_hash(worker)}.js"
    worker = worker.rename(static / worker_name)

    index = static / "catalogs.search-index.json"
    index.write_text('{"version":1}\n', encoding="utf-8")
    index_name = f"catalogs.search-index.{MODULE.content_hash(index)}.json"
    index = index.rename(static / index_name)

    runtime_sources = {
        "catalog-search": (
            f'const SEARCH_WORKER_SCRIPT_SRC = "static/{worker_name}";\n'
            f'const SEARCH_INDEX_DATA_SRC = "{index_name}";\n'
            'export const catalogSearch = {};\n'
        ),
        "tooltip-manager": "export const tooltips = {};\n",
        "favorites-store": "export function createStore() { return {}; }\n",
        "site-routes": "export const siteRoutes = {};\n",
    }
    runtime_assets: dict[str, Path] = {}
    for stem, content in runtime_sources.items():
        runtime = static / f"{stem}.js"
        runtime.write_text(content, encoding="utf-8")
        runtime_name = f"{stem}.{MODULE.content_hash(runtime)}.js"
        runtime_assets[stem] = runtime.rename(static / runtime_name)

    runtime_imports = "".join(
        f'import "./{runtime_assets[stem].name}";\n'
        for stem in ("catalog-search", "tooltip-manager", "favorites-store", "site-routes")
    )
    route_apps: dict[str, Path] = {}
    for stem in ("app-catalog", "app-favorites", "app-viewer"):
        app = static / f"{stem}.js"
        app.write_text(runtime_imports + f"window.{stem.replace('-', '_')} = true;\n", encoding="utf-8")
        app_name = f"{stem}.{MODULE.content_hash(app)}.js"
        route_apps[stem] = app.rename(static / app_name)

    documents = {
        "index.html": route_apps["app-catalog"],
        "favorites.html": route_apps["app-favorites"],
        "viewer.html": route_apps["app-viewer"],
        "nested/index.html": route_apps["app-catalog"],
    }
    for html_name, app in documents.items():
        html = out / html_name
        html.parent.mkdir(parents=True, exist_ok=True)
        html.write_text(
            f'<script type="module" src="static/{app.name}"></script>',
            encoding="utf-8",
        )
    return {
        **route_apps,
        **runtime_assets,
        "worker": worker,
        "index": index,
    }


def test_bundle_validation_rejects_stale_hash_generation(tmp_path: Path) -> None:
    out = tmp_path / "bundle"
    assets = write_search_runtime_bundle(out)
    (out / "static/app-catalog.111111111111.js").write_text("window.old = true;\n", encoding="utf-8")

    with pytest.raises(ValueError, match="stale or unreferenced"):
        MODULE.validate_fingerprinted_bundle(out)


def test_bundle_validation_hashes_each_shared_asset_once(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    out = tmp_path / "bundle"
    assets = write_search_runtime_bundle(out)
    real_content_hash = MODULE.content_hash
    hash_calls: dict[Path, int] = {}

    def counting_content_hash(path: Path, length: int = 12) -> str:
        hash_calls[path] = hash_calls.get(path, 0) + 1
        return real_content_hash(path, length)

    monkeypatch.setattr(MODULE, "content_hash", counting_content_hash)

    assert MODULE.validate_fingerprinted_bundle(out) == 9
    assert hash_calls == {path: 1 for path in assets.values()}


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
    (out / "styles.css").write_bytes(
        b':root { --logo: url("brand-logo.svg"); }\r\n'
        b'.brand { background-image: var(--logo); }\r\n'
    )
    for html_name in MODULE.FINGERPRINT_HTML_FILES:
        (out / html_name).write_text(
            '<link rel="stylesheet" href="styles.css">',
            encoding="utf-8",
        )

    rewrite_map = MODULE.fingerprint_bundle_assets(out)

    css_relative = Path(rewrite_map["styles.css"])
    css_path = out / css_relative
    css_bytes = css_path.read_bytes()
    css = css_bytes.decode("utf-8")
    assert 'url("../brand-logo.svg")' in css
    assert b"\r" not in css_bytes
    assert (out / "brand-logo.svg").is_file()
    assert not (out / "static" / "brand-logo.svg").exists()
    assert MODULE.content_hash(css_path) == css_relative.name.split(".")[-2]


def test_css_rebase_rejects_missing_local_dependencies(tmp_path: Path) -> None:
    root = tmp_path / "bundle"
    root.mkdir()
    css = root / "styles.css"
    css.write_text('.mark { background: url("missing.svg"); }\n', encoding="utf-8")

    with pytest.raises(FileNotFoundError, match="missing.svg"):
        MODULE.rebase_css_asset_urls(css, root / "static", root)


def test_search_runtime_assets_are_fingerprinted_before_runtime_bundle(tmp_path: Path) -> None:
    out = tmp_path / "bundle"
    out.mkdir()
    (out / "catalog-search-worker.js").write_text("self.onmessage = () => {};\n", encoding="utf-8")
    (out / "catalogs.search-index.json").write_text('{"version":1}\n', encoding="utf-8")
    (out / "catalog-search.js").write_text(
        'const SEARCH_WORKER_SCRIPT_SRC = "catalog-search-worker.js";\n'
        'const SEARCH_INDEX_DATA_SRC = "catalogs.search-index.json";\n',
        encoding="utf-8",
    )

    relatives = MODULE.fingerprint_search_runtime_assets(out)

    assert relatives["catalog-search-worker.js"].startswith("static/catalog-search-worker.")
    assert relatives["catalogs.search-index.json"].startswith("static/catalogs.search-index.")
    assert not (out / "catalog-search-worker.js").exists()
    assert not (out / "catalogs.search-index.json").exists()
    runtime = (out / "catalog-search.js").read_text(encoding="utf-8")
    assert f'const SEARCH_WORKER_SCRIPT_SRC = "{relatives["catalog-search-worker.js"]}";' in runtime
    assert f'const SEARCH_INDEX_DATA_SRC = "{Path(relatives["catalogs.search-index.json"]).name}";' in runtime
    assert 'static/static/' not in runtime


def test_minified_search_runtime_keeps_valid_fingerprinted_dynamic_urls(tmp_path: Path) -> None:
    out = tmp_path / "bundle"
    for relative in ("catalog-search.js", "catalog-search-worker.js", "catalogs.search-index.json"):
        write_asset(out, relative, (ROOT / relative).read_bytes())

    worker_stats = MODULE.optimize_deploy_assets(
        out,
        ({"path": "catalog-search-worker.js", "kind": "script"},),
    )
    targets = MODULE.fingerprint_search_runtime_assets(out)
    runtime_stats = MODULE.optimize_deploy_assets(
        out,
        MODULE.DEPLOY_OPTIMIZATION_POST_SEARCH_ASSETS,
    )
    runtime = (out / "catalog-search.js").read_text(encoding="utf-8")

    assert worker_stats.bytes_after < worker_stats.bytes_before
    assert runtime_stats.bytes_after < runtime_stats.bytes_before
    assert MODULE.FINGERPRINTED_SEARCH_WORKER_URL_RE.search(runtime).group("url") == targets["catalog-search-worker.js"]
    assert MODULE.FINGERPRINTED_SEARCH_INDEX_URL_RE.search(runtime).group("url") == Path(
        targets["catalogs.search-index.json"]
    ).name
    assert "SEARCH_WORKER_SCRIPT_SRC" not in runtime
    assert "SEARCH_INDEX_DATA_SRC" not in runtime


def test_search_runtime_validation_rejects_missing_dynamic_asset(tmp_path: Path) -> None:
    out = tmp_path / "bundle"
    assets = write_search_runtime_bundle(out)
    assets["index"].unlink()

    with pytest.raises(FileNotFoundError, match="catalogs.search-index"):
        MODULE.validate_fingerprinted_bundle(out)


def test_deployment_release_id_is_shared_deterministic_and_option_sensitive() -> None:
    inputs = {"src/js/15-telemetry.js": "a" * 64}
    private_options = MODULE.build_options_payload(
        external_assets_url="https://cdn.example.com",
        seo_mode="private",
    )
    public_options = MODULE.build_options_payload(
        external_assets_url="https://cdn.example.com",
        seo_mode="public",
    )

    first = MODULE.deployment_release_id(inputs, private_options)
    second = MODULE.deployment_release_id(dict(inputs), dict(private_options))
    changed = MODULE.deployment_release_id(inputs, public_options)

    assert first == second
    assert first.startswith("deploy-")
    assert len(first) == len("deploy-") + 16
    assert changed != first


def test_deploy_code_assets_receive_production_only_standard_minification(tmp_path: Path) -> None:
    out = tmp_path / "bundle"
    specs = (
        *MODULE.DEPLOY_OPTIMIZATION_PRE_SEARCH_ASSETS,
        *MODULE.DEPLOY_OPTIMIZATION_POST_SEARCH_ASSETS,
    )
    source_contents: dict[str, bytes] = {}
    for spec in specs:
        relative = spec["path"]
        source = ROOT / relative
        content = source.read_bytes()
        source_contents[relative] = content
        write_asset(out, relative, content)

    release_id = "deploy-0123456789abcdef"
    MODULE.stamp_deployment_release_id(out, release_id)
    stats = MODULE.combine_optimization_stats(
        MODULE.optimize_deploy_assets(out, MODULE.DEPLOY_OPTIMIZATION_PRE_SEARCH_ASSETS),
        MODULE.optimize_deploy_assets(out, MODULE.DEPLOY_OPTIMIZATION_POST_SEARCH_ASSETS),
    )

    assert stats.files == len(specs)
    assert stats.bytes_after < stats.bytes_before
    assert stats.bytes_saved == stats.bytes_before - stats.bytes_after
    assert MODULE.build_options_payload(
        external_assets_url="https://cdn.example.com",
        seo_mode="private",
    )["frontendOptimizationProfile"] == MODULE.DEPLOY_OPTIMIZATION_PROFILE

    for spec in specs:
        relative = spec["path"]
        optimized = (out / relative).read_text(encoding="utf-8")
        source_text = source_contents[relative].decode("utf-8")
        assert (ROOT / relative).read_bytes() == source_contents[relative]
        assert (out / relative).stat().st_size < len(source_contents[relative]) + 80
        assert "sourceMappingURL=" not in optimized
        assert optimized.endswith("\n")
        if source_text.count("\n") >= 10:
            assert optimized.count("\n") < source_text.count("\n") // 5
        if spec["kind"] == "esm":
            if relative in MODULE.DEPLOY_APP_FILES:
                assert f'window.__BARGIG_RELEASE_ID__="{release_id}"' in optimized
                assert optimized.count(f'window.__BARGIG_RELEASE_ID__="{release_id}"') == 1
            else:
                assert "__BARGIG_RELEASE_ID__" not in optimized
            assert "GENERATED FILE — DO NOT EDIT DIRECTLY" not in optimized
        elif spec["kind"] == "css" and relative.startswith("styles"):
            assert "@layer bargig.application" in optimized
            assert "BEGIN SOURCE:" not in optimized


def test_deploy_optimizer_fails_before_partial_output_when_an_asset_is_missing(
    tmp_path: Path,
) -> None:
    out = tmp_path / "bundle"
    specs = MODULE.DEPLOY_OPTIMIZATION_PRE_SEARCH_ASSETS
    first = specs[0]["path"]
    write_asset(out, first, (ROOT / first).read_bytes())
    original = (out / first).read_bytes()

    with pytest.raises(FileNotFoundError, match="Cannot optimize missing deploy assets"):
        MODULE.optimize_deploy_assets(out, specs)

    assert (out / first).read_bytes() == original


def test_deploy_optimizer_commits_nothing_when_esbuild_rejects_one_asset(
    tmp_path: Path,
) -> None:
    out = tmp_path / "bundle"
    specs = MODULE.DEPLOY_OPTIMIZATION_PRE_SEARCH_ASSETS
    originals: dict[str, bytes] = {}
    for spec in specs:
        relative = spec["path"]
        content = (
            b".component { color: red; padding: 0 1rem; }\n"
            if spec["kind"] == "css"
            else b"const descriptiveLocalName = 1; window.example = descriptiveLocalName;\n"
        )
        originals[relative] = content
        write_asset(out, relative, content)
    broken = next(spec["path"] for spec in reversed(specs) if spec["kind"] != "css")
    write_asset(out, broken, b"const = ;\n")
    originals[broken] = b"const = ;\n"

    with pytest.raises(RuntimeError, match="Deploy asset optimization failed"):
        MODULE.optimize_deploy_assets(out, specs)

    for relative, content in originals.items():
        assert (out / relative).read_bytes() == content


def test_route_bundles_receive_one_shared_replaceable_release_stamp(tmp_path: Path) -> None:
    out = tmp_path / "bundle"
    for relative in MODULE.DEPLOY_APP_FILES:
        write_asset(out, relative, f"window.route = {relative!r};\n".encode())

    first = "deploy-0123456789abcdef"
    second = "deploy-fedcba9876543210"
    assert MODULE.stamp_deployment_release_id(out, first) == len(MODULE.DEPLOY_APP_FILES)
    for relative in MODULE.DEPLOY_APP_FILES:
        content = (out / relative).read_text(encoding="utf-8")
        assert content.startswith(f'window.__BARGIG_RELEASE_ID__ = "{first}";\n')
        assert content.count("window.__BARGIG_RELEASE_ID__") == 1

    assert MODULE.stamp_deployment_release_id(out, second) == len(MODULE.DEPLOY_APP_FILES)
    for relative in MODULE.DEPLOY_APP_FILES:
        content = (out / relative).read_text(encoding="utf-8")
        assert content.startswith(f'window.__BARGIG_RELEASE_ID__ = "{second}";\n')
        assert first not in content
        assert content.count("window.__BARGIG_RELEASE_ID__") == 1

    with pytest.raises(ValueError, match="Invalid deployment release id"):
        MODULE.stamp_deployment_release_id(out, "release-custom")


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
    state = MODULE.load_artifact_state(out)
    assert state and state["releaseId"] == MODULE.deployment_release_id(inputs, options)
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
    write_asset(root, "dist/site-e2e/old.html")
    write_asset(root, "dist/site-e2e.build.json", b"{}")
    write_asset(root, ".artifacts/public-seo-preview/old.html")
    write_asset(root, ".artifacts/public-seo-preview.build.json", b"{}")
    write_asset(root, ".artifacts/public-seo-preview.audit.json", b"{}")
    write_asset(root, "dist/site-upload-r2/index.html")
    write_asset(root, "dist/site-local/index.html")

    removed = MODULE.clean_legacy_artifacts(root)

    assert removed == [
        "dist/seo-private",
        "dist/seo-public",
        "dist/site-e2e",
        ".artifacts/public-seo-preview",
    ]
    assert not (root / "dist/seo-private").exists()
    assert not (root / "dist/seo-public").exists()
    assert not (root / "dist/site-e2e").exists()
    assert not (root / "dist/site-e2e.build.json").exists()
    assert not (root / ".artifacts/public-seo-preview").exists()
    assert not (root / ".artifacts/public-seo-preview.build.json").exists()
    assert not (root / ".artifacts/public-seo-preview.audit.json").exists()
    assert (root / "dist/site-upload-r2/index.html").is_file()
    assert (root / "dist/site-local/index.html").is_file()
