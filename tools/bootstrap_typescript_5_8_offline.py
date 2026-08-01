#!/usr/bin/env python3
"""Install the pinned TypeScript 5.8 compatibility compiler without npm."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import shutil
import subprocess
import tarfile
import tempfile
import uuid
from pathlib import Path, PurePosixPath
from typing import Final

VERSION: Final = "5.8.3"
PACKAGE_NAME: Final = "typescript"
DEPENDENCY_NAME: Final = "typescript-5-8"
RESOLVED: Final = "https://registry.npmjs.org/typescript/-/typescript-5.8.3.tgz"
INTEGRITY: Final = "sha512-p1diW6TqL9L07nNxvRMM7hMMw4c5XOo/1ibL4aAIGmSAt9slTE1Xgw5KWuof2uTOvCg9BY7ZRi+GaF+7sfgPeQ=="
ARCHIVE_PATH: Final = Path("vendor/npm/typescript-5-8/typescript-5.8.3.tgz")
INSTALL_PATH: Final = Path("node_modules/typescript-5-8")
REQUIRED_FILES: Final = (Path("bin/tsc"), Path("lib/tsc.js"), Path("lib/typescript.js"))


class BootstrapError(RuntimeError):
    """Raised when the compatibility compiler cannot be trusted or installed."""


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def sri_sha512(path: Path) -> str:
    digest = hashlib.sha512(path.read_bytes()).digest()
    return "sha512-" + base64.b64encode(digest).decode("ascii")



def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_relative_member(member_name: str) -> PurePosixPath | None:
    member = PurePosixPath(member_name)
    if member.is_absolute() or not member.parts or member.parts[0] != "package":
        raise BootstrapError(f"Unsafe npm archive member: {member_name!r}")
    parts = member.parts[1:]
    if not parts:
        return None
    if any(part in {"", ".", ".."} for part in parts):
        raise BootstrapError(f"Unsafe npm archive member: {member_name!r}")
    return PurePosixPath(*parts)


def verify_lock_contract(root: Path) -> None:
    try:
        lock = json.loads((root / "package-lock.json").read_text(encoding="utf-8"))
        root_dependency = lock["packages"][""]["devDependencies"][DEPENDENCY_NAME]
        package = lock["packages"][INSTALL_PATH.as_posix()]
    except (OSError, json.JSONDecodeError, KeyError, TypeError) as error:
        raise BootstrapError("Cannot verify TypeScript 5.8 against package-lock.json") from error

    if root_dependency != f"npm:{PACKAGE_NAME}@{VERSION}":
        raise BootstrapError(
            f"package-lock.json must pin {DEPENDENCY_NAME} to npm:{PACKAGE_NAME}@{VERSION}"
        )
    expected = {"name": PACKAGE_NAME, "version": VERSION, "resolved": RESOLVED, "integrity": INTEGRITY}
    actual = {name: package.get(name) for name in expected}
    if actual != expected:
        raise BootstrapError(f"TypeScript 5.8 lock metadata drift: {actual!r}, expected {expected!r}")


def verify_archive(root: Path) -> Path:
    verify_lock_contract(root)
    archive = root / ARCHIVE_PATH
    if not archive.is_file():
        raise BootstrapError(f"Missing offline archive: {ARCHIVE_PATH}")
    actual = sri_sha512(archive)
    if actual != INTEGRITY:
        raise BootstrapError(f"Integrity check failed for {ARCHIVE_PATH}; received {actual}")
    return archive


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
                    raise BootstrapError(f"Unsupported link or special file: {member.name!r}")
                source = bundle.extractfile(member)
                if source is None:
                    raise BootstrapError(f"Cannot read archive member: {member.name!r}")
                target.parent.mkdir(parents=True, exist_ok=True)
                with source, target.open("wb") as output:
                    shutil.copyfileobj(source, output)
                if os.name != "nt":
                    target.chmod(member.mode & 0o777)
    except Exception:
        shutil.rmtree(destination, ignore_errors=True)
        raise


def validate_installation(directory: Path) -> None:
    try:
        metadata = json.loads((directory / "package.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise BootstrapError(f"Invalid TypeScript 5.8 package metadata in {directory}") from error
    if metadata.get("name") != PACKAGE_NAME or metadata.get("version") != VERSION:
        raise BootstrapError(
            f"Unexpected package in {directory}: {metadata.get('name')!r}@{metadata.get('version')!r}"
        )
    for relative in REQUIRED_FILES:
        if not (directory / relative).is_file():
            raise BootstrapError(f"Missing TypeScript 5.8 file: {directory / relative}")


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


def compiler_is_valid(root: Path) -> bool:
    directory = root / INSTALL_PATH
    if not directory.is_dir():
        return False
    try:
        archive = verify_archive(root)
        validate_installation(directory)
    except BootstrapError:
        return False
    if not directory_matches_archive(archive, directory):
        return False
    completed = subprocess.run(
        [shutil.which("node") or "node", str(directory / "bin/tsc"), "--version"],
        cwd=root,
        text=True,
        capture_output=True,
        check=False,
    )
    return completed.returncode == 0 and completed.stdout.strip() == f"Version {VERSION}"


def install(root: Path, *, force: bool = False) -> bool:
    archive = verify_archive(root)
    if not force and compiler_is_valid(root):
        return False
    target = root / INSTALL_PATH
    target.parent.mkdir(parents=True, exist_ok=True)
    staged = Path(tempfile.mkdtemp(prefix=".typescript-5-8-stage-", dir=target.parent))
    shutil.rmtree(staged)
    backup = target.with_name(f".{target.name}.offline-backup-{uuid.uuid4().hex}")
    try:
        extract_verified_archive(archive, staged)
        validate_installation(staged)
        had_target = target.exists() or target.is_symlink()
        if had_target:
            os.replace(target, backup)
        try:
            os.replace(staged, target)
        except Exception:
            if had_target and backup.exists():
                os.replace(backup, target)
            raise
        if backup.exists():
            shutil.rmtree(backup, ignore_errors=True)
    finally:
        shutil.rmtree(staged, ignore_errors=True)
    if not compiler_is_valid(root):
        raise BootstrapError("Installed TypeScript 5.8 compiler failed its version probe")
    return True


def ensure_typescript_5_8_available(root: Path | None = None, *, quiet: bool = False) -> Path:
    base = root or project_root()
    changed = install(base)
    if not quiet:
        action = "installed" if changed else "is available"
        print(f"TypeScript {VERSION} compatibility compiler {action} from a verified local archive.")
    return base / INSTALL_PATH / "bin/tsc"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()
    root = project_root()
    verify_archive(root)
    if args.check:
        if not compiler_is_valid(root):
            raise SystemExit("TypeScript 5.8 compatibility compiler is missing or invalid")
        if not args.quiet:
            print(f"TypeScript {VERSION} compatibility compiler is valid.")
        return 0
    install(root, force=args.force)
    if not args.quiet:
        print(f"TypeScript {VERSION} compatibility compiler is ready.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BootstrapError as error:
        raise SystemExit(str(error)) from error
