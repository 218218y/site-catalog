"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const navigation = read("src/js/00-navigation.js");
const state = read("src/js/10-app-state.js");
const favorites = read("src/js/30-favorites-share.js");
const inquiry = read("src/js/32-shared-inquiry.js");
const catalog = read("src/js/40-catalog-grid.js");
const search = read("src/js/50-search-ui.js");
const viewerSession = read("src/js/52-viewer-session.js");
const viewerGeometry = read("src/js/54-viewer-geometry.js");
const viewerShell = read("src/js/56-viewer-shell.js");
const viewerNavigation = read("src/js/58-viewer-navigation.js");
const viewer = read("src/js/60-viewer.js");
const viewerActions = read("src/js/62-viewer-actions.js");
const onboarding = read("src/js/65-viewer-onboarding.js");
const input = read("src/js/70-viewer-input.js");
const appShell = read("src/js/80-app-shell.js");
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
assert.match(inquiry, /function attachSharedInquiryEvents\(/);
assert.match(catalog, /function attachCatalogGridEvents\(/);
assert.match(search, /function attachSearchUiEvents\(/);
assert.match(viewer, /function attachViewerEvents\(/);
assert.match(viewerActions, /function attachViewerActionEvents\(/);
assert.match(onboarding, /function attachViewerOnboardingEvents\(/);
assert.match(input, /function attachViewerGestures\(/);

assert.doesNotMatch(bootstrap, /searchElements\.globalSearchInput\?\.addEventListener/);
assert.doesNotMatch(bootstrap, /viewerElements\.viewerOnboardingNext\?\.addEventListener/);
assert.doesNotMatch(bootstrap, /viewerElements\.prevPageBtn\?\.addEventListener/);
assert.match(appShell, /function attachFeatureEvents\(\) \{[\s\S]*?getFeatureInterface\("catalog-grid"\)[\s\S]*?catalogGrid\.attachEvents[\s\S]*?getFeatureInterface\("search"\)[\s\S]*?search\.attachEvents[\s\S]*?getFeatureInterface\("viewer"\)[\s\S]*?viewer\.attachEvents/);
assert.match(appShell, /getFeatureInterface\("inquiry"\)[\s\S]*?bindFeatureEventsOnce\("inquiry", inquiry\.attachEvents\)/);
assert.match(appShell, /bindFeatureEventsOnce\("navigation", navigationFeature\(\)\.attachEvents\)/);
assert.match(viewer, /attachEvents: \(\) => \{[\s\S]*?attachViewerActionEvents\(\)[\s\S]*?attachViewerOnboardingEvents\(\)[\s\S]*?attachViewerEvents\(\)/);
assert.ok(appShell.split(/\r?\n/).length < 190, "application shell should stay focused on orchestration");
assert.ok(bootstrap.split(/\r?\n/).length < 30, "bootstrap should remain a startup-only entry point");
assert.doesNotMatch(bootstrap, /addEventListener|attachFeatureEvents|attachShellEvents/, "bootstrap must not own application behavior");

assert.match(viewerSession, /function transitionViewerPhase\(/);
assert.match(viewerSession, /function transitionViewerFullscreenPhase\(/);
assert.match(viewerGeometry, /function applyZoom\(/);
assert.match(viewerShell, /function renderLightboxPageRail\(/);
assert.match(viewerNavigation, /function handleViewerPageWheel\(/);
assert.doesNotMatch(viewer, /function getViewerOnboardingStorage\(/);
assert.doesNotMatch(viewer, /function startPointerInteraction\(/);
assert.match(onboarding, /function getViewerOnboardingStorage\(/);
assert.match(input, /function startPointerInteraction\(/);

assert.doesNotMatch(foundation, /\.viewer-onboarding\s*\{/);
assert.match(onboardingCss, /\.viewer-onboarding\s*\{/);
assert.match(onboardingCss, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(shellCss, /html\.viewer-open/);
assert.match(shellCss, /\.site-header/);
assert.match(shellCss, /\.header-favorites-button\s*\{[\s\S]*?position:\s*relative;[\s\S]*?order:\s*10;/);
assert.match(shellCss, /\.header-favorites-count\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?display:\s*inline-grid;/);
assert.doesNotMatch(favoritesRoutingCss, /(?:^|\n)\.header-favorites-button\s*\{/);
assert.doesNotMatch(favoritesRoutingCss, /(?:^|\n)\.header-favorites-count\s*\{/);
assert.match(responsiveCss, /@media \(max-width: 760px\)/);
assert.match(favoritesRoutingCss, /\.favorites-panel/);
assert.match(favoritesRoutingCss, /Multi-document application layout/);
assert.match(visualPolishCss, /Stage 12/);
assert.match(visualPolishCss, /Favorites sharing/);

console.log("feature_event_ownership_contract.test.js: PASS");
