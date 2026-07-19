'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const favorites = fs.readFileSync(path.join(root, 'favorites.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const store = fs.readFileSync(path.join(root, 'favorites-store.js'), 'utf8');
const privacy = fs.readFileSync(path.join(root, 'legal', 'privacy.content.html'), 'utf8');

for (const html of [template, favorites]) {
  assert.match(html, /id="favoritesCatalogFilter"/);
  assert.match(html, /id="favoritesSelectAllVisible"/);
  assert.match(html, /id="favoritesShareSelected"/);
  assert.match(html, /id="favoritesCompareSelected"[^>]*disabled/);
  assert.match(html, /id="favoriteNoteInput"[^>]*maxlength="280"/);
  assert.match(html, /id="favoritesCompareGrid"/);
  assert.match(html, /id="favoritesCompareGmail"[^>]*target="_blank"/);
}

assert.match(store, /const STORAGE_VERSION = 2;/);
assert.doesNotMatch(store, /LEGACY_STORAGE_VERSION/);
assert.match(store, /setNote\(item, note\)/);
assert.match(store, /reorder\(keys\)/);
assert.match(store, /payload\.version !== STORAGE_VERSION/);

assert.match(app, /function favoriteWorkspaceCardKey\(/);
assert.match(app, /function favoriteWorkspaceFindCardByKey\(/);
assert.doesNotMatch(app, /data-favorite-key=/);
assert.match(app, /\[data-favorite-catalog\]\[data-favorite-page\]/);
assert.match(app, /function favoriteWorkspaceVisibleEntries\(/);
assert.match(app, /function moveFavoriteWithinVisibleOrder\(/);
assert.match(app, /function reorderFavoriteByDrop\(/);
assert.match(app, /function shareSelectedFavorites\(/);
assert.match(app, /function openFavoriteNoteEditor\(/);
assert.match(app, /function openFavoritesCompare\(/);
assert.match(app, /FAVORITES_COMPARE_MIN_ITEMS = 2/);
assert.match(app, /FAVORITES_COMPARE_MAX_ITEMS = 4/);
assert.match(app, /navigator\.canShare\(shareData\)/);
assert.match(app, /viewerInquiryGmailUrl\(email, reference\)/);
assert.match(app, /buildFavoritesShareUrl\(entries\.map/);
assert.match(app, /if \(String\(entry\.note \|\| ""\)\.trim\(\)\) lines\.push/);

assert.match(css, /\.favorite-card\.is-selected\s*\{/);
assert.match(css, /\.favorite-select-control\s*\{/);
assert.match(css, /\.favorite-note-overlay,/);
assert.match(css, /\.favorites-compare-grid\s*\{/);
assert.match(css, /grid-template-columns:\s*repeat\(var\(--favorites-compare-columns/);
assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.favorites-compare-actions/);

assert.match(privacy, /הערות פרטיות/);
assert.match(privacy, /אינו כולל את סדר הרשימה או את ההערות הפרטיות/);

console.log('favorites_workspace_contract.test.js: PASS');
