"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const pageController = fs.readFileSync(path.join(root, "src/js/59-viewer-page-controller.js"), "utf8");
const shell = fs.readFileSync(path.join(root, "src/js/56-viewer-shell.js"), "utf8");
const bundle = fs.readFileSync(path.join(root, "app-viewer.js"), "utf8");

assert.match(pageController, /catalogPageOrdinal\(catalog, activePage\(\)\)/);
assert.match(pageController, /displayCurrent:\s*activePage\(\)/);
assert.match(pageController, /displayTotal:\s*catalogLastPage\(catalog\)/);

assert.match(shell, /viewerPageIndicatorCurrent\.textContent\s*=\s*String\(displayCurrent\)/);
assert.match(shell, /viewerPageIndicatorTotal\.textContent\s*=\s*String\(displayTotal\)/);
assert.doesNotMatch(shell, /viewerPageIndicatorCurrent\.textContent\s*=\s*String\(currentItem\)/);
assert.doesNotMatch(shell, /viewerPageIndicatorTotal\.textContent\s*=\s*String\(totalItems\)/);

assert.match(bundle, /displayCurrent:\s*activePage\(\)/);
assert.match(bundle, /displayTotal:\s*catalogLastPage\(catalog\)/);
assert.match(bundle, /viewerPageIndicatorCurrent\.textContent\s*=\s*String\(displayCurrent\)/);
assert.match(bundle, /viewerPageIndicatorTotal\.textContent\s*=\s*String\(displayTotal\)/);

console.log("viewer_page_indicator_numbering_contract.test.js: PASS");
