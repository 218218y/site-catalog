#!/usr/bin/env python3
"""Verified Linux wheelhouse support for the project's Python test toolchain.

The repository already has an npm mirror for chat/Linux checks. This module adds
matching Python dependency checks around ``vendor/python/linux-x64-glibc`` while
keeping Windows on the normal pip path.
"""
from __future__ import annotations

import hashlib
import json
import os
import platform
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Final, Iterable, Sequence

TARGET_OS: Final = "linux"
TARGET_CPU: Final = "x64"
TARGET_LIBC: Final = "glibc"
TARGET_KEY: Final = "linux-x64-glibc"
MIRROR_DIRECTORY: Final = Path("vendor/python") / TARGET_KEY
WHEELHOUSE_DIRECTORY: Final = MIRROR_DIRECTORY / "wheels"
MANIFEST_PATH: Final = MIRROR_DIRECTORY / "manifest.json"
MANIFEST_SCHEMA_VERSION: Final = 1
DOWNLOAD_USER_AGENT: Final = "site-catalog-python-offline-wheelhouse/1"
WHEELHOUSE_STAGE_PREFIX: Final = ".python-offline-wheelhouse-"
_REQUIREMENT_PATTERN: Final = re.compile(
    r"^\s*([A-Za-z0-9][A-Za-z0-9._-]*)\s*==\s*([^\s;]+)\s*(?:;\s*(.+))?$"
)


class PythonOfflineMirrorError(RuntimeError):
    """Raised when the Python offline wheelhouse is invalid or incomplete."""


@dataclass(frozen=True)
class HostIdentity:
    system: str
    architecture: str
    libc: str

    @property
    def key(self) -> str:
        return f"{self.system}/{self.architecture}/{self.libc or 'unknown'}"


@dataclass(frozen=True)
class PythonRequirement:
    name: str
    version: str
    source: str

    @property
    def normalized_name(self) -> str:
        return normalize_distribution_name(self.name)

    @property
    def requirement_string(self) -> str:
        return f"{self.name}=={self.version}"


@dataclass(frozen=True)
class WheelIdentity:
    name: str
    version: str
    filename: str

    @property
    def normalized_name(self) -> str:
        return normalize_distribution_name(self.name)


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def normalize_distribution_name(value: str) -> str:
    return re.sub(r"[-_.]+", "-", value).lower()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def detect_host() -> HostIdentity:
    system = platform.system().lower()
    machine = platform.machine().lower().replace("-", "_")
    architecture = "x64" if machine in {"x86_64", "amd64", "x64"} else machine
    libc_name, _ = platform.libc_ver()
    libc = "glibc" if libc_name.lower() in {"glibc", "gnu libc"} else libc_name.lower()
    return HostIdentity(system=system, architecture=architecture, libc=libc)


def is_target_host() -> bool:
    host = detect_host()
    return (host.system, host.architecture, host.libc) == (TARGET_OS, TARGET_CPU, TARGET_LIBC)


def verify_target_host() -> None:
    if is_target_host():
        return
    host = detect_host()
    raise PythonOfflineMirrorError(
        "The offline Python install is intentionally limited to the chat target "
        f"{TARGET_OS}/{TARGET_CPU}/{TARGET_LIBC}; detected {host.key}."
    )


def requirement_files(root: Path) -> tuple[Path, ...]:
    return (root / "tools" / "requirements.txt", root / "tools" / "requirements-dev.txt")


def requirements_fingerprint(root: Path) -> str:
    digest = hashlib.sha256()
    for path in requirement_files(root):
        if not path.is_file():
            raise PythonOfflineMirrorError(f"Missing Python requirements file: {path}")
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _strip_inline_comment(line: str) -> str:
    # Requirements in this project are intentionally simple. Keep URL/hash
    # handling out of the offline bootstrap so additions must be explicit.
    return line.split("#", 1)[0].strip()


def _marker_applies_to_linux(marker: str | None) -> bool:
    if marker is None or not marker.strip():
        return True
    normalized = " ".join(marker.replace('"', "'").split())
    if normalized == "sys_platform == 'win32'":
        return False
    if normalized == "sys_platform != 'win32'":
        return True
    if normalized == "sys_platform == 'linux'":
        return True
    if normalized == "sys_platform != 'linux'":
        return False
    raise PythonOfflineMirrorError(f"Unsupported requirement marker for offline Linux mirror: {marker!r}")


def _parse_requirements_file(path: Path, *, root: Path, seen: set[Path]) -> tuple[PythonRequirement, ...]:
    resolved = path.resolve()
    if resolved in seen:
        return ()
    seen.add(resolved)
    if not path.is_file():
        raise PythonOfflineMirrorError(f"Missing Python requirements file: {path}")

    requirements: list[PythonRequirement] = []
    for line_number, raw_line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = _strip_inline_comment(raw_line)
        if not line:
            continue
        if line.startswith("-r ") or line.startswith("--requirement "):
            _, include = line.split(maxsplit=1)
            include_path = (path.parent / include).resolve()
            if root.resolve() not in include_path.parents and include_path != root.resolve():
                raise PythonOfflineMirrorError(f"Requirement include escapes the project: {include}")
            requirements.extend(_parse_requirements_file(include_path, root=root, seen=seen))
            continue
        match = _REQUIREMENT_PATTERN.match(line)
        if not match:
            relative = path.relative_to(root).as_posix() if path.is_relative_to(root) else path.as_posix()
            raise PythonOfflineMirrorError(
                f"Unsupported Python requirement in {relative}:{line_number}: {raw_line!r}; "
                "offline Linux packages must be pinned with name==version."
            )
        name, version, marker = match.groups()
        if _marker_applies_to_linux(marker):
            relative = path.relative_to(root).as_posix() if path.is_relative_to(root) else path.as_posix()
            requirements.append(PythonRequirement(name=name, version=version, source=f"{relative}:{line_number}"))
    return tuple(requirements)


def expected_direct_requirements(root: Path) -> tuple[PythonRequirement, ...]:
    requirements = _parse_requirements_file(root / "tools" / "requirements-dev.txt", root=root, seen=set())
    by_name: dict[str, PythonRequirement] = {}
    for requirement in requirements:
        existing = by_name.get(requirement.normalized_name)
        if existing and existing.version != requirement.version:
            raise PythonOfflineMirrorError(
                f"Conflicting pinned versions for {requirement.name}: "
                f"{existing.version} from {existing.source}, {requirement.version} from {requirement.source}."
            )
        by_name[requirement.normalized_name] = requirement
    return tuple(by_name[name] for name in sorted(by_name))


def _wheel_identity(path: Path) -> WheelIdentity | None:
    if path.suffix != ".whl":
        return None
    parts = path.name[:-4].split("-")
    if len(parts) < 5:
        return None
    name, version = parts[0], parts[1]
    return WheelIdentity(name=name, version=version, filename=path.name)


def _wheel_files(root: Path) -> tuple[Path, ...]:
    wheelhouse = root / WHEELHOUSE_DIRECTORY
    if not wheelhouse.is_dir():
        raise PythonOfflineMirrorError(
            f"Missing Python offline wheelhouse: {WHEELHOUSE_DIRECTORY.as_posix()}. "
            "Run `npm run update:python:offline:linux` on Linux with network access, "
            "commit the generated wheels, then retry in the chat environment."
        )
    return tuple(sorted(path for path in wheelhouse.iterdir() if path.is_file() and path.suffix == ".whl"))


def _matching_wheels(root: Path, requirement: PythonRequirement) -> tuple[Path, ...]:
    matches: list[Path] = []
    for path in _wheel_files(root):
        identity = _wheel_identity(path)
        if identity is None:
            continue
        if identity.normalized_name == requirement.normalized_name and identity.version == requirement.version:
            matches.append(path)
    return tuple(sorted(matches))


def _load_manifest(path: Path) -> dict[str, object] | None:
    if not path.is_file():
        return None
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise PythonOfflineMirrorError(f"Invalid Python offline manifest JSON: {path}") from error
    if not isinstance(manifest, dict):
        raise PythonOfflineMirrorError(f"Invalid Python offline manifest: {path}")
    return manifest


def verify_wheelhouse(root: Path) -> dict[str, object]:
    expected = expected_direct_requirements(root)
    wheels = _wheel_files(root)
    missing = [requirement.requirement_string for requirement in expected if not _matching_wheels(root, requirement)]
    if missing:
        raise PythonOfflineMirrorError(
            "Python offline wheelhouse is incomplete; missing direct wheels for: " + ", ".join(missing)
        )

    wheel_records = [
        {
            "filename": path.name,
            "sha256": sha256_file(path),
        }
        for path in wheels
    ]
    manifest_path = root / MANIFEST_PATH
    recorded = _load_manifest(manifest_path)
    if recorded is not None:
        recorded_hashes = {
            str(item.get("filename")): str(item.get("sha256"))
            for item in recorded.get("wheels", [])
            if isinstance(item, dict)
        }
        for record in wheel_records:
            filename = str(record["filename"])
            expected_hash = recorded_hashes.get(filename)
            if expected_hash is not None and expected_hash != record["sha256"]:
                raise PythonOfflineMirrorError(f"Python offline wheel hash changed for {filename}.")

    return {
        "schemaVersion": MANIFEST_SCHEMA_VERSION,
        "target": TARGET_KEY,
        "requirementsFingerprint": requirements_fingerprint(root),
        "directRequirements": [requirement.requirement_string for requirement in expected],
        "wheelCount": len(wheel_records),
        "wheels": wheel_records,
    }


def _pip_environment() -> dict[str, str]:
    environment = os.environ.copy()
    environment.update(
        {
            "PIP_DISABLE_PIP_VERSION_CHECK": "1",
            "PIP_NO_INPUT": "1",
            "PIP_USER_AGENT_USER_DATA": json.dumps({"source": DOWNLOAD_USER_AGENT}),
        }
    )
    return environment


def sync_wheelhouse(root: Path, *, python: str | Path = sys.executable) -> dict[str, object]:
    verify_target_host()
    root = root.resolve()
    target = root / WHEELHOUSE_DIRECTORY
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=WHEELHOUSE_STAGE_PREFIX, dir=target.parent) as stage_name:
        stage = Path(stage_name)
        command = [
            str(python),
            "-m",
            "pip",
            "download",
            "--disable-pip-version-check",
            "--only-binary=:all:",
            "--dest",
            str(stage),
            "-r",
            str(root / "tools" / "requirements-dev.txt"),
        ]
        subprocess.run(command, cwd=root, env=_pip_environment(), check=True)
        if target.exists():
            shutil.rmtree(target)
        os.replace(stage, target)
    manifest = verify_wheelhouse(root)
    (root / MANIFEST_PATH).write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return manifest


def install_arguments(root: Path) -> tuple[str, ...]:
    """Return pip arguments for installing from the verified Linux wheelhouse."""
    verify_target_host()
    verify_wheelhouse(root)
    return (
        "--no-index",
        "--find-links",
        str((root / WHEELHOUSE_DIRECTORY).resolve()),
        "-r",
        str(root / "tools" / "requirements-dev.txt"),
    )


def has_wheelhouse(root: Path) -> bool:
    return (root / WHEELHOUSE_DIRECTORY).is_dir()
