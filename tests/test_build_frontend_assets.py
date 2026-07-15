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
        "src/js/20-shared-ui.js",
        "src/js/30-favorites-share.js",
        "src/js/40-catalog-grid.js",
        "src/js/50-search-ui.js",
        "src/js/60-viewer.js",
        "src/js/90-bootstrap.js",
    )
    assert MODULE.CSS_MODULES == (
        "src/css/00-foundation.css",
        "src/css/10-catalog.css",
        "src/css/20-viewer.css",
        "src/css/30-media-components.css",
        "src/css/40-catalog-refinements.css",
        "src/css/50-footer-legal.css",
        "src/css/90-responsive-polish.css",
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

    assert "function navigateWithinCurrentDocument" in (ROOT / MODULE.JS_MODULES[0]).read_text(encoding="utf-8")
    assert "const state =" in (ROOT / MODULE.JS_MODULES[1]).read_text(encoding="utf-8")
    assert "function shareFavoritesList" in (ROOT / MODULE.JS_MODULES[3]).read_text(encoding="utf-8")
    assert "function renderCatalogCards" in (ROOT / MODULE.JS_MODULES[4]).read_text(encoding="utf-8")
    assert "function renderSearchResults" in (ROOT / MODULE.JS_MODULES[5]).read_text(encoding="utf-8")
    assert "function openLightbox" in (ROOT / MODULE.JS_MODULES[6]).read_text(encoding="utf-8")
    assert "let initResult = true;" in (ROOT / MODULE.JS_MODULES[7]).read_text(encoding="utf-8")
    assert "initResult = init();" in (ROOT / MODULE.JS_MODULES[7]).read_text(encoding="utf-8")


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
