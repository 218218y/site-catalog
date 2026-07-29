#!/usr/bin/env python3
"""Validate feature-owned frontend state, DOM references, and route bundle boundaries."""
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
    files = config.get("files", [])
    if "types/frontend-globals.d.ts" not in files:
        failures.append("jsconfig.json must include types/frontend-globals.d.ts")


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
        if "__BARGIG_TEST_EXPORTS__" not in helper_text or "require(resolvedPath)" not in helper_text:
            failures.append("frontend test module loader does not import the real source module")

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


def check_frontend_contracts(root: Path | None = None) -> None:
    base = (root or project_root()).resolve()
    sources = sorted((base / "src" / "js").glob("*.js"))
    combined = "\n".join(path.read_text(encoding="utf-8") for path in sources)
    code_without_comments = strip_javascript_comments(combined)
    failures: list[str] = []

    check_typecheck_configuration(base, failures)
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

    if re.search(r"(?<![A-Za-z0-9_$.])state(?:\??\.|\s*\[)", code_without_comments):
        failures.append("legacy monolithic state access remains")
    if re.search(r"(?<![A-Za-z0-9_$.])els\.", code_without_comments):
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
        for source in expectation["required"]:
            if f"BEGIN SOURCE: {source}" not in text:
                failures.append(f"{output} is missing required feature source {source}")
        for source in expectation["forbidden"]:
            if f"BEGIN SOURCE: {source}" in text:
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

    legacy_loader = base / "app.js"
    if not legacy_loader.is_file():
        failures.append("legacy compatibility loader is missing: app.js")
    else:
        legacy_text = legacy_loader.read_text(encoding="utf-8")
        if "GENERATED COMPATIBILITY LOADER" not in legacy_text:
            failures.append("app.js is still a monolithic bundle instead of the generated route loader")
        for route_asset in ("app-catalog.js", "app-favorites.js", "app-viewer.js"):
            if route_asset not in legacy_text:
                failures.append(f"app.js compatibility loader does not route to {route_asset}")

    if failures:
        raise RuntimeError("Frontend contract check failed:\n  - " + "\n  - ".join(failures))


if __name__ == "__main__":
    check_frontend_contracts()
    print("Frontend feature contracts passed.")
