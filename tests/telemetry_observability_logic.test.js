"use strict";

const assert = require("node:assert/strict");
const { importFrontendTestModule } = require("./frontend_test_module");

class FakeElement {
  constructor({ tagName = "DIV", token = "", matches = [] } = {}) {
    this.tagName = tagName;
    this.token = token;
    this.matches = new Set(matches);
    this.parentElement = null;
    this.dataset = {};
  }
  closest(selector) {
    if (selector === "[data-telemetry-component]" && this.token) return this;
    return this.matches.has(selector) ? this : null;
  }
  getAttribute(name) {
    return name === "data-telemetry-component" ? this.token : null;
  }
}

global.Element = FakeElement;
global.Node = FakeElement;
global.window = {
  __BARGIG_RELEASE_ID__: "deploy-0123456789abcdef",
  innerWidth: 390,
  innerHeight: 844,
  location: {
    href: "https://bargig-furniture.com/viewer.html?catalog=kids&page=7",
    pathname: "/viewer.html",
    hostname: "bargig-furniture.com",
    origin: "https://bargig-furniture.com"
  }
};
global.document = {
  querySelector: () => null,
  body: { dataset: { page: "viewer" } },
  visibilityState: "visible"
};
Object.defineProperty(globalThis, "navigator", { value: {}, writable: true, configurable: true });
Object.assign(globalThis, {
  currentAppPage: "viewer",
  activeCatalog: () => ({ id: "active-catalog" }),
  activePage: () => 3,
  CATALOG_IMAGE_RETRY_PARAM: "bargig_retry",
  LIGHTBOX_SOURCE_CATALOG: "catalog",
  eventTargetElement: (value) => value
});

const api = importFrontendTestModule("src/js/15-telemetry.js", "telemetry");

const explicit = new FakeElement({ token: "Hero Banner 01" });
assert.equal(api.telemetryComponentToken(explicit), "hero-banner-01");

const viewerStage = new FakeElement({ matches: ["#lightboxImageFrame, #lightboxStage, #lightbox"] });
assert.equal(api.telemetryComponentToken(viewerStage), "viewer-stage");

const small = new FakeElement({ token: "small-card" });
const large = new FakeElement({ token: "large-card" });
assert.equal(api.telemetryDominantLayoutShiftComponent({
  sources: [
    { node: small, previousRect: { width: 10, height: 10, x: 0, y: 0 }, currentRect: { width: 20, height: 10, x: 0, y: 0 } },
    { node: large, previousRect: { width: 200, height: 100, x: 0, y: 0 }, currentRect: { width: 220, height: 100, x: 0, y: 0 } }
  ]
}), "large-card");

const visibleImage = {
  dataset: { catalogId: "kids", page: "7", telemetrySurface: "viewer-stage", telemetryRequestedTier: "medium" },
  isConnected: true,
  getBoundingClientRect: () => ({ width: 300, height: 400, top: 20, left: 10, right: 310, bottom: 420 }),
  getAttribute: () => "https://cdn.bargig-furniture.com/assets/pages/kids/page-007.webp"
};
assert.equal(api.telemetryImageVisibility(visibleImage, "viewer-stage"), "visible");
assert.equal(api.telemetryImageVisibility(visibleImage, "viewer-neighbor-preload"), "preload");

const context = api.telemetryCreateImageRequestContext(
  visibleImage,
  "https://cdn.bargig-furniture.com/assets/pages/kids/page-007.webp",
  { requestId: "ir-fixed1234", detail: "viewer-single", surface: "viewer-stage" }
);
assert.equal(Object.isFrozen(context), true);
assert.deepEqual(context, {
  requestId: "ir-fixed1234",
  catalogId: "kids",
  pageNumber: 7,
  detail: "viewer-single",
  surface: "viewer-stage",
  visibility: "visible",
  requestedTier: "medium",
  networkState: "unknown",
  page: "viewer",
  path: "/viewer.html",
  viewport: "xs",
  releaseId: "deploy-0123456789abcdef"
});

console.log("telemetry_observability_logic.test.js: PASS");
