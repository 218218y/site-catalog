'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return app.slice(start, end);
}

const candidatesSource = sourceBetween(
  'function catalogImageRecoveryCandidates(primarySrc, fallbackSrc = "", options = {})',
  'function loadCatalogImageWithRecovery(img, options = {})'
);
const normalizeSource = sourceBetween(
  'function normalizeCatalogImageUrl(url)',
  'function catalogImageRecoveryCandidates(primarySrc, fallbackSrc = "", options = {})'
);

const fakeWindow = { location: { href: 'https://example.test/viewer.html' } };
const CATALOG_IMAGE_RETRY_PARAM = 'bargig_retry';
const normalizeCatalogImageUrl = new Function(
  'window', 'CATALOG_IMAGE_RETRY_PARAM',
  `${normalizeSource}; return normalizeCatalogImageUrl;`
)(fakeWindow, CATALOG_IMAGE_RETRY_PARAM);
const cacheBustedCatalogImageUrl = new Function(
  'window', 'CATALOG_IMAGE_RETRY_PARAM', 'CATALOG_ASSET_VERSION_PARAM',
  `${normalizeSource}; return cacheBustedCatalogImageUrl;`
)(fakeWindow, CATALOG_IMAGE_RETRY_PARAM, 'v');
const unversionedCatalogImageUrl = new Function(
  'window', 'CATALOG_IMAGE_RETRY_PARAM', 'CATALOG_ASSET_VERSION_PARAM',
  `${normalizeSource}; return unversionedCatalogImageUrl;`
)(fakeWindow, CATALOG_IMAGE_RETRY_PARAM, 'v');
const catalogImageRecoveryCandidates = new Function(
  'normalizeCatalogImageUrl', 'cacheBustedCatalogImageUrl', 'unversionedCatalogImageUrl',
  `${candidatesSource}; return catalogImageRecoveryCandidates;`
)(normalizeCatalogImageUrl, cacheBustedCatalogImageUrl, unversionedCatalogImageUrl);

const candidates = catalogImageRecoveryCandidates(
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

const tiered = catalogImageRecoveryCandidates(
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

const manual = catalogImageRecoveryCandidates(
  'https://cdn.example.test/full.webp?bargig_retry=old',
  'https://cdn.example.test/thumb.webp',
  { forceRefresh: true }
);
assert.equal(manual[0].role, 'manual');
assert.match(manual[0].src, /bargig_retry=/);
assert.doesNotMatch(manual[0].src, /old/);

console.log('viewer_image_loading_logic.test.js: PASS');
