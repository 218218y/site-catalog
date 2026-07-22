'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const geometrySource = fs.readFileSync(path.join(root, 'src/js/54-viewer-geometry.js'), 'utf8');
const navigationSource = fs.readFileSync(path.join(root, 'src/js/58-viewer-navigation.js'), 'utf8');

function sourceBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

const geometrySlice = sourceBetween(
  geometrySource,
  'function singleViewerUsesBoundaryPan()',
  'function shouldPreserveSingleManualPosition(options = {})'
);
const consumeSlice = sourceBetween(
  geometrySource,
  'function consumeSingleViewerPanInput(deltaX = 0, deltaY = 0)',
  'function getDefaultZoomFocalPoint()'
);

const state = {
  page: 1,
  zoom: 2,
  fitScale: 1,
  panX: 0,
  panY: -90,
  imageFitMode: 'height',
  singleImageFitOriginPending: false,
  singleImagePendingRelativePosition: null,
  singleImagePendingPageTurnOrigin: null
};
const stageCanvas = { clientWidth: 800, clientHeight: 800 };
let metrics = { overflowX: 40, overflowY: 100 };
let applyCalls = 0;
const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));

const geometryApi = new Function(
  'state',
  'els',
  'window',
  'AUTO_VIEWER_ZOOM',
  'VIEWER_FIT_WIDTH',
  'VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO',
  'VIEWER_PAGE_TURN_BUFFER_MIN_PX',
  'VIEWER_PAGE_TURN_BUFFER_MAX_PX',
  'clampValue',
  'getSafeViewerZoom',
  'singleImageCanPan',
  'getSingleImageDisplayMetrics',
  'applySingleZoom',
  `${geometrySlice}\n${consumeSlice}\nreturn {
    singleViewerUsesBoundaryPan,
    getViewerPageTurnBuffer,
    getSinglePanBounds,
    clampSinglePan,
    captureSingleImageRelativePosition,
    queueSingleImageRelativePosition,
    queueSingleImagePageTurnOrigin,
    applyPendingSingleImagePosition,
    consumeSingleViewerPanInput
  };`
)(
  state,
  { stageCanvas },
  { innerWidth: 0, innerHeight: 0 },
  1,
  'width',
  0.36,
  144,
  330,
  clampValue,
  () => state.zoom,
  () => metrics.overflowX > 1 || metrics.overflowY > 1,
  () => metrics,
  () => { applyCalls += 1; }
);

assert.equal(geometryApi.getViewerPageTurnBuffer('y'), 288);
stageCanvas.clientHeight = 300;
assert.equal(geometryApi.getViewerPageTurnBuffer('y'), 144, 'small viewports use the fixed safety minimum');
stageCanvas.clientHeight = 1200;
assert.equal(geometryApi.getViewerPageTurnBuffer('y'), 330, 'large viewports cap black overscroll');
stageCanvas.clientHeight = 800;

let result = geometryApi.consumeSingleViewerPanInput(0, 20);
assert.equal(state.panY, -110, 'wheel/touch movement continues beyond the real image edge');
assert.equal(result.remainingDeltaY, 0, 'the real edge alone must not trigger a page turn');
assert.equal(applyCalls, 1);

result = geometryApi.consumeSingleViewerPanInput(0, 270);
assert.equal(state.panY, -380);
assert.equal(result.remainingDeltaY, 0);
result = geometryApi.consumeSingleViewerPanInput(0, 20);
assert.equal(state.panY, -388, 'pan clamps at image overflow plus adaptive black buffer');
assert.equal(result.remainingDeltaY, 12, 'only input beyond the complete buffer becomes page-turn intent');

state.panX = 320;
state.panY = 0;
result = geometryApi.consumeSingleViewerPanInput(-20, 0);
assert.equal(state.panX, 328, 'horizontal movement receives the same black overscroll contract');
assert.equal(result.remainingDeltaX, -12);

state.zoom = 0.7;
metrics = { overflowX: 0, overflowY: 0 };
assert.equal(geometryApi.singleViewerUsesBoundaryPan(), false, 'a reduced image should page directly rather than drift through empty canvas');
state.zoom = 1;
metrics = { overflowX: 0, overflowY: 140 };
assert.equal(geometryApi.singleViewerUsesBoundaryPan(), true, 'fit-width overflow remains pannable at automatic zoom');
state.zoom = 1.2;
metrics = { overflowX: 0, overflowY: 0 };
assert.equal(geometryApi.singleViewerUsesBoundaryPan(), true, 'manual enlargement keeps the black edge-turn buffer even on a small image');

// Explicit navigation preserves the relative viewport position across pages.
metrics = { overflowX: 200, overflowY: 300 };
state.page = 1;
state.panX = 100;
state.panY = -150;
const relative = geometryApi.captureSingleImageRelativePosition();
assert.deepEqual(relative, { xRatio: 0.5, yRatio: -0.5 });
geometryApi.queueSingleImageRelativePosition(2, relative);
state.page = 2;
metrics = { overflowX: 400, overflowY: 100 };
assert.equal(geometryApi.applyPendingSingleImagePosition(), true);
assert.equal(state.panX, 200);
assert.equal(state.panY, -50);

// Edge-driven forward/backward navigation keeps zoom but chooses a reading origin.
geometryApi.queueSingleImagePageTurnOrigin(3, 1, 'y');
state.page = 3;
metrics = { overflowX: 75, overflowY: 260 };
geometryApi.applyPendingSingleImagePosition();
assert.equal(state.panX, 0);
assert.equal(state.panY, 260, 'forward edge turn opens the next image at its top');
geometryApi.queueSingleImagePageTurnOrigin(2, -1, 'y');
state.page = 2;
geometryApi.applyPendingSingleImagePosition();
assert.equal(state.panY, -260, 'backward edge turn enters the previous image from its bottom');

const intentSlice = sourceBetween(
  navigationSource,
  'function getSingleViewerPageTurnIntent(result, deltaX = 0, deltaY = 0)',
  'function consumeSingleViewerBoundaryInput(deltaX = 0, deltaY = 0, options = {})'
);
const moveCalls = [];
const navigationApi = new Function(
  'VIEWER_PAGE_TURN_REMAINDER_EPSILON',
  'canMoveLightbox',
  'moveLightbox',
  `${intentSlice}\nreturn { getSingleViewerPageTurnIntent, moveLightboxFromPageTurn };`
)(
  0.75,
  () => true,
  (...args) => moveCalls.push(args)
);
assert.deepEqual(
  navigationApi.getSingleViewerPageTurnIntent({ remainingDeltaX: 0, remainingDeltaY: 12 }, 1, 20),
  { axis: 'y', direction: 1 }
);
assert.deepEqual(
  navigationApi.getSingleViewerPageTurnIntent({ remainingDeltaX: -12, remainingDeltaY: 0 }, -20, 1),
  null,
  'horizontal black-buffer overflow is a terminal pan boundary and never turns a zoomed page'
);
assert.equal(navigationApi.moveLightboxFromPageTurn(1, 'y'), true);
assert.deepEqual(moveCalls[0], [1, {
  keepZoom: true,
  positionMode: 'page-turn',
  pageTurnDirection: 1,
  pageTurnAxis: 'y',
  preservePointerInteraction: false
}]);
assert.equal(navigationApi.moveLightboxFromPageTurn(-1, 'x', { preservePointerInteraction: true }), true);
assert.deepEqual(moveCalls[1], [-1, {
  keepZoom: true,
  positionMode: 'page-turn',
  pageTurnDirection: -1,
  pageTurnAxis: 'x',
  preservePointerInteraction: true
}]);

const boundarySlice = sourceBetween(
  navigationSource,
  'function getSingleViewerPageTurnIntent(result, deltaX = 0, deltaY = 0)',
  'function settleViewerPageWheelGesture()'
);
const boundaryMoveCalls = [];
let boundaryPanResult = {
  moved: true,
  remainingDeltaX: 0,
  remainingDeltaY: 18
};
const boundaryApi = new Function(
  'VIEWER_PAGE_TURN_REMAINDER_EPSILON',
  'canMoveLightbox',
  'moveLightbox',
  'consumeSingleViewerPanInput',
  `${boundarySlice}\nreturn { consumeSingleViewerBoundaryInput };`
)(
  0.75,
  () => true,
  (...args) => boundaryMoveCalls.push(args),
  () => boundaryPanResult
);
const boundaryResult = boundaryApi.consumeSingleViewerBoundaryInput(0, 40, { pointerId: 91 });
assert.equal(boundaryResult.turned, true);
assert.deepEqual(boundaryMoveCalls[0], [1, {
  keepZoom: true,
  positionMode: 'page-turn',
  pageTurnDirection: 1,
  pageTurnAxis: 'y',
  preservePointerInteraction: true
}], 'a touch edge turn must preserve the live pointer stream on the next image');

boundaryPanResult = {
  moved: false,
  remainingDeltaX: 18,
  remainingDeltaY: 0
};
const horizontalBoundaryResult = boundaryApi.consumeSingleViewerBoundaryInput(40, 0, { pointerId: 92 });
assert.equal(horizontalBoundaryResult.turned, false);
assert.equal(horizontalBoundaryResult.intent, null);
assert.equal(boundaryMoveCalls.length, 1, 'horizontal boundary overflow must stop without issuing another page command');

const wheelHandlerStart = navigationSource.indexOf('function handleViewerPageWheel(event)');
assert.notEqual(wheelHandlerStart, -1, 'Missing handleViewerPageWheel');
const wheelHandlerSource = navigationSource.slice(wheelHandlerStart);
let prevented = 0;
let boundaryInputs = 0;
const wheelApi = new Function(
  'state',
  'isViewerSessionOpen',
  'normalizeViewerPageWheelDeltas',
  'singleViewerUsesBoundaryPan',
  'clearViewerPageWheelGesture',
  'consumeSingleViewerBoundaryInput',
  `${wheelHandlerSource}\nreturn { handleViewerPageWheel };`
)(
  { catalog: {} },
  () => true,
  (event) => ({ deltaX: event.deltaX, deltaY: event.deltaY }),
  () => true,
  () => {},
  () => { boundaryInputs += 1; }
);
const wheelEvent = {
  deltaX: 0,
  deltaY: 48,
  preventDefault() { prevented += 1; }
};
assert.equal(wheelApi.handleViewerPageWheel(wheelEvent), true);
assert.equal(wheelApi.handleViewerPageWheel(wheelEvent), true);
assert.equal(boundaryInputs, 2, 'continuous wheel/trackpad events must reach the newly opened image without a settle pause');
assert.equal(prevented, 2);

console.log('viewer_page_turn_pan_logic.test.js: PASS');
