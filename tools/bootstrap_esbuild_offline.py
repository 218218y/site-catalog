#!/usr/bin/env python3
"""Install the lockfile-pinned esbuild runtime from verified local npm archives.

Versions and integrity values are resolved from ``package-lock.json`` at run
time.  The focused bootstrap installs only esbuild and the Linux x64 binary;
the complete dependency tree is handled by ``bootstrap_npm_offline_linux.py``.
"""
from __future__ import annotations

import argparse
import hashlib
import sys
import json
import os
import platform
import shutil
import subprocess
import tarfile
import tempfile
import uuid
from pathlib import Path, PurePosixPath

TOOLS_DIRECTORY = Path(__file__).resolve().parent
if str(TOOLS_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIRECTORY))

from npm_offline_linux import (
    OfflineMirrorError,
    directory_matches_archive,
    extract_npm_archive,
    locate_archive,
    locked_package,
    project_root,
    sha256_file,
)

CORE_INSTALL_PATH = "node_modules/esbuild"
PLATFORM_INSTALL_PATHS = {"linux-x64": "node_modules/@esbuild/linux-x64"}


class BootstrapError(RuntimeError):
    """Raised when the focused esbuild runtime cannot be trusted or installed."""


def _locked(root: Path, install_path: str):
    try:
        return locked_package(root, install_path)
    except OfflineMirrorError as error:
        raise BootstrapError(str(error)) from error


def locked_version(root: Path | None = None) -> str:
    return _locked((root or project_root()).resolve(), CORE_INSTALL_PATH).version


ESBUILD_VERSION = locked_version()


def normalize_architecture(machine: str) -> str:
    normalized = machine.strip().lower().replace("-", "_")
    if normalized in {"amd64", "x86_64", "x64"}:
        return "x64"
    raise BootstrapError(
        f"The verified offline esbuild runtime targets Linux x64 only; detected architecture={machine!r}."
    )


def current_platform_key(*, system: str | None = None, machine: str | None = None) -> str:
    detected_system = (system or platform.system()).strip().lower()
    architecture = normalize_architecture(machine or platform.machine())
    if detected_system == "linux" and architecture == "x64":
        return "linux-x64"
    raise BootstrapError(
        "The verified offline esbuild runtime is Linux x64 only; "
        f"detected system={system or platform.system()!r}, architecture={machine or platform.machine()!r}. "
        "Use the package-lock-managed installation (`npm ci`) on this platform."
    )


def _read_package_metadata(directory: Path) -> dict[str, object]:
    package_json = directory / "package.json"
    try:
        value = json.loads(package_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise BootstrapError(f"Invalid installed package metadata: {package_json}") from error
    if not isinstance(value, dict):
        raise BootstrapError(f"Invalid installed package metadata: {package_json}")
    return value


def _validate_directory(directory: Path, *, name: str, version: str, binary: Path | None = None) -> None:
    metadata = _read_package_metadata(directory)
    if metadata.get("name") != name or metadata.get("version") != version:
        raise BootstrapError(
            f"Unexpected package in {directory}: name={metadata.get('name')!r}, "
            f"version={metadata.get('version')!r}; expected {name}@{version}."
        )
    if binary is not None:
        binary_path = directory / binary
        if not binary_path.is_file():
            raise BootstrapError(f"Missing esbuild binary after extraction: {binary_path}")
        if os.name != "nt":
            binary_path.chmod(binary_path.stat().st_mode | 0o755)


def _replace_directory(staged: Path, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    backup = target.with_name(f".{target.name}.offline-backup-{uuid.uuid4().hex}")
    had_target = target.exists() or target.is_symlink()
    if had_target:
        os.replace(target, backup)
    try:
        os.replace(staged, target)
    except Exception:
        if had_target and backup.exists():
            os.replace(backup, target)
        raise
    else:
        if had_target:
            if backup.is_dir() and not backup.is_symlink():
                shutil.rmtree(backup)
            else:
                backup.unlink(missing_ok=True)


def _archive_file_hashes(archive: Path) -> dict[PurePosixPath, str] | None:
    expected: dict[PurePosixPath, str] = {}
    try:
        with tarfile.open(archive, mode="r:gz") as bundle:
            for member in bundle.getmembers():
                parts = PurePosixPath(member.name).parts
                if not parts or parts[0] != "package" or any(part in {"", ".", ".."} for part in parts):
                    return None
                relative = PurePosixPath(*parts[1:])
                if not relative.parts or member.isdir():
                    continue
                if not member.isfile():
                    return None
                source = bundle.extractfile(member)
                if source is None:
                    return None
                with source:
                    expected[relative] = hashlib.sha256(source.read()).hexdigest()
    except (OSError, tarfile.TarError):
        return None
    return expected


def _npm_installed_core_matches(root: Path, archive: Path, directory: Path) -> bool:
    """Accept esbuild's verified postinstall layout.

    npm's esbuild install script replaces the archive's JavaScript
    ``bin/esbuild`` launcher with a byte-for-byte copy of the authenticated
    platform binary. Every other core file must still match the core archive.
    """

    platform_install_path = PLATFORM_INSTALL_PATHS["linux-x64"]
    platform_package = _locked(root, platform_install_path)
    platform_directory = root / platform_install_path
    try:
        platform_archive = locate_archive(root, platform_package)
    except OfflineMirrorError:
        return False
    if not directory_matches_archive(platform_archive, platform_directory):
        return False

    expected = _archive_file_hashes(archive)
    if expected is None:
        return False
    installed_paths = tuple(directory.rglob("*"))
    if any(path.is_symlink() for path in installed_paths):
        return False
    actual_files = {
        PurePosixPath(path.relative_to(directory).as_posix())
        for path in installed_paths
        if path.is_file()
    }
    if actual_files != set(expected):
        return False

    replaced = PurePosixPath("bin/esbuild")
    for relative, expected_hash in expected.items():
        if relative == replaced:
            continue
        if sha256_file(directory.joinpath(*relative.parts)) != expected_hash:
            return False
    core_binary = directory / "bin/esbuild"
    platform_binary = platform_directory / "bin/esbuild"
    return (
        core_binary.is_file()
        and platform_binary.is_file()
        and sha256_file(core_binary) == sha256_file(platform_binary)
    )


def _installation_is_current(root: Path, install_path: str, *, binary: Path | None = None) -> bool:
    package = _locked(root, install_path)
    directory = root / install_path
    if not directory.is_dir():
        return False
    try:
        archive = locate_archive(root, package)
        _validate_directory(directory, name=package.name, version=package.version, binary=binary)
    except (BootstrapError, OfflineMirrorError):
        return False
    if directory_matches_archive(archive, directory):
        return True
    if install_path == CORE_INSTALL_PATH:
        return _npm_installed_core_matches(root, archive, directory)
    return False


def _install_package(
    root: Path,
    install_path: str,
    *,
    binary: Path | None = None,
    force: bool = False,
) -> bool:
    package = _locked(root, install_path)
    try:
        archive = locate_archive(root, package)
    except OfflineMirrorError as error:
        raise BootstrapError(str(error)) from error
    if not force and _installation_is_current(root, install_path, binary=binary):
        return False

    target = root / install_path
    target.parent.mkdir(parents=True, exist_ok=True)
    staged = Path(tempfile.mkdtemp(prefix=f".{target.name}.offline-stage-", dir=target.parent))
    shutil.rmtree(staged)
    try:
        extract_npm_archive(archive, staged)
        _validate_directory(staged, name=package.name, version=package.version, binary=binary)
        _replace_directory(staged, target)
    except OfflineMirrorError as error:
        raise BootstrapError(str(error)) from error
    finally:
        if staged.exists():
            shutil.rmtree(staged, ignore_errors=True)
    return True


def _write_cli_shim(root: Path) -> None:
    bin_directory = root / "node_modules/.bin"
    bin_directory.mkdir(parents=True, exist_ok=True)
    shim = bin_directory / "esbuild"
    if shim.exists() or shim.is_symlink():
        shim.unlink()
    shim.symlink_to(Path("../esbuild/bin/esbuild"))


def verify_node_runtime(root: Path) -> None:
    node = shutil.which("node")
    if node is None:
        raise BootstrapError("Node.js is not available on PATH; install the version pinned in .nvmrc.")
    version = locked_version(root)
    environment = os.environ.copy()
    environment.pop("ESBUILD_BINARY_PATH", None)
    probe = subprocess.run(
        [
            node,
            "--input-type=module",
            "--eval",
            (
                "import { transformSync, version } from 'esbuild';"
                f"if (version !== '{version}') throw new Error('version=' + version);"
                "transformSync('const offlineEsbuildProbe = 1;', { format: 'esm' });"
                "console.log(version);"
            ),
        ],
        cwd=root,
        env=environment,
        text=True,
        capture_output=True,
        check=False,
    )
    if probe.returncode:
        details = (probe.stderr or probe.stdout).strip()
        raise BootstrapError(f"The installed offline esbuild runtime failed its Node.js probe: {details}")


def verify_installed_esbuild(root: Path | None = None) -> None:
    """Verify the lockfile-pinned local runtime without assuming an OS package.

    A normal ``npm ci`` installs esbuild's optional native package for the
    current platform (for example ``@esbuild/win32-x64`` on Windows).  The
    Linux-only offline bootstrap has its own stricter archive verification in
    :func:`verify_offline_installation`; availability checks must accept any
    platform package that the pinned esbuild core can successfully execute.
    """

    base = (root or project_root()).resolve()
    core = _locked(base, CORE_INSTALL_PATH)
    _validate_directory(base / CORE_INSTALL_PATH, name=core.name, version=core.version)
    verify_node_runtime(base)


def ensure_esbuild_available(root: Path | None = None, *, quiet: bool = True) -> bool:
    base = (root or project_root()).resolve()
    try:
        verify_installed_esbuild(base)
        return False
    except BootstrapError as installed_error:
        try:
            current_platform_key()
        except BootstrapError:
            raise BootstrapError(
                f"Local esbuild {locked_version(base)} is missing or unusable. "
                "Offline archives target Linux x64 only; run `npm ci` on this platform."
            ) from installed_error
        install_esbuild(base, quiet=quiet)
        return True


def install_esbuild(
    root: Path | None = None,
    *,
    platform_key: str | None = None,
    force: bool = False,
    verify_runtime: bool = True,
    quiet: bool = False,
) -> bool:
    base = (root or project_root()).resolve()
    selected_key = platform_key or current_platform_key()
    try:
        platform_install_path = PLATFORM_INSTALL_PATHS[selected_key]
    except KeyError as error:
        raise BootstrapError(f"Unsupported offline esbuild target: {selected_key!r}") from error

    # Locate every verified input before mutating node_modules.
    for install_path in (CORE_INSTALL_PATH, platform_install_path):
        package = _locked(base, install_path)
        try:
            locate_archive(base, package)
        except OfflineMirrorError as error:
            raise BootstrapError(str(error)) from error

    changed_platform = _install_package(
        base,
        platform_install_path,
        binary=Path("bin/esbuild"),
        force=force,
    )
    changed_core = _install_package(base, CORE_INSTALL_PATH, force=force)
    _write_cli_shim(base)
    if verify_runtime:
        verify_node_runtime(base)
    if not quiet:
        action = "installed" if changed_core or changed_platform else "already current"
        print(f"esbuild {locked_version(base)} ({selected_key}) is {action} from verified local archives.")
    return changed_core or changed_platform


def verify_offline_installation(root: Path | None = None, *, platform_key: str | None = None) -> None:
    base = (root or project_root()).resolve()
    selected_key = platform_key or current_platform_key()
    try:
        platform_install_path = PLATFORM_INSTALL_PATHS[selected_key]
    except KeyError as error:
        raise BootstrapError(f"Unsupported offline esbuild target: {selected_key!r}") from error
    if not _installation_is_current(base, CORE_INSTALL_PATH):
        raise BootstrapError("Offline esbuild core package is missing or modified.")
    if not _installation_is_current(base, platform_install_path, binary=Path("bin/esbuild")):
        raise BootstrapError("Offline esbuild Linux x64 binary package is missing or modified.")
    verify_node_runtime(base)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify archives and installation without writing")
    parser.add_argument("--force", action="store_true", help="Reinstall even when the local packages are current")
    parser.add_argument("--quiet", action="store_true", help="Suppress the success message")
    args = parser.parse_args()
    try:
        if args.check:
            verify_offline_installation()
            if not args.quiet:
                print(f"Offline esbuild {locked_version()} installation is valid.")
        else:
            install_esbuild(force=args.force, quiet=args.quiet)
    except (BootstrapError, OfflineMirrorError, OSError, tarfile.TarError, subprocess.SubprocessError) as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
