from __future__ import annotations

import importlib.util
from pathlib import Path


def _load_contract_module():
    root = Path(__file__).resolve().parents[1]
    path = root / "tools" / "check_frontend_contracts.py"
    spec = importlib.util.spec_from_file_location("check_frontend_contracts", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


MODULE = _load_contract_module()


def test_detects_historical_whole_bundle_arrow_iife() -> None:
    source = "/* generated banner */\n(() => {\n  console.log('legacy');\n})();\n"
    assert MODULE._has_legacy_top_level_iife_wrapper(source)


def test_detects_historical_whole_bundle_function_iife() -> None:
    source = "/* generated banner */\n(function () {\n  console.log('legacy');\n})();\n"
    assert MODULE._has_legacy_top_level_iife_wrapper(source)


def test_allows_local_iife_inside_native_module_bundle() -> None:
    source = "/* generated banner */\nvar domain = (() => { return Object.freeze({}); })();\ninit();\n"
    assert not MODULE._has_legacy_top_level_iife_wrapper(source)


def test_does_not_accept_wrapper_text_hidden_after_real_module_code() -> None:
    source = "const ready = true;\n(() => { console.log('nested'); })();\n"
    assert not MODULE._has_legacy_top_level_iife_wrapper(source)


def test_rejects_positive_implementation_assertions_against_generated_bundles(tmp_path: Path) -> None:
    tests = tmp_path / "tests"
    tests.mkdir()
    (tests / "brittle.test.js").write_text(
        "const app = readAllBundles();\nassert.match(app, /function implementationDetail/);\n",
        encoding="utf-8",
    )
    failures: list[str] = []
    MODULE.check_test_strategy(tmp_path, failures)
    assert any("implementation syntax against generated bundles" in failure for failure in failures)


def test_allows_structural_absence_assertions_against_generated_bundles(tmp_path: Path) -> None:
    tests = tmp_path / "tests"
    tests.mkdir()
    (tests / "structural.test.js").write_text(
        "const app = readAllBundles();\nassert.doesNotMatch(app, /obsolete-loader/);\n",
        encoding="utf-8",
    )
    failures: list[str] = []
    MODULE.check_test_strategy(tmp_path, failures)
    assert not any("implementation syntax against generated bundles" in failure for failure in failures)
