"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/js/52-viewer-session.js"), "utf8");
const warnings = [];
const document = {
  body: { dataset: {} },
  documentElement: { dataset: {} },
  fullscreenElement: null,
  fullscreenEnabled: true,
  addEventListener() {}
};
const context = {
  VIEWER_PHASE_CLOSED: "closed",
  VIEWER_PHASE_OPENING: "opening",
  VIEWER_PHASE_OPEN: "open",
  VIEWER_PHASE_CLOSING: "closing",
  VIEWER_FULLSCREEN_INACTIVE: "inactive",
  VIEWER_FULLSCREEN_ENTERING: "entering",
  VIEWER_FULLSCREEN_ACTIVE: "active",
  VIEWER_FULLSCREEN_EXITING: "exiting",
  state: {
    viewerPhase: "closed",
    viewerPhaseReason: "initial",
    viewerFullscreenPhase: "inactive",
    viewerFullscreenReason: "initial"
  },
  document,
  els: { fullscreenToggle: null },
  console: { warn: (...args) => warnings.push(args) },
  setTooltipText() {},
  refreshLightboxLayoutForTopUiChange() {},
  showTopUiTemporarily() {},
  closeLightboxSearchScopeMenu() {},
  closeLightboxCatalogMenu() {},
  navigateTo() {},
  homeDocumentUrl: () => "/"
};

vm.runInNewContext(`${source}\nglobalThis.sessionApi = {\n  transitionViewerPhase,\n  isViewerSessionOpen,\n  isViewerSessionVisible,\n  transitionViewerFullscreenPhase,\n  reconcileViewerFullscreenPhase,\n  viewerUsesInDocumentFullscreenNavigation\n};`, context);

const api = context.sessionApi;
assert.equal(api.isViewerSessionOpen(), false);
assert.equal(api.isViewerSessionVisible(), false);
assert.equal(api.transitionViewerPhase("opening", "test-open"), true);
assert.equal(api.isViewerSessionOpen(), true);
assert.equal(document.body.dataset.viewerPhase, "opening");
assert.equal(api.transitionViewerPhase("open", "ready"), true);
assert.equal(context.state.viewerPhaseReason, "ready");
assert.equal(api.transitionViewerPhase("closed", "invalid-skip"), false, "open must close through the closing phase");
assert.equal(context.state.viewerPhase, "open", "invalid transitions must not mutate state");
assert.equal(warnings.length, 1);
assert.equal(api.transitionViewerPhase("closing", "close"), true);
assert.equal(api.isViewerSessionOpen(), false);
assert.equal(api.isViewerSessionVisible(), true);
assert.equal(api.transitionViewerPhase("closed", "hidden"), true);
assert.equal(api.isViewerSessionVisible(), false);

assert.equal(api.viewerUsesInDocumentFullscreenNavigation(), false);
assert.equal(api.transitionViewerFullscreenPhase("entering", "request"), true);
document.fullscreenElement = document.documentElement;
api.reconcileViewerFullscreenPhase("browser-entered");
assert.equal(context.state.viewerFullscreenPhase, "active");
assert.equal(document.documentElement.dataset.viewerFullscreenPhase, "active");
assert.equal(api.viewerUsesInDocumentFullscreenNavigation(), true);
assert.equal(api.transitionViewerFullscreenPhase("exiting", "exit"), true);
document.fullscreenElement = null;
api.reconcileViewerFullscreenPhase("browser-exited");
assert.equal(context.state.viewerFullscreenPhase, "inactive");
assert.equal(api.viewerUsesInDocumentFullscreenNavigation(), false);

console.log("viewer_session_state_logic.test.js: PASS");
