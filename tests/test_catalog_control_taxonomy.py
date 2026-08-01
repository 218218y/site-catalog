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


def load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, TOOLS / filename)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


SERVER = load_module("catalog_control_taxonomy_test", "catalog_control_server.py")


def complete_taxonomy():
    return {
        "categories": [
            {
                "name": "קטגוריה",
                "slug": "category",
                "description": "תיאור קטגוריה",
                "originalName": "קטגוריה",
            }
        ],
        "subcategories": [],
    }


def test_atomic_catalog_and_taxonomy_write_is_one_rollback_unit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config_path = tmp_path / "catalogs.config.json"
    taxonomy_path = tmp_path / "catalog-taxonomy.config.json"
    config_path.write_text('[{"id":"old"}]\n', encoding="utf-8")
    taxonomy_path.write_text('{"categories":[],"subcategories":[]}\n', encoding="utf-8")
    before = {config_path: config_path.read_bytes(), taxonomy_path: taxonomy_path.read_bytes()}

    monkeypatch.setattr(SERVER, "CONFIG_FILE", config_path)
    monkeypatch.setattr(SERVER, "TAXONOMY_FILE", taxonomy_path)
    real_write = SERVER.atomic_write_bytes

    def fail_taxonomy(path: Path, data: bytes) -> None:
        if path == taxonomy_path:
            raise OSError("taxonomy write failed")
        real_write(path, data)

    monkeypatch.setattr(SERVER, "atomic_write_bytes", fail_taxonomy)
    with pytest.raises(OSError, match="taxonomy write failed"):
        SERVER.atomic_write_catalogs_and_taxonomy(
            [{"id": "new", "title": "חדש"}], complete_taxonomy()
        )

    assert config_path.read_bytes() == before[config_path]
    assert taxonomy_path.read_bytes() == before[taxonomy_path]


def test_prepare_save_adds_missing_taxonomy_and_applies_name_renames() -> None:
    catalogs = [
        {
            "id": "a",
            "title": "A",
            "pdf": "assets/pdfs/a.pdf",
            "category": "שם ישן",
            "subcategory": "תת ישנה",
        },
        {
            "id": "b",
            "title": "B",
            "pdf": "assets/pdfs/b.pdf",
            "category": "קטגוריה חדשה",
            "subcategory": "תת חדשה",
        },
    ]
    taxonomy = {
        "categories": [
            {
                "name": "שם חדש",
                "originalName": "שם ישן",
                "slug": "new-name",
                "description": "תיאור",
            }
        ],
        "subcategories": [
            {
                "category": "שם חדש",
                "name": "תת חדשה בשם",
                "originalCategory": "שם ישן",
                "originalName": "תת ישנה",
                "slug": "new-sub",
                "description": "תיאור",
            }
        ],
    }

    updated_catalogs, updated_taxonomy, added = SERVER.prepare_taxonomy_and_catalogs_for_save(
        taxonomy, catalogs
    )

    assert updated_catalogs[0]["category"] == "שם חדש"
    assert updated_catalogs[0]["subcategory"] == "תת חדשה בשם"
    assert added["categories"] == ["קטגוריה חדשה"]
    assert added["subcategories"] == ["קטגוריה חדשה / תת חדשה"]
    added_category = next(
        item for item in updated_taxonomy["categories"] if item["name"] == "קטגוריה חדשה"
    )
    assert added_category["slug"] == ""
    assert added_category["description"] == ""


def test_bundle_and_deploy_actions_are_blocked_until_taxonomy_is_complete() -> None:
    incomplete = {"issues": [{"label": "חסר slug"}]}
    complete = {"issues": []}

    assert SERVER.taxonomy_action_availability("convert", incomplete) == (True, "")
    assert SERVER.taxonomy_action_availability("bundle_r2", complete) == (True, "")
    enabled, reason = SERVER.taxonomy_action_availability("bundle_r2", incomplete)
    assert enabled is False
    assert "להשלים" in reason
    enabled, reason = SERVER.taxonomy_action_availability("cloudflare_pages_deploy", incomplete)
    assert enabled is False
    assert "העלאה" in reason


def test_taxonomy_serialization_written_by_server_has_no_editor_metadata(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config_path = tmp_path / "catalogs.config.json"
    taxonomy_path = tmp_path / "catalog-taxonomy.config.json"
    monkeypatch.setattr(SERVER, "CONFIG_FILE", config_path)
    monkeypatch.setattr(SERVER, "TAXONOMY_FILE", taxonomy_path)

    SERVER.atomic_write_catalogs_and_taxonomy(
        [{"id": "a"}],
        {
            "categories": [
                {
                    "name": "קטגוריה",
                    "originalName": "שם קודם",
                    "slug": "category",
                    "description": "תיאור",
                }
            ],
            "subcategories": [],
        },
    )

    stored = json.loads(taxonomy_path.read_text(encoding="utf-8"))
    assert stored == {
        "categories": [
            {"name": "קטגוריה", "slug": "category", "description": "תיאור"}
        ],
        "subcategories": [],
    }


def write_route_sync_fixture(root: Path) -> None:
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
    (root / "seo-routes.lock.json").write_text(
        json.dumps(
            {
                "schema": 1,
                "siteUrl": "https://example.com",
                "catalogs": [
                    {"id": "cocktail-2026", "route": "/catalog/cocktail-2026/"}
                ],
                "categories": [
                    {
                        "name": "קטגוריה",
                        "slug": "category",
                        "route": "/category/category/",
                    }
                ],
                "subcategories": [],
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def test_atomic_control_panel_save_appends_new_public_routes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config_path = tmp_path / "catalogs.config.json"
    taxonomy_path = tmp_path / "catalog-taxonomy.config.json"
    config_path.write_text('[{"id":"cocktail-2026","category":"קטגוריה"}]\n', encoding="utf-8")
    taxonomy_path.write_text(
        json.dumps(complete_taxonomy(), ensure_ascii=False), encoding="utf-8"
    )
    write_route_sync_fixture(tmp_path)
    monkeypatch.setattr(SERVER, "CONFIG_FILE", config_path)
    monkeypatch.setattr(SERVER, "TAXONOMY_FILE", taxonomy_path)

    result = SERVER.atomic_write_catalogs_and_taxonomy(
        [
            {"id": "cocktail-2026", "category": "קטגוריה"},
            {"id": "roya-2026", "category": "קטגוריה"},
        ],
        complete_taxonomy(),
    )

    assert result == {"added": ["catalog id: roya-2026"], "unresolved": []}
    route_lock = json.loads((tmp_path / "seo-routes.lock.json").read_text(encoding="utf-8"))
    assert {item["id"] for item in route_lock["catalogs"]} == {
        "cocktail-2026",
        "roya-2026",
    }


def test_incomplete_taxonomy_draft_does_not_force_route_lock_generation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config_path = tmp_path / "catalogs.config.json"
    taxonomy_path = tmp_path / "catalog-taxonomy.config.json"
    config_path.write_text('[]\n', encoding="utf-8")
    taxonomy_path.write_text('{"categories":[],"subcategories":[]}\n', encoding="utf-8")
    write_route_sync_fixture(tmp_path)
    before_lock = (tmp_path / "seo-routes.lock.json").read_bytes()
    monkeypatch.setattr(SERVER, "CONFIG_FILE", config_path)
    monkeypatch.setattr(SERVER, "TAXONOMY_FILE", taxonomy_path)

    result = SERVER.atomic_write_catalogs_and_taxonomy(
        [{"id": "new-catalog", "category": "קטגוריה חדשה"}],
        {
            "categories": [
                {"name": "קטגוריה חדשה", "slug": "", "description": ""}
            ],
            "subcategories": [],
        },
    )

    assert result == {"added": [], "unresolved": []}
    assert (tmp_path / "seo-routes.lock.json").read_bytes() == before_lock


def test_route_lock_sync_failure_rolls_back_catalog_taxonomy_and_lock(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config_path = tmp_path / "catalogs.config.json"
    taxonomy_path = tmp_path / "catalog-taxonomy.config.json"
    config_path.write_text('[{"id":"old","category":"קטגוריה"}]\n', encoding="utf-8")
    taxonomy_path.write_text(
        json.dumps(complete_taxonomy(), ensure_ascii=False), encoding="utf-8"
    )
    write_route_sync_fixture(tmp_path)
    route_lock_path = tmp_path / "seo-routes.lock.json"
    before = {
        config_path: config_path.read_bytes(),
        taxonomy_path: taxonomy_path.read_bytes(),
        route_lock_path: route_lock_path.read_bytes(),
    }
    monkeypatch.setattr(SERVER, "CONFIG_FILE", config_path)
    monkeypatch.setattr(SERVER, "TAXONOMY_FILE", taxonomy_path)

    def fail_route_sync(root: Path) -> dict[str, list[str]]:
        route_lock_path.write_text('{"partially":"changed"}\n', encoding="utf-8")
        raise OSError("route lock sync failed")

    monkeypatch.setattr(SERVER, "append_new_configured_routes_to_lock", fail_route_sync)
    with pytest.raises(OSError, match="route lock sync failed"):
        SERVER.atomic_write_catalogs_and_taxonomy(
            [{"id": "new", "category": "קטגוריה"}], complete_taxonomy()
        )

    assert config_path.read_bytes() == before[config_path]
    assert taxonomy_path.read_bytes() == before[taxonomy_path]
    assert route_lock_path.read_bytes() == before[route_lock_path]


def test_control_panel_rejects_noncanonical_catalog_fields(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    config_path = tmp_path / "catalogs.config.json"
    config_path.write_text(
        json.dumps(
            [
                {
                    "id": "catalog",
                    "title": "Catalog",
                    "pdf": "assets/pdfs/catalog.pdf",
                    "subCategory": "Old alias",
                }
            ]
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(SERVER, "CONFIG_FILE", config_path)

    with pytest.raises(ValueError, match="unsupported properties"):
        SERVER.read_config()

    normalized = SERVER.validate_catalogs_for_save(
        [
            {
                "id": "catalog",
                "title": "Catalog",
                "pdf": "assets/pdfs/catalog.pdf",
                "subCategory": "Old alias",
            }
        ]
    )
    with pytest.raises(ValueError, match="unsupported properties"):
        SERVER.config_for_file(normalized)
