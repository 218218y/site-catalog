'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllBundles, readAllCssBundles } = require('./frontend_test_assets');
const { hasAssignmentTarget, hasCall, hasFunction, hasPropertyPath, inventoryProjectFiles } = require('./helpers/frontend_ast');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const app = readAllBundles();
const viewerStateSource = fs.readFileSync(path.join(root, 'src', 'js', '16-viewer-state.js'), 'utf8');
const onboardingSource = fs.readFileSync(path.join(root, 'src', 'js', '65-viewer-onboarding.js'), 'utf8');
const viewerSource = fs.readFileSync(path.join(root, 'src', 'js', '60-viewer.js'), 'utf8');
const favoritesShareSource = fs.readFileSync(path.join(root, 'src', 'js', '30-favorites-share.js'), 'utf8');
const currentLinkSharingSource = fs.readFileSync(path.join(root, 'src', 'js', '23-current-link-sharing.js'), 'utf8');
const browserSharingSource = fs.readFileSync(path.join(root, 'src', 'js', '22-browser-sharing.js'), 'utf8');
const catalogGridSource = fs.readFileSync(path.join(root, 'src', 'js', '40-catalog-grid.js'), 'utf8');
const css = readAllCssBundles();
const inventories = inventoryProjectFiles(root, [
  'src/js/22-browser-sharing.js',
  'src/js/23-current-link-sharing.js',
  'src/js/30-favorites-share.js',
  'src/js/60-viewer.js',
  'src/js/65-viewer-onboarding.js',
]);
const browserSharingAst = inventories['src/js/22-browser-sharing.js'];
const currentLinkSharingAst = inventories['src/js/23-current-link-sharing.js'];
const favoritesShareAst = inventories['src/js/30-favorites-share.js'];
const viewerAst = inventories['src/js/60-viewer.js'];
const onboardingAst = inventories['src/js/65-viewer-onboarding.js'];

for (const html of [template, index, viewer]) {
  assert.match(html, /id="headerCopyLink"[^>]*aria-label="שיתוף העמוד הנוכחי"[^>]*title="שיתוף"/);
  assert.match(html, /id="lightboxCopyLink"[^>]*aria-label="שיתוף העמוד הנוכחי"[^>]*title="שיתוף"/);
  assert.match(html, /id="viewerOnboarding"[^>]*aria-modal="true"/);
  assert.match(html, /id="viewerOnboardingSpotlight"/);
  assert.match(html, /id="viewerOnboardingShadeTop"/);
  assert.match(html, /id="viewerOnboardingShadeRight"/);
  assert.match(html, /id="viewerOnboardingPrevious"[^>]*>הקודם</);
  assert.match(html, /id="viewerOnboardingNext"[^>]*>הבא</);
  assert.match(html, /id="viewerOnboardingSkip"[^>]*aria-label="דלג על ההסבר"/);
  assert.match(html, /id="siteActionToast"[^>]*aria-live="polite"/);
  assert.doesNotMatch(html, /id="thumbsHotspot"|id="lightboxThumbs"/);
  assert.doesNotMatch(html, /viewer-onboarding-touch-copy|viewer-onboarding-desktop-copy|viewerOnboardingConfirm|viewerOnboardingBackdrop/);
}

assert.match(catalogGridSource, /data-open-catalog-entry="\$\{safeCatalogId\}"[^>]*>פתיחת הקטלוג</);
assert.match(catalogGridSource, /data-open-catalog-preview="\$\{safeCatalogId\}"[^>]*>תצוגה מקדימה</);
assert.doesNotMatch(catalogGridSource, /צפייה בקטלוג קטן|data-enter-catalog-card/);
assert.ok(hasFunction(browserSharingAst, 'tryNativeShare'));
assert.ok(hasCall(browserSharingAst, 'navigator.share', 'tryNativeShare'));
assert.ok(hasPropertyPath(browserSharingAst, 'navigator.userAgentData.mobile', 'tryNativeShare'));

assert.ok(hasFunction(currentLinkSharingAst, 'shareOrCopyCurrentLink'));
assert.ok(hasPropertyPath(currentLinkSharingAst, 'window.location.href', 'shareOrCopyCurrentLink'));
assert.ok(hasCall(currentLinkSharingAst, 'tryNativeShare', 'shareOrCopyCurrentLink'));
assert.ok(hasCall(currentLinkSharingAst, 'copyTextToClipboard', 'shareOrCopyCurrentLink'));
const currentLinkNativeShare = currentLinkSharingAst.calls.find((call) => call.callee === 'tryNativeShare' && call.enclosingFunction === 'shareOrCopyCurrentLink');
assert.equal(currentLinkNativeShare?.objectArguments[1]?.literalProperties.mobileOnly, true);
assert.equal(favoritesShareAst.calls.some((call) => ['document.execCommand', 'navigator.clipboard.writeText', 'navigator.share'].includes(call.callee)), false);
assert.ok(currentLinkSharingAst.calls.some((call) => call.callee === 'showActionToast' && call.arguments[0] === 'הקישור הועתק'));

assert.equal(viewerStateSource.includes('VIEWER_ONBOARDING_STORAGE_KEY = "bargig.viewer-onboarding.v2"'), true);
assert.ok(hasFunction(onboardingAst, 'viewerHasTouchCapability'));
assert.ok(hasPropertyPath(onboardingAst, 'navigator.maxTouchPoints', 'viewerHasTouchCapability'));
assert.ok(onboardingAst.stringLiterals.includes('ontouchstart'));

assert.ok(hasFunction(onboardingAst, 'getViewerOnboardingSteps'));
const onboardingStepProperties = onboardingAst.objectPropertyLiterals.filter((entry) => entry.enclosingFunction === 'getViewerOnboardingSteps');
const onboardingStepIds = onboardingStepProperties.filter((entry) => entry.property === 'id').map((entry) => entry.value);
assert.deepEqual(onboardingStepIds, ['page-navigation', 'zoom', 'inquiry']);
for (const title of ['מעבר בין עמודים', 'הגדלה וגרירת התמונה', 'מועדפים ובירור אחד מרוכז']) {
  assert.ok(onboardingStepProperties.some((entry) => entry.property === 'title' && entry.value === title));
}
for (const removedStep of ['top-bar', 'pin-top-bar', 'page-rail']) assert.equal(onboardingStepIds.includes(removedStep), false);

assert.ok(hasFunction(onboardingAst, 'viewerNavigationOnboardingCopy'));
assert.ok(onboardingAst.stringLiterals.some((value) => value.includes('החליקו למעלה, למטה, ימינה או שמאלה')));
assert.ok(onboardingAst.stringLiterals.some((value) => value.includes('מקשי החצים ו־Page Up/Down')));
assert.ok(onboardingAst.identifiers.includes('getViewerOnboardingNavigationFocusRect'));
assert.ok(onboardingAst.propertyAccesses.some((access) => access.path === 'viewerElements.nextPageBtn'));
assert.ok(onboardingAst.propertyAccesses.some((access) => access.path === 'viewerElements.prevPageBtn'));
assert.ok(onboardingStepProperties.some((entry) => entry.property === 'gesture' && entry.value === 'swipe-both'));
assert.ok(onboardingAst.calls.some((call) => call.callee === 'getFeatureInterface' && call.arguments[0] === 'inquiry'));
assert.ok(onboardingAst.calls.some((call) => call.callee === 'getFeatureInterface' && call.arguments[0] === 'favorites'));

assert.ok(hasAssignmentTarget(onboardingAst, 'viewerElements.viewerOnboardingNext.textContent', 'renderViewerOnboardingStep'));
assert.ok(onboardingAst.stringLiterals.includes('סיום'));
assert.ok(onboardingAst.stringLiterals.includes('הבא'));
assert.ok(hasFunction(onboardingAst, 'syncViewerOnboardingFloatingTargetState'));
assert.ok(onboardingAst.stringLiterals.includes('data-favorite-active'));
assert.ok(hasFunction(onboardingAst, 'updateViewerOnboardingFloatingTargets'));
assert.ok(hasCall(onboardingAst, 'source.cloneNode', 'updateViewerOnboardingFloatingTargets'));
assert.ok(hasAssignmentTarget(onboardingAst, 'clone.dataset.tourTarget', 'updateViewerOnboardingFloatingTargets'));
assert.ok(hasCall(onboardingAst, 'source.click', 'updateViewerOnboardingFloatingTargets'));

assert.ok(hasFunction(onboardingAst, 'layoutViewerOnboarding'));
assert.ok(hasCall(onboardingAst, 'target.getBoundingClientRect', 'layoutViewerOnboarding'));
assert.ok(hasCall(onboardingAst, 'setViewerOnboardingShadeRect', 'layoutViewerOnboarding'));
assert.ok(hasCall(onboardingAst, 'calculateViewerOnboardingCalloutPosition', 'layoutViewerOnboarding'));

assert.ok(hasFunction(onboardingAst, 'scheduleViewerOnboardingLayout'));
assert.ok(hasCall(onboardingAst, 'window.clearTimeout', 'scheduleViewerOnboardingLayout'));
assert.ok(hasCall(onboardingAst, 'window.setTimeout', 'scheduleViewerOnboardingLayout'));
assert.ok(hasCall(onboardingAst, 'run', 'scheduleViewerOnboardingLayout'));
assert.equal(onboardingAst.identifiers.some((identifier) => ['thumbsHotspot', 'lightboxThumbs', 'show-thumbs', 'thumbsHideTimer'].includes(identifier)), false);

assert.ok(hasFunction(onboardingAst, 'showViewerOnboardingIfNeeded'));
for (const callee of ['viewerOnboardingWasSeen', 'renderViewerOnboardingStep', 'layoutViewerOnboarding']) {
  assert.ok(hasCall(onboardingAst, callee, 'showViewerOnboardingIfNeeded'));
}
assert.ok(onboardingAst.calls.some((call) => call.enclosingFunction === 'showViewerOnboardingIfNeeded' && call.callee === 'viewerElements.lightbox.classList.add' && call.arguments[0] === 'viewer-tour-active'));
assert.ok(onboardingAst.calls.some((call) => call.enclosingFunction === 'showViewerOnboardingIfNeeded' && call.callee === 'viewerElements.viewerOnboarding.classList.add' && call.arguments[0] === 'layout-ready'));
assert.ok(onboardingAst.calls.some((call) => call.enclosingFunction === 'showViewerOnboardingIfNeeded' && call.callee === 'viewerElements.viewerOnboarding.classList.add' && call.arguments[0] === 'visible'));

assert.ok(hasFunction(onboardingAst, 'closeViewerOnboarding'));
assert.ok(hasCall(onboardingAst, 'markViewerOnboardingSeen', 'closeViewerOnboarding'));
assert.ok(hasCall(onboardingAst, 'restoreViewerUiAfterOnboarding', 'closeViewerOnboarding'));
assert.ok(viewerAst.calls.some((call) => call.callee === 'window.requestAnimationFrame') && viewerAst.identifiers.includes('showViewerOnboardingIfNeeded'));
assert.match(css, /\.site-action-toast\s*\{[\s\S]*?top:\s*max\(16px, env\(safe-area-inset-top\)\);/);
assert.doesNotMatch(index, /id="headerFullscreenToggle"/);
assert.doesNotMatch(viewer, /id="headerFullscreenToggle"/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.brand-copy-link\s*\{[\s\S]*?display:\s*inline-flex;/);
assert.match(css, /\.viewer-onboarding-spotlight\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?border:\s*2px solid/);
assert.match(css, /\.viewer-onboarding-floating-target\s*\{[\s\S]*?z-index:\s*2;[\s\S]*?right:\s*auto;[\s\S]*?bottom:\s*auto;[\s\S]*?pointer-events:\s*auto;/);
assert.match(css, /\.viewer-onboarding-floating-target\[data-tour-target="favorite"\]\s*\{[\s\S]*?color:\s*#fff4cf;[\s\S]*?background:\s*rgba\(151, 106, 36, 0\.9\);/);
assert.match(css, /\.viewer-onboarding-floating-target\[data-tour-target="favorite"\] svg\s*\{[\s\S]*?fill:\s*rgba\(255, 244, 207, 0\.34\);[\s\S]*?stroke:\s*#fff4cf;/);
assert.match(css, /\.viewer-onboarding-spotlight\[data-gesture="swipe-both"\] \.viewer-onboarding-gesture\s*\{[\s\S]*?animation:\s*viewerTourSwipeBoth/);
assert.match(css, /@keyframes viewerTourSwipeBoth\s*\{[\s\S]*?translate\(0, 23px\)[\s\S]*?translate\(0, -23px\)/);
assert.match(css, /\.viewer-onboarding:not\(\.layout-ready\) \.viewer-onboarding-callout[\s\S]*?visibility:\s*hidden;/);
assert.match(css, /\.viewer-inquiry-button\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?border-radius:\s*999px;/);
assert.doesNotMatch(css, /\.viewer-onboarding-floating-target\s*\{[\s\S]*?inset:\s*auto(?:\s*!important)?;/);
assert.doesNotMatch(css, /\.thumbs-hotspot|\.lightbox-thumbs|\.lightbox-thumb/);
assert.match(css, /\.viewer-onboarding-callout\s*\{[\s\S]*?border-radius:\s*24px;/);
assert.match(css, /\.lightbox\.viewer-tour-show-top-ui \.lightbox-top-shell/);
assert.match(css, /\.lightbox\.viewer-tour-show-page-rail \.lightbox-page-rail/);
assert.match(css, /\.site-action-toast\.visible\s*\{/);
assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.catalog-card \.catalog-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);

console.log('initial_ux_upgrade_contract.test.js: PASS');
