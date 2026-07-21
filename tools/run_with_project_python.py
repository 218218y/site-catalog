#!/usr/bin/env python3
"""Run a project Python tool inside the managed ``.venv`` environment.

The launcher itself uses only the standard library, so npm and CI may invoke it
with whichever system Python is available. It then creates or validates the
project environment through ``setup_python_env.py`` and executes the requested
script with that environment's interpreter. This prevents commands from
silently depending on globally installed packages.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Sequence

from setup_python_env import create_or_update_environment


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def resolve_project_script(root: Path, value: str) -> Path:
    candidate = Path(value)
    candidate = candidate.resolve() if candidate.is_absolute() else (root / candidate).resolve()
    if candidate == root or root not in candidate.parents:
        raise ValueError("Python tool must be located inside the project directory")
    if candidate.suffix.lower() != ".py":
        raise ValueError("Python tool must be a .py file")
    if not candidate.is_file():
        raise FileNotFoundError(f"Python tool does not exist: {candidate}")
    return candidate


def build_command(root: Path, script: Path, arguments: Sequence[str]) -> tuple[str, ...]:
    python = create_or_update_environment(root, quiet=True)
    return (
        str(python),
        script.relative_to(root).as_posix(),
        *arguments,
    )


def run_project_tool(root: Path, script: Path, arguments: Sequence[str]) -> int:
    command = build_command(root, script, arguments)
    return subprocess.run(command, cwd=root, check=False).returncode


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("script", help="Project-relative Python script to execute")
    parser.add_argument("arguments", nargs=argparse.REMAINDER)
    args = parser.parse_args(argv)

    root = project_root()
    forwarded = list(args.arguments)
    if forwarded[:1] == ["--"]:
        forwarded.pop(0)

    try:
        script = resolve_project_script(root, args.script)
        return run_project_tool(root, script, forwarded)
    except (FileNotFoundError, RuntimeError, ValueError, subprocess.CalledProcessError) as exc:
        print(f"\nPROJECT PYTHON TOOL FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
