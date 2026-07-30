'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllBundles, readAllCssBundles } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const app = readAllBundles();
const css = readAllCssBundles();
const searchUiSource = fs.readFileSync(path.join(root, 'src/js/50-search-ui.js'), 'utf8');

for (const html of [template, viewer]) {
  assert.match(html, /id="lightboxSearchResults"/);
  assert.match(html, /class="search-floating-preview" id="searchFloatingPreview"/);
  assert.match(html, /id="searchFloatingPreviewImage"/);
}

const viewerShellRule = css.match(
  /\/\* Hide only the inactive document shell in the standalone viewer\.[\s\S]*?display:\s*none\s*!important;\s*\}/
)?.[0] || '';

assert.ok(viewerShellRule, 'standalone viewer shell rule must exist');
assert.doesNotMatch(
  viewerShellRule,
  />\s*\.search-floating-preview/,
  'viewer shell cleanup must not hide the shared search preview overlay'
);

assert.match(searchUiSource, /bindSearchFloatingPreviewEvents\(searchElements\.lightboxSearchResults\)/);
assert.match(searchUiSource, /searchElements\.lightboxSearchResults\?\.addEventListener\("wheel", handleSearchPreviewScrollIntent/);
assert.match(searchUiSource, /searchElements\.lightboxSearchResults\?\.addEventListener\("scroll", \(\) => suppressSearchFloatingPreview\(\)/);
assert.match(searchUiSource, /function restoreSearchFloatingPreviewAfterSuppression\(\)/);

console.log('viewer_search_preview_contract.test.js: PASS');
