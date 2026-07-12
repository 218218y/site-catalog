'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const logoDataSource = fs.readFileSync(path.join(root, 'wp_logo_data.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const pageFiles = ['site.template.html', 'index.html', 'catalog.html', 'favorites.html', 'viewer.html'];

const dataUriMatch = logoDataSource.match(/var DATA_URI\s*=\s*'data:image\/png;base64,([^']+)'/s);
assert.ok(dataUriMatch, 'embedded PNG logo data URI must remain readable');

const png = Buffer.from(dataUriMatch[1], 'base64');
assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG', 'embedded logo must be a PNG');
const logoWidth = png.readUInt32BE(16);
const logoHeight = png.readUInt32BE(20);
assert.ok(logoWidth > 0 && logoHeight > 0, 'embedded logo must expose valid intrinsic dimensions');

const logoSelector = /<img\b[^>]*(?:data-brand-logo="1"|data-wp-logo="1")[^>]*>/g;
for (const filename of pageFiles) {
  const html = fs.readFileSync(path.join(root, filename), 'utf8');
  const logoTags = html.match(logoSelector) || [];
  assert.equal(logoTags.length, 2, `${filename} must contain the shared header and reader logos`);
  for (const tag of logoTags) {
    assert.match(tag, new RegExp(`\\bwidth="${logoWidth}"`), `${filename} logo must reserve its intrinsic width`);
    assert.match(tag, new RegExp(`\\bheight="${logoHeight}"`), `${filename} logo must reserve its intrinsic height`);
  }
}

const escapedRatio = `${logoWidth}\\s*\\/\\s*${logoHeight}`;
const sharedLogoRule = css.match(
  /img\[data-brand-logo="1"\],[\s\S]*?#wpHeaderLogo\s*\{([\s\S]*?)\}/
);
assert.ok(sharedLogoRule, 'shared logo CSS rule must exist');
assert.match(
  sharedLogoRule[1],
  new RegExp(`aspect-ratio:\\s*${escapedRatio};`),
  'logo CSS must preserve the same aspect ratio before the data URI is assigned'
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
