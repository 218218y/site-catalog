'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { readAllBundles, readAllCssBundles } = require('./frontend_test_assets');

const root = path.join(__dirname, '..');
const publicPages = ['index.html', 'catalog.html', 'favorites.html', 'viewer.html', 'payment.html', 'terms.html', 'privacy.html', 'accessibility.html'];
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
  assert.match(html, /class="site-footer-email-link"[\s\S]*?href="mailto:/);
  assert.match(html, /class="site-footer-gmail-link"/);
  assert.match(html, /<span>שליחה דרך Gmail<\/span>/);
  const contactCard = html.match(/<section class="site-footer-card" aria-labelledby="footerContactTitle">([\s\S]*?)<\/section>/)?.[1] || "";
  assert.match(contactCard, /site-footer-email-link[\s\S]*?site-footer-gmail-link/);
  const footerBottom = html.match(/<div class="site-footer-bottom">([\s\S]*?)<\/div>/)?.[1] || "";
  assert.doesNotMatch(footerBottom, /site-footer-gmail-link/);
  assert.match(html, /href="payment\.html" class="site-footer-payment-link">/);
  assert.match(html, /href="terms\.html">/);
  assert.match(html, /href="privacy\.html">/);
  assert.match(html, /href="accessibility\.html">/);
  assert.match(html, /href="#top" class="site-footer-top-link"/);
  assert.doesNotMatch(html, /\{\{FOOTER_[A-Z0-9_]+\}\}/);
  assert.doesNotMatch(html, /site-footer-intro|site-footer-logo|site-footer-brand/);
}

const template = fs.readFileSync(path.join(root, 'site.template.html'), 'utf8');
const legalTemplate = fs.readFileSync(path.join(root, 'legal.template.html'), 'utf8');
const paymentTemplate = fs.readFileSync(path.join(root, 'payment.template.html'), 'utf8');
const footerFragment = fs.readFileSync(path.join(root, 'partials', 'site-footer.html'), 'utf8');
const footerModule = fs.readFileSync(path.join(root, 'tools', 'footer_content.py'), 'utf8');
const pageBuilder = fs.readFileSync(path.join(root, 'tools', 'build_site_pages.py'), 'utf8');
const controlPanel = fs.readFileSync(path.join(root, 'catalog-control-panel.html'), 'utf8');
const controlPanelFooter = fs.readFileSync(path.join(root, 'src', 'control-panel', 'features', 'footer.js'), 'utf8');
const controlPanelApi = fs.readFileSync(path.join(root, 'src', 'control-panel', 'core', 'api.js'), 'utf8');
const controlServer = fs.readFileSync(path.join(root, 'tools', 'catalog_control_server.py'), 'utf8');
const deployTool = fs.readFileSync(path.join(root, 'tools', 'deploy_cloudflare_pages.py'), 'utf8');
const footerLegalCssSource = fs.readFileSync(path.join(root, 'src', 'css', '50-footer-legal.css'), 'utf8');
const css = readAllCssBundles();

assert.match(template, /\{\{SITE_FOOTER\}\}/);
assert.match(legalTemplate, /\{\{LEGAL_CONTENT\}\}/);
assert.match(legalTemplate, /<main class="legal-main" id="main-content" tabindex="-1">/);
assert.match(footerFragment, /\{\{FOOTER_VISIT_TITLE\}\}/);
assert.match(footerFragment, /href="payment\.html" class="site-footer-payment-link">\{\{FOOTER_PAYMENT_LABEL\}\}<\/a>/);
assert.match(footerFragment, /href="tel:\{\{FOOTER_MOBILE_TEL_HREF\}\}"/);
assert.match(footerFragment, /href="\{\{FOOTER_GMAIL_HREF\}\}"/);
assert.match(footerFragment, /\{\{FOOTER_REGISTRATION_NUMBER\}\}/);
assert.match(footerFragment, /class="site-footer-email-link"/);
assert.match(footerFragment, /class="site-footer-gmail-link"/);
assert.match(footerFragment, /<span>\{\{FOOTER_GMAIL_TITLE\}\}<\/span>/);
assert.match(footerFragment, /site-footer-contact-list[\s\S]*?site-footer-email-link[\s\S]*?site-footer-gmail-link/);
assert.doesNotMatch(footerFragment.match(/<div class="site-footer-bottom">([\s\S]*?)<\/div>/)?.[1] || "", /site-footer-gmail-link/);
assert.doesNotMatch(footerFragment, /site-footer-intro|site-footer-logo|site-footer-brand/);
assert.match(footerFragment, /class="site-footer-email-row"/);
assert.match(footerFragment, /class="site-footer-email-link"[\s\S]*?title="\{\{FOOTER_EMAIL_MAILTO_TITLE\}\}"/);
const gmailAnchorAttributes = footerFragment.split('class="site-footer-gmail-link"')[1]?.split('>')[0] || "";
assert.doesNotMatch(gmailAnchorAttributes, /\stitle=/);
assert.match(footerModule, /def validate_footer_content/);
assert.match(footerModule, /def footer_editor_schema/);
assert.match(footerModule, /html\.escape/);
assert.match(footerModule, /def gmail_compose_href/);
assert.match(pageBuilder, /read_footer_content/);
assert.match(pageBuilder, /render_footer_template/);
assert.match(pageBuilder, /footer_content: dict\[str, str\] \| None = None/);
assert.match(pageBuilder, /"terms\.html"[\s\S]*?template_filename="legal\.template\.html"/);
assert.match(pageBuilder, /"privacy\.html"[\s\S]*?content_filename="legal\/privacy\.content\.html"/);
assert.match(pageBuilder, /"accessibility\.html"[\s\S]*?content_filename="legal\/accessibility\.content\.html"/);
assert.match(pageBuilder, /"payment\.html"[\s\S]*?template_filename="payment\.template\.html"/);
assert.match(paymentTemplate, /data-payment-enabled="\{\{PAYMENT_ENABLED\}\}"/);
assert.match(paymentTemplate, /data-payment-url="\{\{PAYMENT_URL\}\}"/);
assert.match(paymentTemplate, /id="paymentShareLink"[\s\S]*?aria-label="שיתוף או העתקת קישור לעמוד התשלום"/);
assert.match(paymentTemplate, /class="brand-copy-link payment-share-link"/);
assert.match(paymentTemplate, /id="paymentShareToast" role="status" aria-live="polite" aria-atomic="true"/);
assert.match(footerLegalCssSource, /\.legal-header-actions\s*\{[\s\S]*?display:\s*inline-flex;[\s\S]*?gap:\s*9px;/);
assert.match(footerLegalCssSource, /\.payment-share-link\s*\{[\s\S]*?min-width:\s*40px;[\s\S]*?min-height:\s*40px;/);
assert.match(footerLegalCssSource, /@media \(max-width: 460px\)[\s\S]*?\.legal-header-actions \.legal-back-link span\s*\{\s*display:\s*none;/);
assert.match(controlPanel, /<h2>עריכת טקסט הפוטר<\/h2>/);
assert.match(controlPanel, /id="footerEditorGroups"/);
assert.match(controlPanelFooter, /function footerFieldMarkup/);
assert.match(controlPanelFooter, /data-footer-field="\$\{escapeHtml\(key\)\}"/);
assert.match(controlPanelFooter, /controlApi\.saveFooter\(/);
assert.match(controlPanelApi, /postJson\("\/api\/footer", request\)/);
assert.match(controlServer, /if path == "\/api\/footer"/);
assert.match(controlServer, /save_footer_content_and_render_pages/);
assert.match(controlServer, /"footerEditor": footer_editor_schema\(\)/);
assert.match(deployTool, /PUBLIC_HTML_FILES = tuple\([\s\S]*?TECHNICAL_SHELL_FILENAMES[\s\S]*?\) \+ \("404\.html",\)/);
assert.match(css, /\.site-footer-grid\s*\{[\s\S]*?grid-template-columns:/);
assert.match(css, /\.site-footer-bottom\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
assert.match(css, /\.site-footer-contact-list\s*\{[\s\S]*?--footer-contact-inline-padding:\s*8px;[\s\S]*?--footer-contact-label-width:\s*44px;/);
assert.match(css, /\.site-footer-contact-list > a,\s*\.site-footer-email-row\s*\{[\s\S]*?grid-template-columns:\s*var\(--footer-contact-label-width\) minmax\(0, 1fr\)/);
assert.match(css, /\.site-footer-contact-list > a\s*\{[\s\S]*?padding-inline:\s*0;/);
assert.match(css, /\.site-footer-contact-list > a > span,\s*\.site-footer-contact-label\s*\{[\s\S]*?padding-inline-start:\s*var\(--footer-contact-inline-padding\)/);
assert.match(css, /\.site-footer-contact-list > a > bdi\s*\{[\s\S]*?padding-left:\s*var\(--footer-contact-inline-padding\);[\s\S]*?text-align:\s*left;/);
assert.match(css, /\.site-footer-email-actions\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
assert.match(css, /\.site-footer-contact-list \.site-footer-email-actions a\s*\{[\s\S]*?width:\s*100%[\s\S]*?min-height:\s*31px[\s\S]*?padding:\s*4px var\(--footer-contact-inline-padding\)/);
assert.match(css, /\.site-footer-contact-list \.site-footer-email-link\s*\{[\s\S]*?justify-content:\s*flex-end;[\s\S]*?text-align:\s*left;/);
assert.match(css, /\.site-footer-contact-list \.site-footer-gmail-link\s*\{[\s\S]*?grid-template-columns:\s*20px minmax\(0, 1fr\)/);
assert.match(css, /\.site-footer-gmail-link span\s*\{[\s\S]*?text-align:\s*left;/);
assert.doesNotMatch(css, /\.site-footer-gmail-link\s*\{[^}]*border-radius:\s*50%/);
assert.match(css, /\.site-footer-contact-list a:hover,[\s\S]*?background:\s*linear-gradient\([\s\S]*?box-shadow:/);
assert.match(css, /\.site-footer-link-list a:focus-visible[\s\S]*?outline:\s*2px solid/);
assert.match(css, /body:is\(\[data-page="home"\], \[data-page="catalog"\], \[data-page="favorites"\]\):not\(\[data-app-ready="true"\]\) > \.site-footer/);
assert.match(css, /\.site-footer\s*\{[\s\S]*?padding:\s*0\s+clamp\(/);
assert.doesNotMatch(css, /\.site-footer-intro\s*\{/);
assert.match(css, /--viewer-control-inner-shadow:\s*none;/);
assert.match(css, /--viewer-control-hover-shadow:\s*0 16px 36px rgba\(70, 50, 36, 0\.17\);/);
assert.doesNotMatch(css, /--viewer-control-hover-bg:[^;]*#fff/);
assert.doesNotMatch(css, /--viewer-control-hover-shadow:[^;]*inset/);
assert.match(css, /\.legal-document-content\s*\{/);
assert.match(css, /@media \(max-width: 700px\)[\s\S]*?\.site-footer-grid\s*\{\s*grid-template-columns:\s*1fr;/);

const terms = fs.readFileSync(path.join(root, 'terms.html'), 'utf8');
const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
const accessibility = fs.readFileSync(path.join(root, 'accessibility.html'), 'utf8');
const payment = fs.readFileSync(path.join(root, 'payment.html'), 'utf8');
const paymentSource = fs.readFileSync(path.join(root, 'src', 'entries', 'payment.js'), 'utf8');
assert.match(terms, /<body data-page="terms">/);
assert.match(terms, /עמוד למעבר לתשלום חוב עבור הזמנה או עסקה קיימת/);
assert.match(terms, /התשלום באתר אינו יוצר הזמנה חדשה/);
assert.match(terms, /תיבת האישור אינה מסומנת מראש/);
assert.match(terms, /Grow במסגרת שירותי התשלומים של Morning/);
assert.match(terms, /האתר אינו שומר את מספר כרטיס האשראי/);
assert.match(terms, /קישור לשיתוף רשימת בחירה עשוי לכלול בכתובת עצמה/);
assert.doesNotMatch(terms, /דין ויישוב מחלוקות/);
assert.match(terms, /<h2>16\. יצירת קשר<\/h2>/);
assert.match(privacy, /<body data-page="privacy">/);
assert.match(privacy, /localStorage/);
assert.match(privacy, /Cloudflare Pages ו־Cloudflare R2\/CDN/);
assert.match(privacy, /מדידה תפעולית מצומצמת/);
assert.match(privacy, /Cloudflare Analytics Engine/);
assert.match(privacy, /אינה יוצרת קובצי עוגיות/);
assert.match(privacy, /Global Privacy Control או Do Not Track/);
assert.match(privacy, /טקסט חלקי בזמן ההקלדה אינו נשלח/);
assert.match(privacy, /Enter או בוחר תוצאה/);
assert.match(privacy, /עד 80 תווים/);
assert.match(privacy, /החריג היחיד הוא מונח חיפוש שהושלם/);
assert.match(privacy, /שם לקוח ומספר הזמנה או חשבון/);
assert.match(privacy, /מספר כרטיס אשראי, תוקף, קוד אבטחה/);
assert.match(privacy, /Grow במסגרת שירותי Morning/);
assert.match(privacy, /שדות הזיהוי בעמוד התשלום אינם נשמרים/);
assert.match(accessibility, /<body data-page="accessibility">/);
assert.match(accessibility, /ת״י 5568 חלק 1/);
assert.match(accessibility, /מגבלות ידועות וחלופות נגישות/);
assert.match(accessibility, /17 ביולי 2026/);
assert.match(payment, /<body data-page="payment">/);
assert.match(payment, /name="customerName"[\s\S]*?required/);
assert.match(payment, /name="orderNumber"[\s\S]*?required/);
assert.match(payment, /name="termsAccepted" type="checkbox" required/);
assert.doesNotMatch(payment, /name="termsAccepted"[^>]*checked/);
assert.match(payment, /id="paymentSubmit" type="submit" disabled/);
assert.match(payment, /href="terms\.html" target="_blank" rel="noopener"/);
assert.match(payment, /href="privacy\.html" target="_blank" rel="noopener"/);
assert.match(payment, /src="app-payment\.js"/);
assert.doesNotMatch(payment, /name="(?:card|cardNumber|cvv|cvc|expiry)"/i);
assert.doesNotMatch(paymentSource, /localStorage|sessionStorage|fetch\(/);
assert.match(paymentSource, /parsedUrl\?\.protocol === "https:"/);
assert.match(paymentSource, /form\.reportValidity\(\)/);
assert.match(paymentSource, /function isMobileShareEnvironment\(\)/);
assert.match(paymentSource, /navigator\.share\(\{[\s\S]*?url: link/);
assert.match(paymentSource, /navigator\.clipboard\?\.writeText/);
assert.match(paymentSource, /document\.execCommand\("copy"\)/);
assert.match(paymentSource, /showShareToast\("הקישור הועתק"\)/);
assert.match(paymentSource, /shareButton\.addEventListener\("click"/);


console.log('footer_legal_contract.test.js: PASS');
