#!/usr/bin/env python3
"""Remove safe-to-delete local caches and obsolete duplicate source artifacts."""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path
from typing import Iterable, Sequence

DUPLICATE_SHARE_IMAGES: tuple[str, ...] = (
    "social-share-default(2).png",
    "social-share-default(3).png",
    "social-share-default(4).png",
)
IGNORED_DIRECTORY_NAMES: frozenset[str] = frozenset({".git", ".venv", "node_modules", "dist", ".artifacts"})


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def iter_cache_directories(root: Path) -> Iterable[Path]:
    for path in root.rglob("__pycache__"):
        if any(part in IGNORED_DIRECTORY_NAMES for part in path.relative_to(root).parts):
            continue
        if path.is_dir():
            yield path


def iter_bytecode_files(root: Path) -> Iterable[Path]:
    for pattern in ("*.pyc", "*.pyo"):
        for path in root.rglob(pattern):
            relative_parts = path.relative_to(root).parts
            if any(part in IGNORED_DIRECTORY_NAMES for part in relative_parts):
                continue
            if "__pycache__" in relative_parts:
                continue
            if path.is_file():
                yield path


def cleanup_candidates(root: Path) -> tuple[Path, ...]:
    candidates = list(iter_cache_directories(root))
    candidates.extend(iter_bytecode_files(root))
    candidates.extend(root / name for name in DUPLICATE_SHARE_IMAGES if (root / name).exists())
    return tuple(sorted(set(candidates), key=lambda path: (len(path.parts), path.as_posix()), reverse=True))


def clean_project_artifacts(root: Path | None = None, *, check: bool = False) -> tuple[Path, ...]:
    base = (root or project_root()).resolve()
    candidates = cleanup_candidates(base)
    if check or not candidates:
        return candidates

    for path in candidates:
        if path.is_dir():
            shutil.rmtree(path)
        else:
            path.unlink(missing_ok=True)
    return candidates


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Fail when removable artifacts are present without deleting them.")
    args = parser.parse_args(argv)
    candidates = clean_project_artifacts(check=args.check)
    if args.check and candidates:
        print("Removable project artifacts are present:")
        for path in candidates:
            print(f"  - {path.relative_to(project_root()).as_posix()}")
        print("Run: npm run clean:artifacts")
        return 1
    if candidates:
        print(f"Removed {len(candidates)} local cache/duplicate artifact(s).")
    else:
        print("No removable local artifacts were found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
