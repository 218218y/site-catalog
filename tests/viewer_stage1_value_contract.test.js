"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { readAllBundles, readAllCssBundles } = require("./frontend_test_assets");
const { findCalls, inventoryProjectFiles } = require("./helpers/frontend_ast.js");

const root = path.join(__dirname, "..");
const app = readAllBundles();
const css = readAllCssBundles();
const template = fs.readFileSync(path.join(root, "site.template.html"), "utf8");
const sharedPureSource = fs.readFileSync(path.join(root, "src/js/19-shared-pure.js"), "utf8");
const sharedInquirySource = fs.readFileSync(path.join(root, "src/js/32-shared-inquiry.js"), "utf8");
const globalSearchSource = fs.readFileSync(path.join(root, "src/js/48-global-search-ui.js"), "utf8");
const readerSearchSource = fs.readFileSync(path.join(root, "src/js/49-search-reader-ui.js"), "utf8");
const searchUiSource = fs.readFileSync(path.join(root, "src/js/50-search-ui.js"), "utf8");
const pageControllerSource = fs.readFileSync(path.join(root, "src/js/59-viewer-page-controller.js"), "utf8");
const viewerSource = fs.readFileSync(path.join(root, "src/js/60-viewer.js"), "utf8");
const viewerActionsSource = fs.readFileSync(path.join(root, "src/js/62-viewer-actions.js"), "utf8");
const telemetrySource = fs.readFileSync(path.join(root, "src/js/15-telemetry.js"), "utf8");
const sourceAst = inventoryProjectFiles(root, [
  "src/js/48-global-search-ui.js",
  "src/js/49-search-reader-ui.js",
]);
const globalSearchAst = sourceAst["src/js/48-global-search-ui.js"];
const readerSearchAst = sourceAst["src/js/49-search-reader-ui.js"];
assert.doesNotMatch(sharedInquirySource, /setTooltipText\(viewerElements\.viewerInquiryButton/, "inquiry button must not be registered with the tooltip manager");

for (const relative of ["index.html", "catalog.html", "favorites.html", "viewer.html"]) {
  const html = fs.readFileSync(path.join(root, relative), "utf8");
  assert.match(html, /id="viewerInquiryButton"[^>]*aria-controls="viewerInquiryOverlay"/, relative);
  assert.doesNotMatch(html, /id="viewerInquiryButton"[^>]*(?:title|data-tooltip)=/, `${relative}: inquiry button must not expose a floating tooltip`);
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
assert.match(template, /data-viewer-mobile-action="fit-auto"/);
assert.match(template, /data-viewer-mobile-action="fit-height"/);
assert.match(template, /data-viewer-mobile-action="fit-width"/);
assert.match(template, /id="viewerMobileFavoritesLink"/);

assert.match(sharedInquirySource, /function viewerPageInquiryReference\(\)[\s\S]*?const catalog = activeCatalog\(\);[\s\S]*?const page = clampPage\(activePage\(\), catalog\);[\s\S]*?absoluteDocumentUrl\(viewerDocumentUrl\(catalog\.id, page\)\)/);
assert.match(sharedInquirySource, /function viewerInquiryReference\(\)[\s\S]*?inquiryState\.reference \|\| viewerPageInquiryReference\(\)/);
assert.match(sharedInquirySource, /`קטלוג: \$\{title\}`/);
assert.match(sharedInquirySource, /`עמוד: \$\{page\}`/);
assert.match(sharedInquirySource, /function syncViewerInquiryUi\([\s\S]*?viewerInquiryCatalog\.textContent = reference\.referenceTitle \|\| reference\.title[\s\S]*?viewerInquiryPage\.textContent = reference\.pageLabel/);
assert.match(sharedInquirySource, /function viewerInquiryMailtoUrl\([\s\S]*?buildViewerInquiryMailtoUrl\(emailAddress, reference\)/);
assert.match(sharedPureSource, /function buildViewerInquiryMailtoUrl\([\s\S]*?encodeURIComponent\(String\(reference\?\.subject \|\| ""\)\)[\s\S]*?replace\(\/\\r\?\\n\/g, "\\r\\n"\)[\s\S]*?`mailto:\$\{String\(emailAddress \|\| ""\)\}\?subject=\$\{subject\}&body=\$\{body\}`/);
assert.match(sharedInquirySource, /emailAvailable \? viewerInquiryMailtoUrl\(emailAddress, reference\) : ""/);
assert.match(sharedInquirySource, /function viewerInquiryGmailUrl\([\s\S]*?mail\.google\.com\/mail\/\?/);
assert.match(sharedInquirySource, /function shareViewerInquiryReference\([\s\S]*?const shareData = \{[\s\S]*?title: reference\.subject,[\s\S]*?text: reference\.shareText,[\s\S]*?url: reference\.url[\s\S]*?tryNativeShare\(shareData\)[\s\S]*?shareResult === "shared"[\s\S]*?viewerInquiryTelemetryFields\(reference, "share"\)/);
assert.doesNotMatch(sharedInquirySource, /viewerInquiry(?:Gmail|Email)\.title\s*=|setTooltipText\(els\.viewerInquiry(?:Gmail|Email)/);
assert.match(sharedInquirySource, /function copyViewerInquiryReference\([\s\S]*?copyTextToClipboard\(reference\.text\)[\s\S]*?viewerInquiryTelemetryFields\(reference, "copy"\)/);
assert.match(pageControllerSource, /function updateLightbox\([\s\S]*?syncViewerInquiryUi\(\)/);
assert.match(pageControllerSource, /function updateLightbox\([\s\S]*?syncViewerInquiryUi\(\)[\s\S]*?syncViewerMobileMoreMenuState\(\)/);
assert.match(viewerActionsSource, /function handleViewerMobileMoreKeydown\([\s\S]*?ArrowDown[\s\S]*?ArrowUp[\s\S]*?Home[\s\S]*?End/);
assert.match(viewerSource, /function hideLightboxUi\([\s\S]*?closeViewerInquiry\(\{ restoreFocus: false \}\)[\s\S]*?closeViewerMobileMoreMenu\(\)/);

assert.equal(
  [...findCalls(globalSearchAst, "telemetryTrackSearch"), ...findCalls(readerSearchAst, "telemetryTrackSearch")]
    .some((call) => ["renderLightboxSearchResults", "renderSearchResults"].includes(call.enclosingFunction)),
  false,
  "rendering search results must remain telemetry-free",
);
assert.equal(
  findCalls(readerSearchAst, "trackCompletedLightboxSearch")
    .some((call) => call.enclosingFunction === "submitLightboxSearch" && call.arguments[0] === "submit"),
  true,
  "lightbox search completion is owned by explicit submit",
);
assert.equal(
  findCalls(globalSearchAst, "trackCompletedGlobalSearch")
    .some((call) => call.enclosingFunction === "submitGlobalSearch" && call.arguments[0] === "submit"),
  true,
  "global search completion is owned by explicit submit",
);
assert.equal(
  findCalls(readerSearchAst, "trackCompletedLightboxSearch")
    .some((call) => call.arguments[0] === "result-open"),
  true,
  "lightbox result navigation records a completed search",
);
assert.equal(
  findCalls(globalSearchAst, "trackCompletedGlobalSearch")
    .some((call) => call.arguments[0] === "result-open"),
  true,
  "global result navigation records a completed search",
);
assert.equal(
  findCalls(globalSearchAst, "telemetryFlush")
    .some((call) => call.enclosingFunction === "flushGlobalSearchTelemetryBeforeNavigation"),
  true,
  "global search telemetry flushes before navigation",
);
assert.match(telemetrySource, /function telemetryTrackSearch\([\s\S]*?completion = telemetryCleanText\(options\.completion \|\| "submit"[\s\S]*?action: completion[\s\S]*?immediate: options\.immediate === true/);
assert.doesNotMatch(telemetrySource + globalSearchSource + readerSearchSource + searchUiSource, /TELEMETRY_SEARCH_DELAY_MS|searchTimers/);

assert.match(css, /\.inquiry-trigger-button\s*\{[\s\S]*?min-height:\s*46px;/);
assert.match(css, /\.viewer-inquiry-button\s*\{[\s\S]*?position:\s*fixed;/);
assert.match(css, /\.viewer-inquiry-dialog\s*\{[\s\S]*?color:\s*var\(--ink\);[\s\S]*?linear-gradient\(180deg, rgba\(255,253,251/);
assert.match(css, /\.viewer-inquiry-action\s*\{[\s\S]*?min-height:\s*56px;/);
assert.match(css, /\.viewer-inquiry-action\.primary\s*\{[\s\S]*?linear-gradient\(135deg, var\(--brand\), var\(--brand-dark\)\)/);
const inquiryPreviewRule = css.match(/\.viewer-inquiry-preview-frame\s*\{([\s\S]*?)\}/);
assert.ok(inquiryPreviewRule, "inquiry preview frame rule should exist");
assert.match(inquiryPreviewRule[1], /--catalog-watermark-width:\s*32%;/, "inquiry watermark must scale proportionally with the compact preview");
assert.match(inquiryPreviewRule[1], /--catalog-watermark-top:\s*5%;/, "inquiry watermark offset must scale with the compact preview");
assert.match(css, /width:\s*var\(--catalog-watermark-width,\s*clamp\(58px, 16%, 138px\)\);/, "shared watermark sizing must allow component-level proportional overrides");
assert.doesNotMatch(css, /\.viewer-inquiry-preview-frame::after\s*\{[^}]*width:\s*clamp\(58px/s, "compact inquiry preview must not inherit the desktop watermark minimum directly");
assert.doesNotMatch(css, /\.viewer-inquiry-action small\s*\{/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?#lightboxScreenshot,[\s\S]*?#lightboxPinTopBar,[\s\S]*?display:\s*none;/);
assert.match(css, /@media \(max-width: 480px\)[\s\S]*?grid-template-areas:\s*"brand actions";/);

console.log("viewer_stage1_value_contract.test.js: PASS");
