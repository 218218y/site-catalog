from __future__ import annotations

import base64
import hashlib
import importlib.util
import io
import json
import os
import sys
import tarfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
SPEC = importlib.util.spec_from_file_location(
    "bootstrap_typescript_offline",
    TOOLS / "bootstrap_typescript_offline.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def write_npm_archive(path: Path, files: dict[str, bytes]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(path, mode="w:gz") as bundle:
        for relative, content in sorted(files.items()):
            info = tarfile.TarInfo(f"package/{relative}")
            info.size = len(content)
            info.mode = 0o755 if relative in {"bin/tsc", "lib/tsc", "lib/tsc.exe"} else 0o644
            bundle.addfile(info, io.BytesIO(content))
    digest = hashlib.sha512(path.read_bytes()).digest()
    return "sha512-" + base64.b64encode(digest).decode("ascii")


def fixture_specs(root: Path) -> tuple[object, object]:
    vendor = root / MODULE.VENDOR_DIRECTORY
    core_filename = "typescript-fixture.tgz"
    platform_filename = "typescript-linux-x64-fixture.tgz"
    platform_name = "@typescript/typescript-linux-x64"
    core_integrity = write_npm_archive(
        vendor / core_filename,
        {
            "package.json": json.dumps(
                {
                    "name": "typescript",
                    "version": MODULE.TYPESCRIPT_VERSION,
                    "type": "module",
                    "bin": {"tsc": "./bin/tsc"},
                    "optionalDependencies": {platform_name: MODULE.TYPESCRIPT_VERSION},
                }
            ).encode(),
            "bin/tsc": (
                "#!/usr/bin/env node\n"
                f"console.log('Version {MODULE.TYPESCRIPT_VERSION}');\n"
            ).encode(),
            "lib/getExePath.js": b"export default function getExePath() {}\n",
            "lib/tsc.js": b"export {};\n",
        },
    )
    platform_integrity = write_npm_archive(
        vendor / platform_filename,
        {
            "package.json": json.dumps(
                {"name": platform_name, "version": MODULE.TYPESCRIPT_VERSION}
            ).encode(),
            "lib/tsc": b"fixture native compiler\n",
        },
    )
    core = MODULE.ArchiveSpec(
        filename=core_filename,
        package_name="typescript",
        resolved="https://example.invalid/typescript-fixture.tgz",
        integrity=core_integrity,
        install_path=Path("node_modules/typescript"),
        required_files=(Path("bin/tsc"), Path("lib/getExePath.js"), Path("lib/tsc.js")),
    )
    platform = MODULE.ArchiveSpec(
        filename=platform_filename,
        package_name=platform_name,
        resolved="https://example.invalid/typescript-linux-x64-fixture.tgz",
        integrity=platform_integrity,
        install_path=Path("node_modules/@typescript/typescript-linux-x64"),
        required_files=(Path("lib/tsc"),),
        executable_path=Path("lib/tsc"),
    )
    lock = {
        "packages": {
            core.install_path.as_posix(): {
                "version": MODULE.TYPESCRIPT_VERSION,
                "resolved": core.resolved,
                "integrity": core.integrity,
            },
            platform.install_path.as_posix(): {
                "version": MODULE.TYPESCRIPT_VERSION,
                "resolved": platform.resolved,
                "integrity": platform.integrity,
            },
        }
    }
    (root / "package-lock.json").write_text(json.dumps(lock), encoding="utf-8")
    return core, platform


def test_lockfile_matches_every_offline_typescript_spec() -> None:
    lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
    for archive in (MODULE.CORE_ARCHIVE, *MODULE.PLATFORM_ARCHIVES.values()):
        locked = lock["packages"][archive.install_path.as_posix()]
        assert locked["version"] == MODULE.TYPESCRIPT_VERSION
        assert locked["resolved"] == archive.resolved
        assert locked["integrity"] == archive.integrity


def test_platform_selection_is_explicit() -> None:
    assert MODULE.current_platform_key(system="Linux", machine="x86_64") == "linux-x64"
    assert MODULE.current_platform_key(system="Linux", machine="aarch64") == "linux-arm64"
    assert MODULE.current_platform_key(system="Windows", machine="AMD64") == "win32-x64"
    with pytest.raises(MODULE.BootstrapError, match="No vendored TypeScript compiler"):
        MODULE.current_platform_key(system="Darwin", machine="arm64")


def test_offline_install_is_atomic_idempotent_and_runtime_checked(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    core, platform = fixture_specs(root)
    monkeypatch.setattr(MODULE, "CORE_ARCHIVE", core)
    monkeypatch.setattr(MODULE, "PLATFORM_ARCHIVES", {"linux-x64": platform})

    assert MODULE.install_typescript(root, platform_key="linux-x64", quiet=True) is True
    assert MODULE.install_typescript(root, platform_key="linux-x64", quiet=True) is False
    assert (root / "node_modules/typescript/bin/tsc").is_file()
    assert (root / "node_modules/@typescript/typescript-linux-x64/lib/tsc").is_file()
    if os.name == "nt":
        assert (root / "node_modules/.bin/tsc.cmd").is_file()
        assert (root / "node_modules/.bin/tsc.ps1").is_file()
    else:
        assert (root / "node_modules/.bin/tsc").is_symlink()
    MODULE.verify_offline_installation(root, platform_key="linux-x64")


def test_modified_installation_is_repaired_from_the_archive(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    core, platform = fixture_specs(root)
    monkeypatch.setattr(MODULE, "CORE_ARCHIVE", core)
    monkeypatch.setattr(MODULE, "PLATFORM_ARCHIVES", {"linux-x64": platform})
    MODULE.install_typescript(
        root,
        platform_key="linux-x64",
        verify_runtime=False,
        quiet=True,
    )
    launcher = root / "node_modules/typescript/bin/tsc"
    expected = launcher.read_bytes()
    launcher.write_bytes(expected + b"// modified\n")

    assert MODULE.install_typescript(
        root,
        platform_key="linux-x64",
        verify_runtime=False,
        quiet=True,
    ) is True
    assert launcher.read_bytes() == expected


def test_corrupted_archive_is_rejected_before_mutation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    core, platform = fixture_specs(root)
    monkeypatch.setattr(MODULE, "CORE_ARCHIVE", core)
    monkeypatch.setattr(MODULE, "PLATFORM_ARCHIVES", {"linux-x64": platform})
    archive = root / MODULE.VENDOR_DIRECTORY / core.filename
    archive.write_bytes(archive.read_bytes() + b"corruption")

    with pytest.raises(MODULE.BootstrapError, match="Integrity check failed"):
        MODULE.install_typescript(
            root,
            platform_key="linux-x64",
            verify_runtime=False,
            quiet=True,
        )
    assert not (root / "node_modules/typescript").exists()
    assert not (root / "node_modules/@typescript/typescript-linux-x64").exists()


def test_missing_archive_message_includes_exact_download_location(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    core, platform = fixture_specs(root)
    monkeypatch.setattr(MODULE, "CORE_ARCHIVE", core)
    monkeypatch.setattr(MODULE, "PLATFORM_ARCHIVES", {"linux-x64": platform})
    missing = root / MODULE.VENDOR_DIRECTORY / platform.filename
    missing.unlink()

    with pytest.raises(MODULE.BootstrapError) as captured:
        MODULE.install_typescript(
            root,
            platform_key="linux-x64",
            verify_runtime=False,
            quiet=True,
        )
    message = str(captured.value)
    assert platform.resolved in message
    assert platform.filename in message


def test_archive_path_traversal_is_rejected(tmp_path: Path) -> None:
    archive = tmp_path / "malicious.tgz"
    with tarfile.open(archive, mode="w:gz") as bundle:
        content = b"escape"
        info = tarfile.TarInfo("package/../escape.txt")
        info.size = len(content)
        bundle.addfile(info, io.BytesIO(content))

    with pytest.raises(MODULE.BootstrapError, match="Unsafe npm archive member"):
        MODULE.extract_verified_archive(archive, tmp_path / "destination")
    assert not (tmp_path / "escape.txt").exists()
