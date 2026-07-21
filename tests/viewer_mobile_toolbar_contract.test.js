'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
const e2e = fs.readFileSync(path.join(root, 'tests', 'e2e', 'site-catalog.spec.js'), 'utf8');

assert.match(template, /id="lightboxSearchPanel"/);
assert.match(template, /id="lightboxMobileSearchToggle"[^>]*aria-controls="lightboxSearchPanel"/);
assert.match(template, /id="lightboxMobileSearchClose"/);
assert.match(template, /id="lightboxMobileSearchToggle"[\s\S]*?id="viewerMobileMoreToggle"[\s\S]*?id="viewerMobileMoreMenu"[\s\S]*?data-viewer-mobile-action="fit-auto"[\s\S]*?id="fitAutoBtn"[\s\S]*?id="fitHeightBtn"/);
assert.match(template, /<button[^>]*id="topHotspot"[^>]*aria-label="הצגת סרגל הכלים העליון"[^>]*>[\s\S]*?<span aria-hidden="true">⌄<\/span>/);

assert.match(app, /const MOBILE_READER_SEARCH_MEDIA = "\(max-width: 760px\)";/);
assert.match(app, /lightboxMobileSearchOpen: false/);
assert.match(app, /function setLightboxMobileSearchOpen\(open, options = \{\}\)/);
assert.match(app, /els\.lightbox\?\.classList\.toggle\("mobile-search-open", isOpen\)/);
assert.match(app, /lightboxMobileSearchToggle: \$\("lightboxMobileSearchToggle"\)/);
assert.match(app, /lightboxMobileSearchClose: \$\("lightboxMobileSearchClose"\)/);
assert.match(app, /function handleTopLayerEscape\(event\)[\s\S]*?state\.viewerMobileMoreOpen[\s\S]*?closeViewerMobileMoreMenu\(\{ returnFocus: true \}\)/);
assert.match(app, /function setViewerMobileMoreOpen\(open, options = \{\}\)/);
assert.match(app, /bindFeatureEventsOnce\("viewer-actions", attachViewerActionEvents\)/);
assert.match(app, /els\.topHotspot\?\.addEventListener\("click", \(event\) => \{[\s\S]*?showTopUiTemporarily\(2200\);/);
assert.doesNotMatch(app, /els\.topHotspot\?\.addEventListener\("mouseenter"/);
assert.match(app, /targetsExplicitTopOpener = Boolean\(els\.topHotspot\?\.contains\?\.\(event\.target\)\)[\s\S]*?if \(!targetsExplicitTopOpener\) openLightboxEdgeUiForPointer\(point\);/);

assert.match(css, /\.reader-mobile-search-toggle,\s*\.reader-mobile-search-head\s*\{\s*display:\s*none;/);
assert.match(css, /\.lightbox\.mobile-search-open \.reader-header-search\s*\{\s*display:\s*block;/);
assert.match(css, /\.lightbox:not\(\.mobile-search-open\) \.lightbox-search-results\s*\{[\s\S]*?display:\s*none !important;/);
assert.match(css, /@media \(max-width: 480px\)[\s\S]*?--reader-mobile-toolbar-height:\s*58px;[\s\S]*?grid-template-areas:\s*"brand actions";/);
assert.doesNotMatch(css, /grid-template-areas:\s*"brand"\s*"search"\s*"actions";/);
assert.doesNotMatch(css, /\.reader-quick-actions\s*\{\s*display:\s*none;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?#lightboxScreenshot,[\s\S]*?#lightboxPinTopBar,[\s\S]*?\.lightbox-actions \.viewer-fit-control,[\s\S]*?display:\s*none !important;/);
assert.match(css, /\.viewer-mobile-more-menu\.visible\s*\{[\s\S]*?pointer-events:\s*auto;/);
assert.match(css, /\.reader-top-hotspot\s*\{[\s\S]*?left:\s*50%;[\s\S]*?width:\s*56px;[\s\S]*?height:\s*44px;[\s\S]*?transform:\s*translateX\(-50%\);/);
assert.doesNotMatch(css, /\.lightbox-top-hotspot:hover \+ \.lightbox-top-shell/);

assert.match(e2e, /async function locatorCenterIsInViewport\(locator\)[\s\S]*?const centerX = rect\.left \+ rect\.width \/ 2;[\s\S]*?const centerY = rect\.top \+ rect\.height \/ 2;/);
assert.match(e2e, /await revealViewerTopToolbar\(page, "#fitWidthBtn"\);\s*await page\.locator\("#fitWidthBtn"\)\.click\(\);/);
assert.doesNotMatch(e2e, /page\.mouse\.move\(720,\s*1\)/);

console.log('viewer_mobile_toolbar_contract.test.js: PASS');
