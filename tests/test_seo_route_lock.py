from __future__ import annotations

import copy
import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location("seo_route_lock_test_module", TOOLS / "seo_route_lock.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_checked_in_public_route_lock_matches_current_sources() -> None:
    MODULE.assert_route_lock_current(ROOT)


def test_route_lock_detects_catalog_id_or_slug_changes() -> None:
    current = MODULE.route_snapshot(ROOT)
    changed = copy.deepcopy(current)
    changed["catalogs"][0]["route"] = "/catalog/accidental-rename/"
    differences = MODULE.snapshot_differences(current, changed)
    assert differences
    assert any("changed catalog id" in item for item in differences)


def test_route_lock_update_requires_explicit_confirmation(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="confirm-route-lock-update"):
        MODULE.write_route_lock(tmp_path, confirmed=False)
