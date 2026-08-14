"use strict";

const assert = require("node:assert/strict");
const { importFrontendModule } = require("./frontend_test_module");

const entries = [
  { catalog: { id: "chairs", title: "כיסאות", pages: 8 }, page: 2, note: "לבדוק רוחב 180" },
  { catalog: { id: "tables", title: "שולחנות", pages: 6 }, page: 4, note: "" },
  { catalog: { id: "beds", title: "מיטות", pages: 10 }, page: 7, note: "גוון בהיר" }
];
const calls = [];
const favoritesState = {
  favoritesSelectedKeys: new Set(),
  favoritesFilterCatalogId: "tables",
  favoriteNoteEditingKey: "",
  favoritesDragKey: ""
};
const favoritesElements = { favoritesInquiryButton: { id: "favoritesInquiryButton" } };
Object.assign(globalThis, {
  window: {},
  document: {},
  requestAnimationFrame(callback) { callback(); },
  favoritesState,
  favoritesElements,
  getFavoriteEntries: () => entries,
  favoritesPortabilityDomain: {
    favoriteItemKey: (item) => `${item.catalogId || item.catalog?.id}\u0000${item.page}`
  },
  viewerDocumentUrl: (catalogId, page) => `/catalog/${catalogId}/page/${page}/`,
  absoluteDocumentUrl: (url) => `https://example.test${url}`,
  buildFavoritesShareUrl: (items) => `https://example.test/favorites.html?selection=${items.map((item) => `${item.catalogId}:${item.page}`).join(",")}`,
  getFeatureInterface(name) {
    return name === "inquiry" ? { openInquiry(options) { calls.push(options); } } : null;
  },
  registerFeatureInterface() {},
  escapeHtml: (value) => String(value),
  thumbSrc: () => "",
  pageSrc: () => "",
  pageAspectStyle: () => "",
  catalogImageDimensionAttributes: () => "",
  catalogImageCrossOriginAttribute: () => "",
  favoritesStore: null,
  closeFavoriteNoteEditor() {},
  renderFavoritesWorkspace() {},
  copyTextToClipboard: async () => {},
  flashActionButton() {},
  showActionToast() {},
  FAVORITES_NOTE_MAX_LENGTH: 280
});
const api = importFrontendModule("src/js/35-favorites-workspace.js");

const allReference = api.favoriteWorkspaceInquiryReference(entries, { selected: false });
assert.equal(allReference.kind, "favorites");
assert.equal(allReference.count, 3);
assert.equal(allReference.title, "בירור על הדגמים");
assert.equal(allReference.selected, false);
assert.match(allReference.text, /לבדוק רוחב 180/);
assert.match(allReference.text, /גוון בהיר/);
assert.equal((allReference.text.match(/https:\/\//g) || []).length, 4);
assert.match(allReference.text, /קישור לרשימת הדגמים:/);

api.openFavoriteWorkspaceInquiry();
assert.equal(calls.length, 1);
assert.equal(calls[0].reference.count, 3);
assert.equal(calls[0].reference.selected, false);
assert.equal(calls[0].returnFocus, favoritesElements.favoritesInquiryButton);

favoritesState.favoritesSelectedKeys.add("chairs\u00002");
favoritesState.favoritesSelectedKeys.add("beds\u00007");
api.openFavoriteWorkspaceInquiry();
assert.equal(calls.length, 2);
assert.equal(calls[1].reference.count, 2);
assert.equal(calls[1].reference.selected, true);
assert.equal(calls[1].reference.title, "בירור על הדגמים שנבחרו");
assert.match(calls[1].reference.text, /לבדוק רוחב 180/);
assert.match(calls[1].reference.text, /גוון בהיר/);
assert.doesNotMatch(calls[1].reference.text, /שולחנות/);
assert.equal((calls[1].reference.text.match(/https:\/\//g) || []).length, 3);

console.log("favorites_inquiry_logic.test.js: PASS");
