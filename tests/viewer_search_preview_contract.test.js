'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const searchPreviewSource = fs.readFileSync(path.join(root, 'src/js/47-search-preview.js'), 'utf8');
const readerSearchSource = fs.readFileSync(path.join(root, 'src/js/49-search-reader-ui.js'), 'utf8');
const searchRootSource = fs.readFileSync(path.join(root, 'src/js/50-search-ui.js'), 'utf8');
const favoritesRoutingCss = fs.readFileSync(path.join(root, 'src/css/85-favorites-routing.css'), 'utf8');

for (const html of [template, viewer]) {
  assert.match(html, /id="lightboxSearchResults"/);
  assert.match(html, /class="search-floating-preview" id="searchFloatingPreview"/);
  assert.match(html, /id="searchFloatingPreviewImage"/);
}

const viewerShellRule = favoritesRoutingCss.match(
  /\/\* Hide only the inactive document shell in the standalone viewer\.[\s\S]*?display:\s*none;\s*\}/
)?.[0] || '';

assert.ok(viewerShellRule, 'standalone viewer shell rule must exist');
assert.doesNotMatch(
  viewerShellRule,
  />\s*\.search-floating-preview/,
  'viewer shell cleanup must not hide the shared search preview overlay'
);

assert.match(readerSearchSource, /bindSearchFloatingPreviewEvents\(searchElements\.lightboxSearchResults\)/);
assert.match(searchRootSource, /searchElements\.lightboxSearchResults\?\.addEventListener\("wheel", handleSearchPreviewScrollIntent/);
assert.match(searchRootSource, /searchElements\.lightboxSearchResults\?\.addEventListener\("scroll", \(\) => suppressSearchFloatingPreview\(\)/);
assert.match(searchPreviewSource, /function restoreSearchFloatingPreviewAfterSuppression\(\)/);

console.log('viewer_search_preview_contract.test.js: PASS');
