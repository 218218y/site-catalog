/**
 * Source module: 06-catalog-page-numbering.js
 * Canonical mapping between user-visible catalog page numbers and physical
 * page image indexes. Physical assets always remain one-based (page-001...),
 * while a catalog may expose its first page as either 0 or 1.
 */

const DEFAULT_CATALOG_PAGE_NUMBER_START = 1;

/** @param {CatalogRecord|null|undefined} catalog */
function catalogPageNumberStart(catalog) {
  return catalog?.pageNumberStart === 0 ? 0 : DEFAULT_CATALOG_PAGE_NUMBER_START;
}

/** @param {CatalogRecord|null|undefined} catalog */
function catalogPageCount(catalog) {
  const count = Number.parseInt(String(catalog?.pages ?? 0), 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

/** @param {CatalogRecord|null|undefined} catalog */
function catalogFirstPage(catalog) {
  return catalogPageNumberStart(catalog);
}

/** @param {CatalogRecord|null|undefined} catalog */
function catalogLastPage(catalog) {
  const firstPage = catalogFirstPage(catalog);
  const count = catalogPageCount(catalog);
  return count > 0 ? firstPage + count - 1 : firstPage;
}

/** @param {unknown} value @param {number} fallback */
function integerOr(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** @param {unknown} page @param {CatalogRecord|null|undefined} catalog */
function clampCatalogPage(page, catalog) {
  const firstPage = catalogFirstPage(catalog);
  const lastPage = catalogLastPage(catalog);
  return Math.min(Math.max(integerOr(page, firstPage), firstPage), lastPage);
}

/** @param {CatalogRecord|null|undefined} catalog @param {unknown} page */
function isCatalogPage(catalog, page) {
  const parsed = integerOr(page, Number.NaN);
  return Number.isFinite(parsed)
    && parsed >= catalogFirstPage(catalog)
    && parsed <= catalogLastPage(catalog);
}

/** @param {CatalogRecord|null|undefined} catalog @param {unknown} displayPage */
function displayPageToAssetPage(catalog, displayPage) {
  return clampCatalogPage(displayPage, catalog) - catalogFirstPage(catalog) + 1;
}

/** @param {CatalogRecord|null|undefined} catalog @param {unknown} assetPage */
function assetPageToDisplayPage(catalog, assetPage) {
  const count = catalogPageCount(catalog);
  const normalizedAssetPage = Math.min(Math.max(integerOr(assetPage, 1), 1), Math.max(1, count));
  return catalogFirstPage(catalog) + normalizedAssetPage - 1;
}

/** @param {CatalogRecord|null|undefined} catalog */
function catalogPageNumbers(catalog) {
  const firstPage = catalogFirstPage(catalog);
  return Array.from({ length: catalogPageCount(catalog) }, (_unused, index) => firstPage + index);
}

/* TEST-ONLY EXPORTS: BEGIN */
if (typeof __BARGIG_TEST_EXPORTS__ !== "undefined") {
  __BARGIG_TEST_EXPORTS__["catalog-page-numbering"] = Object.freeze({
    assetPageToDisplayPage,
    catalogFirstPage,
    catalogLastPage,
    catalogPageCount,
    catalogPageNumberStart,
    catalogPageNumbers,
    clampCatalogPage,
    displayPageToAssetPage,
    isCatalogPage
  });
}
/* TEST-ONLY EXPORTS: END */

export {
  DEFAULT_CATALOG_PAGE_NUMBER_START,
  assetPageToDisplayPage,
  catalogFirstPage,
  catalogLastPage,
  catalogPageCount,
  catalogPageNumberStart,
  catalogPageNumbers,
  clampCatalogPage,
  displayPageToAssetPage,
  isCatalogPage
};
