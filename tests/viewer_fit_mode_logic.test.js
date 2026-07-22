"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const geometrySource = fs.readFileSync(path.join(root, "src/js/54-viewer-geometry.js"), "utf8");
const shellSource = fs.readFileSync(path.join(root, "src/js/56-viewer-shell.js"), "utf8");

assert.match(shellSource, /const automatic = viewerUsesAutomaticFitMode\(\);[\s\S]*?fitAutoBtn/);
assert.match(shellSource, /setTooltipText\(els\.fitAutoBtn, "התאמת תצוגה אוטומטי"/);
assert.match(shellSource, /const isActive = !automatic && fitMode === VIEWER_FIT_HEIGHT/);
assert.match(shellSource, /const isActive = !automatic && fitMode === VIEWER_FIT_WIDTH/);

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

const fitPolicySource = sourceBetween(
  geometrySource,
  "function normalizeViewerFitMode(fitMode)",
  "function getActiveSingleImageNaturalSize()"
);
const fitSetterSource = sourceBetween(
  shellSource,
  "function setViewerFitMode(fitMode, options = {})",
  "function syncLightboxModeUi()"
);

const context = {
  VIEWER_FIT_HEIGHT: "height",
  VIEWER_FIT_WIDTH: "width",
  VIEWER_FIT_SOURCE_AUTO: "auto",
  VIEWER_FIT_SOURCE_MANUAL: "manual",
  AUTO_VIEWER_ZOOM: 1,
  state: {
    imageFitMode: "height",
    imageFitModeSource: "auto",
    zoom: 1,
    pointers: new Map()
  },
  els: {
    stageCanvas: { clientWidth: 1440, clientHeight: 900 }
  },
  window: {
    innerWidth: 1440,
    innerHeight: 900,
    visualViewport: { width: 1440, height: 900 }
  },
  document: {
    documentElement: { clientWidth: 1440, clientHeight: 900 }
  },
  clearViewerPageWheelGesture() {},
  resetImagePosition() {},
  syncViewerFitModeUi() {},
  applyZoom() {},
  refreshSingleViewerImageResolution() {},
  showTopUiTemporarily() {}
};

vm.runInNewContext(`${fitPolicySource}\n${fitSetterSource}\nglobalThis.fitApi = {
  getAutomaticViewerFitMode,
  setViewerFitMode,
  setViewerAutomaticFitMode,
  syncAutomaticViewerFitMode,
  viewerUsesAutomaticFitMode
};`, context);

const api = context.fitApi;
assert.equal(api.getAutomaticViewerFitMode(), "height", "landscape viewports should default to fit-height");

context.els.stageCanvas.clientWidth = 390;
context.els.stageCanvas.clientHeight = 844;
assert.equal(api.getAutomaticViewerFitMode(), "width", "portrait viewports should default to fit-width");

context.els.stageCanvas.clientWidth = 0;
context.els.stageCanvas.clientHeight = 0;
context.window.visualViewport.width = 844;
context.window.visualViewport.height = 390;
assert.equal(api.getAutomaticViewerFitMode(), "height", "hidden viewer startup should fall back to the visual viewport");

context.els.stageCanvas.clientWidth = 390;
context.els.stageCanvas.clientHeight = 844;
context.state.imageFitMode = "height";
context.state.imageFitModeSource = "auto";
assert.equal(api.syncAutomaticViewerFitMode({ showUi: false }), true);
assert.equal(context.state.imageFitMode, "width");
assert.equal(context.state.imageFitModeSource, "auto");

// Clicking the already-selected option is still an explicit user decision and
// must therefore freeze automatic orientation changes for this viewer session.
api.setViewerFitMode("width", { showUi: false });
assert.equal(context.state.imageFitModeSource, "manual");
context.els.stageCanvas.clientWidth = 844;
context.els.stageCanvas.clientHeight = 390;
assert.equal(api.syncAutomaticViewerFitMode({ showUi: false }), false);
assert.equal(context.state.imageFitMode, "width", "manual fit must survive later orientation changes");

// Returning to the dedicated automatic option transfers ownership back to the
// viewport policy immediately, then future orientation changes follow it again.
api.setViewerAutomaticFitMode({ showUi: false });
assert.equal(context.state.imageFitModeSource, "auto");
assert.equal(context.state.imageFitMode, "height", "automatic mode should immediately match the current landscape viewport");
context.els.stageCanvas.clientWidth = 390;
context.els.stageCanvas.clientHeight = 844;
assert.equal(api.syncAutomaticViewerFitMode({ showUi: false }), true);
assert.equal(context.state.imageFitMode, "width", "automatic mode should resume following portrait changes");

// Re-selecting automatic while the effective geometry already matches must
// still restore automatic ownership rather than leaving a hidden manual lock.
api.setViewerFitMode("width", { showUi: false });
assert.equal(context.state.imageFitModeSource, "manual");
api.setViewerAutomaticFitMode({ showUi: false });
assert.equal(context.state.imageFitModeSource, "auto");
assert.equal(context.state.imageFitMode, "width");

console.log("viewer_fit_mode_logic.test.js: PASS");
