#!/usr/bin/env python3
"""Canonical project paths for the catalog control-panel backend."""
from __future__ import annotations

import re
from pathlib import Path

from footer_content import FOOTER_CONTENT_RELATIVE_PATH
from taxonomy_editor import TAXONOMY_CONFIG_FILE

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CONFIG_FILE = PROJECT_ROOT / "catalogs.config.json"
TAXONOMY_FILE = PROJECT_ROOT / TAXONOMY_CONFIG_FILE
SEARCH_OVERRIDES_FILE = PROJECT_ROOT / "catalogs.search-overrides.json"
FOOTER_CONTENT_FILE = PROJECT_ROOT / FOOTER_CONTENT_RELATIVE_PATH
PDF_DIR = PROJECT_ROOT / "assets" / "pdfs"
PAGES_DIR = PROJECT_ROOT / "assets" / "pages"
CATALOG_ID_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,79}$")
PAGE_RE = re.compile(r"^page-(\d{3})\.(webp|jpg|png)$", re.IGNORECASE)

def rel_to_root(path: Path) -> str:
    try:
        return path.resolve(strict=False).relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return path.as_posix()
