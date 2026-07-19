from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location("seo_build_pages", TOOLS / "build_site_pages.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


@pytest.fixture(scope="module")
def seo_outputs(tmp_path_factory: pytest.TempPathFactory) -> tuple[Path, Path]:
    root = tmp_path_factory.mktemp("seo-build")
    private = root / "private"
    public = root / "public"
    MODULE.render_site_pages(
        ROOT,
        private,
        build_assets=False,
        seo_mode="private",
        include_seo_routes=True,
    )
    MODULE.render_site_pages(
        ROOT,
        public,
        build_assets=False,
        seo_mode="public",
        include_seo_routes=True,
        confirm_public_indexing=True,
    )
    return private, public


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")



def test_source_shells_emit_only_clean_canonical_links(tmp_path: Path) -> None:
    MODULE.render_site_pages(
        ROOT,
        tmp_path,
        build_assets=False,
        seo_mode="private",
        include_seo_routes=False,
    )
    home = read(tmp_path / "index.html")
    assert 'data-clean-routes' not in home
    assert 'href="/catalog/opening-fredi-2026/"' in home
    assert 'href="/category/opening-wardrobes/"' in home
    assert 'catalog.html?catalog=' not in home
    assert 'index.html#cat/' not in home
    assert not (tmp_path / "catalog" / "opening-fredi-2026" / "index.html").exists()


def test_complete_private_build_uses_the_same_clean_routes_as_local_preview(
    seo_outputs: tuple[Path, Path],
) -> None:
    private, _public = seo_outputs
    home = read(private / "index.html")
    catalog = read(private / "catalog" / "opening-fredi-2026" / "index.html")
    assert 'data-clean-routes' not in home
    assert 'href="/catalog/opening-fredi-2026/"' in home
    assert 'data-clean-routes' not in catalog
    assert not (private / "catalog.html").exists()
    assert not (private / "viewer.html").exists()

def test_public_mode_requires_an_explicit_second_confirmation(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="confirm-public-indexing"):
        MODULE.render_site_pages(
            ROOT,
            tmp_path,
            build_assets=False,
            seo_mode="public",
            include_seo_routes=True,
        )


def test_private_build_keeps_every_route_out_of_search_and_emits_no_sitemap(
    seo_outputs: tuple[Path, Path],
) -> None:
    private, _public = seo_outputs
    assert not (private / "sitemap.xml").exists()
    assert "X-Robots-Tag: noindex" in read(private / "_headers")
    assert 'content="noindex, nofollow, noimageindex, nosnippet, noarchive"' in read(private / "index.html")
    assert 'href="/category/opening-wardrobes/"' in read(private / "index.html")
    assert 'href="/catalog/opening-fredi-2026/"' in read(private / "index.html")


def test_catalog_and_exact_page_routes_have_server_rendered_unique_metadata(
    seo_outputs: tuple[Path, Path],
) -> None:
    private, _public = seo_outputs
    catalog_html = read(private / "catalog" / "opening-fredi-2026" / "index.html")
    page_html = read(private / "catalog" / "opening-fredi-2026" / "page" / "43" / "index.html")

    assert "ארונות פתיחה פרדי 2026 | קטלוג ריהוט | רהיטי ברגיג" in catalog_html
    assert '<link rel="canonical" href="https://bargig-furniture.com/catalog/opening-fredi-2026/"' in catalog_html
    assert "page-001.webp" in catalog_html

    assert "ארונות פתיחה פרדי 2026 — עמוד 43 | רהיטי ברגיג" in page_html
    assert '<link rel="canonical" href="https://bargig-furniture.com/catalog/opening-fredi-2026/page/43/"' in page_html
    assert 'property="og:image" content="https://cdn.bargig-furniture.com/' in page_html
    assert "page-043.webp" in page_html
    assert 'content="noindex, nofollow, noimageindex, nosnippet, noarchive"' in page_html


def test_public_sitemap_contains_only_stable_indexable_landing_pages(
    seo_outputs: tuple[Path, Path],
) -> None:
    _private, public = seo_outputs
    sitemap = public / "sitemap.xml"
    assert sitemap.is_file()
    tree = ET.parse(sitemap)
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locations = [node.text or "" for node in tree.findall("s:url/s:loc", namespace)]

    taxonomy = MODULE.load_taxonomy(ROOT)
    catalogs = MODULE.read_catalogs(ROOT)
    expected = sum(1 for page in MODULE.PAGE_DOCUMENTS if page.indexable_public)
    expected += len(MODULE.active_categories(taxonomy, catalogs)) + len(catalogs)
    expected += sum(
        len(MODULE.active_subcategories(taxonomy, catalogs, category))
        for category in MODULE.active_categories(taxonomy, catalogs)
    )
    assert len(locations) == expected
    assert len(locations) == len(set(locations))
    assert not any("/page/" in location for location in locations)
    assert "https://bargig-furniture.com/catalog/opening-fredi-2026/" in locations
    assert "https://bargig-furniture.com/category/opening-wardrobes/" in locations
    assert "Sitemap: https://bargig-furniture.com/sitemap.xml" in read(public / "robots.txt")


def test_public_build_indexes_stable_pages_but_not_exact_share_pages(
    seo_outputs: tuple[Path, Path],
) -> None:
    _private, public = seo_outputs
    catalog_html = read(public / "catalog" / "opening-fredi-2026" / "index.html")
    page_html = read(public / "catalog" / "opening-fredi-2026" / "page" / "43" / "index.html")
    assert 'content="index, follow, max-image-preview:large' in catalog_html
    assert 'content="noindex, follow, noimageindex, noarchive"' in page_html
    assert "X-Robots-Tag: noindex" not in read(public / "_headers")


def test_home_structured_data_uses_real_business_details(seo_outputs: tuple[Path, Path]) -> None:
    private, _public = seo_outputs
    html = read(private / "index.html")
    assert '"@type":"FurnitureStore"' in html
    assert '"email":"bargig218@gmail.com"' in html
    assert '"streetAddress":"הרב מצליח 5, קומה -1"' in html
    assert '"addressLocality":"בני ברק"' in html
    assert '"logo":"https://bargig-furniture.com/brand-logo.svg"' in html
    assert '"value":"בתיאום מראש בלבד"' in html
    assert '"taxID"' not in html


def test_all_generated_catalog_titles_and_canonicals_are_unique(
    seo_outputs: tuple[Path, Path],
) -> None:
    private, _public = seo_outputs
    titles: list[str] = []
    canonicals: list[str] = []
    for catalog in MODULE.read_catalogs(ROOT):
        path = private / "catalog" / str(catalog["id"]) / "index.html"
        html = read(path)
        title_match = re.search(r"<title>(.*?)</title>", html)
        canonical_match = re.search(r'<link rel="canonical" href="([^"]+)"', html)
        assert title_match and canonical_match
        titles.append(title_match.group(1))
        canonicals.append(canonical_match.group(1))
    assert len(titles) == len(set(titles))
    assert len(canonicals) == len(set(canonicals))


def test_clean_output_removes_routes_for_deleted_catalogs(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    original_catalogs = MODULE.read_catalogs(ROOT)
    added = dict(original_catalogs[0])
    added.update({
        "id": "temporary-catalog-for-route-cleanup",
        "title": "קטלוג זמני לבדיקת ניקוי",
        "description": "קטלוג בדיקה",
        "pages": 2,
        "dir": "assets/pages/temporary-catalog-for-route-cleanup",
        "cover": "assets/pages/temporary-catalog-for-route-cleanup/page-001.webp",
        "pageSizes": [[1200, 1600], [1200, 1600]],
    })

    monkeypatch.setattr(MODULE, "read_catalogs", lambda _root: [*original_catalogs, added])
    MODULE.render_site_pages_atomic(
        ROOT,
        tmp_path,
        build_assets=False,
        seo_mode="private",
        include_seo_routes=True,
    )
    stale_route = tmp_path / "catalog" / added["id"] / "index.html"
    assert stale_route.is_file()

    monkeypatch.setattr(MODULE, "read_catalogs", lambda _root: original_catalogs)
    MODULE.render_site_pages_atomic(
        ROOT,
        tmp_path,
        build_assets=False,
        seo_mode="private",
        include_seo_routes=True,
    )
    assert not stale_route.exists()
    assert (tmp_path / "catalog" / str(original_catalogs[0]["id"]) / "index.html").is_file()


def test_atomic_route_build_preserves_previous_output_when_render_fails(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    output = tmp_path / "site"
    output.mkdir()
    marker = output / "last-known-good.txt"
    marker.write_text("stable", encoding="utf-8")

    def fail_render(*_args: object, **_kwargs: object) -> list[Path]:
        raise RuntimeError("synthetic render failure")

    monkeypatch.setattr(MODULE, "render_site_pages", fail_render)
    with pytest.raises(RuntimeError, match="synthetic render failure"):
        MODULE.render_site_pages_atomic(
            ROOT,
            output,
            build_assets=False,
            seo_mode="private",
            include_seo_routes=True,
        )

    assert marker.read_text(encoding="utf-8") == "stable"
    assert not MODULE.staging_output_dir(output).exists()


def test_empty_taxonomy_branches_are_omitted_from_generated_site(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    taxonomy = MODULE.load_taxonomy(ROOT)
    catalogs = MODULE.read_catalogs(ROOT)
    category = taxonomy.categories[0]
    remaining = [item for item in catalogs if str(item.get("category", "")) != category.name]
    assert remaining and len(remaining) < len(catalogs)

    monkeypatch.setattr(MODULE, "read_catalogs", lambda _root: remaining)
    MODULE.render_site_pages_atomic(
        ROOT,
        tmp_path,
        build_assets=False,
        seo_mode="private",
        include_seo_routes=True,
    )

    assert not (tmp_path / "category" / category.slug / "index.html").exists()
    home = read(tmp_path / "index.html")
    assert f'href="/category/{category.slug}/"' not in home
