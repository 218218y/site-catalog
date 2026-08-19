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
import fnmatch
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
    "src/css/52-payment.css", "src/css/80-responsive-shell.css", "src/css/90-visual-polish.css",
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
    "src/css/00-foundation.css", "src/css/06-shell-components.css",
    "src/css/08-shared-floating-ui.css", "src/css/10-catalog.css",
    "src/css/20-viewer.css", "src/css/24-shared-inquiry.css",
    "src/css/25-viewer-actions.css", "src/css/30-media-components.css",
    "src/css/40-catalog-refinements.css", "src/css/50-footer-legal.css",
    "src/css/80-responsive-shell.css", "src/css/85-favorites-routing.css",
    "src/css/87-favorites-workspace.css", "src/css/90-visual-polish.css",
    "src/css/92-viewer-onboarding.css", "src/css/95-accessibility-consistency.css",
    "src/css/97-seo-foundation.css",
)


CONFIG_EXTERNAL_MODULES: Mapping[str, str] = {
    "catalog-assets.config.js": "catalog-assets.config.js",
}
RUNTIME_EXTERNAL_MODULES: Mapping[str, str] = {
    "src/runtime/catalog-search.js": "catalog-search.js",
    "src/runtime/tooltip-manager.js": "tooltip-manager.js",
    "src/runtime/favorites-store.js": "favorites-store.js",
    "src/runtime/site-routes.js": "site-routes.js",
}
GENERATED_DATA_EXTERNAL_MODULES: Mapping[str, str] = {
    "catalogs.generated.module.js": "catalogs.generated.module.js",
    "catalog-taxonomy.generated.module.js": "catalog-taxonomy.generated.module.js",
}
ROUTE_EXTERNAL_MODULES: Mapping[str, str] = {
    **CONFIG_EXTERNAL_MODULES,
    **RUNTIME_EXTERNAL_MODULES,
    **GENERATED_DATA_EXTERNAL_MODULES,
}
RUNTIME_EXTERNAL_DEPENDENCIES: Mapping[str, Mapping[str, str]] = {
    "src/runtime/catalog-search.js": {
        "catalog-assets.config.js": "catalog-assets.config.js",
        "catalogs.generated.module.js": "catalogs.generated.module.js",
    },
}
@dataclass(frozen=True)
class CapabilityBoundary:
    required_roots: tuple[str, ...]
    owned_patterns: tuple[str, ...]


CAPABILITY_BOUNDARIES: Mapping[str, CapabilityBoundary] = {
    "viewer": CapabilityBoundary(
        required_roots=("src/js/60-viewer.js",),
        owned_patterns=("src/js/*viewer*.js", "catalog-snapshot.js"),
    ),
    "favoritesWorkspace": CapabilityBoundary(
        required_roots=("src/js/35-favorites-workspace.js",),
        owned_patterns=("src/js/35-favorites-workspace.js",),
    ),
    "catalogGrid": CapabilityBoundary(
        required_roots=("src/js/40-catalog-grid.js",),
        owned_patterns=("src/js/40-catalog-grid.js",),
    ),
    "search": CapabilityBoundary(
        required_roots=("src/js/50-search-ui.js",),
        owned_patterns=("src/js/*search*.js",),
    ),
}


def capability_owned_inputs(inputs: Sequence[str], boundary: CapabilityBoundary) -> tuple[str, ...]:
    """Return graph inputs owned by a capability using reviewed naming boundaries.

    The ownership patterns deliberately describe architecture, not a frozen
    esbuild graph. A new shared helper may enter a route through normal imports
    without editing this file, while a newly added Viewer module is still
    rejected automatically from routes where the Viewer capability is disabled.
    """

    return tuple(sorted(
        relative
        for relative in inputs
        if any(fnmatch.fnmatchcase(relative, pattern) for pattern in boundary.owned_patterns)
    ))


COMMON_ROUTE_REQUIRED_INPUTS: tuple[str, ...] = (
    "src/js/18-navigation-feature.js",
    "src/js/30-favorites-share.js",
    "src/js/80-app-shell.js",
    "src/js/90-bootstrap.js",
)

@dataclass(frozen=True)
class FrontendBundleSpec:
    output_name: str
    kind: str
    modules: tuple[str, ...] = ()
    entrypoint: str | None = None
    required_inputs: tuple[str, ...] = ()
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
        required_inputs=(source_path,),
        external_modules=RUNTIME_EXTERNAL_DEPENDENCIES.get(source_path, {}),
    ) for source_path, output_name in RUNTIME_EXTERNAL_MODULES.items()),
    FrontendBundleSpec("app-catalog.js", "js", entrypoint="src/entries/catalog.js",
        required_inputs=("src/entries/catalog.js", *COMMON_ROUTE_REQUIRED_INPUTS),
        external_modules=ROUTE_EXTERNAL_MODULES,
        capabilities={"viewer": False, "favoritesWorkspace": False, "catalogGrid": True, "search": True}),
    FrontendBundleSpec("app-favorites.js", "js", entrypoint="src/entries/favorites.js",
        required_inputs=("src/entries/favorites.js", *COMMON_ROUTE_REQUIRED_INPUTS, "src/js/32-shared-inquiry.js"),
        external_modules=ROUTE_EXTERNAL_MODULES,
        capabilities={"viewer": False, "favoritesWorkspace": True, "catalogGrid": True, "search": True}),
    FrontendBundleSpec("app-viewer.js", "js", entrypoint="src/entries/viewer.js",
        required_inputs=("src/entries/viewer.js", *COMMON_ROUTE_REQUIRED_INPUTS,
                         "src/js/31-viewer-share.js", "src/js/32-shared-inquiry.js"),
        external_modules=ROUTE_EXTERNAL_MODULES,
        capabilities={"viewer": True, "favoritesWorkspace": True, "catalogGrid": True, "search": True}),
    FrontendBundleSpec("app-payment.js", "js", entrypoint="src/entries/payment.js",
        required_inputs=("src/entries/payment.js",)),
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
    "payment": ("styles.css", "app-payment.js"),
}

MODULE_NAME_PATTERN = re.compile(r"^(?P<order>\d{2})-[a-z0-9-]+\.(?P<extension>js|css)$")
ESBUILD_RUNNER = Path(__file__).with_name("build_frontend_esbuild.mjs")
CSS_CASCADE_LAYER = "bargig.application"


def expected_esbuild_version(root: Path | None = None) -> str:
    """Return the exact esbuild version selected by the project lockfile."""

    try:
        from bootstrap_esbuild_offline import locked_version
    except ImportError as error:
        raise RuntimeError("Cannot load the repository-local esbuild version resolver") from error
    return locked_version((root or project_root()).resolve())


def ensure_local_esbuild() -> None:
    """Use exact local esbuild; bootstrap only from vendored Linux archives."""

    try:
        from bootstrap_esbuild_offline import ensure_esbuild_available
    except ImportError as error:
        raise RuntimeError("Cannot load the repository-local esbuild bootstrap") from error

    try:
        ensure_esbuild_available(project_root(), quiet=True)
    except RuntimeError as error:
        raise RuntimeError(f"esbuild is unavailable: {error}") from error

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


def validate_js_spec(root: Path, spec: FrontendBundleSpec) -> str:
    if not spec.entrypoint or not spec.required_inputs:
        raise ValueError(f"JavaScript bundle {spec.output_name} requires an entrypoint and required input boundaries")
    expected_parent = "src/runtime" if spec.kind == "runtime-js" else "src/entries"
    if Path(spec.entrypoint).parent.as_posix() != expected_parent:
        raise ValueError(f"JavaScript entrypoint must live under {expected_parent}: {spec.entrypoint}")
    for relative in spec.required_inputs:
        read_source_module(root, relative)
    if spec.entrypoint not in spec.required_inputs:
        raise ValueError(f"Required boundaries for {spec.output_name} do not contain its entrypoint")
    external_modules = dict(spec.external_modules or {})
    if len(external_modules.values()) != len(set(external_modules.values())):
        raise ValueError(f"Duplicate external runtime output in {spec.output_name}")
    for source_path, output_name in external_modules.items():
        read_source_module(root, source_path)
        approved_source = (
            Path(source_path).parent.as_posix() == "src/runtime"
            or source_path in CONFIG_EXTERNAL_MODULES
            or source_path in GENERATED_DATA_EXTERNAL_MODULES
        )
        if not approved_source:
            raise ValueError(f"External browser module has no approved owner: {source_path}")
        if Path(output_name).name != output_name or not output_name.endswith(".js"):
            raise ValueError(f"External runtime output must be a root JavaScript filename: {output_name}")
    return spec.entrypoint


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
    entrypoint = validate_js_spec(root, spec)
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
            "node", str(ESBUILD_RUNNER), "--root", str(root), "--entry", entrypoint,
            "--outfile", str(raw_output), "--metafile", str(metafile_path),
            "--capabilities", json.dumps(capabilities, separators=(",", ":")),
            "--external-modules", json.dumps(dict(spec.external_modules or {}), separators=(",", ":")),
            "--expected-version", expected_esbuild_version(),
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
    actual_input_set = set(actual_inputs)
    required_inputs = set(spec.required_inputs)
    missing_required = sorted(required_inputs - actual_input_set)
    if missing_required:
        raise RuntimeError(
            f"Required architecture boundary is absent from {spec.output_name}: {missing_required}"
        )
    if spec.kind == "runtime-js":
        expected_runtime_graph = (spec.entrypoint,)
        if actual_inputs != expected_runtime_graph:
            raise RuntimeError(
                f"Runtime module {spec.output_name} must remain a single-source owner; actual={list(actual_inputs)}"
            )
    else:
        invalid_inputs = sorted(
            relative for relative in actual_inputs
            if relative != "catalog-snapshot.js"
            and not relative.startswith("src/js/")
            and not relative.startswith("src/entries/")
        )
        if invalid_inputs:
            raise RuntimeError(f"Route graph contains sources outside approved roots: {invalid_inputs}")
        foreign_entries = sorted(
            relative for relative in actual_inputs
            if relative.startswith("src/entries/") and relative != spec.entrypoint
        )
        if foreign_entries:
            raise RuntimeError(f"Route graph includes another route entrypoint: {foreign_entries}")
        for capability, boundary in CAPABILITY_BOUNDARIES.items():
            enabled = bool((spec.capabilities or {}).get(capability, False))
            present = capability_owned_inputs(actual_inputs, boundary)
            missing_roots = sorted(set(boundary.required_roots) - actual_input_set)
            if enabled and missing_roots:
                raise RuntimeError(
                    f"Enabled capability {capability!r} is missing its composition root "
                    f"from {spec.output_name}: {missing_roots}"
                )
            if not enabled and present:
                raise RuntimeError(
                    f"Disabled capability {capability!r} leaked into {spec.output_name}: {list(present)}"
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
    external_manifest = (
        f" * External browser modules:\n{source_manifest_text(tuple((spec.external_modules or {}).keys()))}\n"
        if spec.external_modules else ""
    )
    banner = (
        "/*\n * GENERATED FILE — DO NOT EDIT DIRECTLY.\n"
        f" * Browser bundle: {spec.output_name}\n * ES module entrypoint: {spec.entrypoint}\n"
        f" * Bundled ES module graph:\n{source_manifest_text(actual_inputs)}\n"
        f"{external_manifest}"
        f" * Compiler virtual inputs: {', '.join(virtual_inputs) if virtual_inputs else 'none'}\n"
        " * Output format: native browser ES module\n"
        f" * Bundler: esbuild {expected_esbuild_version()} (lockfile-selected direct devDependency)\n"
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
    if spec.kind in {"js", "runtime-js"}:
        graph_match = re.search(r"\* Bundled ES module graph:\n(?P<graph>(?: \*   - .*\n)+)", content)
        graph_count = len(graph_match.group("graph").splitlines()) if graph_match else 0
        module_count = graph_count + len(spec.external_modules or {})
    else:
        module_count = len(spec.modules)
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
