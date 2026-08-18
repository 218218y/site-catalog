from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location("setup_python_env", TOOLS / "setup_python_env.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def _write_environment_inputs(root: Path, *, python_version: str = "3.13") -> None:
    tools = root / "tools"
    tools.mkdir(exist_ok=True)
    (root / ".python-version").write_text(python_version + "\n", encoding="utf-8")
    (tools / "requirements.txt").write_text("Pillow==12.3.0\n", encoding="utf-8")
    (tools / "requirements-dev.txt").write_text(
        "-r requirements.txt\npytest==9.1.1\n",
        encoding="utf-8",
    )


def _runtime(*, minor: int = 13):
    return MODULE.PythonRuntimeIdentity(
        major=3,
        minor=minor,
        implementation="cpython",
        cache_tag=f"cpython-3{minor}",
        system="Linux",
        machine="x86_64",
    )


def _write_stamp(root: Path, fingerprint: str, runtime=None) -> None:
    stamp = MODULE.EnvironmentStamp(MODULE.STAMP_FORMAT, fingerprint, runtime or _runtime())
    stamp_path = root / ".venv" / MODULE.STAMP_NAME
    stamp_path.parent.mkdir(parents=True, exist_ok=True)
    stamp_path.write_text(stamp.to_json(), encoding="utf-8")


def test_venv_python_path_is_cross_platform(tmp_path: Path) -> None:
    assert MODULE.venv_python_path(tmp_path, platform="nt") == tmp_path / ".venv/Scripts/python.exe"
    assert MODULE.venv_python_path(tmp_path, platform="posix") == tmp_path / ".venv/bin/python"


def test_environment_fingerprint_changes_with_dev_requirements_and_python_baseline(tmp_path: Path) -> None:
    _write_environment_inputs(tmp_path)
    first = MODULE.environment_fingerprint(tmp_path)

    (tmp_path / "tools" / "requirements-dev.txt").write_text(
        "-r requirements.txt\npytest==9.1.2\n",
        encoding="utf-8",
    )
    second = MODULE.environment_fingerprint(tmp_path)
    assert first != second

    (tmp_path / ".python-version").write_text("3.14\n", encoding="utf-8")
    third = MODULE.environment_fingerprint(tmp_path)
    assert second != third


def test_environment_is_current_requires_structured_stamp_runtime_and_packages(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _write_environment_inputs(tmp_path)
    python = MODULE.venv_python_path(tmp_path, platform="posix")
    python.parent.mkdir(parents=True)
    python.write_text("", encoding="utf-8")
    _write_stamp(tmp_path, "expected")
    monkeypatch.setattr(MODULE, "inspect_python_runtime", lambda executable: _runtime())
    monkeypatch.setattr(MODULE, "missing_imports", lambda executable: ())
    monkeypatch.setattr(MODULE, "mismatched_distribution_versions", lambda executable: ())

    assert MODULE.environment_is_current(tmp_path, python, "expected", _runtime()) is True
    assert MODULE.environment_is_current(tmp_path, python, "different", _runtime()) is False


def test_environment_is_not_current_for_legacy_or_wrong_runtime_stamp(tmp_path: Path, monkeypatch) -> None:
    _write_environment_inputs(tmp_path)
    python = MODULE.venv_python_path(tmp_path, platform="posix")
    python.parent.mkdir(parents=True)
    python.write_text("", encoding="utf-8")
    stamp = tmp_path / ".venv" / MODULE.STAMP_NAME
    stamp.write_text("old-hash-only-format\n", encoding="utf-8")
    monkeypatch.setattr(MODULE, "inspect_python_runtime", lambda executable: _runtime())
    monkeypatch.setattr(MODULE, "missing_imports", lambda executable: ())
    monkeypatch.setattr(MODULE, "mismatched_distribution_versions", lambda executable: ())

    assert MODULE.environment_is_current(tmp_path, python, "expected", _runtime()) is False

    _write_stamp(tmp_path, "expected", _runtime(minor=12))
    assert MODULE.environment_is_current(tmp_path, python, "expected", _runtime()) is False


def test_environment_is_not_current_when_pinned_versions_drift(tmp_path: Path, monkeypatch) -> None:
    _write_environment_inputs(tmp_path)
    python = MODULE.venv_python_path(tmp_path, platform="posix")
    python.parent.mkdir(parents=True)
    python.write_text("", encoding="utf-8")
    _write_stamp(tmp_path, "expected")
    monkeypatch.setattr(MODULE, "inspect_python_runtime", lambda executable: _runtime())
    monkeypatch.setattr(MODULE, "missing_imports", lambda executable: ())
    monkeypatch.setattr(
        MODULE,
        "mismatched_distribution_versions",
        lambda executable: ("Pillow==12.2.0 (expected 12.3.0)",),
    )

    assert MODULE.environment_is_current(tmp_path, python, "expected", _runtime()) is False


def test_environment_rebuild_check_rejects_wrong_runtime_or_missing_provenance(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _write_environment_inputs(tmp_path)
    python = MODULE.venv_python_path(tmp_path, platform="posix")
    python.parent.mkdir(parents=True)
    python.write_text("", encoding="utf-8")

    monkeypatch.setattr(MODULE, "inspect_python_runtime", lambda executable: _runtime(minor=12))
    assert MODULE._environment_requires_rebuild(tmp_path, python, _runtime()) is True

    monkeypatch.setattr(MODULE, "inspect_python_runtime", lambda executable: _runtime())
    assert MODULE._environment_requires_rebuild(tmp_path, python, _runtime()) is True

    _write_stamp(tmp_path, "expected")
    assert MODULE._environment_requires_rebuild(tmp_path, python, _runtime()) is False


def test_environment_rebuilds_when_supported_host_minor_changes(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _write_environment_inputs(tmp_path)
    python = MODULE.venv_python_path(tmp_path, platform="posix")
    python.parent.mkdir(parents=True)
    python.write_text("", encoding="utf-8")
    _write_stamp(tmp_path, "expected", _runtime(minor=13))
    monkeypatch.setattr(MODULE, "inspect_python_runtime", lambda executable: _runtime(minor=13))

    assert MODULE._environment_requires_rebuild(tmp_path, python, _runtime(minor=14)) is True
    assert MODULE.environment_is_current(
        tmp_path, python, "expected", _runtime(minor=14)
    ) is False



def test_offline_fingerprint_requirement_forces_clean_rebuild(tmp_path: Path, monkeypatch) -> None:
    _write_environment_inputs(tmp_path)
    python = MODULE.venv_python_path(tmp_path, platform="posix")
    python.parent.mkdir(parents=True)
    python.write_text("", encoding="utf-8")
    _write_stamp(tmp_path, "old-offline-lock")
    monkeypatch.setattr(MODULE, "inspect_python_runtime", lambda executable: _runtime())

    assert MODULE._environment_requires_rebuild(
        tmp_path,
        python,
        _runtime(),
        required_fingerprint="new-offline-lock",
    ) is True
    assert MODULE._environment_requires_rebuild(
        tmp_path,
        python,
        _runtime(),
        required_fingerprint="old-offline-lock",
    ) is False

def test_environment_stamp_is_versioned_json() -> None:
    stamp = MODULE.EnvironmentStamp(MODULE.STAMP_FORMAT, "abc123", _runtime())
    payload = json.loads(stamp.to_json())
    assert payload == {
        "format": MODULE.STAMP_FORMAT,
        "environment_fingerprint": "abc123",
        "runtime": {
            "cache_tag": "cpython-313",
            "implementation": "cpython",
            "machine": "x86_64",
            "major": 3,
            "minor": 13,
            "system": "Linux",
        },
    }


def test_expected_pins_include_all_test_runner_dependencies() -> None:
    expected = MODULE.expected_pinned_distributions(platform="posix")
    assert expected == {
        "PyMuPDF": "1.28.0",
        "Pillow": "12.3.0",
        "pytest": "9.1.1",
        "iniconfig": "2.3.0",
        "packaging": "26.2",
        "pluggy": "1.6.0",
        "Pygments": "2.20.0",
        "ruff": "0.16.1",
        "mypy": "2.3.0",
    }
    assert MODULE.expected_pinned_distributions(platform="nt")["colorama"] == "0.4.6"
