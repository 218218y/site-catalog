"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const template = fs.readFileSync(path.join(root, "site.template.html"), "utf8");

for (const relative of ["index.html", "catalog.html", "favorites.html", "viewer.html"]) {
  const html = fs.readFileSync(path.join(root, relative), "utf8");
  assert.match(html, /id="viewerInquiryButton"[^>]*aria-controls="viewerInquiryOverlay"/, relative);
  assert.match(html, /id="viewerInquiryOverlay"[^>]*aria-hidden="true"/, relative);
  assert.match(html, /id="viewerMobileMoreToggle"[^>]*aria-controls="viewerMobileMoreMenu"/, relative);
  assert.match(html, /id="viewerOnboardingCounter">1 מתוך 3</, relative);
}

assert.match(template, /id="viewerInquiryCatalog"/);
assert.match(template, /id="viewerInquiryPage"/);
assert.match(template, /id="viewerInquiryCopy"/);
assert.match(template, /data-viewer-mobile-action="download"/);
assert.match(template, /data-viewer-mobile-action="fit-height"/);
assert.match(template, /data-viewer-mobile-action="fit-width"/);
assert.match(template, /id="viewerMobileFavoritesLink"/);

assert.match(app, /function viewerInquiryReference\(\)[\s\S]*?viewerDocumentUrl\(state\.catalog\.id, page\)/);
assert.match(app, /`קטלוג: \$\{title\}`/);
assert.match(app, /`עמוד: \$\{page\}`/);
assert.match(app, /function syncViewerInquiryUi\([\s\S]*?viewerInquiryCatalog\.textContent = reference\.title[\s\S]*?viewerInquiryPage\.textContent = reference\.pageLabel/);
assert.match(app, /new URLSearchParams\(\{ subject: reference\.subject, body: reference\.text \}\)/);
assert.match(app, /function copyViewerInquiryReference\([\s\S]*?copyTextToClipboard\(reference\.text\)[\s\S]*?action: "copy"[\s\S]*?source: "viewer-inquiry"/);
assert.match(app, /function syncViewerScrollActivePage\([\s\S]*?syncViewerInquiryUi\(\)/);
assert.match(app, /function updateLightbox\([\s\S]*?syncViewerInquiryUi\(\)[\s\S]*?syncViewerMobileMoreMenuState\(\)/);
assert.match(app, /function handleViewerMobileMoreKeydown\([\s\S]*?ArrowDown[\s\S]*?ArrowUp[\s\S]*?Home[\s\S]*?End/);
assert.match(app, /function hideLightboxUi\([\s\S]*?closeViewerInquiry\(\{ restoreFocus: false \}\)[\s\S]*?closeViewerMobileMoreMenu\(\)/);

const lightboxRender = app.match(/function renderLightboxSearchResults\(query\) \{([\s\S]*?)\n\}\n\nfunction renderCatalogCategoryMenu/)?.[1];
const globalRender = app.match(/function renderSearchResults\(query\) \{([\s\S]*?)\n\}\n\nfunction attachSearchUiEvents/)?.[1];
assert.ok(lightboxRender, "lightbox search renderer should be extractable");
assert.ok(globalRender, "global search renderer should be extractable");
assert.doesNotMatch(lightboxRender, /telemetryTrackSearch/);
assert.doesNotMatch(globalRender, /telemetryTrackSearch/);
assert.match(app, /function submitLightboxSearch\([\s\S]*?trackCompletedLightboxSearch\("submit", rawQuery\)/);
assert.match(app, /function submitGlobalSearch\([\s\S]*?trackCompletedGlobalSearch\("submit", rawQuery\)/);
assert.match(app, /trackCompletedLightboxSearch\("result-open"\)/);
assert.match(app, /trackCompletedGlobalSearch\("result-open"\)/);
assert.match(app, /function telemetryTrackSearch\([\s\S]*?completion = telemetryCleanText\(options\.completion \|\| "submit"[\s\S]*?action: completion/);
assert.doesNotMatch(app, /TELEMETRY_SEARCH_DELAY_MS|searchTimers/);

assert.match(css, /\.viewer-inquiry-button\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?min-height:\s*46px;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?#lightboxScreenshot,[\s\S]*?#lightboxPinTopBar,[\s\S]*?display:\s*none !important;/);
assert.match(css, /@media \(max-width: 480px\)[\s\S]*?grid-template-areas:\s*"brand actions";/);

console.log("viewer_stage1_value_contract.test.js: PASS");
