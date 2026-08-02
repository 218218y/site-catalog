from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("project_doctor_test_module", ROOT / "tools/project_doctor.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_doctor_reports_every_result_and_fails_only_on_blocking_checks() -> None:
    checks = (
        MODULE.DoctorCheck("a", "A", "pass", "ready"),
        MODULE.DoctorCheck("b", "B", "warn", "optional", "install optional tool"),
        MODULE.DoctorCheck("c", "C", "fail", "missing", "install required tool"),
    )

    report = MODULE.render_text(checks)

    assert "[PASS] A: ready" in report
    assert "[WARN] B: optional" in report
    assert "[FAIL] C: missing" in report
    assert "1 passed, 1 warnings, 1 failures" in report
    assert MODULE.doctor_exit_code(checks) == 1
    assert MODULE.doctor_exit_code(checks[:2]) == 0


def test_doctor_check_classifies_optional_failures_as_warnings() -> None:
    warning = MODULE._check("optional", "Optional", False, "missing", "install", warning=True)
    failure = MODULE._check("required", "Required", False, "missing", "install")

    assert warning.status == "warn"
    assert warning.blocking is False
    assert failure.status == "fail"
    assert failure.blocking is True

def test_python_package_probe_uses_the_selected_interpreter_and_imports_metadata() -> None:
    calls: list[tuple[tuple[str, ...], Path]] = []

    def runner(command: tuple[str, ...], cwd: Path):
        calls.append((command, cwd))
        return MODULE.subprocess.CompletedProcess(command, 0, stdout="[]\n", stderr="")

    check = MODULE._python_modules_check(ROOT, runner, "project-python")

    assert check.status == "pass"
    assert calls and calls[0][0][:2] == ("project-python", "-c")
    probe = calls[0][0][2]
    assert "import importlib.metadata" in probe
    assert "import importlib.util" in probe
    assert "ruff" in probe and "mypy" in probe


def test_doctor_runs_independent_checks_without_fail_fast(tmp_path: Path, monkeypatch) -> None:
    (tmp_path / ".nvmrc").write_text("24.18.0\n", encoding="utf-8")
    calls: list[tuple[str, ...]] = []

    def runner(command, cwd):
        calls.append(tuple(command))
        if command[:2] == ("node", "--version"):
            return MODULE.subprocess.CompletedProcess(command, 0, stdout="v24.18.0\n", stderr="")
        if len(command) >= 3 and command[1] == "-c":
            return MODULE.subprocess.CompletedProcess(command, 0, stdout="[]\n", stderr="")
        return MODULE.subprocess.CompletedProcess(command, 0, stdout="ok\n", stderr="")

    monkeypatch.setattr(MODULE.shutil, "which", lambda name: None if name == "tesseract" else f"/usr/bin/{name}")
    checks = MODULE.collect_doctor_checks(tmp_path, runner=runner)

    keys = [check.key for check in checks]
    assert keys == [
        "python-runtime",
        "node-runtime",
        "npm-dependencies",
        "python-venv",
        "python-packages",
        "typescript-7",
        "esbuild",
        "playwright",
        "tesseract",
    ]
    assert ("npm", "ls", "--depth=0", "--ignore-scripts") in calls
    assert any(any("bootstrap_typescript_offline.py" in part for part in command) for command in calls)
    assert any(any("bootstrap_esbuild_offline.py" in part for part in command) for command in calls)
    assert checks[-1].status == "warn"

