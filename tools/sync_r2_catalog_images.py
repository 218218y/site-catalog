#!/usr/bin/env python3
"""Sync converted catalog page images from assets/pages to a Cloudflare R2 bucket.

The script is intentionally dependency-free: it talks to the R2 S3-compatible
API directly with AWS Signature V4, so it works after the normal Python setup
without installing boto3 or the AWS CLI.

Default sync target:
    bucket: bargig-catalog
    prefix: assets/pages

Required credentials can be supplied as environment variables or through r2.env:
    R2_ACCOUNT_ID=your-cloudflare-account-id
    R2_ACCESS_KEY_ID=your-r2-access-key-id
    R2_SECRET_ACCESS_KEY=your-r2-secret-access-key

Alternative accepted names:
    CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_R2_ACCOUNT_ID
    AWS_ACCESS_KEY_ID / CLOUDFLARE_R2_ACCESS_KEY_ID
    AWS_SECRET_ACCESS_KEY / CLOUDFLARE_R2_SECRET_ACCESS_KEY
    R2_ENDPOINT_URL / CLOUDFLARE_R2_ENDPOINT_URL / AWS_ENDPOINT_URL_S3
"""
from __future__ import annotations

import argparse
import base64
import datetime as dt
import hashlib
import hmac
import mimetypes
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

DEFAULT_BUCKET = "bargig-catalog"
DEFAULT_PREFIX = "assets/pages"
DEFAULT_PUBLIC_URL = "https://cdn.bargig-furniture.com"
DEFAULT_REGION = "auto"
SERVICE = "s3"


@dataclass(frozen=True)
class LocalObject:
    path: Path
    key: str
    size: int
    sha256: str
    md5: str


@dataclass(frozen=True)
class RemoteObject:
    key: str
    size: int
    etag: str


@dataclass(frozen=True)
class Credentials:
    access_key_id: str
    secret_access_key: str


@dataclass(frozen=True)
class PlannedUpload:
    local: LocalObject
    reason: str


@dataclass(frozen=True)
class SyncPlan:
    skipped: list[str]
    uploads: list[PlannedUpload]
    deletes: list[str]


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def rel_to_root(path: Path) -> str:
    try:
        return path.relative_to(project_root()).as_posix()
    except ValueError:
        return path.as_posix()


def normalize_prefix(prefix: str) -> str:
    return str(prefix or "").strip().strip("/")


def format_bytes(size: int) -> str:
    units = ["B", "KB", "MB", "GB", "TB"]
    value = float(size)
    for unit in units:
        if value < 1024 or unit == units[-1]:
            if unit == "B":
                return f"{int(value)} {unit}"
            return f"{value:.1f} {unit}"
        value /= 1024
    return f"{size} B"


def strip_etag(etag: str) -> str:
    return str(etag or "").strip().strip('"').lower()


def env_first(*names: str) -> str:
    for name in names:
        value = os.environ.get(name)
        if value:
            return value.strip()
    return ""


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for raw_line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def build_endpoint_url(args: argparse.Namespace) -> str:
    explicit = str(args.endpoint_url or "").strip() or env_first(
        "R2_ENDPOINT_URL",
        "CLOUDFLARE_R2_ENDPOINT_URL",
        "AWS_ENDPOINT_URL_S3",
        "AWS_ENDPOINT_URL",
    )
    if explicit:
        endpoint = explicit.rstrip("/")
    else:
        account_id = str(args.account_id or "").strip() or env_first(
            "R2_ACCOUNT_ID",
            "CLOUDFLARE_R2_ACCOUNT_ID",
            "CLOUDFLARE_ACCOUNT_ID",
        )
        if not account_id:
            raise ValueError(
                "Missing R2 endpoint. Set R2_ACCOUNT_ID in r2.env, or pass --account-id/--endpoint-url. "
                "The public r2.dev URL is only for browsing images and cannot be used for bucket uploads."
            )
        endpoint = f"https://{account_id}.r2.cloudflarestorage.com"
    if not re.match(r"^https?://", endpoint, flags=re.IGNORECASE):
        raise ValueError(f"Endpoint URL must start with http:// or https://: {endpoint}")
    return endpoint


def load_credentials(args: argparse.Namespace) -> Credentials:
    access_key_id = str(args.access_key_id or "").strip() or env_first(
        "R2_ACCESS_KEY_ID",
        "CLOUDFLARE_R2_ACCESS_KEY_ID",
        "AWS_ACCESS_KEY_ID",
    )
    secret_access_key = str(args.secret_access_key or "").strip() or env_first(
        "R2_SECRET_ACCESS_KEY",
        "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
        "AWS_SECRET_ACCESS_KEY",
    )
    if not access_key_id or not secret_access_key:
        raise ValueError(
            "Missing R2 credentials. Set R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in r2.env "
            "or in Windows environment variables."
        )
    return Credentials(access_key_id=access_key_id, secret_access_key=secret_access_key)


def hash_file(path: Path) -> tuple[str, str]:
    sha256 = hashlib.sha256()
    md5 = hashlib.md5()  # noqa: S324 - used only for S3 ETag comparison, not for security.
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            sha256.update(chunk)
            md5.update(chunk)
    return sha256.hexdigest(), md5.hexdigest()


def iter_local_objects(root: Path, local_dir: Path, key_prefix: str) -> Iterable[LocalObject]:
    if not local_dir.is_dir():
        raise FileNotFoundError(f"Local image folder does not exist: {rel_to_root(local_dir)}")
    for path in sorted(local_dir.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(local_dir).as_posix()
        key = f"{key_prefix}/{relative}" if key_prefix else relative
        sha256, md5 = hash_file(path)
        yield LocalObject(path=path, key=key, size=path.stat().st_size, sha256=sha256, md5=md5)


def quote_path_part(value: str) -> str:
    return urllib.parse.quote(value, safe="/-_.~")


def canonical_query(params: list[tuple[str, str]]) -> str:
    encoded = [
        (urllib.parse.quote(str(k), safe="-_.~"), urllib.parse.quote(str(v), safe="-_.~"))
        for k, v in params
    ]
    encoded.sort()
    return "&".join(f"{k}={v}" for k, v in encoded)


def signing_key(secret_access_key: str, date_stamp: str, region: str) -> bytes:
    key_date = hmac.new(("AWS4" + secret_access_key).encode("utf-8"), date_stamp.encode("utf-8"), hashlib.sha256).digest()
    key_region = hmac.new(key_date, region.encode("utf-8"), hashlib.sha256).digest()
    key_service = hmac.new(key_region, SERVICE.encode("utf-8"), hashlib.sha256).digest()
    return hmac.new(key_service, b"aws4_request", hashlib.sha256).digest()


class R2S3Client:
    def __init__(self, endpoint_url: str, bucket: str, credentials: Credentials, region: str = DEFAULT_REGION) -> None:
        parsed = urllib.parse.urlparse(endpoint_url.rstrip("/"))
        if not parsed.scheme or not parsed.netloc:
            raise ValueError(f"Invalid endpoint URL: {endpoint_url}")
        self.endpoint_url = endpoint_url.rstrip("/")
        self.scheme = parsed.scheme
        self.host = parsed.netloc
        self.bucket = bucket
        self.credentials = credentials
        self.region = region

    def _request(
        self,
        method: str,
        key: str = "",
        query: list[tuple[str, str]] | None = None,
        body: bytes = b"",
        extra_headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        query = query or []
        extra_headers = extra_headers or {}
        now = dt.datetime.now(dt.UTC)
        amz_date = now.strftime("%Y%m%dT%H%M%SZ")
        date_stamp = now.strftime("%Y%m%d")
        payload_hash = hashlib.sha256(body).hexdigest()

        path = f"/{quote_path_part(self.bucket)}"
        if key:
            path += f"/{quote_path_part(key)}"
        query_string = canonical_query(query)
        url = f"{self.endpoint_url}{path}"
        if query_string:
            url += f"?{query_string}"

        headers = {
            "host": self.host,
            "x-amz-content-sha256": payload_hash,
            "x-amz-date": amz_date,
        }
        for header, value in extra_headers.items():
            if value is not None and value != "":
                headers[header.lower()] = str(value).strip()

        signed_header_names = sorted(headers)
        canonical_headers = "".join(f"{name}:{headers[name]}\n" for name in signed_header_names)
        signed_headers = ";".join(signed_header_names)
        canonical_request = "\n".join([
            method.upper(),
            path,
            query_string,
            canonical_headers,
            signed_headers,
            payload_hash,
        ])
        credential_scope = f"{date_stamp}/{self.region}/{SERVICE}/aws4_request"
        string_to_sign = "\n".join([
            "AWS4-HMAC-SHA256",
            amz_date,
            credential_scope,
            hashlib.sha256(canonical_request.encode("utf-8")).hexdigest(),
        ])
        signature = hmac.new(
            signing_key(self.credentials.secret_access_key, date_stamp, self.region),
            string_to_sign.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        headers["authorization"] = (
            "AWS4-HMAC-SHA256 "
            f"Credential={self.credentials.access_key_id}/{credential_scope}, "
            f"SignedHeaders={signed_headers}, Signature={signature}"
        )

        request_headers = {name: value for name, value in headers.items() if name != "host"}
        request_headers["Host"] = self.host
        request = urllib.request.Request(url=url, data=body if method.upper() != "HEAD" else None, headers=request_headers, method=method.upper())
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                response_headers = {k.lower(): v for k, v in response.headers.items()}
                return response.status, response_headers, response.read()
        except urllib.error.HTTPError as exc:
            error_body = exc.read()
            message = error_body.decode("utf-8", errors="replace").strip()
            raise RuntimeError(f"R2 API {method.upper()} {path} failed with HTTP {exc.code}: {message}") from exc

    def list_objects(self, prefix: str) -> dict[str, RemoteObject]:
        objects: dict[str, RemoteObject] = {}
        continuation = ""
        while True:
            params = [("list-type", "2"), ("prefix", prefix)]
            if continuation:
                params.append(("continuation-token", continuation))
            _, _, body = self._request("GET", query=params)
            root = ET.fromstring(body)
            namespace = ""
            if root.tag.startswith("{"):
                namespace = root.tag.split("}", 1)[0] + "}"
            for item in root.findall(f"{namespace}Contents"):
                key = item.findtext(f"{namespace}Key") or ""
                if not key:
                    continue
                size_text = item.findtext(f"{namespace}Size") or "0"
                etag_text = item.findtext(f"{namespace}ETag") or ""
                objects[key] = RemoteObject(key=key, size=int(size_text), etag=strip_etag(etag_text))
            is_truncated = (root.findtext(f"{namespace}IsTruncated") or "").lower() == "true"
            continuation = root.findtext(f"{namespace}NextContinuationToken") or ""
            if not is_truncated or not continuation:
                return objects

    def head_object(self, key: str) -> dict[str, str]:
        _, headers, _ = self._request("HEAD", key=key)
        return headers

    def put_object(self, local: LocalObject, cache_control: str) -> None:
        content_type = mimetypes.guess_type(local.path.name)[0] or "application/octet-stream"
        body = local.path.read_bytes()
        headers = {
            "content-type": content_type,
            "cache-control": cache_control,
            "x-amz-meta-sha256": local.sha256,
        }
        self._request("PUT", key=local.key, body=body, extra_headers=headers)

    def delete_objects(self, keys: list[str]) -> None:
        if not keys:
            return
        parts = ["<Delete>", "<Quiet>true</Quiet>"]
        for key in keys:
            parts.append(f"<Object><Key>{escape_xml(key)}</Key></Object>")
        parts.append("</Delete>")
        body = "".join(parts).encode("utf-8")
        headers = {
            "content-type": "application/xml",
            "content-md5": base64.b64encode(hashlib.md5(body).digest()).decode("ascii"),  # noqa: S324 - S3 API integrity header.
        }
        self._request("POST", query=[("delete", "")], body=body, extra_headers=headers)


def escape_xml(value: str) -> str:
    return (
        value.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


def should_upload(client: R2S3Client, local: LocalObject, remote: RemoteObject | None) -> str:
    if remote is None:
        return "new"
    if remote.size != local.size:
        return "size changed"
    if remote.etag and remote.etag == local.md5:
        return ""
    # Objects uploaded by this script store the SHA256 in metadata. This avoids
    # re-uploading files when an R2 ETag is not a plain MD5 value.
    try:
        headers = client.head_object(local.key)
    except Exception as exc:  # noqa: BLE001 - re-upload is safer than trusting an unreadable object.
        return f"could not verify remote metadata ({exc})"
    remote_sha256 = (headers.get("x-amz-meta-sha256") or headers.get("x-amz-meta-sha256".lower()) or "").strip().lower()
    if remote_sha256 and remote_sha256 == local.sha256:
        return ""
    return "content changed"


def build_plan(client: R2S3Client, local_objects: list[LocalObject], remote_objects: dict[str, RemoteObject], key_prefix: str, delete: bool) -> SyncPlan:
    skipped: list[str] = []
    uploads: list[PlannedUpload] = []
    local_keys = {item.key for item in local_objects}
    for local in local_objects:
        reason = should_upload(client, local, remote_objects.get(local.key))
        if reason:
            uploads.append(PlannedUpload(local=local, reason=reason))
        else:
            skipped.append(local.key)

    deletes: list[str] = []
    if delete:
        normalized = normalize_prefix(key_prefix)
        prefix_with_slash = f"{normalized}/" if normalized else ""
        for key in sorted(remote_objects):
            if key not in local_keys and (not normalized or key.startswith(prefix_with_slash)):
                deletes.append(key)
    return SyncPlan(skipped=skipped, uploads=uploads, deletes=deletes)


def normalize_public_url(url: str) -> str:
    value = str(url or "").strip().rstrip("/")
    if not value:
        return ""
    if not re.match(r"^https?://", value, flags=re.IGNORECASE):
        raise ValueError(f"Public URL must start with http:// or https://: {url}")
    return value


def public_url(public_base_url: str, key: str) -> str:
    base = normalize_public_url(public_base_url)
    if not base:
        return key
    return f"{base}/{urllib.parse.quote(key, safe='/-_.~')}"


def print_plan(plan: SyncPlan, public_base_url: str, show_all: bool) -> None:
    upload_bytes = sum(item.local.size for item in plan.uploads)
    print("\nSync plan:")
    print(f"  Upload/update: {len(plan.uploads)} files ({format_bytes(upload_bytes)})")
    print(f"  Delete remote:  {len(plan.deletes)} files")
    print(f"  Skip unchanged: {len(plan.skipped)} files")

    if plan.uploads:
        print("\nFiles to upload/update:")
        for item in plan.uploads if show_all else plan.uploads[:80]:
            print(f"  + {item.local.key}  [{item.reason}, {format_bytes(item.local.size)}]")
        if not show_all and len(plan.uploads) > 80:
            print(f"  ... and {len(plan.uploads) - 80} more")

    if plan.deletes:
        print("\nRemote files to delete:")
        for key in plan.deletes if show_all else plan.deletes[:80]:
            print(f"  - {key}")
        if not show_all and len(plan.deletes) > 80:
            print(f"  ... and {len(plan.deletes) - 80} more")

    if plan.uploads and public_base_url:
        print("\nExample public URL after upload:")
        print(f"  {public_url(public_base_url, plan.uploads[0].local.key)}")


def apply_plan(client: R2S3Client, plan: SyncPlan, cache_control: str, delete_batch_size: int) -> None:
    for index, item in enumerate(plan.uploads, start=1):
        print(f"[upload {index}/{len(plan.uploads)}] {item.local.key}")
        client.put_object(item.local, cache_control=cache_control)

    if plan.deletes:
        for start in range(0, len(plan.deletes), delete_batch_size):
            batch = plan.deletes[start : start + delete_batch_size]
            print(f"[delete] {len(batch)} remote files")
            client.delete_objects(batch)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Sync assets/pages catalog images to Cloudflare R2.")
    parser.add_argument("--local-dir", default="assets/pages", help="Local converted images folder, relative to project root by default")
    parser.add_argument("--bucket", default="", help="R2 bucket name. Defaults to R2_BUCKET from r2.env, then bargig-catalog")
    parser.add_argument("--prefix", default="", help="Remote key prefix inside the bucket. Defaults to R2_PREFIX from r2.env, then assets/pages. Use --prefix / for the bucket root")
    parser.add_argument(
        "--public-url",
        default="",
        help="Public base URL used only for display. Defaults to R2_PUBLIC_URL from r2.env, then the Bargig CDN custom domain.",
    )
    parser.add_argument("--endpoint-url", default="", help="R2 S3 API endpoint URL, e.g. https://ACCOUNT_ID.r2.cloudflarestorage.com")
    parser.add_argument("--account-id", default="", help="Cloudflare account ID. Used to build the endpoint URL if --endpoint-url is not supplied")
    parser.add_argument("--access-key-id", default="", help="R2 access key ID. Prefer environment variables or r2.env instead")
    parser.add_argument("--secret-access-key", default="", help="R2 secret access key. Prefer environment variables or r2.env instead")
    parser.add_argument("--env-file", default="r2.env", help="Optional env file to load before reading R2 settings")
    parser.add_argument("--region", default=DEFAULT_REGION, help="S3 signing region. Cloudflare R2 normally uses 'auto'")
    parser.add_argument("--dry-run", action="store_true", help="Show the sync plan without uploading or deleting")
    parser.add_argument("--no-delete", action="store_true", help="Do not delete remote files that are missing locally")
    parser.add_argument("--cache-control", default="public, max-age=31536000, immutable", help="Cache-Control header for uploaded images")
    parser.add_argument("--delete-batch-size", type=int, default=1000, help="How many remote keys to delete per S3 delete request")
    parser.add_argument("--show-all", action="store_true", help="Print every planned file instead of truncating long lists")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv or sys.argv[1:])
    root = project_root()
    env_path = Path(args.env_file)
    if not env_path.is_absolute():
        env_path = root / env_path
    load_env_file(env_path)

    try:
        local_dir = Path(args.local_dir)
        if not local_dir.is_absolute():
            local_dir = root / local_dir
        key_prefix = normalize_prefix(
            args.prefix
            or env_first("R2_PREFIX", "R2_KEY_PREFIX", "CLOUDFLARE_R2_PREFIX")
            or DEFAULT_PREFIX
        )
        bucket = str(args.bucket or env_first("R2_BUCKET", "CLOUDFLARE_R2_BUCKET") or DEFAULT_BUCKET).strip()
        if not bucket:
            raise ValueError("Bucket name is empty.")

        endpoint_url = build_endpoint_url(args)
        public_base_url = normalize_public_url(
            args.public_url
            or env_first("R2_PUBLIC_URL", "CLOUDFLARE_R2_PUBLIC_URL", "PUBLIC_CATALOG_ASSET_URL")
            or DEFAULT_PUBLIC_URL
        )
        credentials = load_credentials(args)
        client = R2S3Client(endpoint_url=endpoint_url, bucket=bucket, credentials=credentials, region=args.region)

        print(f"Local folder: {rel_to_root(local_dir)}")
        print(f"R2 bucket:    {bucket}")
        print(f"R2 prefix:    {key_prefix or '(bucket root)'}")
        print(f"Endpoint:     {endpoint_url}")
        print(f"Public URL:   {public_base_url}")
        print(f"Mode:         {'preview only, no changes' if args.dry_run else 'apply changes'}")
        print(f"Deletes:      {'disabled' if args.no_delete else 'enabled'}")

        print("\nScanning local images...")
        local_objects = list(iter_local_objects(root, local_dir, key_prefix))
        print(f"Found {len(local_objects)} local files.")

        print("Listing remote bucket objects...")
        remote_objects = client.list_objects(f"{key_prefix}/" if key_prefix else "")
        print(f"Found {len(remote_objects)} remote files under prefix.")

        plan = build_plan(client, local_objects, remote_objects, key_prefix, delete=not args.no_delete)
        print_plan(plan, public_base_url, show_all=args.show_all)

        if args.dry_run:
            print("\nDry run only. No upload/delete was performed.")
            return 0

        apply_plan(client, plan, cache_control=args.cache_control, delete_batch_size=max(1, args.delete_batch_size))
        print("\nDone. R2 bucket now matches the local assets/pages folder under the selected prefix.")
        return 0
    except Exception as exc:
        print(f"\nERROR: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
