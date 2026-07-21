#!/usr/bin/env python3
"""Conservative cleanup for Tesseract TSV used by the catalog search index.

The search index values precision over recall: a missing OCR word can still be
added through catalogs.search-overrides.json, while random punctuation and
photo-derived glyphs make every search result worse.  This module therefore
keeps embedded PDF text and manual overrides out of scope and filters only OCR
words, using Tesseract's per-word confidence plus script-aware heuristics.
"""
from __future__ import annotations

import csv
import io
import re
import unicodedata
from collections import OrderedDict
from dataclasses import dataclass

OCR_SEARCH_PIPELINE_VERSION = 2
FULL_PAGE_OCR_PSM = 11
DEFAULT_OCR_MIN_CONFIDENCE = 65
DEFAULT_OCR_TITLE_MIN_CONFIDENCE = 45
DEFAULT_OCR_MAX_WORDS_PER_PAGE = 180

_BIDI_CONTROL_RE = re.compile(r"[\u200e\u200f\u202a-\u202e\u2066-\u2069]")
_HEBREW_MARK_RE = re.compile(r"[\u0591-\u05bd\u05bf-\u05c7]")
_EDGE_PUNCTUATION = " .,:;!?()[]{}<>|/\\\n\r\t־–—_+=*~`@#$%^&"
_TOKEN_CANDIDATE_RE = re.compile(
    r"[A-Za-z0-9\u05d0-\u05ea]+(?:[׳'״\".\-+/×][A-Za-z0-9\u05d0-\u05ea]+)*"
)
_FINAL_HEBREW_LETTERS = frozenset("ךםןףץ")
_SHORT_LATIN_ALLOWLIST = frozenset({"tv", "xl", "led", "usb", "cm", "mm", "kg", "m2"})
_LATIN_VOWELS = frozenset("aeiouy")


@dataclass(frozen=True)
class OcrFilterResult:
    text: str
    total_words: int
    accepted_words: int
    rejected_low_confidence: int
    rejected_invalid: int
    rejected_lines: int
    malformed_tsv: bool = False


@dataclass(frozen=True)
class _Word:
    text: str
    confidence: float
    has_hebrew: bool
    has_latin: bool
    has_digit: bool

    @property
    def is_numeric(self) -> bool:
        return self.has_digit and not self.has_hebrew and not self.has_latin

    @property
    def character_weight(self) -> int:
        return max(1, sum(char.isalnum() for char in self.text))


def _normalize_raw_token(value: str) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = _BIDI_CONTROL_RE.sub("", text.replace("\u00ad", ""))
    text = _HEBREW_MARK_RE.sub("", text)
    return (
        text.replace("’", "'")
        .replace("‘", "'")
        .replace("“", '"')
        .replace("”", '"')
        .replace("–", "-")
        .replace("—", "-")
        .strip(_EDGE_PUNCTUATION)
    )


def _has_implausible_repetition(value: str) -> bool:
    letters = [char.lower() for char in value if char.isalpha()]
    if len(letters) < 4:
        return False
    counts = {char: letters.count(char) for char in set(letters)}
    return max(counts.values(), default=0) / len(letters) >= 0.75


def _is_plausible_candidate(value: str, confidence: float, min_confidence: int, *, title_mode: bool) -> bool:
    hebrew = [char for char in value if "\u05d0" <= char <= "\u05ea"]
    latin = [char for char in value if "a" <= char.lower() <= "z"]
    digits = [char for char in value if char.isdigit()]

    if not hebrew and not latin and not digits:
        return False
    if hebrew and latin:
        # Joined Hebrew/Latin words are overwhelmingly segmentation errors in
        # these catalogs. Legitimate bilingual names are normally separated.
        return False
    if len(value) > 32 or _has_implausible_repetition(value):
        return False

    if hebrew:
        if len(hebrew) < 2 or len(hebrew) > 24:
            return False
        # Hebrew final letters cannot occur in the middle of a normal word.
        if any(char in _FINAL_HEBREW_LETTERS for char in hebrew[:-1]):
            return False
        return confidence >= min_confidence

    if latin and not digits:
        lowered = "".join(latin).lower()
        if len(latin) == 2 and lowered not in _SHORT_LATIN_ALLOWLIST:
            return False
        if len(latin) < 2 or len(latin) > 24:
            return False
        if title_mode:
            return confidence >= min_confidence

        # Full-page photo OCR invents many short Latin fragments. Require a
        # stronger score and either a vowel-bearing word or a very confident
        # compact acronym. Targeted title OCR remains more permissive.
        strong_threshold = max(min_confidence + 10, 78)
        if confidence < strong_threshold:
            return False
        if any(char in _LATIN_VOWELS for char in lowered):
            return True
        return len(latin) <= 5 and confidence >= 88

    if digits and not latin:
        if len(digits) < 2 or len(digits) > 8:
            return False
        return confidence >= max(min_confidence + 8, 75)

    # Latin model codes and dimensions such as A12, 160x200 or M-40.
    if latin and digits:
        return 2 <= len(latin) + len(digits) <= 24 and confidence >= max(min_confidence + 4, 70)

    return False


def _candidate_words(raw_text: str, confidence: float, min_confidence: int, *, title_mode: bool) -> list[_Word]:
    normalized = _normalize_raw_token(raw_text)
    if not normalized:
        return []

    words: list[_Word] = []
    for match in _TOKEN_CANDIDATE_RE.finditer(normalized):
        candidate = match.group(0).strip(_EDGE_PUNCTUATION)
        if not candidate or not _is_plausible_candidate(candidate, confidence, min_confidence, title_mode=title_mode):
            continue
        words.append(
            _Word(
                text=candidate,
                confidence=confidence,
                has_hebrew=any("\u05d0" <= char <= "\u05ea" for char in candidate),
                has_latin=any("a" <= char.lower() <= "z" for char in candidate),
                has_digit=any(char.isdigit() for char in candidate),
            )
        )
    return words


def _weighted_confidence(words: list[_Word]) -> float:
    total_weight = sum(word.character_weight for word in words)
    if total_weight <= 0:
        return 0.0
    return sum(word.confidence * word.character_weight for word in words) / total_weight


def _line_is_plausible(words: list[_Word], min_confidence: int, *, title_mode: bool) -> bool:
    if not words:
        return False
    if title_mode:
        return True

    average = _weighted_confidence(words)
    lexical = [word for word in words if not word.is_numeric]
    has_hebrew = any(word.has_hebrew for word in words)

    if len(words) == 1:
        word = words[0]
        if word.is_numeric:
            return word.confidence >= 88 and word.character_weight >= 3
        required = max(min_confidence + (8 if has_hebrew else 14), 73 if has_hebrew else 82)
        return word.confidence >= required

    if not lexical:
        return average >= 82
    if not has_hebrew:
        return average >= max(min_confidence + 12, 80)
    return average >= min_confidence and any(word.confidence >= min_confidence + 4 for word in lexical)


def filter_tesseract_tsv(
    value: str,
    *,
    min_confidence: int = DEFAULT_OCR_MIN_CONFIDENCE,
    max_words: int = DEFAULT_OCR_MAX_WORDS_PER_PAGE,
    title_mode: bool = False,
) -> OcrFilterResult:
    """Return conservative searchable text from Tesseract TSV output.

    Only level-5 word rows are considered. Words below the configured confidence
    are removed before script/token validation, then weak or numeric-only lines
    are rejected. Duplicate lines and immediately repeated words are collapsed
    because client-side search does not benefit from OCR repetition.
    """
    raw = str(value or "")
    reader = csv.DictReader(io.StringIO(raw), delimiter="\t")
    required = {"level", "page_num", "block_num", "par_num", "line_num", "conf", "text"}
    if not reader.fieldnames or not required.issubset(set(reader.fieldnames)):
        return OcrFilterResult("", 0, 0, 0, 0, 0, malformed_tsv=True)

    threshold = max(0, min(100, int(min_confidence)))
    word_limit = max(1, int(max_words))
    lines: "OrderedDict[tuple[str, str, str, str], list[_Word]]" = OrderedDict()
    total_words = 0
    rejected_low = 0
    rejected_invalid = 0

    for row in reader:
        if str(row.get("level", "")).strip() != "5":
            continue
        raw_text = str(row.get("text", "") or "").strip()
        if not raw_text:
            continue
        total_words += 1
        try:
            confidence = float(str(row.get("conf", "-1")).strip())
        except ValueError:
            confidence = -1.0
        if confidence < threshold:
            rejected_low += 1
            continue

        candidates = _candidate_words(raw_text, confidence, threshold, title_mode=title_mode)
        if not candidates:
            rejected_invalid += 1
            continue

        key = (
            str(row.get("page_num", "")),
            str(row.get("block_num", "")),
            str(row.get("par_num", "")),
            str(row.get("line_num", "")),
        )
        lines.setdefault(key, []).extend(candidates)

    output_lines: list[str] = []
    seen_lines: set[str] = set()
    accepted_words = 0
    rejected_lines = 0

    for words in lines.values():
        compact: list[_Word] = []
        for word in words:
            if compact and compact[-1].text.casefold() == word.text.casefold():
                continue
            compact.append(word)

        if not _line_is_plausible(compact, threshold, title_mode=title_mode):
            rejected_lines += 1
            continue

        remaining = word_limit - accepted_words
        if remaining <= 0:
            break
        compact = compact[:remaining]
        line = " ".join(word.text for word in compact).strip()
        line_key = line.casefold()
        if not line or line_key in seen_lines:
            continue
        seen_lines.add(line_key)
        output_lines.append(line)
        accepted_words += len(compact)

    return OcrFilterResult(
        text=" ".join(output_lines),
        total_words=total_words,
        accepted_words=accepted_words,
        rejected_low_confidence=rejected_low,
        rejected_invalid=rejected_invalid,
        rejected_lines=rejected_lines,
    )
