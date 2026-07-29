#!/usr/bin/env python3
"""Build the browser-facing JavaScript and CSS from maintainable source modules.

Interactive documents load one route-specific JavaScript bundle and one
route-specific stylesheet. Source code is maintained under ``src/js`` and
``src/css`` and concatenated in fixed, reviewed feature manifests. Each
JavaScript entrypoint is wrapped in its own private strict-mode scope, so a
feature omitted from a route is not downloaded or exposed at runtime.
Source-level JSDoc contracts remain available to TypeScript and editors but are
removed from production JavaScript bundles, so stronger typing does not consume
the browser performance budget.

The legal/SEO shell uses the small shared ``styles.css`` bundle and no
application JavaScript. Manifests are validated before writing and outputs are
written atomically, preserving the project's deterministic, package-manager-
independent deployment model.

Usage:
    python tools/build_frontend_assets.py
    python tools/build_frontend_assets.py --check

``--check`` performs no writes and exits with a failure when a generated bundle
is missing or stale. Normal builds write atomically, so an interrupted command
cannot leave a partially generated browser asset behind.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence

COMMON_JS_MODULES: tuple[str, ...] = (
    "src/js/00-navigation.js",
    "src/js/05-app-contracts.js",
    "src/js/10-app-state.js",
    "src/js/11-navigation-state.js",
    "src/js/12-catalog-state.js",
    "src/js/13-search-state.js",
    "src/js/14-favorites-state.js",
    "src/js/15-telemetry.js",
    "src/js/18-navigation-feature.js",
    "src/js/20-shared-ui.js",
    "src/js/30-favorites-share.js",
)

CATALOG_JS_MODULES: tuple[str, ...] = COMMON_JS_MODULES + (
    "src/js/40-catalog-grid.js",
    "src/js/50-search-ui.js",
    "src/js/80-app-shell.js",
    "src/js/90-bootstrap.js",
)

FAVORITES_JS_MODULES: tuple[str, ...] = COMMON_JS_MODULES + (
    "src/js/32-shared-inquiry.js",
    "src/js/35-favorites-workspace.js",
    "src/js/40-catalog-grid.js",
    "src/js/50-search-ui.js",
    "src/js/80-app-shell.js",
    "src/js/90-bootstrap.js",
)

VIEWER_JS_MODULES: tuple[str, ...] = (
    "src/js/00-navigation.js",
    "src/js/05-app-contracts.js",
    "src/js/10-app-state.js",
    "src/js/11-navigation-state.js",
    "src/js/12-catalog-state.js",
    "src/js/13-search-state.js",
    "src/js/14-favorites-state.js",
    "src/js/15-telemetry.js",
    "src/js/16-viewer-state.js",
    "src/js/18-navigation-feature.js",
    "src/js/20-shared-ui.js",
    "src/js/30-favorites-share.js",
    "src/js/31-viewer-share.js",
    "src/js/32-shared-inquiry.js",
    # Replacing the document exits browser fullscreen. The Viewer bundle keeps
    # the route features needed for fullscreen-safe in-document hand-offs.
    "src/js/35-favorites-workspace.js",
    "src/js/40-catalog-grid.js",
    "src/js/50-search-ui.js",
    "src/js/52-viewer-session.js",
    "src/js/53-viewer-image.js",
    "src/js/54-viewer-geometry.js",
    "src/js/56-viewer-shell.js",
    "src/js/58-viewer-navigation.js",
    "src/js/60-viewer.js",
    "src/js/62-viewer-actions.js",
    "src/js/65-viewer-onboarding.js",
    "src/js/70-viewer-input.js",
    "src/js/80-app-shell.js",
    "src/js/90-bootstrap.js",
)

CORE_CSS_MODULES: tuple[str, ...] = (
    "src/css/00-foundation.css",
    "src/css/06-shell-components.css",
    "src/css/30-media-components.css",
    "src/css/50-footer-legal.css",
    "src/css/80-responsive-shell.css",
    "src/css/90-visual-polish.css",
    "src/css/95-accessibility-consistency.css",
    "src/css/97-seo-foundation.css",
)

CATALOG_CSS_MODULES: tuple[str, ...] = (
    "src/css/00-foundation.css",
    "src/css/06-shell-components.css",
    "src/css/08-shared-floating-ui.css",
    "src/css/10-catalog.css",
    "src/css/30-media-components.css",
    "src/css/40-catalog-refinements.css",
    "src/css/50-footer-legal.css",
    "src/css/80-responsive-shell.css",
    "src/css/90-visual-polish.css",
    "src/css/95-accessibility-consistency.css",
    "src/css/97-seo-foundation.css",
)

FAVORITES_CSS_MODULES: tuple[str, ...] = (
    "src/css/00-foundation.css",
    "src/css/06-shell-components.css",
    "src/css/08-shared-floating-ui.css",
    "src/css/10-catalog.css",
    "src/css/24-shared-inquiry.css",
    "src/css/30-media-components.css",
    "src/css/40-catalog-refinements.css",
    "src/css/50-footer-legal.css",
    "src/css/80-responsive-shell.css",
    "src/css/85-favorites-routing.css",
    "src/css/87-favorites-workspace.css",
    "src/css/90-visual-polish.css",
    "src/css/95-accessibility-consistency.css",
    "src/css/97-seo-foundation.css",
)

VIEWER_CSS_MODULES: tuple[str, ...] = (
    "src/css/00-foundation.css",
    "src/css/05-viewer-onboarding.css",
    "src/css/06-shell-components.css",
    "src/css/08-shared-floating-ui.css",
    "src/css/10-catalog.css",
    "src/css/20-viewer.css",
    "src/css/24-shared-inquiry.css",
    "src/css/25-viewer-actions.css",
    "src/css/30-media-components.css",
    "src/css/40-catalog-refinements.css",
    "src/css/50-footer-legal.css",
    "src/css/80-responsive-shell.css",
    "src/css/85-favorites-routing.css",
    "src/css/87-favorites-workspace.css",
    "src/css/90-visual-polish.css",
    "src/css/95-accessibility-consistency.css",
    "src/css/97-seo-foundation.css",
)

@dataclass(frozen=True)
class FrontendBundleSpec:
    output_name: str
    kind: str
    modules: tuple[str, ...]
    capabilities: Mapping[str, bool] | None = None


BUNDLE_SPECS: tuple[FrontendBundleSpec, ...] = (
    FrontendBundleSpec("styles.css", "css", CORE_CSS_MODULES),
    FrontendBundleSpec("styles-catalog.css", "css", CATALOG_CSS_MODULES),
    FrontendBundleSpec("styles-favorites.css", "css", FAVORITES_CSS_MODULES),
    FrontendBundleSpec("styles-viewer.css", "css", VIEWER_CSS_MODULES),
    FrontendBundleSpec(
        "app-catalog.js",
        "js",
        CATALOG_JS_MODULES,
        {"viewer": False, "favoritesWorkspace": False, "catalogGrid": True, "search": True},
    ),
    FrontendBundleSpec(
        "app-favorites.js",
        "js",
        FAVORITES_JS_MODULES,
        {"viewer": False, "favoritesWorkspace": True, "catalogGrid": True, "search": True},
    ),
    FrontendBundleSpec(
        "app-viewer.js",
        "js",
        VIEWER_JS_MODULES,
        {"viewer": True, "favoritesWorkspace": True, "catalogGrid": True, "search": True},
    ),
)

LEGACY_LOADER_NAME = "app.js"
ROUTE_GENERATED_FILES: tuple[str, ...] = tuple(spec.output_name for spec in BUNDLE_SPECS)
DEPLOY_GENERATED_FILES: tuple[str, ...] = ROUTE_GENERATED_FILES
GENERATED_FILES: tuple[str, ...] = (*ROUTE_GENERATED_FILES, LEGACY_LOADER_NAME)
GENERATED_JS_FILES: tuple[str, ...] = (
    *(spec.output_name for spec in BUNDLE_SPECS if spec.kind == "js"),
    LEGACY_LOADER_NAME,
)
GENERATED_CSS_FILES: tuple[str, ...] = tuple(spec.output_name for spec in BUNDLE_SPECS if spec.kind == "css")
ROUTE_ASSETS: Mapping[str, tuple[str, str]] = {
    "home": ("styles-catalog.css", "app-catalog.js"),
    "catalog": ("styles-catalog.css", "app-catalog.js"),
    "favorites": ("styles-favorites.css", "app-favorites.js"),
    "viewer": ("styles-viewer.css", "app-viewer.js"),
}

MODULE_NAME_PATTERN = re.compile(r"^(?P<order>\d{2})-[a-z0-9-]+\.(?P<extension>js|css)$")
TOP_LEVEL_DECLARATION_PATTERN = re.compile(
    r"^(?:(?:async\s+)?function(?:\s*\*)?\s+|class\s+|(?:const|let|var)\s+)"
    r"(?P<name>[A-Za-z_$][A-Za-z0-9_$]*)",
    re.MULTILINE,
)
INLINE_TYPE_JSDOC_PATTERN = re.compile(
    r"/\*\*\s*@(?:type|param|returns?|template|satisfies)\b.*?\*/",
    re.DOTALL,
)


def validate_module_manifest(module_paths: Sequence[str], *, expected_extension: str) -> None:
    """Reject ambiguous or accidentally reordered frontend module manifests."""

    if len(module_paths) != len(set(module_paths)):
        raise ValueError(f"Duplicate {expected_extension} source module in frontend manifest")

    previous_order = -1
    for relative_path in module_paths:
        path = Path(relative_path)
        match = MODULE_NAME_PATTERN.fullmatch(path.name)
        if (
            path.parent.as_posix() != f"src/{expected_extension}"
            or not match
            or match.group("extension") != expected_extension
        ):
            raise ValueError(
                f"Frontend module must use src/{expected_extension}/NN-feature.{expected_extension}: {relative_path}"
            )
        order = int(match.group("order"))
        if order <= previous_order:
            raise ValueError(
                f"Frontend {expected_extension} module order is not strictly increasing at: {relative_path}"
            )
        previous_order = order


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
    """Return deterministic UTF-8 text with LF endings and one final newline."""

    return text.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n"


def read_source_module(root: Path, relative_path: str) -> str:
    path = root / relative_path
    if not path.is_file():
        raise FileNotFoundError(f"Frontend source module is missing: {relative_path}")
    content = normalize_text(path.read_text(encoding="utf-8-sig"))
    if not content.strip():
        raise ValueError(f"Frontend source module is empty: {relative_path}")
    return content


def strip_source_jsdoc(content: str) -> str:
    """Remove standalone JSDoc blocks without touching executable text.

    Frontend modules keep extensive ``@typedef``/``@param`` contracts for
    ``checkJs``. They are build-time metadata and should not be downloaded by
    every browser. The scanner intentionally strips only comments that begin on
    an otherwise-empty source line; comment-like text inside strings, template
    literals, regular expressions, or trailing code is preserved verbatim.
    ``/*!`` license comments are retained.
    """

    output: list[str] = []
    in_jsdoc = False
    for line in content.splitlines(keepends=True):
        stripped = line.lstrip()
        if not in_jsdoc:
            if not stripped.startswith("/**") or stripped.startswith("/*!"):
                output.append(line)
                continue
            closing_index = stripped.find("*/", 3)
            if closing_index < 0:
                in_jsdoc = True
                continue
            if stripped[closing_index + 2 :].strip():
                output.append(line)
            continue

        closing_index = stripped.find("*/")
        if closing_index < 0:
            continue
        in_jsdoc = False
        remainder = stripped[closing_index + 2 :]
        if remainder.strip():
            output.append(remainder)

    if in_jsdoc:
        raise ValueError("Unterminated standalone JSDoc block in frontend source")
    return normalize_text(INLINE_TYPE_JSDOC_PATTERN.sub("", "".join(output)))


def source_manifest_text(module_paths: Sequence[str]) -> str:
    return "\n".join(f" *   - {path}" for path in module_paths)


def top_level_declarations(content: str) -> tuple[str, ...]:
    """Return zero-indented declarations that share the generated bundle scope.

    Source modules are concatenated into one private lexical scope. A duplicate
    top-level name can therefore shadow a function or make a ``const`` bundle
    fail at parse time. Keeping this check in the builder makes that architectural
    contract impossible to bypass accidentally.
    """

    return tuple(match.group("name") for match in TOP_LEVEL_DECLARATION_PATTERN.finditer(content))


def validate_js_module_boundaries(root: Path, module_paths: Sequence[str]) -> dict[str, str]:
    """Validate module identity and reject duplicate bundle-scope declarations."""

    owners: dict[str, str] = {}
    for relative_path in module_paths:
        content = read_source_module(root, relative_path)
        filename = Path(relative_path).name
        header = "\n".join(content.splitlines()[:12])
        expected_header = f"Source module: {filename}"
        if expected_header not in header:
            raise ValueError(
                f"Frontend JavaScript module header must identify its source file: {relative_path}"
            )

        for name in top_level_declarations(content):
            previous = owners.get(name)
            if previous:
                raise ValueError(
                    f"Duplicate top-level JavaScript declaration '{name}' in "
                    f"{previous} and {relative_path}"
                )
            owners[name] = relative_path
    return owners


def render_bundle(
    root: Path,
    *,
    target: str,
    kind: str,
    module_paths: Sequence[str],
    capabilities: Mapping[str, bool] | None = None,
) -> str:
    if kind not in {"js", "css"}:
        raise ValueError(f"Unsupported frontend bundle kind: {kind}")

    validate_module_manifest(module_paths, expected_extension=kind)
    if kind == "js":
        validate_js_module_boundaries(root, module_paths)

    comment_open, comment_close = "/*", "*/"
    banner = (
        f"{comment_open}\n"
        " * GENERATED FILE — DO NOT EDIT DIRECTLY.\n"
        f" * Browser bundle: {target}\n"
        " * Source modules:\n"
        f"{source_manifest_text(module_paths)}\n"
        " * Build command: python tools/build_frontend_assets.py\n"
        f" {comment_close}\n"
    )

    sections: list[str] = [banner]
    if kind == "js":
        # One private strict-mode scope prevents hundreds of implementation helpers from
        # becoming mutable window globals while preserving a single cacheable browser file.
        sections.append('\n(() => {\n"use strict";\n')
        normalized_capabilities = {
            "viewer": False,
            "favoritesWorkspace": False,
            "catalogGrid": False,
            "search": False,
            **dict(capabilities or {}),
        }
        sections.append(
            "\n"
            f"const featureCapabilities = Object.freeze({json.dumps(normalized_capabilities, separators=(',', ':'))});\n"
        )

    for relative_path in module_paths:
        content = read_source_module(root, relative_path)
        if kind == "js":
            content = strip_source_jsdoc(content)
        sections.append(
            f"\n{comment_open} ===== BEGIN SOURCE: {relative_path} ===== {comment_close}\n"
            f"{content}"
            f"{comment_open} ===== END SOURCE: {relative_path} ===== {comment_close}\n"
        )

    if kind == "js":
        sections.append("\n})();\n")
    return normalize_text("".join(sections))


def sha256_text(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def atomic_write_text(path: Path, content: str) -> bool:
    encoded = content.encode("utf-8")
    if path.is_file() and path.read_bytes() == encoded:
        return False

    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(encoded)
            handle.flush()
            os.fsync(handle.fileno())
        temporary.replace(path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return True


def build_one(root: Path, spec: FrontendBundleSpec, *, check: bool) -> FrontendBuildResult:
    output_name = spec.output_name
    kind = spec.kind
    module_paths = spec.modules
    output = root / output_name
    content = render_bundle(
        root,
        target=output_name,
        kind=kind,
        module_paths=module_paths,
        capabilities=spec.capabilities,
    )
    expected = content.encode("utf-8")
    current = output.read_bytes() if output.is_file() else None
    stale = current != expected

    if check and stale:
        raise RuntimeError(
            f"Generated frontend asset is stale: {output_name}. "
            "Run: python tools/build_frontend_assets.py"
        )

    changed = False if check else atomic_write_text(output, content)
    return FrontendBuildResult(
        output=output,
        modules=len(module_paths),
        bytes=len(expected),
        changed=changed,
        digest=sha256_text(content),
    )


def render_legacy_loader() -> str:
    """Return a tiny compatibility loader for old local documents.

    Current generated pages reference route bundles directly. Keeping ``app.js``
    deterministic prevents an obsolete monolithic bundle from lingering in
    copied projects or cached local HTML while avoiding an extra network hop on
    current pages.
    """

    route_map = {
        "favorites": ROUTE_ASSETS["favorites"][1],
        "viewer": ROUTE_ASSETS["viewer"][1],
        "home": ROUTE_ASSETS["home"][1],
        "catalog": ROUTE_ASSETS["catalog"][1],
    }
    return normalize_text(
        "/* GENERATED COMPATIBILITY LOADER — current pages do not reference this file. */\n"
        "(() => {\n"
        '  "use strict";\n'
        "  if (document.querySelector('script[data-bargig-route-bundle]')) return;\n"
        f"  const routeAssets = Object.freeze({json.dumps(route_map, separators=(',', ':'))});\n"
        '  const page = String(document.body?.dataset?.page || "home");\n'
        '  const asset = routeAssets[page] || routeAssets.home;\n'
        '  const currentSource = document.currentScript?.src || document.baseURI;\n'
        '  const script = document.createElement("script");\n'
        '  script.src = new URL(asset, currentSource).href;\n'
        '  script.async = false;\n'
        '  script.dataset.bargigRouteBundle = page;\n'
        '  document.head.appendChild(script);\n'
        "})();\n"
    )


def build_legacy_loader(root: Path, *, check: bool) -> FrontendBuildResult:
    output = root / LEGACY_LOADER_NAME
    content = render_legacy_loader()
    expected = content.encode("utf-8")
    current = output.read_bytes() if output.is_file() else None
    stale = current != expected
    if check and stale:
        raise RuntimeError(
            f"Generated frontend compatibility loader is stale: {LEGACY_LOADER_NAME}. "
            "Run: python tools/build_frontend_assets.py"
        )
    changed = False if check else atomic_write_text(output, content)
    return FrontendBuildResult(
        output=output,
        modules=0,
        bytes=len(expected),
        changed=changed,
        digest=sha256_text(content),
    )


def build_frontend_assets(root: Path | None = None, *, check: bool = False) -> tuple[FrontendBuildResult, ...]:
    base = (root or project_root()).resolve()
    route_results = tuple(build_one(base, spec, check=check) for spec in BUNDLE_SPECS)
    return (*route_results, build_legacy_loader(base, check=check))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify that every route bundle matches its source manifest without writing files.",
    )
    args = parser.parse_args()

    try:
        results = build_frontend_assets(check=args.check)
    except (FileNotFoundError, ValueError, RuntimeError) as exc:
        print(f"ERROR: {exc}")
        return 1

    for result in results:
        status = "verified" if args.check else ("rebuilt" if result.changed else "unchanged")
        relative = result.output.relative_to(project_root()).as_posix()
        print(
            f"{relative}: {status} from {result.modules} modules "
            f"({result.bytes:,} bytes, sha256 {result.digest[:12]})"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
