#!/usr/bin/env python3
"""Deploy the generated static site bundle to Cloudflare Pages.

Default flow executed from the project root:
    1. Rebuild dist/site-upload-r2 from the current source files.
    2. Validate every HTML -> CSS/JS reference in that fresh bundle.
    3. Deploy the same validated folder with Wrangler.

The regular deploy path intentionally changes only Cloudflare Pages. R2 CORS
configuration is an explicit maintenance action exposed through --cors-only,
so repeated site uploads never rewrite a stable bucket policy.

The script is intentionally small and fixed-purpose so it can be called both
from a .bat file and from the local control panel without exposing arbitrary
shell execution in the browser.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

DEFAULT_BUNDLE_DIR = "dist/site-upload-r2"
DEFAULT_PROJECT_NAME = "bargig-catlog"
DEFAULT_R2_ASSET_BASE_URL = "https://cdn.bargig-furniture.com"
DEFAULT_R2_BUCKET = "bargig-catalog"
DEFAULT_R2_CORS_FILE = "r2-cors.json"
DEFAULT_VERIFY_URL = "https://bargig-furniture.com"
PUBLIC_HTML_FILES = (
    "index.html",
    "catalog.html",
    "favorites.html",
    "viewer.html",
)
REQUIRED_BUNDLE_FILES = (*PUBLIC_HTML_FILES, "404.html", "_headers")
HTML_ASSET_RE = re.compile(r"<(?:script|link)\b[^>]*(?:src|href)=[\"']([^\"']+)[\"']", re.IGNORECASE)
HTML_RESPONSE_PREFIX_RE = re.compile(br"^\s*(?:<!doctype\s+html\b|<html\b)", re.IGNORECASE)
FINGERPRINTED_ASSET_DIR = "static"
HASHED_ASSET_FILENAME_RE = re.compile(
    r"^(?P<stem>.+)\.(?P<digest>[0-9a-f]{12})\.(?P<extension>css|js)$"
)

@dataclass(frozen=True)
class PublicResponse:
    status: int
    content_type: str
    headers: dict[str, str]
    body: bytes


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


def build_r2_cors_commands(npx: str, bucket: str, cors_file: str) -> tuple[list[str], list[str]]:
    set_command = [
        npx,
        "--yes",
        "wrangler",
        "r2",
        "bucket",
        "cors",
        "set",
        bucket,
        "--file",
        cors_file,
    ]
    list_command = [
        npx,
        "--yes",
        "wrangler",
        "r2",
        "bucket",
        "cors",
        "list",
        bucket,
    ]
    return set_command, list_command


def apply_r2_cors(npx: str, bucket: str, cors_file: str, root: Path) -> int:
    set_command, list_command = build_r2_cors_commands(npx, bucket, cors_file)
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


def file_content_hash(path: Path, length: int = 12) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:length]


def validate_bundle(bundle_dir: Path) -> None:
    """Validate one clean, internally consistent deployment bundle."""

    if not bundle_dir.is_dir():
        raise FileNotFoundError(
            f"Bundle folder does not exist: {rel_to_root(bundle_dir)}. "
            "The deploy command must create a fresh bundle before uploading."
        )
    missing = [relative for relative in REQUIRED_BUNDLE_FILES if not (bundle_dir / relative).is_file()]
    if missing:
        raise FileNotFoundError(
            f"Bundle folder is incomplete: {rel_to_root(bundle_dir)}. Missing: {', '.join(missing)}. "
            "Create a fresh R2 bundle before deploying."
        )

    referenced_assets: set[str] = set()
    missing_assets: list[str] = []
    invalid_assets: list[str] = []
    for html_name in PUBLIC_HTML_FILES:
        html = (bundle_dir / html_name).read_text(encoding="utf-8", errors="replace")
        for match in HTML_ASSET_RE.finditer(html):
            reference = match.group(1).strip()
            if not reference or reference.startswith(("http://", "https://", "//", "#", "mailto:", "data:", "blob:")):
                continue
            reference_path = reference.split("?", 1)[0].split("#", 1)[0]
            if Path(reference_path).suffix.lower() not in {".css", ".js"}:
                continue

            relative = Path(reference_path)
            if relative.is_absolute() or ".." in relative.parts:
                invalid_assets.append(f"{html_name} -> {reference_path} (unsafe path)")
                continue
            asset_path = bundle_dir / relative
            if not asset_path.is_file():
                missing_assets.append(f"{html_name} -> {reference_path}")
                continue
            if not relative.parts or relative.parts[0] != FINGERPRINTED_ASSET_DIR:
                invalid_assets.append(f"{html_name} -> {reference_path} (not under static/)")
                continue

            filename_match = HASHED_ASSET_FILENAME_RE.fullmatch(relative.name)
            if filename_match is None:
                invalid_assets.append(f"{html_name} -> {reference_path} (invalid hash filename)")
                continue
            if filename_match.group("digest") != file_content_hash(asset_path):
                invalid_assets.append(f"{html_name} -> {reference_path} (hash/content mismatch)")
                continue
            referenced_assets.add(relative.as_posix())

    if missing_assets:
        raise FileNotFoundError(
            f"Bundle folder is incomplete: {rel_to_root(bundle_dir)}. "
            f"Public HTML references missing CSS/JS assets: {', '.join(sorted(set(missing_assets)))}. "
            "Create a fresh R2 bundle before deploying."
        )
    if invalid_assets:
        raise ValueError(
            f"Bundle folder is inconsistent: {rel_to_root(bundle_dir)}. "
            f"Invalid CSS/JS references: {', '.join(sorted(set(invalid_assets)))}."
        )

    static_dir = bundle_dir / FINGERPRINTED_ASSET_DIR
    deployed_assets = {
        path.relative_to(bundle_dir).as_posix()
        for path in static_dir.rglob("*")
        if path.is_file() and path.suffix.lower() in {".css", ".js"}
    } if static_dir.is_dir() else set()
    stale_assets = sorted(deployed_assets - referenced_assets)
    if stale_assets:
        raise ValueError(
            f"Bundle folder contains stale fingerprinted files that are not referenced by the current HTML: "
            f"{', '.join(stale_assets)}. Rebuild the bundle; old generations must not be deployed."
        )
    if not referenced_assets:
        raise ValueError("Bundle validation found no fingerprinted CSS/JS references in public HTML.")


def expected_bundle_asset_paths(bundle_dir: Path) -> set[str]:
    """Return the exact CSS/JS path set referenced by the validated release."""

    assets: set[str] = set()
    for html_name in PUBLIC_HTML_FILES:
        html = (bundle_dir / html_name).read_text(encoding="utf-8", errors="replace")
        for match in HTML_ASSET_RE.finditer(html):
            reference = match.group(1).strip()
            if not reference or reference.startswith(("http://", "https://", "//", "#", "mailto:", "data:", "blob:")):
                continue
            reference_path = reference.split("?", 1)[0].split("#", 1)[0]
            if Path(reference_path).suffix.lower() in {".css", ".js"}:
                assets.add("/" + reference_path.lstrip("/"))
    if not assets:
        raise ValueError("Bundle contains no browser CSS/JS references to verify after deployment.")
    return assets


def with_cache_buster(url: str, token: str) -> str:
    parts = urllib.parse.urlsplit(url)
    query = urllib.parse.parse_qsl(parts.query, keep_blank_values=True)
    query.append(("__deploy_check", token))
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, urllib.parse.urlencode(query), parts.fragment))


def response_headers_dict(headers: object) -> dict[str, str]:
    if not hasattr(headers, "items"):
        return {}
    return {str(name).lower(): str(value) for name, value in headers.items()}


def build_public_response(response: object, body: bytes) -> PublicResponse:
    headers = getattr(response, "headers", None)
    content_type = ""
    if headers is not None and hasattr(headers, "get_content_type"):
        content_type = str(headers.get_content_type()).lower()
    return PublicResponse(
        status=int(getattr(response, "status", getattr(response, "code", 0)) or 0),
        content_type=content_type,
        headers=response_headers_dict(headers),
        body=body,
    )


def fetch_public_url(url: str, token: str) -> PublicResponse:
    request = urllib.request.Request(
        with_cache_buster(url, token),
        headers={
            "User-Agent": "Bargig-Cloudflare-Deploy-Validator/1.0",
            "Cache-Control": "no-cache, no-store, max-age=0",
            "Pragma": "no-cache",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            return build_public_response(response, response.read(2_000_000))
    except urllib.error.HTTPError as exc:
        return build_public_response(exc, exc.read(2_000_000))


def require_cache_directive(url: str, headers: dict[str, str], header_name: str, directive: str) -> None:
    value = headers.get(header_name.lower(), "")
    directives = {item.strip().lower() for item in value.split(",") if item.strip()}
    if directive.lower() not in directives:
        raise RuntimeError(
            f"Public cache-header validation failed: {url} must return {header_name}: {directive}; "
            f"received {value!r}. Check the deployed _headers file and Cloudflare Cache Rules."
        )


def validate_public_html(page_url: str, response: PublicResponse) -> None:
    if response.status != 200:
        raise RuntimeError(f"Public page validation failed: {page_url} returned HTTP {response.status}, not 200.")
    if response.content_type != "text/html" and HTML_RESPONSE_PREFIX_RE.match(response.body) is None:
        raise RuntimeError(
            f"Public page validation failed: {page_url} returned Content-Type {response.content_type!r}, not HTML."
        )
    require_cache_directive(page_url, response.headers, "Cache-Control", "no-store")


def validate_public_asset(asset_url: str, token: str) -> None:
    response = fetch_public_url(asset_url, token)
    path = urllib.parse.urlsplit(asset_url).path.lower()
    is_html_body = HTML_RESPONSE_PREFIX_RE.match(response.body) is not None
    if path.endswith(".js"):
        valid_type = "javascript" in response.content_type or "ecmascript" in response.content_type
        expected = "JavaScript"
    elif path.endswith(".css"):
        valid_type = response.content_type == "text/css"
        expected = "CSS"
    else:
        return
    if response.status != 200 or not valid_type or is_html_body:
        raise RuntimeError(
            f"Public asset validation failed: {asset_url} returned HTTP {response.status} and "
            f"Content-Type {response.content_type!r} instead of executable {expected}. "
            "The deployment is serving HTML/404 content for a static asset."
        )
    require_cache_directive(asset_url, response.headers, "Cache-Control", "immutable")


def validate_missing_static_asset_is_404(base_url: str, token: str) -> None:
    missing_url = f"{base_url.rstrip('/')}/static/__deploy_missing_{token}.js"
    response = fetch_public_url(missing_url, token)
    if response.status != 404:
        raise RuntimeError(
            f"Missing-asset validation failed: {missing_url} returned HTTP {response.status}. "
            "A missing JavaScript file must return a real 404, not the application HTML. "
            "Ensure a top-level 404.html is included in the Pages deployment."
        )


def verify_public_deployment(
    base_url: str,
    *,
    expected_asset_paths: set[str] | None = None,
    attempts: int = 4,
    delay_seconds: float = 2.0,
) -> None:
    """Verify public HTML and every referenced CSS/JS after deployment.

    When ``expected_asset_paths`` is provided, each public page must reference
    the exact asset generation that was just built. This prevents a stale
    production domain from being mistaken for the newly-created deployment.
    """

    normalized = str(base_url or "").strip().rstrip("/")
    if not normalized.startswith(("https://", "http://")):
        raise ValueError(f"Verification URL must start with http:// or https://: {base_url}")

    routes = ("/", "/catalog", "/favorites", "/viewer")
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        token = f"{int(time.time() * 1000)}-{attempt}"
        try:
            asset_urls: set[str] = set()
            for route in routes:
                page_url = f"{normalized}{route}"
                response = fetch_public_url(page_url, token)
                validate_public_html(page_url, response)
                html = response.body.decode("utf-8", errors="replace")
                route_asset_paths: set[str] = set()
                for match in HTML_ASSET_RE.finditer(html):
                    reference = match.group(1).strip()
                    if not reference or reference.startswith(("data:", "blob:", "mailto:", "#")):
                        continue
                    asset_url = urllib.parse.urljoin(page_url, reference)
                    asset_path = urllib.parse.urlsplit(asset_url).path.lower()
                    if asset_path.endswith((".js", ".css")):
                        asset_urls.add(asset_url)
                        route_asset_paths.add(asset_path)

                if expected_asset_paths is not None:
                    expected_lower = {path.lower() for path in expected_asset_paths}
                    if route_asset_paths != expected_lower:
                        missing = sorted(expected_lower - route_asset_paths)
                        unexpected = sorted(route_asset_paths - expected_lower)
                        details: list[str] = []
                        if missing:
                            details.append("missing " + ", ".join(missing))
                        if unexpected:
                            details.append("unexpected " + ", ".join(unexpected))
                        raise RuntimeError(
                            f"Public page {page_url} is not serving the release that was just built"
                            + (f" ({'; '.join(details)})" if details else "")
                            + "."
                        )

            if not asset_urls:
                raise RuntimeError("Public deployment validation found no CSS/JS references in the HTML pages.")
            for asset_url in sorted(asset_urls):
                validate_public_asset(asset_url, token)
            validate_missing_static_asset_is_404(normalized, token)
            return
        except (OSError, RuntimeError, urllib.error.URLError) as exc:
            last_error = exc
            if attempt < attempts:
                time.sleep(delay_seconds)

    assert last_error is not None
    raise RuntimeError(f"Public deployment validation failed after {attempts} attempts: {last_error}") from last_error


def build_pages_deploy_command(
    npx: str,
    bundle_dir: str,
    project_name: str,
    preview_branch: str | None = None,
) -> list[str]:
    """Build a Pages command that targets production unless preview is explicit."""

    command = [
        npx,
        "--yes",
        "wrangler",
        "pages",
        "deploy",
        bundle_dir,
        "--project-name",
        project_name,
    ]
    if preview_branch:
        command.extend(["--branch", preview_branch])
    return command


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
        help="Compatibility alias. A fresh R2 bundle is now created before every normal deploy.",
    )
    parser.add_argument(
        "--external-assets-url",
        default=DEFAULT_R2_ASSET_BASE_URL,
        help=f"R2/CDN image base URL written into the fresh bundle. Default: {DEFAULT_R2_ASSET_BASE_URL}",
    )
    parser.add_argument(
        "--verify-url",
        default=DEFAULT_VERIFY_URL,
        help=(
            "Production custom-domain URL checked after a successful production deploy. "
            f"The temporary *.pages.dev URL is intentionally not requested. Default: {DEFAULT_VERIFY_URL}"
        ),
    )
    parser.add_argument(
        "--no-verify",
        action="store_true",
        help="Skip the public post-deploy HTML/CSS/JS MIME validation.",
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

        npx = find_npx()
        if args.cors_only:
            cors_file = ensure_inside_project(root / args.cors_file)
            validate_r2_cors_file(cors_file)
            cors_set_command, cors_list_command = build_r2_cors_commands(
                npx,
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
            return apply_r2_cors(npx, args.r2_bucket, rel_to_root(cors_file), root)

        bundle_dir = ensure_inside_project(root / args.dir)
        print("Creating one fresh, validated R2 bundle before Cloudflare Pages deploy...", flush=True)
        if args.dry_run:
            print(
                quote_command([
                    sys.executable,
                    "tools/build_deploy_bundle.py",
                    "--out",
                    args.dir,
                    "--external-assets-url",
                    args.external_assets_url,
                ]),
                flush=True,
            )
        else:
            build_code = build_bundle(args)
            if build_code != 0:
                print(f"\nERROR: Bundle creation failed with return code {build_code}.", file=sys.stderr)
                return build_code

        validate_bundle(bundle_dir)
        preview_branch = str(args.preview_branch or "").strip() or None
        wrangler_command = build_pages_deploy_command(
            npx,
            args.dir,
            args.project_name,
            preview_branch,
        )

        print("Cloudflare Pages deploy settings:", flush=True)
        print(f"  folder: {rel_to_root(bundle_dir)}", flush=True)
        print(f"  project: {args.project_name}", flush=True)
        print(
            f"  environment: {'preview branch ' + preview_branch if preview_branch else 'production'}",
            flush=True,
        )

        if args.dry_run:
            print("\nDry run only. Command that would be executed:", flush=True)
            print(quote_command(wrangler_command), flush=True)
            if preview_branch:
                print(
                    "Post-deploy network verification: skipped for preview because its temporary *.pages.dev URL may be blocked.",
                    flush=True,
                )
            elif args.no_verify:
                print("Post-deploy production-domain verification: disabled by --no-verify", flush=True)
            else:
                print(f"Post-deploy production-domain verification: {args.verify_url}", flush=True)
            return 0

        returncode = run_streamed(wrangler_command, root)
        if returncode == 0:
            print("\nCloudflare Pages deploy finished successfully.", flush=True)
            if preview_branch:
                print(
                    "Preview deployment uploaded. Automatic network verification was skipped because the temporary "
                    "*.pages.dev address may be blocked by the local filtering network.",
                    flush=True,
                )
            elif not args.no_verify:
                expected_assets = expected_bundle_asset_paths(bundle_dir)
                print(f"Waiting for the production domain at {args.verify_url}...", flush=True)
                verify_public_deployment(
                    args.verify_url,
                    expected_asset_paths=expected_assets,
                    attempts=30,
                    delay_seconds=3.0,
                )
                print("Production domain is serving the exact new release with valid CSS/JS MIME types.", flush=True)
            else:
                print("Post-deploy production-domain verification was skipped by --no-verify.", flush=True)
        else:
            print(f"\nERROR: Cloudflare Pages deploy failed with return code {returncode}.", file=sys.stderr)
        return returncode
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
