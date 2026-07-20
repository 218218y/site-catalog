"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const telemetry = fs.readFileSync(path.join(root, "src/js/15-telemetry.js"), "utf8");
const viewerCss = fs.readFileSync(path.join(root, "src/css/90-visual-polish.css"), "utf8");
const footerCss = fs.readFileSync(path.join(root, "src/css/50-footer-legal.css"), "utf8");
const viewerShell = fs.readFileSync(path.join(root, "src/js/56-viewer-shell.js"), "utf8");
const template = fs.readFileSync(path.join(root, "site.template.html"), "utf8");

assert.doesNotMatch(telemetry, /"page_view"|"page_load"|"first_catalog_image"/);
assert.match(footerCss, /not\(\[data-app-ready="true"\]\)[^}]*> \.site-footer/);
assert.match(footerCss, /visibility: hidden/);
assert.match(viewerCss, /contain: layout paint style/);
assert.doesNotMatch(viewerCss, /width var\(--image-swap-duration\)/);
assert.doesNotMatch(viewerCss, /height var\(--image-swap-duration\)/);
assert.match(viewerShell, /querySelector\('\.lightbox-page-thumb\[aria-current="page"\]'\)/);
assert.match(template, /rel="preconnect" href="https:\/\/cdn\.bargig-furniture\.com"/);
assert.match(template, /rel="preload" href="brand-logo\.svg"/);
assert.doesNotMatch(template, /rel="preload" href="brand-logo-header\.svg"/);

console.log("web_vitals_stability_contract.test.js: PASS");
