'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = app.indexOf(startMarker);
  const end = app.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return app.slice(start, end);
}

const preload = sourceBetween(
  'function prepareCatalogImage(url, options = {})',
  'function runViewerPageSwapAnimation(element, options = {})'
);
const single = sourceBetween(
  'function showSingleLightboxImage(catalog, page, src)',
  'function pad(num)'
);
const scroll = sourceBetween(
  'function loadViewerScrollPage(page, priority = "low")',
  'function loadViewerScrollWindow(centerPage)'
);

assert.match(app, /const CATALOG_IMAGE_PRELOAD_CACHE_LIMIT = 24;/);
assert.match(preload, /resolve\(\{[\s\S]*?width: Number\(image\.naturalWidth\)[\s\S]*?height: Number\(image\.naturalHeight\)/);
assert.doesNotMatch(preload, /image\.decode\(/);
assert.doesNotMatch(preload, /resolve\(image\)/);
assert.match(preload, /state\.catalogImageLoadCache\.size >= CATALOG_IMAGE_PRELOAD_CACHE_LIMIT/);

assert.match(single, /setCatalogImageSource\(image, src\);/);
assert.match(single, /image\.addEventListener\("load", \(\) => settle\(true\)/);
assert.match(single, /image\.addEventListener\("error", \(\) => settle\(false\)/);
assert.match(single, /if \(image\.complete\) queueMicrotask\(\(\) => settle\(Boolean\(image\.naturalWidth\)\)\);/);
assert.doesNotMatch(single, /prepareCatalogImage\(/);
assert.doesNotMatch(single, /await /);

assert.match(scroll, /image\.loading = priority === "high" \? "eager" : "lazy";/);
assert.match(scroll, /setCatalogImageSource\(image, src\);/);
assert.match(scroll, /image\.addEventListener\("load", \(\) => settle\(true\)/);
assert.match(scroll, /image\.addEventListener\("error", \(\) => settle\(false\)/);
assert.doesNotMatch(scroll, /prepareCatalogImage\(/);

assert.match(css, /\.lightbox-image-frame\.is-preparing-swap \.lightbox-image\s*\{[\s\S]*?opacity:\s*0;/);

console.log('viewer_image_loading_contract.test.js: PASS');
