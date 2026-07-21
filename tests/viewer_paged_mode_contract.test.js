'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const template = read('site.template.html');
const viewer = read('viewer.html');
const app = read('app.js');
const css = read('styles.css');
const stateSource = read('src/js/10-app-state.js');
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
assert.match(stateSource, /singleImagePendingRelativePosition: null/);
assert.match(stateSource, /singleImagePendingPageTurnOrigin: null/);
assert.match(stateSource, /viewerPageWheelAccumulator: 0/);
assert.match(stateSource, /viewerPageWheelLocked: false/);

assert.match(shell, /function syncViewerLayoutModeUi\(\)[\s\S]*?classList\.add\("viewer-layout-paged"\)/);
assert.match(shell, /function syncViewerLayoutModeUi\(\)[\s\S]*?lightboxImageFrame\?\.classList\.remove\("hidden"\)/);
assert.doesNotMatch(viewerSource, /renderViewerScrollPages|loadViewerScrollWindow|handleViewerScrollPagesScroll/);
assert.match(viewerSource, /const request = viewerPageImageRequest\(catalog, state\.page\);[\s\S]*?showSingleLightboxImage/);
assert.match(viewerSource, /function moveLightbox\(delta, options = \{\}\)[\s\S]*?setFavoriteViewerIndex\(state\.favoritesViewerIndex \+ delta, options\)[\s\S]*?setLightboxPage\(state\.page \+ delta, options\)/);

assert.match(geometry, /function captureSingleImageRelativePosition\(\)/);
assert.match(geometry, /state\.panX \/ metrics\.overflowX/);
assert.match(geometry, /state\.panY \/ metrics\.overflowY/);
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
assert.match(navigation, /function moveLightboxFromPageTurn\(direction, axis = "y"\)[\s\S]*?positionMode: "page-turn"[\s\S]*?keepZoom: true/);
assert.match(navigation, /if \(singleViewerUsesBoundaryPan\(\)\)[\s\S]*?consumeSingleViewerBoundaryInput\(deltaX, deltaY\)/);
assert.match(navigation, /keepViewerPageWheelLockedUntilSettle/);
assert.doesNotMatch(navigation, /renderViewerScrollPages|scrollTop|scrollIntoView|viewerScroll/);

assert.match(input, /function handleViewerPageSwipe\(event, startedX, startedY\)[\s\S]*?isTouchLikePointer\(event\)/);
assert.match(input, /const direction = horizontal[\s\S]*?dx > 0 \? 1 : -1[\s\S]*?dy < 0 \? 1 : -1/);
assert.match(input, /positionMode: "page-turn"/);
assert.match(input, /state\.pointerGestureConsumedPan/);
assert.match(input, /state\.singlePageTurnPointerId === event\.pointerId/);
assert.match(input, /attachZoomSurfaceGestures\(els\.stageCanvas\)/);
assert.doesNotMatch(input, /viewerScrollPages|PointerHandoff|IsolatedZoom/);

assert.match(bootstrap, /\["ArrowDown", "PageDown"\]\.includes\(event\.key\)[\s\S]*?moveLightbox\(1\)/);
assert.match(bootstrap, /\["ArrowUp", "PageUp"\]\.includes\(event\.key\)[\s\S]*?moveLightbox\(-1\)/);
assert.match(bootstrap, /event\.key === "ArrowRight"[\s\S]*?moveLightbox\(-1\)/);
assert.match(bootstrap, /event\.key === "ArrowLeft"[\s\S]*?moveLightbox\(1\)/);

assert.match(css, /\.stage-canvas\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?touch-action:\s*none;/);
assert.match(css, /\.lightbox-image-frame\.page-swap-enter\s*\{[\s\S]*?animation:\s*viewer-page-swap-enter/);
assert.match(css, /@keyframes viewer-page-swap-enter\s*\{[\s\S]*?opacity:\s*var\(--image-swap-start-opacity\);[\s\S]*?scale:\s*\.988;/);
assert.doesNotMatch(css, /\.viewer-scroll-pages|\.viewer-scroll-page|viewer-scroll-zoom-isolated/);

assert.doesNotMatch(app, /function renderViewerScrollPages|id="viewerScrollPages"|VIEWER_LAYOUT_SCROLL|VIEWER_LAYOUT_SIDE/);

console.log('viewer_paged_mode_contract.test.js: PASS');
