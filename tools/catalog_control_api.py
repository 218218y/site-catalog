#!/usr/bin/env python3
"""Typed HTTP boundary for the local catalog control panel."""
from __future__ import annotations

import json
from dataclasses import dataclass
from http import HTTPStatus
from typing import Any, Protocol

API_VERSION = 1
MAX_JSON_BODY_BYTES = 1_000_000
MAX_PDF_UPLOAD_BYTES = 160 * 1024 * 1024


class RequestBodyReader(Protocol):
    headers: Any
    rfile: Any


class ApiRequestError(ValueError):
    def __init__(self, status: HTTPStatus, message: str) -> None:
        super().__init__(message)
        self.status = status


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


def read_json_object(handler: RequestBodyReader) -> dict[str, Any]:
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
    return payload


def _require_list(payload: dict[str, Any], key: str) -> list[Any]:
    value = payload.get(key)
    if not isinstance(value, list):
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, f"{key} must be an array")
    return value


def _require_object(payload: dict[str, Any], key: str) -> dict[str, Any]:
    value = payload.get(key)
    if not isinstance(value, dict):
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, f"{key} must be an object")
    return value


@dataclass(frozen=True)
class CatalogSaveRequest:
    catalogs: list[Any]
    taxonomy: dict[str, Any]
    asset_deletes: list[Any]

    @classmethod
    def parse(cls, payload: dict[str, Any]) -> "CatalogSaveRequest":
        deletes = payload.get("assetDeletes", [])
        if not isinstance(deletes, list):
            raise ApiRequestError(HTTPStatus.BAD_REQUEST, "assetDeletes must be an array")
        return cls(
            catalogs=_require_list(payload, "catalogs"),
            taxonomy=_require_object(payload, "taxonomy"),
            asset_deletes=deletes,
        )


@dataclass(frozen=True)
class TaxonomySaveRequest:
    taxonomy: dict[str, Any]

    @classmethod
    def parse(cls, payload: dict[str, Any]) -> "TaxonomySaveRequest":
        return cls(taxonomy=_require_object(payload, "taxonomy"))


@dataclass(frozen=True)
class FooterSaveRequest:
    footer: dict[str, Any]

    @classmethod
    def parse(cls, payload: dict[str, Any]) -> "FooterSaveRequest":
        return cls(footer=_require_object(payload, "footer"))


@dataclass(frozen=True)
class RunActionRequest:
    action: str
    prune_missing_pdfs: bool
    confirmed_missing_pdf_ids: tuple[str, ...]

    @classmethod
    def parse(cls, payload: dict[str, Any]) -> "RunActionRequest":
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
        return cls(action=action.strip(), prune_missing_pdfs=prune, confirmed_missing_pdf_ids=confirmed)
