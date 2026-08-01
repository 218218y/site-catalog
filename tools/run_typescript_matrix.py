#!/usr/bin/env python3
"""Run the frontend JSDoc contract suite with TypeScript 5.8 and TypeScript 7."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Sequence

try:
    from tools.bootstrap_typescript_5_8_offline import VERSION as LEGACY_VERSION
    from tools.bootstrap_typescript_5_8_offline import ensure_typescript_5_8_available
    from tools.bootstrap_typescript_offline import TYPESCRIPT_VERSION as CURRENT_VERSION
    from tools.bootstrap_typescript_offline import ensure_typescript_available
except ModuleNotFoundError:  # Direct execution from tools/
    from bootstrap_typescript_5_8_offline import VERSION as LEGACY_VERSION
    from bootstrap_typescript_5_8_offline import ensure_typescript_5_8_available
    from bootstrap_typescript_offline import TYPESCRIPT_VERSION as CURRENT_VERSION
    from bootstrap_typescript_offline import ensure_typescript_available

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ARGS = ("-p", "jsconfig.json", "--pretty", "false")


def _run(label: str, compiler: Path, arguments: Sequence[str]) -> None:
    completed = subprocess.run(
        ["node", str(compiler), *arguments],
        cwd=PROJECT_ROOT,
        text=True,
        check=False,
    )
    if completed.returncode != 0:
        raise SystemExit(completed.returncode)
    print(f"{label}: PASS")


def main(argv: Sequence[str] | None = None) -> int:
    arguments = tuple(argv or DEFAULT_ARGS)
    legacy = ensure_typescript_5_8_available(PROJECT_ROOT, quiet=True)
    ensure_typescript_available(PROJECT_ROOT, quiet=True)
    current = PROJECT_ROOT / "node_modules" / "typescript" / "bin" / "tsc"
    _run(f"TypeScript {LEGACY_VERSION}", legacy, arguments)
    _run(f"TypeScript {CURRENT_VERSION}", current, arguments)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
