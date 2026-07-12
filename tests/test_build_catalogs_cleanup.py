from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import fitz
import pytest

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"

BUILD_SPEC = importlib.util.spec_from_file_location(
    "build_catalogs_cleanup_contract",
    TOOLS / "build_catalogs.py",
)
assert BUILD_SPEC and BUILD_SPEC.loader
BUILD = importlib.util.module_from_spec(BUILD_SPEC)
sys.modules[BUILD_SPEC.name] = BUILD
BUILD_SPEC.loader.exec_module(BUILD)

CONTROL_SPEC = importlib.util.spec_from_file_location(
    "catalog_control_server_cleanup_contract",
    TOOLS / "catalog_control_server.py",
)
assert CONTROL_SPEC and CONTROL_SPEC.loader
CONTROL = importlib.util.module_from_spec(CONTROL_SPEC)
sys.modules[CONTROL_SPEC.name] = CONTROL
CONTROL_SPEC.loader.exec_module(CONTROL)


def write_pdf(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    document = fitz.open()
    page = document.new_page()
    page.insert_text((72, 72), text)
    document.save(path)
    document.close()


@pytest.mark.parametrize("extra_args", [[], ["--force"]])
def test_conversion_always_reconciles_removed_catalogs(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    extra_args: list[str],
) -> None:
    root = tmp_path / "project"
    root.mkdir()
    write_pdf(root / "assets/pdfs/keep.pdf", "keep catalog")

    config = [
        {
            "id": "keep",
            "title": "Keep",
            "pdf": "assets/pdfs/keep.pdf",
            "ocr": False,
        },
        {
            "id": "missing-pdf",
            "title": "Missing PDF",
            "pdf": "assets/pdfs/missing.pdf",
            "ocr": True,
        },
    ]
    (root / "catalogs.config.json").write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (root / "catalogs.search.json").write_text(
        json.dumps(
            [
                {"catalogId": "keep", "title": "Keep", "pages": [{"page": 1, "text": "old keep"}]},
                {"catalogId": "missing-pdf", "title": "Missing PDF", "pages": [{"page": 1, "text": "stale OCR"}]},
                {"catalogId": "unlisted", "title": "Unlisted", "pages": [{"page": 1, "text": "stale OCR"}]},
            ]
        ),
        encoding="utf-8",
    )

    for catalog_id in ("missing-pdf", "unlisted"):
        output = root / "assets/pages" / catalog_id
        (output / "thumbs").mkdir(parents=True, exist_ok=True)
        (output / "page-001.webp").write_bytes(b"stale")
        (output / "thumbs/page-001.webp").write_bytes(b"stale")

    monkeypatch.setattr(BUILD, "project_root", lambda: root)
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "build_catalogs.py",
            *extra_args,
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
            "--thumb-size",
            "80",
            "--sharpen",
            "0",
        ],
    )

    assert BUILD.main() == 0

    saved_config = json.loads((root / "catalogs.config.json").read_text(encoding="utf-8"))
    assert [item["id"] for item in saved_config] == ["keep"]
    assert (root / "assets/pages/keep/page-001.png").is_file()
    assert not (root / "assets/pages/missing-pdf").exists()
    assert not (root / "assets/pages/unlisted").exists()

    generated = json.loads((root / "catalogs.generated.json").read_text(encoding="utf-8"))
    search = json.loads((root / "catalogs.search.json").read_text(encoding="utf-8"))
    assert [entry["id"] for entry in generated] == ["keep"]
    assert [entry["catalogId"] for entry in search] == ["keep"]


def test_only_two_conversion_actions_and_batch_files_remain() -> None:
    assert "convert" in CONTROL.ACTIONS
    assert "convert_force" in CONTROL.ACTIONS
    assert "convert_delete" not in CONTROL.ACTIONS
    assert "convert_delete_force" not in CONTROL.ACTIONS
    assert not (ROOT / "convert-catalogsdelete.bat").exists()
    assert not (ROOT / "convert-catalogs-deleteforce.bat").exists()
    assert all("--delete-unlisted" not in action.command for action in CONTROL.ACTIONS.values())
