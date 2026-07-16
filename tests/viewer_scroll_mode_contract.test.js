'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

for (const html of [template, viewer]) {
  assert.match(html, /id="lightboxMobileSearchToggle"[\s\S]*?id="viewerLayoutToggle"[\s\S]*?class="viewer-control-separator"[\s\S]*?id="fitHeightBtn"/);
  assert.match(html, /id="viewerLayoutToggle"[^>]*data-viewer-layout="side"/);
  assert.match(html, /class="viewer-layout-icon viewer-layout-icon-scroll"/);
  assert.match(html, /class="viewer-layout-icon viewer-layout-icon-side"/);
  assert.match(html, /id="viewerScrollPages"[^>]*role="list"/);
}

assert.match(app, /const VIEWER_LAYOUT_SIDE = "side";/);
assert.match(app, /const VIEWER_LAYOUT_SCROLL = "scroll";/);
assert.match(app, /const VIEWER_LAYOUT_STORAGE_KEY = "bargig\.viewer-layout\.v1";/);
assert.match(app, /function readViewerLayoutPreference\(\)/);
assert.match(app, /function writeViewerLayoutPreference\(layoutMode\)/);
assert.match(app, /viewerLayoutMode: readViewerLayoutPreference\(\)/);
assert.match(app, /state\.viewerLayoutMode = source === LIGHTBOX_SOURCE_FAVORITES[\s\S]*?readViewerLayoutPreference\(\)/);
assert.match(app, /function setViewerLayoutMode\(layoutMode, options = \{\}\)/);
assert.match(app, /writeViewerLayoutPreference\(nextMode\)/);
assert.match(app, /function toggleViewerLayoutMode\(\)/);
assert.match(app, /function renderViewerScrollPages\(\)/);
assert.match(app, /function loadViewerScrollWindow\(centerPage\)/);
assert.match(app, /for \(let page = Math\.max\(1, center - 2\); page <= Math\.min\(state\.catalog\.pages, center \+ 2\); page \+= 1\)/);
assert.match(app, /function handleViewerScrollPagesScroll\(\)/);
assert.match(app, /viewerScrollPages\?\.addEventListener\("scroll", handleViewerScrollPagesScroll, \{ passive: true \}\)/);
assert.match(app, /scrollToPage: isScrollViewerMode\(\)/);
assert.match(app, /function scrollViewerByViewport\(direction\)/);
assert.match(app, /getZoomSurfaceName\(surface\)[\s\S]*?surface === els\.viewerScrollPages && isScrollViewerMode\(\)/);
assert.match(app, /function isActiveZoomSurface\(surface\)\s*\{[\s\S]*?Boolean\(getZoomSurfaceName\(surface\)\)/);
assert.match(app, /attachZoomSurfaceGestures\(els\.viewerScrollPages\)/);
assert.match(app, /function getViewerScrollZoomAnchor\(clientX = null, clientY = null\)/);
assert.match(app, /function applyViewerScrollZoom\(anchor = null, options = \{\}\)/);
assert.match(app, /function isViewerScrollIsolatedZoom\(\)/);
assert.match(app, /function enterViewerScrollIsolatedZoom\(nextZoom, focalClientX = null, focalClientY = null\)/);
assert.match(app, /function exitViewerScrollIsolatedZoom\(options = \{\}\)/);
assert.match(app, /function panViewerScrollIsolatedZoomByWheel\(deltaX = 0, deltaY = 0\)/);
assert.match(app, /const remainingDeltaY = safeDeltaY - consumedDeltaY;/);
assert.match(app, /const hasVerticalExitIntent = Math\.abs\(safeDeltaY\) > Math\.abs\(safeDeltaX\) \* 0\.5;/);
assert.match(app, /if \(nextPage === state\.page\) return;/);
assert.match(app, /zoom > AUTO_VIEWER_ZOOM \+ 0\.001/);
assert.match(app, /const zoom = Math\.min\(AUTO_VIEWER_ZOOM, getSafeViewerZoom\(\)\)/);
assert.match(app, /container\.scrollTop = top;/);
assert.match(app, /function runViewerScrollPageSwapAnimation\(page\)/);
assert.match(app, /updateLightbox\(\{[\s\S]*?scrollToPage: isScrollViewerMode\(\)[\s\S]*?scrollBehavior: "auto"/);
assert.match(app, /const showButton = Boolean\(state\.lightboxOpen && !isAutoViewerZoom\(\)\)/);

assert.match(css, /\.viewer-control-separator\s*\{/);
assert.match(css, /\.viewer-layout-toggle\[data-viewer-layout="scroll"\]/);
assert.match(css, /\.viewer-scroll-pages\s*\{[\s\S]*?overflow-x:\s*auto;[\s\S]*?overflow-y:\s*auto;/);
assert.match(css, /\.viewer-scroll-pages\s*\{[\s\S]*?touch-action:\s*pan-x pan-y;/);
assert.match(css, /\.viewer-scroll-page\s*\{[\s\S]*?scroll-snap-align:\s*center;/);
assert.match(css, /\.viewer-scroll-page\s*\{[\s\S]*?width:\s*var\(--viewer-scroll-page-width/);
assert.match(css, /\.lightbox\.viewer-layout-scroll \.stage-canvas\s*\{[\s\S]*?touch-action:\s*pan-x pan-y;/);
assert.match(css, /\.lightbox\.viewer-layout-scroll\.viewer-scroll-zoom-isolated \.viewer-scroll-pages\s*\{[\s\S]*?visibility:\s*hidden;/);
assert.match(css, /\.viewer-scroll-page\.page-swap-enter\s*\{/);
assert.doesNotMatch(css, /\.lightbox\.viewer-layout-scroll \.viewer-zoom-indicator\s*\{[\s\S]*?display:\s*none/);

console.log('viewer_scroll_mode_contract.test.js: PASS');
