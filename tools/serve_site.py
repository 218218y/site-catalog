#!/usr/bin/env python3
"""Serve the already-built private site artifact for local preview.

The source tree is deliberately not used as the web root. The canonical build
command creates both dist/site-upload-r2 and dist/site-local from one validated
artifact. This server normally performs no build; --build-first is available
only as an explicit maintenance option.
"""
from __future__ import annotations

import argparse
import functools
import subprocess
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Sequence

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
    ]
    print("Building the complete private local site...", flush=True)
    completed = subprocess.run(command, cwd=root, check=False)
    if completed.returncode != 0:
        raise RuntimeError("Local site build failed; the server was not started")


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
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    root = project_root()
    try:
        out_dir = resolve_output(root, args.out)
        if args.build_first:
            build_preview(root, out_dir, str(args.asset_base_url).strip())
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
