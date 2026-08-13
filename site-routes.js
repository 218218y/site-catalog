/*
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Browser bundle: site-routes.js
 * ES module entrypoint: src/runtime/site-routes.js
 * Bundled ES module graph:
 *   - src/runtime/site-routes.js
 * Compiler virtual inputs: none
 * Output format: native browser ES module
 * Bundler: esbuild 0.28.2 (lockfile-selected direct devDependency)
 * Build command: python tools/build_frontend_assets.py
 */
// src/runtime/site-routes.js
var PAGE_HOME = (
  /** @type {const} */
  "home"
), PAGE_CATALOG = (
  /** @type {const} */
  "catalog"
), PAGE_FAVORITES = (
  /** @type {const} */
  "favorites"
), PAGE_VIEWER = (
  /** @type {const} */
  "viewer"
), FAVORITES_SOURCE = "favorites", CLEAN_CATALOG_SEGMENT = "catalog", CLEAN_CATEGORY_SEGMENT = "category", CLEAN_PAGE_SEGMENT = "page", DOCUMENTS = Object.freeze({
  [PAGE_HOME]: "index.html",
  [PAGE_CATALOG]: "catalog.html",
  [PAGE_FAVORITES]: "favorites.html",
  [PAGE_VIEWER]: "viewer.html"
});
function normalizePage(value) {
  let page = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DOCUMENTS, page) ? (
    /** @type {SitePage} */
    page
  ) : PAGE_HOME;
}
function nonNegativeInteger(value, fallback = 1) {
  let parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
function safeRouteToken(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}
function pathnameSegments(pathname) {
  return String(pathname || "").split("/").map((segment) => segment.trim()).filter(Boolean);
}
function documentRouteName(filename) {
  return String(filename || "").trim().toLowerCase().replace(/\.html$/, "");
}
function cleanCatalogRouteMatch(pathname) {
  let segments = pathnameSegments(pathname), lowered = segments.map((segment) => segment.toLowerCase()), catalogIndex = lowered.lastIndexOf(CLEAN_CATALOG_SEGMENT);
  if (catalogIndex < 0 || catalogIndex + 1 >= segments.length) return null;
  let catalogId = safeRouteToken(segments[catalogIndex + 1]);
  if (!catalogId) return null;
  let trailing = lowered.slice(catalogIndex + 2);
  return trailing.length ? trailing.length === 2 && trailing[0] === CLEAN_PAGE_SEGMENT ? {
    page: PAGE_VIEWER,
    catalogId,
    currentPage: nonNegativeInteger(trailing[1], 1),
    baseSegments: segments.slice(0, catalogIndex)
  } : null : { page: PAGE_CATALOG, catalogId, currentPage: 1, baseSegments: segments.slice(0, catalogIndex) };
}
function shellDocumentMatch(pathname) {
  let segments = pathnameSegments(pathname), last = String(segments[segments.length - 1] || "").toLowerCase(), routeName = documentRouteName(last);
  if (!last || routeName === "index")
    return { page: PAGE_HOME, baseSegments: last ? segments.slice(0, -1) : segments };
  let match = (
    /** @type {[SitePage, string]|undefined} */
    Object.entries(DOCUMENTS).find(([, filename]) => filename === last || documentRouteName(filename) === routeName)
  );
  return match ? { page: match[0], baseSegments: segments.slice(0, -1) } : null;
}
function matchPageFromLocation(locationLike, declaredPage = "") {
  let locationPage = cleanCatalogRouteMatch(locationLike?.pathname)?.page || shellDocumentMatch(locationLike?.pathname)?.page || "";
  return locationPage || (String(declaredPage || "").trim() ? normalizePage(declaredPage) : "");
}
function pageFromLocation(locationLike, declaredPage = "") {
  return matchPageFromLocation(locationLike, declaredPage) || PAGE_HOME;
}
function basePathFromLocation(locationLike, declaredPage = "") {
  let clean = cleanCatalogRouteMatch(locationLike?.pathname), shell = clean ? null : shellDocumentMatch(locationLike?.pathname), baseSegments = clean?.baseSegments || shell?.baseSegments || [];
  return !clean && !shell && String(declaredPage || "").trim() && (baseSegments = pathnameSegments(locationLike?.pathname).slice(0, -1)), baseSegments.length ? `/${baseSegments.join("/")}/` : "/";
}
function runtimeBasePath() {
  return basePathFromLocation(window.location, document.body?.dataset?.page || "");
}
function joinBasePath(relativePath) {
  return `${runtimeBasePath()}${String(relativePath || "").replace(/^\/+/, "")}`;
}
function isDocumentLocation(locationLike) {
  return !!matchPageFromLocation(locationLike);
}
function isSameAppDocumentLocation(currentLocationLike, targetLocationLike, declaredCurrentPage = "") {
  if (!isDocumentLocation(targetLocationLike)) return !1;
  let currentOrigin = String(currentLocationLike?.origin || ""), targetOrigin = String(targetLocationLike?.origin || "");
  return currentOrigin && targetOrigin && currentOrigin !== targetOrigin ? !1 : basePathFromLocation(currentLocationLike, declaredCurrentPage) === basePathFromLocation(targetLocationLike, matchPageFromLocation(targetLocationLike));
}
function buildRelativeUrl(page, params = {}) {
  let filename = DOCUMENTS[normalizePage(page)], search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    value == null || value === "" || search.set(key, String(value));
  });
  let query = search.toString();
  return `${joinBasePath(filename)}${query ? `?${query}` : ""}`;
}
function homeUrl() {
  return runtimeBasePath();
}
function catalogUrl(catalogId) {
  let normalizedCatalogId = safeRouteToken(catalogId);
  return normalizedCatalogId ? joinBasePath(`${CLEAN_CATALOG_SEGMENT}/${normalizedCatalogId}/`) : homeUrl();
}
function categoryUrl(categorySlug, subcategorySlug = "") {
  let category = safeRouteToken(categorySlug), subcategory = safeRouteToken(subcategorySlug);
  return category ? joinBasePath(`${CLEAN_CATEGORY_SEGMENT}/${category}/${subcategory ? `${subcategory}/` : ""}`) : homeUrl();
}
function favoritesUrl() {
  return buildRelativeUrl(PAGE_FAVORITES);
}
function viewerUrl(catalogId, page = 1, options = {}) {
  let normalizedCatalogId = safeRouteToken(catalogId);
  if (!normalizedCatalogId) return homeUrl();
  let currentPage = nonNegativeInteger(page), base = joinBasePath(`${CLEAN_CATALOG_SEGMENT}/${normalizedCatalogId}/${CLEAN_PAGE_SEGMENT}/${currentPage}/`);
  return options.source === FAVORITES_SOURCE ? `${base}?source=${FAVORITES_SOURCE}` : base;
}
function parseLocation(locationLike, declaredPage = "") {
  let search = new URLSearchParams(String(locationLike?.search || "")), clean = cleanCatalogRouteMatch(locationLike?.pathname);
  return clean ? {
    page: clean.page,
    catalogId: clean.catalogId,
    currentPage: clean.currentPage,
    source: search.get("source") === FAVORITES_SOURCE ? FAVORITES_SOURCE : "catalog"
  } : {
    page: pageFromLocation(locationLike, declaredPage),
    catalogId: "",
    currentPage: 1,
    source: FAVORITES_SOURCE === search.get("source") ? FAVORITES_SOURCE : "catalog"
  };
}
var siteRoutes = Object.freeze({
  PAGE_HOME,
  PAGE_CATALOG,
  PAGE_FAVORITES,
  PAGE_VIEWER,
  FAVORITES_SOURCE,
  DOCUMENTS,
  normalizePage,
  matchPageFromLocation,
  pageFromLocation,
  basePathFromLocation,
  isDocumentLocation,
  isSameAppDocumentLocation,
  buildRelativeUrl,
  homeUrl,
  catalogUrl,
  categoryUrl,
  favoritesUrl,
  viewerUrl,
  parseLocation
});
var site_routes_default = siteRoutes;
export {
  DOCUMENTS,
  FAVORITES_SOURCE,
  PAGE_CATALOG,
  PAGE_FAVORITES,
  PAGE_HOME,
  PAGE_VIEWER,
  basePathFromLocation,
  buildRelativeUrl,
  catalogUrl,
  categoryUrl,
  site_routes_default as default,
  favoritesUrl,
  homeUrl,
  isDocumentLocation,
  isSameAppDocumentLocation,
  matchPageFromLocation,
  normalizePage,
  pageFromLocation,
  parseLocation,
  siteRoutes,
  viewerUrl
};
