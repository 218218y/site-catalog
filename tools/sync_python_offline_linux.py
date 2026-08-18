#!/usr/bin/env python3
"""Refresh or verify the cross-download Linux Python verification wheel mirror."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

TOOLS_DIRECTORY = Path(__file__).resolve().parent
if str(TOOLS_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIRECTORY))

from python_offline_linux import PythonOfflineMirrorError, project_root, sync_mirror, verify_mirror


def _summary(prefix: str, package_count: int, profile_key: str) -> None:
    print(f"{prefix}: {package_count} exact wheels for {profile_key}.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify the repository-local wheel mirror without network or writes.",
    )
    args = parser.parse_args()
    try:
        if args.check:
            mirror = verify_mirror(project_root())
            _summary("Linux Python offline mirror is valid", len(mirror.packages), mirror.target.profile_key)
        else:
            mirror = sync_mirror(project_root())
            _summary("Linux Python offline mirror refreshed", len(mirror.packages), mirror.target.profile_key)
            print(
                "The mirror contains exact hash-locked wheels for project tests/quality only; "
                "it can be refreshed cross-platform and installed on the Linux verification target without network."
            )
    except (PythonOfflineMirrorError, OSError, subprocess.SubprocessError) as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
