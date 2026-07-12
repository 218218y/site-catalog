from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location(
    "build_deploy_bundle",
    TOOLS / "build_deploy_bundle.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def write_asset(root: Path, relative: str, content: bytes = b"asset") -> None:
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def test_project_manifest_icons_are_discovered() -> None:
    assets = {path.as_posix() for path in MODULE.discover_web_app_assets(ROOT)}
    assert "android-chrome-192x192.png" in assets
    assert "android-chrome-512x512.png" in assets
    assert "apple-touch-icon.png" in assets
    assert "favicon-16x16.png" in assets
    assert "favicon-32x32.png" in assets
    assert "favicon.ico" in assets


def test_manifest_assets_and_custom_icon_family_are_copied(tmp_path: Path) -> None:
    root = tmp_path / "project"
    out = tmp_path / "bundle"
    root.mkdir()
    out.mkdir()

    for relative in (
        "favicon.ico",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "apple-touch-icon.png",
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
        "images/install-shot.png",
    ):
        write_asset(root, relative)

    (root / "site.webmanifest").write_text(
        json.dumps(
            {
                "icons": [
                    {"src": "/android-chrome-192x192.png"},
                    {"src": "/android-chrome-512x512.png?v=2"},
                ],
                "screenshots": [{"src": "images/install-shot.png#preview"}],
            }
        ),
        encoding="utf-8",
    )

    discovered = {path.as_posix() for path in MODULE.discover_web_app_assets(root)}
    assert discovered == {
        "android-chrome-192x192.png",
        "android-chrome-512x512.png",
        "apple-touch-icon.png",
        "favicon-16x16.png",
        "favicon-32x32.png",
        "favicon.ico",
        "images/install-shot.png",
    }

    stats = MODULE.copy_web_app_assets(root, out)
    assert stats.files == len(discovered)
    for relative in discovered:
        assert (out / relative).is_file()


def test_missing_manifest_asset_fails_the_bundle(tmp_path: Path) -> None:
    root = tmp_path / "project"
    out = tmp_path / "bundle"
    root.mkdir()
    out.mkdir()
    (root / "site.webmanifest").write_text(
        json.dumps({"icons": [{"src": "/missing-icon.png"}]}),
        encoding="utf-8",
    )

    with pytest.raises(FileNotFoundError, match="missing-icon.png"):
        MODULE.copy_web_app_assets(root, out)


def test_manifest_path_traversal_is_rejected() -> None:
    with pytest.raises(ValueError, match="Unsafe local asset reference"):
        MODULE.normalize_local_public_asset("../outside.png")
