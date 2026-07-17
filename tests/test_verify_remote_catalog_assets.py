from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("verify_remote_catalog_assets", ROOT / "tools" / "verify_remote_catalog_assets.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_expected_assets_include_every_page_and_thumbnail() -> None:
    paths = list(MODULE.iter_expected_asset_paths([{
        "id": "demo",
        "dir": "assets/pages/demo",
        "pages": 2,
        "imageExt": "webp",
    }]))
    assert paths == [
        "assets/pages/demo/page-001.webp",
        "assets/pages/demo/thumbs/page-001.webp",
        "assets/pages/demo/page-002.webp",
        "assets/pages/demo/thumbs/page-002.webp",
    ]


def test_verify_remote_assets_reports_failures_without_network() -> None:
    catalogs = [{"id": "demo", "dir": "assets/pages/demo", "pages": 1, "imageExt": "webp"}]

    def checker(url: str, _timeout: float):
        if "/thumbs/" in url:
            return MODULE.AssetCheckResult(url, False, "HTTP 404", 404)
        return MODULE.AssetCheckResult(url, True, status=200)

    total, failures = MODULE.verify_remote_assets(catalogs, "https://cdn.example.test", workers=2, checker=checker)
    assert total == 2
    assert len(failures) == 1
    assert failures[0].status == 404
    assert "/thumbs/" in failures[0].url
