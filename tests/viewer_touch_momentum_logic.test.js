'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/js/70-viewer-input.js'), 'utf8');

function sourceBetween(text, startMarker, endMarker) {
  const start = text.indexOf(startMarker);
  const end = text.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return text.slice(start, end);
}

const momentumSource = sourceBetween(
  source,
  'function getViewerPointerEventTime(event)',
  'function startPointerInteraction(event)'
);

const state = {
  pointers: new Map(),
  viewerTouchMomentumRaf: 0,
  viewerTouchMomentumVelocityX: 0,
  viewerTouchMomentumVelocityY: 0,
  viewerTouchMomentumLastTime: 0
};
let nextFrameId = 1;
const frames = new Map();
const cancelled = [];
const windowStub = {
  requestAnimationFrame(callback) {
    const id = nextFrameId++;
    frames.set(id, callback);
    return id;
  },
  cancelAnimationFrame(id) {
    cancelled.push(id);
    frames.delete(id);
  }
};
const clampValue = (value, min, max) => Math.min(max, Math.max(min, value));
let boundaryImplementation = () => ({
  handled: true,
  turned: false,
  moved: true,
  result: { remainingDeltaX: 0, remainingDeltaY: 0 }
});

const api = new Function(
  'state',
  'window',
  'VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS',
  'VIEWER_TOUCH_VELOCITY_BLEND',
  'VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS',
  'VIEWER_TOUCH_MOMENTUM_MAX_FRAME_MS',
  'VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS',
  'VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS',
  'VIEWER_PAGE_TURN_REMAINDER_EPSILON',
  'clampValue',
  'isViewerSessionOpen',
  'singleViewerUsesBoundaryPan',
  'consumeSingleViewerBoundaryInput',
  `${momentumSource}\nreturn {
    getViewerPointerMoveSamples,
    consumeViewerPointerPanSamples,
    clampViewerTouchMomentumVelocity,
    startViewerTouchMomentum,
    stopViewerTouchMomentum
  };`
)(
  state,
  windowStub,
  80,
  0.45,
  2.6,
  34,
  0.0048,
  0.08,
  0.75,
  clampValue,
  () => true,
  () => true,
  (...args) => boundaryImplementation(...args)
);

function flushNextFrame(timestamp) {
  const entry = frames.entries().next().value;
  assert.ok(entry, 'expected a queued animation frame');
  const [id, callback] = entry;
  frames.delete(id);
  callback(timestamp);
}

const clamped = api.clampViewerTouchMomentumVelocity(10, 0);
assert.equal(clamped.velocityX, 2.6, 'touch momentum has a deterministic speed cap');
assert.equal(clamped.velocityY, 0);

const sampledDeltas = [];
boundaryImplementation = (deltaX, deltaY) => {
  sampledDeltas.push([deltaX, deltaY]);
  return {
    handled: true,
    turned: false,
    moved: true,
    result: { remainingDeltaX: 0, remainingDeltaY: 0 }
  };
};
state.pointers.set(7, {
  x: 100,
  y: 100,
  startX: 100,
  startY: 100,
  velocityX: 0,
  velocityY: 0,
  lastTime: 1000
});
const pan = api.consumeViewerPointerPanSamples({
  pointerId: 7,
  clientX: 70,
  clientY: 100,
  timeStamp: 1020,
  getCoalescedEvents() {
    return [
      { clientX: 90, clientY: 100, timeStamp: 1010 },
      { clientX: 70, clientY: 100, timeStamp: 1020 }
    ];
  }
}, state.pointers.get(7));
assert.deepEqual(sampledDeltas, [[30, 0]], 'coalesced touch samples feed one frame-aligned pan update without repeated layout writes');
assert.equal(pan.handled, true);
assert.equal(state.pointers.get(7).x, 70);
assert.ok(state.pointers.get(7).velocityX > 0, 'pointer samples retain a release velocity for kinetic scrolling');
state.pointers.clear();

const horizontalInputs = [];
boundaryImplementation = (deltaX, deltaY) => {
  horizontalInputs.push([deltaX, deltaY]);
  return {
    handled: true,
    turned: false,
    moved: false,
    result: { remainingDeltaX: deltaX, remainingDeltaY: 0 }
  };
};
assert.equal(api.startViewerTouchMomentum(1, 0), true);
flushNextFrame(100);
flushNextFrame(116);
assert.equal(horizontalInputs.length, 1);
assert.equal(state.viewerTouchMomentumVelocityX, 0, 'horizontal inertia stops independently at the terminal safety edge');
assert.equal(frames.size, 0, 'no further frame is queued once both axes stop');

const verticalInputs = [];
boundaryImplementation = (deltaX, deltaY) => {
  verticalInputs.push([deltaX, deltaY]);
  return {
    handled: true,
    turned: true,
    moved: true,
    result: { remainingDeltaX: 0, remainingDeltaY: deltaY }
  };
};
assert.equal(api.startViewerTouchMomentum(0, 1), true);
flushNextFrame(200);
flushNextFrame(216);
assert.equal(verticalInputs.length, 1);
assert.ok(state.viewerTouchMomentumVelocityY > 0, 'vertical inertia survives a successful edge page turn');
assert.equal(frames.size, 1, 'continuous touch scrolling proceeds on the newly opened page');
api.stopViewerTouchMomentum();
assert.equal(frames.size, 0);
assert.ok(cancelled.length >= 1);

console.log('viewer_touch_momentum_logic.test.js: PASS');
