from __future__ import annotations

import importlib.util
import contextlib
import http.client
import io
import json
import socket
import sys
import threading
from email.message import Message
from http import HTTPStatus
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"


def load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, TOOLS / filename)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


API = load_module("catalog_control_api_security_tests", "catalog_control_api.py")
SERVER = load_module("catalog_control_server_security_tests", "catalog_control_server.py")


class TrackingStream(io.BytesIO):
    def __init__(self, initial_bytes: bytes = b"") -> None:
        super().__init__(initial_bytes)
        self.read_calls = 0

    def read(self, size: int = -1) -> bytes:
        self.read_calls += 1
        return super().read(size)


class DummyHandler:
    def __init__(self, *, headers: dict[str, str], body: bytes = b"") -> None:
        message = Message()
        for key, value in headers.items():
            message[key] = value
        self.headers = message
        self.rfile = TrackingStream(body)


def test_oversized_json_is_rejected_before_body_read() -> None:
    handler = DummyHandler(
        headers={
            "Content-Type": "application/json",
            "Content-Length": str(API.MAX_JSON_BODY_BYTES + 1),
        },
        body=b"must-not-be-read",
    )

    with pytest.raises(API.ApiRequestError) as error:
        API.read_json_object(handler)

    assert error.value.status == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    assert handler.rfile.read_calls == 0


def test_oversized_pdf_upload_is_rejected_before_body_read() -> None:
    handler = DummyHandler(
        headers={
            "Content-Type": "multipart/form-data; boundary=test-boundary",
            "Content-Length": str(API.MAX_PDF_UPLOAD_BYTES + 1),
        },
        body=b"must-not-be-read",
    )

    with pytest.raises(SERVER.ApiRequestError) as error:
        SERVER.read_multipart_pdf_upload(handler)

    assert error.value.status == HTTPStatus.REQUEST_ENTITY_TOO_LARGE
    assert handler.rfile.read_calls == 0


def test_json_reader_requires_complete_valid_object_payload() -> None:
    raw = json.dumps({"action": "convert"}).encode("utf-8")
    handler = DummyHandler(
        headers={"Content-Type": "application/json", "Content-Length": str(len(raw))},
        body=raw,
    )
    assert API.read_json_object(handler) == {"action": "convert"}

    truncated = DummyHandler(
        headers={"Content-Type": "application/json", "Content-Length": "20"},
        body=b"{}",
    )
    with pytest.raises(API.ApiRequestError, match="ended before"):
        API.read_json_object(truncated)


def test_remote_binding_requires_explicit_mode_allowed_host_and_token() -> None:
    with pytest.raises(ValueError, match="--allow-remote"):
        SERVER.build_server_settings("0.0.0.0", 8765)
    with pytest.raises(ValueError, match="--allowed-host"):
        SERVER.build_server_settings("0.0.0.0", 8765, allow_remote=True)

    settings = SERVER.build_server_settings(
        "0.0.0.0",
        8765,
        allow_remote=True,
        allowed_hosts=("192.168.1.20",),
    )
    assert settings.remote_mode is True
    assert settings.allowed_hosts == frozenset({"192.168.1.20"})
    assert settings.token and len(settings.token) >= 32


def test_loopback_mode_has_a_closed_host_allowlist_without_token() -> None:
    settings = SERVER.build_server_settings("127.0.0.1", 8765)
    assert settings.remote_mode is False
    assert settings.token is None
    assert {"localhost", "127.0.0.1", "::1"}.issubset(settings.allowed_hosts)


def test_api_dtos_reject_wrong_shapes() -> None:
    with pytest.raises(API.ApiRequestError, match="catalogs must be an array"):
        API.CatalogSaveRequest.parse({"catalogs": {}, "taxonomy": {}})
    with pytest.raises(API.ApiRequestError, match="pruneMissingPdfs must be a boolean"):
        API.RunActionRequest.parse({"action": "convert", "pruneMissingPdfs": "yes"})
    with pytest.raises(API.ApiRequestError, match="requires pruneMissingPdfs=true"):
        API.RunActionRequest.parse({
            "action": "convert",
            "confirmedMissingPdfIds": ["missing-a"],
        })


def test_missing_pdf_pruning_requires_an_exact_current_confirmation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        SERVER,
        "configured_missing_pdfs",
        lambda: [
            {"id": "missing-a", "title": "A", "pdf": "assets/pdfs/a.pdf"},
            {"id": "missing-b", "title": "B", "pdf": "assets/pdfs/b.pdf"},
        ],
    )
    stale = API.RunActionRequest.parse({
        "action": "convert",
        "pruneMissingPdfs": True,
        "confirmedMissingPdfIds": ["missing-a"],
    })
    with pytest.raises(SERVER.ApiRequestError) as error:
        SERVER.validate_missing_pdf_confirmation(stale)
    assert error.value.status == HTTPStatus.CONFLICT

    exact = API.RunActionRequest.parse({
        "action": "convert",
        "pruneMissingPdfs": True,
        "confirmedMissingPdfIds": ["missing-b", "missing-a"],
    })
    SERVER.validate_missing_pdf_confirmation(exact)

    wrong_action = API.RunActionRequest.parse({
        "action": "bundle_r2",
        "pruneMissingPdfs": True,
        "confirmedMissingPdfIds": ["missing-a", "missing-b"],
    })
    with pytest.raises(SERVER.ApiRequestError) as error:
        SERVER.validate_missing_pdf_confirmation(wrong_action)
    assert error.value.status == HTTPStatus.BAD_REQUEST


def _free_loopback_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(("127.0.0.1", 0))
        return int(probe.getsockname()[1])


@contextlib.contextmanager
def running_control_server(settings):
    server = SERVER.ControlHTTPServer(("127.0.0.1", settings.port), settings)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=3)


def test_http_boundary_serves_extracted_assets_with_security_headers() -> None:
    port = _free_loopback_port()
    settings = SERVER.build_server_settings("127.0.0.1", port)
    with running_control_server(settings):
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
        connection.request(
            "GET",
            "/catalog-control-panel.html",
            headers={"Host": f"127.0.0.1:{port}"},
        )
        response = connection.getresponse()
        body = response.read().decode("utf-8")
        assert response.status == HTTPStatus.OK
        assert "Content-Security-Policy" in response.headers
        assert "unsafe-inline" not in response.headers["Content-Security-Policy"]
        assert "catalog-control-panel.css" in body
        assert "catalog-control-panel.js" in body
        assert " style=" not in body
        connection.close()

        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
        connection.request(
            "GET",
            "/src/control-panel/features/catalogs.js",
            headers={"Host": f"127.0.0.1:{port}"},
        )
        module_response = connection.getresponse()
        module_body = module_response.read().decode("utf-8")
        assert module_response.status == HTTPStatus.OK
        assert module_response.headers["Content-Type"] == "text/javascript; charset=utf-8"
        assert module_response.headers["Cache-Control"] == "no-store"
        assert "export function createCatalogsFeature" in module_body
        connection.close()


def test_http_boundary_rejects_host_header_injection() -> None:
    port = _free_loopback_port()
    settings = SERVER.build_server_settings("127.0.0.1", port)
    with running_control_server(settings):
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
        connection.request("GET", "/api/state", headers={"Host": "attacker.invalid"})
        response = connection.getresponse()
        payload = json.loads(response.read().decode("utf-8"))
        assert response.status == HTTPStatus.FORBIDDEN
        assert payload["ok"] is False
        connection.close()


def test_remote_mode_requires_token_and_origin_for_mutations() -> None:
    port = _free_loopback_port()
    token = "a-secure-control-token-value"
    settings = SERVER.ControlServerSettings(
        bind_host="127.0.0.1",
        port=port,
        allowed_hosts=frozenset({"127.0.0.1"}),
        remote_mode=True,
        token=token,
    )
    with running_control_server(settings):
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
        headers = {
            "Host": f"127.0.0.1:{port}",
            "Content-Type": "application/json",
            "X-Control-Token": token,
        }
        connection.request("POST", "/api/not-found", body=b"{}", headers=headers)
        response = connection.getresponse()
        response.read()
        assert response.status == HTTPStatus.FORBIDDEN
        connection.close()

        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=3)
        headers["Origin"] = f"http://127.0.0.1:{port}"
        connection.request("POST", "/api/not-found", body=b"{}", headers=headers)
        response = connection.getresponse()
        response.read()
        assert response.status == HTTPStatus.NOT_FOUND
        connection.close()
