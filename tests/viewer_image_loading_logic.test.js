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
  'window', 'CATALOG_IMAGE_RETRY_PARAM',
  `${normalizeSource}; return cacheBustedCatalogImageUrl;`
)(fakeWindow, CATALOG_IMAGE_RETRY_PARAM);
const catalogImageRecoveryCandidates = new Function(
  'normalizeCatalogImageUrl', 'cacheBustedCatalogImageUrl',
  `${candidatesSource}; return catalogImageRecoveryCandidates;`
)(normalizeCatalogImageUrl, cacheBustedCatalogImageUrl);

const candidates = catalogImageRecoveryCandidates(
  'https://cdn.example.test/full.webp',
  'https://cdn.example.test/thumb.webp'
);
assert.equal(candidates.length, 3);
assert.equal(candidates[0].role, 'primary');
assert.equal(candidates[1].role, 'retry');
assert.match(candidates[1].src, /bargig_retry=/);
assert.equal(candidates[2].role, 'fallback');
assert.equal(candidates[2].fallback, true);

const manual = catalogImageRecoveryCandidates(
  'https://cdn.example.test/full.webp?bargig_retry=old',
  'https://cdn.example.test/thumb.webp',
  { forceRefresh: true }
);
assert.equal(manual[0].role, 'manual');
assert.match(manual[0].src, /bargig_retry=/);
assert.doesNotMatch(manual[0].src, /old/);

console.log('viewer_image_loading_logic.test.js: PASS');
