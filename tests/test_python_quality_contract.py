from __future__ import annotations

import importlib
import json
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

setup_python_env = importlib.import_module("setup_python_env")
verify_project = importlib.import_module("verify_project")
run_python_quality = importlib.import_module("run_python_quality")


def test_python_quality_dependencies_are_pinned_and_required() -> None:
    requirements = {
        line.strip()
        for line in (TOOLS / "requirements-dev.txt").read_text(encoding="utf-8").splitlines()
        if line.strip() and not line.startswith("-")
    }
    assert "ruff==0.16.1" in requirements
    assert "mypy==2.3.0" in requirements
    assert {"ruff", "mypy"}.issubset(set(setup_python_env.REQUIRED_IMPORTS))
    assert setup_python_env.PINNED_DISTRIBUTIONS["ruff"] == "0.16.1"
    assert setup_python_env.PINNED_DISTRIBUTIONS["mypy"] == "2.3.0"
    assert {"ruff", "mypy"}.issubset(set(verify_project.REQUIRED_PYTHON_MODULES))


def test_python_quality_configuration_is_a_deliberate_ratchet() -> None:
    config = tomllib.loads((ROOT / "pyproject.toml").read_text(encoding="utf-8"))
    ruff = config["tool"]["ruff"]
    mypy = config["tool"]["mypy"]

    python_version = (ROOT / ".python-version").read_text(encoding="utf-8").strip()
    assert ruff["target-version"] == f"py{python_version.replace('.', '')}"
    assert mypy["python_version"] == python_version
    assert ruff["lint"]["select"] == ["E9", "F63", "F7", "F82"]
    assert mypy["disallow_untyped_defs"] is True
    assert mypy["check_untyped_defs"] is True
    assert mypy["no_implicit_optional"] is True
    assert "tools/project_doctor.py" in mypy["files"]
    assert "tools/python_toolchain.py" in mypy["files"]
    assert "tools/check_frontend_contracts.py" in mypy["files"]


def test_python_verification_runs_lint_types_then_tests() -> None:
    steps = verify_project.verification_steps(
        ROOT,
        quick=True,
        python_executable="python-under-test",
        scope="python",
    )
    assert [step.title for step in steps] == [
        "Python Ruff correctness lint",
        "Python static type contracts",
        "Python tests",
    ]
    assert steps[0].command == (
        "python-under-test", "-m", "ruff", "check", "tools", "tests",
    )
    assert steps[1].command == (
        "python-under-test", "-m", "mypy", "--config-file", "pyproject.toml",
    )


def test_package_scripts_expose_doctor_and_individual_quality_gates() -> None:
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    scripts = package["scripts"]
    assert scripts["doctor"].endswith("tools/project_doctor.py")
    assert scripts["lint:python"].endswith("tools/run_python_quality.py --lint")
    assert scripts["check:python-types"].endswith("tools/run_python_quality.py --types")
    assert run_python_quality.quality_commands(lint=True, types=False) == (
        (sys.executable, "-m", "ruff", "check", "tools", "tests"),
    )
