from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "r2_catalog_sync_state_contract",
    ROOT / "tools" / "r2_catalog_sync_state.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def catalog(version: str = "catalog-v1") -> dict:
    return {
        "id": "demo",
        "dir": "assets/pages/demo",
        "pages": 2,
        "imageExt": "webp",
        "assetVersion": version,
        "imageVariants": {
            "thumb": {"directory": "thumbs", "maxSide": 420, "version": "thumb-v1"},
            "medium": {"directory": "medium", "maxSide": 1600, "version": "medium-v1"},
            "full": {"directory": "", "maxSide": 2800, "version": "full-v1"},
        },
    }


def test_release_signature_is_order_independent() -> None:
    first = catalog()
    second = {**catalog("catalog-v2"), "id": "second", "dir": "assets/pages/second"}
    assert MODULE.catalog_release_signature([first, second]) == MODULE.catalog_release_signature([second, first])


def test_completed_sync_state_must_match_current_generated_release(tmp_path: Path) -> None:
    generated = tmp_path / MODULE.CATALOGS_FILE
    generated.write_text(json.dumps([catalog()]), encoding="utf-8")

    path = MODULE.write_sync_state(
        root=tmp_path,
        bucket="bucket",
        prefix="assets/pages",
        public_url="https://cdn.example.test",
    )
    assert path.is_file()
    assert MODULE.verify_sync_state(tmp_path)["catalogCount"] == 1

    generated.write_text(json.dumps([catalog("catalog-v2")]), encoding="utf-8")
    try:
        MODULE.verify_sync_state(tmp_path)
    except RuntimeError as exc:
        assert "changed after the last completed R2 sync" in str(exc)
    else:
        raise AssertionError("stale R2 sync state should block the build")
