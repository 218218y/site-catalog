from __future__ import annotations

import importlib.util
import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location(
    "build_frontend_assets",
    TOOLS / "build_frontend_assets.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def all_source_modules() -> tuple[str, ...]:
    return tuple(dict.fromkeys(
        relative
        for spec in MODULE.BUNDLE_SPECS
        for relative in spec.modules
    ))


def copy_frontend_sources(target: Path) -> None:
    for relative in all_source_modules():
        source = ROOT / relative
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def test_generated_frontend_assets_are_current() -> None:
    results = MODULE.build_frontend_assets(ROOT, check=True)
    assert {result.output.name for result in results} == set(MODULE.GENERATED_FILES)
    assert all(result.changed is False for result in results)


def test_frontend_manifests_define_real_route_boundaries() -> None:
    assert MODULE.ROUTE_ASSETS == {
        "home": ("styles-catalog.css", "app-catalog.js"),
        "catalog": ("styles-catalog.css", "app-catalog.js"),
        "favorites": ("styles-favorites.css", "app-favorites.js"),
        "viewer": ("styles-viewer.css", "app-viewer.js"),
    }
    specs = {spec.output_name: spec for spec in MODULE.BUNDLE_SPECS}
    assert set(specs) == {
        "styles.css",
        "styles-catalog.css",
        "styles-favorites.css",
        "styles-viewer.css",
        "app-catalog.js",
        "app-favorites.js",
        "app-viewer.js",
    }

    catalog_modules = specs["app-catalog.js"].modules
    favorites_modules = specs["app-favorites.js"].modules
    viewer_modules = specs["app-viewer.js"].modules
    assert "src/js/16-viewer-state.js" not in catalog_modules
    assert "src/js/16-viewer-state.js" not in favorites_modules
    assert "src/js/52-viewer-session.js" not in catalog_modules
    assert "src/js/52-viewer-session.js" not in favorites_modules
    assert "src/js/35-favorites-workspace.js" not in catalog_modules
    assert "src/js/19-shared-pure.js" in catalog_modules
    assert "src/js/29-favorites-portability.js" in catalog_modules
    assert "src/js/39-search-catalog-domain.js" in catalog_modules
    assert "src/js/35-favorites-workspace.js" in favorites_modules
    assert "src/js/39-search-catalog-domain.js" in favorites_modules
    assert "src/js/32-shared-inquiry.js" in favorites_modules
    assert "src/js/32-shared-inquiry.js" in viewer_modules
    assert "src/js/35-favorites-workspace.js" in viewer_modules
    assert "src/js/39-search-catalog-domain.js" in viewer_modules
    assert "src/js/40-catalog-grid.js" in viewer_modules
    assert "src/js/31-viewer-share.js" in viewer_modules

    for relative in all_source_modules():
        assert (ROOT / relative).is_file(), relative


def test_shared_header_favorites_styles_ship_on_every_application_route() -> None:
    specs = {spec.output_name: spec for spec in MODULE.BUNDLE_SPECS}
    application_styles = (
        "styles-catalog.css",
        "styles-favorites.css",
        "styles-viewer.css",
    )

    for output_name in application_styles:
        assert "src/css/06-shell-components.css" in specs[output_name].modules
        bundle = (ROOT / output_name).read_text(encoding="utf-8")
        assert ".header-favorites-button {" in bundle
        assert ".header-favorites-count {" in bundle
        assert "position: absolute;" in bundle[bundle.index(".header-favorites-count {"):bundle.index(".header-favorites-count {") + 420]

    catalog_bundle = (ROOT / "styles-catalog.css").read_text(encoding="utf-8")
    assert "BEGIN SOURCE: src/css/85-favorites-routing.css" not in catalog_bundle


def test_shared_floating_ui_styles_ship_on_every_application_route() -> None:
    specs = {spec.output_name: spec for spec in MODULE.BUNDLE_SPECS}
    shared_module = "src/css/08-shared-floating-ui.css"
    application_styles = (
        "styles-catalog.css",
        "styles-favorites.css",
        "styles-viewer.css",
    )

    assert shared_module not in specs["styles.css"].modules
    for output_name in application_styles:
        assert shared_module in specs[output_name].modules
        bundle = (ROOT / output_name).read_text(encoding="utf-8")
        assert f"BEGIN SOURCE: {shared_module}" in bundle
        assert ".site-tooltip {" in bundle
        assert ".reader-catalog-menu {" in bundle
        assert ".reader-catalog-menu-item {" in bundle

    viewer_source = (ROOT / "src/css/20-viewer.css").read_text(encoding="utf-8")
    assert ".site-tooltip {" not in viewer_source
    assert "\n.reader-catalog-menu {" not in viewer_source


def test_generated_bundles_preserve_each_declared_module_order() -> None:
    for spec in MODULE.BUNDLE_SPECS:
        output = (ROOT / spec.output_name).read_text(encoding="utf-8")
        positions = [output.index(f"BEGIN SOURCE: {relative}") for relative in spec.modules]
        assert positions == sorted(positions), spec.output_name
        assert output.lstrip().startswith("/*")
        if spec.kind == "js":
            assert '\n(() => {\n"use strict";' in output
            assert output.rstrip().endswith("})();")


def test_production_javascript_strips_source_jsdoc_contracts() -> None:
    source = (ROOT / "src/js/05-app-contracts.js").read_text(encoding="utf-8")
    assert "@typedef" in source

    for output_name in ("app-catalog.js", "app-favorites.js", "app-viewer.js"):
        bundle = (ROOT / output_name).read_text(encoding="utf-8")
        assert "@typedef" not in bundle
        assert "@param" not in bundle
        assert "@returns" not in bundle


def test_production_javascript_strips_test_only_source_exports() -> None:
    source = (
        "const before = 1;\n"
        "/* TEST-ONLY EXPORTS: BEGIN */\n"
        "if (typeof __BARGIG_TEST_EXPORTS__ !== \"undefined\") {\n"
        "  __BARGIG_TEST_EXPORTS__[\"sample\"] = { before };\n"
        "}\n"
        "/* TEST-ONLY EXPORTS: END */\n"
        "const after = 2;\n"
    )

    rendered = MODULE.strip_source_jsdoc(source)

    assert "const before = 1;" in rendered
    assert "const after = 2;" in rendered
    assert "__BARGIG_TEST_EXPORTS__" not in rendered
    assert "TEST-ONLY EXPORTS" not in rendered

    for output_name in ("app-catalog.js", "app-favorites.js", "app-viewer.js"):
        bundle = (ROOT / output_name).read_text(encoding="utf-8")
        assert "__BARGIG_TEST_EXPORTS__" not in bundle
        assert "TEST-ONLY EXPORTS" not in bundle


def test_jsdoc_stripping_preserves_executable_and_comment_like_strings() -> None:
    source = (
        "/** build-time contract */\n"
        "const literal = `/** runtime text */`;\n"
        "/*! retained license */\n"
        "/** @param {string} value */\n"
        "function normalize(value) { return /** @type {string} */ (value); }\n"
    )

    rendered = MODULE.strip_source_jsdoc(source)

    assert "build-time contract" not in rendered
    assert "@param" not in rendered
    assert "@type" not in rendered
    assert "`/** runtime text */`" in rendered
    assert "/*! retained license */" in rendered
    assert "function normalize(value)" in rendered

    viewer_sources = {
        relative: (ROOT / relative).read_text(encoding="utf-8")
        for relative in next(spec.modules for spec in MODULE.BUNDLE_SPECS if spec.output_name == "app-viewer.js")
    }
    assert "function navigateWithinCurrentDocument" in viewer_sources["src/js/00-navigation.js"]
    assert "const featureInterfaces = new Map()" in viewer_sources["src/js/10-app-state.js"]
    assert "const viewerState =" in viewer_sources["src/js/16-viewer-state.js"]
    assert "function shareCurrentLightboxLink" in viewer_sources["src/js/31-viewer-share.js"]
    assert "function transitionViewerPhase" in viewer_sources["src/js/52-viewer-session.js"]
    assert "function showSingleLightboxImage" in viewer_sources["src/js/53-viewer-image.js"]
    assert "function applyZoom" in viewer_sources["src/js/54-viewer-geometry.js"]
    assert "function renderLightboxPageRail" in viewer_sources["src/js/56-viewer-shell.js"]
    assert "function handleViewerPageWheel" in viewer_sources["src/js/58-viewer-navigation.js"]
    assert "function openLightbox" in viewer_sources["src/js/60-viewer.js"]
    assert "let initResult = true;" in viewer_sources["src/js/90-bootstrap.js"]


def test_manifest_validation_rejects_duplicates_and_unordered_modules() -> None:
    with pytest.raises(ValueError, match="Duplicate js"):
        MODULE.validate_module_manifest(("src/js/00-a.js", "src/js/00-a.js"), expected_extension="js")

    with pytest.raises(ValueError, match="strictly increasing"):
        MODULE.validate_module_manifest(("src/css/10-b.css", "src/css/05-a.css"), expected_extension="css")

    with pytest.raises(ValueError, match="NN-feature"):
        MODULE.validate_module_manifest(("src/js/viewer.js",), expected_extension="js")


def test_check_mode_detects_a_stale_route_asset(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_frontend_sources(root)
    MODULE.build_frontend_assets(root)
    (root / "app-viewer.js").write_text("stale\n", encoding="utf-8")

    with pytest.raises(RuntimeError, match="app-viewer.js"):
        MODULE.build_frontend_assets(root, check=True)


def test_build_is_deterministic_and_does_not_emit_source_directories(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_frontend_sources(root)

    first = MODULE.build_frontend_assets(root)
    first_bytes = {result.output.name: result.output.read_bytes() for result in first}
    second = MODULE.build_frontend_assets(root)

    assert all(result.changed is False for result in second)
    assert first_bytes == {result.output.name: result.output.read_bytes() for result in second}
    assert not (root / "static").exists()


def test_js_module_boundary_validation_rejects_duplicate_top_level_names(tmp_path: Path) -> None:
    root = tmp_path / "project"
    first = root / "src/js/00-first.js"
    second = root / "src/js/10-second.js"
    first.parent.mkdir(parents=True)
    first.write_text(
        "/**\n * Source module: 00-first.js\n */\nfunction sharedName() {}\n",
        encoding="utf-8",
    )
    second.write_text(
        "/**\n * Source module: 10-second.js\n */\nconst sharedName = () => {};\n",
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="Duplicate top-level JavaScript declaration 'sharedName'"):
        MODULE.validate_js_module_boundaries(
            root,
            ("src/js/00-first.js", "src/js/10-second.js"),
        )


def test_js_module_boundary_validation_requires_an_accurate_header(tmp_path: Path) -> None:
    root = tmp_path / "project"
    source = root / "src/js/00-first.js"
    source.parent.mkdir(parents=True)
    source.write_text("function firstFeature() {}\n", encoding="utf-8")

    with pytest.raises(ValueError, match="header must identify"):
        MODULE.validate_js_module_boundaries(root, ("src/js/00-first.js",))


def test_current_route_sources_have_unique_top_level_ownership() -> None:
    specs = [spec for spec in MODULE.BUNDLE_SPECS if spec.kind == "js"]
    owners_by_bundle = {
        spec.output_name: MODULE.validate_js_module_boundaries(ROOT, spec.modules)
        for spec in specs
    }
    assert owners_by_bundle["app-catalog.js"]["navigateTo"] == "src/js/00-navigation.js"
    assert owners_by_bundle["app-catalog.js"]["catalogState"] == "src/js/12-catalog-state.js"
    assert owners_by_bundle["app-favorites.js"]["renderFavoritesWorkspace"] == "src/js/35-favorites-workspace.js"
    viewer_owners = owners_by_bundle["app-viewer.js"]
    assert viewer_owners["viewerState"] == "src/js/16-viewer-state.js"
    assert viewer_owners["transitionViewerPhase"] == "src/js/52-viewer-session.js"
    assert viewer_owners["showSingleLightboxImage"] == "src/js/53-viewer-image.js"
    assert viewer_owners["applyZoom"] == "src/js/54-viewer-geometry.js"
    assert viewer_owners["renderLightboxPageRail"] == "src/js/56-viewer-shell.js"
    assert viewer_owners["handleViewerPageWheel"] == "src/js/58-viewer-navigation.js"
    assert viewer_owners["openLightbox"] == "src/js/60-viewer.js"
    assert viewer_owners["init"] == "src/js/90-bootstrap.js"
