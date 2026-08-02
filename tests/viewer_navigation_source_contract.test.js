"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { findCalls, inventoryProjectFiles } = require("./helpers/frontend_ast.js");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "src", "js");
const sourceNames = fs.readdirSync(sourceDir).filter((name) => name.endsWith(".js"));
const projectInventories = inventoryProjectFiles(
  root,
  sourceNames.map((name) => path.join(sourceDir, name)),
);
const sources = new Map(sourceNames.map((name) => [name, projectInventories[`src/js/${name}`]]));

const allIdentifiers = new Set([...sources.values()].flatMap((inventory) => inventory.identifiers));
for (const legacyName of [
  "resetViewOnPageTurn", "pageTurnDirection", "pageTurnAxis",
  "queueSingleImageRelativePosition", "queueSingleImagePageTurnOrigin",
  "keepZoom", "resetZoom", "resetPosition", "viewerState",
]) {
  assert.equal(allIdentifiers.has(legacyName), false, `${legacyName} must not bypass the command boundary`);
}

const transitions = sources.get("17-viewer-state-transitions.js");
assert.equal(transitions.literalDeclarations.VIEWER_NAVIGATION_SOURCE_WHEEL, "wheel");
assert.equal(transitions.literalDeclarations.VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE, "horizontal-swipe");
for (const functionName of [
  "createViewerNavigationCommand",
  "assertViewerNavigationCommand",
  "beginViewerPageTransitionCommand",
]) {
  assert.equal(transitions.functionDeclarations.includes(functionName), true);
}

const pageController = sources.get("59-viewer-page-controller.js");
assert.equal(pageController.identifiers.includes("navigationCommand"), true);
assert.equal(findCalls(pageController, "createViewerNavigationCommand").length > 0, true);
assert.equal(findCalls(pageController, "beginViewerPageTransitionCommand").length > 0, true);

const viewer = sources.get("60-viewer.js");
assert.equal(findCalls(viewer, "moveLightbox").length >= 2, true);
assert.equal(viewer.identifiers.includes("VIEWER_NAVIGATION_SOURCE_BUTTON"), true);
assert.equal(viewer.identifiers.includes("VIEWER_NAVIGATION_SOURCE_KEYBOARD"), true);
assert.equal(viewer.identifiers.includes("VIEWER_NAVIGATION_SOURCE_HOME_END"), true);

for (const [filename, sourceConstants] of [
  ["70-viewer-input.js", [
    "VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE",
    "VIEWER_NAVIGATION_SOURCE_VERTICAL_SWIPE",
    "VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN",
    "VIEWER_NAVIGATION_SOURCE_MOMENTUM",
  ]],
  ["58-viewer-navigation.js", [
    "VIEWER_NAVIGATION_SOURCE_WHEEL",
    "VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING",
  ]],
]) {
  const identifiers = new Set(sources.get(filename).identifiers);
  for (const sourceConstant of sourceConstants) {
    assert.equal(identifiers.has(sourceConstant), true, `${filename} must use ${sourceConstant}`);
  }
}
assert.equal(
  sources.get("54-viewer-geometry.js").functionDeclarations.some((name) => name.startsWith("queueSingleImage")),
  false,
  "geometry may apply pending state but may not invent navigation policy",
);

const pendingViewportTargets = new Set([
  "viewerViewportState.singleImageFitOriginPending",
  "viewerViewportState.singleImagePendingRelativePosition",
  "viewerViewportState.singleImagePendingPageTurnOrigin",
]);
for (const [name, inventory] of sources) {
  const writesPendingViewport = inventory.assignmentTargets.some((target) => pendingViewportTargets.has(target));
  if (!writesPendingViewport) continue;
  assert.ok(
    name === "17-viewer-state-transitions.js" || name === "54-viewer-geometry.js",
    `${name} mutates pending viewport transitions outside the command/apply owners`,
  );
}

const resolutionLifecycleTargets = new Set([
  "viewerImageState.singleImageResolutionLoadToken",
  "viewerImageState.singleImageResolutionStop",
  "viewerImageState.singleImageResolutionTargetSrc",
  "viewerImageState.singleImageResolutionTargetTier",
  "viewerImageState.singleImageResolutionReady",
  "viewerImageState.singleImageResolutionVisible",
  "viewerImageState.singleImageResolutionCommitPending",
  "viewerImageState.singleImageResolutionRetainedForSwap",
]);
for (const [name, inventory] of sources) {
  const writesResolutionLifecycle = inventory.assignmentTargets.some((target) => resolutionLifecycleTargets.has(target));
  if (!writesResolutionLifecycle) continue;
  assert.equal(name, "17-viewer-state-transitions.js", `${name} mutates resolution lifecycle outside its command owner`);
}

console.log("viewer_navigation_source_contract.test.js: PASS");
