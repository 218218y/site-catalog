#!/usr/bin/env python3
"""Deterministic Linux x64 Python wheel mirror for project verification.

The mirror is generated from the project's pinned requirement roots, but resolves
all transitive dependencies into an exact, hash-locked wheel set.  It is a
cross-download profile: a Windows developer can refresh the Linux mirror and
send it with the repository, while Linux verification installs it with no
network access.
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile
from dataclasses import dataclass
from email.parser import BytesParser
from pathlib import Path
from typing import Final, Mapping, Sequence

from python_toolchain import PythonVersionBaseline, read_python_version_baseline

TARGET_OS: Final = "linux"
TARGET_ARCH: Final = "x64"
TARGET_IMPLEMENTATION: Final = "cp"
TARGET_GLIBC_MINIMUM: Final = (2, 28)
TARGET_GLIBC_TEXT: Final = "2.28"
MIRROR_SCHEMA_VERSION: Final = 1
MIRROR_ROOT: Final = Path("vendor/python")
LOCK_FILENAME: Final = "requirements.offline.lock.txt"
MANIFEST_FILENAME: Final = "manifest.json"
WHEELS_DIRECTORY_NAME: Final = "wheels"

# A conservative Linux target rather than the newest host glibc keeps the mirror
# portable across the chat/CI class of x64 glibc environments.  Repeating the
# compatible manylinux tags is intentional: pip cross-download accepts explicit
# target tags rather than synthesizing the full glibc compatibility ladder.
TARGET_PLATFORM_TAGS: Final = tuple(
    f"manylinux_2_{minor}_x86_64" for minor in range(TARGET_GLIBC_MINIMUM[1], 16, -1)
) + ("manylinux2014_x86_64",)

_REQUIREMENT_PIN_PATTERN: Final = re.compile(
    r"^(?P<name>[A-Za-z0-9][A-Za-z0-9._-]*)==(?P<version>[^\s;]+)(?:\s*;\s*(?P<marker>.+))?$"
)
_WINDOWS_MARKER_PATTERN: Final = re.compile(
    r"^sys_platform\s*(?P<operator>==|!=)\s*['\"]win32['\"]$"
)
_NORMALIZE_NAME_PATTERN: Final = re.compile(r"[-_.]+")


class PythonOfflineMirrorError(RuntimeError):
    """Raised when the Linux Python wheel mirror is missing or inconsistent."""


@dataclass(frozen=True)
class OfflineTarget:
    python_major: int
    python_minor: int

    @property
    def python_version(self) -> str:
        return f"{self.python_major}.{self.python_minor}"

    @property
    def cache_tag(self) -> str:
        return f"cpython-{self.python_major}{self.python_minor}"

    @property
    def profile_key(self) -> str:
        return f"{TARGET_OS}-{TARGET_ARCH}-cp{self.python_major}{self.python_minor}"

    def to_json(self) -> dict[str, object]:
        return {
            "architecture": TARGET_ARCH,
            "glibcMinimum": TARGET_GLIBC_TEXT,
            "implementation": TARGET_IMPLEMENTATION,
            "os": TARGET_OS,
            "pythonMajor": self.python_major,
            "pythonMinor": self.python_minor,
            "pythonVersion": self.python_version,
        }


@dataclass(frozen=True)
class RootRequirement:
    name: str
    version: str

    @property
    def normalized_name(self) -> str:
        return normalize_distribution_name(self.name)

    @property
    def requirement(self) -> str:
        return f"{self.name}=={self.version}"


@dataclass(frozen=True)
class WheelPackage:
    name: str
    version: str
    filename: str
    sha256: str
    size: int

    @property
    def normalized_name(self) -> str:
        return normalize_distribution_name(self.name)

    @property
    def requirement(self) -> str:
        return f"{self.name}=={self.version}"

    def to_json(self) -> dict[str, object]:
        return {
            "filename": self.filename,
            "name": self.name,
            "sha256": self.sha256,
            "size": self.size,
            "version": self.version,
        }


@dataclass(frozen=True)
class VerifiedPythonMirror:
    directory: Path
    wheels_directory: Path
    lock_path: Path
    target: OfflineTarget
    packages: tuple[WheelPackage, ...]

    @property
    def expected_versions(self) -> dict[str, str]:
        return {package.name: package.version for package in self.packages}


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def normalize_distribution_name(name: str) -> str:
    return _NORMALIZE_NAME_PATTERN.sub("-", name).lower()


def offline_target(root: Path) -> OfflineTarget:
    baseline = read_python_version_baseline(root)
    return OfflineTarget(baseline.major, baseline.minor)


def mirror_directory(root: Path, target: OfflineTarget | None = None) -> Path:
    selected = target or offline_target(root)
    return root / MIRROR_ROOT / selected.profile_key


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_json(value: object) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _marker_applies_to_linux(marker: str | None) -> bool:
    if marker is None:
        return True
    match = _WINDOWS_MARKER_PATTERN.fullmatch(marker.strip())
    if match is None:
        raise PythonOfflineMirrorError(
            "Unsupported environment marker in pinned Python requirements: "
            f"{marker!r}. Extend the explicit Linux marker contract before refreshing the mirror."
        )
    return match.group("operator") == "!="


def _read_requirement_file(
    path: Path,
    *,
    visited: set[Path],
    requirements: dict[str, RootRequirement],
) -> None:
    path = path.resolve()
    if path in visited:
        return
    if not path.is_file():
        raise PythonOfflineMirrorError(f"Missing Python requirements file: {path}")
    visited.add(path)

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("-r ") or line.startswith("--requirement "):
            _, include = line.split(maxsplit=1)
            _read_requirement_file(
                path.parent / include,
                visited=visited,
                requirements=requirements,
            )
            continue
        match = _REQUIREMENT_PIN_PATTERN.fullmatch(line)
        if match is None:
            raise PythonOfflineMirrorError(
                f"Offline Python roots must be exact 'name==version' pins; unsupported line in {path}: {line!r}"
            )
        if not _marker_applies_to_linux(match.group("marker")):
            continue
        requirement = RootRequirement(match.group("name"), match.group("version"))
        key = requirement.normalized_name
        previous = requirements.get(key)
        if previous is not None and previous.version != requirement.version:
            raise PythonOfflineMirrorError(
                f"Conflicting pinned versions for {requirement.name}: "
                f"{previous.version} and {requirement.version}"
            )
        requirements[key] = requirement


def target_root_requirements(root: Path) -> tuple[RootRequirement, ...]:
    requirements: dict[str, RootRequirement] = {}
    _read_requirement_file(
        root / "tools" / "requirements-dev.txt",
        visited=set(),
        requirements=requirements,
    )
    return tuple(requirements[key] for key in sorted(requirements))


def profile_lock_payload(root: Path, target: OfflineTarget | None = None) -> dict[str, object]:
    selected = target or offline_target(root)
    return {
        "roots": [requirement.requirement for requirement in target_root_requirements(root)],
        "target": selected.to_json(),
    }


def profile_lock_sha256(root: Path, target: OfflineTarget | None = None) -> str:
    return sha256_json(profile_lock_payload(root, target))


def _wheel_metadata(path: Path) -> tuple[str, str]:
    try:
        with zipfile.ZipFile(path) as archive:
            metadata_names = [
                name for name in archive.namelist() if name.endswith(".dist-info/METADATA")
            ]
            if len(metadata_names) != 1:
                raise PythonOfflineMirrorError(
                    f"Wheel {path.name} must contain exactly one .dist-info/METADATA file."
                )
            message = BytesParser().parsebytes(archive.read(metadata_names[0]))
    except (OSError, zipfile.BadZipFile, KeyError) as error:
        raise PythonOfflineMirrorError(f"Cannot inspect wheel metadata: {path}") from error
    name = message.get("Name")
    version = message.get("Version")
    if not isinstance(name, str) or not name.strip():
        raise PythonOfflineMirrorError(f"Wheel {path.name} has no valid Name metadata.")
    if not isinstance(version, str) or not version.strip():
        raise PythonOfflineMirrorError(f"Wheel {path.name} has no valid Version metadata.")
    return name.strip(), version.strip()


def inspect_wheels(wheels_directory: Path) -> tuple[WheelPackage, ...]:
    if not wheels_directory.is_dir():
        raise PythonOfflineMirrorError(f"Missing Python wheel directory: {wheels_directory}")
    unexpected = sorted(path.name for path in wheels_directory.iterdir() if path.suffix != ".whl")
    if unexpected:
        raise PythonOfflineMirrorError(
            "Python offline mirror contains non-wheel files: " + ", ".join(unexpected)
        )
    wheel_paths = sorted(wheels_directory.glob("*.whl"))
    if not wheel_paths:
        raise PythonOfflineMirrorError(f"Python offline mirror contains no wheels: {wheels_directory}")

    packages: list[WheelPackage] = []
    seen: dict[str, str] = {}
    for path in wheel_paths:
        name, version = _wheel_metadata(path)
        normalized = normalize_distribution_name(name)
        previous = seen.get(normalized)
        if previous is not None:
            raise PythonOfflineMirrorError(
                f"Python offline mirror contains multiple wheels for {name}: {previous}, {path.name}"
            )
        seen[normalized] = path.name
        packages.append(
            WheelPackage(
                name=name,
                version=version,
                filename=path.name,
                sha256=sha256_file(path),
                size=path.stat().st_size,
            )
        )
    return tuple(sorted(packages, key=lambda package: package.normalized_name))


def render_offline_lock(packages: Sequence[WheelPackage]) -> str:
    lines = [
        "# Generated by tools/sync_python_offline_linux.py; do not edit by hand.",
        "# Exact resolved Linux wheel set with sha256 hashes.",
    ]
    for package in sorted(packages, key=lambda item: item.normalized_name):
        lines.append(f"{package.requirement} --hash=sha256:{package.sha256}")
    return "\n".join(lines) + "\n"


def _manifest_payload(
    root: Path,
    target: OfflineTarget,
    packages: Sequence[WheelPackage],
    lock_path: Path,
) -> dict[str, object]:
    roots = target_root_requirements(root)
    return {
        "schemaVersion": MIRROR_SCHEMA_VERSION,
        "profile": "verification-linux",
        "profileLockSha256": profile_lock_sha256(root, target),
        "target": target.to_json(),
        "rootRequirements": [requirement.requirement for requirement in roots],
        "packageCount": len(packages),
        "lockFile": LOCK_FILENAME,
        "lockSha256": sha256_file(lock_path),
        "packages": [package.to_json() for package in packages],
    }


def _load_json_object(path: Path) -> dict[str, object]:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise PythonOfflineMirrorError(f"Cannot read Python offline manifest: {path}") from error
    if not isinstance(payload, dict):
        raise PythonOfflineMirrorError(f"Python offline manifest is not a JSON object: {path}")
    return payload


def _manifest_packages(payload: Mapping[str, object]) -> tuple[dict[str, object], ...]:
    raw_packages = payload.get("packages")
    if not isinstance(raw_packages, list):
        raise PythonOfflineMirrorError("Python offline manifest has no valid packages array.")
    packages: list[dict[str, object]] = []
    for item in raw_packages:
        if not isinstance(item, dict):
            raise PythonOfflineMirrorError("Python offline manifest contains an invalid package record.")
        packages.append(item)
    return tuple(packages)


def _verify_root_requirements(
    root: Path,
    packages: Sequence[WheelPackage],
) -> None:
    by_name = {package.normalized_name: package for package in packages}
    for requirement in target_root_requirements(root):
        package = by_name.get(requirement.normalized_name)
        if package is None:
            raise PythonOfflineMirrorError(
                f"Python offline mirror is missing root requirement {requirement.requirement}."
            )
        if package.version != requirement.version:
            raise PythonOfflineMirrorError(
                f"Python offline mirror has {package.name}=={package.version}; "
                f"expected {requirement.requirement}."
            )


def verify_mirror(
    root: Path,
    *,
    directory: Path | None = None,
) -> VerifiedPythonMirror:
    root = root.resolve()
    target = offline_target(root)
    mirror = (directory or mirror_directory(root, target)).resolve()
    manifest_path = mirror / MANIFEST_FILENAME
    lock_path = mirror / LOCK_FILENAME
    wheels_directory = mirror / WHEELS_DIRECTORY_NAME
    manifest = _load_json_object(manifest_path)

    if manifest.get("schemaVersion") != MIRROR_SCHEMA_VERSION:
        raise PythonOfflineMirrorError(
            f"Python offline manifest schema is stale; expected {MIRROR_SCHEMA_VERSION}."
        )
    if manifest.get("profile") != "verification-linux":
        raise PythonOfflineMirrorError("Python offline manifest has the wrong profile name.")
    if manifest.get("target") != target.to_json():
        raise PythonOfflineMirrorError(
            f"Python offline mirror target does not match {target.profile_key}."
        )
    expected_profile_hash = profile_lock_sha256(root, target)
    if manifest.get("profileLockSha256") != expected_profile_hash:
        raise PythonOfflineMirrorError(
            "Python offline mirror is stale for the current pinned requirements or Python baseline. "
            "Run 'npm run update:python:offline:linux'."
        )
    if not lock_path.is_file():
        raise PythonOfflineMirrorError(f"Python offline lock is missing: {lock_path}")
    if manifest.get("lockFile") != LOCK_FILENAME or manifest.get("lockSha256") != sha256_file(lock_path):
        raise PythonOfflineMirrorError("Python offline lock hash does not match its manifest.")

    packages = inspect_wheels(wheels_directory)
    if manifest.get("packageCount") != len(packages):
        raise PythonOfflineMirrorError("Python offline manifest package count does not match the wheel set.")
    expected_records = [package.to_json() for package in packages]
    if list(_manifest_packages(manifest)) != expected_records:
        raise PythonOfflineMirrorError("Python offline manifest package records do not match the wheel set.")
    expected_lock = render_offline_lock(packages)
    try:
        actual_lock = lock_path.read_text(encoding="utf-8")
    except OSError as error:
        raise PythonOfflineMirrorError(f"Cannot read Python offline lock: {lock_path}") from error
    if actual_lock != expected_lock:
        raise PythonOfflineMirrorError("Python offline lock content does not match the verified wheel set.")
    _verify_root_requirements(root, packages)

    return VerifiedPythonMirror(
        directory=mirror,
        wheels_directory=wheels_directory,
        lock_path=lock_path,
        target=target,
        packages=packages,
    )


def _target_requirements_text(root: Path) -> str:
    lines = [
        "# Generated target roots for the Linux offline resolver.",
        *(requirement.requirement for requirement in target_root_requirements(root)),
    ]
    return "\n".join(lines) + "\n"


def pip_download_command(
    requirements_path: Path,
    wheels_directory: Path,
    target: OfflineTarget,
    *,
    python: Path | str = sys.executable,
) -> tuple[str, ...]:
    command = [
        str(python),
        "-m",
        "pip",
        "download",
        "--disable-pip-version-check",
        "--only-binary=:all:",
        "--implementation",
        TARGET_IMPLEMENTATION,
        "--python-version",
        target.python_version,
    ]
    for platform_tag in TARGET_PLATFORM_TAGS:
        command.extend(("--platform", platform_tag))
    command.extend(("--dest", str(wheels_directory), "--requirement", str(requirements_path)))
    return tuple(command)


def _replace_directory(target: Path, replacement: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".python-offline-backup-", dir=target.parent) as backup_name:
        backup = Path(backup_name) / "mirror"
        moved_existing = False
        try:
            if target.exists():
                os.replace(target, backup)
                moved_existing = True
            os.replace(replacement, target)
        except Exception:
            if target.exists():
                shutil.rmtree(target)
            if moved_existing and backup.exists():
                os.replace(backup, target)
            raise


def sync_mirror(
    root: Path,
    *,
    python: Path | str = sys.executable,
) -> VerifiedPythonMirror:
    root = root.resolve()
    target = offline_target(root)
    destination = mirror_directory(root, target)
    destination.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix=".python-offline-stage-", dir=destination.parent) as stage_name:
        staging_parent = Path(stage_name)
        stage = staging_parent / target.profile_key
        wheels_directory = stage / WHEELS_DIRECTORY_NAME
        wheels_directory.mkdir(parents=True)
        target_requirements = staging_parent / "requirements.target.txt"
        target_requirements.write_text(_target_requirements_text(root), encoding="utf-8")

        completed = subprocess.run(
            pip_download_command(target_requirements, wheels_directory, target, python=python),
            cwd=root,
            check=False,
        )
        if completed.returncode:
            raise PythonOfflineMirrorError(
                "pip could not resolve/download the complete Linux wheel profile "
                f"(exit code {completed.returncode})."
            )

        packages = inspect_wheels(wheels_directory)
        _verify_root_requirements(root, packages)
        lock_path = stage / LOCK_FILENAME
        lock_path.write_text(render_offline_lock(packages), encoding="utf-8")
        manifest_path = stage / MANIFEST_FILENAME
        manifest_path.write_text(
            json.dumps(
                _manifest_payload(root, target, packages, lock_path),
                ensure_ascii=False,
                sort_keys=True,
                indent=2,
            )
            + "\n",
            encoding="utf-8",
        )
        verify_mirror(root, directory=stage)
        _replace_directory(destination, stage)

    return verify_mirror(root)


def glibc_version_at_least(actual: str, minimum: tuple[int, int] = TARGET_GLIBC_MINIMUM) -> bool:
    match = re.match(r"^(?P<major>[0-9]+)\.(?P<minor>[0-9]+)", actual.strip())
    if match is None:
        return False
    return (int(match.group("major")), int(match.group("minor"))) >= minimum


def require_install_host(
    baseline: PythonVersionBaseline,
    *,
    system: str,
    machine: str,
    implementation: str,
    major: int,
    minor: int,
    libc_name: str,
    libc_version: str,
) -> None:
    normalized_machine = machine.lower().replace("-", "_")
    architecture = "x64" if normalized_machine in {"x86_64", "amd64", "x64"} else normalized_machine
    if system.lower() != TARGET_OS or architecture != TARGET_ARCH:
        raise PythonOfflineMirrorError(
            f"The Python offline mirror installs only on Linux x64; detected {system}/{machine}."
        )
    if implementation.lower() != "cpython" or (major, minor) != (baseline.major, baseline.minor):
        raise PythonOfflineMirrorError(
            "The Python offline mirror is tied to the baseline CPython runtime "
            f"{baseline.text}; detected {implementation} {major}.{minor}."
        )
    if libc_name.lower() not in {"glibc", "gnu libc"} or not glibc_version_at_least(libc_version):
        raise PythonOfflineMirrorError(
            f"The Python offline mirror requires glibc {TARGET_GLIBC_TEXT}+; "
            f"detected {libc_name or 'unknown'} {libc_version or 'unknown'}."
        )


def offline_pip_install_command(
    python: Path | str,
    mirror: VerifiedPythonMirror,
) -> tuple[str, ...]:
    return (
        str(python),
        "-m",
        "pip",
        "install",
        "--disable-pip-version-check",
        "--no-index",
        "--only-binary=:all:",
        "--require-hashes",
        "--find-links",
        str(mirror.wheels_directory),
        "--requirement",
        str(mirror.lock_path),
    )
