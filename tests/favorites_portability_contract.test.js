'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const favorites = fs.readFileSync(path.join(root, 'favorites.html'), 'utf8');
const catalog = fs.readFileSync(path.join(root, 'catalog.html'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const pageBuilder = fs.readFileSync(path.join(root, 'tools', 'build_site_pages.py'), 'utf8');

for (const html of [template, favorites]) {
  assert.match(html, /class="favorites-title-row"[\s\S]*?id="favoritesTitle"[\s\S]*?id="favoritesCount"[\s\S]*?id="favoritesShareButton"/);
  assert.match(html, /id="favoritesShareButton"[^>]*title="שיתוף רשימת המועדפים"[^>]*disabled/);
  assert.match(html, /id="favoritesTransferOverlay"[^>]*aria-hidden="true"/);
  assert.match(html, /id="favoritesTransferMerge"/);
  assert.match(html, /id="favoritesTransferReplace"/);
  assert.match(html, /id="favoritesCatalogFilter"/);
  assert.match(html, /id="favoritesSelectionBar"/);
  assert.match(html, /id="favoriteNoteOverlay"/);
  assert.match(html, /id="favoritesCompareOverlay"/);
  assert.doesNotMatch(html, /favoritesExportButton|favoritesImportButton|favoritesImportInput/);
}

assert.doesNotMatch(index, /id="headerFullscreenToggle"/);
assert.doesNotMatch(catalog, /id="headerFullscreenToggle"/);
assert.doesNotMatch(favorites, /id="headerFullscreenToggle"/);
assert.doesNotMatch(viewer, /id="headerFullscreenToggle"/);
assert.doesNotMatch(template, /HEADER_FULLSCREEN_BUTTON|headerFullscreenToggle|brand-fullscreen-link/);
assert.doesNotMatch(pageBuilder, /HEADER_FULLSCREEN_BUTTON|show_header_fullscreen|headerFullscreenToggle/);
assert.doesNotMatch(app, /headerFullscreenToggle/);

assert.match(app, /const FAVORITES_SHARE_VERSION = 2;/);
assert.match(app, /function canonicalizeFavoriteShareItems\(/);
assert.match(app, /function analyzeFavoriteItemMerge\([\s\S]*?newItems[\s\S]*?alreadyExistingItems[\s\S]*?mergedItems/);
assert.match(app, /function mergeFavoriteItemLists\([\s\S]*?analyzeFavoriteItemMerge\(incoming, existing\)\.mergedItems/);
assert.match(app, /function syncFavoritesTransferDialogUi\([\s\S]*?analyzeFavoriteItemMerge\(pending\.items, getValidFavoriteItems\(\)\)[\s\S]*?alreadyExistingCount > 0[\s\S]*?מתוכם[\s\S]*?פריטים ברשימה שהתקבלה/);
assert.match(app, /function encodeFavoritePageRanges\(/);
assert.match(app, /function decodeFavoritePageRanges\(/);
assert.match(app, /function buildFavoritesShareToken\([\s\S]*?canonicalizeFavoriteShareItems\([\s\S]*?encodeFavoritePageRanges/);
assert.match(app, /function parseLegacyFavoritesShareToken\(/);
assert.match(app, /function shareFavoritesList\([\s\S]*?buildFavoritesShareUrl\(items\)[\s\S]*?copyTextToClipboard\(link\)/);
assert.doesNotMatch(app, /FAVORITES_MAX_SAFE_SHARE_URL_LENGTH|exportFavoritesList|parseFavoritesImportDocument|requestFavoritesImport|handleFavoritesImportFile/);
assert.match(app, /function moveFavoriteWithinVisibleOrder\(/);
assert.match(app, /data-drag-favorite/);
assert.match(app, /function openFavoritesCompare\(/);
assert.match(app, /function openFavoriteNoteEditor\(/);

assert.match(css, /\.favorites-title-row\s*\{[\s\S]*?flex-wrap:\s*nowrap;/);
assert.match(css, /\.favorites-share-inline\s*\{/);
assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.favorites-share-inline span\s*\{[\s\S]*?display:\s*none;/);
assert.match(css, /\.favorites-transfer-overlay\s*\{/);
assert.match(css, /\.favorites-transfer-summary\s*\{[\s\S]*?white-space:\s*pre-line;/);
assert.match(css, /\.favorites-tools\s*\{/);
assert.match(css, /\.favorite-order-controls\s*\{/);
assert.match(css, /\.favorite-drag-handle\s*\{/);
assert.match(css, /\.favorites-compare-grid\s*\{/);

console.log('favorites_portability_contract.test.js: PASS');
