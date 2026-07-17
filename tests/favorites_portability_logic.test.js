'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { normalizeItems } = require('../favorites-store.js');

const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing function ${name}`);
  const bodyStart = app.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = bodyStart; index < app.length; index += 1) {
    const char = app[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return app.slice(start, index + 1);
    }
  }
  throw new Error(`Unclosed function ${name}`);
}

const names = [
  'favoriteItemKey',
  'normalizeFavoriteTransferItems',
  'analyzeFavoriteItemMerge',
  'mergeFavoriteItemLists',
  'syncFavoritesTransferDialogUi',
  'encodeBase64UrlUtf8',
  'decodeBase64UrlUtf8',
  'canonicalizeFavoriteShareItems',
  'encodeFavoritePageRanges',
  'decodeFavoritePageRanges',
  'buildFavoritesShareToken',
  'parseLegacyFavoritesShareToken',
  'parseFavoritesShareToken'
];

const catalogs = [
  { id: 'catalog-a', pages: 40 },
  { id: 'catalog-b', pages: 20 }
];
const catalogMap = new Map(catalogs.map((catalog) => [catalog.id, catalog]));
const context = {
  FAVORITES_SHARE_VERSION: 2,
  FAVORITES_SHARE_LEGACY_VERSION: 1,
  catalogs,
  state: { favoritesTransferPending: null },
  els: {
    favoritesTransferOverlay: {},
    favoritesTransferTitle: { textContent: '' },
    favoritesTransferDescription: { textContent: '' },
    favoritesTransferSummary: { textContent: '' }
  },
  currentFavoriteItems: [],
  window: {
    BargigFavorites: { normalizeItems },
    btoa: (value) => Buffer.from(value, 'binary').toString('base64'),
    atob: (value) => Buffer.from(value, 'base64').toString('binary')
  },
  TextEncoder,
  TextDecoder,
  encodeURIComponent,
  decodeURIComponent,
  findCatalogById: (id) => catalogMap.get(String(id)) || null,
  getValidFavoriteItems: () => context.currentFavoriteItems
};
vm.createContext(context);
vm.runInContext(names.map(extractFunction).join('\n\n'), context);

const firstOrder = [
  { catalogId: 'catalog-b', page: 7, savedAt: 30 },
  { catalogId: 'catalog-a', page: 4, savedAt: 20 },
  { catalogId: 'catalog-a', page: 2, savedAt: 10 },
  { catalogId: 'catalog-a', page: 3, savedAt: 5 }
];
const secondOrder = [...firstOrder].reverse();
const token = context.buildFavoritesShareToken(firstOrder);
assert.match(token, /^v2\.[A-Za-z0-9_-]+$/);
assert.equal(token, context.buildFavoritesShareToken(secondOrder), 'the shared token must not encode the local item order');

const decoded = context.parseFavoritesShareToken(token);
assert.equal(decoded.valid, true);
assert.deepEqual(JSON.parse(JSON.stringify(decoded.items)), [
  { catalogId: 'catalog-a', page: 2, savedAt: 0 },
  { catalogId: 'catalog-a', page: 3, savedAt: 0 },
  { catalogId: 'catalog-a', page: 4, savedAt: 0 },
  { catalogId: 'catalog-b', page: 7, savedAt: 0 }
]);

assert.equal(context.encodeFavoritePageRanges([1, 2, 3, 5, 10, 11]), '1-3,5,a-b');
assert.deepEqual(Array.from(context.decodeFavoritePageRanges('1-3,5,a-b')), [1, 2, 3, 5, 10, 11]);

const invalidToken = context.buildFavoritesShareToken([
  { catalogId: 'catalog-a', page: 999 },
  { catalogId: 'missing', page: 1 },
  { catalogId: 'catalog-b', page: 4 }
]);
const filtered = context.parseFavoritesShareToken(invalidToken);
assert.deepEqual(JSON.parse(JSON.stringify(filtered.items)), [{ catalogId: 'catalog-b', page: 4, savedAt: 0 }]);

const legacyPayload = {
  v: 1,
  c: ['catalog-b', 'catalog-a'],
  i: [[0, 7], [1, 2]]
};
const legacyToken = `v1.${context.encodeBase64UrlUtf8(JSON.stringify(legacyPayload))}`;
const legacyDecoded = context.parseFavoritesShareToken(legacyToken);
assert.equal(legacyDecoded.valid, true);
assert.deepEqual(JSON.parse(JSON.stringify(legacyDecoded.items)), [
  { catalogId: 'catalog-b', page: 7, savedAt: 0 },
  { catalogId: 'catalog-a', page: 2, savedAt: 0 }
]);

const merged = context.mergeFavoriteItemLists(
  [{ catalogId: 'catalog-a', page: 2, savedAt: 50 }],
  [
    { catalogId: 'catalog-a', page: 2, savedAt: 10 },
    { catalogId: 'catalog-b', page: 1, savedAt: 5 }
  ]
);
assert.deepEqual(JSON.parse(JSON.stringify(merged)), [
  { catalogId: 'catalog-a', page: 2, savedAt: 50 },
  { catalogId: 'catalog-b', page: 1, savedAt: 5 }
]);

const comparison = context.analyzeFavoriteItemMerge(
  [
    { catalogId: 'catalog-a', page: 2, savedAt: 50 },
    { catalogId: 'catalog-a', page: 4, savedAt: 40 },
    { catalogId: 'catalog-b', page: 7, savedAt: 30 }
  ],
  [
    { catalogId: 'catalog-a', page: 2, savedAt: 10 },
    { catalogId: 'catalog-b', page: 1, savedAt: 5 },
    { catalogId: 'catalog-b', page: 7, savedAt: 1 }
  ]
);
assert.deepEqual(JSON.parse(JSON.stringify(comparison.newItems)), [
  { catalogId: 'catalog-a', page: 4, savedAt: 40 }
]);
assert.deepEqual(JSON.parse(JSON.stringify(comparison.alreadyExistingItems)), [
  { catalogId: 'catalog-a', page: 2, savedAt: 50 },
  { catalogId: 'catalog-b', page: 7, savedAt: 30 }
]);
assert.deepEqual(JSON.parse(JSON.stringify(comparison.mergedItems)), [
  { catalogId: 'catalog-a', page: 2, savedAt: 50 },
  { catalogId: 'catalog-a', page: 4, savedAt: 40 },
  { catalogId: 'catalog-b', page: 7, savedAt: 30 },
  { catalogId: 'catalog-b', page: 1, savedAt: 5 }
]);

context.currentFavoriteItems = [
  { catalogId: 'catalog-a', page: 2, savedAt: 10 },
  { catalogId: 'catalog-b', page: 1, savedAt: 5 },
  { catalogId: 'catalog-a', page: 8, savedAt: 4 },
  { catalogId: 'catalog-b', page: 9, savedAt: 3 }
];
context.state.favoritesTransferPending = {
  items: [
    { catalogId: 'catalog-a', page: 2, savedAt: 0 },
    { catalogId: 'catalog-b', page: 1, savedAt: 0 },
    { catalogId: 'catalog-a', page: 4, savedAt: 0 }
  ],
  rejected: 0
};
context.syncFavoritesTransferDialogUi();
assert.equal(
  context.els.favoritesTransferSummary.textContent,
  '3 פריטים ברשימה שהתקבלה · 4 פריטים שמורים כעת\n' +
    'מתוכם 2 קיימים ו-1 חדש'
);

context.currentFavoriteItems = [
  { catalogId: 'catalog-b', page: 1, savedAt: 5 }
];
context.state.favoritesTransferPending = {
  items: [
    { catalogId: 'catalog-a', page: 4, savedAt: 0 },
    { catalogId: 'catalog-b', page: 7, savedAt: 0 }
  ],
  rejected: 1
};
context.syncFavoritesTransferDialogUi();
assert.equal(
  context.els.favoritesTransferSummary.textContent,
  '2 פריטים ברשימה שהתקבלה · 1 פריטים שמורים כעת · 1 פריטים לא היו זמינים באתר זה',
  'the original summary must remain unchanged and single-line when there is no overlap'
);

console.log('favorites_portability_logic.test.js: PASS');
