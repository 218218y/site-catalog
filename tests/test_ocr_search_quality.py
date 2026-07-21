from __future__ import annotations

import subprocess
from types import SimpleNamespace

from PIL import Image

from tools.build_catalogs import OcrRunner, RenderOptions
from tools.ocr_search_quality import FULL_PAGE_OCR_PSM, filter_tesseract_tsv


TSV_HEADER = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext"


def make_tsv(rows: list[tuple[int, int, int, int, float, str]]) -> str:
    values = [TSV_HEADER]
    for block, paragraph, line, word, confidence, text in rows:
        values.append(
            f"5\t1\t{block}\t{paragraph}\t{line}\t{word}\t0\t0\t100\t30\t{confidence}\t{text}"
        )
    return "\n".join(values) + "\n"


def test_full_page_filter_rejects_noise_and_keeps_searchable_terms() -> None:
    result = filter_tesseract_tsv(
        make_tsv(
            [
                (1, 1, 1, 1, 94, "שלום"),
                (1, 1, 1, 2, 99, "|"),
                (1, 1, 1, 3, 96, "SSSS"),
                (1, 1, 1, 4, 96, "TR"),
                (2, 1, 1, 1, 73, "מיטה"),
                (2, 1, 1, 2, 72, "איכותית"),
                (3, 1, 1, 1, 92, "160x200"),
                (4, 1, 1, 1, 95, "םאב"),
                (5, 1, 1, 1, 45, "ארון"),
                (6, 1, 1, 1, 91, "12"),
            ]
        ),
        min_confidence=65,
    )

    assert result.text == "שלום מיטה איכותית 160x200"
    assert result.total_words == 10
    assert result.accepted_words == 4
    assert result.rejected_low_confidence == 1
    assert result.rejected_invalid >= 4
    assert result.rejected_lines >= 1


def test_targeted_title_filter_is_more_permissive_but_still_structural() -> None:
    result = filter_tesseract_tsv(
        make_tsv(
            [
                (1, 1, 1, 1, 52, "FREDI"),
                (1, 1, 1, 2, 49, "כפולה"),
                (1, 1, 1, 3, 99, "||"),
                (1, 1, 1, 4, 30, "נמוך"),
            ]
        ),
        min_confidence=45,
        max_words=8,
        title_mode=True,
    )

    assert result.text == "FREDI כפולה"
    assert result.accepted_words == 2
    assert result.rejected_low_confidence == 1


def test_filter_collapses_duplicate_lines_and_honors_word_cap() -> None:
    result = filter_tesseract_tsv(
        make_tsv(
            [
                (1, 1, 1, 1, 95, "ארון"),
                (1, 1, 1, 2, 95, "ארון"),
                (2, 1, 1, 1, 95, "ארון"),
                (3, 1, 1, 1, 95, "מיטה"),
                (3, 1, 1, 2, 95, "זוגית"),
            ]
        ),
        min_confidence=65,
        max_words=2,
    )

    assert result.text == "ארון מיטה"
    assert result.accepted_words == 2


def test_filter_fails_closed_for_non_tsv_output() -> None:
    result = filter_tesseract_tsv("random noisy plain OCR text | | |")
    assert result.text == ""
    assert result.malformed_tsv is True


def test_ocr_runner_requests_tsv_lstm_and_filters_stdout(monkeypatch) -> None:
    options = RenderOptions(
        dpi=220,
        max_width=2800,
        max_height=2800,
        medium_size=1600,
        thumb_size=420,
        quality=84,
        medium_quality=82,
        thumb_quality=76,
        image_format="webp",
        clean=True,
        skip_existing=False,
        sharpen=0.8,
        ocr_mode="auto",
        ocr_lang="heb+eng",
        ocr_dpi=260,
        ocr_min_chars=16,
        ocr_min_confidence=65,
        ocr_title_min_confidence=45,
        ocr_max_words_per_page=180,
        tesseract_cmd="tesseract",
        require_ocr=True,
    )
    runner = OcrRunner(options)
    monkeypatch.setattr(runner, "_is_available", lambda: True)
    captured: dict[str, list[str]] = {}

    def fake_run(command, **kwargs):
        captured["command"] = list(command)
        return SimpleNamespace(
            returncode=0,
            stdout=make_tsv(
                [
                    (1, 1, 1, 1, 95, "ארון"),
                    (1, 1, 1, 2, 20, "רעש"),
                    (1, 1, 1, 3, 99, "|"),
                ]
            ),
            stderr="",
        )

    monkeypatch.setattr(subprocess, "run", fake_run)
    text = runner.recognize(Image.new("RGB", (200, 100), "white"), "sample page")

    assert text == "ארון"
    command = captured["command"]
    assert command[command.index("--psm") + 1] == str(FULL_PAGE_OCR_PSM)
    assert command[command.index("--oem") + 1] == "1"
    assert command[-1] == "tsv"
