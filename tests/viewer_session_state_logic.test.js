"use strict";

const assert = require("node:assert/strict");
const { importFrontendTestModule } = require("./frontend_test_module");

const warnings = [];
const documentValue = {
  body: { dataset: {} },
  documentElement: { dataset: {} },
  fullscreenElement: null,
  fullscreenEnabled: true,
  addEventListener() {}
};
const viewerState = {
  viewerPhase: "closed",
  viewerPhaseReason: "initial",
  viewerFullscreenPhase: "inactive",
  viewerFullscreenReason: "initial"
};
Object.assign(globalThis, {
  VIEWER_PHASE_CLOSED: "closed",
  VIEWER_PHASE_OPENING: "opening",
  VIEWER_PHASE_OPEN: "open",
  VIEWER_PHASE_CLOSING: "closing",
  VIEWER_FULLSCREEN_INACTIVE: "inactive",
  VIEWER_FULLSCREEN_ENTERING: "entering",
  VIEWER_FULLSCREEN_ACTIVE: "active",
  VIEWER_FULLSCREEN_EXITING: "exiting",
  viewerState,
  document: documentValue,
  viewerElements: { fullscreenToggle: null },
  setTooltipText() {},
  refreshLightboxLayoutForTopUiChange() {},
  showTopUiTemporarily() {},
  closeLightboxSearchScopeMenu() {},
  closeLightboxCatalogMenu() {},
  navigateTo() {},
  homeDocumentUrl: () => "/"
});
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(args);
const api = importFrontendTestModule("src/js/52-viewer-session.js", "viewer-session");

assert.equal(api.isViewerSessionOpen(), false);
assert.equal(api.isViewerSessionVisible(), false);
assert.equal(api.transitionViewerPhase("opening", "test-open"), true);
assert.equal(api.isViewerSessionOpen(), true);
assert.equal(documentValue.body.dataset.viewerPhase, "opening");
assert.equal(api.transitionViewerPhase("open", "ready"), true);
assert.equal(viewerState.viewerPhaseReason, "ready");
assert.equal(api.transitionViewerPhase("closed", "invalid-skip"), false, "open must close through the closing phase");
assert.equal(viewerState.viewerPhase, "open", "invalid transitions must not mutate state");
assert.equal(warnings.length, 1);
assert.equal(api.transitionViewerPhase("closing", "close"), true);
assert.equal(api.isViewerSessionOpen(), false);
assert.equal(api.isViewerSessionVisible(), true);
assert.equal(api.transitionViewerPhase("closed", "hidden"), true);
assert.equal(api.isViewerSessionVisible(), false);

assert.equal(api.viewerUsesInDocumentFullscreenNavigation(), false);
assert.equal(api.transitionViewerFullscreenPhase("entering", "request"), true);
documentValue.fullscreenElement = documentValue.documentElement;
api.reconcileViewerFullscreenPhase("browser-entered");
assert.equal(viewerState.viewerFullscreenPhase, "active");
assert.equal(documentValue.documentElement.dataset.viewerFullscreenPhase, "active");
assert.equal(api.viewerUsesInDocumentFullscreenNavigation(), true);
assert.equal(api.transitionViewerFullscreenPhase("exiting", "exit"), true);
documentValue.fullscreenElement = null;
api.reconcileViewerFullscreenPhase("browser-exited");
assert.equal(viewerState.viewerFullscreenPhase, "inactive");
assert.equal(api.viewerUsesInDocumentFullscreenNavigation(), false);
console.warn = originalWarn;

console.log("viewer_session_state_logic.test.js: PASS");
