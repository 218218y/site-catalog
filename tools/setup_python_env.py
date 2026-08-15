#!/usr/bin/env python3
"""Create and maintain the project's isolated Python development environment.

The environment lives in ``.venv`` and contains both catalog build requirements
and development tooling.  Freshness is tied to the pinned requirements *and*
the canonical Python runtime contract, so a runtime change cannot leave an old
virtual environment incorrectly marked as current.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import venv
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Sequence

from python_toolchain import (
    PYTHON_VERSION_FILE,
    PythonRuntimeIdentity,
    inspect_python_runtime,
    read_python_version_pin,
    require_current_runtime,
    runtime_identity_from_json,
    runtime_matches_pin,
)

REQUIRED_IMPORTS: tuple[str, ...] = ("pytest", "fitz", "PIL", "ruff", "mypy")
PINNED_DISTRIBUTIONS: dict[str, str] = {
    "PyMuPDF": "1.28.0",
    "Pillow": "12.3.0",
    "pytest": "9.1.1",
    "iniconfig": "2.3.0",
    "packaging": "26.2",
    "pluggy": "1.6.0",
    "Pygments": "2.20.0",
    "ruff": "0.16.1",
    "mypy": "2.3.0",
}
WINDOWS_PINNED_DISTRIBUTIONS: dict[str, str] = {"colorama": "0.4.6"}
STAMP_NAME = ".site-catalog-environment.json"
STAMP_FORMAT = 1


@dataclass(frozen=True)
class EnvironmentStamp:
    format: int
    environment_fingerprint: str
    runtime: PythonRuntimeIdentity

    def to_json(self) -> str:
        return json.dumps(
            {
                "format": self.format,
                "environment_fingerprint": self.environment_fingerprint,
                "runtime": asdict(self.runtime),
            },
            ensure_ascii=False,
            sort_keys=True,
            indent=2,
        ) + "\n"


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def venv_python_path(root: Path, *, platform: str | None = None) -> Path:
    platform_name = platform or os.name
    relative = Path("Scripts/python.exe") if platform_name == "nt" else Path("bin/python")
    return root / ".venv" / relative


def requirements_files(root: Path) -> tuple[Path, ...]:
    return (
        root / PYTHON_VERSION_FILE,
        root / "tools" / "requirements.txt",
        root / "tools" / "requirements-dev.txt",
    )


def environment_fingerprint(root: Path) -> str:
    digest = hashlib.sha256()
    for path in requirements_files(root):
        if not path.is_file():
            raise FileNotFoundError(f"Missing Python environment input: {path}")
        digest.update(path.relative_to(root).as_posix().encode("utf-8"))
        digest.update(b"\0")
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def missing_imports(python: Path | str, modules: Sequence[str] = REQUIRED_IMPORTS) -> tuple[str, ...]:
    script = (
        "import importlib.util, json; "
        f"modules = {list(modules)!r}; "
        "print(json.dumps([name for name in modules if importlib.util.find_spec(name) is None]))"
    )
    try:
        result = subprocess.run(
            (str(python), "-c", script),
            check=True,
            capture_output=True,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return tuple(modules)

    try:
        payload = json.loads(result.stdout.strip() or "[]")
    except json.JSONDecodeError:
        return tuple(modules)
    return tuple(str(name) for name in payload)


def expected_pinned_distributions(*, platform: str | None = None) -> dict[str, str]:
    expected = dict(PINNED_DISTRIBUTIONS)
    if (platform or os.name) == "nt":
        expected.update(WINDOWS_PINNED_DISTRIBUTIONS)
    return expected


def mismatched_distribution_versions(
    python: Path | str,
    expected: dict[str, str] | None = None,
) -> tuple[str, ...]:
    pinned = expected or expected_pinned_distributions()
    script = f"""
import importlib.metadata
import json

expected = {pinned!r}
result = []
for name, version in expected.items():
    try:
        actual = importlib.metadata.version(name)
    except importlib.metadata.PackageNotFoundError:
        result.append(f"{{name}} (missing)")
        continue
    if actual != version:
        result.append(f"{{name}}=={{actual}} (expected {{version}})")
print(json.dumps(result))
"""
    try:
        result = subprocess.run(
            (str(python), "-c", script),
            check=True,
            capture_output=True,
            text=True,
        )
    except (FileNotFoundError, subprocess.CalledProcessError):
        return tuple(f"{name} (unavailable)" for name in pinned)

    try:
        payload = json.loads(result.stdout.strip() or "[]")
    except json.JSONDecodeError:
        return tuple(f"{name} (unreadable)" for name in pinned)
    return tuple(str(item) for item in payload)


def _load_environment_stamp(path: Path) -> EnvironmentStamp | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return None
    if not isinstance(payload, dict):
        return None
    stamp_format = payload.get("format")
    fingerprint = payload.get("environment_fingerprint")
    runtime = runtime_identity_from_json(payload.get("runtime"))
    if stamp_format != STAMP_FORMAT or not isinstance(fingerprint, str) or runtime is None:
        return None
    return EnvironmentStamp(stamp_format, fingerprint, runtime)


def environment_is_current(root: Path, python: Path, fingerprint: str) -> bool:
    if not python.is_file():
        return False
    stamp = _load_environment_stamp(root / ".venv" / STAMP_NAME)
    if stamp is None or stamp.environment_fingerprint != fingerprint:
        return False
    runtime = inspect_python_runtime(python)
    if runtime is None or runtime != stamp.runtime:
        return False
    pin = read_python_version_pin(root)
    if not runtime_matches_pin(runtime, pin):
        return False
    return not missing_imports(python) and not mismatched_distribution_versions(python)


def _environment_requires_rebuild(root: Path, python: Path) -> bool:
    if not python.is_file():
        return True
    runtime = inspect_python_runtime(python)
    if runtime is None or not runtime_matches_pin(runtime, read_python_version_pin(root)):
        return True
    stamp = _load_environment_stamp(root / ".venv" / STAMP_NAME)
    return stamp is None or stamp.runtime != runtime


def _recreate_environment(environment_dir: Path, *, quiet: bool) -> None:
    if environment_dir.exists():
        if not quiet:
            print(f"Removing stale Python environment: {environment_dir}")
        shutil.rmtree(environment_dir)
    if not quiet:
        print(f"Creating isolated Python environment: {environment_dir}")
    venv.EnvBuilder(with_pip=True).create(environment_dir)


def create_or_update_environment(root: Path, *, quiet: bool = False) -> Path:
    root = root.resolve()
    host_runtime = require_current_runtime(root)
    environment_dir = root / ".venv"
    python = venv_python_path(root)
    fingerprint = environment_fingerprint(root)

    if environment_is_current(root, python, fingerprint):
        if not quiet:
            print(f"Python environment is ready: {python}")
        return python

    if _environment_requires_rebuild(root, python):
        _recreate_environment(environment_dir, quiet=quiet)
        python = venv_python_path(root)

    environment_runtime = inspect_python_runtime(python)
    if environment_runtime is None or not runtime_matches_pin(
        environment_runtime,
        read_python_version_pin(root),
    ):
        raise RuntimeError(
            f"Virtual environment does not use required Python {host_runtime.version_text}: {python}"
        )

    requirements = root / "tools" / "requirements-dev.txt"
    if not quiet:
        print(f"Installing Python development requirements from {requirements.relative_to(root)}")
    subprocess.run(
        (
            str(python),
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "-r",
            str(requirements),
        ),
        cwd=root,
        check=True,
    )

    missing = missing_imports(python)
    if missing:
        raise RuntimeError(
            "Python environment was created, but required modules are still missing: "
            + ", ".join(missing)
        )

    mismatched = mismatched_distribution_versions(python)
    if mismatched:
        raise RuntimeError(
            "Python environment was installed, but pinned versions do not match: "
            + "; ".join(mismatched)
        )

    runtime = inspect_python_runtime(python)
    if runtime is None:
        raise RuntimeError(f"Could not inspect managed Python runtime: {python}")
    stamp = EnvironmentStamp(STAMP_FORMAT, fingerprint, runtime)
    (environment_dir / STAMP_NAME).write_text(stamp.to_json(), encoding="utf-8")
    if not quiet:
        print(f"Python environment is ready: {python}")
    return python


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress status messages when the environment is already current.",
    )
    args = parser.parse_args(argv)

    try:
        create_or_update_environment(project_root(), quiet=args.quiet)
    except (FileNotFoundError, RuntimeError, ValueError, subprocess.CalledProcessError) as exc:
        print(f"\nPYTHON ENVIRONMENT SETUP FAILED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
