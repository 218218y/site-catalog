"use strict";

const assert = require("node:assert/strict");
const { importFrontendTestModule } = require("./frontend_test_module");

global.HTMLElement = class HTMLElement {};

class FakeImage {
  constructor(outcomes) {
    this.dataset = {};
    this.complete = false;
    this.naturalWidth = 0;
    this.outcomes = [...outcomes];
    this.listeners = new Map();
    this.srcValue = "";
  }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  emit(type) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(type, []);
    for (const listener of listeners) listener();
  }
  set src(value) {
    this.srcValue = String(value);
    const loaded = Boolean(this.outcomes.shift());
    this.complete = true;
    this.naturalWidth = loaded ? 640 : 0;
    this.emit(loaded ? "load" : "error");
  }
  get src() { return this.srcValue; }
  getAttribute(name) { return name === "src" ? this.srcValue : null; }
  removeAttribute() {}
  closest() { return null; }
}

function createApi(log) {
  Object.defineProperty(globalThis, "navigator", { value: {}, writable: true, configurable: true });
  Object.assign(globalThis, {
    window: {
      BARGIG_CATALOG_TAXONOMY: { categories: [], subcategories: [] },
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
    prepareImagePlaceholder() {},
    syncImagePlaceholderState() {},
    telemetryTrackImageAttemptFailure: (src, options) => log.push(["attempt", src, options]),
    telemetryTrackImageRecovery: (src, options) => log.push(["recovered", src, options]),
    telemetryTrackImageTerminalFailure: (src, options) => log.push(["terminal", src, options])
  });
  return importFrontendTestModule("src/js/20-shared-ui.js", "shared-ui");
}

{
  const log = [];
  const api = createApi(log);
  const image = new FakeImage([false, true]);
  let success = null;
  api.loadCatalogImageWithRecovery(image, {
    primarySrc: "https://cdn.example.test/primary.webp?v=release",
    fallbackSrc: "https://cdn.example.test/thumb.webp",
    telemetryDetail: "viewer-single",
    onSuccess(candidate, state) { success = { candidate, state }; }
  });

  assert.deepEqual(log.map((entry) => entry[0]), ["attempt", "recovered"]);
  assert.equal(log[0][2].detail, "viewer-single-primary");
  assert.equal(log[0][2].attempt, 1);
  assert.equal(log[1][2].action, "direct-retry");
  assert.equal(log[1][2].failedAttempts, 1);
  assert.equal(log[0][2].requestContext, log[1][2].requestContext, "one frozen correlation context spans failure and recovery");
  assert.equal(log[0][2].requestContext.requestId, "ir-test1234");
  assert.equal(success.candidate.role, "direct-retry");
  assert.equal(success.state.failedAttempts, 1);
}

{
  const log = [];
  const api = createApi(log);
  const image = new FakeImage([false, false, false]);
  let exhausted = null;
  api.loadCatalogImageWithRecovery(image, {
    primarySrc: "https://cdn.example.test/primary.webp?v=release",
    fallbackSrc: "https://cdn.example.test/thumb.webp",
    telemetryDetail: "viewer-scroll",
    onExhausted(state) { exhausted = state; }
  });

  assert.deepEqual(log.map((entry) => entry[0]), ["attempt", "attempt", "attempt", "terminal"]);
  assert.deepEqual(log.slice(0, 3).map((entry) => entry[2].action), ["primary", "direct-retry", "fallback"]);
  assert.equal(log[3][2].failedAttempts, 3);
  assert.ok(log.every((entry) => entry[2].requestContext === log[0][2].requestContext), "all attempts and terminal failure share one request context");
  assert.equal(exhausted.failedAttempts, 3);
  assert.equal(exhausted.lastCandidate.role, "fallback");
}

console.log("telemetry_image_lifecycle_logic.test.js: PASS");
