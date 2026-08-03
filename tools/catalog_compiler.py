#!/usr/bin/env python3
"""Single deterministic compiler for catalog-derived public data.

Authoritative inputs have distinct ownership:

* ``catalogs.config.json`` owns editorial catalog metadata and ordering.
* ``catalog-taxonomy.config.json`` owns category routes and descriptions.
* ``catalogs.build-state.json`` owns PDF-derived artifact/search facts produced
  by the conversion pipeline.

Every checked-in catalog projection byte and the active
``catalogs.search-index.json`` are emitted by this module. The control panel and
PDF converter provide inputs; neither owns a second serializer or metadata
patching path. Legacy ``catalogs.search.json`` / ``catalogs.search.js`` may be
read only by the explicit one-time state migration adapter.
"""
from __future__ import annotations

import json
import re
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Mapping, Protocol, Sequence

try:
    from tools.catalog_page_numbering import asset_to_display_page, page_number_start
except ModuleNotFoundError:  # Direct execution from tools/
    from catalog_page_numbering import asset_to_display_page, page_number_start

try:
    from tools.catalog_schema import (
        validate_build_state,
        validate_catalog_config,
        validate_generated,
        validate_compiled_pair,
        validate_search,
        validate_search_index,
        validate_taxonomy_config,
        validate_taxonomy_coverage,
    )
except ModuleNotFoundError:  # Direct execution from tools/
    from catalog_schema import (
        validate_build_state,
        validate_catalog_config,
        validate_generated,
        validate_compiled_pair,
        validate_search,
        validate_search_index,
        validate_taxonomy_config,
        validate_taxonomy_coverage,
    )

try:
    from tools.catalog_search_index import build_normalized_search_index
except ModuleNotFoundError:  # Direct execution from tools/
    from catalog_search_index import build_normalized_search_index

BUILD_STATE_FILE = "catalogs.build-state.json"
GENERATED_JSON_FILE = "catalogs.generated.json"
GENERATED_MODULE_FILE = "catalogs.generated.module.js"
LEGACY_SEARCH_JSON_FILE = "catalogs.search.json"
LEGACY_SEARCH_JS_FILE = "catalogs.search.js"
SEARCH_INDEX_FILE = "catalogs.search-index.json"
TAXONOMY_MODULE_FILE = "catalog-taxonomy.generated.module.js"
MANAGED_CATALOG_OUTPUTS = (
    Path(GENERATED_JSON_FILE),
    Path(GENERATED_MODULE_FILE),
    Path(SEARCH_INDEX_FILE),
)
VARIANT_DIRECTORIES = {
    "thumb": "thumbs",
    "medium": "medium",
    "full": "",
}


class ByteWriter(Protocol):
    def __call__(self, path: Path, data: bytes) -> Any: ...


@dataclass(frozen=True)
class CompiledCatalogData:
    build_state: dict[str, Any]
    generated: list[dict[str, Any]]
    search: list[dict[str, Any]]
    search_index: dict[str, Any]


def _json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _generated_module_bytes(entries: Sequence[Mapping[str, Any]]) -> bytes:
    payload = json.dumps(list(entries), ensure_ascii=False, indent=2)
    return (
        "// הקובץ הזה נוצר אוטומטית על ידי tools/catalog_compiler.py\n"
        "// מקור העריכה הוא catalogs.config.json; נתוני ההמרה מגיעים מ-catalogs.build-state.json.\n"
        "/** @type {import(\"./types/catalog-data.generated.js\").CatalogRecord[]} */\n"
        f"const catalogRecords = {payload};\n"
        "export const catalogs = Object.freeze(catalogRecords);\n"
    ).encode("utf-8")



def compiled_catalog_file_bytes(compiled: CompiledCatalogData) -> dict[Path, bytes]:
    """Return every managed public catalog output as deterministic bytes."""
    return {
        Path(GENERATED_JSON_FILE): _json_bytes(compiled.generated),
        Path(GENERATED_MODULE_FILE): _generated_module_bytes(compiled.generated),
        Path(SEARCH_INDEX_FILE): _json_bytes(compiled.search_index),
    }



def reconstructable_catalog_file_bytes(
    compiled: CompiledCatalogData,
    root: Path,
) -> dict[Path, bytes]:
    """Return every checked-in file derived from compiled catalog data."""
    files = compiled_catalog_file_bytes(compiled)
    viewer_path = root / "catalog-big-pages-viewer-netfree/catalog-big-pages-viewer.html"
    if not viewer_path.is_file():
        return files
    try:
        from tools.build_big_pages_viewer import (
            README_RELATIVE_PATH,
            VIEWER_RELATIVE_PATH,
            render_updated_files_from_catalogs,
        )
    except ModuleNotFoundError:
        from build_big_pages_viewer import (
            README_RELATIVE_PATH,
            VIEWER_RELATIVE_PATH,
            render_updated_files_from_catalogs,
        )
    viewer_text, readme_text = render_updated_files_from_catalogs(root, compiled.generated)
    files[VIEWER_RELATIVE_PATH] = viewer_text.encode("utf-8")
    if readme_text is not None:
        files[README_RELATIVE_PATH] = readme_text.encode("utf-8")
    return files

def build_state_bytes(build_state: Mapping[str, Any]) -> bytes:
    return _json_bytes(dict(build_state))


def _normalize_search_pages(value: Any, pages: int) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    normalized: list[dict[str, Any]] = []
    seen: set[int] = set()
    for item in value:
        if not isinstance(item, Mapping):
            continue
        try:
            page = int(item.get("page", 0))
        except (TypeError, ValueError):
            continue
        if page < 1 or page > pages or page in seen:
            continue
        seen.add(page)
        normalized.append({"page": page, "text": str(item.get("text", ""))})
    normalized.sort(key=lambda item: int(item["page"]))
    return normalized


def _state_image_variants(value: Any, *, fallback_version: str) -> dict[str, dict[str, Any]]:
    source = value if isinstance(value, Mapping) else {}
    defaults = {"thumb": 420, "medium": 1600, "full": 2800}
    variants: dict[str, dict[str, Any]] = {}
    for name in VARIANT_DIRECTORIES:
        raw = source.get(name, {}) if isinstance(source, Mapping) else {}
        raw = raw if isinstance(raw, Mapping) else {}
        variants[name] = {
            "maxSide": int(raw.get("maxSide", defaults[name])),
            "version": str(raw.get("version") or fallback_version),
        }
    return variants


def _public_image_variants(value: Mapping[str, Any]) -> dict[str, dict[str, Any]]:
    return {
        name: {
            "directory": directory,
            "maxSide": int(value[name]["maxSide"]),
            "version": str(value[name]["version"]),
        }
        for name, directory in VARIANT_DIRECTORIES.items()
    }


def artifact_from_compiled_entries(
    generated: Mapping[str, Any],
    search: Mapping[str, Any] | None,
) -> dict[str, Any]:
    """Create one build-state artifact from legacy public outputs.

    This is a migration adapter only.  Once ``catalogs.build-state.json`` exists,
    normal compilation never needs a public generated file as input.
    """
    catalog_id = str(generated.get("id", "")).strip()
    pages = int(generated.get("pages", 0) or 0)
    artifact: dict[str, Any] = {
        "id": catalog_id,
        "pages": pages,
        "imageExt": str(generated.get("imageExt", "webp")).lower(),
        "assetVersion": str(generated.get("assetVersion") or f"legacy-{catalog_id}"),
        "imageVariants": _state_image_variants(
            generated.get("imageVariants"),
            fallback_version=str(generated.get("assetVersion") or f"legacy-{catalog_id}"),
        ),
        "searchPages": _normalize_search_pages(
            search.get("pages", []) if isinstance(search, Mapping) else [],
            pages,
        ),
    }
    if isinstance(generated.get("pageSizes"), list):
        artifact["pageSizes"] = deepcopy(generated["pageSizes"])
    return artifact


def _legacy_js_array(path: Path, global_name: str) -> list[Any]:
    source = path.read_text(encoding="utf-8-sig")
    match = re.search(
        rf"window\.{re.escape(global_name)}\s*=\s*(\[.*\])\s*;\s*$",
        source,
        flags=re.DOTALL,
    )
    if match is None:
        raise ValueError(f"Legacy generated file has no valid window.{global_name} assignment: {path}")
    payload = json.loads(match.group(1))
    if not isinstance(payload, list):
        raise ValueError(f"Legacy window.{global_name} assignment must contain an array: {path}")
    return payload


def migrate_legacy_outputs_to_build_state(root: Path) -> dict[str, Any]:
    """Seed build state once from checked-in legacy outputs.

    The migration is deterministic and validates the resulting state.  It does
    not write anything; callers decide whether the migration belongs to their
    transaction.
    """
    generated_path = root / GENERATED_JSON_FILE
    search_path = root / LEGACY_SEARCH_JSON_FILE
    search_js_path = root / LEGACY_SEARCH_JS_FILE
    search_pair = (search_path.is_file(), search_js_path.is_file())
    if search_pair[0] != search_pair[1]:
        raise RuntimeError(
            "catalogs.search.json ו-catalogs.search.js אינם במצב תואם; "
            "יש לשחזר או לבנות אותם מחדש לפני יצירת מצב ה-Compiler."
        )
    if not generated_path.is_file():
        return {"version": 1, "catalogs": []}
    generated = json.loads(generated_path.read_text(encoding="utf-8-sig"))
    search = json.loads(search_path.read_text(encoding="utf-8-sig")) if search_path.is_file() else []
    if not isinstance(generated, list) or not all(isinstance(item, Mapping) for item in generated):
        raise ValueError("Legacy catalogs.generated.json must contain an array of objects")
    if not isinstance(search, list) or not all(isinstance(item, Mapping) for item in search):
        raise ValueError("Legacy catalogs.search.json must contain an array of objects")
    if search_js_path.is_file() and _legacy_js_array(search_js_path, "BARGIG_CATALOG_SEARCH") != search:
        raise RuntimeError("Legacy catalogs.search.json and catalogs.search.js contain different data")
    search_by_id = {
        str(item.get("catalogId", "")): item
        for item in search
        if isinstance(item, Mapping)
    }
    state = {
        "version": 1,
        "catalogs": [
            artifact_from_compiled_entries(item, search_by_id.get(str(item.get("id", ""))))
            for item in generated
        ],
    }
    return validate_build_state(state, root)


def load_build_state(root: Path, *, allow_legacy_migration: bool = False) -> dict[str, Any]:
    path = root / BUILD_STATE_FILE
    if path.is_file():
        payload = json.loads(path.read_text(encoding="utf-8-sig"))
        return validate_build_state(payload, root)
    if allow_legacy_migration:
        return migrate_legacy_outputs_to_build_state(root)
    raise FileNotFoundError(f"Required compiler state is missing: {BUILD_STATE_FILE}")


def rename_build_state_catalogs(
    build_state: Mapping[str, Any],
    rename_map: Mapping[str, str],
) -> dict[str, Any]:
    """Apply catalog-id renames to compiler state without touching public outputs."""
    normalized = deepcopy(dict(build_state))
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in normalized.get("catalogs", []):
        item = dict(raw)
        original_id = str(item.get("id", ""))
        catalog_id = str(rename_map.get(original_id, original_id))
        if catalog_id in seen:
            raise ValueError(f"Catalog rename would duplicate build-state id: {catalog_id}")
        seen.add(catalog_id)
        item["id"] = catalog_id
        rows.append(item)
    normalized["catalogs"] = rows
    return normalized


def retain_build_state_catalogs(
    build_state: Mapping[str, Any],
    catalog_ids: Iterable[str],
) -> dict[str, Any]:
    """Return state containing only explicitly configured catalog ids."""
    retained = {str(value) for value in catalog_ids}
    normalized = deepcopy(dict(build_state))
    normalized["catalogs"] = [
        deepcopy(dict(item))
        for item in normalized.get("catalogs", [])
        if str(item.get("id", "")) in retained
    ]
    return normalized


def build_artifact_entry(
    *,
    catalog_id: str,
    pages: int,
    image_format: str,
    asset_version: str,
    image_variants: Mapping[str, Any],
    search_pages: Sequence[Mapping[str, Any]],
    page_sizes: Sequence[Sequence[int]] | None = None,
) -> dict[str, Any]:
    entry: dict[str, Any] = {
        "id": str(catalog_id),
        "pages": int(pages),
        "imageExt": str(image_format).lower(),
        "assetVersion": str(asset_version),
        "imageVariants": _state_image_variants(
            image_variants,
            fallback_version=str(asset_version),
        ),
        "searchPages": _normalize_search_pages(list(search_pages), int(pages)),
    }
    if page_sizes is not None:
        entry["pageSizes"] = [[int(size[0]), int(size[1])] for size in page_sizes]
    return entry


def build_state_from_artifacts(
    artifacts: Iterable[Mapping[str, Any]],
    project_root: Path,
) -> dict[str, Any]:
    state = {"version": 1, "catalogs": [deepcopy(dict(item)) for item in artifacts]}
    return validate_build_state(state, project_root)


def compile_catalog_data(
    catalogs: Any,
    taxonomy: Any,
    build_state: Any,
    project_root: Path,
    *,
    require_taxonomy_coverage: bool = True,
) -> CompiledCatalogData:
    """Compile deterministic public catalog/search arrays from authoritative inputs."""
    config = validate_catalog_config(catalogs, project_root)
    if require_taxonomy_coverage:
        taxonomy_payload = validate_taxonomy_config(taxonomy, project_root)
        validate_taxonomy_coverage(config, taxonomy_payload)
    state = validate_build_state(build_state, project_root)
    artifacts_by_id = {str(item["id"]): item for item in state["catalogs"]}
    configured_ids = {str(item["id"]) for item in config}
    orphan_ids = sorted(set(artifacts_by_id) - configured_ids)
    if orphan_ids:
        raise ValueError(
            "Catalog build state contains artifacts that are not present in catalogs.config.json: "
            + ", ".join(orphan_ids)
        )

    generated: list[dict[str, Any]] = []
    search: list[dict[str, Any]] = []
    retained_artifacts: list[dict[str, Any]] = []
    indexed_sources = list(enumerate(config))
    indexed_sources.sort(
        key=lambda pair: (
            int(pair[1].get("sort", 9999)) if isinstance(pair[1].get("sort", 9999), int) else 9999,
            pair[0],
        )
    )
    for _source_index, source in indexed_sources:
        catalog_id = str(source["id"])
        artifact = artifacts_by_id.get(catalog_id)
        if artifact is None:
            # A newly configured PDF is intentionally not public until conversion
            # has produced a complete artifact record.
            continue
        retained_artifacts.append(deepcopy(dict(artifact)))
        directory = f"assets/pages/{catalog_id}"
        image_format = str(artifact["imageExt"])
        entry: dict[str, Any] = {
            "id": catalog_id,
            "title": str(source["title"]),
            "description": str(source.get("description", "")),
            "category": str(source["category"]),
            "pages": int(artifact["pages"]),
            "pageNumberStart": page_number_start(source),
            "dir": directory,
            "cover": f"{directory}/page-001.{image_format}",
            "imageExt": image_format,
            "assetVersion": str(artifact["assetVersion"]),
            "imageVariants": _public_image_variants(artifact["imageVariants"]),
        }
        if "pageSizes" in artifact:
            entry["pageSizes"] = deepcopy(artifact["pageSizes"])
        subcategory = str(source.get("subcategory", ""))
        if subcategory or "subcategory" in source:
            entry["subcategory"] = subcategory
        for key in ("sort", "badge"):
            if key in source:
                entry[key] = deepcopy(source[key])
        generated.append(entry)
        page_mapping_catalog = {
            "pages": int(artifact["pages"]),
            "pageNumberStart": page_number_start(source),
        }
        search.append({
            "catalogId": catalog_id,
            "title": str(source["title"]),
            "pages": [
                {
                    **deepcopy(dict(page)),
                    "page": asset_to_display_page(page_mapping_catalog, page.get("page")),
                }
                for page in artifact["searchPages"]
            ],
        })

    normalized_state = {"version": 1, "catalogs": retained_artifacts}
    normalized_state = validate_build_state(normalized_state, project_root)
    generated = validate_generated(generated, project_root)
    search = validate_search(search, project_root)
    validate_compiled_pair(generated, search)
    search_index = validate_search_index(
        build_normalized_search_index(generated, search),
        project_root,
    )
    return CompiledCatalogData(normalized_state, generated, search, search_index)


def write_compiled_catalog_data(
    compiled: CompiledCatalogData,
    root: Path,
    *,
    writer: ByteWriter,
    write_build_state: bool = False,
) -> tuple[Path, ...]:
    """Write all compiler-owned catalog files through one supplied transaction writer."""
    written: list[Path] = []

    def write_if_changed(path: Path, data: bytes) -> None:
        if path.is_file() and path.read_bytes() == data:
            return
        writer(path, data)
        written.append(path)

    if write_build_state:
        path = root / BUILD_STATE_FILE
        write_if_changed(path, build_state_bytes(compiled.build_state))
    for relative, data in reconstructable_catalog_file_bytes(compiled, root).items():
        write_if_changed(root / relative, data)
    return tuple(written)


def compile_and_write_catalog_data(
    catalogs: Any,
    taxonomy: Any,
    build_state: Any,
    root: Path,
    *,
    writer: ByteWriter,
    require_taxonomy_coverage: bool = True,
    write_build_state: bool = False,
) -> CompiledCatalogData:
    compiled = compile_catalog_data(
        catalogs,
        taxonomy,
        build_state,
        root,
        require_taxonomy_coverage=require_taxonomy_coverage,
    )
    write_compiled_catalog_data(
        compiled,
        root,
        writer=writer,
        write_build_state=write_build_state,
    )
    return compiled



def compile_current_project_catalog_data(
    root: Path,
    *,
    writer: ByteWriter,
    write_build_state: bool = False,
) -> CompiledCatalogData:
    """Compile checked-in source files and state through the canonical pipeline."""
    catalogs = json.loads((root / "catalogs.config.json").read_text(encoding="utf-8-sig"))
    taxonomy = json.loads((root / "catalog-taxonomy.config.json").read_text(encoding="utf-8-sig"))
    state = load_build_state(root, allow_legacy_migration=False)
    return compile_and_write_catalog_data(
        catalogs,
        taxonomy,
        state,
        root,
        writer=writer,
        write_build_state=write_build_state,
    )

def compile_taxonomy_and_site_pages(
    root: Path,
    *,
    writer: ByteWriter,
    staging_root: Path,
) -> tuple[Path, ...]:
    """Emit the taxonomy ESM projection and root pages in one transaction."""
    try:
        from tools.build_site_pages import render_site_pages
        from tools.seo_site import load_taxonomy, taxonomy_generated_module
    except ModuleNotFoundError:  # Direct execution from tools/
        from build_site_pages import render_site_pages
        from seo_site import load_taxonomy, taxonomy_generated_module

    taxonomy = load_taxonomy(root)
    taxonomy_path = root / TAXONOMY_MODULE_FILE
    writer(taxonomy_path, taxonomy_generated_module(taxonomy).encode("utf-8"))

    pages_root = staging_root / "site-pages"
    staged_pages = render_site_pages(
        root,
        pages_root,
        build_assets=False,
        build_taxonomy=False,
        include_indexing_files=False,
    )
    written = [taxonomy_path]
    for staged in staged_pages:
        relative = staged.relative_to(pages_root)
        target = root / relative
        writer(target, staged.read_bytes())
        written.append(target)
    return tuple(written)


def verify_managed_outputs_reconstructable(root: Path) -> tuple[Path, ...]:
    """Fail if checked-in public catalog outputs differ from a clean compilation."""
    config = json.loads((root / "catalogs.config.json").read_text(encoding="utf-8-sig"))
    taxonomy = json.loads((root / "catalog-taxonomy.config.json").read_text(encoding="utf-8-sig"))
    state = load_build_state(root, allow_legacy_migration=False)
    compiled = compile_catalog_data(config, taxonomy, state, root)
    expected = reconstructable_catalog_file_bytes(compiled, root)
    stale: list[Path] = []
    for relative, data in expected.items():
        path = root / relative
        if not path.is_file() or path.read_bytes() != data:
            stale.append(relative)
    if stale:
        names = ", ".join(path.as_posix() for path in stale)
        raise RuntimeError(
            f"Generated catalog outputs are not reconstructable/current: {names}. "
            "Run the catalog compiler/conversion pipeline."
        )
    return tuple(root / relative for relative in expected)


def main(argv: Sequence[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify that all checked-in public catalog outputs are exactly reconstructable.",
    )
    parser.add_argument(
        "--migrate-legacy-state",
        action="store_true",
        help=(
            "Explicitly create catalogs.build-state.json from the legacy public outputs. "
            "Normal builds never use generated outputs as compiler input."
        ),
    )
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parents[1]
    if args.check and args.migrate_legacy_state:
        parser.error("--check and --migrate-legacy-state cannot be combined")
    if args.check:
        verify_managed_outputs_reconstructable(root)
        print("Catalog compiler outputs are current and reconstructable.")
        return 0

    try:
        from tools.project_mutation import ProjectMutationLock, ProjectTransaction
    except ModuleNotFoundError:
        from project_mutation import ProjectMutationLock, ProjectTransaction

    with ProjectMutationLock(root, "קומפילציית נתוני קטלוג"):
        with ProjectTransaction(root, prefix=".catalog-compiler-transaction-") as transaction:
            if args.migrate_legacy_state:
                state_path = root / BUILD_STATE_FILE
                if state_path.exists():
                    raise FileExistsError(
                        f"Refusing legacy migration because {BUILD_STATE_FILE} already exists"
                    )
                catalogs = json.loads((root / "catalogs.config.json").read_text(encoding="utf-8-sig"))
                taxonomy = json.loads((root / "catalog-taxonomy.config.json").read_text(encoding="utf-8-sig"))
                migrated_state = retain_build_state_catalogs(
                    migrate_legacy_outputs_to_build_state(root),
                    (str(item.get("id", "")) for item in catalogs if isinstance(item, Mapping)),
                )
                compiled = compile_and_write_catalog_data(
                    catalogs,
                    taxonomy,
                    migrated_state,
                    root,
                    writer=transaction.write_bytes,
                    write_build_state=True,
                )
            else:
                compiled = compile_current_project_catalog_data(
                    root,
                    writer=transaction.write_bytes,
                )
    print(f"Compiled {len(compiled.generated)} catalog(s) from authoritative sources.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
