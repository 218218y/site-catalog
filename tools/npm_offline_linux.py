#!/usr/bin/env python3
"""Lockfile-driven minimal npm mirror for Linux x64/glibc chat checks.

The canonical ``package-lock.json`` remains npm-managed. The chat profile starts
from direct project dependencies except the deployment-only ``wrangler`` root,
then follows the required dependency graph and platform-compatible optional
packages. Generated offline package/lock files use only repository-local
``file:`` tarball references.
"""
from __future__ import annotations

import base64
import copy
import hashlib
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Final, Iterable

TARGET_OS: Final = "linux"
TARGET_CPU: Final = "x64"
TARGET_LIBC: Final = "glibc"
TARGET_KEY: Final = "linux-x64-glibc"
MIRROR_DIRECTORY: Final = Path("vendor/npm") / TARGET_KEY
ARCHIVE_DIRECTORY: Final = MIRROR_DIRECTORY / "archives"
MANIFEST_PATH: Final = MIRROR_DIRECTORY / "manifest.json"
OFFLINE_LOCK_PATH: Final = MIRROR_DIRECTORY / "package-lock.offline.json"
OFFLINE_PACKAGE_PATH: Final = MIRROR_DIRECTORY / "package.offline.json"
MANIFEST_SCHEMA_VERSION: Final = 3
CHAT_PROFILE_NAME: Final = "chat-tests"
EXCLUDED_CHAT_ROOT_PACKAGES: Final = frozenset({"wrangler"})
ROOT_DEPENDENCY_FIELDS: Final = ("dependencies", "devDependencies", "optionalDependencies")
PACKAGE_DEPENDENCY_FIELDS: Final = ("dependencies", "optionalDependencies")
DOWNLOAD_USER_AGENT: Final = "site-catalog-offline-mirror/2"
LEGACY_MIRROR_DIRECTORIES: Final = (
    Path("vendor/npm/esbuild"),
    Path("vendor/npm/typescript"),
)
LEGACY_CACHE_DIRECTORY: Final = Path(".cache/npm-offline-linux")


class OfflineMirrorError(RuntimeError):
    """Raised when the lockfile or repository-local npm mirror is invalid."""


@dataclass(frozen=True)
class LockedPackage:
    install_path: str
    name: str
    version: str
    resolved: str | None
    integrity: str | None
    optional: bool

    @property
    def has_lock_archive_metadata(self) -> bool:
        return self.resolved is not None and self.integrity is not None

    # Kept as a compatibility alias for the focused esbuild/TypeScript tools.
    @property
    def has_archive(self) -> bool:
        return self.has_lock_archive_metadata


@dataclass(frozen=True)
class MirroredPackage:
    locked: LockedPackage
    archive_relative: Path
    integrity: str
    metadata_source: str


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sri_sha512(path: Path) -> str:
    digest = hashlib.sha512()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return "sha512-" + base64.b64encode(digest.digest()).decode("ascii")


def load_lockfile(root: Path) -> dict[str, object]:
    lock_path = root / "package-lock.json"
    try:
        value = json.loads(lock_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise OfflineMirrorError(f"Cannot read {lock_path}") from error
    if not isinstance(value, dict) or value.get("lockfileVersion") != 3:
        raise OfflineMirrorError("The npm offline mirror requires package-lock.json lockfileVersion 3.")
    packages = value.get("packages")
    if not isinstance(packages, dict):
        raise OfflineMirrorError("package-lock.json does not contain a valid packages map.")
    return value


def package_name_from_install_path(install_path: str) -> str:
    marker = "node_modules/"
    if marker not in install_path:
        raise OfflineMirrorError(f"Unsupported npm install path in lockfile: {install_path!r}")
    tail = install_path.rsplit(marker, 1)[1]
    parts = tail.split("/")
    if tail.startswith("@"):
        if len(parts) < 2:
            raise OfflineMirrorError(f"Invalid scoped package path in lockfile: {install_path!r}")
        return f"{parts[0]}/{parts[1]}"
    if not parts[0]:
        raise OfflineMirrorError(f"Invalid package path in lockfile: {install_path!r}")
    return parts[0]


def _constraint_matches(values: object, target: str) -> bool:
    if values is None:
        return True
    if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
        raise OfflineMirrorError(f"Invalid npm platform constraint: {values!r}")
    denied = {value[1:] for value in values if value.startswith("!")}
    allowed = {value for value in values if not value.startswith("!")}
    return target not in denied and (not allowed or target in allowed)


def is_target_compatible(metadata: dict[str, object]) -> bool:
    return (
        _constraint_matches(metadata.get("os"), TARGET_OS)
        and _constraint_matches(metadata.get("cpu"), TARGET_CPU)
        and _constraint_matches(metadata.get("libc"), TARGET_LIBC)
    )


def _dependency_maps(metadata: dict[str, object], fields: tuple[str, ...]) -> dict[str, dict[str, str]]:
    result: dict[str, dict[str, str]] = {}
    for field in fields:
        raw = metadata.get(field)
        if raw is None:
            continue
        if not isinstance(raw, dict) or not all(
            isinstance(name, str) and isinstance(version, str) for name, version in raw.items()
        ):
            raise OfflineMirrorError(f"Invalid npm {field} map in package-lock.json.")
        result[field] = dict(raw)
    return result


def selected_root_dependency_maps(root: Path) -> dict[str, dict[str, str]]:
    lock = load_lockfile(root)
    raw_packages = lock["packages"]
    assert isinstance(raw_packages, dict)
    root_metadata = raw_packages.get("")
    if not isinstance(root_metadata, dict):
        raise OfflineMirrorError("package-lock.json does not contain root package metadata.")
    selected: dict[str, dict[str, str]] = {}
    for field, dependencies in _dependency_maps(root_metadata, ROOT_DEPENDENCY_FIELDS).items():
        kept = {
            name: version
            for name, version in dependencies.items()
            if name not in EXCLUDED_CHAT_ROOT_PACKAGES
        }
        if kept:
            selected[field] = kept
    return selected


def selected_root_package_names(root: Path) -> tuple[str, ...]:
    names = {
        name
        for dependencies in selected_root_dependency_maps(root).values()
        for name in dependencies
    }
    return tuple(sorted(names))


def excluded_root_package_names(root: Path) -> tuple[str, ...]:
    lock = load_lockfile(root)
    raw_packages = lock["packages"]
    assert isinstance(raw_packages, dict)
    root_metadata = raw_packages.get("")
    if not isinstance(root_metadata, dict):
        raise OfflineMirrorError("package-lock.json does not contain root package metadata.")
    declared = {
        name
        for dependencies in _dependency_maps(root_metadata, ROOT_DEPENDENCY_FIELDS).values()
        for name in dependencies
    }
    return tuple(sorted(declared & EXCLUDED_CHAT_ROOT_PACKAGES))


def _dependency_install_path_candidates(parent_install_path: str, dependency_name: str) -> tuple[str, ...]:
    suffix = f"node_modules/{dependency_name}"
    bases = [parent_install_path]
    current = parent_install_path
    while "/node_modules/" in current:
        current = current.rsplit("/node_modules/", 1)[0]
        bases.append(current)
    bases.append("")
    candidates: list[str] = []
    for base in bases:
        candidate = f"{base}/{suffix}" if base else suffix
        if candidate not in candidates:
            candidates.append(candidate)
    return tuple(candidates)


def _resolve_dependency_install_path(
    raw_packages: dict[str, object],
    parent_install_path: str,
    dependency_name: str,
) -> str | None:
    for candidate in _dependency_install_path_candidates(parent_install_path, dependency_name):
        metadata = raw_packages.get(candidate)
        if isinstance(metadata, dict):
            return candidate
    return None


def _selected_install_paths(root: Path) -> tuple[str, ...]:
    lock = load_lockfile(root)
    raw_packages = lock["packages"]
    assert isinstance(raw_packages, dict)
    queue: list[tuple[str, str, bool]] = []
    for dependencies in selected_root_dependency_maps(root).values():
        for dependency_name in dependencies:
            queue.append(("", dependency_name, False))

    selected: set[str] = set()
    while queue:
        parent_install_path, dependency_name, optional = queue.pop(0)
        install_path = _resolve_dependency_install_path(raw_packages, parent_install_path, dependency_name)
        if install_path is None:
            if optional:
                continue
            raise OfflineMirrorError(
                f"Cannot resolve required dependency {dependency_name!r} from "
                f"{parent_install_path or 'the project root'} in package-lock.json."
            )
        metadata = raw_packages[install_path]
        assert isinstance(metadata, dict)
        if not is_target_compatible(metadata):
            if optional or metadata.get("optional") is True:
                continue
            raise OfflineMirrorError(
                f"Required dependency {install_path} is incompatible with {TARGET_KEY}."
            )
        if install_path in selected:
            continue
        selected.add(install_path)

        for field, dependencies in _dependency_maps(metadata, PACKAGE_DEPENDENCY_FIELDS).items():
            is_optional = field == "optionalDependencies"
            for child_name in dependencies:
                queue.append((install_path, child_name, is_optional))

        peers = metadata.get("peerDependencies")
        if peers is not None:
            if not isinstance(peers, dict) or not all(
                isinstance(name, str) and isinstance(version, str) for name, version in peers.items()
            ):
                raise OfflineMirrorError(f"Invalid peerDependencies for {install_path}.")
            peer_meta = metadata.get("peerDependenciesMeta")
            if peer_meta is not None and not isinstance(peer_meta, dict):
                raise OfflineMirrorError(f"Invalid peerDependenciesMeta for {install_path}.")
            for peer_name in peers:
                optional_peer = False
                if isinstance(peer_meta, dict):
                    raw_peer_meta = peer_meta.get(peer_name)
                    optional_peer = isinstance(raw_peer_meta, dict) and raw_peer_meta.get("optional") is True
                queue.append((install_path, peer_name, optional_peer))

    return tuple(sorted(selected))


def locked_packages(root: Path) -> tuple[LockedPackage, ...]:
    lock = load_lockfile(root)
    raw_packages = lock["packages"]
    assert isinstance(raw_packages, dict)
    selected: list[LockedPackage] = []
    for install_path in _selected_install_paths(root):
        raw_metadata = raw_packages.get(install_path)
        if not isinstance(raw_metadata, dict):
            raise OfflineMirrorError(f"Missing package metadata for {install_path}.")
        metadata = raw_metadata
        version = metadata.get("version")
        if not isinstance(version, str) or not version:
            raise OfflineMirrorError(f"Missing version for {install_path} in package-lock.json.")
        resolved = metadata.get("resolved")
        integrity = metadata.get("integrity")
        if resolved is not None and not isinstance(resolved, str):
            raise OfflineMirrorError(f"Invalid resolved URL for {install_path}.")
        if integrity is not None and not isinstance(integrity, str):
            raise OfflineMirrorError(f"Invalid integrity for {install_path}.")
        if (resolved is None) != (integrity is None):
            raise OfflineMirrorError(
                f"Incomplete archive metadata for {install_path}; resolved and integrity must appear together."
            )
        selected.append(
            LockedPackage(
                install_path=install_path,
                name=package_name_from_install_path(install_path),
                version=version,
                resolved=resolved,
                integrity=integrity,
                optional=metadata.get("optional") is True,
            )
        )
    return tuple(selected)

def locked_package(root: Path, install_path: str) -> LockedPackage:
    for package in locked_packages(root):
        if package.install_path == install_path:
            return package
    raise OfflineMirrorError(
        f"{install_path} is not present for the {TARGET_KEY} target in package-lock.json."
    )


def _safe_component(value: str, *, label: str) -> str:
    if value in {"", ".", ".."} or "/" in value or "\\" in value or "\x00" in value:
        raise OfflineMirrorError(f"Unsafe {label} in lockfile: {value!r}")
    return value


def canonical_archive_relative(package: LockedPackage) -> Path:
    version = _safe_component(package.version, label="package version")
    if package.name.startswith("@"):
        scope, basename = package.name.split("/", 1)
        return ARCHIVE_DIRECTORY / _safe_component(scope, label="package scope") / _safe_component(
            basename, label="package name"
        ) / f"{version}.tgz"
    return ARCHIVE_DIRECTORY / _safe_component(package.name, label="package name") / f"{version}.tgz"


def _safe_archive_member(member_name: str) -> PurePosixPath:
    member = PurePosixPath(member_name)
    if member.is_absolute() or any(part in {"", ".", ".."} for part in member.parts):
        raise OfflineMirrorError(f"Unsafe npm archive member: {member_name!r}")
    return member


def _read_json_member(bundle: tarfile.TarFile, member_name: str) -> dict[str, object]:
    try:
        member = bundle.getmember(member_name)
    except KeyError as error:
        raise OfflineMirrorError(f"Missing {member_name!r} in npm archive.") from error
    _safe_archive_member(member.name)
    if not member.isfile():
        raise OfflineMirrorError(f"Expected a regular file in npm archive: {member_name!r}")
    source = bundle.extractfile(member)
    if source is None:
        raise OfflineMirrorError(f"Cannot read {member_name!r} from npm archive.")
    try:
        with source:
            value = json.loads(source.read().decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise OfflineMirrorError(f"Invalid JSON in npm archive member {member_name!r}.") from error
    if not isinstance(value, dict):
        raise OfflineMirrorError(f"Invalid package metadata in npm archive member {member_name!r}.")
    return value


def verify_archive_identity(path: Path, package: LockedPackage, *, integrity: str | None = None) -> str:
    if not path.is_file():
        raise OfflineMirrorError(f"Missing offline archive: {path}")
    actual_integrity = sri_sha512(path)
    if integrity is not None and actual_integrity != integrity:
        raise OfflineMirrorError(
            f"Integrity check failed for {path}; expected {integrity}, received {actual_integrity}."
        )
    try:
        with tarfile.open(path, mode="r:gz") as bundle:
            metadata = _read_json_member(bundle, "package/package.json")
    except (OSError, tarfile.TarError) as error:
        raise OfflineMirrorError(f"Cannot read npm archive {path}.") from error
    if metadata.get("name") != package.name or metadata.get("version") != package.version:
        raise OfflineMirrorError(
            f"Archive identity mismatch for {path}: expected {package.name}@{package.version}, "
            f"received {metadata.get('name')!r}@{metadata.get('version')!r}."
        )
    return actual_integrity


def verify_archive(path: Path, package: LockedPackage) -> None:
    if not package.has_lock_archive_metadata or package.integrity is None:
        raise OfflineMirrorError(
            f"{package.name}@{package.version} has no lockfile integrity; verify it through the mirror manifest."
        )
    verify_archive_identity(path, package, integrity=package.integrity)


def _archive_candidates(root: Path) -> Iterable[Path]:
    vendor = root / "vendor/npm"
    if not vendor.is_dir():
        return ()
    return (path for path in vendor.rglob("*.tgz") if path.is_file() and not path.is_symlink())


def build_integrity_index(root: Path) -> dict[str, list[Path]]:
    index: dict[str, list[Path]] = {}
    for path in _archive_candidates(root):
        try:
            integrity = sri_sha512(path)
        except OSError:
            continue
        index.setdefault(integrity, []).append(path)
    for paths in index.values():
        paths.sort(key=lambda path: path.as_posix())
    return index


def locate_archive(root: Path, package: LockedPackage) -> Path:
    """Locate a lockfile-authenticated archive for focused bootstraps."""

    if not package.has_lock_archive_metadata or package.integrity is None:
        raise OfflineMirrorError(
            f"{package.name}@{package.version} has no standalone integrity in package-lock.json. "
            "Use the complete Linux mirror instead."
        )
    canonical = root / canonical_archive_relative(package)
    if canonical.is_file():
        verify_archive(canonical, package)
        return canonical
    for candidate in build_integrity_index(root).get(package.integrity, []):
        try:
            verify_archive(candidate, package)
        except OfflineMirrorError:
            continue
        return candidate
    raise OfflineMirrorError(
        f"Missing verified archive for {package.name}@{package.version}. "
        "Run `npm run update:offline:linux` while online."
    )


def extract_npm_archive(archive: Path, destination: Path) -> None:
    """Extract regular files below the npm ``package/`` root safely."""

    destination.mkdir(parents=True, exist_ok=False)
    try:
        with tarfile.open(archive, mode="r:gz") as bundle:
            for member in bundle.getmembers():
                member_path = _safe_archive_member(member.name)
                if not member_path.parts or member_path.parts[0] != "package":
                    raise OfflineMirrorError(f"Unexpected npm archive root: {member.name!r}")
                relative_parts = member_path.parts[1:]
                if not relative_parts:
                    continue
                target = destination.joinpath(*relative_parts)
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                if not member.isfile():
                    raise OfflineMirrorError(
                        f"Unsupported link or special file in {archive.name}: {member.name!r}"
                    )
                source = bundle.extractfile(member)
                if source is None:
                    raise OfflineMirrorError(f"Cannot read {member.name!r} from {archive.name}")
                target.parent.mkdir(parents=True, exist_ok=True)
                with source, target.open("wb") as output:
                    shutil.copyfileobj(source, output)
                if os.name != "nt":
                    target.chmod(member.mode & 0o777)
    except Exception:
        shutil.rmtree(destination, ignore_errors=True)
        raise


def directory_matches_archive(archive: Path, directory: Path) -> bool:
    expected: dict[PurePosixPath, str] = {}
    try:
        with tarfile.open(archive, mode="r:gz") as bundle:
            for member in bundle.getmembers():
                member_path = _safe_archive_member(member.name)
                if not member_path.parts or member_path.parts[0] != "package":
                    return False
                relative_parts = member_path.parts[1:]
                if not relative_parts or member.isdir():
                    continue
                if not member.isfile():
                    return False
                source = bundle.extractfile(member)
                if source is None:
                    return False
                with source:
                    expected[PurePosixPath(*relative_parts)] = hashlib.sha256(source.read()).hexdigest()
    except (OSError, tarfile.TarError, OfflineMirrorError):
        return False

    installed_paths = tuple(directory.rglob("*"))
    if any(path.is_symlink() for path in installed_paths):
        return False
    actual = {
        PurePosixPath(path.relative_to(directory).as_posix())
        for path in installed_paths
        if path.is_file()
    }
    if actual != set(expected):
        return False
    return all(
        sha256_file(directory.joinpath(*relative.parts)) == expected_hash
        for relative, expected_hash in expected.items()
    )


def _copy_atomic(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
    os.close(handle)
    temporary = Path(temporary_name)
    try:
        shutil.copy2(source, temporary)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def _download_atomic(package: LockedPackage, destination: Path) -> str:
    if package.resolved is None or package.integrity is None:
        raise OfflineMirrorError(f"Cannot URL-download {package.name}@{package.version} without lock metadata.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary_name = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
    os.close(handle)
    temporary = Path(temporary_name)
    try:
        request = urllib.request.Request(package.resolved, headers={"User-Agent": DOWNLOAD_USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=120) as response, temporary.open("wb") as output:
                shutil.copyfileobj(response, output, length=1024 * 1024)
        except (OSError, urllib.error.URLError) as error:
            raise OfflineMirrorError(
                f"Failed to download {package.name}@{package.version} from {package.resolved}: {error}"
            ) from error
        integrity = verify_archive_identity(temporary, package, integrity=package.integrity)
        os.replace(temporary, destination)
        return integrity
    finally:
        temporary.unlink(missing_ok=True)


def npm_executable() -> str:
    executable = shutil.which("npm")
    if executable is None:
        raise OfflineMirrorError("npm is not available on PATH; install the Node.js version pinned in .nvmrc.")
    return executable


def _parse_npm_pack_output(stdout: str, package: LockedPackage, directory: Path) -> tuple[Path, str | None]:
    try:
        value = json.loads(stdout)
    except json.JSONDecodeError as error:
        raise OfflineMirrorError(
            f"npm pack returned invalid JSON for {package.name}@{package.version}: {stdout.strip()!r}"
        ) from error
    if not isinstance(value, list) or len(value) != 1 or not isinstance(value[0], dict):
        raise OfflineMirrorError(f"npm pack returned an unexpected result for {package.name}@{package.version}.")
    record = value[0]
    if record.get("name") != package.name or record.get("version") != package.version:
        raise OfflineMirrorError(
            f"npm pack identity mismatch: expected {package.name}@{package.version}, "
            f"received {record.get('name')!r}@{record.get('version')!r}."
        )
    filename = record.get("filename")
    if not isinstance(filename, str) or Path(filename).name != filename:
        raise OfflineMirrorError(f"npm pack returned an unsafe filename for {package.name}@{package.version}.")
    integrity = record.get("integrity")
    if integrity is not None and not isinstance(integrity, str):
        raise OfflineMirrorError(f"npm pack returned an invalid integrity for {package.name}@{package.version}.")
    return directory / filename, integrity


def _npm_pack_exact(root: Path, package: LockedPackage, destination: Path) -> str:
    """Fetch an exact registry package whose lock entry omitted dist metadata."""

    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".npm-pack-", dir=destination.parent) as temporary_name:
        temporary = Path(temporary_name)
        environment = os.environ.copy()
        environment.update(
            {
                "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1",
                "npm_config_audit": "false",
                "npm_config_fund": "false",
                "npm_config_update_notifier": "false",
            }
        )
        command = [
            npm_executable(),
            "pack",
            f"{package.name}@{package.version}",
            "--json",
            "--ignore-scripts",
            "--pack-destination",
            str(temporary),
        ]
        completed = subprocess.run(
            command,
            cwd=root,
            env=environment,
            text=True,
            capture_output=True,
            check=False,
        )
        if completed.returncode:
            details = (completed.stderr or completed.stdout).strip()
            raise OfflineMirrorError(
                f"npm pack failed for {package.name}@{package.version}: {details or 'no diagnostic output'}"
            )
        packed, reported_integrity = _parse_npm_pack_output(completed.stdout, package, temporary)
        actual_integrity = verify_archive_identity(packed, package, integrity=reported_integrity)
        _copy_atomic(packed, destination)
        verify_archive_identity(destination, package, integrity=actual_integrity)
        return actual_integrity


def _load_previous_manifest(root: Path) -> dict[str, dict[str, object]]:
    path = root / MANIFEST_PATH
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    if not isinstance(value, dict) or value.get("schemaVersion") != MANIFEST_SCHEMA_VERSION:
        return {}
    packages = value.get("packages")
    if not isinstance(packages, list):
        return {}
    result: dict[str, dict[str, object]] = {}
    for record in packages:
        if isinstance(record, dict) and isinstance(record.get("installPath"), str):
            result[record["installPath"]] = record
    return result


def _reuse_registry_pack(
    root: Path,
    package: LockedPackage,
    destination: Path,
    previous: dict[str, dict[str, object]],
) -> str | None:
    record = previous.get(package.install_path)
    if not destination.is_file() or record is None or record.get("metadataSource") != "npm-pack":
        return None
    integrity = record.get("integrity")
    archive = record.get("archive")
    if not isinstance(integrity, str) or archive != destination.relative_to(root).as_posix():
        return None
    try:
        return verify_archive_identity(destination, package, integrity=integrity)
    except OfflineMirrorError:
        return None


def _offline_file_reference(relative: Path) -> str:
    return "file:" + relative.as_posix()


def build_offline_package(root: Path) -> dict[str, object]:
    package_path = root / "package.json"
    try:
        package = json.loads(package_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise OfflineMirrorError(f"Cannot read {package_path}") from error
    if not isinstance(package, dict):
        raise OfflineMirrorError("package.json must contain a JSON object.")

    lock = load_lockfile(root)
    raw_packages = lock["packages"]
    assert isinstance(raw_packages, dict)
    root_metadata = raw_packages.get("")
    if not isinstance(root_metadata, dict):
        raise OfflineMirrorError("package-lock.json does not contain root package metadata.")

    result: dict[str, object] = {
        "name": package.get("name", root_metadata.get("name", "offline-chat-toolchain")),
        "version": package.get("version", root_metadata.get("version", "0.0.0")),
        "private": True,
        "description": "Generated minimal npm toolchain for Linux chat/code checks; do not edit.",
    }
    selected_maps = selected_root_dependency_maps(root)
    for field, dependencies in selected_maps.items():
        package_dependencies = package.get(field)
        if not isinstance(package_dependencies, dict):
            raise OfflineMirrorError(f"package.json is missing the {field} map required by package-lock.json.")
        selected_values: dict[str, str] = {}
        for name, locked_request in dependencies.items():
            requested = package_dependencies.get(name)
            if requested != locked_request:
                raise OfflineMirrorError(
                    f"package.json and package-lock.json disagree for {name}: "
                    f"{requested!r} != {locked_request!r}."
                )
            selected_values[name] = locked_request
        if selected_values:
            result[field] = selected_values
    return result


def build_offline_lock(
    root: Path,
    mirrored: tuple[MirroredPackage, ...],
) -> dict[str, object]:
    lock = copy.deepcopy(load_lockfile(root))
    packages = lock.get("packages")
    assert isinstance(packages, dict)
    root_metadata = packages.get("")
    if not isinstance(root_metadata, dict):
        raise OfflineMirrorError("package-lock.json does not contain root package metadata.")

    pruned_root = copy.deepcopy(root_metadata)
    selected_maps = selected_root_dependency_maps(root)
    for field in ROOT_DEPENDENCY_FIELDS:
        if field in selected_maps:
            pruned_root[field] = selected_maps[field]
        else:
            pruned_root.pop(field, None)

    selected_paths = {item.locked.install_path for item in mirrored}
    pruned_packages: dict[str, object] = {"": pruned_root}
    for install_path in sorted(selected_paths):
        metadata = packages.get(install_path)
        if not isinstance(metadata, dict):
            raise OfflineMirrorError(f"Missing {install_path} while building the offline lockfile.")
        pruned_packages[install_path] = copy.deepcopy(metadata)
    lock["packages"] = pruned_packages

    for item in mirrored:
        metadata = pruned_packages.get(item.locked.install_path)
        assert isinstance(metadata, dict)
        metadata["resolved"] = _offline_file_reference(item.archive_relative)
        metadata["integrity"] = item.integrity
    return lock

def _manifest_data(root: Path, mirrored: tuple[MirroredPackage, ...]) -> dict[str, object]:
    records: list[dict[str, object]] = []
    registry_pack_count = 0
    for item in mirrored:
        package = item.locked
        if item.metadata_source == "npm-pack":
            registry_pack_count += 1
        record: dict[str, object] = {
            "installPath": package.install_path,
            "name": package.name,
            "version": package.version,
            "optional": package.optional,
            "metadataSource": item.metadata_source,
            "integrity": item.integrity,
            "archive": item.archive_relative.as_posix(),
        }
        if package.resolved is not None:
            record["registryResolved"] = package.resolved
        records.append(record)
    return {
        "schemaVersion": MANIFEST_SCHEMA_VERSION,
        "profile": CHAT_PROFILE_NAME,
        "target": {"os": TARGET_OS, "cpu": TARGET_CPU, "libc": TARGET_LIBC},
        "lockfileSha256": sha256_file(root / "package-lock.json"),
        "rootPackages": list(selected_root_package_names(root)),
        "excludedRootPackages": list(excluded_root_package_names(root)),
        "packageCount": len(mirrored),
        "archivePackageCount": len(mirrored),
        "registryPackPackageCount": registry_pack_count,
        "playwrightBrowsersIncluded": False,
        "offlineLock": OFFLINE_LOCK_PATH.as_posix(),
        "offlinePackage": OFFLINE_PACKAGE_PATH.as_posix(),
        "packages": records,
    }


def _write_json_atomic(destination: Path, data: dict[str, object]) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    handle, temporary_name = tempfile.mkstemp(prefix=f".{destination.name}.", dir=destination.parent)
    os.close(handle)
    temporary = Path(temporary_name)
    try:
        temporary.write_bytes(encoded)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def write_manifest(root: Path, data: dict[str, object]) -> None:
    _write_json_atomic(root / MANIFEST_PATH, data)


def write_offline_lock(root: Path, data: dict[str, object]) -> None:
    _write_json_atomic(root / OFFLINE_LOCK_PATH, data)


def write_offline_package(root: Path, data: dict[str, object]) -> None:
    _write_json_atomic(root / OFFLINE_PACKAGE_PATH, data)


def _prune_mirror(root: Path, expected: set[Path]) -> None:
    vendor_root = root / "vendor/npm"
    if vendor_root.is_dir():
        for candidate in vendor_root.rglob("*.tgz"):
            if candidate.is_symlink() or candidate.resolve() not in expected:
                candidate.unlink(missing_ok=True)
    for relative in LEGACY_MIRROR_DIRECTORIES:
        shutil.rmtree(root / relative, ignore_errors=True)
    shutil.rmtree(root / LEGACY_CACHE_DIRECTORY, ignore_errors=True)
    archive_root = root / ARCHIVE_DIRECTORY
    if archive_root.is_dir():
        for directory in sorted(archive_root.rglob("*"), reverse=True):
            if directory.is_dir() and not any(directory.iterdir()):
                directory.rmdir()


def sync_mirror(root: Path, *, download_missing: bool = True, prune: bool = True) -> dict[str, object]:
    packages = locked_packages(root)
    integrity_index = build_integrity_index(root)
    previous = _load_previous_manifest(root)
    mirrored: list[MirroredPackage] = []
    expected_canonical: set[Path] = set()

    for package in packages:
        destination = root / canonical_archive_relative(package)
        destination_resolved = destination.resolve()
        expected_canonical.add(destination_resolved)
        integrity: str | None = None
        source = "lockfile" if package.has_lock_archive_metadata else "npm-pack"

        if package.has_lock_archive_metadata:
            assert package.integrity is not None
            if destination.is_file():
                try:
                    integrity = verify_archive_identity(destination, package, integrity=package.integrity)
                except OfflineMirrorError:
                    destination.unlink(missing_ok=True)
            if integrity is None:
                for candidate in integrity_index.get(package.integrity, []):
                    try:
                        verify_archive_identity(candidate, package, integrity=package.integrity)
                    except OfflineMirrorError:
                        continue
                    _copy_atomic(candidate, destination)
                    integrity = verify_archive_identity(destination, package, integrity=package.integrity)
                    break
            if integrity is None:
                if not download_missing:
                    raise OfflineMirrorError(
                        f"Missing archive for {package.name}@{package.version}: {canonical_archive_relative(package)}"
                    )
                integrity = _download_atomic(package, destination)
        else:
            integrity = _reuse_registry_pack(root, package, destination, previous)
            if integrity is None:
                if not download_missing:
                    raise OfflineMirrorError(
                        f"package-lock.json omits resolved/integrity for {package.name}@{package.version}; "
                        "run `npm run update:offline:linux` online so npm pack can mirror it."
                    )
                integrity = _npm_pack_exact(root, package, destination)

        if integrity is None:
            raise OfflineMirrorError(f"No verified archive was produced for {package.name}@{package.version}.")
        mirrored.append(
            MirroredPackage(
                locked=package,
                archive_relative=destination.relative_to(root),
                integrity=integrity,
                metadata_source=source,
            )
        )

    mirrored_tuple = tuple(mirrored)
    offline_lock = build_offline_lock(root, mirrored_tuple)
    offline_package = build_offline_package(root)
    manifest = _manifest_data(root, mirrored_tuple)

    # All required archives and generated metadata are validated before any
    # destructive cleanup of legacy or stale files.
    if prune:
        _prune_mirror(root, expected_canonical)
    write_offline_lock(root, offline_lock)
    write_offline_package(root, offline_package)
    write_manifest(root, manifest)
    return manifest


def _load_json_file(path: Path, *, label: str) -> dict[str, object]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise OfflineMirrorError(f"Missing or invalid {label}: {path}") from error
    if not isinstance(value, dict):
        raise OfflineMirrorError(f"Invalid {label}: {path}")
    return value


def _manifest_records(manifest: dict[str, object]) -> dict[str, dict[str, object]]:
    raw = manifest.get("packages")
    if not isinstance(raw, list):
        raise OfflineMirrorError("Offline manifest packages must be a list.")
    records: dict[str, dict[str, object]] = {}
    for item in raw:
        if not isinstance(item, dict) or not isinstance(item.get("installPath"), str):
            raise OfflineMirrorError("Offline manifest contains an invalid package record.")
        install_path = item["installPath"]
        if install_path in records:
            raise OfflineMirrorError(f"Offline manifest duplicates {install_path}.")
        records[install_path] = item
    return records


def verify_mirror(root: Path) -> dict[str, object]:
    manifest_path = root / MANIFEST_PATH
    try:
        manifest = _load_json_file(manifest_path, label="offline manifest")
    except OfflineMirrorError as error:
        raise OfflineMirrorError(
            f"Missing or invalid {MANIFEST_PATH}. Run `npm run update:offline:linux` while online."
        ) from error
    if manifest.get("schemaVersion") != MANIFEST_SCHEMA_VERSION:
        raise OfflineMirrorError(
            "The Linux npm offline manifest uses an obsolete schema. "
            "Run `npm run update:offline:linux` while online."
        )
    if manifest.get("profile") != CHAT_PROFILE_NAME:
        raise OfflineMirrorError("The offline manifest targets a different dependency profile.")
    if manifest.get("target") != {"os": TARGET_OS, "cpu": TARGET_CPU, "libc": TARGET_LIBC}:
        raise OfflineMirrorError("The offline manifest targets a different platform.")
    if manifest.get("rootPackages") != list(selected_root_package_names(root)):
        raise OfflineMirrorError("The offline manifest root package inventory is stale.")
    if manifest.get("excludedRootPackages") != list(excluded_root_package_names(root)):
        raise OfflineMirrorError("The offline manifest excluded-root inventory is stale.")
    if manifest.get("lockfileSha256") != sha256_file(root / "package-lock.json"):
        raise OfflineMirrorError(
            "The Linux npm offline mirror does not match package-lock.json. "
            "Run `npm run update:offline:linux` while online."
        )

    packages = locked_packages(root)
    records = _manifest_records(manifest)
    if set(records) != {package.install_path for package in packages}:
        raise OfflineMirrorError(
            "The Linux npm offline package inventory does not match package-lock.json. "
            "Run `npm run update:offline:linux` while online."
        )

    mirrored: list[MirroredPackage] = []
    expected_paths: set[Path] = set()
    registry_pack_count = 0
    for package in packages:
        record = records[package.install_path]
        expected_relative = canonical_archive_relative(package)
        expected_source = "lockfile" if package.has_lock_archive_metadata else "npm-pack"
        integrity = record.get("integrity")
        if (
            record.get("name") != package.name
            or record.get("version") != package.version
            or record.get("optional") != package.optional
            or record.get("metadataSource") != expected_source
            or record.get("archive") != expected_relative.as_posix()
            or not isinstance(integrity, str)
        ):
            raise OfflineMirrorError(f"Invalid offline manifest record for {package.install_path}.")
        if package.has_lock_archive_metadata:
            if integrity != package.integrity or record.get("registryResolved") != package.resolved:
                raise OfflineMirrorError(f"Lockfile metadata mismatch for {package.install_path}.")
        else:
            registry_pack_count += 1
        archive = root / expected_relative
        verify_archive_identity(archive, package, integrity=integrity)
        expected_paths.add(archive.resolve())
        mirrored.append(
            MirroredPackage(package, expected_relative, integrity, expected_source)
        )

    if manifest.get("packageCount") != len(packages) or manifest.get("archivePackageCount") != len(packages):
        raise OfflineMirrorError("Offline manifest package counts are invalid.")
    if manifest.get("registryPackPackageCount") != registry_pack_count:
        raise OfflineMirrorError("Offline manifest registry-pack count is invalid.")
    if manifest.get("playwrightBrowsersIncluded") is not False:
        raise OfflineMirrorError("The npm mirror must not claim to include Playwright browsers.")
    if manifest.get("offlineLock") != OFFLINE_LOCK_PATH.as_posix():
        raise OfflineMirrorError("Offline manifest points to an unexpected lockfile.")
    if manifest.get("offlinePackage") != OFFLINE_PACKAGE_PATH.as_posix():
        raise OfflineMirrorError("Offline manifest points to an unexpected package descriptor.")

    stored_offline_lock = _load_json_file(root / OFFLINE_LOCK_PATH, label="offline package lock")
    expected_offline_lock = build_offline_lock(root, tuple(mirrored))
    if stored_offline_lock != expected_offline_lock:
        raise OfflineMirrorError(
            "The generated offline package lock is stale or modified. "
            "Run `npm run update:offline:linux` while online."
        )

    stored_offline_package = _load_json_file(
        root / OFFLINE_PACKAGE_PATH, label="offline package descriptor"
    )
    expected_offline_package = build_offline_package(root)
    if stored_offline_package != expected_offline_package:
        raise OfflineMirrorError(
            "The generated offline package descriptor is stale or modified. "
            "Run `npm run update:offline:linux` while online."
        )

    stale = [
        path.relative_to(root).as_posix()
        for path in _archive_candidates(root)
        if path.resolve() not in expected_paths
    ]
    if stale:
        raise OfflineMirrorError(
            "Stale or duplicate npm archives remain: " + ", ".join(sorted(stale)) + ". Run the update command."
        )
    return manifest


def unique_archive_paths(root: Path, manifest: dict[str, object]) -> tuple[Path, ...]:
    records = _manifest_records(manifest)
    paths: set[Path] = set()
    for record in records.values():
        archive = record.get("archive")
        if not isinstance(archive, str):
            raise OfflineMirrorError("Offline manifest archive path is invalid.")
        path = (root / archive).resolve()
        try:
            path.relative_to(root.resolve())
        except ValueError as error:
            raise OfflineMirrorError(f"Offline archive escapes the project root: {archive}") from error
        paths.add(path)
    return tuple(sorted(paths, key=lambda path: path.as_posix()))
