(function initBargigRoutes(global) {
  "use strict";

  const PAGE_HOME = "home";
  const PAGE_CATALOG = "catalog";
  const PAGE_FAVORITES = "favorites";
  const PAGE_VIEWER = "viewer";
  const FAVORITES_SOURCE = "favorites";
  const CLEAN_CATALOG_SEGMENT = "catalog";
  const CLEAN_CATEGORY_SEGMENT = "category";
  const CLEAN_PAGE_SEGMENT = "page";

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

  function safeRouteToken(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function pathnameSegments(pathname) {
    return String(pathname || "")
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);
  }

  function documentRouteName(filename) {
    return String(filename || "").trim().toLowerCase().replace(/\.html$/, "");
  }

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
        currentPage: positiveInteger(trailing[1], 1),
        baseSegments: segments.slice(0, catalogIndex)
      };
    }
    return null;
  }

  function legacyDocumentMatch(pathname) {
    const segments = pathnameSegments(pathname);
    const last = String(segments[segments.length - 1] || "").toLowerCase();
    const routeName = documentRouteName(last);
    if (!last || routeName === "index") {
      return { page: PAGE_HOME, baseSegments: last ? segments.slice(0, -1) : segments };
    }
    const match = Object.entries(DOCUMENTS).find(([, filename]) => (
      filename === last || documentRouteName(filename) === routeName
    ));
    return match ? { page: match[0], baseSegments: segments.slice(0, -1) } : null;
  }

  function matchPageFromLocation(locationLike, declaredPage = "") {
    if (String(declaredPage || "").trim()) return normalizePage(declaredPage);
    return cleanCatalogRouteMatch(locationLike?.pathname)?.page
      || legacyDocumentMatch(locationLike?.pathname)?.page
      || "";
  }

  function pageFromLocation(locationLike, declaredPage = "") {
    return matchPageFromLocation(locationLike, declaredPage) || PAGE_HOME;
  }

  function basePathFromLocation(locationLike, declaredPage = "") {
    const clean = cleanCatalogRouteMatch(locationLike?.pathname);
    const legacy = clean ? null : legacyDocumentMatch(locationLike?.pathname);
    let baseSegments = clean?.baseSegments || legacy?.baseSegments || [];

    // A declared application page can be used on a generated clean route. If
    // neither route parser matched, preserve the containing directory rather
    // than treating the unknown final segment as part of the app base.
    if (!clean && !legacy && String(declaredPage || "").trim()) {
      const segments = pathnameSegments(locationLike?.pathname);
      baseSegments = segments.slice(0, -1);
    }
    return baseSegments.length ? `/${baseSegments.join("/")}/` : "/";
  }

  function runtimeBasePath() {
    return basePathFromLocation(global.location || { pathname: "/" }, global.document?.body?.dataset?.page || "");
  }

  function joinBasePath(relativePath) {
    const base = runtimeBasePath();
    return `${base}${String(relativePath || "").replace(/^\/+/, "")}`;
  }

  function isDocumentLocation(locationLike) {
    return Boolean(matchPageFromLocation(locationLike));
  }

  function isSameAppDocumentLocation(currentLocationLike, targetLocationLike, declaredCurrentPage = "") {
    if (!isDocumentLocation(targetLocationLike)) return false;
    const currentOrigin = String(currentLocationLike?.origin || "");
    const targetOrigin = String(targetLocationLike?.origin || "");
    if (currentOrigin && targetOrigin && currentOrigin !== targetOrigin) return false;
    return basePathFromLocation(currentLocationLike, declaredCurrentPage)
      === basePathFromLocation(targetLocationLike, matchPageFromLocation(targetLocationLike));
  }

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

  function catalogUrl(catalogId) {
    const normalizedCatalogId = safeRouteToken(catalogId);
    return normalizedCatalogId
      ? joinBasePath(`${CLEAN_CATALOG_SEGMENT}/${normalizedCatalogId}/`)
      : buildRelativeUrl(PAGE_CATALOG);
  }

  function categoryUrl(categorySlug, subcategorySlug = "") {
    const category = safeRouteToken(categorySlug);
    const subcategory = safeRouteToken(subcategorySlug);
    if (!category) return homeUrl();
    return joinBasePath(`${CLEAN_CATEGORY_SEGMENT}/${category}/${subcategory ? `${subcategory}/` : ""}`);
  }

  function favoritesUrl() {
    return buildRelativeUrl(PAGE_FAVORITES);
  }

  function viewerUrl(catalogId, page = 1, options = {}) {
    const normalizedCatalogId = safeRouteToken(catalogId);
    if (!normalizedCatalogId) return buildRelativeUrl(PAGE_VIEWER);
    const base = joinBasePath(`${CLEAN_CATALOG_SEGMENT}/${normalizedCatalogId}/${CLEAN_PAGE_SEGMENT}/${positiveInteger(page)}/`);
    return options.source === FAVORITES_SOURCE ? `${base}?source=${FAVORITES_SOURCE}` : base;
  }

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

    const page = pageFromLocation(locationLike, declaredPage);
    return {
      page,
      catalogId: String(search.get("catalog") || "").trim(),
      currentPage: positiveInteger(search.get("page"), 1),
      source: search.get("source") === FAVORITES_SOURCE ? FAVORITES_SOURCE : "catalog"
    };
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
    categoryUrl,
    favoritesUrl,
    viewerUrl,
    parseLocation
  });
})(typeof window !== "undefined" ? window : globalThis);
