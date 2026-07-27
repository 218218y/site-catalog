from __future__ import annotations

import json
from pathlib import Path

from tools.build_catalogs import load_manual_search_overrides, merge_manual_search_pages

ROOT = Path(__file__).resolve().parents[1]
CATALOG_ID = "hi-riser-comfort-2026"

MODEL_GROUPS = {
    "לירי": ({4, 5}, {"Liri"}),
    "אלמה": ({6, 7}, {"עלמה", "Alma"}),
    "סולה": ({8, 9}, {"סולא", "Sola"}),
    "ליבה": ({10, 11}, {"ליבא", "Liba"}),
    "קיארה": ({12, 13}, {"קיארא", "Kiara", "Chiara"}),
    "ליאה": ({14, 15}, {"ליה", "Lia", "Leah"}),
    "נוי": ({16, 17, 18, 19}, {"Noy"}),
    "בלה": ({20, 21}, {"Bella"}),
    "אוריאן": ({22, 23}, {"אוריין", "Orian"}),
    "צופית": ({24, 25}, {"Tzofit", "Tsofit"}),
    "לילך": ({26, 27}, {"Lilach"}),
    "ניצן": ({28, 29}, {"Nitzan"}),
    "נופר": ({30, 31}, {"Nofar"}),
    "שקד": ({32, 33}, {"Shaked"}),
    "טוליפ": ({34, 35}, {"Tulip"}),
    "לילי": ({36, 37}, {"Lily"}),
    "רוז": ({38, 39}, {"Rose"}),
    "ורד": ({40, 41}, {"Vered"}),
    "סיגלית": ({42, 43}, {"סגלית", "Sigalit"}),
    "לבנדר": ({44, 45}, {"לוונדר", "Lavender"}),
    "צילי": ({46, 47}, {"Tzili", "Tsili"}),
    "רינה": ({48, 49}, {"Rina"}),
    "גילי": ({50, 51}, {"Gili"}),
    "טלי": ({52, 53}, {"Tali"}),
}

MODEL_PAGE_TO_NAME = {
    page: model
    for model, (pages, _aliases) in MODEL_GROUPS.items()
    for page in pages
}

VERIFIED_MODEL_DETAILS = {
    4: {"מיטה כפולה 90", "מיטה כפולה עם ארגז", "עשר שנות אחריות"},
    6: {"מיטה מקוצרת", "מתכת עבה", "מיטה יציבה"},
    8: {"מיטה רביעיה", "מנגנון היי רייזר פרימיום", "מנגנון הרמה"},
    10: {"מיטה כפולה עם ארגז", "מתכת דמוי פולימר"},
    12: {"משטח מתכת צבוע", "בסיס לא מרעיש", "אוורור למזרן"},
    14: {"מיטת קומותיים", "מזרן ספוג", "ספוג בצפיפות גבוהה"},
    16: {"מיטה רביעיה", "מיטת קומותיים", "בד כביס", "בד נשלף"},
    20: {"מיטה כפולה 90", "מיטת קומותיים", "צביעה בתנור אלקטרוסטטי", "3 שכבות צבע"},
    22: {"מיטה כפולה 90", "מיטה כפולה עם ארגז", "תאורת לד צבעונית"},
    24: {"מיטה שלישיה", "ללא שפיצים", "בטיחותי לילדים"},
    26: {"פולימר צבעוני", "בדי ריפוד"},
    28: {"אביזרים משלימים", "אקססוריז", "כריות", "מדפים"},
    32: {"פתרונות להרכב משפחתי"},
    40: {"סדין במבינו", "סדין בצבע המזרן"},
    46: {"סדרת סטנדרט", "שנה אחריות", "צביעה בתנור שכבה אחת", "רשת ברזל בתחתית המיטה"},
    48: {"סדרת סטנדרט", "מתכת בצבע שמנת", "מתכת בצבע אפור"},
    50: {"סדרת סטנדרט", "שנה אחריות", "רשת ברזל בתחתית המיטה"},
    52: {"סדרת סטנדרט", "מתכת בצבע שמנת", "מתכת בצבע אפור"},
}

RECURRING_NOISE = {
    "אלפי ממליצים",
    "חברה אחת שתמיד פה",
    "350",
    "GB",
    "כל הזכויות שמורות",
    "אין להעתיק",
    "הסרן 25",
    "03-3611221",
}


def raw_page_map() -> dict[str, list[str]]:
    payload = json.loads((ROOT / "catalogs.search-overrides.json").read_text(encoding="utf-8"))
    page_map = payload[CATALOG_ID]
    assert isinstance(page_map, dict)
    return page_map


def test_comfort_manual_search_override_covers_every_pdf_page() -> None:
    page_map = raw_page_map()

    assert set(page_map) == {str(page) for page in range(1, 61)}
    assert all(isinstance(terms, list) and terms for terms in page_map.values())
    assert all(len(terms) == len(set(terms)) for terms in page_map.values())

    loaded = load_manual_search_overrides(ROOT)[CATALOG_ID]
    assert set(loaded) == set(range(1, 61))
    assert all(loaded[page].strip() for page in range(1, 61))


def test_comfort_model_pages_keep_names_aliases_and_search_context() -> None:
    page_map = raw_page_map()

    for model, (pages, aliases) in MODEL_GROUPS.items():
        for page in pages:
            terms = set(page_map[str(page)])
            assert model in terms, f"page {page} lost model {model}"
            assert aliases.issubset(terms), f"page {page} lost aliases for {model}"
            assert f"דגם {model}" in terms
            assert f"מיטת {model}" in terms
            assert f"קומפורט {model}" in terms
            assert f"היי רייזר {model}" in terms
            assert f"היי ריזר {model}" in terms
            assert f"היירייזר {model}" in terms
            assert f"הייריזר {model}" in terms


def test_comfort_verified_configurations_and_features_are_locked() -> None:
    page_map = raw_page_map()

    for page, expected_terms in VERIFIED_MODEL_DETAILS.items():
        assert expected_terms.issubset(set(page_map[str(page)])), f"page {page} lost verified details"

    assert "מיטה מתרוממת" in page_map["19"]
    assert "מנגנון היי רייזר" in page_map["25"]
    assert "מיטת קומותיים" in page_map["15"]
    assert "מיטת קומותיים" in page_map["21"]


def test_comfort_non_model_products_remain_searchable_without_ocr() -> None:
    page_map = raw_page_map()

    assert {"מיטת מתכת לחדר שינה", "כולל ארגז מצעים", "שידה"}.issubset(set(page_map["54"]))
    assert {"כולל ראש מיטה", "מיטה עם ארגז מצעים", "שידה"}.issubset(set(page_map["55"]))
    assert {
        "מזרני קומפורט הוטל",
        "וולדורף",
        "פרימה",
        "לונארדו",
        "לאונרדו",
        "רמדה",
        "25 שנות אחריות",
    }.issubset(set(page_map["56"]))
    assert {"ארגז מצעים קומפורט", "מתכת מחופה פולימר", "תכולה גדולה", "טריקה שקטה"}.issubset(
        set(page_map["57"])
    )

    complete_terms = {
        "מיטת קומפורט קומפלט",
        "מיטת קיר",
        "מיטה מתקפלת",
        "פתיחה אופקית",
        "פתיחה אנכית",
        "מזרן 80x190",
        "מיטה לקליניקה",
        "מיטה לחדר אירוח",
    }
    assert complete_terms.issubset(set(page_map["58"]))
    assert complete_terms.issubset(set(page_map["59"]))


def test_comfort_manual_only_search_keeps_all_pages_after_ocr_is_disabled() -> None:
    manual_pages = load_manual_search_overrides(ROOT)[CATALOG_ID]
    merged = merge_manual_search_pages([], manual_pages, page_count=60)

    assert [page["page"] for page in merged] == list(range(1, 61))
    for page in merged:
        page_number = page["page"]
        text = page["text"]
        if page_number in MODEL_PAGE_TO_NAME:
            assert MODEL_PAGE_TO_NAME[page_number] in text

    assert "היי רייזר קומפורט 2026" in merged[0]["text"]
    assert "היי ריזר קומפורט 2026" in merged[0]["text"]
    assert "Hi Riser Comfort 2026" in merged[0]["text"]
    assert "מיטת קומפורט קומפלט" in merged[57]["text"]
    assert "מיטת קומפורט קומפלט" in merged[58]["text"]
    assert "קטלוג קומפורט 2026" in merged[59]["text"]


def test_comfort_manual_search_excludes_repeated_ocr_and_legal_noise() -> None:
    page_map = raw_page_map()

    for page, terms in page_map.items():
        joined = " ".join(terms)
        for fragment in RECURRING_NOISE:
            assert fragment not in joined, f"page {page} contains repeated non-search text: {fragment}"
