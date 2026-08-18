#!/usr/bin/env python3
"""Report the complete local development environment without mutating it.

Unlike the verification runner, the doctor never stops at the first failure.
It checks every independent prerequisite and prints one actionable report, so a
machine can be repaired in one pass instead of through repeated failed builds.
"""
from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Callable, Literal, Sequence

from python_toolchain import (
    current_runtime_identity,
    inspect_python_runtime,
    read_python_version_baseline,
    runtime_satisfies_baseline,
)

DoctorStatus = Literal["pass", "warn", "fail"]
CommandRunner = Callable[[Sequence[str], Path], subprocess.CompletedProcess[str]]


@dataclass(frozen=True)
class DoctorCheck:
    key: str
    label: str
    status: DoctorStatus
    detail: str
    remedy: str = ""

    @property
    def blocking(self) -> bool:
        return self.status == "fail"


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def run_command(command: Sequence[str], cwd: Path) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, cwd=cwd, text=True, capture_output=True, check=False)


def _check(
    key: str,
    label: str,
    ok: bool,
    detail: str,
    remedy: str,
    *,
    warning: bool = False,
) -> DoctorCheck:
    status: DoctorStatus = "pass" if ok else ("warn" if warning else "fail")
    return DoctorCheck(key, label, status, detail, "" if ok else remedy)


def _command_check(
    root: Path,
    runner: CommandRunner,
    *,
    key: str,
    label: str,
    command: Sequence[str],
    remedy: str,
    warning: bool = False,
) -> DoctorCheck:
    try:
        result = runner(command, root)
    except OSError as error:
        return _check(key, label, False, str(error), remedy, warning=warning)
    output = (result.stdout or result.stderr).strip()
    detail = output.splitlines()[-1] if output else f"exit code {result.returncode}"
    return _check(key, label, result.returncode == 0, detail, remedy, warning=warning)


def _python_modules_check(
    root: Path,
    runner: CommandRunner,
    python: str,
) -> DoctorCheck:
    required = {
        "pytest": ("pytest", "9.1.1"),
        "PyMuPDF": ("fitz", "1.28.0"),
        "Pillow": ("PIL", "12.3.0"),
        "ruff": ("ruff", "0.16.1"),
        "mypy": ("mypy", "2.3.0"),
    }
    script = f"""
import importlib.metadata
import importlib.util
import json
required = {required!r}
problems = []
for distribution, (module, expected) in required.items():
    if importlib.util.find_spec(module) is None:
        problems.append(f"{{distribution}} missing")
        continue
    try:
        actual = importlib.metadata.version(distribution)
    except importlib.metadata.PackageNotFoundError:
        problems.append(f"{{distribution}} metadata missing")
        continue
    if actual != expected:
        problems.append(f"{{distribution}}=={{actual}}, expected {{expected}}")
print(json.dumps(problems))
"""
    try:
        result = runner((python, "-c", script), root)
    except OSError as error:
        problems = [str(error)]
    else:
        try:
            payload = json.loads(result.stdout) if result.returncode == 0 else []
            problems = [str(item) for item in payload]
        except (json.JSONDecodeError, TypeError):
            problems = [result.stderr.strip() or "could not inspect Python packages"]
    return _check(
        "python-packages",
        "Pinned Python development packages",
        not problems,
        f"{python}: all pinned packages match" if not problems else "; ".join(problems),
        "Run `npm run setup:python`.",
    )


def collect_doctor_checks(
    root: Path | None = None,
    *,
    runner: CommandRunner = run_command,
) -> tuple[DoctorCheck, ...]:
    base = (root or project_root()).resolve()
    checks: list[DoctorCheck] = []

    python_baseline = read_python_version_baseline(base)
    system_runtime = current_runtime_identity()
    checks.append(_check(
        "python-runtime",
        "Python runtime",
        runtime_satisfies_baseline(system_runtime, python_baseline),
        f"Python {platform.python_version()}; project baseline {python_baseline.text}+",
        f"Install/use Python {python_baseline.text} or newer within Python {python_baseline.major}.x.",
    ))

    expected_node = (base / ".nvmrc").read_text(encoding="utf-8").strip()
    node_result = runner(("node", "--version"), base) if shutil.which("node") else None
    actual_node = node_result.stdout.strip().removeprefix("v") if node_result and node_result.returncode == 0 else "unavailable"
    checks.append(_check(
        "node-runtime",
        "Node.js runtime",
        actual_node == expected_node,
        f"Node {actual_node}; project pin {expected_node}",
        f"Install/use Node {expected_node} (for example with nvm).",
    ))

    checks.append(_command_check(
        base, runner,
        key="npm-dependencies",
        label="package-lock installation",
        command=("npm", "ls", "--depth=0", "--ignore-scripts"),
        remedy="Run `npm ci` or the verified offline bootstrap commands.",
    ))

    local_python = base / ".venv" / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    python = str(local_python if local_python.is_file() else Path(sys.executable))
    if local_python.is_file():
        managed_runtime = inspect_python_runtime(local_python)
        managed_runtime_ok = (
            managed_runtime is not None
            and runtime_satisfies_baseline(managed_runtime, python_baseline)
            and managed_runtime == system_runtime
        )
        managed_detail = (
            f"{local_python}; Python {managed_runtime.version_text}"
            if managed_runtime is not None
            else f"{local_python}; runtime could not be inspected"
        )
        checks.append(_check(
            "python-venv",
            "Project Python environment",
            managed_runtime_ok,
            managed_detail,
            "Run `npm run setup:python` to rebuild .venv with the selected supported runtime.",
        ))
    else:
        checks.append(_check(
            "python-venv",
            "Project Python environment",
            False,
            f"using system interpreter {sys.executable}",
            "Run `npm run setup:python` to create the isolated .venv.",
            warning=True,
        ))
    checks.append(_python_modules_check(base, runner, python))

    for key, label, command, remedy in (
        (
            "typescript-7",
            "Offline TypeScript 7 compiler",
            (python, "tools/bootstrap_typescript_offline.py", "--check", "--quiet"),
            "Run `npm run setup:typescript:offline`.",
        ),
        (
            "esbuild",
            "Offline esbuild runtime",
            (python, "tools/bootstrap_esbuild_offline.py", "--check", "--quiet"),
            "Run `npm run setup:esbuild:offline`.",
        ),
    ):
        checks.append(_command_check(
            base, runner, key=key, label=label, command=command, remedy=remedy,
        ))

    checks.append(_command_check(
        base, runner,
        key="python-offline-linux",
        label="Offline Linux Python verification wheels",
        command=(sys.executable, "tools/sync_python_offline_linux.py", "--check"),
        remedy="Run `npm run update:python:offline:linux` on a machine with package network access.",
        warning=True,
    ))

    checks.append(_command_check(
        base, runner,
        key="playwright",
        label="Playwright Chromium",
        command=("node", "tools/check_playwright_browser.js"),
        remedy="Run `npm run setup:browsers` (or `npm run setup:browsers:linux`).",
        warning=True,
    ))

    tesseract = shutil.which("tesseract")
    if tesseract:
        languages = runner((tesseract, "--list-langs"), base)
        language_set = set(languages.stdout.splitlines()[1:]) if languages.returncode == 0 else set()
        has_hebrew = "heb" in language_set
        checks.append(_check(
            "tesseract",
            "Tesseract OCR with Hebrew",
            has_hebrew,
            f"{tesseract}; Hebrew language {'available' if has_hebrew else 'missing'}",
            "Install Tesseract OCR and the Hebrew language package.",
            warning=True,
        ))
    else:
        checks.append(_check(
            "tesseract",
            "Tesseract OCR with Hebrew",
            False,
            "tesseract command is unavailable",
            "Install Tesseract OCR and the Hebrew language package.",
            warning=True,
        ))

    return tuple(checks)


def doctor_exit_code(checks: Sequence[DoctorCheck]) -> int:
    return 1 if any(check.blocking for check in checks) else 0


def render_text(checks: Sequence[DoctorCheck]) -> str:
    icons = {"pass": "PASS", "warn": "WARN", "fail": "FAIL"}
    lines = ["Project doctor", "=============="]
    for check in checks:
        lines.append(f"[{icons[check.status]}] {check.label}: {check.detail}")
        if check.remedy:
            lines.append(f"       Fix: {check.remedy}")
    counts = {status: sum(check.status == status for check in checks) for status in ("pass", "warn", "fail")}
    lines.append("")
    lines.append(f"Summary: {counts['pass']} passed, {counts['warn']} warnings, {counts['fail']} failures")
    return "\n".join(lines)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON")
    args = parser.parse_args(argv)
    checks = collect_doctor_checks()
    if args.json:
        print(json.dumps({
            "ok": doctor_exit_code(checks) == 0,
            "checks": [asdict(check) for check in checks],
        }, ensure_ascii=False, indent=2))
    else:
        print(render_text(checks))
    return doctor_exit_code(checks)


if __name__ == "__main__":
    raise SystemExit(main())
