'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllBundles, readAllCssBundles } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const app = readAllBundles();
const css = readAllCssBundles();
const catalogCssSource = fs.readFileSync(path.join(root, 'src/css/10-catalog.css'), 'utf8');
const shellCssSource = fs.readFileSync(path.join(root, 'src/css/06-shell-components.css'), 'utf8');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const favorites = fs.readFileSync(path.join(root, 'favorites.html'), 'utf8');
const viewerStateSource = fs.readFileSync(path.join(root, 'src/js/16-viewer-state.js'), 'utf8');
const imageRuntimeSource = fs.readFileSync(path.join(root, 'src/js/20-catalog-runtime.js'), 'utf8');
const favoritesShareSource = fs.readFileSync(path.join(root, 'src/js/30-favorites-share.js'), 'utf8');
const searchUiSource = fs.readFileSync(path.join(root, 'src/js/50-search-ui.js'), 'utf8');
const viewerImageSource = fs.readFileSync(path.join(root, 'src/js/53-viewer-image.js'), 'utf8');
const viewerGeometrySource = fs.readFileSync(path.join(root, 'src/js/54-viewer-geometry.js'), 'utf8');
const viewerShellSource = fs.readFileSync(path.join(root, 'src/js/56-viewer-shell.js'), 'utf8');
const viewerSource = fs.readFileSync(path.join(root, 'src/js/60-viewer.js'), 'utf8');

for (const html of [template, viewer]) {
  assert.match(html, /class="skip-link" href="#main-content"/);
  assert.match(html, /<main id="main-content" tabindex="-1">/);
  assert.match(html, /id="viewerPageIndicator"[\s\S]*?id="viewerPageIndicatorCurrent"[\s\S]*?id="viewerPageIndicatorTotal"/);
  assert.match(html, /id="lightboxProgress"[^>]*role="progressbar"/);
}

for (const html of [template, favorites]) {
  assert.match(html, /id="favoritesEmpty"[\s\S]*?empty-state-icon[\s\S]*?לצפייה בקטלוגים/);
}

assert.match(viewerGeometrySource, /function singleImageFitLayout\(/);
assert.match(viewerGeometrySource, /function applyLightboxFrameGeometry\(/);
assert.match(viewerImageSource, /function applyStableViewerPageGeometry\(/);
assert.match(viewerImageSource, /return applyLightboxFrameGeometry\(width, height, options\)/);
assert.match(viewerImageSource, /loadCatalogImageWithRecovery\(image, \{/);
assert.match(imageRuntimeSource, /function initImagePlaceholderObserver\(/);
assert.match(imageRuntimeSource, /new MutationObserver/);
assert.match(favoritesShareSource, /showFavoritePersistenceFeedback/);
assert.match(favoritesShareSource, /נשמר זמנית בלבד — אחסון המועדפים חסום בדפדפן/);
assert.match(favoritesShareSource, /הוסר מהמועדפים/);
assert.match(favoritesShareSource, /showActionToast\("הקישור הועתק", \{ tone: "link" \}\)/);
assert.match(viewerShellSource, /aria-valuetext/);
assert.match(viewerShellSource, /viewerPageIndicatorCurrent\.textContent/);
assert.match(searchUiSource, /function searchEmptyStateMarkup\(/);
assert.match(searchUiSource, /data-empty-search-clear/);
assert.match(searchUiSource, /data-lightbox-empty-search-clear/);

assert.match(css, /--radius-card:\s*22px/);
assert.match(css, /--brand:\s*#8f6d55/);
assert.match(css, /\.skip-link\s*\{/);
assert.match(css, /--control-height:\s*42px/);
assert.match(css, /\.image-placeholder-frame\.image-loading/);
assert.match(css, /@keyframes image-placeholder-sheen/);
assert.match(css, /\.lightbox-image-frame\s*\{[\s\S]*?contain:\s*layout paint style/);
assert.doesNotMatch(css, /width var\(--image-swap-duration\)|height var\(--image-swap-duration\)/);
assert.match(css, /\.viewer-page-indicator\s*\{/);

const topNavRule = shellCssSource.match(/\.top-nav\s*\{([\s\S]*?)\}/);
assert.ok(topNavRule, 'top navigation layout rule should exist');
assert.match(topNavRule[1], /overflow:\s*hidden/, 'top navigation must retain responsive clipping');
assert.match(topNavRule[1], /padding-block:\s*6px/, 'clipped navigation must leave room for the rounded focus ring');

const topNavLinkRule = shellCssSource.match(/\.top-nav a\s*\{([\s\S]*?)\}/);
assert.ok(topNavLinkRule, 'top navigation link rule should exist');
assert.match(topNavLinkRule[1], /border-radius:\s*999px/, 'category navigation controls must remain pill-shaped');
const topNavLinkShadows = [...topNavLinkRule[1].matchAll(/box-shadow:\s*([^;]+);/g)].map((match) => match[1].trim());
assert.deepEqual(topNavLinkShadows.length, 1, 'category navigation should define one intentional elevation treatment');
assert.match(topNavLinkShadows[0], /^inset\b/, 'clipped category navigation must not restore a rectangular outer shadow');

const topNavHoverRule = shellCssSource.match(/\.top-nav a:hover,\s*\.top-nav a:focus-visible\s*\{([\s\S]*?)\}/);
assert.ok(topNavHoverRule, 'top navigation hover/focus rule should exist');
assert.match(topNavHoverRule[1], /box-shadow:\s*inset\b[^;]*;/, 'hover elevation must remain inset within the rounded control');

const topNavActiveRule = shellCssSource.match(/\.top-nav \.category-nav-link\.active,\s*\.top-nav \.category-nav-link\[aria-current="location"\]\s*\{([\s\S]*?)\}/);
assert.ok(topNavActiveRule, 'active category navigation rule should exist');
assert.match(topNavActiveRule[1], /box-shadow:\s*inset\b[^;]*;/, 'active category elevation must remain inset within the rounded control');

const pageGridRule = catalogCssSource.match(/\.page-grid\s*\{([\s\S]*?)\}/);
assert.ok(pageGridRule, 'catalog page grid rule should exist');
assert.match(
  pageGridRule[1],
  /align-items:\s*start/,
  'mixed-aspect catalog pages must keep each card at its natural height instead of stretching to the tallest page in the row'
);

const pageThumbRule = css.match(/\.page-thumb\s*\{([\s\S]*?)\}/);
assert.ok(pageThumbRule, 'catalog preview thumbnail rule should exist');
assert.match(pageThumbRule[1], /width:\s*100%/);
assert.match(pageThumbRule[1], /height:\s*auto/, 'preview thumbnails must override intrinsic height attributes after responsive width sizing');
assert.match(pageThumbRule[1], /aspect-ratio:\s*var\(--page-thumb-aspect-ratio/, 'preview thumbnails must keep each catalog page ratio');
assert.match(pageThumbRule[1], /object-fit:\s*contain/);

const placeholderRule = css.match(/\.image-placeholder-frame\s*\{([\s\S]*?)\}/);
assert.ok(placeholderRule, 'shared image placeholder rule should exist');
assert.doesNotMatch(placeholderRule[1], /position\s*:/, 'placeholder styling must not override the viewer frame layout position');
assert.match(css, /\.lightbox-image-frame\s*\{[\s\S]*?position:\s*absolute/);
assert.match(css, /\.lightbox-image-frame\s*\{[\s\S]*?top:\s*50%;[\s\S]*?left:\s*50%;[\s\S]*?transform:\s*translate\(-50%, -50%\)/, 'viewer placeholder must be centered before asynchronous image loading completes');
assert.match(css, /\.favorite-image-frame\s*\{[\s\S]*?position:\s*relative/);
assert.match(css, /\.viewer-page-indicator\.visible\s*\{[\s\S]*?opacity:\s*1/);
assert.match(css, /\.viewer-page-indicator\s*\{[\s\S]*?font-family:\s*Tahoma, "Segoe UI", Arial, sans-serif;[\s\S]*?align-items:\s*center;/);
assert.match(css, /\.viewer-page-indicator > span,[\s\S]*?\.viewer-page-indicator > strong\s*\{[\s\S]*?display:\s*inline-grid;[\s\S]*?place-items:\s*center;[\s\S]*?line-height:\s*1;/);
assert.match(viewerStateSource, /const VIEWER_PAGE_INDICATOR_HIDE_MS\s*=\s*1000/);
assert.match(viewerShellSource, /function showViewerPageIndicatorTemporarily\(/);
assert.match(viewerShellSource, /function hideViewerPageIndicator\(/);
assert.match(viewerShellSource, /showViewerPageIndicatorTemporarily\(\)/);
assert.match(viewerSource, /hideViewerPageIndicator\(\)/);
assert.match(css, /\.catalog-progress\s*\{[\s\S]*?height:\s*5px/);
assert.match(css, /\.site-action-toast\[data-tone="removed"\]::before/);
assert.match(css, /\.site-action-toast\[data-tone="warning"\]::before/);
assert.match(css, /\.site-action-toast\[data-tone="warning"\]/);
assert.match(css, /\.empty-state\s*\{/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation-duration:\s*\.01ms !important/);

console.log('visual_polish_contract.test.js: PASS');
