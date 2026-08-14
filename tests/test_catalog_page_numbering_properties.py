from __future__ import annotations

import importlib.util
import random
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "catalog_page_numbering_property_module",
    ROOT / "tools/catalog_page_numbering.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def generated_catalogs(seed: int, count: int = 500) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    return [
        {
            "pages": rng.randint(0, 500),
            "pageNumberStart": rng.choice([0, 1, None, False, "0", "1"]),
        }
        for _ in range(count)
    ]


def test_display_and_asset_page_mappings_are_inverse_on_every_valid_page() -> None:
    for catalog in generated_catalogs(0xB4A619):
        display_pages = list(MODULE.iter_display_pages(catalog))
        assert len(display_pages) == MODULE.page_count(catalog)
        assert display_pages == sorted(set(display_pages))
        for ordinal, display_page in enumerate(display_pages, 1):
            assert MODULE.display_to_asset_page(catalog, display_page) == ordinal
            assert MODULE.asset_to_display_page(catalog, ordinal) == display_page


def test_clamping_is_bounded_idempotent_and_monotonic_for_generated_inputs() -> None:
    rng = random.Random(0xC1A0)
    for catalog in generated_catalogs(0xC1A0):
        first = MODULE.first_display_page(catalog)
        last = MODULE.last_display_page(catalog)
        samples = sorted(rng.randint(-10_000, 10_000) for _ in range(40))
        clamped = [MODULE.clamp_display_page(catalog, value) for value in samples]
        assert clamped == sorted(clamped)
        for value in clamped:
            assert first <= value <= last
            assert MODULE.clamp_display_page(catalog, value) == value
            asset_page = MODULE.display_to_asset_page(catalog, value)
            assert 1 <= asset_page <= max(1, MODULE.page_count(catalog))


def test_invalid_values_fall_back_without_escaping_the_catalog_domain() -> None:
    invalid_values: tuple[Any, ...] = (
        None,
        object(),
        "",
        "1",
        "not-a-page",
        False,
        True,
        1.0,
        [],
        {},
        float("nan"),
    )
    for catalog in generated_catalogs(0xFA11, 100):
        first = MODULE.first_display_page(catalog)
        for value in invalid_values:
            assert MODULE.clamp_display_page(catalog, value) == first
            assert MODULE.display_to_asset_page(catalog, value) == 1
            assert MODULE.asset_to_display_page(catalog, value) == first


def test_page_count_accepts_only_real_integers() -> None:
    assert MODULE.page_count({"pages": 3}) == 3
    assert MODULE.page_count({"pages": 0}) == 0
    assert MODULE.page_count({"pages": -3}) == 0
    for value in (None, False, True, 3.0, "3", "03", [], {}):
        assert MODULE.page_count({"pages": value}) == 0
