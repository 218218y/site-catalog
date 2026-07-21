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


def test_expected_assets_include_advertised_medium_tier() -> None:
    paths = list(MODULE.iter_expected_asset_paths([{
        "id": "demo",
        "dir": "assets/pages/demo",
        "pages": 1,
        "imageExt": "webp",
        "imageVariants": {
            "thumb": {"directory": "thumbs", "maxSide": 420},
            "medium": {"directory": "medium", "maxSide": 1600},
            "full": {"directory": "", "maxSide": 2800},
        },
    }]))
    assert paths == [
        "assets/pages/demo/page-001.webp",
        "assets/pages/demo/medium/page-001.webp",
        "assets/pages/demo/thumbs/page-001.webp",
    ]


def test_full_only_verification_skips_inactive_medium_tier() -> None:
    catalogs = [{
        "id": "demo",
        "dir": "assets/pages/demo",
        "pages": 1,
        "imageExt": "webp",
        "imageVariants": {
            "thumb": {"directory": "thumbs", "maxSide": 420},
            "medium": {"directory": "medium", "maxSide": 1600},
            "full": {"directory": "", "maxSide": 2800},
        },
    }]
    paths = list(MODULE.iter_expected_asset_paths(catalogs, include_medium=False))
    assert paths == [
        "assets/pages/demo/page-001.webp",
        "assets/pages/demo/thumbs/page-001.webp",
    ]
    urls = MODULE.build_asset_urls(
        catalogs,
        "https://cdn.example.test",
        versioned=True,
        include_medium=False,
    )
    assert urls == [
        "https://cdn.example.test/assets/pages/demo/page-001.webp",
        "https://cdn.example.test/assets/pages/demo/thumbs/page-001.webp",
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


def test_versioned_urls_match_tier_specific_browser_cache_keys() -> None:
    catalogs = [{
        "id": "demo",
        "dir": "assets/pages/demo",
        "pages": 1,
        "imageExt": "webp",
        "assetVersion": "catalog-old",
        "imageVariants": {
            "thumb": {"directory": "thumbs", "maxSide": 420, "version": "thumb-bytes"},
            "medium": {"directory": "medium", "maxSide": 1600, "version": "medium-bytes"},
            "full": {"directory": "", "maxSide": 2800, "version": "full-bytes"},
        },
    }]
    urls = MODULE.build_asset_urls(catalogs, "https://cdn.example.test", versioned=True)
    assert urls == [
        "https://cdn.example.test/assets/pages/demo/page-001.webp?v=full-bytes-full-u2",
        "https://cdn.example.test/assets/pages/demo/medium/page-001.webp?v=medium-bytes-medium-u2",
        "https://cdn.example.test/assets/pages/demo/thumbs/page-001.webp?v=thumb-bytes-thumb-u2",
    ]


def test_versioned_urls_fall_back_to_catalog_version_for_legacy_metadata() -> None:
    catalogs = [{
        "id": "demo",
        "dir": "assets/pages/demo",
        "pages": 1,
        "imageExt": "webp",
        "assetVersion": "legacy",
        "imageVariants": {"medium": {"directory": "medium", "maxSide": 1600}},
    }]
    urls = MODULE.build_asset_urls(catalogs, "https://cdn.example.test", versioned=True)
    assert "?v=legacy-full-u2" in urls[0]
    assert "?v=legacy-medium-u2" in urls[1]
    assert "?v=legacy-thumb-u2" in urls[2]


def test_range_get_checks_normal_cached_url_without_bypass_header() -> None:
    captured = {}

    class FakeResponse:
        status = 206
        headers = {"Content-Type": "image/webp", "Content-Length": "1"}

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

    def opener(request, timeout):
        captured["request"] = request
        captured["timeout"] = timeout
        return FakeResponse()

    result = MODULE.check_asset_via_range_get(
        "https://cdn.example.test/assets/pages/demo/medium/page-001.webp?v=release-medium-u2",
        timeout=3.5,
        opener=opener,
    )
    assert result.ok is True
    assert captured["timeout"] == 3.5
    request = captured["request"]
    assert request.get_method() == "GET"
    headers = {key.lower(): value for key, value in request.header_items()}
    assert headers["range"] == "bytes=0-0"
    assert "cache-control" not in headers
