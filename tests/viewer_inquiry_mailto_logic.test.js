"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const functionSource = app.match(
  /function viewerInquiryMailtoUrl\(emailAddress, reference\) \{[\s\S]*?\n\}/
)?.[0];

assert.ok(functionSource, "viewerInquiryMailtoUrl should be present in the generated application bundle");

const context = {};
vm.runInNewContext(`${functionSource}\nthis.buildMailto = viewerInquiryMailtoUrl;`, context);

const reference = {
  subject: "בירור על דגם – קטלוג לדוגמה, עמוד 5",
  text: "שלום,\nרציתי לברר לגבי הדגם הבא:\nקישור ישיר: https://example.com/catalog/demo/page/5/"
};
const href = context.buildMailto("office@example.com", reference);

assert.ok(href.startsWith("mailto:office@example.com?subject="));
assert.ok(href.includes("%20"), "spaces in a mailto URI must use percent encoding");
assert.ok(href.includes("%0D%0A"), "mailto body line breaks should use encoded CRLF");
assert.doesNotMatch(href, /[?&](?:subject|body)=[^&]*\+/, "Outlook must not receive form-style plus signs for spaces");

const parsed = new URL(href);
assert.equal(parsed.searchParams.get("subject"), reference.subject);
assert.equal(parsed.searchParams.get("body"), reference.text.replace(/\n/g, "\r\n"));

console.log("viewer_inquiry_mailto_logic.test.js: PASS");
