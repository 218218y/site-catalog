from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"
if str(TOOLS) not in sys.path:
    sys.path.insert(0, str(TOOLS))

SPEC = importlib.util.spec_from_file_location("audit_accessibility", TOOLS / "audit_accessibility.py")
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)

def test_public_documents_pass_static_accessibility_audit() -> None:
    results = MODULE.audit_project(ROOT)
    assert results
    assert all(not issues for issues in results.values()), results

def test_accessibility_statement_is_part_of_public_documents() -> None:
    assert any(page.filename == "accessibility.html" for page in MODULE.PAGE_DOCUMENTS)
