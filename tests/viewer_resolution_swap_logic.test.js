"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "src/js/20-shared-ui.js"), "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing ${startMarker}`);
  assert.notEqual(end, -1, `Missing ${endMarker}`);
  return source.slice(start, end);
}

const retentionSource = sourceBetween(
  "function retainSingleViewerResolutionLayerForSwap()",
  "function activeSingleViewerImageLogicalSrc()"
);

function createClassList(initial = []) {
  const values = new Set(initial);
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name),
    values
  };
}

function createApi(overrides = {}) {
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
    removeAttribute(name) {
      if (name === "src") this.src = "";
    }
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
  const els = { lightboxImageFrame: { classList } };
  const api = new Function(
    "state",
    "els",
    `${retentionSource}; return { retainSingleViewerResolutionLayerForSwap, releaseSingleViewerRetainedResolutionLayer };`
  )(state, els);
  return { api, state, image, classList, getStopCalls: () => stopCalls };
}

{
  const fixture = createApi();
  assert.equal(fixture.api.retainSingleViewerResolutionLayerForSwap(), true);
  assert.equal(fixture.getStopCalls(), 1);
  assert.equal(fixture.state.singleImageResolutionLoadToken, 8);
  assert.equal(fixture.state.singleImageResolutionRetainedForSwap, true);
  assert.equal(fixture.state.singleImageResolutionVisible, false);
  assert.equal(fixture.state.singleImageResolutionReady, false);
  assert.equal(fixture.state.singleImageResolutionTargetSrc, "");
  assert.equal(fixture.state.singleImageResolutionTargetTier, "");
  assert.equal(fixture.image.src, "full-page-1.webp", "decoded front buffer stays painted during the swap");
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
  const fixture = createApi({ singleImageResolutionVisible: false });
  assert.equal(fixture.api.retainSingleViewerResolutionLayerForSwap(), false);
  assert.equal(fixture.getStopCalls(), 0);
  assert.equal(fixture.image.src, "full-page-1.webp");
}

console.log("viewer_resolution_swap_logic.test.js: PASS");
