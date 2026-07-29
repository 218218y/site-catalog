#!/usr/bin/env python3
"""Build deterministic route-specific browser assets.

JavaScript is authored as native ES modules under ``src/js``. Each route has a
small entrypoint under ``src/entries`` and is bundled by the project's directly
pinned esbuild dependency. The generated files keep their historical names and
IIFE browser format, so existing HTML and fullscreen-safe in-document routing
remain unchanged while every source dependency is explicit and statically
validated.

CSS remains a reviewed ordered concatenation because cascade order is part of
its runtime contract. All generated files are written atomically. ``--check``
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

CATALOG_JS_INPUTS: tuple[str, ...] = (
    "src/entries/catalog.js", "src/js/00-navigation.js", "src/js/01-route-capabilities.js",
    "src/js/02-dom-contracts.js", "src/js/03-runtime-context.js", "src/js/10-app-state.js", "src/js/11-navigation-state.js", "src/js/12-catalog-state.js",
    "src/js/13-search-state.js", "src/js/14-favorites-state.js", "src/js/15-telemetry.js",
    "src/js/17-catalog-asset-urls.js", "src/js/18-navigation-feature.js", "src/js/20-shared-ui.js",
    "src/js/29-favorites-portability.js", "src/js/30-favorites-share.js",
    "src/js/39-search-catalog-domain.js", "src/js/40-catalog-grid.js",
    "src/js/50-search-ui.js", "src/js/80-app-shell.js", "src/js/90-bootstrap.js",
)
FAVORITES_JS_INPUTS: tuple[str, ...] = (
    "src/entries/favorites.js", "src/js/00-navigation.js", "src/js/01-route-capabilities.js",
    "src/js/02-dom-contracts.js", "src/js/03-runtime-context.js", "src/js/10-app-state.js", "src/js/11-navigation-state.js", "src/js/12-catalog-state.js",
    "src/js/13-search-state.js", "src/js/14-favorites-state.js", "src/js/15-telemetry.js",
    "src/js/17-catalog-asset-urls.js", "src/js/18-navigation-feature.js", "src/js/19-shared-pure.js", "src/js/20-shared-ui.js",
    "src/js/29-favorites-portability.js", "src/js/30-favorites-share.js",
    "src/js/32-shared-inquiry.js", "src/js/35-favorites-workspace.js",
    "src/js/39-search-catalog-domain.js", "src/js/40-catalog-grid.js",
    "src/js/50-search-ui.js", "src/js/80-app-shell.js", "src/js/90-bootstrap.js",
)
VIEWER_JS_INPUTS: tuple[str, ...] = (
    "src/entries/viewer.js", "src/js/00-navigation.js", "src/js/01-route-capabilities.js",
    "src/js/02-dom-contracts.js", "src/js/03-runtime-context.js", "src/js/10-app-state.js", "src/js/11-navigation-state.js", "src/js/12-catalog-state.js",
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
)

@dataclass(frozen=True)
class FrontendBundleSpec:
    output_name: str
    kind: str
    modules: tuple[str, ...] = ()
    entrypoint: str | None = None
    expected_inputs: tuple[str, ...] = ()
    capabilities: Mapping[str, bool] | None = None

BUNDLE_SPECS: tuple[FrontendBundleSpec, ...] = (
    FrontendBundleSpec("styles.css", "css", CORE_CSS_MODULES),
    FrontendBundleSpec("styles-catalog.css", "css", CATALOG_CSS_MODULES),
    FrontendBundleSpec("styles-favorites.css", "css", FAVORITES_CSS_MODULES),
    FrontendBundleSpec("styles-viewer.css", "css", VIEWER_CSS_MODULES),
    FrontendBundleSpec("app-catalog.js", "js", entrypoint="src/entries/catalog.js",
        expected_inputs=CATALOG_JS_INPUTS,
        capabilities={"viewer": False, "favoritesWorkspace": False, "catalogGrid": True, "search": True}),
    FrontendBundleSpec("app-favorites.js", "js", entrypoint="src/entries/favorites.js",
        expected_inputs=FAVORITES_JS_INPUTS,
        capabilities={"viewer": False, "favoritesWorkspace": True, "catalogGrid": True, "search": True}),
    FrontendBundleSpec("app-viewer.js", "js", entrypoint="src/entries/viewer.js",
        expected_inputs=VIEWER_JS_INPUTS,
        capabilities={"viewer": True, "favoritesWorkspace": True, "catalogGrid": True, "search": True}),
)

LEGACY_LOADER_NAME = "app.js"
ROUTE_GENERATED_FILES = tuple(spec.output_name for spec in BUNDLE_SPECS)
DEPLOY_GENERATED_FILES = ROUTE_GENERATED_FILES
GENERATED_FILES = (*ROUTE_GENERATED_FILES, LEGACY_LOADER_NAME)
GENERATED_JS_FILES = (*(spec.output_name for spec in BUNDLE_SPECS if spec.kind == "js"), LEGACY_LOADER_NAME)
GENERATED_CSS_FILES = tuple(spec.output_name for spec in BUNDLE_SPECS if spec.kind == "css")
ROUTE_ASSETS: Mapping[str, tuple[str, str]] = {
    "home": ("styles-catalog.css", "app-catalog.js"),
    "catalog": ("styles-catalog.css", "app-catalog.js"),
    "favorites": ("styles-favorites.css", "app-favorites.js"),
    "viewer": ("styles-viewer.css", "app-viewer.js"),
}

MODULE_NAME_PATTERN = re.compile(r"^(?P<order>\d{2})-[a-z0-9-]+\.(?P<extension>js|css)$")
ESBUILD_RUNNER = Path(__file__).with_name("build_frontend_esbuild.mjs")

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
    if Path(spec.entrypoint).parent.as_posix() != "src/entries":
        raise ValueError(f"JavaScript entrypoint must live under src/entries: {spec.entrypoint}")
    for relative in spec.expected_inputs:
        read_source_module(root, relative)
    if spec.entrypoint not in spec.expected_inputs:
        raise ValueError(f"Expected graph for {spec.output_name} does not contain its entrypoint")


def source_manifest_text(module_paths: Sequence[str]) -> str:
    return "\n".join(f" *   - {path}" for path in module_paths)


def render_css_bundle(root: Path, spec: FrontendBundleSpec) -> str:
    validate_module_manifest(spec.modules, expected_extension="css")
    sections = [
        "/*\n * GENERATED FILE — DO NOT EDIT DIRECTLY.\n"
        f" * Browser bundle: {spec.output_name}\n * Source modules:\n{source_manifest_text(spec.modules)}\n"
        " * Build command: python tools/build_frontend_assets.py\n */\n"
    ]
    for relative in spec.modules:
        sections.append(f"\n/* ===== BEGIN SOURCE: {relative} ===== */\n{read_source_module(root, relative)}/* ===== END SOURCE: {relative} ===== */\n")
    return normalize_text("".join(sections))


def _normalize_metafile_inputs(root: Path, inputs: Mapping[str, object]) -> tuple[str, ...]:
    normalized: list[str] = []
    root_resolved = root.resolve()
    for raw_path in inputs:
        candidate = Path(raw_path)
        if candidate.is_absolute():
            relative = candidate.resolve().relative_to(root_resolved).as_posix()
        else:
            relative = candidate.as_posix().removeprefix("./")
        normalized.append(relative)
    return tuple(sorted(normalized))


def render_javascript_bundle(root: Path, spec: FrontendBundleSpec) -> str:
    validate_js_spec(root, spec)
    capabilities = {
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
        ]
        completed = subprocess.run(command, cwd=root, text=True, capture_output=True, check=False)
        if completed.returncode:
            details = (completed.stderr or completed.stdout).strip()
            raise RuntimeError(f"esbuild failed for {spec.output_name}: {details}")
        raw_bundle = normalize_text(raw_output.read_text(encoding="utf-8"))
        metafile = json.loads(metafile_path.read_text(encoding="utf-8"))

    actual_inputs = _normalize_metafile_inputs(root, metafile.get("inputs", {}))
    expected_inputs = tuple(sorted(spec.expected_inputs))
    if actual_inputs != expected_inputs:
        missing = sorted(set(expected_inputs) - set(actual_inputs))
        unexpected = sorted(set(actual_inputs) - set(expected_inputs))
        raise RuntimeError(
            f"Unexpected esbuild graph for {spec.output_name}; missing={missing}, unexpected={unexpected}"
        )
    if "__BARGIG_TEST_EXPORTS__" in raw_bundle or "TEST-ONLY EXPORTS" in raw_bundle:
        raise RuntimeError(f"Test-only exports leaked into {spec.output_name}")

    banner = (
        "/*\n * GENERATED FILE — DO NOT EDIT DIRECTLY.\n"
        f" * Browser bundle: {spec.output_name}\n * ES module entrypoint: {spec.entrypoint}\n"
        f" * Bundled ES module graph:\n{source_manifest_text(spec.expected_inputs)}\n"
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
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "wb") as handle:
            handle.write(encoded); handle.flush(); os.fsync(handle.fileno())
        temporary.replace(path)
    except Exception:
        temporary.unlink(missing_ok=True); raise
    return True


def build_one(root: Path, spec: FrontendBundleSpec, *, check: bool) -> FrontendBuildResult:
    content = render_javascript_bundle(root, spec) if spec.kind == "js" else render_css_bundle(root, spec)
    output = root / spec.output_name
    expected = content.encode("utf-8")
    stale = not output.is_file() or output.read_bytes() != expected
    if check and stale:
        raise RuntimeError(f"Generated frontend asset is stale: {spec.output_name}. Run: python tools/build_frontend_assets.py")
    changed = False if check else atomic_write_text(output, content)
    module_count = len(spec.expected_inputs if spec.kind == "js" else spec.modules)
    return FrontendBuildResult(output, module_count, len(expected), changed, sha256_text(content))


def render_legacy_loader() -> str:
    route_map = {page: ROUTE_ASSETS[page][1] for page in ("favorites", "viewer", "home", "catalog")}
    return normalize_text(
        "/* GENERATED COMPATIBILITY LOADER — current pages do not reference this file. */\n"
        "(() => {\n  \"use strict\";\n"
        "  if (document.querySelector('script[data-bargig-route-bundle]')) return;\n"
        f"  const routeAssets = Object.freeze({json.dumps(route_map, separators=(',', ':'))});\n"
        "  const page = String(document.body?.dataset?.page || \"home\");\n"
        "  const asset = routeAssets[page] || routeAssets.home;\n"
        "  const currentSource = document.currentScript?.src || document.baseURI;\n"
        "  const script = document.createElement(\"script\");\n"
        "  script.src = new URL(asset, currentSource).href;\n  script.async = false;\n"
        "  script.dataset.bargigRouteBundle = page;\n  document.head.appendChild(script);\n})();\n"
    )


def build_legacy_loader(root: Path, *, check: bool) -> FrontendBuildResult:
    output = root / LEGACY_LOADER_NAME
    content = render_legacy_loader(); expected = content.encode("utf-8")
    stale = not output.is_file() or output.read_bytes() != expected
    if check and stale:
        raise RuntimeError(f"Generated frontend compatibility loader is stale: {LEGACY_LOADER_NAME}. Run: python tools/build_frontend_assets.py")
    changed = False if check else atomic_write_text(output, content)
    return FrontendBuildResult(output, 0, len(expected), changed, sha256_text(content))


def build_frontend_assets(root: Path | None = None, *, check: bool = False) -> tuple[FrontendBuildResult, ...]:
    base = (root or project_root()).resolve()
    results = tuple(build_one(base, spec, check=check) for spec in BUNDLE_SPECS)
    return (*results, build_legacy_loader(base, check=check))


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
