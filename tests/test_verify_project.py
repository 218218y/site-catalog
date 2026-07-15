from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"

SPEC = importlib.util.spec_from_file_location("verify_project", TOOLS / "verify_project.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_javascript_tests_are_discovered_deterministically() -> None:
    tests = MODULE.discover_javascript_tests(ROOT)
    assert tests
    assert tests == tuple(sorted(tests))
    assert all(path.name.endswith(".test.js") for path in tests)
    assert any(path.name == "frontend_modules_contract.test.js" for path in tests)


def test_venv_python_path_is_platform_specific(tmp_path: Path) -> None:
    assert MODULE.venv_python_path(tmp_path, platform="nt") == tmp_path / ".venv/Scripts/python.exe"
    assert MODULE.venv_python_path(tmp_path, platform="posix") == tmp_path / ".venv/bin/python"


def test_quick_verification_omits_deploy_build() -> None:
    steps = MODULE.verification_steps(ROOT, quick=True, python_executable="project-python")
    titles = [step.title for step in steps]
    commands = [step.command for step in steps]

    assert titles[0] == "Frontend bundles are current"
    assert "Generated site pages are current" in titles
    assert commands[0][0] == "project-python"
    assert any(command[:2] == ("node", "--check") for command in commands)
    assert any(command[:4] == ("project-python", "-m", "pytest", "-q") for command in commands)
    assert not any("playwright" in " ".join(command).lower() for command in commands)
    assert not any("build_deploy_bundle.py" in command for command in commands)


def test_complete_verification_builds_a_clean_deploy_bundle() -> None:
    steps = MODULE.verification_steps(ROOT, quick=False, python_executable="project-python")
    deploy_steps = [
        step
        for step in steps
        if any(part.endswith("build_deploy_bundle.py") for part in step.command)
    ]

    assert len(deploy_steps) == 1
    assert deploy_steps[0].command[0] == "project-python"
    assert deploy_steps[0].command[-2:] == ("--out", ".artifacts/verify-deploy")

    titles = [step.title for step in steps]
    assert "Generated site pages are current" in titles
    assert "Playwright Chromium is installed" in titles
    assert "Playwright browser journeys" in titles


def test_missing_environment_message_points_to_setup_command(tmp_path: Path, monkeypatch) -> None:
    monkeypatch.setattr(MODULE, "venv_python_path", lambda root: tmp_path / "missing-python")
    monkeypatch.setattr(MODULE.sys, "executable", str(tmp_path / "system-python"))
    monkeypatch.setattr(
        MODULE,
        "missing_python_modules",
        lambda python, modules=MODULE.REQUIRED_PYTHON_MODULES: tuple(modules),
    )

    try:
        MODULE.resolve_project_python(tmp_path)
    except MODULE.MissingPythonTestEnvironment as exc:
        assert "npm run setup:python" in str(exc)
        assert "pytest" in str(exc)
    else:
        raise AssertionError("Expected a missing Python test environment error")


def test_javascript_only_scope_does_not_require_python_tests_or_browser() -> None:
    steps = MODULE.verification_steps(
        ROOT, quick=False, python_executable="system-python", scope="javascript"
    )
    titles = [step.title for step in steps]
    assert "Generated site pages are current" in titles
    assert any(title.startswith("JavaScript contract:") for title in titles)
    assert "Python tests" not in titles
    assert "Playwright browser journeys" not in titles
    assert "Clean Cloudflare Pages bundle" not in titles


def test_python_only_scope_runs_only_pytest() -> None:
    steps = MODULE.verification_steps(
        ROOT, quick=False, python_executable="project-python", scope="python"
    )
    assert steps == (
        MODULE.VerificationStep("Python tests", ("project-python", "-m", "pytest", "-q")),
    )
