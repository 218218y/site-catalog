'use strict';

const assert = require('node:assert/strict');
const { importFrontendTestModule } = require('./frontend_test_module');

const network = { saveData: false, effectiveType: '4g' };
Object.defineProperty(globalThis, 'navigator', {
  value: { connection: network }, writable: true, configurable: true
});
Object.assign(globalThis, {
  window: {
    BARGIG_CATALOG_TAXONOMY: { categories: [], subcategories: [] },
    BARGIG_CATALOG_IMAGE_DELIVERY_MODE: 'responsive',
    location: { href: 'https://example.test/viewer.html' },
    devicePixelRatio: 1,
    innerWidth: 800,
    innerHeight: 600
  },
  requiredElement: () => ({}),
  CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY: 'full-only',
  CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE: 'responsive',
  CATALOG_IMAGE_RETRY_PARAM: 'bargig_retry',
  CATALOG_ASSET_VERSION_PARAM: 'v',
  CATALOG_IMAGE_TIER_MEDIUM: 'medium',
  CATALOG_IMAGE_TIER_THUMB: 'thumb',
  CATALOG_IMAGE_TIER_FULL: 'full',
  DEFAULT_CATALOG_MEDIUM_MAX_SIDE: 1600
});
const shared = importFrontendTestModule('src/js/20-shared-ui.js', 'shared-ui');

function setNetwork({ mode = 'responsive', saveData = false, effectiveType = '4g' } = {}) {
  window.BARGIG_CATALOG_IMAGE_DELIVERY_MODE = mode;
  network.saveData = saveData;
  network.effectiveType = effectiveType;
}

setNetwork({ mode: 'full-only' });
assert.equal(shared.catalogImageDeliveryMode(), 'full-only');
assert.equal(shared.catalogMediumImagesEnabled(), false);
assert.equal(shared.catalogNeighborPreloadRadius(), 1);
setNetwork({ mode: 'responsive' });
assert.equal(shared.catalogImageDeliveryMode(), 'responsive');
assert.equal(shared.catalogMediumImagesEnabled(), true);
assert.equal(shared.catalogNeighborPreloadRadius(), 2);
setNetwork({ effectiveType: '3g' });
assert.equal(shared.catalogNeighborPreloadRadius(), 1);
setNetwork({ saveData: true });
assert.equal(shared.catalogNeighborPreloadRadius(), 1);
setNetwork({ mode: 'unknown' });
assert.equal(shared.catalogImageDeliveryMode(), 'responsive');

const catalog = {
  pageSizes: [[1200, 1600]],
  imageVariants: {
    medium: { directory: 'medium', maxSide: 1600 },
    full: { directory: '', maxSide: 2800 }
  }
};
setNetwork({ mode: 'full-only' });
assert.equal(shared.catalogImageVariant(catalog, 'medium'), null);
setNetwork({ mode: 'responsive' });
assert.deepEqual(shared.catalogImageVariant(catalog, 'medium'), catalog.imageVariants.medium);
assert.deepEqual(shared.catalogImageVariant(catalog, 'full'), catalog.imageVariants.full);

const viewerState = { zoom: 1, imageFitMode: 'height' };
Object.assign(globalThis, {
  viewerState,
  viewerElements: { stageCanvas: { clientWidth: 800, clientHeight: 600 }, lightboxImageFrame: null },
  AUTO_VIEWER_ZOOM: 1,
  VIEWER_FULL_RESOLUTION_WARMUP_ZOOM_EPSILON: 0.01,
  VIEWER_FULL_RESOLUTION_ZOOM_THRESHOLD: 1.35,
  VIEWER_MEDIUM_OVERSUBSCRIPTION_RATIO: 0.96,
  VIEWER_FIT_WIDTH: 'width',
  VIEWER_FIT_HEIGHT: 'height',
  isSaveDataEnabled: () => Boolean(network.saveData),
  networkEffectiveType: () => String(network.effectiveType || ''),
  catalogSupportsImageTier: shared.catalogSupportsImageTier,
  catalogImageTierMaxSide: shared.catalogImageTierMaxSide,
  catalogPageImageSrc: shared.catalogPageImageSrc,
  pageSize: shared.pageSize,
  thumbSrc: (_catalog, page) => `thumb-${page}.webp`,
  pageSrc: (_catalog, page) => `full-${page}.webp`,
  withAssetVersion: (url) => url,
  catalogDir: () => 'assets/pages/demo',
  pad: (page) => String(page).padStart(3, '0'),
  imageExt: () => 'webp'
});
const viewerImage = importFrontendTestModule('src/js/53-viewer-image.js', 'viewer-image');

viewerState.zoom = 1.02; setNetwork();
assert.equal(viewerImage.shouldWarmSingleViewerFullResolution(1), true);
viewerState.zoom = 1.005;
assert.equal(viewerImage.shouldWarmSingleViewerFullResolution(1), false);
viewerState.zoom = 1.2;
assert.equal(viewerImage.shouldWarmSingleViewerFullResolution(1.25), false);
setNetwork({ saveData: true });
assert.equal(viewerImage.shouldWarmSingleViewerFullResolution(1), false);
setNetwork({ effectiveType: '3g' });
assert.equal(viewerImage.shouldWarmSingleViewerFullResolution(1), false);

const requestCatalog = {
  id: 'demo',
  pageSizes: [[2000, 2800]],
  imageVariants: {
    thumb: { directory: 'thumbs', maxSide: 420 },
    medium: { directory: 'medium', maxSide: 1600 },
    full: { directory: '', maxSide: 2800 }
  }
};
setNetwork({ mode: 'full-only' }); viewerState.zoom = 1;
let request = viewerImage.viewerPageImageRequest(requestCatalog, 1);
assert.equal(request.primaryTier, 'full');
assert.deepEqual(request.fallbackCandidates.map((candidate) => candidate.tier), ['thumb']);

setNetwork({ mode: 'responsive' }); viewerState.zoom = 1;
request = viewerImage.viewerPageImageRequest(requestCatalog, 1, { zoom: 1 });
assert.equal(request.primaryTier, 'medium');
assert.deepEqual(request.fallbackCandidates.map((candidate) => candidate.tier), ['full', 'thumb']);

request = viewerImage.viewerPageImageRequest(requestCatalog, 1, { zoom: 2 });
assert.equal(request.primaryTier, 'full');
assert.deepEqual(request.fallbackCandidates.map((candidate) => candidate.tier), ['medium', 'thumb']);

console.log('catalog_image_delivery_mode_logic.test.js: PASS');
