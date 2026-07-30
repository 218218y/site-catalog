from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location("build_site_pages", TOOLS / "build_site_pages.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_generated_site_pages_match_their_sources() -> None:
    checked = MODULE.check_site_pages(ROOT)
    assert len(checked) == len(MODULE.PAGE_DOCUMENTS) + 2
    assert all(path.is_file() for path in checked)
    assert all(b"\r\n" not in path.read_bytes() for path in checked)


def test_check_mode_is_non_destructive() -> None:
    before = {page.filename: (ROOT / page.filename).read_bytes() for page in MODULE.PAGE_DOCUMENTS}
    assert MODULE.main(["--check"]) == 0
    after = {page.filename: (ROOT / page.filename).read_bytes() for page in MODULE.PAGE_DOCUMENTS}
    assert after == before


def test_rendered_pages_use_canonical_lf_on_every_platform(tmp_path: Path) -> None:
    generated = MODULE.render_site_pages(ROOT, tmp_path, build_assets=False)
    assert generated
    for path in generated:
        content = path.read_bytes()
        assert b"\r\n" not in content
        assert b"\r" not in content


def test_route_bundle_tokens_honor_deploy_asset_rewrites(tmp_path: Path) -> None:
    rewrites = {
        "styles-catalog.css": "static/styles-catalog.111111.css",
        "app-catalog.js": "static/app-catalog.222222.js",
        "styles-favorites.css": "static/styles-favorites.333333.css",
        "app-favorites.js": "static/app-favorites.444444.js",
        "styles-viewer.css": "static/styles-viewer.555555.css",
        "app-viewer.js": "static/app-viewer.666666.js",
        "styles.css": "static/styles.777777.css",
        "app-payment.js": "static/app-payment.888888.js",
    }
    MODULE.render_site_pages(
        ROOT,
        tmp_path,
        build_assets=False,
        build_taxonomy=False,
        include_seo_routes=True,
        include_technical_shells=True,
        include_indexing_files=False,
        asset_rewrites=rewrites,
    )

    catalogs = MODULE.read_catalogs(ROOT)
    assert catalogs
    catalog_id = str(catalogs[0]["id"])
    rendered_routes = {
        "home": tmp_path / "index.html",
        "favorites": tmp_path / "favorites.html",
        "catalog": tmp_path / MODULE.catalog_path(catalog_id) / "index.html",
        "viewer": tmp_path / MODULE.catalog_page_path(catalog_id, 1) / "index.html",
        "payment": tmp_path / "payment.html",
    }
    expected = {
        "home": (rewrites["styles-catalog.css"], rewrites["app-catalog.js"]),
        "favorites": (rewrites["styles-favorites.css"], rewrites["app-favorites.js"]),
        "catalog": (rewrites["styles-catalog.css"], rewrites["app-catalog.js"]),
        "viewer": (rewrites["styles-viewer.css"], rewrites["app-viewer.js"]),
        "payment": (rewrites["styles.css"], rewrites["app-payment.js"]),
    }

    for route_name, path in rendered_routes.items():
        html = path.read_text(encoding="utf-8")
        stylesheet, script = expected[route_name]
        assert stylesheet in html, route_name
        assert script in html, route_name
        assert "{{ROUTE_STYLESHEET}}" not in html
        assert "{{ROUTE_SCRIPT}}" not in html
        for raw_asset in {asset for pair in MODULE.ROUTE_ASSETS.values() for asset in pair}:
            assert f'="{raw_asset}"' not in html, (route_name, raw_asset)
