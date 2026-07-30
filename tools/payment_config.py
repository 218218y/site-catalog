#!/usr/bin/env python3
"""Validated public configuration for the hosted payment handoff page.

The configuration intentionally contains no API keys or merchant secrets. It is
rendered into data attributes on ``payment.html`` so the browser can hand the
customer off to a hosted Grow/Morning payment page without exposing privileged
credentials in the static site.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Mapping
from urllib.parse import urlparse

PAYMENT_CONFIG_RELATIVE_PATH = "payment.config.json"
_QUERY_PARAMETER_RE = re.compile(r"^[A-Za-z0-9_.\[\]-]{1,80}$")


def _required_text(payload: Mapping[str, Any], field: str, *, max_length: int) -> str:
    value = payload.get(field)
    if not isinstance(value, str):
        raise ValueError(f"Payment config field {field} must be text")
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"Payment config field {field} cannot be empty")
    if "\n" in normalized or "\r" in normalized:
        raise ValueError(f"Payment config field {field} must be a single line")
    if len(normalized) > max_length:
        raise ValueError(f"Payment config field {field} is longer than {max_length} characters")
    return normalized


def _optional_text(payload: Mapping[str, Any], field: str, *, max_length: int) -> str:
    value = payload.get(field)
    if not isinstance(value, str):
        raise ValueError(f"Payment config field {field} must be text")
    normalized = value.strip()
    if "\n" in normalized or "\r" in normalized:
        raise ValueError(f"Payment config field {field} must be a single line")
    if len(normalized) > max_length:
        raise ValueError(f"Payment config field {field} is longer than {max_length} characters")
    return normalized


def _validate_payment_url(value: str, *, enabled: bool) -> str:
    if not value:
        if enabled:
            raise ValueError("Enabled payment config requires a paymentUrl")
        return ""

    parsed = urlparse(value)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("paymentUrl must be an absolute HTTPS URL")
    if parsed.username or parsed.password:
        raise ValueError("paymentUrl must not contain embedded credentials")
    if parsed.fragment:
        raise ValueError("paymentUrl must not contain a URL fragment")
    return value


def _validate_query_parameter(value: str, field: str) -> str:
    if value and not _QUERY_PARAMETER_RE.fullmatch(value):
        raise ValueError(
            f"Payment config field {field} must be blank or a simple query-parameter name"
        )
    return value


def validate_payment_config(value: Any) -> dict[str, Any]:
    if not isinstance(value, Mapping):
        raise ValueError("payment config must be a JSON object")

    expected = {
        "enabled",
        "providerName",
        "paymentUrl",
        "openInNewTab",
        "customerNameQueryParameter",
        "orderNumberQueryParameter",
    }
    actual = {str(key) for key in value}
    missing = sorted(expected - actual)
    unknown = sorted(actual - expected)
    if missing:
        raise ValueError(f"Payment config is missing fields: {', '.join(missing)}")
    if unknown:
        raise ValueError(f"Payment config has unknown fields: {', '.join(unknown)}")

    enabled = value["enabled"]
    open_in_new_tab = value["openInNewTab"]
    if not isinstance(enabled, bool):
        raise ValueError("Payment config field enabled must be boolean")
    if not isinstance(open_in_new_tab, bool):
        raise ValueError("Payment config field openInNewTab must be boolean")

    provider_name = _required_text(value, "providerName", max_length=80)
    payment_url = _validate_payment_url(
        _optional_text(value, "paymentUrl", max_length=2048),
        enabled=enabled,
    )
    customer_name_parameter = _validate_query_parameter(
        _optional_text(value, "customerNameQueryParameter", max_length=80),
        "customerNameQueryParameter",
    )
    order_number_parameter = _validate_query_parameter(
        _optional_text(value, "orderNumberQueryParameter", max_length=80),
        "orderNumberQueryParameter",
    )

    return {
        "enabled": enabled,
        "providerName": provider_name,
        "paymentUrl": payment_url,
        "openInNewTab": open_in_new_tab,
        "customerNameQueryParameter": customer_name_parameter,
        "orderNumberQueryParameter": order_number_parameter,
    }


def read_payment_config(root: Path) -> dict[str, Any]:
    path = root / PAYMENT_CONFIG_RELATIVE_PATH
    if not path.is_file():
        raise FileNotFoundError(f"Required payment config is missing: {PAYMENT_CONFIG_RELATIVE_PATH}")
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {PAYMENT_CONFIG_RELATIVE_PATH}: {exc}") from exc
    return validate_payment_config(payload)
