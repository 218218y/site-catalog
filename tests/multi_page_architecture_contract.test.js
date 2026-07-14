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
  assert.match(html, /<script src="favorites-store\.js"><\/script>\s*<script src="site-routes\.js"><\/script>\s*<script src="app\.js"><\/script>/);
  assert.doesNotMatch(html, /page-transition\.js|sitePageTransition|site-page-transition|site-transition-(?:pending|leaving|entering)/);
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

// Normal browsing remains native, but fullscreen navigation must stay in the
// current document because replacing the document makes browsers exit fullscreen.
assert.doesNotMatch(template, /page-transition\.js|sitePageTransition|site-page-transition|site-transition-(?:pending|leaving|entering)/);
assert.doesNotMatch(app, /BargigPageTransition|pageTransition\?\.|site-transition-(?:pending|leaving|entering)/);
assert.doesNotMatch(app, /const APP_PAGE/);
assert.match(app, /let currentAppPage = siteRoutes\?\.pageFromLocation/);
assert.match(app, /function setCurrentAppPage\([\s\S]*?document\.body\.dataset\.page = currentAppPage/);
assert.match(app, /function canNavigateWithinCurrentDocument\([\s\S]*?isBrowserFullscreenActive\(\)[\s\S]*?isInternalAppDocumentUrl\(url\)/);
assert.match(app, /function navigateWithinCurrentDocument\([\s\S]*?history\.pushState\([\s\S]*?initDocumentRoute\(\{ scrollPosition/);
assert.match(app, /function navigateTo\([\s\S]*?canNavigateWithinCurrentDocument\(targetUrl\)[\s\S]*?window\.location\.replace\(target\)[\s\S]*?window\.location\.assign\(target\)/);
assert.match(app, /function handleInternalAppLinkClick\([\s\S]*?isBrowserFullscreenActive\(\)[\s\S]*?navigateWithinCurrentDocument\(targetUrl\)/);
assert.match(app, /window\.addEventListener\("popstate"[\s\S]*?initDocumentRoute\(\{/);
assert.match(app, /function prepareDocumentRoute\([\s\S]*?hideLightboxUi\(\)[\s\S]*?hideFavoritesPanelUi\(\)[\s\S]*?setCurrentAppPage\(nextPage\)/);
assert.match(app, /function navigateBack\(\) \{\s*window\.history\.back\(\);\s*\}/);
assert.match(app, /function currentVisibleDocumentUrl\(\) \{\s*return window\.location\.href;\s*\}/);
assert.match(app, /function copyCurrentMainHeaderLink\([\s\S]*?currentVisibleDocumentUrl\(\)/);
assert.match(app, /function copyCurrentLightboxLink\([\s\S]*?currentVisibleDocumentUrl\(\)/);
assert.doesNotMatch(app, /function build(?:MainHeader|LightboxPage)Url/);
assert.match(app, /function markAppReady\(\) \{[\s\S]*?data-app-ready/);
assert.match(app, /return initDocumentRoute\(\)/);
assert.doesNotMatch(app, /(?:localStorage|sessionStorage)[\s\S]{0,80}fullscreen/i);
assert.doesNotMatch(css, /site-page-transition|site-transition-(?:pending|leaving|entering)|--page-transition-|--content-transition-dim-strength/);
assert.doesNotMatch(builder, /"page-transition\.js"/);
assert.equal(fs.existsSync(path.join(root, 'page-transition.js')), false, 'obsolete page transition runtime must be removed');
assert.equal(fs.existsSync(path.join(root, 'tests', 'page_transition.test.js')), false, 'obsolete page transition test must be removed');

// The layout fix that solved the footer jump remains active.
assert.match(css, /body:not\(\[data-page="viewer"\]\)\s*\{[\s\S]*?min-height:\s*100svh;[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
assert.match(css, /body:not\(\[data-page="viewer"\]\) > main\s*\{[\s\S]*?flex:\s*1 0 auto;/);
assert.match(css, /body:not\(\[data-page="viewer"\]\) > \.site-footer\s*\{[\s\S]*?margin-top:\s*auto;/);
assert.match(css, /body\[data-page="favorites"\] > \.favorites-panel\.favorites-standalone-page\s*\{[\s\S]*?flex:\s*1 0 auto;/);

// Only the fullscreen image swap keeps an animation contract.
assert.match(css, /--image-swap-duration:\s*220ms;/);
assert.match(css, /--image-swap-easing:\s*cubic-bezier\(\.2, \.72, \.22, 1\);/);
assert.match(css, /--image-swap-start-opacity:\s*\.42;/);
assert.match(css, /\.lightbox-image-frame\.page-swap-enter\s*\{[\s\S]*?var\(--image-swap-duration\)[\s\S]*?var\(--image-swap-easing\)/);
assert.match(css, /@keyframes lightbox-page-swap\s*\{[\s\S]*?opacity:\s*var\(--image-swap-start-opacity\);/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.lightbox-image-frame\.page-swap-enter[\s\S]*?animation:\s*none !important;/);

console.log('multi_page_architecture_contract.test.js: PASS');
