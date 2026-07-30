from __future__ import annotations

from tools.build_catalogs import merge_manual_search_pages


def test_manual_search_merge_is_idempotent() -> None:
    manual = {1: "דגם אלון model alon"}
    original = [{"page": 1, "text": "טקסט שחולץ מהעמוד"}]

    once = merge_manual_search_pages(original, manual, page_count=1)
    twice = merge_manual_search_pages(once, manual, page_count=1)
    three_times = merge_manual_search_pages(twice, manual, page_count=1)

    assert once == twice == three_times
    assert once[0]["text"].endswith("דגם אלון model alon")


def test_manual_search_merge_repairs_legacy_duplicate_suffixes() -> None:
    manual = {1: "דגם אלון model alon"}
    duplicated = [{
        "page": 1,
        "text": "טקסט שחולץ דגם אלון model alon דגם אלון model alon",
    }]

    repaired = merge_manual_search_pages(duplicated, manual, page_count=1)

    assert repaired == [{"page": 1, "text": "טקסט שחולץ דגם אלון model alon"}]


def test_manual_search_merge_uses_token_boundaries() -> None:
    manual = {1: "אלון"}
    original = [{"page": 1, "text": "אלונקה"}]

    merged = merge_manual_search_pages(original, manual, page_count=1)

    assert merged == [{"page": 1, "text": "אלונקה אלון"}]
