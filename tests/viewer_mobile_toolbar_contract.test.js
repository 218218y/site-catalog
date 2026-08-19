'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllBundles, readAllCssBundles } = require('./frontend_test_assets');
const { hasCall, hasFunction, hasPropertyPath, inventoryProjectFiles } = require('./helpers/frontend_ast');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const app = readAllBundles();
const searchStateSource = fs.readFileSync(path.join(root, 'src/js/13-search-state.js'), 'utf8');
const uiRuntimeSource = fs.readFileSync(path.join(root, 'src/js/21-ui-runtime.js'), 'utf8');
const readerSearchSource = fs.readFileSync(path.join(root, 'src/js/49-search-reader-ui.js'), 'utf8');
const viewerShellSource = fs.readFileSync(path.join(root, 'src/js/56-viewer-shell.js'), 'utf8');
const viewerSource = fs.readFileSync(path.join(root, 'src/js/60-viewer.js'), 'utf8');
const viewerActionsSource = fs.readFileSync(path.join(root, 'src/js/62-viewer-actions.js'), 'utf8');
const css = readAllCssBundles();
const inventories = inventoryProjectFiles(root, [
  'src/js/49-search-reader-ui.js',
  'src/js/21-ui-runtime.js',
  'src/js/56-viewer-shell.js',
  'src/js/60-viewer.js',
  'src/js/62-viewer-actions.js',
]);
const readerSearchAst = inventories['src/js/49-search-reader-ui.js'];
const uiRuntimeAst = inventories['src/js/21-ui-runtime.js'];
const viewerShellAst = inventories['src/js/56-viewer-shell.js'];
const viewerAst = inventories['src/js/60-viewer.js'];
const viewerActionsAst = inventories['src/js/62-viewer-actions.js'];

assert.match(template, /id="lightboxSearchPanel"/);
assert.match(template, /<button[^>]*id="topHotspot"[^>]*type="button"[^>]*aria-label="[^"]+"[^>]*aria-controls="lightboxBar"/);
assert.doesNotMatch(template, /id="topHotspot"[^>]*aria-hidden="true"/);
assert.match(template, /id="lightboxMobileSearchToggle"[^>]*aria-controls="lightboxSearchPanel"/);
assert.match(template, /id="lightboxMobileSearchClose"/);
assert.match(template, /id="lightboxMobileSearchToggle"[\s\S]*?id="viewerMobileMoreToggle"[\s\S]*?id="viewerMobileMoreMenu"[\s\S]*?data-viewer-mobile-action="fit-auto"[\s\S]*?id="fitAutoBtn"[\s\S]*?id="fitHeightBtn"/);

assert.match(searchStateSource, /const MOBILE_READER_SEARCH_MEDIA = "\(max-width: 760px\)";/);
assert.match(searchStateSource, /lightboxMobileSearchOpen: false/);
assert.ok(hasFunction(readerSearchAst, 'setLightboxMobileSearchOpen'));
assert.ok(hasCall(readerSearchAst, 'syncLightboxMobileSearchUi', 'setLightboxMobileSearchOpen'));
assert.ok(hasCall(readerSearchAst, 'getFeatureInterface("viewer").syncMobileSearchUi', 'syncLightboxMobileSearchUi'));
assert.ok(hasCall(viewerAst, 'viewerElements.lightbox.classList.toggle', 'syncMobileSearchUi'));
assert.match(searchStateSource, /lightboxMobileSearchToggle: \$requiredButton\("lightboxMobileSearchToggle"\)/);
assert.match(searchStateSource, /lightboxMobileSearchClose: \$requiredButton\("lightboxMobileSearchClose"\)/);
assert.ok(hasFunction(uiRuntimeAst, 'handleTopLayerEscape'));
assert.ok(hasCall(uiRuntimeAst, 'featureInterfacesByEscapePriority', 'handleTopLayerEscape'));
assert.ok(hasCall(uiRuntimeAst, 'api.closeTopLayer', 'handleTopLayerEscape'));
assert.ok(hasPropertyPath(viewerAst, 'viewerChromeState.viewerMobileMoreOpen', 'closeTopLayer'));
assert.ok(hasCall(viewerAst, 'closeViewerMobileMoreMenu', 'closeTopLayer'));
assert.ok(hasFunction(viewerActionsAst, 'setViewerMobileMoreOpen'));
assert.ok(hasFunction(viewerShellAst, 'openTopUiFromHotspot'));
assert.ok(hasCall(viewerShellAst, 'markTouchLikeViewportInput', 'openTopUiFromHotspot'));
assert.ok(hasCall(viewerShellAst, 'showTopUiTemporarily', 'openTopUiFromHotspot'));
assert.ok(viewerAst.calls.some((call) => call.callee === 'viewerElements.topHotspot.addEventListener' && call.arguments[0] === 'pointerdown'));
assert.ok(viewerAst.calls.some((call) => call.callee === 'viewerElements.topHotspot.addEventListener' && call.arguments[0] === 'click'));
for (const callee of ['attachViewerActionEvents', 'attachViewerOnboardingEvents', 'attachViewerEvents']) {
  assert.ok(hasCall(viewerAst, callee, 'attachEvents'));
}

assert.match(css, /\.reader-mobile-search-toggle,\s*\.reader-mobile-search-head\s*\{\s*display:\s*none;/);
assert.match(css, /\.lightbox\.mobile-search-open \.reader-header-search\s*\{\s*display:\s*block;/);
assert.match(css, /\.lightbox:not\(\.mobile-search-open\) \.lightbox-search-results\s*\{[\s\S]*?display:\s*none;/);
assert.doesNotMatch(css, /\.lightbox:not\(\.mobile-search-open\) \.lightbox-search-results\s*\{[^}]*!important/);
assert.match(css, /@media \(max-width: 480px\)[\s\S]*?--reader-mobile-toolbar-height:\s*58px;[\s\S]*?grid-template-areas:\s*"brand actions";/);
assert.doesNotMatch(css, /grid-template-areas:\s*"brand"\s*"search"\s*"actions";/);
assert.doesNotMatch(css, /\.reader-quick-actions\s*\{\s*display:\s*none;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?#lightboxScreenshot,[\s\S]*?#lightboxPinTopBar,[\s\S]*?\.lightbox-actions \.viewer-fit-control,[\s\S]*?display:\s*none;/);
assert.doesNotMatch(css, /#lightboxScreenshot,[\s\S]*?\.viewer-control-separator\s*\{[^}]*!important/);
assert.match(css, /\.viewer-mobile-more-menu\.visible\s*\{[\s\S]*?pointer-events:\s*auto;/);

console.log('viewer_mobile_toolbar_contract.test.js: PASS');
