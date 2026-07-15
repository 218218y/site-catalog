#!/usr/bin/env python3
"""Run the complete project verification workflow with one cross-platform command.

The script intentionally uses the same commands on Windows and Unix-like systems.
It verifies generated frontend assets, JavaScript syntax, every JavaScript contract
file, the Python suite, and (unless ``--quick`` is supplied) a clean deploy bundle.
Temporary verification artifacts are removed even when a command fails.
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence


@dataclass(frozen=True)
class VerificationStep:
    title: str
    command: tuple[str, ...]


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def discover_javascript_tests(root: Path) -> tuple[Path, ...]:
    return tuple(sorted((root / "tests").glob("*.test.js")))


def verification_steps(root: Path, *, quick: bool = False) -> tuple[VerificationStep, ...]:
    python = sys.executable
    steps: list[VerificationStep] = [
        VerificationStep(
            "Frontend bundles are current",
            (python, "tools/build_frontend_assets.py", "--check"),
        ),
        VerificationStep("Generated JavaScript syntax", ("node", "--check", "app.js")),
    ]
    steps.extend(
        VerificationStep(f"JavaScript contract: {path.name}", ("node", path.as_posix()))
        for path in discover_javascript_tests(root)
    )
    steps.append(VerificationStep("Python tests", (python, "-m", "pytest", "-q")))
    if not quick:
        steps.append(
            VerificationStep(
                "Clean Cloudflare Pages bundle",
                (python, "tools/build_deploy_bundle.py", "--out", ".artifacts/verify-deploy"),
            )
        )
    return tuple(steps)


def run_step(root: Path, step: VerificationStep) -> None:
    print(f"\n=== {step.title} ===", flush=True)
    subprocess.run(step.command, cwd=root, check=True)


def verify_project(root: Path | None = None, *, quick: bool = False) -> int:
    base = (root or project_root()).resolve()
    artifact_dir = base / ".artifacts" / "verify-deploy"
    staging_dir = artifact_dir.with_name(f".{artifact_dir.name}.staging")
    backup_dir = artifact_dir.with_name(f".{artifact_dir.name}.previous")

    try:
        for step in verification_steps(base, quick=quick):
            run_step(base, step)
    except (FileNotFoundError, subprocess.CalledProcessError) as exc:
        print(f"\nVERIFICATION FAILED: {exc}", file=sys.stderr)
        return 1
    finally:
        for path in (artifact_dir, staging_dir, backup_dir):
            if path.exists():
                shutil.rmtree(path, ignore_errors=True)

    mode = "quick" if quick else "complete"
    print(f"\nProject verification passed ({mode}).")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--quick",
        action="store_true",
        help="Run source, syntax and test checks without creating a deploy bundle.",
    )
    args = parser.parse_args(argv)
    return verify_project(quick=args.quick)


if __name__ == "__main__":
    raise SystemExit(main())
