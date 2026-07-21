from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"

SPEC = importlib.util.spec_from_file_location(
    "run_with_project_python",
    TOOLS / "run_with_project_python.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.path.insert(0, str(TOOLS))
try:
    SPEC.loader.exec_module(MODULE)
finally:
    sys.path.remove(str(TOOLS))


def test_resolve_project_script_accepts_project_python_file(tmp_path: Path) -> None:
    script = tmp_path / "tools" / "example.py"
    script.parent.mkdir()
    script.write_text("print('ok')\n", encoding="utf-8")

    assert MODULE.resolve_project_script(tmp_path, "tools/example.py") == script.resolve()


def test_resolve_project_script_rejects_paths_outside_project(tmp_path: Path) -> None:
    outside = tmp_path.parent / "outside.py"
    outside.write_text("print('no')\n", encoding="utf-8")
    try:
        MODULE.resolve_project_script(tmp_path, str(outside))
    except ValueError as exc:
        assert "inside the project" in str(exc)
    else:
        raise AssertionError("outside project script should be rejected")


def test_build_command_uses_managed_environment(tmp_path: Path, monkeypatch) -> None:
    script = tmp_path / "tools" / "example.py"
    script.parent.mkdir()
    script.write_text("print('ok')\n", encoding="utf-8")
    managed_python = tmp_path / ".venv" / "bin" / "python"
    monkeypatch.setattr(
        MODULE,
        "create_or_update_environment",
        lambda root, quiet: managed_python,
    )

    command = MODULE.build_command(tmp_path, script, ("--flag", "value"))

    assert command == (
        str(managed_python),
        "tools/example.py",
        "--flag",
        "value",
    )


def test_run_project_tool_propagates_exit_code(tmp_path: Path, monkeypatch) -> None:
    script = tmp_path / "tools" / "example.py"
    script.parent.mkdir()
    script.write_text("print('ok')\n", encoding="utf-8")
    monkeypatch.setattr(
        MODULE,
        "build_command",
        lambda root, path, arguments: ("managed-python", "tools/example.py"),
    )

    class Result:
        returncode = 7

    calls: list[tuple[tuple[str, ...], Path, bool]] = []

    def fake_run(command, *, cwd, check):
        calls.append((command, cwd, check))
        return Result()

    monkeypatch.setattr(MODULE.subprocess, "run", fake_run)

    assert MODULE.run_project_tool(tmp_path, script, ()) == 7
    assert calls == [(("managed-python", "tools/example.py"), tmp_path, False)]
