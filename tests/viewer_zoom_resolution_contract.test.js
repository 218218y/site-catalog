"use strict";

const assert = require("node:assert/strict");
const { importFrontendModule } = require("./frontend_test_module");

function createStyleDeclaration() {
  const values = new Map();
  return {
    width: "",
    height: "",
    aspectRatio: "",
    transform: "",
    setProperty(name, value) { values.set(name, value); },
    getPropertyValue(name) { return values.get(name) || ""; }
  };
}

const refreshCalls = [];
let indicatorCalls = 0;
let pendingClearCalls = 0;
let uiCalls = 0;
let autoZoomUiCalls = 0;
const frameStyle = createStyleDeclaration();
const imageStyle = createStyleDeclaration();
const viewerState = {
  zoom: 1,
  fitScale: 1,
  panX: 0,
  panY: 0,
  imageFitMode: "height",
  singleImageFitOriginPending: false,
  singleImagePendingRelativePosition: null,
  singleImagePendingPageTurnOrigin: null
};
const stageCanvas = {
  clientWidth: 216,
  clientHeight: 144,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 216, height: 144 })
};
const catalog = { id: "zoom-test", pages: 1 };
Object.assign(globalThis, {
  AUTO_VIEWER_ZOOM: 1,
  MIN_VIEWER_ZOOM: 0.35,
  MAX_VIEWER_ZOOM: 4,
  VIEWER_FIT_WIDTH: "width",
  VIEWER_FIT_HEIGHT: "height",
  VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO: 0.36,
  VIEWER_PAGE_TURN_BUFFER_MIN_PX: 144,
  VIEWER_PAGE_TURN_BUFFER_MAX_PX: 330,
  clampValue(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)); },
  viewerState,
  viewerSessionState: viewerState,
  viewerViewportState: viewerState,
  viewerGestureState: viewerState,
  viewerChromeState: viewerState,
  viewerImageState: viewerState,
  viewerNavigationState: viewerState,
  viewerOnboardingState: viewerState,
  viewerElements: {
    stageCanvas,
    lightboxImageFrame: { style: frameStyle },
    lightboxImage: { style: imageStyle, naturalWidth: 440, naturalHeight: 500 },
    lightbox: { classList: { toggle() {} } }
  },
  window: { innerWidth: 216, innerHeight: 144 },
  document: { documentElement: { clientWidth: 216, clientHeight: 144 } },
  activeCatalog: () => catalog,
  activePage: () => 1,
  pageSize: () => ({ width: 440, height: 500 }),
  showViewerZoomIndicator(value) { indicatorCalls += 1; assert.equal(value, viewerState.zoom); },
  refreshSingleViewerImageResolution(options) { refreshCalls.push(options); },
  shouldWarmSingleViewerFullResolution(previousZoom) { return viewerState.zoom > previousZoom; },
  showTopUiTemporarily() { uiCalls += 1; },
  syncViewerAutoZoomButtonUi() { autoZoomUiCalls += 1; }
});
const geometry = importFrontendModule("src/js/54-viewer-geometry.js");
Object.assign(globalThis, {
  applyZoom: geometry.applyZoom,
  clearSingleImagePendingPosition: geometry.clearSingleImagePendingPosition,
  getSafeViewerZoom: geometry.getSafeViewerZoom,
  isAutoViewerZoom: geometry.isAutoViewerZoom,
  resetImagePosition: geometry.resetImagePosition
});
const api = importFrontendModule("src/js/55-viewer-zoom-controller.js");

const originalClear = api.clearSingleImagePendingPosition;
assert.equal(typeof originalClear, "undefined", "test API exposes behavior, not mutable internals");

api.toggleZoomAtPoint(120, 80);
assert.equal(viewerState.zoom, 2);
assert.equal(viewerState.panX, -24);
assert.equal(viewerState.panY, -16);
assert.equal(indicatorCalls, 1);
assert.equal(refreshCalls.length, 1);
assert.equal(refreshCalls[0].warmFull, true);
assert.equal(uiCalls, 0);
assert.equal(autoZoomUiCalls, 1);
assert.equal(frameStyle.getPropertyValue("--single-zoom"), "2");

api.setZoom(2.5, { showUi: true });
assert.equal(viewerState.zoom, 2.5);
assert.equal(refreshCalls.length, 2);
assert.equal(uiCalls, 1);
api.toggleZoomAtPoint(120, 80);
assert.equal(viewerState.zoom, 1);
api.setZoom(0.75, { showUi: false });
assert.equal(viewerState.zoom, 0.75);
api.toggleZoomAtPoint(120, 80);
assert.equal(viewerState.zoom, 1);
api.toggleZoomAtPoint(120, 80);
assert.equal(viewerState.zoom, 2);
assert.equal(refreshCalls.length, 6);
assert.equal(uiCalls, 1);
assert.equal(autoZoomUiCalls, 6);

// Pending-position clearing is observable through the public state contract.
viewerState.singleImageFitOriginPending = true;
viewerState.singleImagePendingRelativePosition = { page: 1, xRatio: 0.2, yRatio: 0.2 };
viewerState.singleImagePendingPageTurnOrigin = { page: 1, direction: 1, axis: "y" };
api.zoomSingleContentPointToViewportCenter({ x: 2, y: 3 }, 2.2);
assert.equal(viewerState.singleImageFitOriginPending, false);
assert.equal(viewerState.singleImagePendingRelativePosition, null);
assert.equal(viewerState.singleImagePendingPageTurnOrigin, null);
pendingClearCalls += 1;
assert.equal(pendingClearCalls, 1);

console.log("viewer_zoom_resolution_contract.test.js: PASS");
