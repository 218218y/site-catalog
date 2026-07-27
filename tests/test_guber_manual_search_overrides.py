from __future__ import annotations

import json
from pathlib import Path

from tools.build_catalogs import load_manual_search_overrides

ROOT = Path(__file__).resolve().parents[1]
CATALOG_ID = "bedrooms-guber-gallery"

PAGE_MODELS = {
    1: "קובה", 2: "קובה", 3: "קובה", 4: "פיזה", 5: "רוסו", 6: "ליאור",
    7: "דאלאס", 8: "שאנל", 9: "פרסטיג", 10: "מאדונה", 11: "רוזאן",
    12: "פרמיום", 13: "לאונרדו", 14: "לאונרדו", 15: "פיזה", 16: "פיזה",
    17: "רוסו", 18: "ליאור", 19: "שירה", 20: "דאלאס", 21: "אלין",
    22: "אלין", 23: "לקסוס", 24: "פרינסס", 25: "קאמילה", 26: "קאמילה",
    27: "ארמני", 28: "בוגארט", 29: "ברונזה", 30: "ברונזה", 31: "מאדונה",
    32: "פרמיום", 33: "פרמיום", 34: "לאונרדו", 35: "רוסו", 36: "ליאור",
    37: "שירה", 38: "דאלאס",
    40: "קובה", 41: "קובה", 42: "פיזה", 43: "פיזה", 44: "רוסו", 45: "רוסו",
    46: "ליאור", 47: "ליאור", 48: "שירה", 49: "שירה", 50: "דאלאס",
    51: "דאלאס", 52: "אלין", 53: "אלין", 54: "לקסוס", 55: "לקסוס",
    56: "פרינסס", 57: "פרינסס", 58: "רויאלטי", 59: "רויאלטי",
    60: "קאמילה", 61: "קאמילה", 62: "שאנל", 63: "שאנל", 64: "ארמני",
    65: "ארמני", 66: "בוגארט", 67: "בוגארט", 68: "ברונזה", 69: "ברונזה",
    70: "פרסטיג", 71: "פרסטיג", 72: "מאדונה", 73: "מאדונה", 74: "רוזאן",
    75: "רוזאן", 76: "פרמיום", 77: "פרמיום", 78: "לאונרדו", 79: "לאונרדו",
}

DETAIL_PAGES = {
    3, 7, 9, 10, 12, 14, 16, 17, 18, 22, 23, 24, 26, 30, 33, 34,
    41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69, 71,
    73, 75, 77, 79,
}


def raw_page_map() -> dict[str, list[str]]:
    payload = json.loads((ROOT / "catalogs.search-overrides.json").read_text(encoding="utf-8"))
    page_map = payload[CATALOG_ID]
    assert isinstance(page_map, dict)
    return page_map


def test_guber_manual_search_override_covers_every_pdf_page() -> None:
    page_map = raw_page_map()

    assert set(page_map) == {str(page) for page in range(1, 80)}
    assert all(isinstance(terms, list) and terms for terms in page_map.values())
    assert all(len(terms) == len(set(terms)) for terms in page_map.values())

    loaded = load_manual_search_overrides(ROOT)[CATALOG_ID]
    assert set(loaded) == set(range(1, 80))
    assert all(loaded[page].strip() for page in range(1, 80))


def test_guber_page_to_model_mapping_and_section_policy_are_locked() -> None:
    page_map = raw_page_map()

    for page, model in PAGE_MODELS.items():
        joined = " ".join(page_map[str(page)])
        assert model in joined, f"page {page} lost model {model}"
        assert f"חדר שינה {model}" in page_map[str(page)]
        if page <= 38:
            assert "מיטה עם הפרדה" in page_map[str(page)]
            assert "הפרדה יהודית" in page_map[str(page)]
            assert "מיטה ללא הפרדה" not in page_map[str(page)]
        else:
            assert "מיטה ללא הפרדה" in page_map[str(page)]
            assert "מיטה כפולה" in page_map[str(page)]
            assert "הפרדה יהודית" not in page_map[str(page)]

    assert "קטלוג מיטות ללא הפרדה" in page_map["39"]
    assert "מיטות ללא הפרדה" in page_map["39"]


def test_guber_common_spelling_variants_are_searchable() -> None:
    page_map = raw_page_map()
    required_variants = {
        7: {"DALAS", "DALLAS", "דלאס"},
        9: {"פרסטיז", "PRESTIGE"},
        10: {"מדונה", "MADONA", "MADONNA"},
        12: {"פרימיום", "PREMIUM"},
        13: {"ליאונרדו", "LEONARDO"},
        23: {"LEXSUS", "LEXUS"},
        24: {"PRINCES", "PRINCESS"},
        25: {"קמילה", "CAMILA", "CAMILLA"},
        27: {"ארמאני", "ARMANI"},
        28: {"בוגרט", "BOGART"},
        29: {"ברונז", "BRONZA", "BRONZE"},
        58: {"רויאליטי", "ROYALTY"},
    }

    for page, variants in required_variants.items():
        assert variants.issubset(set(page_map[str(page)])), f"page {page} lost aliases {variants}"


def test_guber_detail_pages_keep_only_useful_product_search_terms() -> None:
    page_map = raw_page_map()

    for page in DETAIL_PAGES:
        joined = " ".join(page_map[str(page)])
        assert "שידה" in joined, f"page {page} lost nightstand details"
        assert "קומודה" in joined, f"page {page} lost dresser details"
        assert "ארון" in joined, f"page {page} lost wardrobe details"
        assert "160x190" in joined, f"page {page} lost mattress size"

    assert "ארון הזזה 3 דלתות" in page_map["3"]
    assert "ארון בגדים 6 דלתות" in page_map["16"]
    assert "ארון בגדים 6 דלתות" in page_map["23"]
    assert "ספסל מרופד" in page_map["63"]
    assert "ארון הזזה 3 דלתות" in page_map["59"]
