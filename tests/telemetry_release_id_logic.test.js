"use strict";

const assert = require("node:assert/strict");
const { importFrontendTestModule } = require("./frontend_test_module");

global.window = {};
global.document = { querySelector: () => null };
Object.defineProperty(globalThis, "navigator", { value: {}, writable: true, configurable: true });
const { telemetryResolveReleaseId } = importFrontendTestModule("src/js/15-telemetry.js", "telemetry");

function resolve(windowValue, scriptSrc) {
  global.window = windowValue;
  return telemetryResolveReleaseId(scriptSrc);
}

assert.equal(resolve({}, "https://example.test/static/app.cb9e905e5526.js"), "app-cb9e905e5526");
for (const route of ["catalog", "favorites", "viewer"]) {
  assert.equal(resolve({}, `https://example.test/static/app-${route}.f7ae08108c2c.js`), "app-f7ae08108c2c");
}
assert.equal(resolve({}, "https://example.test/app.js?cache=1"), "app-unversioned");
assert.equal(
  resolve({ __BARGIG_RELEASE_ID__: " deploy-0123456789abcdef " }, "https://example.test/app-catalog.js"),
  "deploy-0123456789abcdef"
);
assert.equal(
  resolve({ __BARGIG_RELEASE_ID__: " release  custom\nvalue " }, "https://example.test/app.js"),
  "release custom value"
);
assert.equal(resolve({}, "https://example.test/vendor.js"), "unknown-release");

console.log("telemetry_release_id_logic.test.js: PASS");
