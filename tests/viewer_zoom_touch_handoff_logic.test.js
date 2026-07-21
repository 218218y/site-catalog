'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '58-viewer-scroll.js'), 'utf8');
const geometrySource = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '54-viewer-geometry.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

const consumeSource = sourceBetween(
  'function consumeViewerScrollIsolatedPan(deltaX = 0, deltaY = 0)',
  'function panViewerScrollIsolatedZoomByWheel(deltaX = 0, deltaY = 0)'
);

const state = {
  panX: 0,
  panY: -90,
  singleImageFitOriginPending: true
};
let isolated = true;
let metrics = { overflowX: 40, overflowY: 100 };
let applyCalls = 0;
const stageCanvas = { clientHeight: 800 };

function geometrySourceBetween(startMarker, endMarker) {
  const start = geometrySource.indexOf(startMarker);
  const end = geometrySource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return geometrySource.slice(start, end);
}

const isolatedPanBoundarySource = geometrySourceBetween(
  'function getViewerScrollIsolatedExitBuffer()',
  'function shouldPreserveSingleManualPosition(options = {})'
);

const isolatedPanBoundaryApi = new Function(
  'state',
  'els',
  'window',
  'isViewerScrollIsolatedZoom',
  'clampValue',
  'getSingleImageDisplayMetrics',
  'VIEWER_SCROLL_ZOOM_EXIT_BUFFER_VIEWPORT_RATIO',
  'VIEWER_SCROLL_ZOOM_EXIT_BUFFER_MIN_PX',
  'VIEWER_SCROLL_ZOOM_EXIT_BUFFER_MAX_PX',
  `${isolatedPanBoundarySource}; return {
    getViewerScrollIsolatedExitBuffer,
    clampSinglePan
  };`
)(
  state,
  { stageCanvas },
  { innerHeight: 0 },
  () => isolated,
  (value, min, max) => Math.min(max, Math.max(min, value)),
  () => metrics,
  0.36,
  144,
  330
);

assert.equal(isolatedPanBoundaryApi.getViewerScrollIsolatedExitBuffer(), 288);
stageCanvas.clientHeight = 300;
assert.equal(isolatedPanBoundaryApi.getViewerScrollIsolatedExitBuffer(), 144, 'small screens should keep the enlarged fixed minimum');
stageCanvas.clientHeight = 1200;
assert.equal(isolatedPanBoundaryApi.getViewerScrollIsolatedExitBuffer(), 330, 'large screens should cap the enlarged black-canvas travel');
stageCanvas.clientHeight = 800;

const consumeViewerScrollIsolatedPan = new Function(
  'state',
  'isViewerScrollIsolatedZoom',
  'getSingleImageDisplayMetrics',
  'clampSinglePan',
  'applySingleZoom',
  `${consumeSource}; return consumeViewerScrollIsolatedPan;`
)(
  state,
  () => isolated,
  () => metrics,
  isolatedPanBoundaryApi.clampSinglePan,
  () => { applyCalls += 1; }
);

let result = consumeViewerScrollIsolatedPan(0, 20);
assert.equal(state.panY, -110, 'movement should continue beyond the image edge into the black exit buffer');
assert.equal(result.remainingDeltaY, 0, 'reaching the real image edge must not dismiss zoom');
assert.equal(result.hasVerticalExitIntent, true);
assert.equal(applyCalls, 1, 'consumed in-image movement should render once');
assert.equal(state.singleImageFitOriginPending, false);

result = consumeViewerScrollIsolatedPan(0, 270);
assert.equal(state.panY, -380, 'the enlarged safety distance should be consumed almost completely before handoff');
assert.equal(result.remainingDeltaY, 0);

result = consumeViewerScrollIsolatedPan(0, 20);
assert.equal(state.panY, -388, 'vertical travel should clamp at image overflow plus the enlarged adaptive exit buffer');
assert.equal(result.remainingDeltaY, 12, 'only movement beyond the complete enlarged safety distance should be handed off');

result = consumeViewerScrollIsolatedPan(0, -330);
assert.equal(state.panY, -58, 'reverse movement should return from the enlarged black buffer into the zoomed image normally');
assert.equal(result.remainingDeltaY, 0, 'movement fully consumed by the image must not exit zoom');
assert.equal(applyCalls, 4);

state.panX = 35;
state.panY = 0;
result = consumeViewerScrollIsolatedPan(-20, 2);
assert.equal(state.panX, 40, 'horizontal panning should still clamp at the real image boundary');
assert.equal(result.remainingDeltaX, -15);
assert.equal(result.hasVerticalExitIntent, false, 'a mostly horizontal drag must not dismiss zoom');

metrics = { overflowX: 80, overflowY: 0 };
state.panX = 0;
state.panY = 0;
result = consumeViewerScrollIsolatedPan(0, 18);
assert.equal(state.panY, -18, 'even a landscape image should expose black canvas before zoom exits');
assert.equal(result.remainingDeltaY, 0);
assert.equal(result.hasVerticalExitIntent, true);

result = consumeViewerScrollIsolatedPan(0, 300);
assert.equal(state.panY, -288);
assert.equal(result.remainingDeltaY, 30, 'handoff should begin only after the enlarged fixed safety range is exhausted');

isolated = false;
assert.equal(isolatedPanBoundaryApi.getViewerScrollIsolatedExitBuffer(), 0);
assert.equal(consumeViewerScrollIsolatedPan(0, 20), null, 'handoff math must be inactive outside isolated zoom');

const inputSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '70-viewer-input.js'), 'utf8');
function inputSourceBetween(startMarker, endMarker) {
  const start = inputSource.indexOf(startMarker);
  const end = inputSource.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return inputSource.slice(start, end);
}

const handoffSource = inputSourceBetween(
  'function clearViewerScrollPointerHandoff()',
  'function startPointerInteraction(event)'
);
const handoffState = { viewerScrollPointerHandoff: null };
const classNames = new Set();
const scrollCalls = [];
const frameCallbacks = new Map();
let nextFrameId = 1;
let exitCalls = 0;
let releasedPointerId = null;

const handoffApi = new Function(
  'state',
  'els',
  'cancelAnimationFrame',
  'requestAnimationFrame',
  'isTouchLikePointer',
  'isViewerScrollIsolatedZoom',
  'exitViewerScrollIsolatedZoom',
  'AUTO_VIEWER_ZOOM',
  `${handoffSource}; return {
    clearViewerScrollPointerHandoff,
    flushViewerScrollPointerHandoff,
    beginViewerScrollPointerHandoff,
    continueViewerScrollPointerHandoff,
    finishViewerScrollPointerHandoff
  };`
)(
  handoffState,
  {
    lightbox: {
      classList: {
        add(name) { classNames.add(name); },
        remove(name) { classNames.delete(name); }
      }
    },
    viewerScrollPages: {
      scrollBy(options) { scrollCalls.push(options); }
    }
  },
  (id) => frameCallbacks.delete(id),
  (callback) => {
    const id = nextFrameId++;
    frameCallbacks.set(id, callback);
    return id;
  },
  (event) => event.pointerType === 'touch' || event.pointerType === 'pen',
  () => true,
  (options) => {
    exitCalls += 1;
    assert.deepEqual(options, { restorePage: true, nextZoom: 1 });
  },
  1
);

const touchEvent = {
  pointerId: 7,
  pointerType: 'touch',
  clientX: 420,
  clientY: 300
};
assert.equal(handoffApi.beginViewerScrollPointerHandoff(touchEvent, 0, 12), true);
assert.equal(exitCalls, 1, 'crossing the zoom boundary should exit isolated zoom exactly once');
assert.equal(classNames.has('viewer-touch-handoff-active'), true, 'snap suspension should remain active for the contact');
assert.equal(frameCallbacks.size, 1, 'the first unconsumed movement should be queued for the continuous viewer');

for (const callback of [...frameCallbacks.values()]) callback();
frameCallbacks.clear();
assert.deepEqual(scrollCalls.shift(), { left: 0, top: 12, behavior: 'auto' });

let preventedMoves = 0;
assert.equal(handoffApi.continueViewerScrollPointerHandoff({
  pointerId: 7,
  clientX: 420,
  clientY: 270,
  preventDefault() { preventedMoves += 1; }
}), true);
assert.equal(preventedMoves, 1);
for (const callback of [...frameCallbacks.values()]) callback();
frameCallbacks.clear();
assert.deepEqual(scrollCalls.shift(), { left: 0, top: 30, behavior: 'auto' }, 'the same finger should keep scrolling after zoom closes');

handoffApi.continueViewerScrollPointerHandoff({
  pointerId: 7,
  clientX: 420,
  clientY: 250,
  preventDefault() {}
});
assert.equal(handoffApi.finishViewerScrollPointerHandoff({
  pointerId: 7,
  preventDefault() {},
  currentTarget: {
    releasePointerCapture(pointerId) { releasedPointerId = pointerId; }
  }
}), true);
assert.deepEqual(scrollCalls.shift(), { left: 0, top: 20, behavior: 'auto' }, 'pointerup should flush the final queued movement');
assert.equal(handoffState.viewerScrollPointerHandoff, null);
assert.equal(classNames.has('viewer-touch-handoff-active'), false, 'normal snap behavior should return after contact ends');
assert.equal(releasedPointerId, 7);

console.log('viewer_zoom_touch_handoff_logic.test.js: PASS');
