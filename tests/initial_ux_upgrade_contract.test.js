'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllBundles, readAllCssBundles } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const app = readAllBundles();
const viewerStateSource = fs.readFileSync(path.join(root, 'src', 'js', '16-viewer-state.js'), 'utf8');
const onboardingSource = fs.readFileSync(path.join(root, 'src', 'js', '65-viewer-onboarding.js'), 'utf8');
const viewerSource = fs.readFileSync(path.join(root, 'src', 'js', '60-viewer.js'), 'utf8');
const favoritesShareSource = fs.readFileSync(path.join(root, 'src', 'js', '30-favorites-share.js'), 'utf8');
const catalogGridSource = fs.readFileSync(path.join(root, 'src', 'js', '40-catalog-grid.js'), 'utf8');
const css = readAllCssBundles();

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
assert.match(favoritesShareSource, /function isMobileShareEnvironment\([\s\S]*?navigator\.share[\s\S]*?userAgentData\?\.mobile/);
assert.match(favoritesShareSource, /function shareOrCopyCurrentLink\([\s\S]*?currentVisibleDocumentUrl\(\)[\s\S]*?navigator\.share\([\s\S]*?copyTextToClipboard\(link\)/);
assert.match(favoritesShareSource, /showActionToast\("הקישור הועתק", \{ tone: "link" \}\)/);
assert.match(viewerStateSource, /VIEWER_ONBOARDING_STORAGE_KEY = "bargig\.viewer-onboarding\.v2"/);
assert.match(onboardingSource, /function viewerHasTouchCapability\([\s\S]*?navigator\.maxTouchPoints[\s\S]*?ontouchstart/);
assert.match(onboardingSource, /function getViewerOnboardingSteps\([\s\S]*?id: "page-navigation"[\s\S]*?מעבר בין עמודים[\s\S]*?id: "zoom"[\s\S]*?הגדלה וגרירת התמונה[\s\S]*?id: "inquiry"[\s\S]*?שמירה, שיתוף ובירור/);
assert.doesNotMatch(onboardingSource, /function getViewerOnboardingSteps\([\s\S]*?id: "top-bar"/);
assert.doesNotMatch(onboardingSource, /function getViewerOnboardingSteps\([\s\S]*?id: "pin-top-bar"/);
assert.doesNotMatch(onboardingSource, /function getViewerOnboardingSteps\([\s\S]*?id: "page-rail"/);
assert.match(onboardingSource, /function viewerNavigationOnboardingCopy\([\s\S]*?החליקו למעלה, למטה, ימינה או שמאלה[\s\S]*?מקשי החצים ו־Page Up\/Down/);
assert.match(onboardingSource, /id: "page-navigation"[\s\S]*?targetRect: getViewerOnboardingNavigationFocusRect[\s\S]*?floatingTargets: \(\) => \[[\s\S]*?viewerElements\.nextPageBtn[\s\S]*?viewerElements\.prevPageBtn[\s\S]*?gesture: "swipe-both"/);
assert.match(onboardingSource, /id: "inquiry"[\s\S]*?target: \(\) => getFeatureInterface\("inquiry"\)\?\.onboardingTarget\(\) \|\| null[\s\S]*?floatingTargets: \(\) => \{[\s\S]*?getFeatureInterface\("inquiry"\)\?\.onboardingTarget\(\)[\s\S]*?getFeatureInterface\("favorites"\)\?\.onboardingTarget\(\)/);
assert.match(onboardingSource, /viewerOnboardingNext\.textContent = viewerOnboardingState\.viewerOnboardingStep === steps\.length - 1 \? "סיום" : "הבא"/);
assert.match(onboardingSource, /function syncViewerOnboardingFloatingTargetState\([\s\S]*?"data-favorite-active"/);
assert.match(onboardingSource, /function updateViewerOnboardingFloatingTargets\([\s\S]*?cloneNode\(true\)[\s\S]*?clone\.dataset\.tourTarget = id[\s\S]*?source\.click\(\)/);
assert.match(onboardingSource, /function layoutViewerOnboarding\([\s\S]*?getBoundingClientRect[\s\S]*?setViewerOnboardingShadeRect[\s\S]*?calculateViewerOnboardingCalloutPosition/);
assert.match(onboardingSource, /function scheduleViewerOnboardingLayout\(delay = 0\)[\s\S]*?if \(delay > 0\) \{[\s\S]*?window\.clearTimeout\(viewerOnboardingState\.viewerOnboardingLayoutTimer\)[\s\S]*?return;[\s\S]*?run\(\);/);
assert.doesNotMatch(onboardingSource, /thumbsHotspot|lightboxThumbs|show-thumbs|thumbsHideTimer/);
assert.match(onboardingSource, /function showViewerOnboardingIfNeeded\([\s\S]*?viewerOnboardingWasSeen\(\)[\s\S]*?viewer-tour-active[\s\S]*?renderViewerOnboardingStep\(\{ focus: false, scheduleLayout: false \}\)[\s\S]*?layoutViewerOnboarding\(\)[\s\S]*?layout-ready[\s\S]*?classList\.add\("visible"\)/);
assert.match(onboardingSource, /function closeViewerOnboarding\([\s\S]*?markViewerOnboardingSeen\(\)[\s\S]*?restoreViewerUiAfterOnboarding/);
assert.match(viewerSource, /window\.requestAnimationFrame\(showViewerOnboardingIfNeeded\)/);
assert.match(css, /\.site-action-toast\s*\{[\s\S]*?top:\s*max\(16px, env\(safe-area-inset-top\)\);/);
assert.doesNotMatch(index, /id="headerFullscreenToggle"/);
assert.doesNotMatch(viewer, /id="headerFullscreenToggle"/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.brand-copy-link\s*\{[\s\S]*?display:\s*inline-flex;/);
assert.match(css, /\.viewer-onboarding-spotlight\s*\{[\s\S]*?box-sizing:\s*border-box;[\s\S]*?border:\s*2px solid/);
assert.match(css, /\.viewer-onboarding-floating-target\s*\{[\s\S]*?z-index:\s*2 !important;[\s\S]*?right:\s*auto !important;[\s\S]*?bottom:\s*auto !important;[\s\S]*?pointer-events:\s*auto !important;/);
assert.match(css, /\.viewer-onboarding-floating-target\[data-tour-target="favorite"\]\s*\{[\s\S]*?color:\s*#fff4cf !important;[\s\S]*?background:\s*rgba\(151, 106, 36, 0\.9\) !important;/);
assert.match(css, /\.viewer-onboarding-floating-target\[data-tour-target="favorite"\] svg\s*\{[\s\S]*?fill:\s*rgba\(255, 244, 207, 0\.34\) !important;[\s\S]*?stroke:\s*#fff4cf !important;/);
assert.match(css, /\.viewer-onboarding-spotlight\[data-gesture="swipe-both"\] \.viewer-onboarding-gesture\s*\{[\s\S]*?animation:\s*viewerTourSwipeBoth/);
assert.match(css, /@keyframes viewerTourSwipeBoth\s*\{[\s\S]*?translate\(0, 23px\)[\s\S]*?translate\(0, -23px\)/);
assert.match(css, /\.viewer-onboarding:not\(\.layout-ready\) \.viewer-onboarding-callout[\s\S]*?visibility:\s*hidden;/);
assert.match(css, /\.viewer-inquiry-button\s*\{[\s\S]*?position:\s*fixed;[\s\S]*?border-radius:\s*999px;/);
assert.doesNotMatch(css, /\.viewer-onboarding-floating-target\s*\{[\s\S]*?inset:\s*auto !important;/);
assert.doesNotMatch(css, /\.thumbs-hotspot|\.lightbox-thumbs|\.lightbox-thumb/);
assert.match(css, /\.viewer-onboarding-callout\s*\{[\s\S]*?border-radius:\s*24px;/);
assert.match(css, /\.lightbox\.viewer-tour-show-top-ui \.lightbox-top-shell/);
assert.match(css, /\.lightbox\.viewer-tour-show-page-rail \.lightbox-page-rail/);
assert.match(css, /\.site-action-toast\.visible\s*\{/);
assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.catalog-card \.catalog-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);

console.log('initial_ux_upgrade_contract.test.js: PASS');
