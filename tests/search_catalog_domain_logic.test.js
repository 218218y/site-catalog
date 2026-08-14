"use strict";

const assert = require("node:assert/strict");
const { importFrontendModule } = require("./frontend_test_module");

const { searchCatalogDomain: domain } = importFrontendModule("src/js/39-search-catalog-domain.js", {
  clampCatalogPage: (page, catalog) => {
    const first = catalog?.pageNumberStart === 0 ? 0 : 1;
    const last = first + Math.max(1, Number(catalog?.pages || 1)) - 1;
    const parsed = Number.parseInt(String(page), 10);
    return Math.min(Math.max(Number.isFinite(parsed) ? parsed : first, first), last);
  }
});

assert.equal(domain.decodeCatalogHashTargetId("#beds%20premium"), "beds premium");
assert.equal(domain.decodeCatalogHashTargetId("beds"), "");
assert.equal(domain.decodeCatalogHashTargetId("#%E0%A4%A"), "%E0%A4%A", "invalid escapes retain the raw target");

assert.equal(domain.catalogColumnCount({ mobile: true, tablet: true }), 1);
assert.equal(domain.catalogColumnCount({ tablet: true }), 2);
assert.equal(domain.catalogColumnCount(null), 3);
assert.equal(domain.clampCatalogSpan(0, 3), 1);
assert.equal(domain.clampCatalogSpan(9, 3), 3);

const catalog = (id) => ({ id, name: id, pages: 1 });
const groups = [
  { category: "A", items: [catalog("a1"), catalog("a2")] },
  {
    category: "B",
    items: [catalog("b0"), catalog("b1"), catalog("b2")],
    hasSubcategories: true,
    directItems: [catalog("b0")],
    subcategories: [{ subcategory: "B1", items: [catalog("b1"), catalog("b2")] }]
  }
];
const segments = domain.catalogCategorySegments(groups, 3);
assert.deepEqual(
  segments.map((segment) => ({ type: segment.segmentType, span: segment.span, ids: segment.items.map((item) => item.id) })),
  [
    { type: "category", span: 2, ids: ["a1", "a2"] },
    { type: "categoryHeader", span: 3, ids: [] },
    { type: "subcategory", span: 1, ids: ["b0"] },
    { type: "subcategory", span: 2, ids: ["b1", "b2"] }
  ]
);
assert.equal(segments[0].inlineDivider, false, "category headers always begin on a fresh row");
assert.equal(segments[2].inlineDivider, true, "adjacent subcategory blocks may share a row with an explicit divider");

assert.equal(
  domain.highlightedSearchText("A < B & C", [{ start: 2, end: 5 }]),
  "A <mark class=\"search-match-highlight\">&lt; B</mark> &amp; C"
);
assert.equal(
  domain.highlightedSearchText("abcdef", [{ start: 1, end: 4 }, { start: 3, end: 6 }]),
  "a<mark class=\"search-match-highlight\">bcd</mark>ef",
  "overlapping highlight ranges never duplicate text"
);
const details = domain.searchResultDetailsMarkup({
  page: 4,
  matchReason: "שם <דגם>",
  excerpt: "מיטה & ארון",
  highlights: [{ start: 0, end: 4 }]
});
assert.match(details, /עמוד 4/);
assert.match(details, /שם &lt;דגם&gt;/);
assert.match(details, /<mark class="search-match-highlight">מיטה<\/mark> &amp; ארון/);
assert.match(domain.searchResultDetailsMarkup({ page: 0 }), /עמוד 0/);

assert.equal(domain.lightboxSearchColumnLimit(5, 400), 3);
assert.equal(domain.lightboxSearchColumnLimit(undefined, 1180), 3);
assert.equal(domain.lightboxSearchColumnLimit(undefined, 900), 2);
assert.equal(domain.lightboxSearchColumnLimit(undefined, 500), 1);

console.log("search_catalog_domain_logic.test.js: PASS");
