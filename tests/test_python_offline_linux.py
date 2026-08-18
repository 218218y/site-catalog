from __future__ import annotations

import importlib.util
import json
import sys
import zipfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location(
    "python_offline_linux",
    TOOLS / "python_offline_linux.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def _write_inputs(root: Path, *, pillow: str = "12.3.0") -> None:
    tools = root / "tools"
    tools.mkdir(parents=True, exist_ok=True)
    (root / ".python-version").write_text("3.13\n", encoding="utf-8")
    (tools / "requirements.txt").write_text(f"Pillow=={pillow}\n", encoding="utf-8")
    (tools / "requirements-dev.txt").write_text(
        "-r requirements.txt\n"
        "pytest==9.1.1\n"
        'colorama==0.4.6; sys_platform == "win32"\n',
        encoding="utf-8",
    )


def _write_wheel(directory: Path, name: str, version: str) -> Path:
    normalized = name.replace("-", "_")
    wheel = directory / f"{normalized}-{version}-py3-none-any.whl"
    dist_info = f"{normalized}-{version}.dist-info"
    with zipfile.ZipFile(wheel, "w") as archive:
        archive.writestr(
            f"{dist_info}/METADATA",
            f"Metadata-Version: 2.1\nName: {name}\nVersion: {version}\n\n",
        )
        archive.writestr(
            f"{dist_info}/WHEEL",
            "Wheel-Version: 1.0\nGenerator: test\nRoot-Is-Purelib: true\nTag: py3-none-any\n",
        )
    return wheel


def _write_valid_mirror(root: Path) -> Path:
    target = MODULE.offline_target(root)
    mirror = MODULE.mirror_directory(root, target)
    wheels = mirror / MODULE.WHEELS_DIRECTORY_NAME
    wheels.mkdir(parents=True, exist_ok=True)
    _write_wheel(wheels, "Pillow", "12.3.0")
    _write_wheel(wheels, "pytest", "9.1.1")
    _write_wheel(wheels, "pluggy", "1.6.0")
    packages = MODULE.inspect_wheels(wheels)
    lock_path = mirror / MODULE.LOCK_FILENAME
    lock_path.write_text(MODULE.render_offline_lock(packages), encoding="utf-8")
    manifest = MODULE._manifest_payload(root, target, packages, lock_path)
    (mirror / MODULE.MANIFEST_FILENAME).write_text(
        json.dumps(manifest, sort_keys=True, indent=2) + "\n",
        encoding="utf-8",
    )
    return mirror


def test_linux_root_requirements_are_semantic_and_exclude_windows_only_marker(tmp_path: Path) -> None:
    _write_inputs(tmp_path)
    requirements = MODULE.target_root_requirements(tmp_path)
    assert [item.requirement for item in requirements] == [
        "Pillow==12.3.0",
        "pytest==9.1.1",
    ]

    first = MODULE.profile_lock_sha256(tmp_path)
    with (tmp_path / "tools" / "requirements-dev.txt").open("a", encoding="utf-8") as output:
        output.write("# comment-only change\n")
    assert MODULE.profile_lock_sha256(tmp_path) == first

    _write_inputs(tmp_path, pillow="12.4.0")
    assert MODULE.profile_lock_sha256(tmp_path) != first


def test_unknown_requirement_marker_fails_closed(tmp_path: Path) -> None:
    _write_inputs(tmp_path)
    (tmp_path / "tools" / "requirements-dev.txt").write_text(
        'pytest==9.1.1; python_version >= "3.13"\n',
        encoding="utf-8",
    )
    with pytest.raises(MODULE.PythonOfflineMirrorError, match="Unsupported environment marker"):
        MODULE.target_root_requirements(tmp_path)


def test_download_command_is_binary_only_cross_platform_linux_profile(tmp_path: Path) -> None:
    _write_inputs(tmp_path)
    target = MODULE.offline_target(tmp_path)
    command = MODULE.pip_download_command(
        tmp_path / "requirements.target.txt",
        tmp_path / "wheels",
        target,
        python="python-host",
    )
    assert command[:4] == ("python-host", "-m", "pip", "download")
    assert "--only-binary=:all:" in command
    assert ("--implementation", "cp") == command[
        command.index("--implementation") : command.index("--implementation") + 2
    ]
    assert command[command.index("--python-version") + 1] == "3.13"
    assert "manylinux_2_28_x86_64" in command
    assert "linux_x86_64" not in command


def test_verified_mirror_is_hash_locked_and_detects_tampering(tmp_path: Path) -> None:
    _write_inputs(tmp_path)
    mirror_path = _write_valid_mirror(tmp_path)
    verified = MODULE.verify_mirror(tmp_path)
    assert verified.directory == mirror_path.resolve()
    assert {package.requirement for package in verified.packages} == {
        "Pillow==12.3.0",
        "pluggy==1.6.0",
        "pytest==9.1.1",
    }
    assert all("--hash=sha256:" in line for line in verified.lock_path.read_text().splitlines()[2:])

    wheel = next(verified.wheels_directory.glob("Pillow-*.whl"))
    with wheel.open("ab") as output:
        output.write(b"tampered")
    with pytest.raises(MODULE.PythonOfflineMirrorError, match="package records"):
        MODULE.verify_mirror(tmp_path)


def test_install_host_contract_rejects_wrong_platform_runtime_or_old_glibc() -> None:
    baseline = MODULE.PythonVersionBaseline(3, 13)
    MODULE.require_install_host(
        baseline,
        system="Linux",
        machine="x86_64",
        implementation="cpython",
        major=3,
        minor=13,
        libc_name="glibc",
        libc_version="2.41",
    )
    with pytest.raises(MODULE.PythonOfflineMirrorError, match="Linux x64"):
        MODULE.require_install_host(
            baseline,
            system="Windows",
            machine="AMD64",
            implementation="cpython",
            major=3,
            minor=13,
            libc_name="",
            libc_version="",
        )
    with pytest.raises(MODULE.PythonOfflineMirrorError, match="baseline CPython"):
        MODULE.require_install_host(
            baseline,
            system="Linux",
            machine="x86_64",
            implementation="cpython",
            major=3,
            minor=14,
            libc_name="glibc",
            libc_version="2.41",
        )
    with pytest.raises(MODULE.PythonOfflineMirrorError, match="glibc 2.28"):
        MODULE.require_install_host(
            baseline,
            system="Linux",
            machine="x86_64",
            implementation="cpython",
            major=3,
            minor=13,
            libc_name="glibc",
            libc_version="2.27",
        )


def test_offline_install_command_disables_indexes_and_requires_hashes(tmp_path: Path) -> None:
    _write_inputs(tmp_path)
    _write_valid_mirror(tmp_path)
    mirror = MODULE.verify_mirror(tmp_path)
    command = MODULE.offline_pip_install_command(".venv/bin/python", mirror)
    assert command[:4] == (".venv/bin/python", "-m", "pip", "install")
    assert "--no-index" in command
    assert "--only-binary=:all:" in command
    assert "--require-hashes" in command
    assert command[command.index("--find-links") + 1] == str(mirror.wheels_directory)


def test_sync_mirror_is_atomic_and_replaces_only_after_complete_resolution(
    tmp_path: Path,
    monkeypatch,
) -> None:
    _write_inputs(tmp_path)
    existing = _write_valid_mirror(tmp_path)
    old_manifest = (existing / MODULE.MANIFEST_FILENAME).read_bytes()

    def failed_download(command, cwd, check):
        return MODULE.subprocess.CompletedProcess(command, 1)

    monkeypatch.setattr(MODULE.subprocess, "run", failed_download)
    with pytest.raises(MODULE.PythonOfflineMirrorError, match="could not resolve/download"):
        MODULE.sync_mirror(tmp_path, python="python-host")
    assert (existing / MODULE.MANIFEST_FILENAME).read_bytes() == old_manifest
    MODULE.verify_mirror(tmp_path)

    def successful_download(command, cwd, check):
        destination = Path(command[command.index("--dest") + 1])
        _write_wheel(destination, "Pillow", "12.3.0")
        _write_wheel(destination, "pytest", "9.1.1")
        _write_wheel(destination, "pluggy", "1.7.0")
        return MODULE.subprocess.CompletedProcess(command, 0)

    monkeypatch.setattr(MODULE.subprocess, "run", successful_download)
    refreshed = MODULE.sync_mirror(tmp_path, python="python-host")
    assert {package.requirement for package in refreshed.packages} == {
        "Pillow==12.3.0",
        "pluggy==1.7.0",
        "pytest==9.1.1",
    }
    assert (refreshed.directory / MODULE.MANIFEST_FILENAME).read_bytes() != old_manifest
