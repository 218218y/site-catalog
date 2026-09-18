from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

import sync_catalog_pdfs as SYNC
from catalog_schema import validate_catalog_config, validate_taxonomy_config, validate_taxonomy_coverage


def test_discovered_pdf_uses_valid_general_category(tmp_path: Path) -> None:
    pdf_dir = tmp_path / "assets" / "pdfs"
    pdf_dir.mkdir(parents=True)
    pdf = pdf_dir / "new-catalog.pdf"
    pdf.write_bytes(b"%PDF-1.4\n")

    rows = SYNC.find_missing_pdf_catalogs([], pdf_dir, root=tmp_path)

    assert len(rows) == 1
    assert rows[0]["category"] == SYNC.DEFAULT_CATEGORY_NAME
    assert rows[0]["subcategory"] == ""
    assert rows[0]["pdf"] == "assets/pdfs/new-catalog.pdf"
    validated = validate_catalog_config(rows, tmp_path)
    assert validated[0]["category"] == SYNC.DEFAULT_CATEGORY_NAME


def test_sync_adds_general_taxonomy_and_keeps_config_buildable(tmp_path: Path) -> None:
    config_path = tmp_path / "catalogs.config.json"
    taxonomy_path = tmp_path / "catalog-taxonomy.config.json"
    pdf_dir = tmp_path / "assets" / "pdfs"
    pdf_dir.mkdir(parents=True)
    config_path.write_text(
        json.dumps([
            {
                "id": "existing",
                "title": "Existing",
                "pdf": "assets/pdfs/existing.pdf",
                "category": "Existing category",
                "subcategory": "",
                "ocr": True,
            }
        ], ensure_ascii=False),
        encoding="utf-8",
    )
    taxonomy_path.write_text(
        json.dumps({
            "categories": [
                {
                    "name": "Existing category",
                    "slug": "existing-category",
                    "description": "Existing category description",
                }
            ],
            "subcategories": [],
        }, ensure_ascii=False),
        encoding="utf-8",
    )
    (pdf_dir / "existing.pdf").write_bytes(b"%PDF-1.4\n")
    (pdf_dir / "new.pdf").write_bytes(b"%PDF-1.4\n")

    result = SYNC.sync_config(
        config_path,
        pdf_dir,
        root=tmp_path,
        taxonomy_path=taxonomy_path,
    )

    assert [item["id"] for item in result.additions] == ["new"]
    stored_config = json.loads(config_path.read_text(encoding="utf-8"))
    stored_taxonomy = json.loads(taxonomy_path.read_text(encoding="utf-8"))
    new_catalog = next(item for item in stored_config if item["id"] == "new")
    general = next(item for item in stored_taxonomy["categories"] if item["name"] == SYNC.DEFAULT_CATEGORY_NAME)
    assert new_catalog["category"] == SYNC.DEFAULT_CATEGORY_NAME
    assert general["slug"] == SYNC.DEFAULT_CATEGORY_SLUG
    assert general["description"] == SYNC.DEFAULT_CATEGORY_DESCRIPTION

    validated_config = validate_catalog_config(stored_config, tmp_path)
    validated_taxonomy = validate_taxonomy_config(stored_taxonomy, tmp_path)
    validate_taxonomy_coverage(validated_config, validated_taxonomy)


def test_dry_run_never_mutates_config_or_taxonomy(tmp_path: Path) -> None:
    config_path = tmp_path / "catalogs.config.json"
    taxonomy_path = tmp_path / "catalog-taxonomy.config.json"
    pdf_dir = tmp_path / "assets" / "pdfs"
    pdf_dir.mkdir(parents=True)
    config_path.write_text("[]\n", encoding="utf-8")
    taxonomy_path.write_text('{"categories":[],"subcategories":[]}\n', encoding="utf-8")
    (pdf_dir / "new.pdf").write_bytes(b"%PDF-1.4\n")
    before_config = config_path.read_bytes()
    before_taxonomy = taxonomy_path.read_bytes()

    result = SYNC.sync_config(
        config_path,
        pdf_dir,
        dry_run=True,
        root=tmp_path,
        taxonomy_path=taxonomy_path,
    )

    assert result.additions and result.additions[0]["category"] == SYNC.DEFAULT_CATEGORY_NAME
    assert config_path.read_bytes() == before_config
    assert taxonomy_path.read_bytes() == before_taxonomy
