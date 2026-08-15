from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location("python_toolchain_test_module", TOOLS / "python_toolchain.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def test_python_version_baseline_is_strict_major_minor(tmp_path: Path) -> None:
    baseline_file = tmp_path / ".python-version"
    baseline_file.write_text("3.13\n", encoding="utf-8")
    assert MODULE.read_python_version_baseline(tmp_path).text == "3.13"

    for invalid in ("3", "3.13.5", ">=3.13", "python-3.13", ""):
        baseline_file.write_text(invalid, encoding="utf-8")
        try:
            MODULE.read_python_version_baseline(tmp_path)
        except ValueError:
            pass
        else:
            raise AssertionError(f"invalid Python baseline was accepted: {invalid!r}")


def test_runtime_policy_accepts_newer_minor_and_rejects_older_or_other_major(tmp_path: Path) -> None:
    (tmp_path / ".python-version").write_text("3.13\n", encoding="utf-8")
    baseline = MODULE.read_python_version_baseline(tmp_path)

    assert MODULE.runtime_satisfies_baseline(
        MODULE.PythonRuntimeIdentity(3, 13, "cpython", "cpython-313", "Windows", "AMD64"),
        baseline,
    )
    assert MODULE.runtime_satisfies_baseline(
        MODULE.PythonRuntimeIdentity(3, 14, "cpython", "cpython-314", "Windows", "AMD64"),
        baseline,
    )
    assert not MODULE.runtime_satisfies_baseline(
        MODULE.PythonRuntimeIdentity(3, 12, "cpython", "cpython-312", "Windows", "AMD64"),
        baseline,
    )
    assert not MODULE.runtime_satisfies_baseline(
        MODULE.PythonRuntimeIdentity(4, 0, "cpython", "cpython-400", "Windows", "AMD64"),
        baseline,
    )


def test_require_supported_current_runtime_rejects_unsupported_baseline(tmp_path: Path) -> None:
    (tmp_path / ".python-version").write_text(
        f"{sys.version_info.major}.{sys.version_info.minor + 1}\n",
        encoding="utf-8",
    )
    try:
        MODULE.require_supported_current_runtime(tmp_path)
    except RuntimeError as error:
        assert ".python-version" in str(error)
    else:
        raise AssertionError("runtime below the compatibility baseline was accepted")


def test_runtime_identity_parser_is_fail_closed() -> None:
    assert MODULE.runtime_identity_from_json({"major": 3}) is None
    assert MODULE.runtime_identity_from_json({
        "major": True,
        "minor": 13,
        "implementation": "cpython",
        "cache_tag": "cpython-313",
        "system": "Linux",
        "machine": "x86_64",
    }) is None

    identity = MODULE.runtime_identity_from_json({
        "major": 3,
        "minor": 13,
        "implementation": "cpython",
        "cache_tag": "cpython-313",
        "system": "Linux",
        "machine": "x86_64",
    })
    assert identity is not None
    assert identity.version_text == "3.13"


def test_inspect_python_runtime_reads_real_interpreter() -> None:
    identity = MODULE.inspect_python_runtime(Path(sys.executable))
    assert identity is not None
    assert identity.major == sys.version_info.major
    assert identity.minor == sys.version_info.minor
    assert identity.implementation == sys.implementation.name


def test_inspect_python_runtime_rejects_invalid_probe_output() -> None:
    def runner(*args, **kwargs):
        return subprocess.CompletedProcess(args[0], 0, stdout="not-json\n", stderr="")

    assert MODULE.inspect_python_runtime("python", runner=runner) is None
