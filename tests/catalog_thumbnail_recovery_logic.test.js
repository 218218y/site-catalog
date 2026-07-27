"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sharedUi = fs.readFileSync(path.join(root, "src/js/20-shared-ui.js"), "utf8");
const start = sharedUi.indexOf("function recoverCatalogImageAfterInitialFailure(img)");
const end = sharedUi.indexOf("function prepareCatalogImage(url, options = {})", start);
assert.notEqual(start, -1, "Missing recoverCatalogImageAfterInitialFailure");
assert.notEqual(end, -1, "Missing recovery function boundary");
const recoverySource = sharedUi.slice(start, end);

const attempts = [];
const loads = [];
const placeholders = [];
const recover = new Function(
  "telemetryCleanText",
  "telemetryCatalogImageContext",
  "telemetryTrackImageAttemptFailure",
  "unversionedCatalogImageUrl",
  "normalizeCatalogImageUrl",
  "loadCatalogImageWithRecovery",
  "syncImagePlaceholderState",
  `${recoverySource}; return recoverCatalogImageAfterInitialFailure;`
)(
  (value, limit) => String(value || "").slice(0, limit),
  () => ({ detail: "thumbnail" }),
  (src, options) => attempts.push({ src, options }),
  (src) => String(src).replace(/[?&]v=[^&#]+/, "").replace(/[?&]$/, ""),
  (src) => String(src || ""),
  (img, options) => {
    loads.push({ img, options });
    options.onExhausted();
  },
  (img) => placeholders.push(img)
);

const image = {
  dataset: {
    catalogImageRecovery: "lightweight",
    telemetryDetail: "thumbnail"
  },
  currentSrc: "https://cdn.example.test/page-001.webp?v=deploy123",
  isConnected: true,
  getAttribute(name) {
    return name === "src" ? this.currentSrc : null;
  }
};

assert.equal(recover(image), true);
assert.equal(recover(image), true, "Repeated error events must not start a second recovery");
assert.equal(attempts.length, 1);
assert.equal(attempts[0].options.action, "primary");
assert.equal(attempts[0].options.attempt, 1);
assert.equal(loads.length, 1);
assert.equal(loads[0].options.primarySrc, "https://cdn.example.test/page-001.webp");
assert.equal(loads[0].options.forceRefresh, true);
assert.equal(loads[0].options.forceRefreshRole, "direct-retry");
assert.equal(loads[0].options.initialFailedAttempts, 1);
assert.equal(loads[0].options.fallbackSrc, undefined, "Lightweight recovery must not fan out into fallback requests");
assert.equal(placeholders.length, 1);

const unmanaged = {
  dataset: {},
  currentSrc: "https://example.test/logo.svg",
  getAttribute() { return this.currentSrc; }
};
assert.equal(recover(unmanaged), false);
assert.equal(loads.length, 1);

for (const [relative, expectedMinimum] of [
  ["src/js/35-favorites-workspace.js", 1],
  ["src/js/40-catalog-grid.js", 2],
  ["src/js/50-search-ui.js", 2],
  ["src/js/56-viewer-shell.js", 2]
]) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const matches = source.match(/catalogImageRecoveryAttributes\(/g) || [];
  assert.ok(
    matches.length >= expectedMinimum,
    `${relative} must mark every catalog thumbnail/cover for bounded recovery`
  );
}

console.log("catalog_thumbnail_recovery_logic.test.js: PASS");
