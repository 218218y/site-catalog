from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location("payment_config_under_test", TOOLS / "payment_config.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def valid_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "enabled": False,
        "providerName": "Grow באמצעות Morning",
        "paymentUrl": "",
        "openInNewTab": True,
        "customerNameQueryParameter": "",
        "orderNumberQueryParameter": "",
    }
    payload.update(overrides)
    return payload


def test_repository_payment_config_is_valid_and_safe_by_default() -> None:
    config = MODULE.read_payment_config(ROOT)
    assert config == valid_payload()
    assert config["enabled"] is False
    assert config["paymentUrl"] == ""


def test_enabled_payment_requires_an_absolute_https_url() -> None:
    with pytest.raises(ValueError, match="requires a paymentUrl"):
        MODULE.validate_payment_config(valid_payload(enabled=True))

    with pytest.raises(ValueError, match="absolute HTTPS"):
        MODULE.validate_payment_config(valid_payload(enabled=True, paymentUrl="http://payments.example.test"))

    with pytest.raises(ValueError, match="absolute HTTPS"):
        MODULE.validate_payment_config(valid_payload(enabled=True, paymentUrl="/relative-payment"))


def test_payment_url_rejects_credentials_and_fragments() -> None:
    with pytest.raises(ValueError, match="embedded credentials"):
        MODULE.validate_payment_config(
            valid_payload(enabled=True, paymentUrl="https://merchant:secret@example.test/pay")
        )

    with pytest.raises(ValueError, match="URL fragment"):
        MODULE.validate_payment_config(
            valid_payload(enabled=True, paymentUrl="https://example.test/pay#unsafe-fragment")
        )


def test_valid_hosted_payment_config_preserves_only_public_values() -> None:
    config = MODULE.validate_payment_config(
        valid_payload(
            enabled=True,
            paymentUrl="https://payments.example.test/open-amount?merchant=123",
            customerNameQueryParameter="customer_name",
            orderNumberQueryParameter="metadata[order_number]",
        )
    )

    assert config["enabled"] is True
    assert config["paymentUrl"] == "https://payments.example.test/open-amount?merchant=123"
    assert config["customerNameQueryParameter"] == "customer_name"
    assert config["orderNumberQueryParameter"] == "metadata[order_number]"


def test_query_parameter_names_and_schema_are_strict() -> None:
    with pytest.raises(ValueError, match="simple query-parameter name"):
        MODULE.validate_payment_config(valid_payload(orderNumberQueryParameter="order number&admin=true"))

    with pytest.raises(ValueError, match="unknown fields"):
        MODULE.validate_payment_config({**valid_payload(), "apiKey": "must-never-be-public"})

    with pytest.raises(ValueError, match="missing fields"):
        payload = valid_payload()
        payload.pop("providerName")
        MODULE.validate_payment_config(payload)


def test_read_payment_config_reports_invalid_json(tmp_path: Path) -> None:
    (tmp_path / "payment.config.json").write_text("{not json}", encoding="utf-8")
    with pytest.raises(ValueError, match="Invalid JSON"):
        MODULE.read_payment_config(tmp_path)


def test_read_payment_config_normalizes_utf8_bom(tmp_path: Path) -> None:
    (tmp_path / "payment.config.json").write_text(
        "\ufeff" + json.dumps(valid_payload(), ensure_ascii=False),
        encoding="utf-8",
    )
    assert MODULE.read_payment_config(tmp_path) == valid_payload()
