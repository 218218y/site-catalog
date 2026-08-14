#!/usr/bin/env python3
"""Single deterministic compiler for catalog-derived public data.

Authoritative inputs have distinct ownership:

* ``catalogs.config.json`` owns editorial catalog metadata and ordering.
* ``catalog-taxonomy.config.json`` owns category routes and descriptions.
* ``catalogs.build-state.json`` owns PDF-derived artifact/search facts produced
  by the conversion pipeline.

Every checked-in catalog projection byte and the active
``catalogs.search-index.json`` are emitted by this module. Public/generated
outputs are never accepted as compiler inputs and no legacy-state migration
path is retained in the runtime compiler.
"""
from __future__ import annotations

import json
from copy import deepcopy
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping, Protocol, Sequence, cast

try:
    from tools.catalog_page_numbering import asset_to_display_page, page_number_start
except ModuleNotFoundError:  # Direct execution from tools/
    from catalog_page_numbering import asset_to_display_page, page_number_start

try:
    from tools.catalog_schema import (
        validate_build_state,
        validate_catalog_config,
        validate_compiled_pair,
        validate_generated,
        validate_search,
        validate_search_index,
        validate_taxonomy_config,
        validate_taxonomy_coverage,
    )
except ModuleNotFoundError:  # Direct execution from tools/
    from catalog_schema import (
        validate_build_state,
        validate_catalog_config,
        validate_compiled_pair,
        validate_generated,
        validate_search,
        validate_search_index,
        validate_taxonomy_config,
        validate_taxonomy_coverage,
    )

try:
    from tools.catalog_search_index import build_normalized_search_index
except ModuleNotFoundError:  # Direct execution from tools/
    from catalog_search_index import build_normalized_search_index

try:
    from tools.catalog_types import (
        CatalogArtifact,
        CatalogBuildState,
        GeneratedCatalog,
        GeneratedCatalogs,
        ImageExtension,
        PublicImageVariant,
        PublicImageVariants,
        SearchCatalog,
        SearchCatalogs,
        SearchIndex,
        SearchPage,
        StateImageVariant,
        StateImageVariants,
    )
except ModuleNotFoundError:  # Direct execution from tools/
    from catalog_types import (
        CatalogArtifact,
        CatalogBuildState,
        GeneratedCatalog,
        GeneratedCatalogs,
        ImageExtension,
        PublicImageVariant,
        PublicImageVariants,
        SearchCatalog,
        SearchCatalogs,
        SearchIndex,
        SearchPage,
        StateImageVariant,
        StateImageVariants,
    )

BUILD_STATE_FILE = "catalogs.build-state.json"
GENERATED_JSON_FILE = "catalogs.generated.json"
GENERATED_MODULE_FILE = "catalogs.generated.module.js"
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
_IMAGE_EXTENSIONS = frozenset({"webp", "jpg", "png"})


class ByteWriter(Protocol):
    def __call__(self, path: Path, data: bytes) -> None: ...


@dataclass(frozen=True)
class CompiledCatalogData:
    build_state: CatalogBuildState
    generated: GeneratedCatalogs
    search: SearchCatalogs
    search_index: SearchIndex


def _json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2) + "\n").encode("utf-8")


def _generated_module_bytes(entries: Sequence[GeneratedCatalog]) -> bytes:
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


def build_state_bytes(build_state: CatalogBuildState) -> bytes:
    return _json_bytes(build_state)


def _copy_state_image_variant(value: Mapping[str, object], *, name: str) -> StateImageVariant:
    expected = {"maxSide", "version"}
    extras = set(value) - expected
    missing = expected - set(value)
    if extras or missing:
        raise ValueError(
            f"Image variant {name!r} must contain exactly maxSide/version; "
            f"missing={sorted(missing)}, extra={sorted(extras)}"
        )
    max_side = value["maxSide"]
    version = value["version"]
    if isinstance(max_side, bool) or not isinstance(max_side, int) or max_side < 1:
        raise ValueError(f"Image variant {name!r} maxSide must be a positive integer")
    if not isinstance(version, str) or not version:
        raise ValueError(f"Image variant {name!r} version must be a non-empty string")
    return {"maxSide": max_side, "version": version}


def _copy_state_image_variants(value: Mapping[str, Mapping[str, object]]) -> StateImageVariants:
    expected = set(VARIANT_DIRECTORIES)
    extras = set(value) - expected
    missing = expected - set(value)
    if extras or missing:
        raise ValueError(
            "imageVariants must contain exactly thumb/medium/full; "
            f"missing={sorted(missing)}, extra={sorted(extras)}"
        )
    return {
        "thumb": _copy_state_image_variant(value["thumb"], name="thumb"),
        "medium": _copy_state_image_variant(value["medium"], name="medium"),
        "full": _copy_state_image_variant(value["full"], name="full"),
    }


def _copy_search_pages(value: Sequence[Mapping[str, object]], *, pages: int) -> list[SearchPage]:
    normalized: list[SearchPage] = []
    seen: set[int] = set()
    for index, item in enumerate(value, 1):
        if set(item) != {"page", "text"}:
            raise ValueError(f"Search page #{index} must contain exactly page/text")
        page = item["page"]
        text = item["text"]
        if isinstance(page, bool) or not isinstance(page, int) or page < 1 or page > pages:
            raise ValueError(f"Search page #{index} has invalid asset page {page!r} for {pages} pages")
        if page in seen:
            raise ValueError(f"Search pages repeat asset page {page}")
        if not isinstance(text, str):
            raise ValueError(f"Search page #{index} text must be a string")
        seen.add(page)
        normalized.append({"page": page, "text": text})
    normalized.sort(key=lambda item: item["page"])
    return normalized


def _public_image_variants(value: StateImageVariants) -> PublicImageVariants:
    def public_variant(name: str, variant: StateImageVariant) -> PublicImageVariant:
        return {
            "directory": VARIANT_DIRECTORIES[name],
            "maxSide": variant["maxSide"],
            "version": variant["version"],
        }

    return {
        "thumb": public_variant("thumb", value["thumb"]),
        "medium": public_variant("medium", value["medium"]),
        "full": public_variant("full", value["full"]),
    }


def load_build_state(root: Path) -> CatalogBuildState:
    path = root / BUILD_STATE_FILE
    if not path.is_file():
        raise FileNotFoundError(f"Required compiler state is missing: {BUILD_STATE_FILE}")
    payload: object = json.loads(path.read_text(encoding="utf-8-sig"))
    return validate_build_state(payload, root)


def rename_build_state_catalogs(
    build_state: CatalogBuildState,
    rename_map: Mapping[str, str],
) -> CatalogBuildState:
    """Apply catalog-id renames to compiler state without touching public outputs."""
    rows: list[CatalogArtifact] = []
    seen: set[str] = set()
    for source in build_state["catalogs"]:
        item = deepcopy(source)
        original_id = item["id"]
        catalog_id = rename_map.get(original_id, original_id)
        if catalog_id in seen:
            raise ValueError(f"Catalog rename would duplicate build-state id: {catalog_id}")
        seen.add(catalog_id)
        item["id"] = catalog_id
        rows.append(item)
    return {"version": 1, "catalogs": rows}


def retain_build_state_catalogs(
    build_state: CatalogBuildState,
    catalog_ids: Iterable[str],
) -> CatalogBuildState:
    """Return state containing only explicitly configured catalog ids."""
    retained = set(catalog_ids)
    return {
        "version": 1,
        "catalogs": [
            deepcopy(item)
            for item in build_state["catalogs"]
            if item["id"] in retained
        ],
    }


def build_artifact_entry(
    *,
    catalog_id: str,
    pages: int,
    image_format: str,
    asset_version: str,
    image_variants: Mapping[str, Mapping[str, object]],
    search_pages: Sequence[Mapping[str, object]],
    page_sizes: Sequence[Sequence[int]] | None = None,
) -> CatalogArtifact:
    """Create one strict compiler-state artifact from conversion-owned facts."""
    if not catalog_id:
        raise ValueError("catalog_id must be non-empty")
    if isinstance(pages, bool) or not isinstance(pages, int) or pages < 1:
        raise ValueError("pages must be a positive integer")
    normalized_format = image_format.lower()
    if normalized_format not in _IMAGE_EXTENSIONS:
        raise ValueError(f"Unsupported image format: {image_format!r}")
    if not asset_version:
        raise ValueError("asset_version must be non-empty")
    entry: CatalogArtifact = {
        "id": catalog_id,
        "pages": pages,
        "imageExt": cast(ImageExtension, normalized_format),
        "assetVersion": asset_version,
        "imageVariants": _copy_state_image_variants(image_variants),
        "searchPages": _copy_search_pages(search_pages, pages=pages),
    }
    if page_sizes is not None:
        normalized_sizes: list[list[int]] = []
        if len(page_sizes) != pages:
            raise ValueError(f"page_sizes must contain exactly {pages} entries")
        for index, size in enumerate(page_sizes, 1):
            if len(size) != 2:
                raise ValueError(f"page_sizes entry #{index} must contain width and height")
            width, height = size
            if (
                isinstance(width, bool)
                or not isinstance(width, int)
                or isinstance(height, bool)
                or not isinstance(height, int)
                or width < 1
                or height < 1
            ):
                raise ValueError(f"page_sizes entry #{index} must contain positive integers")
            normalized_sizes.append([width, height])
        entry["pageSizes"] = normalized_sizes
    return entry


def build_state_from_artifacts(
    artifacts: Iterable[CatalogArtifact],
    project_root: Path,
) -> CatalogBuildState:
    state: CatalogBuildState = {"version": 1, "catalogs": [deepcopy(item) for item in artifacts]}
    return validate_build_state(state, project_root)


def compile_catalog_data(
    catalogs: object,
    taxonomy: object,
    build_state: object,
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
    artifacts_by_id = {item["id"]: item for item in state["catalogs"]}
    configured_ids = {item["id"] for item in config}
    orphan_ids = sorted(set(artifacts_by_id) - configured_ids)
    if orphan_ids:
        raise ValueError(
            "Catalog build state contains artifacts that are not present in catalogs.config.json: "
            + ", ".join(orphan_ids)
        )

    generated: GeneratedCatalogs = []
    search: SearchCatalogs = []
    retained_artifacts: list[CatalogArtifact] = []
    indexed_sources = list(enumerate(config))
    indexed_sources.sort(key=lambda pair: (pair[1].get("sort", 9999), pair[0]))
    for _source_index, source in indexed_sources:
        catalog_id = source["id"]
        artifact = artifacts_by_id.get(catalog_id)
        if artifact is None:
            # A newly configured PDF is intentionally not public until conversion
            # has produced a complete artifact record.
            continue
        retained_artifacts.append(deepcopy(artifact))
        directory = f"assets/pages/{catalog_id}"
        image_format = artifact["imageExt"]
        entry: GeneratedCatalog = {
            "id": catalog_id,
            "title": source["title"],
            "description": source["description"],
            "category": source["category"],
            "pages": artifact["pages"],
            "pageNumberStart": source["pageNumberStart"],
            "dir": directory,
            "cover": f"{directory}/page-001.{image_format}",
            "imageExt": image_format,
            "assetVersion": artifact["assetVersion"],
            "imageVariants": _public_image_variants(artifact["imageVariants"]),
        }
        if "pageSizes" in artifact:
            entry["pageSizes"] = deepcopy(artifact["pageSizes"])
        if source["subcategory"] or "subcategory" in source:
            entry["subcategory"] = source["subcategory"]
        if "sort" in source:
            entry["sort"] = source["sort"]
        if "badge" in source:
            entry["badge"] = source["badge"]
        generated.append(entry)

        page_mapping_catalog: Mapping[str, object] = {
            "pages": artifact["pages"],
            "pageNumberStart": source["pageNumberStart"],
        }
        search_entry: SearchCatalog = {
            "catalogId": catalog_id,
            "title": source["title"],
            "pages": [
                {
                    "page": asset_to_display_page(page_mapping_catalog, page["page"]),
                    "text": page["text"],
                }
                for page in artifact["searchPages"]
            ],
        }
        search.append(search_entry)

    normalized_state: CatalogBuildState = {"version": 1, "catalogs": retained_artifacts}
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
    catalogs: object,
    taxonomy: object,
    build_state: object,
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
    catalogs: object = json.loads((root / "catalogs.config.json").read_text(encoding="utf-8-sig"))
    taxonomy: object = json.loads((root / "catalog-taxonomy.config.json").read_text(encoding="utf-8-sig"))
    state = load_build_state(root)
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
    config: object = json.loads((root / "catalogs.config.json").read_text(encoding="utf-8-sig"))
    taxonomy: object = json.loads((root / "catalog-taxonomy.config.json").read_text(encoding="utf-8-sig"))
    state = load_build_state(root)
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
    args = parser.parse_args(argv)
    root = Path(__file__).resolve().parents[1]
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
            compiled = compile_current_project_catalog_data(
                root,
                writer=transaction.write_bytes,
            )
    print(f"Compiled {len(compiled.generated)} catalog(s) from authoritative sources.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
