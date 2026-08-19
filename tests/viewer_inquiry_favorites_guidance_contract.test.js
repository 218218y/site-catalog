'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllCssBundles } = require('./frontend_test_assets');
const { hasAssignmentTarget, hasFunction, hasPropertyPath, inventoryProjectFiles } = require('./helpers/frontend_ast');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const favorites = fs.readFileSync(path.join(root, 'favorites.html'), 'utf8');
const onboardingSource = fs.readFileSync(path.join(root, 'src', 'js', '65-viewer-onboarding.js'), 'utf8');
const inquirySource = fs.readFileSync(path.join(root, 'src', 'js', '32-shared-inquiry.js'), 'utf8');
const css = readAllCssBundles();
const inventories = inventoryProjectFiles(root, [
  'src/js/32-shared-inquiry.js',
  'src/js/65-viewer-onboarding.js',
]);
const inquiryAst = inventories['src/js/32-shared-inquiry.js'];
const onboardingAst = inventories['src/js/65-viewer-onboarding.js'];

for (const html of [template, viewer, favorites]) {
  assert.match(html, /id="viewerInquiryFavoritesTip"[^>]*hidden[^>]*role="note"/);
  assert.match(html, /id="viewerInquiryFavoritesTipTitle">אפשר לחסוך בירורים נפרדים</);
  assert.match(html, /סמנו כמה דגמים בכוכב, פתחו את מסך המועדפים ושלחו על כולם בירור אחד מרוכז/);
}

const inquiryStepProperties = onboardingAst.objectPropertyLiterals.filter((entry) => entry.enclosingFunction === 'getViewerOnboardingSteps');
assert.ok(inquiryStepProperties.some((entry) => entry.property === 'id' && entry.value === 'inquiry'));
assert.ok(inquiryStepProperties.some((entry) => entry.property === 'title' && entry.value === 'מועדפים ובירור אחד מרוכז'));
assert.ok(inquiryStepProperties.some((entry) => entry.property === 'description' && String(entry.value).includes('סמנו בכוכב כמה דגמים')));
assert.ok(inquiryStepProperties.some((entry) => entry.property === 'note' && String(entry.value).includes('במקום בירור נפרד לכל דגם')));
assert.match(onboardingSource, /viewerOnboardingNote\.classList\.toggle\("is-tip", step\.id === "inquiry"\)/);
assert.match(css, /\.viewer-onboarding-note\.is-tip\s*\{[\s\S]*?linear-gradient[\s\S]*?font-weight:\s*850/);
assert.match(css, /\.viewer-onboarding-note\.is-tip::before\s*\{[\s\S]*?content:\s*"★"/);

assert.ok(inquiryAst.objectDeclarations.inquiryState.includes('tipOpenCount'));
assert.ok(inquiryAst.objectDeclarations.inquiryState.includes('tipShown'));
assert.ok(inquiryAst.objectPropertyLiterals.some((entry) => entry.property === 'tipOpenCount' && entry.value === 0));
assert.ok(inquiryAst.objectPropertyLiterals.some((entry) => entry.property === 'tipShown' && entry.value === false));
assert.ok(hasFunction(inquiryAst, 'openViewerInquiry'));
for (const propertyPath of ['reference.kind', 'inquiryState.tipShown', 'inquiryState.tipOpenCount']) {
  assert.ok(hasPropertyPath(inquiryAst, propertyPath, 'openViewerInquiry'));
}
assert.ok(hasAssignmentTarget(inquiryAst, 'inquiryState.tipShown', 'openViewerInquiry'));
assert.ok(hasAssignmentTarget(inquiryAst, 'inquiryElements.viewerInquiryFavoritesTip.hidden', 'openViewerInquiry'));
assert.ok(hasFunction(inquiryAst, 'closeViewerInquiry'));
assert.ok(hasAssignmentTarget(inquiryAst, 'inquiryElements.viewerInquiryFavoritesTip.hidden', 'closeViewerInquiry'));
assert.match(css, /\.viewer-inquiry-favorites-tip\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\);[\s\S]*?border-radius:\s*18px/);
assert.match(css, /@media \(max-width: 520px\)[\s\S]*?\.viewer-inquiry-favorites-tip\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\)/);

console.log('viewer_inquiry_favorites_guidance_contract.test.js: PASS');
