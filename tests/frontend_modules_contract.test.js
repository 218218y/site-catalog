'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readBundle, readCssBundle } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const catalogBundle = readBundle('catalog');
const favoritesBundle = readBundle('favorites');
const viewerBundle = readBundle('viewer');
const catalogCss = readCssBundle('catalog');
const favoritesCss = readCssBundle('favorites');
const viewerCss = readCssBundle('viewer');
const legacyLoader = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const pageBuilder = fs.readFileSync(path.join(root, 'tools', 'build_site_pages.py'), 'utf8');
const deployBuilder = fs.readFileSync(path.join(root, 'tools', 'build_deploy_bundle.py'), 'utf8');
const frontendBuilder = fs.readFileSync(path.join(root, 'tools', 'build_frontend_assets.py'), 'utf8');
const contractChecker = fs.readFileSync(path.join(root, 'tools', 'check_frontend_contracts.py'), 'utf8');

for (const bundle of [catalogBundle, favoritesBundle, viewerBundle]) {
  assert.match(bundle, /GENERATED FILE — DO NOT EDIT DIRECTLY/);
  assert.match(bundle, /\(\(\) => \{\s*"use strict";/);
  assert.match(bundle, /\}\)\(\);\s*$/);
  assert.equal((bundle.match(/let initResult = true;/g) || []).length, 1);
  assert.equal((bundle.match(/initResult = init\(\);/g) || []).length, 1);
}
for (const css of [catalogCss, favoritesCss, viewerCss]) {
  assert.match(css, /GENERATED FILE — DO NOT EDIT DIRECTLY/);
}

assert.match(frontendBuilder, /BUNDLE_SPECS:\s*tuple\[FrontendBundleSpec, \.\.\.\]/);
assert.match(frontendBuilder, /ROUTE_ASSETS:/);
assert.match(frontendBuilder, /DEPLOY_GENERATED_FILES/);
assert.match(frontendBuilder, /def atomic_write_text/);
assert.match(frontendBuilder, /def build_frontend_assets/);
assert.match(frontendBuilder, /def validate_module_manifest/);
assert.match(frontendBuilder, /def render_legacy_loader/);
assert.match(legacyLoader, /GENERATED COMPATIBILITY LOADER/);
assert.match(legacyLoader, /app-catalog\.js/);
assert.match(legacyLoader, /app-favorites\.js/);
assert.match(legacyLoader, /app-viewer\.js/);

assert.match(pageBuilder, /from build_frontend_assets import ROUTE_ASSETS, build_frontend_assets/);
assert.match(pageBuilder, /ROUTE_STYLESHEET/);
assert.match(pageBuilder, /ROUTE_SCRIPT/);
assert.match(deployBuilder, /DEPLOY_GENERATED_FILES as FRONTEND_GENERATED_FILES/);
assert.doesNotMatch(deployBuilder, /src\/js|src\/css/);

assert.match(catalogBundle, /BEGIN SOURCE: src\/js\/40-catalog-grid\.js/);
assert.match(catalogBundle, /BEGIN SOURCE: src\/js\/50-search-ui\.js/);
assert.doesNotMatch(catalogBundle, /BEGIN SOURCE: src\/js\/16-viewer-state\.js/);
assert.doesNotMatch(catalogBundle, /BEGIN SOURCE: src\/js\/60-viewer\.js/);
assert.doesNotMatch(catalogBundle, /BEGIN SOURCE: src\/js\/35-favorites-workspace\.js/);

assert.match(favoritesBundle, /BEGIN SOURCE: src\/js\/35-favorites-workspace\.js/);
assert.match(favoritesBundle, /BEGIN SOURCE: src\/js\/40-catalog-grid\.js/);
assert.match(favoritesBundle, /BEGIN SOURCE: src\/js\/32-shared-inquiry\.js/);
assert.doesNotMatch(favoritesBundle, /BEGIN SOURCE: src\/js\/16-viewer-state\.js/);
assert.doesNotMatch(favoritesBundle, /BEGIN SOURCE: src\/js\/60-viewer\.js/);

assert.match(viewerBundle, /BEGIN SOURCE: src\/js\/16-viewer-state\.js/);
assert.match(viewerBundle, /BEGIN SOURCE: src\/js\/31-viewer-share\.js/);
assert.match(viewerBundle, /BEGIN SOURCE: src\/js\/32-shared-inquiry\.js/);
assert.match(viewerBundle, /BEGIN SOURCE: src\/js\/60-viewer\.js/);
assert.match(viewerBundle, /BEGIN SOURCE: src\/js\/35-favorites-workspace\.js/);
assert.match(viewerBundle, /BEGIN SOURCE: src\/js\/40-catalog-grid\.js/);
assert.match(viewerBundle, /getFeatureInterface\("search"\)/);

assert.match(contractChecker, /Viewer implementation reaches into search internals/);
assert.match(contractChecker, /Search implementation reaches into Viewer internals/);
assert.match(contractChecker, /app\.js is still a monolithic bundle/);

console.log('frontend_modules_contract.test.js: PASS');
