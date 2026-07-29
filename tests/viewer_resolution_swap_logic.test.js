"use strict";

const assert = require("node:assert/strict");
const { importFrontendTestModule } = require("./frontend_test_module");

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
    values
  };
}

function createFixture(overrides = {}) {
  let stopCalls = 0;
  const classList = createClassList(["is-resolution-loading", "is-resolution-upgrade-ready"]);
  const image = {
    isConnected: true,
    naturalWidth: 2800,
    dataset: {
      logicalSrc: "full-page-1.webp",
      loadedTier: "full",
      loadedQuality: "full",
      imageLoadPending: "true"
    },
    src: "full-page-1.webp",
    removeAttribute(name) { if (name === "src") this.src = ""; }
  };
  const state = {
    singleImageResolutionImage: image,
    singleImageResolutionRetainedForSwap: false,
    singleImageResolutionVisible: true,
    singleImageResolutionReady: true,
    singleImageResolutionLoadToken: 7,
    singleImageResolutionStop: () => { stopCalls += 1; },
    singleImageResolutionTargetSrc: "full-page-1.webp",
    singleImageResolutionTargetTier: "full",
    singleImageResolutionCommitPending: true,
    ...overrides
  };
  Object.assign(globalThis, { viewerState: state, viewerElements: { lightboxImageFrame: { classList } } });
  const api = importFrontendTestModule("src/js/53-viewer-image.js", "viewer-image");
  return { api, state, image, classList, getStopCalls: () => stopCalls };
}

{
  const fixture = createFixture();
  assert.equal(fixture.api.retainSingleViewerResolutionLayerForSwap(), true);
  assert.equal(fixture.getStopCalls(), 1);
  assert.equal(fixture.state.singleImageResolutionLoadToken, 8);
  assert.equal(fixture.state.singleImageResolutionRetainedForSwap, true);
  assert.equal(fixture.state.singleImageResolutionVisible, false);
  assert.equal(fixture.state.singleImageResolutionReady, false);
  assert.equal(fixture.state.singleImageResolutionTargetSrc, "");
  assert.equal(fixture.state.singleImageResolutionTargetTier, "");
  assert.equal(fixture.image.src, "full-page-1.webp");
  assert.equal(fixture.image.dataset.resolutionRetainedForSwap, "true");
  assert.equal(fixture.classList.contains("is-resolution-loading"), false);
  assert.equal(fixture.classList.contains("is-resolution-upgrade-ready"), true);
  assert.equal(fixture.api.releaseSingleViewerRetainedResolutionLayer(), true);
  assert.equal(fixture.state.singleImageResolutionRetainedForSwap, false);
  assert.equal(fixture.image.src, "");
  assert.equal("resolutionRetainedForSwap" in fixture.image.dataset, false);
  assert.equal("logicalSrc" in fixture.image.dataset, false);
  assert.equal(fixture.classList.contains("is-resolution-upgrade-ready"), false);
  assert.equal(fixture.api.releaseSingleViewerRetainedResolutionLayer(), false);
}

{
  const fixture = createFixture({ singleImageResolutionVisible: false });
  assert.equal(fixture.api.retainSingleViewerResolutionLayerForSwap(), false);
  assert.equal(fixture.getStopCalls(), 0);
  assert.equal(fixture.image.src, "full-page-1.webp");
}

console.log("viewer_resolution_swap_logic.test.js: PASS");
