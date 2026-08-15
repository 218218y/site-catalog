#!/usr/bin/env python3
"""Canonical Python runtime contract shared by project tooling.

The project pins one Python major/minor line in ``.python-version``.  Python
bootstrap, diagnostics, CI, static analysis and the Node launcher all derive
from that contract instead of carrying independent minimum-version rules.
"""
from __future__ import annotations

import json
import platform
import re
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Mapping

PYTHON_VERSION_FILE = ".python-version"
_VERSION_PATTERN = re.compile(r"(?P<major>[0-9]+)\.(?P<minor>[0-9]+)")
RuntimeProbeRunner = Callable[..., subprocess.CompletedProcess[str]]


@dataclass(frozen=True)
class PythonVersionPin:
    major: int
    minor: int

    @property
    def text(self) -> str:
        return f"{self.major}.{self.minor}"


@dataclass(frozen=True)
class PythonRuntimeIdentity:
    major: int
    minor: int
    implementation: str
    cache_tag: str
    system: str
    machine: str

    @property
    def version_text(self) -> str:
        return f"{self.major}.{self.minor}"


def read_python_version_pin(root: Path) -> PythonVersionPin:
    path = root / PYTHON_VERSION_FILE
    if not path.is_file():
        raise FileNotFoundError(f"Missing Python toolchain pin: {path}")
    value = path.read_text(encoding="utf-8").strip()
    match = _VERSION_PATTERN.fullmatch(value)
    if match is None:
        raise ValueError(
            f"Invalid {PYTHON_VERSION_FILE}: expected '<major>.<minor>', got {value!r}"
        )
    return PythonVersionPin(int(match.group("major")), int(match.group("minor")))


def current_runtime_identity() -> PythonRuntimeIdentity:
    return PythonRuntimeIdentity(
        major=sys.version_info.major,
        minor=sys.version_info.minor,
        implementation=sys.implementation.name,
        cache_tag=sys.implementation.cache_tag or "",
        system=platform.system(),
        machine=platform.machine(),
    )


def _runtime_probe_script() -> str:
    return """
import json
import platform
import sys
print(json.dumps({
    "major": sys.version_info.major,
    "minor": sys.version_info.minor,
    "implementation": sys.implementation.name,
    "cache_tag": sys.implementation.cache_tag or "",
    "system": platform.system(),
    "machine": platform.machine(),
}))
"""


def _runtime_from_mapping(value: Mapping[str, object]) -> PythonRuntimeIdentity | None:
    major = value.get("major")
    minor = value.get("minor")
    implementation = value.get("implementation")
    cache_tag = value.get("cache_tag")
    system = value.get("system")
    machine = value.get("machine")
    if isinstance(major, bool) or not isinstance(major, int):
        return None
    if isinstance(minor, bool) or not isinstance(minor, int):
        return None
    if not isinstance(implementation, str):
        return None
    if not isinstance(cache_tag, str):
        return None
    if not isinstance(system, str):
        return None
    if not isinstance(machine, str):
        return None
    return PythonRuntimeIdentity(
        major=major,
        minor=minor,
        implementation=implementation,
        cache_tag=cache_tag,
        system=system,
        machine=machine,
    )


def inspect_python_runtime(
    python: Path | str,
    *,
    runner: RuntimeProbeRunner | None = None,
) -> PythonRuntimeIdentity | None:
    try:
        if runner is None:
            completed = subprocess.run(
                (str(python), "-c", _runtime_probe_script()),
                check=True,
                capture_output=True,
                text=True,
            )
        else:
            completed = runner(
                (str(python), "-c", _runtime_probe_script()),
                check=True,
                capture_output=True,
                text=True,
            )
    except (FileNotFoundError, OSError, subprocess.CalledProcessError):
        return None
    try:
        payload = json.loads(completed.stdout)
    except (json.JSONDecodeError, TypeError):
        return None
    if not isinstance(payload, dict):
        return None
    return _runtime_from_mapping(payload)


def runtime_matches_pin(identity: PythonRuntimeIdentity, pin: PythonVersionPin) -> bool:
    return identity.major == pin.major and identity.minor == pin.minor


def require_current_runtime(root: Path) -> PythonRuntimeIdentity:
    pin = read_python_version_pin(root)
    identity = current_runtime_identity()
    if not runtime_matches_pin(identity, pin):
        raise RuntimeError(
            f"Python {pin.text} is required by {PYTHON_VERSION_FILE}; "
            f"current interpreter is Python {identity.version_text}."
        )
    return identity


def runtime_identity_from_json(value: object) -> PythonRuntimeIdentity | None:
    if not isinstance(value, dict):
        return None
    return _runtime_from_mapping(value)
