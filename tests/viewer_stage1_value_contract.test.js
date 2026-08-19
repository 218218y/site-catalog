"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { readAllBundles, readAllCssBundles } = require("./frontend_test_assets");
const { findCalls, hasCall, hasFunction, inventoryProjectFiles } = require("./helpers/frontend_ast.js");

const root = path.join(__dirname, "..");
const app = readAllBundles();
const css = readAllCssBundles();
const template = fs.readFileSync(path.join(root, "site.template.html"), "utf8");
const sourceAst = inventoryProjectFiles(root, [
  "src/runtime/telemetry.js",
  "src/js/19-shared-pure.js",
  "src/js/32-shared-inquiry.js",
  "src/js/48-global-search-ui.js",
  "src/js/49-search-reader-ui.js",
  "src/js/50-search-ui.js",
  "src/js/59-viewer-page-controller.js",
  "src/js/60-viewer.js",
  "src/js/62-viewer-actions.js",
]);
const telemetryAst = sourceAst["src/runtime/telemetry.js"];
const sharedPureAst = sourceAst["src/js/19-shared-pure.js"];
const sharedInquiryAst = sourceAst["src/js/32-shared-inquiry.js"];
const globalSearchAst = sourceAst["src/js/48-global-search-ui.js"];
const readerSearchAst = sourceAst["src/js/49-search-reader-ui.js"];
const searchUiAst = sourceAst["src/js/50-search-ui.js"];
const pageControllerAst = sourceAst["src/js/59-viewer-page-controller.js"];
const viewerAst = sourceAst["src/js/60-viewer.js"];
const viewerActionsAst = sourceAst["src/js/62-viewer-actions.js"];
assert.equal(hasCall(sharedInquiryAst, "setTooltipText"), false, "inquiry button must not be registered with the tooltip manager");

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

for (const callee of ["activeCatalog", "activePage", "clampPage", "viewerDocumentUrl", "absoluteDocumentUrl"]) {
  assert.equal(hasCall(sharedInquiryAst, callee, "viewerPageInquiryReference"), true, `viewerPageInquiryReference must use ${callee}`);
}
assert.equal(hasCall(sharedInquiryAst, "viewerPageInquiryReference", "viewerInquiryReference"), true);
assert.ok(sharedInquiryAst.propertyAccesses.some((access) => access.path === "inquiryState.reference"));
assert.ok(sharedInquiryAst.stringLiterals.includes("קטלוג: "));
assert.ok(sharedInquiryAst.stringLiterals.includes("עמוד: "));
assert.ok(sharedInquiryAst.assignmentTargets.includes("inquiryElements.viewerInquiryCatalog.textContent"));
assert.ok(sharedInquiryAst.assignmentTargets.includes("inquiryElements.viewerInquiryPage.textContent"));
assert.equal(hasCall(sharedInquiryAst, "buildViewerInquiryMailtoUrl", "viewerInquiryMailtoUrl"), true);
assert.equal(hasFunction(sharedPureAst, "buildViewerInquiryMailtoUrl"), true);
assert.equal(hasCall(sharedPureAst, "encodeURIComponent", "buildViewerInquiryMailtoUrl"), true);
assert.ok(sharedInquiryAst.stringLiterals.includes("https://mail.google.com/mail/?"));
assert.equal(hasFunction(sharedInquiryAst, "viewerInquiryGmailUrl"), true);
assert.equal(hasCall(sharedInquiryAst, "tryNativeShare", "shareViewerInquiryReference"), true);
assert.equal(findCalls(sharedInquiryAst, "viewerInquiryTelemetryFields").some((call) => call.enclosingFunction === "shareViewerInquiryReference" && call.arguments[1] === "share"), true);
assert.equal(hasCall(sharedInquiryAst, "copyTextToClipboard", "shareViewerInquiryReference"), true);
assert.equal(hasCall(sharedInquiryAst, "copyTextToClipboard", "copyViewerInquiryReference"), true);
assert.equal(findCalls(sharedInquiryAst, "viewerInquiryTelemetryFields").some((call) => call.enclosingFunction === "copyViewerInquiryReference" && call.arguments[1] === "copy"), true);
assert.equal(sharedInquiryAst.assignmentTargets.some((target) => /viewerInquiry(?:Gmail|Email)\.title$/.test(target)), false);
assert.equal(hasCall(pageControllerAst, "syncViewerInquiryUi", "updateLightbox"), true);
assert.equal(hasCall(pageControllerAst, "syncViewerMobileMoreMenuState", "updateLightbox"), true);
assert.equal(hasFunction(viewerActionsAst, "handleViewerMobileMoreKeydown"), true);
for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) assert.ok(viewerActionsAst.stringLiterals.includes(key));
assert.equal(hasCall(viewerAst, "closeViewerInquiry", "hideLightboxUi"), true);
assert.equal(hasCall(viewerAst, "closeViewerMobileMoreMenu", "hideLightboxUi"), true);

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
assert.equal(hasFunction(telemetryAst, "telemetryTrackSearch"), true);
assert.equal(hasCall(telemetryAst, "telemetryCleanText", "telemetryTrackSearch"), true);
for (const inventory of [telemetryAst, globalSearchAst, readerSearchAst, searchUiAst]) {
  assert.equal(inventory.identifiers.includes("TELEMETRY_SEARCH_DELAY_MS"), false);
  assert.equal(inventory.identifiers.includes("searchTimers"), false);
}

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
