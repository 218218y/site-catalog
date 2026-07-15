from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"

SPEC = importlib.util.spec_from_file_location("setup_python_env", TOOLS / "setup_python_env.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_venv_python_path_is_cross_platform(tmp_path: Path) -> None:
    assert MODULE.venv_python_path(tmp_path, platform="nt") == tmp_path / ".venv/Scripts/python.exe"
    assert MODULE.venv_python_path(tmp_path, platform="posix") == tmp_path / ".venv/bin/python"


def test_requirements_fingerprint_changes_with_dev_requirements(tmp_path: Path) -> None:
    tools = tmp_path / "tools"
    tools.mkdir()
    (tools / "requirements.txt").write_text("Pillow>=10\n", encoding="utf-8")
    dev = tools / "requirements-dev.txt"
    dev.write_text("-r requirements.txt\npytest>=8\n", encoding="utf-8")
    first = MODULE.requirements_fingerprint(tmp_path)

    dev.write_text("-r requirements.txt\npytest>=9\n", encoding="utf-8")
    second = MODULE.requirements_fingerprint(tmp_path)
    assert first != second


def test_environment_is_current_requires_stamp_and_imports(tmp_path: Path, monkeypatch) -> None:
    python = MODULE.venv_python_path(tmp_path, platform="posix")
    python.parent.mkdir(parents=True)
    python.write_text("", encoding="utf-8")
    stamp = tmp_path / ".venv" / MODULE.STAMP_NAME
    stamp.write_text("expected\n", encoding="utf-8")
    monkeypatch.setattr(MODULE, "missing_imports", lambda executable: ())

    assert MODULE.environment_is_current(tmp_path, python, "expected") is True
    assert MODULE.environment_is_current(tmp_path, python, "different") is False
