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

for (const bundleName of ["styles.css", "styles-catalog.css", "styles-favorites.css", "styles-viewer.css"]) {
  const bundle = fs.readFileSync(path.join(root, bundleName), "utf8");
  assert.match(bundle, /Cascade layer: bargig\.application/);
  assert.equal((bundle.match(/@layer bargig\.application;/g) || []).length, 1);
  assert.equal((bundle.match(/@layer bargig\.application \{/g) || []).length, 1);
}

console.log("css_architecture_contract.test.js: PASS");
