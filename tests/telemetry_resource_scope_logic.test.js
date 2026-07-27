"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../src/js/15-telemetry.js"), "utf8");
const stableStart = source.indexOf("function telemetryStableResourceUrl(value)");
const scopeEnd = source.indexOf("function telemetryDiagnosticOnce(key)", stableStart);
assert.notEqual(stableStart, -1, "Missing telemetryStableResourceUrl");
assert.notEqual(scopeEnd, -1, "Missing telemetry resource helper boundary");
const helperSource = source.slice(stableStart, scopeEnd);

const helpers = new Function(
  "window",
  "CATALOG_IMAGE_RETRY_PARAM",
  "telemetryCleanText",
  `${helperSource}; return {
    stable: telemetryStableResourceUrl,
    sourceName: telemetryResourceSourceName,
    scope: telemetryResourceScope
  };`
)(
  { location: { href: "https://bargig-furniture.com/catalog/test", origin: "https://bargig-furniture.com" } },
  "retry",
  (value, limit) => String(value || "").slice(0, limit)
);

const beacon = "https://static.cloudflareinsights.com/beacon.min.js/v4513226cdae34746b4dedf0b4dfa099e1781791509496";
assert.equal(helpers.sourceName(beacon), "beacon.min.js");
assert.equal(helpers.scope(beacon), "cloudflare-observability");
assert.equal(helpers.scope("https://cloudflareinsights.com/cdn-cgi/rum"), "cloudflare-observability");
assert.equal(helpers.scope("https://cdn.bargig-furniture.com/assets/pages/demo/thumbs/page-001.webp"), "catalog-cdn");
assert.equal(helpers.scope("https://bargig-furniture.com/static/app.js"), "site");
assert.equal(helpers.scope("https://netfree.link/review"), "netfree-filter");
assert.equal(helpers.scope("https://review.internal.netfree.link:12001/script.js"), "netfree-filter");
assert.equal(helpers.scope("chrome-extension://example/injected.js"), "extension");
assert.equal(helpers.scope("https://example.test/optional.js"), "external");
assert.equal(
  helpers.stable("https://cdn.bargig-furniture.com/page.webp?v=one&retry=two#hash"),
  "https://cdn.bargig-furniture.com/page.webp?v=one"
);

console.log("telemetry_resource_scope_logic.test.js: PASS");
