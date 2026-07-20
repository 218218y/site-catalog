#!/usr/bin/env python3
"""Draft-safe taxonomy editing helpers for the local catalog control panel.

The production SEO loader is intentionally strict. This module handles the
editor state before it is complete: it preserves valid existing values, adds
catalog categories/subcategories that are missing from the taxonomy, and
reports exactly which editorial fields still need attention.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Mapping, Sequence

TAXONOMY_CONFIG_FILE = "catalog-taxonomy.config.json"
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def _text(value: Any) -> str:
    return str(value or "").strip()


def _read_payload(root: Path) -> dict[str, Any]:
    path = root / TAXONOMY_CONFIG_FILE
    if not path.is_file():
        return {"categories": [], "subcategories": []}
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, dict):
        raise ValueError(f"{TAXONOMY_CONFIG_FILE} must contain one JSON object")
    return payload


def _normalize_category(item: Mapping[str, Any], index: int) -> dict[str, str]:
    name = _text(item.get("name"))
    if not name:
        raise ValueError(f"קטגוריה #{index} חסרה שם")
    slug = _text(item.get("slug")).lower()
    if slug and not SLUG_RE.fullmatch(slug):
        raise ValueError(f"slug לא תקין בקטגוריה '{name}': {slug}")
    return {
        "name": name,
        "slug": slug,
        "description": _text(item.get("description")),
        "originalName": _text(item.get("originalName")) or name,
    }


def _normalize_subcategory(item: Mapping[str, Any], index: int) -> dict[str, str]:
    category = _text(item.get("category"))
    name = _text(item.get("name"))
    if not category:
        raise ValueError(f"תת־קטגוריה #{index} חסרה קטגוריית אב")
    if not name:
        raise ValueError(f"תת־קטגוריה #{index} חסרה שם")
    slug = _text(item.get("slug")).lower()
    if slug and not SLUG_RE.fullmatch(slug):
        raise ValueError(f"slug לא תקין בתת־קטגוריה '{category} / {name}': {slug}")
    return {
        "category": category,
        "name": name,
        "slug": slug,
        "description": _text(item.get("description")),
        "originalCategory": _text(item.get("originalCategory")) or category,
        "originalName": _text(item.get("originalName")) or name,
    }


def normalize_taxonomy_draft(value: Any) -> dict[str, list[dict[str, str]]]:
    if not isinstance(value, dict):
        raise ValueError("taxonomy must be an object")
    categories_raw = value.get("categories", [])
    subcategories_raw = value.get("subcategories", [])
    if not isinstance(categories_raw, list):
        raise ValueError("taxonomy categories must be an array")
    if not isinstance(subcategories_raw, list):
        raise ValueError("taxonomy subcategories must be an array")

    categories: list[dict[str, str]] = []
    category_names: set[str] = set()
    category_slugs: set[str] = set()
    for index, raw in enumerate(categories_raw, 1):
        if not isinstance(raw, Mapping):
            raise ValueError(f"קטגוריה #{index} חייבת להיות אובייקט")
        item = _normalize_category(raw, index)
        if item["name"] in category_names:
            raise ValueError(f"שם קטגוריה כפול: {item['name']}")
        if item["slug"] and item["slug"] in category_slugs:
            raise ValueError(f"slug קטגוריה כפול: {item['slug']}")
        category_names.add(item["name"])
        if item["slug"]:
            category_slugs.add(item["slug"])
        categories.append(item)

    subcategories: list[dict[str, str]] = []
    subcategory_names: set[tuple[str, str]] = set()
    subcategory_paths: set[tuple[str, str]] = set()
    category_slug_by_name = {item["name"]: item["slug"] for item in categories}
    category_renames = {
        item["originalName"]: item["name"]
        for item in categories
        if item["originalName"] and item["originalName"] != item["name"]
    }
    for index, raw in enumerate(subcategories_raw, 1):
        if not isinstance(raw, Mapping):
            raise ValueError(f"תת־קטגוריה #{index} חייבת להיות אובייקט")
        item = _normalize_subcategory(raw, index)
        item["category"] = category_renames.get(item["category"], item["category"])
        if item["category"] not in category_names:
            raise ValueError(
                f"תת־הקטגוריה '{item['name']}' מפנה לקטגוריה שאינה קיימת: {item['category']}"
            )
        key = (item["category"], item["name"])
        if key in subcategory_names:
            raise ValueError(f"תת־קטגוריה כפולה: {item['category']} / {item['name']}")
        parent_slug = category_slug_by_name.get(item["category"], "")
        if parent_slug and item["slug"]:
            path_key = (parent_slug, item["slug"])
            if path_key in subcategory_paths:
                raise ValueError(
                    f"נתיב תת־קטגוריה כפול תחת {item['category']}: {item['slug']}"
                )
            subcategory_paths.add(path_key)
        subcategory_names.add(key)
        subcategories.append(item)

    return {"categories": categories, "subcategories": subcategories}


def _catalog_category_order(catalogs: Sequence[Mapping[str, Any]]) -> list[str]:
    result: list[str] = []
    seen: set[str] = set()
    for catalog in catalogs:
        name = _text(catalog.get("category"))
        if name and name not in seen:
            seen.add(name)
            result.append(name)
    return result


def _catalog_subcategory_order(
    catalogs: Sequence[Mapping[str, Any]],
) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    seen: set[tuple[str, str]] = set()
    for catalog in catalogs:
        category = _text(catalog.get("category"))
        name = _text(catalog.get("subcategory", catalog.get("subCategory", "")))
        key = (category, name)
        if not category or not name or key in seen:
            continue
        seen.add(key)
        result.setdefault(category, []).append(name)
    return result


def reconcile_taxonomy_with_catalogs(
    value: Any,
    catalogs: Sequence[Mapping[str, Any]],
) -> tuple[dict[str, list[dict[str, str]]], dict[str, list[str]]]:
    """Return one ordered draft containing every category used by catalogs.

    Active branches follow the catalog order. Unused taxonomy branches are kept
    afterwards in their previous relative order so editorial work is never
    silently deleted.
    """

    draft = normalize_taxonomy_draft(value)
    existing_categories = {item["name"]: dict(item) for item in draft["categories"]}
    category_order = _catalog_category_order(catalogs)
    added_categories: list[str] = []

    categories: list[dict[str, str]] = []
    for name in category_order:
        item = existing_categories.pop(name, None)
        if item is None:
            item = {"name": name, "slug": "", "description": "", "originalName": name}
            added_categories.append(name)
        categories.append(item)
    categories.extend(existing_categories.values())

    known_category_names = {item["name"] for item in categories}
    existing_subcategories = {
        (item["category"], item["name"]): dict(item)
        for item in draft["subcategories"]
        if item["category"] in known_category_names
    }
    subcategory_order = _catalog_subcategory_order(catalogs)
    added_subcategories: list[str] = []
    subcategories: list[dict[str, str]] = []

    for category in [item["name"] for item in categories]:
        for name in subcategory_order.get(category, []):
            key = (category, name)
            item = existing_subcategories.pop(key, None)
            if item is None:
                item = {
                    "category": category,
                    "name": name,
                    "slug": "",
                    "description": "",
                    "originalCategory": category,
                    "originalName": name,
                }
                added_subcategories.append(f"{category} / {name}")
            subcategories.append(item)
        for key in list(existing_subcategories):
            if key[0] == category:
                subcategories.append(existing_subcategories.pop(key))

    return (
        {"categories": categories, "subcategories": subcategories},
        {"categories": added_categories, "subcategories": added_subcategories},
    )


def apply_taxonomy_renames_to_catalogs(
    catalogs: Sequence[Mapping[str, Any]],
    taxonomy: Mapping[str, Sequence[Mapping[str, Any]]],
) -> list[dict[str, Any]]:
    category_renames: dict[str, str] = {}
    for item in taxonomy.get("categories", []):
        original = _text(item.get("originalName"))
        current = _text(item.get("name"))
        if original and current and original != current:
            category_renames[original] = current

    subcategory_renames: dict[tuple[str, str], tuple[str, str]] = {}
    for item in taxonomy.get("subcategories", []):
        original_category = _text(item.get("originalCategory"))
        original_name = _text(item.get("originalName"))
        current_category = _text(item.get("category"))
        current_name = _text(item.get("name"))
        if original_category and original_name and (
            original_category != current_category or original_name != current_name
        ):
            subcategory_renames[(original_category, original_name)] = (
                current_category,
                current_name,
            )

    updated: list[dict[str, Any]] = []
    for source in catalogs:
        row = dict(source)
        category = _text(row.get("category"))
        subcategory = _text(row.get("subcategory", row.get("subCategory", "")))
        replacement = subcategory_renames.get((category, subcategory))
        if replacement is not None:
            row["category"], row["subcategory"] = replacement
        else:
            row["category"] = category_renames.get(category, category)
            row["subcategory"] = subcategory
        updated.append(row)
    return updated


def taxonomy_completion_issues(
    taxonomy: Mapping[str, Sequence[Mapping[str, Any]]],
) -> list[dict[str, str]]:
    issues: list[dict[str, str]] = []
    for item in taxonomy.get("categories", []):
        name = _text(item.get("name"))
        if not _text(item.get("slug")):
            issues.append({"type": "category", "name": name, "field": "slug", "label": f"{name}: חסר slug"})
        if not _text(item.get("description")):
            issues.append({"type": "category", "name": name, "field": "description", "label": f"{name}: חסר תיאור"})
    for item in taxonomy.get("subcategories", []):
        category = _text(item.get("category"))
        name = _text(item.get("name"))
        label_prefix = f"{category} / {name}"
        if not _text(item.get("slug")):
            issues.append({"type": "subcategory", "category": category, "name": name, "field": "slug", "label": f"{label_prefix}: חסר slug"})
        if not _text(item.get("description")):
            issues.append({"type": "subcategory", "category": category, "name": name, "field": "description", "label": f"{label_prefix}: חסר תיאור"})
    return issues


def taxonomy_usage(
    taxonomy: Mapping[str, Sequence[Mapping[str, Any]]],
    catalogs: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    category_counts: dict[str, int] = {}
    subcategory_counts: dict[tuple[str, str], int] = {}
    for catalog in catalogs:
        category = _text(catalog.get("category"))
        subcategory = _text(catalog.get("subcategory", catalog.get("subCategory", "")))
        if category:
            category_counts[category] = category_counts.get(category, 0) + 1
        if category and subcategory:
            key = (category, subcategory)
            subcategory_counts[key] = subcategory_counts.get(key, 0) + 1
    return {
        "categories": category_counts,
        "subcategories": [
            {"category": category, "name": name, "count": count}
            for (category, name), count in subcategory_counts.items()
        ],
    }


def taxonomy_editor_state(
    root: Path,
    catalogs: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    draft, added = reconcile_taxonomy_with_catalogs(_read_payload(root), catalogs)
    issues = taxonomy_completion_issues(draft)
    return {
        **draft,
        "usage": taxonomy_usage(draft, catalogs),
        "issues": issues,
        "complete": not issues,
        "autoAdded": added,
    }


def taxonomy_file_payload(
    taxonomy: Mapping[str, Sequence[Mapping[str, Any]]],
) -> dict[str, list[dict[str, str]]]:
    normalized = normalize_taxonomy_draft(taxonomy)
    return {
        "categories": [
            {
                "name": item["name"],
                "slug": item["slug"],
                "description": item["description"],
            }
            for item in normalized["categories"]
        ],
        "subcategories": [
            {
                "category": item["category"],
                "name": item["name"],
                "slug": item["slug"],
                "description": item["description"],
            }
            for item in normalized["subcategories"]
        ],
    }


def serialize_taxonomy(taxonomy: Mapping[str, Sequence[Mapping[str, Any]]]) -> bytes:
    return (
        json.dumps(taxonomy_file_payload(taxonomy), ensure_ascii=False, indent=2) + "\n"
    ).encode("utf-8")
