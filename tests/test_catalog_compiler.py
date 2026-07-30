from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path

import pytest

from tools import catalog_compiler as COMPILER
from tools import catalog_control_server as SERVER
from tools import catalog_schema as SCHEMA

ROOT = Path(__file__).resolve().parents[1]


def source_catalog(catalog_id: str, title: str, *, pdf: str, sort: int | None = None) -> dict[str, object]:
    row: dict[str, object] = {
        "id": catalog_id,
        "title": title,
        "description": f"Description for {title}",
        "category": "Category",
        "subcategory": "Sub",
        "pdf": pdf,
        "ocr": False,
    }
    if sort is not None:
        row["sort"] = sort
    return row


def taxonomy() -> dict[str, object]:
    return {
        "categories": [
            {"name": "Category", "slug": "category", "description": "Category description"}
        ],
        "subcategories": [
            {
                "category": "Category",
                "name": "Sub",
                "slug": "sub",
                "description": "Subcategory description",
            }
        ],
    }


def artifact(catalog_id: str, *, text: str = "search text") -> dict[str, object]:
    return {
        "id": catalog_id,
        "pages": 1,
        "imageExt": "webp",
        "assetVersion": f"asset-{catalog_id}",
        "imageVariants": {
            "thumb": {"maxSide": 420, "version": f"thumb-{catalog_id}"},
            "medium": {"maxSide": 1600, "version": f"medium-{catalog_id}"},
            "full": {"maxSide": 2800, "version": f"full-{catalog_id}"},
        },
        "pageSizes": [[1200, 900]],
        "searchPages": [{"page": 1, "text": text}],
    }


def write_sources(root: Path, catalogs: list[dict[str, object]], state: dict[str, object]) -> None:
    (root / "assets/pdfs").mkdir(parents=True, exist_ok=True)
    for row in catalogs:
        (root / str(row["pdf"])).write_bytes(b"%PDF-1.4\n")
    (root / "catalogs.config.json").write_text(
        json.dumps(catalogs, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (root / "catalog-taxonomy.config.json").write_text(
        json.dumps(taxonomy(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (root / COMPILER.BUILD_STATE_FILE).write_text(
        json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def test_checked_in_catalog_sources_and_outputs_match_official_schemas() -> None:
    catalogs = json.loads((ROOT / "catalogs.config.json").read_text(encoding="utf-8"))
    taxonomy_payload = json.loads((ROOT / "catalog-taxonomy.config.json").read_text(encoding="utf-8"))
    state = json.loads((ROOT / COMPILER.BUILD_STATE_FILE).read_text(encoding="utf-8"))
    generated = json.loads((ROOT / COMPILER.GENERATED_JSON_FILE).read_text(encoding="utf-8"))
    compiled = COMPILER.compile_current_project_catalog_data(
        ROOT,
        writer=lambda path, _data: pytest.fail(f"checked-in compiler output is stale: {path}"),
    )
    search_index = json.loads((ROOT / COMPILER.SEARCH_INDEX_FILE).read_text(encoding="utf-8"))

    SCHEMA.validate_catalog_config(catalogs, ROOT)
    SCHEMA.validate_taxonomy_config(taxonomy_payload, ROOT)
    SCHEMA.validate_build_state(state, ROOT)
    SCHEMA.validate_generated(generated, ROOT)
    SCHEMA.validate_search(compiled.search, ROOT)
    SCHEMA.validate_search_index(search_index, ROOT)
    SCHEMA.validate_taxonomy_coverage(catalogs, taxonomy_payload)


@pytest.mark.parametrize(
    "schema_name",
    [
        SCHEMA.CATALOG_CONFIG_SCHEMA,
        SCHEMA.TAXONOMY_SCHEMA,
        SCHEMA.BUILD_STATE_SCHEMA,
        SCHEMA.GENERATED_SCHEMA,
        SCHEMA.SEARCH_SCHEMA,
        SCHEMA.SEARCH_INDEX_SCHEMA,
    ],
)
def test_official_schemas_are_draft_2020_12_documents(schema_name: str) -> None:
    schema = SCHEMA.load_schema(ROOT, schema_name)
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    assert schema["$id"].endswith("/" + schema_name)



def test_search_index_keeps_pages_without_extractable_text_searchable_by_metadata(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    catalogs = [source_catalog("image-only", "Unique Furniture Title", pdf="assets/pdfs/image-only.pdf")]
    state_artifact = artifact("image-only", text="")
    state_artifact["pages"] = 3
    state_artifact["pageSizes"] = [[1200, 900], [1200, 900], [1200, 900]]
    state_artifact["searchPages"] = []
    write_sources(root, catalogs, {"version": 1, "catalogs": [state_artifact]})

    compiled = COMPILER.compile_current_project_catalog_data(
        root, writer=lambda path, data: path.write_bytes(data)
    )

    assert compiled.search[0]["pages"] == []
    assert compiled.search_index["stats"]["pages"] == 3
    assert [document["page"] for document in compiled.search_index["documents"]] == [1, 2, 3]
    assert all(document["text"] == "" for document in compiled.search_index["documents"])
    title_token = "unique"
    assert compiled.search_index["terms"][title_token] == [0, 1, 2]


def test_zero_based_display_numbering_preserves_one_based_physical_assets(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    source = source_catalog("cover", "Cover catalog", pdf="assets/pdfs/cover.pdf")
    source["pageNumberStart"] = 0
    state_artifact = artifact("cover", text="cover text")
    state_artifact["pages"] = 3
    state_artifact["pageSizes"] = [[1200, 900], [1200, 900], [1200, 900]]
    state_artifact["searchPages"] = [
        {"page": 1, "text": "cover"},
        {"page": 2, "text": "first numbered page"},
        {"page": 3, "text": "second numbered page"},
    ]
    write_sources(root, [source], {"version": 1, "catalogs": [state_artifact]})

    compiled = COMPILER.compile_catalog_data([source], taxonomy(), {"version": 1, "catalogs": [state_artifact]}, root)

    assert compiled.generated[0]["pageNumberStart"] == 0
    assert compiled.generated[0]["cover"] == "assets/pages/cover/page-001.webp"
    assert [page["page"] for page in compiled.search[0]["pages"]] == [0, 1, 2]
    assert [document["page"] for document in compiled.search_index["documents"]] == [0, 1, 2]

def test_compiler_is_byte_deterministic_and_second_write_is_a_noop(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    catalogs = [source_catalog("one", "One", pdf="assets/pdfs/one.pdf")]
    state = {"version": 1, "catalogs": [artifact("one")]}
    write_sources(root, catalogs, state)

    first_writes: list[Path] = []

    def first_writer(path: Path, data: bytes) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        first_writes.append(path)

    first = COMPILER.compile_current_project_catalog_data(root, writer=first_writer)
    first_bytes = COMPILER.compiled_catalog_file_bytes(first)
    second = COMPILER.compile_current_project_catalog_data(root, writer=lambda _path, _data: pytest.fail("unchanged compilation attempted a write"))
    second_bytes = COMPILER.compiled_catalog_file_bytes(second)

    assert first_bytes == second_bytes
    assert first.build_state == second.build_state
    assert {path.name for path in first_writes} == {
        COMPILER.GENERATED_JSON_FILE,
        COMPILER.GENERATED_JS_FILE,
        COMPILER.SEARCH_INDEX_FILE,
    }


def test_control_panel_save_and_full_compiler_emit_identical_catalog_outputs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    original = source_catalog("one", "Old title", pdf="assets/pdfs/one.pdf")
    state = {"version": 1, "catalogs": [artifact("one")]}
    write_sources(root, [original], state)
    COMPILER.compile_current_project_catalog_data(root, writer=lambda path, data: path.write_bytes(data))
    (root / "catalogs.search-overrides.json").write_text("{}\n", encoding="utf-8")

    monkeypatch.setattr(SERVER, "PROJECT_ROOT", root)
    monkeypatch.setattr(SERVER, "CONFIG_FILE", root / "catalogs.config.json")
    monkeypatch.setattr(SERVER, "TAXONOMY_FILE", root / "catalog-taxonomy.config.json")
    monkeypatch.setattr(SERVER, "SEARCH_OVERRIDES_FILE", root / "catalogs.search-overrides.json")
    monkeypatch.setattr(SERVER, "PDF_DIR", root / "assets/pdfs")
    monkeypatch.setattr(SERVER, "PAGES_DIR", root / "assets/pages")
    monkeypatch.setattr(SERVER, "compile_taxonomy_and_site_pages", lambda *_args, **_kwargs: ())

    edited = deepcopy(original)
    edited["title"] = "New title"
    SERVER.save_catalogs_transactionally([edited], taxonomy(), [])
    panel_bytes = {
        relative: (root / relative).read_bytes()
        for relative in COMPILER.MANAGED_CATALOG_OUTPUTS
    }

    expected = COMPILER.compile_catalog_data([edited], taxonomy(), state, root)
    assert panel_bytes == COMPILER.compiled_catalog_file_bytes(expected)


def test_new_catalog_and_second_catalog_in_same_category_use_the_same_pipeline(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    catalogs = [
        source_catalog("first", "First", pdf="assets/pdfs/first.pdf"),
        source_catalog("second", "Second", pdf="assets/pdfs/second.pdf"),
    ]
    state = {"version": 1, "catalogs": [artifact("first", text="alpha"), artifact("second", text="beta")]}
    write_sources(root, catalogs, state)

    compiled = COMPILER.compile_catalog_data(catalogs, taxonomy(), state, root)

    assert [item["id"] for item in compiled.generated] == ["first", "second"]
    assert [item["catalogId"] for item in compiled.search] == ["first", "second"]
    first_keys = set(compiled.generated[0])
    second_keys = set(compiled.generated[1])
    assert first_keys == second_keys
    assert compiled.generated[0]["category"] == compiled.generated[1]["category"] == "Category"
    assert compiled.generated[0]["subcategory"] == compiled.generated[1]["subcategory"] == "Sub"


def test_every_managed_public_catalog_output_is_reconstructable() -> None:
    paths = tuple(path.relative_to(ROOT) for path in COMPILER.verify_managed_outputs_reconstructable(ROOT))
    assert paths[: len(COMPILER.MANAGED_CATALOG_OUTPUTS)] == COMPILER.MANAGED_CATALOG_OUTPUTS
    assert Path("catalog-big-pages-viewer-netfree/catalog-big-pages-viewer.html") in paths
    assert Path("catalog-big-pages-viewer-netfree/README.txt") in paths


def test_schema_rejects_unowned_catalog_fields() -> None:
    catalogs = json.loads((ROOT / "catalogs.config.json").read_text(encoding="utf-8"))
    catalogs[0]["generatedPages"] = 37
    with pytest.raises(SCHEMA.SchemaValidationError, match="unsupported properties"):
        SCHEMA.validate_catalog_config(catalogs, ROOT)


def test_normal_compilation_never_uses_public_outputs_as_input(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    catalogs = [source_catalog("one", "One", pdf="assets/pdfs/one.pdf")]
    state = {"version": 1, "catalogs": [artifact("one")]}
    write_sources(root, catalogs, state)
    (root / COMPILER.GENERATED_JSON_FILE).write_text('[{"id":"tampered"}]\n', encoding="utf-8")
    (root / COMPILER.GENERATED_JS_FILE).write_text("tampered\n", encoding="utf-8")
    legacy_search_json = root / COMPILER.LEGACY_SEARCH_JSON_FILE
    legacy_search_js = root / COMPILER.LEGACY_SEARCH_JS_FILE
    legacy_search_json.write_text('[{"catalogId":"tampered","pages":[]}]\n', encoding="utf-8")
    legacy_search_js.write_text("tampered\n", encoding="utf-8")

    COMPILER.compile_current_project_catalog_data(root, writer=lambda path, data: path.write_bytes(data))

    assert json.loads((root / COMPILER.GENERATED_JSON_FILE).read_text(encoding="utf-8"))[0]["id"] == "one"
    assert json.loads((root / COMPILER.SEARCH_INDEX_FILE).read_text(encoding="utf-8"))["catalogs"][0]["id"] == "one"
    assert legacy_search_json.read_text(encoding="utf-8") == '[{"catalogId":"tampered","pages":[]}]\n'
    assert legacy_search_js.read_text(encoding="utf-8") == "tampered\n"


def test_missing_build_state_is_a_hard_error_for_normal_compilation(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    catalogs = [source_catalog("one", "One", pdf="assets/pdfs/one.pdf")]
    write_sources(root, catalogs, {"version": 1, "catalogs": [artifact("one")]})
    (root / COMPILER.BUILD_STATE_FILE).unlink()
    (root / COMPILER.GENERATED_JSON_FILE).write_text("[]\n", encoding="utf-8")
    (root / COMPILER.GENERATED_JS_FILE).write_text("legacy\n", encoding="utf-8")

    with pytest.raises(FileNotFoundError, match=COMPILER.BUILD_STATE_FILE):
        COMPILER.compile_current_project_catalog_data(root, writer=lambda _path, _data: None)


def test_normal_compiler_never_rewrites_authoritative_build_state(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    catalogs = [source_catalog("one", "One", pdf="assets/pdfs/one.pdf")]
    state = {"version": 1, "catalogs": [artifact("one")]}
    write_sources(root, catalogs, state)
    original_state = (root / COMPILER.BUILD_STATE_FILE).read_bytes()

    COMPILER.compile_current_project_catalog_data(root, writer=lambda path, data: path.write_bytes(data))

    assert (root / COMPILER.BUILD_STATE_FILE).read_bytes() == original_state


def test_orphan_build_state_requires_explicit_reconciliation(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    catalogs = [source_catalog("one", "One", pdf="assets/pdfs/one.pdf")]
    state = {"version": 1, "catalogs": [artifact("one"), artifact("removed")]}
    write_sources(root, catalogs, state)

    with pytest.raises(ValueError, match="removed"):
        COMPILER.compile_current_project_catalog_data(root, writer=lambda _path, _data: None)


def test_explicit_legacy_migration_requires_matching_json_and_js(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    catalogs = [source_catalog("one", "One", pdf="assets/pdfs/one.pdf")]
    expected = COMPILER.compile_catalog_data(
        catalogs,
        taxonomy(),
        {"version": 1, "catalogs": [artifact("one")]},
        root,
    )
    (root / COMPILER.GENERATED_JSON_FILE).write_bytes(
        COMPILER.compiled_catalog_file_bytes(expected)[Path(COMPILER.GENERATED_JSON_FILE)]
    )
    (root / COMPILER.GENERATED_JS_FILE).write_bytes(
        COMPILER.compiled_catalog_file_bytes(expected)[Path(COMPILER.GENERATED_JS_FILE)]
    )
    legacy_search_payload = json.dumps(expected.search, ensure_ascii=False, indent=2) + "\n"
    (root / COMPILER.LEGACY_SEARCH_JSON_FILE).write_text(legacy_search_payload, encoding="utf-8")
    (root / COMPILER.LEGACY_SEARCH_JS_FILE).write_text(
        "window.BARGIG_CATALOG_SEARCH = "
        + json.dumps(expected.search, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )

    migrated = COMPILER.migrate_legacy_outputs_to_build_state(root)
    assert migrated == expected.build_state

    (root / COMPILER.GENERATED_JS_FILE).write_text("window.BARGIG_CATALOGS = [];\n", encoding="utf-8")
    with pytest.raises(RuntimeError, match="different data"):
        COMPILER.migrate_legacy_outputs_to_build_state(root)


def test_schema_rejects_cross_file_and_asset_path_drift() -> None:
    generated = json.loads((ROOT / COMPILER.GENERATED_JSON_FILE).read_text(encoding="utf-8"))
    compiled = COMPILER.compile_current_project_catalog_data(
        ROOT,
        writer=lambda path, _data: pytest.fail(f"checked-in compiler output is stale: {path}"),
    )

    invalid_generated = deepcopy(generated)
    invalid_generated[0]["cover"] = "assets/pages/wrong/page-001.webp"
    with pytest.raises(SCHEMA.SchemaValidationError, match="cover must be"):
        SCHEMA.validate_generated(invalid_generated, ROOT)

    invalid_search = deepcopy(compiled.search)
    invalid_search[0]["title"] = "Different title"
    with pytest.raises(SCHEMA.SchemaValidationError, match="must match"):
        SCHEMA.validate_compiled_pair(generated, invalid_search)
