'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllBundles, readAllCssBundles } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const app = readAllBundles();
const css = readAllCssBundles();

assert.match(template, /id="lightboxSearchPanel"/);
assert.match(template, /<button[^>]*id="topHotspot"[^>]*type="button"[^>]*aria-label="[^"]+"[^>]*aria-controls="lightboxBar"/);
assert.doesNotMatch(template, /id="topHotspot"[^>]*aria-hidden="true"/);
assert.match(template, /id="lightboxMobileSearchToggle"[^>]*aria-controls="lightboxSearchPanel"/);
assert.match(template, /id="lightboxMobileSearchClose"/);
assert.match(template, /id="lightboxMobileSearchToggle"[\s\S]*?id="viewerMobileMoreToggle"[\s\S]*?id="viewerMobileMoreMenu"[\s\S]*?data-viewer-mobile-action="fit-auto"[\s\S]*?id="fitAutoBtn"[\s\S]*?id="fitHeightBtn"/);

assert.match(app, /const MOBILE_READER_SEARCH_MEDIA = "\(max-width: 760px\)";/);
assert.match(app, /lightboxMobileSearchOpen: false/);
assert.match(app, /function setLightboxMobileSearchOpen\(open, options = \{\}\)/);
assert.match(app, /getFeatureInterface\("viewer"\)\?\.syncMobileSearchUi\?\.\(isOpen\)/);
assert.match(app, /syncMobileSearchUi: \(isOpen\) => viewerElements\.lightbox\?\.classList\.toggle\("mobile-search-open", Boolean\(isOpen\)\)/);
assert.match(app, /lightboxMobileSearchToggle: \$\("lightboxMobileSearchToggle"\)/);
assert.match(app, /lightboxMobileSearchClose: \$\("lightboxMobileSearchClose"\)/);
assert.match(app, /function handleTopLayerEscape\(event\)[\s\S]*?viewerState\.viewerMobileMoreOpen[\s\S]*?closeViewerMobileMoreMenu\(\{ returnFocus: true \}\)/);
assert.match(app, /function setViewerMobileMoreOpen\(open, options = \{\}\)/);
assert.match(app, /function openTopUiFromHotspot\(event = null\)[\s\S]*?markTouchLikeViewportInput\(event\);[\s\S]*?showTopUiTemporarily\(0\);/);
assert.match(app, /viewerElements\.topHotspot\?\.addEventListener\("pointerdown", openTopUiFromHotspot\)/);
assert.match(app, /viewerElements\.topHotspot\?\.addEventListener\("click", openTopUiFromHotspot\)/);
assert.match(app, /registerFeatureInterface\("viewer", \{[\s\S]*?attachEvents: \(\) => \{[\s\S]*?attachViewerActionEvents\(\);[\s\S]*?attachViewerOnboardingEvents\(\);[\s\S]*?attachViewerEvents\(\);/);

assert.match(css, /\.reader-mobile-search-toggle,\s*\.reader-mobile-search-head\s*\{\s*display:\s*none;/);
assert.match(css, /\.lightbox\.mobile-search-open \.reader-header-search\s*\{\s*display:\s*block;/);
assert.match(css, /\.lightbox:not\(\.mobile-search-open\) \.lightbox-search-results\s*\{[\s\S]*?display:\s*none !important;/);
assert.match(css, /@media \(max-width: 480px\)[\s\S]*?--reader-mobile-toolbar-height:\s*58px;[\s\S]*?grid-template-areas:\s*"brand actions";/);
assert.doesNotMatch(css, /grid-template-areas:\s*"brand"\s*"search"\s*"actions";/);
assert.doesNotMatch(css, /\.reader-quick-actions\s*\{\s*display:\s*none;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?#lightboxScreenshot,[\s\S]*?#lightboxPinTopBar,[\s\S]*?\.lightbox-actions \.viewer-fit-control,[\s\S]*?display:\s*none !important;/);
assert.match(css, /\.viewer-mobile-more-menu\.visible\s*\{[\s\S]*?pointer-events:\s*auto;/);

console.log('viewer_mobile_toolbar_contract.test.js: PASS');
