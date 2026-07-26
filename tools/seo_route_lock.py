#!/usr/bin/env python3
"""Freeze public catalog/category route identities before search launch.

The lock is intentionally separate from generated pages. Public builds must match
it exactly so a renamed catalog id or taxonomy slug cannot silently move an
already-published URL. New catalog/category routes may be appended automatically
from the control-panel sources; destructive route changes still require explicit
review and a confirmed full lock update.
"""
from __future__ import annotations

import argparse
import json
import os
import uuid
from pathlib import Path
from typing import Any, Mapping, Sequence

from build_site_pages import read_catalogs
from seo_site import (
    CATALOG_ID_RE,
    Taxonomy,
    catalog_path,
    category_path,
    load_seo_config,
    load_taxonomy,
    subcategory_path,
)

LOCK_FILENAME = "seo-routes.lock.json"
LOCK_SCHEMA = 1
_ROUTE_GROUPS = (
    ("catalogs", ("id",), "catalog id"),
    ("categories", ("name",), "category"),
    ("subcategories", ("category", "name"), "subcategory"),
)


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _route_snapshot(root: Path, catalogs: Sequence[Mapping[str, Any]], taxonomy: Taxonomy) -> dict[str, Any]:
    config = load_seo_config(root)
    return {
        "schema": LOCK_SCHEMA,
        "siteUrl": config.site_url,
        "catalogs": [
            {
                "id": str(item.get("id", "")).strip(),
                "route": f"/{catalog_path(str(item.get('id', '')).strip())}",
            }
            for item in sorted(catalogs, key=lambda entry: str(entry.get("id", "")))
        ],
        "categories": [
            {
                "name": item.name,
                "slug": item.slug,
                "route": f"/{category_path(item)}",
            }
            for item in sorted(taxonomy.categories, key=lambda entry: entry.slug)
        ],
        "subcategories": [
            {
                "category": item.category,
                "name": item.name,
                "slug": item.slug,
                "route": f"/{subcategory_path(taxonomy.category_by_name(item.category), item)}",
            }
            for item in sorted(
                taxonomy.subcategories,
                key=lambda entry: (entry.category, entry.slug),
            )
        ],
    }


def route_snapshot(root: Path) -> dict[str, Any]:
    """Return the routes that the currently generated public site can expose."""

    return _route_snapshot(root, read_catalogs(root), load_taxonomy(root))


def read_configured_catalogs(root: Path) -> list[dict[str, Any]]:
    """Read route identities directly from the control-panel catalog source."""

    path = root / "catalogs.config.json"
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError as exc:
        raise FileNotFoundError("Required catalog source is missing: catalogs.config.json") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Could not parse catalogs.config.json: {exc}") from exc
    if not isinstance(payload, list) or not payload:
        raise ValueError("catalogs.config.json must contain at least one catalog")

    catalogs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for index, item in enumerate(payload, start=1):
        if not isinstance(item, dict):
            raise ValueError(f"catalogs.config.json item #{index} must be an object")
        catalog_id = str(item.get("id", "")).strip()
        if not CATALOG_ID_RE.fullmatch(catalog_id):
            raise ValueError(f"catalogs.config.json item #{index} has invalid id: {catalog_id or '<empty>'}")
        if catalog_id in seen:
            raise ValueError(f"catalogs.config.json contains duplicate id: {catalog_id}")
        seen.add(catalog_id)
        catalogs.append(dict(item))
    return catalogs


def configured_route_snapshot(root: Path) -> dict[str, Any]:
    """Return intended routes before PDF conversion/generated metadata catches up."""

    return _route_snapshot(root, read_configured_catalogs(root), load_taxonomy(root))


def read_lock(root: Path) -> dict[str, Any]:
    path = root / LOCK_FILENAME
    if not path.is_file():
        raise FileNotFoundError(
            f"Missing {LOCK_FILENAME}. Run `npm run seo:routes:update -- --confirm-route-lock-update` "
            "after reviewing the intended public URLs."
        )
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except json.JSONDecodeError as exc:
        raise ValueError(f"Could not parse {LOCK_FILENAME}: {exc}") from exc
    if not isinstance(payload, dict) or payload.get("schema") != LOCK_SCHEMA:
        raise ValueError(f"{LOCK_FILENAME} must use schema {LOCK_SCHEMA}")
    return payload


def _indexed(items: object, keys: tuple[str, ...]) -> dict[tuple[str, ...], Mapping[str, Any]]:
    result: dict[tuple[str, ...], Mapping[str, Any]] = {}
    if not isinstance(items, list):
        return result
    for item in items:
        if not isinstance(item, dict):
            continue
        key = tuple(str(item.get(name, "")) for name in keys)
        result[key] = item
    return result


def snapshot_differences(expected: Mapping[str, Any], current: Mapping[str, Any]) -> list[str]:
    differences: list[str] = []
    if expected.get("siteUrl") != current.get("siteUrl"):
        differences.append(
            f"site URL changed: {expected.get('siteUrl')!r} -> {current.get('siteUrl')!r}"
        )

    for field, keys, label in _ROUTE_GROUPS:
        locked = _indexed(expected.get(field), keys)
        live = _indexed(current.get(field), keys)
        for key in sorted(set(locked) - set(live)):
            differences.append(f"removed {label}: {' / '.join(key)}")
        for key in sorted(set(live) - set(locked)):
            differences.append(f"new {label} is not locked: {' / '.join(key)}")
        for key in sorted(set(locked) & set(live)):
            locked_item = locked[key]
            live_item = live[key]
            if locked_item != live_item:
                differences.append(
                    f"changed {label} {' / '.join(key)}: "
                    f"{json.dumps(locked_item, ensure_ascii=False, sort_keys=True)} -> "
                    f"{json.dumps(live_item, ensure_ascii=False, sort_keys=True)}"
                )
    return differences


def _atomic_write_lock(path: Path, payload: Mapping[str, Any]) -> None:
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        temporary.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=False) + "\n",
            encoding="utf-8",
            newline="\n",
        )
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def append_new_configured_routes_to_lock(root: Path) -> dict[str, list[str]]:
    """Append only brand-new configured routes to an existing public lock.

    New catalog IDs and newly completed taxonomy entries are safe to register
    automatically because they cannot move an existing public URL. Existing
    entries are never removed or rewritten here. Renames, slug changes, site URL
    changes and deletions remain visible as unresolved differences and continue
    to block a public build until explicitly reviewed.
    """

    locked = read_lock(root)
    configured = configured_route_snapshot(root)
    updated = json.loads(json.dumps(locked, ensure_ascii=False))
    additions: list[str] = []

    for field, keys, label in _ROUTE_GROUPS:
        locked_items = updated.get(field)
        if not isinstance(locked_items, list):
            raise ValueError(f"{LOCK_FILENAME} field '{field}' must be a JSON array")
        known = _indexed(locked_items, keys)
        live_items = configured.get(field)
        if not isinstance(live_items, list):
            raise ValueError(f"Configured route snapshot field '{field}' must be a list")
        for item in live_items:
            key = tuple(str(item.get(name, "")) for name in keys)
            if key in known:
                continue
            copied = dict(item)
            locked_items.append(copied)
            known[key] = copied
            additions.append(f"{label}: {' / '.join(key)}")

    unresolved = snapshot_differences(updated, configured)
    if additions:
        _atomic_write_lock(root / LOCK_FILENAME, updated)
    return {"added": additions, "unresolved": unresolved}


def assert_route_lock_current(root: Path) -> None:
    locked = read_lock(root)
    current = route_snapshot(root)
    differences = snapshot_differences(locked, current)
    if differences:
        sample = "\n  - ".join(differences[:20])
        extra = f"\n  - ... and {len(differences) - 20} more" if len(differences) > 20 else ""
        raise ValueError(
            "Public SEO route lock is stale. Existing public IDs/slugs must not change silently.\n"
            f"  - {sample}{extra}\n"
            "If every route change is intentional, review redirects/impact and run "
            "`npm run seo:routes:update -- --confirm-route-lock-update`."
        )


def write_route_lock(root: Path, *, confirmed: bool) -> Path:
    if not confirmed:
        raise ValueError(
            "Updating public route identities requires --confirm-route-lock-update. "
            "Review every changed catalog id and taxonomy slug first."
        )
    target = root / LOCK_FILENAME
    _atomic_write_lock(target, route_snapshot(root))
    return target


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Verify the current routes match the lock.")
    parser.add_argument("--update", action="store_true", help="Rewrite the route lock from current sources.")
    parser.add_argument("--confirm-route-lock-update", action="store_true")
    args = parser.parse_args(argv)
    if args.check == args.update:
        parser.error("Choose exactly one of --check or --update")
    root = project_root()
    try:
        if args.update:
            path = write_route_lock(root, confirmed=args.confirm_route_lock_update)
            print(f"Updated public SEO route lock: {path.name}")
        else:
            assert_route_lock_current(root)
            current = route_snapshot(root)
            print(
                "Public SEO route lock is current: "
                f"{len(current['catalogs'])} catalogs, "
                f"{len(current['categories'])} categories, "
                f"{len(current['subcategories'])} subcategories."
            )
    except (FileNotFoundError, ValueError) as exc:
        print(f"SEO ROUTE LOCK FAILED: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
