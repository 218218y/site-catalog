'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

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

assert.match(app, /data-open-catalog-entry="\$\{safeCatalogId\}"[^>]*>פתיחת הקטלוג</);
assert.match(app, /data-open-catalog-preview="\$\{safeCatalogId\}"[^>]*>תצוגה מקדימה</);
assert.doesNotMatch(app, /צפייה בקטלוג קטן|data-enter-catalog-card/);
assert.match(app, /function isMobileShareEnvironment\([\s\S]*?navigator\.share[\s\S]*?userAgentData\?\.mobile/);
assert.match(app, /function shareOrCopyCurrentLink\([\s\S]*?currentVisibleDocumentUrl\(\)[\s\S]*?navigator\.share\([\s\S]*?copyTextToClipboard\(link\)/);
assert.match(app, /showActionToast\("הקישור הועתק", \{ tone: "link" \}\)/);
assert.match(app, /VIEWER_ONBOARDING_STORAGE_KEY = "bargig\.viewer-onboarding\.v2"/);
assert.match(app, /function viewerHasTouchCapability\([\s\S]*?navigator\.maxTouchPoints[\s\S]*?ontouchstart/);
assert.match(app, /function getViewerOnboardingSteps\([\s\S]*?סרגל העליון[\s\S]*?נעיצת הסרגל העליון[\s\S]*?סרגל העמודים הימני[\s\S]*?מעבר בין עמודים[\s\S]*?הגדלה וגרירת התמונה[\s\S]*?הוספה למועדפים/);
assert.match(app, /function getViewerOnboardingTopBarFocusRect\([\s\S]*?lightbox-reader-header/);
assert.match(app, /id: "top-bar"[\s\S]*?viewportMargin: 0[\s\S]*?radius: 0/);
assert.match(app, /id: "pin-top-bar"[\s\S]*?targetRect: getViewerOnboardingPinFocusRect[\s\S]*?floatingTarget: \(\) => els\.lightboxPinTopBar[\s\S]*?padding: 0[\s\S]*?viewportMargin: 0[\s\S]*?radius: 25/);
assert.match(app, /function getViewerOnboardingPinFocusRect\(\)[\s\S]*?desiredPadding = 12[\s\S]*?horizontalPadding[\s\S]*?verticalPadding[\s\S]*?source\.top - verticalPadding[\s\S]*?source\.bottom \+ verticalPadding/);
const pinFocusFunctionSource = app.match(/(function getViewerOnboardingPinFocusRect\(\) \{[\s\S]*?\r?\n\})\r?\n\r?\nfunction getViewerOnboardingNavigationFocusRect/)?.[1];
assert.ok(pinFocusFunctionSource, "pin focus rectangle function should be extractable");
const measuredPinRect = { left: 120, top: 9, right: 160, bottom: 49, width: 40, height: 40 };
const symmetricPinRect = vm.runInNewContext(`${pinFocusFunctionSource}; getViewerOnboardingPinFocusRect();`, {
  els: { lightboxPinTopBar: { getBoundingClientRect: () => measuredPinRect } },
  window: { innerWidth: 1000, innerHeight: 700 },
  document: { documentElement: { clientWidth: 1000, clientHeight: 700 } }
});
assert.equal(measuredPinRect.top - symmetricPinRect.top, symmetricPinRect.bottom - measuredPinRect.bottom);
assert.equal(measuredPinRect.left - symmetricPinRect.left, symmetricPinRect.right - measuredPinRect.right);
assert.deepEqual(JSON.parse(JSON.stringify(symmetricPinRect)), { left: 108, top: 0, right: 172, bottom: 58, width: 64, height: 58 });
assert.match(app, /id: "page-navigation"[\s\S]*?targetRect: getViewerOnboardingNavigationFocusRect[\s\S]*?floatingTarget: \(\) => els\.nextPageBtn/);
assert.match(app, /id: "favorite"[\s\S]*?target: \(\) => els\.viewerFavoriteButton[\s\S]*?floatingTarget: \(\) => els\.viewerFavoriteButton/);
assert.match(app, /function syncViewerOnboardingFloatingTargetState\([\s\S]*?"data-favorite-active"/);
assert.match(app, /function updateViewerOnboardingFloatingTarget\([\s\S]*?cloneNode\(true\)[\s\S]*?source\.click\(\)/);
assert.match(app, /function layoutViewerOnboarding\([\s\S]*?getBoundingClientRect[\s\S]*?setViewerOnboardingShadeRect[\s\S]*?calculateViewerOnboardingCalloutPosition/);
assert.match(app, /function scheduleViewerOnboardingLayout\(delay = 0\)[\s\S]*?if \(delay > 0\) \{[\s\S]*?window\.clearTimeout\(state\.viewerOnboardingLayoutTimer\)[\s\S]*?return;[\s\S]*?run\(\);/);
assert.doesNotMatch(app, /thumbsHotspot|lightboxThumbs|show-thumbs|thumbsHideTimer/);
assert.match(app, /function showViewerOnboardingIfNeeded\([\s\S]*?viewerOnboardingWasSeen\(\)[\s\S]*?viewer-tour-active[\s\S]*?renderViewerOnboardingStep\(\{ focus: false, scheduleLayout: false \}\)[\s\S]*?layoutViewerOnboarding\(\)[\s\S]*?layout-ready[\s\S]*?classList\.add\("visible"\)/);
assert.match(app, /function closeViewerOnboarding\([\s\S]*?markViewerOnboardingSeen\(\)[\s\S]*?restoreViewerUiAfterOnboarding/);
assert.match(app, /window\.requestAnimationFrame\(showViewerOnboardingIfNeeded\)/);
assert.match(css, /\.site-action-toast\s*\{[\s\S]*?top:\s*max\(16px, env\(safe-area-inset-top\)\);/);
assert.match(css, /body\[data-page="home"\] #headerFullscreenToggle\s*\{[\s\S]*?display:\s*none !important;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.brand-copy-link\s*\{[\s\S]*?display:\s*inline-flex;/);
assert.match(css, /\.viewer-onboarding-spotlight\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?border:\s*2px solid/);
assert.match(css, /\.viewer-onboarding-floating-target\s*\{[\s\S]*?z-index:\s*2 !important;[\s\S]*?right:\s*auto !important;[\s\S]*?bottom:\s*auto !important;[\s\S]*?pointer-events:\s*auto !important;/);
assert.match(css, /\.viewer-onboarding:not\(\.layout-ready\) \.viewer-onboarding-callout[\s\S]*?visibility:\s*hidden;/);
const pinFloatingRule = css.match(/\.viewer-onboarding-floating-target\[data-tour-step="pin-top-bar"\]\s*\{([\s\S]*?)\}/);
assert.ok(pinFloatingRule, "pin floating target rule should exist");
assert.match(pinFloatingRule[1], /0 0 0 5px rgba\(217,186,163,0\.28\)/);
assert.doesNotMatch(pinFloatingRule[1], /0 0 0 2px rgba\(255,255,255,0\.98\)/, "pin button edge must keep its normal border");
assert.match(css, /\.viewer-onboarding-floating-target\[data-tour-step="favorite"\][\s\S]*?background:\s*rgba\(151, 106, 36, 0\.9\) !important;[\s\S]*?border-color:\s*rgba\(255, 225, 157, 0\.62\) !important;/);
assert.doesNotMatch(css, /\.viewer-onboarding-floating-target\s*\{[\s\S]*?inset:\s*auto !important;/);
assert.doesNotMatch(css, /\.thumbs-hotspot|\.lightbox-thumbs|\.lightbox-thumb/);
assert.match(css, /\.viewer-onboarding-callout\s*\{[\s\S]*?border-radius:\s*24px;/);
assert.match(css, /\.lightbox\.viewer-tour-show-top-ui \.lightbox-top-shell/);
assert.match(css, /\.lightbox\.viewer-tour-show-page-rail \.lightbox-page-rail/);
assert.match(css, /\.site-action-toast\.visible\s*\{/);
assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.catalog-card \.catalog-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);

console.log('initial_ux_upgrade_contract.test.js: PASS');
