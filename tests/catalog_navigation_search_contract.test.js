"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { findCalls, hasPropertyPath, inventoryProjectFiles } = require("./helpers/frontend_ast.js");

const root = path.resolve(__dirname, "..");
const styles = fs.readFileSync(path.join(root, "src/css/10-catalog.css"), "utf8");
const frontendBuilder = fs.readFileSync(path.join(root, "tools/build_frontend_assets.py"), "utf8");
const ast = inventoryProjectFiles(root, [
  "src/runtime/catalog-search.js",
  "src/js/47-search-preview.js",
  "src/js/48-global-search-ui.js",
  "src/js/40-catalog-grid.js",
]);
const searchRuntime = ast["src/runtime/catalog-search.js"];
const searchPreview = ast["src/js/47-search-preview.js"];
const globalSearch = ast["src/js/48-global-search-ui.js"];
const catalogGrid = ast["src/js/40-catalog-grid.js"];
const functions = (inventory) => new Set(inventory.functionDeclarations);
const identifiers = (inventory) => new Set(inventory.identifiers);
const literalText = (inventory) => inventory.stringLiterals.join("\n");

for (const name of ["searchNavigation", "mergeNavigationResults", "navigationResultMarkup", "mediumSrc"]) {
  assert.equal(functions(searchRuntime).has(name), true, `catalog search runtime must own ${name}`);
}
for (const name of ["seenCategories", "seenSubcategories", "seenCatalogs", "compactInlineInitialisms"]) {
  assert.equal(identifiers(searchRuntime).has(name), true, `catalog search runtime must retain ${name}`);
}
assert.equal(hasPropertyPath(searchRuntime, "result.matchField"), true);
for (const marker of [
  "search-navigation-catalog-result-card",
  "data-search-preview-src=",
  'data-catalog-image-recovery="lightweight"',
]) {
  assert.equal(literalText(searchRuntime).includes(marker), true, `navigation markup must contain ${marker}`);
}
for (const forbidden of ["פרדי", "קואליטה", "חדרי שינה ת.ב.י"]) {
  assert.equal(literalText(searchRuntime).includes(forbidden), false, `navigation runtime must not hard-code ${forbidden}`);
}

for (const callee of [
  "catalogSearch.searchNavigation",
  "getGlobalOcrSearchResults",
  "catalogSearch.mergeNavigationResults",
  "searchCatalogDomain.executeGlobalSearchResultAction",
  "catalogSearch.navigationResultMarkup",
]) {
  assert.equal(findCalls(globalSearch, callee).length > 0, true, `Search UI must call ${callee}`);
}
assert.equal(findCalls(globalSearch, "requireFeatureInterface").some((call) => call.arguments[0] === "catalog-grid"), true);
assert.equal(findCalls(globalSearch, "navigateTo").length > 0, true);
assert.equal(findCalls(globalSearch, "catalogDocumentUrl").length > 0, true);
assert.equal(hasPropertyPath(globalSearch, "catalogGrid.activateCategoryTarget"), true);
assert.equal(findCalls(searchPreview, "preview.getBoundingClientRect").length > 0, true);
assert.equal(findCalls(searchPreview, "previewImage.removeAttribute").some((call) => call.arguments[0] === "width"), true);
assert.equal(findCalls(searchPreview, "previewImage.removeAttribute").some((call) => call.arguments[0] === "height"), true);
assert.equal(hasPropertyPath(searchPreview, "preview.offsetWidth"), false);
assert.equal(hasPropertyPath(searchPreview, "preview.offsetHeight"), false);

assert.equal(functions(catalogGrid).has("activateCatalogCategoryTarget"), true);
assert.equal(identifiers(catalogGrid).has("activateCategoryTarget"), true);

assert.match(styles, /\.search-navigation-result-card/);
assert.match(styles, /\.search-navigation-catalog-result-button/);
assert.match(
  styles,
  /\.search-panel\.global-search-popover \.search-result-card \{[^}]*display:\s*flex;/,
  "a grid-stretched result card must own a full-height flex child"
);
assert.match(
  styles,
  /\.search-panel\.global-search-popover \.search-result-button \{[^}]*flex:\s*1 1 auto;/,
  "the category or subcategory button must fill the whole visible card"
);
assert.match(styles, /\.search-floating-preview \{[^}]*width:\s*fit-content;/);
assert.match(styles, /\.search-floating-preview img \{[^}]*width:\s*auto;[^}]*height:\s*auto;/);
assert.match(styles, /max-width:\s*min\(430px, calc\(100vw - 46px\)\);/);
assert.match(styles, /max-height:\s*min\(72vh, 620px, calc\(100vh - 46px\)\);/);
assert.equal(frontendBuilder.includes("45-navigation-search.js"), false);
assert.equal(fs.existsSync(path.join(root, "src/js/45-navigation-search.js")), false);

console.log("catalog_navigation_search_contract.test.js: PASS");
