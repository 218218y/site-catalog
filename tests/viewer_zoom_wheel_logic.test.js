'use strict';

const assert = require('node:assert/strict');
const { importFrontendModule } = require('./frontend_test_module');

const WheelEventValue = { DOM_DELTA_PIXEL: 0, DOM_DELTA_LINE: 1, DOM_DELTA_PAGE: 2 };
const viewerState = { viewerPhase: 'open', zoom: 1, viewerTouchMomentumRaf: 0, viewerTouchMomentumLastTime: 0, viewerTouchMomentumVelocityX: 0, viewerTouchMomentumVelocityY: 0 };
const surface = { clientWidth: 1200, clientHeight: 800 };
const zoomCalls = [];
let cancelledFrame = 0;
Object.assign(globalThis, {
  WheelEvent: WheelEventValue,
  clampValue: (value, min, max) => Math.min(max, Math.max(min, value)),
  normalizeWheelDeltaToPixels(delta, deltaMode, pageSize = 0) {
    if (deltaMode === WheelEventValue.DOM_DELTA_LINE) return delta * 36;
    if (deltaMode === WheelEventValue.DOM_DELTA_PAGE) return delta * Math.max(1, pageSize);
    return delta;
  },
  viewerState,
  viewerSessionState: viewerState,
  viewerViewportState: viewerState,
  viewerGestureState: viewerState,
  viewerChromeState: viewerState,
  viewerImageState: viewerState,
  viewerNavigationState: viewerState,
  viewerOnboardingState: viewerState,
  viewerElements: { stageCanvas: surface },
  isViewerSessionOpen: () => viewerState.viewerPhase === 'open',
  setZoom: (...args) => zoomCalls.push(args),
  window: { cancelAnimationFrame: (id) => { cancelledFrame = id; } }
});
const api = importFrontendModule('src/js/70-viewer-input.js');

const firefoxMouseIn = api.getWheelZoomFactor({ deltaY: -3, deltaMode: WheelEventValue.DOM_DELTA_LINE, currentTarget: surface });
const chromeMouseIn = api.getWheelZoomFactor({ deltaY: -100, deltaMode: WheelEventValue.DOM_DELTA_PIXEL, currentTarget: surface });
const trackpadPinchIn = api.getWheelZoomFactor({ deltaY: -5, deltaMode: WheelEventValue.DOM_DELTA_PIXEL, currentTarget: surface });
const mouseOut = api.getWheelZoomFactor({ deltaY: 3, deltaMode: WheelEventValue.DOM_DELTA_LINE, currentTarget: surface });
const fastMouseIn = api.getWheelZoomFactor({ deltaY: -300, deltaMode: WheelEventValue.DOM_DELTA_PIXEL, currentTarget: surface });

assert.ok(firefoxMouseIn > 1.11 && firefoxMouseIn < 1.13);
assert.ok(chromeMouseIn > 1.11 && chromeMouseIn < 1.13);
assert.ok(trackpadPinchIn > 1 && trackpadPinchIn < firefoxMouseIn);
assert.ok(mouseOut > 0.88 && mouseOut < 0.90);
assert.ok(fastMouseIn < 1.41);

let prevented = 0;
let stopped = 0;
viewerState.viewerTouchMomentumRaf = 17;
api.handleZoomSurfaceWheel({
  ctrlKey: true,
  metaKey: false,
  deltaY: -100,
  deltaMode: WheelEventValue.DOM_DELTA_PIXEL,
  clientX: 420,
  clientY: 280,
  currentTarget: surface,
  preventDefault() { prevented += 1; },
  stopPropagation() { stopped += 1; }
});

assert.equal(prevented, 1);
assert.equal(stopped, 1);
assert.equal(cancelledFrame, 17, 'wheel input must cancel active touch inertia');
assert.equal(viewerState.viewerTouchMomentumRaf, 0);
assert.equal(zoomCalls.length, 1);
assert.ok(zoomCalls[0][0] > 1.11 && zoomCalls[0][0] < 1.13);
assert.deepEqual(zoomCalls[0][1], { showUi: false, focalClientX: 420, focalClientY: 280 });

console.log('viewer_zoom_wheel_logic.test.js: PASS');
