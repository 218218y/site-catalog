# Catalog data compiler and source ownership

Catalog metadata is built through one deterministic compiler:

```text
tools/catalog_compiler.py
```

## Authoritative inputs

Each fact has one owner:

| File | Owns |
| --- | --- |
| `catalogs.config.json` | Catalog identity, title, description, category, subcategory, PDF path, OCR policy, ordering and badges |
| `catalog-taxonomy.config.json` | Category/subcategory names, slugs and descriptions |
| `catalogs.build-state.json` | PDF-derived facts: page count, image format and versions, image dimensions and extracted/OCR search text |

The following files are outputs and must never be edited or used as normal compiler input:

```text
catalogs.generated.json
catalogs.generated.js
catalogs.search.json
catalogs.search.js
```

The control panel and `tools/build_catalogs.py` both call the same compiler. The
control panel changes source metadata; PDF conversion changes build state. The
compiler is the only component that serializes the public catalog/search files.

## Official schemas

The checked-in Draft 2020-12 contracts are under `schemas/`:

```text
catalogs.config.schema.json
catalog-taxonomy.config.schema.json
catalogs.build-state.schema.json
catalogs.generated.schema.json
catalogs.search.schema.json
```

`tools/catalog_schema.py` validates those contracts without adding a new runtime
package. It also enforces cross-file invariants such as unique IDs, taxonomy
coverage, matching generated/search order, page bounds and canonical asset paths.

## Commands

Compile from authoritative inputs:

```bat
python tools/catalog_compiler.py
```

Verify that every compiler-managed checked-in output is byte-for-byte current
and reconstructable:

```bat
python tools/catalog_compiler.py --check
```

A legacy project that does not yet have `catalogs.build-state.json` may perform
one explicit migration:

```bat
python tools/catalog_compiler.py --migrate-legacy-state
```

Normal compilation never falls back to public generated files. A missing or
invalid build-state file is a hard error, preventing generated output from
quietly becoming a second source of truth.

Normal compilation and deployment treat `catalogs.build-state.json` as
read-only. Only PDF conversion and explicit catalog ID deletion/rename flows
write it, inside the same project transaction as their related changes.

## Determinism guarantees

- The same authoritative inputs produce identical bytes.
- Unchanged bytes are not rewritten.
- A second compiler run is a no-op.
- Missing or manually altered public outputs are reconstructed from source and
  build state.
- A newly converted catalog and another catalog in the same category use the
  same artifact and compilation path.
- Deployment recompiles catalog data before checking bundle freshness, and its
  source signature includes config, build state, schemas and compiler code.
