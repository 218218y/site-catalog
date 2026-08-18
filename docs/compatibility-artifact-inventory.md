# Frontend runtime asset boundaries

This contract defines the active runtime asset boundary independently of past migrations. Browser structure is verified from HTML and the TypeScript AST; build/deploy membership is verified from the Python builders' public constants rather than source-text patterns. It is enforced by `tests/compatibility_artifact_inventory.test.js` plus the corresponding builder unit tests.

## Deployment-owned external ES module

Route documents no longer load any classic application/configuration script before the native route module.
`catalog-assets.config.js` is an immutable ES module that exports only the deploy-time image origin and delivery policy. The deploy builder rewrites the CDN origin, fingerprints the resulting module and rewrites every dependent import to that exact generation. No `window.BARGIG_CATALOG_*` configuration globals remain in the application runtime.

## Independently cached external ES modules

Every catalog route imports the following typed modules explicitly; HTML does not load them as classic scripts:

- `catalog-assets.config.js` — immutable deployment-owned image origin and delivery policy.
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
- `catalogs.search.json` and `catalogs.search.js` are retired completely. No compiler, build or migration path reads or recreates them; `catalogs.build-state.json` is required instead.

## Isolated diagnostic snapshot

`catalog-big-pages-viewer-netfree/catalog-big-pages-viewer.html` embeds a generated catalog snapshot so it can run as a standalone diagnostic file. It is rebuilt from `catalogs.generated.json`, is not a route dependency and is not a compatibility source for the application.

## Retired artifacts

- `catalogs.generated.js` and `catalog-taxonomy.generated.js` were replaced atomically by generated ESM modules.
- `app.js` has no producer or consumer. Normal frontend builds do not scan for or delete it.
