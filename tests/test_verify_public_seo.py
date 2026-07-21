from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location(
    "verify_public_seo_module", TOOLS / "verify_public_seo.py"
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def artifact_state(*, digest: str = "a" * 64) -> dict[str, object]:
    return {
        "sourceSignature": "source-signature",
        "options": {"seoMode": "public", "confirmPublicIndexing": True},
        "outputFiles": {
            "index.html": {"sha256": digest, "size": 123, "mtimeNs": 456},
        },
    }


def test_public_build_command_reuses_current_artifact_unless_forced(tmp_path: Path) -> None:
    root = tmp_path / "project"
    out = root / "dist" / "site-public-preview"

    cached = MODULE.public_build_command(root, out, skip_if_current=True)
    forced = MODULE.public_build_command(root, out, skip_if_current=False)

    assert "--skip-if-current" in cached
    assert "--skip-if-current" not in forced
    assert cached[-2:] == ("--confirm-public-indexing", "--skip-if-current")


def test_audit_signature_tracks_artifact_and_validator_contents(tmp_path: Path) -> None:
    root = tmp_path / "project"
    for relative in MODULE.AUDIT_INPUT_FILES:
        path = root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(relative, encoding="utf-8")

    first = MODULE.audit_signature(root, artifact_state())
    changed_artifact = MODULE.audit_signature(root, artifact_state(digest="b" * 64))
    (root / MODULE.AUDIT_INPUT_FILES[0]).write_text("changed validator", encoding="utf-8")
    changed_validator = MODULE.audit_signature(root, artifact_state())

    assert first != changed_artifact
    assert first != changed_validator


def test_repeated_verification_reuses_passed_audit_receipt(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    out = root / "dist" / "site-public-preview"
    out.mkdir(parents=True)
    state = artifact_state()
    audit_calls: list[Path] = []

    monkeypatch.setattr(MODULE, "assert_route_lock_current", lambda _root: None)
    monkeypatch.setattr(MODULE.subprocess, "run", lambda *args, **kwargs: None)
    monkeypatch.setattr(MODULE, "load_artifact_state", lambda _out: state)
    monkeypatch.setattr(MODULE, "audit_signature", lambda _root, _state: "audit-signature")
    monkeypatch.setattr(
        MODULE,
        "audit_local_bundle",
        lambda bundle, _root: audit_calls.append(bundle) or [],
    )
    monkeypatch.setattr(MODULE, "print_result", lambda _label, issues: int(bool(issues)))

    assert MODULE.verify_public_seo(root, out) == 0
    assert MODULE.verify_public_seo(root, out) == 0

    assert audit_calls == [out]
    receipt = MODULE.load_audit_state(out)
    assert receipt and receipt["result"] == "pass"
    assert receipt["htmlDocuments"] == 1


def test_failed_audit_is_never_mirrored_or_cached(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    out = root / "dist" / "site-public-preview"
    mirror = root / "dist" / "site-upload-r2"
    out.mkdir(parents=True)
    mirrored: list[Path] = []

    monkeypatch.setattr(MODULE, "assert_route_lock_current", lambda _root: None)
    monkeypatch.setattr(MODULE.subprocess, "run", lambda *args, **kwargs: None)
    monkeypatch.setattr(MODULE, "load_artifact_state", lambda _out: artifact_state())
    monkeypatch.setattr(MODULE, "audit_signature", lambda _root, _state: "audit-signature")
    monkeypatch.setattr(MODULE, "audit_local_bundle", lambda _bundle, _root: ["broken"])
    monkeypatch.setattr(MODULE, "print_result", lambda _label, _issues: 1)
    monkeypatch.setattr(
        MODULE,
        "mirror_artifact",
        lambda _root, _source, target: mirrored.append(target),
    )

    assert MODULE.verify_public_seo(root, out, mirror_dirs=(mirror,)) == 1
    assert mirrored == []
    assert not MODULE.audit_state_path(out).exists()


def test_passed_public_artifact_can_be_mirrored_without_a_second_build(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    out = root / "dist" / "site-public-preview"
    mirror = root / "dist" / "site-upload-r2"
    out.mkdir(parents=True)
    mirrored: list[tuple[Path, Path]] = []

    monkeypatch.setattr(MODULE, "assert_route_lock_current", lambda _root: None)
    monkeypatch.setattr(MODULE.subprocess, "run", lambda *args, **kwargs: None)
    monkeypatch.setattr(MODULE, "load_artifact_state", lambda _out: artifact_state())
    monkeypatch.setattr(MODULE, "audit_signature", lambda _root, _state: "audit-signature")
    monkeypatch.setattr(MODULE, "audit_is_current", lambda _out, signature: True)
    monkeypatch.setattr(MODULE, "load_audit_state", lambda _out: {"htmlDocuments": 1})
    monkeypatch.setattr(
        MODULE,
        "mirror_artifact",
        lambda _root, source, target: mirrored.append((source, target)),
    )

    assert MODULE.verify_public_seo(root, out, mirror_dirs=(mirror,)) == 0
    assert mirrored == [(out, mirror)]
