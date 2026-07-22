'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src/js/20-shared-ui.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

const modeSource = sourceBetween(
  'function catalogImageDeliveryMode()',
  'function normalizeCatalogImageUrl(url)'
);

function createModeApi(mode, { saveData = false, effectiveType = '4g' } = {}) {
  return new Function(
    'window',
    'isSaveDataEnabled',
    'networkInformation',
    'CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY',
    'CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE',
    `${modeSource}; return { catalogImageDeliveryMode, catalogMediumImagesEnabled, catalogNeighborPreloadRadius };`
  )(
    { BARGIG_CATALOG_IMAGE_DELIVERY_MODE: mode },
    () => saveData,
    () => ({ effectiveType }),
    'full-only',
    'responsive'
  );
}

const fullOnly = createModeApi('full-only');
assert.equal(fullOnly.catalogImageDeliveryMode(), 'full-only');
assert.equal(fullOnly.catalogMediumImagesEnabled(), false);
assert.equal(fullOnly.catalogNeighborPreloadRadius(), 1);

const responsive = createModeApi('responsive');
assert.equal(responsive.catalogImageDeliveryMode(), 'responsive');
assert.equal(responsive.catalogMediumImagesEnabled(), true);
assert.equal(responsive.catalogNeighborPreloadRadius(), 2);

assert.equal(createModeApi('responsive', { effectiveType: '3g' }).catalogNeighborPreloadRadius(), 1);
assert.equal(createModeApi('responsive', { saveData: true }).catalogNeighborPreloadRadius(), 1);
assert.equal(createModeApi('unknown').catalogImageDeliveryMode(), 'responsive');

const warmupSource = sourceBetween(
  'function shouldWarmSingleViewerFullResolution(previousZoom = state.zoom)',
  'function commitSingleViewerResolutionUpgrade'
);
function createWarmupApi({ zoom = 1, saveData = false, effectiveType = '4g' } = {}) {
  return new Function(
    'state',
    'isSaveDataEnabled',
    'networkEffectiveType',
    'AUTO_VIEWER_ZOOM',
    'VIEWER_FULL_RESOLUTION_WARMUP_ZOOM_EPSILON',
    `${warmupSource}; return shouldWarmSingleViewerFullResolution;`
  )(
    { zoom },
    () => saveData,
    () => effectiveType,
    1,
    0.01
  );
}
assert.equal(createWarmupApi({ zoom: 1.02 })(1), true);
assert.equal(createWarmupApi({ zoom: 1.005 })(1), false);
assert.equal(createWarmupApi({ zoom: 1.2 })(1.25), false);
assert.equal(createWarmupApi({ zoom: 1.2, saveData: true })(1), false);
assert.equal(createWarmupApi({ zoom: 1.2, effectiveType: '3g' })(1), false);

const variantSource = sourceBetween(
  'function catalogImageVariant(catalog, tier)',
  'function catalogSupportsImageTier(catalog, tier)'
);

function createVariantApi(mediumEnabled) {
  return new Function(
    'catalogMediumImagesEnabled',
    'CATALOG_IMAGE_TIER_MEDIUM',
    'CATALOG_IMAGE_TIER_THUMB',
    'CATALOG_IMAGE_TIER_FULL',
    'pageSize',
    `${variantSource}; return catalogImageVariant;`
  )(
    () => mediumEnabled,
    'medium',
    'thumb',
    'full',
    () => ({ width: 1200, height: 1600 })
  );
}

const catalog = {
  imageVariants: {
    medium: { directory: 'medium', maxSide: 1600 },
    full: { directory: '', maxSide: 2800 }
  }
};
assert.equal(createVariantApi(false)(catalog, 'medium'), null);
assert.deepEqual(createVariantApi(true)(catalog, 'medium'), catalog.imageVariants.medium);
assert.deepEqual(createVariantApi(false)(catalog, 'full'), catalog.imageVariants.full);

const requestSource = sourceBetween(
  'function catalogImageVariant(catalog, tier)',
  'function catalogImageTierRank(tier)'
);

function createRequestApi(mediumEnabled) {
  return new Function(
    'catalogMediumImagesEnabled',
    'CATALOG_IMAGE_TIER_MEDIUM',
    'CATALOG_IMAGE_TIER_THUMB',
    'CATALOG_IMAGE_TIER_FULL',
    'DEFAULT_CATALOG_MEDIUM_MAX_SIDE',
    'VIEWER_FULL_RESOLUTION_ZOOM_THRESHOLD',
    'VIEWER_MEDIUM_OVERSUBSCRIPTION_RATIO',
    'VIEWER_FIT_WIDTH',
    'VIEWER_FIT_HEIGHT',
    'state',
    'els',
    'window',
    'pageSize',
    'withAssetVersion',
    'catalogDir',
    'pad',
    'imageExt',
    'thumbSrc',
    'pageSrc',
    'isSaveDataEnabled',
    `${requestSource}; return viewerPageImageRequest;`
  )(
    () => mediumEnabled,
    'medium',
    'thumb',
    'full',
    1600,
    1.35,
    0.96,
    'width',
    'height',
    { zoom: 1, imageFitMode: 'height' },
    { stageCanvas: { clientWidth: 800, clientHeight: 600 } },
    { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600 },
    () => ({ width: 2000, height: 2800 }),
    (url) => url,
    () => 'assets/pages/demo',
    (page) => String(page).padStart(3, '0'),
    () => 'webp',
    (_catalog, page) => `thumb-${page}.webp`,
    (_catalog, page) => `full-${page}.webp`,
    () => false
  );
}

const requestCatalog = {
  imageVariants: {
    thumb: { directory: 'thumbs', maxSide: 420 },
    medium: { directory: 'medium', maxSide: 1600 },
    full: { directory: '', maxSide: 2800 }
  }
};
const fullOnlyRequest = createRequestApi(false)(requestCatalog, 1);
assert.equal(fullOnlyRequest.primaryTier, 'full');
assert.deepEqual(fullOnlyRequest.fallbackCandidates.map((candidate) => candidate.tier), ['thumb']);
assert.equal(fullOnlyRequest.fallbackCandidates.some((candidate) => candidate.src.includes('medium')), false);

const responsiveRequest = createRequestApi(true)(requestCatalog, 1, { zoom: 1 });
assert.equal(responsiveRequest.primaryTier, 'medium');
assert.deepEqual(responsiveRequest.fallbackCandidates.map((candidate) => candidate.tier), ['full', 'thumb']);

const zoomedResponsiveRequest = createRequestApi(true)(requestCatalog, 1, { zoom: 2 });
assert.equal(zoomedResponsiveRequest.primaryTier, 'full', 'manual zoom above the threshold must request full resolution');
assert.deepEqual(zoomedResponsiveRequest.fallbackCandidates.map((candidate) => candidate.tier), ['medium', 'thumb']);

console.log('catalog_image_delivery_mode_logic.test.js: PASS');
