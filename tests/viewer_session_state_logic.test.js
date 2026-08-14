"use strict";

const assert = require("node:assert/strict");
const { importFrontendModule } = require("./frontend_test_module");

const warnings = [];
let fullscreenLayoutRefreshes = 0;
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
  viewerSessionState: viewerState,
  viewerViewportState: viewerState,
  viewerGestureState: viewerState,
  viewerChromeState: viewerState,
  viewerImageState: viewerState,
  viewerNavigationState: viewerState,
  viewerOnboardingState: viewerState,
  document: documentValue,
  viewerElements: { fullscreenToggle: null },
  setTooltipText() {},
  getFeatureInterface: (name) => name === "viewer"
    ? { handleResize: () => { fullscreenLayoutRefreshes += 1; } }
    : null,
  showTopUiTemporarily() {},
  closeLightboxSearchScopeMenu() {},
  closeLightboxCatalogMenu() {},
  navigateTo() {},
  homeDocumentUrl: () => "/"
});
const originalWarn = console.warn;
console.warn = (...args) => warnings.push(args);

const stateApi = importFrontendModule("src/js/51-viewer-session-state.js");
Object.assign(globalThis, stateApi);

assert.equal(stateApi.isViewerSessionOpen(), false);
assert.equal(stateApi.isViewerSessionVisible(), false);
assert.equal(stateApi.transitionViewerPhase("opening", "test-open"), true);
assert.equal(stateApi.isViewerSessionOpen(), true);
assert.equal(documentValue.body.dataset.viewerPhase, "opening");
assert.equal(stateApi.transitionViewerPhase("open", "ready"), true);
assert.equal(viewerState.viewerPhaseReason, "ready");
assert.equal(stateApi.transitionViewerPhase("closed", "invalid-skip"), false, "open must close through the closing phase");
assert.equal(viewerState.viewerPhase, "open", "invalid transitions must not mutate state");
assert.equal(warnings.length, 1);
assert.equal(stateApi.transitionViewerPhase("closing", "close"), true);
assert.equal(stateApi.isViewerSessionOpen(), false);
assert.equal(stateApi.isViewerSessionVisible(), true);
assert.equal(stateApi.transitionViewerPhase("closed", "hidden"), true);
assert.equal(stateApi.isViewerSessionVisible(), false);

const browserApi = importFrontendModule("src/js/52-viewer-session.js");
assert.equal(browserApi.viewerUsesInDocumentFullscreenNavigation(), false);
assert.equal(stateApi.transitionViewerPhase("opening", "fullscreen-open"), true);
assert.equal(stateApi.transitionViewerPhase("open", "fullscreen-ready"), true);
assert.equal(stateApi.transitionViewerFullscreenPhase("entering", "request"), true);
documentValue.fullscreenElement = documentValue.documentElement;
browserApi.handleBrowserFullscreenChange();
assert.equal(viewerState.viewerFullscreenPhase, "active");
assert.equal(fullscreenLayoutRefreshes, 1, "fullscreen changes must flow through the canonical viewer resize path");
assert.equal(documentValue.documentElement.dataset.viewerFullscreenPhase, "active");
assert.equal(browserApi.viewerUsesInDocumentFullscreenNavigation(), true);
assert.equal(stateApi.transitionViewerFullscreenPhase("exiting", "exit"), true);
documentValue.fullscreenElement = null;
browserApi.reconcileViewerFullscreenPhase("browser-exited");
assert.equal(viewerState.viewerFullscreenPhase, "inactive");
assert.equal(browserApi.viewerUsesInDocumentFullscreenNavigation(), false);
console.warn = originalWarn;

console.log("viewer_session_state_logic.test.js: PASS");
