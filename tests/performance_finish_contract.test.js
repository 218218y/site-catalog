"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { hasFunction, inventoryProjectFiles } = require("./helpers/frontend_ast");

const root = path.resolve(__dirname, "..");
const appState = fs.readFileSync(path.join(root, "src/js/10-app-state.js"), "utf8");
const imageRuntime = fs.readFileSync(path.join(root, "src/js/20-catalog-runtime.js"), "utf8");
const catalogGrid = fs.readFileSync(path.join(root, "src/js/40-catalog-grid.js"), "utf8");
const telemetry = fs.readFileSync(path.join(root, "src/runtime/telemetry.js"), "utf8");
const telemetryFunction = fs.readFileSync(path.join(root, "functions/api/telemetry.js"), "utf8");
const pageBuilder = fs.readFileSync(path.join(root, "tools/build_site_pages.py"), "utf8");
const verifier = fs.readFileSync(path.join(root, "tools/verify_project.py"), "utf8");
const budgets = JSON.parse(fs.readFileSync(path.join(root, "performance-budgets.json"), "utf8"));
const imageRuntimeAst = inventoryProjectFiles(root, ['src/js/20-catalog-runtime.js'])['src/js/20-catalog-runtime.js'];

assert.match(appState, /const CATALOG_EAGER_COVER_COUNT = 2;/);
assert.ok(hasFunction(imageRuntimeAst, 'catalogImageDimensionAttributes'));
assert.ok(hasFunction(imageRuntimeAst, 'catalogCoverLoadingAttributes'));
assert.match(imageRuntime, /loading="eager" decoding="async" fetchpriority="high"/);
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
assert.match(telemetry, /durationThreshold: 16/);
assert.match(telemetry, /telemetryRecordInteractionTiming/);
assert.match(telemetry, /__BARGIG_ENABLE_VITALS_DIAGNOSTICS__/);
assert.match(telemetry, /__BARGIG_WEB_VITALS__/);
assert.match(telemetry, /for \(const name of (?:\/\*\* @type \{TelemetryWebVitalName\[\]\} \*\/ \()?\["LCP", "INP", "CLS"\]\)?\)/);
assert.match(telemetry, /\(name === "LCP" \|\| name === "INP"\) && value === 0/);
assert.match(telemetry, /telemetryTrack\("web_vital"/);
assert.match(telemetryFunction, /"web_vital"/);

assert.equal(budgets.requiredHeadroomPercent, 15);
for (const route of ["catalog", "favorites", "viewer"]) {
  assert.ok(budgets.javascriptBundles[route].rawBytes > 0);
  assert.ok(budgets.javascriptBundles[route].gzipBytes > 0);
  assert.ok(budgets.cssBundles[route].rawBytes > 0);
  assert.ok(budgets.cssBundles[route].gzipBytes > 0);
}
assert.ok(budgets.cssBundles.core.rawBytes > 0);
assert.ok(budgets.searchIndex.rawBytes > 0);
assert.ok(budgets.largestHtml.rawBytes > 0);
assert.equal(budgets.socialShareImage.width, 1200);
assert.equal(budgets.socialShareImage.height, 630);
assert.deepEqual(budgets.coreWebVitals.mobile4x, { LCP: 2500, INP: 200, CLS: 0.1 });
assert.match(verifier, /Source performance budgets/);
assert.match(verifier, /Deploy performance budgets/);
assert.match(fs.readFileSync(path.join(root, "tools/check_performance_budgets.py"), "utf8"), /operating ceiling/);

console.log("performance_finish_contract.test.js: PASS");
