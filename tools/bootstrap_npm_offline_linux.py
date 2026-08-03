#!/usr/bin/env python3
"""Install the minimal chat/test npm toolchain from the Linux offline mirror."""
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
    OFFLINE_PACKAGE_PATH,
    TARGET_CPU,
    TARGET_LIBC,
    TARGET_OS,
    OfflineMirrorError,
    npm_executable,
    project_root,
    sha256_file,
    verify_mirror,
)

INSTALL_STAGE_PREFIX = ".npm-offline-install-"
NODE_MODULES_BACKUP_PREFIX = ".node_modules-offline-backup-"
TOOLCHAIN_PROBE = r"""
const esbuild = require("esbuild");
const typescript = require("typescript");
const playwright = require("@playwright/test");
const transformed = esbuild.transformSync("const answer: number = 42", { loader: "ts" });
if (!transformed.code.includes("42")) throw new Error("esbuild transform probe failed");
if (typeof typescript.version !== "string") throw new Error("TypeScript runtime probe failed");
if (typeof playwright.chromium?.launch !== "function") throw new Error("Playwright API probe failed");
console.log(`Offline chat npm toolchain verified: esbuild ${esbuild.version}, TypeScript ${typescript.version}, Playwright API loaded without browser binaries.`);
"""


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
            "The offline npm install is intentionally limited to the chat target "
            f"{TARGET_OS}/{TARGET_CPU}/{TARGET_LIBC}; detected {system}/{architecture}/{libc or 'unknown'}."
        )


def run(command: list[str], *, cwd: Path, environment: dict[str, str]) -> None:
    completed = subprocess.run(command, cwd=cwd, env=environment, check=False)
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


def _remove_path(path: Path) -> None:
    if path.is_symlink() or path.is_file():
        path.unlink(missing_ok=True)
    elif path.is_dir():
        shutil.rmtree(path)


def _replace_node_modules(root: Path, staged_node_modules: Path) -> None:
    target = root / "node_modules"
    with tempfile.TemporaryDirectory(prefix=NODE_MODULES_BACKUP_PREFIX, dir=root) as backup_name:
        backup = Path(backup_name) / "node_modules"
        moved_existing = False
        try:
            if target.exists() or target.is_symlink():
                os.replace(target, backup)
                moved_existing = True
            os.replace(staged_node_modules, target)
        except Exception:
            _remove_path(target)
            if moved_existing and backup.exists():
                os.replace(backup, target)
            raise


def install(root: Path) -> None:
    verify_host()
    verify_mirror(root)
    canonical_lock = root / "package-lock.json"
    canonical_package = root / "package.json"
    canonical_lock_hash = sha256_file(canonical_lock)
    canonical_package_hash = sha256_file(canonical_package)
    environment = _install_environment()

    # Install in a disposable sibling project. This lets npm use a generated,
    # pruned package descriptor without ever replacing the canonical package.json
    # or package-lock.json, and keeps the existing node_modules intact until the
    # new toolchain has installed and passed its runtime probes.
    with tempfile.TemporaryDirectory(prefix=INSTALL_STAGE_PREFIX, dir=root) as stage_name:
        stage = Path(stage_name)
        shutil.copy2(root / OFFLINE_PACKAGE_PATH, stage / "package.json")
        shutil.copy2(root / OFFLINE_LOCK_PATH, stage / "npm-shrinkwrap.json")
        (stage / "vendor").symlink_to(root / "vendor", target_is_directory=True)
        cache = stage / ".npm-cache"
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
            cwd=stage,
            environment=environment,
        )
        staged_node_modules = stage / "node_modules"
        if not staged_node_modules.is_dir():
            raise OfflineInstallError("npm ci completed without creating node_modules.")
        node = shutil.which("node")
        if node is None:
            raise OfflineInstallError("node is not available on PATH.")
        run([node, "-e", TOOLCHAIN_PROBE], cwd=stage, environment=environment)
        _replace_node_modules(root, staged_node_modules)

    if sha256_file(canonical_lock) != canonical_lock_hash:
        raise OfflineInstallError("npm modified package-lock.json during the offline install.")
    if sha256_file(canonical_package) != canonical_package_hash:
        raise OfflineInstallError("npm modified package.json during the offline install.")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify mirror completeness without installing")
    args = parser.parse_args()
    try:
        if args.check:
            verify_host()
            manifest = verify_mirror(project_root())
            print(
                "Offline chat npm inputs are valid for Linux x64/glibc: "
                f"{manifest['packageCount']} local tarballs; excluded roots: "
                f"{', '.join(manifest['excludedRootPackages']) or 'none'}."
            )
        else:
            install(project_root())
            print("Minimal chat/test npm toolchain installed from verified local tarballs.")
            print("Cloudflare deployment tooling and Playwright browsers are intentionally not installed.")
    except (OfflineMirrorError, OfflineInstallError, OSError, subprocess.SubprocessError) as error:
        parser.exit(1, f"ERROR: {error}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
