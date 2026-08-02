from __future__ import annotations

import importlib.util
import json
import os
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


def generated_graph_inputs(output_name: str) -> tuple[str, ...]:
    source = (ROOT / output_name).read_text(encoding="utf-8")
    graph = source.split(" * Bundled ES module graph:\n", 1)[1]
    graph = graph.split(" * External runtime modules:\n", 1)[0]
    graph = graph.split(" * Compiler virtual inputs:", 1)[0]
    return tuple(
        line.removeprefix(" *   - ")
        for line in graph.splitlines()
        if line.startswith(" *   - ")
    )


def all_source_modules() -> tuple[str, ...]:
    css_sources = (
        relative
        for spec in MODULE.BUNDLE_SPECS
        if spec.kind == "css"
        for relative in spec.modules
    )
    javascript_sources = (
        path.relative_to(ROOT).as_posix()
        for directory in (ROOT / "src/js", ROOT / "src/entries", ROOT / "src/runtime")
        for path in sorted(directory.glob("*.js"))
    )
    return tuple(dict.fromkeys((*css_sources, *javascript_sources, "catalog-snapshot.js")))


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
        "payment": ("styles.css", "app-payment.js"),
    }
    specs = {spec.output_name: spec for spec in MODULE.BUNDLE_SPECS}
    assert set(specs) == {
        "styles.css",
        "styles-catalog.css",
        "styles-favorites.css",
        "styles-viewer.css",
        "catalog-search.js",
        "tooltip-manager.js",
        "favorites-store.js",
        "site-routes.js",
        "app-catalog.js",
        "app-favorites.js",
        "app-viewer.js",
        "app-payment.js",
    }
    assert {
        output: specs[output].entrypoint
        for output in MODULE.RUNTIME_EXTERNAL_MODULES.values()
    } == {
        output: source
        for source, output in MODULE.RUNTIME_EXTERNAL_MODULES.items()
    }
    for output in MODULE.RUNTIME_EXTERNAL_MODULES.values():
        runtime_spec = specs[output]
        assert runtime_spec.kind == "runtime-js"
        assert runtime_spec.required_inputs == (runtime_spec.entrypoint,)
        assert runtime_spec.external_modules is None
        generated = (ROOT / output).read_text(encoding="utf-8")
        assert "Compiler virtual inputs: none" in generated
        assert "__BARGIG_FEATURE_CAPABILITIES__" not in generated

    catalog_inputs = generated_graph_inputs("app-catalog.js")
    favorites_inputs = generated_graph_inputs("app-favorites.js")
    viewer_inputs = generated_graph_inputs("app-viewer.js")
    payment_inputs = generated_graph_inputs("app-payment.js")
    assert specs["app-catalog.js"].entrypoint == "src/entries/catalog.js"
    assert specs["app-favorites.js"].entrypoint == "src/entries/favorites.js"
    assert specs["app-viewer.js"].entrypoint == "src/entries/viewer.js"
    assert specs["app-payment.js"].entrypoint == "src/entries/payment.js"
    assert payment_inputs == ("src/entries/payment.js",)

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
    assert "catalog-snapshot.js" not in catalog_inputs
    assert "catalog-snapshot.js" not in favorites_inputs
    assert "catalog-snapshot.js" in viewer_inputs

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
        "payment": set(),
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
        if route == "payment":
            assert "export {};" in source
        else:
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
            assert f"Cascade layer: {MODULE.CSS_CASCADE_LAYER}" in output
            assert output.count(f"@layer {MODULE.CSS_CASCADE_LAYER};") == 1
            assert output.count(f"@layer {MODULE.CSS_CASCADE_LAYER} {{") == 1
            assert output.rstrip().endswith("}")
            positions = [output.index(f"BEGIN SOURCE: {relative}") for relative in spec.modules]
            assert positions == sorted(positions), spec.output_name
            continue

        assert f"ES module entrypoint: {spec.entrypoint}" in output
        assert "Bundler: esbuild 0.28.1 (direct pinned devDependency)" in output
        for relative in spec.required_inputs:
            assert f" *   - {relative}" in output
        assert "Output format: native browser ES module" in output
        assert "\n(() => {" not in output
        assert "__BARGIG_TEST_EXPORTS__" not in output
        assert "TEST-ONLY EXPORTS" not in output


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
        "app-payment.js": {
            "required": {"src/entries/payment.js"},
            "forbidden": {"src/js/16-viewer-state.js", "src/js/35-favorites-workspace.js", "src/js/40-catalog-grid.js", "src/js/60-viewer.js"},
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


def test_viewer_css_manifest_keeps_onboarding_as_a_late_feature_override() -> None:
    modules = MODULE.VIEWER_CSS_MODULES

    assert "src/css/05-viewer-onboarding.css" not in modules
    assert modules.count("src/css/92-viewer-onboarding.css") == 1
    assert modules.index("src/css/90-visual-polish.css") < modules.index(
        "src/css/92-viewer-onboarding.css"
    )
    assert modules.index("src/css/92-viewer-onboarding.css") < modules.index(
        "src/css/95-accessibility-consistency.css"
    )


def test_js_spec_requires_an_entrypoint_and_required_boundaries(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    entry = root / "src/entries/catalog.js"
    entry.parent.mkdir(parents=True)
    entry.write_text("export {};\n", encoding="utf-8")

    missing_graph = MODULE.FrontendBundleSpec("app-catalog.js", "js", entrypoint="src/entries/catalog.js")
    with pytest.raises(ValueError, match="requires an entrypoint and required input boundaries"):
        MODULE.validate_js_spec(root, missing_graph)

    wrong_entry = MODULE.FrontendBundleSpec(
        "app-catalog.js",
        "js",
        entrypoint="src/js/00-navigation.js",
        required_inputs=("src/js/00-navigation.js",),
    )
    with pytest.raises(ValueError, match="src/entries"):
        MODULE.validate_js_spec(root, wrong_entry)



def test_esbuild_metafile_partitions_reviewed_sources_from_known_virtual_defines(tmp_path: Path) -> None:
    root = tmp_path / "project"
    source = root / "src/entries/catalog.js"
    source.parent.mkdir(parents=True)
    source.write_text("export {};\n", encoding="utf-8")

    physical, virtual = MODULE._partition_metafile_inputs(root, {
        "src/entries/catalog.js": {},
        "<define:__BARGIG_FEATURE_CAPABILITIES__>": {},
    })

    assert physical == ("src/entries/catalog.js",)
    assert virtual == ("<define:__BARGIG_FEATURE_CAPABILITIES__>",)

    with pytest.raises(RuntimeError, match="Unexpected esbuild virtual input"):
        MODULE._partition_metafile_inputs(root, {"<define:UNREVIEWED_DEFINE>": {}})



def test_render_javascript_bundle_accepts_esbuild_define_virtual_inputs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    entry = root / "src/entries/catalog.js"
    entry.parent.mkdir(parents=True)
    entry.write_text("export {};\n", encoding="utf-8")
    spec = MODULE.FrontendBundleSpec(
        "app-catalog.js",
        "js",
        entrypoint="src/entries/catalog.js",
        required_inputs=("src/entries/catalog.js",),
    )

    def fake_esbuild(command: list[str], **_kwargs: object) -> object:
        outfile = Path(command[command.index("--outfile") + 1])
        metafile = Path(command[command.index("--metafile") + 1])
        outfile.write_text("console.log('module');\n", encoding="utf-8")
        metafile.write_text(json.dumps({
            "inputs": {
                "src/entries/catalog.js": {},
                "<define:__BARGIG_FEATURE_CAPABILITIES__>": {},
            },
            "outputs": {
                "app-catalog.js": {"imports": []},
            },
        }), encoding="utf-8")
        return type("Completed", (), {"returncode": 0, "stderr": "", "stdout": ""})()

    monkeypatch.setattr(MODULE, "ensure_local_esbuild", lambda: None)
    monkeypatch.setattr(MODULE.subprocess, "run", fake_esbuild)
    output = MODULE.render_javascript_bundle(root, spec)

    assert "Output format: native browser ES module" in output
    assert "<define:__BARGIG_FEATURE_CAPABILITIES__>" in output
    assert "console.log('module');" in output




def test_css_bundle_strips_internal_comments_but_preserves_license_comments(tmp_path: Path) -> None:
    source = tmp_path / "src/css/00-a.css"
    source.parent.mkdir(parents=True)
    source.write_text(
        "/* internal architecture note */\n"
        "/*! retained license */\n"
        '.label::before { content: "/* visible text */"; }\n'
        ".a { color: red; }\n",
        encoding="utf-8",
    )
    spec = MODULE.FrontendBundleSpec("styles-test.css", "css", modules=("src/css/00-a.css",))

    output = MODULE.render_css_bundle(tmp_path, spec)

    assert "internal architecture note" not in output
    assert "/*! retained license */" in output
    assert 'content: "/* visible text */"' in output
    assert ".a { color: red; }" in output


def test_css_comment_scanner_rejects_unterminated_comments() -> None:
    with pytest.raises(ValueError, match="Unterminated CSS comment"):
        MODULE.strip_internal_css_comments(".a { color: red; } /* incomplete")


def test_css_line_end_whitespace_is_removed_without_touching_strings() -> None:
    source = '.a { color: red; }   \n.b::before { content: "value  "; }  \n'

    result = MODULE.strip_css_line_end_whitespace(source)

    assert result == '.a { color: red; }\n.b::before { content: "value  "; }\n'


@pytest.mark.skipif(os.name == "nt", reason="POSIX file modes are not portable to Windows")
def test_atomic_write_uses_readable_defaults_and_preserves_existing_mode(tmp_path: Path) -> None:
    output = tmp_path / "generated.css"

    assert MODULE.atomic_write_text(output, "first\n")
    assert output.stat().st_mode & 0o777 == 0o644

    output.chmod(0o640)
    assert MODULE.atomic_write_text(output, "second\n")
    assert output.stat().st_mode & 0o777 == 0o640


def test_css_cascade_layer_preserves_reviewed_module_order(tmp_path: Path) -> None:
    root = tmp_path / "project"
    module_a = root / "src/css/00-a.css"
    module_b = root / "src/css/10-b.css"
    module_a.parent.mkdir(parents=True)
    module_a.write_text(".same { color: red; }\n", encoding="utf-8")
    module_b.write_text(".same { color: blue; }\n", encoding="utf-8")
    spec = MODULE.FrontendBundleSpec(
        "styles-test.css",
        "css",
        modules=("src/css/00-a.css", "src/css/10-b.css"),
    )

    output = MODULE.render_css_bundle(root, spec)

    assert output.count(f"@layer {MODULE.CSS_CASCADE_LAYER};") == 1
    assert output.count(f"@layer {MODULE.CSS_CASCADE_LAYER} {{") == 1
    assert output.index("color: red") < output.index("color: blue")
    assert output.rstrip().endswith("}")

def test_check_mode_detects_a_stale_route_asset(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_frontend_sources(root)
    MODULE.build_frontend_assets(root)
    (root / "app-viewer.js").write_text("stale\n", encoding="utf-8")

    with pytest.raises(RuntimeError, match="app-viewer.js"):
        MODULE.build_frontend_assets(root, check=True)


def test_esbuild_graph_accepts_new_shared_dependencies_without_manifest_churn(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_frontend_sources(root)
    shared_helper = root / "src/js/17-shared-probe.js"
    shared_helper.write_text("globalThis.__sharedProbe = true;\n", encoding="utf-8")
    entry = root / "src/entries/catalog.js"
    entry.write_text('import "../js/17-shared-probe.js";\n' + entry.read_text(encoding="utf-8"), encoding="utf-8")

    output = MODULE.render_javascript_bundle(root, js_specs()["app-catalog.js"])

    assert " *   - src/js/17-shared-probe.js" in output


def test_esbuild_graph_rejects_a_new_disabled_capability_owner(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_frontend_sources(root)
    viewer_probe = root / "src/js/19-viewer-probe.js"
    viewer_probe.write_text("globalThis.__viewerProbe = true;\n", encoding="utf-8")
    entry = root / "src/entries/catalog.js"
    entry.write_text('import "../js/19-viewer-probe.js";\n' + entry.read_text(encoding="utf-8"), encoding="utf-8")

    with pytest.raises(RuntimeError, match="Disabled capability 'viewer' leaked"):
        MODULE.render_javascript_bundle(root, js_specs()["app-catalog.js"])


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
