'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findCalls, hasPropertyPath, inventoryProjectFiles } = require('./helpers/frontend_ast.js');
const { readBundle, readCssBundle } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const template = read('site.template.html');
const viewer = read('viewer.html');
const app = readBundle('viewer');
const css = readCssBundle('viewer');

const javascriptFiles = {
  state: 'src/js/16-viewer-state.js',
  transitions: 'src/js/17-viewer-state-transitions.js',
  geometry: 'src/js/54-viewer-geometry.js',
  shell: 'src/js/56-viewer-shell.js',
  navigation: 'src/js/58-viewer-navigation.js',
  pageController: 'src/js/59-viewer-page-controller.js',
  viewer: 'src/js/60-viewer.js',
  input: 'src/js/70-viewer-input.js',
  bootstrap: 'src/js/90-bootstrap.js',
};
const projectInventories = inventoryProjectFiles(root, Object.values(javascriptFiles));
const ast = Object.fromEntries(
  Object.entries(javascriptFiles).map(([key, relative]) => [key, projectInventories[relative]]),
);
const functions = (key) => new Set(ast[key].functionDeclarations);
const identifiers = (key) => new Set(ast[key].identifiers);
const strings = (key) => new Set(ast[key].stringLiterals);
const callsIn = (key, functionName, callee) => findCalls(ast[key], callee)
  .filter((call) => call.enclosingFunction === functionName);

for (const html of [template, viewer]) {
  assert.match(html, /id="lightboxMobileSearchToggle"[\s\S]*?id="fitAutoBtn"[\s\S]*?id="fitHeightBtn"/);
  assert.match(html, /id="lightboxImageFrame"[\s\S]*?id="lightboxImage"/);
  assert.doesNotMatch(html, /id="viewerScrollPages"|id="viewerLayoutToggle"|viewer-layout-icon-(?:scroll|side)/);
}

for (const retired of [
  'VIEWER_LAYOUT_SIDE', 'VIEWER_LAYOUT_SCROLL', 'viewerLayoutMode', 'viewerScroll',
  'viewerPageWheelLocked', 'viewerPageWheelUnlockTimer', 'singlePageTurnPointerId',
]) {
  assert.equal(identifiers('state').has(retired), false, `viewer state must not retain ${retired}`);
}
assert.deepEqual(
  Object.fromEntries([
    'VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX',
    'VIEWER_PAGE_WHEEL_PAGE_DELTA_PX',
    'VIEWER_PAGE_WHEEL_SETTLE_MS',
    'VIEWER_PAGE_WHEEL_RESET_RESTART_GAP_MS',
    'VIEWER_PAGE_WHEEL_RESET_ACCELERATION_RATIO',
    'VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO',
    'VIEWER_PAGE_TURN_BUFFER_MIN_PX',
    'VIEWER_PAGE_TURN_BUFFER_MAX_PX',
    'VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS',
    'VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS',
  ].map((name) => [name, ast.state.literalDeclarations[name]])),
  {
    VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX: 20,
    VIEWER_PAGE_WHEEL_PAGE_DELTA_PX: 100,
    VIEWER_PAGE_WHEEL_SETTLE_MS: 150,
    VIEWER_PAGE_WHEEL_RESET_RESTART_GAP_MS: 48,
    VIEWER_PAGE_WHEEL_RESET_ACCELERATION_RATIO: 1.4,
    VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO: 0.36,
    VIEWER_PAGE_TURN_BUFFER_MIN_PX: 144,
    VIEWER_PAGE_TURN_BUFFER_MAX_PX: 330,
    VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS: 0.08,
    VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS: 0.0048,
  },
);
for (const field of [
  'singleImagePendingRelativePosition', 'singleImagePendingPageTurnOrigin', 'viewerTouchMomentumRaf',
  'viewerPageWheelAccumulator', 'viewerPageWheelResetGestureActive', 'viewerPageWheelResetLastEventAt',
  'viewerPageWheelResetLastDelta', 'viewerPageWheelResetDirection',
]) {
  const declared = Object.values(ast.state.objectDeclarations).some((properties) => properties.includes(field));
  assert.equal(declared, true, `viewer state must own ${field}`);
}

for (const [key, names] of Object.entries({
  shell: ['syncViewerLayoutModeUi'],
  pageController: ['moveLightbox'],
  geometry: [
    'captureSingleImageRelativePosition', 'getViewerPageTurnBuffer', 'consumeSingleViewerPanInput',
    'applyPendingSingleImagePosition',
  ],
  transitions: ['createViewerNavigationCommand'],
  navigation: [
    'normalizeViewerPageWheelDeltas', 'getViewerPageWheelRequestedSteps', 'consumeSingleViewerBoundaryInput',
    'getSingleViewerPageTurnIntent', 'getViewerPageTurnNavigationCommand', 'moveLightboxFromPageTurn',
    'consumeViewerPageWheelResetContinuation', 'handleViewerPageWheel', 'clearViewerPageWheelGesture',
  ],
  input: [
    'handleViewerPageSwipe', 'getViewerPointerMoveSamples', 'startViewerTouchMomentum',
    'runViewerTouchMomentumFrame', 'captureViewerPointer', 'releaseViewerPointerCapture',
  ],
})) {
  for (const name of names) {
    assert.equal(functions(key).has(name), true, `${javascriptFiles[key]} must own ${name}`);
  }
}

assert.equal(strings('shell').has('viewer-layout-paged'), true);
assert.equal(callsIn('pageController', 'updateLightbox', 'viewerPageImageRequest').length > 0, true);
assert.equal(callsIn('pageController', 'beginPageControllerTransition', 'beginViewerPageTransitionCommand').length > 0, true);
assert.equal(callsIn('navigation', 'getViewerPageTurnNavigationCommand', 'createViewerNavigationCommand').length > 0, true);
assert.equal(callsIn('navigation', 'moveLightboxFromPageTurn', 'moveLightbox').length > 0, true);
assert.equal(callsIn('navigation', 'consumeSingleViewerBoundaryInput', 'consumeSingleViewerPanInput').length > 0, true);
assert.equal(callsIn('navigation', 'consumeViewerPageWheelResetContinuation', 'clearViewerPageWheelGesture').length > 0, true);
assert.equal(callsIn('navigation', 'handleViewerPageWheel', 'consumeViewerPageWheelResetContinuation').length > 0, true);
assert.equal(callsIn('navigation', 'handleViewerPageWheel', 'consumeSingleViewerBoundaryInput').length > 0, true);
assert.equal(callsIn('input', 'handleViewerPageSwipe', 'createViewerNavigationCommand').length > 0, true);
assert.equal(callsIn('input', 'handleViewerPageSwipe', 'moveLightboxFromPageTurn').length > 0, true);
assert.equal(callsIn('input', 'runViewerTouchMomentumFrame', 'consumeSingleViewerBoundaryInput').length > 0, true);
assert.equal(findCalls(ast.input, 'attachZoomSurfaceGestures').length > 0, true);
assert.equal(hasPropertyPath(ast.input, 'viewerGestureState.pointerGestureConsumedPan'), true);
assert.equal(ast.input.propertyAccesses.some((entry) => entry.property === 'hasPointerCapture'), true);

for (const retired of [
  'renderViewerScrollPages', 'loadViewerScrollWindow', 'handleViewerScrollPagesScroll',
  'viewerScrollPages', 'PointerHandoff', 'IsolatedZoom', 'singlePageTurnPointerId',
]) {
  assert.equal(identifiers('viewer').has(retired) || identifiers('input').has(retired), false, `paged viewer must not retain ${retired}`);
}
assert.equal(functions('geometry').has('queueSingleImageRelativePosition'), false);
assert.equal(functions('geometry').has('queueSingleImagePageTurnOrigin'), false);
assert.equal(findCalls(ast.viewer, 'moveLightbox').length > 0, true, 'keyboard navigation must delegate to moveLightbox');
assert.equal(ast.bootstrap.topLevelStatementCount < 10, true, 'bootstrap must remain a minimal startup owner');

assert.match(css, /\.stage-canvas\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?touch-action:\s*none;/);
assert.match(css, /\.lightbox-image-frame\.page-swap-enter\s*\{[\s\S]*?animation:\s*viewer-page-swap-enter/);
assert.match(css, /@keyframes viewer-page-swap-enter\s*\{[\s\S]*?opacity:\s*var\(--image-swap-start-opacity\);[\s\S]*?scale:\s*\.988;/);
assert.doesNotMatch(css, /\.viewer-scroll-pages|\.viewer-scroll-page|viewer-scroll-zoom-isolated/);
assert.doesNotMatch(app, /function renderViewerScrollPages|id="viewerScrollPages"|VIEWER_LAYOUT_SCROLL|VIEWER_LAYOUT_SIDE/);

console.log('viewer_paged_mode_contract.test.js: PASS');
