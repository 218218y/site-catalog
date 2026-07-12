'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'site-routes.js'), 'utf8');
const context = { globalThis: {}, URLSearchParams, URL };
vm.createContext(context);
vm.runInContext(source, context);
const routes = context.globalThis.BargigRoutes;

assert.ok(routes, 'route API should be exported');
assert.equal(routes.homeUrl(), 'index.html');
assert.equal(routes.catalogUrl('opening 2026'), 'catalog.html?catalog=opening+2026');
assert.equal(routes.favoritesUrl(), 'favorites.html');
assert.equal(
  routes.viewerUrl('opening-tbi-2026', 7, { source: 'favorites' }),
  'viewer.html?catalog=opening-tbi-2026&page=7&source=favorites'
);

assert.deepEqual(
  JSON.parse(JSON.stringify(routes.parseLocation({ pathname: '/catalog.html', search: '?catalog=abc' }, 'catalog'))),
  { page: 'catalog', catalogId: 'abc', currentPage: 1, source: 'catalog' }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(routes.parseLocation({ pathname: '/viewer.html', search: '?catalog=abc&page=9&source=favorites' }, 'viewer'))),
  { page: 'viewer', catalogId: 'abc', currentPage: 9, source: 'favorites' }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(routes.parseLegacyHash('#c/abc/p/3'))),
  { catalogId: 'abc', page: 3, viewer: true }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(routes.parseLegacyHash('#c/abc'))),
  { catalogId: 'abc', page: 1, viewer: false }
);
assert.equal(routes.parseLegacyHash('#cat/wardrobes'), null);

console.log('site_routes.test.js: PASS');
