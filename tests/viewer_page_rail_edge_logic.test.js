'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'js', '56-viewer-shell.js'), 'utf8');
const viewerCss = fs.readFileSync(path.join(__dirname, '..', 'src', 'css', '20-viewer.css'), 'utf8');

assert.match(
  viewerCss,
  /--viewer-page-rail-edge-zone:\s*40px;/,
  'the page-rail activation strip should remain exactly 40px wide'
);

function sourceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

const geometrySource = sourceBetween(
  'function getViewportPointer(event)',
  'function openLightboxEdgeUiForPointer(point)'
);

const navRects = {
  prev: { left: 900, right: 946, top: 377, bottom: 423, width: 46, height: 46 },
  next: { left: 54, right: 100, top: 377, bottom: 423, width: 46, height: 46 }
};
const hotspotRect = { left: 960, right: 1000, top: 0, bottom: 800, width: 40, height: 800 };
const geometryApi = new Function(
  'els',
  'window',
  'document',
  `${geometrySource}; return {
    getRightEdgeViewerNavigationRect,
    isPointInPageRailNavigationConflictZone,
    isPointInPageRailEdgeActivationZone
  };`
)(
  {
    prevPageBtn: { getBoundingClientRect: () => navRects.prev },
    nextPageBtn: { getBoundingClientRect: () => navRects.next },
    lightboxSideHotspot: { getBoundingClientRect: () => hotspotRect },
    lightboxPageRail: {}
  },
  { innerWidth: 1000, innerHeight: 800 },
  { documentElement: { clientWidth: 1000, clientHeight: 800 } }
);

assert.deepEqual(geometryApi.getRightEdgeViewerNavigationRect(), navRects.prev);
assert.equal(geometryApi.isPointInPageRailEdgeActivationZone({ x: 961, y: 100 }), true, 'the full-height strip should use the widened edge zone');
assert.equal(geometryApi.isPointInPageRailEdgeActivationZone({ x: 959, y: 100 }), false, 'points outside the strip should not reveal the rail');
assert.equal(geometryApi.isPointInPageRailEdgeActivationZone({ x: 1000, y: 400 }), true, 'the physical viewport edge must remain an activation point');

navRects.prev = { left: 940, right: 986, top: 377, bottom: 423, width: 46, height: 46 };
assert.equal(geometryApi.isPointInPageRailNavigationConflictZone({ x: 962, y: 400 }), true);
assert.equal(geometryApi.isPointInPageRailEdgeActivationZone({ x: 962, y: 400 }), false, 'an overlapping navigation button must keep its own hit area');
assert.equal(geometryApi.isPointInPageRailEdgeActivationZone({ x: 995, y: 400 }), true, 'the physical edge beside the button must still reveal the rail');

const hoverSource = sourceBetween(
  'function hasHoverPointer()',
  'function showPageRailTemporarily(delay = 2600, options = {})'
);
const hoverState = {
  lastTouchLikeViewportInputAt: 0,
  lastTouchLikeRailInputAt: 0
};
const hoverApi = new Function(
  'window',
  'state',
  'isViewerSessionOpen',
  `${hoverSource}; return { shouldUseLightboxHoverPointer, shouldUsePageRailHover };`
)(
  { matchMedia: () => ({ matches: false }) },
  hoverState,
  () => true
);

assert.equal(hoverApi.shouldUseLightboxHoverPointer({ type: 'mousemove' }), true, 'observed mouse input must override stale hybrid-device media classification');
assert.equal(hoverApi.shouldUseLightboxHoverPointer({ type: 'pointermove', pointerType: 'mouse' }), true);
assert.equal(hoverApi.shouldUseLightboxHoverPointer({ type: 'pointermove', pointerType: 'touch' }), false);
hoverState.lastTouchLikeViewportInputAt = Date.now();
assert.equal(hoverApi.shouldUseLightboxHoverPointer({ type: 'mousemove' }), false, 'synthetic mouse input immediately after touch must stay suppressed');

console.log('viewer_page_rail_edge_logic.test.js: PASS');
