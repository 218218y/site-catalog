from __future__ import annotations

import errno
import importlib.util
import json
import platform
import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

import npm_offline_linux as OFFLINE  # noqa: E402

SPEC = importlib.util.spec_from_file_location(
    "bootstrap_esbuild_offline",
    TOOLS / "bootstrap_esbuild_offline.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def copy_inputs(target: Path) -> None:
    shutil.copy2(ROOT / "package-lock.json", target / "package-lock.json")
    for install_path in (MODULE.CORE_INSTALL_PATH, MODULE.PLATFORM_INSTALL_PATHS["linux-x64"]):
        package = OFFLINE.locked_package(ROOT, install_path)
        source = OFFLINE.locate_archive(ROOT, package)
        destination = target / OFFLINE.canonical_archive_relative(package)
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)


def test_specs_are_derived_from_the_current_lockfile() -> None:
    core = OFFLINE.locked_package(ROOT, MODULE.CORE_INSTALL_PATH)
    binary = OFFLINE.locked_package(ROOT, MODULE.PLATFORM_INSTALL_PATHS["linux-x64"])
    assert MODULE.ESBUILD_VERSION == core.version
    assert binary.version == core.version
    assert OFFLINE.sri_sha512(OFFLINE.locate_archive(ROOT, core)) == core.integrity
    assert OFFLINE.sri_sha512(OFFLINE.locate_archive(ROOT, binary)) == binary.integrity


def test_platform_selection_is_chat_linux_x64_only() -> None:
    assert MODULE.current_platform_key(system="Linux", machine="x86_64") == "linux-x64"
    with pytest.raises(MODULE.BootstrapError, match="Linux x64 only"):
        MODULE.current_platform_key(system="Linux", machine="aarch64")
    with pytest.raises(MODULE.BootstrapError, match="Linux x64 only"):
        MODULE.current_platform_key(system="Windows", machine="AMD64")
    assert set(MODULE.PLATFORM_INSTALL_PATHS) == {"linux-x64"}


def test_offline_install_is_atomic_idempotent_and_repairs_changes(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_inputs(root)

    assert MODULE.install_esbuild(root, platform_key="linux-x64", verify_runtime=False, quiet=True)
    assert not MODULE.install_esbuild(root, platform_key="linux-x64", verify_runtime=False, quiet=True)

    core_metadata = json.loads((root / "node_modules/esbuild/package.json").read_text(encoding="utf-8"))
    platform_metadata = json.loads(
        (root / "node_modules/@esbuild/linux-x64/package.json").read_text(encoding="utf-8")
    )
    assert core_metadata["version"] == MODULE.locked_version(root)
    assert platform_metadata["version"] == MODULE.locked_version(root)
    assert (root / "node_modules/@esbuild/linux-x64/bin/esbuild").is_file()
    assert not (root / "node_modules/@esbuild/linux-arm64").exists()

    main_js = root / "node_modules/esbuild/lib/main.js"
    expected = main_js.read_bytes()
    main_js.write_bytes(expected + b"\n// modified\n")
    assert MODULE.install_esbuild(root, platform_key="linux-x64", verify_runtime=False, quiet=True)
    assert main_js.read_bytes() == expected


def test_cli_shim_falls_back_to_a_copied_launcher_when_symlinks_are_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_inputs(root)

    def reject_symlink(*_args: object, **_kwargs: object) -> None:
        raise PermissionError(errno.EPERM, "symlink creation unavailable")

    monkeypatch.setattr(Path, "symlink_to", reject_symlink)
    MODULE.install_esbuild(root, platform_key="linux-x64", verify_runtime=False, quiet=True)

    launcher = root / "node_modules/esbuild/bin/esbuild"
    shim = root / "node_modules/.bin/esbuild"
    assert shim.is_file()
    assert not shim.is_symlink()
    assert shim.read_bytes() == launcher.read_bytes()


def test_npm_postinstall_core_binary_layout_is_accepted(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_inputs(root)
    MODULE.install_esbuild(root, platform_key="linux-x64", verify_runtime=False, quiet=True)

    core_binary = root / MODULE.CORE_INSTALL_PATH / "bin/esbuild"
    platform_binary = root / MODULE.PLATFORM_INSTALL_PATHS["linux-x64"] / "bin/esbuild"
    shutil.copy2(platform_binary, core_binary)

    MODULE.verify_offline_installation(
        root, platform_key="linux-x64", verify_runtime=False
    )
    assert not MODULE.install_esbuild(
        root,
        platform_key="linux-x64",
        verify_runtime=False,
        quiet=True,
    )


@pytest.mark.skipif(
    platform.system() != "Linux" or platform.machine().lower() not in {"x86_64", "amd64", "x64"},
    reason="runtime probe uses the Linux x64 vendored binary",
)
def test_offline_linux_x64_runtime_works_without_npm(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_inputs(root)
    MODULE.install_esbuild(root, platform_key="linux-x64", quiet=True)
    MODULE.verify_offline_installation(root, platform_key="linux-x64")


def test_corrupted_only_archive_is_rejected_before_mutation(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    copy_inputs(root)
    core = OFFLINE.locked_package(root, MODULE.CORE_INSTALL_PATH)
    archive = root / OFFLINE.canonical_archive_relative(core)
    archive.write_bytes(archive.read_bytes() + b"corruption")

    with pytest.raises(MODULE.BootstrapError, match="Missing verified archive|Integrity check failed"):
        MODULE.install_esbuild(root, platform_key="linux-x64", verify_runtime=False, quiet=True)
    assert not (root / MODULE.CORE_INSTALL_PATH).exists()


def test_valid_installed_runtime_does_not_require_linux_platform_package(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    shutil.copy2(ROOT / "package-lock.json", root / "package-lock.json")

    core = OFFLINE.locked_package(root, MODULE.CORE_INSTALL_PATH)
    core_directory = root / MODULE.CORE_INSTALL_PATH
    core_directory.mkdir(parents=True)
    (core_directory / "package.json").write_text(
        json.dumps({"name": core.name, "version": core.version}),
        encoding="utf-8",
    )

    probes: list[Path] = []
    monkeypatch.setattr(MODULE, "verify_node_runtime", lambda base: probes.append(base))
    monkeypatch.setattr(
        MODULE,
        "current_platform_key",
        lambda: (_ for _ in ()).throw(AssertionError("offline platform detection must not run")),
    )

    assert MODULE.ensure_esbuild_available(root, quiet=True) is False
    assert probes == [root.resolve()]
    assert not (root / MODULE.PLATFORM_INSTALL_PATHS["linux-x64"]).exists()


def test_valid_local_runtime_is_accepted_without_vendor_archives(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    shutil.copy2(ROOT / "package-lock.json", root / "package-lock.json")
    monkeypatch.setattr(MODULE, "verify_installed_esbuild", lambda base: None)
    assert MODULE.ensure_esbuild_available(root, quiet=True) is False


def test_non_linux_missing_runtime_points_to_npm(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    root = tmp_path / "project"
    root.mkdir()
    shutil.copy2(ROOT / "package-lock.json", root / "package-lock.json")
    monkeypatch.setattr(
        MODULE,
        "verify_installed_esbuild",
        lambda base: (_ for _ in ()).throw(MODULE.BootstrapError("missing runtime")),
    )
    monkeypatch.setattr(
        MODULE,
        "current_platform_key",
        lambda: (_ for _ in ()).throw(MODULE.BootstrapError("Linux x64 only")),
    )
    with pytest.raises(MODULE.BootstrapError, match=r"Linux x64 only.*npm ci"):
        MODULE.ensure_esbuild_available(root, quiet=True)
