"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const navigation = read("src/js/00-navigation.js");
const state = read("src/js/10-app-state.js");
const favorites = read("src/js/30-favorites-share.js");
const catalog = read("src/js/40-catalog-grid.js");
const search = read("src/js/50-search-ui.js");
const viewer = read("src/js/60-viewer.js");
const viewerActions = read("src/js/62-viewer-actions.js");
const onboarding = read("src/js/65-viewer-onboarding.js");
const input = read("src/js/70-viewer-input.js");
const bootstrap = read("src/js/90-bootstrap.js");
const foundation = read("src/css/00-foundation.css");
const onboardingCss = read("src/css/05-viewer-onboarding.css");
const shellCss = read("src/css/06-shell-components.css");
const responsiveCss = read("src/css/80-responsive-shell.css");
const favoritesRoutingCss = read("src/css/85-favorites-routing.css");
const visualPolishCss = read("src/css/90-visual-polish.css");

assert.match(state, /const boundEventFeatures = new Set\(\)/);
assert.match(state, /function bindFeatureEventsOnce\([\s\S]*?binder\(\);[\s\S]*?boundEventFeatures\.add\(name\)/);
assert.match(navigation, /function attachNavigationEvents\(/);
assert.match(favorites, /function attachFavoritesShareEvents\(/);
assert.match(catalog, /function attachCatalogGridEvents\(/);
assert.match(search, /function attachSearchUiEvents\(/);
assert.match(viewer, /function attachViewerEvents\(/);
assert.match(viewerActions, /function attachViewerActionEvents\(/);
assert.match(onboarding, /function attachViewerOnboardingEvents\(/);
assert.match(input, /function attachViewerGestures\(/);

assert.doesNotMatch(bootstrap, /els\.globalSearchInput\?\.addEventListener/);
assert.doesNotMatch(bootstrap, /els\.viewerOnboardingNext\?\.addEventListener/);
assert.doesNotMatch(bootstrap, /els\.prevPageBtn\?\.addEventListener/);
assert.match(bootstrap, /function attachEvents\(\) \{[\s\S]*?attachCatalogGridEvents[\s\S]*?attachSearchUiEvents[\s\S]*?attachViewerActionEvents[\s\S]*?attachViewerEvents/);
assert.ok(bootstrap.split(/\r?\n/).length < 330, "composition root should stay compact");

assert.doesNotMatch(viewer, /function getViewerOnboardingStorage\(/);
assert.doesNotMatch(viewer, /function startPointerInteraction\(/);
assert.match(onboarding, /function getViewerOnboardingStorage\(/);
assert.match(input, /function startPointerInteraction\(/);

assert.doesNotMatch(foundation, /\.viewer-onboarding\s*\{/);
assert.match(onboardingCss, /\.viewer-onboarding\s*\{/);
assert.match(onboardingCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(shellCss, /html\.viewer-open/);
assert.match(shellCss, /\.site-header/);
assert.match(responsiveCss, /@media \(max-width: 760px\)/);
assert.match(favoritesRoutingCss, /\.favorites-panel/);
assert.match(favoritesRoutingCss, /Multi-document application layout/);
assert.match(visualPolishCss, /Stage 12/);
assert.match(visualPolishCss, /Favorites sharing/);

console.log("feature_event_ownership_contract.test.js: PASS");
