#!/usr/bin/env python3
"""Generate canonical browser catalog declarations from the public JSON Schema."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Mapping, Sequence

try:
    from tools.catalog_schema import GENERATED_SCHEMA, load_schema
except ModuleNotFoundError:  # Direct execution from tools/
    from catalog_schema import GENERATED_SCHEMA, load_schema

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = PROJECT_ROOT / "schemas" / GENERATED_SCHEMA
OUTPUT_PATH = PROJECT_ROOT / "types" / "catalog-data.generated.d.ts"
HEADER = (
    "// Generated from schemas/catalogs.generated.schema.json. Do not edit manually.\n"
    "// Regenerate with: python tools/generate_catalog_data_types.py\n\n"
)
DEFINITION_NAMES = {
    "pageSize": "CatalogPageSize",
    "variant": "CatalogImageVariant",
    "catalog": "CatalogRecord",
}


def _literal(value: Any) -> str:
    if value is True:
        return "true"
    if value is False:
        return "false"
    if value is None:
        return "null"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    return str(value)


def _definition_name(reference: str) -> str:
    prefix = "#/$defs/"
    if not reference.startswith(prefix):
        raise ValueError(f"Unsupported external schema reference: {reference}")
    key = reference[len(prefix):]
    try:
        return DEFINITION_NAMES[key]
    except KeyError as error:
        raise ValueError(f"Unmapped catalog schema definition: {key}") from error


def _property_name(name: str) -> str:
    return name if name.isidentifier() else json.dumps(name, ensure_ascii=False)


def _tuple_type(schema: Mapping[str, Any]) -> str | None:
    minimum = schema.get("minItems")
    maximum = schema.get("maxItems")
    items = schema.get("items")
    if (
        isinstance(minimum, int)
        and minimum == maximum
        and 0 <= minimum <= 16
        and isinstance(items, Mapping)
    ):
        item_type = _type(items)
        return f"[{', '.join(item_type for _ in range(minimum))}]"
    return None


def _inline_object(schema: Mapping[str, Any], indent: str = "") -> str:
    properties = schema.get("properties")
    properties = properties if isinstance(properties, Mapping) else {}
    required = set(schema.get("required") or [])
    lines = ["{"]
    for name, child in properties.items():
        if not isinstance(name, str) or not isinstance(child, Mapping):
            continue
        optional = "" if name in required else "?"
        child_type = _type(child, f"{indent}  ")
        lines.append(f"{indent}  {_property_name(name)}{optional}: {child_type};")
    additional = schema.get("additionalProperties")
    if additional is True:
        lines.append(f"{indent}  [key: string]: unknown;")
    elif isinstance(additional, Mapping):
        lines.append(f"{indent}  [key: string]: {_type(additional)};")
    lines.append(f"{indent}}}")
    return "\n".join(lines)


def _type(schema: Mapping[str, Any], indent: str = "") -> str:
    all_of = schema.get("allOf")
    if isinstance(all_of, list):
        branches = [_type(branch, indent) for branch in all_of if isinstance(branch, Mapping)]
        if not branches:
            raise ValueError("Catalog schema allOf must contain object branches")
        return " & ".join(branches)

    reference = schema.get("$ref")
    if isinstance(reference, str):
        return _definition_name(reference)
    if "const" in schema:
        return _literal(schema["const"])
    enum = schema.get("enum")
    if isinstance(enum, list) and enum:
        return " | ".join(_literal(value) for value in enum)

    schema_type = schema.get("type")
    if schema_type == "string":
        return "string"
    if schema_type in {"number", "integer"}:
        return "number"
    if schema_type == "boolean":
        return "boolean"
    if schema_type == "null":
        return "null"
    if schema_type == "array":
        tuple_type = _tuple_type(schema)
        if tuple_type is not None:
            return tuple_type
        items = schema.get("items")
        return f"Array<{_type(items, indent) if isinstance(items, Mapping) else 'unknown'}>"
    if schema_type == "object" or isinstance(schema.get("properties"), Mapping):
        return _inline_object(schema, indent)
    if isinstance(schema_type, list):
        return " | ".join(_type({"type": item}, indent) for item in schema_type)
    raise ValueError(f"Unsupported catalog schema node: {schema!r}")


def _declaration(name: str, schema: Mapping[str, Any]) -> str:
    if schema.get("type") == "object" and isinstance(schema.get("properties"), Mapping):
        return f"export interface {name} {_inline_object(schema)}\n"
    return f"export type {name} = {_type(schema)};\n"


def render_types() -> str:
    schema = load_schema(PROJECT_ROOT, GENERATED_SCHEMA)
    definitions = schema.get("$defs")
    if not isinstance(definitions, Mapping):
        raise ValueError(f"{SCHEMA_PATH} must define a $defs object")

    parts = [HEADER]
    for schema_name, type_name in DEFINITION_NAMES.items():
        definition = definitions.get(schema_name)
        if not isinstance(definition, Mapping):
            raise ValueError(f"Missing catalog schema definition: {schema_name}")
        parts.append(_declaration(type_name, definition))
        parts.append("\n")

    root_type = _type(schema)
    if root_type != "Array<CatalogRecord>":
        raise ValueError(f"Unexpected generated catalog root type: {root_type}")
    parts.append("export type CatalogImageTier = keyof CatalogRecord[\"imageVariants\"];\n")
    parts.append("export type CatalogData = Array<CatalogRecord>;\n")
    return "".join(parts)



def _display_path(path: Path) -> str:
    try:
        return path.relative_to(PROJECT_ROOT).as_posix()
    except ValueError:
        return str(path)


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)

    rendered = render_types()
    if args.check:
        try:
            current = OUTPUT_PATH.read_text(encoding="utf-8")
        except FileNotFoundError:
            current = ""
        if current != rendered:
            raise SystemExit(
                f"Generated catalog declarations are stale: {_display_path(OUTPUT_PATH)}"
            )
        print(f"Catalog declarations are current: {_display_path(OUTPUT_PATH)}")
        return 0

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(rendered, encoding="utf-8", newline="\n")
    print(f"Generated: {_display_path(OUTPUT_PATH)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
