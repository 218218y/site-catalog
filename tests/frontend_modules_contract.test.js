'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const pageBuilder = fs.readFileSync(path.join(root, 'tools', 'build_site_pages.py'), 'utf8');
const deployBuilder = fs.readFileSync(path.join(root, 'tools', 'build_deploy_bundle.py'), 'utf8');
const frontendBuilder = fs.readFileSync(path.join(root, 'tools', 'build_frontend_assets.py'), 'utf8');

assert.match(app, /GENERATED FILE — DO NOT EDIT DIRECTLY/);
assert.match(css, /GENERATED FILE — DO NOT EDIT DIRECTLY/);
assert.match(frontendBuilder, /JS_MODULES:\s*tuple\[str, \.\.\.\]/);
assert.match(frontendBuilder, /CSS_MODULES:\s*tuple\[str, \.\.\.\]/);
assert.match(frontendBuilder, /def atomic_write_text/);
assert.match(frontendBuilder, /def build_frontend_assets/);
assert.match(pageBuilder, /from build_frontend_assets import build_frontend_assets/);
assert.match(pageBuilder, /if build_assets:\s*\n\s*build_frontend_assets\(root\)/);
assert.doesNotMatch(deployBuilder, /src\/js|src\/css/);

const jsSources = [
  ['src/js/00-navigation.js', /function navigateTo/],
  ['src/js/10-app-state.js', /const state =/],
  ['src/js/20-shared-ui.js', /function showActionToast/],
  ['src/js/30-favorites-share.js', /function shareFavoritesList/],
  ['src/js/40-catalog-grid.js', /function renderCatalogCards/],
  ['src/js/50-search-ui.js', /function renderSearchResults/],
  ['src/js/60-viewer.js', /function openLightbox/],
  ['src/js/90-bootstrap.js', /function attachEvents/]
];
for (const [relative, pattern] of jsSources) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  assert.match(source, pattern, relative);
  assert.match(app, new RegExp(`BEGIN SOURCE: ${relative.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
}

assert.equal((app.match(/let initResult = true;/g) || []).length, 1);
assert.equal((app.match(/initResult = init\(\);/g) || []).length, 1);
assert.equal((app.match(/function attachEvents\(/g) || []).length, 1);

console.log('frontend_modules_contract.test.js: PASS');
