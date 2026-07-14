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
  JSON.parse(JSON.stringify(routes.parseLocation({ pathname: '/catalog', search: '?catalog=clean-url' }))),
  { page: 'catalog', catalogId: 'clean-url', currentPage: 1, source: 'catalog' },
  'Cloudflare Pages redirects catalog.html to the extensionless /catalog route'
);
assert.deepEqual(
  JSON.parse(JSON.stringify(routes.parseLocation({ pathname: '/viewer', search: '?catalog=clean-url&page=4' }))),
  { page: 'viewer', catalogId: 'clean-url', currentPage: 4, source: 'catalog' },
  'Cloudflare Pages redirects viewer.html to the extensionless /viewer route'
);
assert.equal(routes.pageFromLocation({ pathname: '/favorites/' }), 'favorites');
assert.equal(routes.pageFromLocation({ pathname: '/' }), 'home');
assert.equal(routes.matchPageFromLocation({ pathname: '/favorites' }), 'favorites');
assert.equal(routes.matchPageFromLocation({ pathname: '/favorites.html' }), 'favorites');
assert.equal(routes.matchPageFromLocation({ pathname: '/unknown-page' }), '');
assert.equal(routes.isDocumentLocation({ pathname: '/favorites' }), true);
assert.equal(routes.isDocumentLocation({ pathname: '/favorites.html' }), true);
assert.equal(routes.isDocumentLocation({ pathname: '/unknown-page' }), false);
assert.equal(routes.basePathFromLocation({ pathname: '/favorites' }, 'favorites'), '/');
assert.equal(routes.basePathFromLocation({ pathname: '/favorites/' }, 'favorites'), '/');
assert.equal(routes.basePathFromLocation({ pathname: '/shop/favorites' }, 'favorites'), '/shop/');
assert.equal(routes.basePathFromLocation({ pathname: '/shop/favorites.html' }, 'favorites'), '/shop/');
assert.equal(routes.basePathFromLocation({ pathname: '/shop/' }, 'home'), '/shop/');
assert.equal(
  routes.isSameAppDocumentLocation(
    { origin: 'https://example.test', pathname: '/viewer' },
    { origin: 'https://example.test', pathname: '/favorites' },
    'viewer'
  ),
  true,
  'clean Netlify/Cloudflare routes must stay inside the current document during fullscreen navigation'
);
assert.equal(
  routes.isSameAppDocumentLocation(
    { origin: 'https://example.test', pathname: '/shop/viewer/' },
    { origin: 'https://example.test', pathname: '/shop/favorites.html' },
    'viewer'
  ),
  true,
  'clean and .html routes must resolve to the same application base path'
);
assert.equal(
  routes.isSameAppDocumentLocation(
    { origin: 'https://example.test', pathname: '/shop/viewer' },
    { origin: 'https://example.test', pathname: '/favorites' },
    'viewer'
  ),
  false,
  'navigation must not escape a subdirectory deployment'
);
assert.equal(
  routes.isSameAppDocumentLocation(
    { origin: 'https://example.test', pathname: '/viewer' },
    { origin: 'https://other.test', pathname: '/favorites' },
    'viewer'
  ),
  false,
  'cross-origin links are never in-document application routes'
);
assert.equal(
  Object.prototype.hasOwnProperty.call(routes, 'parseLegacyHash'),
  false,
  'new installations should expose only the current multi-page URL contract'
);

console.log('site_routes.test.js: PASS');
