'use strict';

const assert = require('node:assert/strict');
const { importFrontendTestModule } = require('./frontend_test_module');

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
let boundaryImplementation = () => ({ handled: true, turned: false, moved: true, result: { remainingDeltaX: 0, remainingDeltaY: 0 } });
Object.assign(globalThis, {
  viewerState: state,
  window: windowStub,
  VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS: 80,
  VIEWER_TOUCH_VELOCITY_BLEND: 0.45,
  VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS: 2.6,
  VIEWER_TOUCH_MOMENTUM_MAX_FRAME_MS: 34,
  VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS: 0.0048,
  VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS: 0.08,
  VIEWER_PAGE_TURN_REMAINDER_EPSILON: 0.75,
  clampValue: (value, min, max) => Math.min(max, Math.max(min, value)),
  isViewerSessionOpen: () => true,
  singleViewerUsesBoundaryPan: () => true,
  consumeSingleViewerBoundaryInput: (...args) => boundaryImplementation(...args)
});
const api = importFrontendTestModule('src/js/70-viewer-input.js', 'viewer-input');

function flushNextFrame(timestamp) {
  const entry = frames.entries().next().value;
  assert.ok(entry, 'expected a queued animation frame');
  const [id, callback] = entry;
  frames.delete(id);
  callback(timestamp);
}

assert.deepEqual(api.clampViewerTouchMomentumVelocity(10, 0), { velocityX: 2.6, velocityY: 0 });
const sampledDeltas = [];
boundaryImplementation = (deltaX, deltaY) => {
  sampledDeltas.push([deltaX, deltaY]);
  return { handled: true, turned: false, moved: true, result: { remainingDeltaX: 0, remainingDeltaY: 0 } };
};
state.pointers.set(7, { x: 100, y: 100, startX: 100, startY: 100, velocityX: 0, velocityY: 0, lastTime: 1000 });
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
assert.deepEqual(sampledDeltas, [[30, 0]]);
assert.equal(pan.handled, true);
assert.equal(state.pointers.get(7).x, 70);
assert.ok(state.pointers.get(7).velocityX > 0);
state.pointers.clear();

const horizontalInputs = [];
boundaryImplementation = (deltaX, deltaY) => {
  horizontalInputs.push([deltaX, deltaY]);
  return { handled: true, turned: false, moved: false, result: { remainingDeltaX: deltaX, remainingDeltaY: 0 } };
};
assert.equal(api.startViewerTouchMomentum(1, 0), true);
flushNextFrame(100);
flushNextFrame(116);
assert.equal(horizontalInputs.length, 1);
assert.equal(state.viewerTouchMomentumVelocityX, 0);
assert.equal(frames.size, 0);

const verticalInputs = [];
boundaryImplementation = (deltaX, deltaY) => {
  verticalInputs.push([deltaX, deltaY]);
  return { handled: true, turned: true, moved: true, result: { remainingDeltaX: 0, remainingDeltaY: deltaY } };
};
assert.equal(api.startViewerTouchMomentum(0, 1), true);
flushNextFrame(200);
flushNextFrame(216);
assert.equal(verticalInputs.length, 1);
assert.ok(state.viewerTouchMomentumVelocityY > 0);
assert.equal(frames.size, 1);
api.stopViewerTouchMomentum();
assert.equal(frames.size, 0);
assert.ok(cancelled.length >= 1);

console.log('viewer_touch_momentum_logic.test.js: PASS');
