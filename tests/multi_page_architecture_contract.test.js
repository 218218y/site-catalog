'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pages = {
  'index.html': 'home',
  'catalog.html': 'catalog',
  'favorites.html': 'favorites',
  'viewer.html': 'viewer'
};

for (const [filename, mode] of Object.entries(pages)) {
  const html = fs.readFileSync(path.join(root, filename), 'utf8');
  assert.match(html, new RegExp(`<body data-page="${mode}">`));
  assert.match(html, /<script src="site-routes\.js"><\/script>\s*<script src="app\.js"><\/script>/);
  assert.match(html, /href="index\.html" aria-label="רהיטי ברגיג - דף הבית"/);
}

const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'tools', 'build_deploy_bundle.py'), 'utf8');
const pageBuilder = fs.readFileSync(path.join(root, 'tools', 'build_site_pages.py'), 'utf8');

assert.match(template, /data-page="\{\{PAGE_MODE\}\}"/);
assert.match(pageBuilder, /PAGE_DOCUMENTS = \(/);
assert.match(pageBuilder, /render_site_pages/);
assert.match(builder, /from build_site_pages import PAGE_DOCUMENTS, render_site_pages/);
assert.match(builder, /html_paths = \[out_dir \/ page\.filename for page in PAGE_DOCUMENTS\]/);
assert.match(app, /navigateTo\(viewerDocumentUrl\(state\.catalog\.id, page, \{ source \}\)\)/);
assert.match(app, /navigateTo\(favoritesDocumentUrl\(\)\)/);
assert.match(app, /siteRoutes\?\.parseLocation/);
assert.match(css, /body\[data-page="favorites"\] \.favorites-panel\.favorites-standalone-page/);
assert.match(css, /body\[data-page="viewer"\] > \.site-header/);

console.log('multi_page_architecture_contract.test.js: PASS');
