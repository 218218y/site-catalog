#!/usr/bin/env python3
"""Cross-process project locking and crash-recoverable file transactions.

The catalog project has several maintenance entry points (control-panel saves,
PDF conversion, bundle generation, remote sync and deployment).  This module
provides one shared lock plus a durable transaction journal.  Ordinary failures
roll back immediately; if a process is terminated without running cleanup, the
next lock owner restores the interrupted transaction before doing new work.
"""
from __future__ import annotations

import json
import os
import shutil
import socket
import tempfile
import time
import uuid
from contextlib import AbstractContextManager
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

LOCK_FILENAME = ".site-catalog.mutation.lock"
LOCK_MARKER = b"L"
FAULT_ENV = "SITE_CATALOG_FAULT_POINT"
TRANSACTION_JOURNAL = ".site-catalog.transaction.json"
TRANSACTION_SCHEMA = 1


class MutationBusyError(RuntimeError):
    """Raised when another process owns the shared project mutation lock."""


class InjectedMutationFault(RuntimeError):
    """Raised only by explicit test/development fault injection."""


class TransactionRecoveryError(RuntimeError):
    """Raised when an interrupted transaction cannot be restored safely."""


def trigger_fault(point: str) -> None:
    """Raise at a named fault point when explicitly requested through env."""

    requested = {
        item.strip()
        for item in os.environ.get(FAULT_ENV, "").split(",")
        if item.strip()
    }
    if point in requested:
        raise InjectedMutationFault(f"Injected mutation fault: {point}")


def _fsync_directory(path: Path) -> None:
    if os.name == "nt":
        return
    try:
        descriptor = os.open(path, os.O_RDONLY)
    except OSError:
        return
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _atomic_write_bytes(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    previous_mode = path.stat().st_mode if path.exists() else None
    temporary = path.with_name(f".{path.name}.{uuid.uuid4().hex}.tmp")
    try:
        with temporary.open("wb") as handle:
            handle.write(data)
            handle.flush()
            os.fsync(handle.fileno())
        if previous_mode is not None:
            os.chmod(temporary, previous_mode)
        os.replace(temporary, path)
        _fsync_directory(path.parent)
    finally:
        temporary.unlink(missing_ok=True)


def _copy_file_durable(source: Path, target: Path) -> None:
    """Copy a regular file and durably flush the copied bytes.

    Windows' ``os.fsync`` maps to ``_commit`` and rejects descriptors opened
    read-only.  Copy through a writable destination handle so the same durability
    guarantee works on every supported platform, then restore source metadata.
    """

    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        with source.open("rb") as source_handle, target.open("wb") as target_handle:
            shutil.copyfileobj(source_handle, target_handle)
            target_handle.flush()
            os.fsync(target_handle.fileno())
        shutil.copystat(source, target)
        _fsync_directory(target.parent)
    except Exception:
        target.unlink(missing_ok=True)
        raise


def _remove_path(path: Path) -> None:
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
    elif path.exists() or path.is_symlink():
        path.unlink()


def _metadata_tail(metadata: Mapping[str, Any]) -> bytes:
    return b"\n" + json.dumps(dict(metadata), ensure_ascii=False, sort_keys=True).encode("utf-8") + b"\n"


def _write_lock_metadata(handle: Any, metadata: Mapping[str, Any]) -> None:
    """Write metadata after the dedicated byte used by the Windows lock.

    ``msvcrt.locking`` denies reads of the locked byte through another handle.
    Keeping byte zero exclusively for locking lets status readers inspect the
    JSON metadata while the mutation is active.
    """

    handle.seek(1)
    handle.truncate()
    handle.write(_metadata_tail(metadata))
    handle.flush()
    os.fsync(handle.fileno())


def read_lock_metadata(root: Path) -> dict[str, Any] | None:
    path = Path(root) / LOCK_FILENAME
    try:
        with path.open("rb") as handle:
            # Byte zero is the cross-process lock byte on Windows.  Reading only
            # the tail avoids ERROR_LOCK_VIOLATION while another process owns it.
            handle.seek(1)
            raw = handle.read()
    except OSError:
        return None
    if not raw:
        return None
    try:
        value = json.loads(raw.decode("utf-8-sig"))
    except (ValueError, UnicodeDecodeError):
        return None
    return value if isinstance(value, dict) else None


def describe_lock_owner(root: Path) -> str:
    metadata = read_lock_metadata(root) or {}
    action = str(metadata.get("action") or "פעולת תחזוקה אחרת")
    pid = metadata.get("pid")
    started_at = metadata.get("startedAt")
    details = [action]
    if pid:
        details.append(f"PID {pid}")
    if isinstance(started_at, (int, float)):
        age = max(0, int(time.time() - float(started_at)))
        details.append(f"רץ {age} שניות")
    return " · ".join(details)


def _relative_to(base: Path, path: Path, *, label: str) -> str:
    resolved = Path(path).resolve(strict=False)
    try:
        relative = resolved.relative_to(base.resolve())
    except ValueError as exc:
        raise ValueError(f"{label} is outside its allowed root: {resolved}") from exc
    if not relative.parts:
        raise ValueError(f"{label} cannot be the root directory itself")
    return relative.as_posix()


def _resolve_journal_path(base: Path, value: Any, *, label: str) -> Path:
    text = str(value or "").strip().replace("\\", "/")
    candidate = Path(text)
    if not text or candidate.is_absolute() or ".." in candidate.parts:
        raise TransactionRecoveryError(f"Unsafe {label} in transaction journal: {text!r}")
    resolved = (base / candidate).resolve(strict=False)
    try:
        resolved.relative_to(base.resolve())
    except ValueError as exc:
        raise TransactionRecoveryError(f"Unsafe {label} in transaction journal: {text!r}") from exc
    return resolved


def _read_transaction_journal(temp_root: Path) -> dict[str, Any]:
    journal_path = temp_root / TRANSACTION_JOURNAL
    try:
        payload = json.loads(journal_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise TransactionRecoveryError(f"Could not read interrupted transaction journal: {journal_path}") from exc
    if not isinstance(payload, dict) or payload.get("schema") != TRANSACTION_SCHEMA:
        raise TransactionRecoveryError(f"Unsupported transaction journal: {journal_path}")
    return payload


def _write_transaction_journal(temp_root: Path, payload: Mapping[str, Any]) -> None:
    data = (json.dumps(dict(payload), ensure_ascii=False, indent=2, sort_keys=False) + "\n").encode("utf-8")
    _atomic_write_bytes(temp_root / TRANSACTION_JOURNAL, data)


def _rollback_rename_batches(
    root: Path,
    temp_root: Path,
    batches: Sequence[Mapping[str, Any]],
) -> list[str]:
    errors: list[str] = []
    for batch in reversed(list(batches)):
        records = batch.get("records", [])
        if not isinstance(records, list):
            errors.append("Invalid rename batch records")
            continue
        install_started = bool(batch.get("installStarted"))
        resolved_records: list[tuple[Path, Path, Path]] = []
        try:
            for item in records:
                if not isinstance(item, Mapping):
                    raise TransactionRecoveryError("Invalid rename record")
                resolved_records.append((
                    _resolve_journal_path(root, item.get("original"), label="rename original"),
                    _resolve_journal_path(root, item.get("target"), label="rename target"),
                    _resolve_journal_path(temp_root, item.get("staged"), label="rename staging path"),
                ))
        except Exception as exc:
            errors.append(str(exc))
            continue

        if install_started:
            for original, target, staged in reversed(resolved_records):
                try:
                    if staged.exists():
                        continue
                    if target.exists():
                        staged.parent.mkdir(parents=True, exist_ok=True)
                        target.rename(staged)
                        continue
                    if original.exists():
                        continue
                    raise TransactionRecoveryError(
                        f"Missing original, installed and staged rename content: {target}"
                    )
                except Exception as exc:
                    errors.append(f"{target}: {exc}")

        for original, _target, staged in reversed(resolved_records):
            try:
                if not staged.exists():
                    if not original.exists():
                        raise TransactionRecoveryError(
                            f"Missing original and staged rename content: {original}"
                        )
                    continue
                if original.exists():
                    raise TransactionRecoveryError(
                        f"Cannot restore rename because original path already exists: {original}"
                    )
                original.parent.mkdir(parents=True, exist_ok=True)
                staged.rename(original)
            except Exception as exc:
                errors.append(f"{original}: {exc}")
    return errors


def _rollback_transaction_payload(root: Path, temp_root: Path, payload: Mapping[str, Any]) -> None:
    errors: list[str] = []
    rename_batches = payload.get("renameBatches", [])
    if isinstance(rename_batches, list):
        errors.extend(_rollback_rename_batches(root, temp_root, rename_batches))
    else:
        errors.append("Invalid renameBatches journal field")

    replacements = payload.get("directoryReplacements", [])
    if not isinstance(replacements, list):
        errors.append("Invalid directoryReplacements journal field")
        replacements = []
    for item in reversed(replacements):
        try:
            if not isinstance(item, Mapping):
                raise TransactionRecoveryError("Invalid directory replacement record")
            target = _resolve_journal_path(root, item.get("target"), label="directory target")
            had_target = bool(item.get("hadTarget"))
            backup_value = item.get("backup")
            backup = (
                _resolve_journal_path(temp_root, backup_value, label="directory backup")
                if backup_value
                else None
            )
            if backup is not None and backup.exists():
                if target.exists() or target.is_symlink():
                    _remove_path(target)
                target.parent.mkdir(parents=True, exist_ok=True)
                backup.rename(target)
            elif had_target:
                if not target.exists():
                    raise TransactionRecoveryError(
                        f"Missing original directory and transaction backup: {target}"
                    )
            elif target.exists() or target.is_symlink():
                _remove_path(target)
        except Exception as exc:
            errors.append(str(exc))

    files = payload.get("files", [])
    if not isinstance(files, list):
        errors.append("Invalid files journal field")
        files = []
    for item in reversed(files):
        try:
            if not isinstance(item, Mapping):
                raise TransactionRecoveryError("Invalid file snapshot record")
            path = _resolve_journal_path(root, item.get("path"), label="file target")
            existed = bool(item.get("existed"))
            backup_value = item.get("backup")
            if existed:
                if not backup_value:
                    raise TransactionRecoveryError(f"Missing backup reference for {path}")
                backup = _resolve_journal_path(temp_root, backup_value, label="file backup")
                if not backup.is_file():
                    raise TransactionRecoveryError(f"Missing file backup for {path}")
                _atomic_write_bytes(path, backup.read_bytes())
                try:
                    shutil.copystat(backup, path)
                except OSError:
                    pass
            else:
                if path.is_dir() and not path.is_symlink():
                    raise TransactionRecoveryError(f"Expected a file target during rollback, found directory: {path}")
                path.unlink(missing_ok=True)
        except Exception as exc:
            errors.append(str(exc))

    if errors:
        raise TransactionRecoveryError("Transaction rollback was incomplete: " + "; ".join(errors))


def recover_incomplete_transactions(root: Path) -> list[Path]:
    """Restore interrupted transactions while the caller owns the project lock."""

    project_root = Path(root).resolve()
    recovered: list[Path] = []
    if not project_root.is_dir():
        return recovered
    for candidate in sorted(project_root.iterdir(), key=lambda path: path.name):
        if not candidate.is_dir() or candidate.is_symlink():
            continue
        journal_path = candidate / TRANSACTION_JOURNAL
        if not journal_path.is_file():
            continue
        payload = _read_transaction_journal(candidate)
        state = str(payload.get("state") or "active")
        if state == "active":
            _rollback_transaction_payload(project_root, candidate, payload)
            recovered_payload = dict(payload)
            recovered_payload["state"] = "rolledback"
            recovered_payload["recoveredAt"] = time.time()
            _write_transaction_journal(candidate, recovered_payload)
        elif state not in {"committed", "rolledback"}:
            raise TransactionRecoveryError(
                f"Unknown transaction state {state!r} in {journal_path}"
            )
        shutil.rmtree(candidate)
        _fsync_directory(project_root)
        recovered.append(candidate)
    return recovered


class ProjectMutationLock(AbstractContextManager["ProjectMutationLock"]):
    """Non-blocking, cross-platform, cross-process project mutation lock."""

    def __init__(self, root: Path, action: str, *, token: str | None = None) -> None:
        self.root = Path(root).resolve()
        self.path = self.root / LOCK_FILENAME
        self.action = str(action or "project mutation").strip()
        self.token = token or uuid.uuid4().hex
        self._file: Any = None
        self._acquired = False
        self.recovered_transactions: list[Path] = []

    @property
    def acquired(self) -> bool:
        return self._acquired

    def acquire(self) -> "ProjectMutationLock":
        if self._acquired:
            return self
        self.path.parent.mkdir(parents=True, exist_ok=True)
        descriptor = os.open(self.path, os.O_RDWR | os.O_CREAT, 0o666)
        handle = os.fdopen(descriptor, "r+b", buffering=0)
        try:
            # msvcrt cannot lock a byte that has never existed.  Initializing the
            # marker before acquisition is safe even if two first-time processes
            # race because both write the same single byte at the same offset.
            if os.fstat(handle.fileno()).st_size == 0:
                handle.seek(0)
                handle.write(LOCK_MARKER)
                handle.flush()
                os.fsync(handle.fileno())
            handle.seek(0)
            self._lock_file(handle)
        except OSError as exc:
            handle.close()
            raise MutationBusyError(
                "לא ניתן להתחיל פעולה חדשה משום שהפרויקט נעול כעת: "
                + describe_lock_owner(self.root)
            ) from exc

        self._file = handle
        self._acquired = True
        try:
            metadata = {
                "schema": 1,
                "token": self.token,
                "action": self.action,
                "pid": os.getpid(),
                "host": socket.gethostname(),
                "startedAt": time.time(),
            }
            handle.seek(0)
            if handle.read(1) != LOCK_MARKER:
                handle.seek(0)
                handle.write(LOCK_MARKER)
            _write_lock_metadata(handle, metadata)
            self.recovered_transactions = recover_incomplete_transactions(self.root)
            return self
        except Exception:
            self.release()
            raise

    @staticmethod
    def _lock_file(handle: Any) -> None:
        if os.name == "nt":  # pragma: no cover - exercised on Windows installations
            import msvcrt

            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            return
        import fcntl

        fcntl.flock(handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)

    @staticmethod
    def _unlock_file(handle: Any) -> None:
        if os.name == "nt":  # pragma: no cover - exercised on Windows installations
            import msvcrt

            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            return
        import fcntl

        fcntl.flock(handle.fileno(), fcntl.LOCK_UN)

    def release(self) -> None:
        if not self._acquired:
            return
        handle = self._file
        self._file = None
        try:
            if handle is not None:
                _write_lock_metadata(handle, {})
                self._unlock_file(handle)
        finally:
            if handle is not None:
                handle.close()
            self._acquired = False

    def __enter__(self) -> "ProjectMutationLock":
        return self.acquire()

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self.release()


@dataclass
class _FileSnapshot:
    path: Path
    existed: bool
    backup: Path | None


@dataclass
class _DirectoryReplacement:
    target: Path
    had_target: bool
    backup: Path | None
    operation: str


@dataclass
class _PathRename:
    original: Path
    target: Path
    staged: Path


@dataclass
class _RenameBatch:
    records: list[_PathRename]
    install_started: bool = False


class ProjectTransaction(AbstractContextManager["ProjectTransaction"]):
    """Rollback unit with a durable journal for files and directories."""

    def __init__(self, root: Path, *, prefix: str = ".site-catalog-transaction-") -> None:
        self.root = Path(root).resolve()
        self.temp_root = Path(tempfile.mkdtemp(prefix=prefix, dir=self.root))
        self.transaction_id = uuid.uuid4().hex
        self.created_at = time.time()
        self._files: dict[Path, _FileSnapshot] = {}
        self._file_order: list[Path] = []
        self._directory_replacements: list[_DirectoryReplacement] = []
        self._rename_batches: list[_RenameBatch] = []
        self._finished = False
        self._state = "active"
        try:
            self._persist_journal()
        except Exception:
            shutil.rmtree(self.temp_root, ignore_errors=True)
            raise

    def _project_path(self, path: Path) -> Path:
        resolved = Path(path).resolve(strict=False)
        try:
            resolved.relative_to(self.root)
        except ValueError as exc:
            raise ValueError(f"Transaction target is outside the project root: {resolved}") from exc
        if resolved == self.root:
            raise ValueError("Refusing to mutate the project root directory itself")
        return resolved

    def _staged_path(self, path: Path) -> Path:
        resolved = Path(path).resolve(strict=False)
        try:
            resolved.relative_to(self.temp_root)
        except ValueError as exc:
            raise ValueError(f"Staged path is outside the transaction directory: {resolved}") from exc
        if resolved == self.temp_root:
            raise ValueError("A staged replacement must be below the transaction directory")
        return resolved

    def _journal_payload(self, *, state: str | None = None) -> dict[str, Any]:
        return {
            "schema": TRANSACTION_SCHEMA,
            "transactionId": self.transaction_id,
            "state": state or self._state,
            "createdAt": self.created_at,
            "files": [
                {
                    "path": _relative_to(self.root, snapshot.path, label="file snapshot"),
                    "existed": snapshot.existed,
                    "backup": (
                        _relative_to(self.temp_root, snapshot.backup, label="file backup")
                        if snapshot.backup is not None
                        else None
                    ),
                }
                for snapshot in (self._files[path] for path in self._file_order)
            ],
            "directoryReplacements": [
                {
                    "target": _relative_to(self.root, record.target, label="directory target"),
                    "hadTarget": record.had_target,
                    "backup": (
                        _relative_to(self.temp_root, record.backup, label="directory backup")
                        if record.backup is not None
                        else None
                    ),
                    "operation": record.operation,
                }
                for record in self._directory_replacements
            ],
            "renameBatches": [
                {
                    "installStarted": batch.install_started,
                    "records": [
                        {
                            "original": _relative_to(self.root, record.original, label="rename original"),
                            "target": _relative_to(self.root, record.target, label="rename target"),
                            "staged": _relative_to(self.temp_root, record.staged, label="rename staging path"),
                        }
                        for record in batch.records
                    ],
                }
                for batch in self._rename_batches
            ],
        }

    def _persist_journal(self, *, state: str | None = None) -> None:
        _write_transaction_journal(self.temp_root, self._journal_payload(state=state))

    def track_file(self, path: Path) -> None:
        resolved = self._project_path(path)
        if resolved in self._files:
            return
        if resolved.exists() and not resolved.is_file():
            raise ValueError(f"Transaction file target is not a regular file: {resolved}")
        existed = resolved.is_file()
        backup: Path | None = None
        if existed:
            backup = self.temp_root / "files" / uuid.uuid4().hex
            _copy_file_durable(resolved, backup)
        snapshot = _FileSnapshot(resolved, existed, backup)
        self._files[resolved] = snapshot
        self._file_order.append(resolved)
        try:
            self._persist_journal()
        except Exception:
            self._file_order.pop()
            self._files.pop(resolved, None)
            if backup is not None:
                backup.unlink(missing_ok=True)
            raise

    def track_files(self, paths: Iterable[Path]) -> None:
        for path in paths:
            self.track_file(path)

    def write_bytes(self, path: Path, data: bytes) -> None:
        resolved = self._project_path(path)
        self.track_file(resolved)
        _atomic_write_bytes(resolved, data)

    def write_text(self, path: Path, text: str, *, encoding: str = "utf-8") -> None:
        self.write_bytes(path, text.encode(encoding))

    def delete_path(self, path: Path) -> bool:
        target = self._project_path(path)
        if not target.exists() and not target.is_symlink():
            return False
        backup = self.temp_root / "deleted" / uuid.uuid4().hex
        backup.parent.mkdir(parents=True, exist_ok=True)
        record = _DirectoryReplacement(
            target=target,
            had_target=True,
            backup=backup,
            operation="delete",
        )
        self._directory_replacements.append(record)
        self._persist_journal()
        target.rename(backup)
        _fsync_directory(target.parent)
        _fsync_directory(backup.parent)
        return True

    def replace_directory(self, target: Path, staged_directory: Path, *, fault_point: str | None = None) -> None:
        target = self._project_path(target)
        staged_directory = self._staged_path(staged_directory)
        if not staged_directory.is_dir():
            raise FileNotFoundError(f"Staged directory not found: {staged_directory}")
        if target.exists() and not target.is_dir():
            raise NotADirectoryError(f"Directory replacement target is not a directory: {target}")
        had_target = target.exists()
        backup = self.temp_root / "replaced" / uuid.uuid4().hex if had_target else None
        if backup is not None:
            backup.parent.mkdir(parents=True, exist_ok=True)
        record = _DirectoryReplacement(
            target=target,
            had_target=had_target,
            backup=backup,
            operation="replace",
        )
        self._directory_replacements.append(record)
        self._persist_journal()
        if backup is not None:
            target.rename(backup)
            _fsync_directory(target.parent)
            _fsync_directory(backup.parent)
        if fault_point:
            trigger_fault(fault_point)
        target.parent.mkdir(parents=True, exist_ok=True)
        staged_directory.rename(target)
        _fsync_directory(target.parent)

    def rename_paths(self, mapping: Mapping[Path, Path]) -> list[tuple[Path, Path]]:
        normalized = {
            self._project_path(source): self._project_path(target)
            for source, target in mapping.items()
            if Path(source).resolve(strict=False) != Path(target).resolve(strict=False)
        }
        existing = {source: target for source, target in normalized.items() if source.exists()}
        if not existing:
            return []
        targets = list(existing.values())
        if len(set(targets)) != len(targets):
            raise ValueError("Multiple rename sources cannot use the same target path")

        source_set = set(existing)
        for source, target in existing.items():
            if target.exists() and target not in source_set:
                raise FileExistsError(f"Cannot rename {source} to existing path {target}")

        rename_root = self.temp_root / "renames" / uuid.uuid4().hex
        rename_root.mkdir(parents=True, exist_ok=True)
        batch = _RenameBatch([
            _PathRename(source, target, rename_root / uuid.uuid4().hex)
            for source, target in existing.items()
        ])
        self._rename_batches.append(batch)
        self._persist_journal()
        try:
            for record in batch.records:
                record.original.rename(record.staged)
            batch.install_started = True
            self._persist_journal()
            for record in batch.records:
                record.target.parent.mkdir(parents=True, exist_ok=True)
                record.staged.rename(record.target)
            _fsync_directory(self.root)
        except Exception:
            errors = _rollback_rename_batches(
                self.root,
                self.temp_root,
                self._journal_payload().get("renameBatches", [])[-1:],
            )
            if not errors:
                self._rename_batches.pop()
                self._persist_journal()
            else:
                raise RuntimeError("Rename rollback was incomplete: " + "; ".join(errors))
            raise
        return [(record.original, record.target) for record in batch.records]

    def rollback(self) -> None:
        if self._finished:
            return
        payload = self._journal_payload(state="active")
        _rollback_transaction_payload(self.root, self.temp_root, payload)
        self._state = "rolledback"
        self._persist_journal(state="rolledback")
        self._cleanup_temp()
        self._finished = True

    def commit(self) -> list[str]:
        if self._finished:
            return []
        try:
            self._persist_journal(state="committed")
        except Exception:
            self.rollback()
            raise
        self._state = "committed"
        warnings: list[str] = []
        try:
            self._cleanup_temp()
        except Exception as exc:  # pragma: no cover - cleanup-only failure
            warnings.append(f"Could not remove transaction staging directory {self.temp_root}: {exc}")
        self._finished = True
        return warnings

    def _cleanup_temp(self) -> None:
        if self.temp_root.exists():
            shutil.rmtree(self.temp_root)
            _fsync_directory(self.root)

    def __enter__(self) -> "ProjectTransaction":
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        if self._finished:
            return
        if exc_type is None:
            self.commit()
        else:
            self.rollback()
