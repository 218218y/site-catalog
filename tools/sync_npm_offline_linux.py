#!/usr/bin/env python3
"""Synchronize or verify the lockfile-driven Linux x64/glibc npm mirror."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

TOOLS_DIRECTORY = Path(__file__).resolve().parent
if str(TOOLS_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIRECTORY))

from npm_offline_linux import OfflineMirrorError, project_root, sync_mirror, verify_mirror


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the mirror without network or writes")
    parser.add_argument(
        "--no-prune",
        action="store_true",
        help="Keep stale archives in the canonical Linux mirror (not recommended)",
    )
    args = parser.parse_args()
    try:
        if args.check:
            manifest = verify_mirror(project_root())
            print(
                "Linux npm offline mirror is valid: "
                f"{manifest['packageCount']} packages, {manifest['archivePackageCount']} archives, "
                f"{manifest['bundledPackageCount']} bundled dependencies."
            )
        else:
            manifest = sync_mirror(project_root(), prune=not args.no_prune)
            print(
                "Linux npm offline mirror updated from package-lock.json: "
                f"{manifest['packageCount']} packages, {manifest['archivePackageCount']} archives, "
                f"{manifest['bundledPackageCount']} bundled dependencies."
            )
            print("Playwright npm packages are mirrored; browser binaries are intentionally excluded.")
    except OfflineMirrorError as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
