"use strict";

const assert = require("node:assert/strict");
const { importFrontendTestModule } = require("./frontend_test_module");

const pageNumbering = importFrontendTestModule("src/js/06-catalog-page-numbering.js", "catalog-page-numbering");
Object.assign(globalThis, pageNumbering);

const clampValue = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const state = {
  page: 1,
  zoom: 2,
  fitScale: 1,
  panX: 0,
  panY: -90,
  imageFitMode: "height",
  singleImageFitOriginPending: false,
  singleImagePendingRelativePosition: null,
  singleImagePendingPageTurnOrigin: null,
  viewerPageWheelSettleTimer: 0,
  viewerPageWheelAccumulator: 0,
  viewerPageWheelBasePage: 0,
  viewerPageWheelTargetPage: 0,
  viewerPageWheelResetGestureActive: false,
  viewerPageWheelResetLastEventAt: 0,
  viewerPageWheelResetLastDelta: 0,
  viewerPageWheelResetDirection: 0
};
const stageCanvas = { clientWidth: 800, clientHeight: 800 };
let metrics = { overflowX: 40, overflowY: 100 };
const catalog = { id: "page-turn-test", pages: 5 };

Object.assign(globalThis, {
  AUTO_VIEWER_ZOOM: 1,
  MIN_VIEWER_ZOOM: 0.35,
  MAX_VIEWER_ZOOM: 4,
  VIEWER_FIT_WIDTH: "width",
  VIEWER_FIT_HEIGHT: "height",
  VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO: 0.36,
  VIEWER_PAGE_TURN_BUFFER_MIN_PX: 144,
  VIEWER_PAGE_TURN_BUFFER_MAX_PX: 330,
  clampValue,
  viewerState: state,
  navigationState: state,
  viewerElements: { stageCanvas },
  window: {
    innerWidth: 0,
    innerHeight: 0,
    clearTimeout() {},
    setTimeout() { return 1; }
  },
  activeCatalog: () => catalog,
  activePage: () => state.page,
  pageSize() {
    return {
      width: (stageCanvas.clientWidth + metrics.overflowX * 2) / (state.fitScale * state.zoom),
      height: (stageCanvas.clientHeight + metrics.overflowY * 2) / (state.fitScale * state.zoom)
    };
  }
});
const geometry = importFrontendTestModule("src/js/54-viewer-geometry.js", "viewer-geometry");


assert.equal(geometry.getViewerPageTurnBuffer("y"), 288);
stageCanvas.clientHeight = 300;
assert.equal(geometry.getViewerPageTurnBuffer("y"), 144, "small viewports use the fixed safety minimum");
stageCanvas.clientHeight = 1200;
assert.equal(geometry.getViewerPageTurnBuffer("y"), 330, "large viewports cap black overscroll");
stageCanvas.clientHeight = 800;

let result = geometry.consumeSingleViewerPanInput(0, 20);
assert.equal(state.panY, -110, "wheel/touch movement continues beyond the real image edge");
assert.equal(result.remainingDeltaY, 0, "the real edge alone must not trigger a page turn");

result = geometry.consumeSingleViewerPanInput(0, 270);
assert.equal(state.panY, -380);
assert.equal(result.remainingDeltaY, 0);
result = geometry.consumeSingleViewerPanInput(0, 20);
assert.equal(state.panY, -388, "pan clamps at image overflow plus adaptive black buffer");
assert.equal(result.remainingDeltaY, 12, "only input beyond the complete buffer becomes page-turn intent");

state.panX = 320;
state.panY = 0;
result = geometry.consumeSingleViewerPanInput(-20, 0);
assert.equal(state.panX, 328, "horizontal movement receives the same black overscroll contract");
assert.equal(result.remainingDeltaX, -12);

state.zoom = 0.7;
metrics = { overflowX: 0, overflowY: 0 };
assert.equal(geometry.singleViewerUsesBoundaryPan(), false, "a reduced image should page directly rather than drift through empty canvas");
state.zoom = 1;
metrics = { overflowX: 0, overflowY: 140 };
assert.equal(geometry.singleViewerUsesBoundaryPan(), true, "fit-width overflow remains pannable at automatic zoom");
state.zoom = 1.2;
metrics = { overflowX: 0, overflowY: 0 };
assert.equal(geometry.singleViewerUsesBoundaryPan(), true, "manual enlargement keeps the black edge-turn buffer even on a small image");

// Explicit navigation preserves the relative viewport position across pages.
state.zoom = 2;
metrics = { overflowX: 200, overflowY: 300 };
state.page = 1;
state.panX = 100;
state.panY = -150;
const relative = geometry.captureSingleImageRelativePosition();
assert.deepEqual(relative, { xRatio: 0.5, yRatio: -0.5 });
geometry.queueSingleImageRelativePosition(2, relative);
state.page = 2;
metrics = { overflowX: 400, overflowY: 100 };
assert.equal(geometry.applyPendingSingleImagePosition(), true);
assert.equal(state.panX, 200);
assert.equal(state.panY, -50);

// Edge-driven forward/backward navigation keeps zoom but chooses a reading origin.
geometry.queueSingleImagePageTurnOrigin(3, 1, "y");
state.page = 3;
metrics = { overflowX: 75, overflowY: 260 };
geometry.applyPendingSingleImagePosition();
assert.equal(state.panX, 0);
assert.equal(state.panY, 260, "forward edge turn opens the next image at its top");
geometry.queueSingleImagePageTurnOrigin(2, -1, "y");
state.page = 2;
geometry.applyPendingSingleImagePosition();
assert.equal(state.panY, -260, "backward edge turn enters the previous image from its bottom");

const moveCalls = [];
const setPageCalls = [];
let boundaryPanResult = { moved: true, remainingDeltaX: 0, remainingDeltaY: 18 };
let boundaryInputs = 0;
let usesBoundaryPan = true;
class HTMLElementValue {}
Object.assign(globalThis, {
  HTMLElement: HTMLElementValue,
  WheelEvent: { DOM_DELTA_PIXEL: 0, DOM_DELTA_LINE: 1, DOM_DELTA_PAGE: 2 },
  VIEWER_PAGE_TURN_REMAINDER_EPSILON: 0.75,
  VIEWER_PAGE_WHEEL_PAGE_DELTA_PX: 840,
  VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX: 72,
  VIEWER_PAGE_WHEEL_SETTLE_MS: 180,
  VIEWER_PAGE_WHEEL_RESET_RESTART_GAP_MS: 48,
  VIEWER_PAGE_WHEEL_RESET_ACCELERATION_RATIO: 1.4,
  isFavoritesLightboxMode: () => false,
  getFeatureInterface: () => null,
  setFavoriteViewerIndex() {},
  setLightboxPage: (...args) => {
    setPageCalls.push(args);
    state.page = args[0];
  },
  moveLightbox: (...args) => {
    moveCalls.push(args);
    state.page += args[0];
  },
  consumeSingleViewerPanInput: () => boundaryPanResult,
  isAutoViewerZoom: () => Math.abs(state.zoom - 1) <= 0.001,
  normalizeWheelDeltaToPixels: (delta) => Number(delta) || 0,
  isViewerSessionOpen: () => true,
  singleViewerUsesBoundaryPan: () => usesBoundaryPan
});
const navigation = importFrontendTestModule("src/js/58-viewer-navigation.js", "viewer-navigation");

assert.deepEqual(
  navigation.getSingleViewerPageTurnIntent({ remainingDeltaX: 0, remainingDeltaY: 12 }, 1, 20),
  { axis: "y", direction: 1 }
);
assert.deepEqual(
  navigation.getSingleViewerPageTurnIntent({ remainingDeltaX: -12, remainingDeltaY: 0 }, -20, 1),
  null,
  "horizontal black-buffer overflow is a terminal pan boundary and never turns a zoomed page"
);
state.page = 2;
assert.equal(navigation.moveLightboxFromPageTurn(1, "y"), true);
assert.deepEqual(moveCalls[0], [1, {
  keepZoom: true,
  positionMode: "page-turn",
  pageTurnDirection: 1,
  pageTurnAxis: "y",
  preservePointerInteraction: false
}]);
assert.equal(navigation.moveLightboxFromPageTurn(-1, "x", { preservePointerInteraction: true }), true);
assert.deepEqual(moveCalls[1], [-1, {
  keepZoom: true,
  positionMode: "page-turn",
  pageTurnDirection: -1,
  pageTurnAxis: "x",
  preservePointerInteraction: true
}]);

assert.deepEqual(
  navigation.getViewerPageTurnNavigationOptions(1, "y", {
    preservePointerInteraction: true,
    resetViewOnPageTurn: true
  }),
  {
    keepZoom: false,
    resetZoom: true,
    resetPosition: true,
    positionMode: "auto",
    preservePointerInteraction: true
  },
  "scroll-driven page turns must reset a manual zoom and its pan position"
);

const boundaryResult = navigation.consumeSingleViewerBoundaryInput(0, 40, {
  pointerId: 91,
  resetViewOnPageTurn: true
});
assert.equal(boundaryResult.turned, true);
assert.deepEqual(moveCalls[2], [1, {
  keepZoom: false,
  resetZoom: true,
  resetPosition: true,
  positionMode: "auto",
  preservePointerInteraction: true
}], "a vertical touch-scroll edge turn resets the view while preserving the live pointer stream");

boundaryPanResult = { moved: false, remainingDeltaX: 18, remainingDeltaY: 0 };
const horizontalBoundaryResult = navigation.consumeSingleViewerBoundaryInput(40, 0, { pointerId: 92 });
assert.equal(horizontalBoundaryResult.turned, false);
assert.equal(horizontalBoundaryResult.intent, null);
assert.equal(moveCalls.length, 3, "horizontal boundary overflow must stop without issuing another page command");

state.zoom = 1;
assert.deepEqual(
  navigation.getViewerPageTurnNavigationOptions(1, "y", { resetViewOnPageTurn: true }),
  {
    keepZoom: true,
    positionMode: "page-turn",
    pageTurnDirection: 1,
    pageTurnAxis: "y",
    preservePointerInteraction: false
  },
  "ordinary scrolling at automatic zoom keeps the continuous-reading page origin"
);

// A trailing delta from the same manual-zoom edge gesture must not skip the
// freshly opened page after the view has been reset.
let prevented = 0;
const wheelEvent = {
  deltaX: 0,
  deltaY: 48,
  deltaMode: 0,
  timeStamp: 1000,
  currentTarget: null,
  preventDefault() { prevented += 1; }
};
state.zoom = 2;
boundaryInputs = 0;
boundaryPanResult = { moved: false, remainingDeltaX: 0, remainingDeltaY: 18 };
globalThis.consumeSingleViewerPanInput = () => {
  boundaryInputs += 1;
  return boundaryPanResult;
};
const moveCountBeforeWheelReset = moveCalls.length;
assert.equal(navigation.handleViewerPageWheel(wheelEvent), true);
assert.equal(moveCalls.length, moveCountBeforeWheelReset + 1);
assert.equal(state.viewerPageWheelResetGestureActive, true);
state.zoom = 1;
boundaryPanResult = { moved: true, remainingDeltaX: 0, remainingDeltaY: 0 };
assert.equal(navigation.handleViewerPageWheel({ ...wheelEvent, deltaY: 24, timeStamp: 1016 }), true);
assert.equal(boundaryInputs, 1, "the trailing delta is owned by the completed reset gesture");
assert.equal(moveCalls.length, moveCountBeforeWheelReset + 1, "the trailing delta must not issue a second page command");

// A new wheel/trackpad gesture must not wait for the full settle timeout. A
// cadence break followed by renewed input is processed by the current event.
usesBoundaryPan = false;
const pageBeforeRestart = state.page;
assert.equal(navigation.handleViewerPageWheel({ ...wheelEvent, deltaY: 96, timeStamp: 1072 }), true);
assert.equal(state.page, pageBeforeRestart + 1, "a fresh gesture after the momentum tail advances immediately");
assert.equal(setPageCalls.length, 1);
assert.equal(state.viewerPageWheelResetGestureActive, false);
navigation.clearViewerPageWheelGesture();

state.viewerPageWheelResetGestureActive = true;
state.viewerPageWheelResetLastEventAt = 2000;
state.viewerPageWheelResetLastDelta = 18;
state.viewerPageWheelResetDirection = 1;
assert.equal(
  navigation.consumeViewerPageWheelResetContinuation(-8, 2016),
  false,
  "an opposite-direction wheel event starts a fresh gesture immediately"
);

state.viewerPageWheelResetGestureActive = true;
state.viewerPageWheelResetLastEventAt = 3000;
state.viewerPageWheelResetLastDelta = 10;
state.viewerPageWheelResetDirection = 1;
assert.equal(
  navigation.consumeViewerPageWheelResetContinuation(90, 3016),
  false,
  "renewed acceleration starts a fresh gesture even inside the cadence window"
);
navigation.clearViewerPageWheelGesture();

// Automatic-fit boundary panning remains continuous because no manual view was
// reset and every event still belongs to the reading stream.
state.zoom = 1;
usesBoundaryPan = true;
boundaryInputs = 0;
globalThis.consumeSingleViewerPanInput = () => {
  boundaryInputs += 1;
  return { moved: true, remainingDeltaX: 0, remainingDeltaY: 0 };
};
assert.equal(navigation.handleViewerPageWheel(wheelEvent), true);
assert.equal(navigation.handleViewerPageWheel(wheelEvent), true);
assert.equal(boundaryInputs, 2, "automatic-fit wheel events must continue to reach boundary pan");
assert.equal(prevented, 5);
navigation.clearViewerPageWheelGesture();

console.log("viewer_page_turn_pan_logic.test.js: PASS");
