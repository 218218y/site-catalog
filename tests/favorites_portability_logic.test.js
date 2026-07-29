'use strict';

const assert = require('node:assert/strict');
const { normalizeItems } = require('../favorites-store.js');
const { importFrontendTestModule } = require('./frontend_test_module');

const { createFavoritesPortabilityDomain } = importFrontendTestModule(
  'src/js/29-favorites-portability.js',
  'favorites-portability'
);
const catalogs = [
  { id: 'catalog-a', pages: 40 },
  { id: 'catalog-b', pages: 20 }
];
const catalogMap = new Map(catalogs.map((catalog) => [catalog.id, catalog]));
const domain = createFavoritesPortabilityDomain({
  normalizeItems,
  findCatalogById: (id) => catalogMap.get(String(id)) || null,
  catalogs: () => catalogs,
  encodeBase64: (value) => Buffer.from(value, 'binary').toString('base64'),
  decodeBase64: (value) => Buffer.from(value, 'base64').toString('binary'),
  shareVersion: 2
});

const firstOrder = [
  { catalogId: 'catalog-b', page: 7, savedAt: 30 },
  { catalogId: 'catalog-a', page: 4, savedAt: 20 },
  { catalogId: 'catalog-a', page: 2, savedAt: 10, note: 'הערה מקומית' },
  { catalogId: 'catalog-a', page: 3, savedAt: 5 }
];
const token = domain.buildFavoritesShareToken(firstOrder);
assert.match(token, /^v2\.[A-Za-z0-9_-]+$/);
assert.equal(token, domain.buildFavoritesShareToken([...firstOrder].reverse()), 'the shared token must not encode local item order');
assert.deepEqual(domain.parseFavoritesShareToken(token).items, [
  { catalogId: 'catalog-a', page: 2, savedAt: 0 },
  { catalogId: 'catalog-a', page: 3, savedAt: 0 },
  { catalogId: 'catalog-a', page: 4, savedAt: 0 },
  { catalogId: 'catalog-b', page: 7, savedAt: 0 }
]);

const invalidToken = domain.buildFavoritesShareToken([
  { catalogId: 'catalog-a', page: 999 },
  { catalogId: 'missing', page: 1 },
  { catalogId: 'catalog-b', page: 4 }
]);
assert.deepEqual(domain.parseFavoritesShareToken(invalidToken).items, [{ catalogId: 'catalog-b', page: 4, savedAt: 0 }]);

const legacyToken = 'v1.legacy-payload';
assert.deepEqual(domain.parseFavoritesShareToken(legacyToken), { valid: false, items: [], rejected: 0 });

const comparison = domain.analyzeFavoriteItemMerge(
  [
    { catalogId: 'catalog-a', page: 2, savedAt: 50 },
    { catalogId: 'catalog-a', page: 4, savedAt: 40 },
    { catalogId: 'catalog-b', page: 7, savedAt: 30 }
  ],
  [
    { catalogId: 'catalog-a', page: 2, savedAt: 10, note: 'לשמור' },
    { catalogId: 'catalog-b', page: 1, savedAt: 5 },
    { catalogId: 'catalog-b', page: 7, savedAt: 1 }
  ]
);
assert.deepEqual(comparison.newItems, [{ catalogId: 'catalog-a', page: 4, savedAt: 40 }]);
assert.deepEqual(comparison.alreadyExistingItems, [
  { catalogId: 'catalog-a', page: 2, savedAt: 50 },
  { catalogId: 'catalog-b', page: 7, savedAt: 30 }
]);
assert.deepEqual(comparison.mergedItems, [
  { catalogId: 'catalog-a', page: 2, savedAt: 10, note: 'לשמור' },
  { catalogId: 'catalog-a', page: 4, savedAt: 40 },
  { catalogId: 'catalog-b', page: 7, savedAt: 1 },
  { catalogId: 'catalog-b', page: 1, savedAt: 5 }
]);

assert.equal(domain.favoritesTransferSummary(
  { items: [
    { catalogId: 'catalog-a', page: 2, savedAt: 0 },
    { catalogId: 'catalog-b', page: 1, savedAt: 0 },
    { catalogId: 'catalog-a', page: 4, savedAt: 0 }
  ], rejected: 0 },
  [
    { catalogId: 'catalog-a', page: 2, savedAt: 10 },
    { catalogId: 'catalog-b', page: 1, savedAt: 5 },
    { catalogId: 'catalog-a', page: 8, savedAt: 4 },
    { catalogId: 'catalog-b', page: 9, savedAt: 3 }
  ]
), '3 פריטים ברשימה שהתקבלה · 4 פריטים שמורים כעת\nמתוכם 2 קיימים ו-1 חדש');

assert.equal(domain.favoritesTransferSummary(
  { items: [
    { catalogId: 'catalog-a', page: 4, savedAt: 0 },
    { catalogId: 'catalog-b', page: 7, savedAt: 0 }
  ], rejected: 1 },
  [{ catalogId: 'catalog-b', page: 1, savedAt: 5 }]
), '2 פריטים ברשימה שהתקבלה · 1 פריטים שמורים כעת · 1 פריטים לא היו זמינים באתר זה');

console.log('favorites_portability_logic.test.js: PASS');
