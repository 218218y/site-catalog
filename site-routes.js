(function initBargigRoutes(global) {
  "use strict";

  const PAGE_HOME = "home";
  const PAGE_CATALOG = "catalog";
  const PAGE_FAVORITES = "favorites";
  const PAGE_VIEWER = "viewer";
  const FAVORITES_SOURCE = "favorites";

  const DOCUMENTS = Object.freeze({
    [PAGE_HOME]: "index.html",
    [PAGE_CATALOG]: "catalog.html",
    [PAGE_FAVORITES]: "favorites.html",
    [PAGE_VIEWER]: "viewer.html"
  });

  function normalizePage(value) {
    const page = String(value || "").trim().toLowerCase();
    return Object.prototype.hasOwnProperty.call(DOCUMENTS, page) ? page : PAGE_HOME;
  }

  function positiveInteger(value, fallback = 1) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  function documentNameFromPath(pathname) {
    const segments = String(pathname || "")
      .split("/")
      .map((segment) => segment.trim().toLowerCase())
      .filter(Boolean);
    return segments.pop() || DOCUMENTS[PAGE_HOME];
  }

  function documentRouteName(filename) {
    return String(filename || "").trim().toLowerCase().replace(/\.html$/, "");
  }

  function matchPageFromLocation(locationLike, declaredPage = "") {
    if (String(declaredPage || "").trim()) return normalizePage(declaredPage);

    const documentName = documentNameFromPath(locationLike?.pathname);
    const routeName = documentRouteName(documentName);
    if (!routeName || routeName === "index") return PAGE_HOME;

    const match = Object.entries(DOCUMENTS).find(([, filename]) => (
      filename === documentName || documentRouteName(filename) === routeName
    ));
    return match?.[0] || "";
  }

  function pageFromLocation(locationLike, declaredPage = "") {
    return matchPageFromLocation(locationLike, declaredPage) || PAGE_HOME;
  }

  function basePathFromLocation(locationLike, declaredPage = "") {
    const pathname = String(locationLike?.pathname || "/");
    const segments = pathname.split("/").filter(Boolean);
    const page = matchPageFromLocation(locationLike, declaredPage);

    if (page && segments.length) {
      const lastSegment = segments[segments.length - 1].toLowerCase();
      const expectedDocument = DOCUMENTS[page];
      const expectedRoute = documentRouteName(expectedDocument);
      const isPageSegment = lastSegment === expectedDocument || documentRouteName(lastSegment) === expectedRoute;
      if (isPageSegment) segments.pop();
    }

    return segments.length ? `/${segments.join("/")}/` : "/";
  }

  function isDocumentLocation(locationLike) {
    return Boolean(matchPageFromLocation(locationLike));
  }

  function isSameAppDocumentLocation(currentLocationLike, targetLocationLike, declaredCurrentPage = "") {
    if (!isDocumentLocation(targetLocationLike)) return false;

    const currentOrigin = String(currentLocationLike?.origin || "");
    const targetOrigin = String(targetLocationLike?.origin || "");
    if (currentOrigin && targetOrigin && currentOrigin !== targetOrigin) return false;

    const currentBasePath = basePathFromLocation(currentLocationLike, declaredCurrentPage);
    const targetPage = matchPageFromLocation(targetLocationLike);
    const targetBasePath = basePathFromLocation(targetLocationLike, targetPage);
    return currentBasePath === targetBasePath;
  }

  function buildRelativeUrl(page, params = {}) {
    const filename = DOCUMENTS[normalizePage(page)];
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      search.set(key, String(value));
    });
    const query = search.toString();
    return query ? `${filename}?${query}` : filename;
  }

  function homeUrl() {
    return buildRelativeUrl(PAGE_HOME);
  }

  function catalogUrl(catalogId) {
    const normalizedCatalogId = String(catalogId || "").trim();
    return buildRelativeUrl(PAGE_CATALOG, { catalog: normalizedCatalogId });
  }

  function favoritesUrl() {
    return buildRelativeUrl(PAGE_FAVORITES);
  }

  function viewerUrl(catalogId, page = 1, options = {}) {
    return buildRelativeUrl(PAGE_VIEWER, {
      catalog: String(catalogId || ""),
      page: positiveInteger(page),
      source: options.source === FAVORITES_SOURCE ? FAVORITES_SOURCE : ""
    });
  }

  function parseLocation(locationLike, declaredPage = "") {
    const page = pageFromLocation(locationLike, declaredPage);
    const search = new URLSearchParams(String(locationLike?.search || ""));
    const catalogId = String(search.get("catalog") || "").trim();
    const currentPage = positiveInteger(search.get("page"), 1);
    const source = search.get("source") === FAVORITES_SOURCE ? FAVORITES_SOURCE : "catalog";
    return { page, catalogId, currentPage, source };
  }

  global.BargigRoutes = Object.freeze({
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
    favoritesUrl,
    viewerUrl,
    parseLocation
  });
})(typeof window !== "undefined" ? window : globalThis);
