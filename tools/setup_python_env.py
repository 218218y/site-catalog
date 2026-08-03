#!/usr/bin/env python3
"""Create and maintain the project's isolated Python development environment.

The environment lives in ``.venv`` and contains both the catalog build
requirements and the test runner. A content fingerprint prevents unnecessary
``pip`` calls on later runs while import checks catch damaged environments.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import os
import subprocess
import sys
import venv
from pathlib import Path
from typing import Sequence

TOOLS_DIRECTORY = Path(__file__).resolve().parent
if str(TOOLS_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(TOOLS_DIRECTORY))

from python_offline_linux import (  # noqa: E402
    PythonOfflineMirrorError,
    WHEELHOUSE_DIRECTORY,
    has_wheelhouse,
    install_arguments as offline_python_install_arguments,
    is_target_host as is_python_offline_target_host,
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
STAMP_NAME = ".site-catalog-requirements.sha256"
PYTHON_OFFLINE_ENV_VAR = "SITE_CATALOG_PYTHON_OFFLINE"


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def venv_python_path(root: Path, *, platform: str | None = None) -> Path:
    platform_name = platform or os.name
    relative = Path("Scripts/python.exe") if platform_name == "nt" else Path("bin/python")
    return root / ".venv" / relative


def requirements_files(root: Path) -> tuple[Path, ...]:
    return (
        root / "tools" / "requirements.txt",
        root / "tools" / "requirements-dev.txt",
    )


def requirements_fingerprint(root: Path) -> str:
    digest = hashlib.sha256()
    for path in requirements_files(root):
        if not path.is_file():
            raise FileNotFoundError(f"Missing Python requirements file: {path}")
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

    import json

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

    import json

    try:
        payload = json.loads(result.stdout.strip() or "[]")
    except json.JSONDecodeError:
        return tuple(f"{name} (unreadable)" for name in pinned)
    return tuple(str(item) for item in payload)


def environment_is_current(root: Path, python: Path, fingerprint: str) -> bool:
    stamp = root / ".venv" / STAMP_NAME
    if not python.is_file() or not stamp.is_file():
        return False
    if stamp.read_text(encoding="utf-8").strip() != fingerprint:
        return False
    return not missing_imports(python) and not mismatched_distribution_versions(python)



def should_use_offline_wheelhouse(root: Path) -> bool:
    """Return whether setup should install Python deps from the Linux wheelhouse."""
    requested = os.environ.get(PYTHON_OFFLINE_ENV_VAR, "auto").strip().lower()
    if requested in {"0", "false", "no", "off"}:
        return False
    if requested in {"1", "true", "yes", "on", "required"}:
        return True
    return is_python_offline_target_host() and has_wheelhouse(root)


def pip_install_arguments(root: Path) -> tuple[str, ...]:
    if should_use_offline_wheelhouse(root):
        try:
            return offline_python_install_arguments(root)
        except PythonOfflineMirrorError as error:
            raise RuntimeError(f"Python offline wheelhouse is not usable: {error}") from error
    return ("-r", str(root / "tools" / "requirements-dev.txt"))

def create_or_update_environment(root: Path, *, quiet: bool = False) -> Path:
    root = root.resolve()
    environment_dir = root / ".venv"
    python = venv_python_path(root)
    fingerprint = requirements_fingerprint(root)

    if environment_is_current(root, python, fingerprint):
        if not quiet:
            print(f"Python environment is ready: {python}")
        return python

    if not python.is_file():
        if not quiet:
            print(f"Creating isolated Python environment: {environment_dir}")
        venv.EnvBuilder(with_pip=True).create(environment_dir)
        python = venv_python_path(root)

    install_args = pip_install_arguments(root)
    using_offline = "--no-index" in install_args
    if not quiet:
        if using_offline:
            print(f"Installing Python development requirements from {WHEELHOUSE_DIRECTORY.as_posix()}")
        else:
            requirements = root / "tools" / "requirements-dev.txt"
            print(f"Installing Python development requirements from {requirements.relative_to(root)}")
    subprocess.run(
        (
            str(python),
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            *install_args,
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

    (environment_dir / STAMP_NAME).write_text(fingerprint + "\n", encoding="utf-8")
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
    except (FileNotFoundError, RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"\nPYTHON ENVIRONMENT SETUP FAILED: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
