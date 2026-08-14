'use strict';

const assert = require('node:assert/strict');
const { importFrontendModule } = require('./frontend_test_module');

Object.defineProperty(globalThis, 'navigator', { value: {}, writable: true, configurable: true });
Object.assign(globalThis, {
  window: { location: { href: 'https://example.test/viewer.html' } },
  requiredElement: () => ({}),
  CATALOG_IMAGE_RETRY_PARAM: 'bargig_retry',
  CATALOG_ASSET_VERSION_PARAM: 'v'
});
const api = importFrontendModule('src/js/20-shared-ui.js');

const candidates = api.catalogImageRecoveryCandidates(
  'https://cdn.example.test/full.webp?v=release-full-u2',
  'https://cdn.example.test/thumb.webp'
);
assert.equal(candidates.length, 3);
assert.equal(candidates[0].role, 'primary');
assert.equal(candidates[1].role, 'direct-retry');
assert.doesNotMatch(candidates[1].src, /[?&]v=/);
assert.match(candidates[1].src, /bargig_retry=/);
assert.equal(candidates[2].role, 'fallback');
assert.equal(candidates[2].fallback, true);

const tiered = api.catalogImageRecoveryCandidates(
  'https://cdn.example.test/medium.webp?v=release-medium-u2',
  '',
  {
    primaryTier: 'medium',
    fallbackCandidates: [
      { src: 'https://cdn.example.test/full.webp', role: 'fallback-full', tier: 'full' },
      { src: 'https://cdn.example.test/thumb.webp', role: 'fallback-thumb', tier: 'thumb' }
    ]
  }
);
assert.deepEqual(tiered.map((candidate) => candidate.tier), ['medium', 'medium', 'full', 'thumb']);
assert.equal(tiered[2].fallback, true);
assert.equal(tiered[3].fallback, true);

const manual = api.catalogImageRecoveryCandidates(
  'https://cdn.example.test/full.webp?bargig_retry=old',
  'https://cdn.example.test/thumb.webp',
  { forceRefresh: true }
);
assert.equal(manual[0].role, 'manual');
assert.match(manual[0].src, /bargig_retry=/);
assert.doesNotMatch(manual[0].src, /old/);

{
  const catalog = { id: "catalog-one" };
  const request = { primarySrc: "https://cdn.example.test/page-004.webp", fallbackCandidates: [] };
  const calls = [];
  Object.assign(globalThis, {
    activeCatalog: () => catalog,
    activePage: () => 4,
    isViewerSessionOpen: () => true,
    viewerPageImageRequest: (candidateCatalog, page) => {
      assert.equal(candidateCatalog, catalog);
      assert.equal(page, 4);
      return request;
    },
    showSingleLightboxImage: (...args) => calls.push(args)
  });
  const navigation = importFrontendModule("src/js/58-viewer-navigation.js");
  navigation.retryCurrentViewerImage();
  assert.deepEqual(calls, [[catalog, 4, request.primarySrc, { imageRequest: request, forceRefresh: true }]]);

  globalThis.isViewerSessionOpen = () => false;
  navigation.retryCurrentViewerImage();
  assert.equal(calls.length, 1, "closed Viewer sessions must not start a retry");
}

console.log('viewer_image_loading_logic.test.js: PASS');
