from __future__ import annotations

import importlib.util
import json
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


def source_paths_for_spec(spec: object) -> tuple[str, ...]:
    return tuple(spec.expected_inputs if spec.kind == "js" else spec.modules)


def all_source_modules() -> tuple[str, ...]:
    return tuple(dict.fromkeys(
        relative
        for spec in MODULE.BUNDLE_SPECS
        for relative in source_paths_for_spec(spec)
    ))


def copy_frontend_sources(target: Path) -> None:
    for relative in all_source_modules():
        source = ROOT / relative
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def js_specs() -> dict[str, object]:
    return {spec.output_name: spec for spec in MODULE.BUNDLE_SPECS if spec.kind == "js"}


def css_specs() -> dict[str, object]:
    return {spec.output_name: spec for spec in MODULE.BUNDLE_SPECS if spec.kind == "css"}


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

    catalog_inputs = specs["app-catalog.js"].expected_inputs
    favorites_inputs = specs["app-favorites.js"].expected_inputs
    viewer_inputs = specs["app-viewer.js"].expected_inputs
    assert specs["app-catalog.js"].entrypoint == "src/entries/catalog.js"
    assert specs["app-favorites.js"].entrypoint == "src/entries/favorites.js"
    assert specs["app-viewer.js"].entrypoint == "src/entries/viewer.js"

    common_runtime_owners = {
        "src/js/02-dom-contracts.js",
        "src/js/03-runtime-context.js",
        "src/js/17-catalog-asset-urls.js",
        "src/js/80-app-shell.js",
    }
    for inputs in (catalog_inputs, favorites_inputs, viewer_inputs):
        assert common_runtime_owners.issubset(inputs)

    assert "src/js/16-viewer-state.js" not in catalog_inputs
    assert "src/js/16-viewer-state.js" not in favorites_inputs
    assert "src/js/52-viewer-session.js" not in catalog_inputs
    assert "src/js/52-viewer-session.js" not in favorites_inputs
    assert "src/js/35-favorites-workspace.js" not in catalog_inputs
    assert "src/js/29-favorites-portability.js" in catalog_inputs
    assert "src/js/39-search-catalog-domain.js" in catalog_inputs
    assert "src/js/35-favorites-workspace.js" in favorites_inputs
    assert "src/js/32-shared-inquiry.js" in favorites_inputs
    assert "src/js/32-shared-inquiry.js" in viewer_inputs
    assert "src/js/35-favorites-workspace.js" in viewer_inputs
    assert "src/js/39-search-catalog-domain.js" in viewer_inputs
    assert "src/js/40-catalog-grid.js" in viewer_inputs
    assert "src/js/31-viewer-share.js" in viewer_inputs

    for relative in all_source_modules():
        assert (ROOT / relative).is_file(), relative


def test_esbuild_is_an_exact_direct_reproducible_dependency() -> None:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))

    assert package["devDependencies"]["esbuild"] == "0.28.1"
    assert lock["packages"][""]["devDependencies"]["esbuild"] == "0.28.1"
    locked = lock["packages"]["node_modules/esbuild"]
    assert locked["version"] == "0.28.1"
    assert locked["resolved"].endswith("/esbuild-0.28.1.tgz")
    assert locked["integrity"].startswith("sha512-")
    linux_binary = lock["packages"]["node_modules/@esbuild/linux-x64"]
    assert linux_binary["version"] == "0.28.1"
    assert linux_binary["resolved"].endswith("/linux-x64-0.28.1.tgz")
    assert linux_binary["integrity"].startswith("sha512-")


def test_route_entrypoints_are_small_explicit_static_composition_roots() -> None:
    expectations = {
        "catalog": {"18-navigation-feature.js", "30-favorites-share.js", "40-catalog-grid.js", "50-search-ui.js", "80-app-shell.js", "90-bootstrap.js"},
        "favorites": {"18-navigation-feature.js", "30-favorites-share.js", "32-shared-inquiry.js", "35-favorites-workspace.js", "40-catalog-grid.js", "50-search-ui.js", "80-app-shell.js", "90-bootstrap.js"},
        "viewer": {"18-navigation-feature.js", "30-favorites-share.js", "31-viewer-share.js", "32-shared-inquiry.js", "35-favorites-workspace.js", "40-catalog-grid.js", "50-search-ui.js", "60-viewer.js", "80-app-shell.js", "90-bootstrap.js"},
    }
    for route, expected_names in expectations.items():
        path = ROOT / f"src/entries/{route}.js"
        source = path.read_text(encoding="utf-8")
        imports = {
            Path(line.split('"')[1]).name
            for line in source.splitlines()
            if line.startswith("import ")
        }
        assert imports == expected_names
        assert "import(" not in source
        assert "export " not in source


def test_every_runtime_owner_is_a_real_es_module() -> None:
    for source in sorted((ROOT / "src/js").glob("*.js")):
        text = source.read_text(encoding="utf-8")
        if source.name == "05-app-contracts.js":
            continue
        assert "import " in text or "export " in text, source.name
        assert "share one lexical scope" not in text
        assert "concatenates all sources" not in text


def test_shared_header_favorites_styles_ship_on_every_application_route() -> None:
    specs = css_specs()
    application_styles = ("styles-catalog.css", "styles-favorites.css", "styles-viewer.css")

    for output_name in application_styles:
        assert "src/css/06-shell-components.css" in specs[output_name].modules
        bundle = (ROOT / output_name).read_text(encoding="utf-8")
        assert ".header-favorites-button {" in bundle
        assert ".header-favorites-count {" in bundle
        start = bundle.index(".header-favorites-count {")
        assert "position: absolute;" in bundle[start:start + 420]

    catalog_bundle = (ROOT / "styles-catalog.css").read_text(encoding="utf-8")
    assert "BEGIN SOURCE: src/css/85-favorites-routing.css" not in catalog_bundle


def test_shared_floating_ui_styles_ship_on_every_application_route() -> None:
    specs = css_specs()
    shared_module = "src/css/08-shared-floating-ui.css"
    application_styles = ("styles-catalog.css", "styles-favorites.css", "styles-viewer.css")

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


def test_generated_bundles_publish_the_reviewed_esbuild_graph() -> None:
    for spec in MODULE.BUNDLE_SPECS:
        output = (ROOT / spec.output_name).read_text(encoding="utf-8")
        assert output.lstrip().startswith("/*")
        if spec.kind == "css":
            positions = [output.index(f"BEGIN SOURCE: {relative}") for relative in spec.modules]
            assert positions == sorted(positions), spec.output_name
            continue

        assert f"ES module entrypoint: {spec.entrypoint}" in output
        assert "Bundler: esbuild 0.28.1 (direct pinned devDependency)" in output
        for relative in spec.expected_inputs:
            assert f" *   - {relative}" in output
        assert "\n(() => {" in output
        assert output.rstrip().endswith("})();")
        assert "__BARGIG_TEST_EXPORTS__" not in output
        assert "TEST-ONLY EXPORTS" not in output
        assert "\nimport " not in output
        assert "\nexport " not in output


def test_route_bundles_keep_forbidden_features_physically_absent() -> None:
    expectations = {
        "app-catalog.js": {
            "required": {"src/js/39-search-catalog-domain.js", "src/js/40-catalog-grid.js", "src/js/50-search-ui.js"},
            "forbidden": {"src/js/16-viewer-state.js", "src/js/31-viewer-share.js", "src/js/35-favorites-workspace.js", "src/js/60-viewer.js"},
        },
        "app-favorites.js": {
            "required": {"src/js/32-shared-inquiry.js", "src/js/35-favorites-workspace.js", "src/js/40-catalog-grid.js"},
            "forbidden": {"src/js/16-viewer-state.js", "src/js/31-viewer-share.js", "src/js/60-viewer.js"},
        },
        "app-viewer.js": {
            "required": {"src/js/16-viewer-state.js", "src/js/31-viewer-share.js", "src/js/35-favorites-workspace.js", "src/js/40-catalog-grid.js", "src/js/60-viewer.js"},
            "forbidden": set(),
        },
    }
    for output_name, expectation in expectations.items():
        output = (ROOT / output_name).read_text(encoding="utf-8")
        for relative in expectation["required"]:
            assert f" *   - {relative}" in output
        for relative in expectation["forbidden"]:
            assert f" *   - {relative}" not in output


def test_manifest_validation_is_reserved_for_ordered_css_layers() -> None:
    with pytest.raises(ValueError, match="Duplicate css"):
        MODULE.validate_module_manifest(("src/css/00-a.css", "src/css/00-a.css"), expected_extension="css")

    with pytest.raises(ValueError, match="strictly increasing"):
        MODULE.validate_module_manifest(("src/css/10-b.css", "src/css/05-a.css"), expected_extension="css")

    with pytest.raises(ValueError, match="NN-feature"):
        MODULE.validate_module_manifest(("src/css/viewer.css",), expected_extension="css")


def test_js_spec_requires_an_entrypoint_and_reviewed_graph(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    entry = root / "src/entries/catalog.js"
    entry.parent.mkdir(parents=True)
    entry.write_text("export {};\n", encoding="utf-8")

    missing_graph = MODULE.FrontendBundleSpec("app-catalog.js", "js", entrypoint="src/entries/catalog.js")
    with pytest.raises(ValueError, match="requires an entrypoint and expected input graph"):
        MODULE.validate_js_spec(root, missing_graph)

    wrong_entry = MODULE.FrontendBundleSpec(
        "app-catalog.js",
        "js",
        entrypoint="src/js/00-navigation.js",
        expected_inputs=("src/js/00-navigation.js",),
    )
    with pytest.raises(ValueError, match="src/entries"):
        MODULE.validate_js_spec(root, wrong_entry)


def test_check_mode_detects_a_stale_route_asset(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_frontend_sources(root)
    MODULE.build_frontend_assets(root)
    (root / "app-viewer.js").write_text("stale\n", encoding="utf-8")

    with pytest.raises(RuntimeError, match="app-viewer.js"):
        MODULE.build_frontend_assets(root, check=True)


def test_esbuild_graph_rejects_an_unreviewed_transitive_dependency(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_frontend_sources(root)
    unexpected = root / "src/js/17-unreviewed.js"
    unexpected.write_text("export const unreviewed = true;\n", encoding="utf-8")
    entry = root / "src/entries/catalog.js"
    entry.write_text('import "../js/17-unreviewed.js";\n' + entry.read_text(encoding="utf-8"), encoding="utf-8")

    spec = js_specs()["app-catalog.js"]
    with pytest.raises(RuntimeError, match="Unexpected esbuild graph"):
        MODULE.render_javascript_bundle(root, spec)


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
