"use strict";

const assert = require("node:assert/strict");
const { importFrontendModule } = require("./frontend_test_module");

const {
  CATALOG_ASSET_URL_SCHEMA_VERSION,
  CATALOG_ASSET_VERSION_PARAM,
  CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY,
  CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE,
  CATALOG_IMAGE_RETRY_PARAM,
  CATALOG_IMAGE_TIER_FULL,
  CATALOG_IMAGE_TIER_MEDIUM,
  CATALOG_IMAGE_TIER_THUMB,
  DEFAULT_CATALOG_MEDIUM_MAX_SIDE
} = importFrontendModule("src/js/10-app-state.js");
const policy = {
  CATALOG_ASSET_URL_SCHEMA_VERSION,
  CATALOG_ASSET_VERSION_PARAM,
  CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY,
  CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE,
  CATALOG_IMAGE_RETRY_PARAM,
  CATALOG_IMAGE_TIER_FULL,
  CATALOG_IMAGE_TIER_MEDIUM,
  CATALOG_IMAGE_TIER_THUMB,
  DEFAULT_CATALOG_MEDIUM_MAX_SIDE
};
assert.deepEqual(policy, {
  CATALOG_ASSET_URL_SCHEMA_VERSION: 2,
  CATALOG_ASSET_VERSION_PARAM: "v",
  CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY: "full-only",
  CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE: "responsive",
  CATALOG_IMAGE_RETRY_PARAM: "bargig_retry",
  CATALOG_IMAGE_TIER_FULL: "full",
  CATALOG_IMAGE_TIER_MEDIUM: "medium",
  CATALOG_IMAGE_TIER_THUMB: "thumb",
  DEFAULT_CATALOG_MEDIUM_MAX_SIDE: 1600
});

Object.assign(globalThis, {
  CATALOG_ASSET_URL_SCHEMA_VERSION: policy.CATALOG_ASSET_URL_SCHEMA_VERSION,
  CATALOG_ASSET_VERSION_PARAM: policy.CATALOG_ASSET_VERSION_PARAM,
  CATALOG_IMAGE_TIER_FULL: policy.CATALOG_IMAGE_TIER_FULL,
  CATALOG_IMAGE_TIER_THUMB: policy.CATALOG_IMAGE_TIER_THUMB,
  displayPageToAssetPage: (_catalog, page) => Number(page),
  catalogFirstPage: () => 1,
  window: { BARGIG_CATALOG_ASSET_BASE_URL: "https://cdn.example.test/catalogs/" }
});
const urls = importFrontendModule("src/js/17-catalog-asset-urls.js");
const catalog = {
  id: "demo",
  assetVersion: "release",
  imageVariants: {
    thumb: { version: "thumb-release" },
    medium: { version: "medium-release" },
    full: { version: "full-release" }
  }
};
assert.equal(urls.catalogAssetVersionForTier(catalog, "medium"), "medium-release-medium-u2");
assert.equal(urls.catalogAssetVersionForTier({ assetVersion: "legacy" }, "full"), "legacy-full-u2");
assert.equal(
  urls.withAssetVersion("https://cdn.example.test/page-001.webp", catalog, "thumb"),
  "https://cdn.example.test/page-001.webp?v=thumb-release-thumb-u2"
);
assert.equal(
  urls.resolveCatalogAssetUrl("assets/pages/demo/page-001.webp"),
  "https://cdn.example.test/catalogs/assets/pages/demo/page-001.webp"
);

const search = importFrontendModule("src/runtime/catalog-search.js", { catalogs: [catalog] });
assert.match(search.pageSrc(catalog, 1), /page-001\.jpg\?v=full-release-full-u2$/);
assert.match(search.thumbSrc(catalog, 1), /thumbs\/page-001\.jpg\?v=thumb-release-thumb-u2$/);

console.log("responsive_catalog_images_contract.test.js: PASS");
