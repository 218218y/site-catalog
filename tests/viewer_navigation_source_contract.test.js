"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "src", "js");
const sources = new Map(
  fs.readdirSync(sourceDir)
    .filter((name) => name.endsWith(".js"))
    .map((name) => [name, fs.readFileSync(path.join(sourceDir, name), "utf8")])
);
const transitions = sources.get("17-viewer-state-transitions.js");
const geometry = sources.get("54-viewer-geometry.js");
const navigation = sources.get("58-viewer-navigation.js");
const pageController = sources.get("59-viewer-page-controller.js");
const viewer = sources.get("60-viewer.js");
const input = sources.get("70-viewer-input.js");

const allProductionSource = [...sources.values()].join("\n");
for (const legacyName of [
  "resetViewOnPageTurn", "pageTurnDirection", "pageTurnAxis",
  "queueSingleImageRelativePosition", "queueSingleImagePageTurnOrigin"
]) {
  assert.doesNotMatch(allProductionSource, new RegExp(`\\b${legacyName}\\b`), `${legacyName} must not bypass the command boundary`);
}
assert.doesNotMatch(allProductionSource, /\b(?:keepZoom|resetZoom|resetPosition)\s*:/,
  "contradictory boolean navigation flags must not return");
assert.doesNotMatch(allProductionSource, /\bviewerState\b/, "the aggregate Viewer state must not return to production code");

assert.match(transitions, /const VIEWER_NAVIGATION_SOURCE_WHEEL = "wheel"/);
assert.match(transitions, /const VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE = "horizontal-swipe"/);
assert.match(transitions, /function createViewerNavigationCommand\(/);
assert.match(transitions, /function assertViewerNavigationCommand\(/);
assert.match(transitions, /function beginViewerPageTransitionCommand\(/);
assert.match(pageController, /const command = options\.navigationCommand \|\| createViewerNavigationCommand\(/);
assert.match(pageController, /beginViewerPageTransitionCommand\(targetPage, command, relativePosition\)/);
assert.match(viewer, /moveLightbox\(-1, \{ navigationSource: VIEWER_NAVIGATION_SOURCE_BUTTON \}\)/);
assert.match(viewer, /moveLightbox\(1, \{ navigationSource: VIEWER_NAVIGATION_SOURCE_KEYBOARD \}\)/);
assert.match(viewer, /navigationSource: VIEWER_NAVIGATION_SOURCE_HOME_END/);
assert.match(input, /VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE/);
assert.match(input, /VIEWER_NAVIGATION_SOURCE_VERTICAL_SWIPE/);
assert.match(input, /VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN/);
assert.match(input, /VIEWER_NAVIGATION_SOURCE_MOMENTUM/);
assert.match(navigation, /VIEWER_NAVIGATION_SOURCE_WHEEL/);
assert.match(navigation, /VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING/);
assert.doesNotMatch(geometry, /function queueSingleImage/, "geometry may apply pending state but may not invent navigation policy");

const pendingViewportAssignment = /viewerViewportState\.(singleImageFitOriginPending|singleImagePendingRelativePosition|singleImagePendingPageTurnOrigin)\s*=(?!=)/g;
for (const [name, source] of sources) {
  if (!pendingViewportAssignment.test(source)) continue;
  assert.ok(name === "17-viewer-state-transitions.js" || name === "54-viewer-geometry.js",
    `${name} mutates pending viewport transitions outside the command/apply owners`);
  pendingViewportAssignment.lastIndex = 0;
}

const resolutionLifecycleAssignment = /viewerImageState\.(singleImageResolution(?:LoadToken|Stop|TargetSrc|TargetTier|Ready|Visible|CommitPending|RetainedForSwap))\s*=(?!=)/g;
for (const [name, source] of sources) {
  if (!resolutionLifecycleAssignment.test(source)) continue;
  assert.equal(name, "17-viewer-state-transitions.js", `${name} mutates resolution lifecycle outside its command owner`);
  resolutionLifecycleAssignment.lastIndex = 0;
}

console.log("viewer_navigation_source_contract.test.js: PASS");
