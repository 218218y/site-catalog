"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { findCalls, inventorySource } = require("./helpers/frontend_ast.js");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const parse = (relative) => inventorySource(read(relative), relative);

const javascriptFiles = {
  navigation: "src/js/00-navigation.js",
  state: "src/js/10-app-state.js",
  favorites: "src/js/30-favorites-share.js",
  inquiry: "src/js/32-shared-inquiry.js",
  catalog: "src/js/40-catalog-grid.js",
  search: "src/js/50-search-ui.js",
  viewerSessionState: "src/js/51-viewer-session-state.js",
  viewerSession: "src/js/52-viewer-session.js",
  viewerGeometry: "src/js/54-viewer-geometry.js",
  viewerShell: "src/js/56-viewer-shell.js",
  viewerNavigation: "src/js/58-viewer-navigation.js",
  viewer: "src/js/60-viewer.js",
  viewerActions: "src/js/62-viewer-actions.js",
  onboarding: "src/js/65-viewer-onboarding.js",
  input: "src/js/70-viewer-input.js",
  appShell: "src/js/80-app-shell.js",
  bootstrap: "src/js/90-bootstrap.js",
};
const ast = Object.fromEntries(Object.entries(javascriptFiles).map(([key, relative]) => [key, parse(relative)]));
const functions = (key) => new Set(ast[key].functionDeclarations);

assert.equal(ast.state.newExpressions.some((entry) => entry.callee === "Set"), true);
assert.equal(functions("state").has("bindFeatureEventsOnce"), true);
assert.equal(findCalls(ast.state, "binder").length > 0, true);
assert.equal(findCalls(ast.state, "boundEventFeatures.add").length > 0, true);

for (const [key, functionName] of [
  ["navigation", "attachNavigationEvents"],
  ["favorites", "attachFavoritesShareEvents"],
  ["inquiry", "attachSharedInquiryEvents"],
  ["catalog", "attachCatalogGridEvents"],
  ["search", "attachSearchUiEvents"],
  ["viewer", "attachViewerEvents"],
  ["viewerActions", "attachViewerActionEvents"],
  ["onboarding", "attachViewerOnboardingEvents"],
  ["input", "attachViewerGestures"],
]) {
  assert.equal(functions(key).has(functionName), true, `${javascriptFiles[key]} must own ${functionName}`);
}

assert.equal(ast.bootstrap.identifiers.includes("searchElements"), false);
assert.equal(ast.bootstrap.identifiers.includes("viewerElements"), false);
assert.equal(functions("appShell").has("attachFeatureEvents"), true);
const requiredFeatures = new Set(findCalls(ast.appShell, "requireFeatureInterface").map((call) => call.arguments[0]));
for (const feature of ["catalog-grid", "search", "favorites"]) {
  assert.equal(requiredFeatures.has(feature), true, `app shell must require ${feature}`);
}
const boundOwners = new Set(findCalls(ast.appShell, "bindFeatureEventsOnce").map((call) => call.arguments[0]));
for (const owner of ["catalog-grid", "search-ui", "favorites-share", "inquiry", "navigation"]) {
  assert.equal(boundOwners.has(owner), true, `app shell must bind ${owner} once`);
}
const optionalFeatures = new Set(findCalls(ast.appShell, "getFeatureInterface").map((call) => call.arguments[0]));
assert.equal(optionalFeatures.has("viewer"), true);
assert.equal(optionalFeatures.has("inquiry"), true);

for (const callee of ["attachViewerActionEvents", "attachViewerOnboardingEvents", "attachViewerEvents"]) {
  assert.equal(findCalls(ast.viewer, callee).length > 0, true, `Viewer feature must compose ${callee}`);
}

const appShellSource = read(javascriptFiles.appShell);
const bootstrapSource = read(javascriptFiles.bootstrap);
assert.ok(appShellSource.split(/\r?\n/).length < 190, "application shell should stay focused on orchestration");
assert.ok(bootstrapSource.split(/\r?\n/).length < 30, "bootstrap should remain a startup-only entry point");
for (const forbiddenCall of ["addEventListener", "attachFeatureEvents", "attachShellEvents"]) {
  assert.equal(findCalls(ast.bootstrap, forbiddenCall).length, 0, `bootstrap must not call ${forbiddenCall}`);
}
assert.equal(findCalls(ast.bootstrap, 'requireFeatureInterface("app-shell").initialize').length, 1);
assert.equal(findCalls(ast.bootstrap, "getFeatureInterface").length, 0);

for (const [key, functionName] of [
  ["viewerSessionState", "transitionViewerPhase"],
  ["viewerSessionState", "transitionViewerFullscreenPhase"],
  ["viewerGeometry", "applyZoom"],
  ["viewerShell", "renderLightboxPageRail"],
  ["viewerNavigation", "handleViewerPageWheel"],
  ["onboarding", "getViewerOnboardingStorage"],
  ["input", "startPointerInteraction"],
]) {
  assert.equal(functions(key).has(functionName), true, `${javascriptFiles[key]} must own ${functionName}`);
}
assert.equal(functions("viewer").has("getViewerOnboardingStorage"), false);
assert.equal(functions("viewer").has("startPointerInteraction"), false);

// CSS contracts remain textual by nature; AST migration applies only to code structure.
const foundation = read("src/css/00-foundation.css");
const onboardingCss = read("src/css/05-viewer-onboarding.css");
const shellCss = read("src/css/06-shell-components.css");
const responsiveCss = read("src/css/80-responsive-shell.css");
const favoritesRoutingCss = read("src/css/85-favorites-routing.css");
const visualPolishCss = read("src/css/90-visual-polish.css");
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
