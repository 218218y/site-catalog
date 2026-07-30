#!/usr/bin/env python3
"""Canonical control-panel API schema loading and strict stdlib validation."""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping, Sequence

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = PROJECT_ROOT / "schemas" / "control-panel-api.schema.json"


class ControlPanelSchemaError(ValueError):
    """Raised when a control-panel request or response violates the contract."""



_SCHEMA_KEYWORDS = frozenset({
    "$ref",
    "type",
    "properties",
    "required",
    "additionalProperties",
    "items",
    "oneOf",
    "enum",
    "const",
    "minLength",
    "pattern",
})
_SCHEMA_TYPES = frozenset({"null", "object", "array", "string", "boolean", "integer", "number"})


def _audit_schema_node(node: Mapping[str, Any], path: str, definitions: Mapping[str, Any]) -> None:
    unsupported = sorted(set(node) - _SCHEMA_KEYWORDS)
    if unsupported:
        raise RuntimeError(f"Unsupported control-panel schema keyword at {path}: {', '.join(unsupported)}")

    ref = node.get("$ref")
    if ref is not None:
        if not isinstance(ref, str) or not ref.startswith("#/$defs/"):
            raise RuntimeError(f"Unsupported control-panel schema reference at {path}: {ref!r}")
        if ref.removeprefix("#/$defs/") not in definitions:
            raise RuntimeError(f"Unknown control-panel schema reference at {path}: {ref}")

    schema_type = node.get("type")
    schema_types = schema_type if isinstance(schema_type, list) else [schema_type]
    for item in schema_types:
        if item is not None and (not isinstance(item, str) or item not in _SCHEMA_TYPES):
            raise RuntimeError(f"Unsupported control-panel schema type at {path}: {item!r}")

    properties = node.get("properties")
    if properties is not None and not isinstance(properties, dict):
        raise RuntimeError(f"Schema properties must be an object at {path}")
    if isinstance(properties, dict):
        for name, child in properties.items():
            if not isinstance(child, dict):
                raise RuntimeError(f"Invalid property schema at {path}.properties.{name}")
            _audit_schema_node(child, f"{path}.properties.{name}", definitions)

    required = node.get("required")
    if required is not None:
        if not isinstance(required, list) or not all(isinstance(name, str) for name in required):
            raise RuntimeError(f"Schema required must be an array of strings at {path}")
        unknown_required = sorted(set(required) - set(properties or {}))
        if unknown_required:
            raise RuntimeError(f"Schema requires unknown properties at {path}: {', '.join(unknown_required)}")

    additional = node.get("additionalProperties")
    if additional is not None and not isinstance(additional, (bool, dict)):
        raise RuntimeError(f"Invalid additionalProperties at {path}")
    if isinstance(additional, dict):
        _audit_schema_node(additional, f"{path}.additionalProperties", definitions)

    items = node.get("items")
    if items is not None:
        if not isinstance(items, dict):
            raise RuntimeError(f"Invalid items schema at {path}")
        _audit_schema_node(items, f"{path}.items", definitions)

    one_of = node.get("oneOf")
    if one_of is not None:
        if not isinstance(one_of, list) or not one_of:
            raise RuntimeError(f"Schema oneOf must be a non-empty array at {path}")
        for index, branch in enumerate(one_of):
            if not isinstance(branch, dict):
                raise RuntimeError(f"Invalid oneOf branch at {path}[{index}]")
            _audit_schema_node(branch, f"{path}.oneOf[{index}]", definitions)

    enum = node.get("enum")
    if enum is not None and (not isinstance(enum, list) or not enum):
        raise RuntimeError(f"Schema enum must be a non-empty array at {path}")

    min_length = node.get("minLength")
    if min_length is not None and (not isinstance(min_length, int) or isinstance(min_length, bool) or min_length < 0):
        raise RuntimeError(f"Invalid minLength at {path}")

    pattern = node.get("pattern")
    if pattern is not None:
        if not isinstance(pattern, str):
            raise RuntimeError(f"Invalid pattern at {path}")
        re.compile(pattern)


def _audit_schema(payload: Mapping[str, Any]) -> None:
    allowed_root = {"$schema", "$id", "title", "$defs"}
    unsupported = sorted(set(payload) - allowed_root)
    if unsupported:
        raise RuntimeError(f"Unsupported control-panel schema root keyword: {', '.join(unsupported)}")
    definitions = payload.get("$defs")
    if not isinstance(definitions, dict) or not definitions:
        raise RuntimeError("Control-panel schema must define a non-empty $defs object")
    for name, definition in definitions.items():
        if not isinstance(name, str) or not isinstance(definition, dict):
            raise RuntimeError(f"Invalid control-panel schema definition: {name!r}")
        _audit_schema_node(definition, f"$defs.{name}", definitions)

@lru_cache(maxsize=1)
def load_control_panel_schema() -> dict[str, Any]:
    payload = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid control-panel schema: {SCHEMA_PATH}")
    _audit_schema(payload)
    return payload


def schema_definition(name: str) -> Mapping[str, Any]:
    definition = load_control_panel_schema()["$defs"].get(name)
    if not isinstance(definition, dict):
        raise KeyError(f"Unknown control-panel schema definition: {name}")
    return definition


def _resolve_ref(ref: str) -> Mapping[str, Any]:
    prefix = "#/$defs/"
    if not ref.startswith(prefix):
        raise RuntimeError(f"Unsupported control-panel schema reference: {ref}")
    return schema_definition(ref[len(prefix):])


def _type_matches(expected: str, value: Any) -> bool:
    if expected == "null":
        return value is None
    if expected == "object":
        return isinstance(value, dict)
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
    raise RuntimeError(f"Unsupported control-panel schema type: {expected}")


def _validate(schema: Mapping[str, Any], value: Any, path: str) -> None:
    ref = schema.get("$ref")
    if isinstance(ref, str):
        _validate(_resolve_ref(ref), value, path)
        return

    branches = schema.get("oneOf")
    if isinstance(branches, list):
        failures: list[str] = []
        matches = 0
        for branch in branches:
            if not isinstance(branch, dict):
                raise RuntimeError(f"Invalid oneOf branch at {path}")
            try:
                _validate(branch, value, path)
            except ControlPanelSchemaError as exc:
                failures.append(str(exc))
            else:
                matches += 1
        if matches != 1:
            details = "; ".join(failures[:3])
            raise ControlPanelSchemaError(f"{path} must match exactly one schema branch{': ' + details if details else ''}")
        return

    if "const" in schema and value != schema["const"]:
        raise ControlPanelSchemaError(f"{path} must equal {schema['const']!r}")
    if "enum" in schema and value not in schema["enum"]:
        raise ControlPanelSchemaError(f"{path} must be one of {schema['enum']!r}")

    expected = schema.get("type")
    if isinstance(expected, str):
        if not _type_matches(expected, value):
            raise ControlPanelSchemaError(f"{path} must be {expected}")
    elif isinstance(expected, list):
        if not any(isinstance(item, str) and _type_matches(item, value) for item in expected):
            raise ControlPanelSchemaError(f"{path} must match one of {expected!r}")

    if isinstance(value, str):
        minimum = schema.get("minLength")
        if isinstance(minimum, int) and len(value) < minimum:
            raise ControlPanelSchemaError(f"{path} must contain at least {minimum} characters")
        pattern = schema.get("pattern")
        if isinstance(pattern, str) and re.fullmatch(pattern, value) is None:
            raise ControlPanelSchemaError(f"{path} does not match the required pattern")

    if isinstance(value, list):
        item_schema = schema.get("items")
        if isinstance(item_schema, dict):
            for index, item in enumerate(value):
                _validate(item_schema, item, f"{path}[{index}]")

    if isinstance(value, dict):
        properties = schema.get("properties")
        properties = properties if isinstance(properties, dict) else {}
        required = schema.get("required")
        required_names = required if isinstance(required, list) else []
        for name in required_names:
            if name not in value:
                raise ControlPanelSchemaError(f"{path}.{name} is required")
        additional = schema.get("additionalProperties", True)
        for name, item in value.items():
            child_path = f"{path}.{name}"
            child_schema = properties.get(name)
            if isinstance(child_schema, dict):
                _validate(child_schema, item, child_path)
            elif additional is False:
                raise ControlPanelSchemaError(f"{child_path} is not allowed")
            elif isinstance(additional, dict):
                _validate(additional, item, child_path)


def validate_control_panel_payload(name: str, payload: Any) -> None:
    """Validate one named request/response payload against the canonical schema."""

    _validate(schema_definition(name), payload, name)


def validate_many(name: str, payloads: Sequence[Any]) -> None:
    for index, payload in enumerate(payloads):
        try:
            validate_control_panel_payload(name, payload)
        except ControlPanelSchemaError as exc:
            raise ControlPanelSchemaError(f"{name}[{index}]: {exc}") from exc
