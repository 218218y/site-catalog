#!/usr/bin/env python3
"""Strict JSON Schema subset shared by project data contracts.

The project intentionally avoids a general-purpose runtime JSON Schema dependency,
but checked-in schemas are still executable contracts. This module owns the one
supported Draft 2020-12 subset and fails closed when a schema starts using a
keyword or reference form that the runtime does not enforce.
"""
from __future__ import annotations

import json
import re
from collections.abc import Mapping
from typing import Any


class JsonSchemaDefinitionError(RuntimeError):
    """Raised when a checked-in schema uses unsupported or invalid constructs."""


class JsonSchemaValidationError(ValueError):
    """Raised when an instance violates an audited JSON Schema."""


_SUPPORTED_KEYWORDS = frozenset(
    {
        "$schema",
        "$id",
        "$defs",
        "$ref",
        "title",
        "description",
        "type",
        "properties",
        "required",
        "additionalProperties",
        "items",
        "oneOf",
        "allOf",
        "enum",
        "const",
        "minLength",
        "maxLength",
        "pattern",
        "minItems",
        "maxItems",
        "uniqueItems",
        "minimum",
        "maximum",
    }
)
_SUPPORTED_TYPES = frozenset({"null", "object", "array", "string", "boolean", "integer", "number"})
_NON_NEGATIVE_INTEGER_KEYWORDS = ("minLength", "maxLength", "minItems", "maxItems")
_NUMBER_KEYWORDS = ("minimum", "maximum")


def _schema_path(parent: str, child: str) -> str:
    return f"{parent}.{child}" if parent else child


def _resolve_ref(root_schema: Mapping[str, Any], reference: str) -> Mapping[str, Any]:
    if not reference.startswith("#/"):
        raise JsonSchemaDefinitionError(f"Unsupported external schema reference: {reference}")
    value: Any = root_schema
    for encoded_part in reference[2:].split("/"):
        part = encoded_part.replace("~1", "/").replace("~0", "~")
        if not isinstance(value, Mapping) or part not in value:
            raise JsonSchemaDefinitionError(f"Broken local schema reference: {reference}")
        value = value[part]
    if not isinstance(value, Mapping):
        raise JsonSchemaDefinitionError(f"Schema reference does not target an object: {reference}")
    return value


def _audit_schema_node(node: Mapping[str, Any], root_schema: Mapping[str, Any], path: str) -> None:
    unsupported = sorted(set(node) - _SUPPORTED_KEYWORDS)
    if unsupported:
        raise JsonSchemaDefinitionError(f"Unsupported JSON Schema keyword at {path}: {', '.join(unsupported)}")

    for annotation in ("$schema", "$id", "title", "description"):
        value = node.get(annotation)
        if value is not None and not isinstance(value, str):
            raise JsonSchemaDefinitionError(f"{annotation} must be a string at {path}")

    definitions = node.get("$defs")
    if definitions is not None:
        if not isinstance(definitions, Mapping):
            raise JsonSchemaDefinitionError(f"$defs must be an object at {path}")
        for name, child in definitions.items():
            if not isinstance(name, str) or not isinstance(child, Mapping):
                raise JsonSchemaDefinitionError(f"Invalid schema definition at {_schema_path(path, '$defs')}")
            _audit_schema_node(child, root_schema, _schema_path(path, f"$defs.{name}"))

    reference = node.get("$ref")
    if reference is not None:
        if not isinstance(reference, str):
            raise JsonSchemaDefinitionError(f"$ref must be a string at {path}")
        _resolve_ref(root_schema, reference)

    schema_type = node.get("type")
    if schema_type is not None:
        schema_types = schema_type if isinstance(schema_type, list) else [schema_type]
        if not schema_types:
            raise JsonSchemaDefinitionError(f"type must not be an empty array at {path}")
        for item in schema_types:
            if not isinstance(item, str) or item not in _SUPPORTED_TYPES:
                raise JsonSchemaDefinitionError(f"Unsupported JSON Schema type at {path}: {item!r}")
        if len(schema_types) != len(set(schema_types)):
            raise JsonSchemaDefinitionError(f"type contains duplicate entries at {path}")

    properties = node.get("properties")
    if properties is not None:
        if not isinstance(properties, Mapping):
            raise JsonSchemaDefinitionError(f"properties must be an object at {path}")
        for name, child in properties.items():
            if not isinstance(name, str) or not isinstance(child, Mapping):
                raise JsonSchemaDefinitionError(f"Invalid property schema at {_schema_path(path, 'properties')}.{name}")
            _audit_schema_node(child, root_schema, _schema_path(path, f"properties.{name}"))

    required = node.get("required")
    if required is not None:
        if not isinstance(required, list) or not all(isinstance(name, str) for name in required):
            raise JsonSchemaDefinitionError(f"required must be an array of strings at {path}")
        if len(required) != len(set(required)):
            raise JsonSchemaDefinitionError(f"required contains duplicate entries at {path}")
        if isinstance(properties, Mapping):
            unknown_required = sorted(set(required) - set(properties))
            if unknown_required:
                raise JsonSchemaDefinitionError(
                    f"required references undeclared properties at {path}: {', '.join(unknown_required)}"
                )

    additional = node.get("additionalProperties")
    if additional is not None and not isinstance(additional, (bool, Mapping)):
        raise JsonSchemaDefinitionError(f"additionalProperties must be boolean or a schema at {path}")
    if isinstance(additional, Mapping):
        _audit_schema_node(additional, root_schema, _schema_path(path, "additionalProperties"))

    items = node.get("items")
    if items is not None:
        if not isinstance(items, Mapping):
            raise JsonSchemaDefinitionError(f"items must be a schema object at {path}")
        _audit_schema_node(items, root_schema, _schema_path(path, "items"))

    for keyword in ("oneOf", "allOf"):
        branches = node.get(keyword)
        if branches is None:
            continue
        if not isinstance(branches, list) or not branches:
            raise JsonSchemaDefinitionError(f"{keyword} must be a non-empty array at {path}")
        for index, branch in enumerate(branches):
            if not isinstance(branch, Mapping):
                raise JsonSchemaDefinitionError(f"Invalid {keyword} branch at {path}.{keyword}[{index}]")
            _audit_schema_node(branch, root_schema, f"{path}.{keyword}[{index}]")

    enum = node.get("enum")
    if enum is not None and (not isinstance(enum, list) or not enum):
        raise JsonSchemaDefinitionError(f"enum must be a non-empty array at {path}")

    for keyword in _NON_NEGATIVE_INTEGER_KEYWORDS:
        value = node.get(keyword)
        if value is not None and (not isinstance(value, int) or isinstance(value, bool) or value < 0):
            raise JsonSchemaDefinitionError(f"{keyword} must be a non-negative integer at {path}")

    minimum = node.get("minimum")
    maximum = node.get("maximum")
    for keyword in _NUMBER_KEYWORDS:
        value = node.get(keyword)
        if value is not None and (not isinstance(value, (int, float)) or isinstance(value, bool)):
            raise JsonSchemaDefinitionError(f"{keyword} must be a number at {path}")
    if minimum is not None and maximum is not None and minimum > maximum:
        raise JsonSchemaDefinitionError(f"minimum must not exceed maximum at {path}")

    unique_items = node.get("uniqueItems")
    if unique_items is not None and not isinstance(unique_items, bool):
        raise JsonSchemaDefinitionError(f"uniqueItems must be boolean at {path}")

    pattern = node.get("pattern")
    if pattern is not None:
        if not isinstance(pattern, str):
            raise JsonSchemaDefinitionError(f"pattern must be a string at {path}")
        try:
            re.compile(pattern)
        except re.error as exc:
            raise JsonSchemaDefinitionError(f"Invalid regex pattern at {path}: {exc}") from exc


def audit_json_schema(schema: Mapping[str, Any]) -> None:
    """Verify that every schema construct is supported and internally valid."""

    _audit_schema_node(schema, schema, "$")


def _matches_type(value: Any, expected: str) -> bool:
    if expected == "null":
        return value is None
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
    raise JsonSchemaDefinitionError(f"Unsupported JSON Schema type: {expected}")


def _display_instance_path(root_label: str, path: tuple[Any, ...]) -> str:
    result = root_label
    for part in path:
        if isinstance(part, int):
            result += f"[{part}]"
        elif isinstance(part, str) and re.fullmatch(r"[A-Za-z_$][A-Za-z0-9_$-]*", part):
            result += f".{part}"
        else:
            result += f"[{part!r}]"
    return result


def _fail(root_label: str, path: tuple[Any, ...], message: str) -> None:
    raise JsonSchemaValidationError(f"{_display_instance_path(root_label, path)}: {message}")


def _validate(
    value: Any,
    schema: Mapping[str, Any],
    root_schema: Mapping[str, Any],
    root_label: str,
    path: tuple[Any, ...],
) -> None:
    reference = schema.get("$ref")
    if isinstance(reference, str):
        _validate(value, _resolve_ref(root_schema, reference), root_schema, root_label, path)

    all_of = schema.get("allOf")
    if isinstance(all_of, list):
        for branch in all_of:
            _validate(value, branch, root_schema, root_label, path)

    one_of = schema.get("oneOf")
    if isinstance(one_of, list):
        failures: list[str] = []
        matches = 0
        for branch in one_of:
            try:
                _validate(value, branch, root_schema, root_label, path)
            except JsonSchemaValidationError as exc:
                failures.append(str(exc))
            else:
                matches += 1
        if matches != 1:
            details = "; ".join(failures[:3])
            suffix = f" ({details})" if details else ""
            _fail(root_label, path, f"must match exactly one oneOf branch{suffix}")

    if "const" in schema and value != schema["const"]:
        _fail(root_label, path, f"must equal {schema['const']!r}")
    enum = schema.get("enum")
    if isinstance(enum, list) and value not in enum:
        _fail(root_label, path, f"must be one of {enum!r}")

    expected_type = schema.get("type")
    if isinstance(expected_type, str):
        if not _matches_type(value, expected_type):
            _fail(root_label, path, f"must be {expected_type}, got {type(value).__name__}")
    elif isinstance(expected_type, list):
        if not any(_matches_type(value, item) for item in expected_type):
            _fail(root_label, path, f"must match one of the allowed types: {expected_type!r}")

    if isinstance(value, Mapping):
        properties = schema.get("properties")
        properties = properties if isinstance(properties, Mapping) else {}
        required = schema.get("required")
        required_names = required if isinstance(required, list) else []
        for name in required_names:
            if name not in value:
                _fail(root_label, (*path, name), "is required")

        additional = schema.get("additionalProperties", True)
        if additional is False:
            extras = sorted(str(name) for name in value if name not in properties)
            if extras:
                _fail(root_label, path, f"contains unsupported properties: {', '.join(extras)}")

        for name, item in value.items():
            child_schema = properties.get(name)
            if isinstance(child_schema, Mapping):
                _validate(item, child_schema, root_schema, root_label, (*path, name))
            elif isinstance(additional, Mapping):
                _validate(item, additional, root_schema, root_label, (*path, name))

    if isinstance(value, list):
        minimum_items = schema.get("minItems")
        maximum_items = schema.get("maxItems")
        if isinstance(minimum_items, int) and len(value) < minimum_items:
            _fail(root_label, path, f"must contain at least {minimum_items} item(s)")
        if isinstance(maximum_items, int) and len(value) > maximum_items:
            _fail(root_label, path, f"must contain at most {maximum_items} item(s)")
        item_schema = schema.get("items")
        if isinstance(item_schema, Mapping):
            for index, item in enumerate(value):
                _validate(item, item_schema, root_schema, root_label, (*path, index))
        if schema.get("uniqueItems") is True:
            serialized = [json.dumps(item, ensure_ascii=False, sort_keys=True) for item in value]
            if len(serialized) != len(set(serialized)):
                _fail(root_label, path, "must contain unique items")

    if isinstance(value, str):
        minimum_length = schema.get("minLength")
        maximum_length = schema.get("maxLength")
        if isinstance(minimum_length, int) and len(value) < minimum_length:
            _fail(root_label, path, f"must contain at least {minimum_length} character(s)")
        if isinstance(maximum_length, int) and len(value) > maximum_length:
            _fail(root_label, path, f"must contain at most {maximum_length} character(s)")
        pattern = schema.get("pattern")
        if isinstance(pattern, str) and re.search(pattern, value) is None:
            _fail(root_label, path, f"does not match required pattern {pattern!r}")

    if isinstance(value, (int, float)) and not isinstance(value, bool):
        minimum = schema.get("minimum")
        maximum = schema.get("maximum")
        if isinstance(minimum, (int, float)) and value < minimum:
            _fail(root_label, path, f"must be at least {minimum}")
        if isinstance(maximum, (int, float)) and value > maximum:
            _fail(root_label, path, f"must be at most {maximum}")


def validate_json_schema(
    value: Any,
    schema: Mapping[str, Any],
    *,
    root_schema: Mapping[str, Any] | None = None,
    root_label: str = "$",
) -> None:
    """Validate one value against an already-audited schema node."""

    canonical_root = root_schema if root_schema is not None else schema
    _validate(value, schema, canonical_root, root_label, ())
