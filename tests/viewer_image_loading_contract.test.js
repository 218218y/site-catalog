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
assert.match(recovery, /const managePlaceholder = options\.managePlaceholder !== false;/);
assert.match(recovery, /if \(managePlaceholder\) \{[\s\S]*?prepareImagePlaceholder\(img\);/);
assert.match(app, /fallback: role\.startsWith\("fallback"\)/);
assert.match(single, /fallbackCandidates: request\.fallbackCandidates/);
assert.match(single, /image\.dataset\.loadedTier/);
assert.match(single, /telemetryDetail: "viewer-single"/);
assert.match(single, /currentTierIsSufficient/);
assert.match(app, /telemetryDetail: "viewer-resolution-upgrade"/);
assert.match(app, /managePlaceholder: false/);
assert.match(app, /lightbox-image-resolution-upgrade/);
assert.match(app, /placeholderPolicy = IMAGE_PLACEHOLDER_POLICY_PRESERVE_FRAME/);
assert.match(app, /function keepSingleViewerPlaceholderReady\(\)/);
assert.match(app, /baseImage\.dataset\.placeholderPolicy = IMAGE_PLACEHOLDER_POLICY_PRESERVE_FRAME;[\s\S]*?setCatalogImageSource\(baseImage, loadedSrc\);/);
assert.match(app, /await upgradeImage\.decode\(\)/);
assert.match(single, /התמונה לא הצליחה להיטען/);
assert.match(retry, /viewerPageImageRequest\(state\.catalog, state\.page, \{ progressive: true \}\)/);
assert.match(retry, /showSingleLightboxImage\(state\.catalog, state\.page, request\.primarySrc/);
assert.match(retry, /forceRefresh: true/);
assert.match(template, /id="viewerImageFeedback"[^>]*role="status"/);
assert.match(template, /id="viewerImageRetry"/);
assert.match(css, /\.viewer-image-feedback\s*\{/);
assert.doesNotMatch(css, /\.viewer-scroll-image-feedback\s*\{/);
assert.match(css, /\.lightbox-image-frame\.image-terminal-error/);

console.log('viewer_image_loading_contract.test.js: PASS');
