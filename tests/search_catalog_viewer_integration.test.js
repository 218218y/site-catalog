"use strict";

const assert = require("node:assert/strict");
const { importFrontendModule } = require("./frontend_test_module");

const pageNumbering = importFrontendModule("src/js/06-catalog-page-numbering.js");
Object.assign(globalThis, pageNumbering);

const { searchCatalogDomain: domain } = importFrontendModule("src/js/39-search-catalog-domain.js");
const registry = importFrontendModule("src/js/10-app-state.js");
assert.throws(
  () => registry.requireFeatureInterface("catalog-grid"),
  /Required feature interface is unavailable: catalog-grid/,
  "required Feature seams must fail before Search can report a successful no-op"
);
const catalogGridFeature = { activateCategoryTarget: () => true };
registry.registerFeatureInterface("catalog-grid", catalogGridFeature);
assert.equal(registry.requireFeatureInterface("catalog-grid").activateCategoryTarget("category-beds"), true);
assert.equal(registry.getFeatureInterface("catalog-grid").name, "catalog-grid");

const calls = [];
const globalPorts = {
  activateCategoryTarget(targetId) { calls.push(["category", targetId]); return true; },
  openCatalog(catalogId) { calls.push(["catalog", catalogId]); },
  openViewer(catalogId, page) { calls.push(["viewer", catalogId, page]); }
};

assert.equal(domain.executeGlobalSearchResultAction({ targetId: "category-beds" }, globalPorts), true);
assert.equal(domain.executeGlobalSearchResultAction({ resultType: "catalog", catalogId: "comfort" }, globalPorts), true);
assert.equal(domain.executeGlobalSearchResultAction({ catalogId: "comfort", page: 7 }, globalPorts), true);
assert.deepEqual(calls, [
  ["category", "category-beds"],
  ["catalog", "comfort"],
  ["viewer", "comfort", 7]
]);

assert.throws(
  () => domain.executeGlobalSearchResultAction({ targetId: "category-beds" }, {}),
  TypeError,
  "a Search/Catalog Grid contract mismatch must fail at the integration seam"
);
assert.throws(
  () => domain.executeGlobalSearchResultAction({ resultType: "catalog", catalogId: "comfort" }, {}),
  TypeError
);
assert.throws(
  () => domain.executeGlobalSearchResultAction({ catalogId: "comfort", page: 2 }, {}),
  TypeError
);

const lightboxCalls = [];
const viewerPorts = {
  openCatalog(catalogId, page) { lightboxCalls.push(["open", catalogId, page]); },
  setPage(page) { lightboxCalls.push(["page", page]); },
  showTopUi() { lightboxCalls.push(["ui"]); }
};
const activeCatalog = { id: "comfort", pages: 5 };
assert.equal(
  domain.executeLightboxSearchResultAction({ catalogId: "comfort", page: 99 }, activeCatalog, viewerPorts),
  true
);
assert.deepEqual(lightboxCalls, [["page", 5], ["ui"]], "same-catalog search stays in the Viewer and clamps the page");

assert.equal(
  domain.executeLightboxSearchResultAction({ catalogId: "other", page: 3 }, activeCatalog, viewerPorts),
  true
);
assert.deepEqual(lightboxCalls[2], ["open", "other", 3], "cross-catalog search delegates to the Viewer navigation port");

assert.throws(
  () => domain.executeLightboxSearchResultAction({ catalogId: "comfort", page: 2 }, activeCatalog, { openCatalog() {} }),
  TypeError,
  "Viewer integration cannot silently omit setPage/showTopUi"
);
assert.throws(
  () => domain.executeLightboxSearchResultAction({ catalogId: "other", page: 2 }, activeCatalog, {}),
  TypeError
);
assert.equal(domain.executeLightboxSearchResultAction(null, activeCatalog, viewerPorts), false);

console.log("search_catalog_viewer_integration.test.js: PASS");
