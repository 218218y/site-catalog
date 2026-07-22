"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/js/54-viewer-geometry.js"), "utf8");
const start = source.indexOf("function finalizeSingleViewerZoomChange(previousZoom, options = {})");
assert.notEqual(start, -1, "shared zoom finalizer must exist");
const zoomSource = source.slice(start);

const refreshCalls = [];
let applyCalls = 0;
let indicatorCalls = 0;
let pendingClearCalls = 0;
let uiCalls = 0;

const context = {
  AUTO_VIEWER_ZOOM: 1,
  state: {
    zoom: 1,
    panX: 0,
    panY: 0
  },
  applyZoom() { applyCalls += 1; },
  getSafeViewerZoom(value) { return Number(value) || 1; },
  showViewerZoomIndicator(value) {
    indicatorCalls += 1;
    assert.equal(value, context.state.zoom);
  },
  refreshSingleViewerImageResolution(options) { refreshCalls.push(options); },
  shouldWarmSingleViewerFullResolution(previousZoom) {
    return context.state.zoom > previousZoom;
  },
  showTopUiTemporarily() { uiCalls += 1; },
  clampViewerZoom(value) { return Math.max(1, Math.min(4, Number(value) || 1)); },
  isAutoViewerZoom(value) { return Math.abs(Number(value) - 1) <= 0.001; },
  clearSingleImagePendingPosition() { pendingClearCalls += 1; },
  getSingleContentPointFromClientPoint(clientX, clientY) {
    return { x: clientX / 10, y: clientY / 10 };
  },
  getDefaultZoomFocalPoint() { return { x: 0, y: 0 }; },
  adjustSinglePanForZoom() {},
  resetImagePosition() {}
};

vm.runInNewContext(`${zoomSource}\nglobalThis.zoomApi = {
  finalizeSingleViewerZoomChange,
  zoomSingleContentPointToViewportCenter,
  zoomClientPointToViewportCenter,
  setZoom,
  toggleZoomAtPoint
};`, context);

context.zoomApi.toggleZoomAtPoint(120, 80);
assert.equal(context.state.zoom, 2, "double-click/tap zoom should enter manual zoom");
assert.equal(context.state.panX, -24);
assert.equal(context.state.panY, -16);
assert.equal(pendingClearCalls, 1);
assert.equal(applyCalls, 1);
assert.equal(indicatorCalls, 1);
assert.equal(refreshCalls.length, 1, "focal-point zoom must run the resolution policy");
assert.equal(refreshCalls[0].warmFull, true, "first zoom movement should warm/commit full resolution");
assert.equal(uiCalls, 0, "double-click/tap keeps the toolbar behavior unchanged");

context.zoomApi.setZoom(2.5, { showUi: true });
assert.equal(context.state.zoom, 2.5);
assert.equal(applyCalls, 2);
assert.equal(refreshCalls.length, 2, "ordinary zoom must use the same resolution finalizer exactly once");
assert.equal(uiCalls, 1);

console.log("viewer_zoom_resolution_contract.test.js: PASS");
