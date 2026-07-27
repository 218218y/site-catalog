#!/usr/bin/env python3
"""Slow transaction used only by the browser cancellation regression test."""
from __future__ import annotations

import signal
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

from project_mutation import ProjectMutationLock, ProjectTransaction

MARKER = ROOT / ".artifacts/e2e-control-job/state.txt"


def interrupt(_signum: int, _frame: object) -> None:
    raise KeyboardInterrupt


def main() -> int:
    MARKER.parent.mkdir(parents=True, exist_ok=True)
    if not MARKER.exists():
        MARKER.write_text("stable\n", encoding="utf-8")

    for name in ("SIGINT", "SIGTERM", "SIGBREAK"):
        value = getattr(signal, name, None)
        if value is not None:
            signal.signal(value, interrupt)

    try:
        with ProjectMutationLock(ROOT, "E2E interruptible control-panel job"):
            with ProjectTransaction(ROOT, prefix=".control-e2e-interrupt-") as transaction:
                transaction.write_text(MARKER, "mutating\n")
                print("[e2e-ready] transaction is active", flush=True)
                while True:
                    time.sleep(0.1)
    except KeyboardInterrupt:
        print("[e2e-cancel] cooperative interruption received", flush=True)
        return 130


if __name__ == "__main__":
    raise SystemExit(main())
