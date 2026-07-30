#!/usr/bin/env python3
"""Build deterministic route-specific browser assets.

JavaScript is authored as native ES modules under ``src/js`` and ``src/runtime``.
Each route has a small entrypoint under ``src/entries`` and imports shared runtime
modules as external browser modules. The pinned esbuild dependency emits both
the route bundles and the separately cacheable runtime assets under their historical names. Existing fullscreen-safe in-document routing remains
unchanged while every source dependency is explicit and statically validated.

CSS remains a reviewed ordered cascade inside one explicit application layer;
source order remains part of its runtime contract. All generated files are written atomically. ``--check``
performs no writes and fails when any generated asset is stale.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence

CORE_CSS_MODULES: tuple[str, ...] = (
    "src/css/00-foundation.css", "src/css/06-shell-components.css",
    "src/css/30-media-components.css", "src/css/50-footer-legal.css",
    "src/css/80-responsive-shell.css", "src/css/90-visual-polish.css",
    "src/css/95-accessibility-consistency.css", "src/css/97-seo-foundation.css",
)
CATALOG_CSS_MODULES: tuple[str, ...] = (
    "src/css/00-foundation.css", "src/css/06-shell-components.css",
    "src/css/08-shared-floating-ui.css", "src/css/10-catalog.css",
    "src/css/30-media-components.css", "src/css/40-catalog-refinements.css",
    "src/css/50-footer-legal.css", "src/css/80-responsive-shell.css",
    "src/css/90-visual-polish.css", "src/css/95-accessibility-consistency.css",
    "src/css/97-seo-foundation.css",
)
FAVORITES_CSS_MODULES: tuple[str, ...] = (
    "src/css/00-foundation.css", "src/css/06-shell-components.css",
    "src/css/08-shared-floating-ui.css", "src/css/10-catalog.css",
    "src/css/24-shared-inquiry.css", "src/css/30-media-components.css",
    "src/css/40-catalog-refinements.css", "src/css/50-footer-legal.css",
    "src/css/80-responsive-shell.css", "src/css/85-favorites-routing.css",
    "src/css/87-favorites-workspace.css", "src/css/90-visual-polish.css",
    "src/css/95-accessibility-consistency.css", "src/css/97-seo-foundation.css",
)
VIEWER_CSS_MODULES: tuple[str, ...] = (
    "src/css/00-foundation.css", "src/css/05-viewer-onboarding.css",
    "src/css/06-shell-components.css", "src/css/08-shared-floating-ui.css",
    "src/css/10-catalog.css", "src/css/20-viewer.css",
    "src/css/24-shared-inquiry.css", "src/css/25-viewer-actions.css",
    "src/css/30-media-components.css", "src/css/40-catalog-refinements.css",
    "src/css/50-footer-legal.css", "src/css/80-responsive-shell.css",
    "src/css/85-favorites-routing.css", "src/css/87-favorites-workspace.css",
    "src/css/90-visual-polish.css", "src/css/95-accessibility-consistency.css",
    "src/css/97-seo-foundation.css",
)


RUNTIME_EXTERNAL_MODULES: Mapping[str, str] = {
    "src/runtime/catalog-search.js": "catalog-search.js",
    "src/runtime/tooltip-manager.js": "tooltip-manager.js",
    "src/runtime/favorites-store.js": "favorites-store.js",
    "src/runtime/site-routes.js": "site-routes.js",
}
CATALOG_JS_INPUTS: tuple[str, ...] = (
    "src/entries/catalog.js", "src/js/00-navigation.js", "src/js/01-route-capabilities.js",
    "src/js/02-dom-contracts.js", "src/js/03-runtime-context.js", "src/js/06-catalog-page-numbering.js", "src/js/10-app-state.js", "src/js/11-navigation-state.js", "src/js/12-catalog-state.js",
    "src/js/13-search-state.js", "src/js/14-favorites-state.js", "src/js/15-telemetry.js",
    "src/js/17-catalog-asset-urls.js", "src/js/18-navigation-feature.js", "src/js/20-shared-ui.js",
    "src/js/29-favorites-portability.js", "src/js/30-favorites-share.js",
    "src/js/39-search-catalog-domain.js", "src/js/40-catalog-grid.js",
    "src/js/50-search-ui.js", "src/js/80-app-shell.js", "src/js/90-bootstrap.js",
)
FAVORITES_JS_INPUTS: tuple[str, ...] = (
    "src/entries/favorites.js", "src/js/00-navigation.js", "src/js/01-route-capabilities.js",
    "src/js/02-dom-contracts.js", "src/js/03-runtime-context.js", "src/js/06-catalog-page-numbering.js", "src/js/10-app-state.js", "src/js/11-navigation-state.js", "src/js/12-catalog-state.js",
    "src/js/13-search-state.js", "src/js/14-favorites-state.js", "src/js/15-telemetry.js",
    "src/js/17-catalog-asset-urls.js", "src/js/18-navigation-feature.js", "src/js/19-shared-pure.js", "src/js/20-shared-ui.js",
    "src/js/29-favorites-portability.js", "src/js/30-favorites-share.js",
    "src/js/32-shared-inquiry.js", "src/js/35-favorites-workspace.js",
    "src/js/39-search-catalog-domain.js", "src/js/40-catalog-grid.js",
    "src/js/50-search-ui.js", "src/js/80-app-shell.js", "src/js/90-bootstrap.js",
)
VIEWER_JS_INPUTS: tuple[str, ...] = (
    "src/entries/viewer.js", "src/js/00-navigation.js", "src/js/01-route-capabilities.js",
    "src/js/02-dom-contracts.js", "src/js/03-runtime-context.js", "src/js/06-catalog-page-numbering.js", "src/js/10-app-state.js", "src/js/11-navigation-state.js", "src/js/12-catalog-state.js",
    "src/js/13-search-state.js", "src/js/14-favorites-state.js", "src/js/15-telemetry.js",
    "src/js/16-viewer-state.js", "src/js/17-catalog-asset-urls.js", "src/js/18-navigation-feature.js", "src/js/19-shared-pure.js",
    "src/js/20-shared-ui.js", "src/js/29-favorites-portability.js",
    "src/js/30-favorites-share.js", "src/js/31-viewer-share.js",
    "src/js/32-shared-inquiry.js", "src/js/35-favorites-workspace.js",
    "src/js/39-search-catalog-domain.js", "src/js/40-catalog-grid.js",
    "src/js/50-search-ui.js", "src/js/52-viewer-session.js", "src/js/53-viewer-image.js",
    "src/js/54-viewer-geometry.js", "src/js/56-viewer-shell.js",
    "src/js/58-viewer-navigation.js", "src/js/60-viewer.js",
    "src/js/62-viewer-actions.js", "src/js/65-viewer-onboarding.js",
    "src/js/70-viewer-input.js", "src/js/80-app-shell.js", "src/js/90-bootstrap.js",
    "catalog-snapshot.js",
)

@dataclass(frozen=True)
class FrontendBundleSpec:
    output_name: str
    kind: str
    modules: tuple[str, ...] = ()
    entrypoint: str | None = None
    expected_inputs: tuple[str, ...] = ()
    capabilities: Mapping[str, bool] | None = None
    external_modules: Mapping[str, str] | None = None

BUNDLE_SPECS: tuple[FrontendBundleSpec, ...] = (
    FrontendBundleSpec("styles.css", "css", CORE_CSS_MODULES),
    FrontendBundleSpec("styles-catalog.css", "css", CATALOG_CSS_MODULES),
    FrontendBundleSpec("styles-favorites.css", "css", FAVORITES_CSS_MODULES),
    FrontendBundleSpec("styles-viewer.css", "css", VIEWER_CSS_MODULES),
    *(FrontendBundleSpec(
        output_name,
        "runtime-js",
        entrypoint=source_path,
        expected_inputs=(source_path,),
    ) for source_path, output_name in RUNTIME_EXTERNAL_MODULES.items()),
    FrontendBundleSpec("app-catalog.js", "js", entrypoint="src/entries/catalog.js",
        expected_inputs=CATALOG_JS_INPUTS, external_modules=RUNTIME_EXTERNAL_MODULES,
        capabilities={"viewer": False, "favoritesWorkspace": False, "catalogGrid": True, "search": True}),
    FrontendBundleSpec("app-favorites.js", "js", entrypoint="src/entries/favorites.js",
        expected_inputs=FAVORITES_JS_INPUTS, external_modules=RUNTIME_EXTERNAL_MODULES,
        capabilities={"viewer": False, "favoritesWorkspace": True, "catalogGrid": True, "search": True}),
    FrontendBundleSpec("app-viewer.js", "js", entrypoint="src/entries/viewer.js",
        expected_inputs=VIEWER_JS_INPUTS, external_modules=RUNTIME_EXTERNAL_MODULES,
        capabilities={"viewer": True, "favoritesWorkspace": True, "catalogGrid": True, "search": True}),
)

GENERATED_FILES = tuple(spec.output_name for spec in BUNDLE_SPECS)
DEPLOY_GENERATED_FILES = GENERATED_FILES
ROUTE_GENERATED_FILES = tuple(
    spec.output_name for spec in BUNDLE_SPECS
    if spec.kind == "css" or spec.output_name.startswith("app-")
)
GENERATED_JS_FILES = tuple(spec.output_name for spec in BUNDLE_SPECS if spec.kind in {"js", "runtime-js"})
GENERATED_CSS_FILES = tuple(spec.output_name for spec in BUNDLE_SPECS if spec.kind == "css")
ROUTE_ASSETS: Mapping[str, tuple[str, str]] = {
    "home": ("styles-catalog.css", "app-catalog.js"),
    "catalog": ("styles-catalog.css", "app-catalog.js"),
    "favorites": ("styles-favorites.css", "app-favorites.js"),
    "viewer": ("styles-viewer.css", "app-viewer.js"),
}

MODULE_NAME_PATTERN = re.compile(r"^(?P<order>\d{2})-[a-z0-9-]+\.(?P<extension>js|css)$")
ESBUILD_RUNNER = Path(__file__).with_name("build_frontend_esbuild.mjs")
CSS_CASCADE_LAYER = "bargig.application"


def ensure_local_esbuild() -> None:
    """Provision only the pinned local esbuild packages when they are absent."""

    try:
        from bootstrap_esbuild_offline import (
            CORE_ARCHIVE,
            PLATFORM_ARCHIVES,
            current_platform_key,
            install_esbuild,
            installation_is_current,
        )
    except ImportError as error:
        raise RuntimeError("Cannot load the repository-local esbuild bootstrap") from error

    root = project_root()
    try:
        platform_spec = PLATFORM_ARCHIVES[current_platform_key()]
    except RuntimeError as error:
        raise RuntimeError(str(error)) from error
    if installation_is_current(root, CORE_ARCHIVE) and installation_is_current(root, platform_spec):
        return
    try:
        install_esbuild(root, verify_runtime=False, quiet=True)
    except RuntimeError as error:
        raise RuntimeError(
            "esbuild is unavailable and the verified offline bootstrap failed: " + str(error)
        ) from error

@dataclass(frozen=True)
class FrontendBuildResult:
    output: Path
    modules: int
    bytes: int
    changed: bool
    digest: str


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def normalize_text(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n"


def read_source_module(root: Path, relative_path: str) -> str:
    path = root / relative_path
    if not path.is_file():
        raise FileNotFoundError(f"Frontend source module is missing: {relative_path}")
    content = normalize_text(path.read_text(encoding="utf-8-sig"))
    if not content.strip():
        raise ValueError(f"Frontend source module is empty: {relative_path}")
    return content


def validate_module_manifest(module_paths: Sequence[str], *, expected_extension: str) -> None:
    if len(module_paths) != len(set(module_paths)):
        raise ValueError(f"Duplicate {expected_extension} source module in frontend manifest")
    previous_order = -1
    for relative_path in module_paths:
        path = Path(relative_path)
        match = MODULE_NAME_PATTERN.fullmatch(path.name)
        if path.parent.as_posix() != f"src/{expected_extension}" or not match or match.group("extension") != expected_extension:
            raise ValueError(f"Frontend module must use src/{expected_extension}/NN-feature.{expected_extension}: {relative_path}")
        order = int(match.group("order"))
        if order <= previous_order:
            raise ValueError(f"Frontend {expected_extension} module order is not strictly increasing at: {relative_path}")
        previous_order = order


def validate_js_spec(root: Path, spec: FrontendBundleSpec) -> None:
    if not spec.entrypoint or not spec.expected_inputs:
        raise ValueError(f"JavaScript bundle {spec.output_name} requires an entrypoint and expected input graph")
    expected_parent = "src/runtime" if spec.kind == "runtime-js" else "src/entries"
    if Path(spec.entrypoint).parent.as_posix() != expected_parent:
        raise ValueError(f"JavaScript entrypoint must live under {expected_parent}: {spec.entrypoint}")
    for relative in spec.expected_inputs:
        read_source_module(root, relative)
    if spec.entrypoint not in spec.expected_inputs:
        raise ValueError(f"Expected graph for {spec.output_name} does not contain its entrypoint")
    external_modules = dict(spec.external_modules or {})
    if spec.kind == "runtime-js" and external_modules:
        raise ValueError(f"Runtime module {spec.output_name} cannot depend on external runtime modules")
    if len(external_modules.values()) != len(set(external_modules.values())):
        raise ValueError(f"Duplicate external runtime output in {spec.output_name}")
    for source_path, output_name in external_modules.items():
        read_source_module(root, source_path)
        if Path(source_path).parent.as_posix() != "src/runtime":
            raise ValueError(f"External runtime source must live under src/runtime: {source_path}")
        if Path(output_name).name != output_name or not output_name.endswith(".js"):
            raise ValueError(f"External runtime output must be a root JavaScript filename: {output_name}")


def source_manifest_text(module_paths: Sequence[str]) -> str:
    return "\n".join(f" *   - {path}" for path in module_paths)


def strip_internal_css_comments(source: str) -> str:
    """Remove CSS comments outside strings while retaining license comments.

    A regular expression is unsafe here because comment-looking text may be
    intentional content inside a quoted string or data URL. This small scanner
    follows CSS string escaping, keeps ``/*! ... */`` comments verbatim, and
    preserves line breaks from removed review comments for useful diagnostics.
    """

    output: list[str] = []
    index = 0
    quote = ""
    while index < len(source):
        char = source[index]
        if quote:
            output.append(char)
            if char == "\\" and index + 1 < len(source):
                index += 1
                output.append(source[index])
            elif char == quote:
                quote = ""
            index += 1
            continue

        if char in {"'", '"'}:
            quote = char
            output.append(char)
            index += 1
            continue

        if source.startswith("/*", index):
            end = source.find("*/", index + 2)
            if end < 0:
                raise ValueError("Unterminated CSS comment")
            comment = source[index:end + 2]
            if comment.startswith("/*!"):
                output.append(comment)
            else:
                line_breaks = comment.count("\n")
                output.append("\n" * line_breaks if line_breaks else " ")
            index = end + 2
            continue

        output.append(char)
        index += 1
    return "".join(output)


def strip_css_line_end_whitespace(source: str) -> str:
    """Remove line-end whitespace outside quoted CSS strings."""

    output: list[str] = []
    index = 0
    quote = ""
    while index < len(source):
        char = source[index]
        if quote:
            output.append(char)
            if char == "\\" and index + 1 < len(source):
                index += 1
                output.append(source[index])
            elif char == quote:
                quote = ""
            index += 1
            continue
        if char in {"'", '"'}:
            quote = char
            output.append(char)
            index += 1
            continue
        if char == "\n":
            while output and output[-1] in {" ", "\t"}:
                output.pop()
            output.append(char)
            index += 1
            continue
        output.append(char)
        index += 1
    return "".join(output)


def css_source_for_bundle(root: Path, relative_path: str) -> str:
    """Remove internal review comments without changing executable CSS.

    Source files remain fully documented. Generated bundles keep the signed
    source boundary markers and any ``/*!`` license comments, but do not ship
    implementation commentary or line-end whitespace to browsers.
    """

    source = read_source_module(root, relative_path)
    stripped = strip_internal_css_comments(source)
    return normalize_text(strip_css_line_end_whitespace(stripped))


def render_css_bundle(root: Path, spec: FrontendBundleSpec) -> str:
    validate_module_manifest(spec.modules, expected_extension="css")
    sections = [
        "/*\n * GENERATED FILE — DO NOT EDIT DIRECTLY.\n"
        f" * Browser bundle: {spec.output_name}\n * Source modules:\n{source_manifest_text(spec.modules)}\n"
        f" * Cascade layer: {CSS_CASCADE_LAYER}\n"
        " * Build command: python tools/build_frontend_assets.py\n */\n"
        f"@layer {CSS_CASCADE_LAYER};\n\n"
        f"@layer {CSS_CASCADE_LAYER} {{\n"
    ]
    for relative in spec.modules:
        sections.append(
            f"\n/* ===== BEGIN SOURCE: {relative} ===== */\n"
            f"{css_source_for_bundle(root, relative)}"
            f"/* ===== END SOURCE: {relative} ===== */\n"
        )
    sections.append("}\n")
    return normalize_text("".join(sections))


ESBUILD_DEFINE_INPUT_RE = re.compile(r"^<define:(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)>$")
ALLOWED_ESBUILD_DEFINE_INPUTS = frozenset({
    "__BARGIG_FEATURE_CAPABILITIES__",
    "__BARGIG_TEST_EXPORTS__",
})


def _partition_metafile_inputs(
    root: Path,
    inputs: Mapping[str, object],
) -> tuple[tuple[str, ...], tuple[str, ...]]:
    """Separate reviewed source files from esbuild's synthetic compiler inputs.

    esbuild 0.28+ records values introduced by ``define`` as virtual metafile
    inputs such as ``<define:NAME>``. They are not source modules and therefore
    must not be compared with the reviewed physical import graph. Unknown
    virtual inputs remain a hard failure instead of being silently discarded.
    """

    physical: list[str] = []
    virtual: list[str] = []
    root_resolved = root.resolve()
    for raw_path in inputs:
        define_match = ESBUILD_DEFINE_INPUT_RE.fullmatch(raw_path)
        if define_match:
            name = define_match.group("name")
            if name not in ALLOWED_ESBUILD_DEFINE_INPUTS:
                raise RuntimeError(f"Unexpected esbuild virtual input: {raw_path}")
            virtual.append(raw_path)
            continue
        if raw_path.startswith("<") and raw_path.endswith(">"):
            raise RuntimeError(f"Unexpected esbuild virtual input: {raw_path}")

        candidate = Path(raw_path)
        if candidate.is_absolute():
            try:
                relative = candidate.resolve().relative_to(root_resolved).as_posix()
            except ValueError as error:
                raise RuntimeError(f"esbuild input escapes project root: {raw_path}") from error
        else:
            relative = candidate.as_posix().removeprefix("./")
        physical.append(relative)
    return tuple(sorted(physical)), tuple(sorted(virtual))



def render_javascript_bundle(root: Path, spec: FrontendBundleSpec) -> str:
    validate_js_spec(root, spec)
    ensure_local_esbuild()
    capabilities = None if spec.kind == "runtime-js" else {
        "viewer": False, "favoritesWorkspace": False, "catalogGrid": False, "search": False,
        **dict(spec.capabilities or {}),
    }
    with tempfile.TemporaryDirectory(prefix="bargig-esbuild-") as temporary_dir:
        temporary = Path(temporary_dir)
        raw_output = temporary / spec.output_name
        metafile_path = temporary / "metafile.json"
        command = [
            "node", str(ESBUILD_RUNNER), "--root", str(root), "--entry", spec.entrypoint,
            "--outfile", str(raw_output), "--metafile", str(metafile_path),
            "--capabilities", json.dumps(capabilities, separators=(",", ":")),
            "--external-modules", json.dumps(dict(spec.external_modules or {}), separators=(",", ":")),
        ]
        environment = os.environ.copy()
        environment.pop("ESBUILD_BINARY_PATH", None)
        completed = subprocess.run(
            command,
            cwd=root,
            env=environment,
            text=True,
            capture_output=True,
            check=False,
        )
        if completed.returncode:
            details = (completed.stderr or completed.stdout).strip()
            raise RuntimeError(f"esbuild failed for {spec.output_name}: {details}")
        raw_bundle = normalize_text(raw_output.read_text(encoding="utf-8"))
        metafile = json.loads(metafile_path.read_text(encoding="utf-8"))

    actual_inputs, virtual_inputs = _partition_metafile_inputs(root, metafile.get("inputs", {}))
    expected_inputs = tuple(sorted(spec.expected_inputs))
    if actual_inputs != expected_inputs:
        missing = sorted(set(expected_inputs) - set(actual_inputs))
        unexpected = sorted(set(actual_inputs) - set(expected_inputs))
        raise RuntimeError(
            f"Unexpected esbuild graph for {spec.output_name}; missing={missing}, unexpected={unexpected}"
        )
    output_records = list(metafile.get("outputs", {}).values())
    if len(output_records) != 1:
        raise RuntimeError(f"Expected one esbuild output record for {spec.output_name}")
    actual_external_imports = tuple(
        str(item.get("path", ""))
        for item in output_records[0].get("imports", [])
        if item.get("external")
    )
    expected_external_imports = frozenset(
        f"./{output_name}" for output_name in (spec.external_modules or {}).values()
    )
    if frozenset(actual_external_imports) != expected_external_imports:
        raise RuntimeError(
            f"Unexpected external runtime imports for {spec.output_name}; "
            f"expected={sorted(expected_external_imports)}, actual={sorted(set(actual_external_imports))}"
        )
    missing_runtime_references = sorted(
        runtime_path for runtime_path in expected_external_imports
        if actual_external_imports.count(runtime_path) < 1
    )
    if missing_runtime_references:
        raise RuntimeError(
            f"External runtime imports were tree-shaken unexpectedly for {spec.output_name}: "
            f"{missing_runtime_references}"
        )
    if "__BARGIG_TEST_EXPORTS__" in raw_bundle or "TEST-ONLY EXPORTS" in raw_bundle:
        raise RuntimeError(f"Test-only exports leaked into {spec.output_name}")

    external_manifest = (
        f" * External runtime modules:\n{source_manifest_text(tuple((spec.external_modules or {}).keys()))}\n"
        if spec.external_modules else ""
    )
    banner = (
        "/*\n * GENERATED FILE — DO NOT EDIT DIRECTLY.\n"
        f" * Browser bundle: {spec.output_name}\n * ES module entrypoint: {spec.entrypoint}\n"
        f" * Bundled ES module graph:\n{source_manifest_text(spec.expected_inputs)}\n"
        f"{external_manifest}"
        f" * Compiler virtual inputs: {', '.join(virtual_inputs) if virtual_inputs else 'none'}\n"
        " * Output format: native browser ES module\n"
        " * Bundler: esbuild 0.28.1 (direct pinned devDependency)\n"
        " * Build command: python tools/build_frontend_assets.py\n */\n"
    )
    return normalize_text(banner + raw_bundle)


def sha256_text(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def atomic_write_text(path: Path, content: str) -> bool:
    encoded = content.encode("utf-8")
    if path.is_file() and path.read_bytes() == encoded:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    target_mode = (path.stat().st_mode & 0o777) if path.exists() else 0o644
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(encoded); handle.flush(); os.fsync(handle.fileno())
        os.chmod(temporary, target_mode)
        temporary.replace(path)
    except Exception:
        temporary.unlink(missing_ok=True); raise
    return True


def build_one(root: Path, spec: FrontendBundleSpec, *, check: bool) -> FrontendBuildResult:
    content = render_javascript_bundle(root, spec) if spec.kind in {"js", "runtime-js"} else render_css_bundle(root, spec)
    output = root / spec.output_name
    expected = content.encode("utf-8")
    stale = not output.is_file() or output.read_bytes() != expected
    if check and stale:
        raise RuntimeError(f"Generated frontend asset is stale: {spec.output_name}. Run: python tools/build_frontend_assets.py")
    changed = False if check else atomic_write_text(output, content)
    module_count = len(spec.expected_inputs) + len(spec.external_modules or {}) if spec.kind in {"js", "runtime-js"} else len(spec.modules)
    return FrontendBuildResult(output, module_count, len(expected), changed, sha256_text(content))



def build_frontend_assets(root: Path | None = None, *, check: bool = False) -> tuple[FrontendBuildResult, ...]:
    base = (root or project_root()).resolve()
    return tuple(build_one(base, spec, check=check) for spec in BUNDLE_SPECS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    try:
        results = build_frontend_assets(check=args.check)
    except (OSError, RuntimeError, ValueError, json.JSONDecodeError) as error:
        parser.exit(1, f"ERROR: {error}\n")
    for result in results:
        action = "checked" if args.check else ("updated" if result.changed else "unchanged")
        print(f"{result.output.name}: {action}; modules={result.modules}; bytes={result.bytes}; sha256={result.digest[:12]}")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
