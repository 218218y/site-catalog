from __future__ import annotations

import copy
import importlib.util
import random
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "taxonomy_editor_property_module",
    ROOT / "tools/taxonomy_editor.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def generated_catalogs(seed: int, count: int = 80) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    categories = [f"Category {index}" for index in range(1, 12)]
    subcategories = [f"Subcategory {index}" for index in range(1, 20)]
    result: list[dict[str, Any]] = []
    for index in range(count):
        category = rng.choice(categories)
        result.append({
            "id": f"catalog-{index}",
            "category": category,
            "subcategory": rng.choice(subcategories) if rng.random() > 0.2 else "",
        })
    return result


def first_seen(values: list[str]) -> list[str]:
    return list(dict.fromkeys(value for value in values if value))


def test_reconciliation_is_idempotent_and_preserves_first_seen_catalog_order() -> None:
    for seed in range(40):
        catalogs = generated_catalogs(seed)
        reconciled, _ = MODULE.reconcile_taxonomy_with_catalogs(
            {"categories": [], "subcategories": []},
            catalogs,
        )
        repeated, added = MODULE.reconcile_taxonomy_with_catalogs(reconciled, catalogs)

        assert repeated == reconciled
        assert added == {"categories": [], "subcategories": []}
        assert [item["name"] for item in reconciled["categories"]] == first_seen(
            [str(catalog["category"]) for catalog in catalogs]
        )

        actual_pairs = [
            (item["category"], item["name"])
            for item in reconciled["subcategories"]
        ]
        category_order = first_seen([str(catalog["category"]) for catalog in catalogs])
        expected_pairs = [
            pair
            for category in category_order
            for pair in list(dict.fromkeys(
                (str(catalog["category"]), str(catalog["subcategory"]))
                for catalog in catalogs
                if catalog["category"] == category and catalog["subcategory"]
            ))
        ]
        assert actual_pairs == expected_pairs
        assert len(actual_pairs) == len(set(actual_pairs))


def test_taxonomy_serialization_is_canonical_and_does_not_mutate_editor_state() -> None:
    for seed in range(30):
        catalogs = generated_catalogs(seed, 30)
        reconciled, _ = MODULE.reconcile_taxonomy_with_catalogs(
            {"categories": [], "subcategories": []},
            catalogs,
        )
        before = copy.deepcopy(reconciled)
        payload = MODULE.taxonomy_file_payload(reconciled)
        serialized_once = MODULE.serialize_taxonomy(reconciled)
        serialized_twice = MODULE.serialize_taxonomy(reconciled)

        assert reconciled == before
        assert serialized_once == serialized_twice
        assert serialized_once.endswith(b"\n")
        assert all(set(item) == {"name", "slug", "description"} for item in payload["categories"])
        assert all(
            set(item) == {"category", "name", "slug", "description"}
            for item in payload["subcategories"]
        )


def test_catalog_rename_projection_is_pure_and_stable() -> None:
    catalogs = generated_catalogs(0xA11A5, 100)
    taxonomy, _ = MODULE.reconcile_taxonomy_with_catalogs(
        {"categories": [], "subcategories": []},
        catalogs,
    )
    for item in taxonomy["categories"]:
        item["originalName"] = item["name"]
        item["name"] = f"Renamed {item['name']}"
    category_map = {item["originalName"]: item["name"] for item in taxonomy["categories"]}
    for item in taxonomy["subcategories"]:
        item["originalCategory"] = item["category"]
        item["originalName"] = item["name"]
        item["category"] = category_map[item["category"]]
        item["name"] = f"Renamed {item['name']}"

    before = copy.deepcopy(catalogs)
    first = MODULE.apply_taxonomy_renames_to_catalogs(catalogs, taxonomy)
    second = MODULE.apply_taxonomy_renames_to_catalogs(catalogs, taxonomy)

    assert catalogs == before
    assert first == second
    assert [item["id"] for item in first] == [item["id"] for item in catalogs]
