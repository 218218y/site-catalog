#!/usr/bin/env python3
"""Install the complete npm lockfile from the verified Linux x64/glibc mirror."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path

TOOLS_DIRECTORY = Path(__file__).resolve().parent
if str(TOOLS_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIRECTORY))

from npm_offline_linux import (
    TARGET_CPU,
    TARGET_LIBC,
    TARGET_OS,
    OfflineMirrorError,
    project_root,
    unique_archive_paths,
    verify_mirror,
)

CACHE_DIRECTORY = Path(".cache/npm-offline-linux")
STAMP_FILE = CACHE_DIRECTORY / "mirror-stamp.sha256"


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


def npm_executable() -> str:
    executable = shutil.which("npm")
    if executable is None:
        raise OfflineInstallError("npm is not available on PATH; install the Node.js version pinned in .nvmrc.")
    return executable


def manifest_stamp(manifest: dict[str, object]) -> str:
    payload = json.dumps(manifest, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def run(command: list[str], *, root: Path, environment: dict[str, str]) -> None:
    completed = subprocess.run(command, cwd=root, env=environment, check=False)
    if completed.returncode:
        raise OfflineInstallError(f"Command failed with exit code {completed.returncode}: {' '.join(command)}")


def seed_cache(root: Path, manifest: dict[str, object], *, force: bool = False) -> Path:
    cache = root / CACHE_DIRECTORY
    stamp = manifest_stamp(manifest)
    stamp_path = root / STAMP_FILE
    if not force and stamp_path.is_file() and stamp_path.read_text(encoding="utf-8").strip() == stamp:
        return cache

    shutil.rmtree(cache, ignore_errors=True)
    cache.mkdir(parents=True, exist_ok=True)
    environment = os.environ.copy()
    environment.update(
        {
            "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1",
            "npm_config_audit": "false",
            "npm_config_fund": "false",
            "npm_config_update_notifier": "false",
        }
    )
    npm = npm_executable()
    for archive in unique_archive_paths(root, manifest):
        run([npm, "cache", "add", "--cache", str(cache), str(archive)], root=root, environment=environment)
    stamp_path.write_text(stamp + "\n", encoding="utf-8")
    return cache


def install(root: Path, *, force_cache: bool = False) -> None:
    verify_host()
    manifest = verify_mirror(root)
    cache = seed_cache(root, manifest, force=force_cache)
    environment = os.environ.copy()
    environment.update(
        {
            "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1",
            "npm_config_audit": "false",
            "npm_config_fund": "false",
            "npm_config_update_notifier": "false",
        }
    )
    run(
        [
            npm_executable(),
            "ci",
            "--offline",
            "--cache",
            str(cache),
            "--no-audit",
            "--no-fund",
        ],
        root=root,
        environment=environment,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify mirror completeness without installing")
    parser.add_argument("--force-cache", action="store_true", help="Rebuild the local npm cache before install")
    args = parser.parse_args()
    try:
        if args.check:
            verify_host()
            manifest = verify_mirror(project_root())
            print(
                "Offline npm install inputs are valid for Linux x64/glibc: "
                f"{manifest['packageCount']} packages."
            )
        else:
            install(project_root(), force_cache=args.force_cache)
            print("Complete npm dependency tree installed from the verified local mirror.")
            print("Playwright browsers were not installed; use `npm run setup:browsers` only when needed.")
    except (OfflineMirrorError, OfflineInstallError, OSError, subprocess.SubprocessError) as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
