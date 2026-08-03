from __future__ import annotations

import base64
import hashlib
import importlib.util
import io
import json
import shutil
import sys
import tarfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

import npm_offline_linux as MODULE  # noqa: E402

BOOTSTRAP_SPEC = importlib.util.spec_from_file_location(
    "bootstrap_npm_offline_linux",
    TOOLS / "bootstrap_npm_offline_linux.py",
)
assert BOOTSTRAP_SPEC and BOOTSTRAP_SPEC.loader
BOOTSTRAP = importlib.util.module_from_spec(BOOTSTRAP_SPEC)
sys.modules[BOOTSTRAP_SPEC.name] = BOOTSTRAP
BOOTSTRAP_SPEC.loader.exec_module(BOOTSTRAP)


def write_archive(
    path: Path,
    *,
    name: str,
    version: str,
    extra_files: dict[str, bytes] | None = None,
) -> str:
    files = {
        "package.json": json.dumps(
            {"name": name, "version": version, "main": "index.js"},
            separators=(",", ":"),
        ).encode(),
        "index.js": b"module.exports = 'offline fixture';\n",
        **(extra_files or {}),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(path, mode="w:gz") as bundle:
        for relative, content in sorted(files.items()):
            info = tarfile.TarInfo(f"package/{relative}")
            info.size = len(content)
            info.mode = 0o644
            bundle.addfile(info, io.BytesIO(content))
    digest = hashlib.sha512(path.read_bytes()).digest()
    return "sha512-" + base64.b64encode(digest).decode("ascii")


def write_lock(root: Path, packages: dict[str, dict[str, object]], dev_dependencies: dict[str, str]) -> None:
    lock = {
        "name": "offline-fixture-project",
        "version": "1.0.0",
        "lockfileVersion": 3,
        "requires": True,
        "packages": {
            "": {
                "name": "offline-fixture-project",
                "version": "1.0.0",
                "devDependencies": dev_dependencies,
            },
            **packages,
        },
    }
    (root / "package-lock.json").write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")
    (root / "package.json").write_text(
        json.dumps(
            {
                "name": "offline-fixture-project",
                "version": "1.0.0",
                "private": True,
                "devDependencies": dev_dependencies,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def fixture_project(root: Path) -> None:
    legacy = root / "vendor/npm/legacy"
    alpha_integrity = write_archive(
        legacy / "alpha.tgz",
        name="offline-alpha",
        version="1.2.3",
    )
    owner_integrity = write_archive(
        legacy / "owner.tgz",
        name="offline-owner",
        version="2.0.0",
        extra_files={
            "node_modules/offline-bundled/package.json": json.dumps(
                {"name": "offline-bundled", "version": "3.0.0"},
                separators=(",", ":"),
            ).encode(),
            "node_modules/offline-bundled/index.js": b"module.exports = 3;\n",
        },
    )
    playwright_integrity = write_archive(
        legacy / "playwright-test.tgz",
        name="@playwright/test",
        version="1.0.0",
    )
    linux_integrity = write_archive(
        legacy / "linux-native.tgz",
        name="@fixture/linux-x64",
        version="4.0.0",
    )
    windows_integrity = write_archive(
        legacy / "windows-native.tgz",
        name="@fixture/win32-x64",
        version="4.0.0",
    )
    arm_integrity = write_archive(
        legacy / "linux-arm64.tgz",
        name="@fixture/linux-arm64",
        version="4.0.0",
    )
    musl_integrity = write_archive(
        legacy / "linuxmusl-x64.tgz",
        name="@fixture/linuxmusl-x64",
        version="4.0.0",
    )
    write_lock(
        root,
        {
            "node_modules/offline-alpha": {
                "version": "1.2.3",
                "resolved": "https://registry.npmjs.org/offline-alpha/-/offline-alpha-1.2.3.tgz",
                "integrity": alpha_integrity,
                "dev": True,
            },
            "node_modules/offline-owner": {
                "version": "2.0.0",
                "resolved": "https://registry.npmjs.org/offline-owner/-/offline-owner-2.0.0.tgz",
                "integrity": owner_integrity,
                "dependencies": {"offline-bundled": "3.0.0"},
                "dev": True,
            },
            "node_modules/offline-bundled": {"version": "3.0.0", "dev": True},
            "node_modules/@playwright/test": {
                "version": "1.0.0",
                "resolved": "https://registry.npmjs.org/@playwright/test/-/test-1.0.0.tgz",
                "integrity": playwright_integrity,
                "dev": True,
            },
            "node_modules/@fixture/linux-x64": {
                "version": "4.0.0",
                "resolved": "https://registry.npmjs.org/@fixture/linux-x64/-/linux-x64-4.0.0.tgz",
                "integrity": linux_integrity,
                "os": ["linux"],
                "cpu": ["x64"],
                "libc": ["glibc"],
                "optional": True,
            },
            "node_modules/@fixture/win32-x64": {
                "version": "4.0.0",
                "resolved": "https://registry.npmjs.org/@fixture/win32-x64/-/win32-x64-4.0.0.tgz",
                "integrity": windows_integrity,
                "os": ["win32"],
                "cpu": ["x64"],
                "optional": True,
            },
            "node_modules/@fixture/linux-arm64": {
                "version": "4.0.0",
                "resolved": "https://registry.npmjs.org/@fixture/linux-arm64/-/linux-arm64-4.0.0.tgz",
                "integrity": arm_integrity,
                "os": ["linux"],
                "cpu": ["arm64"],
                "optional": True,
            },
            "node_modules/@fixture/linuxmusl-x64": {
                "version": "4.0.0",
                "resolved": "https://registry.npmjs.org/@fixture/linuxmusl-x64/-/linuxmusl-x64-4.0.0.tgz",
                "integrity": musl_integrity,
                "os": ["linux"],
                "cpu": ["x64"],
                "libc": ["musl"],
                "optional": True,
            },
        },
        {
            "offline-alpha": "1.2.3",
            "offline-owner": "2.0.0",
            "@playwright/test": "1.0.0",
        },
    )


def test_lockfile_selection_keeps_only_chat_linux_packages_and_playwright_npm(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    fixture_project(root)

    selected = {package.name for package in MODULE.locked_packages(root)}
    assert "offline-alpha" in selected
    assert "offline-owner" in selected
    assert "offline-bundled" in selected
    assert "@playwright/test" in selected
    assert "@fixture/linux-x64" in selected
    assert "@fixture/win32-x64" not in selected
    assert "@fixture/linux-arm64" not in selected
    assert "@fixture/linuxmusl-x64" not in selected


def test_sync_reuses_existing_archives_and_resolves_bundled_dependencies(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    fixture_project(root)

    manifest = MODULE.sync_mirror(root, download_missing=False)
    assert manifest["target"] == {"os": "linux", "cpu": "x64", "libc": "glibc"}
    assert manifest["packageCount"] == 5
    assert manifest["archivePackageCount"] == 4
    assert manifest["bundledPackageCount"] == 1
    assert manifest["playwrightBrowsersIncluded"] is False

    records = {record["name"]: record for record in manifest["packages"]}
    assert records["offline-bundled"]["source"] == "bundled"
    assert records["offline-bundled"]["owner"] == "offline-owner@2.0.0"
    assert records["@playwright/test"]["source"] == "archive"
    assert all((root / path).is_file() for path in {record["archive"] for record in records.values()})
    assert MODULE.verify_mirror(root) == manifest


def test_lockfile_change_invalidates_the_manifest(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    fixture_project(root)
    MODULE.sync_mirror(root, download_missing=False)
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    package["description"] = "does not affect lock"
    (root / "package.json").write_text(json.dumps(package), encoding="utf-8")
    lock = json.loads((root / "package-lock.json").read_text(encoding="utf-8"))
    lock["packages"]["node_modules/offline-alpha"]["optional"] = True
    (root / "package-lock.json").write_text(json.dumps(lock), encoding="utf-8")

    with pytest.raises(MODULE.OfflineMirrorError, match="does not match package-lock.json"):
        MODULE.verify_mirror(root)


def test_missing_unresolved_package_must_really_be_bundled(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    fixture_project(root)
    owner = root / "vendor/npm/legacy/owner.tgz"
    owner.unlink()
    owner_integrity = write_archive(owner, name="offline-owner", version="2.0.0")
    lock = json.loads((root / "package-lock.json").read_text(encoding="utf-8"))
    lock["packages"]["node_modules/offline-owner"]["integrity"] = owner_integrity
    (root / "package-lock.json").write_text(json.dumps(lock), encoding="utf-8")

    with pytest.raises(MODULE.OfflineMirrorError, match="no mirrored archive contains"):
        MODULE.sync_mirror(root, download_missing=False)

    # Validation happens before prune, preserving the previous mirror for a
    # safe retry and diagnosis instead of destructively half-updating it.
    assert owner.is_file()


def test_installed_directory_with_unexpected_symlink_is_not_trusted(tmp_path: Path) -> None:
    archive = tmp_path / "package.tgz"
    write_archive(archive, name="offline-alpha", version="1.2.3")
    installed = tmp_path / "installed"
    MODULE.extract_npm_archive(archive, installed)
    (installed / "unexpected-link").symlink_to("index.js")

    assert MODULE.directory_matches_archive(archive, installed) is False


@pytest.mark.skipif(shutil.which("npm") is None, reason="npm is required for the offline install integration test")
def test_complete_install_runs_npm_ci_from_seeded_local_cache(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    archive = root / "vendor/npm/legacy/offline-alpha.tgz"
    integrity = write_archive(archive, name="offline-alpha", version="1.2.3")
    write_lock(
        root,
        {
            "node_modules/offline-alpha": {
                "version": "1.2.3",
                "resolved": "https://registry.npmjs.org/offline-alpha/-/offline-alpha-1.2.3.tgz",
                "integrity": integrity,
                "dev": True,
            }
        },
        {"offline-alpha": "1.2.3"},
    )
    MODULE.sync_mirror(root, download_missing=False)

    BOOTSTRAP.install(root)
    installed = json.loads((root / "node_modules/offline-alpha/package.json").read_text(encoding="utf-8"))
    assert installed["name"] == "offline-alpha"
    assert installed["version"] == "1.2.3"


def test_real_project_inventory_contains_all_required_native_linux_families() -> None:
    selected = {package.name for package in MODULE.locked_packages(ROOT)}
    assert {
        "esbuild",
        "@esbuild/linux-x64",
        "typescript",
        "@typescript/typescript-linux-x64",
        "sharp",
        "@img/sharp-linux-x64",
        "@img/sharp-libvips-linux-x64",
        "workerd",
        "@cloudflare/workerd-linux-64",
        "wrangler",
        "@playwright/test",
        "playwright",
        "playwright-core",
    } <= selected
    assert not any("win32" in name or "darwin" in name or "arm64" in name for name in selected)
