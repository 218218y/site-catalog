'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const logoAssetPath = path.join(root, 'brand-logo.svg');
const logoSvg = fs.readFileSync(logoAssetPath, 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const pageFiles = ['site.template.html', 'index.html', 'catalog.html', 'favorites.html', 'viewer.html'];

assert.match(logoSvg, /<svg\b[^>]*\bwidth="786"[^>]*\bheight="317"[^>]*\bviewBox="0 0 786 317"/s);
assert.match(logoSvg, /<path\b[^>]*\bfill-rule="evenodd"/s, 'logo must contain native vector paths');
assert.doesNotMatch(logoSvg, /<image\b|data:image\//i, 'SVG must not wrap or embed the old raster logo');
assert.equal(fs.existsSync(path.join(root, 'wp_logo_data.js')), false, 'legacy embedded logo data file must be removed');
assert.equal(fs.existsSync(path.join(root, 'brand-logo.js')), false, 'legacy logo injection script must be removed');

const logoWidth = 786;
const logoHeight = 317;
const logoSelector = /<img\b[^>]*data-brand-logo="1"[^>]*>/g;
for (const filename of pageFiles) {
  const html = fs.readFileSync(path.join(root, filename), 'utf8');
  const logoTags = html.match(logoSelector) || [];
  assert.equal(logoTags.length, 2, `${filename} must contain the shared header and reader logos`);
  assert.match(html, /<html\b[^>]*class="has-bargig-logo"[^>]*--bargig-logo-url:\s*url\('brand-logo\.svg'\)/s);
  assert.doesNotMatch(html, /wp_logo_data\.js|brand-logo\.js|data-wp-logo=/);
  for (const tag of logoTags) {
    assert.match(tag, /\bsrc="brand-logo\.svg"/, `${filename} logo must load the SVG asset directly`);
    assert.match(tag, new RegExp(`\\bwidth="${logoWidth}"`), `${filename} logo must reserve its intrinsic width`);
    assert.match(tag, new RegExp(`\\bheight="${logoHeight}"`), `${filename} logo must reserve its intrinsic height`);
  }
}

const escapedRatio = `${logoWidth}\\s*\\/\\s*${logoHeight}`;
const sharedLogoRule = css.match(/img\[data-brand-logo="1"\]\s*\{([\s\S]*?)\}/);
assert.ok(sharedLogoRule, 'shared logo CSS rule must exist');
assert.match(
  sharedLogoRule[1],
  new RegExp(`aspect-ratio:\\s*${escapedRatio};`),
  'logo CSS must preserve the SVG aspect ratio before it finishes loading'
);
assert.match(
  sharedLogoRule[1],
  /height:\s*auto;/,
  'all responsive logo variants must override the intrinsic height attribute'
);
assert.match(css, /\.brand-mark\s*\{[\s\S]*?width:\s*clamp\([^;]+\);[\s\S]*?height:\s*auto;/);
assert.doesNotMatch(
  css,
  /\.reader-logo\s*\{[^}]*height:\s*(?!auto\b)[^;}]+/s,
  'reader logo must not receive a fixed CSS height that can stretch the viewer toolbar'
);

console.log('header_layout_stability_contract.test.js: PASS');
