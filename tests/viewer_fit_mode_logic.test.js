"use strict";

const assert = require("node:assert/strict");
const { importFrontendTestModule } = require("./frontend_test_module");

const viewerState = {
  imageFitMode: "height",
  imageFitModeSource: "auto",
  zoom: 1,
  pointers: new Map()
};

function fakeClassList() {
  const values = new Set();
  return {
    toggle(name, enabled) { if (enabled) values.add(name); else values.delete(name); },
    contains(name) { return values.has(name); }
  };
}

function fakeButton() {
  const attributes = new Map();
  return {
    attributes,
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; }
  };
}

let activePageSize = { width: 1200, height: 1800 };
const activeCatalogValue = { id: "fit-test" };
const viewerElements = {
  stageCanvas: { clientWidth: 1440, clientHeight: 900 },
  lightbox: { classList: fakeClassList() },
  lightboxImage: { naturalWidth: 0, naturalHeight: 0 },
  fitAutoBtn: fakeButton(),
  fitHeightBtn: fakeButton(),
  fitWidthBtn: fakeButton()
};
const tooltips = new Map();
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
  activeCatalog: () => activeCatalogValue,
  activePage: () => 1,
  pageSize: () => activePageSize,
  clearViewerPageWheelGesture() {},
  resetImagePosition() {},
  syncViewerAutoZoomButtonUi() {},
  syncViewerMobileMoreMenuState() {},
  setPressedState() {},
  setTooltipText(element, text) { tooltips.set(element, text); },
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
const shell = importFrontendTestModule("src/js/56-viewer-shell.js", "viewer-shell");
globalThis.syncViewerFitModeUi = shell.syncViewerFitModeUi;

assert.equal(geometry.getAutomaticViewerFitMode(), "height", "portrait page should prefer height when its width remains visible");
activePageSize = { width: 2400, height: 1000 };
assert.equal(geometry.getAutomaticViewerFitMode(), "width", "wide page must switch to width even in a landscape viewport");
activePageSize = { width: 1200, height: 1800 };
viewerElements.stageCanvas.clientWidth = 390;
viewerElements.stageCanvas.clientHeight = 844;
assert.equal(geometry.getAutomaticViewerFitMode(), "width");
viewerElements.stageCanvas.clientWidth = 0;
viewerElements.stageCanvas.clientHeight = 0;
window.visualViewport.width = 844;
window.visualViewport.height = 390;
assert.equal(geometry.getAutomaticViewerFitMode(), "height");
activePageSize = null;
assert.equal(geometry.getAutomaticViewerFitMode(), "height", "orientation fallback remains available before image dimensions are known");
activePageSize = { width: 1200, height: 1800 };

viewerElements.stageCanvas.clientWidth = 390;
viewerElements.stageCanvas.clientHeight = 844;
viewerState.imageFitMode = "height";
viewerState.imageFitModeSource = "auto";
assert.equal(fitController.syncAutomaticViewerFitMode({ showUi: false }), true);
assert.equal(viewerState.imageFitMode, "width");
assert.equal(viewerState.imageFitModeSource, "auto");

shell.syncViewerFitModeUi();
assert.equal(viewerElements.fitAutoBtn.getAttribute("aria-pressed"), "true");
assert.equal(viewerElements.fitHeightBtn.getAttribute("aria-pressed"), "false");
assert.equal(viewerElements.fitWidthBtn.getAttribute("aria-pressed"), "false");
assert.equal(viewerElements.fitAutoBtn.getAttribute("aria-label"), "התאמת תצוגה אוטומטי");
assert.equal(tooltips.get(viewerElements.fitAutoBtn), "התאמת תצוגה אוטומטי");
assert.equal(viewerElements.lightbox.classList.contains("fit-width"), true);

fitController.setViewerFitMode("width", { showUi: false });
assert.equal(viewerState.imageFitModeSource, "manual");
shell.syncViewerFitModeUi();
assert.equal(viewerElements.fitAutoBtn.getAttribute("aria-pressed"), "false");
assert.equal(viewerElements.fitWidthBtn.getAttribute("aria-pressed"), "true");
assert.equal(viewerElements.fitHeightBtn.getAttribute("aria-pressed"), "false");
assert.equal(tooltips.get(viewerElements.fitHeightBtn), "התאמה לגובה");
assert.equal(tooltips.get(viewerElements.fitWidthBtn), "התאמה לרוחב");

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

console.log("viewer_fit_mode_logic.test.js: PASS");
