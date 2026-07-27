"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "catalog-search.js"), "utf8");
const windowObject = { BARGIG_CATALOGS: [] };
const context = vm.createContext({
  window: windowObject,
  URL,
  Map,
  Set,
  Object,
  Array,
  String,
  Number,
  Intl,
  console,
  encodeURIComponent
});
vm.runInContext(source, context);

const catalogSearch = windowObject.BargigCatalogSearch;
assert.ok(catalogSearch, "catalog search runtime should expose its public API");
assert.equal(catalogSearch.normalize("פרד״י"), "פרדי");
assert.equal(catalogSearch.normalize("מלכים"), "מלכימ", "Hebrew final letters should normalize consistently");

const frediOpening = { id: "opening-fredi", title: "ארונות פתיחה פרדי", category: "ארונות פתיחה", subcategory: "" };
const frediKids = { id: "kids-fredi", title: "חדרי ילדים פרדי", category: "חדרי ילדים", subcategory: "חדרי ילדים קומפלט" };
const frediBedrooms = { id: "bedrooms-fredi", title: "חדרי שינה מרופדים פרדי", category: "חדרי שינה", subcategory: "מרופדים" };
const tbiBedrooms = { id: "bedrooms-tbi", title: "חדרי שינה ת.ב.י", category: "חדרי שינה", subcategory: "חדרי שינה" };

const groups = [
  {
    category: "ארונות פתיחה",
    items: [frediOpening],
    subcategories: []
  },
  {
    category: "חדרי ילדים",
    items: [frediKids],
    subcategories: [{ subcategory: "חדרי ילדים קומפלט", items: [frediKids] }]
  },
  {
    category: "חדרי שינה",
    items: [frediBedrooms, tbiBedrooms, frediBedrooms],
    subcategories: [
      { subcategory: "מרופדים", items: [frediBedrooms] },
      { subcategory: "חדרי שינה", items: [tbiBedrooms] }
    ]
  }
];

const bedroomResults = catalogSearch.searchNavigation(groups, "חדרי־שינה");
assert.equal(bedroomResults[0].resultType, "category");
assert.equal(bedroomResults[0].label, "חדרי שינה");
assert.equal(bedroomResults[0].targetId, "catalog-category-חדרי-שינה-3");
assert.ok(bedroomResults.some((result) => result.resultType === "subcategory" && result.label === "חדרי שינה"));
assert.equal(
  bedroomResults.filter((result) => result.resultType === "category" && result.label === "חדרי שינה").length,
  1,
  "a category must appear once"
);

const frediResults = catalogSearch.searchNavigation(groups, "פרדי");
assert.deepEqual(
  Array.from(frediResults, (result) => result.catalogId),
  ["opening-fredi", "kids-fredi", "bedrooms-fredi"],
  "catalog title search should return one result per catalog in screen order"
);
assert.ok(frediResults.every((result) => result.resultType === "catalog"));

const scopedResults = catalogSearch.searchNavigation(groups, "פרדי", { category: "חדרי שינה" });
assert.deepEqual(Array.from(scopedResults, (result) => result.catalogId), ["bedrooms-fredi"]);

const mutableGroups = JSON.parse(JSON.stringify(groups));
assert.equal(catalogSearch.searchNavigation(mutableGroups, "קואליטה").length, 0);
mutableGroups[1].items.push({
  id: "qualita",
  title: "היי ריזר קואליטה",
  category: "חדרי ילדים",
  subcategory: "היי ריזר"
});
assert.deepEqual(
  Array.from(catalogSearch.searchNavigation(mutableGroups, "קואליטה"), (result) => result.catalogId),
  ["qualita"],
  "results must reflect newly added catalogs without rebuilding a separate index"
);
mutableGroups[1].items = mutableGroups[1].items.filter((catalog) => catalog.id !== "qualita");
assert.equal(
  catalogSearch.searchNavigation(mutableGroups, "קואליטה").length,
  0,
  "results must reflect catalog removal immediately"
);

windowObject.BARGIG_CATALOGS = [frediOpening, frediKids, frediBedrooms, tbiBedrooms];
const merged = catalogSearch.mergeNavigationResults(frediResults, [
  { catalogId: "opening-fredi", page: 1, matchField: "title" },
  { catalogId: "kids-fredi", page: 2, matchField: "page" },
  { catalogId: "bedrooms-fredi", page: 1, matchField: "category" },
  { catalogId: "bedrooms-tbi", page: 3, matchField: "page" }
]);
assert.deepEqual(
  Array.from(merged.filter((result) => result.resultType === "ocr"), (result) => `${result.catalogId}:${result.page}`),
  ["kids-fredi:2", "bedrooms-fredi:1", "bedrooms-tbi:3"],
  "catalog-title metadata matches should be suppressed while real page/OCR matches remain"
);

const bedroomNavigation = catalogSearch.searchNavigation(groups, "חדרי שינה");
const categoryMerged = catalogSearch.mergeNavigationResults(bedroomNavigation, [
  { catalogId: "bedrooms-fredi", page: 1, matchField: "category" },
  { catalogId: "bedrooms-tbi", page: 2, matchField: "page" }
]);
assert.deepEqual(
  Array.from(categoryMerged.filter((result) => result.resultType === "ocr"), (result) => `${result.catalogId}:${result.page}`),
  ["bedrooms-tbi:2"],
  "category metadata duplicates should be suppressed when the category navigation result is present"
);

const markup = catalogSearch.navigationResultMarkup(frediResults[0]);
assert.match(markup, /data-search-navigation-type="catalog"/);
assert.match(markup, /פתיחת דף הקטלוג/);
assert.match(markup, /ארונות פתיחה פרדי/);

console.log("catalog_navigation_search_logic.test.js: PASS");
