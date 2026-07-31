#!/usr/bin/env python3
"""Run the pinned TypeScript compiler after provisioning its offline packages."""
from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path
from typing import Sequence

from bootstrap_typescript_offline import BootstrapError, install_typescript, project_root


def run_typescript(arguments: Sequence[str], *, root: Path | None = None) -> int:
    base = (root or project_root()).resolve()
    install_typescript(base, quiet=True)
    node = shutil.which("node")
    if node is None:
        raise BootstrapError("Node.js is not available on PATH; install the version pinned in .nvmrc.")
    command = [node, str(base / "node_modules/typescript/bin/tsc"), *arguments]
    return subprocess.run(command, cwd=base, check=False).returncode


def main(argv: Sequence[str] | None = None) -> int:
    try:
        return run_typescript(tuple(argv if argv is not None else sys.argv[1:]))
    except (BootstrapError, OSError, subprocess.SubprocessError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
