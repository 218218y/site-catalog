"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const behaviorTests = [
  "responsive_catalog_images_contract.test.js",
  "viewer_fit_mode_logic.test.js",
  "viewer_page_indicator_numbering_contract.test.js",
  "viewer_image_loading_logic.test.js",
];

for (const name of behaviorTests) {
  const source = fs.readFileSync(path.join(__dirname, name), "utf8");
  assert.match(source, /importFrontendTestModule/, `${name}: must execute a production owner module`);
  assert.doesNotMatch(source, /readFileSync\([^\n]*src[\\/]js/, `${name}: must not inspect production source text`);
  assert.doesNotMatch(source, /sourceBetween|extractFunction|new Function|\beval\s*\(/, `${name}: dynamic source extraction is forbidden`);
}

const structuralImageContract = fs.readFileSync(path.join(__dirname, "viewer_image_loading_contract.test.js"), "utf8");
assert.doesNotMatch(structuralImageContract, /src[\\/]js|sourceBetween|function showSingleLightboxImage/);
assert.match(structuralImageContract, /markup and visual-state contract/);

console.log("behavior_test_strategy_contract.test.js: PASS");
