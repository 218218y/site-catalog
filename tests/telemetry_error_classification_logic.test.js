"use strict";

const assert = require("node:assert/strict");
const { importFrontendModule } = require("./frontend_test_module");

class FakeElement {
  constructor(tagName) { this.tagName = tagName; }
}
class FakeHTMLImageElement extends FakeElement {}
class FakeErrorEvent {
  constructor(message) {
    this.message = message;
    this.target = {};
  }
  get [Symbol.toStringTag]() { return "ErrorEvent"; }
}

global.window = { location: { href: "https://example.test/", origin: "https://example.test" } };
global.document = { querySelector: () => null };
Object.defineProperty(globalThis, "navigator", { value: {}, writable: true, configurable: true });
global.ErrorEvent = FakeErrorEvent;
global.Element = FakeElement;
global.HTMLImageElement = FakeHTMLImageElement;

const { telemetryClassifyWindowError: classify, telemetryIsRuntimeErrorEvent: isRuntime } =
  importFrontendModule("src/js/15-telemetry.js");

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
