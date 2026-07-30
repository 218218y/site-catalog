"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { readAllCssBundles } = require("./frontend_test_assets");

const root = path.join(__dirname, "..");
const css = readAllCssBundles();
const template = fs.readFileSync(path.join(root, "site.template.html"), "utf8");

// This file intentionally owns only the markup and visual-state contract.
// Recovery candidates, retry commands, telemetry and resolution-layer behavior
// are exercised through the real module APIs in the corresponding logic tests.
assert.match(template, /id="viewerImageFeedback"[^>]*role="status"/);
assert.match(template, /id="viewerImageRetry"/);
assert.match(css, /\.viewer-image-feedback\s*\{/);
assert.doesNotMatch(css, /\.viewer-scroll-image-feedback\s*\{/);
assert.match(css, /\.lightbox-image-frame\.image-terminal-error/);
assert.match(css, /\.lightbox\.is-page-loading \.lightbox-image-frame\s*\{[\s\S]*?brightness\(\.97\)/);
assert.match(css, /\.lightbox-image-frame > \.lightbox-image:not\(\.lightbox-image-resolution\)\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?inset:\s*0;[\s\S]*?display:\s*block;[\s\S]*?width:\s*100%;[\s\S]*?height:\s*100%;/);
assert.match(css, /\.image-placeholder-frame:not\(\.lightbox-image-frame\) > img:not\(\[data-placeholder-ignore="true"\]\)\s*\{[\s\S]*?position:\s*relative;/);
assert.match(css, /\.lightbox-image-frame \.lightbox-image-resolution/);
assert.match(css, /\.lightbox-image-frame\.is-resolution-upgrade-ready \.lightbox-image-resolution/);

console.log("viewer_image_loading_contract.test.js: PASS");
