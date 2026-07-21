from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
sys.path.insert(0, str(TOOLS))

BUILD_SPEC = importlib.util.spec_from_file_location("seo_audit_build_pages", TOOLS / "build_site_pages.py")
assert BUILD_SPEC and BUILD_SPEC.loader
BUILD = importlib.util.module_from_spec(BUILD_SPEC)
sys.modules[BUILD_SPEC.name] = BUILD
BUILD_SPEC.loader.exec_module(BUILD)

AUDIT_SPEC = importlib.util.spec_from_file_location("seo_public_audit_module", TOOLS / "audit_public_seo.py")
assert AUDIT_SPEC and AUDIT_SPEC.loader
AUDIT = importlib.util.module_from_spec(AUDIT_SPEC)
sys.modules[AUDIT_SPEC.name] = AUDIT
AUDIT_SPEC.loader.exec_module(AUDIT)


@pytest.fixture(scope="module")
def public_bundle(tmp_path_factory: pytest.TempPathFactory) -> Path:
    output = tmp_path_factory.mktemp("public-seo-audit")
    catalogs = BUILD.read_catalogs(ROOT)
    primary = next(item for item in catalogs if item["id"] == "opening-fredi-2026")
    secondary = next(
        item
        for item in catalogs
        if item["id"] != primary["id"] and item.get("category") != primary.get("category")
    )

    def compact(catalog: dict[str, object]) -> dict[str, object]:
        value = dict(catalog)
        sizes = list(value.get("pageSizes") or [[1200, 1600]])
        value["pages"] = 2
        value["pageSizes"] = (sizes + [sizes[-1]])[:2]
        return value

    original_read_catalogs = BUILD.read_catalogs
    BUILD.read_catalogs = lambda _root: [compact(primary), compact(secondary)]
    try:
        BUILD.render_site_pages(
            ROOT,
            output,
            build_assets=False,
            seo_mode="public",
            include_seo_routes=True,
            confirm_public_indexing=True,
        )
    finally:
        BUILD.read_catalogs = original_read_catalogs
    (output / "social-share-default.png").write_bytes(
        (ROOT / "social-share-default.png").read_bytes()
    )
    return output


def parse_document(html: str) -> object:
    document, parse_issues = AUDIT.parse_document(ROOT / "index.html", ROOT, html=html)
    assert parse_issues == []
    return document


def test_representative_public_bundle_passes_complete_seo_audit(public_bundle: Path) -> None:
    """Exercise every audit rule cheaply; the project gate checks the full catalog."""

    assert AUDIT.audit_local_bundle(public_bundle, ROOT) == []


def test_public_audit_detects_missing_h1_without_building_a_bundle() -> None:
    document = parse_document(
        """<!doctype html><html><head>
        <meta name="robots" content="index, follow">
        </head><body><div class="brand-page-heading">Catalogs</div></body></html>"""
    )

    issues = AUDIT.audit_indexable_h1(document)

    assert any("exactly one h1" in issue for issue in issues)


def test_public_audit_detects_broken_internal_link_without_copying_a_bundle() -> None:
    document = parse_document(
        """<!doctype html><html><head>
        <meta name="robots" content="index, follow">
        </head><body><h1>Catalogs</h1>
        <a href="/category/missing-route/">Missing</a></body></html>"""
    )
    site_origin = AUDIT.load_seo_config(ROOT).site_url

    issues = AUDIT.audit_internal_links(document, frozenset({"/", "/index.html"}), site_origin)

    assert any("broken internal link" in issue for issue in issues)


def test_bundle_inventory_builds_routes_from_one_file_walk(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<!doctype html>", encoding="utf-8")
    route = tmp_path / "catalog" / "sample" / "index.html"
    route.parent.mkdir(parents=True)
    route.write_text("<!doctype html>", encoding="utf-8")
    (tmp_path / "static").mkdir()
    (tmp_path / "static" / "app.js").write_text("", encoding="utf-8")

    inventory = AUDIT.build_bundle_inventory(tmp_path)

    assert inventory.html_files == (tmp_path / "index.html", route)
    assert inventory.files == frozenset({"index.html", "catalog/sample/index.html", "static/app.js"})
    assert "/catalog/sample/" in inventory.routes
    assert "/catalog/sample" in inventory.routes
