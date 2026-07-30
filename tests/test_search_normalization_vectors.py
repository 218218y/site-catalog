from __future__ import annotations

import json
from pathlib import Path

from tools.catalog_search_index import (
    normalize_loose_search_text,
    normalize_search_text,
    search_tokens,
)

ROOT = Path(__file__).resolve().parents[1]
VECTORS = json.loads(
    (ROOT / "tests/fixtures/search_normalization_vectors.json").read_text(encoding="utf-8")
)


def test_shared_search_normalization_vectors() -> None:
    for vector in VECTORS:
        assert normalize_search_text(vector["input"]) == vector["normalized"], vector["name"]
        assert normalize_loose_search_text(vector["input"]) == vector["loose"], vector["name"]
        assert list(search_tokens(vector["input"])) == vector["tokens"], vector["name"]
