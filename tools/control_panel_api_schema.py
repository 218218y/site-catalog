#!/usr/bin/env python3
"""Canonical control-panel API schema loading backed by the shared validator."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Mapping, Sequence

try:
    from tools.json_schema import JsonSchemaDefinitionError, JsonSchemaValidationError, audit_json_schema, validate_json_schema
except ModuleNotFoundError:  # Direct execution from tools/
    from json_schema import JsonSchemaDefinitionError, JsonSchemaValidationError, audit_json_schema, validate_json_schema

PROJECT_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = PROJECT_ROOT / "schemas" / "control-panel-api.schema.json"


class ControlPanelSchemaError(ValueError):
    """Raised when a control-panel request or response violates the contract."""


@lru_cache(maxsize=1)
def load_control_panel_schema() -> dict[str, Any]:
    try:
        payload = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Could not parse control-panel schema {SCHEMA_PATH}: {exc}") from exc
    if not isinstance(payload, dict):
        raise RuntimeError(f"Invalid control-panel schema: {SCHEMA_PATH}")
    try:
        audit_json_schema(payload)
    except JsonSchemaDefinitionError as exc:
        raise RuntimeError(f"Invalid control-panel schema {SCHEMA_PATH}: {exc}") from exc
    definitions = payload.get("$defs")
    if not isinstance(definitions, dict) or not definitions:
        raise RuntimeError("Control-panel schema must define a non-empty $defs object")
    return payload


def schema_definition(name: str) -> Mapping[str, Any]:
    definition = load_control_panel_schema()["$defs"].get(name)
    if not isinstance(definition, dict):
        raise KeyError(f"Unknown control-panel schema definition: {name}")
    return definition


def validate_control_panel_payload(name: str, payload: Any) -> None:
    """Validate one named request/response payload against the canonical schema."""

    schema = load_control_panel_schema()
    definition = schema_definition(name)
    try:
        validate_json_schema(payload, definition, root_schema=schema, root_label=name)
    except JsonSchemaValidationError as exc:
        raise ControlPanelSchemaError(str(exc)) from exc


def validate_many(name: str, payloads: Sequence[Any]) -> None:
    for index, payload in enumerate(payloads):
        try:
            validate_control_panel_payload(name, payload)
        except ControlPanelSchemaError as exc:
            raise ControlPanelSchemaError(f"{name}[{index}]: {exc}") from exc
