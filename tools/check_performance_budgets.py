#!/usr/bin/env python3
"""Enforce explicit network-size and social-image budgets.

Source assets are checked on every quick verification. When ``--bundle-dir`` is
provided, the fingerprinted deploy assets and the largest generated HTML file
are checked as well. Gzip sizes are calculated deterministically in memory so
CI does not depend on server compression settings.
"""
from __future__ import annotations

import argparse
import gzip
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

BUDGET_FILE = "performance-budgets.json"


@dataclass(frozen=True)
class BudgetMeasurement:
    label: str
    path: Path
    raw_bytes: int
    gzip_bytes: int | None = None


def project_root() -> Path:
    return Path(__file__).resolve().parents[1]


def load_budgets(root: Path) -> Mapping[str, Any]:
    path = root / BUDGET_FILE
    try:
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError as exc:
        raise FileNotFoundError(f"Missing performance budget file: {BUDGET_FILE}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Could not parse {BUDGET_FILE}: {exc}") from exc
    if not isinstance(payload, dict):
        raise ValueError(f"{BUDGET_FILE} must contain one JSON object")
    return payload


def gzip_size(path: Path) -> int:
    return len(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))


def measure_file(label: str, path: Path, *, include_gzip: bool = True) -> BudgetMeasurement:
    if not path.is_file():
        raise FileNotFoundError(f"Performance budget input is missing: {path}")
    return BudgetMeasurement(
        label=label,
        path=path,
        raw_bytes=path.stat().st_size,
        gzip_bytes=gzip_size(path) if include_gzip else None,
    )


def resolve_bundle_asset(bundle_dir: Path, pattern: str) -> Path:
    matches = sorted(bundle_dir.glob(pattern))
    if len(matches) != 1:
        raise ValueError(
            f"Expected exactly one deploy asset for '{pattern}' under {bundle_dir}; found {len(matches)}"
        )
    return matches[0]


def format_bytes(value: int) -> str:
    return f"{value / 1024:.1f} KiB"


def assert_limit(failures: list[str], *, label: str, kind: str, actual: int, limit: int) -> None:
    if actual > limit:
        failures.append(
            f"{label} {kind} is {format_bytes(actual)}; budget is {format_bytes(limit)}"
        )


def check_asset_budget(
    failures: list[str],
    measurements: list[BudgetMeasurement],
    *,
    label: str,
    path: Path,
    budget: Mapping[str, Any],
) -> None:
    measurement = measure_file(label, path)
    measurements.append(measurement)
    assert_limit(
        failures,
        label=label,
        kind="raw size",
        actual=measurement.raw_bytes,
        limit=int(budget["rawBytes"]),
    )
    assert_limit(
        failures,
        label=label,
        kind="gzip size",
        actual=int(measurement.gzip_bytes or 0),
        limit=int(budget["gzipBytes"]),
    )



def png_dimensions(path: Path) -> tuple[int, int]:
    header = path.read_bytes()[:24]
    if len(header) < 24 or header[:8] != b"\x89PNG\r\n\x1a\n" or header[12:16] != b"IHDR":
        raise ValueError(f"Social share image must be a valid PNG file: {path}")
    return (int.from_bytes(header[16:20], "big"), int.from_bytes(header[20:24], "big"))

def check_social_image(
    failures: list[str],
    measurements: list[BudgetMeasurement],
    root: Path,
    budget: Mapping[str, Any],
) -> None:
    path = root / str(budget["source"])
    measurement = measure_file("Social share image", path, include_gzip=False)
    measurements.append(measurement)
    assert_limit(
        failures,
        label=measurement.label,
        kind="file size",
        actual=measurement.raw_bytes,
        limit=int(budget["rawBytes"]),
    )
    actual_size = png_dimensions(path)
    expected_size = (int(budget["width"]), int(budget["height"]))
    if actual_size != expected_size:
        failures.append(
            f"Social share image dimensions are {actual_size[0]}x{actual_size[1]}; "
            f"expected {expected_size[0]}x{expected_size[1]}"
        )


def largest_html(bundle_dir: Path) -> Path:
    files = [path for path in bundle_dir.rglob("*.html") if path.is_file()]
    if not files:
        raise FileNotFoundError(f"No generated HTML files were found under {bundle_dir}")
    return max(files, key=lambda path: path.stat().st_size)


def check_performance_budgets(root: Path, bundle_dir: Path | None = None) -> list[BudgetMeasurement]:
    budgets = load_budgets(root)
    failures: list[str] = []
    measurements: list[BudgetMeasurement] = []

    for key, label in (
        ("appJavaScript", "Application JavaScript"),
        ("stylesCss", "Application CSS"),
        ("searchIndex", "Search index"),
    ):
        budget = budgets[key]
        path = root / str(budget["source"])
        check_asset_budget(failures, measurements, label=label, path=path, budget=budget)

    check_social_image(failures, measurements, root, budgets["socialShareImage"])

    if bundle_dir is not None:
        resolved_bundle = bundle_dir.resolve()
        for key, label in (
            ("appJavaScript", "Deploy JavaScript"),
            ("stylesCss", "Deploy CSS"),
            ("searchIndex", "Deploy search index"),
        ):
            budget = budgets[key]
            path = resolve_bundle_asset(resolved_bundle, str(budget["bundlePattern"]))
            check_asset_budget(failures, measurements, label=label, path=path, budget=budget)

        html_path = largest_html(resolved_bundle)
        html_budget = budgets["largestHtml"]
        check_asset_budget(
            failures,
            measurements,
            label=f"Largest HTML ({html_path.relative_to(resolved_bundle).as_posix()})",
            path=html_path,
            budget=html_budget,
        )

    if failures:
        raise RuntimeError("Performance budget exceeded:\n  - " + "\n  - ".join(failures))
    return measurements


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--bundle-dir",
        help="Optional deploy bundle whose fingerprinted assets and largest HTML should be checked.",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    root = project_root()
    bundle_dir = Path(args.bundle_dir).resolve() if args.bundle_dir else None
    try:
        measurements = check_performance_budgets(root, bundle_dir)
    except Exception as exc:
        print(f"PERFORMANCE BUDGET CHECK FAILED: {exc}")
        return 1

    print("Performance budgets passed:")
    for item in measurements:
        details = f"raw {format_bytes(item.raw_bytes)}"
        if item.gzip_bytes is not None:
            details += f", gzip {format_bytes(item.gzip_bytes)}"
        try:
            shown_path = item.path.relative_to(root).as_posix()
        except ValueError:
            shown_path = item.path.as_posix()
        print(f"  {item.label}: {details} — {shown_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
