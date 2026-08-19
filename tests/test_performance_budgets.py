from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "check_performance_budgets",
    ROOT / "tools" / "check_performance_budgets.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def write_fixture(root: Path, *, app_size: int = 100, html_size: int = 100) -> Path:
    (root / "app-catalog.js").write_bytes(b"a" * app_size)
    (root / "styles-catalog.css").write_bytes(b"b" * 100)
    (root / "catalogs.search-index.json").write_bytes(b"c" * 100)
    (root / "catalog-search-worker.js").write_bytes(b"d" * 100)
    Image.new("RGB", (1200, 630), "white").save(root / "social-share-default.png", optimize=True)
    budget = {
        "requiredHeadroomPercent": 0,
        "javascriptBundles": {
            "catalog": {
                "source": "app-catalog.js",
                "bundlePattern": "static/app-catalog.*.js",
                "rawBytes": 500,
                "gzipBytes": 100,
            }
        },
        "cssBundles": {
            "catalog": {
                "source": "styles-catalog.css",
                "bundlePattern": "static/styles-catalog.*.css",
                "rawBytes": 500,
                "gzipBytes": 100,
            }
        },
        "searchIndex": {
            "source": "catalogs.search-index.json",
            "bundlePattern": "static/catalogs.search-index.*.json",
            "rawBytes": 500,
            "gzipBytes": 100,
        },
        "searchWorker": {
            "source": "catalog-search-worker.js",
            "bundlePattern": "static/catalog-search-worker.*.js",
            "rawBytes": 500,
            "gzipBytes": 100,
        },
        "largestHtml": {"rawBytes": 500, "gzipBytes": 100},
        "socialShareImage": {
            "source": "social-share-default.png",
            "rawBytes": 10000,
            "width": 1200,
            "height": 630,
        },
    }
    (root / "performance-budgets.json").write_text(json.dumps(budget), encoding="utf-8")

    bundle = root / "bundle"
    (bundle / "static").mkdir(parents=True)
    (bundle / "static" / "app-catalog.abc.js").write_bytes(b"a" * app_size)
    (bundle / "static" / "styles-catalog.abc.css").write_bytes(b"b" * 100)
    (bundle / "static" / "catalogs.search-index.abc.json").write_bytes(b"c" * 100)
    (bundle / "static" / "catalog-search-worker.abc.js").write_bytes(b"d" * 100)
    (bundle / "index.html").write_bytes(b"<" + b"x" * html_size + b">")
    return bundle


def test_budget_checker_accepts_source_and_bundle_within_limits(tmp_path: Path) -> None:
    bundle = write_fixture(tmp_path)
    measurements = MODULE.check_performance_budgets(tmp_path, bundle)
    labels = {item.label for item in measurements}
    assert "Catalog JavaScript" in labels
    assert "Deploy catalog JavaScript" in labels
    assert any(label.startswith("Largest HTML") for label in labels)


def test_budget_checker_reports_the_specific_exceeded_budget(tmp_path: Path) -> None:
    bundle = write_fixture(tmp_path, app_size=700)
    with pytest.raises(RuntimeError, match="Catalog JavaScript raw size"):
        MODULE.check_performance_budgets(tmp_path, bundle)


def test_budget_checker_rejects_wrong_share_image_dimensions(tmp_path: Path) -> None:
    bundle = write_fixture(tmp_path)
    Image.new("RGB", (1000, 630), "white").save(tmp_path / "social-share-default.png")
    with pytest.raises(RuntimeError, match="dimensions are 1000x630"):
        MODULE.check_performance_budgets(tmp_path, bundle)



def test_javascript_can_enforce_stricter_headroom_than_css(tmp_path: Path) -> None:
    bundle = write_fixture(tmp_path, app_size=410)
    budget_path = tmp_path / "performance-budgets.json"
    budget = json.loads(budget_path.read_text(encoding="utf-8"))
    budget["javascriptRequiredHeadroomPercent"] = 20
    budget_path.write_text(json.dumps(budget), encoding="utf-8")

    with pytest.raises(RuntimeError, match="20% headroom"):
        MODULE.check_performance_budgets(tmp_path, bundle)

def test_project_assets_fit_committed_budgets() -> None:
    measurements = MODULE.check_performance_budgets(ROOT)
    assert measurements
