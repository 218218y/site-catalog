"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const state = fs.readFileSync(path.join(root, "src/js/16-viewer-state.js"), "utf8");
const navigation = fs.readFileSync(path.join(root, "src/js/00-navigation.js"), "utf8");
const sessionState = fs.readFileSync(path.join(root, "src/js/51-viewer-session-state.js"), "utf8");
const session = fs.readFileSync(path.join(root, "src/js/52-viewer-session.js"), "utf8");
const lifecycle = fs.readFileSync(path.join(root, "src/js/60-viewer.js"), "utf8");
const allFeatureSources = fs.readdirSync(path.join(root, "src/js"))
  .filter((name) => name.endsWith(".js") && !["16-viewer-state.js", "51-viewer-session-state.js"].includes(name))
  .map((name) => fs.readFileSync(path.join(root, "src/js", name), "utf8"))
  .join("\n");

for (const phase of ["closed", "opening", "open", "closing"]) {
  assert.match(state, new RegExp(`VIEWER_PHASE_[A-Z]+ = "${phase}"`));
}
for (const phase of ["inactive", "entering", "active", "exiting"]) {
  assert.match(state, new RegExp(`VIEWER_FULLSCREEN_[A-Z]+ = "${phase}"`));
}

assert.match(state, /viewerPhase: VIEWER_PHASE_CLOSED/);
assert.match(state, /viewerFullscreenPhase: VIEWER_FULLSCREEN_INACTIVE/);
assert.doesNotMatch(state, /lightboxOpen:/);
assert.match(sessionState, /const VIEWER_PHASE_TRANSITIONS = Object\.freeze/);
assert.match(sessionState, /const VIEWER_FULLSCREEN_TRANSITIONS = Object\.freeze/);
assert.match(sessionState, /function transitionViewerPhase\(/);
assert.match(sessionState, /function isViewerSessionOpen\(/);
assert.match(sessionState, /function transitionViewerFullscreenPhase\(/);
assert.match(session, /function reconcileViewerFullscreenPhase\(/);
assert.match(session, /function viewerUsesInDocumentFullscreenNavigation\(/);
assert.match(session, /function handleBrowserFullscreenChange\(/);
assert.match(lifecycle, /transitionViewerPhase\(VIEWER_PHASE_OPENING, "open-lightbox"\)/);
assert.match(lifecycle, /transitionViewerPhase\(VIEWER_PHASE_OPEN, "lightbox-ready"\)/);
assert.match(lifecycle, /transitionViewerPhase\(VIEWER_PHASE_CLOSING, "hide-lightbox"\)/);
assert.match(lifecycle, /transitionViewerPhase\(VIEWER_PHASE_CLOSED, "lightbox-hidden"\)/);
assert.match(navigation, /getFeatureInterface\("viewer"\)\?\.usesInDocumentFullscreenNavigation\?\.\(\)/);
assert.doesNotMatch(allFeatureSources, /state\.lightboxOpen/);
assert.doesNotMatch(allFeatureSources, /viewerPhase\s*=/);
assert.doesNotMatch(allFeatureSources, /viewerFullscreenPhase\s*=/);
assert.match(sessionState, /viewerState\.viewerPhase = nextPhase/);
assert.match(sessionState, /viewerState\.viewerFullscreenPhase = nextPhase/);

console.log("viewer_session_state_contract.test.js: PASS");
