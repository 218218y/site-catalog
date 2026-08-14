"use strict";

const assert = require("node:assert/strict");
const { importFrontendModule } = require("./frontend_test_module");

class ControlledImage {
  static instances = [];

  constructor() {
    this.dataset = {};
    this.listeners = new Map();
    this.naturalWidth = 1200;
    this.naturalHeight = 800;
    this.srcValue = "";
    this.removedSource = false;
    ControlledImage.instances.push(this);
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(type, listeners.filter((candidate) => candidate !== listener));
  }

  emit(type) {
    const listeners = [...(this.listeners.get(type) || [])];
    for (const listener of listeners) listener();
  }

  decode() { return Promise.resolve(); }
  set src(value) { this.srcValue = String(value); }
  get src() { return this.srcValue; }
  removeAttribute(name) {
    if (name === "src") {
      this.srcValue = "";
      this.removedSource = true;
    }
  }
}

async function testPreparationLifecycle() {
  const telemetry = [];
  const imageLoadCache = new Map();
  Object.defineProperty(globalThis, "navigator", { value: {}, writable: true, configurable: true });
  Object.assign(globalThis, {
    Image: ControlledImage,
    window: {
      location: { href: "https://example.test/viewer.html" }
    },
    requiredElement: () => ({}),
    catalogAssetState: { imageLoadCache },
    CATALOG_IMAGE_PRELOAD_CACHE_LIMIT: 12,
    CATALOG_IMAGE_RETRY_PARAM: "bargig_retry",
    CATALOG_ASSET_VERSION_PARAM: "v",
    telemetryCreateImageRequestContext: (_img, _src, options = {}) => Object.freeze({
      requestId: "ir-rapidnav1234",
      detail: String(options.detail || "image"),
      surface: String(options.surface || "image"),
      visibility: String(options.visibility || "visible")
    }),
    telemetryTrackImageAttemptFailure: (src, options) => telemetry.push(["attempt", src, options]),
    telemetryTrackImageTerminalFailure: (src, options) => telemetry.push(["terminal", src, options]),
    telemetryTrackImageRecovery() {},
  });

  const shared = importFrontendModule("src/js/20-catalog-runtime.js");
  const requestContext = Object.freeze({
    requestId: "ir-stage-shared1",
    detail: "viewer-single",
    surface: "viewer-stage",
    visibility: "visible"
  });

  const staged = shared.prepareCatalogImage("https://cdn.example.test/page-002.webp", {
    cache: false,
    detail: "viewer-single-stage",
    failureAction: "stage",
    terminalOnFailure: false,
    telemetryRequestContext: requestContext
  });
  ControlledImage.instances.at(-1).emit("error");
  await assert.rejects(staged, /image-load-failed/);
  assert.deepEqual(telemetry.map(([kind]) => kind), ["attempt"],
    "a failed staging probe is an intermediate attempt, never a terminal Viewer failure");
  assert.equal(telemetry[0][2].action, "stage");
  assert.equal(telemetry[0][2].requestContext, requestContext,
    "the staging attempt remains correlated with the authoritative visible-image lifecycle");

  const controller = new AbortController();
  const aborted = shared.prepareCatalogImage("https://cdn.example.test/page-003.webp", {
    cache: false,
    signal: controller.signal,
    isCurrent: () => true,
    detail: "viewer-single-stage",
    terminalOnFailure: false,
    telemetryRequestContext: requestContext
  });
  const abortedImage = ControlledImage.instances.at(-1);
  controller.abort();
  await assert.rejects(aborted, (error) => error?.name === "AbortError");
  abortedImage.emit("error");
  assert.equal(telemetry.length, 1, "superseded navigation work must not emit image-failure telemetry");
  assert.equal(abortedImage.removedSource, true, "aborting a stale stage releases its detached image request");

  let current = false;
  const stale = shared.prepareCatalogImage("https://cdn.example.test/page-004.webp", {
    cache: false,
    isCurrent: () => current,
    detail: "viewer-single-stage",
    terminalOnFailure: false,
    telemetryRequestContext: requestContext
  });
  ControlledImage.instances.at(-1).emit("error");
  await assert.rejects(stale, (error) => error?.name === "AbortError");
  assert.equal(telemetry.length, 1, "a request made stale by fast navigation is cancellation, not failure");
}

function testNeighborPreloadCoalescing() {
  const scheduled = new Map();
  const cleared = [];
  const preloads = [];
  let nextTimer = 1;
  let page = 1;
  const catalog = { id: "rapid-navigation", title: "Rapid", pages: 8 };
  const imageState = {
    singleImageStageAbortController: null,
    neighborPreloadTimer: 0,
    singleImageResolutionVisible: false,
    singleImageResolutionReady: false,
    singleImageResolutionRetainedForSwap: false,
    singleImageResolutionTargetSrc: ""
  };

  Object.assign(globalThis, {
    CATALOG_IMAGE_TIER_FULL: "full",
    CATALOG_IMAGE_TIER_MEDIUM: "medium",
    CATALOG_IMAGE_TIER_THUMB: "thumb",
    VIEWER_NEIGHBOR_PRELOAD_SETTLE_MS: 180,
    viewerImageState: imageState,
    viewerViewportState: { zoom: 1, imageFitMode: "height" },
    viewerElements: {},
    window: {
      innerWidth: 1200,
      innerHeight: 800,
      setTimeout(callback, delay) {
        const id = nextTimer++;
        scheduled.set(id, { callback, delay });
        return id;
      },
      clearTimeout(id) {
        cleared.push(id);
        scheduled.delete(id);
      }
    },
    activeCatalog: () => catalog,
    activePage: () => page,
    isViewerSessionOpen: () => true,
    isFavoritesLightboxMode: () => false,
    getFeatureInterface: () => null,
    catalogSupportsImageTier: () => false,
    catalogNeighborPreloadRadius: () => 2,
    catalogFirstPage: () => 1,
    catalogLastPage: (item) => item.pages,
    pageSrc: (_item, targetPage) => `page-${targetPage}.webp`,
    prepareCatalogImage: (src, options) => {
      preloads.push({ src, options });
      return Promise.resolve({ width: 1, height: 1 });
    },
    isSaveDataEnabled: () => false,
  });

  const viewerImage = importFrontendModule("src/js/53-viewer-image.js");

  viewerImage.preloadNeighbors();
  const firstTimer = imageState.neighborPreloadTimer;
  assert.equal(scheduled.get(firstTimer).delay, 180);

  page = 2;
  viewerImage.preloadNeighbors();
  const finalTimer = imageState.neighborPreloadTimer;
  assert.notEqual(finalTimer, firstTimer);
  assert.equal(scheduled.has(firstTimer), false, "a newer page invalidates the previous neighbor-preload batch");
  assert.ok(cleared.includes(firstTimer));

  scheduled.get(finalTimer).callback();
  assert.deepEqual(preloads.map(({ src }) => src), ["page-1.webp", "page-3.webp"],
    "only neighbors of the final settled page are requested after a rapid navigation burst");

  let abortCount = 0;
  imageState.singleImageStageAbortController = { abort() { abortCount += 1; } };
  assert.equal(viewerImage.cancelSingleViewerStagePreparation(), true);
  assert.equal(abortCount, 1);
  assert.equal(imageState.singleImageStageAbortController, null);
}

(async () => {
  await testPreparationLifecycle();
  testNeighborPreloadCoalescing();
  console.log("viewer_rapid_navigation_image_loading_logic.test.js: PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
