#!/usr/bin/env python3
"""Install the pinned esbuild runtime from repository-local npm tarballs.

This deliberately does not invoke npm. It installs only ``esbuild`` and the
platform binary needed by the current machine, leaving every other package in
``node_modules`` untouched. The vendored archives are verified against the
SHA-512 integrity values pinned in ``package-lock.json`` before extraction.
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Final

ESBUILD_VERSION: Final = "0.28.1"
VENDOR_DIRECTORY: Final = Path("vendor/npm/esbuild")


@dataclass(frozen=True)
class ArchiveSpec:
    filename: str
    package_name: str
    integrity: str
    install_path: Path
    binary_path: Path | None = None
    binary_sha256: str | None = None


CORE_ARCHIVE: Final = ArchiveSpec(
    filename="esbuild-0.28.1.tgz",
    package_name="esbuild",
    integrity="sha512-HrJrvZv5ayxBzPfwphOoNzkzOIIlifzk0KJrGK2c8R4+LKpMtpYLQeUdjnwjWv/LZlkH2laZk+4w78pi99D4Vw==",
    install_path=Path("node_modules/esbuild"),
)

PLATFORM_ARCHIVES: Final[dict[str, ArchiveSpec]] = {
    "linux-x64": ArchiveSpec(
        filename="linux-x64-0.28.1.tgz",
        package_name="@esbuild/linux-x64",
        integrity="sha512-u/anNYF2mmVOEDwLtnQ1wOr3EZ9sTNGLWrsYGYwHWzGA3Si84IOkHXlbWTD1NB+9/1lcnweYKO54uhxZydNzfA==",
        install_path=Path("node_modules/@esbuild/linux-x64"),
        binary_path=Path("bin/esbuild"),
        binary_sha256="0c6588b092a2c291a72bab90659f3c9e0e25e0fe59c9ac12b4dae4d945e5548c",
    ),
    "linux-arm64": ArchiveSpec(
        filename="linux-arm64-0.28.1.tgz",
        package_name="@esbuild/linux-arm64",
        integrity="sha512-yHs+0uc8+nvEAfAfxrWQKK5peSNzBc4PegcMO0EJ2hT71uA7vB8Ihg2e77R2P7SG5uYjPbHlLLmve4LLLRCf0g==",
        install_path=Path("node_modules/@esbuild/linux-arm64"),
        binary_path=Path("bin/esbuild"),
        binary_sha256="51e829ba36f36be6d9aea6e329ddc4f9350302339b16aaca96a3cb97f64a8ebb",
    ),
    "win32-x64": ArchiveSpec(
        filename="win32-x64-0.28.1.tgz",
        package_name="@esbuild/win32-x64",
        integrity="sha512-bm4Mowrv+GXMlpWX++EcXw/iLyd1o3+bJkC2DkWXYVvgZCqD/bSj9ctZeAMC3cIxgjRVR2Dufaiu4YPxr5gW1A==",
        install_path=Path("node_modules/@esbuild/win32-x64"),
        binary_path=Path("esbuild.exe"),
        binary_sha256="ec02ee9b14ab332416fedd10614dfb80eed5304d94f67745067c011934a8c3c3",
    ),
}


class BootstrapError(RuntimeError):
    """Raised when the offline runtime cannot be trusted or installed."""


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def normalize_architecture(machine: str) -> str:
    normalized = machine.strip().lower().replace("-", "_")
    aliases = {
        "amd64": "x64",
        "x86_64": "x64",
        "x64": "x64",
        "aarch64": "arm64",
        "arm64": "arm64",
    }
    try:
        return aliases[normalized]
    except KeyError as error:
        raise BootstrapError(f"Unsupported CPU architecture for offline esbuild: {machine!r}") from error


def current_platform_key(*, system: str | None = None, machine: str | None = None) -> str:
    detected_system = (system or platform.system()).strip().lower()
    architecture = normalize_architecture(machine or platform.machine())
    if detected_system == "linux" and architecture in {"x64", "arm64"}:
        return f"linux-{architecture}"
    if detected_system == "windows" and architecture == "x64":
        return "win32-x64"
    raise BootstrapError(
        "No vendored esbuild binary matches "
        f"system={system or platform.system()!r}, architecture={machine or platform.machine()!r}. "
        "Run npm ci on this platform or add its matching @esbuild archive."
    )


def sri_sha512(path: Path) -> str:
    digest = hashlib.sha512(path.read_bytes()).digest()
    return "sha512-" + base64.b64encode(digest).decode("ascii")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_lock_contract(root: Path, spec: ArchiveSpec) -> None:
    lock_path = root / "package-lock.json"
    try:
        lock = json.loads(lock_path.read_text(encoding="utf-8"))
        locked = lock["packages"][spec.install_path.as_posix()]
    except (OSError, json.JSONDecodeError, KeyError, TypeError) as error:
        raise BootstrapError(f"Cannot verify {spec.package_name} against {lock_path}") from error
    if locked.get("version") != ESBUILD_VERSION or locked.get("integrity") != spec.integrity:
        raise BootstrapError(
            f"Offline manifest drift for {spec.package_name}; package-lock.json does not match "
            f"version {ESBUILD_VERSION} and the pinned SHA-512 integrity."
        )


def verify_archive(root: Path, spec: ArchiveSpec) -> Path:
    verify_lock_contract(root, spec)
    archive = root / VENDOR_DIRECTORY / spec.filename
    if not archive.is_file():
        raise BootstrapError(
            f"Missing offline archive: {archive.relative_to(root)}. "
            "Restore the vendored esbuild files before building."
        )
    actual_integrity = sri_sha512(archive)
    if actual_integrity != spec.integrity:
        raise BootstrapError(
            f"Integrity check failed for {archive.relative_to(root)}; "
            f"expected {spec.integrity}, received {actual_integrity}."
        )
    return archive


def _safe_relative_member(member_name: str) -> PurePosixPath | None:
    member = PurePosixPath(member_name)
    if member.is_absolute() or not member.parts or member.parts[0] != "package":
        raise BootstrapError(f"Unsafe npm archive member: {member_name!r}")
    relative_parts = member.parts[1:]
    if not relative_parts:
        return None
    if any(part in {"", ".", ".."} for part in relative_parts):
        raise BootstrapError(f"Unsafe npm archive member: {member_name!r}")
    return PurePosixPath(*relative_parts)


def extract_verified_archive(archive: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=False)
    try:
        with tarfile.open(archive, mode="r:gz") as bundle:
            for member in bundle.getmembers():
                relative = _safe_relative_member(member.name)
                if relative is None:
                    continue
                target = destination.joinpath(*relative.parts)
                if member.isdir():
                    target.mkdir(parents=True, exist_ok=True)
                    continue
                if not member.isfile():
                    raise BootstrapError(
                        f"Unsupported link or special file in {archive.name}: {member.name!r}"
                    )
                source = bundle.extractfile(member)
                if source is None:
                    raise BootstrapError(f"Cannot read {member.name!r} from {archive.name}")
                target.parent.mkdir(parents=True, exist_ok=True)
                with source, target.open("wb") as output:
                    shutil.copyfileobj(source, output)
                if os.name != "nt":
                    target.chmod(member.mode & 0o777)
    except Exception:
        shutil.rmtree(destination, ignore_errors=True)
        raise


def read_package_metadata(directory: Path) -> dict[str, object]:
    package_json = directory / "package.json"
    try:
        value = json.loads(package_json.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise BootstrapError(f"Invalid installed package metadata: {package_json}") from error
    if not isinstance(value, dict):
        raise BootstrapError(f"Invalid installed package metadata: {package_json}")
    return value


def validate_package_directory(directory: Path, spec: ArchiveSpec) -> None:
    metadata = read_package_metadata(directory)
    if metadata.get("name") != spec.package_name or metadata.get("version") != ESBUILD_VERSION:
        raise BootstrapError(
            f"Unexpected package in {directory}: "
            f"name={metadata.get('name')!r}, version={metadata.get('version')!r}"
        )
    if spec.binary_path is not None:
        binary = directory / spec.binary_path
        if not binary.is_file():
            raise BootstrapError(f"Missing esbuild binary after extraction: {binary}")
        actual_hash = sha256_file(binary)
        if actual_hash != spec.binary_sha256:
            raise BootstrapError(
                f"Binary hash failed for {binary}; expected {spec.binary_sha256}, received {actual_hash}."
            )
        if os.name != "nt":
            binary.chmod(binary.stat().st_mode | 0o755)


def directory_matches_archive(archive: Path, directory: Path) -> bool:
    expected_files: dict[PurePosixPath, str] = {}
    try:
        with tarfile.open(archive, mode="r:gz") as bundle:
            for member in bundle.getmembers():
                relative = _safe_relative_member(member.name)
                if relative is None or member.isdir():
                    continue
                if not member.isfile():
                    return False
                source = bundle.extractfile(member)
                if source is None:
                    return False
                with source:
                    expected_files[relative] = hashlib.sha256(source.read()).hexdigest()
    except (BootstrapError, OSError, tarfile.TarError):
        return False

    actual_files = {
        PurePosixPath(path.relative_to(directory).as_posix())
        for path in directory.rglob("*")
        if path.is_file() and not path.is_symlink()
    }
    if actual_files != set(expected_files):
        return False
    return all(
        sha256_file(directory.joinpath(*relative.parts)) == expected_hash
        for relative, expected_hash in expected_files.items()
    )


def installation_is_current(root: Path, spec: ArchiveSpec) -> bool:
    directory = root / spec.install_path
    if not directory.is_dir():
        return False
    try:
        archive = verify_archive(root, spec)
        validate_package_directory(directory, spec)
    except BootstrapError:
        return False
    return directory_matches_archive(archive, directory)


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


def install_archive(root: Path, spec: ArchiveSpec, *, force: bool = False) -> bool:
    archive = verify_archive(root, spec)
    target = root / spec.install_path
    if not force and installation_is_current(root, spec):
        return False

    target.parent.mkdir(parents=True, exist_ok=True)
    staged = Path(tempfile.mkdtemp(prefix=f".{target.name}.offline-stage-", dir=target.parent))
    shutil.rmtree(staged)
    try:
        extract_verified_archive(archive, staged)
        validate_package_directory(staged, spec)
        _replace_directory(staged, target)
    finally:
        if staged.exists():
            shutil.rmtree(staged, ignore_errors=True)
    return True


def _write_cli_shims(root: Path) -> None:
    bin_directory = root / "node_modules/.bin"
    bin_directory.mkdir(parents=True, exist_ok=True)
    if os.name == "nt":
        (bin_directory / "esbuild.cmd").write_text(
            '@ECHO OFF\r\nnode "%~dp0\\..\\esbuild\\bin\\esbuild" %*\r\n',
            encoding="utf-8",
            newline="",
        )
        (bin_directory / "esbuild.ps1").write_text(
            '#!/usr/bin/env pwsh\n& node "$PSScriptRoot/../esbuild/bin/esbuild" $args\nexit $LASTEXITCODE\n',
            encoding="utf-8",
        )
        return

    shim = bin_directory / "esbuild"
    if shim.exists() or shim.is_symlink():
        shim.unlink()
    shim.symlink_to(Path("../esbuild/bin/esbuild"))


def verify_node_runtime(root: Path) -> None:
    node = shutil.which("node")
    if node is None:
        raise BootstrapError("Node.js is not available on PATH; install Node.js 18 or newer.")

    version_check = subprocess.run(
        [node, "-p", "process.versions.node"],
        cwd=root,
        text=True,
        capture_output=True,
        check=False,
    )
    if version_check.returncode:
        raise BootstrapError((version_check.stderr or version_check.stdout).strip())
    version_text = version_check.stdout.strip()
    try:
        major = int(version_text.split(".", 1)[0])
    except ValueError as error:
        raise BootstrapError(f"Cannot parse Node.js version: {version_text!r}") from error
    if major < 18:
        raise BootstrapError(f"Node.js {version_text} is too old; esbuild requires Node.js 18 or newer.")

    environment = os.environ.copy()
    environment.pop("ESBUILD_BINARY_PATH", None)
    probe = subprocess.run(
        [
            node,
            "--input-type=module",
            "--eval",
            (
                "import { transformSync, version } from 'esbuild';"
                f"if (version !== '{ESBUILD_VERSION}') throw new Error('version=' + version);"
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
        platform_spec = PLATFORM_ARCHIVES[selected_key]
    except KeyError as error:
        raise BootstrapError(f"Unsupported offline esbuild target: {selected_key!r}") from error

    # Validate the complete local input set before mutating node_modules.
    verify_archive(base, CORE_ARCHIVE)
    verify_archive(base, platform_spec)
    changed_platform = install_archive(base, platform_spec, force=force)
    changed_core = install_archive(base, CORE_ARCHIVE, force=force)
    _write_cli_shims(base)
    if verify_runtime:
        verify_node_runtime(base)

    if not quiet:
        action = "installed" if changed_core or changed_platform else "already current"
        print(f"esbuild {ESBUILD_VERSION} ({selected_key}) is {action} from verified local archives.")
    return changed_core or changed_platform


def verify_offline_installation(root: Path | None = None, *, platform_key: str | None = None) -> None:
    base = (root or project_root()).resolve()
    selected_key = platform_key or current_platform_key()
    try:
        platform_spec = PLATFORM_ARCHIVES[selected_key]
    except KeyError as error:
        raise BootstrapError(f"Unsupported offline esbuild target: {selected_key!r}") from error

    for spec in (CORE_ARCHIVE, platform_spec):
        verify_archive(base, spec)
        if not installation_is_current(base, spec):
            raise BootstrapError(
                f"Offline esbuild is not installed correctly at {spec.install_path}. "
                "Run: python tools/bootstrap_esbuild_offline.py"
            )
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
                print(f"Offline esbuild {ESBUILD_VERSION} installation is valid.")
        else:
            install_esbuild(force=args.force, quiet=args.quiet)
    except (BootstrapError, OSError, tarfile.TarError, subprocess.SubprocessError) as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
