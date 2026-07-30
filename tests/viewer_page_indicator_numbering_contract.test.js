"use strict";

const assert = require("node:assert/strict");
const { importFrontendTestModule } = require("./frontend_test_module");

Object.assign(globalThis, {
  catalogLastPage: (catalog) => (catalog.pageNumberStart === 0 ? catalog.pages - 1 : catalog.pages),
  catalogPageOrdinal: (catalog, page) => page - (catalog.pageNumberStart === 0 ? 0 : 1) + 1
});
const controller = importFrontendTestModule("src/js/59-viewer-page-controller.js", "viewer-page-controller");

const catalog = { pages: 10, pageNumberStart: 0 };
assert.deepEqual(controller.catalogPageProgress(catalog, 0), {
  current: 1,
  total: 10,
  title: "עמוד 0 מתוך 9",
  options: { label: "עמוד", displayCurrent: 0, displayTotal: 9 }
});
assert.deepEqual(controller.catalogPageProgress(catalog, 9), {
  current: 10,
  total: 10,
  title: "עמוד 9 מתוך 9",
  options: { label: "עמוד", displayCurrent: 9, displayTotal: 9 }
});

function fakeElement() {
  const attributes = new Map();
  return {
    textContent: "",
    style: { values: new Map(), setProperty(name, value) { this.values.set(name, String(value)); } },
    classList: { values: new Set(), add(name) { this.values.add(name); }, remove(name) { this.values.delete(name); }, toggle(name, enabled) { if (enabled) this.values.add(name); else this.values.delete(name); } },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; }
  };
}

const viewerElements = {
  lightboxProgress: fakeElement(),
  viewerPageIndicator: fakeElement(),
  viewerPageIndicatorLabel: fakeElement(),
  viewerPageIndicatorCurrent: fakeElement(),
  viewerPageIndicatorTotal: fakeElement(),
  viewerPageIndicatorDetail: fakeElement()
};
Object.assign(globalThis, {
  viewerElements,
  viewerState: { pageIndicatorHideTimer: 0 },
  VIEWER_PAGE_INDICATOR_HIDE_MS: 1000,
  clampValue: (value, min, max) => Math.min(max, Math.max(min, value)),
  isViewerSessionOpen: () => true,
  window: { clearTimeout() {}, setTimeout() { return 1; } }
});
const shell = importFrontendTestModule("src/js/56-viewer-shell.js", "viewer-shell");
const progress = controller.catalogPageProgress(catalog, 0);
shell.syncLightboxProgress(progress.current, progress.total, progress.title, progress.options);

assert.equal(viewerElements.lightboxProgress.getAttribute("aria-valuenow"), "1");
assert.equal(viewerElements.lightboxProgress.getAttribute("aria-valuemax"), "10");
assert.equal(viewerElements.lightboxProgress.getAttribute("aria-valuetext"), "עמוד 0 מתוך 9");
assert.equal(viewerElements.viewerPageIndicatorCurrent.textContent, "0");
assert.equal(viewerElements.viewerPageIndicatorTotal.textContent, "9");
assert.equal(viewerElements.viewerPageIndicatorLabel.textContent, "עמוד");

console.log("viewer_page_indicator_numbering_contract.test.js: PASS");
