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
