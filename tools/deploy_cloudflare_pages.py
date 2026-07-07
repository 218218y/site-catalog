#!/usr/bin/env python3
"""Deploy the generated static site bundle to Cloudflare Pages.

Default command executed from the project root:
    npx --yes wrangler pages deploy dist/site-upload-r2 --project-name bargig-catlog --branch main

The script is intentionally small and fixed-purpose so it can be called both
from a .bat file and from the local control panel without exposing arbitrary
shell execution in the browser.
"""
from __future__ import annotations

import argparse
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Sequence

DEFAULT_BUNDLE_DIR = "dist/site-upload-r2"
DEFAULT_PROJECT_NAME = "bargig-catlog"
DEFAULT_BRANCH = "main"
DEFAULT_R2_ASSET_BASE_URL = "https://cdn.bargig-furniture.com"
REQUIRED_BUNDLE_FILES = (
    "index.html",
    "_headers",
)
HTML_ASSET_RE = re.compile(r"<(?:script|link)\b[^>]*(?:src|href)=[\"']([^\"']+)[\"']", re.IGNORECASE)


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def rel_to_root(path: Path) -> str:
    root = project_root().resolve()
    try:
        return path.resolve(strict=False).relative_to(root).as_posix()
    except ValueError:
        return path.as_posix()


def quote_command(command: Sequence[str]) -> str:
    parts: list[str] = []
    for part in command:
        text = str(part)
        if not text or any(ch.isspace() for ch in text) or any(ch in text for ch in '"&()[]{}^=;!\'+,`~'):
            parts.append('"' + text.replace('"', '\\"') + '"')
        else:
            parts.append(text)
    return " ".join(parts)


def ensure_inside_project(path: Path) -> Path:
    root = project_root().resolve()
    resolved = path.resolve(strict=False)
    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"Bundle folder must be inside the project: {path}") from exc
    return resolved


def validate_bundle(bundle_dir: Path) -> None:
    if not bundle_dir.is_dir():
        raise FileNotFoundError(
            f"Bundle folder does not exist: {rel_to_root(bundle_dir)}. "
            "Run bundle-site-r2.bat or the control-panel action 'יצירת באנדל R2' first."
        )
    missing = [relative for relative in REQUIRED_BUNDLE_FILES if not (bundle_dir / relative).is_file()]
    if missing:
        raise FileNotFoundError(
            f"Bundle folder is incomplete: {rel_to_root(bundle_dir)}. Missing: {', '.join(missing)}. "
            "Create a fresh R2 bundle before deploying."
        )

    index_html = (bundle_dir / "index.html").read_text(encoding="utf-8", errors="replace")
    missing_assets: list[str] = []
    for match in HTML_ASSET_RE.finditer(index_html):
        reference = match.group(1).strip()
        if not reference or reference.startswith(("http://", "https://", "//", "#", "mailto:")):
            continue
        reference_path = reference.split("?", 1)[0].split("#", 1)[0]
        if Path(reference_path).suffix.lower() not in {".css", ".js"}:
            continue
        if not (bundle_dir / reference_path).is_file():
            missing_assets.append(reference_path)
    if missing_assets:
        raise FileNotFoundError(
            f"Bundle folder is incomplete: {rel_to_root(bundle_dir)}. "
            f"index.html references missing CSS/JS assets: {', '.join(sorted(set(missing_assets)))}. "
            "Create a fresh R2 bundle before deploying."
        )


def find_npx() -> str:
    candidates = ["npx.cmd", "npx"] if os.name == "nt" else ["npx"]
    for name in candidates:
        executable = shutil.which(name)
        if executable:
            return executable
    raise FileNotFoundError(
        "npx was not found. Install Node.js/npm, then run this command again. "
        "Wrangler is executed through npx."
    )


def run_streamed(command: Sequence[str], cwd: Path) -> int:
    print(f"$ {quote_command(command)}", flush=True)
    process = subprocess.Popen(
        list(command),
        cwd=cwd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert process.stdout is not None
    for line in process.stdout:
        print(line.rstrip("\n"), flush=True)
    return process.wait()


def build_bundle(args: argparse.Namespace) -> int:
    command = [
        sys.executable,
        "tools/build_deploy_bundle.py",
        "--out",
        args.dir,
        "--external-assets-url",
        args.external_assets_url,
    ]
    return run_streamed(command, project_root())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy dist/site-upload-r2 to Cloudflare Pages with Wrangler.")
    parser.add_argument("--dir", default=DEFAULT_BUNDLE_DIR, help=f"Bundle folder to deploy. Default: {DEFAULT_BUNDLE_DIR}")
    parser.add_argument("--project-name", default=DEFAULT_PROJECT_NAME, help=f"Cloudflare Pages project name. Default: {DEFAULT_PROJECT_NAME}")
    parser.add_argument("--branch", default=DEFAULT_BRANCH, help=f"Cloudflare Pages branch name. Default: {DEFAULT_BRANCH}")
    parser.add_argument(
        "--build-first",
        action="store_true",
        help="Create a fresh R2 bundle before uploading it to Cloudflare Pages.",
    )
    parser.add_argument(
        "--external-assets-url",
        default=DEFAULT_R2_ASSET_BASE_URL,
        help=f"R2/CDN image base URL used only with --build-first. Default: {DEFAULT_R2_ASSET_BASE_URL}",
    )
    parser.add_argument("--dry-run", action="store_true", help="Validate and print the Wrangler command without deploying.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = project_root()
    bundle_dir = ensure_inside_project(root / args.dir)

    try:
        if args.build_first:
            print("Creating a fresh R2 bundle before Cloudflare Pages deploy...", flush=True)
            build_code = build_bundle(args)
            if build_code != 0:
                print(f"\nERROR: Bundle creation failed with return code {build_code}.", file=sys.stderr)
                return build_code

        validate_bundle(bundle_dir)
        npx = find_npx()
        wrangler_command = [
            npx,
            "--yes",
            "wrangler",
            "pages",
            "deploy",
            args.dir,
            "--project-name",
            args.project_name,
            "--branch",
            args.branch,
        ]

        print("Cloudflare Pages deploy settings:", flush=True)
        print(f"  folder: {rel_to_root(bundle_dir)}", flush=True)
        print(f"  project: {args.project_name}", flush=True)
        print(f"  branch: {args.branch}", flush=True)

        if args.dry_run:
            print("\nDry run only. Command that would be executed:", flush=True)
            print(quote_command(wrangler_command), flush=True)
            return 0

        returncode = run_streamed(wrangler_command, root)
        if returncode == 0:
            print("\nCloudflare Pages deploy finished successfully.", flush=True)
        else:
            print(f"\nERROR: Cloudflare Pages deploy failed with return code {returncode}.", file=sys.stderr)
        return returncode
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
