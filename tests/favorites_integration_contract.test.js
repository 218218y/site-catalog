'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const bundleBuilder = fs.readFileSync(path.join(root, 'tools', 'build_deploy_bundle.py'), 'utf8');

assert.match(html, /<button[^>]*class="[^"]*header-favorites-button[^"]*hidden[^"]*"[^>]*id="headerFavoritesButton"/);
assert.match(html, /<div[^>]*id="favoritesPanel"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(html, /id="viewerFavoriteButton"[^>]*aria-pressed="false"/);
assert.match(html, /id="favoriteOpenCatalogButton"[^>]*aria-label="פתיחת התמונה בתוך הקטלוג המלא"/);
assert.match(html, /id="prevPageBtn"[\s\S]*?<\/button>\s*<\/div>\s*<button class="reader-button favorite-open-catalog-button[^>]*id="favoriteOpenCatalogButton"/);
assert.match(html, /id="favoriteOpenCatalogButton"[\s\S]*?id="thumbsHotspot"/);
assert.match(html, /id="lightboxPageRailTitle">עמודים</);
assert.match(html, /<script src="favorites-store\.js"><\/script>\s*<script src="app\.js"><\/script>/);

assert.match(app, /favoritesStore\.toggle\(\{ \.\.\.identity, savedAt: Date\.now\(\) \}\)/);
assert.match(app, /window\.addEventListener\("storage", handleFavoritesStorageChange\)/);
assert.match(app, /openFavoriteViewer\(catalogId, page\)/);
assert.match(app, /source: LIGHTBOX_SOURCE_FAVORITES/);
assert.match(app, /setFavoriteViewerIndex\(state\.favoritesViewerIndex \+ delta\)/);
assert.match(app, /openCurrentFavoriteInCatalog/);
assert.match(app, /openFavoritesPanel\(\{ allowEmpty: true, captureReturnFocus: false \}\)/);
assert.match(app, /window\.confirm\("למחוק את כל העמודים מהמועדפים\?"\)/);
assert.match(app, /handleFavoritesPanelKeydown/);

const favoritesClickHandler = app.match(/function handleFavoritesGridClick\(event\) \{[\s\S]*?\n\}/)?.[0] || '';
assert.doesNotMatch(favoritesClickHandler, /openCatalogInViewer/);
assert.match(favoritesClickHandler, /openFavoriteViewer\(catalogId, page\)/);

assert.match(css, /\.viewer-favorite-button\s*\{/);
assert.match(css, /\.viewer-favorite-button\[data-favorite-active="true"\]/);
assert.match(css, /\.favorites-grid\s*\{/);
assert.match(css, /\.favorites-grid\s*\{[\s\S]*?flex:\s*1 1 auto;/);
assert.match(css, /\.favorites-grid\s*\{[\s\S]*?grid-auto-rows:\s*max-content;/);
assert.match(css, /\.favorites-grid\s*\{[\s\S]*?align-content:\s*start;/);
assert.match(css, /\.favorite-open-catalog-button\s*\{/);
assert.match(css, /\.lightbox\.favorites-viewer-mode \.lightbox-search/);
assert.match(css, /\.header-favorites-button\s*\{[\s\S]*?order:\s*10;/);
assert.match(bundleBuilder, /"favorites-store\.js"/);

console.log('favorites_integration_contract.test.js: PASS');
