from __future__ import annotations

import copy
import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))


def load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, TOOLS / filename)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


SCHEMA = load_module("control_panel_api_schema_contract_tests", "control_panel_api_schema.py")
GENERATOR = load_module("generate_control_panel_api_types_contract_tests", "generate_control_panel_api_types.py")
API = load_module("catalog_control_api_schema_contract_tests", "catalog_control_api.py")
SERVER = load_module("catalog_control_server_schema_contract_tests", "catalog_control_server.py")


def test_generated_browser_dtos_are_exactly_current() -> None:
    assert GENERATOR.OUTPUT_PATH.read_text(encoding="utf-8") == GENERATOR.render_types()


def test_live_state_payload_satisfies_the_canonical_response_contract() -> None:
    payload = SERVER.state_payload()
    SCHEMA.validate_control_panel_payload("ControlPanelStateDto", payload)


def test_response_contract_rejects_missing_and_unknown_fields() -> None:
    payload = SERVER.state_payload()

    missing = copy.deepcopy(payload)
    del missing["counts"]
    with pytest.raises(SCHEMA.ControlPanelSchemaError, match=r"ControlPanelStateDto\.counts: is required"):
        SCHEMA.validate_control_panel_payload("ControlPanelStateDto", missing)

    unknown = copy.deepcopy(payload)
    unknown["silentContractDrift"] = True
    with pytest.raises(SCHEMA.ControlPanelSchemaError, match=r"contains unsupported properties: silentContractDrift"):
        SCHEMA.validate_control_panel_payload("ControlPanelStateDto", unknown)


def test_request_parser_rejects_fields_not_declared_by_the_schema() -> None:
    with pytest.raises(API.ApiRequestError, match=r"contains unsupported properties: unexpected"):
        API.FooterSaveRequest.parse({"footer": {"businessName": "Test"}, "unexpected": True})

    with pytest.raises(API.ApiRequestError, match=r"contains unsupported properties: unexpected"):
        API.RunActionRequest.parse({"action": "convert", "unexpected": True})


def test_named_contract_lookup_fails_closed() -> None:
    with pytest.raises(KeyError, match="Unknown control-panel schema definition"):
        SCHEMA.validate_control_panel_payload("MissingDto", {})


def test_response_contract_failure_is_an_internal_server_error_boundary() -> None:
    handler = object.__new__(SERVER.ControlHandler)
    with pytest.raises(RuntimeError, match="Control-panel response violates ErrorResponseDto"):
        handler.send_contract_json("ErrorResponseDto", {"ok": True, "error": "wrong const"})
