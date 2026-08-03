#!/usr/bin/env python3
"""Install npm dependencies from the verified Linux x64/glibc mirror."""
from __future__ import annotations

import argparse
import os
import platform
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

TOOLS_DIRECTORY = Path(__file__).resolve().parent
if str(TOOLS_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIRECTORY))

from npm_offline_linux import (
    OFFLINE_LOCK_PATH,
    TARGET_CPU,
    TARGET_LIBC,
    TARGET_OS,
    OfflineMirrorError,
    npm_executable,
    project_root,
    sha256_file,
    verify_mirror,
)

TEMPORARY_SHRINKWRAP = Path("npm-shrinkwrap.json")


class OfflineInstallError(RuntimeError):
    """Raised when npm cannot be installed from the repository mirror."""


def verify_host() -> None:
    system = platform.system().lower()
    machine = platform.machine().lower().replace("-", "_")
    architecture = "x64" if machine in {"x86_64", "amd64", "x64"} else machine
    libc_name, _ = platform.libc_ver()
    libc = "glibc" if libc_name.lower() in {"glibc", "gnu libc"} else libc_name.lower()
    if (system, architecture, libc) != (TARGET_OS, TARGET_CPU, TARGET_LIBC):
        raise OfflineInstallError(
            "The complete offline npm install is intentionally limited to the chat target "
            f"{TARGET_OS}/{TARGET_CPU}/{TARGET_LIBC}; detected {system}/{architecture}/{libc or 'unknown'}."
        )


def run(command: list[str], *, root: Path, environment: dict[str, str]) -> None:
    completed = subprocess.run(command, cwd=root, env=environment, check=False)
    if completed.returncode:
        raise OfflineInstallError(f"Command failed with exit code {completed.returncode}: {' '.join(command)}")


def _install_environment() -> dict[str, str]:
    environment = os.environ.copy()
    environment.update(
        {
            "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1",
            "npm_config_audit": "false",
            "npm_config_fund": "false",
            "npm_config_update_notifier": "false",
        }
    )
    return environment


def install(root: Path) -> None:
    verify_host()
    verify_mirror(root)
    canonical_lock = root / "package-lock.json"
    canonical_hash = sha256_file(canonical_lock)
    offline_lock = root / OFFLINE_LOCK_PATH
    shrinkwrap = root / TEMPORARY_SHRINKWRAP
    if shrinkwrap.exists() or shrinkwrap.is_symlink():
        raise OfflineInstallError(
            f"Refusing to overwrite existing {TEMPORARY_SHRINKWRAP}; remove or commit it intentionally first."
        )

    # npm has no alternate-lockfile flag. npm-shrinkwrap.json has precedence
    # over package-lock.json, so expose the verified local-file lock only for
    # the duration of npm ci and remove it unconditionally afterwards.
    shutil.copy2(offline_lock, shrinkwrap)
    try:
        with tempfile.TemporaryDirectory(prefix=".npm-offline-cache-", dir=root) as cache:
            run(
                [
                    npm_executable(),
                    "ci",
                    "--offline",
                    "--cache",
                    cache,
                    "--no-audit",
                    "--no-fund",
                ],
                root=root,
                environment=_install_environment(),
            )
    finally:
        shrinkwrap.unlink(missing_ok=True)
    if sha256_file(canonical_lock) != canonical_hash:
        raise OfflineInstallError("npm modified package-lock.json during the offline install.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify mirror completeness without installing")
    args = parser.parse_args()
    try:
        if args.check:
            verify_host()
            manifest = verify_mirror(project_root())
            print(
                "Offline npm install inputs are valid for Linux x64/glibc: "
                f"{manifest['packageCount']} local tarballs."
            )
        else:
            install(project_root())
            print("Complete npm dependency tree installed directly from verified local tarballs.")
            print("Playwright browsers were not installed; use `npm run setup:browsers` only when needed.")
    except (OfflineMirrorError, OfflineInstallError, OSError, subprocess.SubprocessError) as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
