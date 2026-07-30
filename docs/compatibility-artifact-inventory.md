# Frontend compatibility and generated artifact inventory

This inventory distinguishes active runtime assets from reconstruction or diagnostic outputs.
It is enforced by `tests/compatibility_artifact_inventory.test.js`.

## Active browser runtime assets

The route documents currently load the following standalone boundaries before the native route module:

- `catalog-assets.config.js` — deploy-time image origin and delivery policy.
- `catalogs.generated.js` — browser catalog metadata projection.
- `catalog-taxonomy.generated.js` — browser taxonomy projection.
- `catalog-search.js` — asynchronous search client.
- `tooltip-manager.js` — shared tooltip lifecycle.
- `favorites-store.js` — durable favorites storage service.
- `site-routes.js` — clean-route parsing and URL construction.

These files are active boundaries, not accidental compatibility outputs. They remain independently cached
bootstrap/data services and must not be removed until their consumers are migrated in one reviewed slice.

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
