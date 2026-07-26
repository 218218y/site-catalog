#!/usr/bin/env python3
"""Schema-backed validation for catalog source and compiler data.

The JSON files in ``schemas/`` are the public, editor-friendly contracts.  This
module intentionally implements the small Draft 2020-12 subset used by those
schemas, avoiding a runtime dependency on a general-purpose schema package.
Semantic checks that JSON Schema cannot express cleanly (cross-file taxonomy
coverage and duplicate ids/slugs) live beside the structural validation.
"""
from __future__ import annotations

import json
import re
from copy import deepcopy
from pathlib import Path
from typing import Any, Mapping, Sequence

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


def load_schema(project_root: Path, name: str) -> dict[str, Any]:
    path = schema_root(project_root) / name
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Required catalog schema is missing: {path}") from exc
    except json.JSONDecodeError as exc:
        raise SchemaValidationError(f"Could not parse schema {name}: {exc}") from exc
    if not isinstance(payload, dict):
        raise SchemaValidationError(f"Schema {name} must contain one JSON object")
    return payload


def _resolve_ref(root_schema: Mapping[str, Any], reference: str) -> Mapping[str, Any]:
    if not reference.startswith("#/"):
        raise SchemaValidationError(f"Unsupported external schema reference: {reference}")
    value: Any = root_schema
    for part in reference[2:].split("/"):
        key = part.replace("~1", "/").replace("~0", "~")
        if not isinstance(value, Mapping) or key not in value:
            raise SchemaValidationError(f"Broken local schema reference: {reference}")
        value = value[key]
    if not isinstance(value, Mapping):
        raise SchemaValidationError(f"Schema reference does not target an object: {reference}")
    return value


def _matches_type(value: Any, expected: str) -> bool:
    if expected == "object":
        return isinstance(value, Mapping)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "null":
        return value is None
    raise SchemaValidationError(f"Unsupported schema type: {expected}")


def _display_path(path: tuple[Any, ...]) -> str:
    result = "$"
    for part in path:
        result += f"[{part}]" if isinstance(part, int) else f".{part}"
    return result


def _fail(path: tuple[Any, ...], message: str) -> None:
    raise SchemaValidationError(f"{_display_path(path)}: {message}")


def _validate(value: Any, schema: Mapping[str, Any], root_schema: Mapping[str, Any], path: tuple[Any, ...]) -> None:
    all_of = schema.get("allOf")
    if isinstance(all_of, list):
        for branch in all_of:
            if not isinstance(branch, Mapping):
                raise SchemaValidationError("Schema allOf entries must be objects")
            _validate(value, branch, root_schema, path)

    reference = schema.get("$ref")
    if isinstance(reference, str):
        _validate(value, _resolve_ref(root_schema, reference), root_schema, path)
        return

    if "const" in schema and value != schema["const"]:
        _fail(path, f"must equal {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        _fail(path, f"must be one of {schema['enum']!r}")

    expected_type = schema.get("type")
    if isinstance(expected_type, str):
        if not _matches_type(value, expected_type):
            _fail(path, f"must be {expected_type}, got {type(value).__name__}")
    elif isinstance(expected_type, list):
        if not any(_matches_type(value, item) for item in expected_type):
            _fail(path, f"must match one of the allowed types: {expected_type!r}")

    if isinstance(value, Mapping):
        required = schema.get("required", [])
        for key in required if isinstance(required, list) else []:
            if key not in value:
                _fail(path, f"is missing required property {key!r}")
        properties = schema.get("properties", {})
        properties = properties if isinstance(properties, Mapping) else {}
        if schema.get("additionalProperties") is False:
            extras = sorted(str(key) for key in value if key not in properties)
            if extras:
                _fail(path, f"contains unsupported properties: {', '.join(extras)}")
        for key, item in value.items():
            child_schema = properties.get(key)
            if isinstance(child_schema, Mapping):
                _validate(item, child_schema, root_schema, (*path, key))

    if isinstance(value, list):
        minimum = schema.get("minItems")
        maximum = schema.get("maxItems")
        if isinstance(minimum, int) and len(value) < minimum:
            _fail(path, f"must contain at least {minimum} item(s)")
        if isinstance(maximum, int) and len(value) > maximum:
            _fail(path, f"must contain at most {maximum} item(s)")
        item_schema = schema.get("items")
        if isinstance(item_schema, Mapping):
            for index, item in enumerate(value):
                _validate(item, item_schema, root_schema, (*path, index))
        if schema.get("uniqueItems") is True:
            serialized = [json.dumps(item, ensure_ascii=False, sort_keys=True) for item in value]
            if len(serialized) != len(set(serialized)):
                _fail(path, "must contain unique items")

    if isinstance(value, str):
        minimum = schema.get("minLength")
        maximum = schema.get("maxLength")
        if isinstance(minimum, int) and len(value) < minimum:
            _fail(path, f"must contain at least {minimum} character(s)")
        if isinstance(maximum, int) and len(value) > maximum:
            _fail(path, f"must contain at most {maximum} character(s)")
        pattern = schema.get("pattern")
        if isinstance(pattern, str) and re.search(pattern, value) is None:
            _fail(path, f"does not match required pattern {pattern!r}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        minimum = schema.get("minimum")
        maximum = schema.get("maximum")
        if isinstance(minimum, (int, float)) and value < minimum:
            _fail(path, f"must be at least {minimum}")
        if isinstance(maximum, (int, float)) and value > maximum:
            _fail(path, f"must be at most {maximum}")


def validate_against_schema(value: Any, project_root: Path, schema_name: str) -> None:
    schema = load_schema(project_root, schema_name)
    _validate(value, schema, schema, ())


def _ensure_unique(rows: Sequence[Mapping[str, Any]], key: str, *, label: str) -> None:
    seen: set[str] = set()
    for index, row in enumerate(rows, 1):
        value = str(row.get(key, ""))
        if value in seen:
            raise SchemaValidationError(f"Duplicate {label} at item #{index}: {value}")
        seen.add(value)


def validate_catalog_config(value: Any, project_root: Path) -> list[dict[str, Any]]:
    validate_against_schema(value, project_root, CATALOG_CONFIG_SCHEMA)
    rows = [deepcopy(dict(item)) for item in value]
    for row in rows:
        row["id"] = str(row["id"]).strip().lower()
        row["title"] = str(row["title"]).strip()
        row["pdf"] = str(row["pdf"]).replace("\\", "/").strip()
        row["description"] = str(row.get("description", ""))
        row["category"] = str(row.get("category", "קטלוג")).strip() or "קטלוג"
        row["subcategory"] = str(row.get("subcategory", "")).strip()
        row["ocr"] = bool(row.get("ocr", True))
    _ensure_unique(rows, "id", label="catalog id")
    return rows


def validate_taxonomy_config(value: Any, project_root: Path) -> dict[str, list[dict[str, str]]]:
    validate_against_schema(value, project_root, TAXONOMY_SCHEMA)
    payload = deepcopy(dict(value))
    categories = [dict(item) for item in payload["categories"]]
    subcategories = [dict(item) for item in payload["subcategories"]]
    _ensure_unique(categories, "name", label="taxonomy category name")
    _ensure_unique(categories, "slug", label="taxonomy category slug")
    category_names = {str(item["name"]) for item in categories}
    sub_names: set[tuple[str, str]] = set()
    sub_paths: set[tuple[str, str]] = set()
    category_slug_by_name = {str(item["name"]): str(item["slug"]) for item in categories}
    for index, item in enumerate(subcategories, 1):
        category = str(item["category"])
        if category not in category_names:
            raise SchemaValidationError(
                f"Taxonomy subcategory #{index} references unknown category: {category}"
            )
        name_key = (category, str(item["name"]))
        path_key = (category_slug_by_name[category], str(item["slug"]))
        if name_key in sub_names:
            raise SchemaValidationError(f"Duplicate taxonomy subcategory: {category} / {item['name']}")
        if path_key in sub_paths:
            raise SchemaValidationError(
                f"Duplicate taxonomy route: {path_key[0]} / {path_key[1]}"
            )
        sub_names.add(name_key)
        sub_paths.add(path_key)
    return {"categories": categories, "subcategories": subcategories}


def validate_taxonomy_coverage(
    catalogs: Sequence[Mapping[str, Any]],
    taxonomy: Mapping[str, Sequence[Mapping[str, Any]]],
) -> None:
    category_names = {str(item["name"]) for item in taxonomy.get("categories", [])}
    subcategories = {
        (str(item["category"]), str(item["name"]))
        for item in taxonomy.get("subcategories", [])
    }
    failures: list[str] = []
    for catalog in catalogs:
        catalog_id = str(catalog.get("id", ""))
        category = str(catalog.get("category", ""))
        subcategory = str(catalog.get("subcategory", ""))
        if category not in category_names:
            failures.append(f"{catalog_id}: unknown category {category!r}")
        if subcategory and (category, subcategory) not in subcategories:
            failures.append(f"{catalog_id}: unknown subcategory {category!r} / {subcategory!r}")
    if failures:
        raise SchemaValidationError("Catalog taxonomy coverage failed: " + "; ".join(failures))


def validate_build_state(value: Any, project_root: Path) -> dict[str, Any]:
    validate_against_schema(value, project_root, BUILD_STATE_SCHEMA)
    payload = deepcopy(dict(value))
    rows = [dict(item) for item in payload["catalogs"]]
    _ensure_unique(rows, "id", label="build-state catalog id")
    for row in rows:
        pages = int(row["pages"])
        page_sizes = row.get("pageSizes")
        if page_sizes is not None and len(page_sizes) != pages:
            raise SchemaValidationError(
                f"Build-state catalog {row['id']} has {len(page_sizes)} pageSizes for {pages} pages"
            )
        seen_pages: set[int] = set()
        for page in row["searchPages"]:
            page_number = int(page["page"])
            if page_number > pages:
                raise SchemaValidationError(
                    f"Build-state catalog {row['id']} search page {page_number} exceeds page count {pages}"
                )
            if page_number in seen_pages:
                raise SchemaValidationError(
                    f"Build-state catalog {row['id']} repeats search page {page_number}"
                )
            seen_pages.add(page_number)
    payload["catalogs"] = rows
    return payload


def validate_generated(value: Any, project_root: Path) -> list[dict[str, Any]]:
    validate_against_schema(value, project_root, GENERATED_SCHEMA)
    rows = [deepcopy(dict(item)) for item in value]
    _ensure_unique(rows, "id", label="generated catalog id")
    for row in rows:
        catalog_id = str(row["id"])
        directory = f"assets/pages/{catalog_id}"
        if str(row["dir"]) != directory:
            raise SchemaValidationError(
                f"Generated catalog {catalog_id} directory must be {directory!r}"
            )
        expected_cover = f"{directory}/page-001.{row['imageExt']}"
        if str(row["cover"]) != expected_cover:
            raise SchemaValidationError(
                f"Generated catalog {catalog_id} cover must be {expected_cover!r}"
            )
        page_sizes = row.get("pageSizes")
        if page_sizes is not None and len(page_sizes) != int(row["pages"]):
            raise SchemaValidationError(
                f"Generated catalog {catalog_id} has {len(page_sizes)} pageSizes for {row['pages']} pages"
            )
    return rows


def validate_search(value: Any, project_root: Path) -> list[dict[str, Any]]:
    validate_against_schema(value, project_root, SEARCH_SCHEMA)
    rows = [deepcopy(dict(item)) for item in value]
    _ensure_unique(rows, "catalogId", label="search catalog id")
    for row in rows:
        seen_pages: set[int] = set()
        for page in row["pages"]:
            page_number = int(page["page"])
            if page_number in seen_pages:
                raise SchemaValidationError(
                    f"Search catalog {row['catalogId']} repeats page {page_number}"
                )
            seen_pages.add(page_number)
    return rows



def validate_search_index(value: Any, project_root: Path) -> dict[str, Any]:
    validate_against_schema(value, project_root, SEARCH_INDEX_SCHEMA)
    payload = deepcopy(dict(value))
    catalogs = [dict(item) for item in payload["catalogs"]]
    documents = [dict(item) for item in payload["documents"]]
    _ensure_unique(catalogs, "id", label="search-index catalog id")
    seen_document_pages: set[tuple[int, int]] = set()
    for index, document in enumerate(documents):
        catalog_index = int(document["catalog"])
        if catalog_index < 0 or catalog_index >= len(catalogs):
            raise SchemaValidationError(
                f"Search-index document #{index} references catalog index {catalog_index}, "
                f"but only {len(catalogs)} catalog(s) exist"
            )
        page_key = (catalog_index, int(document["page"]))
        if page_key in seen_document_pages:
            raise SchemaValidationError(
                f"Search-index repeats catalog index {catalog_index}, page {page_key[1]}"
            )
        seen_document_pages.add(page_key)
    document_count = len(documents)
    terms = dict(payload["terms"])
    for token, postings in terms.items():
        if not str(token).strip():
            raise SchemaValidationError("Search-index terms may not contain an empty token")
        previous = -1
        for document_id in postings:
            document_id = int(document_id)
            if document_id <= previous:
                raise SchemaValidationError(
                    f"Search-index postings for {token!r} must be strictly increasing"
                )
            if document_id < 0 or document_id >= document_count:
                raise SchemaValidationError(
                    f"Search-index token {token!r} references missing document {document_id}"
                )
            previous = document_id
    stats = dict(payload["stats"])
    if int(stats["catalogs"]) != len(catalogs):
        raise SchemaValidationError("Search-index catalog count does not match catalogs array")
    if int(stats["pages"]) != document_count:
        raise SchemaValidationError("Search-index page count does not match documents array")
    if int(stats["tokens"]) != len(terms):
        raise SchemaValidationError("Search-index token count does not match terms object")
    category_pages = dict(stats["categoryPages"])
    if sum(int(count) for count in category_pages.values()) != document_count:
        raise SchemaValidationError("Search-index category page counts do not match documents array")
    payload["catalogs"] = catalogs
    payload["documents"] = documents
    payload["terms"] = terms
    return payload

def validate_compiled_pair(
    generated: Sequence[Mapping[str, Any]],
    search: Sequence[Mapping[str, Any]],
) -> None:
    """Validate cross-file invariants shared by the two public outputs."""
    generated_ids = [str(item["id"]) for item in generated]
    search_ids = [str(item["catalogId"]) for item in search]
    if generated_ids != search_ids:
        raise SchemaValidationError(
            "Generated catalog and search output must contain the same catalog ids in the same order"
        )
    generated_by_id = {str(item["id"]): item for item in generated}
    for item in search:
        catalog_id = str(item["catalogId"])
        generated_item = generated_by_id[catalog_id]
        if str(item["title"]) != str(generated_item["title"]):
            raise SchemaValidationError(
                f"Search title for {catalog_id} must match generated catalog title"
            )
        pages = int(generated_item["pages"])
        for page in item["pages"]:
            if int(page["page"]) > pages:
                raise SchemaValidationError(
                    f"Search page {page['page']} for {catalog_id} exceeds generated page count {pages}"
                )
