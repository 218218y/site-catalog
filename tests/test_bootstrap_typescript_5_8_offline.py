from __future__ import annotations

import base64
import hashlib
import importlib.util
import io
import json
import sys
import tarfile
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools/bootstrap_typescript_5_8_offline.py"
SPEC = importlib.util.spec_from_file_location("bootstrap_typescript_5_8_offline", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def write_fixture_project(root: Path, monkeypatch: pytest.MonkeyPatch) -> bytes:
    files = {
        "package.json": json.dumps(
            {
                "name": MODULE.PACKAGE_NAME,
                "version": MODULE.VERSION,
                "bin": {"tsc": "./bin/tsc"},
            }
        ).encode(),
        "bin/tsc": (
            "#!/usr/bin/env node\n"
            f"console.log('Version {MODULE.VERSION}');\n"
        ).encode(),
        "lib/tsc.js": b"module.exports = {};\n",
        "lib/typescript.js": b"module.exports = {};\n",
    }
    archive = root / MODULE.ARCHIVE_PATH
    archive.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive, mode="w:gz") as bundle:
        for relative, content in sorted(files.items()):
            info = tarfile.TarInfo(f"package/{relative}")
            info.size = len(content)
            info.mode = 0o755 if relative == "bin/tsc" else 0o644
            bundle.addfile(info, io.BytesIO(content))
    integrity = "sha512-" + base64.b64encode(
        hashlib.sha512(archive.read_bytes()).digest()
    ).decode("ascii")
    monkeypatch.setattr(MODULE, "INTEGRITY", integrity)
    lock = {
        "packages": {
            "": {
                "devDependencies": {
                    MODULE.DEPENDENCY_NAME: f"npm:{MODULE.PACKAGE_NAME}@{MODULE.VERSION}"
                }
            },
            MODULE.INSTALL_PATH.as_posix(): {
                "name": MODULE.PACKAGE_NAME,
                "version": MODULE.VERSION,
                "resolved": MODULE.RESOLVED,
                "integrity": integrity,
            },
        }
    }
    (root / "package-lock.json").write_text(json.dumps(lock), encoding="utf-8")
    return files["bin/tsc"]


def test_repository_archive_matches_lockfile_and_integrity() -> None:
    lock = json.loads((ROOT / "package-lock.json").read_text(encoding="utf-8"))
    package = lock["packages"][MODULE.INSTALL_PATH.as_posix()]
    assert lock["packages"][""]["devDependencies"][MODULE.DEPENDENCY_NAME] == (
        f"npm:{MODULE.PACKAGE_NAME}@{MODULE.VERSION}"
    )
    assert package["name"] == MODULE.PACKAGE_NAME
    assert package["version"] == MODULE.VERSION
    assert package["resolved"] == MODULE.RESOLVED
    assert package["integrity"] == MODULE.INTEGRITY
    assert MODULE.sri_sha512(ROOT / MODULE.ARCHIVE_PATH) == MODULE.INTEGRITY


def test_install_is_atomic_idempotent_and_repairs_modified_files(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    expected_launcher = write_fixture_project(root, monkeypatch)

    assert MODULE.install(root) is True
    assert MODULE.install(root) is False
    launcher = root / MODULE.INSTALL_PATH / "bin/tsc"
    launcher.write_bytes(expected_launcher + b"// modified\n")
    assert MODULE.install(root) is True
    assert launcher.read_bytes() == expected_launcher
    assert MODULE.compiler_is_valid(root)


def test_corrupted_archive_is_rejected_before_install(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    write_fixture_project(root, monkeypatch)
    archive = root / MODULE.ARCHIVE_PATH
    archive.write_bytes(archive.read_bytes() + b"corrupt")

    with pytest.raises(MODULE.BootstrapError, match="Integrity check failed"):
        MODULE.install(root)
    assert not (root / MODULE.INSTALL_PATH).exists()


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
