#!/usr/bin/env python3
"""Track which generated catalog image release completed an R2 sync.

The state is deliberately local and is never deployed.  It closes the unsafe
window where newly generated cache-busted URLs could be built into the site
before their image objects had finished uploading to R2.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
from pathlib import Path
from typing import Any, Iterable

STATE_FILE = ".r2-catalog-sync-state.json"
CATALOGS_FILE = "catalogs.generated.json"
STATE_SCHEMA_VERSION = 1


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _catalog_release_record(catalog: dict[str, Any]) -> dict[str, Any]:
    variants = catalog.get("imageVariants") if isinstance(catalog.get("imageVariants"), dict) else {}
    normalized_variants: dict[str, dict[str, Any]] = {}
    for tier in ("thumb", "medium", "full"):
        raw = variants.get(tier) if isinstance(variants.get(tier), dict) else {}
        normalized_variants[tier] = {
            "directory": str(raw.get("directory") or "").strip().strip("/"),
            "maxSide": int(raw.get("maxSide") or 0),
            "version": str(raw.get("version") or "").strip(),
        }
    return {
        "id": str(catalog.get("id") or "").strip(),
        "dir": str(catalog.get("dir") or "").strip().strip("/"),
        "pages": int(catalog.get("pages") or 0),
        "imageExt": str(catalog.get("imageExt") or "webp").strip().lstrip(".") or "webp",
        "assetVersion": str(catalog.get("assetVersion") or "").strip(),
        "imageVariants": normalized_variants,
    }


def catalog_release_records(catalogs: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    records = [_catalog_release_record(item) for item in catalogs if isinstance(item, dict)]
    records.sort(key=lambda item: item["id"])
    return records


def catalog_release_signature(catalogs: Iterable[dict[str, Any]]) -> str:
    payload = json.dumps(
        catalog_release_records(catalogs),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def load_generated_catalogs(root: Path | None = None) -> list[dict[str, Any]]:
    base = (root or project_root()).resolve()
    path = base / CATALOGS_FILE
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, list) or not payload:
        raise ValueError(f"{CATALOGS_FILE} must contain a non-empty JSON array")
    return [item for item in payload if isinstance(item, dict)]


def state_path(root: Path | None = None) -> Path:
    return (root or project_root()).resolve() / STATE_FILE


def write_sync_state(
    *,
    root: Path | None = None,
    bucket: str,
    prefix: str,
    public_url: str,
) -> Path:
    base = (root or project_root()).resolve()
    catalogs = load_generated_catalogs(base)
    payload = {
        "schemaVersion": STATE_SCHEMA_VERSION,
        "syncedAtUtc": dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat(),
        "bucket": str(bucket or "").strip(),
        "prefix": str(prefix or "").strip().strip("/"),
        "publicUrl": str(public_url or "").strip().rstrip("/"),
        "catalogReleaseSignature": catalog_release_signature(catalogs),
        "catalogCount": len(catalogs),
    }
    path = state_path(base)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def load_sync_state(root: Path | None = None) -> dict[str, Any]:
    path = state_path(root)
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError as exc:
        raise FileNotFoundError(
            f"R2 image sync state is missing: {path.name}. Run .07-sync-r2-images.bat before building or publishing."
        ) from exc
    if not isinstance(payload, dict) or int(payload.get("schemaVersion") or 0) != STATE_SCHEMA_VERSION:
        raise ValueError(f"R2 image sync state is invalid or unsupported: {path.name}")
    return payload


def verify_sync_state(root: Path | None = None) -> dict[str, Any]:
    base = (root or project_root()).resolve()
    state = load_sync_state(base)
    catalogs = load_generated_catalogs(base)
    expected = catalog_release_signature(catalogs)
    actual = str(state.get("catalogReleaseSignature") or "").strip()
    if not actual or actual != expected:
        raise RuntimeError(
            "Generated catalog image metadata changed after the last completed R2 sync. "
            "Run .07-sync-r2-images.bat before building or publishing the site."
        )
    return state
