'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllBundles, readAllCssBundles } = require('./frontend_test_assets');
const { hasCall, hasFunction, hasPropertyPath, inventoryProjectFiles } = require('./helpers/frontend_ast');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const favorites = fs.readFileSync(path.join(root, 'favorites.html'), 'utf8');
const catalog = fs.readFileSync(path.join(root, 'catalog.html'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const app = readAllBundles();
const css = readAllCssBundles();
const favoritesWorkspaceSource = fs.readFileSync(path.join(root, 'src', 'js', '35-favorites-workspace.js'), 'utf8');
const favoritesStateSource = fs.readFileSync(path.join(root, 'src', 'js', '14-favorites-state.js'), 'utf8');
const favoritesShareSource = fs.readFileSync(path.join(root, 'src', 'js', '30-favorites-share.js'), 'utf8');
const portabilitySource = fs.readFileSync(path.join(root, 'src', 'js', '29-favorites-portability.js'), 'utf8');
const pageBuilder = fs.readFileSync(path.join(root, 'tools', 'build_site_pages.py'), 'utf8');
const inventories = inventoryProjectFiles(root, [
  'src/js/29-favorites-portability.js',
  'src/js/30-favorites-share.js',
  'src/js/35-favorites-workspace.js',
]);
const portabilityAst = inventories['src/js/29-favorites-portability.js'];
const favoritesShareAst = inventories['src/js/30-favorites-share.js'];
const favoritesWorkspaceAst = inventories['src/js/35-favorites-workspace.js'];

for (const html of [template, favorites]) {
  assert.match(html, /class="favorites-title-row"[\s\S]*?id="favoritesTitle"[\s\S]*?id="favoritesCatalogFilter"[\s\S]*?id="favoritesVisibleCount"[\s\S]*?id="favoritesShareButton"/);
  assert.match(html, /<\/section>\s*<button class="inquiry-trigger-button favorites-inquiry-button hidden"[^>]*id="favoritesInquiryButton"/);
  assert.match(html, /id="favoritesShareButton"[^>]*disabled/);
  assert.match(html, /id="favoritesTransferOverlay"[^>]*aria-hidden="true"/);
  assert.match(html, /id="favoritesTransferMerge"/);
  assert.match(html, /id="favoritesTransferReplace"/);
  assert.match(html, /id="favoritesSelectionBar"/);
  assert.match(html, /id="favoriteNoteOverlay"/);
  assert.doesNotMatch(html, /favoritesExportButton|favoritesImportButton|favoritesImportInput/);
  assert.doesNotMatch(html, /favoritesCompare|favoritesSelectAllVisible|favoritesShareSelected/);
}

assert.doesNotMatch(index, /id="headerFullscreenToggle"/);
assert.doesNotMatch(catalog, /id="headerFullscreenToggle"/);
assert.doesNotMatch(favorites, /id="headerFullscreenToggle"/);
assert.doesNotMatch(viewer, /id="headerFullscreenToggle"/);
assert.doesNotMatch(template, /HEADER_FULLSCREEN_BUTTON|headerFullscreenToggle|brand-fullscreen-link/);
assert.doesNotMatch(pageBuilder, /HEADER_FULLSCREEN_BUTTON|show_header_fullscreen|headerFullscreenToggle/);
assert.doesNotMatch(app, /headerFullscreenToggle/);

assert.match(favoritesStateSource, /const FAVORITES_SHARE_VERSION = 2;/);
assert.ok(hasFunction(portabilityAst, 'analyzeFavoriteItemMerge'));
assert.ok(hasCall(portabilityAst, 'normalizeFavoriteTransferItems', 'analyzeFavoriteItemMerge'));
assert.ok(hasCall(portabilityAst, 'normalizeItems', 'analyzeFavoriteItemMerge'));
for (const identifier of ['newItems', 'alreadyExistingItems', 'mergedItems']) assert.ok(portabilityAst.identifiers.includes(identifier));
assert.ok(hasFunction(favoritesShareAst, 'syncFavoritesTransferDialogUi'));
assert.ok(hasCall(favoritesShareAst, 'favoritesPortabilityDomain.favoritesTransferSummary', 'syncFavoritesTransferDialogUi'));
assert.ok(hasFunction(portabilityAst, 'favoritesTransferSummary'));
assert.ok(hasCall(portabilityAst, 'analyzeFavoriteItemMerge', 'favoritesTransferSummary'));
assert.ok(hasPropertyPath(portabilityAst, 'pending.items', 'favoritesTransferSummary'));
assert.ok(portabilityAst.stringLiterals.some((value) => value.includes('מתוכם')));
assert.ok(portabilityAst.stringLiterals.some((value) => value.includes('פריטים ברשימה שהתקבלה')));
assert.doesNotMatch(app, /FAVORITES_SHARE_LEGACY_VERSION|parseLegacyFavoritesShareToken/);
assert.ok(hasFunction(favoritesShareAst, 'shareFavoritesList'));
assert.ok(hasCall(favoritesShareAst, 'getFeatureInterface', 'shareFavoritesList'));
assert.ok(hasCall(favoritesShareAst, 'workspace.copyShareLink', 'shareFavoritesList'));
assert.ok(hasCall(favoritesShareAst, 'workspace.shareLinkEntries', 'shareFavoritesList'));
assert.ok(hasFunction(favoritesWorkspaceAst, 'copyFavoriteWorkspaceLink'));
assert.ok(hasCall(favoritesWorkspaceAst, 'copyTextToClipboard', 'copyFavoriteWorkspaceLink'));
assert.ok(favoritesWorkspaceAst.stringLiterals.includes('קישור המועדפים הועתק'));
assert.equal(hasFunction(favoritesWorkspaceAst, 'shareFavoriteWorkspaceEntries'), false);
assert.doesNotMatch(favoritesWorkspaceSource, /navigator\.share\(shareData\)/);
assert.doesNotMatch(app, /FAVORITES_MAX_SAFE_SHARE_URL_LENGTH|exportFavoritesList|parseFavoritesImportDocument|requestFavoritesImport|handleFavoritesImportFile/);
assert.ok(hasFunction(favoritesWorkspaceAst, 'moveFavoriteWithinVisibleOrder'));
assert.match(favoritesWorkspaceSource, /data-drag-favorite/);
assert.ok(hasFunction(favoritesWorkspaceAst, 'openFavoriteNoteEditor'));
assert.doesNotMatch(app, /openFavoritesCompare|favoritesCompare/);

assert.match(css, /\.favorites-title-row\s*\{[\s\S]*?flex-wrap:\s*wrap;/);
assert.match(css, /\.favorites-share-inline\s*\{/);
assert.match(css, /\.favorites-header-workspace\s*\{/);
assert.match(css, /\.favorites-transfer-overlay\s*\{/);
assert.match(css, /\.favorites-transfer-summary\s*\{[\s\S]*?white-space:\s*pre-line;/);
assert.match(css, /\.favorite-order-controls\s*\{/);
assert.match(css, /\.favorite-drag-handle\s*\{/);
assert.doesNotMatch(css, /\.favorites-tools\s*\{|\.favorites-compare-/);

console.log('favorites_portability_contract.test.js: PASS');
