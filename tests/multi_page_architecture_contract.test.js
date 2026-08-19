'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllBundles, readAllCssBundles } = require('./frontend_test_assets');
const { findCalls, inventoryProjectFiles } = require('./helpers/frontend_ast.js');

const root = path.join(__dirname, '..');
const pages = {
  'index.html': { mode: 'home', script: 'app-catalog.js', stylesheet: 'styles-catalog.css' },
  'catalog.html': { mode: 'catalog', script: 'app-catalog.js', stylesheet: 'styles-catalog.css' },
  'favorites.html': { mode: 'favorites', script: 'app-favorites.js', stylesheet: 'styles-favorites.css' },
  'viewer.html': { mode: 'viewer', script: 'app-viewer.js', stylesheet: 'styles-viewer.css' },
  'payment.html': { mode: 'payment', script: 'app-payment.js', stylesheet: 'styles.css' }
};

for (const [filename, { mode, script, stylesheet }] of Object.entries(pages)) {
  const html = fs.readFileSync(path.join(root, filename), 'utf8');
  assert.match(html, new RegExp(`<body data-page="${mode}"`));
  assert.doesNotMatch(html, /data-clean-routes/);
  assert.match(html, new RegExp(`<link rel="stylesheet" href="${stylesheet.replace(".", "\\.")}"`));
  assert.match(html, new RegExp(`<script type="module" data-bargig-route-module src="${script.replace(".", "\\.")}"><\/script>`));
  assert.doesNotMatch(html, /<script src="app\.js"><\/script>/);
  assert.doesNotMatch(html, /page-transition\.js|sitePageTransition|site-page-transition|site-transition-(?:pending|leaving|entering)/);
  assert.match(html, /href="index\.html" aria-label="רהיטי ברגיג - דף הבית"/);
}

const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const app = readAllBundles();
const javascriptFiles = [
  'src/js/00-navigation.js',
  'src/js/18-navigation-feature.js',
  'src/js/23-current-link-sharing.js',
  'src/js/30-favorites-share.js',
  'src/js/31-viewer-share.js',
  'src/js/50-search-ui.js',
  'src/js/60-viewer.js',
  'src/js/80-app-shell.js',
  'site-routes.js'
];
const ast = inventoryProjectFiles(root, javascriptFiles);
const navigationAst = ast['src/js/00-navigation.js'];
const navigationFeatureAst = ast['src/js/18-navigation-feature.js'];
const currentLinkSharingAst = ast['src/js/23-current-link-sharing.js'];
const favoritesShareAst = ast['src/js/30-favorites-share.js'];
const viewerShareAst = ast['src/js/31-viewer-share.js'];
const searchAst = ast['src/js/50-search-ui.js'];
const viewerAst = ast['src/js/60-viewer.js'];
const appShellAst = ast['src/js/80-app-shell.js'];
const siteRoutesAst = ast['site-routes.js'];
const hasCallIn = (inventory, callee, owner) => findCalls(inventory, callee).some((call) => call.enclosingFunction === owner);
const css = readAllCssBundles();
const builder = fs.readFileSync(path.join(root, 'tools', 'build_deploy_bundle.py'), 'utf8');
const pageBuilder = fs.readFileSync(path.join(root, 'tools', 'build_site_pages.py'), 'utf8');

assert.match(template, /data-page="\{\{PAGE_MODE\}\}"/);
assert.doesNotMatch(template, /data-clean-routes|CLEAN_ROUTES_ENABLED/);
const globalSearchIndex = template.indexOf('id="catalogSearch"');
const mainIndex = template.indexOf('<main id="main-content" tabindex="-1">');
assert.ok(globalSearchIndex >= 0 && globalSearchIndex < mainIndex, 'global search must remain outside page-specific main content');
assert.doesNotMatch(app, /parseLegacyHash/);
assert.match(template, /class="back-link catalog-back-button"[\s\S]*?<svg/);
assert.equal(findCalls(searchAst, 'searchElements.globalSearchOpen.addEventListener').some((call) => call.arguments[0] === 'click' && call.enclosingFunction === 'attachSearchUiEvents'), true);
assert.ok(findCalls(searchAst, 'setGlobalSearchPanelOpen').length > 0, 'global search click path must delegate panel state to its owner');
assert.match(css, /\.catalog-back-button\s*\{[\s\S]*?border-radius:\s*999px;/);
assert.match(pageBuilder, /PAGE_DOCUMENTS = \(/);
assert.match(pageBuilder, /render_site_pages/);
assert.match(builder, /from build_site_pages import \([\s\S]*?PAGE_DOCUMENTS,[\s\S]*?TECHNICAL_SHELL_FILENAMES,[\s\S]*?render_site_pages,/);
assert.match(builder, /function discover_bundle_html|def discover_bundle_html/);
assert.match(builder, /html_paths = discover_bundle_html\(out_dir\)/);
assert.equal(hasCallIn(viewerAst, 'navigateTo', 'openLightbox'), true);
assert.equal(hasCallIn(viewerAst, 'viewerDocumentUrl', 'openLightbox'), true);
assert.equal(hasCallIn(favoritesShareAst, 'navigateTo', 'openFavoritesPanel'), true);
assert.equal(hasCallIn(favoritesShareAst, 'favoritesDocumentUrl', 'openFavoritesPanel'), true);
assert.ok(findCalls(appShellAst, 'siteRoutes.parseLocation').length > 0);
assert.match(css, /body\[data-page="favorites"\] \.favorites-panel\.favorites-standalone-page/);
assert.match(css, /body\[data-page="viewer"\] > \.site-header/);

// Normal browsing remains native, but fullscreen navigation must stay in the
// current document because replacing the document makes browsers exit fullscreen.
assert.doesNotMatch(template, /page-transition\.js|sitePageTransition|site-page-transition|site-transition-(?:pending|leaving|entering)/);
assert.doesNotMatch(app, /BargigPageTransition|pageTransition\?\.|site-transition-(?:pending|leaving|entering)/);
assert.doesNotMatch(app, /const APP_PAGE/);
assert.equal(findCalls(navigationAst, 'siteRoutes.pageFromLocation').some((call) => call.enclosingFunction === null), true);
assert.ok(navigationAst.assignmentTargets.includes('document.body.dataset.page'));
assert.equal(hasCallIn(navigationAst, 'siteRoutes.isSameAppDocumentLocation', 'isInternalAppDocumentUrl'), true);
assert.equal(hasCallIn(navigationAst, 'getFeatureInterface("viewer").usesInDocumentFullscreenNavigation', 'canNavigateWithinCurrentDocument'), true);
assert.equal(hasCallIn(navigationAst, 'isInternalAppDocumentUrl', 'canNavigateWithinCurrentDocument'), true);
for (const name of ['matchPageFromLocation', 'basePathFromLocation', 'isDocumentLocation', 'isSameAppDocumentLocation']) {
  assert.ok(siteRoutesAst.functionDeclarations.includes(name), `site-routes runtime must own ${name}`);
}
assert.equal(hasCallIn(navigationAst, 'history.pushState', 'navigateWithinCurrentDocument'), true);
assert.equal(hasCallIn(navigationAst, 'requireFeatureInterface("app-shell").renderRoute', 'navigateWithinCurrentDocument'), true);
for (const callee of ['canNavigateWithinCurrentDocument', 'window.location.replace', 'window.location.assign']) {
  assert.equal(hasCallIn(navigationAst, callee, 'navigateTo'), true, `navigateTo must own ${callee}`);
}
assert.equal(hasCallIn(navigationAst, 'getFeatureInterface("viewer").usesInDocumentFullscreenNavigation', 'handleInternalAppLinkClick'), true);
assert.equal(hasCallIn(navigationAst, 'navigateWithinCurrentDocument', 'handleInternalAppLinkClick'), true);
assert.equal(findCalls(navigationAst, 'window.addEventListener').some((call) => call.arguments[0] === 'popstate' && call.enclosingFunction === 'attachNavigationEvents'), true);
assert.ok(findCalls(navigationAst, 'requireFeatureInterface("app-shell").renderRoute').length >= 2, 'navigation must render after both pushState and popstate');
assert.ok(navigationFeatureAst.functionDeclarations.includes('syncDocumentRouteShell'));
assert.equal(hasCallIn(navigationFeatureAst, 'shellElements.catalogsSection.classList.toggle', 'syncDocumentRouteShell'), true);
for (const feature of ['favorites', 'catalog-grid', 'search']) {
  assert.equal(findCalls(appShellAst, 'requireFeatureInterface').some((call) => call.arguments[0] === feature && call.enclosingFunction === 'prepareDocumentRoute'), true);
}
for (const callee of [
  'getFeatureInterface("viewer").prepareRoute',
  'favorites.prepareRoute',
  'catalogGrid.prepareRoute',
  'search.prepareRoute',
  'navigationFeature().setAppPage',
  'navigationFeature().syncRouteShell'
]) {
  assert.equal(hasCallIn(appShellAst, callee, 'prepareDocumentRoute'), true, `prepareDocumentRoute must coordinate ${callee}`);
}
assert.equal(hasCallIn(navigationAst, 'window.history.back', 'navigateBack'), true);
assert.ok(currentLinkSharingAst.functionDeclarations.includes('shareOrCopyCurrentLink'));
assert.ok(currentLinkSharingAst.propertyAccesses.some((access) => access.path === 'window.location.href'));
assert.equal(hasCallIn(currentLinkSharingAst, 'tryNativeShare', 'shareOrCopyCurrentLink'), true);
assert.equal(hasCallIn(currentLinkSharingAst, 'copyTextToClipboard', 'shareOrCopyCurrentLink'), true);
assert.equal(hasCallIn(favoritesShareAst, 'shareOrCopyCurrentLink', 'shareCurrentMainHeaderLink'), true);
assert.equal(hasCallIn(viewerShareAst, 'shareOrCopyCurrentLink', 'shareCurrentLightboxLink'), true);
assert.doesNotMatch(app, /function build(?:MainHeader|LightboxPage)Url/);
assert.equal(findCalls(navigationAst, 'document.body.setAttribute').some((call) => call.enclosingFunction === 'markAppReady' && call.arguments[0] === 'data-app-ready'), true);
assert.equal(hasCallIn(appShellAst, 'initDocumentRoute', 'initializeApplicationShell'), true);
assert.doesNotMatch(app, /(?:localStorage|sessionStorage)[\s\S]{0,80}fullscreen/i);
assert.doesNotMatch(css, /site-page-transition|site-transition-(?:pending|leaving|entering)|--page-transition-|--content-transition-dim-strength/);
assert.doesNotMatch(builder, /"page-transition\.js"/);
assert.equal(fs.existsSync(path.join(root, 'page-transition.js')), false, 'obsolete page transition runtime must be removed');
assert.equal(fs.existsSync(path.join(root, 'tests', 'page_transition.test.js')), false, 'obsolete page transition test must be removed');

// Public documents keep a stable column layout, but content no longer stretches to manufacture a large blank gap above the footer.
assert.match(css, /body:not\(\[data-page="viewer"\]\)\s*\{[\s\S]*?min-height:\s*100svh;[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;/);
assert.match(css, /body:not\(\[data-page="viewer"\]\) > main\s*\{[\s\S]*?flex:\s*0 0 auto;/);
assert.match(css, /body:not\(\[data-page="viewer"\]\) > \.site-footer\s*\{[\s\S]*?margin-top:\s*0;/);
assert.match(css, /body\[data-page="favorites"\] > \.favorites-panel\.favorites-standalone-page\s*\{[\s\S]*?flex:\s*0 0 auto;/);

// Both viewer layouts share one incoming-page animation contract.
assert.match(css, /--image-swap-duration:\s*190ms;/);
assert.match(css, /--image-swap-easing:\s*var\(--motion-easing\);/);
assert.match(css, /--image-swap-start-opacity:\s*\.58;/);
assert.match(css, /\.lightbox-image-frame\.page-swap-enter\s*\{[\s\S]*?var\(--image-swap-duration\)[\s\S]*?var\(--image-swap-easing\)/);
assert.match(css, /@keyframes viewer-page-swap-enter\s*\{[\s\S]*?opacity:\s*var\(--image-swap-start-opacity\);[\s\S]*?scale:\s*\.988;/);
assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?animation-duration:\s*\.01ms !important;/);

console.log('multi_page_architecture_contract.test.js: PASS');
