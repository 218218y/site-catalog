"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { importFrontendTestModule } = require("./frontend_test_module");

const root = path.resolve(__dirname, "..");
const attempts = [];
Object.defineProperty(globalThis, "navigator", { value: {}, writable: true, configurable: true });
Object.assign(globalThis, {
  window: {
    location: { href: "https://example.test/viewer.html" }
  },
  requiredElement: () => ({}),
  CATALOG_IMAGE_RETRY_PARAM: "bargig_retry",
  CATALOG_ASSET_VERSION_PARAM: "v",
  telemetryCleanText: (value, limit) => String(value || "").slice(0, limit),
  telemetryCreateImageRequestContext: (_img, _src, options = {}) => Object.freeze({
    requestId: "ir-test1234", catalogId: "catalog-a", pageNumber: 1,
    detail: String(options.detail || "image"), surface: String(options.surface || "image"),
    visibility: String(options.visibility || "visible"), page: "viewer",
    path: "/viewer.html?catalog=catalog-a&page=1", viewport: "xs", releaseId: "deploy-0123456789abcdef"
  }),
  telemetryCatalogImageContext: () => ({ detail: "thumbnail" }),
  telemetryTrackImageAttemptFailure: (src, options) => attempts.push({ src, options }),
  telemetryTrackImageRecovery() {},
  telemetryTrackImageTerminalFailure() {},
});
class FakeHTMLElement {}
global.HTMLElement = FakeHTMLElement;
const frameClasses = new Set();
const frame = new FakeHTMLElement();
frame.classList = {
  add: (...names) => names.forEach((name) => frameClasses.add(name)),
  remove: (...names) => names.forEach((name) => frameClasses.delete(name)),
  toggle(name, enabled) { if (enabled) frameClasses.add(name); else frameClasses.delete(name); }
};
const api = importFrontendTestModule("src/js/20-shared-ui.js", "shared-ui");

class FakeImage {
  constructor() {
    this.dataset = { catalogImageRecovery: "lightweight", telemetryDetail: "thumbnail" };
    this.currentSrc = "https://cdn.example.test/page-001.webp?v=deploy123";
    this.srcValue = this.currentSrc;
    this.naturalWidth = 0;
    this.complete = false;
    this.isConnected = true;
    this.listeners = new Map();
  }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) || [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  set src(value) {
    this.srcValue = String(value);
    this.currentSrc = this.srcValue;
    this.complete = true;
    const list = this.listeners.get("error") || [];
    this.listeners.set("error", []);
    for (const listener of list) listener();
  }
  get src() { return this.srcValue; }
  getAttribute(name) { return name === "src" ? this.srcValue : null; }
  removeAttribute() {}
  closest() { return frame; }
}

const image = new FakeImage();
assert.equal(api.recoverCatalogImageAfterInitialFailure(image), true);
assert.equal(api.recoverCatalogImageAfterInitialFailure(image), true, "Repeated error events must not start a second recovery");
assert.equal(image.dataset.catalogImageRecoveryStarted, "true");
assert.equal(attempts.length, 2, "the original failure and the bounded direct retry are both tracked");
assert.equal(attempts[0].options.action, "primary");
assert.equal(attempts[0].options.attempt, 1);
assert.equal(attempts[1].options.action, "direct-retry");
assert.equal(attempts[0].options.requestContext, attempts[1].options.requestContext);
assert.equal(attempts[0].options.requestContext.requestId, "ir-test1234");
assert.match(image.currentSrc, /bargig_retry=/);
assert.doesNotMatch(image.currentSrc, /[?&]v=/);
assert.equal(frameClasses.has("image-error"), true, "exhausted lightweight recovery exposes the placeholder error state");

const unmanaged = { dataset: {}, currentSrc: "https://example.test/logo.svg", getAttribute() { return this.currentSrc; } };
assert.equal(api.recoverCatalogImageAfterInitialFailure(unmanaged), false);
assert.equal(attempts.length, 2);

for (const [relative, expectedMinimum] of [
  ["src/js/35-favorites-workspace.js", 1],
  ["src/js/40-catalog-grid.js", 2],
  ["src/js/50-search-ui.js", 2],
  ["src/js/56-viewer-shell.js", 2]
]) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  const matches = source.match(/catalogImageRecoveryAttributes\(/g) || [];
  assert.ok(matches.length >= expectedMinimum, `${relative} must mark every catalog thumbnail/cover for bounded recovery`);
}

console.log("catalog_thumbnail_recovery_logic.test.js: PASS");
