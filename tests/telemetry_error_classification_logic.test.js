"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../src/js/15-telemetry.js"), "utf8");
const start = source.indexOf("function telemetryIsRuntimeErrorEvent(event)");
const end = source.indexOf("function telemetryTrackRuntimeError(event)", start);
assert.notEqual(start, -1, "Missing telemetryIsRuntimeErrorEvent");
assert.notEqual(end, -1, "Missing telemetryTrackRuntimeError boundary");
const classificationSource = source.slice(start, end);

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName;
  }
}
class FakeHTMLImageElement extends FakeElement {}
class FakeErrorEvent {
  constructor(message) {
    this.message = message;
    this.target = {};
  }
  get [Symbol.toStringTag]() {
    return "ErrorEvent";
  }
}

const { classify, isRuntime } = new Function(
  "ErrorEvent",
  "Element",
  "HTMLImageElement",
  `${classificationSource}; return {
    classify: telemetryClassifyWindowError,
    isRuntime: telemetryIsRuntimeErrorEvent
  };`
)(FakeErrorEvent, FakeElement, FakeHTMLImageElement);

const scriptError = { type: "error", target: new FakeElement("SCRIPT") };
const linkError = { type: "error", target: new FakeElement("LINK") };
const imageError = { type: "error", target: new FakeHTMLImageElement("IMG") };
const runtimeError = new FakeErrorEvent("boom");

assert.equal(classify(scriptError), "resource");
assert.equal(classify(linkError), "resource");
assert.equal(classify(imageError), "image");
assert.equal(classify(runtimeError), "runtime");
assert.equal(classify({ type: "error", target: {} }), "ignored");
assert.equal(isRuntime(scriptError), false);
assert.equal(isRuntime(linkError), false);
assert.equal(isRuntime(runtimeError), true);

console.log("telemetry_error_classification_logic.test.js: PASS");
