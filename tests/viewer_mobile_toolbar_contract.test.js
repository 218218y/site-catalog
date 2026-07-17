'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.match(template, /id="lightboxSearchPanel"/);
assert.match(template, /id="lightboxMobileSearchToggle"[^>]*aria-controls="lightboxSearchPanel"/);
assert.match(template, /id="lightboxMobileSearchClose"/);
assert.match(template, /id="lightboxMobileSearchToggle"[\s\S]*?id="viewerMobileMoreToggle"[\s\S]*?id="viewerMobileMoreMenu"[\s\S]*?id="fitHeightBtn"/);

assert.match(app, /const MOBILE_READER_SEARCH_MEDIA = "\(max-width: 760px\)";/);
assert.match(app, /lightboxMobileSearchOpen: false/);
assert.match(app, /function setLightboxMobileSearchOpen\(open, options = \{\}\)/);
assert.match(app, /els\.lightbox\?\.classList\.toggle\("mobile-search-open", isOpen\)/);
assert.match(app, /lightboxMobileSearchToggle: \$\("lightboxMobileSearchToggle"\)/);
assert.match(app, /lightboxMobileSearchClose: \$\("lightboxMobileSearchClose"\)/);
assert.match(app, /event\.key === "Escape" && state\.viewerMobileMoreOpen/);
assert.match(app, /function setViewerMobileMoreOpen\(open, options = \{\}\)/);
assert.match(app, /bindFeatureEventsOnce\("viewer-actions", attachViewerActionEvents\)/);

assert.match(css, /\.reader-mobile-search-toggle,\s*\.reader-mobile-search-head\s*\{\s*display:\s*none;/);
assert.match(css, /\.lightbox\.mobile-search-open \.reader-header-search\s*\{\s*display:\s*block;/);
assert.match(css, /\.lightbox:not\(\.mobile-search-open\) \.lightbox-search-results\s*\{[\s\S]*?display:\s*none !important;/);
assert.match(css, /@media \(max-width: 480px\)[\s\S]*?--reader-mobile-toolbar-height:\s*58px;[\s\S]*?grid-template-areas:\s*"brand actions";/);
assert.doesNotMatch(css, /grid-template-areas:\s*"brand"\s*"search"\s*"actions";/);
assert.doesNotMatch(css, /\.reader-quick-actions\s*\{\s*display:\s*none;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?#lightboxScreenshot,[\s\S]*?#lightboxPinTopBar,[\s\S]*?\.lightbox-actions \.viewer-fit-control,[\s\S]*?display:\s*none !important;/);
assert.match(css, /\.viewer-mobile-more-menu\.visible\s*\{[\s\S]*?pointer-events:\s*auto;/);

console.log('viewer_mobile_toolbar_contract.test.js: PASS');
