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
assert.equal(routes.homeUrl(), '/');
assert.equal(routes.catalogUrl('opening-tbi-2026'), '/catalog/opening-tbi-2026/');
assert.equal(routes.categoryUrl('opening-wardrobes'), '/category/opening-wardrobes/');
assert.equal(routes.categoryUrl('kids', 'kids-rooms'), '/category/kids/kids-rooms/');
assert.equal(routes.favoritesUrl(), '/favorites.html');
assert.equal(
  routes.viewerUrl('opening-tbi-2026', 7, { source: 'favorites' }),
  '/catalog/opening-tbi-2026/page/7/?source=favorites'
);

assert.deepEqual(
  JSON.parse(JSON.stringify(routes.parseLocation({ pathname: '/catalog/opening-tbi-2026/', search: '' }))),
  { page: 'catalog', catalogId: 'opening-tbi-2026', currentPage: 1, source: 'catalog' }
);
assert.deepEqual(
  JSON.parse(JSON.stringify(routes.parseLocation({ pathname: '/catalog/opening-tbi-2026/page/9/', search: '?source=favorites' }))),
  { page: 'viewer', catalogId: 'opening-tbi-2026', currentPage: 9, source: 'favorites' }
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
  JSON.parse(JSON.stringify(routes.parseLocation({ pathname: '/catalog', search: '?catalog=clean-url' }))),
  { page: 'catalog', catalogId: 'clean-url', currentPage: 1, source: 'catalog' }
);
assert.equal(routes.pageFromLocation({ pathname: '/favorites/' }), 'favorites');
assert.equal(routes.pageFromLocation({ pathname: '/' }), 'home');
assert.equal(routes.matchPageFromLocation({ pathname: '/catalog/abc/' }), 'catalog');
assert.equal(routes.matchPageFromLocation({ pathname: '/catalog/abc/page/4/' }), 'viewer');
assert.equal(routes.matchPageFromLocation({ pathname: '/unknown-page' }), '');
assert.equal(routes.isDocumentLocation({ pathname: '/catalog/abc/page/4/' }), true);
assert.equal(routes.isDocumentLocation({ pathname: '/unknown-page' }), false);
assert.equal(routes.basePathFromLocation({ pathname: '/favorites' }, 'favorites'), '/');
assert.equal(routes.basePathFromLocation({ pathname: '/shop/favorites.html' }, 'favorites'), '/shop/');
assert.equal(routes.basePathFromLocation({ pathname: '/shop/catalog/abc/' }, 'catalog'), '/shop/');
assert.equal(routes.basePathFromLocation({ pathname: '/shop/catalog/abc/page/4/' }, 'viewer'), '/shop/');
assert.equal(
  routes.isSameAppDocumentLocation(
    { origin: 'https://example.test', pathname: '/catalog/abc/page/4/' },
    { origin: 'https://example.test', pathname: '/favorites.html' },
    'viewer'
  ),
  true
);
assert.equal(
  routes.isSameAppDocumentLocation(
    { origin: 'https://example.test', pathname: '/shop/catalog/abc/page/4/' },
    { origin: 'https://example.test', pathname: '/shop/favorites.html' },
    'viewer'
  ),
  true
);
assert.equal(
  routes.isSameAppDocumentLocation(
    { origin: 'https://example.test', pathname: '/shop/catalog/abc/page/4/' },
    { origin: 'https://example.test', pathname: '/favorites.html' },
    'viewer'
  ),
  false
);
assert.equal(
  routes.isSameAppDocumentLocation(
    { origin: 'https://example.test', pathname: '/catalog/abc/' },
    { origin: 'https://other.test', pathname: '/catalog/abc/page/2/' },
    'catalog'
  ),
  false
);

console.log('site_routes.test.js: PASS');
