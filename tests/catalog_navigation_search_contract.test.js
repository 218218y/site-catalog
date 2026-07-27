"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const searchRuntime = fs.readFileSync(path.join(root, "catalog-search.js"), "utf8");
const searchUi = fs.readFileSync(path.join(root, "src/js/50-search-ui.js"), "utf8");
const catalogGrid = fs.readFileSync(path.join(root, "src/js/40-catalog-grid.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src/css/10-catalog.css"), "utf8");
const frontendBuilder = fs.readFileSync(path.join(root, "tools/build_frontend_assets.py"), "utf8");

assert.match(searchRuntime, /function searchNavigation\(groups, query, options = \{\}\)/);
assert.match(searchRuntime, /Array\.isArray\(groups\) \? groups : \[\]/);
assert.match(searchRuntime, /seenCategories/);
assert.match(searchRuntime, /seenSubcategories/);
assert.match(searchRuntime, /seenCatalogs/);
assert.match(searchRuntime, /function mergeNavigationResults/);
assert.match(searchRuntime, /result\?\.matchField === "title"/);
assert.match(searchRuntime, /result\?\.matchField !== "category"/);
assert.match(searchRuntime, /function navigationResultMarkup/);
assert.doesNotMatch(searchRuntime, /פרדי|קואליטה|חדרי שינה ת\.ב\.י/);

assert.match(searchUi, /catalogSearch\.searchNavigation\([\s\S]*getCatalogCategoryGroups\(\)[\s\S]*rawQuery/);
assert.match(searchUi, /const navigationResults = rawQuery\.length < 2 \? \[\] : catalogSearch\.searchNavigation/);
assert.match(searchUi, /await getGlobalOcrSearchResults\(rawQuery, limit, control\)/);
assert.match(searchUi, /catalogSearch\.mergeNavigationResults\([\s\S]*navigationResults[\s\S]*getGlobalOcrSearchResults/);
assert.match(searchUi, /navigateTo\(catalogDocumentUrl\(result\.catalogId\)\)/);
assert.match(searchUi, /activateCategoryTarget/);
assert.match(searchUi, /catalogSearch\.navigationResultMarkup\(result\)/);

assert.match(catalogGrid, /function activateCatalogCategoryTarget/);
assert.match(catalogGrid, /activateCategoryTarget: activateCatalogCategoryTarget/);
assert.match(styles, /\.search-navigation-result-card/);
assert.equal((frontendBuilder.match(/45-navigation-search\.js/g) || []).length, 0);
assert.equal(fs.existsSync(path.join(root, "src/js/45-navigation-search.js")), false);

console.log("catalog_navigation_search_contract.test.js: PASS");
