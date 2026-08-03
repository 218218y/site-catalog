#!/usr/bin/env python3
"""Shared lockfile-driven support for the Linux x64 npm offline mirror.

The repository mirror intentionally targets the ChatGPT/Linux execution host:
Linux, x64, glibc.  Package versions, tarball URLs and integrity values are read
from ``package-lock.json``; this module contains no package-version inventory.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import shutil
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
MANIFEST_SCHEMA_VERSION: Final = 1
DOWNLOAD_USER_AGENT: Final = "site-catalog-offline-mirror/1"


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
    def has_archive(self) -> bool:
        return self.resolved is not None and self.integrity is not None


@dataclass(frozen=True)
class BundleOwner:
    package_name: str
    package_version: str
    archive_relative: Path


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


def locked_packages(root: Path) -> tuple[LockedPackage, ...]:
    lock = load_lockfile(root)
    raw_packages = lock["packages"]
    assert isinstance(raw_packages, dict)
    selected: list[LockedPackage] = []
    for install_path, raw_metadata in raw_packages.items():
        if not install_path:
            continue
        if not isinstance(install_path, str) or not isinstance(raw_metadata, dict):
            raise OfflineMirrorError("package-lock.json contains an invalid package entry.")
        metadata = raw_metadata
        if not is_target_compatible(metadata):
            continue
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
    return tuple(sorted(selected, key=lambda item: item.install_path))


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
    if not package.has_archive:
        raise OfflineMirrorError(f"{package.name}@{package.version} is bundled and has no standalone archive.")
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


def verify_archive(path: Path, package: LockedPackage) -> None:
    if not package.has_archive:
        raise OfflineMirrorError(f"Cannot verify a standalone archive for bundled package {package.name}.")
    if not path.is_file():
        raise OfflineMirrorError(f"Missing offline archive: {path}")
    actual_integrity = sri_sha512(path)
    if actual_integrity != package.integrity:
        raise OfflineMirrorError(
            f"Integrity check failed for {path}; expected {package.integrity}, received {actual_integrity}."
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


def _archive_candidates(root: Path) -> Iterable[Path]:
    vendor = root / "vendor/npm"
    if not vendor.is_dir():
        return ()
    return (path for path in vendor.rglob("*.tgz") if path.is_file())


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
    if not package.has_archive or package.integrity is None:
        raise OfflineMirrorError(f"{package.name}@{package.version} has no standalone lockfile archive.")
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


def _download_atomic(package: LockedPackage, destination: Path) -> None:
    assert package.resolved is not None
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
        verify_archive(temporary, package)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def _bundled_packages_in_archive(path: Path) -> dict[tuple[str, str], None]:
    discovered: dict[tuple[str, str], None] = {}
    try:
        with tarfile.open(path, mode="r:gz") as bundle:
            for member in bundle.getmembers():
                member_path = _safe_archive_member(member.name)
                if not member.isfile() or member_path.name != "package.json":
                    continue
                parts = member_path.parts
                if len(parts) < 4 or parts[0] != "package" or "node_modules" not in parts[1:-1]:
                    continue
                source = bundle.extractfile(member)
                if source is None:
                    continue
                try:
                    metadata = json.loads(source.read().decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    continue
                if not isinstance(metadata, dict):
                    continue
                name = metadata.get("name")
                version = metadata.get("version")
                if isinstance(name, str) and isinstance(version, str):
                    discovered[(name, version)] = None
    except (OSError, tarfile.TarError) as error:
        raise OfflineMirrorError(f"Cannot scan bundled dependencies in {path}.") from error
    return discovered


def resolve_bundle_owners(
    root: Path,
    archive_packages: Iterable[LockedPackage],
    bundled_packages: Iterable[LockedPackage],
) -> dict[str, BundleOwner]:
    ownership: dict[tuple[str, str], list[BundleOwner]] = {}
    seen_archives: set[Path] = set()
    for owner_package in archive_packages:
        archive = locate_archive(root, owner_package)
        resolved_archive = archive.resolve()
        if resolved_archive in seen_archives:
            continue
        seen_archives.add(resolved_archive)
        owner = BundleOwner(
            package_name=owner_package.name,
            package_version=owner_package.version,
            archive_relative=archive.relative_to(root),
        )
        for identity in _bundled_packages_in_archive(archive):
            ownership.setdefault(identity, []).append(owner)

    result: dict[str, BundleOwner] = {}
    for package in bundled_packages:
        owners = ownership.get((package.name, package.version), [])
        if not owners:
            raise OfflineMirrorError(
                f"package-lock.json omits a tarball for {package.name}@{package.version}, but no mirrored "
                "archive contains that exact bundled dependency."
            )
        owners.sort(key=lambda item: (item.archive_relative.as_posix(), item.package_name))
        result[package.install_path] = owners[0]
    return result


def _manifest_data(root: Path, packages: tuple[LockedPackage, ...]) -> dict[str, object]:
    archives = tuple(package for package in packages if package.has_archive)
    bundled = tuple(package for package in packages if not package.has_archive)
    bundle_owners = resolve_bundle_owners(root, archives, bundled)
    records: list[dict[str, object]] = []
    for package in packages:
        base: dict[str, object] = {
            "installPath": package.install_path,
            "name": package.name,
            "version": package.version,
            "optional": package.optional,
        }
        if package.has_archive:
            archive = locate_archive(root, package)
            base.update(
                {
                    "source": "archive",
                    "resolved": package.resolved,
                    "integrity": package.integrity,
                    "archive": archive.relative_to(root).as_posix(),
                }
            )
        else:
            owner = bundle_owners[package.install_path]
            base.update(
                {
                    "source": "bundled",
                    "owner": f"{owner.package_name}@{owner.package_version}",
                    "archive": owner.archive_relative.as_posix(),
                }
            )
        records.append(base)
    return {
        "schemaVersion": MANIFEST_SCHEMA_VERSION,
        "target": {"os": TARGET_OS, "cpu": TARGET_CPU, "libc": TARGET_LIBC},
        "lockfileSha256": sha256_file(root / "package-lock.json"),
        "packageCount": len(packages),
        "archivePackageCount": len(archives),
        "bundledPackageCount": len(bundled),
        "playwrightBrowsersIncluded": False,
        "packages": records,
    }


def write_manifest(root: Path, data: dict[str, object]) -> None:
    destination = root / MANIFEST_PATH
    destination.parent.mkdir(parents=True, exist_ok=True)
    encoded = (json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8")
    handle, temporary_name = tempfile.mkstemp(prefix=".manifest.", dir=destination.parent)
    os.close(handle)
    temporary = Path(temporary_name)
    try:
        temporary.write_bytes(encoded)
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)


def sync_mirror(root: Path, *, download_missing: bool = True, prune: bool = True) -> dict[str, object]:
    packages = locked_packages(root)
    archive_packages = tuple(package for package in packages if package.has_archive)
    integrity_index = build_integrity_index(root)
    expected_canonical: set[Path] = set()

    for package in archive_packages:
        assert package.integrity is not None
        destination = root / canonical_archive_relative(package)
        expected_canonical.add(destination.resolve())
        if destination.is_file():
            try:
                verify_archive(destination, package)
                continue
            except OfflineMirrorError:
                destination.unlink()
        reusable = None
        for candidate in integrity_index.get(package.integrity, []):
            try:
                verify_archive(candidate, package)
            except OfflineMirrorError:
                continue
            reusable = candidate
            break
        if reusable is not None:
            _copy_atomic(reusable, destination)
            verify_archive(destination, package)
            continue
        if not download_missing:
            raise OfflineMirrorError(
                f"Missing archive for {package.name}@{package.version}: {canonical_archive_relative(package)}"
            )
        _download_atomic(package, destination)
        integrity_index.setdefault(package.integrity, []).append(destination)

    # Validate archive identities and all lockfile entries without standalone
    # tarballs before destructive cleanup. A failed bundled-package check must
    # leave the previous repository mirror available for diagnosis/retry.
    manifest = _manifest_data(root, packages)

    if prune:
        vendor_root = root / "vendor/npm"
        if vendor_root.is_dir():
            for candidate in vendor_root.rglob("*.tgz"):
                if candidate.resolve() not in expected_canonical:
                    candidate.unlink()
        archive_root = root / ARCHIVE_DIRECTORY
        if archive_root.is_dir():
            for directory in sorted(archive_root.rglob("*"), reverse=True):
                if directory.is_dir() and not any(directory.iterdir()):
                    directory.rmdir()

    write_manifest(root, manifest)
    return manifest


def verify_mirror(root: Path) -> dict[str, object]:
    manifest_path = root / MANIFEST_PATH
    try:
        stored = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise OfflineMirrorError(
            f"Missing or invalid {MANIFEST_PATH}. Run `npm run update:offline:linux` while online."
        ) from error
    if not isinstance(stored, dict):
        raise OfflineMirrorError(f"Invalid offline manifest: {MANIFEST_PATH}")
    expected = _manifest_data(root, locked_packages(root))
    if stored != expected:
        raise OfflineMirrorError(
            "The Linux npm offline mirror does not match package-lock.json. "
            "Run `npm run update:offline:linux` while online."
        )
    return expected


def unique_archive_paths(root: Path, manifest: dict[str, object]) -> tuple[Path, ...]:
    raw_packages = manifest.get("packages")
    if not isinstance(raw_packages, list):
        raise OfflineMirrorError("Offline manifest packages must be a list.")
    paths: set[Path] = set()
    for raw in raw_packages:
        if not isinstance(raw, dict) or raw.get("source") != "archive":
            continue
        archive = raw.get("archive")
        if not isinstance(archive, str):
            raise OfflineMirrorError("Offline manifest archive path is invalid.")
        path = (root / archive).resolve()
        try:
            path.relative_to(root.resolve())
        except ValueError as error:
            raise OfflineMirrorError(f"Offline archive escapes the project root: {archive}") from error
        paths.add(path)
    return tuple(sorted(paths, key=lambda path: path.as_posix()))
