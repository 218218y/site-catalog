from __future__ import annotations

import base64
import errno
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


def fixture_project(root: Path) -> dict[tuple[str, str], Path]:
    legacy = root / "vendor/npm/legacy"
    alpha_integrity = write_archive(legacy / "alpha.tgz", name="offline-alpha", version="1.2.3")
    playwright_integrity = write_archive(
        legacy / "playwright-test.tgz", name="@playwright/test", version="1.0.0"
    )
    linux_integrity = write_archive(
        legacy / "linux-native.tgz", name="@fixture/linux-x64", version="4.0.0"
    )
    windows_integrity = write_archive(
        legacy / "windows-native.tgz", name="@fixture/win32-x64", version="4.0.0"
    )
    arm_integrity = write_archive(
        legacy / "linux-arm64.tgz", name="@fixture/linux-arm64", version="4.0.0"
    )
    musl_integrity = write_archive(
        legacy / "linuxmusl-x64.tgz", name="@fixture/linuxmusl-x64", version="4.0.0"
    )
    wrangler_integrity = write_archive(
        legacy / "wrangler.tgz", name="wrangler", version="9.0.0"
    )
    heavy_integrity = write_archive(
        legacy / "offline-heavy-runtime.tgz", name="offline-heavy-runtime", version="9.0.0"
    )
    registry_only = root / "registry-fixtures/offline-registry-only-3.0.0.tgz"
    write_archive(registry_only, name="offline-registry-only", version="3.0.0")
    write_lock(
        root,
        {
            "node_modules/offline-alpha": {
                "version": "1.2.3",
                "resolved": "https://registry.npmjs.org/offline-alpha/-/offline-alpha-1.2.3.tgz",
                "integrity": alpha_integrity,
                "dev": True,
                "optionalDependencies": {
                    "@fixture/linux-x64": "4.0.0",
                    "@fixture/win32-x64": "4.0.0",
                    "@fixture/linux-arm64": "4.0.0",
                    "@fixture/linuxmusl-x64": "4.0.0",
                },
            },
            # This reproduces the real Wrangler lockfile defect: an ordinary
            # registry dependency with exact version but no resolved/integrity.
            "node_modules/offline-registry-only": {"version": "3.0.0", "dev": True},
            "node_modules/@playwright/test": {
                "version": "1.0.0",
                "resolved": "https://registry.npmjs.org/@playwright/test/-/test-1.0.0.tgz",
                "integrity": playwright_integrity,
                "dev": True,
            },
            "node_modules/wrangler": {
                "version": "9.0.0",
                "resolved": "https://registry.npmjs.org/wrangler/-/wrangler-9.0.0.tgz",
                "integrity": wrangler_integrity,
                "dev": True,
                "dependencies": {"offline-heavy-runtime": "9.0.0"},
            },
            "node_modules/offline-heavy-runtime": {
                "version": "9.0.0",
                "resolved": "https://registry.npmjs.org/offline-heavy-runtime/-/offline-heavy-runtime-9.0.0.tgz",
                "integrity": heavy_integrity,
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
            "offline-registry-only": "3.0.0",
            "@playwright/test": "1.0.0",
            "wrangler": "9.0.0",
        },
    )
    return {("offline-registry-only", "3.0.0"): registry_only}


def install_fake_packer(
    monkeypatch: pytest.MonkeyPatch,
    sources: dict[tuple[str, str], Path],
) -> None:
    def fake_pack(root: Path, package: MODULE.LockedPackage, destination: Path) -> str:
        del root
        source = sources[(package.name, package.version)]
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        return MODULE.verify_archive_identity(destination, package)

    monkeypatch.setattr(MODULE, "_npm_pack_exact", fake_pack)


def test_lockfile_selection_keeps_only_chat_linux_packages_and_playwright_npm(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    fixture_project(root)

    selected = {package.name for package in MODULE.locked_packages(root)}
    assert "offline-alpha" in selected
    assert "offline-registry-only" in selected
    assert "@playwright/test" in selected
    assert "@fixture/linux-x64" in selected
    assert "@fixture/win32-x64" not in selected
    assert "@fixture/linux-arm64" not in selected
    assert "@fixture/linuxmusl-x64" not in selected
    assert "wrangler" not in selected
    assert "offline-heavy-runtime" not in selected
    assert MODULE.selected_root_package_names(root) == (
        "@playwright/test",
        "offline-alpha",
        "offline-registry-only",
    )
    assert MODULE.excluded_root_package_names(root) == ("wrangler",)


def test_dependency_resolution_prefers_nested_lockfile_package(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    write_lock(
        root,
        {
            "node_modules/parent": {
                "version": "1.0.0",
                "dependencies": {"child": "2.0.0"},
            },
            "node_modules/child": {"version": "1.0.0"},
            "node_modules/parent/node_modules/child": {"version": "2.0.0"},
        },
        {"parent": "1.0.0"},
    )

    selected = {package.install_path for package in MODULE.locked_packages(root)}
    assert selected == {
        "node_modules/parent",
        "node_modules/parent/node_modules/child",
    }


def test_excluded_root_is_restored_when_selected_package_requires_it(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    fixture_project(root)
    lock = json.loads((root / "package-lock.json").read_text(encoding="utf-8"))
    lock["packages"]["node_modules/offline-alpha"].setdefault("dependencies", {})["wrangler"] = "9.0.0"
    (root / "package-lock.json").write_text(json.dumps(lock, indent=2) + "\n", encoding="utf-8")

    selected = {package.name for package in MODULE.locked_packages(root)}
    assert "wrangler" in selected
    assert "offline-heavy-runtime" in selected
    assert MODULE.excluded_root_package_names(root) == ("wrangler",)


def test_sync_packs_missing_lock_metadata_and_generates_local_offline_lock(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    sources = fixture_project(root)
    install_fake_packer(monkeypatch, sources)
    original_lock = (root / "package-lock.json").read_bytes()

    manifest = MODULE.sync_mirror(root)
    assert manifest["profile"] == "chat-tests"
    assert manifest["target"] == {"os": "linux", "cpu": "x64", "libc": "glibc"}
    assert manifest["rootPackages"] == ["@playwright/test", "offline-alpha", "offline-registry-only"]
    assert manifest["excludedRootPackages"] == ["wrangler"]
    assert manifest["packageCount"] == 4
    assert manifest["archivePackageCount"] == 4
    assert manifest["registryPackPackageCount"] == 1
    assert manifest["playwrightBrowsersIncluded"] is False
    assert (root / "package-lock.json").read_bytes() == original_lock

    records = {record["name"]: record for record in manifest["packages"]}
    assert records["offline-registry-only"]["metadataSource"] == "npm-pack"
    assert records["offline-alpha"]["metadataSource"] == "lockfile"
    assert all((root / record["archive"]).is_file() for record in records.values())

    offline_lock = json.loads((root / MODULE.OFFLINE_LOCK_PATH).read_text(encoding="utf-8"))
    unresolved = offline_lock["packages"]["node_modules/offline-registry-only"]
    assert unresolved["resolved"].startswith("file:vendor/npm/linux-x64-glibc/archives/")
    assert unresolved["integrity"].startswith("sha512-")
    assert "node_modules/wrangler" not in offline_lock["packages"]
    assert "wrangler" not in offline_lock["packages"][""]["devDependencies"]
    offline_package = json.loads((root / MODULE.OFFLINE_PACKAGE_PATH).read_text(encoding="utf-8"))
    assert offline_package["devDependencies"] == {
        "offline-alpha": "1.2.3",
        "offline-registry-only": "3.0.0",
        "@playwright/test": "1.0.0",
    }
    assert "scripts" not in offline_package
    assert MODULE.verify_mirror(root) == manifest

    # A later no-network check/update reuses the manifest-authenticated pack.
    assert MODULE.sync_mirror(root, download_missing=False) == manifest


def test_unresolved_registry_package_is_not_misclassified_as_bundled(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    fixture_project(root)

    with pytest.raises(MODULE.OfflineMirrorError, match=r"omits resolved/integrity.*npm pack"):
        MODULE.sync_mirror(root, download_missing=False)


def test_lockfile_change_invalidates_the_manifest(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    sources = fixture_project(root)
    install_fake_packer(monkeypatch, sources)
    MODULE.sync_mirror(root)
    lock = json.loads((root / "package-lock.json").read_text(encoding="utf-8"))
    lock["packages"]["node_modules/offline-alpha"]["optional"] = True
    (root / "package-lock.json").write_text(json.dumps(lock), encoding="utf-8")

    with pytest.raises(MODULE.OfflineMirrorError, match="does not match package-lock.json"):
        MODULE.verify_mirror(root)


def test_failed_registry_pack_preserves_legacy_mirror_before_prune(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    fixture_project(root)
    legacy_tool = root / "vendor/npm/esbuild/legacy.tgz"
    write_archive(legacy_tool, name="legacy-tool", version="1.0.0")
    old_cache = root / MODULE.LEGACY_CACHE_DIRECTORY / "marker"
    old_cache.parent.mkdir(parents=True)
    old_cache.write_text("keep until success", encoding="utf-8")

    def fail_pack(*_args: object, **_kwargs: object) -> str:
        raise MODULE.OfflineMirrorError("registry unavailable")

    monkeypatch.setattr(MODULE, "_npm_pack_exact", fail_pack)
    with pytest.raises(MODULE.OfflineMirrorError, match="registry unavailable"):
        MODULE.sync_mirror(root)
    assert legacy_tool.is_file()
    assert old_cache.is_file()


def test_successful_sync_prunes_duplicate_legacy_mirrors_and_old_cache(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    sources = fixture_project(root)
    install_fake_packer(monkeypatch, sources)
    for relative in MODULE.LEGACY_MIRROR_DIRECTORIES:
        directory = root / relative
        directory.mkdir(parents=True, exist_ok=True)
        (directory / "README.md").write_text("obsolete", encoding="utf-8")
    old_cache = root / MODULE.LEGACY_CACHE_DIRECTORY
    old_cache.mkdir(parents=True)
    (old_cache / "marker").write_text("obsolete", encoding="utf-8")

    MODULE.sync_mirror(root)

    assert all(not (root / relative).exists() for relative in MODULE.LEGACY_MIRROR_DIRECTORIES)
    assert not old_cache.exists()
    assert len(tuple((root / MODULE.ARCHIVE_DIRECTORY).rglob("*.tgz"))) == 4
    assert not (root / MODULE.ARCHIVE_DIRECTORY / "wrangler/9.0.0.tgz").exists()
    assert not (root / MODULE.ARCHIVE_DIRECTORY / "offline-heavy-runtime/9.0.0.tgz").exists()


def test_installed_directory_with_unexpected_symlink_is_not_trusted(tmp_path: Path) -> None:
    archive = tmp_path / "package.tgz"
    write_archive(archive, name="offline-alpha", version="1.2.3")
    installed = tmp_path / "installed"
    MODULE.extract_npm_archive(archive, installed)
    try:
        (installed / "unexpected-link").symlink_to("index.js")
    except OSError as error:
        unavailable = getattr(error, "winerror", None) == 1314 or error.errno in {
            errno.EACCES, errno.EPERM, errno.ENOSYS, errno.ENOTSUP
        }
        if unavailable:
            pytest.skip(f"symlink creation is unavailable on this host: {error}")
        raise

    assert MODULE.directory_matches_archive(archive, installed) is False


def _linux_offline_install_integration_available() -> bool:
    if shutil.which("npm") is None:
        return False
    try:
        BOOTSTRAP.verify_host()
    except BOOTSTRAP.OfflineInstallError:
        return False
    return True


@pytest.mark.skipif(
    not _linux_offline_install_integration_available(),
    reason="integration test requires npm on the Linux x64/glibc offline-install target",
)
def test_complete_install_uses_isolated_stage_and_preserves_project_metadata(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    source = root / "registry-fixtures/offline-registry-only-3.0.0.tgz"
    write_archive(source, name="offline-registry-only", version="3.0.0")
    write_lock(
        root,
        {"node_modules/offline-registry-only": {"version": "3.0.0", "dev": True}},
        {"offline-registry-only": "3.0.0"},
    )
    install_fake_packer(monkeypatch, {("offline-registry-only", "3.0.0"): source})
    MODULE.sync_mirror(root)
    canonical_lock = (root / "package-lock.json").read_bytes()
    canonical_package = (root / "package.json").read_bytes()
    existing_shrinkwrap = root / "npm-shrinkwrap.json"
    existing_shrinkwrap.write_text("do not replace", encoding="utf-8")
    old_node_modules = root / "node_modules"
    old_node_modules.mkdir()
    (old_node_modules / "old-marker").write_text("replace only after success", encoding="utf-8")

    monkeypatch.setattr(BOOTSTRAP, "TOOLCHAIN_PROBE", "console.log('fixture probe')")
    BOOTSTRAP.install(root)

    installed = json.loads(
        (root / "node_modules/offline-registry-only/package.json").read_text(encoding="utf-8")
    )
    assert installed["name"] == "offline-registry-only"
    assert installed["version"] == "3.0.0"
    assert not (root / "node_modules/old-marker").exists()
    assert (root / "package-lock.json").read_bytes() == canonical_lock
    assert (root / "package.json").read_bytes() == canonical_package
    assert existing_shrinkwrap.read_text(encoding="utf-8") == "do not replace"
    assert not any(root.glob(f"{BOOTSTRAP.INSTALL_STAGE_PREFIX}*"))
    assert not any(root.glob(f"{BOOTSTRAP.NODE_MODULES_BACKUP_PREFIX}*"))
    assert not (root / MODULE.LEGACY_CACHE_DIRECTORY).exists()


@pytest.mark.skipif(
    not _linux_offline_install_integration_available(),
    reason="integration test requires npm on the Linux x64/glibc offline-install target",
)
def test_failed_staged_install_keeps_existing_node_modules(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    source = root / "registry-fixtures/offline-registry-only-3.0.0.tgz"
    write_archive(source, name="offline-registry-only", version="3.0.0")
    write_lock(
        root,
        {"node_modules/offline-registry-only": {"version": "3.0.0", "dev": True}},
        {"offline-registry-only": "3.0.0"},
    )
    install_fake_packer(monkeypatch, {("offline-registry-only", "3.0.0"): source})
    MODULE.sync_mirror(root)
    marker = root / "node_modules/keep-me"
    marker.parent.mkdir()
    marker.write_text("old install", encoding="utf-8")

    monkeypatch.setattr(BOOTSTRAP, "TOOLCHAIN_PROBE", "process.exit(7)")
    with pytest.raises(BOOTSTRAP.OfflineInstallError, match="exit code 7"):
        BOOTSTRAP.install(root)
    assert marker.read_text(encoding="utf-8") == "old install"


def test_real_project_inventory_contains_only_the_chat_toolchain() -> None:
    selected = {package.name for package in MODULE.locked_packages(ROOT)}
    assert selected == {
        "@esbuild/linux-x64",
        "@playwright/test",
        "@typescript/typescript-linux-x64",
        "esbuild",
        "playwright",
        "playwright-core",
        "typescript",
    }
    assert MODULE.selected_root_package_names(ROOT) == ("@playwright/test", "esbuild", "typescript")
    assert MODULE.excluded_root_package_names(ROOT) == ("wrangler",)
    assert not any("win32" in name or "darwin" in name or "arm64" in name for name in selected)
    assert all(package.has_lock_archive_metadata for package in MODULE.locked_packages(ROOT))
