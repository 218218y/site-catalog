"use strict";

const assert = require("node:assert/strict");
const { importFrontendTestModule } = require("./frontend_test_module");

global.window = {
  location: {
    href: "https://bargig-furniture.com/catalog/test",
    origin: "https://bargig-furniture.com"
  }
};
global.document = { querySelector: () => null };
Object.defineProperty(globalThis, "navigator", { value: {}, writable: true, configurable: true });
global.CATALOG_IMAGE_RETRY_PARAM = "retry";

const helpers = importFrontendTestModule("src/js/15-telemetry.js", "telemetry");
const beacon = "https://static.cloudflareinsights.com/beacon.min.js/v4513226cdae34746b4dedf0b4dfa099e1781791509496";
assert.equal(helpers.telemetryResourceSourceName(beacon), "beacon.min.js");
assert.equal(helpers.telemetryResourceScope(beacon), "cloudflare-observability");
assert.equal(helpers.telemetryResourceScope("https://cloudflareinsights.com/cdn-cgi/rum"), "cloudflare-observability");
assert.equal(helpers.telemetryResourceScope("https://cdn.bargig-furniture.com/assets/pages/demo/thumbs/page-001.webp"), "catalog-cdn");
assert.equal(helpers.telemetryResourceScope("https://bargig-furniture.com/static/app.js"), "site");
assert.equal(helpers.telemetryResourceScope("https://netfree.link/review"), "netfree-filter");
assert.equal(helpers.telemetryResourceScope("https://review.internal.netfree.link:12001/script.js"), "netfree-filter");
assert.equal(helpers.telemetryResourceScope("chrome-extension://example/injected.js"), "extension");
assert.equal(helpers.telemetryResourceScope("https://example.test/optional.js"), "external");
assert.equal(
  helpers.telemetryStableResourceUrl("https://cdn.bargig-furniture.com/page.webp?v=one&retry=two#hash"),
  "https://cdn.bargig-furniture.com/page.webp?v=one"
);

console.log("telemetry_resource_scope_logic.test.js: PASS");
