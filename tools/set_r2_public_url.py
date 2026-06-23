#!/usr/bin/env python3
"""Set the public Cloudflare R2 image URL in catalog-assets-config.js.

This intentionally rejects the R2 S3 API endpoint (*.r2.cloudflarestorage.com)
because that endpoint is for authenticated API tools, not public image delivery.
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

CONFIG_PATH = Path(__file__).resolve().parents[1] / "catalog-assets-config.js"
S3_ENDPOINT_MARKER = ".r2.cloudflarestorage.com"


def normalize_url(value: str) -> str:
    return str(value or "").strip().rstrip("/")


def validate_public_url(url: str) -> list[str]:
    errors: list[str] = []
    if not url:
        errors.append("Public URL is empty.")
        return errors
    if S3_ENDPOINT_MARKER in url.lower():
        errors.append(
            "This is an R2 S3 API endpoint, not a public browser URL. Use an R2 Custom Domain or Public Development URL."
        )
    if not re.match(r"^https://", url, re.IGNORECASE):
        errors.append("Use an https:// public URL.")
    if "/assets/pages" in url.lower():
        errors.append("Do not include /assets/pages. Use only the public origin, for example https://catalogs.example.com")
    return errors


def set_base_url(url: str) -> None:
    if not CONFIG_PATH.exists():
        raise FileNotFoundError(f"Missing {CONFIG_PATH}")
    text = CONFIG_PATH.read_text(encoding="utf-8")
    pattern = re.compile(r'(baseUrl\s*:\s*)(["\'])(.*?)(\2)')
    new_text, count = pattern.subn(lambda m: f'{m.group(1)}{m.group(2)}{url}{m.group(4)}', text, count=1)
    if count != 1:
        raise RuntimeError("Could not find baseUrl in catalog-assets-config.js")
    CONFIG_PATH.write_text(new_text, encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Set the public R2 baseUrl used by the catalog website.")
    parser.add_argument("url", help="R2 public read URL / custom domain, without /assets/pages")
    args = parser.parse_args()

    url = normalize_url(args.url)
    errors = validate_public_url(url)
    if errors:
        print("ERROR: The URL was not accepted:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1

    set_base_url(url)
    print(f"Updated catalog-assets-config.js baseUrl to: {url}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
