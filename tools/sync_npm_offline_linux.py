#!/usr/bin/env python3
"""Synchronize or verify the minimal Linux x64/glibc npm mirror for chat checks."""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

TOOLS_DIRECTORY = Path(__file__).resolve().parent
if str(TOOLS_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIRECTORY))

from npm_offline_linux import OfflineMirrorError, project_root, sync_mirror, verify_mirror


def _summary(prefix: str, manifest: dict[str, object]) -> None:
    roots = ", ".join(manifest["rootPackages"])
    excluded = ", ".join(manifest["excludedRootPackages"]) or "none"
    print(
        f"{prefix}: {manifest['packageCount']} packages / {manifest['archivePackageCount']} archives; "
        f"chat roots: {roots}; excluded roots: {excluded}."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the mirror without network or writes")
    args = parser.parse_args()
    try:
        if args.check:
            manifest = verify_mirror(project_root())
            _summary("Linux chat npm offline mirror is valid", manifest)
        else:
            manifest = sync_mirror(project_root())
            _summary("Linux chat npm offline mirror updated from package-lock.json", manifest)
            print(
                "Only dependencies reachable from the chat/test roots are retained. "
                "Wrangler/Cloudflare runtimes and Playwright browser binaries are intentionally excluded."
            )
    except OfflineMirrorError as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
