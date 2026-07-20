"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "src", "js", "35-favorites-workspace.js"), "utf8");
const entries = [
  {
    catalog: { id: "chairs", title: "כיסאות", pages: 8 },
    page: 2,
    note: "לבדוק רוחב 180"
  },
  {
    catalog: { id: "tables", title: "שולחנות", pages: 6 },
    page: 4,
    note: ""
  },
  {
    catalog: { id: "beds", title: "מיטות", pages: 10 },
    page: 7,
    note: "גוון בהיר"
  }
];

const calls = [];
const context = {
  console,
  window: {},
  document: {},
  requestAnimationFrame(callback) { callback(); },
  state: {
    favoritesSelectedKeys: new Set(),
    favoritesFilterCatalogId: "tables",
    favoriteNoteEditingKey: "",
    favoritesDragKey: ""
  },
  els: {
    favoritesInquiryButton: { id: "favoritesInquiryButton" }
  },
  getFavoriteEntries() { return entries; },
  favoriteItemKey(item) { return `${item.catalogId || item.catalog?.id}\u0000${item.page}`; },
  viewerDocumentUrl(catalogId, page) { return `/catalog/${catalogId}/page/${page}/`; },
  absoluteDocumentUrl(url) { return `https://example.test${url}`; },
  buildFavoritesShareUrl(items) {
    return `https://example.test/favorites.html?selection=${items.map((item) => `${item.catalogId}:${item.page}`).join(",")}`;
  },
  openViewerInquiry(options) { calls.push(options); },
  escapeHtml(value) { return String(value); },
  thumbSrc() { return ""; },
  pageSrc() { return ""; },
  pageAspectStyle() { return ""; },
  catalogImageDimensionAttributes() { return ""; },
  catalogImageCrossOriginAttribute() { return ""; },
  favoritesStore: null,
  closeFavoriteNoteEditor() {},
  renderFavoritesWorkspace() {},
  copyTextToClipboard: async () => {},
  flashActionButton() {},
  showActionToast() {},
  FAVORITES_NOTE_MAX_LENGTH: 280
};

vm.createContext(context);
vm.runInContext(source, context, { filename: "35-favorites-workspace.js" });

const allReference = context.favoriteWorkspaceInquiryReference(entries, { selected: false });
assert.equal(allReference.kind, "favorites");
assert.equal(allReference.count, 3);
assert.equal(allReference.title, "בירור על הדגמים");
assert.equal(allReference.selected, false);
assert.match(allReference.text, /לבדוק רוחב 180/);
assert.match(allReference.text, /גוון בהיר/);
assert.equal((allReference.text.match(/https:\/\//g) || []).length, 4, "three direct model links plus one list link");
assert.match(allReference.text, /קישור לרשימת הדגמים:/);

context.openFavoriteWorkspaceInquiry();
assert.equal(calls.length, 1);
assert.equal(calls[0].reference.count, 3, "a visual catalog filter must not narrow the default inquiry");
assert.equal(calls[0].reference.selected, false);
assert.equal(calls[0].returnFocus, context.els.favoritesInquiryButton);

context.state.favoritesSelectedKeys.add("chairs\u00002");
context.state.favoritesSelectedKeys.add("beds\u00007");
context.openFavoriteWorkspaceInquiry();
assert.equal(calls.length, 2);
assert.equal(calls[1].reference.count, 2);
assert.equal(calls[1].reference.selected, true);
assert.equal(calls[1].reference.title, "בירור על הדגמים שנבחרו");
assert.match(calls[1].reference.text, /לבדוק רוחב 180/);
assert.match(calls[1].reference.text, /גוון בהיר/);
assert.doesNotMatch(calls[1].reference.text, /שולחנות/);
assert.equal((calls[1].reference.text.match(/https:\/\//g) || []).length, 3, "two direct model links plus one selected-list link");

console.log("favorites_inquiry_logic.test.js: PASS");
