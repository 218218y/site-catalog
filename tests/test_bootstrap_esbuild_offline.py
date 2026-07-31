from __future__ import annotations

import importlib.util
import json
import os
import platform
import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
SPEC = importlib.util.spec_from_file_location(
    "bootstrap_esbuild_offline",
    TOOLS / "bootstrap_esbuild_offline.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def copy_vendored_archives(target: Path) -> None:
    shutil.copy2(ROOT / "package-lock.json", target / "package-lock.json")
    vendor = target / MODULE.VENDOR_DIRECTORY
    vendor.mkdir(parents=True)
    for archive in (MODULE.CORE_ARCHIVE, *MODULE.PLATFORM_ARCHIVES.values()):
        shutil.copy2(ROOT / MODULE.VENDOR_DIRECTORY / archive.filename, vendor / archive.filename)


def test_vendored_archives_match_the_pinned_integrities() -> None:
    for archive in (MODULE.CORE_ARCHIVE, *MODULE.PLATFORM_ARCHIVES.values()):
        path = ROOT / MODULE.VENDOR_DIRECTORY / archive.filename
        assert path.is_file()
        assert MODULE.sri_sha512(path) == archive.integrity


def test_platform_selection_is_explicit_and_rejects_unvendored_targets() -> None:
    assert MODULE.current_platform_key(system="Linux", machine="x86_64") == "linux-x64"
    assert MODULE.current_platform_key(system="Linux", machine="aarch64") == "linux-arm64"
    with pytest.raises(MODULE.BootstrapError, match="Linux-only"):
        MODULE.current_platform_key(system="Windows", machine="AMD64")
    with pytest.raises(MODULE.BootstrapError, match="Linux-only"):
        MODULE.current_platform_key(system="Darwin", machine="arm64")
    assert all(not key.startswith("win32-") for key in MODULE.PLATFORM_ARCHIVES)


def test_offline_install_extracts_only_the_selected_runtime(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_vendored_archives(root)

    changed = MODULE.install_esbuild(
        root,
        platform_key="linux-x64",
        verify_runtime=False,
        quiet=True,
    )

    assert changed is True
    core = json.loads((root / "node_modules/esbuild/package.json").read_text(encoding="utf-8"))
    binary = json.loads(
        (root / "node_modules/@esbuild/linux-x64/package.json").read_text(encoding="utf-8")
    )
    assert (core["name"], core["version"]) == ("esbuild", MODULE.ESBUILD_VERSION)
    assert (binary["name"], binary["version"]) == ("@esbuild/linux-x64", MODULE.ESBUILD_VERSION)
    assert (root / "node_modules/@esbuild/linux-x64/bin/esbuild").is_file()
    assert not (root / "node_modules/@esbuild/linux-arm64").exists()
    assert MODULE.install_esbuild(
        root,
        platform_key="linux-x64",
        verify_runtime=False,
        quiet=True,
    ) is False


@pytest.mark.skipif(
    platform.system() != "Linux" or platform.machine().lower() not in {"x86_64", "amd64", "x64"},
    reason="runtime probe uses the current vendored binary",
)
def test_offline_linux_x64_runtime_works_without_npm(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_vendored_archives(root)
    MODULE.install_esbuild(root, platform_key="linux-x64", quiet=True)
    MODULE.verify_offline_installation(root, platform_key="linux-x64")


def test_corrupted_archive_is_rejected_before_extraction(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_vendored_archives(root)
    archive = root / MODULE.VENDOR_DIRECTORY / MODULE.CORE_ARCHIVE.filename
    archive.write_bytes(archive.read_bytes() + b"corruption")

    with pytest.raises(MODULE.BootstrapError, match="Integrity check failed"):
        MODULE.install_archive(root, MODULE.CORE_ARCHIVE, force=True)
    assert not (root / MODULE.CORE_ARCHIVE.install_path).exists()


def test_modified_installed_javascript_is_repaired_from_the_archive(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_vendored_archives(root)
    MODULE.install_esbuild(
        root,
        platform_key="linux-x64",
        verify_runtime=False,
        quiet=True,
    )
    main_js = root / "node_modules/esbuild/lib/main.js"
    original = main_js.read_bytes()
    main_js.write_bytes(original + b"\n// modified\n")

    assert MODULE.install_esbuild(
        root,
        platform_key="linux-x64",
        verify_runtime=False,
        quiet=True,
    ) is True
    assert main_js.read_bytes() == original


def test_valid_local_runtime_is_accepted_without_any_vendor_archives(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    monkeypatch.setattr(MODULE.shutil, "which", lambda name: "/usr/bin/node")
    monkeypatch.setattr(MODULE, "verify_node_runtime", lambda base: None)

    assert MODULE.ensure_esbuild_available(root, quiet=True) is False


def test_non_linux_missing_runtime_points_to_npm_instead_of_a_windows_archive(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    monkeypatch.setattr(MODULE.shutil, "which", lambda name: "C:/Program Files/nodejs/node.exe")
    monkeypatch.setattr(
        MODULE,
        "verify_node_runtime",
        lambda base: (_ for _ in ()).throw(MODULE.BootstrapError("missing runtime")),
    )
    monkeypatch.setattr(
        MODULE,
        "current_platform_key",
        lambda: (_ for _ in ()).throw(MODULE.BootstrapError("Linux-only")),
    )

    with pytest.raises(MODULE.BootstrapError, match=r"Linux-only.*npm ci") as captured:
        MODULE.ensure_esbuild_available(root, quiet=True)
    assert "win32-x64" not in str(captured.value)
    assert "Missing offline archive" not in str(captured.value)
