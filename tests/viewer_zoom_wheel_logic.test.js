'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '70-viewer-input.js'), 'utf8');

function sourceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

const wheelFactorSource = sourceBetween(
  'function getWheelZoomFactor(event)',
  'function handleZoomSurfaceWheel(event)'
);
const wheelHandlerSource = sourceBetween(
  'function handleZoomSurfaceWheel(event)',
  'function handleZoomSurfaceDoubleClick(event)'
);

const WheelEvent = {
  DOM_DELTA_PIXEL: 0,
  DOM_DELTA_LINE: 1,
  DOM_DELTA_PAGE: 2
};
const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));
const normalizeWheelDeltaToPixels = (delta, deltaMode, pageSize = 0) => {
  if (deltaMode === WheelEvent.DOM_DELTA_LINE) return delta * 36;
  if (deltaMode === WheelEvent.DOM_DELTA_PAGE) return delta * Math.max(1, pageSize);
  return delta;
};

const getWheelZoomFactor = new Function(
  'WheelEvent',
  'clampValue',
  'normalizeWheelDeltaToPixels',
  `${wheelFactorSource}; return getWheelZoomFactor;`
)(WheelEvent, clampValue, normalizeWheelDeltaToPixels);

const surface = { clientWidth: 1200, clientHeight: 800 };
const firefoxMouseIn = getWheelZoomFactor({ deltaY: -3, deltaMode: WheelEvent.DOM_DELTA_LINE, currentTarget: surface });
const chromeMouseIn = getWheelZoomFactor({ deltaY: -100, deltaMode: WheelEvent.DOM_DELTA_PIXEL, currentTarget: surface });
const trackpadPinchIn = getWheelZoomFactor({ deltaY: -5, deltaMode: WheelEvent.DOM_DELTA_PIXEL, currentTarget: surface });
const mouseOut = getWheelZoomFactor({ deltaY: 3, deltaMode: WheelEvent.DOM_DELTA_LINE, currentTarget: surface });
const fastMouseIn = getWheelZoomFactor({ deltaY: -300, deltaMode: WheelEvent.DOM_DELTA_PIXEL, currentTarget: surface });

assert.ok(firefoxMouseIn > 1.11 && firefoxMouseIn < 1.13, 'one Firefox mouse detent should zoom by about 12%');
assert.ok(chromeMouseIn > 1.11 && chromeMouseIn < 1.13, 'one Chromium mouse detent should zoom by about 12%');
assert.ok(trackpadPinchIn > 1 && trackpadPinchIn < firefoxMouseIn, 'small trackpad deltas should remain smooth and finer-grained');
assert.ok(mouseOut > 0.88 && mouseOut < 0.90, 'reverse mouse-wheel direction should zoom out by the reciprocal step');
assert.ok(fastMouseIn < 1.41, 'even a combined large wheel event must remain bounded well below a full-range jump');

let prevented = 0;
let stopped = 0;
let momentumStops = 0;
const zoomCalls = [];
const state = { viewerPhase: 'open', zoom: 1 };
const handleZoomSurfaceWheel = new Function(
  'state',
  'isViewerSessionOpen',
  'isActiveZoomSurface',
  'stopViewerTouchMomentum',
  'getWheelZoomFactor',
  'setZoom',
  `${wheelHandlerSource}; return handleZoomSurfaceWheel;`
)(
  state,
  () => state.viewerPhase === 'open',
  () => true,
  () => { momentumStops += 1; },
  getWheelZoomFactor,
  (...args) => zoomCalls.push(args)
);

handleZoomSurfaceWheel({
  ctrlKey: true,
  metaKey: false,
  deltaY: -100,
  deltaMode: WheelEvent.DOM_DELTA_PIXEL,
  clientX: 420,
  clientY: 280,
  currentTarget: surface,
  preventDefault() { prevented += 1; },
  stopPropagation() { stopped += 1; }
});

assert.equal(prevented, 1, 'browser page zoom must be suppressed');
assert.equal(stopped, 1, 'nested viewer surfaces must not process the same wheel event twice');
assert.equal(momentumStops, 1, 'wheel input must cancel any active touch inertia first');
assert.equal(zoomCalls.length, 1, 'one physical wheel event must produce one zoom update');
assert.ok(zoomCalls[0][0] > 1.11 && zoomCalls[0][0] < 1.13);
assert.deepEqual(zoomCalls[0][1], {
  showUi: false,
  focalClientX: 420,
  focalClientY: 280
});

console.log('viewer_zoom_wheel_logic.test.js: PASS');
