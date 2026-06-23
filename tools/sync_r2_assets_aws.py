#!/usr/bin/env python3
"""Fast Cloudflare R2 asset sync using the AWS CLI S3 API.

Why not Wrangler per file?
- `wrangler r2 object put` is good for single objects and small fixes.
- Large catalog folders need a sync tool that compares local/remote state,
  skips unchanged files, and uploads many files concurrently.

This script runs `aws s3 sync` against the Cloudflare R2 S3-compatible endpoint,
with separate passes per content type so browser metadata stays correct.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

DEFAULT_BUCKET = "bargig-catalog"
DEFAULT_PROFILE = "r2"
# This is the account-level S3 API endpoint the user supplied. It is not the
# public browser URL; it is only for authenticated S3-compatible upload tools.
DEFAULT_ENDPOINT_URL = "https://7d352c315748f2f8c6e723c5fc46f606.r2.cloudflarestorage.com"

CACHE_CONTROL_ASSETS = "public, max-age=31536000, immutable"
CACHE_CONTROL_METADATA = "public, max-age=300"


@dataclass(frozen=True)
class SyncGroup:
    name: str
    suffixes: tuple[str, ...]
    content_type: str
    cache_control: str


SYNC_GROUPS = (
    SyncGroup("WebP images", (".webp",), "image/webp", CACHE_CONTROL_ASSETS),
    SyncGroup("JPEG images", (".jpg", ".jpeg"), "image/jpeg", CACHE_CONTROL_ASSETS),
    SyncGroup("PNG images", (".png",), "image/png", CACHE_CONTROL_ASSETS),
    SyncGroup("GIF images", (".gif",), "image/gif", CACHE_CONTROL_ASSETS),
    SyncGroup("SVG images", (".svg",), "image/svg+xml", CACHE_CONTROL_ASSETS),
    SyncGroup("JSON metadata", (".json",), "application/json; charset=utf-8", CACHE_CONTROL_METADATA),
)


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def rel_to_root(path: Path) -> str:
    try:
        return path.relative_to(project_root()).as_posix()
    except ValueError:
        return path.as_posix()


def format_bytes(size: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{int(value)} {unit}" if unit == "B" else f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"


def iter_files(root: Path) -> Iterable[Path]:
    for path in root.rglob("*"):
        if path.is_file():
            yield path


def count_matching(root: Path, suffixes: tuple[str, ...]) -> tuple[int, int]:
    normalized = {suffix.lower() for suffix in suffixes}
    count = 0
    total = 0
    for path in iter_files(root):
        if path.suffix.lower() in normalized:
            count += 1
            total += path.stat().st_size
    return count, total


def aws_command() -> list[str]:
    executable = "aws.cmd" if os.name == "nt" else "aws"
    return [executable]


def run(command: list[str], cwd: Path, *, quiet: bool = False) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env.setdefault("AWS_PAGER", "")
    env.setdefault("PYTHONUTF8", "1")
    return subprocess.run(
        command,
        cwd=str(cwd),
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE if quiet else None,
        stderr=subprocess.PIPE if quiet else None,
        env=env,
    )


def check_aws_cli(root: Path) -> bool:
    if not shutil.which("aws") and not shutil.which("aws.cmd"):
        print("ERROR: AWS CLI was not found.")
        print("Install AWS CLI v2, then run setup-r2-aws-profile.bat once.")
        return False
    result = run(aws_command() + ["--version"], cwd=root, quiet=True)
    if result.returncode != 0:
        print("ERROR: AWS CLI exists but could not run.")
        if result.stderr:
            print(result.stderr)
        return False
    version = (result.stdout or result.stderr or "").strip()
    if version:
        print(version)
    return True


def configure_concurrency(root: Path, profile: str, max_concurrent_requests: int) -> None:
    if max_concurrent_requests <= 0:
        return
    command = aws_command() + [
        "configure", "set", "s3.max_concurrent_requests", str(max_concurrent_requests),
        "--profile", profile,
    ]
    result = run(command, cwd=root, quiet=True)
    if result.returncode == 0:
        print(f"AWS CLI parallel upload setting: s3.max_concurrent_requests={max_concurrent_requests}")
    else:
        print("[warn] Could not set AWS CLI parallel upload setting; continuing with AWS defaults.")
        if result.stderr:
            print(result.stderr.strip())


def sync_group(
    *,
    root: Path,
    upload_root: Path,
    bucket: str,
    endpoint_url: str,
    profile: str,
    group: SyncGroup,
    dry_run: bool,
    delete: bool,
    size_only: bool,
    only_show_errors: bool,
) -> int:
    remote = f"s3://{bucket}"
    command = aws_command() + [
        "s3", "sync", str(upload_root), remote,
        "--endpoint-url", endpoint_url,
        "--profile", profile,
        "--exclude", "*",
    ]
    for suffix in group.suffixes:
        command += ["--include", f"*{suffix}"]
    command += [
        "--content-type", group.content_type,
        "--cache-control", group.cache_control,
        "--no-progress",
    ]
    if only_show_errors:
        command.append("--only-show-errors")
    if dry_run:
        command.append("--dryrun")
    if delete:
        command.append("--delete")
    if size_only:
        command.append("--size-only")

    print(f"\n== {group.name} ==")
    result = run(command, cwd=root)
    return int(result.returncode)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fast sync dist/r2-assets to Cloudflare R2 using AWS CLI.")
    parser.add_argument("--bucket", default=os.environ.get("R2_BUCKET", DEFAULT_BUCKET), help="R2 bucket name")
    parser.add_argument("--endpoint-url", default=os.environ.get("R2_ENDPOINT_URL", DEFAULT_ENDPOINT_URL), help="R2 S3 API endpoint URL")
    parser.add_argument("--profile", default=os.environ.get("AWS_PROFILE", DEFAULT_PROFILE), help="AWS CLI profile that contains the R2 access keys")
    parser.add_argument("--root", default="dist/r2-assets", help="Local folder to sync, relative to project root")
    parser.add_argument("--max-concurrent-requests", type=int, default=32, help="AWS CLI S3 concurrent request count; 0 keeps current AWS config")
    parser.add_argument("--delete", action="store_true", help="Also delete remote files that no longer exist locally. Use only when you are sure.")
    parser.add_argument("--dry-run", action="store_true", help="Show what would change without uploading")
    parser.add_argument("--size-only", action="store_true", help="Skip by file size only. Useful after timestamp-only changes, but less strict than default sync.")
    parser.add_argument("--verbose", action="store_true", help="Show every synced/skipped operation instead of errors only")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = project_root()
    upload_root = (root / str(args.root)).resolve()
    bucket = str(args.bucket).strip()
    endpoint_url = str(args.endpoint_url).strip().rstrip("/")
    profile = str(args.profile).strip()

    if not bucket:
        print("ERROR: bucket name is required.")
        return 1
    if not endpoint_url.startswith("https://") or ".r2.cloudflarestorage.com" not in endpoint_url:
        print("ERROR: endpoint-url must be the R2 S3 API endpoint, for example:")
        print("  https://ACCOUNT_ID.r2.cloudflarestorage.com")
        print("Do not use the public r2.dev URL here.")
        return 1
    if not upload_root.is_dir():
        print(f"ERROR: upload folder was not found: {rel_to_root(upload_root)}")
        print("Run build-r2-assets.bat first.")
        return 1
    if not check_aws_cli(root):
        return 1

    all_files = list(iter_files(upload_root))
    if not all_files:
        print(f"ERROR: no files found in {rel_to_root(upload_root)}")
        return 1

    print("\nFast R2 sync")
    print("------------")
    print(f"Bucket: {bucket}")
    print(f"Endpoint: {endpoint_url}")
    print(f"Profile: {profile}")
    print(f"Folder: {rel_to_root(upload_root)}")
    print(f"Files: {len(all_files)} ({format_bytes(sum(path.stat().st_size for path in all_files))})")
    print("Mode: AWS CLI s3 sync; unchanged remote files are skipped")
    if args.dry_run:
        print("Dry run: no files will be uploaded")
    if args.size_only:
        print("Comparison: --size-only")
    if args.delete:
        print("Delete: enabled; remote files missing locally may be removed")

    configure_concurrency(root, profile, int(args.max_concurrent_requests))

    exit_code = 0
    for group in SYNC_GROUPS:
        count, total = count_matching(upload_root, group.suffixes)
        if count == 0:
            continue
        print(f"\nSelected: {count} files, {format_bytes(total)}")
        result = sync_group(
            root=root,
            upload_root=upload_root,
            bucket=bucket,
            endpoint_url=endpoint_url,
            profile=profile,
            group=group,
            dry_run=bool(args.dry_run),
            delete=bool(args.delete),
            size_only=bool(args.size_only),
            only_show_errors=not bool(args.verbose),
        )
        if result != 0:
            exit_code = result
            print(f"[error] Sync failed for {group.name}.")
            break

    if exit_code == 0:
        print("\nFast R2 sync finished successfully.")
        print("Open a public image URL in the browser to verify, for example:")
        print("  https://pub-5e6c7421563f4086ba1e097bb88f3348.r2.dev/assets/pages/fredi-arnot/page-030.webp")
    else:
        print("\nFast R2 sync failed. Check AWS profile keys, endpoint, bucket permissions, and network.")
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
