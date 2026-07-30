"""Canonical catalog display-page to physical-asset page mapping."""
from __future__ import annotations

from collections.abc import Iterator, Mapping
from typing import Any

DEFAULT_PAGE_NUMBER_START = 1


def page_number_start(catalog: Mapping[str, Any] | None) -> int:
    value = catalog.get("pageNumberStart") if catalog is not None else None
    return 0 if isinstance(value, int) and not isinstance(value, bool) and value == 0 else DEFAULT_PAGE_NUMBER_START


def page_count(catalog: Mapping[str, Any] | None) -> int:
    try:
        value = int((catalog or {}).get("pages", 0) or 0)
    except (TypeError, ValueError):
        return 0
    return max(0, value)


def first_display_page(catalog: Mapping[str, Any] | None) -> int:
    return page_number_start(catalog)


def last_display_page(catalog: Mapping[str, Any] | None) -> int:
    first = first_display_page(catalog)
    count = page_count(catalog)
    return first + count - 1 if count else first


def clamp_display_page(catalog: Mapping[str, Any] | None, display_page: Any) -> int:
    first = first_display_page(catalog)
    last = last_display_page(catalog)
    try:
        value = int(display_page)
    except (TypeError, ValueError):
        value = first
    return min(max(value, first), last)


def display_to_asset_page(catalog: Mapping[str, Any] | None, display_page: Any) -> int:
    return clamp_display_page(catalog, display_page) - first_display_page(catalog) + 1


def asset_to_display_page(catalog: Mapping[str, Any] | None, asset_page: Any) -> int:
    count = max(1, page_count(catalog))
    try:
        value = int(asset_page)
    except (TypeError, ValueError):
        value = 1
    return first_display_page(catalog) + min(max(value, 1), count) - 1


def iter_display_pages(catalog: Mapping[str, Any] | None) -> Iterator[int]:
    first = first_display_page(catalog)
    yield from range(first, first + page_count(catalog))
