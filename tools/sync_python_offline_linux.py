#!/usr/bin/env python3
"""Synchronize or verify the Linux x64/glibc Python wheelhouse for chat checks."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

TOOLS_DIRECTORY = Path(__file__).resolve().parent
if str(TOOLS_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIRECTORY))

from python_offline_linux import (  # noqa: E402
    PythonOfflineMirrorError,
    project_root,
    sync_wheelhouse,
    verify_target_host,
    verify_wheelhouse,
)


def _summary(prefix: str, manifest: dict[str, object]) -> None:
    print(
        f"{prefix}: {manifest['wheelCount']} wheels; "
        f"direct requirements: {', '.join(manifest['directRequirements'])}."
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the wheelhouse without network or writes")
    args = parser.parse_args()
    try:
        verify_target_host()
        if args.check:
            manifest = verify_wheelhouse(project_root())
            _summary("Linux chat Python offline wheelhouse is valid", manifest)
        else:
            manifest = sync_wheelhouse(project_root())
            _summary("Linux chat Python offline wheelhouse updated from requirements-dev.txt", manifest)
            print("Only Linux x64/glibc wheels are retained; Windows keeps using the normal pip install path.")
    except (PythonOfflineMirrorError, OSError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
