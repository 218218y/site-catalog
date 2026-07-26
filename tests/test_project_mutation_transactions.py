from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from pathlib import Path

import fitz
import pytest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))


def load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, TOOLS / filename)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


MUTATION = load_module("project_mutation_transaction_tests", "project_mutation.py")
BUILD = load_module("build_catalogs_transaction_tests", "build_catalogs.py")
SERVER = load_module("catalog_control_transaction_tests", "catalog_control_server.py")
CLEAN = load_module("clean_project_artifacts_lock_tests", "clean_project_artifacts.py")


def snapshot_tree(root: Path) -> dict[str, bytes]:
    ignored_prefixes = (
        ".catalog-build-transaction-",
        ".catalog-save-transaction-",
        ".taxonomy-save-transaction-",
    )
    result: dict[str, bytes] = {}
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(root).as_posix()
        if relative == MUTATION.LOCK_FILENAME:
            continue
        if any(part.startswith(ignored_prefixes) for part in path.parts):
            continue
        result[relative] = path.read_bytes()
    return result


def write_pdf(path: Path, pages: int = 1) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    document = fitz.open()
    for page_number in range(1, pages + 1):
        page = document.new_page()
        page.insert_text((72, 72), f"catalog page {page_number}")
    document.save(path)
    document.close()


def write_complete_output(root: Path, catalog_id: str, *, value: int = 32) -> None:
    output = root / "assets/pages" / catalog_id
    (output / "medium").mkdir(parents=True, exist_ok=True)
    (output / "thumbs").mkdir(parents=True, exist_ok=True)
    for relative in (
        Path("page-001.png"),
        Path("medium/page-001.png"),
        Path("thumbs/page-001.png"),
    ):
        Image.new("RGB", (24, 24), (value, value, value)).save(output / relative, "PNG")
    (output / "catalog.render-manifest.json").write_text(
        json.dumps({"version": 1, "legacy": True}) + "\n",
        encoding="utf-8",
    )


def build_argv(*extra: str) -> list[str]:
    return [
        "build_catalogs.py",
        "--force",
        "--ocr",
        "never",
        "--format",
        "png",
        "--dpi",
        "72",
        "--max-width",
        "600",
        "--max-height",
        "600",
        "--medium-size",
        "320",
        "--thumb-size",
        "80",
        "--sharpen",
        "0",
        *extra,
    ]


def build_fixture(root: Path, *, include_missing: bool = False) -> None:
    write_pdf(root / "assets/pdfs/keep.pdf")
    config = [
        {
            "id": "keep",
            "title": "Keep",
            "pdf": "assets/pdfs/keep.pdf",
            "ocr": False,
        }
    ]
    if include_missing:
        config.append(
            {
                "id": "missing",
                "title": "Missing",
                "pdf": "assets/pdfs/missing.pdf",
                "ocr": False,
            }
        )
    (root / "catalogs.config.json").write_text(
        json.dumps(config, indent=2) + "\n",
        encoding="utf-8",
    )
    write_complete_output(root, "keep")
    if include_missing:
        write_complete_output(root, "missing", value=64)
    (root / "catalogs.generated.json").write_text('[{"id":"old-public"}]\n', encoding="utf-8")
    (root / "catalogs.generated.js").write_text("window.BARGIG_CATALOGS = [{\"id\":\"old-public\"}];\n", encoding="utf-8")
    (root / "catalogs.search.json").write_text('[{"catalogId":"old-public","pages":[]}]\n', encoding="utf-8")
    (root / "catalogs.search.js").write_text("window.BARGIG_CATALOG_SEARCH = [{\"catalogId\":\"old-public\",\"pages\":[]}];\n", encoding="utf-8")


@pytest.mark.parametrize(
    "fault_point",
    ["during-page-render", "during-search-index", "during-output-replacement"],
)
def test_conversion_faults_preserve_the_entire_previous_public_version(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    fault_point: str,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    build_fixture(root)
    before = snapshot_tree(root)

    monkeypatch.setattr(BUILD, "project_root", lambda: root)
    monkeypatch.setattr(sys, "argv", build_argv())
    monkeypatch.setenv(MUTATION.FAULT_ENV, fault_point)

    assert BUILD.main() == 1
    assert snapshot_tree(root) == before


def test_prune_fault_after_config_write_restores_config_and_public_outputs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    build_fixture(root, include_missing=True)
    before = snapshot_tree(root)

    monkeypatch.setattr(BUILD, "project_root", lambda: root)
    monkeypatch.setattr(sys, "argv", build_argv("--prune-missing-pdfs"))
    monkeypatch.setenv(MUTATION.FAULT_ENV, "after-config-write")

    assert BUILD.main() == 1
    assert snapshot_tree(root) == before


def test_missing_pdf_without_explicit_prune_changes_nothing(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    build_fixture(root, include_missing=True)
    before = snapshot_tree(root)

    monkeypatch.setattr(BUILD, "project_root", lambda: root)
    monkeypatch.setattr(sys, "argv", build_argv())

    assert BUILD.main() == 1
    assert snapshot_tree(root) == before


def patch_control_paths(monkeypatch: pytest.MonkeyPatch, root: Path) -> None:
    monkeypatch.setattr(SERVER, "PROJECT_ROOT", root)
    monkeypatch.setattr(SERVER, "CONFIG_FILE", root / "catalogs.config.json")
    monkeypatch.setattr(SERVER, "TAXONOMY_FILE", root / "catalog-taxonomy.config.json")
    monkeypatch.setattr(SERVER, "GENERATED_JSON_FILE", root / "catalogs.generated.json")
    monkeypatch.setattr(SERVER, "GENERATED_JS_FILE", root / "catalogs.generated.js")
    monkeypatch.setattr(SERVER, "SEARCH_JSON_FILE", root / "catalogs.search.json")
    monkeypatch.setattr(SERVER, "SEARCH_JS_FILE", root / "catalogs.search.js")
    monkeypatch.setattr(SERVER, "SEARCH_OVERRIDES_FILE", root / "catalogs.search-overrides.json")
    monkeypatch.setattr(SERVER, "PDF_DIR", root / "assets/pdfs")
    monkeypatch.setattr(SERVER, "PAGES_DIR", root / "assets/pages")


def control_fixture(root: Path) -> tuple[list[dict[str, object]], dict[str, object]]:
    (root / "assets/pdfs").mkdir(parents=True)
    (root / "assets/pdfs/catalog.pdf").write_bytes(b"%PDF-1.4\n")
    (root / "assets/pages/old-id").mkdir(parents=True)
    (root / "assets/pages/old-id/page-001.webp").write_bytes(b"old image")
    old_catalog = {
        "id": "old-id",
        "title": "Old",
        "description": "old description",
        "category": "Category",
        "subcategory": "Sub",
        "pdf": "assets/pdfs/catalog.pdf",
        "ocr": False,
    }
    (root / "catalogs.config.json").write_text(json.dumps([old_catalog], indent=2) + "\n", encoding="utf-8")
    taxonomy = {
        "categories": [{"name": "Category", "slug": "", "description": ""}],
        "subcategories": [{"category": "Category", "name": "Sub", "slug": "", "description": ""}],
    }
    (root / "catalog-taxonomy.config.json").write_text(json.dumps(taxonomy) + "\n", encoding="utf-8")
    generated = [{"id": "old-id", "title": "Old", "description": "old", "category": "Category", "subcategory": "Sub", "pages": 1, "dir": "assets/pages/old-id", "cover": "assets/pages/old-id/page-001.webp", "imageExt": "webp"}]
    search = [{"catalogId": "old-id", "title": "Old", "pages": [{"page": 1, "text": "old"}]}]
    (root / "catalogs.generated.json").write_text(json.dumps(generated) + "\n", encoding="utf-8")
    (root / "catalogs.generated.js").write_text("old generated js\n", encoding="utf-8")
    (root / "catalogs.search.json").write_text(json.dumps(search) + "\n", encoding="utf-8")
    (root / "catalogs.search.js").write_text("old search js\n", encoding="utf-8")
    (root / "catalogs.search-overrides.json").write_text(json.dumps({"old-id": {"1": ["term"]}}) + "\n", encoding="utf-8")

    changed = dict(old_catalog)
    changed.update({"id": "new-id", "originalId": "old-id", "title": "New"})
    return [changed], taxonomy


@pytest.mark.parametrize(
    "fault_point",
    ["after-config-write", "after-directory-rename", "during-search-index"],
)
def test_control_panel_save_faults_rollback_every_file_and_directory(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    fault_point: str,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    catalogs, taxonomy = control_fixture(root)
    patch_control_paths(monkeypatch, root)
    before = snapshot_tree(root)
    monkeypatch.setenv(MUTATION.FAULT_ENV, fault_point)

    with pytest.raises(RuntimeError, match="Injected mutation fault"):
        SERVER.save_catalogs_transactionally(catalogs, taxonomy, [])

    assert snapshot_tree(root) == before
    assert (root / "assets/pages/old-id").is_dir()
    assert not (root / "assets/pages/new-id").exists()


def test_control_panel_save_commits_all_related_outputs_together(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    catalogs, taxonomy = control_fixture(root)
    patch_control_paths(monkeypatch, root)

    result = SERVER.save_catalogs_transactionally(catalogs, taxonomy, [])

    saved_config = json.loads((root / "catalogs.config.json").read_text(encoding="utf-8"))
    generated = json.loads((root / "catalogs.generated.json").read_text(encoding="utf-8"))
    search = json.loads((root / "catalogs.search.json").read_text(encoding="utf-8"))
    overrides = json.loads((root / "catalogs.search-overrides.json").read_text(encoding="utf-8"))
    assert saved_config[0]["id"] == "new-id"
    assert generated[0]["id"] == "new-id"
    assert generated[0]["dir"] == "assets/pages/new-id"
    assert search[0]["catalogId"] == "new-id"
    assert "new-id" in overrides and "old-id" not in overrides
    assert (root / "assets/pages/new-id/page-001.webp").read_bytes() == b"old image"
    assert not (root / "assets/pages/old-id").exists()
    assert result["deletedAssets"] == []


def test_project_lock_rejects_a_second_mutation_and_then_releases(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    first = MUTATION.ProjectMutationLock(root, "first").acquire()
    try:
        with pytest.raises(MUTATION.MutationBusyError):
            MUTATION.ProjectMutationLock(root, "second").acquire()
    finally:
        first.release()

    with MUTATION.ProjectMutationLock(root, "second"):
        metadata = MUTATION.read_lock_metadata(root)
        assert metadata and metadata["action"] == "second"


def test_control_panel_rejects_a_job_while_another_mutation_owns_the_lock(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    monkeypatch.setattr(SERVER, "PROJECT_ROOT", root)
    monkeypatch.setattr(SERVER, "current_taxonomy_state", lambda: {"issues": []})

    with MUTATION.ProjectMutationLock(root, "existing operation"):
        with pytest.raises(RuntimeError, match="נעול"):
            SERVER.start_job("convert")



def test_direct_maintenance_tool_cannot_bypass_the_shared_lock(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    monkeypatch.setattr(CLEAN, "project_root", lambda: root)

    with MUTATION.ProjectMutationLock(root, "existing operation"):
        assert CLEAN.main(["--check"]) == 1


def test_mutation_runtime_artifacts_are_ignored_by_version_control() -> None:
    ignored = (ROOT / ".gitignore").read_text(encoding="utf-8")
    for pattern in (
        ".site-catalog.mutation.lock",
        ".catalog-build-transaction-*/",
        ".catalog-save-transaction-*/",
        ".taxonomy-save-transaction-*/",
        ".site-catalog-transaction-*/",
    ):
        assert pattern in ignored


def test_control_panel_rejects_a_second_running_job(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    monkeypatch.setattr(SERVER, "PROJECT_ROOT", root)
    monkeypatch.setattr(SERVER, "current_taxonomy_state", lambda: {"issues": []})
    running = SERVER.Job(
        id="already-running",
        action_key="convert",
        label="המרה פעילה",
        started_at=1.0,
    )
    with SERVER.jobs_lock:
        SERVER.jobs.clear()
        SERVER.jobs[running.id] = running
    try:
        with pytest.raises(RuntimeError, match="עדיין פועלת"):
            SERVER.start_job("convert_force")
    finally:
        with SERVER.jobs_lock:
            SERVER.jobs.clear()


def test_every_control_panel_worker_command_acquires_the_shared_lock_itself() -> None:
    for action in SERVER.ACTIONS.values():
        script_path = ROOT / action.command[0]
        source = script_path.read_text(encoding="utf-8")
        assert "ProjectMutationLock" in source, action.command[0]


def test_transaction_refuses_targets_outside_the_project_root(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    outside = tmp_path / "outside.txt"
    outside.write_text("do not touch", encoding="utf-8")

    with MUTATION.ProjectTransaction(root) as transaction:
        with pytest.raises(ValueError, match="outside the project root"):
            transaction.write_text(outside, "changed")

    assert outside.read_text(encoding="utf-8") == "do not touch"


def test_directory_replacement_accepts_only_its_own_staging_area(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    unrelated = root / "unrelated-staging"
    unrelated.mkdir()

    with MUTATION.ProjectTransaction(root) as transaction:
        with pytest.raises(ValueError, match="outside the transaction directory"):
            transaction.replace_directory(root / "target", unrelated)


def test_control_save_rejects_half_missing_generated_file_pairs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    catalogs, taxonomy = control_fixture(root)
    patch_control_paths(monkeypatch, root)
    (root / "catalogs.generated.js").unlink()
    before = snapshot_tree(root)

    with pytest.raises(RuntimeError, match="אינם במצב תואם"):
        SERVER.save_catalogs_transactionally(catalogs, taxonomy, [])

    assert snapshot_tree(root) == before


def test_hard_process_termination_is_recovered_before_the_next_mutation(tmp_path: Path) -> None:
    root = tmp_path / "project"
    root.mkdir()
    (root / "state.txt").write_text("old state", encoding="utf-8")
    live_dir = root / "assets/pages/catalog"
    live_dir.mkdir(parents=True)
    (live_dir / "page.bin").write_bytes(b"old page")
    (root / "rename-a").mkdir()
    (root / "rename-a/value.txt").write_text("A", encoding="utf-8")
    (root / "rename-b").mkdir()
    (root / "rename-b/value.txt").write_text("B", encoding="utf-8")

    crash_script = """
import os
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
from project_mutation import ProjectMutationLock, ProjectTransaction
root = Path(sys.argv[2])
with ProjectMutationLock(root, "crashing worker"):
    transaction = ProjectTransaction(root, prefix=".hard-crash-transaction-")
    transaction.write_text(root / "state.txt", "new state")
    staged = transaction.temp_root / "catalogs/catalog"
    staged.mkdir(parents=True)
    (staged / "page.bin").write_bytes(b"new page")
    transaction.replace_directory(root / "assets/pages/catalog", staged)
    transaction.rename_paths({
        root / "rename-a": root / "rename-b",
        root / "rename-b": root / "rename-a",
    })
    os._exit(23)
"""
    completed = subprocess.run(
        [sys.executable, "-c", crash_script, str(TOOLS), str(root)],
        cwd=root,
        env={**os.environ, "PYTHONDONTWRITEBYTECODE": "1"},
        check=False,
    )
    assert completed.returncode == 23
    assert (root / "state.txt").read_text(encoding="utf-8") == "new state"
    assert (live_dir / "page.bin").read_bytes() == b"new page"

    with MUTATION.ProjectMutationLock(root, "next safe operation") as lock:
        assert len(lock.recovered_transactions) == 1

    assert (root / "state.txt").read_text(encoding="utf-8") == "old state"
    assert (live_dir / "page.bin").read_bytes() == b"old page"
    assert (root / "rename-a/value.txt").read_text(encoding="utf-8") == "A"
    assert (root / "rename-b/value.txt").read_text(encoding="utf-8") == "B"
    assert not list(root.glob(".*transaction-*"))


def test_durable_file_copy_fsyncs_a_writable_destination_descriptor(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    source = tmp_path / "source.bin"
    target = tmp_path / "backup/target.bin"
    source.write_bytes(b"durable backup")
    real_fsync = MUTATION.os.fsync
    checked_descriptors: list[int] = []

    def fsync_requiring_write_access(descriptor: int) -> None:
        try:
            MUTATION.os.write(descriptor, b"")
        except OSError as exc:  # pragma: no cover - fails on the old Windows implementation
            raise AssertionError("durable copies must fsync a writable descriptor") from exc
        checked_descriptors.append(descriptor)
        real_fsync(descriptor)

    monkeypatch.setattr(MUTATION, "_fsync_directory", lambda _path: None)
    monkeypatch.setattr(MUTATION.os, "fsync", fsync_requiring_write_access)

    MUTATION._copy_file_durable(source, target)

    assert target.read_bytes() == b"durable backup"
    assert checked_descriptors


def test_rename_recovery_accepts_an_original_that_was_already_restored(tmp_path: Path) -> None:
    root = tmp_path / "project"
    temp_root = root / ".transaction"
    original = root / "original"
    target = root / "target"
    staged = temp_root / "renames/staged"
    original.mkdir(parents=True)
    temp_root.mkdir()

    errors = MUTATION._rollback_rename_batches(
        root,
        temp_root,
        [
            {
                "installStarted": True,
                "records": [
                    {
                        "original": original.relative_to(root).as_posix(),
                        "target": target.relative_to(root).as_posix(),
                        "staged": staged.relative_to(temp_root).as_posix(),
                    }
                ],
            }
        ],
    )

    assert errors == []
    assert original.is_dir()
    assert not target.exists()
    assert not staged.exists()
