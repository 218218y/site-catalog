#!/usr/bin/env python3
"""Run the complete project verification workflow with one cross-platform command.

The script verifies generated frontend assets and HTML pages, JavaScript syntax,
every JavaScript contract file, and the Python suite. Complete verification also
runs Playwright browser journeys and creates a clean deploy bundle with validated
fingerprinted assets. Python tests run inside the project's ``.venv`` when it
exists, so the command behaves consistently on Windows and Unix-like systems.
Temporary deploy artifacts are removed even when a command fails. CI can skip
the browser journeys while retaining every source, unit, SEO, deploy-bundle and
performance gate, allowing Playwright to run concurrently in a separate job.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys

# Verification imports and launches many project Python modules. Keep bytecode
# outside the source tree so local runs and CI cannot create tracked cache noise.
sys.dont_write_bytecode = True
os.environ.setdefault("PYTHONDONTWRITEBYTECODE", "1")

from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Sequence

from build_frontend_assets import GENERATED_JS_FILES

REQUIRED_PYTHON_MODULES: tuple[str, ...] = ("pytest", "fitz", "PIL", "ruff", "mypy")
VerificationScope = Literal["all", "javascript", "python"]


@dataclass(frozen=True)
class VerificationStep:
    title: str
    command: tuple[str, ...]


class MissingPythonTestEnvironment(RuntimeError):
    """Raised when neither the local venv nor the current Python can run tests."""


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def venv_python_path(root: Path, *, platform: str | None = None) -> Path:
    platform_name = platform or os.name
    relative = Path("Scripts/python.exe") if platform_name == "nt" else Path("bin/python")
    return root / ".venv" / relative


def missing_python_modules(
    python: Path | str,
    modules: Sequence[str] = REQUIRED_PYTHON_MODULES,
) -> tuple[str, ...]:
    script = (
        "import importlib.util, json; "
        f"modules = {list(modules)!r}; "
        "print(json.dumps([name for name in modules if importlib.util.find_spec(name) is None]))"
    )
    try:
        result = subprocess.run(
            (str(python), "-c", script),
            check=True,
            capture_output=True,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return tuple(modules)

    try:
        payload = json.loads(result.stdout.strip() or "[]")
    except json.JSONDecodeError:
        return tuple(modules)
    return tuple(str(name) for name in payload)


def resolve_project_python(root: Path) -> str:
    candidates: list[Path | str] = []
    local_python = venv_python_path(root)
    if local_python.is_file():
        candidates.append(local_python)
    candidates.append(sys.executable)

    checked: set[str] = set()
    failures: list[str] = []
    for candidate in candidates:
        normalized = str(candidate)
        if normalized in checked:
            continue
        checked.add(normalized)
        missing = missing_python_modules(candidate)
        if not missing:
            return normalized
        failures.append(f"{normalized}: missing {', '.join(missing)}")

    details = "; ".join(failures) if failures else "no usable Python interpreter was found"
    raise MissingPythonTestEnvironment(
        "Python test dependencies are not installed. "
        "Run `npm run setup:python` once, then run the verification again. "
        f"Checked: {details}"
    )


def discover_javascript_tests(root: Path) -> tuple[Path, ...]:
    return tuple(sorted((root / "tests").glob("*.test.js")))


def playwright_cli_path(root: Path) -> Path:
    return root / "node_modules" / "@playwright" / "test" / "cli.js"


def verification_steps(
    root: Path,
    *,
    quick: bool = False,
    include_browser: bool = True,
    python_executable: str | None = None,
    scope: VerificationScope = "all",
) -> tuple[VerificationStep, ...]:
    if scope not in {"all", "javascript", "python"}:
        raise ValueError(f"Unknown verification scope: {scope}")

    python = python_executable or (resolve_project_python(root) if scope != "javascript" else sys.executable)
    steps: list[VerificationStep] = []

    if scope in {"all", "javascript"}:
        steps.extend((
            VerificationStep(
                "Linux npm offline mirror is current",
                (python, "tools/sync_npm_offline_linux.py", "--check"),
            ),
            VerificationStep(
                "Frontend bundles are current",
                (python, "tools/build_frontend_assets.py", "--check"),
            ),
            VerificationStep(
                "Frontend feature contracts",
                (python, "tools/check_frontend_contracts.py"),
            ),
            VerificationStep(
                "Catalog data types are current",
                (python, "tools/generate_catalog_data_types.py", "--check"),
            ),
            VerificationStep(
                "Control-panel API types are current",
                (python, "tools/generate_control_panel_api_types.py", "--check"),
            ),
            VerificationStep(
                "Frontend JSDoc typecheck (TypeScript 7)",
                (
                    python,
                    "tools/run_typescript_offline.py",
                    "-p",
                    "jsconfig.json",
                    "--pretty",
                    "false",
                ),
            ),
            VerificationStep(
                "Frontend route runtime symbols",
                ("node", "tools/check_frontend_runtime_symbols.js"),
            ),
            VerificationStep(
                "Generated site pages are current",
                (python, "tools/build_site_pages.py", "--check"),
            ),
            VerificationStep(
                "Static accessibility audit",
                (python, "tools/audit_accessibility.py"),
            ),
            VerificationStep(
                "Source performance budgets",
                (python, "tools/check_performance_budgets.py"),
            ),
        ))
        steps.extend(
            VerificationStep(
                f"Generated JavaScript syntax: {filename}",
                ("node", "--check", filename),
            )
            for filename in GENERATED_JS_FILES
        )
        steps.extend(
            VerificationStep(f"JavaScript contract: {path.name}", ("node", path.as_posix()))
            for path in discover_javascript_tests(root)
        )

    if scope in {"all", "python"}:
        steps.extend((
            VerificationStep(
                "Python Ruff correctness lint",
                (python, "-m", "ruff", "check", "tools", "tests"),
            ),
            VerificationStep(
                "Python static type contracts",
                (python, "-m", "mypy", "--config-file", "pyproject.toml"),
            ),
            VerificationStep("Python tests", (python, "-m", "pytest", "-q")),
        ))

    if scope == "all":
        steps.append(
            VerificationStep(
                "Guarded public SEO preview",
                (
                    python,
                    "tools/verify_public_seo.py",
                    "--out",
                    "dist/site-public-preview",
                    "--clean-legacy-artifacts",
                ),
            )
        )

    if scope == "all" and not quick and include_browser:
        steps.extend((
            VerificationStep(
                "Playwright Chromium is installed",
                ("node", "tools/check_playwright_browser.js"),
            ),
            VerificationStep(
                "Playwright browser journeys",
                ("node", playwright_cli_path(root).relative_to(root).as_posix(), "test"),
            ),
        ))

    if scope == "all" and not quick:
        steps.extend((
            VerificationStep(
                "Clean Cloudflare Pages bundle",
                (python, "tools/build_deploy_bundle.py", "--out", ".artifacts/verify-deploy"),
            ),
            VerificationStep(
                "Deploy performance budgets",
                (python, "tools/check_performance_budgets.py", "--bundle-dir", ".artifacts/verify-deploy"),
            ),
        ))
    return tuple(steps)


def run_step(root: Path, step: VerificationStep) -> None:
    print(f"\n=== {step.title} ===", flush=True)
    subprocess.run(step.command, cwd=root, check=True)


def verify_project(
    root: Path | None = None,
    *,
    quick: bool = False,
    include_browser: bool = True,
    scope: VerificationScope = "all",
) -> int:
    base = (root or project_root()).resolve()
    artifact_dir = base / ".artifacts" / "verify-deploy"
    staging_dir = artifact_dir.with_name(f".{artifact_dir.name}.staging")
    backup_dir = artifact_dir.with_name(f".{artifact_dir.name}.previous")

    try:
        python = sys.executable if scope == "javascript" else resolve_project_python(base)
        for step in verification_steps(
            base,
            quick=quick,
            include_browser=include_browser,
            python_executable=python,
            scope=scope,
        ):
            run_step(base, step)
    except (FileNotFoundError, MissingPythonTestEnvironment, subprocess.CalledProcessError) as exc:
        print(f"\nVERIFICATION FAILED: {exc}", file=sys.stderr)
        return 1
    finally:
        for path in (artifact_dir, staging_dir, backup_dir):
            if path.exists():
                shutil.rmtree(path, ignore_errors=True)

    mode = scope if scope != "all" else ("quick" if quick else ("complete" if include_browser else "core"))
    print(f"\nProject verification passed ({mode}).")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--quick",
        action="store_true",
        help=(
            "Run source, syntax, unit and cached public-SEO checks without "
            "browser journeys or a private deploy bundle."
        ),
    )
    parser.add_argument(
        "--skip-browser",
        action="store_true",
        help=(
            "Run the complete non-browser verification, including clean deploy-bundle "
            "and performance gates; intended for CI with a parallel Playwright job."
        ),
    )
    scope_group = parser.add_mutually_exclusive_group()
    scope_group.add_argument(
        "--javascript-only",
        action="store_true",
        help="Run generated-page, JavaScript syntax and JavaScript contract checks only.",
    )
    scope_group.add_argument(
        "--python-only",
        action="store_true",
        help="Run the Python test suite only.",
    )
    args = parser.parse_args(argv)
    scope: VerificationScope = "javascript" if args.javascript_only else ("python" if args.python_only else "all")
    return verify_project(
        quick=args.quick,
        include_browser=not args.skip_browser,
        scope=scope,
    )


if __name__ == "__main__":
    raise SystemExit(main())
