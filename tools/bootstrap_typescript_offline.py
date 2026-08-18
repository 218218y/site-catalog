#!/usr/bin/env python3
"""Install the lockfile-pinned TypeScript compiler from verified local archives.

The focused bootstrap installs only the TypeScript launcher and its Linux x64
native compiler. Versions, URLs and integrity values come from package-lock.json.
"""
from __future__ import annotations

import argparse
import errno
import sys
import json
import os
import platform
import shutil
import subprocess
import tarfile
import tempfile
import uuid
from pathlib import Path

TOOLS_DIRECTORY = Path(__file__).resolve().parent
if str(TOOLS_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIRECTORY))

from npm_offline_linux import (
    LockedPackage,
    OfflineMirrorError,
    directory_matches_archive,
    extract_npm_archive,
    locate_archive,
    locked_package,
    project_root,
)

CORE_INSTALL_PATH = "node_modules/typescript"
PLATFORM_INSTALL_PATHS = {"linux-x64": "node_modules/@typescript/typescript-linux-x64"}
CORE_REQUIRED_FILES = (Path("bin/tsc"), Path("lib/getExePath.js"), Path("lib/tsc.js"))
PLATFORM_REQUIRED_FILES = (Path("lib/tsc"),)


class BootstrapError(RuntimeError):
    """Raised when the focused TypeScript compiler cannot be trusted or installed."""


def _locked(root: Path, install_path: str) -> LockedPackage:
    try:
        return locked_package(root, install_path)
    except OfflineMirrorError as error:
        raise BootstrapError(str(error)) from error


def locked_version(root: Path | None = None) -> str:
    return _locked((root or project_root()).resolve(), CORE_INSTALL_PATH).version


TYPESCRIPT_VERSION = locked_version()


def normalize_architecture(machine: str) -> str:
    normalized = machine.strip().lower().replace("-", "_")
    if normalized in {"amd64", "x86_64", "x64"}:
        return "x64"
    raise BootstrapError(
        f"The verified offline TypeScript compiler targets Linux x64 only; detected architecture={machine!r}."
    )


def current_platform_key(*, system: str | None = None, machine: str | None = None) -> str:
    detected_system = (system or platform.system()).strip().lower()
    architecture = normalize_architecture(machine or platform.machine())
    if detected_system == "linux" and architecture == "x64":
        return "linux-x64"
    raise BootstrapError(
        "The verified offline TypeScript compiler is Linux x64 only; "
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


def _validate_directory(
    directory: Path,
    *,
    name: str,
    version: str,
    required_files: tuple[Path, ...],
    executable: Path | None = None,
) -> None:
    metadata = _read_package_metadata(directory)
    if metadata.get("name") != name or metadata.get("version") != version:
        raise BootstrapError(
            f"Unexpected package in {directory}: name={metadata.get('name')!r}, "
            f"version={metadata.get('version')!r}; expected {name}@{version}."
        )
    for required in required_files:
        if not (directory / required).is_file():
            raise BootstrapError(f"Missing required TypeScript file: {directory / required}")
    if executable is not None and os.name != "nt":
        executable_path = directory / executable
        executable_path.chmod(executable_path.stat().st_mode | 0o755)


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


def _package_contract(install_path: str) -> tuple[tuple[Path, ...], Path | None]:
    if install_path == CORE_INSTALL_PATH:
        return CORE_REQUIRED_FILES, None
    if install_path in PLATFORM_INSTALL_PATHS.values():
        return PLATFORM_REQUIRED_FILES, Path("lib/tsc")
    raise BootstrapError(f"Unsupported focused TypeScript package path: {install_path}")


def _installation_is_current(root: Path, install_path: str) -> bool:
    package = _locked(root, install_path)
    directory = root / install_path
    if not directory.is_dir():
        return False
    required_files, executable = _package_contract(install_path)
    try:
        archive = locate_archive(root, package)
        _validate_directory(
            directory,
            name=package.name,
            version=package.version,
            required_files=required_files,
            executable=executable,
        )
    except (BootstrapError, OfflineMirrorError):
        return False
    return directory_matches_archive(archive, directory)


def _install_package(root: Path, install_path: str, *, force: bool = False) -> bool:
    package = _locked(root, install_path)
    try:
        archive = locate_archive(root, package)
    except OfflineMirrorError as error:
        raise BootstrapError(str(error)) from error
    if not force and _installation_is_current(root, install_path):
        return False

    required_files, executable = _package_contract(install_path)
    target = root / install_path
    target.parent.mkdir(parents=True, exist_ok=True)
    staged = Path(tempfile.mkdtemp(prefix=f".{target.name}.offline-stage-", dir=target.parent))
    shutil.rmtree(staged)
    try:
        extract_npm_archive(archive, staged)
        _validate_directory(
            staged,
            name=package.name,
            version=package.version,
            required_files=required_files,
            executable=executable,
        )
        _replace_directory(staged, target)
    except OfflineMirrorError as error:
        raise BootstrapError(str(error)) from error
    finally:
        if staged.exists():
            shutil.rmtree(staged, ignore_errors=True)
    return True


def _symlink_creation_is_unavailable(error: OSError) -> bool:
    return getattr(error, "winerror", None) == 1314 or error.errno in {
        errno.EACCES,
        errno.EPERM,
        errno.ENOSYS,
        errno.ENOTSUP,
    }


def _write_cli_shim(root: Path) -> None:
    bin_directory = root / "node_modules/.bin"
    bin_directory.mkdir(parents=True, exist_ok=True)
    shim = bin_directory / "tsc"
    if shim.exists() or shim.is_symlink():
        shim.unlink()
    try:
        shim.symlink_to(Path("../typescript/bin/tsc"))
    except OSError as error:
        if not _symlink_creation_is_unavailable(error):
            raise
        # Windows commonly denies symlink creation without Developer Mode or
        # elevated privileges. The focused installer may still be exercised
        # there for archive/layout verification, so preserve the launcher by
        # copying it instead of requiring a host privilege unrelated to the
        # Linux-target package contract.
        shutil.copy2(root / "node_modules/typescript/bin/tsc", shim)


def _parse_node_version(version_text: str) -> tuple[int, int, int]:
    components = version_text.strip().removeprefix("v").split(".")
    if len(components) < 2:
        raise BootstrapError(f"Cannot parse Node.js version: {version_text!r}")
    try:
        return (
            int(components[0]),
            int(components[1]),
            int(components[2]) if len(components) > 2 else 0,
        )
    except ValueError as error:
        raise BootstrapError(f"Cannot parse Node.js version: {version_text!r}") from error


def verify_node_runtime(root: Path) -> None:
    node = shutil.which("node")
    if node is None:
        raise BootstrapError("Node.js is not available on PATH; install the version pinned in .nvmrc.")
    version_check = subprocess.run(
        [node, "-p", "process.versions.node"],
        cwd=root,
        text=True,
        capture_output=True,
        check=False,
    )
    if version_check.returncode:
        raise BootstrapError((version_check.stderr or version_check.stdout).strip())
    if _parse_node_version(version_check.stdout) < (16, 20, 0):
        raise BootstrapError(
            f"Node.js {version_check.stdout.strip()} is too old; TypeScript requires Node.js 16.20 or newer."
        )
    probe = subprocess.run(
        [node, str(root / CORE_INSTALL_PATH / "bin/tsc"), "--version"],
        cwd=root,
        text=True,
        capture_output=True,
        check=False,
    )
    if probe.returncode:
        details = (probe.stderr or probe.stdout).strip()
        raise BootstrapError(f"The installed offline TypeScript compiler failed its probe: {details}")
    expected = f"Version {locked_version(root)}"
    if probe.stdout.strip() != expected:
        raise BootstrapError(
            f"Unexpected TypeScript compiler version: {probe.stdout.strip()!r}; expected {expected!r}."
        )


def verify_core_platform_contract(root: Path, platform_install_path: str) -> None:
    metadata = _read_package_metadata(root / CORE_INSTALL_PATH)
    platform_package = _locked(root, platform_install_path)
    dependencies = metadata.get("optionalDependencies")
    if not isinstance(dependencies, dict) or dependencies.get(platform_package.name) != platform_package.version:
        raise BootstrapError(
            f"The TypeScript launcher does not pin {platform_package.name} to {platform_package.version}."
        )


def verify_installed_typescript(root: Path | None = None) -> None:
    base = (root or project_root()).resolve()
    core = _locked(base, CORE_INSTALL_PATH)
    required_files, executable = _package_contract(CORE_INSTALL_PATH)
    _validate_directory(
        base / CORE_INSTALL_PATH,
        name=core.name,
        version=core.version,
        required_files=required_files,
        executable=executable,
    )
    verify_node_runtime(base)


def ensure_typescript_available(root: Path | None = None, *, quiet: bool = True) -> bool:
    base = (root or project_root()).resolve()
    try:
        verify_installed_typescript(base)
        return False
    except BootstrapError as installed_error:
        try:
            current_platform_key()
        except BootstrapError:
            raise BootstrapError(
                f"Local TypeScript {locked_version(base)} is missing or unusable. "
                "Offline archives target Linux x64 only; run `npm ci` on this platform."
            ) from installed_error
        install_typescript(base, quiet=quiet)
        return True


def install_typescript(
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
        raise BootstrapError(f"Unsupported offline TypeScript target: {selected_key!r}") from error

    for install_path in (CORE_INSTALL_PATH, platform_install_path):
        package = _locked(base, install_path)
        try:
            locate_archive(base, package)
        except OfflineMirrorError as error:
            raise BootstrapError(str(error)) from error

    changed_platform = _install_package(base, platform_install_path, force=force)
    changed_core = _install_package(base, CORE_INSTALL_PATH, force=force)
    verify_core_platform_contract(base, platform_install_path)
    _write_cli_shim(base)
    if verify_runtime:
        verify_node_runtime(base)
    if not quiet:
        action = "installed" if changed_core or changed_platform else "already current"
        print(
            f"TypeScript {locked_version(base)} ({selected_key}) is {action} "
            "from verified local archives."
        )
    return changed_core or changed_platform


def verify_offline_installation(
    root: Path | None = None,
    *,
    platform_key: str | None = None,
    verify_runtime: bool = True,
) -> None:
    base = (root or project_root()).resolve()
    selected_key = platform_key or current_platform_key()
    try:
        platform_install_path = PLATFORM_INSTALL_PATHS[selected_key]
    except KeyError as error:
        raise BootstrapError(f"Unsupported offline TypeScript target: {selected_key!r}") from error
    if not _installation_is_current(base, CORE_INSTALL_PATH):
        raise BootstrapError("Offline TypeScript launcher package is missing or modified.")
    if not _installation_is_current(base, platform_install_path):
        raise BootstrapError("Offline TypeScript Linux x64 compiler package is missing or modified.")
    verify_core_platform_contract(base, platform_install_path)
    if verify_runtime:
        verify_node_runtime(base)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify archives and installation without writing")
    parser.add_argument("--force", action="store_true", help="Reinstall even when local packages are current")
    parser.add_argument("--quiet", action="store_true", help="Suppress the success message")
    args = parser.parse_args()
    try:
        if args.check:
            verify_offline_installation()
            if not args.quiet:
                print(f"Offline TypeScript {locked_version()} installation is valid.")
        else:
            install_typescript(force=args.force, quiet=args.quiet)
    except (BootstrapError, OfflineMirrorError, OSError, tarfile.TarError, subprocess.SubprocessError) as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
