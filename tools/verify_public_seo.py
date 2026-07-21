#!/usr/bin/env python3
"""Build and audit the guarded public SEO preview without deploying it.

The public preview is a persistent, validated build artifact. Repeated checks
reuse it when the declared build inputs are unchanged. A separate audit receipt
is keyed by the artifact contents and the audit implementation, so the costly
all-page scan is repeated whenever either changes but not on every test run.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Mapping, Sequence

from PIL import __version__ as PILLOW_VERSION

from audit_public_seo import audit_local_bundle, print_result
from build_deploy_bundle import (
    clean_legacy_artifacts,
    load_artifact_state,
    mirror_artifact,
    sha256_file,
)
from seo_route_lock import assert_route_lock_current


AUDIT_STATE_SCHEMA = 1
AUDIT_SIGNATURE_VERSION = "public-seo-audit-v1"
AUDIT_INPUT_FILES = (
    "tools/audit_public_seo.py",
    "tools/verify_public_seo.py",
    "tools/requirements.txt",
)


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def safe_output(root: Path, value: str) -> Path:
    candidate = (root / value).resolve() if not Path(value).is_absolute() else Path(value).resolve()
    if candidate == root or root not in candidate.parents:
        raise ValueError("Public SEO preview output must be inside the project directory")
    return candidate


def audit_state_path(out_dir: Path) -> Path:
    """Keep verification metadata beside the uploadable directory, never inside it."""

    return out_dir.with_name(f"{out_dir.name}.audit.json")


def normalized_output_inventory(state: Mapping[str, object]) -> dict[str, dict[str, object]]:
    """Return only content identity fields from a bundle build state."""

    raw_inventory = state.get("outputFiles")
    if not isinstance(raw_inventory, dict) or not raw_inventory:
        raise ValueError("Public SEO bundle state has no output inventory")

    inventory: dict[str, dict[str, object]] = {}
    for name, raw_record in sorted(raw_inventory.items()):
        if isinstance(raw_record, str):
            inventory[str(name)] = {"sha256": raw_record}
            continue
        if not isinstance(raw_record, dict) or not isinstance(raw_record.get("sha256"), str):
            raise ValueError(f"Public SEO bundle state has an invalid output record: {name}")
        inventory[str(name)] = {
            "sha256": raw_record["sha256"],
            "size": raw_record.get("size"),
        }
    return inventory


def audit_signature(root: Path, artifact_state: Mapping[str, object]) -> str:
    """Fingerprint the exact bundle contents and validator implementation."""

    validator_inputs: dict[str, str] = {}
    for relative in AUDIT_INPUT_FILES:
        path = root / relative
        if not path.is_file():
            raise FileNotFoundError(f"Public SEO audit input is missing: {relative}")
        validator_inputs[relative] = sha256_file(path)

    payload = {
        "signatureVersion": AUDIT_SIGNATURE_VERSION,
        "artifactSourceSignature": artifact_state.get("sourceSignature"),
        "artifactOptions": artifact_state.get("options"),
        "artifactFiles": normalized_output_inventory(artifact_state),
        "validatorInputs": validator_inputs,
        "validatorRuntime": {
            "python": ".".join(str(value) for value in sys.version_info[:3]),
            "pillow": PILLOW_VERSION,
        },
    }
    encoded = json.dumps(
        payload,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def load_audit_state(out_dir: Path) -> dict[str, object] | None:
    path = audit_state_path(out_dir)
    if not path.is_file():
        return None
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict) or payload.get("schema") != AUDIT_STATE_SCHEMA:
        return None
    return payload


def audit_is_current(out_dir: Path, *, signature: str) -> bool:
    state = load_audit_state(out_dir)
    return bool(
        state
        and state.get("result") == "pass"
        and state.get("auditSignature") == signature
    )


def write_audit_state(
    out_dir: Path,
    *,
    signature: str,
    artifact_state: Mapping[str, object],
) -> None:
    inventory = normalized_output_inventory(artifact_state)
    payload = {
        "schema": AUDIT_STATE_SCHEMA,
        "result": "pass",
        "auditSignature": signature,
        "artifactSourceSignature": artifact_state.get("sourceSignature"),
        "files": len(inventory),
        "htmlDocuments": sum(name.lower().endswith(".html") for name in inventory),
        "auditedAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    path = audit_state_path(out_dir)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
        newline="\n",
    )
    temporary.replace(path)


def public_build_command(
    root: Path,
    out_dir: Path,
    *,
    skip_if_current: bool,
) -> tuple[str, ...]:
    command = [
        sys.executable,
        "tools/build_deploy_bundle.py",
        "--out",
        out_dir.relative_to(root).as_posix(),
        "--seo-mode",
        "public",
        "--confirm-public-indexing",
    ]
    if skip_if_current:
        command.append("--skip-if-current")
    return tuple(command)


def verify_public_seo(
    root: Path,
    out_dir: Path,
    *,
    force_rebuild: bool = False,
    force_audit: bool = False,
    mirror_dirs: Sequence[Path] = (),
    clean_legacy: bool = False,
) -> int:
    assert_route_lock_current(root)
    subprocess.run(
        public_build_command(root, out_dir, skip_if_current=not force_rebuild),
        cwd=root,
        check=True,
    )

    artifact_state = load_artifact_state(out_dir)
    if artifact_state is None:
        raise ValueError("Public SEO bundle has no valid build state after the build completed")
    signature = audit_signature(root, artifact_state)

    if not force_rebuild and not force_audit and audit_is_current(out_dir, signature=signature):
        audit_state = load_audit_state(out_dir) or {}
        print(
            "[audit] Public SEO content and validators are unchanged; "
            f"reusing the passed audit of {audit_state.get('htmlDocuments', 0)} HTML documents."
        )
        result = 0
    else:
        print("[audit] Public SEO content or validators changed; auditing every generated page.")
        issues = audit_local_bundle(out_dir, root)
        result = print_result("Public SEO release preview", issues)
        if result == 0:
            write_audit_state(
                out_dir,
                signature=signature,
                artifact_state=artifact_state,
            )
        else:
            audit_state_path(out_dir).unlink(missing_ok=True)

    if result != 0:
        return result

    for mirror_dir in mirror_dirs:
        if mirror_dir == out_dir:
            raise ValueError("Public SEO mirror output must differ from the preview output")
        mirror_artifact(root, out_dir, mirror_dir)
    if clean_legacy:
        for relative in clean_legacy_artifacts(root):
            print(f"[cleanup] Removed obsolete generated folder: {relative}")

    print(f"Public SEO preview is current and fully audited: {out_dir.relative_to(root).as_posix()}")
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="dist/site-public-preview")
    parser.add_argument(
        "--force-rebuild",
        action="store_true",
        help="Rebuild the public preview even when its build signature is current.",
    )
    parser.add_argument(
        "--force-audit",
        action="store_true",
        help="Rescan every generated public page even when its audit receipt is current.",
    )
    parser.add_argument(
        "--mirror-to",
        action="append",
        default=[],
        help="After a passed audit, atomically mirror the exact public artifact to another dist folder. Repeatable.",
    )
    parser.add_argument(
        "--clean-legacy-artifacts",
        action="store_true",
        help="Remove obsolete generated dist folders after a passed audit.",
    )
    # Backward-compatible no-op: persistent reuse is now the safe default.
    parser.add_argument("--keep-existing", action="store_true", help=argparse.SUPPRESS)
    args = parser.parse_args(argv)
    root = project_root()
    try:
        out_dir = safe_output(root, args.out)
        mirror_dirs = tuple(safe_output(root, value) for value in args.mirror_to)
        return verify_public_seo(
            root,
            out_dir,
            force_rebuild=args.force_rebuild,
            force_audit=args.force_audit,
            mirror_dirs=mirror_dirs,
            clean_legacy=args.clean_legacy_artifacts,
        )
    except (ValueError, FileNotFoundError, OSError, subprocess.CalledProcessError) as exc:
        print(f"PUBLIC SEO VERIFICATION FAILED: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
