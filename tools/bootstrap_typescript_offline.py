#!/usr/bin/env python3
"""Install the pinned TypeScript 7 compiler from repository-local npm tarballs.

The bootstrap deliberately does not invoke npm. It installs only the
``typescript`` launcher package and the native compiler package for the current
platform, leaving every unrelated dependency in ``node_modules`` untouched.
Every archive is checked against the exact URL and SHA-512 integrity pinned in
``package-lock.json`` before extraction.
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
import tarfile
import tempfile
import uuid
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Final

TYPESCRIPT_VERSION: Final = "7.0.2"
VENDOR_DIRECTORY: Final = Path("vendor/npm/typescript")


@dataclass(frozen=True)
class ArchiveSpec:
    filename: str
    package_name: str
    resolved: str
    integrity: str
    install_path: Path
    required_files: tuple[Path, ...]
    executable_path: Path | None = None


CORE_ARCHIVE: Final = ArchiveSpec(
    filename="typescript-7.0.2.tgz",
    package_name="typescript",
    resolved="https://registry.npmjs.org/typescript/-/typescript-7.0.2.tgz",
    integrity="sha512-8FYau96o3NKOhbjKi/qNvG/W5jhzxkbdm5sj9AbZ/5T5sWqn3hJgLfGx27sRKZWTvyzCP8dLRBTf5tBTSRVUNA==",
    install_path=Path("node_modules/typescript"),
    required_files=(Path("bin/tsc"), Path("lib/getExePath.js"), Path("lib/tsc.js")),
)

PLATFORM_ARCHIVES: Final[dict[str, ArchiveSpec]] = {
    "linux-x64": ArchiveSpec(
        filename="typescript-linux-x64-7.0.2.tgz",
        package_name="@typescript/typescript-linux-x64",
        resolved=(
            "https://registry.npmjs.org/@typescript/typescript-linux-x64/"
            "-/typescript-linux-x64-7.0.2.tgz"
        ),
        integrity="sha512-EYdf2cNg7rgCWJnxCdJ+F3V39O8ihb37eHAu1LK8oAFizgTQbPOK7zHHXbPt8rX24COqODXeI3sIf0fCXG7H/A==",
        install_path=Path("node_modules/@typescript/typescript-linux-x64"),
        required_files=(Path("lib/tsc"),),
        executable_path=Path("lib/tsc"),
    ),
    "linux-arm64": ArchiveSpec(
        filename="typescript-linux-arm64-7.0.2.tgz",
        package_name="@typescript/typescript-linux-arm64",
        resolved=(
            "https://registry.npmjs.org/@typescript/typescript-linux-arm64/"
            "-/typescript-linux-arm64-7.0.2.tgz"
        ),
        integrity="sha512-Qh4eU4/y3yDjnfjjyPYihMj5/ODIlmt+Bzu17OI+fiSRDW57QmU5SiN63exPRNJPKUzcc1INa1NXdrJ+MqHjUQ==",
        install_path=Path("node_modules/@typescript/typescript-linux-arm64"),
        required_files=(Path("lib/tsc"),),
        executable_path=Path("lib/tsc"),
    ),
    "win32-x64": ArchiveSpec(
        filename="typescript-win32-x64-7.0.2.tgz",
        package_name="@typescript/typescript-win32-x64",
        resolved=(
            "https://registry.npmjs.org/@typescript/typescript-win32-x64/"
            "-/typescript-win32-x64-7.0.2.tgz"
        ),
        integrity="sha512-0BQ3HkAHHlKLSp1qRvf3SUhGpGsDuhB/jgFw75guyqbxJqEaS0Cw/VFO8i2nHglJUzQCRtMMR/IBAKE3ETMC4g==",
        install_path=Path("node_modules/@typescript/typescript-win32-x64"),
        required_files=(Path("lib/tsc.exe"),),
        executable_path=Path("lib/tsc.exe"),
    ),
}


class BootstrapError(RuntimeError):
    """Raised when the offline compiler cannot be trusted or installed."""


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
        raise BootstrapError(
            f"Unsupported CPU architecture for offline TypeScript: {machine!r}"
        ) from error


def current_platform_key(*, system: str | None = None, machine: str | None = None) -> str:
    detected_system = (system or platform.system()).strip().lower()
    architecture = normalize_architecture(machine or platform.machine())
    if detected_system == "linux" and architecture in {"x64", "arm64"}:
        return f"linux-{architecture}"
    if detected_system == "windows" and architecture == "x64":
        return "win32-x64"
    raise BootstrapError(
        "No vendored TypeScript compiler matches "
        f"system={system or platform.system()!r}, architecture={machine or platform.machine()!r}. "
        "Add the matching @typescript archive or use npm ci on that platform."
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

    expected = {
        "version": TYPESCRIPT_VERSION,
        "resolved": spec.resolved,
        "integrity": spec.integrity,
    }
    actual = {name: locked.get(name) for name in expected}
    if actual != expected:
        raise BootstrapError(
            f"Offline manifest drift for {spec.package_name}; package-lock.json contains "
            f"{actual!r}, expected {expected!r}."
        )


def verify_archive(root: Path, spec: ArchiveSpec) -> Path:
    verify_lock_contract(root, spec)
    archive = root / VENDOR_DIRECTORY / spec.filename
    if not archive.is_file():
        raise BootstrapError(
            f"Missing offline archive: {archive.relative_to(root)}. Download {spec.resolved} "
            f"and save it with the exact filename {spec.filename!r}."
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
    if metadata.get("name") != spec.package_name or metadata.get("version") != TYPESCRIPT_VERSION:
        raise BootstrapError(
            f"Unexpected package in {directory}: "
            f"name={metadata.get('name')!r}, version={metadata.get('version')!r}"
        )
    for relative in spec.required_files:
        required = directory / relative
        if not required.is_file():
            raise BootstrapError(f"Missing required TypeScript file after extraction: {required}")
    if spec.executable_path is not None and os.name != "nt":
        executable = directory / spec.executable_path
        executable.chmod(executable.stat().st_mode | 0o755)


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
        (bin_directory / "tsc.cmd").write_text(
            '@ECHO OFF\r\nnode "%~dp0\\..\\typescript\\bin\\tsc" %*\r\n',
            encoding="utf-8",
            newline="",
        )
        (bin_directory / "tsc.ps1").write_text(
            '#!/usr/bin/env pwsh\n& node "$PSScriptRoot/../typescript/bin/tsc" $args\n'
            "exit $LASTEXITCODE\n",
            encoding="utf-8",
        )
        return

    shim = bin_directory / "tsc"
    if shim.exists() or shim.is_symlink():
        shim.unlink()
    shim.symlink_to(Path("../typescript/bin/tsc"))


def _parse_node_version(version_text: str) -> tuple[int, int, int]:
    components = version_text.strip().removeprefix("v").split(".")
    if len(components) < 2:
        raise BootstrapError(f"Cannot parse Node.js version: {version_text!r}")
    try:
        major = int(components[0])
        minor = int(components[1])
        patch = int(components[2]) if len(components) > 2 else 0
    except ValueError as error:
        raise BootstrapError(f"Cannot parse Node.js version: {version_text!r}") from error
    return major, minor, patch


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
            f"Node.js {version_check.stdout.strip()} is too old; TypeScript 7 requires Node.js 16.20 or newer."
        )

    probe = subprocess.run(
        [node, str(root / CORE_ARCHIVE.install_path / "bin/tsc"), "--version"],
        cwd=root,
        text=True,
        capture_output=True,
        check=False,
    )
    if probe.returncode:
        details = (probe.stderr or probe.stdout).strip()
        raise BootstrapError(f"The installed offline TypeScript compiler failed its probe: {details}")
    expected = f"Version {TYPESCRIPT_VERSION}"
    if probe.stdout.strip() != expected:
        raise BootstrapError(
            f"Unexpected TypeScript compiler version: {probe.stdout.strip()!r}; expected {expected!r}."
        )


def verify_core_platform_contract(root: Path, platform_spec: ArchiveSpec) -> None:
    metadata = read_package_metadata(root / CORE_ARCHIVE.install_path)
    dependencies = metadata.get("optionalDependencies")
    if not isinstance(dependencies, dict) or dependencies.get(platform_spec.package_name) != TYPESCRIPT_VERSION:
        raise BootstrapError(
            f"The TypeScript launcher does not pin {platform_spec.package_name} to {TYPESCRIPT_VERSION}."
        )


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
        platform_spec = PLATFORM_ARCHIVES[selected_key]
    except KeyError as error:
        raise BootstrapError(f"Unsupported offline TypeScript target: {selected_key!r}") from error

    # Verify every input before replacing either installed package.
    verify_archive(base, CORE_ARCHIVE)
    verify_archive(base, platform_spec)
    changed_platform = install_archive(base, platform_spec, force=force)
    changed_core = install_archive(base, CORE_ARCHIVE, force=force)
    verify_core_platform_contract(base, platform_spec)
    _write_cli_shims(base)
    if verify_runtime:
        verify_node_runtime(base)

    if not quiet:
        action = "installed" if changed_core or changed_platform else "already current"
        print(
            f"TypeScript {TYPESCRIPT_VERSION} ({selected_key}) is {action} "
            "from verified local archives."
        )
    return changed_core or changed_platform


def verify_offline_installation(root: Path | None = None, *, platform_key: str | None = None) -> None:
    base = (root or project_root()).resolve()
    selected_key = platform_key or current_platform_key()
    try:
        platform_spec = PLATFORM_ARCHIVES[selected_key]
    except KeyError as error:
        raise BootstrapError(f"Unsupported offline TypeScript target: {selected_key!r}") from error

    for spec in (CORE_ARCHIVE, platform_spec):
        verify_archive(base, spec)
        if not installation_is_current(base, spec):
            raise BootstrapError(
                f"Offline TypeScript is not installed correctly at {spec.install_path}. "
                "Run: python tools/bootstrap_typescript_offline.py"
            )
    verify_core_platform_contract(base, platform_spec)
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
                print(f"Offline TypeScript {TYPESCRIPT_VERSION} installation is valid.")
        else:
            install_typescript(force=args.force, quiet=args.quiet)
    except (BootstrapError, OSError, tarfile.TarError, subprocess.SubprocessError) as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
