#!/usr/bin/env python3
"""Validate feature-owned frontend state, DOM references, and route bundle boundaries."""
from __future__ import annotations

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
    code_without_comments = re.sub(r"/\*.*?\*/|//[^\n]*", "", combined, flags=re.DOTALL)
    failures: list[str] = []

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
            "required": ("src/js/40-catalog-grid.js", "src/js/50-search-ui.js"),
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
