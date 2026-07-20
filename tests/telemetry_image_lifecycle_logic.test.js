"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "../src/js/20-shared-ui.js"), "utf8");
const start = app.indexOf("function loadCatalogImageWithRecovery(img, options = {})");
const end = app.indexOf("function prepareCatalogImage(url, options = {})", start);
assert.notEqual(start, -1, "Missing loadCatalogImageWithRecovery");
assert.notEqual(end, -1, "Missing loadCatalogImageWithRecovery boundary");
const functionSource = app.slice(start, end);

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

  getAttribute(name) {
    return name === "src" ? this.srcValue : null;
  }
}

function createLoader(log) {
  return new Function(
    "catalogImageRecoveryCandidates",
    "telemetryCleanText",
    "prepareImagePlaceholder",
    "syncImagePlaceholderState",
    "telemetryTrackImageAttemptFailure",
    "telemetryTrackImageRecovery",
    "telemetryTrackImageTerminalFailure",
    "setCatalogImageSource",
    `${functionSource}; return loadCatalogImageWithRecovery;`
  )(
    () => [
      { src: "primary.webp", role: "primary", fallback: false },
      { src: "retry.webp", role: "retry", fallback: false },
      { src: "thumb.webp", role: "fallback", fallback: true }
    ],
    (value, limit) => String(value || "").slice(0, limit),
    () => {},
    () => {},
    (src, options) => log.push(["attempt", src, options]),
    (src, options) => log.push(["recovered", src, options]),
    (src, options) => log.push(["terminal", src, options]),
    (img, src) => {
      img.srcValue = src;
      const loaded = Boolean(img.outcomes.shift());
      img.naturalWidth = loaded ? 640 : 0;
      img.emit(loaded ? "load" : "error");
    }
  );
}

{
  const log = [];
  const image = new FakeImage([false, true]);
  let success = null;
  createLoader(log)(image, {
    primarySrc: "primary.webp",
    telemetryDetail: "viewer-single",
    onSuccess(candidate, state) {
      success = { candidate, state };
    }
  });

  assert.deepEqual(log.map((entry) => entry[0]), ["attempt", "recovered"]);
  assert.equal(log[0][2].detail, "viewer-single-primary");
  assert.equal(log[0][2].attempt, 1);
  assert.equal(log[1][1], "retry.webp");
  assert.equal(log[1][2].action, "retry");
  assert.equal(log[1][2].failedAttempts, 1);
  assert.equal(success.candidate.role, "retry");
  assert.equal(success.state.failedAttempts, 1);
}

{
  const log = [];
  const image = new FakeImage([false, false, false]);
  let exhausted = null;
  createLoader(log)(image, {
    primarySrc: "primary.webp",
    telemetryDetail: "viewer-scroll",
    onExhausted(state) {
      exhausted = state;
    }
  });

  assert.deepEqual(log.map((entry) => entry[0]), ["attempt", "attempt", "attempt", "terminal"]);
  assert.deepEqual(log.slice(0, 3).map((entry) => entry[2].action), ["primary", "retry", "fallback"]);
  assert.equal(log[3][1], "thumb.webp");
  assert.equal(log[3][2].failedAttempts, 3);
  assert.equal(exhausted.failedAttempts, 3);
  assert.equal(exhausted.lastCandidate.role, "fallback");
}

console.log("telemetry_image_lifecycle_logic.test.js: PASS");
