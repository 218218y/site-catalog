'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllBundles, readAllCssBundles, readCssBundle } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const app = readAllBundles();
const css = readAllCssBundles();
const viewerCss = readCssBundle('viewer');

for (const html of [template, viewer]) {
  assert.match(html, /id="lightboxFavoritesButton"[^>]*href="favorites\.html"/);
  assert.match(html, /id="fitWidthBtn"[\s\S]*?id="lightboxFavoritesSeparator"[\s\S]*?id="lightboxFavoritesButton"[\s\S]*?id="lightboxFavoritesCount"/);
  assert.match(html, /id="viewerFavoriteButton"[\s\S]*?id="fullscreenToggle"/);
  assert.match(html, /class="reader-button viewer-fullscreen-toggle viewer-fullscreen-float"[^>]*id="fullscreenToggle"/);
  const toolbar = html.match(/<div class="lightbox-actions">([\s\S]*?)<\/div>\s*<\/header>/)?.[1] || '';
  assert.doesNotMatch(toolbar, /id="fullscreenToggle"/);
}

assert.match(app, /lightboxFavoritesButton: \$\("lightboxFavoritesButton"\)/);
assert.match(app, /lightboxFavoritesCount: \$\("lightboxFavoritesCount"\)/);
assert.match(app, /lightboxFavoritesSeparator: \$\("lightboxFavoritesSeparator"\)/);
assert.match(app, /function syncFavoritesShortcut\(button, countElement, count\)/);
assert.match(app, /syncFavoritesShortcut\(shellElements\.headerFavoritesButton, shellElements\.headerFavoritesCount, count\)/);
assert.match(app, /syncFavoritesShortcut\(favoritesElements\.lightboxFavoritesButton, favoritesElements\.lightboxFavoritesCount, count\)/);
assert.match(app, /favoritesElements\.lightboxFavoritesSeparator\?\.classList\.toggle\("hidden", count === 0\)/);

assert.match(css, /--viewer-side-control-near-top:\s*calc\(50% - var\(--viewer-side-control-step\)\)/);
assert.match(css, /--viewer-side-control-far-top:\s*calc\(50% - var\(--viewer-side-control-step\) - var\(--viewer-side-control-step\)\)/);
assert.match(css, /\.viewer-favorite-button\s*\{[\s\S]*?top:\s*var\(--viewer-side-control-near-top\)/);
assert.match(css, /\.viewer-fullscreen-float\s*\{[\s\S]*?top:\s*var\(--viewer-side-control-far-top\)/);
assert.match(viewerCss, /\.viewer-auto-zoom-button\s*\{[^}]*top:\s*max\([^}]*var\(--lightbox-top-safe-offset, 0px\) \+ 18px[^}]*left:\s*50%;[^}]*transform:\s*translateX\(-50%\)/);
assert.match(css, /\.lightbox-favorites-button\s*\{[\s\S]*?order:\s*10;/);
assert.match(css, /\.header-favorites-count\.lightbox-favorites-count\s*\{/);
assert.doesNotMatch(viewerCss, /\.viewer-auto-zoom-button\s*\{[^}]*(?:left:\s*var\(--viewer-side-control-edge\)|top:\s*var\(--viewer-side-control-lower-top\)|transform:\s*translateY\(-50%\))/);
assert.doesNotMatch(css, /\.viewer-favorite-button\s*\{[\s\S]*?top:\s*calc\(50% - 142px\)/);

console.log('viewer_favorites_controls_contract.test.js: PASS');
