#!/usr/bin/env python3
"""HTTP composition root for the local catalog control panel.

Domain mutations, PDF/file boundaries, and worker-process lifecycle live in
dedicated modules. This module owns only request security, transport, response
contracts, and composition of those capabilities.
"""
from __future__ import annotations

import argparse
import hmac
import ipaddress
import json
import re
import secrets
import sys
import threading
import webbrowser
from dataclasses import dataclass
from http import HTTPStatus
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Sequence, cast
from urllib.parse import ParseResult, parse_qs, unquote, urlparse

TOOLS_DIR = Path(__file__).resolve().parent
if str(TOOLS_DIR) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIR))

from build_site_pages import PAGE_DOCUMENTS
from catalog_control_api import (
    API_VERSION,
    MAX_PDF_UPLOAD_BYTES,
    ApiRequestError,
    CatalogSaveRequest,
    FooterSaveRequest,
    RunActionRequest,
    TaxonomySaveRequest,
    read_json_object,
    validate_request_payload,
)
from catalog_control_files import (
    catalog_output_status,
    iter_pdf_files,
    missing_pdf_count,
    pdf_files_payload,
    pick_native_pdf_file,
    read_multipart_pdf_upload,
    save_uploaded_pdf,
)
from catalog_control_jobs import (
    ACTIONS,
    cancel_job,
    jobs,
    jobs_lock,
    serialize_job,
    start_job,
    validate_missing_pdf_confirmation,
)
from catalog_control_paths import (
    CONFIG_FILE,
    FOOTER_CONTENT_FILE,
    PAGES_DIR,
    PDF_DIR,
    PROJECT_ROOT,
    SEARCH_OVERRIDES_FILE,
    TAXONOMY_FILE,
    rel_to_root,
)
from catalog_control_service import (
    catalog_ocr_enabled,
    configured_missing_pdfs,
    current_taxonomy_state,
    normalize_catalog_for_ui,
    read_config,
    save_catalogs_transactionally,
    save_footer_content_and_render_pages,
    save_taxonomy_transactionally,
    taxonomy_action_availability,
)
from control_panel_api_schema import ControlPanelSchemaError, validate_control_panel_payload
from footer_content import footer_editor_schema, read_footer_content
from project_mutation import MutationBusyError, ProjectMutationLock, read_lock_metadata

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8765
CONTROL_PANEL_STATIC_ROOT = PROJECT_ROOT / "src" / "control-panel"
STATIC_FILES = {
    "/catalog-control-panel.html": PROJECT_ROOT / "catalog-control-panel.html",
    **{
        f"/{path.relative_to(PROJECT_ROOT).as_posix()}": path
        for path in CONTROL_PANEL_STATIC_ROOT.rglob("*")
        if path.is_file() and path.suffix.lower() in {".js", ".css"}
    },
}

footer_save_lock = threading.Lock()
taxonomy_save_lock = threading.Lock()


def read_json_body(handler: BaseHTTPRequestHandler) -> dict[str, object]:
    """Read one bounded JSON object from a control-panel request."""
    return read_json_object(handler)

def state_payload() -> dict[str, object]:
    config = read_config()
    taxonomy = current_taxonomy_state(config)
    missing_configured = configured_missing_pdfs(config)
    mutation = read_lock_metadata(PROJECT_ROOT) or {}
    with jobs_lock:
        active_jobs = [job for job in jobs.values() if job.status in {"running", "canceling"}]
        job_summaries = [serialize_job(job, include_log=False) for job in sorted(jobs.values(), key=lambda item: item.started_at, reverse=True)[:10]]
    active_job = max(active_jobs, key=lambda item: item.started_at) if active_jobs else None
    mutation_active = bool(mutation.get("token") or active_job)
    mutation_action = str(mutation.get("action") or (active_job.label if active_job else ""))
    taxonomy_issues = taxonomy.get("issues")
    taxonomy_missing = len(taxonomy_issues) if isinstance(taxonomy_issues, list) else 0
    actions: list[dict[str, object]] = []
    for key, action in ACTIONS.items():
        enabled, reason = taxonomy_action_availability(key, taxonomy)
        if enabled and mutation_active:
            enabled = False
            reason = f"פעולת תחזוקה אחרת פעילה כעת: {mutation_action or 'פעולה אחרת'}"
        actions.append({
            "key": key,
            "label": action.label,
            "description": action.description,
            "disabled": not enabled,
            "disabledReason": reason,
        })
    payload = {
        "apiVersion": API_VERSION,
        "catalogs": [normalize_catalog_for_ui(item) for item in config],
        "taxonomy": taxonomy,
        "footer": read_footer_content(PROJECT_ROOT),
        "footerEditor": footer_editor_schema(),
        "counts": {
            "catalogs": len(config),
            "pdfs": len(iter_pdf_files()),
            "missingPdfs": missing_pdf_count(config),
            "configuredMissingPdfs": len(missing_configured),
            "ocrDisabled": sum(1 for item in config if not catalog_ocr_enabled(item)),
            "converted": sum(1 for item in config if catalog_output_status(str(item.get("id", ""))).get("state") == "ready"),
            "taxonomyMissing": taxonomy_missing,
        },
        "files": {
            "config": rel_to_root(CONFIG_FILE),
            "taxonomy": rel_to_root(TAXONOMY_FILE),
            "generated": (PROJECT_ROOT / "catalogs.generated.module.js").is_file(),
            "search": (PROJECT_ROOT / "catalogs.search-index.json").is_file(),
            "pdfDir": rel_to_root(PDF_DIR),
            "pagesDir": rel_to_root(PAGES_DIR),
            "footerContent": rel_to_root(FOOTER_CONTENT_FILE),
        },
        "pdfFiles": pdf_files_payload(),
        "configuredMissingPdfs": missing_configured,
        "mutation": {
            "active": mutation_active,
            "action": mutation_action,
            "startedAt": mutation.get("startedAt") or (active_job.started_at if active_job else None),
        },
        "actions": actions,
        "jobs": job_summaries,
    }
    validate_control_panel_payload("ControlPanelStateDto", payload)
    return payload

@dataclass(frozen=True)
class ControlServerSettings:
    bind_host: str
    port: int
    allowed_hosts: frozenset[str]
    remote_mode: bool
    token: str | None = None


class ControlHTTPServer(ThreadingHTTPServer):
    def __init__(self, address: tuple[str, int], settings: ControlServerSettings) -> None:
        super().__init__(address, ControlHandler)
        self.settings = settings


def _normalized_hostname(value: str) -> str:
    raw = value.strip().lower()
    if not raw:
        return ""
    literal = raw.strip("[]")
    try:
        return str(ipaddress.ip_address(literal))
    except ValueError:
        pass
    try:
        parsed = urlparse(f"//{raw}")
        return str(parsed.hostname or "").rstrip(".")
    except ValueError:
        return ""


def _is_loopback_host(host: str) -> bool:
    normalized = _normalized_hostname(host)
    if normalized == "localhost":
        return True
    try:
        return ipaddress.ip_address(normalized).is_loopback
    except ValueError:
        return False


def build_server_settings(
    host: str,
    port: int,
    *,
    allow_remote: bool = False,
    allowed_hosts: Sequence[str] = (),
    token: str | None = None,
) -> ControlServerSettings:
    normalized_bind = _normalized_hostname(host)
    local = _is_loopback_host(normalized_bind)
    if not local and not allow_remote:
        raise ValueError("Binding the control panel outside loopback requires --allow-remote")

    normalized_allowed = {_normalized_hostname(item) for item in allowed_hosts}
    normalized_allowed.discard("")
    if local:
        normalized_allowed.update({"localhost", "127.0.0.1", "::1"})
        if normalized_bind:
            normalized_allowed.add(normalized_bind)
    else:
        if normalized_bind not in {"0.0.0.0", "::"}:
            normalized_allowed.add(normalized_bind)
        if not normalized_allowed:
            raise ValueError("Remote mode requires at least one --allowed-host")

    remote_mode = not local
    normalized_token = str(token or "").strip() or None
    if remote_mode and normalized_token is not None and len(normalized_token) < 20:
        raise ValueError("Remote control token must contain at least 20 characters")
    if remote_mode and normalized_token is None:
        normalized_token = secrets.token_urlsafe(32)
    if not remote_mode:
        normalized_token = None

    return ControlServerSettings(
        bind_host=host,
        port=int(port),
        allowed_hosts=frozenset(normalized_allowed),
        remote_mode=remote_mode,
        token=normalized_token,
    )


class ControlHandler(BaseHTTPRequestHandler):
    server_version = "CatalogControlPanel/2.0"

    @property
    def control_settings(self) -> ControlServerSettings:
        server = cast(ControlHTTPServer, self.server)
        return server.settings

    def _request_token(self) -> str:
        header = str(self.headers.get("X-Control-Token", "") or "").strip()
        if header:
            return header
        cookie = SimpleCookie()
        try:
            cookie.load(str(self.headers.get("Cookie", "") or ""))
        except Exception:
            return ""
        morsel = cookie.get("catalog_control_token")
        return morsel.value if morsel else ""

    def _validate_request_security(self, *, require_origin: bool) -> None:
        settings = self.control_settings
        host = _normalized_hostname(str(self.headers.get("Host", "") or ""))
        if not host or host not in settings.allowed_hosts:
            raise ApiRequestError(HTTPStatus.FORBIDDEN, "Host is not allowed")

        fetch_site = str(self.headers.get("Sec-Fetch-Site", "") or "").lower()
        if fetch_site == "cross-site":
            raise ApiRequestError(HTTPStatus.FORBIDDEN, "Cross-site request is not allowed")

        origin = str(self.headers.get("Origin", "") or "").strip()
        if require_origin and settings.remote_mode and not origin:
            raise ApiRequestError(HTTPStatus.FORBIDDEN, "Origin header is required in remote mode")
        if origin:
            parsed_origin = urlparse(origin)
            if parsed_origin.scheme not in {"http", "https"}:
                raise ApiRequestError(HTTPStatus.FORBIDDEN, "Origin is not allowed")
            origin_host = str(parsed_origin.hostname or "").lower().rstrip(".")
            origin_port = parsed_origin.port or (443 if parsed_origin.scheme == "https" else 80)
            if origin_host not in settings.allowed_hosts or origin_port != settings.port:
                raise ApiRequestError(HTTPStatus.FORBIDDEN, "Origin is not allowed")

        if settings.token and not hmac.compare_digest(self._request_token(), settings.token):
            raise ApiRequestError(HTTPStatus.UNAUTHORIZED, "Control token is required")

    def _accept_token_bootstrap(self, parsed: ParseResult) -> bool:
        settings = self.control_settings
        if not settings.token or parsed.path not in {"/", "", "/catalog-control-panel", "/catalog-control-panel/", "/catalog-control-panel.html"}:
            return False
        supplied = (parse_qs(parsed.query).get("token") or [""])[0]
        if not supplied or not hmac.compare_digest(supplied, settings.token):
            return False
        host = _normalized_hostname(str(self.headers.get("Host", "") or ""))
        if host not in settings.allowed_hosts:
            raise ApiRequestError(HTTPStatus.FORBIDDEN, "Host is not allowed")
        self.send_response(HTTPStatus.FOUND)
        self._send_security_headers()
        self.send_header("Location", "/catalog-control-panel.html")
        self.send_header(
            "Set-Cookie",
            f"catalog_control_token={settings.token}; HttpOnly; SameSite=Strict; Path=/",
        )
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.end_headers()
        return True

    def do_GET(self) -> None:  # noqa: N802
        try:
            parsed = urlparse(self.path)
            if self._accept_token_bootstrap(parsed):
                return
            self._validate_request_security(require_origin=False)
            path = unquote(parsed.path)
            if path in {"/", ""}:
                self.redirect("/catalog-control-panel.html")
                return
            if path in {"/catalog-control-panel", "/catalog-control-panel/"}:
                self.redirect("/catalog-control-panel.html")
                return
            if path == "/api/state":
                self.send_contract_json("ControlPanelStateDto", state_payload())
                return
            if path == "/api/pdfs":
                self.send_contract_json("PdfListResponseDto", {"pdfs": pdf_files_payload(), "pdfDir": rel_to_root(PDF_DIR)})
                return
            if path == "/api/jobs":
                with jobs_lock:
                    payload = [serialize_job(job, include_log=False) for job in sorted(jobs.values(), key=lambda item: item.started_at, reverse=True)]
                self.send_contract_json("JobListResponseDto", {"jobs": payload})
                return
            if path.startswith("/api/jobs/"):
                job_id = path.rsplit("/", 1)[-1]
                with jobs_lock:
                    job = jobs.get(job_id)
                    job_payload = serialize_job(job) if job else None
                if not job_payload:
                    self.send_error_json(HTTPStatus.NOT_FOUND, "Job not found")
                    return
                self.send_contract_json("ControlJobDto", job_payload)
                return
            self.serve_static(path)
        except ApiRequestError as exc:
            self.send_error_json(exc.status, str(exc))
        except Exception as exc:
            print(f"ERROR: GET {self.path}: {exc}", file=sys.stderr)
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "Internal server error")

    def do_POST(self) -> None:  # noqa: N802
        try:
            parsed = urlparse(self.path)
            self._validate_request_security(require_origin=True)
            path = unquote(parsed.path)
            if path == "/api/pdf-pick-native":
                pick_request = read_json_body(self)
                validate_request_payload("PdfPickRequestDto", pick_request)
                picked = pick_native_pdf_file()
                if picked.get("canceled"):
                    self.send_contract_json("PdfPickResponseDto", {"ok": True, "canceled": True, "errors": picked.get("errors", [])})
                    return
                self.send_contract_json("PdfPickResponseDto", {"ok": True, "pdf": picked["pdf"], "pdfFiles": pdf_files_payload(), "state": state_payload()})
                return
            if path == "/api/pdf-upload":
                filename, content = read_multipart_pdf_upload(self)
                upload = save_uploaded_pdf(filename, content)
                self.send_contract_json("PdfUploadResponseDto", {"ok": True, "pdf": upload, "pdfFiles": pdf_files_payload(), "state": state_payload()})
                return

            cancel_match = re.fullmatch(r"/api/jobs/([a-z0-9]+)/cancel", path)
            if cancel_match:
                cancel_request = read_json_body(self)
                validate_request_payload("EmptyRequestDto", cancel_request)
                job = cancel_job(cancel_match.group(1))
                self.send_contract_json("CancelJobResponseDto", {"ok": True, "job": serialize_job(job)})
                return

            payload = read_json_body(self)
            if path == "/api/footer":
                footer_request = FooterSaveRequest.parse(payload)
                with footer_save_lock:
                    with ProjectMutationLock(PROJECT_ROOT, "שמירת הפוטר מלוח השליטה"):
                        footer = save_footer_content_and_render_pages(footer_request.footer)
                self.send_contract_json("FooterSaveResponseDto", {"ok": True, "footer": footer, "state": state_payload(), "updatedPages": [page.filename for page in PAGE_DOCUMENTS]})
                return
            if path == "/api/catalogs":
                catalog_request = CatalogSaveRequest.parse(payload)
                with taxonomy_save_lock:
                    result = save_catalogs_transactionally(
                        catalog_request.catalogs,
                        catalog_request.taxonomy,
                        catalog_request.asset_deletes,
                    )
                self.send_contract_json("CatalogSaveResponseDto", {
                    "ok": True,
                    "state": state_payload(),
                    "warnings": result["warnings"],
                    "autoAddedTaxonomy": result["autoAddedTaxonomy"],
                    "grouped": True,
                    "deletedAssets": result["deletedAssets"],
                    "routeLockUpdates": result["routeLockUpdates"],
                })
                return
            if path == "/api/taxonomy":
                taxonomy_request = TaxonomySaveRequest.parse(payload)
                with taxonomy_save_lock:
                    result = save_taxonomy_transactionally(taxonomy_request.taxonomy)
                self.send_contract_json("TaxonomySaveResponseDto", {
                    "ok": True,
                    "state": state_payload(),
                    "warnings": result["warnings"],
                    "autoAddedTaxonomy": result["autoAddedTaxonomy"],
                    "routeLockUpdates": result["routeLockUpdates"],
                })
                return
            if path == "/api/run":
                run_request = RunActionRequest.parse(payload)
                validate_missing_pdf_confirmation(run_request)
                job = start_job(
                    run_request.action,
                    prune_missing_pdfs=run_request.prune_missing_pdfs,
                    confirmed_missing_pdf_ids=run_request.confirmed_missing_pdf_ids,
                )
                self.send_contract_json("RunActionResponseDto", {"ok": True, "job": serialize_job(job)})
                return
            self.send_error_json(HTTPStatus.NOT_FOUND, "Unknown API route")
        except ApiRequestError as exc:
            self.send_error_json(exc.status, str(exc))
        except (ValueError, MutationBusyError) as exc:
            self.send_error_json(HTTPStatus.BAD_REQUEST, str(exc))
        except Exception as exc:
            print(f"ERROR: POST {self.path}: {exc}", file=sys.stderr)
            self.send_error_json(HTTPStatus.INTERNAL_SERVER_ERROR, "Internal server error")

    def serve_static(self, url_path: str) -> None:
        file_path = STATIC_FILES.get(url_path)
        if file_path is None or not file_path.is_file():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        content_types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
        }
        content_type = content_types.get(file_path.suffix.lower(), "application/octet-stream")
        raw = file_path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self._send_security_headers()
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _send_security_headers(self) -> None:
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")

    def send_contract_json(self, contract: str, payload: object, status: HTTPStatus = HTTPStatus.OK) -> None:
        try:
            validate_control_panel_payload(contract, payload)
        except ControlPanelSchemaError as exc:
            raise RuntimeError(f"Control-panel response violates {contract}: {exc}") from exc
        self.send_json(payload, status=status)

    def send_json(self, payload: object, status: HTTPStatus = HTTPStatus.OK) -> None:
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._send_security_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def send_error_json(self, status: HTTPStatus, message: str) -> None:
        self.send_contract_json("ErrorResponseDto", {"ok": False, "error": message}, status=status)

    def redirect(self, location: str) -> None:
        self.send_response(HTTPStatus.FOUND)
        self._send_security_headers()
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, format: str, *args: object) -> None:
        print(f"[{self.log_date_time_string()}] {format % args}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Open the local catalog control panel.")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Bind address. Default: 127.0.0.1")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Local port. Default: 8765")
    parser.add_argument("--no-open", action="store_true", help="Do not open the browser automatically")
    parser.add_argument("--allow-remote", action="store_true", help="Explicitly permit a non-loopback bind")
    parser.add_argument("--allowed-host", action="append", default=[], help="Host name/IP accepted in remote mode; repeat as needed")
    parser.add_argument("--token", default="", help="Remote access token; generated automatically when omitted")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        with ProjectMutationLock(PROJECT_ROOT, "בדיקת ושחזור מצב הפרויקט לפני פתיחת לוח השליטה") as lock:
            if lock.recovered_transactions:
                print(f"Recovered {len(lock.recovered_transactions)} interrupted project transaction(s).")
    except MutationBusyError:
        # Another valid worker may already be active.  The panel can still open,
        # display that operation and keep all mutation actions disabled.
        pass
    except Exception as exc:
        print(f"ERROR: Failed to recover the project before starting the control panel: {exc}", file=sys.stderr)
        return 1
    try:
        settings = build_server_settings(
            str(args.host),
            int(args.port),
            allow_remote=bool(args.allow_remote),
            allowed_hosts=tuple(args.allowed_host),
            token=str(args.token or ""),
        )
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 2
    server = ControlHTTPServer((settings.bind_host, settings.port), settings)
    display_host = next(iter(sorted(settings.allowed_hosts))) if settings.remote_mode else settings.bind_host
    url = f"http://{display_host}:{settings.port}/catalog-control-panel.html"
    open_url = f"{url}?token={settings.token}" if settings.token else url
    print(f"Catalog control panel: {url}")
    if settings.remote_mode:
        print("WARNING: Remote control mode is enabled. Keep the token private and stop the server when finished.")
        print(f"One-time authenticated URL: {open_url}")
    print("Press Ctrl+C to stop.")
    if not args.no_open:
        threading.Timer(0.5, lambda: webbrowser.open(open_url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
        return 0
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
