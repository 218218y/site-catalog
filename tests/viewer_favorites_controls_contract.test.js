'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

for (const html of [template, viewer]) {
  assert.match(html, /id="fullscreenToggle"[\s\S]*?id="lightboxFavoritesButton"[^>]*href="favorites\.html"/);
  assert.match(html, /id="lightboxFavoritesButton"[\s\S]*?id="lightboxFavoritesCount"/);
}

assert.match(app, /lightboxFavoritesButton: \$\("lightboxFavoritesButton"\)/);
assert.match(app, /lightboxFavoritesCount: \$\("lightboxFavoritesCount"\)/);
assert.match(app, /function syncFavoritesShortcut\(button, countElement, count\)/);
assert.match(app, /syncFavoritesShortcut\(els\.headerFavoritesButton, els\.headerFavoritesCount, count\)/);
assert.match(app, /syncFavoritesShortcut\(els\.lightboxFavoritesButton, els\.lightboxFavoritesCount, count\)/);

assert.match(css, /--viewer-side-control-near-top:\s*calc\(50% - var\(--viewer-side-control-step\)\)/);
assert.match(css, /--viewer-side-control-far-top:\s*calc\(50% - var\(--viewer-side-control-step\) - var\(--viewer-side-control-step\)\)/);
assert.match(css, /\.viewer-favorite-button\s*\{[\s\S]*?top:\s*var\(--viewer-side-control-near-top\)/);
assert.match(css, /\.viewer-auto-zoom-button\s*\{[\s\S]*?top:\s*var\(--viewer-side-control-far-top\)/);
assert.match(css, /\.lightbox-favorites-button\s*\{[\s\S]*?order:\s*10;/);
assert.match(css, /\.header-favorites-count\.lightbox-favorites-count\s*\{/);
assert.doesNotMatch(css, /\.viewer-auto-zoom-button\s*\{[\s\S]*?top:\s*calc\(50% - 82px\)/);
assert.doesNotMatch(css, /\.viewer-favorite-button\s*\{[\s\S]*?top:\s*calc\(50% - 142px\)/);

console.log('viewer_favorites_controls_contract.test.js: PASS');
