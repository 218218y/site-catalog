from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import fitz
import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"

BUILD_SPEC = importlib.util.spec_from_file_location(
    "build_catalogs_cleanup_contract",
    TOOLS / "build_catalogs.py",
)
assert BUILD_SPEC and BUILD_SPEC.loader
BUILD = importlib.util.module_from_spec(BUILD_SPEC)
sys.modules[BUILD_SPEC.name] = BUILD
BUILD_SPEC.loader.exec_module(BUILD)

CONTROL_SPEC = importlib.util.spec_from_file_location(
    "catalog_control_server_cleanup_contract",
    TOOLS / "catalog_control_server.py",
)
assert CONTROL_SPEC and CONTROL_SPEC.loader
CONTROL = importlib.util.module_from_spec(CONTROL_SPEC)
sys.modules[CONTROL_SPEC.name] = CONTROL
CONTROL_SPEC.loader.exec_module(CONTROL)


def write_pdf(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    document.save(path)
    document.close()


@pytest.mark.parametrize("extra_args", [[], ["--force"]])
def test_conversion_always_reconciles_removed_catalogs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    extra_args: list[str],
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    write_pdf(root / "assets/pdfs/keep.pdf", "keep catalog")

    config = [
        {
            "id": "keep",
            "title": "Keep",
            "pdf": "assets/pdfs/keep.pdf",
            "ocr": False,
        },
        {
            "id": "missing-pdf",
            "title": "Missing PDF",
            "pdf": "assets/pdfs/missing.pdf",
            "ocr": True,
        },
    ]
    (root / "catalogs.config.json").write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (root / "catalog-taxonomy.config.json").write_text(
        json.dumps({
            "categories": [{"name": "קטלוג", "slug": "catalog", "description": "Catalogs"}],
            "subcategories": [],
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


    for catalog_id in ("missing-pdf", "unlisted"):
        output = root / "assets/pages" / catalog_id
        (output / "thumbs").mkdir(parents=True, exist_ok=True)
        (output / "page-001.webp").write_bytes(b"stale")
        (output / "thumbs/page-001.webp").write_bytes(b"stale")

    monkeypatch.setattr(BUILD, "project_root", lambda: root)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "build_catalogs.py",
            *extra_args,
            "--ocr",
            "never",
            "--format",
            "png",
            "--dpi",
            "72",
            "--max-width",
            "600",
            "--max-height",
            "600",
            "--thumb-size",
            "80",
            "--sharpen",
            "0",
            "--prune-missing-pdfs",
        ],
    )

    assert BUILD.main() == 0

    saved_config = json.loads((root / "catalogs.config.json").read_text(encoding="utf-8"))
    assert [item["id"] for item in saved_config] == ["keep"]
    assert (root / "assets/pages/keep/page-001.png").is_file()
    assert (root / "assets/pages/keep/medium/page-001.png").is_file()
    assert (root / "assets/pages/keep/thumbs/page-001.png").is_file()
    assert not (root / "assets/pages/missing-pdf").exists()
    assert not (root / "assets/pages/unlisted").exists()

    generated = json.loads((root / "catalogs.generated.json").read_text(encoding="utf-8"))
    search_index = json.loads((root / "catalogs.search-index.json").read_text(encoding="utf-8"))
    assert [entry["id"] for entry in generated] == ["keep"]
    medium_variant = generated[0]["imageVariants"]["medium"]
    assert medium_variant["directory"] == "medium"
    assert medium_variant["maxSide"] == 1600
    assert len(medium_variant["version"]) == 12
    assert generated[0]["assetVersion"]
    assert [entry["id"] for entry in search_index["catalogs"]] == ["keep"]


def test_only_two_conversion_actions_and_batch_files_remain() -> None:
    assert "convert" in CONTROL.ACTIONS
    assert "convert_force" in CONTROL.ACTIONS
    assert "convert_delete" not in CONTROL.ACTIONS
    assert "convert_delete_force" not in CONTROL.ACTIONS
    assert not (ROOT / "convert-catalogsdelete.bat").exists()
    assert not (ROOT / "convert-catalogs-deleteforce.bat").exists()
    assert all("--delete-unlisted" not in action.command for action in CONTROL.ACTIONS.values())


def test_full_conversion_and_control_panel_save_emit_identical_catalog_bytes(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    write_pdf(root / "assets/pdfs/one.pdf", "one catalog")
    catalogs = [{
        "id": "one",
        "title": "One",
        "description": "Description",
        "category": "Category",
        "subcategory": "Sub",
        "pdf": "assets/pdfs/one.pdf",
        "ocr": False,
    }]
    taxonomy = {
        "categories": [{"name": "Category", "slug": "category", "description": "Category description"}],
        "subcategories": [{"category": "Category", "name": "Sub", "slug": "sub", "description": "Sub description"}],
    }
    (root / "catalogs.config.json").write_text(json.dumps(catalogs, indent=2) + "\n", encoding="utf-8")
    (root / "catalog-taxonomy.config.json").write_text(json.dumps(taxonomy, indent=2) + "\n", encoding="utf-8")

    monkeypatch.setattr(BUILD, "project_root", lambda: root)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "build_catalogs.py", "--ocr", "never", "--format", "png", "--dpi", "72",
            "--max-width", "600", "--max-height", "600", "--medium-size", "320",
            "--thumb-size", "80", "--sharpen", "0",
        ],
    )
    assert BUILD.main() == 0
    managed = (
        "catalogs.build-state.json",
        "catalogs.generated.json",
        "catalogs.generated.module.js",
        "catalogs.search-index.json",
    )
    conversion_bytes = {name: (root / name).read_bytes() for name in managed}

    monkeypatch.setattr(CONTROL, "PROJECT_ROOT", root)
    monkeypatch.setattr(CONTROL, "CONFIG_FILE", root / "catalogs.config.json")
    monkeypatch.setattr(CONTROL, "TAXONOMY_FILE", root / "catalog-taxonomy.config.json")
    monkeypatch.setattr(CONTROL, "SEARCH_OVERRIDES_FILE", root / "catalogs.search-overrides.json")
    monkeypatch.setattr(CONTROL, "PDF_DIR", root / "assets/pdfs")
    monkeypatch.setattr(CONTROL, "PAGES_DIR", root / "assets/pages")
    monkeypatch.setattr(CONTROL, "compile_taxonomy_and_site_pages", lambda *_args, **_kwargs: ())
    CONTROL.save_catalogs_transactionally(catalogs, taxonomy, [])

    assert {name: (root / name).read_bytes() for name in managed} == conversion_bytes


def test_two_consecutive_full_conversions_leave_no_byte_diff(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    write_pdf(root / "assets/pdfs/one.pdf", "one catalog")
    (root / "catalogs.config.json").write_text(
        json.dumps([{"id": "one", "title": "One", "pdf": "assets/pdfs/one.pdf", "ocr": False}], indent=2) + "\n",
        encoding="utf-8",
    )
    (root / "catalog-taxonomy.config.json").write_text(
        json.dumps({
            "categories": [{"name": "קטלוג", "slug": "catalog", "description": "Catalogs"}],
            "subcategories": [],
        }, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    argv = [
        "build_catalogs.py", "--ocr", "never", "--format", "png", "--dpi", "72",
        "--max-width", "600", "--max-height", "600", "--medium-size", "320",
        "--thumb-size", "80", "--sharpen", "0",
    ]
    monkeypatch.setattr(BUILD, "project_root", lambda: root)
    monkeypatch.setattr(sys, "argv", argv)
    assert BUILD.main() == 0
    first = {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file() and ".site-catalog.mutation.lock" not in path.name
    }

    monkeypatch.setattr(sys, "argv", argv)
    assert BUILD.main() == 0
    second = {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file() and ".site-catalog.mutation.lock" not in path.name
    }
    assert second == first
