#!/usr/bin/env python3
"""Typed HTTP boundary for the local catalog control panel."""
from __future__ import annotations

import json
import sys
from dataclasses import dataclass
from http import HTTPStatus
from pathlib import Path
from typing import Protocol, cast

TOOLS_DIR = Path(__file__).resolve().parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from control_panel_api_schema import ControlPanelSchemaError, validate_control_panel_payload

API_VERSION = 1
MAX_JSON_BODY_BYTES = 1_000_000
MAX_PDF_UPLOAD_BYTES = 160 * 1024 * 1024


class HeaderReader(Protocol):
    def get(self, name: str, default: str | None = None) -> str | None: ...


class BinaryReader(Protocol):
    def read(self, size: int = -1) -> bytes: ...


class RequestBodyReader(Protocol):
    headers: HeaderReader
    rfile: BinaryReader


class ApiRequestError(ValueError):
    def __init__(self, status: HTTPStatus, message: str) -> None:
        super().__init__(message)
        self.status = status


def validate_request_payload(name: str, payload: dict[str, object]) -> None:
    try:
        validate_control_panel_payload(name, payload)
    except ControlPanelSchemaError as exc:
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, str(exc)) from exc


def content_length(handler: RequestBodyReader, *, maximum: int) -> int:
    raw = str(handler.headers.get("Content-Length", "0") or "0").strip()
    try:
        length = int(raw)
    except ValueError as exc:
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, "Invalid Content-Length") from exc
    if length < 0:
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, "Invalid Content-Length")
    if length > maximum:
        raise ApiRequestError(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "Request body is too large")
    return length


def read_json_object(handler: RequestBodyReader) -> dict[str, object]:
    content_type = str(handler.headers.get("Content-Type", "") or "").lower()
    if not content_type.startswith("application/json"):
        raise ApiRequestError(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "Content-Type must be application/json")
    length = content_length(handler, maximum=MAX_JSON_BODY_BYTES)
    if length == 0:
        return {}
    raw = handler.rfile.read(length)
    if len(raw) != length:
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, "Request body ended before Content-Length")
    try:
        payload = json.loads(raw.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, "Invalid JSON body") from exc
    if not isinstance(payload, dict):
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, "JSON body must be an object")
    return cast(dict[str, object], payload)


def _require_list(payload: dict[str, object], key: str) -> list[object]:
    value = payload.get(key)
    if not isinstance(value, list):
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, f"{key} must be an array")
    return cast(list[object], value)


def _require_object(payload: dict[str, object], key: str) -> dict[str, object]:
    value = payload.get(key)
    if not isinstance(value, dict):
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, f"{key} must be an object")
    return cast(dict[str, object], value)


@dataclass(frozen=True)
class CatalogSaveRequest:
    catalogs: list[object]
    taxonomy: dict[str, object]
    asset_deletes: list[object]

    @classmethod
    def parse(cls, payload: dict[str, object]) -> "CatalogSaveRequest":
        catalogs = _require_list(payload, "catalogs")
        taxonomy = _require_object(payload, "taxonomy")
        deletes = payload.get("assetDeletes", [])
        if not isinstance(deletes, list):
            raise ApiRequestError(HTTPStatus.BAD_REQUEST, "assetDeletes must be an array")
        normalized = dict(payload)
        normalized["assetDeletes"] = deletes
        validate_request_payload("CatalogSaveRequestDto", normalized)
        return cls(catalogs=catalogs, taxonomy=taxonomy, asset_deletes=deletes)


@dataclass(frozen=True)
class TaxonomySaveRequest:
    taxonomy: dict[str, object]

    @classmethod
    def parse(cls, payload: dict[str, object]) -> "TaxonomySaveRequest":
        taxonomy = _require_object(payload, "taxonomy")
        validate_request_payload("TaxonomySaveRequestDto", payload)
        return cls(taxonomy=taxonomy)


@dataclass(frozen=True)
class FooterSaveRequest:
    footer: dict[str, object]

    @classmethod
    def parse(cls, payload: dict[str, object]) -> "FooterSaveRequest":
        footer = _require_object(payload, "footer")
        validate_request_payload("FooterSaveRequestDto", payload)
        return cls(footer=footer)


@dataclass(frozen=True)
class RunActionRequest:
    action: str
    prune_missing_pdfs: bool
    confirmed_missing_pdf_ids: tuple[str, ...]

    @classmethod
    def parse(cls, payload: dict[str, object]) -> "RunActionRequest":
        action = payload.get("action")
        if not isinstance(action, str) or not action.strip():
            raise ApiRequestError(HTTPStatus.BAD_REQUEST, "action must be a non-empty string")
        prune = payload.get("pruneMissingPdfs", False)
        if not isinstance(prune, bool):
            raise ApiRequestError(HTTPStatus.BAD_REQUEST, "pruneMissingPdfs must be a boolean")
        raw_confirmed = payload.get("confirmedMissingPdfIds", [])
        if not isinstance(raw_confirmed, list) or not all(isinstance(item, str) for item in raw_confirmed):
            raise ApiRequestError(HTTPStatus.BAD_REQUEST, "confirmedMissingPdfIds must be an array of strings")
        confirmed = tuple(sorted({item.strip() for item in raw_confirmed if item.strip()}))
        if confirmed and not prune:
            raise ApiRequestError(
                HTTPStatus.BAD_REQUEST,
                "confirmedMissingPdfIds requires pruneMissingPdfs=true",
            )
        normalized = dict(payload)
        normalized["action"] = action.strip()
        normalized["pruneMissingPdfs"] = prune
        normalized["confirmedMissingPdfIds"] = list(confirmed)
        validate_request_payload("RunActionRequestDto", normalized)
        return cls(action=action.strip(), prune_missing_pdfs=prune, confirmed_missing_pdf_ids=confirmed)
