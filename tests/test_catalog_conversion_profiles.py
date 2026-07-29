from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLS = ROOT / "tools"


def load_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, TOOLS / filename)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


PROFILES = load_module("catalog_conversion_profiles_tests", "catalog_conversion_profiles.py")
BUILD = load_module("build_catalogs_profile_tests", "build_catalogs.py")
SERVER = load_module("catalog_control_profile_tests", "catalog_control_server.py")


def test_production_profile_is_the_cli_default() -> None:
    args = BUILD.parse_args([])
    profile = PROFILES.get_conversion_profile("production")
    options = BUILD.build_options_from_args(args)

    assert args.profile == "production"
    assert args.force is False
    assert args.no_clean is False
    assert args.skip_existing is False
    assert options.dpi == profile.dpi == 220
    assert options.max_width == profile.max_width == 2800
    assert options.max_height == profile.max_height == 2800
    assert options.medium_size == profile.medium_size == 1600
    assert options.thumb_size == profile.thumb_size == 420
    assert options.quality == profile.quality == 84
    assert options.medium_quality == profile.medium_quality == 82
    assert options.thumb_quality == profile.thumb_quality == 76
    assert options.sharpen == profile.sharpen == 0.8
    assert options.ocr_mode == profile.ocr_mode == "auto"
    assert options.ocr_min_confidence == profile.ocr_min_confidence == 65
    assert options.ocr_title_min_confidence == profile.ocr_title_min_confidence == 45
    assert options.ocr_max_words_per_page == profile.ocr_max_words_per_page == 180


def test_force_and_ocr_refresh_profiles_only_change_workflow_flags() -> None:
    force = BUILD.parse_args(["--profile", "force"])
    refresh = BUILD.parse_args(["--profile", "ocr-refresh"])

    assert force.force is True
    assert force.no_clean is False
    assert force.skip_existing is False

    assert refresh.force is True
    assert refresh.no_clean is True
    assert refresh.skip_existing is True
    assert BUILD.build_options_from_args(refresh).ocr_mode == "auto"


def test_explicit_cli_values_override_profile_numeric_defaults() -> None:
    args = BUILD.parse_args([
        "--profile", "production",
        "--dpi", "300",
        "--quality", "90",
        "--ocr", "never",
    ])
    options = BUILD.build_options_from_args(args)
    assert options.dpi == 300
    assert options.quality == 90
    assert options.ocr_mode == "never"


def test_control_panel_uses_the_same_thin_profile_commands() -> None:
    assert SERVER.ACTIONS["convert"].command == PROFILES.conversion_profile_command("production")
    assert SERVER.ACTIONS["convert_force"].command == PROFILES.conversion_profile_command("force")
    assert SERVER.ACTIONS["refresh_ocr"].command == PROFILES.conversion_profile_command("ocr-refresh")


def test_windows_wrappers_only_select_a_canonical_profile() -> None:
    expected = {
        ".10-convert-catalogs.bat": "python tools\\build_catalogs.py --profile production",
        ".011-convert-catalogs-force.bat": "python tools\\build_catalogs.py --profile force",
        ".012-refresh-ocr-search.bat": "python tools\\build_catalogs.py --profile ocr-refresh",
    }
    legacy_flags = ("--dpi", "--quality", "--thumb-size", "--ocr-dpi", "--sharpen")
    for filename, command in expected.items():
        source = (ROOT / filename).read_text(encoding="utf-8-sig")
        assert command in source
        assert not any(flag in source for flag in legacy_flags)


def test_confirmed_missing_pdf_ids_are_revalidated_by_the_converter() -> None:
    exact = BUILD.parse_args([
        "--profile", "production",
        "--prune-missing-pdfs",
        "--confirmed-missing-pdf-id", "missing-b",
        "--confirmed-missing-pdf-id", "missing-a",
    ])
    missing = [{"id": "missing-a"}, {"id": "missing-b"}]
    BUILD.validate_missing_pdf_prune_confirmation(exact, missing)

    stale = BUILD.parse_args([
        "--prune-missing-pdfs",
        "--confirmed-missing-pdf-id", "missing-a",
    ])
    import pytest
    with pytest.raises(RuntimeError, match="changed after confirmation"):
        BUILD.validate_missing_pdf_prune_confirmation(stale, missing)


def test_control_panel_job_command_carries_the_exact_confirmation() -> None:
    command = SERVER.action_command_for_job(
        "convert",
        prune_missing_pdfs=True,
        confirmed_missing_pdf_ids=("missing-b", "missing-a", "missing-a"),
    )
    assert command == [
        "tools/build_catalogs.py",
        "--profile",
        "production",
        "--prune-missing-pdfs",
        "--confirmed-missing-pdf-id",
        "missing-a",
        "--confirmed-missing-pdf-id",
        "missing-b",
    ]
