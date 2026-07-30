'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllBundles, readAllCssBundles } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const favoritesHtml = fs.readFileSync(path.join(root, 'favorites.html'), 'utf8');
const viewerHtml = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const app = readAllBundles();
const css = readAllCssBundles();
const bundleBuilder = fs.readFileSync(path.join(root, 'tools', 'build_deploy_bundle.py'), 'utf8');
const favoritesShareSource = fs.readFileSync(path.join(root, 'src/js/30-favorites-share.js'), 'utf8');
const favoritesWorkspaceSource = fs.readFileSync(path.join(root, 'src/js/35-favorites-workspace.js'), 'utf8');
const viewerSource = fs.readFileSync(path.join(root, 'src/js/60-viewer.js'), 'utf8');

assert.match(html, /<a[^>]*class="[^"]*header-favorites-button[^"]*hidden[^"]*"[^>]*id="headerFavoritesButton"[^>]*href="favorites\.html"/);
assert.match(html, /<div[^>]*id="favoritesPanel"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(html, /id="viewerFavoriteButton"[^>]*aria-pressed="false"/);
assert.match(html, /id="favoritesCatalogFilter"[\s\S]*?id="favoritesVisibleCount"[\s\S]*?id="favoritesShareButton"/);
assert.match(html, /<\/section>\s*<button class="inquiry-trigger-button favorites-inquiry-button hidden"[^>]*id="favoritesInquiryButton"/);
assert.doesNotMatch(html, /id="favoritesDescription"|id="favoritesCount"/);
assert.match(html, /id="favoritesCloseButton"[\s\S]*?<svg[\s\S]*?<path d="M6\.5 6\.5 17\.5 17\.5M17\.5 6\.5 6\.5 17\.5"/);
assert.match(html, /id="favoriteOpenCatalogButton"[^>]*aria-label="פתיחת התמונה בתוך הקטלוג המלא"/);
assert.match(html, /id="prevPageBtn"[\s\S]*?<\/button>\s*<\/div>\s*<button class="reader-button favorite-open-catalog-button[^>]*id="favoriteOpenCatalogButton"/);
assert.match(html, /id="favoriteOpenCatalogButton"[\s\S]*?id="lightboxPageRail"/);
assert.doesNotMatch(html, /id="thumbsHotspot"|id="lightboxThumbs"/);
assert.match(html, /id="lightboxPageRailTitle">עמודים</);
assert.match(html, /<script src="favorites-store\.js"><\/script>\s*<script src="site-routes\.js"><\/script>\s*<script type="module" data-bargig-route-module src="app-catalog\.js"><\/script>/);
assert.match(favoritesHtml, /<script type="module" data-bargig-route-module src="app-favorites\.js"><\/script>/);
assert.match(viewerHtml, /<script type="module" data-bargig-route-module src="app-viewer\.js"><\/script>/);

assert.match(favoritesShareSource, /favoritesStore\.toggleDetailed\(\{ \.\.\.identity, savedAt: Date\.now\(\) \}\)/);
assert.match(favoritesShareSource + favoritesWorkspaceSource, /favoritesStore\.replaceDetailed\(/);
assert.match(favoritesWorkspaceSource, /favoritesStore\.setNoteDetailed\(/);
assert.match(favoritesShareSource, /showFavoritePersistenceFeedback/);
assert.match(favoritesShareSource, /persisted/);
assert.match(favoritesShareSource, /window\.addEventListener\("storage", handleFavoritesStorageChange\)/);
assert.match(favoritesShareSource, /openFavoriteViewer\(catalogId, page\)/);
assert.match(favoritesShareSource, /source: LIGHTBOX_SOURCE_FAVORITES/);
assert.match(viewerSource, /setFavoriteViewerIndex\(\(getFeatureInterface\("favorites"\)\?\.viewerIndex\(\) \?\? 0\) \+ delta, options\)/);
assert.match(favoritesShareSource, /openCurrentFavoriteInCatalogFromViewer/);
assert.match(favoritesShareSource, /openFavoritesPanel\(\{ allowEmpty: true, captureReturnFocus: false \}\)/);
assert.match(favoritesShareSource, /window\.confirm\("למחוק את כל העמודים מהמועדפים\?"\)/);
assert.match(favoritesShareSource, /handleFavoritesPanelKeydown/);

const favoritesClickHandler = favoritesShareSource.match(/function handleFavoritesGridClick\(event\) \{[\s\S]*?\n\}/)?.[0] || '';
assert.doesNotMatch(favoritesClickHandler, /openCatalogInViewer/);
assert.match(favoritesClickHandler, /openFavoriteViewer\(catalogId, page\)/);

assert.match(css, /\.viewer-favorite-button\s*\{/);
assert.match(css, /\.viewer-favorite-button\[data-favorite-active="true"\]/);
assert.match(css, /\.favorites-grid\s*\{/);
assert.match(css, /\.favorite-remove-button\s*\{[\s\S]*?top:\s*12px;[\s\S]*?left:\s*12px;/);
assert.match(css, /\.favorites-close-button svg\s*\{[\s\S]*?stroke:\s*currentColor;/);
assert.match(css, /body\[data-page="favorites"\] \.favorites-standalone-page \.favorites-header\s*\{[\s\S]*?border-radius:\s*18px;/);
assert.match(css, /\.favorites-grid\s*\{[\s\S]*?flex:\s*1 1 auto;/);
assert.match(css, /\.favorites-grid\s*\{[\s\S]*?grid-auto-rows:\s*max-content;/);
assert.match(css, /\.favorites-grid\s*\{[\s\S]*?align-content:\s*start;/);
assert.match(css, /\.favorite-open-catalog-button\s*\{/);
assert.match(css, /\.lightbox\.favorites-viewer-mode \.lightbox-search/);
assert.match(css, /\.header-favorites-button\s*\{[\s\S]*?order:\s*10;/);
assert.match(bundleBuilder, /"favorites-store\.js"/);
assert.doesNotMatch(bundleBuilder, /"page-transition\.js"/);
assert.match(bundleBuilder, /"site-routes\.js"/);

console.log('favorites_integration_contract.test.js: PASS');
