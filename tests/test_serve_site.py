from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location("serve_site", TOOLS / "serve_site.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_local_preview_output_is_separate_from_source_root() -> None:
    resolved = MODULE.resolve_output(ROOT, "dist/site-local")
    assert resolved == (ROOT / "dist" / "site-local").resolve()
    assert resolved != ROOT.resolve()


def test_local_preview_refuses_source_root_and_external_paths(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="source root"):
        MODULE.resolve_output(ROOT, ".")
    with pytest.raises(ValueError, match="inside the project"):
        MODULE.resolve_output(ROOT, str(tmp_path / "outside"))


def test_server_does_not_build_unless_explicitly_requested() -> None:
    assert MODULE.parse_args([]).build_first is False
    assert MODULE.parse_args([]).ensure_current is None
    assert MODULE.parse_args(["--build-first"]).build_first is True
    assert MODULE.parse_args(["--ensure-current", "ask"]).ensure_current == "ask"


def test_current_preview_starts_without_rebuilding(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    out = root / "dist" / "site-local"
    out.mkdir(parents=True)
    monkeypatch.setattr(MODULE, "preview_currentness", lambda *args: (True, "current"))

    def unexpected_build(*args: object) -> None:
        raise AssertionError("current preview must not rebuild")

    monkeypatch.setattr(MODULE, "build_preview", unexpected_build)
    assert MODULE.ensure_preview_current(root, out, "https://cdn.example.com", "build") is True


def test_stale_preview_can_be_rebuilt_and_rechecked(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    root = tmp_path / "project"
    out = root / "dist" / "site-local"
    checks = iter(((False, "changed: src/js/app.js"), (True, "current")))
    built: list[Path] = []
    monkeypatch.setattr(MODULE, "preview_currentness", lambda *args: next(checks))
    monkeypatch.setattr(MODULE, "build_preview", lambda _root, target, _url: built.append(target))

    assert MODULE.ensure_preview_current(root, out, "https://cdn.example.com", "build") is True
    assert built == [out]
