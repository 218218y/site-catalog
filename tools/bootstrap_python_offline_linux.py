#!/usr/bin/env python3
"""Install the project Python test environment from the Linux offline wheelhouse."""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path
from typing import Sequence

TOOLS_DIRECTORY = Path(__file__).resolve().parent
if str(TOOLS_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIRECTORY))

from python_offline_linux import PythonOfflineMirrorError, project_root, verify_target_host, verify_wheelhouse  # noqa: E402
from setup_python_env import PYTHON_OFFLINE_ENV_VAR, create_or_update_environment  # noqa: E402


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="Suppress setup progress messages")
    args = parser.parse_args(argv)
    root = project_root()
    try:
        verify_target_host()
        manifest = verify_wheelhouse(root)
        os.environ[PYTHON_OFFLINE_ENV_VAR] = "required"
        python = create_or_update_environment(root, quiet=args.quiet)
        if not args.quiet:
            print(
                "Python test toolchain installed from verified Linux wheelhouse: "
                f"{manifest['wheelCount']} wheels; interpreter: {python}"
            )
    except (PythonOfflineMirrorError, FileNotFoundError, RuntimeError, subprocess.CalledProcessError) as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
