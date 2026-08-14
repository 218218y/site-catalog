"use strict";

const assert = require("node:assert/strict");
const { importFrontendModule } = require("./frontend_test_module");

Object.defineProperty(globalThis, "navigator", { value: {}, writable: true, configurable: true });

Object.assign(globalThis, {
  window: {
    location: { href: "https://example.test/catalog.html" },
  },
  requiredElement: () => ({}),
  catalogs: [
    { id: "canonical", category: "Category", subcategory: "Canonical" },
    { id: "direct", category: "Category", subCategory: "Ignored alias" },
    { id: "conflict", category: "Category", subcategory: "Canonical", subCategory: "Ignored alias" },
  ],
});

const shared = importFrontendModule("src/js/20-shared-ui.js");
const groups = shared.getCatalogCategoryGroups();

assert.equal(groups.length, 1);
assert.deepEqual(groups[0].directItems.map((catalog) => catalog.id), ["direct"]);
assert.deepEqual(groups[0].subcategories.map((group) => group.subcategory), ["Canonical"]);
assert.deepEqual(groups[0].subcategories[0].items.map((catalog) => catalog.id), ["canonical", "conflict"]);

console.log("catalog_canonical_fields_logic.test.js: PASS");
