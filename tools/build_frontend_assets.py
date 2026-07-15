#!/usr/bin/env python3
"""Build the browser-facing JavaScript and CSS from maintainable source modules.

The public HTML intentionally continues to load exactly one ``app.js`` and one
``styles.css`` file. Source code is maintained under ``src/js`` and ``src/css``
and concatenated in a fixed, reviewed order. JavaScript is wrapped in one
private strict-mode scope, so implementation helpers do not leak into ``window``.
The manifest is validated before writing. This gives the project clear feature
boundaries without adding runtime requests or requiring a JavaScript package
manager on the deployment machine.

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
import os
import re
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

JS_MODULES: tuple[str, ...] = (
    "src/js/00-navigation.js",
    "src/js/10-app-state.js",
    "src/js/20-shared-ui.js",
    "src/js/30-favorites-share.js",
    "src/js/40-catalog-grid.js",
    "src/js/50-search-ui.js",
    "src/js/60-viewer.js",
    "src/js/65-viewer-onboarding.js",
    "src/js/70-viewer-input.js",
    "src/js/90-bootstrap.js",
)

CSS_MODULES: tuple[str, ...] = (
    "src/css/00-foundation.css",
    "src/css/05-viewer-onboarding.css",
    "src/css/06-shell-components.css",
    "src/css/10-catalog.css",
    "src/css/20-viewer.css",
    "src/css/30-media-components.css",
    "src/css/40-catalog-refinements.css",
    "src/css/50-footer-legal.css",
    "src/css/80-responsive-shell.css",
    "src/css/85-favorites-routing.css",
    "src/css/90-visual-polish.css",
)

GENERATED_FILES: tuple[str, ...] = ("app.js", "styles.css")
MODULE_NAME_PATTERN = re.compile(r"^(?P<order>\d{2})-[a-z0-9-]+\.(?P<extension>js|css)$")


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


def source_manifest_text(module_paths: Sequence[str]) -> str:
    return "\n".join(f" *   - {path}" for path in module_paths)


def render_bundle(root: Path, *, kind: str, module_paths: Sequence[str]) -> str:
    if kind not in {"js", "css"}:
        raise ValueError(f"Unsupported frontend bundle kind: {kind}")

    validate_module_manifest(module_paths, expected_extension=kind)

    comment_open, comment_close = "/*", "*/"
    target = "app.js" if kind == "js" else "styles.css"
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

    for relative_path in module_paths:
        content = read_source_module(root, relative_path)
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


def build_one(root: Path, output_name: str, kind: str, module_paths: Sequence[str], *, check: bool) -> FrontendBuildResult:
    output = root / output_name
    content = render_bundle(root, kind=kind, module_paths=module_paths)
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


def build_frontend_assets(root: Path | None = None, *, check: bool = False) -> tuple[FrontendBuildResult, ...]:
    base = (root or project_root()).resolve()
    return (
        build_one(base, "app.js", "js", JS_MODULES, check=check),
        build_one(base, "styles.css", "css", CSS_MODULES, check=check),
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify that app.js and styles.css match the source modules without writing files.",
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
