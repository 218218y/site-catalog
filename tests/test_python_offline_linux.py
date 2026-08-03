from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"

SPEC = importlib.util.spec_from_file_location("python_offline_linux", TOOLS / "python_offline_linux.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def copy_requirements(root: Path) -> None:
    tools = root / "tools"
    tools.mkdir()
    for name in ("requirements.txt", "requirements-dev.txt"):
        (tools / name).write_text((TOOLS / name).read_text(encoding="utf-8"), encoding="utf-8")


def write_direct_wheels(root: Path, *, omit: set[str] | None = None) -> None:
    wheelhouse = root / MODULE.WHEELHOUSE_DIRECTORY
    wheelhouse.mkdir(parents=True)
    omitted = omit or set()
    for requirement in MODULE.expected_direct_requirements(root):
        if requirement.normalized_name in omitted:
            continue
        filename = f"{requirement.name.replace('-', '_')}-{requirement.version}-py3-none-manylinux_2_28_x86_64.whl"
        (wheelhouse / filename).write_text(f"wheel fixture for {requirement.requirement_string}\n", encoding="utf-8")


def test_expected_direct_requirements_include_quality_tools_and_skip_windows_only_colorama(tmp_path: Path) -> None:
    copy_requirements(tmp_path)

    requirements = {item.requirement_string for item in MODULE.expected_direct_requirements(tmp_path)}

    assert "ruff==0.16.1" in requirements
    assert "mypy==2.3.0" in requirements
    assert "pytest==9.1.1" in requirements
    assert "PyMuPDF==1.28.0" in requirements
    assert not any(item.startswith("colorama==") for item in requirements)


def test_verified_wheelhouse_requires_direct_quality_and_runtime_wheels(tmp_path: Path) -> None:
    copy_requirements(tmp_path)
    write_direct_wheels(tmp_path)

    manifest = MODULE.verify_wheelhouse(tmp_path)

    assert manifest["target"] == MODULE.TARGET_KEY
    assert "ruff==0.16.1" in manifest["directRequirements"]
    assert "mypy==2.3.0" in manifest["directRequirements"]
    assert manifest["wheelCount"] == len(MODULE.expected_direct_requirements(tmp_path))


def test_wheelhouse_missing_ruff_is_rejected_before_pip_install(tmp_path: Path) -> None:
    copy_requirements(tmp_path)
    write_direct_wheels(tmp_path, omit={"ruff"})

    with pytest.raises(MODULE.PythonOfflineMirrorError, match="ruff==0.16.1"):
        MODULE.verify_wheelhouse(tmp_path)


def test_install_arguments_are_no_index_and_verified_for_linux_wheelhouse(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    copy_requirements(tmp_path)
    write_direct_wheels(tmp_path)
    monkeypatch.setattr(MODULE, "is_target_host", lambda: True)

    arguments = MODULE.install_arguments(tmp_path)

    assert arguments[:3] == ("--no-index", "--find-links", str((tmp_path / MODULE.WHEELHOUSE_DIRECTORY).resolve()))
    assert arguments[-2:] == ("-r", str(tmp_path / "tools" / "requirements-dev.txt"))


def test_offline_host_guard_rejects_non_linux_targets(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        MODULE,
        "detect_host",
        lambda: MODULE.HostIdentity(system="windows", architecture="x64", libc=""),
    )

    with pytest.raises(MODULE.PythonOfflineMirrorError, match="linux/x64/glibc"):
        MODULE.verify_target_host()
