'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return app.slice(start, end);
}

const recovery = sourceBetween(
  'function loadCatalogImageWithRecovery(img, options = {})',
  'function prepareCatalogImage(url, options = {})'
);
const single = sourceBetween(
  'function showSingleLightboxImage(catalog, page, src, options = {})',
  'function pad(num)'
);
const retry = sourceBetween(
  'function retryCurrentViewerImage()',
  'function getViewerNavigationPosition()'
);

assert.match(app, /const CATALOG_IMAGE_RETRY_PARAM = "bargig_retry";/);
assert.match(app, /function catalogImageRecoveryCandidates\(/);
assert.match(recovery, /setCatalogImageSource\(img, candidate\.src\);/);
assert.match(recovery, /onExhausted/);
assert.match(recovery, /telemetryTrackImageAttemptFailure/);
assert.match(recovery, /telemetryTrackImageRecovery/);
assert.match(recovery, /telemetryTrackImageTerminalFailure/);
assert.match(app, /fallback: role\.startsWith\("fallback"\)/);
assert.match(single, /fallbackCandidates: request\.fallbackCandidates/);
assert.match(single, /image\.dataset\.loadedTier/);
assert.match(single, /telemetryDetail: "viewer-single"/);
assert.match(single, /const preserveCurrentImage = Boolean\(/);
assert.match(single, /retainSingleViewerResolutionLayerForSwap\(\)/);
assert.match(single, /releaseSingleViewerRetainedResolutionLayer\(\)/);
assert.match(single, /image\.dataset\.placeholderIgnore = "true"/);
assert.match(single, /prepareCatalogImage\(primarySrc, \{ priority: "high", detail: "viewer-page-stage" \}\)/);
assert.match(single, /\.catch\(\(\) => null\)[\s\S]*?\.then\(commitImageRequest\)/);
assert.match(single, /delete image\.dataset\.placeholderIgnore/);
assert.match(single, /התמונה לא הצליחה להיטען/);
assert.match(retry, /viewerPageImageRequest\(state\.catalog, state\.page\)/);
assert.match(retry, /showSingleLightboxImage\(state\.catalog, state\.page, request\.primarySrc/);
assert.match(retry, /forceRefresh: true/);
assert.match(template, /id="viewerImageFeedback"[^>]*role="status"/);
assert.match(template, /id="viewerImageRetry"/);
assert.match(css, /\.viewer-image-feedback\s*\{/);
assert.doesNotMatch(css, /\.viewer-scroll-image-feedback\s*\{/);
assert.match(css, /\.lightbox-image-frame\.image-terminal-error/);
assert.match(css, /\.lightbox\.is-page-loading \.lightbox-image-frame\s*\{[\s\S]*?brightness\(\.97\)/);
assert.match(app, /function prepareSingleViewerResolutionUpgrade\(/);
assert.match(app, /telemetryDetail: "viewer-resolution-upgrade"/);
assert.match(app, /activeSingleViewerImageLogicalSrc\(\)/);
assert.match(css, /\.lightbox-image-frame > \.lightbox-image:not\(\.lightbox-image-resolution\)\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?display:\s*block;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;/);
assert.match(css, /\.image-placeholder-frame:not\(\.lightbox-image-frame\) > img:not\(\[data-placeholder-ignore=\"true\"\]\)\s*\{[\s\S]*?position:\s*relative;/);
assert.match(css, /\.lightbox-image-frame \.lightbox-image-resolution/);
assert.match(css, /\.lightbox-image-frame\.is-resolution-upgrade-ready \.lightbox-image-resolution/);

console.log('viewer_image_loading_contract.test.js: PASS');
