"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { importFrontendTestModule } = require("./frontend_test_module");

const root = path.join(__dirname, "..");
const shellSource = fs.readFileSync(path.join(root, "src/js/56-viewer-shell.js"), "utf8");
assert.match(shellSource, /const automatic = viewerUsesAutomaticFitMode\(\);[\s\S]*?fitAutoBtn/);
assert.match(shellSource, /setTooltipText\(viewerElements\.fitAutoBtn, "התאמת תצוגה אוטומטי"/);
assert.match(shellSource, /const isActive = !automatic && fitMode === VIEWER_FIT_HEIGHT/);
assert.match(shellSource, /const isActive = !automatic && fitMode === VIEWER_FIT_WIDTH/);

const viewerState = {
  imageFitMode: "height",
  imageFitModeSource: "auto",
  zoom: 1,
  pointers: new Map()
};
const viewerElements = { stageCanvas: { clientWidth: 1440, clientHeight: 900 } };
Object.assign(globalThis, {
  VIEWER_FIT_HEIGHT: "height",
  VIEWER_FIT_WIDTH: "width",
  VIEWER_FIT_SOURCE_AUTO: "auto",
  VIEWER_FIT_SOURCE_MANUAL: "manual",
  AUTO_VIEWER_ZOOM: 1,
  viewerState,
  viewerElements,
  window: {
    innerWidth: 1440,
    innerHeight: 900,
    visualViewport: { width: 1440, height: 900 }
  },
  document: { documentElement: { clientWidth: 1440, clientHeight: 900 } },
  clearViewerPageWheelGesture() {},
  resetImagePosition() {},
  syncViewerFitModeUi() {},
  syncViewerAutoZoomButtonUi() {},
  syncViewerMobileMoreMenuState() {},
  setPressedState() {},
  setTooltipText() {},
  applyZoom() {},
  refreshSingleViewerImageResolution() {},
  showTopUiTemporarily() {}
});
const geometry = importFrontendTestModule("src/js/54-viewer-geometry.js", "viewer-geometry");
Object.assign(globalThis, {
  normalizeViewerFitMode: geometry.normalizeViewerFitMode,
  normalizeViewerFitModeSource: geometry.normalizeViewerFitModeSource,
  getAutomaticViewerFitMode: geometry.getAutomaticViewerFitMode,
  viewerUsesAutomaticFitMode: geometry.viewerUsesAutomaticFitMode
});
const fitController = importFrontendTestModule("src/js/57-viewer-fit-controller.js", "viewer-fit-controller");

assert.equal(geometry.getAutomaticViewerFitMode(), "height");
viewerElements.stageCanvas.clientWidth = 390;
viewerElements.stageCanvas.clientHeight = 844;
assert.equal(geometry.getAutomaticViewerFitMode(), "width");
viewerElements.stageCanvas.clientWidth = 0;
viewerElements.stageCanvas.clientHeight = 0;
window.visualViewport.width = 844;
window.visualViewport.height = 390;
assert.equal(geometry.getAutomaticViewerFitMode(), "height");

viewerElements.stageCanvas.clientWidth = 390;
viewerElements.stageCanvas.clientHeight = 844;
viewerState.imageFitMode = "height";
viewerState.imageFitModeSource = "auto";
assert.equal(fitController.syncAutomaticViewerFitMode({ showUi: false }), true);
assert.equal(viewerState.imageFitMode, "width");
assert.equal(viewerState.imageFitModeSource, "auto");

fitController.setViewerFitMode("width", { showUi: false });
assert.equal(viewerState.imageFitModeSource, "manual");
viewerElements.stageCanvas.clientWidth = 844;
viewerElements.stageCanvas.clientHeight = 390;
assert.equal(fitController.syncAutomaticViewerFitMode({ showUi: false }), false);
assert.equal(viewerState.imageFitMode, "width");

fitController.setViewerAutomaticFitMode({ showUi: false });
assert.equal(viewerState.imageFitModeSource, "auto");
assert.equal(viewerState.imageFitMode, "height");
viewerElements.stageCanvas.clientWidth = 390;
viewerElements.stageCanvas.clientHeight = 844;
assert.equal(fitController.syncAutomaticViewerFitMode({ showUi: false }), true);
assert.equal(viewerState.imageFitMode, "width");

fitController.setViewerFitMode("width", { showUi: false });
assert.equal(viewerState.imageFitModeSource, "manual");
fitController.setViewerAutomaticFitMode({ showUi: false });
assert.equal(viewerState.imageFitModeSource, "auto");
assert.equal(viewerState.imageFitMode, "width");

console.log("viewer_fit_mode_logic.test.js: PASS");
