#!/usr/bin/env python3
"""Fail unless the current generated catalog image release completed an R2 sync."""
from __future__ import annotations

import sys

from r2_catalog_sync_state import verify_sync_state


def main() -> int:
    try:
        state = verify_sync_state()
        print(
            "R2 image sync state is current: "
            f"{state.get('catalogCount', 0)} catalogs, synced {state.get('syncedAtUtc', '(unknown time)')}."
        )
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
