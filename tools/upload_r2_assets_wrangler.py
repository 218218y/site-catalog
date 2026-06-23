#!/usr/bin/env python3
"""Upload dist/r2-assets to Cloudflare R2 through Wrangler, safely.

Why this exists instead of a simple batch loop:
- Wrangler uploads can fail transiently because of network hiccups.
- The old loop did not reliably retry a failed file.
- Wrangler v4 can operate on local storage unless --remote is explicit.
- A resumable state file prevents re-uploading everything after a failure.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable

CONTENT_TYPES = {
    ".webp": "image/webp",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
}
CACHE_CONTROL_ASSETS = "public, max-age=31536000, immutable"
CACHE_CONTROL_METADATA = "public, max-age=300"


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def rel_to_root(path: Path) -> str:
    try:
        return path.relative_to(project_root()).as_posix()
    except ValueError:
        return path.as_posix()


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def format_bytes(size: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{int(value)} {unit}" if unit == "B" else f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"


def iter_files(root: Path) -> Iterable[Path]:
    for path in sorted(root.rglob("*")):
        if path.is_file():
            yield path


def object_key(root: Path, file_path: Path) -> str:
    return file_path.relative_to(root).as_posix()


def content_type_for(file_path: Path) -> str:
    return CONTENT_TYPES.get(file_path.suffix.lower(), "application/octet-stream")


def cache_control_for(file_path: Path) -> str:
    if file_path.suffix.lower() in {".webp", ".jpg", ".jpeg", ".png", ".gif", ".svg"}:
        return CACHE_CONTROL_ASSETS
    return CACHE_CONTROL_METADATA


def signature(file_path: Path) -> dict[str, Any]:
    stat = file_path.stat()
    return {
        "size": stat.st_size,
        "mtimeNs": getattr(stat, "st_mtime_ns", int(stat.st_mtime * 1_000_000_000)),
    }


def load_json(path: Path, default: dict[str, Any]) -> dict[str, Any]:
    if not path.exists():
        return default
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def load_failed_keys(path: Path) -> set[str]:
    if not path.exists():
        return set()
    return {line.strip().replace("\\", "/") for line in path.read_text(encoding="utf-8").splitlines() if line.strip()}


def save_failed_keys(path: Path, keys: Iterable[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    unique = sorted(set(keys))
    if unique:
        path.write_text("\n".join(unique) + "\n", encoding="utf-8")
    elif path.exists():
        path.unlink()


def run_command(command: list[str], cwd: Path, quiet_success: bool = True) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.setdefault("FORCE_COLOR", "0")
    return subprocess.run(
        command,
        cwd=str(cwd),
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE if quiet_success else None,
        stderr=subprocess.PIPE if quiet_success else None,
        env=env,
    )


def wrangler_base_command() -> list[str]:
    # On Windows, npm exposes npx through npx.cmd. With shell=False, Python usually
    # resolves PATHEXT, but this explicit name is more reliable.
    if os.name == "nt":
        return ["npx.cmd", "wrangler"]
    return ["npx", "wrangler"]


def set_cors(bucket: str, cors_file: Path, root: Path) -> bool:
    if not cors_file.exists():
        print(f"[warn] CORS file not found: {rel_to_root(cors_file)}")
        return True
    print(f"Applying CORS policy from {rel_to_root(cors_file)} to bucket {bucket}...")
    cmd = wrangler_base_command() + [
        "r2", "bucket", "cors", "set", bucket,
        "--file", str(cors_file),
        "--force",
    ]
    result = run_command(cmd, cwd=root)
    if result.returncode == 0:
        print("CORS policy applied.")
        return True
    print("[error] Failed to apply CORS policy.")
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr)
    return False


def upload_one(bucket: str, root_dir: Path, file_path: Path, project_dir: Path, retries: int) -> tuple[bool, str]:
    key = object_key(root_dir, file_path)
    ctype = content_type_for(file_path)
    cache_control = cache_control_for(file_path)
    total_attempts = max(1, retries + 1)

    cmd = wrangler_base_command() + [
        "r2", "object", "put", f"{bucket}/{key}",
        "--remote",
        "--file", str(file_path),
        "--content-type", ctype,
        "--cache-control", cache_control,
    ]

    last_output = ""
    for attempt in range(1, total_attempts + 1):
        if attempt == 1:
            print(f"Uploading {key} ({format_bytes(file_path.stat().st_size)})")
        else:
            print(f"Retry {attempt - 1}/{retries}: {key}")

        result = run_command(cmd, cwd=project_dir)
        combined = "\n".join(part for part in [result.stdout or "", result.stderr or ""] if part).strip()
        last_output = combined
        if result.returncode == 0:
            return True, combined

        # Connectivity failures and occasional Wrangler/Node crashes are usually transient.
        if attempt < total_attempts:
            time.sleep(min(30, 2 * attempt))

    return False, last_output


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upload dist/r2-assets to a remote Cloudflare R2 bucket using Wrangler.")
    parser.add_argument("bucket", nargs="?", help="Cloudflare R2 bucket name, for example bargig-catalog")
    parser.add_argument("--root", default="dist/r2-assets", help="Folder to upload, relative to project root")
    parser.add_argument("--state", default="dist/r2-upload-state.json", help="Resume state file, relative to project root")
    parser.add_argument("--failed-list", default="dist/r2-upload-failed.txt", help="Failed keys list, relative to project root")
    parser.add_argument("--retries", type=int, default=3, help="Retry count after the first failed attempt for each file")
    parser.add_argument("--failed-only", action="store_true", help="Upload only keys listed in the failed-list file")
    parser.add_argument("--force", action="store_true", help="Upload every file even if it is already marked as successfully uploaded")
    parser.add_argument("--set-cors", action="store_true", help="Also set the bucket CORS policy before uploading")
    parser.add_argument("--cors-file", default="r2-cors-wrangler.json", help="CORS JSON file, relative to project root")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = project_root()
    bucket = (args.bucket or "").strip()
    if not bucket:
        print("Bucket name is required.")
        return 1

    upload_root = (root / args.root).resolve()
    state_path = root / args.state
    failed_path = root / args.failed_list
    cors_file = root / args.cors_file

    if not upload_root.is_dir():
        print(f"Upload folder not found: {rel_to_root(upload_root)}")
        print("Run build-r2-assets.bat first.")
        return 1

    if args.set_cors and not set_cors(bucket, cors_file, root):
        return 1

    files = list(iter_files(upload_root))
    if not files:
        print(f"No files found in {rel_to_root(upload_root)}")
        return 1

    failed_filter = load_failed_keys(failed_path) if args.failed_only else set()
    if args.failed_only and not failed_filter:
        print(f"No failed upload list found at {rel_to_root(failed_path)}.")
        print("Nothing to retry.")
        return 0

    state = load_json(state_path, {"version": 1, "uploaded": {}})
    uploaded: dict[str, Any] = state.setdefault("uploaded", {})

    to_upload: list[Path] = []
    skipped = 0
    for file_path in files:
        key = object_key(upload_root, file_path)
        if args.failed_only and key not in failed_filter:
            continue
        sig = signature(file_path)
        if not args.force and uploaded.get(key, {}).get("signature") == sig:
            skipped += 1
            continue
        to_upload.append(file_path)

    total_bytes = sum(path.stat().st_size for path in to_upload)
    print()
    print(f"Bucket: {bucket}")
    print(f"Mode: remote R2 upload (--remote)")
    print(f"Folder: {rel_to_root(upload_root)}")
    print(f"Files found: {len(files)}")
    print(f"Skipped already uploaded: {skipped}")
    print(f"Files to upload: {len(to_upload)} ({format_bytes(total_bytes)})")
    print()

    if not to_upload:
        save_failed_keys(failed_path, set())
        print("Nothing new to upload.")
        return 0

    failed: dict[str, str] = {}
    succeeded = 0
    for index, file_path in enumerate(to_upload, start=1):
        key = object_key(upload_root, file_path)
        print(f"[{index}/{len(to_upload)}]")
        ok, output = upload_one(bucket, upload_root, file_path, root, args.retries)
        if ok:
            uploaded[key] = {
                "bucket": bucket,
                "signature": signature(file_path),
                "contentType": content_type_for(file_path),
                "uploadedAt": now_iso(),
            }
            succeeded += 1
            state["bucket"] = bucket
            state["root"] = rel_to_root(upload_root)
            state["updatedAt"] = now_iso()
            save_json(state_path, state)
            # In case this file was previously failed, remove it from the failed list below.
            print("Upload complete.")
        else:
            failed[key] = output or "wrangler exited with an error"
            print(f"[failed] {key}")
            if output:
                tail = "\n".join(output.splitlines()[-12:])
                print(tail)
            # Save progress immediately so a crash or Ctrl+C still leaves a useful retry list.
            existing_failures = load_failed_keys(failed_path)
            existing_failures.add(key)
            save_failed_keys(failed_path, existing_failures)
        print()

    remaining_failures = (load_failed_keys(failed_path) | set(failed.keys())) - {
        key for key in uploaded.keys()
        if key in load_failed_keys(failed_path) and key not in failed
    }
    # Recalculate failures only against current files and current successful signatures.
    current_keys = {object_key(upload_root, file_path) for file_path in files}
    clean_remaining: set[str] = set()
    for key in remaining_failures:
        if key not in current_keys:
            continue
        # If it was successfully uploaded in this run or an earlier run with same local signature, remove it.
        local_file = upload_root / key
        if local_file.exists() and uploaded.get(key, {}).get("signature") == signature(local_file) and key not in failed:
            continue
        clean_remaining.add(key)
    save_failed_keys(failed_path, clean_remaining)

    print("Upload summary")
    print("--------------")
    print(f"Succeeded now: {succeeded}")
    print(f"Skipped already uploaded: {skipped}")
    print(f"Failed now: {len(failed)}")

    if failed:
        print()
        print(f"Failed keys were saved to: {rel_to_root(failed_path)}")
        print("Run this to retry only failed files:")
        print(f"  upload-r2-assets-wrangler.bat {bucket} --failed-only")
        return 2

    print()
    print("All selected files are uploaded to remote R2.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
