#!/usr/bin/env python3
"""Serve a validated private site artifact for local preview.

The source tree is deliberately not used as the web root. ``start-server.bat``
serves the existing ``dist/site-local`` artifact without inspecting or rebuilding
it. ``check-and-start-server.bat`` is the explicit opt-in workflow that verifies
currentness and can offer a rebuild before serving.
"""
from __future__ import annotations

import argparse
import functools
import subprocess
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Sequence

from build_deploy_bundle import artifact_is_current, build_options_payload

DEFAULT_OUT = "dist/site-local"
DEFAULT_ASSET_BASE_URL = "https://cdn.bargig-furniture.com"


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def resolve_output(root: Path, value: str) -> Path:
    candidate = (root / value).resolve() if not Path(value).is_absolute() else Path(value).resolve()
    try:
        candidate.relative_to(root.resolve())
    except ValueError as exc:
        raise ValueError("Local preview output must stay inside the project directory") from exc
    if candidate == root.resolve():
        raise ValueError("The project source root cannot be used as the preview output directory")
    return candidate


def build_preview(root: Path, out_dir: Path, asset_base_url: str) -> None:
    relative_out = out_dir.relative_to(root).as_posix()
    command = [
        sys.executable,
        "tools/build_deploy_bundle.py",
        "--out",
        relative_out,
        "--seo-mode",
        "private",
        "--external-assets-url",
        asset_base_url,
        "--skip-if-current",
    ]
    print("Updating the complete private local site only if needed...", flush=True)
    completed = subprocess.run(command, cwd=root, check=False)
    if completed.returncode != 0:
        raise RuntimeError("Local site build failed; the server was not started")


def preview_currentness(root: Path, out_dir: Path, asset_base_url: str) -> tuple[bool, str]:
    options = build_options_payload(
        external_assets_url=asset_base_url,
        seo_mode="private",
    )
    return artifact_is_current(root, out_dir, options=options)


def prompt_stale_action(reason: str, *, allow_old: bool = True) -> str:
    print("\nThe local preview is not current:")
    print(f"  {reason}")
    if allow_old:
        print("\nChoose: [U]pdate now (recommended), [O]pen the older build, or [C]ancel.")
    else:
        print("\nNo older preview exists. Choose [U]pdate now or [C]ancel.")
    while True:
        try:
            answer = input("Selection [U/o/c]: " if allow_old else "Selection [U/c]: ").strip().lower()
        except EOFError:
            return "cancel"
        if answer in {"", "u", "update", "y", "yes"}:
            return "build"
        if allow_old and answer in {"o", "open", "n", "no", "serve"}:
            return "serve"
        if answer in {"c", "cancel", "q", "quit"}:
            return "cancel"


def ensure_preview_current(
    root: Path,
    out_dir: Path,
    asset_base_url: str,
    policy: str,
) -> bool:
    current, reason = preview_currentness(root, out_dir, asset_base_url)
    if current:
        print("Local preview bundle is current.")
        return True

    action = policy
    if policy == "ask":
        action = prompt_stale_action(reason, allow_old=(out_dir / "index.html").is_file())
    elif policy == "error":
        raise RuntimeError(f"Local preview is stale: {reason}")

    if action == "build":
        build_preview(root, out_dir, asset_base_url)
        current_after_build, remaining_reason = preview_currentness(root, out_dir, asset_base_url)
        if not current_after_build:
            raise RuntimeError(
                f"Local preview was built but still failed the currentness check: {remaining_reason}"
            )
        return True
    if action == "serve":
        if not (out_dir / "index.html").is_file():
            raise FileNotFoundError("No older local preview exists to serve")
        print("Warning: serving the older local artifact by explicit choice.")
        return True
    return False


class PreviewRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        self.send_header("Cache-Control", "no-store, max-age=0, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1", help="Local interface. Default: 127.0.0.1")
    parser.add_argument("--port", type=int, default=8080, help="Local port. Default: 8080")
    parser.add_argument("--out", default=DEFAULT_OUT, help=f"Generated preview folder. Default: {DEFAULT_OUT}")
    parser.add_argument("--asset-base-url", default=DEFAULT_ASSET_BASE_URL, help="Catalog image CDN/R2 base URL")
    parser.add_argument("--build-first", action="store_true", help="Explicitly rebuild the preview before serving")
    parser.add_argument(
        "--ensure-current",
        choices=("ask", "build", "error", "serve"),
        help=(
            "Verify the local artifact before serving. 'ask' offers update/open-old/cancel; "
            "'build' updates automatically; 'error' refuses stale output; 'serve' only warns."
        ),
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    root = project_root()
    try:
        out_dir = resolve_output(root, args.out)
        if args.build_first:
            build_preview(root, out_dir, str(args.asset_base_url).strip())
        elif args.ensure_current:
            should_continue = ensure_preview_current(
                root,
                out_dir,
                str(args.asset_base_url).strip(),
                args.ensure_current,
            )
            if not should_continue:
                print("Local server start was cancelled.")
                return 0
        if not (out_dir / "index.html").is_file():
            raise FileNotFoundError(
                f"Preview is missing {out_dir / 'index.html'}. Run bundle-site-r2.bat once, then start the server again"
            )
    except (FileNotFoundError, RuntimeError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    handler = functools.partial(PreviewRequestHandler, directory=str(out_dir))
    server = ThreadingHTTPServer((args.host, max(1, int(args.port))), handler)
    print(f"Local site: http://localhost:{args.port}/")
    print(f"Serving generated artifact: {out_dir.relative_to(root).as_posix()}")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping local site...")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
