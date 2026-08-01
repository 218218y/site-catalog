from __future__ import annotations

import importlib.util
import json
import sys

import pytest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "tools/generate_catalog_data_types.py"
SPEC = importlib.util.spec_from_file_location("generate_catalog_data_types", MODULE_PATH)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_generated_catalog_declarations_are_current() -> None:
    assert MODULE.OUTPUT_PATH.read_text(encoding="utf-8") == MODULE.render_types()


def test_catalog_record_requiredness_tracks_the_schema() -> None:
    schema = json.loads(MODULE.SCHEMA_PATH.read_text(encoding="utf-8"))
    catalog = schema["$defs"]["catalog"]
    rendered = MODULE.render_types()

    for name in catalog["required"]:
        assert f"  {name}:" in rendered
        assert f"  {name}?:" not in rendered
    for name in set(catalog["properties"]) - set(catalog["required"]):
        assert f"  {name}?:" in rendered


def test_canonical_catalog_contract_has_no_compatibility_declaration_boundary() -> None:
    rendered = MODULE.render_types()
    for name in (
        "subCategory",
        "sub_category",
        "subcategories",
        "תת קטגוריה",
        "תת_קטגוריה",
        "thumbDir",
        "mediumDir",
        "format",
    ):
        assert name not in rendered

    assert not (ROOT / "types/catalog-legacy-input.d.ts").exists()


def test_generator_rejects_unmapped_schema_references() -> None:
    try:
        MODULE._definition_name("#/$defs/notMapped")
    except ValueError as error:
        assert "Unmapped catalog schema definition" in str(error)
    else:
        raise AssertionError("unmapped schema references must fail closed")


def test_check_mode_rejects_stale_generated_output(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    output = tmp_path / "catalog-data.generated.d.ts"
    output.write_text("stale\n", encoding="utf-8")
    monkeypatch.setattr(MODULE, "OUTPUT_PATH", output)

    with pytest.raises(SystemExit, match="Generated catalog declarations are stale"):
        MODULE.main(["--check"])
