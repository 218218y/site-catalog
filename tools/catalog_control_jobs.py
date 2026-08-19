#!/usr/bin/env python3
"""Maintenance action and subprocess lifecycle for the catalog control panel."""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import threading
import time
import uuid
from dataclasses import dataclass, field
from http import HTTPStatus
from typing import Literal, Sequence

from catalog_conversion_profiles import conversion_profile_command
from catalog_control_api import ApiRequestError, RunActionRequest
from catalog_control_paths import PROJECT_ROOT
from catalog_control_service import configured_missing_pdfs, current_taxonomy_state, taxonomy_action_availability
from project_mutation import MutationBusyError, ProjectMutationLock

@dataclass(frozen=True)
class Action:
    label: str
    description: str
    command: list[str]


ACTIONS: dict[str, Action] = {
    "sync_pdfs": Action(
        "הוסף PDFים חסרים לרשימה",
        "סורק assets/pdfs ומוסיף ל-catalogs.config.json קטלוגים שלא רשומים עדיין. לא ממיר ולא מריץ OCR.",
        ["tools/sync_catalog_pdfs.py"],
    ),
    "convert": Action(
        "המרה רגילה",
        "ממיר קטלוגים חסרים/שהשתנו לשלוש שכבות תמונה: thumbnail, medium ו-full. קטלוג שהוסר מהרשימה ינוקה; PDF חסר לעולם לא יגרום למחיקה בלי אישור מפורש. OCR במצב auto, אבל קטלוג עם ocr=false ידולג ב-OCR.",
        conversion_profile_command("production"),
    ),
    "convert_force": Action(
        "המרה מחדש לכל הקטלוגים",
        "מרנדר מחדש את כל הקטלוגים התקינים עם שכבות thumbnail, medium ו-full. PDF חסר עוצר את הפעולה, אלא אם המשתמש מאשר במפורש להסיר את הקטלוג החסר.",
        conversion_profile_command("force"),
    ),
    "refresh_ocr": Action(
        "רענון אינדקס חיפוש/OCR בלבד",
        "בונה מחדש את catalogs.search-index.json בלי לרנדר מחדש תמונות קיימות, ככל האפשר.",
        conversion_profile_command("ocr-refresh"),
    ),
    "r2_preview": Action(
        "בדיקת סנכרון R2 בלי שינוי",
        "מציג מה יועלה/יימחק ב-Cloudflare R2 בלי לבצע שינוי אמיתי.",
        ["tools/sync_r2_catalog_images.py", "--dry-run"],
    ),
    "r2_sync": Action(
        "סנכרון R2 בפועל",
        "מסנכרן assets/pages מול ה-bucket לפי r2.env.",
        ["tools/sync_r2_catalog_images.py"],
    ),
    "bundle_r2": Action(
        "יצירת באנדל R2",
        "בונה רק כשיש שינוי, ומעדכן מאותו תוצר את dist/site-upload-r2 ואת dist/site-local.",
        [
            "tools/build_deploy_bundle.py",
            "--out",
            "dist/site-upload-r2",
            "--seo-mode",
            "private",
            "--external-assets-url",
            "https://cdn.bargig-furniture.com",
            "--skip-if-current",
            "--mirror-to",
            "dist/site-local",
            "--clean-legacy-artifacts",
        ],
    ),
    "cloudflare_pages_deploy": Action(
        "העלאת באנדל ל-Cloudflare",
        "מאמת שהבאנדל הקיים שלם ותואם למקורות, ואז מעלה אותו ל-production בלי לבנות מחדש. אם היו שינויים יש להריץ קודם יצירת באנדל R2.",
        ["tools/deploy_cloudflare_pages.py"],
    ),
}

if os.environ.get("BARGIG_CONTROL_E2E") == "1":
    ACTIONS["_e2e_interruptible"] = Action(
        "בדיקת עצירה ושחזור",
        "פעולת בדיקה איטית שמוודאת עצירה ושחזור עסקה דרך הדפדפן.",
        ["tests/fixtures/control_panel_interruptible_job.py"],
    )


JobStatus = Literal["running", "canceling", "canceled", "success", "failed"]


@dataclass
class Job:
    id: str
    action_key: str
    label: str
    started_at: float
    status: JobStatus = "running"
    returncode: int | None = None
    finished_at: float | None = None
    cancel_requested: bool = False
    cancel_requested_at: float | None = None
    process: subprocess.Popen[str] | None = field(default=None, repr=False, compare=False)
    log: list[str] = field(default_factory=list)

jobs: dict[str, Job] = {}
jobs_lock = threading.Lock()
job_start_lock = threading.Lock()

def python_executable() -> str:
    venv = PROJECT_ROOT / ".venv" / "Scripts" / "python.exe"
    if venv.is_file():
        return str(venv)
    return sys.executable


CONVERSION_ACTION_KEYS = frozenset({"convert", "convert_force", "refresh_ocr"})


def validate_missing_pdf_confirmation(request: RunActionRequest) -> None:
    if not request.prune_missing_pdfs:
        return
    if request.action not in CONVERSION_ACTION_KEYS:
        raise ApiRequestError(HTTPStatus.BAD_REQUEST, "Missing-PDF pruning is only valid for conversion actions")
    current_missing_ids = tuple(sorted(item["id"] for item in configured_missing_pdfs()))
    if request.confirmed_missing_pdf_ids != current_missing_ids:
        raise ApiRequestError(
            HTTPStatus.CONFLICT,
            "The missing-PDF list changed. Refresh the panel and confirm the current list.",
        )


def action_command_for_job(
    action_key: str,
    *,
    prune_missing_pdfs: bool = False,
    confirmed_missing_pdf_ids: Sequence[str] = (),
) -> list[str]:
    action = ACTIONS.get(action_key)
    if not action:
        raise ValueError(f"Unknown action: {action_key}")
    command = list(action.command)
    if prune_missing_pdfs:
        if action_key not in CONVERSION_ACTION_KEYS:
            raise ValueError("Missing-PDF pruning is only valid for conversion actions")
        command.append("--prune-missing-pdfs")
        for catalog_id in sorted({str(value).strip() for value in confirmed_missing_pdf_ids if str(value).strip()}):
            command.extend(("--confirmed-missing-pdf-id", catalog_id))
    elif confirmed_missing_pdf_ids:
        raise ValueError("Confirmed missing-PDF ids require pruning")
    return command


def start_job(
    action_key: str,
    *,
    prune_missing_pdfs: bool = False,
    confirmed_missing_pdf_ids: Sequence[str] = (),
) -> Job:
    action = ACTIONS.get(action_key)
    if not action:
        raise ValueError(f"Unknown action: {action_key}")
    enabled, reason = taxonomy_action_availability(action_key, current_taxonomy_state())
    if not enabled:
        raise ValueError(reason)

    with job_start_lock:
        with jobs_lock:
            running = [item for item in jobs.values() if item.status in {"running", "canceling"}]
        if running:
            current = max(running, key=lambda item: item.started_at)
            raise MutationBusyError(
                f"לא ניתן להתחיל פעולה חדשה משום ש-{current.label} עדיין פועלת."
            )

        # Probe the cross-process lock before registering the job.  The worker
        # then acquires and owns the lock inside its own process, so closing the
        # control panel cannot release protection while the worker continues.
        with ProjectMutationLock(PROJECT_ROOT, f"בדיקת זמינות לפני {action.label}"):
            pass

        job = Job(id=uuid.uuid4().hex[:12], action_key=action_key, label=action.label, started_at=time.time())
        command = action_command_for_job(
            action_key,
            prune_missing_pdfs=prune_missing_pdfs,
            confirmed_missing_pdf_ids=confirmed_missing_pdf_ids,
        )
        with jobs_lock:
            jobs[job.id] = job

        try:
            thread = threading.Thread(target=run_job, args=(job, command), daemon=True)
            thread.start()
        except Exception:
            with jobs_lock:
                jobs.pop(job.id, None)
            raise
        return job


if sys.platform == "win32":
    def _signal_process_group(process: subprocess.Popen[str], sig: signal.Signals) -> None:
        """Reject POSIX-only group signals on Windows."""
        raise OSError("POSIX process-group signals are unavailable on Windows")

    def _force_kill_process_group(process: subprocess.Popen[str]) -> None:
        """Force-stop the Windows worker process."""
        process.kill()
else:
    def _signal_process_group(process: subprocess.Popen[str], sig: signal.Signals) -> None:
        """Signal the POSIX worker process group created by start_new_session."""
        os.killpg(process.pid, sig)

    def _force_kill_process_group(process: subprocess.Popen[str]) -> None:
        """Force-stop the POSIX worker process group."""
        os.killpg(process.pid, signal.SIGKILL)


def _signal_job_process(process: subprocess.Popen[str]) -> str:
    """Request cooperative cancellation for a worker process group."""
    if process.poll() is not None:
        return "already-exited"
    if os.name == "nt":
        ctrl_break = getattr(signal, "CTRL_BREAK_EVENT", None)
        if ctrl_break is not None:
            try:
                process.send_signal(ctrl_break)
                return "ctrl-break"
            except (OSError, ValueError):
                pass
    else:
        try:
            _signal_process_group(process, signal.SIGINT)
            return "sigint-group"
        except (OSError, ProcessLookupError):
            pass
    process.terminate()
    return "terminate"


def _escalate_job_cancellation(job: Job, process: subprocess.Popen[str]) -> None:
    try:
        process.wait(timeout=8)
        return
    except subprocess.TimeoutExpired:
        append_job_log(job, "[cancel] graceful stop timed out; terminating process group")

    try:
        if os.name != "nt":
            _signal_process_group(process, signal.SIGTERM)
        else:
            process.terminate()
        process.wait(timeout=4)
        return
    except (OSError, ProcessLookupError, subprocess.TimeoutExpired):
        pass

    append_job_log(job, "[cancel] termination timed out; forcing process exit")
    try:
        _force_kill_process_group(process)
    except (OSError, ProcessLookupError):
        pass


def cancel_job(job_id: str) -> Job:
    with jobs_lock:
        job = jobs.get(job_id)
        if not job:
            raise ValueError("Job not found")
        if job.status not in {"running", "canceling"}:
            return job
        if job.cancel_requested:
            return job
        job.cancel_requested = True
        job.cancel_requested_at = time.time()
        job.status = "canceling"
        job.log.append("[cancel] stop requested from the control panel")
        process = job.process

    if process is not None and process.poll() is None:
        try:
            method = _signal_job_process(process)
            append_job_log(job, f"[cancel] signal sent: {method}")
        except Exception as exc:
            append_job_log(job, f"[cancel] failed to signal worker: {exc}")
        threading.Thread(
            target=_escalate_job_cancellation,
            args=(job, process),
            daemon=True,
        ).start()
    return job


def _recover_after_canceled_job(job: Job) -> str:
    try:
        with ProjectMutationLock(PROJECT_ROOT, f"שחזור לאחר עצירת {job.label}") as lock:
            recovered = tuple(lock.recovered_transactions)
        if recovered:
            return f"[cancel] recovered {len(recovered)} interrupted transaction(s)"
        return "[cancel] no interrupted transaction required recovery"
    except Exception as exc:
        raise RuntimeError(f"failed to recover the project after cancellation: {exc}") from exc


def job_cancel_requested(job: Job) -> bool:
    """Read cancellation state without carrying stale static narrowing across threads."""
    return job.cancel_requested


def run_job(job: Job, action_command: Sequence[str]) -> None:
    command = [python_executable(), *action_command]
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    # Jobs are piped into the browser rather than attached to a terminal.
    # Python otherwise block-buffers stdout/stderr and the control panel only
    # receives progress after a large buffer fills or the process exits.  Keep
    # the direct worker and any Python subprocesses it starts unbuffered so the
    # existing 500 ms UI poll can display each completed line promptly.
    env["PYTHONUNBUFFERED"] = "1"
    append_job_log(job, f"$ {' '.join(action_command)}")
    try:
        with jobs_lock:
            if job_cancel_requested(job):
                job.returncode = 130
                job.finished_at = time.time()
                job.status = "canceled"
                job.log.append("[cancel] canceled before worker startup")
                return

        creationflags = getattr(subprocess, "CREATE_NEW_PROCESS_GROUP", 0) if os.name == "nt" else 0
        start_new_session = os.name != "nt"

        process = subprocess.Popen(
            command,
            cwd=PROJECT_ROOT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
            creationflags=creationflags,
            start_new_session=start_new_session,
        )
        with jobs_lock:
            job.process = process
            cancel_raced = job_cancel_requested(job)

        if cancel_raced and process.poll() is None:
            method = _signal_job_process(process)
            append_job_log(job, f"[cancel] signal sent after startup race: {method}")
            threading.Thread(target=_escalate_job_cancellation, args=(job, process), daemon=True).start()

        assert process.stdout is not None
        for line in process.stdout:
            append_job_log(job, line.rstrip("\n"))
        returncode = process.wait()

        recovery_message = ""
        recovery_error = ""
        if job_cancel_requested(job):
            try:
                recovery_message = _recover_after_canceled_job(job)
            except Exception as exc:
                recovery_error = str(exc)

        with jobs_lock:
            job.process = None
            job.returncode = returncode
            job.finished_at = time.time()
            if job_cancel_requested(job) and not recovery_error:
                job.status = "canceled"
                job.log.append(recovery_message)
                job.log.append(f"[done] canceled; return code: {returncode}")
            elif recovery_error:
                job.status = "failed"
                job.log.append(f"ERROR: {recovery_error}")
            else:
                job.status = "success" if returncode == 0 else "failed"
                job.log.append(f"[done] return code: {returncode}")
    except Exception as exc:
        with jobs_lock:
            job.process = None
            job.returncode = -1
            job.finished_at = time.time()
            job.status = "failed"
            job.log.append(f"ERROR: {exc}")


def append_job_log(job: Job, line: str) -> None:
    with jobs_lock:
        job.log.append(line)
        if len(job.log) > 3000:
            job.log = job.log[-3000:]


def serialize_job(job: Job, include_log: bool = True) -> dict[str, object]:
    data: dict[str, object] = {
        "id": job.id,
        "actionKey": job.action_key,
        "label": job.label,
        "status": job.status,
        "returncode": job.returncode,
        "startedAt": job.started_at,
        "finishedAt": job.finished_at,
        "cancelRequested": job.cancel_requested,
        "cancelRequestedAt": job.cancel_requested_at,
    }
    if include_log:
        data["log"] = job.log
    return data
