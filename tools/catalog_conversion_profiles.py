#!/usr/bin/env python3
"""Canonical catalog conversion profiles shared by CLI and control panel.

The profile is the single source of truth for render and OCR defaults.  Callers
select a named workflow and may still pass an explicit CLI override when a
one-off diagnostic run requires it.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Final


@dataclass(frozen=True)
class ConversionProfile:
    name: str
    description: str
    dpi: int = 220
    max_width: int = 2800
    max_height: int = 2800
    medium_size: int = 1600
    thumb_size: int = 420
    quality: int = 84
    medium_quality: int = 82
    thumb_quality: int = 76
    image_format: str = "webp"
    sharpen: float = 0.8
    ocr_mode: str = "auto"
    ocr_lang: str = "heb+eng"
    ocr_dpi: int = 260
    ocr_min_chars: int = 16
    ocr_min_confidence: int = 65
    ocr_title_min_confidence: int = 45
    ocr_max_words_per_page: int = 180
    force: bool = False
    no_clean: bool = False
    skip_existing: bool = False
    require_ocr: bool = False


CONVERSION_PROFILES: Final[dict[str, ConversionProfile]] = {
    "production": ConversionProfile(
        name="production",
        description="Incremental production conversion with responsive WebP and conservative OCR.",
    ),
    "force": ConversionProfile(
        name="force",
        description="Rebuild every configured catalog with the production render settings.",
        force=True,
    ),
    "ocr-refresh": ConversionProfile(
        name="ocr-refresh",
        description="Refresh OCR/search data while preserving complete existing page images.",
        force=True,
        no_clean=True,
        skip_existing=True,
    ),
}

DEFAULT_CONVERSION_PROFILE: Final[str] = "production"


def get_conversion_profile(name: str) -> ConversionProfile:
    try:
        return CONVERSION_PROFILES[name]
    except KeyError as exc:
        choices = ", ".join(sorted(CONVERSION_PROFILES))
        raise ValueError(f"Unknown conversion profile {name!r}. Expected one of: {choices}") from exc


def conversion_profile_command(name: str) -> list[str]:
    """Return the intentionally thin command used by UI and wrapper scripts."""
    get_conversion_profile(name)
    return ["tools/build_catalogs.py", "--profile", name]
