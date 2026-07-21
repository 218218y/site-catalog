from __future__ import annotations

import importlib.util
import shutil
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
    BUILD.render_site_pages(
        ROOT,
        output,
        build_assets=False,
        seo_mode="public",
        include_seo_routes=True,
        confirm_public_indexing=True,
    )
    shutil.copy2(ROOT / "social-share-default.png", output / "social-share-default.png")
    return output


def test_public_bundle_passes_complete_seo_audit(public_bundle: Path) -> None:
    assert AUDIT.audit_local_bundle(public_bundle, ROOT) == []


def test_public_audit_detects_missing_h1(public_bundle: Path, tmp_path: Path) -> None:
    target = tmp_path / "copy"
    shutil.copytree(public_bundle, target)
    index = target / "index.html"
    html = index.read_text(encoding="utf-8").replace("<h1 class=\"brand-text brand-page-heading\">", "<div class=\"brand-text brand-page-heading\">", 1).replace("</h1>", "</div>", 1)
    index.write_text(html, encoding="utf-8")
    issues = AUDIT.audit_local_bundle(target, ROOT)
    assert any("exactly one h1" in issue for issue in issues)


def test_public_audit_detects_broken_internal_link(public_bundle: Path, tmp_path: Path) -> None:
    target = tmp_path / "copy"
    shutil.copytree(public_bundle, target)
    index = target / "index.html"
    html = index.read_text(encoding="utf-8").replace('href="/category/opening-wardrobes/"', 'href="/category/missing-route/"', 1)
    index.write_text(html, encoding="utf-8")
    issues = AUDIT.audit_local_bundle(target, ROOT)
    assert any("broken internal link" in issue for issue in issues)
