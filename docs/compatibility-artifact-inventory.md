# Frontend compatibility and generated artifact inventory

This inventory distinguishes active runtime assets from reconstruction or diagnostic outputs.
It is enforced by `tests/compatibility_artifact_inventory.test.js`.

## Active browser bootstrap and generated-data assets

The route documents load only these classic scripts before the native route module:

- `catalog-assets.config.js` — deploy-time image origin and delivery policy.
- `catalogs.generated.js` — generated browser catalog metadata projection.
- `catalog-taxonomy.generated.js` — generated browser taxonomy projection.

They are configuration/data boundaries, not business APIs. Their temporary generated-data role and the
reviewed path to external ESM projections are documented in `docs/catalog-data-esm-projection.md`.

## Independently cached external ES modules

The route bundles import these typed modules explicitly; HTML does not load them as classic scripts:

- `catalog-search.js` — asynchronous search client.
- `tooltip-manager.js` — shared tooltip lifecycle.
- `favorites-store.js` — durable favorites storage service.
- `site-routes.js` — clean-route parsing and URL construction.

Their editable sources live under `src/runtime/`. esbuild keeps them external to every route bundle, and the
deploy builder fingerprints each module once, rewrites route imports to the hashed sibling and rejects stale
or mixed generations. They expose no `window.Bargig*` business API.

## Route-scoped native ES module

- `catalog-snapshot.js` is no longer a classic script or a standalone deploy asset. It is a side-effect-free
  ES module imported by the Viewer-owned sharing adapter. Only the Viewer route reaches that import, so
  `app-catalog.js` and `app-favorites.js` never parse or bundle the exporter and no extra request is created.

## Non-runtime compiler outputs

- `catalogs.generated.json` is the canonical machine-readable catalog projection used by build, SEO, R2,
  telemetry and maintenance tools.
- `catalogs.search-index.json` is the active normalized worker index.
- `catalogs.search.json` and `catalogs.search.js` are reconstructable audit/migration projections. They are not
  loaded by route HTML and `catalogs.search.js` is not deployed. Their removal belongs to a dedicated catalog
  compiler state migration, not to a CSS or frontend cleanup slice.

## Retired artifact

- `app.js` has no producer or consumer. Normal frontend builds no longer scan for or delete it.
