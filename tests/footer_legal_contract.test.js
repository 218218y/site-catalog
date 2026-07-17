'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const publicPages = ['index.html', 'catalog.html', 'favorites.html', 'viewer.html', 'terms.html', 'privacy.html'];
const footerContent = JSON.parse(fs.readFileSync(path.join(root, 'partials', 'site-footer.content.json'), 'utf8'));

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;'
  })[character]);
}

function telHref(value) {
  const source = String(value).trim();
  const digits = source.replace(/\D/g, '');
  if (source.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('0')) return `+972${digits.slice(1)}`;
  return digits;
}

const expectedTextFields = Object.entries(footerContent)
  .filter(([field]) => field !== 'gmailSubject')
  .map(([, value]) => escapeHtml(value));
const gmailHref = (
  `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(footerContent.email)}` +
  `&su=${encodeURIComponent(footerContent.gmailSubject)}`
).replaceAll('&', '&amp;');

for (const filename of publicPages) {
  const html = fs.readFileSync(path.join(root, filename), 'utf8');
  assert.match(html, /<footer class="site-footer" aria-label="פרטי העסק וקישורים שימושיים">/);
  for (const expectedText of expectedTextFields) {
    assert.ok(html.includes(expectedText), `${filename} must contain configured footer text: ${expectedText}`);
  }
  assert.ok(html.includes(`href="tel:${telHref(footerContent.mobile)}"`));
  assert.ok(html.includes(`href="tel:${telHref(footerContent.phone)}"`));
  assert.ok(html.includes(`href="mailto:${escapeHtml(footerContent.email)}"`));
  assert.ok(html.includes(`href="${gmailHref}"`));
  assert.ok(html.includes(`aria-label="${escapeHtml(`פתיחת הודעה חדשה ב-Gmail אל ${footerContent.businessName}`)}"`));
  assert.match(html, /class="site-footer-email-link" href="mailto:/);
  assert.match(html, /class="site-footer-gmail-link"/);
  assert.match(html, /<span>שליחה דרך Gmail<\/span>/);
  const contactCard = html.match(/<section class="site-footer-card" aria-labelledby="footerContactTitle">([\s\S]*?)<\/section>/)?.[1] || "";
  assert.match(contactCard, /site-footer-email-link[\s\S]*?site-footer-gmail-link/);
  const footerBottom = html.match(/<div class="site-footer-bottom">([\s\S]*?)<\/div>/)?.[1] || "";
  assert.doesNotMatch(footerBottom, /site-footer-gmail-link/);
  assert.match(html, /href="terms\.html">/);
  assert.match(html, /href="privacy\.html">/);
  assert.match(html, /href="#top" class="site-footer-top-link"/);
  assert.doesNotMatch(html, /\{\{FOOTER_[A-Z0-9_]+\}\}/);
  assert.doesNotMatch(html, /site-footer-intro|site-footer-logo|site-footer-brand/);
}

const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const legalTemplate = fs.readFileSync(path.join(root, 'legal.template.html'), 'utf8');
const footerFragment = fs.readFileSync(path.join(root, 'partials', 'site-footer.html'), 'utf8');
const footerModule = fs.readFileSync(path.join(root, 'tools', 'footer_content.py'), 'utf8');
const pageBuilder = fs.readFileSync(path.join(root, 'tools', 'build_site_pages.py'), 'utf8');
const controlPanel = fs.readFileSync(path.join(root, 'catalog-control-panel.html'), 'utf8');
const controlServer = fs.readFileSync(path.join(root, 'tools', 'catalog_control_server.py'), 'utf8');
const deployTool = fs.readFileSync(path.join(root, 'tools', 'deploy_cloudflare_pages.py'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.match(template, /\{\{SITE_FOOTER\}\}/);
assert.match(legalTemplate, /\{\{LEGAL_CONTENT\}\}/);
assert.match(legalTemplate, /<main class="legal-main" id="main-content" tabindex="-1">/);
assert.match(footerFragment, /\{\{FOOTER_VISIT_TITLE\}\}/);
assert.match(footerFragment, /href="tel:\{\{FOOTER_MOBILE_TEL_HREF\}\}"/);
assert.match(footerFragment, /href="\{\{FOOTER_GMAIL_HREF\}\}"/);
assert.match(footerFragment, /\{\{FOOTER_REGISTRATION_NUMBER\}\}/);
assert.match(footerFragment, /class="site-footer-email-link"/);
assert.match(footerFragment, /class="site-footer-gmail-link"/);
assert.match(footerFragment, /<span>\{\{FOOTER_GMAIL_TITLE\}\}<\/span>/);
assert.match(footerFragment, /site-footer-contact-list[\s\S]*?site-footer-email-link[\s\S]*?site-footer-gmail-link/);
assert.doesNotMatch(footerFragment.match(/<div class="site-footer-bottom">([\s\S]*?)<\/div>/)?.[1] || "", /site-footer-gmail-link/);
assert.doesNotMatch(footerFragment, /site-footer-intro|site-footer-logo|site-footer-brand/);
assert.match(footerModule, /def validate_footer_content/);
assert.match(footerModule, /html\.escape/);
assert.match(footerModule, /def gmail_compose_href/);
assert.match(pageBuilder, /read_footer_content/);
assert.match(pageBuilder, /render_footer_template/);
assert.match(pageBuilder, /footer_content: dict\[str, str\] \| None = None/);
assert.match(pageBuilder, /"terms\.html"[\s\S]*?template_filename="legal\.template\.html"/);
assert.match(pageBuilder, /"privacy\.html"[\s\S]*?content_filename="legal\/privacy\.content\.html"/);
assert.match(controlPanel, /<h2>עריכת טקסט הפוטר<\/h2>/);
assert.match(controlPanel, /data-footer-field="businessName"/);
assert.match(controlPanel, /api\('\/api\/footer'/);
assert.match(controlServer, /if path == "\/api\/footer"/);
assert.match(controlServer, /save_footer_content_and_render_pages/);
assert.match(deployTool, /PUBLIC_HTML_FILES = tuple\(page\.filename for page in PAGE_DOCUMENTS\) \+ \("404\.html",\)/);
assert.match(css, /\.site-footer-grid\s*\{[\s\S]*?grid-template-columns:/);
assert.match(css, /\.site-footer-bottom\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /\.site-footer-contact-list \.site-footer-gmail-link\s*\{[\s\S]*?grid-template-columns:\s*20px minmax\(0, 1fr\)/);
assert.match(css, /\.site-footer-contact-list \.site-footer-email-link\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.doesNotMatch(css, /\.site-footer-gmail-link\s*\{[^}]*border-radius:\s*50%/);
assert.match(css, /\.site-footer-contact-list a:hover,[\s\S]*?background:\s*linear-gradient\([\s\S]*?box-shadow:/);
assert.match(css, /\.site-footer-link-list a:focus-visible[\s\S]*?outline:\s*2px solid/);
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
assert.doesNotMatch(terms, /דין ויישוב מחלוקות/);
assert.match(terms, /<h2>11\. יצירת קשר<\/h2>/);
assert.match(privacy, /<body data-page="privacy">/);
assert.match(privacy, /localStorage/);
assert.match(privacy, /Cloudflare Pages ו־Cloudflare R2\/CDN/);
assert.match(privacy, /מדידה תפעולית מצומצמת/);
assert.match(privacy, /Cloudflare Analytics Engine/);
assert.match(privacy, /אינה יוצרת קובצי עוגיות/);
assert.match(privacy, /Global Privacy Control או Do Not Track/);

console.log('footer_legal_contract.test.js: PASS');
