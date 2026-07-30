#!/usr/bin/env python3
"""Generate browser DTO declarations from the canonical control-panel API schema."""
from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Mapping, Sequence

from control_panel_api_schema import SCHEMA_PATH, load_control_panel_schema

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = PROJECT_ROOT / "types" / "control-panel-api.d.ts"
HEADER = "// Generated from schemas/control-panel-api.schema.json. Do not edit manually.\n\n"


def _ref_name(value: str) -> str:
    prefix = "#/$defs/"
    if not value.startswith(prefix):
        raise ValueError(f"Unsupported schema reference: {value}")
    return value[len(prefix):]


def _literal(value: Any) -> str:
    if value is True:
        return "true"
    if value is False:
        return "false"
    if value is None:
        return "null"
    if isinstance(value, str):
        return repr(value).replace("'", '"')
    return str(value)


def _type(schema: Mapping[str, Any]) -> str:
    ref = schema.get("$ref")
    if isinstance(ref, str):
        return _ref_name(ref)
    if "const" in schema:
        return _literal(schema["const"])
    enum = schema.get("enum")
    if isinstance(enum, list):
        return " | ".join(_literal(value) for value in enum)
    one_of = schema.get("oneOf")
    if isinstance(one_of, list):
        return " | ".join(_type(branch) for branch in one_of if isinstance(branch, dict))
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
        items = schema.get("items")
        return f"Array<{_type(items) if isinstance(items, dict) else 'unknown'}>"
    if schema_type == "object":
        properties = schema.get("properties")
        additional = schema.get("additionalProperties", True)
        if not properties and isinstance(additional, dict):
            return f"Record<string, {_type(additional)}>"
        if not properties and additional is True:
            return "Record<string, unknown>"
        return _inline_object(schema)
    if isinstance(schema_type, list):
        return " | ".join(_type({"type": item}) for item in schema_type)
    return "unknown"


def _property_name(name: str) -> str:
    return name if name.replace("_", "a").isalnum() and not name[0].isdigit() else repr(name)


def _inline_object(schema: Mapping[str, Any], indent: str = "") -> str:
    properties = schema.get("properties")
    properties = properties if isinstance(properties, dict) else {}
    required = set(schema.get("required") or [])
    lines = ["{"]
    for name, child in properties.items():
        if not isinstance(child, dict):
            continue
        optional = "" if name in required else "?"
        lines.append(f"{indent}  {_property_name(name)}{optional}: {_type(child)};")
    if schema.get("additionalProperties") is True:
        lines.append(f"{indent}  [key: string]: unknown;")
    elif isinstance(schema.get("additionalProperties"), dict):
        lines.append(f"{indent}  [key: string]: {_type(schema['additionalProperties'])};")
    lines.append(f"{indent}}}")
    return "\n".join(lines)


def _declaration(name: str, schema: Mapping[str, Any]) -> str:
    if schema.get("type") == "object" and isinstance(schema.get("properties"), dict):
        body = _inline_object(schema)
        return f"interface {name} {body}\n"
    return f"type {name} = {_type(schema)};\n"


def render_types() -> str:
    schema = load_control_panel_schema()
    definitions = schema["$defs"]
    parts = [HEADER]
    for name, definition in definitions.items():
        if isinstance(definition, dict):
            parts.append(_declaration(name, definition))
            parts.append("\n")
    return "".join(parts).rstrip() + "\n"


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    rendered = render_types()
    if args.check:
        current = OUTPUT_PATH.read_text(encoding="utf-8") if OUTPUT_PATH.is_file() else ""
        if current != rendered:
            print(f"Generated control-panel API types are stale: {OUTPUT_PATH.relative_to(PROJECT_ROOT)}")
            print(f"Run: python {Path(__file__).name}")
            return 1
        print(f"Control-panel API types are current ({SCHEMA_PATH.relative_to(PROJECT_ROOT)}).")
        return 0
    OUTPUT_PATH.write_text(rendered, encoding="utf-8")
    print(f"Wrote {OUTPUT_PATH.relative_to(PROJECT_ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
