"""Canonical catalog display-page to physical-asset page mapping."""
from __future__ import annotations

from collections.abc import Iterator, Mapping

DEFAULT_PAGE_NUMBER_START = 1


def page_number_start(catalog: Mapping[str, object] | None) -> int:
    value = catalog.get("pageNumberStart") if catalog is not None else None
    return 0 if isinstance(value, int) and not isinstance(value, bool) and value == 0 else DEFAULT_PAGE_NUMBER_START


def _integer_or(value: object, fallback: int) -> int:
    """Return a real integer value without accepting coercible lookalikes."""
    return value if isinstance(value, int) and not isinstance(value, bool) else fallback


def page_count(catalog: Mapping[str, object] | None) -> int:
    value = catalog.get("pages") if catalog is not None else None
    return max(0, _integer_or(value, 0))


def first_display_page(catalog: Mapping[str, object] | None) -> int:
    return page_number_start(catalog)


def last_display_page(catalog: Mapping[str, object] | None) -> int:
    first = first_display_page(catalog)
    count = page_count(catalog)
    return first + count - 1 if count else first


def clamp_display_page(catalog: Mapping[str, object] | None, display_page: object) -> int:
    first = first_display_page(catalog)
    last = last_display_page(catalog)
    value = _integer_or(display_page, first)
    return min(max(value, first), last)


def display_to_asset_page(catalog: Mapping[str, object] | None, display_page: object) -> int:
    return clamp_display_page(catalog, display_page) - first_display_page(catalog) + 1


def asset_to_display_page(catalog: Mapping[str, object] | None, asset_page: object) -> int:
    count = max(1, page_count(catalog))
    value = _integer_or(asset_page, 1)
    return first_display_page(catalog) + min(max(value, 1), count) - 1


def iter_display_pages(catalog: Mapping[str, object] | None) -> Iterator[int]:
    first = first_display_page(catalog)
    yield from range(first, first + page_count(catalog))
