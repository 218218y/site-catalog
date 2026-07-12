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
  assert.match(html, /<script src="page-transition\.js"><\/script>\s*<script src="site-routes\.js"><\/script>\s*<script src="app\.js"><\/script>/);
  assert.match(html, /<div class="site-page-transition" id="sitePageTransition" aria-hidden="true"><\/div>/);
  assert.doesNotMatch(html, /site-page-transition-(?:brand|logo|progress)/);
  assert.match(html, /href="index\.html" aria-label="רהיטי ברגיג - דף הבית"/);
}

const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const builder = fs.readFileSync(path.join(root, 'tools', 'build_deploy_bundle.py'), 'utf8');
const pageBuilder = fs.readFileSync(path.join(root, 'tools', 'build_site_pages.py'), 'utf8');

assert.match(template, /data-page="\{\{PAGE_MODE\}\}"/);
const globalSearchIndex = template.indexOf('id="catalogSearch"');
const mainIndex = template.indexOf('<main id="top">');
assert.ok(globalSearchIndex >= 0 && globalSearchIndex < mainIndex, 'global search must remain outside page-specific main content');
assert.doesNotMatch(app, /parseLegacyHash/);
assert.match(template, /class="back-link catalog-back-button"[\s\S]*?<svg/);
assert.match(app, /els\.globalSearchOpen\?\.addEventListener\("click"[\s\S]*?setGlobalSearchPanelOpen/);
assert.match(css, /\.catalog-back-button\s*\{[\s\S]*?border-radius:\s*999px;/);
assert.match(pageBuilder, /PAGE_DOCUMENTS = \(/);
assert.match(pageBuilder, /render_site_pages/);
assert.match(builder, /from build_site_pages import PAGE_DOCUMENTS, render_site_pages/);
assert.match(builder, /html_paths = \[out_dir \/ page\.filename for page in PAGE_DOCUMENTS\]/);
assert.match(app, /navigateTo\(viewerDocumentUrl\(state\.catalog\.id, page, \{ source \}\)\)/);
assert.match(app, /navigateTo\(favoritesDocumentUrl\(\)\)/);
assert.match(app, /siteRoutes\?\.parseLocation/);
assert.match(css, /body\[data-page="favorites"\] \.favorites-panel\.favorites-standalone-page/);
assert.match(css, /body\[data-page="viewer"\] > \.site-header/);
const transition = fs.readFileSync(path.join(root, 'page-transition.js'), 'utf8');
assert.match(template, /document\.documentElement\.classList\.add\("site-transition-pending"\)/);
assert.match(template, /<div class="site-page-transition" id="sitePageTransition" aria-hidden="true"><\/div>/);
assert.doesNotMatch(template, /site-page-transition-(?:brand|logo|progress)/);
assert.match(template, /<script src="page-transition\.js"><\/script>/);
assert.match(transition, /function prefetchDocument\(url\)/);
assert.match(transition, /hint\.rel = 'prefetch'/);
assert.match(transition, /function coverThen\(callback\)/);
assert.match(transition, /global\.BargigPageTransition = Object\.freeze/);
assert.match(transition, /global\.addEventListener\('pageshow'[\s\S]*?event\.persisted/);
assert.match(app, /pageTransition\?\.navigate/);
assert.match(app, /pageTransition\?\.back/);
assert.match(app, /pageTransition\?\.ready/);
assert.match(app, /return initDocumentRoute\(\)/);
assert.match(css, /\.site-page-transition\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?z-index:\s*2147483000;/);
assert.match(css, /html\.site-transition-pending \.site-page-transition\s*\{[\s\S]*?opacity:\s*1;[\s\S]*?transition:\s*none;/);
assert.match(css, /html\.site-transition-leaving \.site-page-transition\s*\{[\s\S]*?var\(--page-transition-cover-duration\)/);
assert.match(css, /html\.site-transition-entering \.site-page-transition\s*\{[\s\S]*?var\(--page-transition-reveal-duration\)/);
assert.match(css, /--content-transition-dim-strength:\s*\.58;/);
assert.match(css, /\.site-page-transition\s*\{[\s\S]*?background:\s*rgb\(8 6 4 \/ var\(--content-transition-dim-strength\)\);/);
assert.match(css, /@keyframes lightbox-page-swap\s*\{[\s\S]*?opacity:\s*calc\(1 - var\(--content-transition-dim-strength\)\);/);
assert.doesNotMatch(css, /\.site-page-transition\s*\{[^}]*background:\s*#080604;/);
assert.doesNotMatch(css, /site-page-transition-(?:brand|logo|progress)|site-page-transition-(?:sweep|shine)/);
assert.match(css, /body:not\(\[data-page="viewer"\]\)\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
assert.match(css, /body:not\(\[data-page="viewer"\]\) > main\s*\{[\s\S]*?flex:\s*1 0 auto;/);
assert.match(css, /\.lightbox-image-frame\.page-swap-enter\s*\{[\s\S]*?var\(--image-swap-duration\)[\s\S]*?var\(--page-transition-easing\)/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.site-page-transition[\s\S]*?transition-duration:\s*1ms\s*!important;/);
assert.match(builder, /"page-transition\.js"/);

console.log('multi_page_architecture_contract.test.js: PASS');
