"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const cssDirectory = path.join(root, "src", "css");
const sources = fs.readdirSync(cssDirectory).filter((name) => name.endsWith(".css")).sort();
const foundation = fs.readFileSync(path.join(cssDirectory, "00-foundation.css"), "utf8");
const requiredTokens = [
  "--z-sticky", "--z-site-header", "--z-viewer-hotspot", "--z-viewer-shell",
  "--z-viewer-progress", "--z-search-results", "--z-floating-control",
  "--z-scroll-top", "--z-mobile-menu", "--z-viewer-root",
  "--z-feature-panel", "--z-feature-action", "--z-search-popover",
  "--z-dialog", "--z-floating-menu", "--z-elevated-menu", "--z-toast",
  "--z-tour", "--z-transfer-dialog", "--z-note-dialog",
  "--z-skip-link", "--z-tooltip",
];

const scaleValues = requiredTokens.map((token) => {
  const match = foundation.match(new RegExp(`${token}:\\s*(-?\\d+);`));
  assert.ok(match, `${token}: missing z-index token`);
  return Number(match[1]);
});
assert.ok(scaleValues[0] >= 20, "global z-index scale must start above local stacking contexts");
for (let index = 1; index < scaleValues.length; index += 1) {
  assert.ok(scaleValues[index] > scaleValues[index - 1], `${requiredTokens[index]} must preserve scale order`);
}

const approvedTokens = new Set(requiredTokens);
for (const name of sources) {
  const source = fs.readFileSync(path.join(cssDirectory, name), "utf8");
  for (const match of source.matchAll(/\bz-index\s*:\s*([^;{}]+)/g)) {
    const value = match[1].trim().replace(/\s*!important$/, "");
    const token = value.match(/^var\((--z-[a-z0-9-]+)\)$/i)?.[1] || "";
    const localInteger = /^-?\d+$/.test(value) ? Number(value) : null;
    assert.ok(
      approvedTokens.has(token) || (localInteger !== null && Math.abs(localInteger) < 20),
      `${name}: unreviewed z-index value ${match[1].trim()}`,
    );
  }
  assert.doesNotMatch(source, /@layer\b/, `${name}: cascade layer ownership belongs to the builder`);
}

const reviewedImportantCounts = Object.freeze({
  "00-foundation.css": 0,
  "06-shell-components.css": 2,
  "08-shared-floating-ui.css": 0,
  "10-catalog.css": 0,
  "20-viewer.css": 2,
  "24-shared-inquiry.css": 0,
  "25-viewer-actions.css": 0,
  "30-media-components.css": 0,
  "40-catalog-refinements.css": 0,
  "50-footer-legal.css": 0,
  "52-payment.css": 0,
  "80-responsive-shell.css": 0,
  "85-favorites-routing.css": 0,
  "87-favorites-workspace.css": 1,
  "90-visual-polish.css": 10,
  "92-viewer-onboarding.css": 2,
  "95-accessibility-consistency.css": 5,
  "97-seo-foundation.css": 0,
});
assert.deepEqual(sources, Object.keys(reviewedImportantCounts).sort(), "review every CSS module in the important override ledger");
const importantCount = sources.reduce((total, name) => {
  const source = fs.readFileSync(path.join(cssDirectory, name), "utf8");
  const count = (source.match(/!important/g) || []).length;
  assert.equal(count, reviewedImportantCounts[name], `${name}: update the reviewed !important count after a justified removal`);
  return total + count;
}, 0);
assert.equal(importantCount, 22, "the reviewed CSS !important total must only move downward");

for (const bundleName of ["styles.css", "styles-catalog.css", "styles-favorites.css", "styles-viewer.css"]) {
  const bundle = fs.readFileSync(path.join(root, bundleName), "utf8");
  assert.match(bundle, /Cascade layer: bargig\.application/);
  assert.equal((bundle.match(/@layer bargig\.application;/g) || []).length, 1);
  assert.equal((bundle.match(/@layer bargig\.application \{/g) || []).length, 1);
}

console.log("css_architecture_contract.test.js: PASS");
