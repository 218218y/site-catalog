from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools import json_schema as SCHEMA

ROOT = Path(__file__).resolve().parents[1]


def test_every_checked_in_schema_is_fully_supported_by_the_runtime() -> None:
    for path in sorted((ROOT / "schemas").glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
        assert isinstance(payload, dict)
        SCHEMA.audit_json_schema(payload)


def test_schema_audit_fails_closed_on_unknown_keywords_and_broken_references() -> None:
    unsupported = {"type": "object", "anyOf": [{"type": "object"}]}
    with pytest.raises(SCHEMA.JsonSchemaDefinitionError, match="Unsupported JSON Schema keyword"):
        SCHEMA.audit_json_schema(unsupported)

    broken_ref = {"$defs": {"known": {"type": "string"}}, "$ref": "#/$defs/missing"}
    with pytest.raises(SCHEMA.JsonSchemaDefinitionError, match="Broken local schema reference"):
        SCHEMA.audit_json_schema(broken_ref)


def test_schema_audit_rejects_malformed_supported_keywords() -> None:
    invalid_schemas = [
        ({"type": []}, "type must not be an empty array"),
        ({"type": "string", "minLength": -1}, "minLength must be a non-negative integer"),
        ({"type": "array", "uniqueItems": "yes"}, "uniqueItems must be boolean"),
        ({"type": "number", "minimum": 2, "maximum": 1}, "minimum must not exceed maximum"),
        ({"type": "object", "properties": {"x": {"type": "string"}}, "required": ["typo"]}, "undeclared"),
    ]
    for schema, message in invalid_schemas:
        with pytest.raises(SCHEMA.JsonSchemaDefinitionError, match=message):
            SCHEMA.audit_json_schema(schema)


def _assert_invalid(schema: dict[str, object], value: object, message: str) -> None:
    SCHEMA.audit_json_schema(schema)
    with pytest.raises(SCHEMA.JsonSchemaValidationError, match=message):
        SCHEMA.validate_json_schema(value, schema)


def test_runtime_enforces_the_complete_supported_constraint_set() -> None:
    _assert_invalid({"type": "integer"}, True, "must be integer")
    _assert_invalid({"const": "ok"}, "wrong", "must equal")
    _assert_invalid({"enum": ["a", "b"]}, "c", "must be one of")
    _assert_invalid({"type": "string", "minLength": 2}, "x", "at least 2 character")
    _assert_invalid({"type": "string", "maxLength": 2}, "xxx", "at most 2 character")
    _assert_invalid({"type": "string", "pattern": "^a+$"}, "bbb", "required pattern")
    _assert_invalid({"type": "array", "minItems": 2}, [1], "at least 2 item")
    _assert_invalid({"type": "array", "maxItems": 1}, [1, 2], "at most 1 item")
    _assert_invalid({"type": "array", "uniqueItems": True}, [1, 1], "unique items")
    _assert_invalid({"type": "array", "items": {"type": "integer"}}, [1, "2"], "must be integer")
    _assert_invalid({"type": "number", "minimum": 1}, 0, "at least 1")
    _assert_invalid({"type": "number", "maximum": 1}, 2, "at most 1")


def test_object_contracts_enforce_required_declared_and_dynamic_properties() -> None:
    schema = {
        "type": "object",
        "properties": {"fixed": {"type": "string"}},
        "required": ["fixed"],
        "additionalProperties": {"type": "integer", "minimum": 0},
    }
    SCHEMA.audit_json_schema(schema)
    SCHEMA.validate_json_schema({"fixed": "ok", "dynamic": 1}, schema)

    with pytest.raises(SCHEMA.JsonSchemaValidationError, match=r"fixed: is required"):
        SCHEMA.validate_json_schema({"dynamic": 1}, schema)
    with pytest.raises(SCHEMA.JsonSchemaValidationError, match=r"dynamic: must be integer"):
        SCHEMA.validate_json_schema({"fixed": "ok", "dynamic": "1"}, schema)

    closed = {"type": "object", "properties": {}, "additionalProperties": False}
    SCHEMA.audit_json_schema(closed)
    with pytest.raises(SCHEMA.JsonSchemaValidationError, match=r"extra: is not allowed"):
        SCHEMA.validate_json_schema({"extra": True}, closed)


def test_refs_allof_and_oneof_share_the_same_root_contract() -> None:
    schema = {
        "$defs": {
            "slug": {"type": "string", "pattern": "^[a-z]+$"},
            "positive": {"type": "integer", "minimum": 1},
        },
        "type": "object",
        "additionalProperties": False,
        "required": ["slug", "value"],
        "properties": {
            "slug": {"$ref": "#/$defs/slug"},
            "value": {
                "allOf": [{"$ref": "#/$defs/positive"}, {"maximum": 10}],
                "oneOf": [{"const": 2}, {"const": 4}],
            },
        },
    }
    SCHEMA.audit_json_schema(schema)
    SCHEMA.validate_json_schema({"slug": "valid", "value": 4}, schema)

    with pytest.raises(SCHEMA.JsonSchemaValidationError, match="required pattern"):
        SCHEMA.validate_json_schema({"slug": "INVALID", "value": 4}, schema)
    with pytest.raises(SCHEMA.JsonSchemaValidationError, match="exactly one oneOf branch"):
        SCHEMA.validate_json_schema({"slug": "valid", "value": 6}, schema)
    with pytest.raises(SCHEMA.JsonSchemaValidationError, match="at most 10"):
        SCHEMA.validate_json_schema({"slug": "valid", "value": 12}, schema)
