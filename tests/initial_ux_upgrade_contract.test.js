'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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
  assert.match(html, /id="viewerOnboardingConfirm"[^>]*>הבנתי, אפשר להתחיל</);
  assert.match(html, /id="siteActionToast"[^>]*aria-live="polite"/);
}

assert.match(app, /data-open-catalog-entry="\$\{safeCatalogId\}"[^>]*>פתיחת הקטלוג</);
assert.match(app, /data-open-catalog-preview="\$\{safeCatalogId\}"[^>]*>תצוגה מקדימה</);
assert.doesNotMatch(app, /צפייה בקטלוג קטן|data-enter-catalog-card/);
assert.match(app, /function isMobileShareEnvironment\([\s\S]*?navigator\.share[\s\S]*?userAgentData\?\.mobile/);
assert.match(app, /function shareOrCopyCurrentLink\([\s\S]*?currentVisibleDocumentUrl\(\)[\s\S]*?navigator\.share\([\s\S]*?copyTextToClipboard\(link\)/);
assert.match(app, /showActionToast\("הקישור המדויק לעמוד הועתק ללוח"\)/);
assert.match(app, /VIEWER_ONBOARDING_STORAGE_KEY = "bargig\.viewer-onboarding\.v1"/);
assert.match(app, /function showViewerOnboardingIfNeeded\([\s\S]*?viewerOnboardingWasSeen\(\)[\s\S]*?markViewerOnboardingSeen\(\)/);
assert.match(app, /window\.requestAnimationFrame\(showViewerOnboardingIfNeeded\)/);
assert.match(css, /body\[data-page="home"\] #headerFullscreenToggle\s*\{[\s\S]*?display:\s*none !important;/);
assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.brand-copy-link\s*\{[\s\S]*?display:\s*inline-flex;/);
assert.match(css, /\.viewer-onboarding-card\s*\{[\s\S]*?border-radius:\s*30px;/);
assert.match(css, /\.site-action-toast\.visible\s*\{/);
assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.catalog-card \.catalog-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);

console.log('initial_ux_upgrade_contract.test.js: PASS');
