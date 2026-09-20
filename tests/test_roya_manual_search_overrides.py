from __future__ import annotations

import json
from pathlib import Path

from tools.build_catalogs import load_manual_search_overrides, merge_manual_search_pages

ROOT = Path(__file__).resolve().parents[1]
CATALOG_ID = "roya-2026"

MODEL_TERMS: dict[int, set[str]] = {
    2: {"DT-015", "DT015", "015-DT"},
    3: {"DT-005", "DT005", "005-DT"},
    4: {"DT-006", "DT-007", "DT-008"},
    5: {"DT-009", "DT009", "009-DT"},
    6: {"DT-010", "DT010", "010-DT"},
    7: {"DT-011", "DT-012"},
    8: {"DT-013", "DT013", "013-DT"},
    9: {"1800 T", "T-1800", "1800-T"},
    10: {"2000-T", "T-2000", "T2000"},
    11: {"82520 HD", "HD-82520", "HD82520"},
    12: {"דגם 160", "כיסא 160 ללא ידית"},
    13: {"160 עם ידית", "כורסא 160"},
    14: {"LENA", "לנה", "לינה"},
    15: {"LENA עם ידית", "לנה עם ידיות"},
    16: {"F82421", "F-82421", "F8242I"},
    17: {"57-Y", "Y-57", "Y57"},
    18: {"דגם 116", "כורסא 116"},
    19: {"6963", "כיסא 6963"},
    20: {"3646", "כיסא 3646"},
    22: {"160 T", "T-160", "160-T"},
    23: {"3070", "שולחן 3070"},
    24: {"101-2", "1012", "2-101"},
}

VERIFIED_DETAILS: dict[int, set[str]] = {
    2: {"200/103", "300/103", "50+50", "פלטת MDF", "רגליים חום פלטה טרוורטין"},
    3: {"200/100", "נפתח עד 5 מטר", "5 הגדלות", "רגל X", "שחור מעונן מבריק"},
    4: {"160/90", "180/90", "200/100", "פתיחת ספר", "לבן עם גידים אפורים מט"},
    5: {"קוטר 135 ס\"מ", "גובה 75 ס\"מ", "50+50", "פלטות הגדלה בקופסה פנימית"},
    6: {"110/140*70*75", "פלטה מבריקה", "חום עץ מבריק", "רגל מתכת שחורה"},
    7: {"100/60", "110/70", "פתיחה אוטומטית 40 ס\"מ", "פתיחה אוטומטית 35 ס\"מ", "קרמיקה"},
    8: {"120/70", "25+25", "פתיחת צדדים 25+25", "טרוורטין מט"},
    9: {"180/180", "40+40", "פתיחת ספר", "רגל ברזל שחורה", "שדרוג לרגל חדשה"},
    10: {"200/100", "40+40", "פתיחת ספר", "עץ אלון מבריק"},
    11: {"110x86x51", "מושב בד", "בז'", "אפור", "חום"},
    12: {"קטיפה כחול", "בד רגיל מוקה", "רגלי מתכת שחורות"},
    13: {"כיסא מרופד עם ידיות", "קטיפה שחור", "בד רגיל בז'"},
    14: {"כיסא לנה ללא ידיות", "קטיפה אפור", "בד רגיל מוקה"},
    15: {"בד חדיש", "שמנת", "מוקה", "רגלי מתכת שחורות"},
    16: {"66x64x61", "BEIGE", "GREY", "PINK", "BLACK", "רגל ברזל שחורה"},
    17: {"כיסא דמוי עור", "אפור בהיר", "רגל ברזל שחורה", "רגל ברזל אפור בהיר"},
    18: {"CREAM", "DARK GRAY", "DARK GREEN", "ORANGE", "עומק מושב 46", "גובה מהרצפה לגב 76"},
    19: {"בד דמוי עור", "נוחות מקסימלית", "תמיכה רכה לגב", "אפור מעונן"},
    20: {"מושב 42x45", "רוחב מושב 56", "גובה כיסא 85", "אפור דו גוני", "ירוק כהה"},
    21: {"110/70", "100/60", "90/70", "שולחן נפתח אוטומטי", "לבן עם גידים אפורים", "רגל עץ שחור מבריק"},
    22: {"160/90", "פתיחת ספר 40 ס\"מ", "פלטת MDF", "שחור מבריק גידים", "רגל חדשה"},
    23: {"120/70", "25+25", "שולחן נפתח משני הצדדים", "פלטת שיש", "שמנת"},
    24: {"קוטר 60", "קוטר 90", "הצמדה ביחד 132 ס\"מ", "גובה שולחן גדול 36 ס\"מ", "שחור מעונן"},
}


def raw_page_map() -> dict[str, list[str]]:
    payload = json.loads((ROOT / "catalogs.search-overrides.json").read_text(encoding="utf-8"))
    page_map = payload[CATALOG_ID]
    assert isinstance(page_map, dict)
    return page_map


def test_roya_manual_search_override_covers_every_pdf_page() -> None:
    page_map = raw_page_map()

    assert set(page_map) == {str(page) for page in range(1, 25)}
    assert all(isinstance(terms, list) and terms for terms in page_map.values())
    assert all(len(terms) == len(set(terms)) for terms in page_map.values())

    loaded = load_manual_search_overrides(ROOT)[CATALOG_ID]
    assert set(loaded) == set(range(1, 25))
    assert all(loaded[page].strip() for page in range(1, 25))


def test_roya_model_aliases_follow_the_current_24_page_pdf() -> None:
    page_map = raw_page_map()

    assert {"רויה", "Roya", "Roya Exclusive", "פינות אוכל"}.issubset(set(page_map["1"]))
    for page, expected_terms in MODEL_TERMS.items():
        assert expected_terms.issubset(set(page_map[str(page)])), f"page {page} lost model aliases"

    # Page 21 intentionally has no printed model number in the source catalog.
    assert "שולחן אוכל" in page_map["21"]
    assert "שולחן נפתח אוטומטי" in page_map["21"]


def test_roya_verified_dimensions_colors_and_features_are_locked() -> None:
    page_map = raw_page_map()

    for page, expected_terms in VERIFIED_DETAILS.items():
        assert expected_terms.issubset(set(page_map[str(page)])), f"page {page} lost verified search details"


def test_roya_manual_only_search_is_complete_when_ocr_is_disabled() -> None:
    manual_pages = load_manual_search_overrides(ROOT)[CATALOG_ID]
    merged = merge_manual_search_pages([], manual_pages, page_count=24)

    assert [page["page"] for page in merged] == list(range(1, 25))
    assert "DT-015" in merged[1]["text"]
    assert "DT-005" in merged[2]["text"]
    assert "101-2" in merged[23]["text"]


def test_roya_checked_in_search_artifacts_match_the_manual_source() -> None:
    manual_pages = load_manual_search_overrides(ROOT)[CATALOG_ID]

    state = json.loads((ROOT / "catalogs.build-state.json").read_text(encoding="utf-8"))
    state_catalog = next(item for item in state["catalogs"] if item["id"] == CATALOG_ID)
    state_pages = {item["page"]: item["text"] for item in state_catalog["searchPages"]}
    assert state_catalog["pages"] == 24
    assert state_pages == manual_pages

    search_index = json.loads((ROOT / "catalogs.search-index.json").read_text(encoding="utf-8"))
    catalog_number = next(
        index for index, item in enumerate(search_index["catalogs"]) if item["id"] == CATALOG_ID
    )
    indexed_pages = {
        item["page"]: item["text"]
        for item in search_index["documents"]
        if item["catalog"] == catalog_number
    }
    assert indexed_pages == manual_pages
    assert "DT-015" in indexed_pages[2]
    assert "DT-005" in indexed_pages[3]
    assert "101-2" in indexed_pages[24]
