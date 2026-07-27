from __future__ import annotations

import importlib.util
import json
import re
import sys

import pytest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
VIEWER = ROOT / "catalog-big-pages-viewer-netfree/catalog-big-pages-viewer.html"
README = ROOT / "catalog-big-pages-viewer-netfree/README.txt"

SPEC = importlib.util.spec_from_file_location(
    "build_big_pages_viewer_contract",
    TOOLS / "build_big_pages_viewer.py",
)
assert SPEC and SPEC.loader
BUILD = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = BUILD
SPEC.loader.exec_module(BUILD)


def embedded_catalogs(html: str) -> list[dict]:
    start = html.index(BUILD.SNAPSHOT_START)
    end = html.index(BUILD.SNAPSHOT_END, start)
    block = html[start:end]
    match = re.search(r"window\.BARGIG_CATALOGS\s*=\s*(\[.*\]);\s*$", block, re.DOTALL)
    assert match, "embedded catalog snapshot is missing"
    return json.loads(match.group(1))


def test_standalone_viewer_snapshot_matches_generated_catalogs() -> None:
    BUILD.build_big_pages_viewer(ROOT, check=True)
    generated = json.loads((ROOT / "catalogs.generated.json").read_text(encoding="utf-8"))
    embedded = embedded_catalogs(VIEWER.read_text(encoding="utf-8"))

    assert [catalog["id"] for catalog in embedded] == [catalog["id"] for catalog in generated]
    assert [catalog["dir"] for catalog in embedded] == [catalog["dir"] for catalog in generated]
    assert [catalog["pages"] for catalog in embedded] == [catalog["pages"] for catalog in generated]
    assert sum(catalog["pages"] for catalog in embedded) == sum(catalog["pages"] for catalog in generated)
    assert "kachtan-2026" in {catalog["id"] for catalog in embedded}


def test_generated_readme_has_cross_platform_lf_checkout_policy() -> None:
    attributes = (ROOT / ".gitattributes").read_text(encoding="utf-8").splitlines()
    rules = {line.strip() for line in attributes if line.strip() and not line.lstrip().startswith("#")}

    assert "catalog-big-pages-viewer-netfree/README.txt text eol=lf" in rules


def test_standalone_viewer_supports_all_three_r2_image_tiers() -> None:
    html = VIEWER.read_text(encoding="utf-8")

    assert 'id="imageTierSelect"' in html
    assert '<option value="thumb">קטנות</option>' in html
    assert '<option value="medium">בינוניות</option>' in html
    assert '<option value="full">גדולות</option>' in html
    assert 'function imageUrl(catalog, page, tier)' in html
    assert 'function imageOriginUrl(catalog, page, tier)' in html
    assert 'const INSPECTION_SESSION_PARAM = "viewer_session";' in html
    assert 'attemptedOriginFallback' in html
    assert 'catalog?.imageVariants?.[normalized]' in html
    assert 'url.searchParams.set("size", currentTier)' in html
    assert 'window.BARGIG_CATALOG_ASSET_BASE_URL = "https://cdn.bargig-furniture.com/";' in html
    assert '<script src=' not in html.lower()


def test_standalone_viewer_readme_stats_match_metadata() -> None:
    generated = json.loads((ROOT / "catalogs.generated.json").read_text(encoding="utf-8"))
    readme = README.read_text(encoding="utf-8")
    total = sum(int(catalog["pages"]) for catalog in generated)
    chunks = (total + 49) // 50

    assert f"- מספר קטלוגים: {len(generated)}" in readme
    assert f"- סך תמונות/עמודים בכל גודל: {total}" in readme
    assert f"- מספר קבוצות של עד 50 תמונות: {chunks}" in readme


def test_standalone_viewer_check_is_byte_exact_for_line_endings(tmp_path: Path) -> None:
    root = tmp_path / "project"
    viewer = root / BUILD.VIEWER_RELATIVE_PATH
    readme = root / BUILD.README_RELATIVE_PATH
    catalogs_path = root / BUILD.CATALOGS_RELATIVE_PATH
    viewer.parent.mkdir(parents=True)
    catalogs = [{"id": "sample", "title": "Sample", "dir": "assets/pages/sample", "pages": 1}]
    catalogs_path.write_text(json.dumps(catalogs), encoding="utf-8")
    viewer.write_text(
        f"<script>\n{BUILD.SNAPSHOT_START}\nold\n{BUILD.SNAPSHOT_END}\n</script>\n",
        encoding="utf-8",
    )
    readme.write_text(
        f"Header\n{BUILD.README_STATS_START}\nold\n{BUILD.README_STATS_END}\n",
        encoding="utf-8",
    )

    BUILD.build_big_pages_viewer(root)
    canonical = readme.read_bytes()
    assert b"\r\n" not in canonical

    readme.write_bytes(canonical.replace(b"\n", b"\r\n"))
    with pytest.raises(RuntimeError, match="Line endings are non-canonical"):
        BUILD.build_big_pages_viewer(root, check=True)

    assert BUILD.build_big_pages_viewer(root) is True
    assert readme.read_bytes() == canonical
