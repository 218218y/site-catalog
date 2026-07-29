"use strict";

const assert = require("node:assert/strict");
const { importFrontendTestModule } = require("./frontend_test_module");

const { buildViewerInquiryMailtoUrl } = importFrontendTestModule("src/js/19-shared-pure.js", "shared-pure");
const reference = {
  subject: "בירור על דגם – קטלוג לדוגמה, עמוד 5",
  text: "שלום,\nרציתי לברר לגבי הדגם הבא:\nקישור ישיר: https://example.com/catalog/demo/page/5/"
};
const href = buildViewerInquiryMailtoUrl("office@example.com", reference);

assert.ok(href.startsWith("mailto:office@example.com?subject="));
assert.ok(href.includes("%20"), "spaces in a mailto URI must use percent encoding");
assert.ok(href.includes("%0D%0A"), "mailto body line breaks should use encoded CRLF");
assert.doesNotMatch(href, /[?&](?:subject|body)=[^&]*\+/, "Outlook must not receive form-style plus signs for spaces");

const parsed = new URL(href);
assert.equal(parsed.searchParams.get("subject"), reference.subject);
assert.equal(parsed.searchParams.get("body"), reference.text.replace(/\n/g, "\r\n"));

console.log("viewer_inquiry_mailto_logic.test.js: PASS");
