from __future__ import annotations

import importlib.util
import json
import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))


def load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, TOOLS / filename)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


FOOTER = load_module("footer_content_under_test", "footer_content.py")
SERVER = load_module("catalog_control_server_footer_test", "catalog_control_server.py")


def copy_page_sources(target: Path) -> None:
    for relative in (
        "site.template.html",
        "legal.template.html",
        "partials/site-footer.html",
        "partials/site-footer.content.json",
        "legal/terms.content.html",
        "legal/privacy.content.html",
        "legal/accessibility.content.html",
    ):
        source = ROOT / relative
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)



def test_footer_editor_schema_matches_footer_structure_and_limits() -> None:
    schema = FOOTER.footer_editor_schema()
    groups = schema["groups"]

    assert [group["id"] for group in groups] == ["visit", "contact", "response", "links", "bottom"]
    fields = [field for group in groups for field in group["fields"]]
    keys = [field["key"] for field in fields]

    assert keys == list(FOOTER.FOOTER_FIELD_LIMITS)
    assert len(keys) == len(set(keys))
    assert {field["key"]: field["maxLength"] for field in fields} == dict(FOOTER.FOOTER_FIELD_LIMITS)

    contact_group = next(group for group in groups if group["id"] == "contact")
    assert [field["key"] for field in contact_group["fields"]] == [
        "contactTitle",
        "mobileLabel",
        "mobile",
        "phoneLabel",
        "phone",
        "emailLabel",
        "email",
        "emailMailtoTitle",
        "gmailTitle",
        "gmailSubject",
    ]
    assert next(field for field in contact_group["fields"] if field["key"] == "gmailSubject")["help"].endswith(
        "ואינו מוצג כטקסט בפוטר עצמו."
    )

def test_footer_template_escapes_text_and_builds_links() -> None:
    content = FOOTER.read_footer_content(ROOT)
    content["visitTitle"] = '<script>alert("x")</script>'
    content["mobile"] = "+972 (52) 769-6310"
    template = (ROOT / "partials/site-footer.html").read_text(encoding="utf-8")

    rendered = FOOTER.render_footer_template(template, content)

    assert "<script>alert" not in rendered
    assert "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;" in rendered
    assert 'href="tel:+972527696310"' in rendered
    assert "{{FOOTER_" not in rendered


def test_footer_validation_rejects_incomplete_or_invalid_content() -> None:
    content = FOOTER.read_footer_content(ROOT)

    missing = dict(content)
    missing.pop("address")
    with pytest.raises(ValueError, match="missing fields"):
        FOOTER.validate_footer_content(missing)

    invalid_email = dict(content, email="not-an-email")
    with pytest.raises(ValueError, match="valid email"):
        FOOTER.validate_footer_content(invalid_email)

    multiline = dict(content, bottomNote="line one\nline two")
    with pytest.raises(ValueError, match="single line"):
        FOOTER.validate_footer_content(multiline)


def test_control_panel_footer_save_updates_config_and_all_public_pages(tmp_path: Path) -> None:
    copy_page_sources(tmp_path)
    content = FOOTER.read_footer_content(tmp_path)
    content["businessName"] = "עסק בדיקה מקצועי"
    content["email"] = "office@example.com"
    content["gmailSubject"] = "נושא חדש לבדיקה"

    saved = SERVER.save_footer_content_and_render_pages(content, root=tmp_path)

    assert saved["businessName"] == "עסק בדיקה מקצועי"
    persisted = json.loads((tmp_path / "partials/site-footer.content.json").read_text(encoding="utf-8"))
    assert persisted == saved
    for page in SERVER.PAGE_DOCUMENTS:
        html = (tmp_path / page.filename).read_text(encoding="utf-8")
        assert "עסק בדיקה מקצועי" in html
        assert 'href="mailto:office@example.com"' in html
        assert "office%40example.com" in html
        assert "{{FOOTER_" not in html


def test_footer_save_rolls_back_config_and_pages_on_commit_failure(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    copy_page_sources(tmp_path)
    original = FOOTER.read_footer_content(tmp_path)
    SERVER.save_footer_content_and_render_pages(original, root=tmp_path)
    tracked_paths = [tmp_path / "partials/site-footer.content.json", *[tmp_path / page.filename for page in SERVER.PAGE_DOCUMENTS]]
    before = {path: path.read_bytes() for path in tracked_paths}

    changed = dict(original, bottomNote="טקסט שלא אמור להישאר אחרי כשל")
    real_atomic_write = SERVER.atomic_write_bytes
    failed_once = False

    def flaky_atomic_write(path: Path, data: bytes) -> None:
        nonlocal failed_once
        if path.name == "catalog.html" and not failed_once:
            failed_once = True
            raise OSError("simulated disk failure")
        real_atomic_write(path, data)

    monkeypatch.setattr(SERVER, "atomic_write_bytes", flaky_atomic_write)
    with pytest.raises(OSError, match="simulated disk failure"):
        SERVER.save_footer_content_and_render_pages(changed, root=tmp_path)

    after = {path: path.read_bytes() for path in tracked_paths}
    assert after == before
