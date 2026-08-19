"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { findCalls, inventoryProjectFiles } = require("./helpers/frontend_ast.js");

const root = path.join(__dirname, "..");
const featureFiles = fs.readdirSync(path.join(root, "src/js"))
  .filter((name) => name.endsWith(".js"))
  .map((name) => `src/js/${name}`);
const inventories = inventoryProjectFiles(root, featureFiles);
const state = inventories["src/js/16-viewer-state.js"];
const navigation = inventories["src/js/00-navigation.js"];
const sessionState = inventories["src/js/51-viewer-session-state.js"];
const session = inventories["src/js/52-viewer-session.js"];
const lifecycle = inventories["src/js/60-viewer.js"];
const functions = (inventory) => new Set(inventory.functionDeclarations);

assert.deepEqual(
  ["VIEWER_PHASE_CLOSED", "VIEWER_PHASE_OPENING", "VIEWER_PHASE_OPEN", "VIEWER_PHASE_CLOSING"]
    .map((name) => state.literalDeclarations[name]),
  ["closed", "opening", "open", "closing"],
);
assert.deepEqual(
  ["VIEWER_FULLSCREEN_INACTIVE", "VIEWER_FULLSCREEN_ENTERING", "VIEWER_FULLSCREEN_ACTIVE", "VIEWER_FULLSCREEN_EXITING"]
    .map((name) => state.literalDeclarations[name]),
  ["inactive", "entering", "active", "exiting"],
);

assert.ok(state.objectDeclarations.viewerSessionState.includes("viewerPhase"));
assert.ok(state.objectDeclarations.viewerSessionState.includes("viewerFullscreenPhase"));
assert.equal(state.objectDeclarations.viewerSessionState.includes("lightboxOpen"), false);
assert.ok(sessionState.objectDeclarations.VIEWER_PHASE_TRANSITIONS, "viewer phase transition table must be declared");
assert.ok(sessionState.objectDeclarations.VIEWER_FULLSCREEN_TRANSITIONS, "fullscreen transition table must be declared");
for (const name of ["transitionViewerPhase", "isViewerSessionOpen", "transitionViewerFullscreenPhase"]) {
  assert.equal(functions(sessionState).has(name), true, `session-state owner must define ${name}`);
}
for (const name of ["reconcileViewerFullscreenPhase", "viewerUsesInDocumentFullscreenNavigation", "handleBrowserFullscreenChange"]) {
  assert.equal(functions(session).has(name), true, `viewer session owner must define ${name}`);
}

for (const [reason, owner] of [
  ["open-lightbox", "openLightbox"],
  ["lightbox-ready", "openLightbox"],
  ["hide-lightbox", "hideLightboxUi"],
  ["lightbox-hidden", "hideLightboxUi"],
]) {
  assert.equal(
    findCalls(lifecycle, "transitionViewerPhase")
      .some((call) => call.enclosingFunction === owner && call.arguments[1] === reason),
    true,
    `${owner} must drive the ${reason} viewer transition`,
  );
}
assert.equal(
  findCalls(navigation, 'getFeatureInterface("viewer").usesInDocumentFullscreenNavigation')
    .some((call) => call.enclosingFunction === "canNavigateWithinCurrentDocument"),
  true,
  "navigation must consult the Viewer feature before in-document fullscreen routing",
);

const nonStateOwners = featureFiles.filter(
  (relative) => !["src/js/16-viewer-state.js", "src/js/51-viewer-session-state.js"].includes(relative),
);
for (const relative of nonStateOwners) {
  const inventory = inventories[relative];
  assert.equal(
    inventory.propertyAccesses.some((access) => access.path === "state.lightboxOpen"),
    false,
    `${relative}: legacy state.lightboxOpen access must stay removed`,
  );
  assert.equal(
    inventory.assignmentTargets.some((target) => target === "viewerSessionState.viewerPhase" || target === "viewerSessionState.viewerFullscreenPhase"),
    false,
    `${relative}: viewer phases may only be written by the transition owner`,
  );
}
assert.ok(sessionState.assignmentTargets.includes("viewerSessionState.viewerPhase"));
assert.ok(sessionState.assignmentTargets.includes("viewerSessionState.viewerFullscreenPhase"));

console.log("viewer_session_state_contract.test.js: PASS");
