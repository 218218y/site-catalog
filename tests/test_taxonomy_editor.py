from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools" / "taxonomy_editor.py"
SPEC = importlib.util.spec_from_file_location("taxonomy_editor_test_module", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def base_taxonomy():
    return {
        "categories": [
            {
                "name": "קטגוריה קיימת",
                "slug": "existing",
                "description": "תיאור קיים",
            },
            {
                "name": "קטגוריה לא בשימוש",
                "slug": "unused",
                "description": "נשמרת לעריכה עתידית",
            },
        ],
        "subcategories": [
            {
                "category": "קטגוריה קיימת",
                "name": "תת קיימת",
                "slug": "existing-sub",
                "description": "תיאור תת קיים",
            }
        ],
    }


def test_reconcile_adds_missing_branches_in_catalog_order_and_marks_editorial_fields_blank():
    catalogs = [
        {"id": "a", "category": "קטגוריה חדשה", "subcategory": "תת חדשה"},
        {"id": "b", "category": "קטגוריה קיימת", "subcategory": "תת קיימת"},
    ]

    result, added = MODULE.reconcile_taxonomy_with_catalogs(base_taxonomy(), catalogs)

    assert [item["name"] for item in result["categories"]] == [
        "קטגוריה חדשה",
        "קטגוריה קיימת",
        "קטגוריה לא בשימוש",
    ]
    new_category = result["categories"][0]
    assert new_category["slug"] == ""
    assert new_category["description"] == ""
    assert result["subcategories"][0]["category"] == "קטגוריה חדשה"
    assert result["subcategories"][0]["name"] == "תת חדשה"
    assert added == {
        "categories": ["קטגוריה חדשה"],
        "subcategories": ["קטגוריה חדשה / תת חדשה"],
    }


def test_completion_issues_report_only_missing_slug_and_description():
    result, _ = MODULE.reconcile_taxonomy_with_catalogs(
        base_taxonomy(),
        [{"id": "a", "category": "קטגוריה חדשה", "subcategory": "תת חדשה"}],
    )
    labels = [item["label"] for item in MODULE.taxonomy_completion_issues(result)]
    assert "קטגוריה חדשה: חסר slug" in labels
    assert "קטגוריה חדשה: חסר תיאור" in labels
    assert "קטגוריה חדשה / תת חדשה: חסר slug" in labels
    assert "קטגוריה חדשה / תת חדשה: חסר תיאור" in labels


def test_category_and_subcategory_renames_update_catalog_references():
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
                "name": "תת חדשה",
                "originalCategory": "שם ישן",
                "originalName": "תת ישנה",
                "slug": "new-sub",
                "description": "תיאור",
            }
        ],
    }
    normalized = MODULE.normalize_taxonomy_draft(taxonomy)
    updated = MODULE.apply_taxonomy_renames_to_catalogs(
        [{"id": "a", "category": "שם ישן", "subcategory": "תת ישנה"}],
        normalized,
    )
    assert updated[0]["category"] == "שם חדש"
    assert updated[0]["subcategory"] == "תת חדשה"


def test_taxonomy_file_payload_strips_editor_only_original_fields():
    normalized = MODULE.normalize_taxonomy_draft(
        {
            "categories": [
                {
                    "name": "קטגוריה",
                    "originalName": "ישן",
                    "slug": "category",
                    "description": "תיאור",
                }
            ],
            "subcategories": [],
        }
    )
    payload = MODULE.taxonomy_file_payload(normalized)
    assert payload == {
        "categories": [
            {"name": "קטגוריה", "slug": "category", "description": "תיאור"}
        ],
        "subcategories": [],
    }
