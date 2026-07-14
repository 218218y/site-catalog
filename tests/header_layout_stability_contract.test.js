'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const fullLogoAssetPath = path.join(root, 'brand-logo.svg');
const headerLogoAssetPath = path.join(root, 'brand-logo-header.svg');
const fullLogoSvg = fs.readFileSync(fullLogoAssetPath, 'utf8');
const headerLogoSvg = fs.readFileSync(headerLogoAssetPath, 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const pageFiles = ['site.template.html', 'index.html', 'catalog.html', 'favorites.html', 'viewer.html'];

for (const [name, svg] of [['full logo', fullLogoSvg], ['header logo', headerLogoSvg]]) {
  assert.match(svg, /<svg\b[^>]*\bwidth="786"[^>]*\bheight="317"[^>]*\bviewBox="0 0 786 317"/s, `${name} must preserve intrinsic dimensions`);
  assert.match(svg, /<path\b[^>]*\bfill-rule="evenodd"/s, `${name} must contain native vector paths`);
  assert.doesNotMatch(svg, /<image\b|data:image\//i, `${name} must not wrap or embed raster artwork`);
}
assert.match(fullLogoSvg, /<rect\b/s, 'the shared viewer/export logo must keep its built-in panel');
assert.doesNotMatch(headerLogoSvg, /<rect\b/s, 'the header logo must leave the panel to CSS so it can match the header palette');
assert.equal(fs.existsSync(path.join(root, 'wp_logo_data.js')), false, 'legacy embedded logo data file must be removed');
assert.equal(fs.existsSync(path.join(root, 'brand-logo.js')), false, 'legacy logo injection script must be removed');

const logoWidth = 786;
const logoHeight = 317;
for (const filename of pageFiles) {
  const html = fs.readFileSync(path.join(root, filename), 'utf8');
  const headerLogo = html.match(/<img\b[^>]*class="brand-mark"[^>]*>/)?.[0];
  const readerLogo = html.match(/<img\b[^>]*class="reader-logo"[^>]*>/)?.[0];
  assert.ok(headerLogo, `${filename} must contain the header logo`);
  assert.ok(readerLogo, `${filename} must contain the reader logo`);
  assert.match(html, /<html\b[^>]*class="has-bargig-logo"[^>]*--bargig-logo-url:\s*url\('brand-logo\.svg'\)/s);
  assert.doesNotMatch(html, /wp_logo_data\.js|brand-logo\.js|data-wp-logo=/);
  assert.match(headerLogo, /\bsrc="brand-logo-header\.svg"/, `${filename} header must use the transparent header artwork`);
  assert.match(readerLogo, /\bsrc="brand-logo\.svg"/, `${filename} reader must keep the complete shared logo`);
  for (const tag of [headerLogo, readerLogo]) {
    assert.match(tag, /\bdata-brand-logo="1"/, `${filename} logos must keep the load hook`);
    assert.match(tag, new RegExp(`\\bwidth="${logoWidth}"`), `${filename} logo must reserve its intrinsic width`);
    assert.match(tag, new RegExp(`\\bheight="${logoHeight}"`), `${filename} logo must reserve its intrinsic height`);
  }
}

const escapedRatio = `${logoWidth}\\s*\\/\\s*${logoHeight}`;
const sharedLogoRule = css.match(/img\[data-brand-logo="1"\]\s*\{([\s\S]*?)\}/);
assert.ok(sharedLogoRule, 'shared logo CSS rule must exist');
assert.match(sharedLogoRule[1], new RegExp(`aspect-ratio:\\s*${escapedRatio};`), 'logo CSS must preserve the SVG aspect ratio before load');
assert.match(sharedLogoRule[1], /height:\s*auto;/, 'responsive logos must override the intrinsic height attribute');
assert.match(css, /\.brand-mark-frame\s*\{[\s\S]*?width:\s*clamp\([^;]+\);[\s\S]*?aspect-ratio:\s*786\s*\/\s*317;/);
assert.match(css, /\.brand-mark\s*\{[\s\S]*?width:\s*100%;[\s\S]*?height:\s*auto;/);
assert.doesNotMatch(css, /\.reader-logo\s*\{[^}]*height:\s*(?!auto\b)[^;}]+/s, 'reader logo must not receive a fixed CSS height');

console.log('header_layout_stability_contract.test.js: PASS');
