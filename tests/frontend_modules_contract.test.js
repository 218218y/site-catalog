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
assert.match(frontendBuilder, /def validate_module_manifest/);
assert.match(app, /\(\(\) => \{\s*"use strict";/);
assert.match(app, /\}\)\(\);\s*$/);
assert.match(pageBuilder, /from build_frontend_assets import build_frontend_assets/);
assert.match(pageBuilder, /if build_assets:\s*\n\s*build_frontend_assets\(root\)/);
assert.doesNotMatch(deployBuilder, /src\/js|src\/css/);

const jsSources = [
  ['src/js/00-navigation.js', /function navigateTo/],
  ['src/js/10-app-state.js', /const state =/],
  ['src/js/15-telemetry.js', /function telemetryInit/],
  ['src/js/20-shared-ui.js', /function showActionToast/],
  ['src/js/30-favorites-share.js', /function shareFavoritesList/],
  ['src/js/40-catalog-grid.js', /function renderCatalogCards/],
  ['src/js/50-search-ui.js', /function renderSearchResults/],
  ['src/js/52-viewer-session.js', /function transitionViewerPhase/],
  ['src/js/54-viewer-geometry.js', /function applyZoom/],
  ['src/js/56-viewer-shell.js', /function renderLightboxPageRail/],
  ['src/js/58-viewer-scroll.js', /function renderViewerScrollPages/],
  ['src/js/60-viewer.js', /function openLightbox/],
  ['src/js/62-viewer-actions.js', /function openViewerInquiry/],
  ['src/js/65-viewer-onboarding.js', /function showViewerOnboardingIfNeeded/],
  ['src/js/70-viewer-input.js', /function startPointerInteraction/],
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
assert.match(app, /function bindFeatureEventsOnce\(/);
assert.match(app, /bindFeatureEventsOnce\("catalog-grid", attachCatalogGridEvents\)/);
assert.match(app, /bindFeatureEventsOnce\("viewer-actions", attachViewerActionEvents\)/);
assert.match(app, /bindFeatureEventsOnce\("viewer-onboarding", attachViewerOnboardingEvents\)/);
assert.match(app, /bindFeatureEventsOnce\("viewer", attachViewerEvents\)/);

console.log('frontend_modules_contract.test.js: PASS');
