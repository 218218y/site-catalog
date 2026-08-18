#!/usr/bin/env python3
"""Run the pinned Python quality gates with the active project interpreter."""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Sequence


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


MYPY_PLATFORM_TARGETS: tuple[tuple[str, str], ...] = (
    ("Linux", "linux"),
    ("Windows", "win32"),
)


def python_typecheck_commands(python: str) -> tuple[tuple[str, ...], ...]:
    """Return deterministic mypy commands for every supported host platform."""
    return tuple(
        (
            python,
            "-m",
            "mypy",
            "--config-file",
            "pyproject.toml",
            "--platform",
            platform,
            "--cache-dir",
            f".artifacts/mypy-cache/{platform}",
        )
        for _, platform in MYPY_PLATFORM_TARGETS
    )


def quality_commands(*, lint: bool, types: bool) -> tuple[tuple[str, ...], ...]:
    commands: list[tuple[str, ...]] = []
    if lint:
        commands.append((sys.executable, "-m", "ruff", "check", "tools", "tests"))
    if types:
        commands.extend(python_typecheck_commands(sys.executable))
    return tuple(commands)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--lint", action="store_true", help="Run Ruff only")
    group.add_argument("--types", action="store_true", help="Run mypy only")
    args = parser.parse_args(argv)
    lint = args.lint or not args.types
    types = args.types or not args.lint
    for command in quality_commands(lint=lint, types=types):
        subprocess.run(command, cwd=project_root(), check=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
