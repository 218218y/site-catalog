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
assert.match(template, /id="viewerInquiryGmail"/);
assert.match(template, /id="viewerInquiryEmail"/);
assert.match(template, /id="viewerInquiryShare"/);
assert.match(template, /id="viewerInquiryCopy"/);
const inquiryActions = template.match(/<div class="viewer-inquiry-actions" id="viewerInquiryActions">([\s\S]*?)<\/div>/)?.[1] || "";
assert.doesNotMatch(inquiryActions, /<small>/);
for (const label of ["שליחה דרך Gmail", "פתיחה בתוכנת דואר", "שיתוף פרטי הדגם", "העתקת ההודעה והקישור"]) {
  assert.ok(inquiryActions.includes(`<strong>${label}</strong>`), `missing compact inquiry label: ${label}`);
}
assert.doesNotMatch(template.match(/id="viewerInquiryGmail"[^>]*>/)?.[0] || "", /title=|data-tooltip=/);
assert.doesNotMatch(template.match(/id="viewerInquiryEmail"[^>]*>/)?.[0] || "", /title=|data-tooltip=/);
assert.doesNotMatch(template, /id="viewerInquiryMobile"|id="viewerInquiryPhone"/);
assert.match(template, /data-viewer-mobile-action="download"/);
assert.match(template, /data-viewer-mobile-action="fit-height"/);
assert.match(template, /data-viewer-mobile-action="fit-width"/);
assert.match(template, /id="viewerMobileFavoritesLink"/);

assert.match(app, /function viewerInquiryReference\(\)[\s\S]*?viewerDocumentUrl\(state\.catalog\.id, page\)/);
assert.match(app, /`קטלוג: \$\{title\}`/);
assert.match(app, /`עמוד: \$\{page\}`/);
assert.match(app, /function syncViewerInquiryUi\([\s\S]*?viewerInquiryCatalog\.textContent = reference\.title[\s\S]*?viewerInquiryPage\.textContent = reference\.pageLabel/);
assert.match(app, /new URLSearchParams\(\{ subject: reference\.subject, body: reference\.text \}\)/);
assert.match(app, /function viewerInquiryGmailUrl\([\s\S]*?mail\.google\.com\/mail\/\?/);
assert.match(app, /function shareViewerInquiryReference\([\s\S]*?const shareData = \{[\s\S]*?title: reference\.subject,[\s\S]*?text: reference\.shareText,[\s\S]*?url: reference\.url[\s\S]*?navigator\.share\(shareData\)[\s\S]*?action: "share"/);
assert.doesNotMatch(app, /viewerInquiry(?:Gmail|Email)\.title\s*=|setTooltipText\(els\.viewerInquiry(?:Gmail|Email)/);
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
assert.match(app, /function submitGlobalSearch\([\s\S]*?trackCompletedGlobalSearch\("submit", rawQuery, \{ immediate: true \}\)/);
assert.match(app, /trackCompletedLightboxSearch\("result-open"\)/);
assert.match(app, /trackCompletedGlobalSearch\("result-open", undefined, \{ immediate: true \}\)/);
assert.match(app, /function flushGlobalSearchTelemetryBeforeNavigation\([\s\S]*?telemetryFlush\(\)/);
assert.match(app, /function telemetryTrackSearch\([\s\S]*?completion = telemetryCleanText\(options\.completion \|\| "submit"[\s\S]*?action: completion[\s\S]*?immediate: options\.immediate === true/);
assert.doesNotMatch(app, /TELEMETRY_SEARCH_DELAY_MS|searchTimers/);

assert.match(css, /\.viewer-inquiry-button\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?min-height:\s*46px;/);
assert.match(css, /\.viewer-inquiry-dialog\s*\{[\s\S]*?color:\s*var\(--ink\);[\s\S]*?linear-gradient\(180deg, rgba\(255,253,251/);
assert.match(css, /\.viewer-inquiry-action\s*\{[\s\S]*?min-height:\s*56px;/);
assert.match(css, /\.viewer-inquiry-action\.primary\s*\{[\s\S]*?linear-gradient\(135deg, var\(--brand\), var\(--brand-dark\)\)/);
assert.doesNotMatch(css, /\.viewer-inquiry-action small\s*\{/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?#lightboxScreenshot,[\s\S]*?#lightboxPinTopBar,[\s\S]*?display:\s*none !important;/);
assert.match(css, /@media \(max-width: 480px\)[\s\S]*?grid-template-areas:\s*"brand actions";/);

console.log("viewer_stage1_value_contract.test.js: PASS");
