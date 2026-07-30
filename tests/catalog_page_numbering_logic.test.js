"use strict";

const assert = require("node:assert/strict");
const { importFrontendTestModule } = require("./frontend_test_module");

const pageNumbering = importFrontendTestModule(
  "src/js/06-catalog-page-numbering.js",
  "catalog-page-numbering"
);

const regular = { id: "regular", pages: 3 };
assert.equal(pageNumbering.catalogFirstPage(regular), 1);
assert.equal(pageNumbering.catalogLastPage(regular), 3);
assert.equal(pageNumbering.catalogPageOrdinal(regular, 1), 1);
assert.equal(pageNumbering.catalogPageOrdinal(regular, 3), 3);
assert.deepEqual(pageNumbering.catalogPageNumbers(regular), [1, 2, 3]);
assert.equal(pageNumbering.displayPageToAssetPage(regular, 1), 1);
assert.equal(pageNumbering.assetPageToDisplayPage(regular, 3), 3);
assert.equal(pageNumbering.clampCatalogPage(regular, -10), 1);
assert.equal(pageNumbering.catalogFirstPage({ pages: 2, pageNumberStart: false }), 1);
assert.equal(pageNumbering.catalogFirstPage({ pages: 2, pageNumberStart: "0" }), 1);

const coverCatalog = { id: "cover", pages: 3, pageNumberStart: 0 };
assert.equal(pageNumbering.catalogFirstPage(coverCatalog), 0);
assert.equal(pageNumbering.catalogLastPage(coverCatalog), 2);
assert.equal(pageNumbering.catalogPageOrdinal(coverCatalog, 0), 1);
assert.equal(pageNumbering.catalogPageOrdinal(coverCatalog, 2), 3);
assert.deepEqual(pageNumbering.catalogPageNumbers(coverCatalog), [0, 1, 2]);
assert.equal(pageNumbering.displayPageToAssetPage(coverCatalog, 0), 1);
assert.equal(pageNumbering.displayPageToAssetPage(coverCatalog, 2), 3);
assert.equal(pageNumbering.assetPageToDisplayPage(coverCatalog, 1), 0);
assert.equal(pageNumbering.assetPageToDisplayPage(coverCatalog, 3), 2);
assert.equal(pageNumbering.clampCatalogPage(-1, coverCatalog), 0);
assert.equal(pageNumbering.clampCatalogPage(99, coverCatalog), 2);
assert.equal(pageNumbering.isCatalogPage(coverCatalog, 0), true);
assert.equal(pageNumbering.isCatalogPage(coverCatalog, 3), false);

console.log("catalog_page_numbering_logic.test.js: PASS");
