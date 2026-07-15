'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const publicPages = ['index.html', 'catalog.html', 'favorites.html', 'viewer.html', 'terms.html', 'privacy.html'];

for (const filename of publicPages) {
  const html = fs.readFileSync(path.join(root, filename), 'utf8');
  assert.match(html, /<footer class="site-footer" aria-label="פרטי העסק וקישורים שימושיים">/);
  assert.match(html, /כתובת ושעות פתיחה/);
  assert.match(html, /הרב מצליח 5, בני ברק/);
  assert.match(html, /ע\.מ\.\s*<bdi dir="ltr">301276861<\/bdi>/);
  assert.doesNotMatch(html, /site-footer-intro|site-footer-logo|site-footer-brand/);
  assert.match(html, /052-7696310/);
  assert.match(html, /077-2180217/);
  assert.match(html, /bargig218@gmail\.com/);
  assert.match(html, /11:00–13:00/);
  assert.match(html, /ימים א׳–ג׳, 21:00–23:00/);
  assert.match(html, /href="terms\.html">תנאי שימוש/);
  assert.match(html, /href="privacy\.html">מדיניות פרטיות/);
  assert.match(html, /href="#top" class="site-footer-top-link"/);
}

const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const legalTemplate = fs.readFileSync(path.join(root, 'legal.template.html'), 'utf8');
const footerFragment = fs.readFileSync(path.join(root, 'partials', 'site-footer.html'), 'utf8');
const pageBuilder = fs.readFileSync(path.join(root, 'tools', 'build_site_pages.py'), 'utf8');
const deployTool = fs.readFileSync(path.join(root, 'tools', 'deploy_cloudflare_pages.py'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.match(template, /\{\{SITE_FOOTER\}\}/);
assert.match(legalTemplate, /\{\{LEGAL_CONTENT\}\}/);
assert.match(legalTemplate, /<main class="legal-main">/);
assert.match(footerFragment, /<h2 id="footerVisitTitle">כתובת ושעות פתיחה<\/h2>/);
assert.match(footerFragment, /<address>רחוב הרב מצליח 5/);
assert.match(footerFragment, /ע\.מ\. <bdi dir="ltr">301276861<\/bdi>/);
assert.doesNotMatch(footerFragment, /site-footer-intro|site-footer-logo|site-footer-brand/);
assert.match(pageBuilder, /"terms\.html"[\s\S]*?template_filename="legal\.template\.html"/);
assert.match(pageBuilder, /"privacy\.html"[\s\S]*?content_filename="legal\/privacy\.content\.html"/);
assert.match(deployTool, /PUBLIC_HTML_FILES = tuple\(page\.filename for page in PAGE_DOCUMENTS\)/);
assert.match(css, /\.site-footer-grid\s*\{[\s\S]*?grid-template-columns:/);
assert.match(css, /body:not\(\[data-page="viewer"\]\) > \.site-footer\s*\{\s*margin-top:\s*0;/);
assert.match(css, /\.site-footer\s*\{[\s\S]*?padding:\s*0\s+clamp\(/);
assert.doesNotMatch(css, /\.site-footer-intro\s*\{/);
assert.match(css, /\.legal-document-content\s*\{/);
assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.site-footer-grid\s*\{\s*grid-template-columns:\s*1fr;/);

const terms = fs.readFileSync(path.join(root, 'terms.html'), 'utf8');
const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
assert.match(terms, /<body data-page="terms">/);
assert.match(terms, /האתר אינו משמש לביצוע הזמנה מחייבת, סליקת תשלום או כריתת עסקה מקוונת/);
assert.match(terms, /קישור לשיתוף רשימת בחירה עשוי לכלול בכתובת עצמה/);
assert.match(terms, /ע\.מ\. <bdi dir="ltr">301276861<\/bdi>/);
assert.doesNotMatch(terms, /דין ויישוב מחלוקות/);
assert.match(terms, /<h2>11\. יצירת קשר<\/h2>/);
assert.match(privacy, /<body data-page="privacy">/);
assert.match(privacy, /localStorage/);
assert.match(privacy, /Cloudflare Pages ו־Cloudflare R2\/CDN/);
assert.match(privacy, /קוד האתר אינו מפעיל מערכת סטטיסטיקה התנהגותית/);
assert.match(privacy, /רהיטי ברגיג, ע\.מ\. <bdi dir="ltr">301276861<\/bdi>/);

console.log('footer_legal_contract.test.js: PASS');
