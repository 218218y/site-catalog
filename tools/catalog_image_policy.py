#!/usr/bin/env python3
"""Shared catalog image delivery policy for build and publication tools."""
from __future__ import annotations

import re
from pathlib import Path

CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE = "responsive"
CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY = "full-only"
CATALOG_IMAGE_DELIVERY_MODES = frozenset(
    {CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE, CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY}
)
DEFAULT_CATALOG_IMAGE_DELIVERY_MODE = CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE
CONFIG_FILE = "catalog-assets.config.js"
DELIVERY_MODE_PATTERN = re.compile(
    r"window\.BARGIG_CATALOG_IMAGE_DELIVERY_MODE\s*=\s*([\"'])(?P<mode>[^\"']+)\1\s*;"
)


def normalize_catalog_image_delivery_mode(value: str) -> str:
    mode = str(value or "").strip().lower() or DEFAULT_CATALOG_IMAGE_DELIVERY_MODE
    if mode not in CATALOG_IMAGE_DELIVERY_MODES:
        allowed = ", ".join(sorted(CATALOG_IMAGE_DELIVERY_MODES))
        raise ValueError(f"Unsupported catalog image delivery mode {mode!r}; expected one of: {allowed}")
    return mode


def load_catalog_image_delivery_mode(root: Path) -> str:
    """Read and validate the one checked-in runtime image-policy switch."""

    source = root / CONFIG_FILE
    if not source.is_file():
        raise FileNotFoundError(f"Runtime asset config is missing: {CONFIG_FILE}")
    text = source.read_text(encoding="utf-8-sig")
    match = DELIVERY_MODE_PATTERN.search(text)
    return normalize_catalog_image_delivery_mode(match.group("mode") if match else "")


def runtime_uses_medium_images(mode: str) -> bool:
    return normalize_catalog_image_delivery_mode(mode) == CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE
