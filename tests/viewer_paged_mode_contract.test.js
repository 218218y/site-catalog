'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readBundle, readCssBundle } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const template = read('site.template.html');
const viewer = read('viewer.html');
const app = readBundle('viewer');
const css = readCssBundle('viewer');
const stateSource = read('src/js/16-viewer-state.js');
const geometry = read('src/js/54-viewer-geometry.js');
const shell = read('src/js/56-viewer-shell.js');
const navigation = read('src/js/58-viewer-navigation.js');
const viewerSource = read('src/js/60-viewer.js');
const input = read('src/js/70-viewer-input.js');
const bootstrap = read('src/js/90-bootstrap.js');

for (const html of [template, viewer]) {
  assert.match(html, /id="lightboxMobileSearchToggle"[\s\S]*?id="fitAutoBtn"[\s\S]*?id="fitHeightBtn"/);
  assert.match(html, /id="lightboxImageFrame"[\s\S]*?id="lightboxImage"/);
  assert.doesNotMatch(html, /id="viewerScrollPages"|id="viewerLayoutToggle"|viewer-layout-icon-(?:scroll|side)/);
}

assert.doesNotMatch(stateSource, /VIEWER_LAYOUT_(?:SIDE|SCROLL)|viewerLayoutMode|viewerScroll/);
assert.match(stateSource, /const VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX = 20;/);
assert.match(stateSource, /const VIEWER_PAGE_WHEEL_PAGE_DELTA_PX = 100;/);
assert.match(stateSource, /const VIEWER_PAGE_WHEEL_SETTLE_MS = 150;/);
assert.match(stateSource, /const VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO = 0\.36;/);
assert.match(stateSource, /const VIEWER_PAGE_TURN_BUFFER_MIN_PX = 144;/);
assert.match(stateSource, /const VIEWER_PAGE_TURN_BUFFER_MAX_PX = 330;/);
assert.match(stateSource, /const VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS = 0\.08;/);
assert.match(stateSource, /const VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS = 0\.0048;/);
assert.match(stateSource, /singleImagePendingRelativePosition: null/);
assert.match(stateSource, /singleImagePendingPageTurnOrigin: null/);
assert.match(stateSource, /viewerTouchMomentumRaf: 0/);
assert.match(stateSource, /viewerPageWheelAccumulator: 0/);
assert.doesNotMatch(stateSource, /viewerPageWheelLocked|viewerPageWheelUnlockTimer|singlePageTurnPointerId/);

assert.match(shell, /function syncViewerLayoutModeUi\(\)[\s\S]*?classList\.add\("viewer-layout-paged"\)/);
assert.match(shell, /function syncViewerLayoutModeUi\(\)[\s\S]*?lightboxImageFrame\?\.classList\.remove\("hidden"\)/);
assert.doesNotMatch(viewerSource, /renderViewerScrollPages|loadViewerScrollWindow|handleViewerScrollPagesScroll/);
assert.match(viewerSource, /const preserveFullResolutionTier = !isAutoViewerZoom\(\)[\s\S]*?const request = viewerPageImageRequest\(catalog, activePage\(\), \{[\s\S]*?forceFull: preserveFullResolutionTier[\s\S]*?showSingleLightboxImage/);
assert.match(viewerSource, /function moveLightbox\(delta, options = \{\}\)[\s\S]*?setFavoriteViewerIndex\(\(getFeatureInterface\("favorites"\)\?\.viewerIndex\(\) \?\? 0\) \+ delta, options\)[\s\S]*?setLightboxPage\(activePage\(\) \+ delta, options\)/);

assert.match(geometry, /function captureSingleImageRelativePosition\(\)/);
assert.match(geometry, /viewerState\.panX \/ metrics\.overflowX/);
assert.match(geometry, /viewerState\.panY \/ metrics\.overflowY/);
assert.match(geometry, /function queueSingleImageRelativePosition\(page, position = null\)/);
assert.match(geometry, /function queueSingleImagePageTurnOrigin\(page, direction, axis = "y"\)/);
assert.match(geometry, /pageTurnOrigin\.direction > 0 \? metrics\.overflowY : -metrics\.overflowY/);
assert.match(geometry, /metrics\.overflowX \* relativePosition\.xRatio/);
assert.match(geometry, /metrics\.overflowY \* relativePosition\.yRatio/);
assert.match(geometry, /function getViewerPageTurnBuffer\(axis = "y"\)[\s\S]*?VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO[\s\S]*?VIEWER_PAGE_TURN_BUFFER_MIN_PX[\s\S]*?VIEWER_PAGE_TURN_BUFFER_MAX_PX/);
assert.match(geometry, /function consumeSingleViewerPanInput\(deltaX = 0, deltaY = 0\)/);
assert.match(geometry, /remainingDeltaX: safeDeltaX - consumedDeltaX/);
assert.match(geometry, /remainingDeltaY: safeDeltaY - consumedDeltaY/);
assert.match(geometry, /getSafeViewerZoom\(\) > AUTO_VIEWER_ZOOM \+ 0\.001 \|\| singleImageCanPan\(\)/);

assert.match(navigation, /function normalizeViewerPageWheelDeltas\(event\)/);
assert.match(navigation, /function getViewerPageWheelRequestedSteps\(accumulator\)/);
assert.match(navigation, /function consumeSingleViewerBoundaryInput\(deltaX = 0, deltaY = 0, options = \{\}\)/);
assert.match(navigation, /function getSingleViewerPageTurnIntent[\s\S]*?const remaining = result\.remainingDeltaY;[\s\S]*?axis: "y"/);
assert.doesNotMatch(navigation, /remainingDeltaX[\s\S]{0,240}page-turn intent/);
assert.match(navigation, /function getViewerPageTurnNavigationOptions\(direction, axis = "y", options = \{\}\)[\s\S]*?resetViewOnPageTurn[\s\S]*?!isAutoViewerZoom\(\)[\s\S]*?keepZoom: false[\s\S]*?resetZoom: true[\s\S]*?resetPosition: true[\s\S]*?positionMode: "auto"/);
assert.match(navigation, /function getViewerPageTurnNavigationOptions\(direction, axis = "y", options = \{\}\)[\s\S]*?keepZoom: true[\s\S]*?positionMode: "page-turn"[\s\S]*?pageTurnDirection: step/);
assert.match(navigation, /function moveLightboxFromPageTurn\(direction, axis = "y", options = \{\}\)[\s\S]*?getViewerPageTurnNavigationOptions\(step, axis, options\)/);
assert.match(navigation, /if \(singleViewerUsesBoundaryPan\(\)\)[\s\S]*?consumeSingleViewerBoundaryInput\(deltaX, deltaY, \{ resetViewOnPageTurn: true \}\)/);
assert.doesNotMatch(navigation, /viewerPageWheelLocked|keepViewerPageWheelLockedUntilSettle|unlockViewerPageWheel/);
assert.doesNotMatch(navigation, /renderViewerScrollPages|scrollTop|scrollIntoView|viewerScroll/);

assert.match(viewerSource, /preservePointerInteraction = false/);
assert.match(viewerSource, /if \(!preservePointerInteraction\) viewerState\.pointers\.clear\(\)/);
assert.match(viewerSource, /const currentCatalog = activeCatalog\(\);[\s\S]*?const preserveCurrentGeometry = Boolean\([\s\S]*?viewerElements\.lightboxImage\?\.complete[\s\S]*?viewerElements\.lightboxImage\.naturalWidth > 0[\s\S]*?catalogPagesShareAspectRatio\(previousCatalog, previousPage, currentCatalog, activePage\(\)\)[\s\S]*?\);[\s\S]*?const geometryPrimed = Boolean\(currentCatalog && !preserveCurrentGeometry[\s\S]*?primeLightboxFrameForCatalogPage\(currentCatalog, activePage\(\)\)\);[\s\S]*?if \(geometryPrimed\) applyZoom\(\);[\s\S]*?updateLightbox\(\{ thumbScrollIntoView, preserveCurrentImage: preserveCurrentGeometry \}\)/);

assert.match(input, /function handleViewerPageSwipe\(event, startedX, startedY\)[\s\S]*?isTouchLikePointer\(event\)/);
assert.match(input, /const direction = horizontal[\s\S]*?dx > 0 \? 1 : -1[\s\S]*?dy < 0 \? 1 : -1/);
assert.match(input, /if \(horizontal\)[\s\S]*?keepZoom: true[\s\S]*?positionMode: "page-turn"[\s\S]*?pageTurnAxis: "x"/);
assert.match(input, /else \{[\s\S]*?moveLightboxFromPageTurn\(direction, "y", \{ resetViewOnPageTurn: true \}\)/);
assert.match(input, /consumeSingleViewerBoundaryInput\(totalDeltaX, totalDeltaY, \{[\s\S]*?pointerId: event\.pointerId,[\s\S]*?resetViewOnPageTurn: true/);
assert.match(input, /consumeSingleViewerBoundaryInput\([\s\S]*?velocityX \* elapsed,[\s\S]*?velocityY \* elapsed,[\s\S]*?\{ resetViewOnPageTurn: true \}/);
assert.match(input, /viewerState\.pointerGestureConsumedPan/);
assert.match(input, /function getViewerPointerMoveSamples\(event\)/);
assert.match(input, /getCoalescedEvents\(\)/);
assert.match(input, /function startViewerTouchMomentum\(velocityX, velocityY\)/);
assert.match(input, /function runViewerTouchMomentumFrame\(timestamp\)/);
assert.match(input, /Math\.exp\(-VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS \* elapsed\)/);
assert.match(input, /if \(pan\.handled\) viewerState\.pointerGestureConsumedPan = true;/);
assert.match(input, /function captureViewerPointer\(surface, pointerId\)/);
assert.match(input, /function releaseViewerPointerCapture\(surface, pointerId\)/);
assert.match(input, /hasPointerCapture\(pointerId\)/);
assert.doesNotMatch(input, /singlePageTurnPointerId/);
assert.match(input, /attachZoomSurfaceGestures\(viewerElements\.stageCanvas\)/);
assert.doesNotMatch(input, /viewerScrollPages|PointerHandoff|IsolatedZoom/);

assert.match(viewerSource, /\["ArrowDown", "PageDown"\]\.includes\(event\.key\)[\s\S]*?moveLightbox\(1\)/);
assert.match(viewerSource, /\["ArrowUp", "PageUp"\]\.includes\(event\.key\)[\s\S]*?moveLightbox\(-1\)/);
assert.match(viewerSource, /event\.key === "ArrowRight"[\s\S]*?moveLightbox\(-1\)/);
assert.match(viewerSource, /event\.key === "ArrowLeft"[\s\S]*?moveLightbox\(1\)/);

assert.match(css, /\.stage-canvas\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?touch-action:\s*none;/);
assert.match(css, /\.lightbox-image-frame\.page-swap-enter\s*\{[\s\S]*?animation:\s*viewer-page-swap-enter/);
assert.match(css, /@keyframes viewer-page-swap-enter\s*\{[\s\S]*?opacity:\s*var\(--image-swap-start-opacity\);[\s\S]*?scale:\s*\.988;/);
assert.doesNotMatch(css, /\.viewer-scroll-pages|\.viewer-scroll-page|viewer-scroll-zoom-isolated/);

assert.doesNotMatch(app, /function renderViewerScrollPages|id="viewerScrollPages"|VIEWER_LAYOUT_SCROLL|VIEWER_LAYOUT_SIDE/);

console.log('viewer_paged_mode_contract.test.js: PASS');
