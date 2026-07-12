'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const bundleBuilder = fs.readFileSync(path.join(root, 'tools', 'build_deploy_bundle.py'), 'utf8');

assert.match(html, /<button[^>]*class="[^"]*header-favorites-button[^"]*hidden[^"]*"[^>]*id="headerFavoritesButton"/);
assert.match(html, /<div[^>]*id="favoritesPanel"[^>]*role="dialog"[^>]*aria-modal="true"/);
assert.match(html, /id="viewerFavoriteButton"[^>]*aria-pressed="false"/);
assert.match(html, /<script src="favorites-store\.js"><\/script>\s*<script src="app\.js"><\/script>/);

assert.match(app, /favoritesStore\.toggle\(\{ \.\.\.identity, savedAt: Date\.now\(\) \}\)/);
assert.match(app, /window\.addEventListener\("storage", handleFavoritesStorageChange\)/);
assert.match(app, /openCatalogInViewer\(catalogId, page\)/);
assert.match(app, /window\.confirm\("למחוק את כל העמודים מהמועדפים\?"\)/);
assert.match(app, /handleFavoritesPanelKeydown/);

assert.match(css, /\.viewer-favorite-button\s*\{/);
assert.match(css, /\.viewer-favorite-button\[data-favorite-active="true"\]/);
assert.match(css, /\.favorites-grid\s*\{/);
assert.match(css, /\.header-favorites-button\s*\{[\s\S]*?order:\s*10;/);
assert.match(bundleBuilder, /"favorites-store\.js"/);

console.log('favorites_integration_contract.test.js: PASS');
