from __future__ import annotations

import importlib.util
import sys
import threading
import time
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


SERVER = load_module("catalog_control_job_tests", "catalog_control_server.py")


def wait_for(predicate, timeout: float = 12.0) -> None:
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if predicate():
            return
        time.sleep(0.05)
    raise AssertionError("timed out waiting for asynchronous job state")


def test_canceling_a_running_job_rolls_back_and_reports_canceled(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    marker = root / "state.txt"
    marker.write_text("stable\n", encoding="utf-8")
    worker = root / "interruptible_worker.py"
    worker.write_text(
        """
from __future__ import annotations
import signal
import sys
import time
from pathlib import Path
root = Path(sys.argv[1])
sys.path.insert(0, sys.argv[2])
from project_mutation import ProjectMutationLock, ProjectTransaction

def interrupt(_signum, _frame):
    raise KeyboardInterrupt
for name in ("SIGINT", "SIGTERM", "SIGBREAK"):
    value = getattr(signal, name, None)
    if value is not None:
        signal.signal(value, interrupt)
try:
    with ProjectMutationLock(root, "cancel test worker"):
        with ProjectTransaction(root, prefix=".cancel-test-transaction-") as transaction:
            transaction.write_text(root / "state.txt", "mutating\\n")
            print("[ready]", flush=True)
            while True:
                time.sleep(0.1)
except KeyboardInterrupt:
    print("[canceled]", flush=True)
    raise SystemExit(130)
""".strip()
        + "\n",
        encoding="utf-8",
    )

    action_key = "cancel_test"
    monkeypatch.setattr(SERVER, "PROJECT_ROOT", root)
    monkeypatch.setattr(SERVER, "current_taxonomy_state", lambda: {"issues": []})
    monkeypatch.setitem(
        SERVER.ACTIONS,
        action_key,
        SERVER.Action(
            "Cancel test",
            "Cancel test",
            [str(worker), str(root), str(TOOLS)],
        ),
    )
    with SERVER.jobs_lock:
        SERVER.jobs.clear()

    job = SERVER.start_job(action_key)
    wait_for(lambda: any("[ready]" in line for line in job.log))
    assert marker.read_text(encoding="utf-8") == "mutating\n"

    canceled = SERVER.cancel_job(job.id)
    assert canceled.cancel_requested is True
    assert canceled.status in {"canceling", "canceled"}
    wait_for(lambda: job.status not in {"running", "canceling"})

    assert job.status == "canceled"
    assert marker.read_text(encoding="utf-8") == "stable\n"
    assert any("canceled" in line or "שחזור" in line or "recovered" in line for line in job.log)
    assert not list(root.glob(".cancel-test-transaction-*"))

    with SERVER.jobs_lock:
        SERVER.jobs.clear()


def test_canceling_a_finished_job_is_idempotent() -> None:
    job = SERVER.Job(
        id="finished",
        action_key="convert",
        label="Finished",
        started_at=1.0,
        status="success",
        returncode=0,
        finished_at=2.0,
    )
    with SERVER.jobs_lock:
        SERVER.jobs.clear()
        SERVER.jobs[job.id] = job
    try:
        result = SERVER.cancel_job(job.id)
        assert result is job
        assert result.status == "success"
        assert result.cancel_requested is False
    finally:
        with SERVER.jobs_lock:
            SERVER.jobs.clear()


def test_job_output_is_streamed_before_worker_exit(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    worker = root / "buffered_worker.py"
    started_marker = root / "worker-started.txt"
    worker.write_text(
        """
from __future__ import annotations
import sys
import time
from pathlib import Path

Path(sys.argv[1]).write_text("started\\n", encoding="utf-8")
print("[stream-first]")
time.sleep(2.0)
print("[stream-last]")
""".strip()
        + "\n",
        encoding="utf-8",
    )

    monkeypatch.setattr(SERVER, "PROJECT_ROOT", root)
    job = SERVER.Job(
        id="streaming",
        action_key="streaming",
        label="Streaming",
        started_at=time.time(),
    )

    thread = threading.Thread(
        target=SERVER.run_job,
        args=(job, [str(worker), str(started_marker)]),
        daemon=True,
    )
    thread.start()

    wait_for(started_marker.exists, timeout=5.0)
    wait_for(lambda: "[stream-first]" in job.log, timeout=0.75)
    assert job.status == "running"
    assert "[stream-last]" not in job.log

    wait_for(lambda: job.status != "running", timeout=5.0)
    thread.join(timeout=1.0)
    assert job.status == "success"
    assert "[stream-last]" in job.log
