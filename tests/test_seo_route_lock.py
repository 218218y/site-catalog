from __future__ import annotations

import copy
import json
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


def test_subcategory_route_rejects_orphaned_taxonomy_branch() -> None:
    item = MODULE.TaxonomySubcategory(
        category="missing-category",
        name="orphan",
        slug="orphan",
        description="",
    )
    taxonomy = MODULE.Taxonomy(categories=(), subcategories=(item,))
    with pytest.raises(ValueError, match="unknown category"):
        MODULE._subcategory_route(taxonomy, item)


def write_control_panel_sources(
    root: Path,
    *,
    catalogs: list[dict[str, str]],
    taxonomy: dict[str, list[dict[str, str]]],
    route_lock: dict[str, object],
) -> None:
    (root / "seo.config.json").write_text(
        json.dumps(
            {
                "defaultMode": "private",
                "siteUrl": "https://example.com",
                "assetBaseUrl": "https://cdn.example.com",
                "siteName": "Example",
                "locale": "he_IL",
                "defaultShareImage": "share.png",
                "business": {},
            }
        ),
        encoding="utf-8",
    )
    (root / "catalogs.config.json").write_text(
        json.dumps(catalogs, ensure_ascii=False), encoding="utf-8"
    )
    (root / "catalog-taxonomy.config.json").write_text(
        json.dumps(taxonomy, ensure_ascii=False), encoding="utf-8"
    )
    (root / "seo-routes.lock.json").write_text(
        json.dumps(route_lock, ensure_ascii=False), encoding="utf-8"
    )


def test_append_new_configured_routes_registers_new_catalog_automatically(tmp_path: Path) -> None:
    taxonomy = {
        "categories": [
            {"name": "פינות אוכל", "slug": "dining-sets", "description": "תיאור"}
        ],
        "subcategories": [],
    }
    write_control_panel_sources(
        tmp_path,
        catalogs=[
            {"id": "cocktail-2026", "category": "פינות אוכל"},
            {"id": "roya-2026", "category": "פינות אוכל"},
        ],
        taxonomy=taxonomy,
        route_lock={
            "schema": 1,
            "siteUrl": "https://example.com",
            "catalogs": [
                {"id": "cocktail-2026", "route": "/catalog/cocktail-2026/"}
            ],
            "categories": [
                {
                    "name": "פינות אוכל",
                    "slug": "dining-sets",
                    "route": "/category/dining-sets/",
                }
            ],
            "subcategories": [],
        },
    )

    result = MODULE.append_new_configured_routes_to_lock(tmp_path)

    assert result == {"added": ["catalog id: roya-2026"], "unresolved": []}
    stored = MODULE.read_lock(tmp_path)
    assert {item["id"] for item in stored["catalogs"]} == {
        "cocktail-2026",
        "roya-2026",
    }


def test_append_new_routes_never_rewrites_existing_slug_changes(tmp_path: Path) -> None:
    taxonomy = {
        "categories": [
            {"name": "פינות אוכל", "slug": "new-dining", "description": "תיאור"}
        ],
        "subcategories": [],
    }
    write_control_panel_sources(
        tmp_path,
        catalogs=[{"id": "cocktail-2026", "category": "פינות אוכל"}],
        taxonomy=taxonomy,
        route_lock={
            "schema": 1,
            "siteUrl": "https://example.com",
            "catalogs": [
                {"id": "cocktail-2026", "route": "/catalog/cocktail-2026/"}
            ],
            "categories": [
                {
                    "name": "פינות אוכל",
                    "slug": "dining-sets",
                    "route": "/category/dining-sets/",
                }
            ],
            "subcategories": [],
        },
    )

    result = MODULE.append_new_configured_routes_to_lock(tmp_path)

    assert result["added"] == []
    assert any("changed category פינות אוכל" in item for item in result["unresolved"])
    stored = MODULE.read_lock(tmp_path)
    assert stored["categories"][0]["slug"] == "dining-sets"
    assert stored["categories"][0]["route"] == "/category/dining-sets/"


def test_append_new_configured_routes_registers_new_taxonomy_branches(tmp_path: Path) -> None:
    taxonomy = {
        "categories": [
            {"name": "קטגוריה חדשה", "slug": "new-category", "description": "תיאור"}
        ],
        "subcategories": [
            {
                "category": "קטגוריה חדשה",
                "name": "תת חדשה",
                "slug": "new-subcategory",
                "description": "תיאור",
            }
        ],
    }
    write_control_panel_sources(
        tmp_path,
        catalogs=[
            {
                "id": "new-catalog",
                "category": "קטגוריה חדשה",
                "subcategory": "תת חדשה",
            }
        ],
        taxonomy=taxonomy,
        route_lock={
            "schema": 1,
            "siteUrl": "https://example.com",
            "catalogs": [],
            "categories": [],
            "subcategories": [],
        },
    )

    result = MODULE.append_new_configured_routes_to_lock(tmp_path)

    assert result["unresolved"] == []
    assert set(result["added"]) == {
        "catalog id: new-catalog",
        "category: קטגוריה חדשה",
        "subcategory: קטגוריה חדשה / תת חדשה",
    }
    stored = MODULE.read_lock(tmp_path)
    assert stored["catalogs"] == [
        {"id": "new-catalog", "route": "/catalog/new-catalog/"}
    ]
    assert stored["categories"] == [
        {
            "name": "קטגוריה חדשה",
            "slug": "new-category",
            "route": "/category/new-category/",
        }
    ]
    assert stored["subcategories"] == [
        {
            "category": "קטגוריה חדשה",
            "name": "תת חדשה",
            "slug": "new-subcategory",
            "route": "/category/new-category/new-subcategory/",
        }
    ]
