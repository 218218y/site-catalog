#!/usr/bin/env python3
"""Deterministic normalized search-index compiler for catalog page text.

The browser consumes this artifact inside a Web Worker. Normalization and
postings are computed once during the catalog compiler build instead of once
per page on every keystroke.
"""
from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from copy import deepcopy
from typing import Any, Mapping, Sequence

FINAL_LETTERS = str.maketrans({"ך": "כ", "ם": "מ", "ן": "נ", "ף": "פ", "ץ": "צ"})
HEBREW_MARKS_RE = re.compile(r"[\u0591-\u05C7]")
QUOTE_CHARS = frozenset("״׳'\"“”")
SEPARATOR_CHARS = frozenset("־–—_")
SPACE_RE = re.compile(r"\s+")


def normalize_search_text(value: Any) -> str:
    """Return stable Unicode search text equivalent to the browser runtime."""

    normalized = unicodedata.normalize("NFKD", str(value or "")).lower()
    output: list[str] = []
    pending_space = False
    for char in normalized:
        if HEBREW_MARKS_RE.fullmatch(char) or unicodedata.category(char).startswith("M"):
            continue
        if char in QUOTE_CHARS:
            continue
        if char in SEPARATOR_CHARS or not char.isalnum():
            pending_space = bool(output)
            continue
        if pending_space:
            output.append(" ")
            pending_space = False
        output.append(char.translate(FINAL_LETTERS))
    return "".join(output).strip()


def normalize_loose_search_text(value: Any) -> str:
    return normalize_search_text(value).replace("כ", "ב")


def search_tokens(value: Any) -> tuple[str, ...]:
    return tuple(token for token in normalize_search_text(value).split(" ") if token)


def build_normalized_search_index(
    generated: Sequence[Mapping[str, Any]],
    search: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    """Compile compact documents and an inverted token index.

    Catalog metadata is normalized once and referenced by numeric catalog
    position. Each document stores raw text for excerpts and normalized text for
    exact phrase verification. The token -> document postings remove full-page
    scans from the interactive search path.
    """

    search_by_id = {
        str(entry.get("catalogId", "")): entry
        for entry in search
        if isinstance(entry, Mapping)
    }
    catalogs: list[dict[str, Any]] = []
    documents: list[dict[str, Any]] = []
    postings: dict[str, list[int]] = defaultdict(list)
    category_page_counts: dict[str, int] = defaultdict(int)

    for catalog_index, source in enumerate(generated):
        catalog_id = str(source.get("id", ""))
        title = str(source.get("title", ""))
        description = str(source.get("description", ""))
        category = str(source.get("category", ""))
        normalized_fields = {
            "title": normalize_search_text(title),
            "description": normalize_search_text(description),
            "category": normalize_search_text(category),
        }
        catalogs.append({
            "id": catalog_id,
            "title": title,
            "description": description,
            "category": category,
            "sort": int(source.get("sort", 9999)) if isinstance(source.get("sort", 9999), int) else 9999,
            "normalized": normalized_fields,
        })

        search_entry = search_by_id.get(catalog_id, {})
        search_pages = search_entry.get("pages", []) if isinstance(search_entry, Mapping) else []
        text_by_page = {
            int(page_entry.get("page", 0) or 0): SPACE_RE.sub(
                " ", str(page_entry.get("text", ""))
            ).strip()
            for page_entry in search_pages if isinstance(search_pages, list) and isinstance(page_entry, Mapping)
            if int(page_entry.get("page", 0) or 0) >= 1
        }
        metadata_text = " ".join(
            value for value in (
                normalized_fields["title"],
                normalized_fields["description"],
                normalized_fields["category"],
            ) if value
        )
        metadata_tokens = set(metadata_text.split())

        # Every generated page is a searchable document, even when the PDF has
        # no extractable/OCR text. Metadata searches must still be able to open
        # those pages, and corpus/page counts must match the public catalog.
        page_count = max(0, int(source.get("pages", 0) or 0))
        for page in range(1, page_count + 1):
            raw_text = text_by_page.get(page, "")
            normalized_text = normalize_search_text(raw_text)
            document_id = len(documents)
            documents.append({
                "catalog": catalog_index,
                "page": page,
                "text": raw_text,
                "normalized": normalized_text,
            })
            category_page_counts[category] += 1
            for token in sorted(metadata_tokens | set(normalized_text.split())):
                postings[token].append(document_id)

    normalized_postings = {
        token: document_ids
        for token, document_ids in sorted(postings.items(), key=lambda item: item[0])
    }
    return {
        "version": 1,
        "stats": {
            "catalogs": len(catalogs),
            "pages": len(documents),
            "tokens": len(normalized_postings),
            "categoryPages": {
                category: count
                for category, count in sorted(category_page_counts.items(), key=lambda item: item[0])
            },
        },
        "catalogs": catalogs,
        "documents": documents,
        "terms": normalized_postings,
    }


def clone_search_index(value: Mapping[str, Any]) -> dict[str, Any]:
    return deepcopy(dict(value))
