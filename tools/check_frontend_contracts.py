#!/usr/bin/env python3
"""Validate feature ownership, explicit ES-module dependencies, and route bundles."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path
from typing import Any, Mapping

from bootstrap_typescript_offline import BootstrapError, ensure_typescript_available

STATE_OWNERS: Mapping[str, str] = {
    "catalogAssetState": "src/js/10-app-state.js",
    "uiRuntime": "src/js/10-app-state.js",
    "navigationState": "src/js/11-navigation-state.js",
    "catalogState": "src/js/12-catalog-state.js",
    "searchState": "src/js/13-search-state.js",
    "favoritesState": "src/js/14-favorites-state.js",
    "viewerSessionState": "src/js/16-viewer-state.js",
    "viewerViewportState": "src/js/16-viewer-state.js",
    "viewerGestureState": "src/js/16-viewer-state.js",
    "viewerChromeState": "src/js/16-viewer-state.js",
    "viewerImageState": "src/js/16-viewer-state.js",
    "viewerNavigationState": "src/js/16-viewer-state.js",
    "viewerOnboardingState": "src/js/16-viewer-state.js",
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
    "viewerSessionState": (
        "src/js/16-viewer-state.js",
        "src/js/17-viewer-state-transitions.js",
        "src/js/51-viewer-session-state.js",
        "src/js/52-viewer-session.js",
    ),
    "viewerViewportState": (
        "src/js/16-viewer-state.js",
        "src/js/17-viewer-state-transitions.js",
        "src/js/53-viewer-image.js",
        "src/js/54-viewer-geometry.js",
        "src/js/55-viewer-zoom-controller.js",
        "src/js/56-viewer-shell.js",
        "src/js/57-viewer-fit-controller.js",
        "src/js/59-viewer-page-controller.js",
        "src/js/60-viewer.js",
        "src/js/61-viewer-layout-controller.js",
        "src/js/70-viewer-input.js",
    ),
    "viewerGestureState": (
        "src/js/16-viewer-state.js",
        "src/js/17-viewer-state-transitions.js",
        "src/js/54-viewer-geometry.js",
        "src/js/70-viewer-input.js",
    ),
    "viewerChromeState": (
        "src/js/16-viewer-state.js",
        "src/js/56-viewer-shell.js",
        "src/js/60-viewer.js",
        "src/js/61-viewer-layout-controller.js",
        "src/js/62-viewer-actions.js",
        "src/js/65-viewer-onboarding.js",
    ),
    "viewerImageState": (
        "src/js/16-viewer-state.js",
        "src/js/17-viewer-state-transitions.js",
        "src/js/53-viewer-image.js",
        "src/js/60-viewer.js",
    ),
    "viewerNavigationState": (
        "src/js/16-viewer-state.js",
        "src/js/17-viewer-state-transitions.js",
        "src/js/58-viewer-navigation.js",
    ),
    "viewerOnboardingState": (
        "src/js/16-viewer-state.js",
        "src/js/56-viewer-shell.js",
        "src/js/60-viewer.js",
        "src/js/65-viewer-onboarding.js",
    ),
    "viewerElements": (
        "src/js/16-viewer-state.js",
        "src/js/31-viewer-share.js",
        "src/js/51-viewer-session-state.js",
        "src/js/52-viewer-session.js",
        "src/js/53-viewer-image.js",
        "src/js/54-viewer-geometry.js",
        "src/js/55-viewer-zoom-controller.js",
        "src/js/56-viewer-shell.js",
        "src/js/57-viewer-fit-controller.js",
        "src/js/58-viewer-navigation.js",
        "src/js/59-viewer-page-controller.js",
        "src/js/60-viewer.js",
        "src/js/61-viewer-layout-controller.js",
        "src/js/62-viewer-actions.js",
        "src/js/65-viewer-onboarding.js",
        "src/js/70-viewer-input.js",
    ),
}


AstInventory = dict[str, Any]


def load_ast_inventory(base: Path, paths: list[Path]) -> dict[str, AstInventory]:
    """Parse browser sources once with TypeScript and return structural facts.

    The Node bridge deliberately owns JavaScript syntax knowledge. Python only
    consumes JSON facts, so comments and strings can never satisfy code
    ownership contracts by accident.
    """

    relative_paths = [path.relative_to(base).as_posix() for path in paths]
    request = json.dumps({"root": str(base), "files": relative_paths})
    try:
        ensure_typescript_available(base, quiet=True)
    except BootstrapError as error:
        raise RuntimeError(f"TypeScript 7 AST runtime is unavailable: {error}") from error
    try:
        result = subprocess.run(
            ("node", "tools/frontend_ast_inventory.js"),
            cwd=base,
            input=request,
            encoding="utf-8",
            errors="strict",
            capture_output=True,
            check=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError, UnicodeError) as error:
        detail = getattr(error, "stderr", "") or str(error)
        raise RuntimeError(f"JavaScript AST inventory failed: {detail.strip()}") from error
    output = result.stdout or ""
    if not output.strip():
        raise RuntimeError("JavaScript AST inventory returned no JSON output")
    try:
        payload = json.loads(output)
    except json.JSONDecodeError as error:
        raise RuntimeError("JavaScript AST inventory returned invalid JSON") from error
    if not isinstance(payload, dict):
        raise RuntimeError("JavaScript AST inventory returned a non-object payload")
    return payload


def ast_calls(inventory: AstInventory, callee: str) -> list[dict[str, Any]]:
    return [call for call in inventory.get("calls", []) if call.get("callee") == callee]


def ast_property_paths(inventory: AstInventory) -> set[str]:
    return {str(access.get("path")) for access in inventory.get("propertyAccesses", [])}


def ast_owner_properties(inventory: AstInventory, owner: str) -> set[str]:
    return {
        str(access.get("property"))
        for access in inventory.get("propertyAccesses", [])
        if access.get("object") == owner
    }


APPROVED_DYNAMIC_IMPORTS: Mapping[str, tuple[str, ...]] = {}
APPROVED_ROOT_BROWSER_MODULES: tuple[str, ...] = (
    "catalog-snapshot.js",
    "catalogs.generated.module.js",
    "catalog-taxonomy.generated.module.js",
)
EXTERNAL_RUNTIME_MODULES: tuple[str, ...] = (
    "catalog-search.js",
    "tooltip-manager.js",
    "favorites-store.js",
    "site-routes.js",
)
FORBIDDEN_RUNTIME_GLOBALS: tuple[str, ...] = (
    "BargigCatalogSearch",
    "BargigTooltips",
    "BargigFavorites",
    "BargigRoutes",
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

Z_INDEX_SCALE: tuple[str, ...] = (
    "--z-sticky",
    "--z-site-header",
    "--z-viewer-hotspot",
    "--z-viewer-shell",
    "--z-viewer-progress",
    "--z-search-results",
    "--z-floating-control",
    "--z-scroll-top",
    "--z-mobile-menu",
    "--z-viewer-root",
    "--z-feature-panel",
    "--z-feature-action",
    "--z-search-popover",
    "--z-dialog",
    "--z-floating-menu",
    "--z-elevated-menu",
    "--z-toast",
    "--z-tour",
    "--z-transfer-dialog",
    "--z-note-dialog",
    "--z-skip-link",
    "--z-tooltip",
)



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
    if "src/runtime/**/*.js" not in include:
        failures.append("jsconfig.json must type-check every external runtime module via src/runtime/**/*.js")
    for root_module in APPROVED_ROOT_BROWSER_MODULES:
        if root_module not in include:
            failures.append(f"jsconfig.json must type-check approved root browser module: {root_module}")
    if compiler.get("module") != "ESNext" or compiler.get("moduleResolution") != "Bundler":
        failures.append("jsconfig.json must type-check native ES modules with module=ESNext and moduleResolution=Bundler")
    files = config.get("files", [])
    if "types/frontend-globals.d.ts" not in files:
        failures.append("jsconfig.json must include types/frontend-globals.d.ts")


def check_es_module_imports(
    base: Path,
    sources: list[Path],
    inventory: Mapping[str, AstInventory],
    failures: list[str],
) -> None:
    """Validate explicit local imports and reject unreviewed dependency cycles."""

    entries = sorted((base / "src" / "entries").glob("*.js"))
    root_modules = [base / relative for relative in APPROVED_ROOT_BROWSER_MODULES]
    allowed_root = (base / "src").resolve()
    entry_root = (base / "src" / "entries").resolve()
    all_modules = [*sources, *entries, *root_modules]
    graph: dict[str, set[str]] = {path.relative_to(base).as_posix(): set() for path in all_modules}

    for path in all_modules:
        relative = path.relative_to(base).as_posix()
        module_inventory = inventory[relative]
        dynamic_imports = module_inventory.get("dynamicImports", [])
        non_static_dynamic_imports = [item for item in dynamic_imports if not item.get("static")]
        dynamic_specifiers = tuple(
            str(item["specifier"])
            for item in dynamic_imports
            if item.get("static") and item.get("specifier") is not None
        )
        expected_dynamic_specifiers = APPROVED_DYNAMIC_IMPORTS.get(relative, ())
        if dynamic_specifiers != expected_dynamic_specifiers:
            failures.append(
                f"dynamic import contract changed for {relative}; "
                f"expected={expected_dynamic_specifiers}, actual={dynamic_specifiers}"
            )
        if non_static_dynamic_imports:
            failures.append(f"dynamic import must use one reviewed static string specifier: {relative}")
        for specifier in dynamic_specifiers:
            target = (path.parent / specifier).resolve()
            if not specifier.endswith(".js") or not target.is_file():
                failures.append(f"reviewed dynamic import target is invalid: {relative} -> {specifier}")
        for raw_specifier in module_inventory.get("staticImports", []):
            specifier = str(raw_specifier)
            if not specifier.startswith("."):
                failures.append(f"browser source imports a package directly instead of a local module: {relative} -> {specifier}")
                continue
            if not specifier.endswith(".js"):
                failures.append(f"browser import must include an explicit .js extension: {relative} -> {specifier}")
            resolved = (path.parent / specifier).resolve()
            try:
                resolved_relative = resolved.relative_to(allowed_root)
                target_relative = f"src/{resolved_relative.as_posix()}"
            except ValueError:
                try:
                    target_relative = resolved.relative_to(base.resolve()).as_posix()
                except ValueError:
                    failures.append(f"browser import escapes project root: {relative} -> {specifier}")
                    continue
                if target_relative not in APPROVED_ROOT_BROWSER_MODULES:
                    failures.append(f"browser import escapes src/: {relative} -> {specifier}")
                    continue
            if not resolved.is_file():
                failures.append(f"browser import target is missing: {relative} -> {specifier}")
                continue
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

    for cycle in sorted(cycles, key=lambda value: sorted(value)):
        failures.append(f"ES-module dependency cycle is forbidden: {sorted(cycle)}")

    expected_entries = {"catalog.js", "favorites.js", "viewer.js", "payment.js"}
    actual_entries = {path.name for path in entries}
    if actual_entries != expected_entries:
        failures.append(
            "route entrypoint set is not exact; "
            f"expected={sorted(expected_entries)}, actual={sorted(actual_entries)}"
        )


def check_feature_registry(
    base: Path,
    sources: list[Path],
    inventory: Mapping[str, AstInventory],
    failures: list[str],
) -> None:
    contracts = (base / "types/frontend-contracts.d.ts").read_text(encoding="utf-8")
    registry = (base / "src/js/10-app-state.js").read_text(encoding="utf-8")
    if not re.search(r"export\s+(?:type|interface)\s+FeatureRegistry\b", contracts) or "keyof FeatureRegistry" not in contracts:
        failures.append("frontend contracts do not define an exact FeatureRegistry")
    if re.search(r"@typedef\s+\{Object\}\s+FeatureInterface\b", contracts):
        failures.append("legacy generic FeatureInterface contract remains")
    if "@template {FeatureName} K" not in registry:
        failures.append("feature registry access is not keyed by FeatureName")
    if "function requireFeatureInterface(name)" not in registry:
        failures.append("required feature seams can still degrade into silent optional no-ops")

    registered: list[str] = []
    for path in sources:
        relative = path.relative_to(base).as_posix()
        for call in ast_calls(inventory[relative], "registerFeatureInterface"):
            arguments = call.get("arguments", [])
            if arguments and isinstance(arguments[0], str):
                registered.append(arguments[0])
            else:
                failures.append(f"feature registration must use a static literal name: {relative}")
    unknown = sorted(set(registered) - FEATURE_NAMES)
    missing = sorted(FEATURE_NAMES - set(registered))
    duplicates = sorted(name for name in set(registered) if registered.count(name) > 1)
    if unknown:
        failures.append(f"unknown feature registrations: {', '.join(unknown)}")
    if missing:
        failures.append(f"missing feature registrations: {', '.join(missing)}")
    if duplicates:
        failures.append(f"duplicate feature registrations: {', '.join(duplicates)}")


def check_bootstrap_boundary(
    base: Path,
    inventory: Mapping[str, AstInventory],
    failures: list[str],
) -> None:
    path = base / "src/js/90-bootstrap.js"
    relative = path.relative_to(base).as_posix()
    module_inventory = inventory[relative]
    function_names = module_inventory.get("functionDeclarations", [])
    if function_names != ["init"]:
        failures.append("90-bootstrap.js must contain only the init startup function")
    if not ast_calls(module_inventory, 'requireFeatureInterface("app-shell").initialize'):
        failures.append("90-bootstrap.js must require the app-shell feature during startup")
    if ast_calls(module_inventory, "getFeatureInterface"):
        failures.append("90-bootstrap.js must not allow a missing app-shell feature to become a silent no-op")
    if int(module_inventory.get("topLevelStatementCount", 0)) > 8:
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

    ast_structural_tests = (
        "tests/control_panel_modular_architecture_contract.test.js",
        "tests/viewer_dependency_graph_contract.test.js",
        "tests/viewer_navigation_source_contract.test.js",
        "tests/viewer_state_domains_contract.test.js",
    )
    ast_helper = base / "tests/helpers/frontend_ast.js"
    ast_cli = base / "tools/frontend_ast_inventory.js"
    if not ast_helper.is_file() or not ast_cli.is_file():
        failures.append("shared TypeScript AST inventory boundary is missing")
    for relative in ast_structural_tests:
        path = base / relative
        if not path.is_file():
            failures.append(f"required AST structural contract is missing: {relative}")
            continue
        text = path.read_text(encoding="utf-8")
        if "frontend_ast.js" not in text:
            failures.append(f"{relative} must use the shared TypeScript AST helper")
        if "assert.match(" in text or "assert.doesNotMatch(" in text:
            failures.append(f"{relative} must not regress to source-regex structure assertions")

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

    for output in ("app-catalog.js", "app-favorites.js", "app-viewer.js", "app-payment.js"):
        path = base / output
        if not path.is_file():
            continue
        text = path.read_text(encoding="utf-8")
        if "__BARGIG_TEST_EXPORTS__" in text or "TEST-ONLY EXPORTS" in text:
            failures.append(f"{output} ships test-only source exports")



CSS_IMPORTANT_BUDGET_BY_FILE: Mapping[str, int] = {
    "00-foundation.css": 0,
    "06-shell-components.css": 2,
    "08-shared-floating-ui.css": 0,
    "10-catalog.css": 0,
    "20-viewer.css": 2,
    "24-shared-inquiry.css": 0,
    "25-viewer-actions.css": 0,
    "30-media-components.css": 0,
    "40-catalog-refinements.css": 0,
    "50-footer-legal.css": 0,
    "52-payment.css": 0,
    "80-responsive-shell.css": 0,
    "85-favorites-routing.css": 0,
    "87-favorites-workspace.css": 1,
    "90-visual-polish.css": 10,
    "92-viewer-onboarding.css": 2,
    "95-accessibility-consistency.css": 5,
    "97-seo-foundation.css": 0,
}


def check_css_architecture(base: Path, failures: list[str]) -> None:
    """Keep the current cascade behavior explicit and global stacking semantic."""

    css_sources = sorted((base / "src/css").glob("*.css"))
    foundation = (base / "src/css/00-foundation.css").read_text(encoding="utf-8")
    actual_css_names = {path.name for path in css_sources}
    expected_css_names = set(CSS_IMPORTANT_BUDGET_BY_FILE)
    if actual_css_names != expected_css_names:
        missing = sorted(expected_css_names - actual_css_names)
        extra = sorted(actual_css_names - expected_css_names)
        failures.append(f"CSS important override ledger mismatch; missing={missing}, extra={extra}")
    for path in css_sources:
        count = path.read_text(encoding="utf-8").count("!important")
        budget = CSS_IMPORTANT_BUDGET_BY_FILE.get(path.name, 0)
        if count > budget:
            failures.append(
                f"CSS !important budget exceeded in {path.name}: {count} > {budget}; "
                "prefer scoped ownership selectors before adding cascade overrides"
            )
    token_values: list[int] = []
    missing_tokens: list[str] = []
    for token in Z_INDEX_SCALE:
        match = re.search(rf"{re.escape(token)}\s*:\s*(-?\d+)\s*;", foundation)
        if not match:
            missing_tokens.append(token)
            continue
        token_values.append(int(match.group(1)))
    if missing_tokens:
        failures.append(f"global z-index token contract is incomplete: {', '.join(missing_tokens)}")
    elif token_values[0] < 20 or any(left >= right for left, right in zip(token_values, token_values[1:])):
        failures.append("global z-index token values must form a strictly increasing scale starting at 20 or above")

    z_index_declaration = re.compile(r"\bz-index\s*:\s*([^;{}]+)")
    semantic_token = re.compile(r"var\((--z-[a-z0-9-]+)\)(?:\s*!important)?$", re.IGNORECASE)
    local_integer = re.compile(r"-?\d+(?:\s*!important)?$", re.IGNORECASE)
    approved_tokens = frozenset(Z_INDEX_SCALE)
    for path in css_sources:
        relative = path.relative_to(base).as_posix()
        text = path.read_text(encoding="utf-8")
        if "@layer" in strip_javascript_comments(text):
            failures.append(f"CSS source declares a cascade layer directly; builder owns the layer boundary: {relative}")
        for match in z_index_declaration.finditer(text):
            value = match.group(1).strip()
            token_match = semantic_token.fullmatch(value)
            integer_match = local_integer.fullmatch(value)
            if token_match and token_match.group(1) in approved_tokens:
                continue
            if integer_match and abs(int(value.split()[0])) < 20:
                continue
            line = text.count("\n", 0, match.start()) + 1
            failures.append(
                f"unreviewed z-index declaration in {relative}:{line}: {value}; "
                "use a semantic --z-* token or a local integer below 20"
            )

    expected_layer = "bargig.application"
    for name in ("styles.css", "styles-catalog.css", "styles-favorites.css", "styles-viewer.css"):
        path = base / name
        if not path.is_file():
            failures.append(f"generated CSS bundle is missing: {name}")
            continue
        text = path.read_text(encoding="utf-8")
        if f"Cascade layer: {expected_layer}" not in text:
            failures.append(f"{name} does not publish the reviewed cascade layer")
        if text.count(f"@layer {expected_layer};") != 1:
            failures.append(f"{name} must declare the cascade layer exactly once")
        if text.count(f"@layer {expected_layer} {{") != 1 or not text.rstrip().endswith("}"):
            failures.append(f"{name} must wrap the complete reviewed cascade in one safe layer")

def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def declared_properties(
    inventory: Mapping[str, AstInventory],
    owner: str,
    relative_path: str,
) -> set[str]:
    properties = inventory[relative_path].get("objectDeclarations", {}).get(owner)
    if properties is None:
        raise RuntimeError(f"Could not find declared object for {owner} in {relative_path}")
    return {str(name) for name in properties}


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
    runtime_sources = sorted((base / "src" / "runtime").glob("*.js"))
    all_browser_sources = [*sources, *runtime_sources]
    ast_paths = list(dict.fromkeys([
        *all_browser_sources,
        *sorted((base / "src/entries").glob("*.js")),
        *(base / relative for relative in APPROVED_ROOT_BROWSER_MODULES),
        *(base / relative for relative in EXTERNAL_RUNTIME_MODULES),
    ]))
    inventory = load_ast_inventory(base, ast_paths)
    failures: list[str] = []

    check_typecheck_configuration(base, failures)
    check_es_module_imports(base, all_browser_sources, inventory, failures)
    check_feature_registry(base, sources, inventory, failures)
    check_bootstrap_boundary(base, inventory, failures)

    for path in [*runtime_sources, *(base / name for name in EXTERNAL_RUNTIME_MODULES)]:
        if not path.is_file():
            failures.append(f"external runtime module is missing: {path.relative_to(base).as_posix()}")
            continue
        relative = path.relative_to(base).as_posix()
        property_paths = ast_property_paths(inventory[relative])
        for global_name in FORBIDDEN_RUNTIME_GLOBALS:
            if f"window.{global_name}" in property_paths:
                failures.append(
                    f"business runtime API leaked back onto window.{global_name}: {relative}"
                )

    check_test_strategy(base, failures)
    check_test_only_exports(base, sources, failures)
    check_css_architecture(base, failures)

    for path in sources:
        relative_path = path.relative_to(base).as_posix()
        identifiers = set(inventory[relative_path].get("identifiers", []))
        for identifier, allowed_paths in DIRECT_ACCESS_OWNERS.items():
            if relative_path not in allowed_paths and identifier in identifiers:
                failures.append(
                    f"{relative_path} reaches into {identifier}; use the owning feature interface instead"
                )

    all_property_accesses = [
        access
        for path in sources
        for access in inventory[path.relative_to(base).as_posix()].get("propertyAccesses", [])
    ]
    if any(access.get("object") == "state" for access in all_property_accesses):
        failures.append("legacy monolithic state access remains")
    if any(access.get("object") == "els" for access in all_property_accesses):
        failures.append("legacy monolithic els.* access remains")

    all_state_properties: dict[str, str] = {}
    for owner, relative_path in STATE_OWNERS.items():
        declared = declared_properties(inventory, owner, relative_path)
        for name in declared:
            previous = all_state_properties.get(name)
            if previous:
                failures.append(f"state property '{name}' is owned by both {previous} and {owner}")
            all_state_properties[name] = owner
        used = set().union(*(ast_owner_properties(inventory[path.relative_to(base).as_posix()], owner) for path in sources))
        unknown = sorted(used - declared)
        if unknown:
            failures.append(f"{owner} uses undeclared properties: {', '.join(unknown)}")

    all_element_properties: dict[str, str] = {}
    for owner, relative_path in ELEMENT_OWNERS.items():
        declared = declared_properties(inventory, owner, relative_path)
        for name in declared:
            previous = all_element_properties.get(name)
            if previous:
                failures.append(f"DOM reference '{name}' is owned by both {previous} and {owner}")
            all_element_properties[name] = owner
        used = set().union(*(ast_owner_properties(inventory[path.relative_to(base).as_posix()], owner) for path in sources))
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
        if relative not in type_only_modules and not inventory[relative].get("isExternalModule"):
            failures.append(f"runtime source is not an ES module: {relative}")
        if "share one lexical scope" in text or "concatenates all sources" in text:
            failures.append(f"legacy shared-scope architecture text remains: {relative}")

    entries = {"catalog", "favorites", "viewer", "payment"}
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
            "required": (
                "src/js/39-search-catalog-domain.js",
                "src/js/40-catalog-grid.js",
                "src/js/50-search-ui.js",
            ),
            "forbidden": (
                "src/js/16-viewer-state.js",
                "src/js/17-viewer-state-transitions.js",
                "src/js/31-viewer-share.js",
                "src/js/51-viewer-session-state.js",
                "src/js/52-viewer-session.js",
                "src/js/53-viewer-image.js",
                "src/js/54-viewer-geometry.js",
                "src/js/55-viewer-zoom-controller.js",
                "src/js/56-viewer-shell.js",
                "src/js/57-viewer-fit-controller.js",
                "src/js/58-viewer-navigation.js",
                "src/js/59-viewer-page-controller.js",
                "src/js/60-viewer.js",
                "src/js/61-viewer-layout-controller.js",
                "src/js/62-viewer-actions.js",
                "src/js/65-viewer-onboarding.js",
                "src/js/70-viewer-input.js",
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
                "src/js/17-viewer-state-transitions.js",
                "src/js/31-viewer-share.js",
                "src/js/51-viewer-session-state.js",
                "src/js/52-viewer-session.js",
                "src/js/53-viewer-image.js",
                "src/js/54-viewer-geometry.js",
                "src/js/55-viewer-zoom-controller.js",
                "src/js/56-viewer-shell.js",
                "src/js/57-viewer-fit-controller.js",
                "src/js/58-viewer-navigation.js",
                "src/js/59-viewer-page-controller.js",
                "src/js/60-viewer.js",
                "src/js/61-viewer-layout-controller.js",
                "src/js/62-viewer-actions.js",
                "src/js/65-viewer-onboarding.js",
                "src/js/70-viewer-input.js",
            ),
        },
        "app-viewer.js": {
            "required": (
                "src/js/16-viewer-state.js",
                "src/js/17-viewer-state-transitions.js",
                "src/js/31-viewer-share.js",
                "src/js/32-shared-inquiry.js",
                "src/js/35-favorites-workspace.js",
                "src/js/39-search-catalog-domain.js",
                "src/js/40-catalog-grid.js",
                "src/js/51-viewer-session-state.js",
                "src/js/52-viewer-session.js",
                "src/js/53-viewer-image.js",
                "src/js/54-viewer-geometry.js",
                "src/js/55-viewer-zoom-controller.js",
                "src/js/56-viewer-shell.js",
                "src/js/57-viewer-fit-controller.js",
                "src/js/58-viewer-navigation.js",
                "src/js/59-viewer-page-controller.js",
                "src/js/60-viewer.js",
                "src/js/61-viewer-layout-controller.js",
                "src/js/62-viewer-actions.js",
                "src/js/65-viewer-onboarding.js",
                "src/js/70-viewer-input.js",
            ),
            "forbidden": (),
        },
        "app-payment.js": {
            "required": ("src/entries/payment.js",),
            "forbidden": (
                "src/js/16-viewer-state.js",
                "src/js/17-viewer-state-transitions.js",
                "src/js/35-favorites-workspace.js",
                "src/js/40-catalog-grid.js",
                "src/js/60-viewer.js",
            ),
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
        if re.fullmatch(r"(?:31|5[1-9]|6[0-9]|70)-.*\.js", path.name)
    ]
    for path in viewer_implementation_sources:
        relative = path.relative_to(base).as_posix()
        identifiers = set(inventory[relative].get("identifiers", []))
        if identifiers.intersection({"searchState", "searchElements"}):
            failures.append(
                "Viewer implementation reaches into search internals instead of the feature interface: "
                f"{relative}"
            )

    search_relative = "src/js/50-search-ui.js"
    search_identifiers = set(inventory[search_relative].get("identifiers", []))
    forbidden_viewer_internals = {
        "viewerSessionState", "viewerViewportState", "viewerGestureState",
        "viewerChromeState", "viewerImageState", "viewerNavigationState",
        "viewerOnboardingState", "viewerElements",
    }
    if search_identifiers.intersection(forbidden_viewer_internals):
        failures.append("Search implementation reaches into Viewer internals instead of the feature interface")

    for path in sources:
        relative = path.relative_to(base).as_posix()
        if "document.currentScript" in ast_property_paths(inventory[relative]):
            failures.append(f"native ES module depends on document.currentScript: {relative}")

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
        "payment.html": "app-payment.js",
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
        for runtime_asset in EXTERNAL_RUNTIME_MODULES:
            if f'<script src="{runtime_asset}"></script>' in page_text:
                failures.append(f"{page_name} still loads business runtime {runtime_asset} as a classic script")

    template_text = (base / "site.template.html").read_text(encoding="utf-8")
    if '<script type="module" data-bargig-route-module src="{{ROUTE_SCRIPT}}"></script>' not in template_text:
        failures.append("site.template.html does not emit native route module scripts")
    payment_template_text = (base / "payment.template.html").read_text(encoding="utf-8")
    if '<script type="module" data-bargig-route-module src="{{ROUTE_SCRIPT}}"></script>' not in payment_template_text:
        failures.append("payment.template.html does not emit the native payment route module")
    for runtime_asset in EXTERNAL_RUNTIME_MODULES:
        if f'<script src="{runtime_asset}"></script>' in template_text:
            failures.append(f"site.template.html still loads business runtime {runtime_asset} as a classic script")

    if failures:
        raise RuntimeError("Frontend contract check failed:\n  - " + "\n  - ".join(failures))


if __name__ == "__main__":
    check_frontend_contracts()
    print("Frontend feature contracts passed.")
