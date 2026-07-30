/** Typed external ESM runtime: application route parsing and URL generation. */

/** @typedef {"home"|"catalog"|"favorites"|"viewer"} SitePage */
/** @typedef {{pathname?:string, search?:string, origin?:string}} LocationLike */
/** @typedef {{source?:string}} ViewerRouteOptions */
/** @typedef {{page:SitePage, catalogId:string, currentPage:number, source:string}} SiteRoute */

const PAGE_HOME = /** @type {const} */ ("home");
const PAGE_CATALOG = /** @type {const} */ ("catalog");
const PAGE_FAVORITES = /** @type {const} */ ("favorites");
const PAGE_VIEWER = /** @type {const} */ ("viewer");
const FAVORITES_SOURCE = "favorites";
const CLEAN_CATALOG_SEGMENT = "catalog";
const CLEAN_CATEGORY_SEGMENT = "category";
const CLEAN_PAGE_SEGMENT = "page";

/** @type {Readonly<Record<SitePage, string>>} */
const DOCUMENTS = Object.freeze({
  [PAGE_HOME]: "index.html",
  [PAGE_CATALOG]: "catalog.html",
  [PAGE_FAVORITES]: "favorites.html",
  [PAGE_VIEWER]: "viewer.html"
});

/** @param {unknown} value @returns {SitePage} */
function normalizePage(value) {
  const page = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(DOCUMENTS, page)
    ? /** @type {SitePage} */ (page)
    : PAGE_HOME;
}

/** @param {unknown} value @param {number} [fallback] */
function nonNegativeInteger(value, fallback = 1) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** @param {unknown} value */
function safeRouteToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** @param {unknown} pathname */
function pathnameSegments(pathname) {
  return String(pathname || "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

/** @param {unknown} filename */
function documentRouteName(filename) {
  return String(filename || "").trim().toLowerCase().replace(/\.html$/, "");
}

/** @param {unknown} pathname @returns {{page:SitePage, catalogId:string, currentPage:number, baseSegments:string[]}|null} */
function cleanCatalogRouteMatch(pathname) {
  const segments = pathnameSegments(pathname);
  const lowered = segments.map((segment) => segment.toLowerCase());
  const catalogIndex = lowered.lastIndexOf(CLEAN_CATALOG_SEGMENT);
  if (catalogIndex < 0 || catalogIndex + 1 >= segments.length) return null;

  const catalogId = safeRouteToken(segments[catalogIndex + 1]);
  if (!catalogId) return null;
  const trailing = lowered.slice(catalogIndex + 2);
  if (!trailing.length) {
    return { page: PAGE_CATALOG, catalogId, currentPage: 1, baseSegments: segments.slice(0, catalogIndex) };
  }
  if (trailing.length === 2 && trailing[0] === CLEAN_PAGE_SEGMENT) {
    return {
      page: PAGE_VIEWER,
      catalogId,
      currentPage: nonNegativeInteger(trailing[1], 1),
      baseSegments: segments.slice(0, catalogIndex)
    };
  }
  return null;
}

/** @param {unknown} pathname @returns {{page:SitePage, baseSegments:string[]}|null} */
function shellDocumentMatch(pathname) {
  const segments = pathnameSegments(pathname);
  const last = String(segments[segments.length - 1] || "").toLowerCase();
  const routeName = documentRouteName(last);
  if (!last || routeName === "index") {
    return { page: PAGE_HOME, baseSegments: last ? segments.slice(0, -1) : segments };
  }
  const match = /** @type {[SitePage, string]|undefined} */ (
    Object.entries(DOCUMENTS).find(([, filename]) => (
      filename === last || documentRouteName(filename) === routeName
    ))
  );
  return match ? { page: match[0], baseSegments: segments.slice(0, -1) } : null;
}

/** @param {LocationLike} locationLike @param {unknown} [declaredPage] @returns {SitePage|""} */
function matchPageFromLocation(locationLike, declaredPage = "") {
  if (String(declaredPage || "").trim()) return normalizePage(declaredPage);
  return cleanCatalogRouteMatch(locationLike?.pathname)?.page
    || shellDocumentMatch(locationLike?.pathname)?.page
    || "";
}

/** @param {LocationLike} locationLike @param {unknown} [declaredPage] @returns {SitePage} */
function pageFromLocation(locationLike, declaredPage = "") {
  return matchPageFromLocation(locationLike, declaredPage) || PAGE_HOME;
}

/** @param {LocationLike} locationLike @param {unknown} [declaredPage] */
function basePathFromLocation(locationLike, declaredPage = "") {
  const clean = cleanCatalogRouteMatch(locationLike?.pathname);
  const shell = clean ? null : shellDocumentMatch(locationLike?.pathname);
  let baseSegments = clean?.baseSegments || shell?.baseSegments || [];

  if (!clean && !shell && String(declaredPage || "").trim()) {
    const segments = pathnameSegments(locationLike?.pathname);
    baseSegments = segments.slice(0, -1);
  }
  return baseSegments.length ? `/${baseSegments.join("/")}/` : "/";
}

function runtimeBasePath() {
  return basePathFromLocation(window.location, document.body?.dataset?.page || "");
}

/** @param {unknown} relativePath */
function joinBasePath(relativePath) {
  const base = runtimeBasePath();
  return `${base}${String(relativePath || "").replace(/^\/+/, "")}`;
}

/** @param {LocationLike} locationLike */
function isDocumentLocation(locationLike) {
  return Boolean(matchPageFromLocation(locationLike));
}

/**
 * @param {LocationLike} currentLocationLike
 * @param {LocationLike} targetLocationLike
 * @param {unknown} [declaredCurrentPage]
 */
function isSameAppDocumentLocation(currentLocationLike, targetLocationLike, declaredCurrentPage = "") {
  if (!isDocumentLocation(targetLocationLike)) return false;
  const currentOrigin = String(currentLocationLike?.origin || "");
  const targetOrigin = String(targetLocationLike?.origin || "");
  if (currentOrigin && targetOrigin && currentOrigin !== targetOrigin) return false;
  return basePathFromLocation(currentLocationLike, declaredCurrentPage)
    === basePathFromLocation(targetLocationLike, matchPageFromLocation(targetLocationLike));
}

/** @param {unknown} page @param {Record<string, unknown>} [params] */
function buildRelativeUrl(page, params = {}) {
  const filename = DOCUMENTS[normalizePage(page)];
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    search.set(key, String(value));
  });
  const query = search.toString();
  return `${joinBasePath(filename)}${query ? `?${query}` : ""}`;
}

function homeUrl() {
  return runtimeBasePath();
}

/** @param {unknown} catalogId */
function catalogUrl(catalogId) {
  const normalizedCatalogId = safeRouteToken(catalogId);
  return normalizedCatalogId
    ? joinBasePath(`${CLEAN_CATALOG_SEGMENT}/${normalizedCatalogId}/`)
    : homeUrl();
}

/** @param {unknown} categorySlug @param {unknown} [subcategorySlug] */
function categoryUrl(categorySlug, subcategorySlug = "") {
  const category = safeRouteToken(categorySlug);
  const subcategory = safeRouteToken(subcategorySlug);
  if (!category) return homeUrl();
  return joinBasePath(`${CLEAN_CATEGORY_SEGMENT}/${category}/${subcategory ? `${subcategory}/` : ""}`);
}

function favoritesUrl() {
  return buildRelativeUrl(PAGE_FAVORITES);
}

/** @param {unknown} catalogId @param {unknown} [page] @param {ViewerRouteOptions} [options] */
function viewerUrl(catalogId, page = 1, options = {}) {
  const normalizedCatalogId = safeRouteToken(catalogId);
  if (!normalizedCatalogId) return homeUrl();
  const currentPage = nonNegativeInteger(page);
  const base = joinBasePath(`${CLEAN_CATALOG_SEGMENT}/${normalizedCatalogId}/${CLEAN_PAGE_SEGMENT}/${currentPage}/`);
  return options.source === FAVORITES_SOURCE ? `${base}?source=${FAVORITES_SOURCE}` : base;
}

/** @param {LocationLike} locationLike @param {unknown} [declaredPage] @returns {SiteRoute} */
function parseLocation(locationLike, declaredPage = "") {
  const search = new URLSearchParams(String(locationLike?.search || ""));
  const clean = cleanCatalogRouteMatch(locationLike?.pathname);
  if (clean) {
    return {
      page: clean.page,
      catalogId: clean.catalogId,
      currentPage: clean.currentPage,
      source: search.get("source") === FAVORITES_SOURCE ? FAVORITES_SOURCE : "catalog"
    };
  }

  return {
    page: pageFromLocation(locationLike, declaredPage),
    catalogId: "",
    currentPage: 1,
    source: FAVORITES_SOURCE === search.get("source") ? FAVORITES_SOURCE : "catalog"
  };
}

const siteRoutes = Object.freeze({
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

export {
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
  parseLocation,
  siteRoutes
};
export default siteRoutes;
