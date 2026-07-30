#!/usr/bin/env python3
"""Validate feature ownership, explicit ES-module dependencies, and route bundles."""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Mapping

STATE_OWNERS: Mapping[str, str] = {
    "catalogAssetState": "src/js/10-app-state.js",
    "uiRuntime": "src/js/10-app-state.js",
    "navigationState": "src/js/11-navigation-state.js",
    "catalogState": "src/js/12-catalog-state.js",
    "searchState": "src/js/13-search-state.js",
    "favoritesState": "src/js/14-favorites-state.js",
    "viewerState": "src/js/16-viewer-state.js",
    "inquiryState": "src/js/32-shared-inquiry.js",
}
ELEMENT_OWNERS: Mapping[str, str] = {
    "shellElements": "src/js/11-navigation-state.js",
    "catalogElements": "src/js/12-catalog-state.js",
    "searchElements": "src/js/13-search-state.js",
    "favoritesElements": "src/js/14-favorites-state.js",
    "viewerElements": "src/js/16-viewer-state.js",
    "inquiryElements": "src/js/32-shared-inquiry.js",
}
PROPERTY_RE_TEMPLATE = r"\b{owner}\.([A-Za-z_$][A-Za-z0-9_$]*)"
OBJECT_RE_TEMPLATE = r"const\s+{owner}\s*=\s*(?:Object\.freeze\()?\{{(?P<body>.*?)\n\}}\)?;"
DECLARED_PROPERTY_RE = re.compile(r"^\s{2}([A-Za-z_$][A-Za-z0-9_$]*):", re.MULTILINE)

# Direct access to mutable state and feature-owned DOM is permitted only inside
# the owning feature boundary. A state declaration may live in a small state
# module while the implementation is split across a reviewed set of files.
DIRECT_ACCESS_OWNERS: Mapping[str, tuple[str, ...]] = {
    "catalogAssetState": ("src/js/10-app-state.js", "src/js/20-shared-ui.js"),
    "uiRuntime": ("src/js/10-app-state.js", "src/js/20-shared-ui.js"),
    "navigationState": ("src/js/00-navigation.js", "src/js/11-navigation-state.js", "src/js/18-navigation-feature.js"),
    "shellElements": ("src/js/11-navigation-state.js", "src/js/18-navigation-feature.js"),
    "catalogState": ("src/js/12-catalog-state.js", "src/js/40-catalog-grid.js"),
    "catalogElements": ("src/js/12-catalog-state.js", "src/js/40-catalog-grid.js"),
    "searchState": ("src/js/13-search-state.js", "src/js/50-search-ui.js"),
    "searchElements": ("src/js/13-search-state.js", "src/js/50-search-ui.js"),
    "favoritesState": ("src/js/14-favorites-state.js", "src/js/30-favorites-share.js", "src/js/35-favorites-workspace.js"),
    "favoritesElements": ("src/js/14-favorites-state.js", "src/js/30-favorites-share.js", "src/js/35-favorites-workspace.js"),
    "inquiryState": ("src/js/32-shared-inquiry.js",),
    "inquiryElements": ("src/js/32-shared-inquiry.js",),
    "viewerState": (
        "src/js/16-viewer-state.js",
        "src/js/52-viewer-session.js",
        "src/js/53-viewer-image.js",
        "src/js/54-viewer-geometry.js",
        "src/js/56-viewer-shell.js",
        "src/js/58-viewer-navigation.js",
        "src/js/60-viewer.js",
        "src/js/62-viewer-actions.js",
        "src/js/65-viewer-onboarding.js",
        "src/js/70-viewer-input.js",
    ),
    "viewerElements": (
        "src/js/16-viewer-state.js",
        "src/js/31-viewer-share.js",
        "src/js/52-viewer-session.js",
        "src/js/53-viewer-image.js",
        "src/js/54-viewer-geometry.js",
        "src/js/56-viewer-shell.js",
        "src/js/58-viewer-navigation.js",
        "src/js/60-viewer.js",
        "src/js/62-viewer-actions.js",
        "src/js/65-viewer-onboarding.js",
        "src/js/70-viewer-input.js",
    ),
}

STATIC_IMPORT_RE = re.compile(
    r"^\s*import(?:\s+[\s\S]*?\s+from\s+|\s*)[\"](?P<specifier>[^\"]+)[\"]\s*;",
    re.MULTILINE,
)
DYNAMIC_IMPORT_RE = re.compile(r"\bimport\s*\(")

APPROVED_IMPORT_CYCLES: tuple[frozenset[str], ...] = (
    frozenset({
        "src/js/52-viewer-session.js",
        "src/js/53-viewer-image.js",
        "src/js/54-viewer-geometry.js",
        "src/js/56-viewer-shell.js",
        "src/js/58-viewer-navigation.js",
        "src/js/60-viewer.js",
        "src/js/62-viewer-actions.js",
        "src/js/65-viewer-onboarding.js",
        "src/js/70-viewer-input.js",
    }),
)

FEATURE_NAMES = frozenset({
    "navigation",
    "favorites",
    "inquiry",
    "favorites-workspace",
    "catalog-grid",
    "catalog-navigation",
    "catalog-detail",
    "search",
    "viewer",
    "app-shell",
})



def strip_javascript_comments(text: str) -> str:
    """Remove comments while preserving executable identifiers for ownership scans."""
    return re.sub(r"/\*.*?\*/|//[^\n]*", "", text, flags=re.DOTALL)


def check_typecheck_configuration(base: Path, failures: list[str]) -> None:
    config_path = base / "jsconfig.json"
    if not config_path.is_file():
        failures.append("strict frontend type-check configuration is missing: jsconfig.json")
        return
    try:
        config = json.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        failures.append(f"jsconfig.json is not valid JSON: {error}")
        return

    compiler = config.get("compilerOptions", {})
    required_flags = {"allowJs": True, "checkJs": True, "noEmit": True, "strict": True}
    for name, expected in required_flags.items():
        if compiler.get(name) is not expected:
            failures.append(f"jsconfig.json must set compilerOptions.{name}=true")
    include = config.get("include", [])
    if "src/js/**/*.js" not in include:
        failures.append("jsconfig.json must type-check every src/js module via src/js/**/*.js")
    if "src/entries/**/*.js" not in include:
        failures.append("jsconfig.json must type-check every route entrypoint via src/entries/**/*.js")
    if compiler.get("module") != "ESNext" or compiler.get("moduleResolution") != "Bundler":
        failures.append("jsconfig.json must type-check native ES modules with module=ESNext and moduleResolution=Bundler")
    files = config.get("files", [])
    if "types/frontend-globals.d.ts" not in files:
        failures.append("jsconfig.json must include types/frontend-globals.d.ts")


def check_es_module_imports(base: Path, sources: list[Path], failures: list[str]) -> None:
    """Validate explicit local imports and reject unreviewed dependency cycles."""

    entries = sorted((base / "src" / "entries").glob("*.js"))
    allowed_root = (base / "src").resolve()
    entry_root = (base / "src" / "entries").resolve()
    all_modules = [*sources, *entries]
    graph: dict[str, set[str]] = {path.relative_to(base).as_posix(): set() for path in all_modules}

    for path in all_modules:
        relative = path.relative_to(base).as_posix()
        text = path.read_text(encoding="utf-8")
        if DYNAMIC_IMPORT_RE.search(strip_javascript_comments(text)):
            failures.append(f"dynamic import is not justified in the current route architecture: {relative}")
        for match in STATIC_IMPORT_RE.finditer(text):
            specifier = match.group("specifier")
            if not specifier.startswith("."):
                failures.append(f"browser source imports a package directly instead of a local module: {relative} -> {specifier}")
                continue
            if not specifier.endswith(".js"):
                failures.append(f"browser import must include an explicit .js extension: {relative} -> {specifier}")
            resolved = (path.parent / specifier).resolve()
            try:
                resolved_relative = resolved.relative_to(allowed_root)
            except ValueError:
                failures.append(f"browser import escapes src/: {relative} -> {specifier}")
                continue
            if not resolved.is_file():
                failures.append(f"browser import target is missing: {relative} -> {specifier}")
                continue
            target_relative = f"src/{resolved_relative.as_posix()}"
            if target_relative in graph:
                graph[relative].add(target_relative)
            if path in sources:
                try:
                    resolved.relative_to(entry_root)
                except ValueError:
                    pass
                else:
                    failures.append(f"runtime owner imports a route entrypoint: {relative} -> {specifier}")

    index = 0
    indices: dict[str, int] = {}
    lowlinks: dict[str, int] = {}
    stack: list[str] = []
    on_stack: set[str] = set()
    cycles: list[frozenset[str]] = []

    def visit(node: str) -> None:
        nonlocal index
        indices[node] = index
        lowlinks[node] = index
        index += 1
        stack.append(node)
        on_stack.add(node)
        for target in graph[node]:
            if target not in indices:
                visit(target)
                lowlinks[node] = min(lowlinks[node], lowlinks[target])
            elif target in on_stack:
                lowlinks[node] = min(lowlinks[node], indices[target])
        if lowlinks[node] != indices[node]:
            return
        component: set[str] = set()
        while stack:
            member = stack.pop()
            on_stack.remove(member)
            component.add(member)
            if member == node:
                break
        if len(component) > 1:
            cycles.append(frozenset(component))

    for module in sorted(graph):
        if module not in indices:
            visit(module)

    approved = set(APPROVED_IMPORT_CYCLES)
    actual = set(cycles)
    for cycle in sorted(actual - approved, key=lambda value: sorted(value)):
        failures.append(f"unapproved ES-module dependency cycle: {sorted(cycle)}")
    for cycle in sorted(approved - actual, key=lambda value: sorted(value)):
        failures.append(f"approved dependency cycle changed and requires explicit review: {sorted(cycle)}")

    expected_entries = {"catalog.js", "favorites.js", "viewer.js"}
    actual_entries = {path.name for path in entries}
    if actual_entries != expected_entries:
        failures.append(
            "route entrypoint set is not exact; "
            f"expected={sorted(expected_entries)}, actual={sorted(actual_entries)}"
        )


def check_feature_registry(base: Path, sources: list[Path], failures: list[str]) -> None:
    contracts = (base / "src/js/05-app-contracts.js").read_text(encoding="utf-8")
    registry = (base / "src/js/10-app-state.js").read_text(encoding="utf-8")
    if "FeatureRegistry" not in contracts or "keyof FeatureRegistry" not in contracts:
        failures.append("frontend contracts do not define an exact FeatureRegistry")
    if re.search(r"@typedef\s+\{Object\}\s+FeatureInterface\b", contracts):
        failures.append("legacy generic FeatureInterface contract remains")
    if "@template {FeatureName} K" not in registry:
        failures.append("feature registry access is not keyed by FeatureName")
    if "function requireFeatureInterface(name)" not in registry:
        failures.append("required feature seams can still degrade into silent optional no-ops")

    registered: list[str] = []
    for path in sources:
        registered.extend(re.findall(r'registerFeatureInterface\("([^"\n]+)"', strip_javascript_comments(path.read_text(encoding="utf-8"))))
    unknown = sorted(set(registered) - FEATURE_NAMES)
    missing = sorted(FEATURE_NAMES - set(registered))
    duplicates = sorted(name for name in set(registered) if registered.count(name) > 1)
    if unknown:
        failures.append(f"unknown feature registrations: {', '.join(unknown)}")
    if missing:
        failures.append(f"missing feature registrations: {', '.join(missing)}")
    if duplicates:
        failures.append(f"duplicate feature registrations: {', '.join(duplicates)}")


def check_bootstrap_boundary(base: Path, failures: list[str]) -> None:
    path = base / "src/js/90-bootstrap.js"
    text = path.read_text(encoding="utf-8")
    code = strip_javascript_comments(text)
    function_names = re.findall(r"\bfunction\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(", code)
    if function_names != ["init"]:
        failures.append("90-bootstrap.js must contain only the init startup function")
    if 'getFeatureInterface("app-shell")?.initialize()' not in code:
        failures.append("90-bootstrap.js must delegate startup to the app-shell feature")
    executable_lines = [line for line in code.splitlines() if line.strip()]
    if len(executable_lines) > 18:
        failures.append("90-bootstrap.js contains orchestration or business logic instead of a minimal startup boundary")


def check_test_strategy(base: Path, failures: list[str]) -> None:
    """Keep behavior tests coupled to runtime APIs, never source formatting."""

    tests_dir = base / "tests"
    if not tests_dir.is_dir():
        failures.append("frontend test directory is missing: tests")
        return

    dynamic_execution_patterns = {
        "new Function": re.compile(r"\bnew\s+Function\s*\("),
        "eval": re.compile(r"(?<![A-Za-z0-9_$])eval\s*\("),
    }
    for path in sorted(tests_dir.rglob("*.test.js")):
        text = path.read_text(encoding="utf-8")
        relative = path.relative_to(base).as_posix()
        for label, pattern in dynamic_execution_patterns.items():
            if pattern.search(text):
                failures.append(
                    f"{relative} executes extracted source with {label}; import the production module instead"
                )
        if path.name != "browser_e2e_contract.test.js" and re.search(r"\bvm\.runIn(?:New)?Context\s*\(", text):
            failures.append(
                f"{relative} executes source through vm; source-text tests are structural only"
            )
        if "data:text/javascript" in text:
            failures.append(
                f"{relative} imports JavaScript reconstructed from source text; import the module file directly"
            )

        bundle_variables = re.findall(
            r"\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*readAllBundles\(\s*\)",
            text,
        )
        for variable in bundle_variables:
            if re.search(rf"\bassert\.match\(\s*{re.escape(variable)}\s*,", text) or re.search(
                rf"\b{re.escape(variable)}\.match\s*\(", text
            ):
                failures.append(
                    f"{relative} asserts implementation syntax against generated bundles; "
                    "inspect the owning source module or import its runtime test API"
                )

    required_behavior_tests = (
        "tests/search_catalog_domain_logic.test.js",
        "tests/search_catalog_viewer_integration.test.js",
    )
    for relative in required_behavior_tests:
        path = base / relative
        if not path.is_file():
            failures.append(f"required Search/Catalog behavior test is missing: {relative}")
            continue
        text = path.read_text(encoding="utf-8")
        if "importFrontendTestModule" not in text:
            failures.append(f"{relative} must import the production test module instead of reading source text")


def check_test_only_exports(base: Path, sources: list[Path], failures: list[str]) -> None:
    """Require explicit source-owned test APIs and prove they never ship."""

    helper = base / "tests/frontend_test_module.js"
    if not helper.is_file():
        failures.append("source-owned frontend test module loader is missing")
    else:
        helper_text = helper.read_text(encoding="utf-8")
        if "__BARGIG_TEST_EXPORTS__" not in helper_text or "compileFrontendModuleForTest" not in helper_text:
            failures.append("frontend test module loader does not compile the complete source-owned ES module")

    for path in sources:
        text = path.read_text(encoding="utf-8")
        begins = text.count("/* TEST-ONLY EXPORTS: BEGIN */")
        ends = text.count("/* TEST-ONLY EXPORTS: END */")
        if begins != ends:
            failures.append(f"unbalanced test-only export boundary: {path.relative_to(base).as_posix()}")

    for output in ("app-catalog.js", "app-favorites.js", "app-viewer.js"):
        path = base / output
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if "__BARGIG_TEST_EXPORTS__" in text or "TEST-ONLY EXPORTS" in text:
            failures.append(f"{output} ships test-only source exports")


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def declared_properties(root: Path, owner: str, relative_path: str) -> set[str]:
    text = (root / relative_path).read_text(encoding="utf-8")
    match = re.search(OBJECT_RE_TEMPLATE.format(owner=re.escape(owner)), text, re.DOTALL)
    if not match:
        raise RuntimeError(f"Could not find declared object for {owner} in {relative_path}")
    return set(DECLARED_PROPERTY_RE.findall(match.group("body")))


def _strip_leading_javascript_comments(source: str) -> str:
    """Return JavaScript after removing only leading whitespace/comments.

    The generated bundle starts with a build banner and may contain additional
    esbuild source comments. Removing only the leading trivia lets the contract
    inspect the actual outermost construct without treating a nested initializer
    as a bundle wrapper.
    """

    remaining = source.lstrip("\ufeff \t\r\n")
    while True:
        if remaining.startswith("/*"):
            end = remaining.find("*/", 2)
            if end < 0:
                return remaining
            remaining = remaining[end + 2:].lstrip()
            continue
        if remaining.startswith("//"):
            newline = remaining.find("\n", 2)
            if newline < 0:
                return ""
            remaining = remaining[newline + 1:].lstrip()
            continue
        return remaining


def _has_legacy_top_level_iife_wrapper(source: str) -> bool:
    """Detect the obsolete whole-bundle IIFE, not nested local IIFEs.

    Native ES-module bundles may legitimately contain a local IIFE used to
    initialize one value. The historical compatibility output wrapped the
    entire generated file, so the wrapper must be the first non-comment token
    and its invocation must close the file.
    """

    body = _strip_leading_javascript_comments(source)
    arrow_wrapper = re.match(r"^\(\(\)\s*=>\s*\{", body)
    function_wrapper = re.match(r"^\(function(?:\s+[A-Za-z_$][A-Za-z0-9_$]*)?\s*\(\)\s*\{", body)
    if not (arrow_wrapper or function_wrapper):
        return False
    return re.search(r"\}\)\(\);?\s*$", body) is not None


def check_frontend_contracts(root: Path | None = None) -> None:
    base = (root or project_root()).resolve()
    sources = sorted((base / "src" / "js").glob("*.js"))
    combined = "\n".join(path.read_text(encoding="utf-8") for path in sources)
    code_without_comments = strip_javascript_comments(combined)
    code_without_imports = re.sub(r"^\s*import\b.*?;\s*$", "", code_without_comments, flags=re.MULTILINE)
    failures: list[str] = []

    check_typecheck_configuration(base, failures)
    check_es_module_imports(base, sources, failures)
    check_feature_registry(base, sources, failures)
    check_bootstrap_boundary(base, failures)
    check_test_strategy(base, failures)
    check_test_only_exports(base, sources, failures)

    for path in sources:
        relative_path = path.relative_to(base).as_posix()
        code = strip_javascript_comments(path.read_text(encoding="utf-8"))
        for identifier, allowed_paths in DIRECT_ACCESS_OWNERS.items():
            if relative_path not in allowed_paths and re.search(rf"\b{re.escape(identifier)}\b", code):
                failures.append(
                    f"{relative_path} reaches into {identifier}; use the owning feature interface instead"
                )

    if re.search(r"(?<![A-Za-z0-9_$.])state(?:\??\.|\s*\[)", code_without_imports):
        failures.append("legacy monolithic state access remains")
    if re.search(r"(?<![A-Za-z0-9_$.])els\.", code_without_imports):
        failures.append("legacy monolithic els.* access remains")

    all_state_properties: dict[str, str] = {}
    for owner, relative_path in STATE_OWNERS.items():
        declared = declared_properties(base, owner, relative_path)
        for name in declared:
            previous = all_state_properties.get(name)
            if previous:
                failures.append(f"state property '{name}' is owned by both {previous} and {owner}")
            all_state_properties[name] = owner
        used = set(re.findall(PROPERTY_RE_TEMPLATE.format(owner=re.escape(owner)), combined))
        unknown = sorted(used - declared)
        if unknown:
            failures.append(f"{owner} uses undeclared properties: {', '.join(unknown)}")

    all_element_properties: dict[str, str] = {}
    for owner, relative_path in ELEMENT_OWNERS.items():
        declared = declared_properties(base, owner, relative_path)
        for name in declared:
            previous = all_element_properties.get(name)
            if previous:
                failures.append(f"DOM reference '{name}' is owned by both {previous} and {owner}")
            all_element_properties[name] = owner
        used = set(re.findall(PROPERTY_RE_TEMPLATE.format(owner=re.escape(owner)), combined))
        unknown = sorted(used - declared)
        if unknown:
            failures.append(f"{owner} uses undeclared DOM references: {', '.join(unknown)}")

    # Every runtime owner is a real ES module; no source file may rely on the old
    # concatenated lexical scope. TypeScript then proves every cross-file symbol
    # is either imported or intentionally global.
    type_only_modules = {"src/js/05-app-contracts.js"}
    for path in sources:
        relative = path.relative_to(base).as_posix()
        text = path.read_text(encoding="utf-8")
        if relative not in type_only_modules and not re.search(r"^(?:import|export)\s", text, re.MULTILINE):
            failures.append(f"runtime source is not an ES module: {relative}")
        if "share one lexical scope" in text or "concatenates all sources" in text:
            failures.append(f"legacy shared-scope architecture text remains: {relative}")

    entries = {"catalog", "favorites", "viewer"}
    for entry in entries:
        entry_path = base / f"src/entries/{entry}.js"
        if not entry_path.is_file():
            failures.append(f"route ES-module entrypoint is missing: src/entries/{entry}.js")

    package_path = base / "package.json"
    lock_path = base / "package-lock.json"
    try:
        package = json.loads(package_path.read_text(encoding="utf-8"))
        lock = json.loads(lock_path.read_text(encoding="utf-8"))
        if package.get("devDependencies", {}).get("esbuild") != "0.28.1":
            failures.append("esbuild must be a direct exact devDependency at version 0.28.1")
        if lock.get("packages", {}).get("", {}).get("devDependencies", {}).get("esbuild") != "0.28.1":
            failures.append("package-lock.json does not pin the root esbuild devDependency")
        locked_esbuild = lock.get("packages", {}).get("node_modules/esbuild", {})
        if locked_esbuild.get("version") != "0.28.1":
            failures.append("package-lock.json does not lock esbuild 0.28.1")
        if not locked_esbuild.get("resolved", "").endswith("/esbuild-0.28.1.tgz") or not locked_esbuild.get("integrity"):
            failures.append("package-lock.json is missing reproducible esbuild registry metadata")
        locked_linux = lock.get("packages", {}).get("node_modules/@esbuild/linux-x64", {})
        if locked_linux.get("version") != "0.28.1" or not locked_linux.get("integrity"):
            failures.append("package-lock.json is missing the locked Linux esbuild binary metadata")
    except (OSError, json.JSONDecodeError) as error:
        failures.append(f"could not validate pinned esbuild dependency: {error}")

    # Route outputs must prove that omitted features are physically absent, not merely disabled.
    route_expectations = {
        "app-catalog.js": {
            "required": ("src/js/39-search-catalog-domain.js", "src/js/40-catalog-grid.js", "src/js/50-search-ui.js"),
            "forbidden": (
                "src/js/16-viewer-state.js",
                "src/js/31-viewer-share.js",
                "src/js/53-viewer-image.js",
                "src/js/60-viewer.js",
                "src/js/35-favorites-workspace.js",
            ),
        },
        "app-favorites.js": {
            "required": (
                "src/js/32-shared-inquiry.js",
                "src/js/35-favorites-workspace.js",
                "src/js/39-search-catalog-domain.js",
                "src/js/40-catalog-grid.js",
            ),
            "forbidden": (
                "src/js/16-viewer-state.js",
                "src/js/31-viewer-share.js",
                "src/js/53-viewer-image.js",
                "src/js/60-viewer.js",
            ),
        },
        "app-viewer.js": {
            "required": (
                "src/js/16-viewer-state.js",
                "src/js/31-viewer-share.js",
                "src/js/32-shared-inquiry.js",
                "src/js/35-favorites-workspace.js",
                "src/js/39-search-catalog-domain.js",
                "src/js/40-catalog-grid.js",
                "src/js/53-viewer-image.js",
                "src/js/60-viewer.js",
            ),
            "forbidden": (),
        },
    }
    for output, expectation in route_expectations.items():
        path = base / output
        if not path.is_file():
            failures.append(f"route bundle is missing: {output}")
            continue
        text = path.read_text(encoding="utf-8")
        if "Output format: native browser ES module" not in text:
            failures.append(f"{output} is not marked as a native browser ES module")
        if _has_legacy_top_level_iife_wrapper(text):
            failures.append(f"{output} still contains a top-level IIFE compatibility wrapper")
        for source in expectation["required"]:
            if f" *   - {source}" not in text:
                failures.append(f"{output} is missing required feature source {source}")
        for source in expectation["forbidden"]:
            if f" *   - {source}" in text:
                failures.append(f"{output} contains forbidden feature source {source}")


    viewer_implementation_sources = [
        path for path in sources
        if re.fullmatch(r"(?:31|5[2-9]|6[0-9]|70)-.*\.js", path.name)
    ]
    for path in viewer_implementation_sources:
        text = path.read_text(encoding="utf-8")
        if re.search(r"\b(?:searchState|searchElements)\b", text):
            failures.append(
                f"Viewer implementation reaches into search internals instead of the feature interface: "
                f"{path.relative_to(base).as_posix()}"
            )

    search_source = (base / "src/js/50-search-ui.js").read_text(encoding="utf-8")
    if re.search(r"\b(?:viewerState|viewerElements)\b", search_source):
        failures.append("Search implementation reaches into Viewer internals instead of the feature interface")

    for path in sources:
        if "document.currentScript" in path.read_text(encoding="utf-8"):
            failures.append(
                f"native ES module depends on document.currentScript: "
                f"{path.relative_to(base).as_posix()}"
            )

    if (base / "app.js").exists():
        failures.append("obsolete compatibility loader remains: app.js")

    runner = (base / "tools/build_frontend_esbuild.mjs").read_text(encoding="utf-8")
    if 'format: "esm"' not in runner or 'format: "iife"' in runner:
        failures.append("frontend bundles must be emitted as native browser ES modules")
    if "_partition_metafile_inputs" not in (base / "tools/build_frontend_assets.py").read_text(encoding="utf-8"):
        failures.append("esbuild physical and virtual metafile inputs are not validated separately")

    route_pages = {
        "index.html": "app-catalog.js",
        "catalog.html": "app-catalog.js",
        "favorites.html": "app-favorites.js",
        "viewer.html": "app-viewer.js",
    }
    for page_name, route_asset in route_pages.items():
        page_path = base / page_name
        if not page_path.is_file():
            failures.append(f"route document is missing: {page_name}")
            continue
        page_text = page_path.read_text(encoding="utf-8")
        expected_tag = f'<script type="module" data-bargig-route-module src="{route_asset}"></script>'
        if expected_tag not in page_text:
            failures.append(f"{page_name} does not load {route_asset} as a native module")

    template_text = (base / "site.template.html").read_text(encoding="utf-8")
    if '<script type="module" data-bargig-route-module src="{{ROUTE_SCRIPT}}"></script>' not in template_text:
        failures.append("site.template.html does not emit native route module scripts")

    if failures:
        raise RuntimeError("Frontend contract check failed:\n  - " + "\n  - ".join(failures))


if __name__ == "__main__":
    check_frontend_contracts()
    print("Frontend feature contracts passed.")
