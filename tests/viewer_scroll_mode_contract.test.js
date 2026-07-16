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
assert.match(app, /viewerLayoutMode: VIEWER_LAYOUT_SIDE/);
assert.match(app, /function setViewerLayoutMode\(layoutMode, options = \{\}\)/);
assert.match(app, /function toggleViewerLayoutMode\(\)/);
assert.match(app, /function renderViewerScrollPages\(\)/);
assert.match(app, /function loadViewerScrollWindow\(centerPage\)/);
assert.match(app, /for \(let page = Math\.max\(1, center - 2\); page <= Math\.min\(state\.catalog\.pages, center \+ 2\); page \+= 1\)/);
assert.match(app, /function handleViewerScrollPagesScroll\(\)/);
assert.match(app, /viewerScrollPages\?\.addEventListener\("scroll", handleViewerScrollPagesScroll, \{ passive: true \}\)/);
assert.match(app, /scrollToPage: isScrollViewerMode\(\)/);
assert.match(app, /function scrollViewerByViewport\(direction\)/);
assert.match(app, /getZoomSurfaceName\(surface\)[\s\S]*?!isScrollViewerMode\(\)/);

assert.match(css, /\.viewer-control-separator\s*\{/);
assert.match(css, /\.viewer-layout-toggle\[data-viewer-layout="scroll"\]/);
assert.match(css, /\.viewer-scroll-pages\s*\{[\s\S]*?overflow-y:\s*auto;/);
assert.match(css, /\.viewer-scroll-page\s*\{[\s\S]*?scroll-snap-align:\s*center;/);
assert.match(css, /\.lightbox\.viewer-layout-scroll \.stage-canvas\s*\{[\s\S]*?touch-action:\s*pan-y;/);

console.log('viewer_scroll_mode_contract.test.js: PASS');
