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
