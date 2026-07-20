"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../src/js/15-telemetry.js"), "utf8");
const resolveStart = source.indexOf("function telemetryResolveReleaseId()");
const cleanStart = source.indexOf("function telemetryCleanText(value, limit = 120)");
const cleanEnd = source.indexOf("function telemetryCleanPathname", cleanStart);
assert.notEqual(resolveStart, -1, "Missing telemetryResolveReleaseId");
assert.notEqual(cleanStart, -1, "Missing telemetryCleanText");
assert.notEqual(cleanEnd, -1, "Missing telemetryCleanText boundary");

const resolveSource = source.slice(resolveStart, source.indexOf("const TELEMETRY_RELEASE_ID", resolveStart));
const cleanSource = source.slice(cleanStart, cleanEnd);

function resolver(windowValue, scriptSrc) {
  return new Function(
    "window",
    "document",
    `${cleanSource}\n${resolveSource}\nreturn telemetryResolveReleaseId;`
  )(windowValue, { currentScript: scriptSrc ? { src: scriptSrc } : null });
}

assert.equal(
  resolver({}, "https://example.test/static/app.cb9e905e5526.js")(),
  "app-cb9e905e5526"
);
assert.equal(
  resolver({}, "https://example.test/app.js?cache=1")(),
  "app-unversioned"
);
assert.equal(
  resolver({ __BARGIG_RELEASE_ID__: " release  custom\nvalue " }, "https://example.test/app.js")(),
  "release custom value"
);
assert.equal(resolver({}, "https://example.test/vendor.js")(), "unknown-release");

console.log("telemetry_release_id_logic.test.js: PASS");
