"use strict";

const assert = require("node:assert/strict");
const { importFrontendModule } = require("./frontend_test_module");

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
  });
}

function createClipboardFallbackDocument(execCommandResult) {
  const state = {
    appended: 0,
    removed: 0,
    selected: 0,
    selectionRange: null,
    commands: [],
  };
  const textarea = {
    value: "",
    style: {},
    setAttribute() {},
    select() { state.selected += 1; },
    setSelectionRange(start, end) { state.selectionRange = [start, end]; },
    remove() { state.removed += 1; },
  };
  return {
    state,
    document: {
      body: {
        appendChild(node) {
          assert.equal(node, textarea);
          state.appended += 1;
        },
      },
      createElement(tagName) {
        assert.equal(tagName, "textarea");
        return textarea;
      },
      execCommand(command) {
        state.commands.push(command);
        if (execCommandResult instanceof Error) throw execCommandResult;
        return execCommandResult;
      },
    },
  };
}

async function run() {
  setGlobal("navigator", {});
  setGlobal("window", { isSecureContext: false });
  setGlobal("document", {});
  const {
    copyTextToClipboard,
    tryNativeShare,
  } = importFrontendModule("src/js/22-browser-sharing.js");

  let standardsCopy = "";
  setGlobal("navigator", {
    clipboard: {
      async writeText(value) { standardsCopy = value; },
    },
  });
  setGlobal("window", { isSecureContext: true });
  setGlobal("document", {
    execCommand() { assert.fail("legacy clipboard fallback must not run when Clipboard API succeeds"); },
  });
  await copyTextToClipboard("modern copy");
  assert.equal(standardsCopy, "modern copy");

  const successfulFallback = createClipboardFallbackDocument(true);
  setGlobal("navigator", {});
  setGlobal("window", { isSecureContext: false });
  setGlobal("document", successfulFallback.document);
  await copyTextToClipboard("legacy copy");
  assert.deepEqual(successfulFallback.state.commands, ["copy"]);
  assert.equal(successfulFallback.state.appended, 1);
  assert.equal(successfulFallback.state.removed, 1);
  assert.equal(successfulFallback.state.selected, 1);
  assert.deepEqual(successfulFallback.state.selectionRange, [0, "legacy copy".length]);

  const rejectedFallback = createClipboardFallbackDocument(false);
  setGlobal("document", rejectedFallback.document);
  await assert.rejects(copyTextToClipboard("must fail"), /Clipboard copy command failed/);
  assert.equal(rejectedFallback.state.removed, 1, "failed legacy copy must always clean up its textarea");

  const throwingFallback = createClipboardFallbackDocument(new Error("exec failed"));
  setGlobal("document", throwingFallback.document);
  await assert.rejects(copyTextToClipboard("must throw"), /exec failed/);
  assert.equal(throwingFallback.state.removed, 1, "throwing legacy copy must always clean up its textarea");

  setGlobal("navigator", {});
  assert.equal(await tryNativeShare({ text: "hello" }), "fallback");

  let sharedData = null;
  setGlobal("navigator", {
    userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
    platform: "Linux x86_64",
    maxTouchPoints: 0,
    canShare: () => true,
    async share(data) { sharedData = data; },
  });
  assert.equal(await tryNativeShare({ text: "desktop" }, { mobileOnly: true }), "fallback");
  assert.equal(sharedData, null);
  assert.equal(await tryNativeShare({ text: "desktop" }), "shared");
  assert.deepEqual(sharedData, { text: "desktop" });

  setGlobal("navigator", {
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile",
    platform: "iPhone",
    maxTouchPoints: 5,
    canShare: () => false,
    async share() { assert.fail("share must not run when canShare rejects the payload"); },
  });
  assert.equal(await tryNativeShare({ url: "https://example.test" }, { mobileOnly: true }), "fallback");

  setGlobal("navigator", {
    userAgent: "Mobile",
    platform: "",
    maxTouchPoints: 1,
    async share() {
      throw new DOMException("cancelled", "AbortError");
    },
  });
  assert.equal(await tryNativeShare({ text: "cancel" }, { mobileOnly: true }), "cancelled");

  setGlobal("navigator", {
    userAgent: "Mobile",
    platform: "",
    maxTouchPoints: 1,
    async share() { throw new Error("share failed"); },
  });
  assert.equal(await tryNativeShare({ text: "failure" }, { mobileOnly: true }), "fallback");

  console.log("browser_sharing.test.js: PASS");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
