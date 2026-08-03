'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllCssBundles } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'viewer.html'), 'utf8');
const favorites = fs.readFileSync(path.join(root, 'favorites.html'), 'utf8');
const onboardingSource = fs.readFileSync(path.join(root, 'src', 'js', '65-viewer-onboarding.js'), 'utf8');
const inquirySource = fs.readFileSync(path.join(root, 'src', 'js', '32-shared-inquiry.js'), 'utf8');
const css = readAllCssBundles();

for (const html of [template, viewer, favorites]) {
  assert.match(html, /id="viewerInquiryFavoritesTip"[^>]*hidden[^>]*role="note"/);
  assert.match(html, /id="viewerInquiryFavoritesTipTitle">אפשר לחסוך בירורים נפרדים</);
  assert.match(html, /סמנו כמה דגמים בכוכב, פתחו את מסך המועדפים ושלחו על כולם בירור אחד מרוכז/);
}

assert.match(onboardingSource, /id: "inquiry"[\s\S]*?title: "מועדפים ובירור אחד מרוכז"[\s\S]*?סמנו בכוכב כמה דגמים[\s\S]*?בירור על הדגמים[\s\S]*?במקום בירור נפרד לכל דגם/);
assert.match(onboardingSource, /viewerOnboardingNote\.classList\.toggle\("is-tip", step\.id === "inquiry"\)/);
assert.match(css, /\.viewer-onboarding-note\.is-tip\s*\{[\s\S]*?linear-gradient[\s\S]*?font-weight:\s*850/);
assert.match(css, /\.viewer-onboarding-note\.is-tip::before\s*\{[\s\S]*?content:\s*"★"/);

assert.match(inquirySource, /const inquiryState = \{[\s\S]*?tipOpenCount: 0,[\s\S]*?tipShown: false/);
assert.match(inquirySource, /function openViewerInquiry\([\s\S]*?const showTip = reference\.kind === "viewer"[\s\S]*?!inquiryState\.tipShown[\s\S]*?\+\+inquiryState\.tipOpenCount >= 2[\s\S]*?tipShown = true[\s\S]*?viewerInquiryFavoritesTip\.hidden = !showTip/);
assert.match(inquirySource, /function closeViewerInquiry\([\s\S]*?viewerInquiryFavoritesTip\.hidden = true/);
assert.match(css, /\.viewer-inquiry-favorites-tip\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\);[\s\S]*?border-radius:\s*18px/);
assert.match(css, /@media \(max-width: 520px\)[\s\S]*?\.viewer-inquiry-favorites-tip\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\)/);

console.log('viewer_inquiry_favorites_guidance_contract.test.js: PASS');
