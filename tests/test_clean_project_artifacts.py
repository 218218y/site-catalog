from __future__ import annotations

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "clean_project_artifacts",
    ROOT / "tools" / "clean_project_artifacts.py",
)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_cleanup_removes_source_caches_and_known_duplicate_images(tmp_path: Path) -> None:
    cache = tmp_path / "tools" / "__pycache__"
    cache.mkdir(parents=True)
    (cache / "module.pyc").write_bytes(b"cache")
    loose_bytecode = tmp_path / "tests" / "stale.pyo"
    loose_bytecode.parent.mkdir()
    loose_bytecode.write_bytes(b"cache")
    duplicate = tmp_path / MODULE.DUPLICATE_SHARE_IMAGES[0]
    duplicate.write_bytes(b"duplicate")

    candidates = MODULE.clean_project_artifacts(tmp_path, check=True)
    assert cache in candidates
    assert cache / "module.pyc" not in candidates, "cache directories should be reported once, not with every child"
    assert loose_bytecode in candidates
    assert duplicate in candidates
    assert cache.exists(), "check mode must not mutate the source tree"

    removed = MODULE.clean_project_artifacts(tmp_path)
    assert set(removed) == set(candidates)
    assert not cache.exists()
    assert not loose_bytecode.exists()
    assert not duplicate.exists()


def test_cleanup_never_descends_into_dependency_or_build_directories(tmp_path: Path) -> None:
    protected = []
    for directory in MODULE.IGNORED_DIRECTORY_NAMES:
        cache = tmp_path / directory / "nested" / "__pycache__"
        cache.mkdir(parents=True)
        file = cache / "module.pyc"
        file.write_bytes(b"protected")
        protected.append(file)

    assert MODULE.clean_project_artifacts(tmp_path, check=True) == ()
    MODULE.clean_project_artifacts(tmp_path)
    assert all(path.exists() for path in protected)
