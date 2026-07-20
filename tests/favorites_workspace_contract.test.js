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

function divMarkupById(html, id) {
  const markerIndex = html.indexOf(`id="${id}"`);
  assert.notEqual(markerIndex, -1, `missing #${id}`);
  const start = html.lastIndexOf("<div", markerIndex);
  assert.notEqual(start, -1, `missing opening div for #${id}`);
  const tags = /<\/?div\b[^>]*>/g;
  tags.lastIndex = start;
  let depth = 0;
  for (let match = tags.exec(html); match; match = tags.exec(html)) {
    depth += match[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(start, tags.lastIndex);
  }
  assert.fail(`unclosed div for #${id}`);
}

for (const html of [template, favorites]) {
  assert.match(html, /class="favorites-title-row"[\s\S]*?id="favoritesTitle"[\s\S]*?id="favoritesCatalogFilter"[\s\S]*?id="favoritesVisibleCount"[\s\S]*?id="favoritesShareButton"/);
  assert.match(html, /<\/section>\s*<button class="inquiry-trigger-button favorites-inquiry-button hidden"[^>]*id="favoritesInquiryButton"/);
  assert.doesNotMatch(divMarkupById(html, "lightbox"), /id="viewerInquiryOverlay"/, "shared inquiry overlay must not be trapped inside the hidden viewer shell");
  assert.match(html, /<\/div>\s*<div class="viewer-inquiry-overlay hidden" id="viewerInquiryOverlay"/);
  assert.match(html, /id="favoritesCatalogFilter"[^>]*aria-label="סינון המועדפים לפי קטלוג"/);
  assert.match(html, /<option value="">כל הקטלוגים<\/option>/);
  assert.match(html, /id="favoritesInquiryButton"(?=[^>]*aria-controls="viewerInquiryOverlay")(?=[^>]*aria-expanded="false")[^>]*>/);
  assert.match(html, /id="favoritesSelectionBar"[\s\S]*?id="favoritesSelectionCount"[\s\S]*?id="favoritesClearSelection"/);
  assert.match(html, /id="favoriteNoteInput"[^>]*maxlength="280"/);
  assert.doesNotMatch(html, /favoritesSelectAllVisible|favoritesShareSelected|favoritesCompareSelected|favoritesCompareOverlay/);
  assert.doesNotMatch(html, /id="favoritesCount"|id="favoritesDescription"/);
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
assert.match(app, /function favoriteWorkspaceShareLinkEntries\([\s\S]*?return selectedEntries\.length \? selectedEntries : entries/);
assert.match(app, /function moveFavoriteWithinVisibleOrder\(/);
assert.match(app, /function reorderFavoriteByDrop\(/);
assert.match(app, /function openFavoriteNoteEditor\(/);
assert.match(app, /class="favorite-remove-button"[^>]*data-remove-favorite="1"[^>]*title="הסרה מהמועדפים"/);
assert.doesNotMatch(app, /favorite-remove-inline/);
assert.match(app, /function favoriteWorkspaceInquiryReference\([\s\S]*?purpose: "inquiry"[\s\S]*?קישור לרשימת הדגמים/);
assert.match(app, /function openFavoriteWorkspaceInquiry\([\s\S]*?selectedEntries\.length \? selectedEntries : entries[\s\S]*?openViewerInquiry\(\{ reference, returnFocus: els\.favoritesInquiryButton \}\)/);
assert.match(app, /favoritesInquiryButton\.classList\.toggle\("hidden", !hasEntries\)/);
assert.match(app, /favoritesInquiryLabel\.textContent = selectedCount \? "בירור על הדגמים שנבחרו" : "בירור על הדגמים"/);
assert.match(app, /function copyFavoriteWorkspaceLink\([\s\S]*?favoriteWorkspaceSelectionUrl\(entries\)[\s\S]*?copyTextToClipboard\(selectionUrl\)/);
assert.match(app, /buildFavoritesShareUrl\(entries\.map/);
assert.match(app, /if \(String\(entry\.note \|\| ""\)\.trim\(\)\) lines\.push/);
assert.match(app, /if \(!note\) return "";/);
assert.doesNotMatch(app, /FAVORITES_COMPARE|openFavoritesCompare|favoritesCompareOpen|shareFavoritesComparison/);
assert.doesNotMatch(app, /toggleAllVisibleFavoritesSelection|shareSelectedFavorites/);

assert.match(css, /\.favorites-header-workspace\s*\{/);
assert.match(css, /\.inquiry-trigger-button\s*\{/);
assert.match(css, /\.favorites-inquiry-button\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?left:\s*max\(18px, env\(safe-area-inset-left\)\);[\s\S]*?bottom:\s*max\(18px, env\(safe-area-inset-bottom\)\);/);
assert.match(css, /\.favorites-grid\s*\{[\s\S]*?padding-bottom:\s*calc\(clamp\(18px, 3vw, 30px\) \+ 86px \+ env\(safe-area-inset-bottom\)\);/);
assert.match(css, /\.favorite-card\.is-selected\s*\{/);
assert.match(css, /\.favorite-select-control\s*\{/);
assert.match(css, /\.favorite-card-actions\s*\{[\s\S]*?display:\s*flex;[\s\S]*?justify-content:\s*center;[\s\S]*?flex-wrap:\s*wrap;/);
assert.doesNotMatch(css, /\.favorite-remove-button\s*\{\s*display:\s*none;/);
assert.doesNotMatch(css, /\.favorite-remove-inline/);
assert.match(css, /\.favorite-note-overlay\s*\{/);
assert.doesNotMatch(css, /\.favorites-compare-/);
assert.doesNotMatch(css, /\.favorite-note-empty/);

assert.match(privacy, /הערות פרטיות/);
assert.match(privacy, /אינו כולל את סדר הרשימה או את ההערות הפרטיות/);

console.log('favorites_workspace_contract.test.js: PASS');
