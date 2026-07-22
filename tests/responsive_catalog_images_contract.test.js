"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appState = fs.readFileSync(path.join(root, "src/js/10-app-state.js"), "utf8");
const sharedUi = fs.readFileSync(path.join(root, "src/js/20-shared-ui.js"), "utf8");
const catalog = fs.readFileSync(path.join(root, "src/js/40-catalog-grid.js"), "utf8");
const viewer = fs.readFileSync(path.join(root, "src/js/60-viewer.js"), "utf8");
const searchUi = fs.readFileSync(path.join(root, "src/js/50-search-ui.js"), "utf8");
const favorites = fs.readFileSync(path.join(root, "src/js/35-favorites-workspace.js"), "utf8");
const converter = fs.readFileSync(path.join(root, "tools/build_catalogs.py"), "utf8");
const searchRuntime = fs.readFileSync(path.join(root, "catalog-search.js"), "utf8");
const remoteVerifier = fs.readFileSync(path.join(root, "tools/verify_remote_catalog_assets.py"), "utf8");
const assetConfig = fs.readFileSync(path.join(root, "catalog-assets.config.js"), "utf8");

assert.match(appState, /const CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE = "responsive";/);
assert.match(appState, /const CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY = "full-only";/);
assert.match(appState, /const DEFAULT_CATALOG_MEDIUM_MAX_SIDE = 1600;/);
assert.match(appState, /const VIEWER_FULL_RESOLUTION_ZOOM_THRESHOLD = 1\.35;/);
assert.match(appState, /const VIEWER_FULL_RESOLUTION_PRELOAD_ZOOM_THRESHOLD = 1\.01;/);
assert.match(appState, /const VIEWER_RESOLUTION_CROSSFADE_MS = 160;/);
assert.match(sharedUi, /function mediumSrc\(catalog, page\)/);
assert.match(sharedUi, /function catalogImageDeliveryMode\(\)/);
assert.match(sharedUi, /function catalogMediumImagesEnabled\(\)/);
assert.match(sharedUi, /tier === CATALOG_IMAGE_TIER_MEDIUM && !catalogMediumImagesEnabled\(\)/);
assert.match(sharedUi, /if \(!catalogMediumImagesEnabled\(\)\) return 1;/);
assert.match(sharedUi, /function catalogAssetVersionForTier\(catalog, tier\)/);
assert.match(sharedUi, /function unversionedCatalogImageUrl\(url\)/);
assert.match(sharedUi, /function viewerPageImageRequest\(catalog, page, options = \{\}\)/);
assert.match(sharedUi, /function preferredViewerImageTier\(catalog, page, options = \{\}\)/);
assert.match(sharedUi, /requiredPixels > mediumMaxSide \* VIEWER_MEDIUM_OVERSUBSCRIPTION_RATIO/);
assert.match(sharedUi, /function isSaveDataEnabled\(\)/);
assert.match(sharedUi, /effectiveType === "3g"\) return 1/);
assert.match(sharedUi, /targetTier,/);
assert.match(sharedUi, /options\.progressive/);
assert.match(sharedUi, /function requestSingleViewerResolutionUpgrade\(options = \{\}\)/);
assert.match(sharedUi, /await upgradeImage\.decode\(\)/);
assert.match(sharedUi, /function singleViewerResolutionCrossfadeMs\(\)/);
assert.match(sharedUi, /prefers-reduced-motion: reduce/);
assert.match(sharedUi, /function revealSingleViewerResolutionUpgrade\(/);
assert.match(sharedUi, /function finishSingleViewerResolutionPromotion\(/);
assert.match(sharedUi, /fallbackCandidates: candidates\.slice\(1\)/);
assert.match(catalog, /function preloadNeighbors\(\)[\s\S]*?const radius = catalogNeighborPreloadRadius\(\);/);
assert.match(catalog, /viewerPageSrc\(state\.catalog, page, \{ preferMedium: true \}\)/);
assert.match(viewer, /const request = viewerPageImageRequest\(catalog, state\.page, \{ progressive: true \}\);/);
assert.match(viewer, /syncSingleViewerResolutionForCurrentState\(\{ reason: "page-reused" \}\)/);
assert.match(searchUi, /if \(isSaveDataEnabled\(\)\) return;/);
assert.match(searchUi, /const rawImage = rawThumb \|\| rawPreview;/);
assert.match(favorites, /const image = thumbSrc\(catalog, page\);/);
assert.match(converter, /"mediumSize": int\(options\.medium_size\)/);
assert.match(converter, /medium_dir = out_dir \/ "medium"/);
assert.match(converter, /def catalog_asset_versions\(/);
assert.match(converter, /"version": asset_versions\["medium"\]/);
assert.match(searchRuntime, /const ASSET_URL_SCHEMA_VERSION = 2;/);
assert.match(searchRuntime, /function assetVersionForTier\(catalog, tier\)/);
assert.match(remoteVerifier, /CATALOG_ASSET_URL_SCHEMA_VERSION = 2/);
assert.match(remoteVerifier, /versioned: bool = False/);
const configuredMode = assetConfig.match(/window\.BARGIG_CATALOG_IMAGE_DELIVERY_MODE = "([^"]+)";/)?.[1];
assert.ok(configuredMode, "catalog image delivery mode must be configured");
assert.ok(
  ["responsive", "full-only"].includes(configuredMode),
  `unsupported catalog image delivery mode: ${configuredMode}`
);

console.log("responsive_catalog_images_contract.test.js: PASS");
