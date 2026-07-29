'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { importFrontendTestModule } = require('./frontend_test_module');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/js/56-viewer-shell.js'), 'utf8');
const viewerCss = fs.readFileSync(path.join(root, 'src/css/20-viewer.css'), 'utf8');
assert.match(viewerCss, /--viewer-page-rail-edge-zone:\s*40px;/);
assert.match(viewerCss, /\.lightbox-floating-preview\s*\{[^}]*width:\s*fit-content;[^}]*min-width:\s*0;/);
assert.match(viewerCss, /\.lightbox-floating-preview img\s*\{[^}]*width:\s*auto;[^}]*height:\s*auto;[^}]*max-width:\s*min\(420px, calc\(100vw - 46px\)\);/);
assert.match(viewerCss, /\.lightbox-floating-preview\.from-page-rail\s*\{[^}]*width:\s*fit-content;/);
assert.match(source, /const previewRect = preview\.getBoundingClientRect\(\);/);
assert.match(source, /previewImage\.removeAttribute\("width"\);[\s\S]*?previewImage\.removeAttribute\("height"\);[\s\S]*?previewImage\.onload = \(\) => positionLightboxFloatingPreview\(button\);/);
assert.doesNotMatch(source, /Math\.max\(240, preview\.(?:offsetWidth|offsetHeight)/);
assert.doesNotMatch(source, /applyCatalogImageDimensions\(viewerElements\.lightboxFloatingPreviewImage/);

const navRects = {
  prev: { left: 900, right: 946, top: 377, bottom: 423, width: 46, height: 46 },
  next: { left: 54, right: 100, top: 377, bottom: 423, width: 46, height: 46 }
};
const hotspotRect = { left: 960, right: 1000, top: 0, bottom: 800, width: 40, height: 800 };
const viewerState = { lastTouchLikeViewportInputAt: 0, lastTouchLikeRailInputAt: 0 };
Object.assign(globalThis, {
  window: { innerWidth: 1000, innerHeight: 800, matchMedia: () => ({ matches: false }) },
  document: { documentElement: { clientWidth: 1000, clientHeight: 800 } },
  viewerState,
  viewerElements: {
    prevPageBtn: { getBoundingClientRect: () => navRects.prev },
    nextPageBtn: { getBoundingClientRect: () => navRects.next },
    lightboxSideHotspot: { getBoundingClientRect: () => hotspotRect },
    lightboxPageRail: {}
  },
  requiredElement: () => ({}),
  isViewerSessionOpen: () => true
});
Object.defineProperty(globalThis, 'navigator', { value: {}, writable: true, configurable: true });
window.BARGIG_CATALOG_TAXONOMY = { categories: [], subcategories: [] };
window.location = { href: 'https://example.test/' };
const shared = importFrontendTestModule('src/js/20-shared-ui.js', 'shared-ui');
global.hasHoverPointer = shared.hasHoverPointer;
global.isTouchLikePointer = shared.isTouchLikePointer;
const shell = importFrontendTestModule('src/js/56-viewer-shell.js', 'viewer-shell');

assert.deepEqual(shell.getRightEdgeViewerNavigationRect(), navRects.prev);
assert.equal(shell.isPointInPageRailEdgeActivationZone({ x: 961, y: 100 }), true);
assert.equal(shell.isPointInPageRailEdgeActivationZone({ x: 959, y: 100 }), false);
assert.equal(shell.isPointInPageRailEdgeActivationZone({ x: 1000, y: 400 }), true);
navRects.prev = { left: 940, right: 986, top: 377, bottom: 423, width: 46, height: 46 };
assert.equal(shell.isPointInPageRailNavigationConflictZone({ x: 962, y: 400 }), true);
assert.equal(shell.isPointInPageRailEdgeActivationZone({ x: 962, y: 400 }), false);
assert.equal(shell.isPointInPageRailEdgeActivationZone({ x: 995, y: 400 }), true);

assert.equal(shell.shouldUseLightboxHoverPointer({ type: 'mousemove' }), true);
assert.equal(shell.shouldUseLightboxHoverPointer({ type: 'pointermove', pointerType: 'mouse' }), true);
assert.equal(shell.shouldUseLightboxHoverPointer({ type: 'pointermove', pointerType: 'touch' }), false);
viewerState.lastTouchLikeViewportInputAt = Date.now();
assert.equal(shell.shouldUseLightboxHoverPointer({ type: 'mousemove' }), false);

console.log('viewer_page_rail_edge_logic.test.js: PASS');
