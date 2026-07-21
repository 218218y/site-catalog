#!/usr/bin/env python3
"""Build and audit the guarded public SEO preview without deploying it."""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Sequence

from audit_public_seo import audit_local_bundle, print_result
from seo_route_lock import assert_route_lock_current


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def safe_output(root: Path, value: str) -> Path:
    candidate = (root / value).resolve() if not Path(value).is_absolute() else Path(value).resolve()
    if candidate == root or root not in candidate.parents:
        raise ValueError("Public SEO preview output must be inside the project directory")
    return candidate


def verify_public_seo(root: Path, out_dir: Path, *, clean: bool = True) -> int:
    assert_route_lock_current(root)
    if clean and out_dir.exists():
        shutil.rmtree(out_dir)
    command = (
        sys.executable,
        "tools/build_deploy_bundle.py",
        "--out",
        out_dir.relative_to(root).as_posix(),
        "--seo-mode",
        "public",
        "--confirm-public-indexing",
    )
    subprocess.run(command, cwd=root, check=True)
    issues = audit_local_bundle(out_dir, root)
    result = print_result("Public SEO release preview", issues)
    if result == 0:
        print(f"Public SEO preview is ready for review: {out_dir.relative_to(root).as_posix()}")
    return result


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=".artifacts/public-seo-preview")
    parser.add_argument("--keep-existing", action="store_true")
    args = parser.parse_args(argv)
    root = project_root()
    try:
        out_dir = safe_output(root, args.out)
        return verify_public_seo(root, out_dir, clean=not args.keep_existing)
    except (ValueError, FileNotFoundError, subprocess.CalledProcessError) as exc:
        print(f"PUBLIC SEO VERIFICATION FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
