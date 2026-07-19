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


def copy_frontend_sources(target: Path) -> None:
    for relative in (*MODULE.JS_MODULES, *MODULE.CSS_MODULES):
        source = ROOT / relative
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def test_generated_frontend_assets_are_current() -> None:
    results = MODULE.build_frontend_assets(ROOT, check=True)
    assert {result.output.name for result in results} == {"app.js", "styles.css"}
    assert all(result.changed is False for result in results)


def test_frontend_manifest_uses_reviewed_feature_modules() -> None:
    assert MODULE.JS_MODULES == (
        "src/js/00-navigation.js",
        "src/js/10-app-state.js",
        "src/js/15-telemetry.js",
        "src/js/20-shared-ui.js",
        "src/js/30-favorites-share.js",
        "src/js/40-catalog-grid.js",
        "src/js/50-search-ui.js",
        "src/js/60-viewer.js",
        "src/js/62-viewer-actions.js",
        "src/js/65-viewer-onboarding.js",
        "src/js/70-viewer-input.js",
        "src/js/90-bootstrap.js",
    )
    assert MODULE.CSS_MODULES == (
        "src/css/00-foundation.css",
        "src/css/05-viewer-onboarding.css",
        "src/css/06-shell-components.css",
        "src/css/10-catalog.css",
        "src/css/20-viewer.css",
        "src/css/25-viewer-actions.css",
        "src/css/30-media-components.css",
        "src/css/40-catalog-refinements.css",
        "src/css/50-footer-legal.css",
        "src/css/80-responsive-shell.css",
        "src/css/85-favorites-routing.css",
        "src/css/90-visual-polish.css",
        "src/css/95-accessibility-consistency.css",
        "src/css/97-seo-foundation.css",
    )
    for relative in (*MODULE.JS_MODULES, *MODULE.CSS_MODULES):
        assert (ROOT / relative).is_file(), relative


def test_generated_bundle_preserves_declared_module_order() -> None:
    app = (ROOT / "app.js").read_text(encoding="utf-8")
    css = (ROOT / "styles.css").read_text(encoding="utf-8")

    app_positions = [app.index(f"BEGIN SOURCE: {relative}") for relative in MODULE.JS_MODULES]
    css_positions = [css.index(f"BEGIN SOURCE: {relative}") for relative in MODULE.CSS_MODULES]
    assert app_positions == sorted(app_positions)
    assert css_positions == sorted(css_positions)

    module_sources = {relative: (ROOT / relative).read_text(encoding="utf-8") for relative in MODULE.JS_MODULES}
    assert "function navigateWithinCurrentDocument" in module_sources["src/js/00-navigation.js"]
    assert "const state =" in module_sources["src/js/10-app-state.js"]
    assert "function telemetryInit" in module_sources["src/js/15-telemetry.js"]
    assert "function shareFavoritesList" in module_sources["src/js/30-favorites-share.js"]
    assert "function renderCatalogCards" in module_sources["src/js/40-catalog-grid.js"]
    assert "function renderSearchResults" in module_sources["src/js/50-search-ui.js"]
    assert "function openLightbox" in module_sources["src/js/60-viewer.js"]
    assert "function openViewerInquiry" in module_sources["src/js/62-viewer-actions.js"]
    assert "function showViewerOnboardingIfNeeded" in module_sources["src/js/65-viewer-onboarding.js"]
    assert "function startPointerInteraction" in module_sources["src/js/70-viewer-input.js"]
    assert "let initResult = true;" in module_sources["src/js/90-bootstrap.js"]
    assert "initResult = init();" in module_sources["src/js/90-bootstrap.js"]
    assert app.lstrip().startswith("/*")
    assert '\n(() => {\n"use strict";' in app
    assert app.rstrip().endswith("})();")


def test_manifest_validation_rejects_duplicates_and_unordered_modules() -> None:
    with pytest.raises(ValueError, match="Duplicate js"):
        MODULE.validate_module_manifest(("src/js/00-a.js", "src/js/00-a.js"), expected_extension="js")

    with pytest.raises(ValueError, match="strictly increasing"):
        MODULE.validate_module_manifest(("src/css/10-b.css", "src/css/05-a.css"), expected_extension="css")

    with pytest.raises(ValueError, match="NN-feature"):
        MODULE.validate_module_manifest(("src/js/viewer.js",), expected_extension="js")


def test_check_mode_detects_a_stale_generated_asset(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_frontend_sources(root)
    MODULE.build_frontend_assets(root)
    (root / "app.js").write_text("stale\n", encoding="utf-8")

    with pytest.raises(RuntimeError, match="app.js"):
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


def test_current_js_sources_have_unique_top_level_ownership() -> None:
    owners = MODULE.validate_js_module_boundaries(ROOT, MODULE.JS_MODULES)
    assert len(owners) >= 450
    assert owners["navigateTo"] == "src/js/00-navigation.js"
    assert owners["state"] == "src/js/10-app-state.js"
    assert owners["openLightbox"] == "src/js/60-viewer.js"
    assert owners["init"] == "src/js/90-bootstrap.js"
