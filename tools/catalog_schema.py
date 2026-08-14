#!/usr/bin/env python3
"""Schema-backed validation for catalog source and compiler data.

The JSON files in ``schemas/`` are the public, editor-friendly contracts. This
module owns the boundary from untrusted JSON-shaped values to typed canonical
catalog models. Structural enforcement is delegated to the shared strict
Draft 2020-12 subset in ``tools/json_schema.py``; semantic cross-record checks
live here beside that boundary.
"""
from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from copy import deepcopy
from pathlib import Path
from typing import cast

try:
    from tools.json_schema import (
        JsonSchemaDefinitionError,
        JsonSchemaValidationError,
        audit_json_schema,
        validate_json_schema,
    )
except ModuleNotFoundError:  # Direct execution from tools/
    from json_schema import (
        JsonSchemaDefinitionError,
        JsonSchemaValidationError,
        audit_json_schema,
        validate_json_schema,
    )

try:
    from tools.catalog_page_numbering import first_display_page, last_display_page, page_number_start
except ModuleNotFoundError:  # Direct execution from tools/
    from catalog_page_numbering import first_display_page, last_display_page, page_number_start

try:
    from tools.catalog_types import (
        CatalogBuildState,
        CatalogConfig,
        CatalogSource,
        CatalogSourceInput,
        GeneratedCatalogs,
        SearchCatalogs,
        SearchIndex,
        TaxonomyConfig,
    )
except ModuleNotFoundError:  # Direct execution from tools/
    from catalog_types import (
        CatalogBuildState,
        CatalogConfig,
        CatalogSource,
        CatalogSourceInput,
        GeneratedCatalogs,
        SearchCatalogs,
        SearchIndex,
        TaxonomyConfig,
    )

SCHEMA_DIRNAME = "schemas"
CATALOG_CONFIG_SCHEMA = "catalogs.config.schema.json"
TAXONOMY_SCHEMA = "catalog-taxonomy.config.schema.json"
BUILD_STATE_SCHEMA = "catalogs.build-state.schema.json"
GENERATED_SCHEMA = "catalogs.generated.schema.json"
SEARCH_SCHEMA = "catalogs.search.schema.json"
SEARCH_INDEX_SCHEMA = "catalogs.search-index.schema.json"


class SchemaValidationError(ValueError):
    """Raised when data violates one of the checked-in JSON Schemas."""


def schema_root(project_root: Path) -> Path:
    candidate = project_root / SCHEMA_DIRNAME
    if candidate.is_dir():
        return candidate
    # Isolated tests and embedders may point the compiler at a temporary data
    # root. Schemas are code assets, so fall back to the checked-in tool root.
    return Path(__file__).resolve().parents[1] / SCHEMA_DIRNAME


def load_schema(project_root: Path, name: str) -> dict[str, object]:
    path = schema_root(project_root) / name
    try:
        payload: object = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Required catalog schema is missing: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SchemaValidationError(f"Could not parse schema {name}: {exc}") from exc
    if not isinstance(payload, dict):
        raise SchemaValidationError(f"Schema {name} must contain one JSON object")
    return cast(dict[str, object], payload)


def validate_against_schema(value: object, project_root: Path, schema_name: str) -> None:
    schema = load_schema(project_root, schema_name)
    try:
        audit_json_schema(schema)
        validate_json_schema(value, schema)
    except JsonSchemaDefinitionError as exc:
        raise SchemaValidationError(f"Invalid schema {schema_name}: {exc}") from exc
    except JsonSchemaValidationError as exc:
        raise SchemaValidationError(str(exc)) from exc


def _ensure_unique(rows: Sequence[Mapping[str, object]], key: str, *, label: str) -> None:
    seen: set[str] = set()
    for index, row in enumerate(rows, 1):
        raw_value = row.get(key)
        value = raw_value if isinstance(raw_value, str) else str(raw_value or "")
        if value in seen:
            raise SchemaValidationError(f"Duplicate {label} at item #{index}: {value}")
        seen.add(value)


def validate_catalog_config(value: object, project_root: Path) -> CatalogConfig:
    validate_against_schema(value, project_root, CATALOG_CONFIG_SCHEMA)
    source_rows = cast(list[CatalogSourceInput], deepcopy(value))
    rows: CatalogConfig = []
    for source in source_rows:
        row: CatalogSource = {
            "id": source["id"].strip().lower(),
            "title": source["title"].strip(),
            "pdf": source["pdf"].replace("\\", "/").strip(),
            "description": source.get("description", ""),
            "category": source.get("category", "קטלוג").strip() or "קטלוג",
            "subcategory": source.get("subcategory", "").strip(),
            "ocr": source.get("ocr", True),
            "pageNumberStart": page_number_start(source),
        }
        if "sort" in source:
            row["sort"] = source["sort"]
        if "badge" in source:
            row["badge"] = source["badge"]
        rows.append(row)
    _ensure_unique(rows, "id", label="catalog id")
    return rows


def validate_taxonomy_config(value: object, project_root: Path) -> TaxonomyConfig:
    validate_against_schema(value, project_root, TAXONOMY_SCHEMA)
    payload = cast(TaxonomyConfig, deepcopy(value))
    categories = payload["categories"]
    subcategories = payload["subcategories"]
    _ensure_unique(categories, "name", label="taxonomy category name")
    _ensure_unique(categories, "slug", label="taxonomy category slug")
    category_names = {item["name"] for item in categories}
    sub_names: set[tuple[str, str]] = set()
    sub_paths: set[tuple[str, str]] = set()
    category_slug_by_name = {item["name"]: item["slug"] for item in categories}
    for index, item in enumerate(subcategories, 1):
        category = item["category"]
        if category not in category_names:
            raise SchemaValidationError(
                f"Taxonomy subcategory #{index} references unknown category: {category}"
            )
        name_key = (category, item["name"])
        path_key = (category_slug_by_name[category], item["slug"])
        if name_key in sub_names:
            raise SchemaValidationError(f"Duplicate taxonomy subcategory: {category} / {item['name']}")
        if path_key in sub_paths:
            raise SchemaValidationError(
                f"Duplicate taxonomy route: {path_key[0]} / {path_key[1]}"
            )
        sub_names.add(name_key)
        sub_paths.add(path_key)
    return payload


def validate_taxonomy_coverage(catalogs: Sequence[CatalogSource], taxonomy: TaxonomyConfig) -> None:
    category_names = {item["name"] for item in taxonomy["categories"]}
    subcategories = {
        (item["category"], item["name"])
        for item in taxonomy["subcategories"]
    }
    failures: list[str] = []
    for catalog in catalogs:
        catalog_id = catalog["id"]
        category = catalog["category"]
        subcategory = catalog["subcategory"]
        if category not in category_names:
            failures.append(f"{catalog_id}: unknown category {category!r}")
        if subcategory and (category, subcategory) not in subcategories:
            failures.append(f"{catalog_id}: unknown subcategory {category!r} / {subcategory!r}")
    if failures:
        raise SchemaValidationError("Catalog taxonomy coverage failed: " + "; ".join(failures))


def validate_build_state(value: object, project_root: Path) -> CatalogBuildState:
    validate_against_schema(value, project_root, BUILD_STATE_SCHEMA)
    payload = cast(CatalogBuildState, deepcopy(value))
    rows = payload["catalogs"]
    _ensure_unique(rows, "id", label="build-state catalog id")
    for row in rows:
        pages = row["pages"]
        page_sizes = row.get("pageSizes")
        if page_sizes is not None and len(page_sizes) != pages:
            raise SchemaValidationError(
                f"Build-state catalog {row['id']} has {len(page_sizes)} pageSizes for {pages} pages"
            )
        seen_pages: set[int] = set()
        for page in row["searchPages"]:
            page_number = page["page"]
            if page_number > pages:
                raise SchemaValidationError(
                    f"Build-state catalog {row['id']} search page {page_number} exceeds page count {pages}"
                )
            if page_number in seen_pages:
                raise SchemaValidationError(
                    f"Build-state catalog {row['id']} repeats search page {page_number}"
                )
            seen_pages.add(page_number)
    return payload


def validate_generated(value: object, project_root: Path) -> GeneratedCatalogs:
    validate_against_schema(value, project_root, GENERATED_SCHEMA)
    rows = cast(GeneratedCatalogs, deepcopy(value))
    _ensure_unique(rows, "id", label="generated catalog id")
    for row in rows:
        catalog_id = row["id"]
        directory = f"assets/pages/{catalog_id}"
        if row["dir"] != directory:
            raise SchemaValidationError(
                f"Generated catalog {catalog_id} directory must be {directory!r}"
            )
        expected_cover = f"{directory}/page-001.{row['imageExt']}"
        if row["cover"] != expected_cover:
            raise SchemaValidationError(
                f"Generated catalog {catalog_id} cover must be {expected_cover!r}"
            )
        page_sizes = row.get("pageSizes")
        if page_sizes is not None and len(page_sizes) != row["pages"]:
            raise SchemaValidationError(
                f"Generated catalog {catalog_id} has {len(page_sizes)} pageSizes for {row['pages']} pages"
            )
    return rows


def validate_search(value: object, project_root: Path) -> SearchCatalogs:
    validate_against_schema(value, project_root, SEARCH_SCHEMA)
    rows = cast(SearchCatalogs, deepcopy(value))
    _ensure_unique(rows, "catalogId", label="search catalog id")
    for row in rows:
        seen_pages: set[int] = set()
        for page in row["pages"]:
            page_number = page["page"]
            if page_number in seen_pages:
                raise SchemaValidationError(
                    f"Search catalog {row['catalogId']} repeats page {page_number}"
                )
            seen_pages.add(page_number)
    return rows


def validate_search_index(value: object, project_root: Path) -> SearchIndex:
    validate_against_schema(value, project_root, SEARCH_INDEX_SCHEMA)
    payload = cast(SearchIndex, deepcopy(value))
    catalogs = payload["catalogs"]
    documents = payload["documents"]
    _ensure_unique(catalogs, "id", label="search-index catalog id")
    seen_document_pages: set[tuple[int, int]] = set()
    for index, document in enumerate(documents):
        catalog_index = document["catalog"]
        if catalog_index < 0 or catalog_index >= len(catalogs):
            raise SchemaValidationError(
                f"Search-index document #{index} references catalog index {catalog_index}, "
                f"but only {len(catalogs)} catalog(s) exist"
            )
        page_key = (catalog_index, document["page"])
        if page_key in seen_document_pages:
            raise SchemaValidationError(
                f"Search-index repeats catalog index {catalog_index}, page {page_key[1]}"
            )
        seen_document_pages.add(page_key)
    document_count = len(documents)
    terms = payload["terms"]
    for token, postings in terms.items():
        if not token.strip():
            raise SchemaValidationError("Search-index terms may not contain an empty token")
        previous = -1
        for document_id in postings:
            if document_id <= previous:
                raise SchemaValidationError(
                    f"Search-index postings for {token!r} must be strictly increasing"
                )
            if document_id < 0 or document_id >= document_count:
                raise SchemaValidationError(
                    f"Search-index token {token!r} references missing document {document_id}"
                )
            previous = document_id
    stats = payload["stats"]
    if stats["catalogs"] != len(catalogs):
        raise SchemaValidationError("Search-index catalog count does not match catalogs array")
    if stats["pages"] != document_count:
        raise SchemaValidationError("Search-index page count does not match documents array")
    if stats["tokens"] != len(terms):
        raise SchemaValidationError("Search-index token count does not match terms object")
    if sum(stats["categoryPages"].values()) != document_count:
        raise SchemaValidationError("Search-index category page counts do not match documents array")
    return payload


def validate_compiled_pair(generated: Sequence[Mapping[str, object]], search: SearchCatalogs) -> None:
    """Validate cross-file invariants shared by the two public outputs."""
    generated_ids = [str(item["id"]) for item in generated]
    search_ids = [item["catalogId"] for item in search]
    if generated_ids != search_ids:
        raise SchemaValidationError(
            "Generated catalog and search output must contain the same catalog ids in the same order"
        )
    generated_by_id = {str(item["id"]): item for item in generated}
    for item in search:
        catalog_id = item["catalogId"]
        generated_item = generated_by_id[catalog_id]
        if item["title"] != str(generated_item["title"]):
            raise SchemaValidationError(
                f"Search title for {catalog_id} must match generated catalog title"
            )
        first_page = first_display_page(generated_item)
        last_page = last_display_page(generated_item)
        for page in item["pages"]:
            page_number = page["page"]
            if page_number < first_page or page_number > last_page:
                raise SchemaValidationError(
                    f"Search page {page_number} for {catalog_id} is outside "
                    f"the generated display range {first_page}..{last_page}"
                )
