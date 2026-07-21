#!/usr/bin/env python3
"""Deploy the generated static site bundle to Cloudflare Pages.

Default flow executed from the project root:
    1. Validate that dist/site-upload-r2 is complete and still matches the current sources.
    2. Deploy that exact validated folder with Wrangler.

Building is deliberately a separate action (.01-bundle-site-r2.bat). Use
--build-first only when an explicit combined build-and-deploy operation is desired.

The deploy finishes when Wrangler reports success. It intentionally performs
no request to the public website after upload, because filtering/proxy layers
may inject content and make a byte/reference comparison unreliable.

The regular deploy path intentionally changes only Cloudflare Pages. R2 CORS
configuration is an explicit maintenance action exposed through --cors-only,
so repeated site uploads never rewrite a stable bucket policy.

The script is intentionally small and fixed-purpose so it can be called both
from a .bat file and from the local control panel without exposing arbitrary
shell execution in the browser.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path
from typing import Sequence

from build_deploy_bundle import (
    build_options_payload,
    validate_current_artifact,
    validate_fingerprinted_bundle,
)
from build_site_pages import PAGE_DOCUMENTS, TECHNICAL_SHELL_FILENAMES

DEFAULT_BUNDLE_DIR = "dist/site-upload-r2"
DEFAULT_PROJECT_NAME = "bargig-catlog"
DEFAULT_R2_ASSET_BASE_URL = "https://cdn.bargig-furniture.com"
DEFAULT_R2_BUCKET = "bargig-catalog"
DEFAULT_R2_CORS_FILE = "r2-cors.json"
WRANGLER_CONFIG_FILE = "wrangler.jsonc"
TELEMETRY_FUNCTION_FILE = "functions/api/telemetry.js"
TELEMETRY_BINDING = "SITE_TELEMETRY"
PUBLIC_HTML_FILES = tuple(
    page.filename for page in PAGE_DOCUMENTS
    if page.filename not in TECHNICAL_SHELL_FILENAMES
) + ("404.html",)
REQUIRED_BUNDLE_FILES = (*PUBLIC_HTML_FILES, "_headers", "robots.txt")

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



def load_wrangler_pages_config(root: Path) -> dict:
    config_path = root / WRANGLER_CONFIG_FILE
    if not config_path.is_file():
        raise FileNotFoundError(
            f"Cloudflare Pages config is missing: {WRANGLER_CONFIG_FILE}. "
            "It defines the Pages project, output folder, and telemetry binding."
        )
    try:
        payload = json.loads(config_path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"{WRANGLER_CONFIG_FILE} is not valid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"{WRANGLER_CONFIG_FILE} must contain one JSON object.")
    return payload


def validate_pages_runtime_config(root: Path, bundle_dir: Path, project_name: str) -> dict:
    config = load_wrangler_pages_config(root)
    configured_name = str(config.get("name") or "").strip()
    if configured_name != project_name:
        raise ValueError(
            f"Cloudflare project mismatch: command uses {project_name!r}, "
            f"but {WRANGLER_CONFIG_FILE} defines {configured_name!r}."
        )

    configured_output = str(config.get("pages_build_output_dir") or "").strip()
    if not configured_output:
        raise ValueError(f"{WRANGLER_CONFIG_FILE} must define pages_build_output_dir.")
    configured_output_path = (root / configured_output).resolve(strict=False)
    if configured_output_path != bundle_dir.resolve(strict=False):
        raise ValueError(
            f"Cloudflare output mismatch: deploy folder is {rel_to_root(bundle_dir)}, "
            f"but {WRANGLER_CONFIG_FILE} points to {configured_output}."
        )

    bindings = config.get("analytics_engine_datasets")
    if not isinstance(bindings, list) or not any(
        isinstance(item, dict)
        and item.get("binding") == TELEMETRY_BINDING
        and str(item.get("dataset") or "").strip()
        for item in bindings
    ):
        raise ValueError(
            f"{WRANGLER_CONFIG_FILE} must define the {TELEMETRY_BINDING} Analytics Engine binding."
        )

    function_path = root / TELEMETRY_FUNCTION_FILE
    if not function_path.is_file():
        raise FileNotFoundError(
            f"Telemetry Pages Function is missing: {TELEMETRY_FUNCTION_FILE}."
        )
    return config

def validate_r2_cors_file(cors_file: Path) -> None:
    if not cors_file.is_file():
        raise FileNotFoundError(
            f"R2 CORS policy file does not exist: {rel_to_root(cors_file)}."
        )
    try:
        payload = json.loads(cors_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"R2 CORS policy is not valid JSON: {rel_to_root(cors_file)} ({exc})") from exc

    rules = payload.get("rules") if isinstance(payload, dict) else None
    if not isinstance(rules, list) or not rules:
        raise ValueError(f"R2 CORS policy must contain a non-empty rules array: {rel_to_root(cors_file)}")

    has_browser_read_rule = False
    for rule in rules:
        allowed = rule.get("allowed") if isinstance(rule, dict) else None
        if not isinstance(allowed, dict):
            continue
        origins = allowed.get("origins")
        methods = allowed.get("methods")
        if isinstance(origins, list) and origins and isinstance(methods, list) and "GET" in methods:
            has_browser_read_rule = True
            break
    if not has_browser_read_rule:
        raise ValueError(
            f"R2 CORS policy must allow at least one origin and the GET method: {rel_to_root(cors_file)}"
        )


def build_r2_cors_commands(wrangler: str, bucket: str, cors_file: str) -> tuple[list[str], list[str]]:
    set_command = [
        wrangler,
        "r2",
        "bucket",
        "cors",
        "set",
        bucket,
        "--file",
        cors_file,
    ]
    list_command = [
        wrangler,
        "r2",
        "bucket",
        "cors",
        "list",
        bucket,
    ]
    return set_command, list_command


def apply_r2_cors(wrangler: str, bucket: str, cors_file: str, root: Path) -> int:
    set_command, list_command = build_r2_cors_commands(wrangler, bucket, cors_file)
    print("Applying Cloudflare R2 CORS policy...", flush=True)
    returncode = run_streamed(set_command, root)
    if returncode != 0:
        print(f"\nERROR: R2 CORS update failed with return code {returncode}.", file=sys.stderr)
        return returncode

    print("Verifying Cloudflare R2 CORS policy...", flush=True)
    returncode = run_streamed(list_command, root)
    if returncode != 0:
        print(f"\nERROR: R2 CORS verification failed with return code {returncode}.", file=sys.stderr)
    return returncode


def validate_bundle(bundle_dir: Path) -> None:
    """Validate one clean, internally consistent deployment bundle.

    Asset validation is intentionally delegated to the exact same validator
    used while building the bundle. Keeping one source of truth prevents the
    deploy step from drifting behind new runtime-loaded assets such as the
    fingerprinted search index referenced from app.js rather than HTML.
    """

    if not bundle_dir.is_dir():
        raise FileNotFoundError(
            f"Bundle folder does not exist: {rel_to_root(bundle_dir)}. "
            "Run .01-bundle-site-r2.bat before uploading."
        )
    missing = [relative for relative in REQUIRED_BUNDLE_FILES if not (bundle_dir / relative).is_file()]
    if missing:
        raise FileNotFoundError(
            f"Bundle folder is incomplete: {rel_to_root(bundle_dir)}. Missing: {', '.join(missing)}. "
            "Create a fresh R2 bundle before deploying."
        )

    validate_fingerprinted_bundle(bundle_dir)



def build_pages_deploy_command(
    wrangler: str,
    bundle_dir: str,
    project_name: str,
    preview_branch: str | None = None,
) -> list[str]:
    """Build a Pages command that targets production unless preview is explicit."""

    command = [
        wrangler,
        "pages",
        "deploy",
        bundle_dir,
        "--project-name",
        project_name,
    ]
    if preview_branch:
        command.extend(["--branch", preview_branch])
    return command


def find_local_wrangler(root: Path | None = None) -> str:
    base = (root or project_root()).resolve()
    executable_name = "wrangler.cmd" if os.name == "nt" else "wrangler"
    candidate = base / "node_modules" / ".bin" / executable_name
    if candidate.is_file():
        return str(candidate)
    raise FileNotFoundError(
        "The project-local Wrangler executable is missing. Run npm ci (or .20-setup-windows.bat) "
        "before deploying; global and floating npx versions are intentionally not used."
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
        "--seo-mode",
        args.seo_mode,
    ]
    if args.confirm_public_indexing:
        command.append("--confirm-public-indexing")
    command.extend([
        "--skip-if-current",
        "--mirror-to",
        "dist/site-local",
        "--clean-legacy-artifacts",
    ])
    return run_streamed(command, project_root())


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Deploy dist/site-upload-r2 to Cloudflare Pages with Wrangler.")
    parser.add_argument("--dir", default=DEFAULT_BUNDLE_DIR, help=f"Bundle folder to deploy. Default: {DEFAULT_BUNDLE_DIR}")
    parser.add_argument("--project-name", default=DEFAULT_PROJECT_NAME, help=f"Cloudflare Pages project name. Default: {DEFAULT_PROJECT_NAME}")
    parser.add_argument(
        "--preview-branch",
        default="",
        help="Create an explicit preview deployment for this branch. Omit for the production deployment/custom domain.",
    )
    parser.add_argument(
        "--build-first",
        action="store_true",
        help="Explicitly build/update the upload and local artifacts before deploying. Normal deploy only validates.",
    )
    parser.add_argument(
        "--external-assets-url",
        default=DEFAULT_R2_ASSET_BASE_URL,
        help=f"Expected R2/CDN image base URL recorded for the existing bundle. Default: {DEFAULT_R2_ASSET_BASE_URL}",
    )
    parser.add_argument(
        "--seo-mode",
        choices=("private", "public"),
        default="private",
        help="Expected SEO/indexing mode of the existing bundle. Default: private.",
    )
    parser.add_argument(
        "--confirm-public-indexing",
        action="store_true",
        help="Required together with --seo-mode public.",
    )
    parser.add_argument(
        "--r2-bucket",
        default=DEFAULT_R2_BUCKET,
        help=f"R2 bucket used only with --cors-only. Default: {DEFAULT_R2_BUCKET}",
    )
    parser.add_argument(
        "--cors-file",
        default=DEFAULT_R2_CORS_FILE,
        help=f"Wrangler R2 CORS JSON file used only with --cors-only. Default: {DEFAULT_R2_CORS_FILE}",
    )
    parser.add_argument("--cors-only", action="store_true", help="Apply and verify only the R2 CORS policy without deploying Cloudflare Pages")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print the Wrangler command(s) without changing Cloudflare.")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    root = project_root()

    try:
        if args.cors_only and args.build_first:
            raise ValueError("--cors-only cannot be combined with --build-first.")

        wrangler = find_local_wrangler(root)
        if args.cors_only:
            cors_file = ensure_inside_project(root / args.cors_file)
            validate_r2_cors_file(cors_file)
            cors_set_command, cors_list_command = build_r2_cors_commands(
                wrangler,
                args.r2_bucket,
                rel_to_root(cors_file),
            )
            print("Cloudflare R2 CORS settings:", flush=True)
            print(f"  bucket: {args.r2_bucket}", flush=True)
            print(f"  policy: {rel_to_root(cors_file)}", flush=True)
            if args.dry_run:
                print("\nDry run only. Commands that would be executed:", flush=True)
                print(quote_command(cors_set_command), flush=True)
                print(quote_command(cors_list_command), flush=True)
                return 0
            return apply_r2_cors(wrangler, args.r2_bucket, rel_to_root(cors_file), root)

        bundle_dir = ensure_inside_project(root / args.dir)
        runtime_config = validate_pages_runtime_config(root, bundle_dir, args.project_name)
        if args.build_first:
            print("Updating the validated site artifacts before Cloudflare Pages deploy...", flush=True)
            build_code = build_bundle(args)
            if build_code != 0:
                print(f"\nERROR: Bundle creation failed with return code {build_code}.", file=sys.stderr)
                return build_code
        else:
            print("Validating the existing Cloudflare Pages bundle without rebuilding...", flush=True)

        validate_bundle(bundle_dir)
        current_options = build_options_payload(
            external_assets_url=args.external_assets_url,
            seo_mode=args.seo_mode,
            confirm_public_indexing=args.confirm_public_indexing,
        )
        try:
            validate_current_artifact(root, bundle_dir, options=current_options)
        except (FileNotFoundError, ValueError) as exc:
            raise ValueError(
                f"{exc} Run .01-bundle-site-r2.bat once, then run the upload command again."
            ) from exc
        preview_branch = str(args.preview_branch or "").strip() or None
        wrangler_command = build_pages_deploy_command(
            wrangler,
            args.dir,
            args.project_name,
            preview_branch,
        )

        print("Cloudflare Pages deploy settings:", flush=True)
        print(f"  folder: {rel_to_root(bundle_dir)}", flush=True)
        print(f"  SEO mode: {args.seo_mode}", flush=True)
        print(f"  project: {args.project_name}", flush=True)
        print(f"  telemetry: {TELEMETRY_BINDING} -> {runtime_config['analytics_engine_datasets'][0]['dataset']}", flush=True)
        print(
            f"  environment: {'preview branch ' + preview_branch if preview_branch else 'production'}",
            flush=True,
        )

        if args.dry_run:
            print("\nDry run only. Command that would be executed:", flush=True)
            print(quote_command(wrangler_command), flush=True)
            print("Post-deploy website comparison: disabled; Wrangler success ends the deployment.", flush=True)
            return 0

        returncode = run_streamed(wrangler_command, root)
        if returncode == 0:
            print("\nCloudflare Pages deploy finished successfully.", flush=True)
            print(
                "The existing bundle passed source and file validation and Wrangler completed the upload; "
                "no public website comparison was performed.",
                flush=True,
            )
        else:
            print(f"\nERROR: Cloudflare Pages deploy failed with return code {returncode}.", file=sys.stderr)
        return returncode
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
