"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appState = fs.readFileSync(path.join(root, "src/js/10-app-state.js"), "utf8");
const sharedUi = fs.readFileSync(path.join(root, "src/js/20-shared-ui.js"), "utf8");
const catalogGrid = fs.readFileSync(path.join(root, "src/js/40-catalog-grid.js"), "utf8");
const telemetry = fs.readFileSync(path.join(root, "src/js/15-telemetry.js"), "utf8");
const telemetryFunction = fs.readFileSync(path.join(root, "functions/api/telemetry.js"), "utf8");
const pageBuilder = fs.readFileSync(path.join(root, "tools/build_site_pages.py"), "utf8");
const verifier = fs.readFileSync(path.join(root, "tools/verify_project.py"), "utf8");
const budgets = JSON.parse(fs.readFileSync(path.join(root, "performance-budgets.json"), "utf8"));

assert.match(appState, /const CATALOG_EAGER_COVER_COUNT = 2;/);
assert.match(sharedUi, /function catalogImageDimensionAttributes\(/);
assert.match(sharedUi, /function catalogCoverLoadingAttributes\(/);
assert.match(sharedUi, /loading="eager" decoding="async" fetchpriority="high"/);
assert.match(catalogGrid, /catalogImageDimensionAttributes\(catalog, 1\)/);
assert.match(catalogGrid, /catalogCoverLoadingAttributes\(catalog\)/);
assert.match(pageBuilder, /width="\{width\}" height="\{height\}" loading="\{loading\}"/);
assert.match(pageBuilder, /eager_catalog_ids/);

for (const metric of ["LCP", "INP", "CLS"]) {
  assert.match(telemetry, new RegExp(`"${metric}"`));
}
assert.match(telemetry, /PerformanceObserver\.supportedEntryTypes/);
assert.match(telemetry, /largest-contentful-paint/);
assert.match(telemetry, /layout-shift/);
assert.match(telemetry, /durationThreshold: 40/);
assert.match(telemetry, /for \(const name of \["LCP", "INP", "CLS"\]\)/);
assert.match(telemetry, /\(name === "LCP" \|\| name === "INP"\) && value === 0/);
assert.match(telemetry, /telemetryTrack\("web_vital"/);
assert.match(telemetryFunction, /"web_vital"/);

assert.ok(budgets.appJavaScript.rawBytes > 0);
assert.ok(budgets.stylesCss.rawBytes > 0);
assert.ok(budgets.searchIndex.rawBytes > 0);
assert.ok(budgets.largestHtml.rawBytes > 0);
assert.equal(budgets.socialShareImage.width, 1200);
assert.equal(budgets.socialShareImage.height, 630);
assert.match(verifier, /Source performance budgets/);
assert.match(verifier, /Deploy performance budgets/);

console.log("performance_finish_contract.test.js: PASS");
