#!/usr/bin/env python3
"""Report route-owned JavaScript contributors and shared external runtime cost.

The report reads esbuild's authoritative metafile rather than source file sizes.
It intentionally shows route-owned output separately from shared browser modules
so extraction cannot masquerade as eliminated network cost.
"""
from __future__ import annotations

import argparse
import gzip
import json
from pathlib import Path
from typing import Any, Sequence

from build_frontend_assets import (
    BUNDLE_SPECS,
    ROUTE_EXTERNAL_MODULES,
    FrontendBundleSpec,
    analyze_javascript_bundle,
    project_root,
)


def gzip_bytes(path: Path) -> int:
    return len(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))


def route_specs() -> tuple[FrontendBundleSpec, ...]:
    return tuple(
        spec for spec in BUNDLE_SPECS
        if spec.kind == "js" and spec.output_name.startswith("app-")
    )


def shared_external_records(root: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for source, output in ROUTE_EXTERNAL_MODULES.items():
        path = root / output
        if not path.is_file():
            raise FileNotFoundError(
                f"Generated external browser module is missing: {output}. Run python tools/build_frontend_assets.py"
            )
        records.append({
            "source": source,
            "output": output,
            "rawBytes": path.stat().st_size,
            "gzipBytes": gzip_bytes(path),
        })
    return records


def build_report(root: Path, *, top: int = 12) -> dict[str, Any]:
    shared = shared_external_records(root)
    shared_by_output = {record["output"]: record for record in shared}
    routes: list[dict[str, Any]] = []
    for spec in route_specs():
        analysis = analyze_javascript_bundle(root, spec)
        generated = root / spec.output_name
        external: list[dict[str, Any]] = []
        seen_external: set[tuple[str, str]] = set()
        for specifier, kind in analysis.external_imports:
            logical = Path(specifier).name
            identity = (logical, kind)
            if identity in seen_external:
                continue
            seen_external.add(identity)
            shared_record = shared_by_output.get(logical)
            external.append({
                "specifier": specifier,
                "kind": kind,
                "output": logical,
                "rawBytes": int(shared_record["rawBytes"]) if shared_record else None,
                "gzipBytes": int(shared_record["gzipBytes"]) if shared_record else None,
            })
        generated_bytes = generated.stat().st_size if generated.is_file() else None
        generated_gzip_bytes = gzip_bytes(generated) if generated.is_file() else None
        uncached_external_raw = sum(int(item["rawBytes"] or 0) for item in external)
        uncached_external_gzip = sum(int(item["gzipBytes"] or 0) for item in external)
        routes.append({
            "output": spec.output_name,
            "entrypoint": spec.entrypoint,
            "esbuildBytes": analysis.output_bytes,
            "generatedBytes": generated_bytes,
            "generatedGzipBytes": generated_gzip_bytes,
            "contributors": [
                {
                    "source": item.source,
                    "bytesInOutput": item.bytes_in_output,
                    "percentOfEsbuildOutput": round(
                        (item.bytes_in_output / analysis.output_bytes * 100) if analysis.output_bytes else 0,
                        2,
                    ),
                }
                for item in analysis.contributions[:max(0, top)]
            ],
            "externalModules": external,
            "uncachedExternalRawBytes": uncached_external_raw,
            "uncachedExternalGzipBytes": uncached_external_gzip,
            "uncachedGraphRawBytes": (generated_bytes or 0) + uncached_external_raw,
            "uncachedGraphGzipBytes": (generated_gzip_bytes or 0) + uncached_external_gzip,
        })
    return {
        "schemaVersion": 1,
        "measurement": "esbuild-metafile-bytesInOutput",
        "routes": routes,
        "sharedExternalModules": shared,
    }


def format_kib(value: int | None) -> str:
    return "n/a" if value is None else f"{value / 1024:.1f} KiB"


def print_human(report: dict[str, Any]) -> None:
    print("Frontend bundle contribution report")
    print("Route-owned bytes come from esbuild metafile; shared externals are listed separately.\n")
    for route in report["routes"]:
        print(
            f"{route['output']}: route-owned {format_kib(route['generatedBytes'])}, "
            f"gzip {format_kib(route['generatedGzipBytes'])}; "
            f"uncached graph {format_kib(route['uncachedGraphRawBytes'])}, "
            f"gzip {format_kib(route['uncachedGraphGzipBytes'])}"
        )
        for item in route["contributors"]:
            print(
                f"  {format_kib(item['bytesInOutput']):>10} "
                f"{item['percentOfEsbuildOutput']:>5.1f}%  {item['source']}"
            )
        if route["externalModules"]:
            print(
                f"  shared externals (uncached): {format_kib(route["uncachedExternalRawBytes"])}, "
                f"gzip {format_kib(route["uncachedExternalGzipBytes"])}"
            )
            for item in route["externalModules"]:
                print(
                    f"    {item['output']}: {format_kib(item['rawBytes'])}, "
                    f"gzip {format_kib(item['gzipBytes'])} ({item['kind'] or 'import'})"
                )
        print()


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--top", type=int, default=12, help="Number of route-owned contributors to show per route")
    parser.add_argument("--json", action="store_true", help="Emit machine-readable JSON instead of the human report")
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    if args.top < 0:
        raise SystemExit("--top must be zero or greater")
    report = build_report(project_root(), top=args.top)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))
    else:
        print_human(report)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
