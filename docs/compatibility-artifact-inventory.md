# Frontend compatibility and generated artifact inventory

This inventory distinguishes active runtime assets from reconstruction or diagnostic outputs. It is enforced by `tests/compatibility_artifact_inventory.test.js`.

## Active browser bootstrap

Route documents load one classic script before the native route module:

- `catalog-assets.config.js` — deploy-time image origin and delivery policy.

It is a small environment boundary, not a business API. Catalog data and taxonomy are not exposed through classic scripts or `window` globals.

## Independently cached external ES modules

Every catalog route imports the following typed modules explicitly; HTML does not load them as classic scripts:

- `catalogs.generated.module.js` — immutable generated catalog records.
- `catalog-taxonomy.generated.module.js` — immutable generated taxonomy.
- `catalog-search.js` — asynchronous search client.
- `tooltip-manager.js` — shared tooltip lifecycle.
- `favorites-store.js` — durable favorites storage service.
- `site-routes.js` — clean-route parsing and URL construction.

Editable runtime sources live under `src/runtime/`; generated data comes from the catalog compiler and SEO builder. esbuild keeps all six modules external to every route bundle. The deploy builder fingerprints each generation once, rewrites dependent imports in topological order and rejects stale, mixed or unreferenced generations. None exposes a `window.Bargig*` business API.

## Route-scoped native ES module

- `catalog-snapshot.js` is a side-effect-free ES module imported by the Viewer-owned sharing adapter. Only the Viewer route reaches that import, so catalog and favorites routes do not parse the exporter and no standalone deploy request is created.

## Non-runtime compiler outputs

- `catalogs.generated.json` is the canonical machine-readable projection used by build, SEO, R2, telemetry and maintenance tools.
- `catalogs.search-index.json` is the active normalized worker index.
- `catalogs.search.json` and `catalogs.search.js` are retired. A read-only adapter remains only for the explicit `--migrate-legacy-state` command; normal builds neither read nor recreate them.

## Isolated diagnostic snapshot

`catalog-big-pages-viewer-netfree/catalog-big-pages-viewer.html` embeds a generated catalog snapshot so it can run as a standalone diagnostic file. It is rebuilt from `catalogs.generated.json`, is not a route dependency and is not a compatibility source for the application.

## Retired artifacts

- `catalogs.generated.js` and `catalog-taxonomy.generated.js` were replaced atomically by generated ESM modules.
- `app.js` has no producer or consumer. Normal frontend builds do not scan for or delete it.
