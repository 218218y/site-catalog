'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const favorites = fs.readFileSync(path.join(root, 'favorites.html'), 'utf8');

for (const html of [template, viewer]) {
  assert.match(html, /id="viewerPageIndicator"[\s\S]*?id="viewerPageIndicatorCurrent"[\s\S]*?id="viewerPageIndicatorTotal"/);
  assert.match(html, /id="lightboxProgress"[^>]*role="progressbar"/);
}

for (const html of [template, favorites]) {
  assert.match(html, /id="favoritesEmpty"[\s\S]*?empty-state-icon[\s\S]*?לצפייה בקטלוגים/);
}

assert.match(app, /function singleImageFitLayout\(/);
assert.match(app, /function applyLightboxFrameGeometry\(/);
assert.match(app, /applyLightboxFrameGeometry\(preparedImage\.naturalWidth, preparedImage\.naturalHeight/);
assert.match(app, /function initImagePlaceholderObserver\(/);
assert.match(app, /new MutationObserver/);
assert.match(app, /showActionToast\("נשמר",|const feedback = added \? "נשמר" : "הוסר"/);
assert.match(app, /showActionToast\("הוסר", \{ tone: "removed" \}\)/);
assert.match(app, /showActionToast\("הקישור הועתק", \{ tone: "link" \}\)/);
assert.match(app, /aria-valuetext/);
assert.match(app, /viewerPageIndicatorCurrent\.textContent/);
assert.match(app, /function searchEmptyStateMarkup\(/);
assert.match(app, /data-empty-search-clear/);
assert.match(app, /data-lightbox-empty-search-clear/);

assert.match(css, /--radius-card:\s*22px/);
assert.match(css, /--control-height:\s*42px/);
assert.match(css, /\.image-placeholder-frame\.image-loading/);
assert.match(css, /@keyframes image-placeholder-sheen/);
assert.match(css, /\.lightbox-image-frame\s*\{[\s\S]*?width var\(--image-swap-duration\)[\s\S]*?height var\(--image-swap-duration\)/);
assert.match(css, /\.viewer-page-indicator\s*\{/);
assert.match(css, /\.catalog-progress\s*\{[\s\S]*?height:\s*5px/);
assert.match(css, /\.site-action-toast\[data-tone="removed"\]::before/);
assert.match(css, /\.empty-state\s*\{/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation-duration:\s*\.01ms !important/);

console.log('visual_polish_contract.test.js: PASS');
