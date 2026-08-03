/*
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Browser bundle: app-viewer.js
 * ES module entrypoint: src/entries/viewer.js
 * Bundled ES module graph:
 *   - catalog-snapshot.js
 *   - src/entries/viewer.js
 *   - src/js/00-navigation.js
 *   - src/js/01-route-capabilities.js
 *   - src/js/02-dom-contracts.js
 *   - src/js/03-runtime-context.js
 *   - src/js/06-catalog-page-numbering.js
 *   - src/js/10-app-state.js
 *   - src/js/11-navigation-state.js
 *   - src/js/12-catalog-state.js
 *   - src/js/13-search-state.js
 *   - src/js/14-favorites-state.js
 *   - src/js/15-telemetry.js
 *   - src/js/16-viewer-state.js
 *   - src/js/17-catalog-asset-urls.js
 *   - src/js/17-viewer-state-transitions.js
 *   - src/js/18-navigation-feature.js
 *   - src/js/19-shared-pure.js
 *   - src/js/20-shared-ui.js
 *   - src/js/29-favorites-portability.js
 *   - src/js/30-favorites-share.js
 *   - src/js/31-viewer-share.js
 *   - src/js/32-shared-inquiry.js
 *   - src/js/35-favorites-workspace.js
 *   - src/js/39-search-catalog-domain.js
 *   - src/js/40-catalog-grid.js
 *   - src/js/50-search-ui.js
 *   - src/js/51-viewer-session-state.js
 *   - src/js/52-viewer-session.js
 *   - src/js/53-viewer-image.js
 *   - src/js/54-viewer-geometry.js
 *   - src/js/55-viewer-zoom-controller.js
 *   - src/js/56-viewer-shell.js
 *   - src/js/57-viewer-fit-controller.js
 *   - src/js/58-viewer-navigation.js
 *   - src/js/59-viewer-page-controller.js
 *   - src/js/60-viewer.js
 *   - src/js/61-viewer-layout-controller.js
 *   - src/js/62-viewer-actions.js
 *   - src/js/65-viewer-onboarding.js
 *   - src/js/70-viewer-input.js
 *   - src/js/80-app-shell.js
 *   - src/js/90-bootstrap.js
 * External runtime modules:
 *   - src/runtime/catalog-search.js
 *   - src/runtime/tooltip-manager.js
 *   - src/runtime/favorites-store.js
 *   - src/runtime/site-routes.js
 * Compiler virtual inputs: <define:__BARGIG_FEATURE_CAPABILITIES__>
 * Output format: native browser ES module
 * Bundler: esbuild 0.28.1 (direct pinned devDependency)
 * Build command: python tools/build_frontend_assets.py
 */
// <define:__BARGIG_FEATURE_CAPABILITIES__>
var define_BARGIG_FEATURE_CAPABILITIES_default = { viewer: !0, favoritesWorkspace: !0, catalogGrid: !0, search: !0 };

// src/js/01-route-capabilities.js
var resolvedFeatureCapabilities = typeof define_BARGIG_FEATURE_CAPABILITIES_default == "object" ? define_BARGIG_FEATURE_CAPABILITIES_default : { viewer: !1, favoritesWorkspace: !1, catalogGrid: !1, search: !1 }, featureCapabilities = Object.freeze(resolvedFeatureCapabilities);

// src/js/06-catalog-page-numbering.js
function catalogPageNumberStart(catalog) {
  return catalog?.pageNumberStart === 0 ? 0 : 1;
}
function catalogPageCount(catalog) {
  let count = Number.parseInt(String(catalog?.pages ?? 0), 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}
function catalogFirstPage(catalog) {
  return catalogPageNumberStart(catalog);
}
function catalogLastPage(catalog) {
  let firstPage = catalogFirstPage(catalog), count = catalogPageCount(catalog);
  return count > 0 ? firstPage + count - 1 : firstPage;
}
function integerOr(value, fallback) {
  let parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function clampCatalogPage(page, catalog) {
  let firstPage = catalogFirstPage(catalog), lastPage = catalogLastPage(catalog);
  return Math.min(Math.max(integerOr(page, firstPage), firstPage), lastPage);
}
function isCatalogPage(catalog, page) {
  let parsed = integerOr(page, Number.NaN);
  return Number.isFinite(parsed) && parsed >= catalogFirstPage(catalog) && parsed <= catalogLastPage(catalog);
}
function catalogPageOrdinal(catalog, displayPage) {
  return clampCatalogPage(displayPage, catalog) - catalogFirstPage(catalog) + 1;
}
function displayPageToAssetPage(catalog, displayPage) {
  return catalogPageOrdinal(catalog, displayPage);
}
function catalogPageNumbers(catalog) {
  let firstPage = catalogFirstPage(catalog);
  return Array.from({ length: catalogPageCount(catalog) }, (_unused, index) => firstPage + index);
}

// src/js/10-app-state.js
var CATALOG_IMAGE_TIER_THUMB = "thumb", CATALOG_IMAGE_TIER_MEDIUM = "medium", CATALOG_IMAGE_TIER_FULL = "full", CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE = "responsive", CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY = "full-only";
var CATALOG_IMAGE_RETRY_PARAM = "bargig_retry";
var catalogAssetState = {
  imageLoadCache: /* @__PURE__ */ new Map()
}, uiRuntime = {
  actionToastTimer: 0
}, featureInterfaces = /* @__PURE__ */ new Map();
function registerFeatureInterface(name, api) {
  let normalizedName = String(name || "").trim();
  if (!normalizedName || normalizedName !== name)
    throw new TypeError("Feature interface requires an exact stable name");
  if (!api || typeof api != "object")
    throw new TypeError(`Feature interface must be an object: ${normalizedName}`);
  let featureName = (
    /** @type {K} */
    name
  );
  if (featureInterfaces.has(featureName))
    throw new Error(`Feature interface was registered twice: ${normalizedName}`);
  let registered = Object.freeze({ ...api, name: featureName });
  featureInterfaces.set(
    featureName,
    /** @type {RegisteredFeatureInterface} */
    registered
  );
}
function getFeatureInterface(name) {
  return (
    /** @type {(FeatureRegistry[K] & {readonly name:K})|null} */
    featureInterfaces.get(name) || null
  );
}
function requireFeatureInterface(name) {
  let api = getFeatureInterface(name);
  if (!api) throw new Error(`Required feature interface is unavailable: ${name}`);
  return api;
}
var ESCAPE_FEATURE_NAMES = (
  /** @type {const} */
  [
    "inquiry",
    "favorites",
    "catalog-navigation",
    "search",
    "catalog-detail",
    "viewer"
  ]
);
function featureInterfacesByEscapePriority() {
  let interfaces = [];
  return ESCAPE_FEATURE_NAMES.forEach((name) => {
    let api = getFeatureInterface(name);
    api && interfaces.push(api);
  }), interfaces.sort((first, second) => second.escapePriority - first.escapePriority);
}
var boundEventFeatures = /* @__PURE__ */ new Set();
function bindFeatureEventsOnce(featureName, binder) {
  let name = String(featureName || "").trim();
  if (!name) throw new TypeError("Feature event binding requires a stable name");
  if (boundEventFeatures.has(name)) return !1;
  if (typeof binder != "function") throw new TypeError(`Feature event binder is not callable: ${name}`);
  return binder(), boundEventFeatures.add(name), !0;
}

// src/js/02-dom-contracts.js
var $ = (id) => document.getElementById(id), $image = (id) => (
  /** @type {HTMLImageElement|null} */
  document.getElementById(id)
);
function requiredElement(id) {
  let element = document.getElementById(id);
  if (!element) throw new Error(`Required application element is missing: #${id}`);
  return element;
}
var $requiredButton = (id) => (
  /** @type {HTMLButtonElement} */
  requiredElement(id)
), $requiredAnchor = (id) => (
  /** @type {HTMLAnchorElement} */
  requiredElement(id)
), $requiredInput = (id) => (
  /** @type {HTMLInputElement} */
  requiredElement(id)
), $requiredSelect = (id) => (
  /** @type {HTMLSelectElement} */
  requiredElement(id)
), $requiredTextarea = (id) => (
  /** @type {HTMLTextAreaElement} */
  requiredElement(id)
), $requiredImage = (id) => (
  /** @type {HTMLImageElement} */
  requiredElement(id)
);
function eventTargetElement(target) {
  return target instanceof Element ? target : null;
}

// src/js/03-runtime-context.js
import { catalogSearch } from "./catalog-search.js";
import { siteRoutes } from "./site-routes.js";
var catalogs = Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];

// src/js/11-navigation-state.js
var LIGHTBOX_SOURCE_CATALOG = "catalog", LIGHTBOX_SOURCE_FAVORITES = "favorites", navigationState = {
  catalog: null,
  page: 1,
  lightboxSource: LIGHTBOX_SOURCE_CATALOG
}, shellElements = Object.freeze({
  splash: $("splashScreen"),
  catalogsSection: requiredElement("catalogs")
});

// src/js/17-catalog-asset-urls.js
function catalogAssetBaseUrl() {
  let rawBase = String(window.BARGIG_CATALOG_ASSET_BASE_URL || "").trim();
  return rawBase ? rawBase.endsWith("/") ? rawBase : `${rawBase}/` : "";
}
function isAbsoluteAssetUrl(path) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith("//") || path.startsWith("data:");
}
function resolveCatalogAssetUrl(path) {
  let cleanPath = String(path || "").trim();
  if (!cleanPath || isAbsoluteAssetUrl(cleanPath)) return cleanPath;
  let baseUrl = catalogAssetBaseUrl();
  if (!baseUrl) return cleanPath;
  try {
    return new URL(cleanPath.replace(/^\/+/, ""), baseUrl).href;
  } catch {
    return `${baseUrl}${cleanPath.replace(/^\/+/, "")}`;
  }
}
function padCatalogPage(value) {
  return String(value).padStart(3, "0");
}
function imageExt(catalog) {
  return catalog?.imageExt || "jpg";
}
function catalogDir(catalog) {
  return resolveCatalogAssetUrl(catalog?.dir || `assets/pages/${catalog.id}`);
}
function catalogAssetVersionForTier(catalog, tier) {
  let normalizedTier = String(tier || CATALOG_IMAGE_TIER_FULL), baseVersion = String(catalog?.imageVariants?.[normalizedTier]?.version || "").trim() || String(catalog?.assetVersion || "").trim();
  return baseVersion ? `${baseVersion}-${normalizedTier}-u${2}` : "";
}
function withAssetVersion(url, catalog, tier = CATALOG_IMAGE_TIER_FULL) {
  let version = catalogAssetVersionForTier(catalog, tier);
  return version ? `${url}${url.includes("?") ? "&" : "?"}${"v"}=${encodeURIComponent(version)}` : url;
}
function pageSrc(catalog, page) {
  return withAssetVersion(
    `${catalogDir(catalog)}/page-${padCatalogPage(displayPageToAssetPage(catalog, page))}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_FULL
  );
}
function thumbSrc(catalog, page) {
  return withAssetVersion(
    `${catalogDir(catalog)}/thumbs/page-${padCatalogPage(displayPageToAssetPage(catalog, page))}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_THUMB
  );
}
function coverThumbSrc(catalog) {
  return thumbSrc(catalog, catalogFirstPage(catalog));
}

// src/js/00-navigation.js
var currentAppPage = siteRoutes.pageFromLocation(window.location, document.body?.dataset?.page), IN_DOCUMENT_ROUTE_STATE_KEY = "__bargigInDocumentRoute", hasInDocumentRouteSession = !1;
function isAppPage(page) {
  return currentAppPage === page;
}
function setCurrentAppPage(page) {
  currentAppPage = siteRoutes.normalizePage(page), document.body && (document.body.dataset.page = currentAppPage);
}
function historyStateWithRouteData(values = {}) {
  return { ...history.state && typeof history.state == "object" ? history.state : {}, [IN_DOCUMENT_ROUTE_STATE_KEY]: !0, ...values };
}
function saveCurrentRouteScrollPosition() {
  window.history?.replaceState && history.replaceState(historyStateWithRouteData({
    scrollX: window.scrollX || 0,
    scrollY: window.scrollY || 0
  }), "", window.location.href);
}
function isInternalAppDocumentUrl(url) {
  return !!(url && siteRoutes.isSameAppDocumentLocation(window.location, url, currentAppPage));
}
function canNavigateWithinCurrentDocument(url) {
  return !!(featureCapabilities.viewer && getFeatureInterface("viewer")?.usesInDocumentFullscreenNavigation?.() && isInternalAppDocumentUrl(url));
}
function navigateWithinCurrentDocument(url, options = {}) {
  hasInDocumentRouteSession = !0, saveCurrentRouteScrollPosition();
  let nextState = historyStateWithRouteData({ scrollX: 0, scrollY: 0 }), sameUrl = url.href === window.location.href;
  options.replace || sameUrl ? history.replaceState(nextState, "", url.href) : history.pushState(nextState, "", url.href), requireFeatureInterface("app-shell").renderRoute({ scrollPosition: { x: 0, y: 0 } });
}
function navigateTo(relativeUrl, options = {}) {
  let target = String(relativeUrl || "").trim();
  if (!target) return;
  let targetUrl = null;
  try {
    targetUrl = new URL(target, document.baseURI || window.location.href);
  } catch {
    targetUrl = null;
  }
  if (targetUrl && canNavigateWithinCurrentDocument(targetUrl)) {
    navigateWithinCurrentDocument(targetUrl, options);
    return;
  }
  options.replace ? window.location.replace(targetUrl?.href || target) : window.location.assign(targetUrl?.href || target);
}
function navigateBack() {
  window.history.back();
}
function handleInternalAppLinkClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !featureCapabilities.viewer || !getFeatureInterface("viewer")?.usesInDocumentFullscreenNavigation?.()) return;
  let link = eventTargetElement(event.target)?.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download") || link.target && link.target !== "_self") return;
  let targetUrl = null;
  try {
    targetUrl = new URL(link.href, window.location.href);
  } catch {
    return;
  }
  targetUrl.pathname === window.location.pathname && targetUrl.search === window.location.search && targetUrl.hash && targetUrl.hash !== window.location.hash || !canNavigateWithinCurrentDocument(targetUrl) || (event.preventDefault(), navigateWithinCurrentDocument(targetUrl));
}
function markAppReady() {
  document.body?.setAttribute("data-app-ready", "true");
}
function canReturnToSameSite() {
  if (!document.referrer) return !1;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch {
    return !1;
  }
}
function homeDocumentUrl() {
  return siteRoutes.homeUrl();
}
function catalogDocumentUrl(catalogId) {
  return siteRoutes.catalogUrl(catalogId);
}
function favoritesDocumentUrl() {
  return siteRoutes.favoritesUrl();
}
function viewerDocumentUrl(catalogId, page = 1, options = {}) {
  let parsedPage = Number.parseInt(String(page), 10), routePage = Number.isFinite(parsedPage) && parsedPage >= 0 ? parsedPage : 1;
  return siteRoutes.viewerUrl(catalogId, routePage, options);
}
function categoryDocumentUrl(categorySlugValue, subcategorySlugValue = "") {
  return siteRoutes.categoryUrl(categorySlugValue, subcategorySlugValue);
}
function absoluteDocumentUrl(relativeUrl) {
  return new URL(relativeUrl, document.baseURI || window.location.href).href;
}
function setMetadataContent(selector, value, attribute = "content") {
  let element = document.querySelector(selector);
  element && value && element.setAttribute(attribute, value);
}
function currentDocumentMetadata(catalog = navigationState?.catalog || null) {
  let brand = "רהיטי ברגיג";
  return isAppPage("catalog") && catalog ? {
    title: `${catalog.title} | קטלוג ריהוט | ${brand}`,
    description: `${catalog.description || "קטלוג ריהוט"}. צפייה נוחה ב־${catalog.pages} עמודי הקטלוג.`,
    url: absoluteDocumentUrl(catalogDocumentUrl(catalog.id)),
    image: coverThumbSrc(catalog),
    imageAlt: `שער ${catalog.title}`
  } : isAppPage("viewer") && catalog ? {
    title: `${catalog.title} — עמוד ${navigationState.page} | ${brand}`,
    description: `צפייה בעמוד ${navigationState.page} מתוך ${catalogLastPage(catalog)} בקטלוג ${catalog.title}.`,
    url: absoluteDocumentUrl(viewerDocumentUrl(catalog.id, navigationState.page)),
    image: pageSrc(catalog, navigationState.page),
    imageAlt: `${catalog.title} — עמוד ${navigationState.page}`
  } : isAppPage("favorites") ? {
    title: `המועדפים שלי | ${brand}`,
    description: "עמודי הקטלוג ששמרת במועדפים, עם הערות, סינון ושיתוף מרוכז.",
    url: absoluteDocumentUrl(favoritesDocumentUrl())
  } : {
    title: `קטלוגים | ${brand}`,
    description: "גלריית הקטלוגים של רהיטי ברגיג — בחירת קטלוג, חיפוש מהיר ופתיחה נוחה.",
    url: absoluteDocumentUrl(homeDocumentUrl())
  };
}
function updateDocumentMetadata(catalog = navigationState?.catalog || null) {
  let metadata = currentDocumentMetadata(catalog);
  document.title = metadata.title, setMetadataContent('meta[name="description"]', metadata.description), setMetadataContent('link[rel="canonical"]', metadata.url, "href"), setMetadataContent('meta[property="og:title"]', metadata.title), setMetadataContent('meta[property="og:description"]', metadata.description), setMetadataContent('meta[property="og:url"]', metadata.url), setMetadataContent('meta[name="twitter:title"]', metadata.title), setMetadataContent('meta[name="twitter:description"]', metadata.description), metadata.image && (setMetadataContent('meta[property="og:image"]', metadata.image), setMetadataContent('meta[property="og:image:secure_url"]', metadata.image), setMetadataContent('meta[property="og:image:alt"]', metadata.imageAlt || metadata.title), setMetadataContent('meta[name="twitter:image"]', metadata.image), setMetadataContent('meta[name="twitter:image:alt"]', metadata.imageAlt || metadata.title));
}
function attachNavigationEvents() {
  document.addEventListener("click", handleInternalAppLinkClick), window.addEventListener("popstate", (event) => {
    let routeState = event.state && typeof event.state == "object" ? event.state : null;
    !hasInDocumentRouteSession && !routeState?.[IN_DOCUMENT_ROUTE_STATE_KEY] || (hasInDocumentRouteSession = !0, requireFeatureInterface("app-shell").renderRoute({
      scrollPosition: {
        x: routeState?.scrollX || 0,
        y: routeState?.scrollY || 0
      }
    }));
  }), window.addEventListener("hashchange", () => {
    isAppPage("home") && getFeatureInterface("catalog-grid")?.syncCategoryFocusFromHash?.();
  });
}

// src/js/18-navigation-feature.js
function syncDocumentRouteShell(nextPage) {
  let showCatalogs = nextPage === "home";
  shellElements.catalogsSection.classList.toggle("hidden", !showCatalogs), showCatalogs ? (shellElements.catalogsSection.removeAttribute("aria-hidden"), shellElements.catalogsSection.classList.add("in-view")) : shellElements.catalogsSection.setAttribute("aria-hidden", "true");
}
function restoreDocumentRouteScroll(position = null) {
  if (!position) return;
  let x = Number.isFinite(Number(position.x)) ? Number(position.x) : 0, y = Number.isFinite(Number(position.y)) ? Number(position.y) : 0;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.scrollTo(x, y));
  });
}
registerFeatureInterface("navigation", {
  catalog: () => navigationState.catalog,
  page: () => navigationState.page,
  source: () => navigationState.lightboxSource,
  setLocation: (catalog, page = void 0, source = navigationState.lightboxSource) => {
    navigationState.catalog = catalog, navigationState.page = clampCatalogPage(page, catalog), navigationState.lightboxSource = String(source || LIGHTBOX_SOURCE_CATALOG);
  },
  setPage: (page) => {
    navigationState.page = clampCatalogPage(page, navigationState.catalog);
  },
  setSource: (source) => {
    navigationState.lightboxSource = String(source || LIGHTBOX_SOURCE_CATALOG);
  },
  clearLocation: () => {
    navigationState.catalog = null, navigationState.page = 1, navigationState.lightboxSource = LIGHTBOX_SOURCE_CATALOG;
  },
  setAppPage: setCurrentAppPage,
  appPage: () => currentAppPage,
  syncRouteShell: syncDocumentRouteShell,
  restoreScroll: restoreDocumentRouteScroll,
  attachEvents: attachNavigationEvents
});
function navigationFeature() {
  let feature = getFeatureInterface("navigation");
  if (!feature) throw new Error("Navigation feature is not registered");
  return feature;
}
function activeCatalog() {
  return navigationFeature().catalog();
}
function activePage() {
  return navigationFeature().page();
}
function activeViewerSource() {
  return navigationFeature().source();
}
function setActiveLocation(catalog, page = void 0, source = activeViewerSource()) {
  navigationFeature().setLocation(catalog, page, source);
}
function setActivePage(page) {
  navigationFeature().setPage(page);
}
function setActiveViewerSource(source) {
  navigationFeature().setSource(source);
}
function clearActiveLocation() {
  navigationFeature().clearLocation();
}

// src/js/30-favorites-share.js
import { normalizeItems as normalizeFavoriteItems } from "./favorites-store.js";

// src/js/14-favorites-state.js
import { createStore } from "./favorites-store.js";
var FAVORITES_SHARE_PARAM = "selection", FAVORITES_SHARE_VERSION = 2, FAVORITES_NOTE_MAX_LENGTH = 280;
function getFavoritesStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
var favoritesStore = createStore({ storage: getFavoritesStorage() }), favoritesState = {
  favoritesViewerIndex: 0,
  favoritesViewerOpeningHash: "",
  favoritesViewerPreviousCatalog: null,
  favoritesViewerPreviousPage: 1,
  favoritesOpen: !1,
  favoritesReturnFocus: null,
  favoritesTransferPending: null,
  favoritesTransferReturnFocus: null,
  favoritesFilterCatalogId: "",
  favoritesSelectedKeys: /* @__PURE__ */ new Set(),
  favoritesDragKey: "",
  favoriteNoteEditingKey: "",
  favoriteNoteReturnFocus: null
}, favoritesElements = Object.freeze({
  headerFavoritesButton: $requiredAnchor("headerFavoritesButton"),
  headerFavoritesCount: requiredElement("headerFavoritesCount"),
  headerCopyLink: $requiredButton("headerCopyLink"),
  lightboxFavoritesButton: $requiredAnchor("lightboxFavoritesButton"),
  lightboxFavoritesCount: requiredElement("lightboxFavoritesCount"),
  lightboxFavoritesSeparator: requiredElement("lightboxFavoritesSeparator"),
  favoritesPanel: requiredElement("favoritesPanel"),
  favoritesBackdrop: requiredElement("favoritesBackdrop"),
  favoritesCloseButton: $requiredButton("favoritesCloseButton"),
  favoritesClearButton: $requiredButton("favoritesClearButton"),
  favoritesShareButton: $requiredButton("favoritesShareButton"),
  favoritesShareLabel: requiredElement("favoritesShareLabel"),
  favoritesInquiryButton: $requiredButton("favoritesInquiryButton"),
  favoritesInquiryLabel: requiredElement("favoritesInquiryLabel"),
  favoritesHeaderWorkspace: requiredElement("favoritesHeaderWorkspace"),
  favoritesGrid: requiredElement("favoritesGrid"),
  favoritesEmpty: requiredElement("favoritesEmpty"),
  favoritesFilteredEmpty: requiredElement("favoritesFilteredEmpty"),
  favoritesResetFilter: $requiredButton("favoritesResetFilter"),
  favoritesCatalogFilter: $requiredSelect("favoritesCatalogFilter"),
  favoritesVisibleCount: requiredElement("favoritesVisibleCount"),
  favoritesSelectionBar: requiredElement("favoritesSelectionBar"),
  favoritesSelectionCount: requiredElement("favoritesSelectionCount"),
  favoritesClearSelection: $requiredButton("favoritesClearSelection"),
  favoriteNoteOverlay: requiredElement("favoriteNoteOverlay"),
  favoriteNoteBackdrop: requiredElement("favoriteNoteBackdrop"),
  favoriteNoteTitle: requiredElement("favoriteNoteTitle"),
  favoriteNoteContext: requiredElement("favoriteNoteContext"),
  favoriteNoteInput: $requiredTextarea("favoriteNoteInput"),
  favoriteNoteCount: requiredElement("favoriteNoteCount"),
  favoriteNoteSave: $requiredButton("favoriteNoteSave"),
  favoriteNoteCancel: $requiredButton("favoriteNoteCancel"),
  favoriteNoteClose: $requiredButton("favoriteNoteClose"),
  favoritesTransferOverlay: requiredElement("favoritesTransferOverlay"),
  favoritesTransferBackdrop: requiredElement("favoritesTransferBackdrop"),
  favoritesTransferTitle: requiredElement("favoritesTransferTitle"),
  favoritesTransferDescription: requiredElement("favoritesTransferDescription"),
  favoritesTransferSummary: requiredElement("favoritesTransferSummary"),
  favoritesTransferMerge: $requiredButton("favoritesTransferMerge"),
  favoritesTransferReplace: $requiredButton("favoritesTransferReplace"),
  favoritesTransferCancel: $requiredButton("favoritesTransferCancel"),
  favoriteOpenCatalogButton: $requiredButton("favoriteOpenCatalogButton"),
  viewerFavoriteButton: $requiredButton("viewerFavoriteButton"),
  viewerMobileFavoritesLink: $requiredAnchor("viewerMobileFavoritesLink")
});

// src/js/15-telemetry.js
var TELEMETRY_ENDPOINT = "/api/telemetry", TELEMETRY_SCHEMA_VERSION = 3, TELEMETRY_BATCH_LIMIT = 20, TELEMETRY_QUEUE_LIMIT = 60, TELEMETRY_FLUSH_DELAY_MS = 900, TELEMETRY_SEARCH_DEDUP_MS = 1200, TELEMETRY_ALLOWED_HOSTS = /* @__PURE__ */ new Set([
  "bargig-furniture.com",
  "www.bargig-furniture.com"
]), TELEMETRY_EVENT_NAMES = /* @__PURE__ */ new Set([
  "app_session",
  "catalog_open",
  "search",
  "favorite",
  "contact",
  "js_error",
  "resource_error",
  "search_index_load_failed",
  "image_attempt_failed",
  "image_recovered",
  "image_terminal_failure",
  "web_vital"
]), telemetryRuntime = {
  enabled: (
    /** @type {boolean|null} */
    null
  ),
  queue: (
    /** @type {Array<Record<string, string|number>>} */
    []
  ),
  flushTimer: 0,
  flushing: !1,
  catalogKey: "",
  catalogAt: 0,
  searchKeys: /* @__PURE__ */ new Map(),
  diagnosticEvents: /* @__PURE__ */ new Set(),
  webVitals: {
    supported: /* @__PURE__ */ new Set(),
    reported: /* @__PURE__ */ new Set(),
    lcp: 0,
    lcpComponent: "unknown",
    inp: 0,
    cls: 0,
    clsComponent: "unknown",
    clsSessionValue: 0,
    clsSessionStart: 0,
    clsLastEntry: 0,
    clsSessionComponents: /* @__PURE__ */ new Map(),
    interactions: /* @__PURE__ */ new Map()
  },
  initialized: !1
};
function telemetryRouteModuleUrl() {
  let routeModule = document.querySelector?.("script[type=module][data-bargig-route-module]") || null;
  return routeModule ? "src" in routeModule ? String(routeModule.src || "") : String(routeModule.getAttribute?.("src") || "") : "";
}
function telemetryResolveReleaseId(scriptSrc = telemetryRouteModuleUrl()) {
  let explicit = String(window.__BARGIG_RELEASE_ID__ || "").trim();
  if (explicit) return telemetryCleanText(explicit, 64);
  let filename = String(scriptSrc || "").split("?")[0].split("#")[0].split("/").pop() || "", fingerprint = filename.match(/^app(?:-(?:catalog|favorites|viewer))?\.([a-f0-9]{8,64})\.js$/i)?.[1];
  return fingerprint ? `app-${fingerprint.slice(0, 16).toLowerCase()}` : /^app(?:-(?:catalog|favorites|viewer))?\.js$/i.test(filename) ? "app-unversioned" : "unknown-release";
}
var TELEMETRY_RELEASE_ID = telemetryResolveReleaseId();
function telemetryCleanText(value, limit = 120) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, limit);
}
function telemetryCleanPathname(value = window.location.pathname) {
  let pathname = telemetryCleanText(value, 180) || "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}
function telemetryCleanToken(value, limit = 50) {
  return telemetryCleanText(value, limit).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-").slice(0, limit);
}
var TELEMETRY_IMAGE_VISIBILITY = /* @__PURE__ */ new Set(["visible", "hidden", "preload", "background", "unknown"]);
function telemetryCleanVisibility(value) {
  let visibility = telemetryCleanToken(value, 20);
  return TELEMETRY_IMAGE_VISIBILITY.has(visibility) ? visibility : "unknown";
}
function telemetryCleanRequestId(value) {
  let requestId = telemetryCleanToken(value, 48);
  return /^ir-[a-z0-9-]{8,45}$/.test(requestId) ? requestId : "";
}
function telemetryViewportBucket() {
  let width = Math.max(0, Number(window.innerWidth) || 0);
  return width < 480 ? "xs" : width < 760 ? "sm" : width < 1100 ? "md" : width < 1600 ? "lg" : "xl";
}
function telemetryViewportValue(value) {
  let viewport = telemetryCleanToken(value, 12);
  return ["xs", "sm", "md", "lg", "xl"].includes(viewport) ? viewport : telemetryViewportBucket();
}
function telemetryPrivacySignalEnabled() {
  if (navigator.globalPrivacyControl === !0) return !0;
  let dnt = String(navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack || "").toLowerCase();
  return dnt === "1" || dnt === "yes";
}
function telemetryIsEnabled() {
  if (telemetryRuntime.enabled !== null) return telemetryRuntime.enabled;
  if (window.__BARGIG_DISABLE_TELEMETRY__ === !0 || telemetryPrivacySignalEnabled())
    return telemetryRuntime.enabled = !1, !1;
  let forced = window.__BARGIG_ENABLE_TELEMETRY__ === !0, productionHost = TELEMETRY_ALLOWED_HOSTS.has(window.location.hostname.toLowerCase());
  return telemetryRuntime.enabled = !!(forced || productionHost), telemetryRuntime.enabled;
}
function telemetryNumber(value, min = 0, max = 864e5) {
  let number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : 0;
}
function telemetryErrorFingerprint(parts) {
  let source = parts.map((part) => telemetryCleanText(part, 160)).join("|"), hash = 2166136261;
  for (let index = 0; index < source.length; index += 1)
    hash ^= source.charCodeAt(index), hash = Math.imul(hash, 16777619);
  return `e${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function telemetryNormalizeEvent(name, fields = {}) {
  let eventName = telemetryCleanText(name, 40);
  return TELEMETRY_EVENT_NAMES.has(eventName) ? {
    name: eventName,
    page: telemetryCleanText(fields.page || currentAppPage || document.body?.dataset?.page || "", 30),
    path: telemetryCleanPathname(fields.path),
    catalogId: telemetryCleanText(fields.catalogId, 100),
    query: telemetryCleanText(fields.query, 80),
    scope: telemetryCleanText(fields.scope, 50),
    action: telemetryCleanText(fields.action, 50),
    detail: telemetryCleanText(fields.detail, 120),
    error: telemetryCleanText(fields.error, 80),
    viewport: telemetryViewportValue(fields.viewport),
    source: telemetryCleanText(fields.source, 50),
    value: telemetryNumber(fields.value, -1e6, 1e6),
    durationMs: telemetryNumber(fields.durationMs),
    pageNumber: telemetryNumber(fields.pageNumber, 0, 1e5),
    secondaryValue: telemetryNumber(fields.secondaryValue, -1e6, 1e6),
    releaseId: telemetryCleanText(fields.releaseId || TELEMETRY_RELEASE_ID, 64),
    component: telemetryCleanToken(fields.component || "", 50),
    surface: telemetryCleanToken(fields.surface || "", 50),
    requestId: telemetryCleanRequestId(fields.requestId),
    visibility: telemetryCleanVisibility(fields.visibility)
  } : null;
}
function telemetryScheduleFlush(delay = TELEMETRY_FLUSH_DELAY_MS) {
  window.clearTimeout(telemetryRuntime.flushTimer), telemetryRuntime.flushTimer = window.setTimeout(() => {
    telemetryRuntime.flushTimer = 0, telemetryFlush().catch(() => {
    });
  }, Math.max(0, delay));
}
function telemetryTrack(name, fields = {}, options = {}) {
  if (!telemetryIsEnabled()) return !1;
  let event = telemetryNormalizeEvent(name, fields);
  return event ? (telemetryRuntime.queue.length >= TELEMETRY_QUEUE_LIMIT && telemetryRuntime.queue.splice(0, telemetryRuntime.queue.length - TELEMETRY_QUEUE_LIMIT + 1), telemetryRuntime.queue.push(event), telemetryScheduleFlush(options.immediate ? 0 : TELEMETRY_FLUSH_DELAY_MS), !0) : !1;
}
async function telemetryFlush(options = {}) {
  if (!telemetryIsEnabled() || telemetryRuntime.flushing || !telemetryRuntime.queue.length) return !1;
  window.clearTimeout(telemetryRuntime.flushTimer), telemetryRuntime.flushTimer = 0;
  let events = telemetryRuntime.queue.splice(0, TELEMETRY_BATCH_LIMIT), body = JSON.stringify({ version: TELEMETRY_SCHEMA_VERSION, events });
  telemetryRuntime.flushing = !0;
  try {
    if (options.beacon && typeof navigator.sendBeacon == "function") {
      let queued = navigator.sendBeacon(TELEMETRY_ENDPOINT, new Blob([body], { type: "application/json" }));
      return queued || telemetryRuntime.queue.unshift(...events), queued;
    }
    let response = await fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      cache: "no-store",
      keepalive: !0,
      redirect: "error"
    });
    if (!response.ok && response.status !== 202 && response.status !== 204)
      throw new Error(`telemetry-http-${response.status}`);
    return !0;
  } catch {
    return !1;
  } finally {
    telemetryRuntime.flushing = !1, telemetryRuntime.queue.length && telemetryScheduleFlush(250);
  }
}
function telemetryTrackCatalogOpen(catalog, page, source = LIGHTBOX_SOURCE_CATALOG) {
  if (!catalog) return;
  let now = Date.now(), key = `${catalog.id}|${source}`;
  key === telemetryRuntime.catalogKey && now - telemetryRuntime.catalogAt < 1200 || (telemetryRuntime.catalogKey = key, telemetryRuntime.catalogAt = now, telemetryTrack("catalog_open", {
    page: "viewer",
    catalogId: catalog.id,
    pageNumber: page,
    source
  }));
}
function telemetryTrackSearch(query, resultCount, options = {}) {
  if (!telemetryIsEnabled()) return !1;
  let cleanQuery = telemetryCleanText(query, 80);
  if (cleanQuery.length < 2) return !1;
  let surface = telemetryCleanText(options.surface || "global", 30), scope = telemetryCleanText(options.scope || "all", 50), catalogId = telemetryCleanText(options.catalogId, 100), completion = telemetryCleanText(options.completion || "submit", 30), count = Math.max(0, Number(resultCount) || 0), key = `${surface}|${cleanQuery}|${count}|${scope}|${catalogId}|${completion}`, now = Date.now(), previous = telemetryRuntime.searchKeys.get(key) || 0;
  if (now - previous < TELEMETRY_SEARCH_DEDUP_MS) return !1;
  if (telemetryRuntime.searchKeys.set(key, now), telemetryRuntime.searchKeys.size > 80)
    for (let [storedKey, timestamp] of telemetryRuntime.searchKeys)
      now - timestamp > 6e4 && telemetryRuntime.searchKeys.delete(storedKey);
  return telemetryTrack("search", {
    query: cleanQuery,
    scope,
    catalogId,
    source: surface,
    action: completion,
    value: count
  }, { immediate: options.immediate === !0 });
}
function telemetryTrackFavorite(action, catalogId = "", pageNumber = 0, count = 0) {
  telemetryTrack("favorite", {
    action,
    catalogId,
    pageNumber,
    value: count
  });
}
function telemetryTrackAppSession() {
  return telemetryTrack("app_session", {
    action: telemetryNavigationType(),
    visibility: document.visibilityState === "hidden" ? "hidden" : "visible"
  }, { immediate: !0 });
}
var TELEMETRY_COMPONENT_SELECTORS = Object.freeze([
  ["[data-telemetry-component]", ""],
  ["#lightboxImageFrame, #lightboxStage, #lightbox", "viewer-stage"],
  ["#lightboxBar, .lightbox-top-shell", "viewer-toolbar"],
  ["#lightboxPageRail, .lightbox-page-rail", "viewer-thumbnail-rail"],
  ["#catalogSearch, .global-search-popover", "global-search"],
  ["#globalSearchResults, .search-results", "global-search-results"],
  ["#catalogGrid, .catalog-category-list", "catalog-grid"],
  ["#pageGrid, .page-grid", "catalog-page-grid"],
  ["#catalogDetail, .catalog-detail", "catalog-detail"],
  ["#favoritesPanel, .favorites-panel", "favorites-panel"],
  [".site-header", "site-header"],
  [".site-footer", "site-footer"],
  ["main, #main-content", "main-content"],
  ["img", "image"],
  ["video", "video"],
  ["iframe", "frame"]
]);
function telemetryComponentToken(node) {
  let element = typeof Element == "function" && node instanceof Element ? node : typeof Element == "function" && node?.parentElement instanceof Element ? node.parentElement : null;
  if (!element) return "unknown";
  for (let [selector, fixedToken] of TELEMETRY_COMPONENT_SELECTORS) {
    let matched = element.closest?.(selector);
    if (matched) {
      if (!fixedToken) {
        let explicit = telemetryCleanToken(matched.getAttribute?.("data-telemetry-component"), 50);
        if (explicit) return explicit;
        continue;
      }
      return fixedToken;
    }
  }
  return telemetryCleanToken(element.tagName || "element", 30) || "unknown";
}
function telemetryRectSignal(rect) {
  if (!rect) return 0;
  let width = Math.max(0, Number(rect.width) || 0), height = Math.max(0, Number(rect.height) || 0), x = Number(rect.x ?? rect.left) || 0, y = Number(rect.y ?? rect.top) || 0;
  return width * height + Math.abs(x) + Math.abs(y);
}
function telemetryDominantLayoutShiftComponent(entry) {
  let sources = Array.isArray(entry?.sources) ? entry.sources : [], token = "unknown", bestScore = -1;
  for (let source of sources) {
    let current = telemetryRectSignal(source.currentRect), previous = telemetryRectSignal(source.previousRect), score = Math.max(current, previous) + Math.abs(current - previous);
    score <= bestScore || (bestScore = score, token = telemetryComponentToken(source.node));
  }
  return token;
}
function telemetryDominantSessionComponent(components) {
  let token = "unknown", value = -1;
  for (let [candidate, contribution] of components)
    contribution <= value || (token = candidate, value = contribution);
  return token;
}
var TELEMETRY_WEB_VITAL_THRESHOLDS = Object.freeze({
  LCP: [2500, 4e3],
  INP: [200, 500],
  CLS: [0.1, 0.25]
});
function telemetryWebVitalRating(name, value) {
  let thresholds = TELEMETRY_WEB_VITAL_THRESHOLDS[name];
  return thresholds ? value <= thresholds[0] ? "good" : value <= thresholds[1] ? "needs-improvement" : "poor" : "unknown";
}
function telemetryNavigationType() {
  let navigation = performance.getEntriesByType?.("navigation")?.[0];
  return telemetryCleanText(navigation?.type || "navigate", 30);
}
function telemetryWebVitalsSnapshot() {
  let runtime = telemetryRuntime.webVitals;
  return {
    LCP: Math.max(0, Number(runtime.lcp) || 0),
    INP: Math.max(0, Number(runtime.inp) || 0),
    CLS: Math.max(0, Number(runtime.cls) || 0)
  };
}
function telemetryPublishWebVitalsDiagnostics() {
  window.__BARGIG_ENABLE_VITALS_DIAGNOSTICS__ === !0 && (window.__BARGIG_WEB_VITALS__ = telemetryWebVitalsSnapshot());
}
function telemetryRecordInteractionTiming(entry) {
  let interactionId = Number(entry?.interactionId) || 0;
  if (!interactionId) return;
  let runtime = telemetryRuntime.webVitals, duration = Math.max(0, Number(entry?.duration) || 0);
  if (runtime.interactions.set(interactionId, Math.max(duration, runtime.interactions.get(interactionId) || 0)), runtime.interactions.size > 300) {
    let oldest = runtime.interactions.keys().next().value;
    oldest !== void 0 && runtime.interactions.delete(oldest);
  }
  let candidates = Array.from(runtime.interactions.values()).sort((left, right) => right - left), candidateIndex = Math.min(candidates.length - 1, Math.floor(candidates.length / 50));
  runtime.inp = candidates[candidateIndex] || 0, telemetryPublishWebVitalsDiagnostics();
}
function telemetryReportWebVitals() {
  let runtime = telemetryRuntime.webVitals;
  for (
    let name of
    /** @type {TelemetryWebVitalName[]} */
    ["LCP", "INP", "CLS"]
  ) {
    if (!runtime.supported.has(name) || runtime.reported.has(name)) continue;
    let snapshot = telemetryWebVitalsSnapshot(), value = Number(snapshot[name]);
    !Number.isFinite(value) || value < 0 || (name === "LCP" || name === "INP") && value === 0 || (runtime.reported.add(name), telemetryTrack("web_vital", {
      action: name,
      detail: telemetryWebVitalRating(name, value),
      source: telemetryNavigationType(),
      component: name === "CLS" ? runtime.clsComponent : name === "LCP" ? runtime.lcpComponent : "",
      value
    }, { immediate: !0 }));
  }
}
function telemetryObserveWebVitals() {
  if (typeof PerformanceObserver != "function") return;
  let supported = new Set(PerformanceObserver.supportedEntryTypes || []), runtime = telemetryRuntime.webVitals;
  if (supported.has("largest-contentful-paint")) {
    runtime.supported.add("LCP");
    try {
      new PerformanceObserver((list) => {
        let entries = list.getEntries(), latest = (
          /** @type {TelemetryLcpEntry|undefined} */
          entries[entries.length - 1]
        );
        latest && (runtime.lcp = Math.max(0, Number(latest.startTime) || 0), runtime.lcpComponent = telemetryComponentToken(latest.element)), telemetryPublishWebVitalsDiagnostics();
      }).observe({ type: "largest-contentful-paint", buffered: !0 });
    } catch {
    }
  }
  if (supported.has("layout-shift")) {
    runtime.supported.add("CLS");
    try {
      new PerformanceObserver((list) => {
        for (let rawEntry of list.getEntries()) {
          let entry = (
            /** @type {TelemetryLayoutShiftEntry} */
            rawEntry
          );
          if (entry.hadRecentInput) continue;
          let start = Number(entry.startTime) || 0, value = Number(entry.value) || 0;
          runtime.clsLastEntry && start - runtime.clsLastEntry < 1e3 && start - runtime.clsSessionStart < 5e3 ? runtime.clsSessionValue += value : (runtime.clsSessionValue = value, runtime.clsSessionStart = start, runtime.clsSessionComponents.clear());
          let component = telemetryDominantLayoutShiftComponent(entry);
          runtime.clsSessionComponents.set(
            component,
            (runtime.clsSessionComponents.get(component) || 0) + value
          ), runtime.clsLastEntry = start, runtime.clsSessionValue >= runtime.cls && (runtime.cls = runtime.clsSessionValue, runtime.clsComponent = telemetryDominantSessionComponent(runtime.clsSessionComponents)), telemetryPublishWebVitalsDiagnostics();
        }
      }).observe({ type: "layout-shift", buffered: !0 });
    } catch {
    }
  }
  if (supported.has("event")) {
    runtime.supported.add("INP");
    try {
      new PerformanceObserver((list) => {
        for (let entry of list.getEntries()) telemetryRecordInteractionTiming(entry);
      }).observe({ type: "event", buffered: !0, durationThreshold: 16 });
    } catch {
    }
  }
}
function telemetryCatalogImageContext(img, src = "") {
  let value = String(src || img?.currentSrc || img?.getAttribute?.("src") || ""), match = value.match(/\/assets\/pages\/([^/]+)\/(?:thumbs\/)?page-(\d+)/i), catalogId = telemetryCleanText(match?.[1] || img?.dataset?.catalogId || activeCatalog()?.id || "", 100), pageNumber = Number.parseInt(String(match?.[2] || img?.dataset?.page || activePage() || 0), 10) || 0, detail = "image";
  return /\/thumbs\//i.test(value) ? detail = "thumbnail" : img?.id === "lightboxImage" ? detail = "viewer" : img?.classList?.contains("catalog-cover") && (detail = "cover"), { catalogId, pageNumber, detail, value };
}
function telemetryCreateRequestId() {
  let bytes = new Uint8Array(8);
  return globalThis.crypto?.getRandomValues ? (globalThis.crypto.getRandomValues(bytes), `ir-${Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("")}`) : `ir-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
function telemetryImageVisibility(img, surface) {
  let cleanSurface = telemetryCleanToken(surface, 50);
  if (!img || /(?:^|-)preload(?:-|$)|background|buffer/.test(cleanSurface)) return "preload";
  if (img.dataset?.telemetryVisibility) return telemetryCleanVisibility(img.dataset.telemetryVisibility);
  if (img.isConnected === !1) return "background";
  if (typeof img.getBoundingClientRect != "function") return "unknown";
  let rect = img.getBoundingClientRect(), width = Math.max(0, Number(rect?.width) || 0), height = Math.max(0, Number(rect?.height) || 0);
  if (!width || !height) return "hidden";
  let viewportWidth = Math.max(0, Number(window.innerWidth) || 0), viewportHeight = Math.max(0, Number(window.innerHeight) || 0);
  return Number(rect.bottom) > 0 && Number(rect.right) > 0 && Number(rect.top) < viewportHeight && Number(rect.left) < viewportWidth ? "visible" : "hidden";
}
function telemetryCreateImageRequestContext(img, src = "", options = {}) {
  let image = telemetryCatalogImageContext(img, src), surface = telemetryCleanToken(options.surface || img?.dataset?.telemetrySurface || image.detail, 50) || "image";
  return Object.freeze({
    requestId: telemetryCleanRequestId(options.requestId) || telemetryCreateRequestId(),
    catalogId: image.catalogId,
    pageNumber: image.pageNumber,
    detail: telemetryCleanText(options.detail || img?.dataset?.telemetryDetail || image.detail, 50),
    surface,
    visibility: telemetryCleanVisibility(options.visibility || telemetryImageVisibility(img, surface)),
    page: telemetryCleanText(currentAppPage || document.body?.dataset?.page || "", 30),
    path: telemetryCleanPathname(),
    viewport: telemetryViewportBucket(),
    releaseId: TELEMETRY_RELEASE_ID
  });
}
function telemetryStableResourceUrl(value) {
  let raw = String(value || "").trim();
  if (!raw) return "";
  try {
    let parsed = new URL(raw, window.location.href);
    return parsed.hash = "", parsed.searchParams.delete(CATALOG_IMAGE_RETRY_PARAM), parsed.href;
  } catch {
    return raw.replace(new RegExp(`([?&])${CATALOG_IMAGE_RETRY_PARAM}=[^&#]*&?`, "g"), "$1").replace(/[?&]$/, "").split("#")[0];
  }
}
function telemetryResourceSourceName(value) {
  let clean = telemetryStableResourceUrl(value);
  if (!clean) return "inline";
  try {
    let parsed = new URL(clean, window.location.href);
    return ["data:", "blob:"].includes(parsed.protocol) ? parsed.protocol.slice(0, -1) : parsed.hostname.toLowerCase() === "static.cloudflareinsights.com" && /\/beacon\.min\.js(?:\/|$)/i.test(parsed.pathname) ? "beacon.min.js" : telemetryCleanText(parsed.pathname.split("/").pop() || "root", 80);
  } catch {
    return telemetryCleanText(clean.split("/").pop() || "unknown", 80);
  }
}
function telemetryResourceScope(value) {
  let clean = telemetryStableResourceUrl(value);
  if (!clean) return "inline";
  if (/^(?:chrome|moz|safari)-extension:/i.test(clean)) return "extension";
  try {
    let parsed = new URL(clean, window.location.href), hostname = parsed.hostname.toLowerCase();
    return parsed.origin === window.location.origin ? "site" : hostname === "cdn.bargig-furniture.com" ? "catalog-cdn" : hostname === "static.cloudflareinsights.com" || hostname === "cloudflareinsights.com" ? "cloudflare-observability" : hostname === "netfree.link" || hostname.endsWith(".netfree.link") ? "netfree-filter" : "external";
  } catch {
    return "unknown";
  }
}
function telemetryDiagnosticOnce(key) {
  let cleanKey = telemetryCleanText(key, 320);
  if (!cleanKey || telemetryRuntime.diagnosticEvents.has(cleanKey)) return !1;
  if (telemetryRuntime.diagnosticEvents.add(cleanKey), telemetryRuntime.diagnosticEvents.size > 240) {
    let oldest = telemetryRuntime.diagnosticEvents.values().next().value;
    oldest !== void 0 && telemetryRuntime.diagnosticEvents.delete(oldest);
  }
  return !0;
}
function telemetryTrackImageEvent(name, src, options = {}) {
  let context = options.requestContext || telemetryCreateImageRequestContext(options.img, src, options), detail = telemetryCleanText(options.detail || context.detail, 50), action = telemetryCleanText(options.action || "", 50), stableUrl = telemetryStableResourceUrl(src || options.img?.currentSrc || options.img?.src || ""), source = telemetryResourceSourceName(stableUrl), eventKey = [name, context.requestId, detail, action, source].join("|");
  return telemetryDiagnosticOnce(eventKey) ? telemetryTrack(name, {
    page: context.page,
    path: context.path,
    catalogId: context.catalogId,
    pageNumber: context.pageNumber,
    detail,
    action,
    source,
    viewport: context.viewport,
    releaseId: context.releaseId,
    surface: context.surface,
    requestId: context.requestId,
    visibility: context.visibility,
    value: telemetryNumber(options.failedAttempts ?? options.attempt ?? options.value, 0, 100),
    error: telemetryErrorFingerprint([name, context.catalogId, context.pageNumber, context.surface, detail, action, source])
  }, { immediate: !0 }) : !1;
}
function telemetryTrackImageAttemptFailure(src, options = {}) {
  return telemetryTrackImageEvent("image_attempt_failed", src, options);
}
function telemetryTrackImageRecovery(src, options = {}) {
  return telemetryTrackImageEvent("image_recovered", src, options);
}
function telemetryTrackImageTerminalFailure(src, options = {}) {
  return telemetryTrackImageEvent("image_terminal_failure", src, options);
}
function telemetryErrorSourceScope(filename) {
  let value = String(filename || "").toLowerCase();
  if (!value) return "inline";
  if (/^(?:chrome|moz|safari)-extension:/.test(value)) return "extension";
  try {
    return new URL(value, window.location.href).origin === window.location.origin ? "site" : "external";
  } catch {
    return "unknown";
  }
}
function telemetryIsRuntimeErrorEvent(event) {
  return event ? typeof ErrorEvent == "function" && event instanceof ErrorEvent ? !0 : Object.prototype.toString.call(event) === "[object ErrorEvent]" : !1;
}
function telemetryClassifyWindowError(event) {
  return typeof HTMLImageElement == "function" && event?.target instanceof HTMLImageElement ? "image" : telemetryIsRuntimeErrorEvent(event) ? "runtime" : typeof Element == "function" && event?.target instanceof Element ? "resource" : "ignored";
}
function telemetryTrackRuntimeError(event) {
  if (!telemetryIsRuntimeErrorEvent(event)) return !1;
  let filename = String(event.filename || ""), sourceName = telemetryResourceSourceName(filename), errorName = telemetryCleanText(event.error?.name || "Error", 40), message = telemetryCleanText(event.message || event.error?.message || "JavaScript error", 120);
  return telemetryTrack("js_error", {
    catalogId: activeCatalog()?.id || "",
    action: errorName,
    detail: message,
    scope: telemetryErrorSourceScope(filename),
    source: sourceName,
    pageNumber: Number(event.lineno) || 0,
    secondaryValue: Number(event.colno) || 0,
    error: telemetryErrorFingerprint([errorName, message, sourceName, event.lineno, event.colno])
  }, { immediate: !0 });
}
function telemetryResourceElementUrl(target) {
  if (!target) return "";
  let resource = (
    /** @type {TelemetryResourceElement} */
    target
  );
  return String(resource.currentSrc || resource.src || resource.href || resource.data || "");
}
function telemetryResourceRole(target) {
  if (!target) return "resource";
  let explicit = target instanceof HTMLElement ? telemetryCleanText(target.dataset.telemetryResourceRole, 50) : "";
  if (explicit) return explicit;
  if (target instanceof HTMLElement && target.dataset.searchIndexSrc) return "search-index";
  let tag = String(target.tagName || "").toLowerCase();
  if (target instanceof HTMLLinkElement) {
    let rel = telemetryCleanText(target.rel || target.getAttribute("rel") || "link", 24), asType = telemetryCleanText(target.as || target.getAttribute("as") || "", 24);
    return asType ? `${rel}:${asType}` : rel;
  }
  return tag || "resource";
}
function telemetryTrackSearchIndexFailure(reason, options = {}) {
  let src = String(options.src || telemetryResourceElementUrl(options.target) || SEARCH_INDEX_SCRIPT_SRC || ""), source = telemetryResourceSourceName(src), action = telemetryCleanText(reason || "load-error", 50), targetTrigger = options.target instanceof HTMLElement ? options.target.dataset.telemetrySearchTrigger : "", detail = telemetryCleanText(options.trigger || targetTrigger || "unknown", 50), scope = telemetryErrorSourceScope(src), key = ["search_index_load_failed", source, action, scope, detail].join("|");
  return telemetryDiagnosticOnce(key) ? telemetryTrack("search_index_load_failed", {
    action,
    detail,
    scope,
    source,
    error: telemetryErrorFingerprint(["search-index", action, source, scope])
  }, { immediate: !0 }) : !1;
}
function telemetryTrackResourceError(target) {
  let src = telemetryResourceElementUrl(target), role = telemetryResourceRole(target);
  if (role === "search-index")
    return telemetryTrackSearchIndexFailure("network-error", { target, src });
  let tag = telemetryCleanText(String(target?.tagName || "resource").toLowerCase(), 30), source = telemetryResourceSourceName(src), scope = telemetryResourceScope(src), key = ["resource_error", tag, role, source, scope].join("|");
  return telemetryDiagnosticOnce(key) ? telemetryTrack("resource_error", {
    action: tag,
    detail: role,
    scope,
    source,
    error: telemetryErrorFingerprint(["resource", tag, role, source, scope])
  }, { immediate: !0 }) : !1;
}
function telemetryTrackUnhandledRejection(event) {
  let reason = event?.reason, errorName = telemetryCleanText(reason?.name || "UnhandledRejection", 40), message = telemetryCleanText(reason?.message || reason || "Unhandled promise rejection", 120);
  telemetryTrack("js_error", {
    catalogId: activeCatalog()?.id || "",
    action: errorName,
    detail: message,
    scope: "promise",
    error: telemetryErrorFingerprint([errorName, message, "promise"]),
    source: "promise"
  }, { immediate: !0 });
}
function telemetryHandleDocumentClick(event) {
  let link = eventTargetElement(event.target)?.closest("a[href]");
  if (!(link instanceof HTMLAnchorElement)) return;
  let href = String(link.getAttribute("href") || "").trim(), action = telemetryCleanText(link.dataset.contactAction, 50);
  !action && href.startsWith("tel:") ? action = "phone" : !action && href.startsWith("mailto:") ? action = "email" : !action && (link.classList.contains("site-footer-gmail-link") || /mail\.google\.com/i.test(href)) && (action = "gmail"), action && telemetryTrack("contact", {
    action,
    source: link.dataset.contactSource || "footer",
    catalogId: link.dataset.contactCatalogId || "",
    pageNumber: link.dataset.contactPage || 0
  }, { immediate: !0 });
}
function telemetryInit(options = {}) {
  telemetryRuntime.initialized || (telemetryRuntime.initialized = !0, telemetryIsEnabled() && (telemetryTrackAppSession(), window.addEventListener("error", (event) => {
    let classification = telemetryClassifyWindowError(event);
    if (classification === "image") {
      let image = event.target instanceof HTMLImageElement ? event.target : null;
      if (!image) return;
      if (image.dataset.telemetryManaged !== "true") {
        if (options.recoverCatalogImageAfterInitialFailure?.(image)) return;
        let requestContext = telemetryCreateImageRequestContext(image, image.currentSrc || image.src, {
          detail: telemetryCatalogImageContext(image).detail,
          surface: image.dataset.telemetrySurface || "unmanaged-image"
        });
        telemetryTrackImageTerminalFailure(image.currentSrc || image.src, {
          img: image,
          requestContext,
          action: "unmanaged",
          failedAttempts: 1
        });
      }
      return;
    }
    if (classification === "runtime") {
      telemetryTrackRuntimeError(event);
      return;
    }
    classification === "resource" && telemetryTrackResourceError(eventTargetElement(event.target));
  }, !0), window.addEventListener("unhandledrejection", telemetryTrackUnhandledRejection), document.addEventListener("click", telemetryHandleDocumentClick, !0), telemetryObserveWebVitals(), document.addEventListener("visibilitychange", () => {
    document.visibilityState === "hidden" && (telemetryReportWebVitals(), telemetryFlush({ beacon: !0 }).catch(() => {
    }));
  }), window.addEventListener("pagehide", () => {
    telemetryReportWebVitals(), telemetryFlush({ beacon: !0 }).catch(() => {
    });
  })));
}

// src/js/20-shared-ui.js
import { tooltips } from "./tooltip-manager.js";
var uiElements = Object.freeze({
  siteActionToast: requiredElement("siteActionToast")
});
function isHtmlElement(value) {
  return value instanceof HTMLElement;
}
function focusHtmlElement(value, options) {
  return value instanceof HTMLElement ? (value.focus(options), !0) : !1;
}
function catalogImageCrossOriginAttribute(_url = "") {
  return "";
}
function applyCatalogImageCrossOrigin(img) {
  img && img.removeAttribute("crossorigin");
}
function setCatalogImageSource(img, url) {
  img && (applyCatalogImageCrossOrigin(img), img.src = url);
}
function networkInformation() {
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}
function isSaveDataEnabled() {
  return !!networkInformation()?.saveData;
}
function catalogImageDeliveryMode() {
  return String(window.BARGIG_CATALOG_IMAGE_DELIVERY_MODE || "").trim().toLowerCase() === CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY ? CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY : CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE;
}
function catalogMediumImagesEnabled() {
  return catalogImageDeliveryMode() === CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE;
}
function networkEffectiveType() {
  return String(networkInformation()?.effectiveType || "").trim().toLowerCase();
}
function catalogNeighborPreloadRadius() {
  if (isSaveDataEnabled()) return 1;
  let effectiveType = networkEffectiveType();
  return effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g" || !catalogMediumImagesEnabled() ? 1 : 2;
}
function normalizeCatalogImageUrl(url) {
  let value = String(url || "").trim();
  if (!value) return "";
  try {
    let parsed = new URL(value, window.location.href);
    return parsed.searchParams.delete(CATALOG_IMAGE_RETRY_PARAM), parsed.href;
  } catch {
    return value.replace(new RegExp(`([?&])${CATALOG_IMAGE_RETRY_PARAM}=[^&#]*&?`, "g"), "$1").replace(/[?&]$/, "");
  }
}
function unversionedCatalogImageUrl(url) {
  let value = normalizeCatalogImageUrl(url);
  if (!value) return "";
  try {
    let parsed = new URL(value, window.location.href);
    return parsed.searchParams.delete("v"), parsed.href;
  } catch {
    return value.replace(new RegExp(`([?&])${"v"}=[^&#]*&?`, "g"), "$1").replace(/[?&]$/, "");
  }
}
function cacheBustedCatalogImageUrl(url) {
  let value = normalizeCatalogImageUrl(url);
  if (!value) return "";
  try {
    let parsed = new URL(value, window.location.href);
    return parsed.searchParams.set(CATALOG_IMAGE_RETRY_PARAM, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`), parsed.href;
  } catch {
    let separator = value.includes("?") ? "&" : "?";
    return `${value}${separator}${CATALOG_IMAGE_RETRY_PARAM}=${Date.now()}`;
  }
}
function catalogImageRecoveryCandidates(primarySrc, fallbackSrc = "", options = {}) {
  let primary = normalizeCatalogImageUrl(primarySrc), fallback = normalizeCatalogImageUrl(fallbackSrc), candidates = [], push = (src, role, tier = "") => {
    !src || candidates.some((candidate) => candidate.src === src) || candidates.push({ src, role, tier, fallback: role.startsWith("fallback") });
  }, primaryTier = String(options.primaryTier || "");
  push(
    options.forceRefresh ? cacheBustedCatalogImageUrl(primary) : primary,
    options.forceRefresh ? String(options.forceRefreshRole || "manual") : "primary",
    primaryTier
  );
  let unversionedPrimary = unversionedCatalogImageUrl(primary);
  return unversionedPrimary && unversionedPrimary !== primary && push(cacheBustedCatalogImageUrl(unversionedPrimary), "direct-retry", primaryTier), fallback && fallback !== primary && push(fallback, "fallback", String(options.fallbackTier || "")), (Array.isArray(options.fallbackCandidates) ? options.fallbackCandidates : []).forEach((candidate, index) => {
    !candidate || typeof candidate != "object" || push(
      normalizeCatalogImageUrl(candidate.src),
      String(candidate.role || `fallback-${index + 1}`),
      String(candidate.tier || "")
    );
  }), candidates;
}
function loadCatalogImageWithRecovery(img, options = {}) {
  let candidates = catalogImageRecoveryCandidates(options.primarySrc, options.fallbackSrc, options), isCurrent = typeof options.isCurrent == "function" ? options.isCurrent : () => !0, telemetryDetail = telemetryCleanText(options.telemetryDetail, 40), telemetryRequestContext = options.telemetryRequestContext || (telemetryDetail ? telemetryCreateImageRequestContext(img, options.primarySrc || options.fallbackSrc || "", {
    detail: telemetryDetail,
    surface: options.telemetrySurface,
    visibility: options.telemetryVisibility
  }) : null), index = 0, stopped = !1, failedAttempts = Math.max(0, Number(options.initialFailedAttempts) || 0), lastCandidate = null;
  img.dataset.telemetryManaged = "true";
  let attempt = () => {
    if (stopped || !isCurrent() || index >= candidates.length) {
      !stopped && isCurrent() && (telemetryDetail && lastCandidate && telemetryTrackImageTerminalFailure(lastCandidate.src, {
        img,
        requestContext: telemetryRequestContext,
        action: lastCandidate.role,
        failedAttempts
      }), options.onExhausted?.({ failedAttempts, lastCandidate }));
      return;
    }
    let candidate = candidates[index++];
    lastCandidate = candidate, img.dataset.imageLoadPending = "true", prepareImagePlaceholder(img);
    let settled = !1, settle = (loaded) => {
      if (!settled && (settled = !0, delete img.dataset.imageLoadPending, !(stopped || !isCurrent() || img.getAttribute("src") !== candidate.src))) {
        if (loaded && img.naturalWidth > 0) {
          syncImagePlaceholderState(img), telemetryDetail && failedAttempts > 0 && telemetryTrackImageRecovery(candidate.src, {
            img,
            requestContext: telemetryRequestContext,
            action: candidate.role,
            failedAttempts
          }), options.onSuccess?.(candidate, { failedAttempts, attempts: index });
          return;
        }
        failedAttempts += 1, telemetryDetail && telemetryTrackImageAttemptFailure(candidate.src, {
          img,
          requestContext: telemetryRequestContext,
          detail: `${telemetryDetail}-${candidate.role}`,
          action: candidate.role,
          attempt: failedAttempts
        }), options.onFailure?.(candidate, { failedAttempts, attempts: index }), attempt();
      }
    };
    img.addEventListener("load", () => settle(!0), { once: !0 }), img.addEventListener("error", () => settle(!1), { once: !0 }), options.onAttempt?.(candidate, { failedAttempts, attempts: index }), setCatalogImageSource(img, candidate.src), img.complete && queueMicrotask(() => settle(!!img.naturalWidth));
  };
  return attempt(), () => {
    stopped = !0;
  };
}
function catalogImageRecoveryAttributes(catalog, page, detail = "thumbnail", surface = detail) {
  let catalogId = escapeHtml(catalog?.id || ""), safePage = Math.max(0, Number.parseInt(String(page), 10) || 0), safeDetail = escapeHtml(detail || "thumbnail"), safeSurface = escapeHtml(surface || detail || "image");
  return ` data-catalog-image-recovery="lightweight" data-catalog-id="${catalogId}" data-page="${safePage}" data-telemetry-detail="${safeDetail}" data-telemetry-surface="${safeSurface}"`;
}
function recoverCatalogImageAfterInitialFailure(img) {
  if (!img || img.dataset.catalogImageRecovery !== "lightweight") return !1;
  if (img.dataset.catalogImageRecoveryStarted === "true") return !0;
  let failedSrc = String(img.currentSrc || img.getAttribute("src") || "");
  if (!failedSrc) return !1;
  let detail = telemetryCleanText(img.dataset.telemetryDetail || telemetryCatalogImageContext(img).detail, 40), requestContext = telemetryCreateImageRequestContext(img, failedSrc, {
    detail,
    surface: img.dataset.telemetrySurface || detail
  });
  img.dataset.catalogImageRecoveryStarted = "true", telemetryTrackImageAttemptFailure(failedSrc, {
    img,
    requestContext,
    detail: `${detail}-primary`,
    action: "primary",
    attempt: 1
  });
  let directRetrySrc = unversionedCatalogImageUrl(failedSrc) || normalizeCatalogImageUrl(failedSrc);
  return loadCatalogImageWithRecovery(img, {
    primarySrc: directRetrySrc,
    forceRefresh: !0,
    forceRefreshRole: "direct-retry",
    initialFailedAttempts: 1,
    telemetryDetail: detail,
    telemetryRequestContext: requestContext,
    isCurrent: () => img.isConnected !== !1,
    onExhausted: () => syncImagePlaceholderState(img)
  }), !0;
}
function catalogImagePreparationAbortError(reason = "image-load-aborted") {
  let error = new Error(reason);
  return error.name = "AbortError", error;
}
function prepareCatalogImage(url, options = {}) {
  let src = String(url || "");
  if (!src) return Promise.reject(new Error("missing-image-src"));
  let signal = options.signal || null, isCurrent = typeof options.isCurrent == "function" ? options.isCurrent : () => !0, useCache = options.cache !== !1 && !signal && typeof options.isCurrent != "function", cached = useCache ? catalogAssetState.imageLoadCache.get(src) : null;
  if (cached) return cached;
  let image = new Image(), requestContext = options.telemetryRequestContext || telemetryCreateImageRequestContext(null, src, {
    detail: options.detail || "preload",
    surface: options.surface || options.detail || "image-preload",
    visibility: options.visibility || "preload"
  });
  applyCatalogImageCrossOrigin(image), image.decoding = "async", image.fetchPriority = options.priority || "auto";
  let promise = new Promise((resolve, reject) => {
    let settled = !1, cleanup = () => {
      image.removeEventListener("load", handleLoad), image.removeEventListener("error", handleError), signal?.removeEventListener("abort", handleAbort);
    }, rejectOnce = (error) => {
      settled || (settled = !0, cleanup(), useCache && catalogAssetState.imageLoadCache.delete(src), reject(error));
    }, handleAbort = () => {
      if (!settled) {
        settled = !0, cleanup(), useCache && catalogAssetState.imageLoadCache.delete(src);
        try {
          image.removeAttribute("src");
        } catch {
        }
        reject(catalogImagePreparationAbortError());
      }
    }, handleLoad = async () => {
      if (!settled) {
        if (typeof image.decode == "function")
          try {
            await image.decode();
          } catch {
          }
        if (!settled) {
          if (signal?.aborted || !isCurrent()) {
            rejectOnce(catalogImagePreparationAbortError("image-load-superseded"));
            return;
          }
          settled = !0, cleanup(), resolve({
            width: Number(image.naturalWidth) || 0,
            height: Number(image.naturalHeight) || 0
          });
        }
      }
    }, handleError = () => {
      if (!settled) {
        if (signal?.aborted || !isCurrent()) {
          rejectOnce(catalogImagePreparationAbortError("image-load-superseded"));
          return;
        }
        telemetryTrackImageAttemptFailure(src, {
          requestContext,
          detail: options.detail || "preload",
          action: options.failureAction || "preload",
          attempt: 1
        }), options.terminalOnFailure !== !1 && telemetryTrackImageTerminalFailure(src, {
          requestContext,
          detail: options.detail || "preload",
          action: options.failureAction || "preload",
          failedAttempts: 1
        }), rejectOnce(new Error("image-load-failed"));
      }
    };
    if (image.addEventListener("load", handleLoad, { once: !0 }), image.addEventListener("error", handleError, { once: !0 }), signal?.addEventListener("abort", handleAbort, { once: !0 }), signal?.aborted) {
      handleAbort();
      return;
    }
    image.src = src;
  });
  if (useCache) {
    if (catalogAssetState.imageLoadCache.size >= 24) {
      let oldestSrc = catalogAssetState.imageLoadCache.keys().next().value;
      oldestSrc && catalogAssetState.imageLoadCache.delete(oldestSrc);
    }
    catalogAssetState.imageLoadCache.set(src, promise);
  }
  return promise;
}
function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function pad(value) {
  return String(value).padStart(3, "0");
}
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function catalogCategoryName(catalog) {
  return String(catalog?.category || "").trim() || "קטלוגים";
}
function catalogSubcategoryName(catalog) {
  return String(catalog?.subcategory || "").trim();
}
function categorySlug(value) {
  return String(value || "catalog").trim().toLowerCase().replace(/[^a-z0-9\u0590-\u05ff]+/g, "-").replace(/^-+|-+$/g, "") || "catalog";
}
function categorySectionId(category, index) {
  return `catalog-category-${categorySlug(category)}-${index + 1}`;
}
function subcategorySectionId(category, categoryIndex, subcategory, subcategoryIndex) {
  return `${categorySectionId(category, categoryIndex)}-sub-${categorySlug(subcategory)}-${subcategoryIndex + 1}`;
}
var catalogTaxonomy = window.BARGIG_CATALOG_TAXONOMY || { categories: [], subcategories: [] }, CATALOG_CATEGORY_SHARE_SLUGS = new Map(
  (Array.isArray(catalogTaxonomy.categories) ? catalogTaxonomy.categories : []).map((item) => (
    /** @type {[string, string]} */
    [String(item?.name || "").trim(), String(item?.slug || "").trim()]
  )).filter(([name, slug]) => name && slug)
), CATALOG_SUBCATEGORY_SHARE_SLUGS = new Map(
  (Array.isArray(catalogTaxonomy.subcategories) ? catalogTaxonomy.subcategories : []).map((item) => (
    /** @type {[string, string]} */
    [String(item?.name || "").trim(), String(item?.slug || "").trim()]
  )).filter(([name, slug]) => name && slug)
);
function normalizeShareRouteToken(value) {
  return String(value || "").trim().toLowerCase().replace(/['"`]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function normalizeShareRoutePath(value) {
  return String(value || "").split("/").map(normalizeShareRouteToken).filter(Boolean).join("/");
}
function categoryShareSlug(category, index) {
  let mapped = CATALOG_CATEGORY_SHARE_SLUGS.get(String(category || "").trim());
  return normalizeShareRouteToken(mapped) || normalizeShareRouteToken(category) || `category-${index + 1}`;
}
function subcategoryShareSlug(subcategory, index) {
  let mapped = CATALOG_SUBCATEGORY_SHARE_SLUGS.get(String(subcategory || "").trim());
  return normalizeShareRouteToken(mapped) || normalizeShareRouteToken(subcategory) || `sub-${index + 1}`;
}
function catalogCategorySharePath(category, index) {
  return categoryShareSlug(category, index);
}
function catalogSubcategorySharePath(category, categoryIndex, subcategory, subcategoryIndex) {
  return `${categoryShareSlug(category, categoryIndex)}/${subcategoryShareSlug(subcategory, subcategoryIndex)}`;
}
function getCatalogCategoryGroups() {
  let groups = [], groupByCategory = /* @__PURE__ */ new Map();
  return catalogs.forEach((catalog) => {
    let category = catalogCategoryName(catalog);
    if (!groupByCategory.has(category)) {
      let group2 = {
        category,
        items: [],
        directItems: [],
        subcategories: [],
        subcategoryMap: /* @__PURE__ */ new Map()
      };
      groupByCategory.set(category, group2), groups.push(group2);
    }
    let group = groupByCategory.get(category);
    if (!group) return;
    let subcategory = catalogSubcategoryName(catalog);
    if (group.items.push(catalog), !subcategory) {
      group.directItems.push(catalog);
      return;
    }
    if (!group.subcategoryMap?.has(subcategory)) {
      let subcategoryGroup = { subcategory, items: [] };
      group.subcategoryMap?.set(subcategory, subcategoryGroup), group.subcategories.push(subcategoryGroup);
    }
    group.subcategoryMap?.get(subcategory)?.items.push(catalog);
  }), groups.forEach((group) => {
    group.hasSubcategories = group.subcategories.length > 0, delete group.subcategoryMap;
  }), groups;
}
function catalogImageVariant(catalog, tier) {
  if (tier === CATALOG_IMAGE_TIER_MEDIUM && !catalogMediumImagesEnabled()) return null;
  let variants = catalog?.imageVariants;
  if (variants && typeof variants == "object" && variants[tier] && typeof variants[tier] == "object")
    return variants[tier];
  if (tier === CATALOG_IMAGE_TIER_THUMB) return { directory: "thumbs", maxSide: 420 };
  if (tier === CATALOG_IMAGE_TIER_FULL) {
    let size = pageSize(catalog, catalogFirstPage(catalog));
    return { directory: "", maxSide: size ? Math.max(size.width, size.height) : 2800 };
  }
  return null;
}
function catalogSupportsImageTier(catalog, tier) {
  return !!catalogImageVariant(catalog, tier);
}
function catalogImageTierMaxSide(catalog, tier) {
  let value = Number(catalogImageVariant(catalog, tier)?.maxSide);
  return Number.isFinite(value) && value > 0 ? value : tier === CATALOG_IMAGE_TIER_MEDIUM ? 1600 : 0;
}
function mediumSrc(catalog, page) {
  let variant = catalogImageVariant(catalog, CATALOG_IMAGE_TIER_MEDIUM);
  if (!variant) return "";
  let directory = String(variant.directory || "medium").trim().replace(/^\/+|\/+$/g, "") || "medium";
  return withAssetVersion(
    `${catalogDir(catalog)}/${directory}/page-${pad(displayPageToAssetPage(catalog, page))}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_MEDIUM
  );
}
function catalogPageImageSrc(catalog, page, tier) {
  return tier === CATALOG_IMAGE_TIER_THUMB ? thumbSrc(catalog, page) : tier === CATALOG_IMAGE_TIER_MEDIUM ? mediumSrc(catalog, page) : pageSrc(catalog, page);
}
function pageSize(catalog, page) {
  let sizes = Array.isArray(catalog?.pageSizes) ? catalog.pageSizes : [], assetPage = displayPageToAssetPage(catalog, page), size = sizes[assetPage - 1];
  if (!Array.isArray(size) || size.length < 2) return null;
  let width = Number(size[0]), height = Number(size[1]);
  return !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ? null : { width, height };
}
function catalogPagesShareAspectRatio(firstCatalog, firstPage, secondCatalog, secondPage) {
  let firstSize = pageSize(firstCatalog, firstPage), secondSize = pageSize(secondCatalog, secondPage);
  if (!firstSize || !secondSize) return !1;
  let firstRatio = firstSize.width / firstSize.height, secondRatio = secondSize.width / secondSize.height;
  return Math.abs(firstRatio - secondRatio) <= 1e-3;
}
function catalogImageDimensionAttributes(catalog, page) {
  let size = pageSize(catalog, page);
  return size ? ` width="${size.width}" height="${size.height}"` : "";
}
function applyCatalogImageDimensions(image, catalog, page) {
  if (!image) return;
  let size = pageSize(catalog, page);
  if (!size) {
    image.removeAttribute("width"), image.removeAttribute("height");
    return;
  }
  image.width = size.width, image.height = size.height;
}
function catalogCoverLoadingAttributes(catalog) {
  let index = catalogs.findIndex((item) => item?.id === catalog?.id);
  return index >= 0 && index < 2 ? ' loading="eager" decoding="async" fetchpriority="high"' : ' loading="lazy" decoding="async" fetchpriority="low"';
}
function pageAspectStyle(catalog, page) {
  let size = pageSize(catalog, page);
  return size ? ` style="aspect-ratio: ${size.width} / ${size.height}"` : "";
}
function pageAspectVariableStyle(catalog, page, variableName = "--page-aspect-ratio") {
  let size = pageSize(catalog, page);
  return size ? ` style="${variableName}: ${size.width} / ${size.height}"` : "";
}
function clampPage(page, catalog = activeCatalog()) {
  return clampCatalogPage(page, catalog);
}
function getTooltipText(button) {
  return tooltips.getText(button || null) || button?.getAttribute?.("title") || "";
}
function setTooltipText(button, text, options = {}) {
  button && tooltips.setText(button, text, options);
}
function flashActionButton(button, message) {
  if (!(button instanceof HTMLElement) || !message) return;
  let originalTooltip = getTooltipText(button);
  setTooltipText(button, message), button.classList.remove("reader-icon-button-feedback"), button.offsetWidth, button.classList.add("reader-icon-button-done", "reader-icon-button-feedback"), window.setTimeout(() => {
    setTooltipText(button, originalTooltip), button.classList.remove("reader-icon-button-done", "reader-icon-button-feedback");
  }, 1200);
}
function actionToastTone(message) {
  return message === "נשמר" || message === "התמונה נשמרה" ? "saved" : message === "הוסר" || message.includes("הוסרו") ? "removed" : message.includes("קישור") ? "link" : "info";
}
function showActionToast(message, options = {}) {
  if (!uiElements.siteActionToast || !message) return;
  let normalizedOptions = typeof options == "number" ? { duration: options } : options, duration = Math.max(1e3, Number(normalizedOptions.duration) || 1e3);
  window.clearTimeout(uiRuntime.actionToastTimer), uiElements.siteActionToast.textContent = message, uiElements.siteActionToast.dataset.tone = normalizedOptions.tone || actionToastTone(message), uiElements.siteActionToast.classList.remove("hidden", "visible"), uiElements.siteActionToast.offsetWidth, window.requestAnimationFrame(() => uiElements.siteActionToast.classList.add("visible")), uiRuntime.actionToastTimer = window.setTimeout(() => {
    uiElements.siteActionToast.classList.remove("visible"), window.setTimeout(() => {
      uiElements.siteActionToast.classList.contains("visible") || uiElements.siteActionToast.classList.add("hidden");
    }, 180);
  }, duration);
}
var IMAGE_PLACEHOLDER_FRAME_SELECTOR = [
  ".catalog-image-frame",
  ".lightbox-image-frame",
  ".search-result-thumb-frame",
  ".reader-search-thumb-frame",
  ".favorite-image-frame",
  ".lightbox-page-thumb-frame",
  ".reader-page-frame",
  ".reader-page-thumb-frame"
].join(", ");
function imagePlaceholderFrame(img) {
  if (img?.dataset?.placeholderIgnore === "true") return null;
  let frame = img?.closest?.(IMAGE_PLACEHOLDER_FRAME_SELECTOR) || null;
  return frame instanceof HTMLElement ? frame : null;
}
function syncImagePlaceholderState(img) {
  let frame = imagePlaceholderFrame(img);
  if (!frame) return;
  frame.classList.add("image-placeholder-frame");
  let pending = img.dataset.imageLoadPending === "true", isReady = !pending && !!(img.complete && img.naturalWidth > 0), isError = !pending && !!(img.complete && !img.naturalWidth && (img.currentSrc || img.getAttribute("src")));
  frame.classList.toggle("image-ready", isReady), frame.classList.toggle("image-error", isError), frame.classList.toggle("image-loading", pending || !isReady && !isError);
}
function prepareImagePlaceholder(img) {
  let frame = imagePlaceholderFrame(img);
  if (frame) {
    if (frame.classList.add("image-placeholder-frame"), img.dataset.imageLoadPending === "true") {
      frame.classList.remove("image-ready", "image-error"), frame.classList.add("image-loading");
      return;
    }
    if (img.complete) {
      syncImagePlaceholderState(img);
      return;
    }
    frame.classList.remove("image-ready", "image-error"), frame.classList.add("image-loading");
  }
}
function initImagePlaceholderObserver() {
  if (document.querySelectorAll(`${IMAGE_PLACEHOLDER_FRAME_SELECTOR} img`).forEach((image) => {
    image instanceof HTMLImageElement && prepareImagePlaceholder(image);
  }), document.addEventListener("load", (event) => {
    event.target instanceof HTMLImageElement && syncImagePlaceholderState(event.target);
  }, !0), document.addEventListener("error", (event) => {
    event.target instanceof HTMLImageElement && syncImagePlaceholderState(event.target);
  }, !0), !("MutationObserver" in window) || !document.body) return;
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes" && mutation.target instanceof HTMLImageElement) {
        prepareImagePlaceholder(mutation.target);
        return;
      }
      mutation.addedNodes.forEach((node) => {
        node instanceof Element && (node instanceof HTMLImageElement && prepareImagePlaceholder(node), node.querySelectorAll?.("img").forEach((image) => {
          image instanceof HTMLImageElement && prepareImagePlaceholder(image);
        }));
      });
    });
  }).observe(document.body, {
    subtree: !0,
    childList: !0,
    attributes: !0,
    attributeFilter: ["src", "data-src"]
  });
}
function hasHoverPointer() {
  if (typeof window.matchMedia != "function") return !0;
  let primaryFineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches, anyFineHover = window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;
  return primaryFineHover || anyFineHover;
}
function isTouchLikePointer(event) {
  return !!(event && "pointerType" in event && (event.pointerType === "touch" || event.pointerType === "pen"));
}
function encodeHashRouteSegment(value) {
  return encodeURIComponent(String(value ?? ""));
}
function decodeHashRouteSegment(value) {
  let segment = String(value || "");
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
function encodeShareRoutePath(path) {
  let normalizedPath = normalizeShareRoutePath(path);
  return normalizedPath ? normalizedPath.split("/").map(encodeHashRouteSegment).join("/") : "";
}
function buildCategoryShareRouteHash(path) {
  let encodedPath = encodeShareRoutePath(path);
  return encodedPath ? `#cat/${encodedPath}` : "";
}
function findCatalogById(id) {
  let catalogId = String(id || "");
  return catalogs.find((item) => String(item.id || "") === catalogId) || null;
}
function syncDocumentLock() {
  let documentLocked = !!(getFeatureInterface("favorites")?.requiresDocumentLock() || getFeatureInterface("inquiry")?.requiresDocumentLock() || getFeatureInterface("viewer")?.requiresDocumentLock()), viewerOpen = !!getFeatureInterface("viewer")?.isViewerOpen();
  document.body.classList.toggle("no-scroll", documentLocked), document.documentElement.classList.toggle("viewer-open", viewerOpen);
}
function handleTopLayerEscape(event) {
  if (event.key !== "Escape" || event.defaultPrevented) return !1;
  for (let api of featureInterfacesByEscapePriority())
    if (api.closeTopLayer(event) === !0)
      return event.preventDefault(), !0;
  return !1;
}

// src/js/29-favorites-portability.js
function createFavoritesPortabilityDomain(dependencies) {
  let {
    normalizeItems,
    findCatalogById: findCatalog,
    catalogs: readCatalogs,
    encodeBase64,
    decodeBase64,
    shareVersion
  } = dependencies;
  function favoriteItemKey(item) {
    let catalogId = String(item?.catalogId || item?.catalog?.id || "").trim(), page = Number.parseInt(String(item?.page ?? ""), 10);
    return catalogId && Number.isFinite(page) && page >= 0 ? `${catalogId}\0${page}` : "";
  }
  function normalizeFavoriteTransferItems(values) {
    let normalized = normalizeItems(values), accepted = [], rejected = Math.max(0, Array.isArray(values) ? values.length - normalized.length : 0);
    return normalized.forEach((item) => {
      let catalog = findCatalog(item.catalogId);
      if (!catalog || !isCatalogPage(catalog, item.page)) {
        rejected += 1;
        return;
      }
      accepted.push({
        catalogId: item.catalogId,
        page: item.page,
        savedAt: Number(item.savedAt) > 0 ? Number(item.savedAt) : 0
      });
    }), { items: accepted, rejected };
  }
  function analyzeFavoriteItemMerge(incoming, existing) {
    let incomingItems = normalizeFavoriteTransferItems(incoming).items, existingItems = normalizeItems(existing), existingByKey = new Map(existingItems.map((item) => [favoriteItemKey(item), item])), incomingKeys = new Set(incomingItems.map(favoriteItemKey).filter(Boolean)), newItems = incomingItems.filter((item) => !existingByKey.has(favoriteItemKey(item))), alreadyExistingItems = incomingItems.filter((item) => existingByKey.has(favoriteItemKey(item))), mergedIncomingItems = incomingItems.map((item) => {
      let existingItem = existingByKey.get(favoriteItemKey(item));
      return existingItem ? {
        ...item,
        savedAt: Number(existingItem.savedAt) > 0 ? Number(existingItem.savedAt) : Number(item.savedAt) || 0,
        ...String(existingItem.note || "").trim() ? { note: String(existingItem.note).trim() } : {}
      } : item;
    }), preservedExistingItems = existingItems.filter((item) => !incomingKeys.has(favoriteItemKey(item)));
    return {
      incomingItems,
      existingItems,
      newItems,
      alreadyExistingItems,
      mergedItems: [...mergedIncomingItems, ...preservedExistingItems]
    };
  }
  function encodeBase64UrlUtf8(value) {
    let bytes = new TextEncoder().encode(String(value || "")), binary = "", chunkSize = 32768;
    for (let offset = 0; offset < bytes.length; offset += chunkSize)
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    return encodeBase64(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  function decodeBase64UrlUtf8(value) {
    let normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/"), padding = "=".repeat((4 - normalized.length % 4) % 4), binary = decodeBase64(`${normalized}${padding}`), bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  function canonicalizeFavoriteShareItems(items) {
    let normalized = normalizeFavoriteTransferItems(items).items.map(({ catalogId, page }) => ({ catalogId, page, savedAt: 0 })), catalogOrder = new Map(readCatalogs().map((catalog, index) => [String(catalog.id || ""), index]));
    return normalized.sort((first, second) => {
      let firstIndex = catalogOrder.get(first.catalogId) ?? Number.MAX_SAFE_INTEGER, secondIndex = catalogOrder.get(second.catalogId) ?? Number.MAX_SAFE_INTEGER;
      return firstIndex !== secondIndex ? firstIndex - secondIndex : first.catalogId.localeCompare(second.catalogId, "he") || first.page - second.page;
    });
  }
  function encodeFavoritePageRanges(pages) {
    let sorted = [...new Set(pages.map((page) => Number.parseInt(String(page), 10)).filter((page) => Number.isFinite(page) && page >= 0))].sort((first, second) => first - second), ranges = [];
    for (let index = 0; index < sorted.length; ) {
      let start = sorted[index], end = start;
      for (; index + 1 < sorted.length && sorted[index + 1] === end + 1; )
        index += 1, end = sorted[index];
      let encodedStart = start.toString(36);
      ranges.push(end === start ? encodedStart : `${encodedStart}-${end.toString(36)}`), index += 1;
    }
    return ranges.join(",");
  }
  function decodeFavoritePageRanges(value) {
    let pages = [];
    return String(value || "").split(",").forEach((part) => {
      if (!part) return;
      let [rawStart, rawEnd = rawStart] = part.split("-", 2), start = Number.parseInt(rawStart, 36), end = Number.parseInt(rawEnd, 36);
      if (!(!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start || end - start > 1e3))
        for (let page = start; page <= end; page += 1) pages.push(page);
    }), pages;
  }
  function buildFavoritesShareToken(items) {
    let grouped = /* @__PURE__ */ new Map();
    canonicalizeFavoriteShareItems(items).forEach(({ catalogId, page }) => {
      let pages = grouped.get(catalogId) || [];
      pages.push(page), grouped.set(catalogId, pages);
    });
    let payload = [...grouped.entries()].map(([catalogId, pages]) => `${encodeURIComponent(catalogId)}~${encodeFavoritePageRanges(pages)}`).join("|");
    return `v${shareVersion}.${encodeBase64UrlUtf8(payload)}`;
  }
  function parseFavoritesShareToken(token) {
    let rawToken = String(token || "").trim(), prefix = `v${shareVersion}.`;
    if (!rawToken.startsWith(prefix)) return { items: [], rejected: 0, valid: !1 };
    try {
      let payload = decodeBase64UrlUtf8(rawToken.slice(prefix.length)), rawItems = [];
      return payload && payload.split("|").forEach((group) => {
        let separatorIndex = group.indexOf("~");
        if (separatorIndex < 1) return;
        let catalogId = decodeURIComponent(group.slice(0, separatorIndex));
        decodeFavoritePageRanges(group.slice(separatorIndex + 1)).forEach((page) => {
          rawItems.push({ catalogId, page, savedAt: 0 });
        });
      }), { ...normalizeFavoriteTransferItems(rawItems), valid: !0 };
    } catch {
      return { items: [], rejected: 0, valid: !1 };
    }
  }
  function favoritesTransferSummary(pending, existing) {
    if (!pending) return "";
    let comparison = analyzeFavoriteItemMerge(pending.items, existing), incomingCount = comparison.incomingItems.length, currentCount = comparison.existingItems.length, newCount = comparison.newItems.length, alreadyExistingCount = comparison.alreadyExistingItems.length, rejectedText = pending.rejected ? ` · ${pending.rejected} פריטים לא היו זמינים באתר זה` : "", existingLabel = alreadyExistingCount === 1 ? "קיים" : "קיימים", newLabel = newCount === 1 ? "חדש" : "חדשים", overlapText = alreadyExistingCount > 0 ? `
מתוכם ${alreadyExistingCount} ${existingLabel} ו-${newCount} ${newLabel}` : "";
    return `${incomingCount} פריטים ברשימה שהתקבלה · ${currentCount} פריטים שמורים כעת${rejectedText}${overlapText}`;
  }
  return Object.freeze({
    favoriteItemKey,
    analyzeFavoriteItemMerge,
    buildFavoritesShareToken,
    parseFavoritesShareToken,
    favoritesTransferSummary
  });
}

// src/js/30-favorites-share.js
function favoriteIdentity(catalog = activeCatalog(), page = activePage()) {
  return catalog ? {
    catalogId: String(catalog.id || ""),
    page: clampPage(page, catalog)
  } : null;
}
function getFavoriteEntries() {
  return favoritesStore ? favoritesStore.read().flatMap((item) => {
    let catalog = findCatalogById(item.catalogId), page = Number.parseInt(String(item.page), 10);
    return !catalog || !isCatalogPage(catalog, page) ? [] : [{ ...item, catalog, page }];
  }) : [];
}
function showFavoritePersistenceFeedback(result, messages) {
  let persisted = result?.persisted !== !1;
  return showActionToast(persisted ? messages.persisted : messages.temporary, {
    tone: persisted ? messages.tone || "saved" : "warning",
    duration: persisted ? messages.duration || 1300 : 4600
  }), persisted;
}
function warnIfFavoriteChangeIsTemporary(result) {
  !result?.changed || result.persisted !== !1 || showActionToast("השינוי נשמר זמנית בלבד — אחסון המועדפים חסום בדפדפן", {
    tone: "warning",
    duration: 4600
  });
}
function getValidFavoriteItems() {
  return getFavoriteEntries().map(({ catalogId, catalog, page, savedAt, note }) => {
    let item = {
      catalogId: String(catalogId || catalog?.id || ""),
      page,
      savedAt: Number(savedAt) > 0 ? Number(savedAt) : 0
    };
    return String(note || "").trim() && (item.note = String(note).trim()), item;
  });
}
var favoritesPortabilityDomain = createFavoritesPortabilityDomain({
  normalizeItems: normalizeFavoriteItems,
  findCatalogById,
  catalogs: () => catalogs,
  encodeBase64: (value) => window.btoa(value),
  decodeBase64: (value) => window.atob(value),
  shareVersion: FAVORITES_SHARE_VERSION
});
function buildFavoritesShareUrl(items) {
  let url = new URL(favoritesDocumentUrl(), window.location.href);
  return url.hash = "", url.searchParams.set(FAVORITES_SHARE_PARAM, favoritesPortabilityDomain.buildFavoritesShareToken(items)), url.toString();
}
function cleanFavoritesSelectionFromUrl() {
  let url = new URL(window.location.href);
  url.searchParams.has(FAVORITES_SHARE_PARAM) && (url.searchParams.delete(FAVORITES_SHARE_PARAM), window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`));
}
function syncFavoritesTransferDialogUi() {
  let pending = favoritesState.favoritesTransferPending;
  if (!pending || !favoritesElements.favoritesTransferOverlay) return;
  let existingItems = getValidFavoriteItems();
  favoritesElements.favoritesTransferTitle && (favoritesElements.favoritesTransferTitle.textContent = "רשימת מועדפים התקבלה"), favoritesElements.favoritesTransferDescription && (favoritesElements.favoritesTransferDescription.textContent = "הקישור כולל מועדפים ממחשב אחר. בחרו כיצד לשלב אותם עם הרשימה הקיימת."), favoritesElements.favoritesTransferSummary && (favoritesElements.favoritesTransferSummary.textContent = favoritesPortabilityDomain.favoritesTransferSummary(
    pending,
    existingItems
  ));
}
function openFavoritesTransferDialog(transfer, returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null) {
  return !transfer?.items?.length || !favoritesElements.favoritesTransferOverlay ? !1 : (favoritesState.favoritesTransferPending = transfer, favoritesState.favoritesTransferReturnFocus = returnFocus, syncFavoritesTransferDialogUi(), favoritesElements.favoritesTransferOverlay.classList.remove("hidden"), favoritesElements.favoritesTransferOverlay.setAttribute("aria-hidden", "false"), syncDocumentLock(), requestAnimationFrame(() => favoritesElements.favoritesTransferMerge?.focus()), !0);
}
function closeFavoritesTransferDialog(options = {}) {
  let { restoreFocus = !0, cleanUrl = !1 } = options, returnFocus = favoritesState.favoritesTransferReturnFocus;
  favoritesState.favoritesTransferPending = null, favoritesState.favoritesTransferReturnFocus = null, favoritesElements.favoritesTransferOverlay?.classList.add("hidden"), favoritesElements.favoritesTransferOverlay?.setAttribute("aria-hidden", "true"), cleanUrl && cleanFavoritesSelectionFromUrl(), syncDocumentLock(), restoreFocus && focusHtmlElement(returnFocus);
}
function applyFavoritesTransfer(mode) {
  let pending = favoritesState.favoritesTransferPending;
  if (!pending?.items?.length || !favoritesStore) return;
  let timestamp = Date.now(), incoming = pending.items.map((item, index) => ({
    ...item,
    savedAt: Number(item.savedAt) > 0 ? Number(item.savedAt) : timestamp - index
  })), comparison = favoritesPortabilityDomain.analyzeFavoriteItemMerge(incoming, getValidFavoriteItems()), nextItems = mode === "merge" ? comparison.mergedItems : incoming, mutation = favoritesStore.replaceDetailed(nextItems);
  closeFavoritesTransferDialog({ restoreFocus: !1, cleanUrl: pending.source === "link" }), syncFavoritesUi({ renderPanel: !0 }), syncFavoriteViewerAfterStoreChange();
  let verb = mode === "merge" ? "מוזגה" : "נטענה", rejectedText = pending.rejected ? ` · ${pending.rejected} לא היו זמינים` : "", resultText = mode === "merge" ? `${comparison.newItems.length} חדשים · ${comparison.alreadyExistingItems.length} כבר היו שמורים` : `${incoming.length} פריטים`;
  showFavoritePersistenceFeedback(mutation, {
    persisted: `הרשימה ${verb}: ${resultText}${rejectedText}`,
    temporary: `הרשימה ${verb} זמנית בלבד: ${resultText}${rejectedText} — האחסון חסום`,
    tone: "saved",
    duration: 2800
  }), requestAnimationFrame(() => focusHtmlElement(favoritesElements.favoritesGrid.querySelector(".favorite-card")));
}
function prepareIncomingFavoritesTransfer(transfer, options = {}) {
  let { returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null } = options;
  return !transfer?.valid || !transfer.items.length || !favoritesStore ? !1 : getValidFavoriteItems().length ? openFavoritesTransferDialog(transfer, returnFocus) : (favoritesState.favoritesTransferPending = transfer, applyFavoritesTransfer("replace"), !0);
}
function processFavoritesSelectionFromUrl() {
  if (!isAppPage("favorites")) return;
  let token = new URL(window.location.href).searchParams.get(FAVORITES_SHARE_PARAM);
  if (!token) return;
  let parsed = favoritesPortabilityDomain.parseFavoritesShareToken(token);
  if (!parsed.valid || !parsed.items.length) {
    cleanFavoritesSelectionFromUrl(), showActionToast("הקישור אינו מכיל רשימת בחירה תקינה");
    return;
  }
  prepareIncomingFavoritesTransfer({ ...parsed, source: "link" }, { returnFocus: favoritesElements.favoritesShareButton });
}
function syncFavoritesShareButton(count = getFavoriteEntries().length) {
  if (!favoritesElements.favoritesShareButton) return;
  let hasItems = count > 0;
  favoritesElements.favoritesShareButton.disabled = !hasItems, favoritesElements.favoritesShareButton.setAttribute("aria-label", hasItems ? `העתקת קישור לרשימת המועדפים, ${count} עמודים שמורים` : "העתקת קישור לרשימת המועדפים — אין עדיין עמודים שמורים");
}
async function shareFavoritesList() {
  let workspace = getFeatureInterface("favorites-workspace");
  !workspace?.copyShareLink || !workspace?.shareLinkEntries || await workspace.copyShareLink(
    workspace.shareLinkEntries(),
    favoritesElements.favoritesShareButton
  );
}
function handleFavoritesTransferKeydown(event) {
  if (!favoritesState.favoritesTransferPending || !favoritesElements.favoritesTransferOverlay) return;
  if (event.key === "Escape") {
    event.preventDefault(), event.stopPropagation(), closeFavoritesTransferDialog({ cleanUrl: favoritesState.favoritesTransferPending?.source === "link" });
    return;
  }
  if (event.key !== "Tab") return;
  let focusable = Array.from(favoritesElements.favoritesTransferOverlay.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')).filter((element) => element instanceof HTMLElement);
  if (!focusable.length) return;
  let first = focusable[0], last = focusable[focusable.length - 1];
  event.shiftKey && document.activeElement === first ? (event.preventDefault(), focusHtmlElement(last)) : !event.shiftKey && document.activeElement === last && (event.preventDefault(), focusHtmlElement(first));
}
function isFavoritesLightboxMode() {
  return activeViewerSource() === LIGHTBOX_SOURCE_FAVORITES;
}
function findFavoriteEntryIndex(entries, catalogId, page) {
  let normalizedCatalogId = String(catalogId || ""), normalizedPage = Number.parseInt(String(page), 10);
  return entries.findIndex((entry) => String(entry.catalog?.id || entry.catalogId || "") === normalizedCatalogId && entry.page === normalizedPage);
}
function setFavoriteViewerEntry(entries, index) {
  if (!entries.length) return !1;
  let nextIndex = clampValue(Number.parseInt(String(index), 10) || 0, 0, entries.length - 1), entry = entries[nextIndex];
  return favoritesState.favoritesViewerIndex = nextIndex, setActiveLocation(entry.catalog, entry.page, activeViewerSource()), !0;
}
function syncFavoriteViewerAfterStoreChange(options = {}) {
  let viewer = getFeatureInterface("viewer");
  if (!viewer?.isViewerOpen?.() || !isFavoritesLightboxMode()) return;
  let { preferredIndex = favoritesState.favoritesViewerIndex } = options, entries = getFavoriteEntries();
  if (!entries.length) {
    viewer.close?.({ restoreFavorites: !0 });
    return;
  }
  let currentIndex = findFavoriteEntryIndex(entries, activeCatalog()?.id, activePage());
  setFavoriteViewerEntry(entries, currentIndex >= 0 ? currentIndex : preferredIndex), viewer.renderPageRail?.(), viewer.refresh?.({ thumbScrollIntoView: !0 });
}
function syncFavoritesViewerModeUi(favoritesMode) {
  let button = favoritesElements.favoriteOpenCatalogButton;
  button.classList.toggle("hidden", !favoritesMode), button.setAttribute("aria-hidden", favoritesMode ? "false" : "true"), button.setAttribute("tabindex", favoritesMode ? "0" : "-1");
}
function syncFavoritesInquiryTriggerState(open, activeTrigger = null) {
  let button = favoritesElements.favoritesInquiryButton;
  button.setAttribute("aria-expanded", open && button === activeTrigger ? "true" : "false");
}
function openCurrentFavoriteInCatalogFromViewer() {
  let catalog = activeCatalog(), viewer = getFeatureInterface("viewer");
  !catalog || !viewer?.isViewerOpen() || !isFavoritesLightboxMode() || viewer.openCatalog(catalog.id, activePage(), { source: LIGHTBOX_SOURCE_CATALOG });
}
function syncViewerFavoriteButtonUi() {
  let button = favoritesElements.viewerFavoriteButton;
  if (!button) return;
  let identity = favoriteIdentity(), isFavorite = !!(identity && favoritesStore?.has(identity)), label = isFavorite ? "הסרת העמוד מהמועדפים" : "הוספת העמוד למועדפים";
  button.dataset.favoriteActive = isFavorite ? "true" : "false", button.setAttribute("aria-pressed", isFavorite ? "true" : "false"), button.setAttribute("aria-label", label), setTooltipText(button, label, { updateDefault: !0 });
  let hiddenLabel = button.querySelector(".visually-hidden");
  hiddenLabel && (hiddenLabel.textContent = label);
}
function renderFavoritesPanel(entries = getFavoriteEntries()) {
  getFeatureInterface("favorites-workspace")?.render?.(entries);
}
function syncFavoritesShortcut(button, countElement, count) {
  countElement && (countElement.textContent = String(count)), button && (button.classList.toggle("hidden", count === 0), button.setAttribute("aria-label", `פתיחת מועדפים, ${count} עמודים שמורים`));
}
function syncFavoritesUi(options = {}) {
  let { renderPanel = favoritesState.favoritesOpen } = options, entries = getFavoriteEntries();
  getFeatureInterface("favorites-workspace")?.prune?.(entries);
  let count = entries.length;
  syncFavoritesShortcut(favoritesElements.headerFavoritesButton, favoritesElements.headerFavoritesCount, count), syncFavoritesShortcut(favoritesElements.lightboxFavoritesButton, favoritesElements.lightboxFavoritesCount, count), favoritesElements.lightboxFavoritesSeparator?.classList.toggle("hidden", count === 0), favoritesElements.lightboxFavoritesSeparator?.setAttribute("aria-hidden", count === 0 ? "true" : "false"), syncViewerFavoriteButtonUi(), syncFavoritesShareButton(count), renderPanel && (renderFavoritesPanel(entries), favoritesState.favoritesOpen && entries.length === 0 && requestAnimationFrame(() => favoritesElements.favoritesCloseButton?.focus()));
}
function openFavoritesPanel(options = {}) {
  let { allowEmpty = !1, captureReturnFocus = !0 } = options, entries = getFavoriteEntries();
  if (!isAppPage("favorites")) {
    (allowEmpty || entries.length) && navigateTo(favoritesDocumentUrl());
    return;
  }
  !favoritesElements.favoritesPanel || !allowEmpty && !entries.length || (captureReturnFocus && (favoritesState.favoritesReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null), favoritesState.favoritesOpen = !0, renderFavoritesPanel(entries), favoritesElements.favoritesPanel.classList.remove("hidden"), favoritesElements.favoritesPanel.classList.add("favorites-standalone-page"), favoritesElements.favoritesPanel.setAttribute("aria-hidden", "false"), favoritesElements.favoritesPanel.setAttribute("aria-modal", "false"), syncDocumentLock(), updateDocumentMetadata());
}
function hideFavoritesPanelUi(options = {}) {
  let { restoreFocus = !1, preserveReturnFocus = !1 } = options, returnFocus = favoritesState.favoritesReturnFocus;
  favoritesState.favoritesOpen = !1, favoritesElements.favoritesPanel?.classList.add("hidden"), favoritesElements.favoritesPanel?.classList.remove("favorites-standalone-page"), favoritesElements.favoritesPanel?.setAttribute("aria-hidden", "true"), favoritesElements.favoritesPanel?.setAttribute("aria-modal", "true"), syncDocumentLock(), restoreFocus && focusHtmlElement(returnFocus), preserveReturnFocus || (favoritesState.favoritesReturnFocus = null);
}
function closeFavoritesPanel(options = {}) {
  let { restoreFocus = !0, preserveReturnFocus = !1 } = options;
  if (isAppPage("favorites")) {
    (hasInDocumentRouteSession || canReturnToSameSite()) && window.history.length > 1 ? navigateBack() : navigateTo(homeDocumentUrl(), { replace: !0 });
    return;
  }
  favoritesState.favoritesOpen && hideFavoritesPanelUi({ restoreFocus, preserveReturnFocus });
}
function openFavoriteViewer(catalogId, page) {
  let entries = getFavoriteEntries(), index = findFavoriteEntryIndex(entries, catalogId, page);
  if (!(index < 0)) {
    if (!isAppPage("viewer")) {
      navigateTo(viewerDocumentUrl(catalogId, page, { source: LIGHTBOX_SOURCE_FAVORITES }));
      return;
    }
    favoritesState.favoritesViewerOpeningHash = window.location.href, favoritesState.favoritesViewerPreviousCatalog = activeCatalog(), favoritesState.favoritesViewerPreviousPage = activePage(), setFavoriteViewerEntry(entries, index), getFeatureInterface("viewer")?.openCatalog?.(catalogId, page, {
      source: LIGHTBOX_SOURCE_FAVORITES,
      favoriteIndex: index
    });
  }
}
function toggleCurrentPageFavorite() {
  let identity = favoriteIdentity();
  if (!identity || !favoritesStore) return;
  let previousFavoriteIndex = favoritesState.favoritesViewerIndex, mutation = favoritesStore.toggleDetailed({ ...identity, savedAt: Date.now() });
  if (!mutation.changed) return;
  let added = mutation.active === !0;
  telemetryTrackFavorite(added ? "add" : "remove", identity.catalogId, identity.page, getFavoriteEntries().length), syncFavoritesUi({ renderPanel: !0 }), isFavoritesLightboxMode() && !added && syncFavoriteViewerAfterStoreChange({ preferredIndex: previousFavoriteIndex }), getFeatureInterface("viewer")?.isViewerOpen?.() && (flashActionButton(favoritesElements.viewerFavoriteButton, mutation.persisted === !1 ? "זמני" : added ? "נשמר" : "הוסר"), showFavoritePersistenceFeedback(mutation, added ? {
    persisted: "נשמר במועדפים",
    temporary: "נשמר זמנית בלבד — אחסון המועדפים חסום בדפדפן",
    tone: "saved"
  } : {
    persisted: "הוסר מהמועדפים",
    temporary: "הוסר מהרשימה הזמנית בלבד — השינוי לא יישמר לאחר רענון",
    tone: "removed"
  }));
}
function removeFavorite(catalogId, page) {
  if (!favoritesStore) return;
  let mutation = favoritesStore.removeDetailed({ catalogId, page });
  mutation.changed && (favoritesState.favoritesSelectedKeys.delete(favoritesPortabilityDomain.favoriteItemKey({ catalogId, page })), telemetryTrackFavorite("remove", catalogId, page, getFavoriteEntries().length)), syncFavoritesUi({ renderPanel: !0 }), mutation.changed && showFavoritePersistenceFeedback(mutation, {
    persisted: "הוסר מהמועדפים",
    temporary: "הוסר מהרשימה הזמנית בלבד — השינוי לא יישמר לאחר רענון",
    tone: "removed"
  });
}
function clearAllFavorites() {
  if (!favoritesStore || !getFavoriteEntries().length || !window.confirm("למחוק את כל העמודים מהמועדפים?")) return;
  let mutation = favoritesStore.clearDetailed();
  mutation.changed && (favoritesState.favoritesSelectedKeys.clear(), favoritesState.favoritesFilterCatalogId = "", telemetryTrackFavorite("clear", "", 0, 0), syncFavoritesUi({ renderPanel: !0 }), showFavoritePersistenceFeedback(mutation, {
    persisted: "כל המועדפים הוסרו",
    temporary: "המועדפים הוסרו זמנית בלבד — הרשימה תחזור לאחר רענון",
    tone: "removed"
  }));
}
function handleFavoritesGridClick(event) {
  if (getFeatureInterface("favorites-workspace")?.handleGridClick(event)) return;
  let target = eventTargetElement(event.target), card = target?.closest("[data-favorite-catalog][data-favorite-page]");
  if (!(card instanceof HTMLElement) || !favoritesElements.favoritesGrid?.contains(card)) return;
  let catalogId = String(card.dataset.favoriteCatalog || ""), page = Number.parseInt(String(card.dataset.favoritePage || ""), 10);
  if (target?.closest("[data-remove-favorite]")) {
    removeFavorite(catalogId, page);
    return;
  }
  target?.closest("[data-open-favorite]") && openFavoriteViewer(catalogId, page);
}
function handleFavoritesStorageChange(event) {
  !favoritesStore || event.key !== null && event.key !== favoritesStore.storageKey || (favoritesStore.reload(), getFeatureInterface("favorites-workspace")?.prune?.(getFavoriteEntries()), syncFavoritesUi({ renderPanel: !0 }), favoritesState.favoritesTransferPending && syncFavoritesTransferDialogUi(), syncFavoriteViewerAfterStoreChange());
}
function handleFavoritesPanelKeydown(event) {
  if (!favoritesState.favoritesOpen || event.key !== "Tab" || !favoritesElements.favoritesPanel) return;
  let focusable = Array.from(favoritesElements.favoritesPanel.querySelectorAll(
    'button:not([disabled]):not(.hidden), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => isHtmlElement(element) && !element.closest(".hidden"));
  if (!focusable.length) return;
  let first = focusable[0], last = focusable[focusable.length - 1];
  event.shiftKey && document.activeElement === first ? (event.preventDefault(), focusHtmlElement(last)) : !event.shiftKey && document.activeElement === last && (event.preventDefault(), focusHtmlElement(first));
}
function currentVisibleDocumentUrl() {
  return window.location.href;
}
async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }
  let input = document.createElement("textarea");
  input.value = value, input.setAttribute("readonly", ""), input.style.position = "fixed", input.style.top = "-1000px", document.body.appendChild(input), input.select(), document.execCommand("copy"), input.remove();
}
function isMobileShareEnvironment() {
  if (typeof navigator.share != "function") return !1;
  let mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || ""), iPadDesktopMode = navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1, userAgentDataMobile = navigator.userAgentData?.mobile === !0;
  return !!(mobileUserAgent || iPadDesktopMode || userAgentDataMobile);
}
function currentShareLabel() {
  let catalog = activeCatalog();
  return catalog && isAppPage("viewer") ? `${catalog.title} · עמוד ${activePage()}` : catalog && isAppPage("catalog") ? catalog.title : isAppPage("favorites") ? "המועדפים שלי · רהיטי ברגיג" : "קטלוגי רהיטי ברגיג";
}
async function shareOrCopyCurrentLink(button) {
  let link = currentVisibleDocumentUrl();
  if (isMobileShareEnvironment())
    try {
      await navigator.share({
        title: document.title,
        text: currentShareLabel(),
        url: link
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  try {
    await copyTextToClipboard(link), flashActionButton(button, "הקישור הועתק"), showActionToast("הקישור הועתק", { tone: "link" });
  } catch {
    showActionToast("לא ניתן להעתיק אוטומטית — אפשר להעתיק מהחלון שנפתח"), window.prompt("אפשר להעתיק את הקישור מכאן:", link);
  }
}
async function shareCurrentMainHeaderLink() {
  await shareOrCopyCurrentLink(favoritesElements.headerCopyLink);
}
function attachFavoritesShareEvents() {
  favoritesElements.headerCopyLink.addEventListener("click", () => shareCurrentMainHeaderLink()), favoritesElements.viewerFavoriteButton.addEventListener("click", (event) => {
    event.preventDefault(), event.stopPropagation(), toggleCurrentPageFavorite();
  }), favoritesElements.viewerFavoriteButton.addEventListener("pointerdown", (event) => event.stopPropagation()), favoritesElements.favoriteOpenCatalogButton.addEventListener("click", openCurrentFavoriteInCatalogFromViewer), favoritesElements.viewerMobileFavoritesLink.href = favoritesDocumentUrl(), favoritesElements.viewerMobileFavoritesLink.addEventListener("click", () => {
    getFeatureInterface("viewer")?.closeMobileMoreMenu();
  }), favoritesElements.favoritesBackdrop?.addEventListener("click", () => closeFavoritesPanel()), favoritesElements.favoritesCloseButton?.addEventListener("click", () => closeFavoritesPanel()), favoritesElements.favoritesClearButton?.addEventListener("click", clearAllFavorites), favoritesElements.favoritesShareButton?.addEventListener("click", () => shareFavoritesList()), favoritesElements.favoritesGrid?.addEventListener("click", handleFavoritesGridClick);
  let workspace = getFeatureInterface("favorites-workspace");
  workspace?.attachEvents && bindFeatureEventsOnce("favorites-workspace", workspace.attachEvents), favoritesElements.favoritesPanel?.addEventListener("keydown", handleFavoritesPanelKeydown), favoritesElements.favoritesTransferBackdrop?.addEventListener("click", () => closeFavoritesTransferDialog({ cleanUrl: favoritesState.favoritesTransferPending?.source === "link" })), favoritesElements.favoritesTransferCancel?.addEventListener("click", () => closeFavoritesTransferDialog({ cleanUrl: favoritesState.favoritesTransferPending?.source === "link" })), favoritesElements.favoritesTransferMerge?.addEventListener("click", () => applyFavoritesTransfer("merge")), favoritesElements.favoritesTransferReplace?.addEventListener("click", () => applyFavoritesTransfer("replace")), favoritesElements.favoritesTransferOverlay?.addEventListener("keydown", handleFavoritesTransferKeydown), window.addEventListener("storage", handleFavoritesStorageChange);
}
registerFeatureInterface("favorites", {
  escapePriority: 500,
  requiresDocumentLock: () => !!(favoritesState.favoritesOpen && !isAppPage("favorites") || favoritesState.favoritesTransferPending || favoritesState.favoriteNoteEditingKey),
  attachEvents: attachFavoritesShareEvents,
  entries: getFavoriteEntries,
  viewerIndex: () => favoritesState.favoritesViewerIndex,
  setViewerIndex: (index) => {
    favoritesState.favoritesViewerIndex = Math.max(0, Number.parseInt(String(index), 10) || 0);
  },
  findViewerEntryIndex: findFavoriteEntryIndex,
  selectViewerEntry: setFavoriteViewerEntry,
  resetViewerSession: () => {
    favoritesState.favoritesViewerIndex = 0, favoritesState.favoritesViewerOpeningHash = "", favoritesState.favoritesViewerPreviousCatalog = null, favoritesState.favoritesViewerPreviousPage = 1, favoritesState.favoritesReturnFocus = null;
  },
  syncViewerButton: syncViewerFavoriteButtonUi,
  syncViewerMode: syncFavoritesViewerModeUi,
  syncInquiryTrigger: syncFavoritesInquiryTriggerState,
  onboardingTarget: () => favoritesElements.viewerFavoriteButton,
  prepareRoute: (nextPage) => {
    nextPage !== "favorites" && favoritesState.favoritesTransferPending && closeFavoritesTransferDialog({ restoreFocus: !1, cleanUrl: !0 }), nextPage !== "favorites" && favoritesState.favoriteNoteEditingKey && getFeatureInterface("favorites-workspace")?.closeNoteEditor({ restoreFocus: !1 }), nextPage !== "favorites" && (favoritesState.favoritesOpen || favoritesElements.favoritesPanel.classList.contains("favorites-standalone-page")) && hideFavoritesPanelUi();
  },
  syncUi: () => syncFavoritesUi({ renderPanel: isAppPage("favorites") }),
  openRoute: () => {
    openFavoritesPanel({ allowEmpty: !0, captureReturnFocus: !1 }), processFavoritesSelectionFromUrl();
  },
  isPanelOpen: () => favoritesState.favoritesOpen,
  closeTopLayer: () => favoritesState.favoriteNoteEditingKey ? (getFeatureInterface("favorites-workspace")?.closeNoteEditor?.(), !0) : favoritesState.favoritesTransferPending ? (closeFavoritesTransferDialog({
    cleanUrl: favoritesState.favoritesTransferPending?.source === "link"
  }), !0) : favoritesState.favoritesOpen ? (closeFavoritesPanel(), !0) : !1
});

// src/js/16-viewer-state.js
var AUTO_VIEWER_ZOOM = 1, MIN_VIEWER_ZOOM = 0.35, MAX_VIEWER_ZOOM = 5, VIEWER_FIT_HEIGHT = "height", VIEWER_FIT_WIDTH = "width", VIEWER_FIT_SOURCE_AUTO = "auto", VIEWER_FIT_SOURCE_MANUAL = "manual", VIEWER_PHASE_CLOSED = "closed", VIEWER_PHASE_OPENING = "opening", VIEWER_PHASE_OPEN = "open", VIEWER_PHASE_CLOSING = "closing", VIEWER_FULLSCREEN_INACTIVE = "inactive", VIEWER_FULLSCREEN_ENTERING = "entering", VIEWER_FULLSCREEN_ACTIVE = "active", VIEWER_FULLSCREEN_EXITING = "exiting", VIEWER_FULL_RESOLUTION_ZOOM_THRESHOLD = 1.35, VIEWER_MEDIUM_OVERSUBSCRIPTION_RATIO = 0.96, VIEWER_FULL_RESOLUTION_WARMUP_ZOOM_EPSILON = 0.01, VIEWER_ONBOARDING_STORAGE_KEY = "bargig.viewer-onboarding.v2", DOUBLE_TAP_DELAY = 320, DOUBLE_TAP_DISTANCE = 34, TAP_MOVE_TOLERANCE = 14, VIEWER_PAGE_SWIPE_MIN_DISTANCE = 46, VIEWER_PAGE_SWIPE_AXIS_RATIO = 1.35, VIEWER_ZOOM_INDICATOR_HIDE_MS = 760, VIEWER_PAGE_INDICATOR_HIDE_MS = 1e3, VIEWER_PAGE_SWAP_CLEANUP_MS = 240, VIEWER_NEIGHBOR_PRELOAD_SETTLE_MS = 180, VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX = 20, VIEWER_PAGE_WHEEL_PAGE_DELTA_PX = 100, VIEWER_PAGE_WHEEL_SETTLE_MS = 150, VIEWER_PAGE_WHEEL_RESET_RESTART_GAP_MS = 48, VIEWER_PAGE_WHEEL_RESET_ACCELERATION_RATIO = 1.4, VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO = 0.36, VIEWER_PAGE_TURN_BUFFER_MIN_PX = 144, VIEWER_PAGE_TURN_BUFFER_MAX_PX = 330, VIEWER_PAGE_TURN_REMAINDER_EPSILON = 0.75, VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS = 0.08, VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS = 2.6, VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS = 48e-4, VIEWER_TOUCH_MOMENTUM_MAX_FRAME_MS = 34, VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS = 80, VIEWER_TOUCH_VELOCITY_BLEND = 0.45, viewerSessionState = {
  viewerPhase: VIEWER_PHASE_CLOSED,
  viewerPhaseReason: "initial",
  viewerFullscreenPhase: VIEWER_FULLSCREEN_INACTIVE,
  viewerFullscreenReason: "initial"
}, viewerViewportState = {
  zoom: AUTO_VIEWER_ZOOM,
  fitScale: 1,
  imageFitMode: VIEWER_FIT_HEIGHT,
  imageFitModeSource: VIEWER_FIT_SOURCE_AUTO,
  singleImageFitOriginPending: !1,
  singleImagePendingRelativePosition: null,
  singleImagePendingPageTurnOrigin: null,
  panX: 0,
  panY: 0
}, viewerGestureState = {
  dragStartX: 0,
  dragStartY: 0,
  dragStartPanX: 0,
  dragStartPanY: 0,
  lastTapAt: 0,
  lastTapX: 0,
  lastTapY: 0,
  lastTapSurface: "",
  suppressNextDblClickUntil: 0,
  pinchStartDistance: 0,
  pinchStartZoom: AUTO_VIEWER_ZOOM,
  pinchLastMidX: 0,
  pinchLastMidY: 0,
  pointerGestureHadMultiplePointers: !1,
  pointerGestureConsumedPan: !1,
  pointers: /* @__PURE__ */ new Map(),
  viewerTouchMomentumRaf: 0,
  viewerTouchMomentumVelocityX: 0,
  viewerTouchMomentumVelocityY: 0,
  viewerTouchMomentumLastTime: 0
}, viewerChromeState = {
  topUiPinned: !1,
  uiHideTimer: 0,
  pageRailHideTimer: 0,
  lastTouchLikeViewportInputAt: 0,
  lastTouchLikeRailInputAt: 0,
  zoomIndicatorHideTimer: 0,
  pageIndicatorHideTimer: 0,
  viewerMobileMoreOpen: !1
}, viewerImageState = {
  singleImageLoadToken: 0,
  singleImageAnimationTimer: 0,
  singleImageStageAbortController: null,
  neighborPreloadTimer: 0,
  singleImageResolutionLoadToken: 0,
  singleImageResolutionStop: null,
  singleImageResolutionImage: null,
  singleImageResolutionTargetSrc: "",
  singleImageResolutionTargetTier: "",
  singleImageResolutionReady: !1,
  singleImageResolutionVisible: !1,
  singleImageResolutionCommitPending: !1,
  singleImageResolutionRetainedForSwap: !1
}, viewerNavigationState = {
  viewerPageWheelAccumulator: 0,
  viewerPageWheelBasePage: 0,
  viewerPageWheelTargetPage: 0,
  viewerPageWheelSettleTimer: 0,
  viewerPageWheelResetGestureActive: !1,
  viewerPageWheelResetLastEventAt: 0,
  viewerPageWheelResetLastDelta: 0,
  viewerPageWheelResetDirection: 0
}, viewerOnboardingState = {
  viewerOnboardingOpen: !1,
  viewerOnboardingShownThisSession: !1,
  viewerOnboardingStep: 0,
  viewerOnboardingTarget: null,
  viewerOnboardingFloatingTargets: [],
  viewerOnboardingRestoreUi: null,
  viewerOnboardingLayoutRaf: 0,
  viewerOnboardingLayoutTimer: 0
}, viewerElements = Object.freeze({
  lightbox: requiredElement("lightbox"),
  lightboxBackdrop: requiredElement("lightboxBackdrop"),
  lightboxBar: requiredElement("lightboxBar"),
  topHotspot: $requiredButton("topHotspot"),
  lightboxScreenshot: $requiredButton("lightboxScreenshot"),
  lightboxCopyLink: $requiredButton("lightboxCopyLink"),
  lightboxHomeLink: $requiredAnchor("lightboxHomeLink"),
  lightboxPinTopBar: $requiredButton("lightboxPinTopBar"),
  lightboxModeLabel: requiredElement("lightboxModeLabel"),
  lightboxTitle: requiredElement("lightboxTitle"),
  lightboxMeta: requiredElement("lightboxMeta"),
  lightboxProgress: requiredElement("lightboxProgress"),
  viewerPageIndicator: requiredElement("viewerPageIndicator"),
  viewerPageIndicatorLabel: requiredElement("viewerPageIndicatorLabel"),
  viewerPageIndicatorCurrent: requiredElement("viewerPageIndicatorCurrent"),
  viewerPageIndicatorTotal: requiredElement("viewerPageIndicatorTotal"),
  viewerPageIndicatorDetail: requiredElement("viewerPageIndicatorDetail"),
  lightboxImage: $requiredImage("lightboxImage"),
  lightboxImageFrame: requiredElement("lightboxImageFrame"),
  viewerImageFeedback: requiredElement("viewerImageFeedback"),
  viewerImageFeedbackText: requiredElement("viewerImageFeedbackText"),
  viewerImageRetry: $requiredButton("viewerImageRetry"),
  lightboxStage: requiredElement("lightboxStage"),
  lightboxSideHotspot: requiredElement("lightboxSideHotspot"),
  lightboxPageRail: requiredElement("lightboxPageRail"),
  lightboxPageRailTitle: requiredElement("lightboxPageRailTitle"),
  lightboxPageThumbs: requiredElement("lightboxPageThumbs"),
  lightboxFloatingPreview: requiredElement("lightboxFloatingPreview"),
  lightboxFloatingPreviewImage: $requiredImage("lightboxFloatingPreviewImage"),
  lightboxFloatingPreviewPage: requiredElement("lightboxFloatingPreviewPage"),
  stageCanvas: requiredElement("stageCanvas"),
  viewerLoading: requiredElement("viewerLoading"),
  prevPageBtn: $requiredButton("prevPageBtn"),
  nextPageBtn: $requiredButton("nextPageBtn"),
  fullscreenToggle: $requiredButton("fullscreenToggle"),
  fitAutoBtn: $requiredButton("fitAutoBtn"),
  fitHeightBtn: $requiredButton("fitHeightBtn"),
  fitWidthBtn: $requiredButton("fitWidthBtn"),
  viewerAutoZoomBtn: $requiredButton("viewerAutoZoomBtn"),
  viewerZoomIndicator: requiredElement("viewerZoomIndicator"),
  viewerMobileMoreToggle: $requiredButton("viewerMobileMoreToggle"),
  viewerMobileMoreMenu: requiredElement("viewerMobileMoreMenu"),
  viewerOnboarding: requiredElement("viewerOnboarding"),
  viewerOnboardingCard: requiredElement("viewerOnboardingCard"),
  viewerOnboardingSpotlight: requiredElement("viewerOnboardingSpotlight"),
  viewerOnboardingGesture: requiredElement("viewerOnboardingGesture"),
  viewerOnboardingTitle: requiredElement("viewerOnboardingTitle"),
  viewerOnboardingDescription: requiredElement("viewerOnboardingDescription"),
  viewerOnboardingEyebrow: requiredElement("viewerOnboardingEyebrow"),
  viewerOnboardingNote: requiredElement("viewerOnboardingNote"),
  viewerOnboardingCounter: requiredElement("viewerOnboardingCounter"),
  viewerOnboardingDots: requiredElement("viewerOnboardingDots"),
  viewerOnboardingPrevious: $requiredButton("viewerOnboardingPrevious"),
  viewerOnboardingNext: $requiredButton("viewerOnboardingNext"),
  viewerOnboardingSkip: $requiredButton("viewerOnboardingSkip"),
  viewerOnboardingShadeTop: requiredElement("viewerOnboardingShadeTop"),
  viewerOnboardingShadeRight: requiredElement("viewerOnboardingShadeRight"),
  viewerOnboardingShadeBottom: requiredElement("viewerOnboardingShadeBottom"),
  viewerOnboardingShadeLeft: requiredElement("viewerOnboardingShadeLeft")
});

// catalog-snapshot.js
var EXPORT_MIME = "image/jpeg";
var LOGO_ASPECT_RATIO = 2.4794952681388014, LOGO_ASSET_PATH = "brand-logo.svg", SNAPSHOT_CORS_VERSION = "1";
function resolveUrl(src) {
  try {
    return new URL(String(src || ""), document.baseURI || window.location.href);
  } catch {
    return null;
  }
}
function isCrossOriginHttpUrl(src) {
  var url = resolveUrl(src);
  return !url || !/^https?:$/.test(url.protocol) ? !1 : url.origin !== window.location.origin;
}
function withSnapshotCorsVersion(src) {
  var url = resolveUrl(src);
  return url ? (url.searchParams.set("snapshot-cors", SNAPSHOT_CORS_VERSION), url.href) : src;
}
function loadSnapshotImage(src) {
  return new Promise(function(resolve, reject) {
    var img = new Image(), imageSrc = src;
    isCrossOriginHttpUrl(src) && (img.crossOrigin = "anonymous", imageSrc = withSnapshotCorsVersion(src)), img.onload = function() {
      resolve(img);
    }, img.onerror = function() {
      reject(new Error("image-load-failed"));
    }, img.src = imageSrc;
  });
}
function getNaturalImageSize(img) {
  return {
    width: Math.max(1, Math.round(img.naturalWidth || img.width || 1)),
    height: Math.max(1, Math.round(img.naturalHeight || img.height || 1))
  };
}
function getExportSize(img) {
  var size = getNaturalImageSize(img), longestEdge = Math.max(size.width, size.height);
  if (longestEdge <= 2200) return size;
  var scale = 2200 / longestEdge;
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale))
  };
}
function getLogoUri() {
  var url = resolveUrl(LOGO_ASSET_PATH);
  return url ? url.href : LOGO_ASSET_PATH;
}
function drawLogoOverlay(ctx, canvas) {
  var uri = getLogoUri();
  return uri ? loadSnapshotImage(uri).then(function(logo) {
    var logoWidth = Math.max(1, Math.round(canvas.width * 0.13)), aspectRatio = logo.naturalWidth && logo.naturalHeight ? logo.naturalWidth / logo.naturalHeight : LOGO_ASPECT_RATIO, logoHeight = Math.max(1, Math.round(logoWidth / aspectRatio)), logoX = Math.round((canvas.width - logoWidth) / 2), logoY = Math.max(1, Math.round(canvas.height * 0.02));
    return ctx.save(), ctx.shadowColor = "rgba(0,0,0,0.16)", ctx.shadowBlur = Math.max(8, Math.round(canvas.width * 0.01)), ctx.shadowOffsetY = Math.max(3, Math.round(canvas.height * 4e-3)), ctx.drawImage(logo, logoX, logoY, logoWidth, logoHeight), ctx.restore(), !0;
  }).catch(function() {
    return !1;
  }) : Promise.resolve(!1);
}
function canvasToBlob(canvas) {
  return new Promise(function(resolve, reject) {
    canvas.toBlob(function(blob) {
      blob ? resolve(blob) : reject(new Error("snapshot-blob-failed"));
    }, EXPORT_MIME, 0.82);
  });
}
function buildSnapshotBlob(src) {
  return loadSnapshotImage(src).then(function(pageImage) {
    var canvas = document.createElement("canvas"), size = getExportSize(pageImage);
    canvas.width = size.width, canvas.height = size.height;
    var ctx = canvas.getContext("2d", { alpha: !1 });
    if (!ctx) throw new Error("snapshot-context-failed");
    return ctx.fillStyle = "#fff", ctx.fillRect(0, 0, canvas.width, canvas.height), ctx.imageSmoothingEnabled = !0, "imageSmoothingQuality" in ctx && (ctx.imageSmoothingQuality = "high"), ctx.drawImage(pageImage, 0, 0, canvas.width, canvas.height), drawLogoOverlay(ctx, canvas).then(function() {
      return canvasToBlob(canvas);
    });
  });
}
var catalogSnapshotApi = Object.freeze({
  buildSnapshotBlob,
  extension: "jpg"
});
var catalog_snapshot_default = catalogSnapshotApi;

// src/js/31-viewer-share.js
function safeFilePart(value) {
  return String(value || "catalog").trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "catalog";
}
function saveBlob(blob, filename) {
  let url = URL.createObjectURL(blob), link = document.createElement("a");
  link.href = url, link.download = filename, document.body.appendChild(link), link.click(), link.remove(), window.setTimeout(() => URL.revokeObjectURL(url), 900);
}
async function downloadCatalogPageSnapshot(catalog, page, button) {
  let currentPage = clampPage(page, catalog), src = pageSrc(catalog, currentPage);
  try {
    let blob = await catalog_snapshot_default.buildSnapshotBlob(src), extension = catalog_snapshot_default.extension || "jpg", pageNumber = String(currentPage).padStart(3, "0");
    saveBlob(blob, `${safeFilePart(catalog.title || catalog.id)}-page-${pageNumber}.${extension}`), flashActionButton(button, "נשמר"), showActionToast("התמונה נשמרה", { tone: "saved" });
  } catch (error) {
    console.error("[CatalogSnapshot] Failed to export catalog page", {
      catalogId: catalog.id,
      page: currentPage,
      src,
      error
    }), window.alert("לא הצלחתי ליצור את תמונת העמוד. יש לוודא שמדיניות CORS של מאגר התמונות מאפשרת קריאה מהאתר.");
  }
}
function downloadCurrentLightboxImage() {
  let catalog = activeCatalog();
  catalog && downloadCatalogPageSnapshot(
    catalog,
    activePage(),
    viewerElements.lightboxScreenshot
  );
}
async function shareCurrentLightboxLink() {
  await shareOrCopyCurrentLink(viewerElements.lightboxCopyLink);
}
function attachViewerShareEvents() {
  viewerElements.lightboxScreenshot?.addEventListener("click", downloadCurrentLightboxImage), viewerElements.lightboxCopyLink?.addEventListener("click", shareCurrentLightboxLink);
}

// src/js/19-shared-pure.js
function buildViewerInquiryMailtoUrl(emailAddress, reference) {
  let subject = encodeURIComponent(String(reference?.subject || "")), body = encodeURIComponent(String(reference?.text || "").replace(/\r?\n/g, `\r
`));
  return `mailto:${String(emailAddress || "")}?subject=${subject}&body=${body}`;
}

// src/js/32-shared-inquiry.js
var inquiryState = {
  open: !1,
  returnFocus: null,
  reference: null
}, inquiryElements = Object.freeze({
  viewerInquiryButton: $requiredButton("viewerInquiryButton"),
  viewerInquiryOverlay: requiredElement("viewerInquiryOverlay"),
  viewerInquiryBackdrop: requiredElement("viewerInquiryBackdrop"),
  viewerInquiryClose: $requiredButton("viewerInquiryClose"),
  viewerInquiryEyebrow: requiredElement("viewerInquiryEyebrow"),
  viewerInquiryTitle: requiredElement("viewerInquiryTitle"),
  viewerInquiryDescription: requiredElement("viewerInquiryDescription"),
  viewerInquiryReference: requiredElement("viewerInquiryReference"),
  viewerInquiryCatalog: requiredElement("viewerInquiryCatalog"),
  viewerInquiryPage: requiredElement("viewerInquiryPage"),
  viewerInquiryPreview: $requiredImage("viewerInquiryPreview"),
  viewerInquiryActions: requiredElement("viewerInquiryActions"),
  viewerInquiryGmail: $requiredAnchor("viewerInquiryGmail"),
  viewerInquiryEmail: $requiredAnchor("viewerInquiryEmail"),
  viewerInquiryShare: $requiredButton("viewerInquiryShare"),
  viewerInquiryCopy: $requiredButton("viewerInquiryCopy")
});
function viewerInquiryFooterEmail() {
  let link = Array.from(document.querySelectorAll(".site-footer-contact-list a[href]")).find((candidate) => String(candidate.getAttribute("href") || "").startsWith("mailto:"));
  return link instanceof HTMLAnchorElement ? link : null;
}
function viewerInquiryEmailAddress() {
  return String(viewerInquiryFooterEmail()?.getAttribute?.("href") || "").trim().replace(/^mailto:/i, "").split("?")[0].trim();
}
function viewerPageInquiryReference() {
  let catalog = activeCatalog();
  if (!catalog) return null;
  let page = clampPage(activePage(), catalog), url = absoluteDocumentUrl(viewerDocumentUrl(catalog.id, page)), title = String(catalog.title || "קטלוג").trim() || "קטלוג", pageLabel = `עמוד ${page} מתוך ${catalogLastPage(catalog)}`, subject = `בירור על דגם – ${title}, עמוד ${page}`, shareText = [
    "שלום,",
    "רציתי לברר לגבי הדגם הבא:",
    `קטלוג: ${title}`,
    `עמוד: ${page}`
  ].join(`
`), text = `${shareText}
קישור ישיר: ${url}`;
  return {
    kind: "viewer",
    source: "viewer-inquiry",
    catalog,
    page,
    title: "בירור על הדגם",
    eyebrow: "פרטי העמוד מצורפים אוטומטית",
    description: "אפשר לפתוח הודעה מוכנה ב-Gmail, להשתמש בתוכנת דואר, לשתף דרך המכשיר או להעתיק. שם הקטלוג, מספר העמוד והקישור המדויק מוכנים מראש.",
    referenceTitle: title,
    pageLabel,
    subject,
    shareText,
    text,
    url,
    previewCatalog: catalog,
    previewPage: page,
    telemetry: {
      source: "viewer-inquiry",
      catalogId: catalog.id,
      pageNumber: page
    }
  };
}
function viewerInquiryReference() {
  return inquiryState.reference || viewerPageInquiryReference();
}
function viewerInquiryGmailUrl(emailAddress, reference) {
  return `https://mail.google.com/mail/?${new URLSearchParams({
    view: "cm",
    fs: "1",
    to: emailAddress,
    su: reference.subject,
    body: reference.text
  }).toString()}`;
}
function viewerInquiryMailtoUrl(emailAddress, reference) {
  return buildViewerInquiryMailtoUrl(emailAddress, reference);
}
function viewerInquiryTelemetryFields(reference, action, detail = "") {
  let telemetry = reference?.telemetry || {};
  return {
    action,
    detail,
    source: telemetry.source || reference?.source || "viewer-inquiry",
    catalogId: telemetry.catalogId || reference?.catalog?.id || "",
    pageNumber: telemetry.pageNumber ?? reference?.page ?? 0,
    value: telemetry.value || reference?.count || 0
  };
}
function syncViewerInquiryContactLink(link, href, reference, action) {
  if (!link) return;
  let available = !!href;
  if (link.classList.toggle("hidden", !available), link.setAttribute("aria-hidden", available ? "false" : "true"), !available) {
    link.removeAttribute("href"), delete link.dataset.contactSource, delete link.dataset.contactAction, delete link.dataset.contactCatalogId, delete link.dataset.contactPage;
    return;
  }
  let telemetry = viewerInquiryTelemetryFields(reference, action);
  link.href = href, link.dataset.contactSource = telemetry.source, link.dataset.contactAction = action, telemetry.catalogId ? link.dataset.contactCatalogId = telemetry.catalogId : delete link.dataset.contactCatalogId, Number.isFinite(Number(telemetry.pageNumber)) ? link.dataset.contactPage = String(telemetry.pageNumber) : delete link.dataset.contactPage;
}
function syncViewerInquiryUi(reference = viewerInquiryReference()) {
  if (!reference) return;
  if (inquiryElements.viewerInquiryEyebrow && (inquiryElements.viewerInquiryEyebrow.textContent = reference.eyebrow || "פרטי הבירור מצורפים אוטומטית"), inquiryElements.viewerInquiryTitle && (inquiryElements.viewerInquiryTitle.textContent = reference.title || "בירור על הדגם"), inquiryElements.viewerInquiryDescription && (inquiryElements.viewerInquiryDescription.textContent = reference.description || "פרטי הבירור והקישורים מוכנים מראש."), inquiryElements.viewerInquiryCatalog && (inquiryElements.viewerInquiryCatalog.textContent = reference.referenceTitle || reference.title), inquiryElements.viewerInquiryPage && (inquiryElements.viewerInquiryPage.textContent = reference.pageLabel || ""), inquiryElements.viewerInquiryReference?.classList.toggle("is-bulk", reference.kind === "favorites"), inquiryElements.viewerInquiryButton && reference.kind === "viewer") {
    let label = `בירור על הדגם — ${reference.referenceTitle}, עמוד ${reference.page}`;
    inquiryElements.viewerInquiryButton.setAttribute("aria-label", label);
  }
  let previewCatalog = reference.previewCatalog || reference.catalog, rawPreviewPage = reference.previewPage ?? reference.page, previewPage = Number.isFinite(Number(rawPreviewPage)) ? Number(rawPreviewPage) : 1;
  if (inquiryElements.viewerInquiryPreview && previewCatalog) {
    let preview = thumbSrc(previewCatalog, previewPage) || pageSrc(previewCatalog, previewPage);
    inquiryElements.viewerInquiryPreview.getAttribute("src") !== preview && (inquiryElements.viewerInquiryPreview.src = preview), inquiryElements.viewerInquiryPreview.alt = reference.kind === "favorites" ? `תצוגה מקדימה של ${reference.referenceTitle}` : `${reference.referenceTitle}, עמוד ${previewPage}`;
  }
  let emailAddress = viewerInquiryEmailAddress(), emailAvailable = !!emailAddress;
  syncViewerInquiryContactLink(
    inquiryElements.viewerInquiryEmail,
    emailAvailable ? viewerInquiryMailtoUrl(emailAddress, reference) : "",
    reference,
    "email"
  ), syncViewerInquiryContactLink(
    inquiryElements.viewerInquiryGmail,
    emailAvailable ? viewerInquiryGmailUrl(emailAddress, reference) : "",
    reference,
    "gmail"
  );
}
function setViewerInquiryTriggerState(open, activeTrigger = null) {
  inquiryElements.viewerInquiryButton.setAttribute(
    "aria-expanded",
    open && inquiryElements.viewerInquiryButton === activeTrigger ? "true" : "false"
  ), getFeatureInterface("favorites")?.syncInquiryTrigger(open, activeTrigger);
}
function getViewerInquiryFocusableElements() {
  return Array.from(inquiryElements.viewerInquiryOverlay.querySelectorAll(
    'button:not([disabled]), a[href]:not(.hidden), [tabindex]:not([tabindex="-1"])'
  )).filter(isHtmlElement).filter((element) => !element.closest(".hidden"));
}
function openViewerInquiry(options = {}) {
  let reference = options.reference || viewerPageInquiryReference();
  if (!reference || !inquiryElements.viewerInquiryOverlay) return;
  getFeatureInterface("viewer")?.prepareInquiry?.();
  let returnFocus = isHtmlElement(options.returnFocus) ? options.returnFocus : isHtmlElement(document.activeElement) ? document.activeElement : inquiryElements.viewerInquiryButton;
  inquiryState.reference = reference, inquiryState.open = !0, inquiryState.returnFocus = returnFocus, syncViewerInquiryUi(reference), inquiryElements.viewerInquiryOverlay.classList.remove("hidden"), inquiryElements.viewerInquiryOverlay.setAttribute("aria-hidden", "false"), setViewerInquiryTriggerState(!0, returnFocus), syncDocumentLock(), window.requestAnimationFrame(() => {
    inquiryState.open && (inquiryElements.viewerInquiryOverlay?.classList.add("visible"), focusHtmlElement(inquiryElements.viewerInquiryClose || getViewerInquiryFocusableElements()[0], { preventScroll: !0 }));
  });
}
function closeViewerInquiry(options = {}) {
  if (!inquiryState.open && inquiryElements.viewerInquiryOverlay?.classList.contains("hidden")) return;
  let { restoreFocus = !0 } = options, returnFocus = inquiryState.returnFocus;
  inquiryState.open = !1, inquiryState.returnFocus = null, inquiryState.reference = null, inquiryElements.viewerInquiryOverlay?.classList.remove("visible"), inquiryElements.viewerInquiryOverlay?.setAttribute("aria-hidden", "true"), setViewerInquiryTriggerState(!1), syncDocumentLock(), window.setTimeout(() => {
    inquiryState.open || inquiryElements.viewerInquiryOverlay?.classList.add("hidden");
  }, 180), restoreFocus && focusHtmlElement(returnFocus || inquiryElements.viewerInquiryButton, { preventScroll: !0 });
}
function handleViewerInquiryKeydown(event) {
  if (!inquiryState.open) return !1;
  if (event.key === "Escape")
    return event.preventDefault(), event.stopPropagation(), closeViewerInquiry(), !0;
  if (event.key !== "Tab") return !0;
  let focusable = getViewerInquiryFocusableElements();
  if (!focusable.length)
    return event.preventDefault(), !0;
  let first = focusable[0], last = focusable[focusable.length - 1];
  return event.shiftKey && document.activeElement === first ? (event.preventDefault(), focusHtmlElement(last)) : !event.shiftKey && document.activeElement === last && (event.preventDefault(), focusHtmlElement(first)), !0;
}
async function copyViewerInquiryReference() {
  let reference = viewerInquiryReference();
  if (reference)
    try {
      await copyTextToClipboard(reference.text), telemetryTrack("contact", viewerInquiryTelemetryFields(reference, "copy"), { immediate: !0 }), showActionToast(reference.kind === "favorites" ? "פרטי הדגמים הועתקו" : "פרטי הדגם הועתקו", { tone: "link" }), closeViewerInquiry();
    } catch {
      window.prompt("אפשר להעתיק את פרטי הבירור מכאן:", reference.text);
    }
}
async function shareViewerInquiryReference() {
  let reference = viewerInquiryReference();
  if (!reference) return;
  let shareData = {
    title: reference.subject,
    text: reference.shareText,
    url: reference.url
  }, canUseNativeShare = typeof navigator.share == "function";
  if (canUseNativeShare && typeof navigator.canShare == "function")
    try {
      canUseNativeShare = navigator.canShare(shareData);
    } catch {
      canUseNativeShare = !1;
    }
  if (canUseNativeShare)
    try {
      await navigator.share(shareData), telemetryTrack("contact", viewerInquiryTelemetryFields(reference, "share"), { immediate: !0 }), closeViewerInquiry({ restoreFocus: !1 });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  try {
    await copyTextToClipboard(reference.text), telemetryTrack("contact", viewerInquiryTelemetryFields(reference, "share", "copy-fallback"), { immediate: !0 }), showActionToast(
      reference.kind === "favorites" ? "אפשרויות שיתוף אינן זמינות — פרטי הדגמים הועתקו" : "אפשרויות שיתוף אינן זמינות — פרטי הדגם הועתקו",
      { tone: "link" }
    ), closeViewerInquiry();
  } catch {
    window.prompt("אפשר להעתיק ולשתף את פרטי הבירור מכאן:", reference.text);
  }
}
function attachSharedInquiryEvents() {
  inquiryElements.viewerInquiryButton?.addEventListener("click", (event) => {
    event.preventDefault(), event.stopPropagation(), openViewerInquiry({ returnFocus: inquiryElements.viewerInquiryButton });
  }), inquiryElements.viewerInquiryBackdrop?.addEventListener("click", () => closeViewerInquiry()), inquiryElements.viewerInquiryClose?.addEventListener("click", () => closeViewerInquiry()), inquiryElements.viewerInquiryShare?.addEventListener("click", () => shareViewerInquiryReference()), inquiryElements.viewerInquiryCopy?.addEventListener("click", () => copyViewerInquiryReference()), inquiryElements.viewerInquiryOverlay?.addEventListener("keydown", handleViewerInquiryKeydown), [inquiryElements.viewerInquiryGmail, inquiryElements.viewerInquiryEmail].forEach((link) => {
    link?.addEventListener("click", () => window.setTimeout(() => closeViewerInquiry({ restoreFocus: !1 }), 0));
  });
}
registerFeatureInterface("inquiry", {
  escapePriority: 600,
  requiresDocumentLock: () => inquiryState.open,
  isOpen: () => inquiryState.open,
  attachEvents: attachSharedInquiryEvents,
  openInquiry: (options = {}) => openViewerInquiry(options),
  close: (options = {}) => closeViewerInquiry(options),
  onboardingTarget: () => inquiryElements.viewerInquiryButton,
  closeTopLayer: () => inquiryState.open ? (closeViewerInquiry(), !0) : !1
});

// src/js/35-favorites-workspace.js
function favoriteWorkspaceEntryKey(entry) {
  return favoritesPortabilityDomain.favoriteItemKey({ catalogId: entry?.catalog?.id || entry?.catalogId, page: entry?.page });
}
function favoriteWorkspaceCardKey(card) {
  return card instanceof HTMLElement ? favoritesPortabilityDomain.favoriteItemKey({
    catalogId: card.dataset.favoriteCatalog,
    page: card.dataset.favoritePage
  }) : "";
}
function favoriteWorkspaceFindCardByKey(key) {
  if (!key || !favoritesElements.favoritesGrid) return null;
  let cards = (
    /** @type {NodeListOf<HTMLElement>} */
    favoritesElements.favoritesGrid.querySelectorAll("[data-favorite-catalog][data-favorite-page]")
  );
  return Array.from(cards).find((card) => favoriteWorkspaceCardKey(card) === key) || null;
}
function favoriteWorkspaceSelectedEntries(entries = getFavoriteEntries()) {
  return entries.filter((entry) => favoritesState.favoritesSelectedKeys.has(favoriteWorkspaceEntryKey(entry)));
}
function favoriteWorkspaceVisibleEntries(entries = getFavoriteEntries()) {
  let filter = String(favoritesState.favoritesFilterCatalogId || "");
  return filter ? entries.filter((entry) => String(entry.catalog?.id || entry.catalogId) === filter) : entries;
}
function favoriteWorkspaceShareLinkEntries(entries = getFavoriteEntries()) {
  let selectedEntries = favoriteWorkspaceSelectedEntries(entries);
  return selectedEntries.length ? selectedEntries : entries;
}
function pruneFavoritesWorkspaceState(entries = getFavoriteEntries()) {
  let validKeys = new Set(entries.map(favoriteWorkspaceEntryKey).filter(Boolean));
  for (let key of favoritesState.favoritesSelectedKeys)
    validKeys.has(key) || favoritesState.favoritesSelectedKeys.delete(key);
  favoritesState.favoriteNoteEditingKey && !validKeys.has(favoritesState.favoriteNoteEditingKey) && closeFavoriteNoteEditor({ restoreFocus: !1 }), favoritesState.favoritesFilterCatalogId && !entries.some((entry) => String(entry.catalog?.id || entry.catalogId) === favoritesState.favoritesFilterCatalogId) && (favoritesState.favoritesFilterCatalogId = "");
}
function favoriteWorkspaceFilterOptions(entries) {
  let catalogCounts = /* @__PURE__ */ new Map();
  return entries.forEach((entry) => {
    let id = String(entry.catalog?.id || entry.catalogId || "");
    if (!id) return;
    let current = catalogCounts.get(id) || { catalog: entry.catalog, count: 0 };
    current.count += 1, catalogCounts.set(id, current);
  }), [...catalogCounts.entries()].map(([id, value]) => ({ id, ...value }));
}
function syncFavoriteWorkspaceFilter(entries) {
  if (!favoritesElements.favoritesCatalogFilter) return;
  let options = favoriteWorkspaceFilterOptions(entries), current = String(favoritesState.favoritesFilterCatalogId || "");
  favoritesElements.favoritesCatalogFilter.innerHTML = [
    '<option value="">כל הקטלוגים</option>',
    ...options.map(({ id, catalog, count }) => `<option value="${escapeHtml(id)}">${escapeHtml(catalog?.title || id)} (${count})</option>`)
  ].join(""), favoritesElements.favoritesCatalogFilter.value = options.some((option) => option.id === current) ? current : "", favoritesState.favoritesFilterCatalogId = favoritesElements.favoritesCatalogFilter.value;
}
function favoriteWorkspaceInquiryReference(entries, options = {}) {
  if (!entries.length) return null;
  let selected = !!options.selected, firstEntry = entries[0], count = entries.length, scopeLabel = selected ? "הדגמים שנבחרו" : "כל המועדפים", title = selected ? "בירור על הדגמים שנבחרו" : "בירור על הדגמים", selectionUrl = favoriteWorkspaceSelectionUrl(entries), shareText = favoriteWorkspaceMessage(entries, { purpose: "inquiry" }), text = `${shareText}

קישור לרשימת הדגמים: ${selectionUrl}`;
  return {
    kind: "favorites",
    source: "favorites-inquiry",
    entries,
    count,
    selected,
    title,
    eyebrow: "הדגמים וההערות מצורפים אוטומטית",
    description: "אפשר לפתוח הודעה מוכנה ב-Gmail, להשתמש בתוכנת דואר, לשתף דרך המכשיר או להעתיק. כל הדגמים, ההערות והקישורים הישירים כבר מוכנים.",
    referenceTitle: `${count} ${count === 1 ? "דגם" : "דגמים"} מהמועדפים`,
    pageLabel: `${scopeLabel} · כולל הערות וקישורים`,
    subject: `${title} – ${count} ${count === 1 ? "דגם" : "דגמים"}`,
    shareText,
    text,
    url: selectionUrl,
    previewCatalog: firstEntry.catalog,
    previewPage: firstEntry.page,
    telemetry: { source: "favorites-inquiry", value: count }
  };
}
function openFavoriteWorkspaceInquiry() {
  let entries = getFavoriteEntries(), selectedEntries = favoriteWorkspaceSelectedEntries(entries), actionEntries = selectedEntries.length ? selectedEntries : entries, reference = favoriteWorkspaceInquiryReference(actionEntries, { selected: selectedEntries.length > 0 });
  reference && getFeatureInterface("inquiry")?.openInquiry?.({
    reference,
    returnFocus: favoritesElements.favoritesInquiryButton
  });
}
function syncFavoriteWorkspaceHeaderActions(entries, visibleEntries) {
  let selectedEntries = favoriteWorkspaceSelectedEntries(entries), selectedCount = selectedEntries.length, inquiryEntries = selectedCount ? selectedEntries : entries, shareEntries = selectedCount ? selectedEntries : entries, hasEntries = entries.length > 0;
  favoritesElements.favoritesHeaderWorkspace?.classList.toggle("hidden", !hasEntries), favoritesElements.favoritesCatalogFilter && (favoritesElements.favoritesCatalogFilter.disabled = !hasEntries), favoritesElements.favoritesVisibleCount && (favoritesElements.favoritesVisibleCount.textContent = visibleEntries.length === entries.length ? `${entries.length} פריטים` : `${visibleEntries.length} מתוך ${entries.length}`), favoritesElements.favoritesShareButton && (favoritesElements.favoritesShareButton.disabled = shareEntries.length === 0, favoritesElements.favoritesShareButton.setAttribute("aria-label", shareEntries.length ? selectedCount ? `העתקת קישור עבור ${selectedCount} פריטים שסומנו` : `העתקת קישור לכל ${entries.length} המועדפים` : "העתקת קישור למועדפים — אין עדיין פריטים")), favoritesElements.favoritesShareLabel && (favoritesElements.favoritesShareLabel.textContent = selectedCount ? "שיתוף הבחירה" : "שיתוף הרשימה"), favoritesElements.favoritesInquiryButton && (favoritesElements.favoritesInquiryButton.classList.toggle("hidden", !hasEntries), favoritesElements.favoritesInquiryButton.disabled = inquiryEntries.length === 0, favoritesElements.favoritesInquiryButton.setAttribute("aria-label", selectedCount ? `בירור על ${selectedCount} הדגמים שנבחרו` : `בירור על כל ${entries.length} הדגמים במועדפים`)), favoritesElements.favoritesInquiryLabel && (favoritesElements.favoritesInquiryLabel.textContent = selectedCount ? "בירור על הדגמים שנבחרו" : "בירור על הדגמים"), favoritesElements.favoritesSelectionBar?.classList.toggle("hidden", selectedCount === 0), favoritesElements.favoritesSelectionCount && (favoritesElements.favoritesSelectionCount.textContent = String(selectedCount));
}
function favoriteWorkspaceNoteMarkup(entry) {
  let note = String(entry.note || "").trim();
  return note ? `
    <div class="favorite-note-summary">
      <span class="favorite-note-label">הערה</span>
      <span class="favorite-note-text">${escapeHtml(note)}</span>
    </div>
  ` : "";
}
function favoriteWorkspaceCardMarkup(entry, visibleIndex, visibleCount) {
  let { catalog, page } = entry, key = favoriteWorkspaceEntryKey(entry), identityCatalog = escapeHtml(catalog.id), title = escapeHtml(catalog.title || "קטלוג"), image = thumbSrc(catalog, page), selected = favoritesState.favoritesSelectedKeys.has(key), noteActionLabel = String(entry.note || "").trim() ? "עריכת ההערה" : "הוספת הערה", upDisabled = visibleIndex === 0 ? " disabled" : "", downDisabled = visibleIndex === visibleCount - 1 ? " disabled" : "";
  return `
    <article class="favorite-card${selected ? " is-selected" : ""}" data-favorite-catalog="${identityCatalog}" data-favorite-page="${page}" draggable="false">
      <label class="favorite-select-control">
        <input type="checkbox" data-select-favorite="1" ${selected ? "checked" : ""} aria-label="סימון ${title}, עמוד ${page}" />
        <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6.5 12.4 3.3 3.3 7.7-8"/></svg></span>
      </label>
      <button class="favorite-remove-button" type="button" data-remove-favorite="1" aria-label="הסרת ${title}, עמוד ${page} מהמועדפים" title="הסרה מהמועדפים">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/></svg>
      </button>
      <button class="favorite-preview-button" type="button" data-open-favorite="1" aria-label="פתיחת ${title}, עמוד ${page}">
        <span class="favorite-image-frame catalog-image-frame"${pageAspectStyle(catalog, page)}>
          <img src="${escapeHtml(image)}" alt="${title} - עמוד ${page}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "favorites-grid")}${catalogImageCrossOriginAttribute(image)} />
        </span>
        <span class="favorite-card-meta">
          <strong>${title}</strong>
          <span>עמוד ${page}</span>
        </span>
      </button>
      ${favoriteWorkspaceNoteMarkup(entry)}
      <div class="favorite-card-actions">
        <button class="favorite-card-action favorite-note-button" type="button" data-edit-favorite-note="1" aria-label="${noteActionLabel} עבור ${title}, עמוד ${page}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h14v12H9l-4 3v-15Z"/><path d="M8 8h8M8 11.5h5"/></svg>
          <span>${noteActionLabel}</span>
        </button>
        <div class="favorite-order-controls" aria-label="שינוי סדר הפריט">
          <button class="favorite-order-button" type="button" data-move-favorite="-1" aria-label="העברת ${title}, עמוד ${page} למעלה"${upDisabled}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg>
          </button>
          <button class="favorite-drag-handle" type="button" draggable="true" data-drag-favorite="1" aria-label="גרירת ${title}, עמוד ${page} לשינוי סדר" title="גרירה לשינוי סדר">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg>
          </button>
          <button class="favorite-order-button" type="button" data-move-favorite="1" aria-label="העברת ${title}, עמוד ${page} למטה"${downDisabled}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
          </button>
        </div>
      </div>
    </article>
  `;
}
function renderFavoritesWorkspace(entries = getFavoriteEntries()) {
  if (!favoritesElements.favoritesGrid) return;
  pruneFavoritesWorkspaceState(entries);
  let count = entries.length;
  favoritesElements.favoritesClearButton?.classList.toggle("hidden", count === 0), favoritesElements.favoritesEmpty?.classList.toggle("hidden", count !== 0), syncFavoriteWorkspaceFilter(entries);
  let visibleEntries = favoriteWorkspaceVisibleEntries(entries);
  syncFavoriteWorkspaceHeaderActions(entries, visibleEntries), favoritesElements.favoritesFilteredEmpty?.classList.toggle("hidden", count === 0 || visibleEntries.length > 0), favoritesElements.favoritesGrid.classList.toggle("hidden", count === 0 || visibleEntries.length === 0), favoritesElements.favoritesGrid.innerHTML = visibleEntries.map((entry, index) => favoriteWorkspaceCardMarkup(entry, index, visibleEntries.length)).join("");
}
function favoriteWorkspaceReorderVisible(orderedVisibleKeys) {
  if (!favoritesStore || !orderedVisibleKeys.length) return !1;
  let allItems = favoritesStore.read(), visibleSet = new Set(orderedVisibleKeys), itemByKey = new Map(allItems.map((item) => [favoritesPortabilityDomain.favoriteItemKey(item), item]));
  if (orderedVisibleKeys.some((key) => !itemByKey.has(key))) return !1;
  let visibleIndex = 0, nextItems = allItems.map((item) => {
    let key = favoritesPortabilityDomain.favoriteItemKey(item);
    if (!visibleSet.has(key)) return item;
    let replacement = itemByKey.get(orderedVisibleKeys[visibleIndex]);
    return visibleIndex += 1, replacement || item;
  }), mutation = favoritesStore.replaceDetailed(nextItems);
  return warnIfFavoriteChangeIsTemporary(mutation), mutation.changed;
}
function moveFavoriteWithinVisibleOrder(key, direction) {
  let entries = getFavoriteEntries(), keys = favoriteWorkspaceVisibleEntries(entries).map(favoriteWorkspaceEntryKey), index = keys.indexOf(key), targetIndex = index + Number(direction || 0);
  return index < 0 || targetIndex < 0 || targetIndex >= keys.length ? !1 : ([keys[index], keys[targetIndex]] = [keys[targetIndex], keys[index]], favoriteWorkspaceReorderVisible(keys), syncFavoritesUi({ renderPanel: !0 }), requestAnimationFrame(() => {
    let movedCard = favoriteWorkspaceFindCardByKey(key);
    focusHtmlElement(movedCard?.querySelector(`[data-move-favorite="${direction}"]`));
  }), !0);
}
function reorderFavoriteByDrop(sourceKey, targetKey) {
  if (!sourceKey || !targetKey || sourceKey === targetKey) return !1;
  let visibleKeys = favoriteWorkspaceVisibleEntries().map(favoriteWorkspaceEntryKey), from = visibleKeys.indexOf(sourceKey), to = visibleKeys.indexOf(targetKey);
  return from < 0 || to < 0 ? !1 : (visibleKeys.splice(to, 0, visibleKeys.splice(from, 1)[0]), favoriteWorkspaceReorderVisible(visibleKeys), syncFavoritesUi({ renderPanel: !0 }), !0);
}
function setFavoriteWorkspaceSelection(key, selected) {
  key && (selected ? favoritesState.favoritesSelectedKeys.add(key) : favoritesState.favoritesSelectedKeys.delete(key), renderFavoritesWorkspace(getFavoriteEntries()));
}
function clearFavoritesSelection() {
  favoritesState.favoritesSelectedKeys.clear(), renderFavoritesWorkspace(getFavoriteEntries());
}
function favoriteWorkspaceItemUrl(entry) {
  return absoluteDocumentUrl(viewerDocumentUrl(entry.catalog.id, entry.page));
}
function favoriteWorkspaceMessage(entries, options = {}) {
  let lines = (options.purpose === "inquiry" ? "inquiry" : "share") === "inquiry" ? ["שלום,", "רציתי לברר לגבי הדגמים הבאים מתוך קטלוגי רהיטי ברגיג:", ""] : ["שלום,", "רציתי לשתף כמה דגמים מתוך קטלוגי רהיטי ברגיג:", ""];
  return entries.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.catalog.title} — עמוד ${entry.page}`), String(entry.note || "").trim() && lines.push(`הערה: ${String(entry.note).trim()}`), lines.push(favoriteWorkspaceItemUrl(entry), "");
  }), lines.join(`
`).trim();
}
function favoriteWorkspaceSelectionUrl(entries) {
  return buildFavoritesShareUrl(entries.map((entry) => ({ catalogId: entry.catalog.id, page: entry.page })));
}
async function copyFavoriteWorkspaceLink(entries, button = null) {
  if (!entries.length) return;
  let selectionUrl = favoriteWorkspaceSelectionUrl(entries);
  try {
    await copyTextToClipboard(selectionUrl), button && flashActionButton(button, "הקישור הועתק"), showActionToast("קישור המועדפים הועתק", { tone: "link" });
  } catch {
    window.prompt("אפשר להעתיק את קישור המועדפים מכאן:", selectionUrl);
  }
}
function favoriteWorkspaceFindEntryByKey(key) {
  return getFavoriteEntries().find((entry) => favoriteWorkspaceEntryKey(entry) === key) || null;
}
function syncFavoriteNoteCount() {
  !favoritesElements.favoriteNoteCount || !favoritesElements.favoriteNoteInput || (favoritesElements.favoriteNoteCount.textContent = `${favoritesElements.favoriteNoteInput.value.length}/${FAVORITES_NOTE_MAX_LENGTH}`);
}
function openFavoriteNoteEditor(key, returnFocus = isHtmlElement(document.activeElement) ? document.activeElement : null) {
  let entry = favoriteWorkspaceFindEntryByKey(key);
  !entry || !favoritesElements.favoriteNoteOverlay || !favoritesElements.favoriteNoteInput || (favoritesState.favoriteNoteEditingKey = key, favoritesState.favoriteNoteReturnFocus = returnFocus, favoritesElements.favoriteNoteTitle && (favoritesElements.favoriteNoteTitle.textContent = entry.note ? "עריכת הערה" : "הוספת הערה"), favoritesElements.favoriteNoteContext && (favoritesElements.favoriteNoteContext.textContent = `${entry.catalog.title} · עמוד ${entry.page}`), favoritesElements.favoriteNoteInput.value = String(entry.note || ""), syncFavoriteNoteCount(), favoritesElements.favoriteNoteOverlay.classList.remove("hidden"), favoritesElements.favoriteNoteOverlay.setAttribute("aria-hidden", "false"), syncDocumentLock(), requestAnimationFrame(() => {
    favoritesElements.favoriteNoteInput.focus(), favoritesElements.favoriteNoteInput.setSelectionRange(favoritesElements.favoriteNoteInput.value.length, favoritesElements.favoriteNoteInput.value.length);
  }));
}
function closeFavoriteNoteEditor(options = {}) {
  let { restoreFocus = !0 } = options, returnFocus = favoritesState.favoriteNoteReturnFocus;
  favoritesState.favoriteNoteEditingKey = "", favoritesState.favoriteNoteReturnFocus = null, favoritesElements.favoriteNoteOverlay?.classList.add("hidden"), favoritesElements.favoriteNoteOverlay?.setAttribute("aria-hidden", "true"), syncDocumentLock(), restoreFocus && returnFocus?.focus?.();
}
function saveFavoriteNote() {
  if (!favoritesState.favoriteNoteEditingKey || !favoritesStore || !favoritesElements.favoriteNoteInput) return;
  let entry = favoriteWorkspaceFindEntryByKey(favoritesState.favoriteNoteEditingKey);
  if (!entry) return closeFavoriteNoteEditor({ restoreFocus: !1 });
  let hasNote = !!favoritesElements.favoriteNoteInput.value.trim(), mutation = favoritesStore.setNoteDetailed(
    { catalogId: entry.catalog.id, page: entry.page },
    favoritesElements.favoriteNoteInput.value
  );
  closeFavoriteNoteEditor({ restoreFocus: !1 }), syncFavoritesUi({ renderPanel: !0 }), mutation.changed && showFavoritePersistenceFeedback(mutation, hasNote ? {
    persisted: "ההערה נשמרה",
    temporary: "ההערה נשמרה זמנית בלבד — היא תיעלם לאחר רענון",
    tone: "saved"
  } : {
    persisted: "ההערה הוסרה",
    temporary: "ההערה הוסרה זמנית בלבד — השינוי לא יישמר לאחר רענון",
    tone: "removed"
  }), requestAnimationFrame(() => {
    focusHtmlElement(favoriteWorkspaceFindCardByKey(favoriteWorkspaceEntryKey(entry))?.querySelector("[data-edit-favorite-note]"));
  });
}
function favoriteWorkspaceFocusable(container) {
  return container ? Array.from(container.querySelectorAll('button:not([disabled]), a[href]:not(.hidden), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter(isHtmlElement).filter((element) => !element.closest(".hidden")) : [];
}
function trapFavoriteWorkspaceDialogFocus(event, container, closeCallback) {
  if (event.key === "Escape")
    return event.preventDefault(), event.stopPropagation(), closeCallback(), !0;
  if (event.key !== "Tab") return !1;
  let focusable = favoriteWorkspaceFocusable(container);
  if (!focusable.length) return !1;
  let first = focusable[0], last = focusable[focusable.length - 1];
  return event.shiftKey && document.activeElement === first ? (event.preventDefault(), last.focus()) : !event.shiftKey && document.activeElement === last && (event.preventDefault(), first.focus()), !0;
}
function handleFavoritesWorkspaceGridClick(event) {
  let target = eventTargetElement(event.target), card = target?.closest("[data-favorite-catalog][data-favorite-page]");
  if (!card || !favoritesElements.favoritesGrid?.contains(card)) return !1;
  let key = favoriteWorkspaceCardKey(card);
  if (target?.closest("[data-edit-favorite-note]")) {
    let button = target.closest("button");
    return openFavoriteNoteEditor(key, isHtmlElement(button) ? button : null), !0;
  }
  let moveButton = target?.closest("[data-move-favorite]");
  return moveButton instanceof HTMLElement ? (moveFavoriteWithinVisibleOrder(key, Number(moveButton.dataset.moveFavorite)), !0) : !1;
}
function handleFavoritesWorkspaceGridChange(event) {
  let checkbox = eventTargetElement(event.target)?.closest("[data-select-favorite]");
  if (!(checkbox instanceof HTMLInputElement)) return;
  let card = checkbox.closest("[data-favorite-catalog][data-favorite-page]");
  setFavoriteWorkspaceSelection(favoriteWorkspaceCardKey(card), checkbox.checked);
}
function handleFavoritesWorkspaceDragStart(event) {
  let handle = eventTargetElement(event.target)?.closest("[data-drag-favorite]"), card = handle?.closest("[data-favorite-catalog][data-favorite-page]");
  !handle || !card || (favoritesState.favoritesDragKey = favoriteWorkspaceCardKey(card), card.classList.add("is-dragging"), event.dataTransfer?.setData("text/plain", "favorite-card"), event.dataTransfer && (event.dataTransfer.effectAllowed = "move"));
}
function handleFavoritesWorkspaceDragOver(event) {
  if (!favoritesState.favoritesDragKey) return;
  let card = eventTargetElement(event.target)?.closest("[data-favorite-catalog][data-favorite-page]");
  !card || favoriteWorkspaceCardKey(card) === favoritesState.favoritesDragKey || (event.preventDefault(), favoritesElements.favoritesGrid?.querySelectorAll(".is-drag-target").forEach((item) => item.classList.remove("is-drag-target")), card.classList.add("is-drag-target"));
}
function handleFavoritesWorkspaceDrop(event) {
  let card = eventTargetElement(event.target)?.closest("[data-favorite-catalog][data-favorite-page]");
  !card || !favoritesState.favoritesDragKey || (event.preventDefault(), reorderFavoriteByDrop(favoritesState.favoritesDragKey, favoriteWorkspaceCardKey(card)), favoritesState.favoritesDragKey = "");
}
function handleFavoritesWorkspaceDragEnd() {
  favoritesState.favoritesDragKey = "", favoritesElements.favoritesGrid?.querySelectorAll(".is-dragging, .is-drag-target").forEach((item) => item.classList.remove("is-dragging", "is-drag-target"));
}
function attachFavoritesWorkspaceEvents() {
  favoritesElements.favoritesCatalogFilter?.addEventListener("change", () => {
    favoritesState.favoritesFilterCatalogId = favoritesElements.favoritesCatalogFilter.value, renderFavoritesWorkspace(getFavoriteEntries());
  }), favoritesElements.favoritesResetFilter?.addEventListener("click", () => {
    favoritesState.favoritesFilterCatalogId = "", renderFavoritesWorkspace(getFavoriteEntries()), requestAnimationFrame(() => favoritesElements.favoritesCatalogFilter?.focus?.());
  }), favoritesElements.favoritesClearSelection?.addEventListener("click", clearFavoritesSelection), favoritesElements.favoritesInquiryButton?.addEventListener("click", openFavoriteWorkspaceInquiry), favoritesElements.favoritesGrid?.addEventListener("change", handleFavoritesWorkspaceGridChange), favoritesElements.favoritesGrid?.addEventListener("dragstart", handleFavoritesWorkspaceDragStart), favoritesElements.favoritesGrid?.addEventListener("dragover", handleFavoritesWorkspaceDragOver), favoritesElements.favoritesGrid?.addEventListener("drop", handleFavoritesWorkspaceDrop), favoritesElements.favoritesGrid?.addEventListener("dragend", handleFavoritesWorkspaceDragEnd), favoritesElements.favoriteNoteInput?.addEventListener("input", syncFavoriteNoteCount), favoritesElements.favoriteNoteSave?.addEventListener("click", saveFavoriteNote), favoritesElements.favoriteNoteCancel?.addEventListener("click", () => closeFavoriteNoteEditor()), favoritesElements.favoriteNoteClose?.addEventListener("click", () => closeFavoriteNoteEditor()), favoritesElements.favoriteNoteBackdrop?.addEventListener("click", () => closeFavoriteNoteEditor()), favoritesElements.favoriteNoteOverlay?.addEventListener("keydown", (event) => trapFavoriteWorkspaceDialogFocus(event, favoritesElements.favoriteNoteOverlay, closeFavoriteNoteEditor));
}
registerFeatureInterface("favorites-workspace", {
  attachEvents: attachFavoritesWorkspaceEvents,
  shareLinkEntries: (entries = getFavoriteEntries()) => favoriteWorkspaceShareLinkEntries(entries),
  copyShareLink: (entries, button = null) => copyFavoriteWorkspaceLink(entries, button),
  render: (entries = getFavoriteEntries()) => renderFavoritesWorkspace(entries),
  prune: (entries = getFavoriteEntries()) => pruneFavoritesWorkspaceState(entries),
  handleGridClick: (event) => handleFavoritesWorkspaceGridClick(event),
  closeNoteEditor: (options = {}) => closeFavoriteNoteEditor(options)
});

// src/js/12-catalog-state.js
var catalogState = {
  catalogLayoutColumns: 0,
  catalogLayoutResizeTimer: 0,
  catalogScrollTopButtonRaf: 0,
  categoryFocusTargetId: "",
  categoryFocusTimer: 0,
  categoryNavFitRaf: 0
}, catalogElements = Object.freeze({
  categoryNav: requiredElement("categoryNav"),
  mobileCategoryMenuToggle: $requiredButton("mobileCategoryMenuToggle"),
  mobileCategoryMenu: requiredElement("mobileCategoryMenu"),
  catalogCount: $("catalogCount"),
  pageCount: $("pageCount"),
  catalogGrid: requiredElement("catalogGrid"),
  catalogLoadStatus: requiredElement("catalogLoadStatus"),
  catalogDetail: requiredElement("catalogDetail"),
  catalogTitle: requiredElement("catalogDetailTitle"),
  catalogDescription: requiredElement("catalogDescription"),
  catalogMenuToggle: $requiredButton("catalogMenuToggle"),
  catalogMenuToggleText: requiredElement("catalogMenuToggleText"),
  catalogMenu: requiredElement("catalogMenu"),
  catalogCoverPreview: $image("catalogCoverPreview"),
  pageGrid: requiredElement("pageGrid"),
  openCatalogEntryFromDetail: $requiredButton("openCatalogEntryFromDetail"),
  scrollToTopBtn: $requiredButton("scrollToTopBtn")
});

// src/js/39-search-catalog-domain.js
var searchCatalogDomain = (() => {
  function decodeCatalogHashTargetId(hash) {
    let rawHash = String(hash || "");
    if (!rawHash.startsWith("#")) return "";
    let rawId = rawHash.slice(1);
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  }
  function catalogColumnCount(matches) {
    return matches?.mobile ? 1 : matches?.tablet ? 2 : 3;
  }
  function clampCatalogSpan(value, columns) {
    return Math.min(columns, Math.max(1, Number(value || 1)));
  }
  function catalogSubcategorySourceBlocks(source) {
    let sourceBlocks = [];
    return Array.isArray(source?.directItems) && source.directItems.length && sourceBlocks.push({
      blockKey: "__direct__",
      blockIndex: -1,
      label: "קטלוגים כלליים",
      isDirect: !0,
      items: source.directItems
    }), (Array.isArray(source?.subcategories) ? source.subcategories : []).forEach((group, index) => {
      let subcategory = String(group?.subcategory || "").trim(), items = Array.isArray(group?.items) ? group.items : [];
      !subcategory || !items.length || sourceBlocks.push({
        blockKey: subcategory,
        blockIndex: index,
        label: subcategory,
        isDirect: !1,
        items
      });
    }), sourceBlocks;
  }
  function catalogCategorySegments(groups, columns) {
    let safeColumns = clampCatalogSpan(columns, 3), segments = [], occupied = 0, appendCardBlockSegments = (group, groupIndex, block, options = {}) => {
      let items = Array.isArray(block?.items) ? block.items : [];
      if (!items.length) return;
      let segmentType = options.segmentType || "category", layoutBlockKey = options.layoutBlockKey || `${segmentType}:${groupIndex}:${block?.blockKey || "main"}`, itemOffset = 0, segmentIndex = 0;
      for (; itemOffset < items.length; ) {
        occupied >= safeColumns && (occupied = 0);
        let availableInRow = occupied > 0 ? safeColumns - occupied : safeColumns, span = Math.min(availableInRow, items.length - itemOffset, safeColumns), segment = {
          category: group.category,
          groupIndex,
          segmentIndex,
          itemOffset,
          span,
          items: items.slice(itemOffset, itemOffset + span),
          hasSubcategories: !!options.hasSubcategories,
          segmentType,
          layoutBlockKey,
          inlineDivider: !1
        };
        segmentType === "subcategory" && Object.assign(segment, {
          blockKey: block.blockKey,
          blockIndex: block.blockIndex,
          blockOrder: options.blockOrder,
          label: block.label,
          isDirect: !!block.isDirect
        }), segments.push(segment), itemOffset += span, segmentIndex += 1, occupied += span, occupied >= safeColumns && (occupied = 0);
      }
    };
    return groups.forEach((group, groupIndex) => {
      let items = Array.isArray(group?.items) ? group.items : [];
      if (items.length) {
        if (group?.hasSubcategories) {
          occupied > 0 && (occupied = 0), segments.push({
            category: group.category,
            groupIndex,
            segmentIndex: 0,
            itemOffset: 0,
            span: safeColumns,
            items: [],
            directItems: Array.isArray(group.directItems) ? group.directItems : [],
            subcategories: Array.isArray(group.subcategories) ? group.subcategories : [],
            hasSubcategories: !0,
            segmentType: "categoryHeader",
            layoutBlockKey: `category-header:${groupIndex}`,
            inlineDivider: !1
          }), occupied = 0, catalogSubcategorySourceBlocks(group).forEach((block, blockOrder) => {
            appendCardBlockSegments(group, groupIndex, block, {
              segmentType: "subcategory",
              hasSubcategories: !0,
              blockOrder,
              layoutBlockKey: `subcategory:${groupIndex}:${block.blockKey}:${blockOrder}`
            });
          });
          return;
        }
        appendCardBlockSegments(group, groupIndex, { blockKey: "__category__", items }, {
          segmentType: "category",
          hasSubcategories: !1,
          layoutBlockKey: `category:${groupIndex}`
        });
      }
    }), occupied = 0, segments.forEach((segment, index) => {
      let span = clampCatalogSpan(segment.span, safeColumns);
      occupied + span > safeColumns && (occupied = 0);
      let rowEnd = occupied + span, nextSegment = segments[index + 1], nextSpan = nextSegment ? clampCatalogSpan(nextSegment.span, safeColumns) : 0, sameLayoutBlock = !!(nextSegment && nextSegment.layoutBlockKey === segment.layoutBlockKey);
      segment.inlineDivider = !!(nextSegment && !sameLayoutBlock && segment.segmentType !== "categoryHeader" && nextSegment.segmentType !== "categoryHeader" && rowEnd < safeColumns && nextSpan <= safeColumns - rowEnd), occupied = rowEnd >= safeColumns ? 0 : rowEnd;
    }), segments;
  }
  function escapeSearchMarkup(text) {
    return String(text ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
  function highlightedSearchText(text, ranges = []) {
    let raw = String(text || "");
    if (!raw) return "";
    let normalizedRanges = Array.isArray(ranges) ? ranges.map((range) => ({
      start: Math.max(0, Math.min(raw.length, Number(range?.start) || 0)),
      end: Math.max(0, Math.min(raw.length, Number(range?.end) || 0))
    })).filter((range) => range.end > range.start).sort((first, second) => first.start - second.start || first.end - second.end) : [], cursor = 0, markup = "";
    return normalizedRanges.forEach((range) => {
      range.start < cursor || (markup += escapeSearchMarkup(raw.slice(cursor, range.start)), markup += `<mark class="search-match-highlight">${escapeSearchMarkup(raw.slice(range.start, range.end))}</mark>`, cursor = range.end);
    }), markup + escapeSearchMarkup(raw.slice(cursor));
  }
  function searchResultPage(value) {
    let page = Number.parseInt(String(value), 10);
    return Number.isFinite(page) && page >= 0 ? page : 1;
  }
  function searchResultDetailsMarkup(result) {
    let page = searchResultPage(result?.page), reason = String(result?.matchReason || "התאמה בטקסט הקטלוג"), excerpt = highlightedSearchText(result?.excerpt || "", result?.highlights || []);
    return `
      <span class="search-result-meta">עמוד ${page} · ${escapeSearchMarkup(reason)}</span>
      ${excerpt ? `<span class="search-result-excerpt">${excerpt}</span>` : ""}
    `;
  }
  function lightboxSearchColumnLimit(featureColumns, viewportWidth) {
    let columns = Number(featureColumns);
    if (Number.isFinite(columns)) return Math.max(1, Math.min(columns, 3));
    let width = Math.max(0, Number(viewportWidth) || 0);
    return width >= 1180 ? 3 : width >= 760 ? 2 : 1;
  }
  function resolveGlobalSearchResultAction(result) {
    if (!result) return null;
    if (result.targetId) return { type: "category", targetId: String(result.targetId) };
    let catalogId = String(result.catalogId || "").trim();
    return catalogId ? result.resultType === "catalog" ? { type: "catalog", catalogId } : { type: "viewer", catalogId, page: searchResultPage(result.page) } : null;
  }
  function executeGlobalSearchResultAction(result, ports) {
    let action = resolveGlobalSearchResultAction(result);
    return action ? action.type === "category" ? ports.activateCategoryTarget(action.targetId) === !0 : (action.type === "catalog" ? ports.openCatalog(action.catalogId) : ports.openViewer(action.catalogId, action.page), !0) : !1;
  }
  function executeLightboxSearchResultAction(result, activeCatalog2, ports) {
    if (!result) return !1;
    let targetCatalogId = String(result.catalogId || activeCatalog2?.id || "").trim();
    if (!targetCatalogId) return !1;
    let requestedPage = searchResultPage(result.page), page = clampCatalogPage(requestedPage, activeCatalog2);
    return !activeCatalog2 || String(activeCatalog2.id) !== targetCatalogId ? (ports.openCatalog(targetCatalogId, requestedPage), !0) : (ports.setPage(page), ports.showTopUi(), !0);
  }
  return Object.freeze({
    decodeCatalogHashTargetId,
    catalogColumnCount,
    clampCatalogSpan,
    catalogSubcategorySourceBlocks,
    catalogCategorySegments,
    highlightedSearchText,
    searchResultDetailsMarkup,
    lightboxSearchColumnLimit,
    resolveGlobalSearchResultAction,
    executeGlobalSearchResultAction,
    executeLightboxSearchResultAction
  });
})();

// src/js/50-search-ui.js
import { tooltips as tooltips2 } from "./tooltip-manager.js";

// src/js/13-search-state.js
var SEARCH_INPUT_DEBOUNCE_MS = 90, SEARCH_INDEX_PRELOAD_DELAY_MS = 6e3, MOBILE_READER_SEARCH_MEDIA = "(max-width: 760px)", SEARCH_PREVIEW_SCROLL_SUPPRESS_MS = 260, searchState = {
  globalSearchCategory: "",
  globalSearchOpen: !1,
  lightboxSearchScope: "catalog",
  lightboxMobileSearchOpen: !1,
  searchIndexLoadState: catalogSearch.isReady() ? "ready" : "idle",
  searchIndexLoadPromise: null,
  searchIndexPreloadTimer: 0,
  searchPreviewSuppressUntil: 0,
  searchPreviewSuppressTimer: 0,
  searchPreviewPointerClientX: null,
  searchPreviewPointerClientY: null
}, searchElements = Object.freeze({
  catalogSearch: requiredElement("catalogSearch"),
  globalSearchOpen: $requiredButton("globalSearchOpen"),
  globalSearchClose: $requiredButton("globalSearchClose"),
  globalSearchInput: $requiredInput("globalSearchInput"),
  globalSearchResults: requiredElement("globalSearchResults"),
  globalSearchClear: $requiredButton("globalSearchClear"),
  globalSearchScopeToggle: $requiredButton("globalSearchScopeToggle"),
  globalSearchScopeMenu: requiredElement("globalSearchScopeMenu"),
  searchFloatingPreview: requiredElement("searchFloatingPreview"),
  searchFloatingPreviewImage: $requiredImage("searchFloatingPreviewImage"),
  searchFloatingPreviewPage: requiredElement("searchFloatingPreviewPage"),
  lightboxSearchInput: $requiredInput("lightboxSearchInput"),
  lightboxSearchPanel: requiredElement("lightboxSearchPanel"),
  lightboxMobileSearchToggle: $requiredButton("lightboxMobileSearchToggle"),
  lightboxMobileSearchClose: $requiredButton("lightboxMobileSearchClose"),
  lightboxSearchResults: requiredElement("lightboxSearchResults"),
  lightboxSearchStatus: requiredElement("lightboxSearchStatus"),
  lightboxSearchClear: $requiredButton("lightboxSearchClear"),
  lightboxSearchScopeToggle: $requiredButton("lightboxSearchScopeToggle"),
  lightboxSearchScopeMenu: requiredElement("lightboxSearchScopeMenu"),
  lightboxCatalogMenuToggle: $requiredButton("lightboxCatalogMenuToggle"),
  lightboxCatalogMenu: requiredElement("lightboxCatalogMenu")
});

// src/js/50-search-ui.js
var globalSearchRenderTimer = 0, lightboxSearchRenderTimer = 0, globalSearchAppendTimer = 0, globalSearchRenderSequence = 0, lightboxSearchRenderSequence = 0, lastGlobalSearchResults = [], lastLightboxSearchResults = [], lastGlobalSearchKey = "", lastLightboxSearchKey = "", GLOBAL_SEARCH_INITIAL_RENDER_COUNT = 6, GLOBAL_SEARCH_RENDER_CHUNK_SIZE = 6;
function isSearchIndexReady() {
  return catalogSearch.isReady();
}
function refreshSearchUiAfterIndexLoad() {
  initSearchStatus(), initLightboxSearchStatus();
}
function ensureSearchIndexLoaded(options = {}) {
  if (isSearchIndexReady())
    return searchState.searchIndexLoadState = "ready", Promise.resolve(!0);
  if (searchState.searchIndexLoadPromise) return searchState.searchIndexLoadPromise;
  searchState.searchIndexLoadState = "loading", initLightboxSearchStatus();
  let loadTrigger = telemetryCleanText(options.trigger || "interactive", 40);
  return searchState.searchIndexLoadPromise = catalogSearch.ensureReady().then(() => (searchState.searchIndexLoadState = "ready", searchState.searchIndexLoadPromise = null, refreshSearchUiAfterIndexLoad(), !0)).catch((error) => {
    throw searchState.searchIndexLoadState = "error", searchState.searchIndexLoadPromise = null, telemetryTrackSearchIndexFailure("network-error", { trigger: loadTrigger }), initSearchStatus(), initLightboxSearchStatus(), error;
  }), searchState.searchIndexLoadPromise;
}
function scheduleSearchIndexPreload() {
  window.clearTimeout(searchState.searchIndexPreloadTimer), !isSaveDataEnabled() && (searchState.searchIndexPreloadTimer = window.setTimeout(() => {
    if (isSaveDataEnabled()) return;
    let preload = () => ensureSearchIndexLoaded({ trigger: "preload" }).catch(() => {
    });
    "requestIdleCallback" in window ? window.requestIdleCallback(preload, { timeout: 2500 }) : preload();
  }, SEARCH_INDEX_PRELOAD_DELAY_MS));
}
function cancelScheduledSearch(channel) {
  channel === "global" ? (window.clearTimeout(globalSearchRenderTimer), window.clearTimeout(globalSearchAppendTimer), globalSearchRenderTimer = 0, globalSearchAppendTimer = 0, globalSearchRenderSequence += 1) : (window.clearTimeout(lightboxSearchRenderTimer), lightboxSearchRenderTimer = 0, lightboxSearchRenderSequence += 1), catalogSearch.cancel(channel);
}
function cancelGlobalSearchResultAppend() {
  window.clearTimeout(globalSearchAppendTimer), globalSearchAppendTimer = 0;
}
function scheduleSearchRender(channel, query, options = {}) {
  let delay = options.immediate ? 0 : SEARCH_INPUT_DEBOUNCE_MS, callback = channel === "global" ? () => renderSearchResults(query) : () => renderLightboxSearchResults(query);
  catalogSearch.cancel(channel), channel === "global" ? (cancelGlobalSearchResultAppend(), globalSearchRenderSequence += 1, window.clearTimeout(globalSearchRenderTimer), globalSearchRenderTimer = window.setTimeout(callback, delay)) : (lightboxSearchRenderSequence += 1, window.clearTimeout(lightboxSearchRenderTimer), lightboxSearchRenderTimer = window.setTimeout(callback, delay));
}
function getGlobalSearchCategories() {
  return getCatalogCategoryGroups().filter((group) => String(group.category || "").trim() && Array.isArray(group.items) && group.items.length).map((group) => ({ category: group.category }));
}
function hasGlobalSearchCategory(category) {
  let requestedCategory = String(category || "").trim();
  return requestedCategory ? getCatalogCategoryGroups().some((group) => group.category === requestedCategory) : !1;
}
function getGlobalSearchCategory() {
  let selectedCategory = String(searchState.globalSearchCategory || "").trim();
  return selectedCategory && hasGlobalSearchCategory(selectedCategory) ? selectedCategory : "";
}
function globalSearchScopeLabel(category = getGlobalSearchCategory()) {
  return category || "בכל הקטלוגים";
}
function globalSearchPlaceholder() {
  let category = getGlobalSearchCategory();
  return category ? `חיפוש קטלוג, קטגוריה או דגם בתוך ${category}...` : "חיפוש קטגוריה, תת קטגוריה, קטלוג, דגם או טקסט...";
}
function closeGlobalSearchScopeMenu() {
  searchElements.globalSearchScopeMenu?.classList.add("hidden"), searchElements.globalSearchScopeToggle?.setAttribute("aria-expanded", "false");
}
function isGlobalSearchPanelOpen() {
  return !!(searchState.globalSearchOpen && searchElements.catalogSearch && !searchElements.catalogSearch.classList.contains("hidden"));
}
function setGlobalSearchPanelOpen(open, options = {}) {
  let shouldOpen = !!open;
  if (searchState.globalSearchOpen = shouldOpen, !!searchElements.catalogSearch) {
    if (searchElements.catalogSearch.classList.toggle("hidden", !shouldOpen), searchElements.catalogSearch.classList.toggle("is-open", shouldOpen), searchElements.catalogSearch.setAttribute("aria-hidden", shouldOpen ? "false" : "true"), searchElements.globalSearchOpen?.classList.toggle("is-active", shouldOpen), searchElements.globalSearchOpen?.setAttribute("aria-expanded", shouldOpen ? "true" : "false"), shouldOpen) {
      renderGlobalSearchScopeMenu(), renderSearchResults(searchElements.globalSearchInput?.value || ""), options.focus !== !1 && window.requestAnimationFrame(() => searchElements.globalSearchInput?.focus({ preventScroll: !0 }));
      return;
    }
    closeGlobalSearchScopeMenu(), hideSearchFloatingPreview(), cancelScheduledSearch("global"), options.hideResults !== !1 && searchElements.globalSearchResults?.classList.add("hidden"), options.focusButton && window.requestAnimationFrame(() => searchElements.globalSearchOpen?.focus({ preventScroll: !0 }));
  }
}
function closeGlobalSearchPanel(options = {}) {
  setGlobalSearchPanelOpen(!1, options);
}
function renderGlobalSearchScopeMenu() {
  if (!searchElements.globalSearchScopeMenu) return;
  let categories = getGlobalSearchCategories();
  searchElements.globalSearchScopeMenu.innerHTML = `
    <button type="button" role="menuitemradio" aria-checked="true" data-global-search-category="">
      <strong>בכל הקטלוגים</strong>
    </button>
    ${categories.map((group) => `
      <button type="button" role="menuitemradio" aria-checked="false" data-global-search-category="${escapeHtml(group.category)}">
        <strong>${escapeHtml(group.category)}</strong>
      </button>
    `).join("")}
  `, syncGlobalSearchScopeUi();
}
function syncGlobalSearchScopeUi() {
  let category = getGlobalSearchCategory();
  searchElements.globalSearchScopeToggle && (searchElements.globalSearchScopeToggle.innerHTML = `${escapeHtml(globalSearchScopeLabel(category))} <span aria-hidden="true">⌄</span>`, searchElements.globalSearchScopeToggle.title = category ? `חיפוש רק בקטגוריית ${category}` : "חיפוש בכל הקטלוגים"), searchElements.globalSearchInput && (searchElements.globalSearchInput.placeholder = globalSearchPlaceholder(), searchElements.globalSearchInput.setAttribute("aria-label", globalSearchPlaceholder())), Array.from(searchElements.globalSearchScopeMenu?.querySelectorAll("[data-global-search-category]") || []).filter(isHtmlElement).forEach((button) => {
    let selected = String(button.dataset.globalSearchCategory || "") === category;
    button.classList.toggle("active", selected), button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}
function setGlobalSearchCategory(category, options = {}) {
  let requestedCategory = String(category || "").trim(), nextCategory = requestedCategory && hasGlobalSearchCategory(requestedCategory) ? requestedCategory : "";
  if (searchState.globalSearchCategory === nextCategory) {
    syncGlobalSearchScopeUi(), closeGlobalSearchScopeMenu();
    return;
  }
  searchState.globalSearchCategory = nextCategory, syncGlobalSearchScopeUi(), closeGlobalSearchScopeMenu(), initSearchStatus(), options.render !== !1 && searchElements.globalSearchInput && renderSearchResults(searchElements.globalSearchInput.value);
}
function initSearchStatus() {
  syncGlobalSearchScopeUi();
}
function getLightboxSearchScope() {
  return searchState.lightboxSearchScope === "all" ? "all" : "catalog";
}
function lightboxSearchScopeLabel(scope = getLightboxSearchScope()) {
  return scope === "all" ? "בכל הקטלוגים" : "בקטלוג הזה";
}
function lightboxSearchPlaceholder() {
  if (getLightboxSearchScope() === "all") return "חיפוש דגם בכל הקטלוגים...";
  let title = String(activeCatalog()?.title || "").trim();
  return title ? `חיפוש ב: ${title}` : "חיפוש ב...";
}
function closeLightboxSearchScopeMenu() {
  searchElements.lightboxSearchScopeMenu?.classList.add("hidden"), searchElements.lightboxSearchScopeToggle?.setAttribute("aria-expanded", "false");
}
function closeLightboxCatalogMenu() {
  searchElements.lightboxCatalogMenu?.classList.add("hidden"), searchElements.lightboxCatalogMenuToggle?.setAttribute("aria-expanded", "false");
}
function isMobileReaderSearchMode() {
  return !!window.matchMedia?.(MOBILE_READER_SEARCH_MEDIA).matches;
}
function syncLightboxMobileSearchUi() {
  let compactMode = isMobileReaderSearchMode(), isOpen = compactMode && searchState.lightboxMobileSearchOpen;
  compactMode || (searchState.lightboxMobileSearchOpen = !1), getFeatureInterface("viewer")?.syncMobileSearchUi?.(isOpen), searchElements.lightboxMobileSearchToggle?.setAttribute("aria-expanded", isOpen ? "true" : "false"), searchElements.lightboxSearchPanel?.setAttribute("aria-hidden", compactMode && !isOpen ? "true" : "false");
}
function setLightboxMobileSearchOpen(open, options = {}) {
  let { focusInput = !1, returnFocus = !1, hideResults = !0, hideTopUi = !1 } = options, shouldOpen = !!(open && getFeatureInterface("viewer")?.isViewerOpen?.() && isMobileReaderSearchMode());
  if (searchState.lightboxMobileSearchOpen = shouldOpen, syncLightboxMobileSearchUi(), shouldOpen) {
    closeLightboxCatalogMenu(), closeLightboxSearchScopeMenu(), getFeatureInterface("viewer")?.showTopUi?.(), ensureSearchIndexLoaded().catch(() => {
    }), focusInput && window.requestAnimationFrame(() => searchElements.lightboxSearchInput?.focus());
    return;
  }
  hideResults && hideLightboxSearchResults({ blurTopUiFocus: !0, hideTopUi }), returnFocus && isMobileReaderSearchMode() && searchElements.lightboxMobileSearchToggle?.focus();
}
function syncLightboxSearchScopeUi() {
  let scope = getLightboxSearchScope();
  searchElements.lightboxSearchScopeToggle && (searchElements.lightboxSearchScopeToggle.innerHTML = `${escapeHtml(lightboxSearchScopeLabel(scope))} <span aria-hidden="true">⌄</span>`), searchElements.lightboxSearchInput && (searchElements.lightboxSearchInput.placeholder = lightboxSearchPlaceholder(), searchElements.lightboxSearchInput.setAttribute("aria-label", lightboxSearchPlaceholder())), Array.from(searchElements.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]") || []).filter(isHtmlElement).forEach((button) => {
    let selected = button.dataset.lightboxSearchScope === scope;
    button.classList.toggle("active", selected), button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}
function setLightboxSearchScope(scope, options = {}) {
  let nextScope = scope === "all" ? "all" : "catalog";
  if (searchState.lightboxSearchScope === nextScope) {
    syncLightboxSearchScopeUi(), closeLightboxSearchScopeMenu();
    return;
  }
  searchState.lightboxSearchScope = nextScope, syncLightboxSearchScopeUi(), closeLightboxSearchScopeMenu(), initLightboxSearchStatus(), options.render !== !1 && searchElements.lightboxSearchInput && renderLightboxSearchResults(searchElements.lightboxSearchInput.value);
}
function hideLightboxSearchResults(options = {}) {
  let { blurTopUiFocus = !1, hideTopUi = !1 } = options;
  if (hideSearchFloatingPreview(), searchElements.lightboxSearchResults?.classList.add("hidden"), closeLightboxSearchScopeMenu(), closeLightboxCatalogMenu(), blurTopUiFocus) {
    let activeElement = document.activeElement;
    isHtmlElement(activeElement) && getFeatureInterface("viewer")?.containsTopBarElement(activeElement) && activeElement.blur();
  }
  hideTopUi && getFeatureInterface("viewer")?.hideTopUiForSearch?.();
}
function resetLightboxSearch() {
  searchState.lightboxMobileSearchOpen = !1, syncLightboxMobileSearchUi(), searchElements.lightboxSearchInput && (searchElements.lightboxSearchInput.value = ""), hideLightboxSearchResults({ blurTopUiFocus: !0 }), searchElements.lightboxSearchResults && (searchElements.lightboxSearchResults.innerHTML = ""), searchElements.lightboxSearchClear?.classList.add("hidden"), syncLightboxSearchScopeUi(), initLightboxSearchStatus();
}
function lightboxSearchKey(query) {
  let scope = getLightboxSearchScope();
  return [String(query || "").trim(), scope, scope === "all" ? "" : activeCatalog()?.id || ""].join("\0");
}
async function getLightboxSearchResults(query, limit = 24, control = {}) {
  let rawQuery = String(query || "").trim();
  if (rawQuery.length < 2) return [];
  if (await ensureSearchIndexLoaded({ trigger: "viewer-search" }), control.isCurrent && !control.isCurrent()) return [];
  if (!catalogSearch.hasIndex()) return [];
  let options = { limit, channel: "viewer" };
  if (getLightboxSearchScope() !== "all") {
    let catalog = activeCatalog();
    if (!catalog) return [];
    options.catalogId = catalog.id;
  }
  let results = await catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}
async function trackCompletedLightboxSearch(completion, query = searchElements.lightboxSearchInput?.value || "") {
  let rawQuery = String(query || "").trim(), scope = getLightboxSearchScope(), results = lightboxSearchKey(rawQuery) === lastLightboxSearchKey ? lastLightboxSearchResults : await getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24);
  return telemetryTrackSearch(rawQuery, results.length, {
    surface: "viewer",
    scope,
    catalogId: scope === "all" ? "" : activeCatalog()?.id,
    completion
  }), results;
}
function openLightboxSearchResult(result) {
  if (!result) return !1;
  let catalog = activeCatalog(), targetCatalogId = String(result.catalogId || catalog?.id || "").trim(), sameCatalog = !!(catalog && String(catalog.id) === targetCatalogId), viewer = requireFeatureInterface("viewer"), handled = searchCatalogDomain.executeLightboxSearchResultAction(result, catalog, {
    openCatalog: viewer.openCatalog,
    setPage: viewer.setPage,
    showTopUi: viewer.showTopUi
  });
  return !handled || !sameCatalog ? handled : (searchState.lightboxMobileSearchOpen ? setLightboxMobileSearchOpen(!1, { hideResults: !0 }) : hideLightboxSearchResults(), !0);
}
async function submitLightboxSearch() {
  let rawQuery = String(searchElements.lightboxSearchInput?.value || "").trim(), results = await renderLightboxSearchResults(rawQuery);
  return await trackCompletedLightboxSearch("submit", rawQuery), openLightboxSearchResult(results[0]);
}
function initLightboxSearchStatus() {
  if (!searchElements.lightboxSearchStatus) return;
  let hasCatalog = !!activeCatalog(), hasIndex = !!catalogSearch.hasIndex(), indexPending = !hasIndex && searchState.searchIndexLoadState !== "error";
  if (searchElements.lightboxSearchInput && (searchElements.lightboxSearchInput.disabled = !hasCatalog), syncLightboxSearchScopeUi(), !hasCatalog) {
    searchElements.lightboxSearchStatus.textContent = "בחר קטלוג כדי לחפש.";
    return;
  }
  if (!hasIndex) {
    searchElements.lightboxSearchStatus.textContent = indexPending ? "אינדקס החיפוש נטען לפי הצורך." : "אינדקס החיפוש אינו זמין כרגע.";
    return;
  }
  searchElements.lightboxSearchStatus.textContent = getLightboxSearchScope() === "all" ? "הקלד לפחות 2 תווים לחיפוש בכל הקטלוגים." : "הקלד לפחות 2 תווים לחיפוש בתוך הקטלוג הפתוח.";
}
function hideSearchFloatingPreview() {
  searchElements.searchFloatingPreview?.classList.remove("visible");
}
function isGlobalSearchScopeMenuOpen() {
  return !!(searchElements.globalSearchScopeMenu && !searchElements.globalSearchScopeMenu.classList.contains("hidden"));
}
function isLightboxSearchScopeMenuOpen() {
  return !!(searchElements.lightboxSearchScopeMenu && !searchElements.lightboxSearchScopeMenu.classList.contains("hidden"));
}
function rememberSearchPreviewPointer(event) {
  let clientX = Number(event?.clientX), clientY = Number(event?.clientY);
  !Number.isFinite(clientX) || !Number.isFinite(clientY) || (searchState.searchPreviewPointerClientX = clientX, searchState.searchPreviewPointerClientY = clientY);
}
function searchPreviewTargetBelongsToOpenResults(target) {
  return !target || !target.isConnected ? !1 : searchElements.globalSearchResults?.contains(target) ? isGlobalSearchPanelOpen() && !searchElements.globalSearchResults.classList.contains("hidden") : searchElements.lightboxSearchResults?.contains(target) ? !!getFeatureInterface("viewer")?.isViewerOpen?.() && !searchElements.lightboxSearchResults.classList.contains("hidden") : !1;
}
function isSearchPreviewBlockedByOpenMenu(target) {
  return target instanceof Node ? !!(searchElements.globalSearchResults?.contains(target) && isGlobalSearchScopeMenuOpen() || searchElements.lightboxSearchResults?.contains(target) && isLightboxSearchScopeMenuOpen()) : !1;
}
function getSearchPreviewTargetAtLastPointer() {
  let clientX = Number(searchState.searchPreviewPointerClientX), clientY = Number(searchState.searchPreviewPointerClientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || clientX < 0 || clientY < 0 || clientX > window.innerWidth || clientY > window.innerHeight) return null;
  let target = document.elementFromPoint(clientX, clientY)?.closest?.("[data-search-preview-src]");
  return target instanceof HTMLElement && searchPreviewTargetBelongsToOpenResults(target) ? target : null;
}
function isSearchPreviewSuppressed() {
  return Date.now() < (searchState.searchPreviewSuppressUntil || 0);
}
function restoreSearchFloatingPreviewAfterSuppression() {
  if (isSearchPreviewSuppressed() || !hasHoverPointer()) return;
  let target = getSearchPreviewTargetAtLastPointer();
  !target || isSearchPreviewBlockedByOpenMenu(target) || showSearchFloatingPreview(target);
}
function suppressSearchFloatingTooltip(duration = SEARCH_PREVIEW_SCROLL_SUPPRESS_MS, options = {}) {
  tooltips2.suppress(duration, options);
}
function suppressSearchFloatingPreview(duration = SEARCH_PREVIEW_SCROLL_SUPPRESS_MS, options = {}) {
  let { restoreAfter = !0 } = options, delay = Math.max(0, Number(duration) || 0);
  suppressSearchFloatingTooltip(delay, { restoreAfter }), searchState.searchPreviewSuppressUntil = Math.max(
    searchState.searchPreviewSuppressUntil || 0,
    Date.now() + delay
  ), hideSearchFloatingPreview(), window.clearTimeout(searchState.searchPreviewSuppressTimer), searchState.searchPreviewSuppressTimer = window.setTimeout(() => {
    searchState.searchPreviewSuppressTimer = 0, restoreAfter && restoreSearchFloatingPreviewAfterSuppression();
  }, delay + 20);
}
function searchPreviewPageLabel(target) {
  return String(target?.dataset?.searchPreviewTitle || "קטלוג").trim() || "קטלוג";
}
function positionSearchFloatingPreview(target) {
  let preview = searchElements.searchFloatingPreview;
  if (!preview || !target) return;
  let targetRect = target.getBoundingClientRect(), gap = 16, safeMargin = 12, fallbackWidth = Math.min(430, Math.max(180, window.innerWidth * 0.34)), fallbackHeight = Math.min(620, Math.max(180, window.innerHeight * 0.64)), previewRect = preview.getBoundingClientRect(), previewWidth = previewRect.width || fallbackWidth, previewHeight = previewRect.height || fallbackHeight, left;
  targetRect.left - gap - previewWidth >= safeMargin ? left = targetRect.left - gap - previewWidth : targetRect.right + gap + previewWidth <= window.innerWidth - safeMargin ? left = targetRect.right + gap : left = targetRect.left + targetRect.width / 2 - previewWidth / 2;
  let top = targetRect.top + targetRect.height / 2 - previewHeight / 2;
  preview.style.left = `${clampValue(left, safeMargin, Math.max(safeMargin, window.innerWidth - previewWidth - safeMargin))}px`, preview.style.top = `${clampValue(top, safeMargin, Math.max(safeMargin, window.innerHeight - previewHeight - safeMargin))}px`;
}
function showSearchFloatingPreview(target) {
  if (!target || !searchElements.searchFloatingPreview || !searchElements.searchFloatingPreviewImage || !searchPreviewTargetBelongsToOpenResults(target) || isSearchPreviewSuppressed() || isSearchPreviewBlockedByOpenMenu(target)) return;
  let src = String(target.dataset.searchPreviewSrc || "").trim();
  if (!src) return;
  let label = searchPreviewPageLabel(target), previewImage = searchElements.searchFloatingPreviewImage;
  previewImage.removeAttribute("width"), previewImage.removeAttribute("height"), previewImage.onload = () => positionSearchFloatingPreview(target), setCatalogImageSource(previewImage, src), searchElements.searchFloatingPreviewImage.alt = label, searchElements.searchFloatingPreviewPage && (searchElements.searchFloatingPreviewPage.textContent = label), searchElements.searchFloatingPreview.classList.add("visible"), positionSearchFloatingPreview(target);
}
function bindSearchFloatingPreviewEvents(container) {
  container && container.querySelectorAll("[data-search-preview-src]").forEach((candidate) => {
    if (!(candidate instanceof HTMLElement)) return;
    let target = candidate;
    target.addEventListener("pointerenter", (event) => {
      rememberSearchPreviewPointer(event), !(!hasHoverPointer() || isTouchLikePointer(event) || isSearchPreviewSuppressed()) && showSearchFloatingPreview(target);
    }), target.addEventListener("pointermove", (event) => {
      if (rememberSearchPreviewPointer(event), !(!hasHoverPointer() || isTouchLikePointer(event))) {
        if (isSearchPreviewSuppressed()) {
          hideSearchFloatingPreview();
          return;
        }
        positionSearchFloatingPreview(target);
      }
    }), target.addEventListener("pointerleave", (event) => {
      rememberSearchPreviewPointer(event), hideSearchFloatingPreview();
    }), target.addEventListener("focus", () => showSearchFloatingPreview(target)), target.addEventListener("blur", hideSearchFloatingPreview);
  });
}
function handleSearchPreviewScrollIntent(event) {
  rememberSearchPreviewPointer(event), suppressSearchFloatingPreview();
}
function normalizedWheelDeltaY(event, scrollTarget) {
  let rawDelta = Number(event?.deltaY) || 0;
  return rawDelta ? event.deltaMode === 1 ? rawDelta * 16 : event.deltaMode === 2 ? rawDelta * Math.max(1, scrollTarget?.clientHeight || window.innerHeight || 1) : rawDelta : 0;
}
function globalSearchWheelTarget(eventTarget) {
  return eventTarget instanceof Node && isGlobalSearchScopeMenuOpen() && searchElements.globalSearchScopeMenu?.contains(eventTarget) ? searchElements.globalSearchScopeMenu : searchElements.globalSearchResults && !searchElements.globalSearchResults.classList.contains("hidden") ? searchElements.globalSearchResults : null;
}
function scrollElementByWheel(element, event) {
  if (!element) return !1;
  let deltaY = normalizedWheelDeltaY(event, element);
  if (!deltaY) return !1;
  let maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight), nextScrollTop = clampValue(element.scrollTop + deltaY, 0, maxScrollTop);
  return Math.abs(nextScrollTop - element.scrollTop) > 0.5 && (element.scrollTop = nextScrollTop), !0;
}
function handleGlobalSearchPanelWheel(event) {
  if (!isGlobalSearchPanelOpen() || !(event.target instanceof Node) || !searchElements.catalogSearch?.contains(event.target)) return;
  handleSearchPreviewScrollIntent(event);
  let scrollTarget = globalSearchWheelTarget(event.target);
  scrollTarget && scrollElementByWheel(scrollTarget, event), event.preventDefault(), event.stopPropagation();
}
function normalizeSearchResultsDirection(container) {
  container && container.setAttribute("dir", "rtl");
}
function lightboxSearchLayoutColumnLimit() {
  let columns = getFeatureInterface("catalog-grid")?.layoutColumnCount?.(), width = Math.max(0, window.innerWidth || document.documentElement?.clientWidth || 0);
  return searchCatalogDomain.lightboxSearchColumnLimit(columns, width);
}
function updateLightboxSearchResultsLayout(count = 0) {
  if (!searchElements.lightboxSearchResults) return;
  normalizeSearchResultsDirection(searchElements.lightboxSearchResults);
  let resultCount = Math.max(0, Number(count) || 0), columns = Math.max(1, Math.min(resultCount || 1, lightboxSearchLayoutColumnLimit()));
  searchElements.lightboxSearchResults.style.setProperty("--reader-search-result-columns", String(columns)), searchElements.lightboxSearchResults.dataset.resultColumns = String(columns), searchElements.lightboxSearchResults.dataset.resultCount = String(resultCount);
}
function searchEmptyStateMarkup(query, message, options = {}) {
  let reader = options.reader === !0, wrapperClass = reader ? "reader-search-empty lightbox-search-empty empty-state ui-state empty-state-dark" : "search-empty empty-state ui-state", actionAttribute = reader ? "data-lightbox-empty-search-clear" : "data-empty-search-clear";
  return `
    <article class="${wrapperClass}" data-state="empty" role="status">
      <span class="empty-state-icon ui-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="10.5" cy="10.5" r="5.8"></circle>
          <path d="m15 15 4.2 4.2M8.2 8.2l4.6 4.6M12.8 8.2l-4.6 4.6"></path>
        </svg>
      </span>
      <div class="empty-state-copy">
        <strong>לא נמצאו תוצאות עבור “${escapeHtml(query)}”</strong>
        <p>${escapeHtml(message)}</p>
      </div>
      <button class="button soft empty-state-action" type="button" ${actionAttribute}>נקה וחפש מחדש</button>
    </article>
  `;
}
function searchIndexErrorMarkup(options = {}) {
  let reader = options.reader === !0;
  return `
    <article class="${reader ? "reader-search-empty lightbox-search-empty empty-state ui-state empty-state-dark" : "search-empty empty-state ui-state"}" data-state="error" role="alert">
      <span class="empty-state-icon ui-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 9v4.5M12 16.8h.01"/></svg>
      </span>
      <div class="empty-state-copy">
        <strong>החיפוש אינו זמין כרגע</strong>
        <p>אינדקס החיפוש לא הצליח להיטען. אפשר לנסות שוב בלי לרענן את העמוד.</p>
      </div>
      <button class="button soft empty-state-action" type="button" ${reader ? "data-lightbox-search-index-retry" : "data-global-search-index-retry"}>נסה לטעון שוב</button>
    </article>
  `;
}
function retrySearchIndexLoad(options = {}) {
  searchState.searchIndexLoadPromise = null, searchState.searchIndexLoadState = "idle", ensureSearchIndexLoaded({ trigger: "retry" }).then(() => {
    options.reader ? renderLightboxSearchResults(searchElements.lightboxSearchInput?.value || "") : renderSearchResults(searchElements.globalSearchInput?.value || "");
  }).catch(() => {
    options.reader ? renderLightboxSearchResults(searchElements.lightboxSearchInput?.value || "") : renderSearchResults(searchElements.globalSearchInput?.value || "");
  });
}
async function renderLightboxSearchResults(query) {
  let rawQuery = String(query || "").trim();
  if (!searchElements.lightboxSearchResults || !searchElements.lightboxSearchStatus) return [];
  let renderSequence = ++lightboxSearchRenderSequence, renderKey = lightboxSearchKey(rawQuery);
  if (normalizeSearchResultsDirection(searchElements.lightboxSearchResults), hideSearchFloatingPreview(), updateLightboxSearchResultsLayout(0), searchElements.lightboxSearchClear?.classList.toggle("hidden", rawQuery.length === 0), rawQuery.length < 2)
    return catalogSearch.cancel("viewer"), lastLightboxSearchKey = "", lastLightboxSearchResults = [], searchElements.lightboxSearchResults.classList.add("hidden"), searchElements.lightboxSearchResults.removeAttribute("aria-busy"), searchElements.lightboxSearchResults.innerHTML = "", initLightboxSearchStatus(), [];
  if (!activeCatalog())
    return searchElements.lightboxSearchResults.classList.add("hidden"), searchElements.lightboxSearchStatus.textContent = "בחר קטלוג כדי לחפש.", [];
  searchElements.lightboxSearchResults.setAttribute("aria-busy", "true"), searchElements.lightboxSearchStatus.textContent = "מחפש באינדקס…";
  try {
    let scope = getLightboxSearchScope(), results = await getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24, {
      isCurrent: () => renderSequence === lightboxSearchRenderSequence && renderKey === lightboxSearchKey(searchElements.lightboxSearchInput?.value || "")
    });
    return renderSequence !== lightboxSearchRenderSequence || renderKey !== lightboxSearchKey(searchElements.lightboxSearchInput?.value || "") ? [] : (lastLightboxSearchKey = lightboxSearchKey(rawQuery), lastLightboxSearchResults = results, updateLightboxSearchResultsLayout(results.length), searchElements.lightboxSearchResults.classList.remove("hidden"), searchElements.lightboxSearchResults.removeAttribute("aria-busy"), results.length ? (searchElements.lightboxSearchStatus.textContent = scope === "all" ? `נמצאו ${results.length} תוצאות בכל הקטלוגים.` : `נמצאו ${results.length} תוצאות בקטלוג הזה.`, searchElements.lightboxSearchResults.innerHTML = results.map((result) => {
      let catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId) || activeCatalog();
      if (!catalog) return "";
      let page = clampPage(result.page, catalog), rawPreview = result.image || mediumSrc(catalog, page) || pageSrc(catalog, page), rawImage = result.thumb || thumbSrc(catalog, page) || rawPreview, catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
      return `
        <button class="reader-search-result lightbox-search-result" type="button" data-lightbox-search-catalog="${escapeHtml(result.catalogId || catalog?.id || "")}" data-lightbox-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
          <span class="reader-search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
          <span class="reader-search-thumb-frame catalog-image-frame">
            <img class="reader-search-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "viewer-search-results")}${catalogImageCrossOriginAttribute(rawImage)} />
          </span>
          <span class="reader-search-result-copy">${searchCatalogDomain.searchResultDetailsMarkup(result)}</span>
        </button>
      `;
    }).join(""), bindSearchFloatingPreviewEvents(searchElements.lightboxSearchResults), Array.from(searchElements.lightboxSearchResults.querySelectorAll("[data-lightbox-search-page]")).filter(isHtmlElement).forEach((button) => {
      button.addEventListener("click", async () => {
        await trackCompletedLightboxSearch("result-open"), hideSearchFloatingPreview(), openLightboxSearchResult({
          catalogId: button.dataset.lightboxSearchCatalog,
          page: button.dataset.lightboxSearchPage
        });
      });
    }), results) : (searchElements.lightboxSearchStatus.textContent = scope === "all" ? "לא נמצאו תוצאות בכל הקטלוגים." : "לא נמצאו תוצאות בקטלוג הפתוח.", searchElements.lightboxSearchResults.innerHTML = searchEmptyStateMarkup(
      rawQuery,
      "נסה חלק קצר יותר של הדגם או מילה אחרת.",
      { reader: !0 }
    ), searchElements.lightboxSearchResults.querySelector("[data-lightbox-empty-search-clear]")?.addEventListener("click", (event) => {
      event.stopPropagation(), searchElements.lightboxSearchInput.value = "", renderLightboxSearchResults(""), searchElements.lightboxSearchInput.focus();
    }), []));
  } catch (error) {
    return catalogSearch.isCancelledError(error) || renderSequence !== lightboxSearchRenderSequence ? [] : (searchState.searchIndexLoadState = "error", searchElements.lightboxSearchResults.removeAttribute("aria-busy"), searchElements.lightboxSearchResults.classList.remove("hidden"), searchElements.lightboxSearchResults.innerHTML = searchIndexErrorMarkup({ reader: !0 }), searchElements.lightboxSearchResults.querySelector("[data-lightbox-search-index-retry]")?.addEventListener("click", () => retrySearchIndexLoad({ reader: !0 })), searchElements.lightboxSearchStatus.textContent = "אינדקס החיפוש אינו זמין כרגע.", []);
  }
}
function renderLightboxCatalogMenu() {
  getFeatureInterface("catalog-grid")?.renderCatalogMenu(searchElements.lightboxCatalogMenu, {
    onSelect: (catalogId) => {
      closeLightboxCatalogMenu(), catalogId !== activeCatalog()?.id && getFeatureInterface("viewer")?.openCatalog(catalogId);
    }
  });
}
function globalSearchKey(query) {
  return [String(query || "").trim(), getGlobalSearchCategory()].join("\0");
}
async function getGlobalOcrSearchResults(query, limit = 72, control = {}) {
  let rawQuery = String(query || "").trim(), category = getGlobalSearchCategory();
  if (rawQuery.length < 2) return [];
  if (await ensureSearchIndexLoaded({ trigger: "global-search" }), control.isCurrent && !control.isCurrent()) return [];
  if (!catalogSearch.hasIndex({ category })) return [];
  let options = { limit, channel: "global" };
  category && (options.category = category);
  let results = await catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}
async function getGlobalSearchResults(query, limit = 72, control = {}) {
  let rawQuery = String(query || "").trim(), navigationResults = rawQuery.length < 2 ? [] : catalogSearch.searchNavigation(
    getCatalogCategoryGroups(),
    rawQuery,
    { category: getGlobalSearchCategory(), limit: 36 }
  );
  try {
    return catalogSearch.mergeNavigationResults(
      navigationResults,
      await getGlobalOcrSearchResults(rawQuery, limit, control)
    );
  } catch (error) {
    if (!navigationResults.length || catalogSearch.isCancelledError(error)) throw error;
    return searchState.searchIndexLoadState = "error", navigationResults;
  }
}
async function trackCompletedGlobalSearch(completion, query = searchElements.globalSearchInput?.value || "", options = {}) {
  let rawQuery = String(query || "").trim(), category = getGlobalSearchCategory(), results = globalSearchKey(rawQuery) === lastGlobalSearchKey ? lastGlobalSearchResults : await getGlobalSearchResults(rawQuery, 72);
  return telemetryTrackSearch(rawQuery, results.length, {
    surface: "global",
    scope: category || "all",
    completion,
    immediate: options.immediate === !0
  }), results;
}
function flushGlobalSearchTelemetryBeforeNavigation() {
  telemetryFlush().catch(() => {
  });
}
function openGlobalSearchResult(result) {
  if (!result) return !1;
  hideSearchFloatingPreview(), closeGlobalSearchPanel({ focusButton: !1 });
  let catalogGrid = requireFeatureInterface("catalog-grid");
  return searchCatalogDomain.executeGlobalSearchResultAction(result, {
    activateCategoryTarget: catalogGrid.activateCategoryTarget,
    openCatalog: (catalogId) => navigateTo(catalogDocumentUrl(catalogId)),
    openViewer: (catalogId, page) => navigateTo(viewerDocumentUrl(catalogId, page))
  });
}
async function submitGlobalSearch() {
  let rawQuery = String(searchElements.globalSearchInput?.value || "").trim(), results = await renderSearchResults(rawQuery);
  return await trackCompletedGlobalSearch("submit", rawQuery, { immediate: !0 }), flushGlobalSearchTelemetryBeforeNavigation(), openGlobalSearchResult(results[0]);
}
function globalSearchResultMarkup(result) {
  if (result?.resultType !== "ocr")
    return catalogSearch ? catalogSearch.navigationResultMarkup(result) : "";
  let catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId), page = clampPage(result.page, catalog), rawThumb = result.thumb || (catalog ? thumbSrc(catalog, page) : ""), rawPreview = result.image || (catalog ? mediumSrc(catalog, page) || pageSrc(catalog, page) : rawThumb), rawImage = rawThumb || rawPreview, catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
  return `
    <article class="search-result-card">
      <button type="button" class="search-result-button" data-search-catalog="${escapeHtml(result.catalogId)}" data-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
        <span class="search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
        <span class="search-result-thumb-frame catalog-image-frame">
          <img class="search-result-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "global-search-results")}${catalogImageCrossOriginAttribute(rawImage)} />
        </span>
        <span class="search-result-copy">${searchCatalogDomain.searchResultDetailsMarkup(result)}</span>
      </button>
    </article>
  `;
}
function bindGlobalSearchResultEvents(root) {
  bindSearchFloatingPreviewEvents(root), Array.from(root.querySelectorAll("[data-search-navigation-type], [data-search-catalog]")).filter(isHtmlElement).forEach((button) => {
    button.addEventListener("click", async () => {
      await trackCompletedGlobalSearch("result-open", void 0, { immediate: !0 }), flushGlobalSearchTelemetryBeforeNavigation(), openGlobalSearchResult(button.dataset.searchNavigationType ? {
        resultType: button.dataset.searchNavigationType,
        targetId: button.dataset.searchNavigationTarget,
        catalogId: button.dataset.searchNavigationCatalog
      } : {
        resultType: "ocr",
        catalogId: button.dataset.searchCatalog,
        page: button.dataset.searchPage
      });
    });
  });
}
function appendGlobalSearchResultBatch(results, start, count) {
  let template = document.createElement("template");
  return template.innerHTML = results.slice(start, start + count).map(globalSearchResultMarkup).join(""), bindGlobalSearchResultEvents(template.content), searchElements.globalSearchResults.append(template.content), Math.min(results.length, start + count);
}
function isCurrentGlobalSearchRender(renderSequence, rawQuery) {
  return renderSequence === globalSearchRenderSequence && globalSearchKey(rawQuery) === globalSearchKey(searchElements.globalSearchInput?.value || "") && isGlobalSearchPanelOpen();
}
function renderGlobalSearchResultsProgressively(results, renderSequence, rawQuery) {
  cancelGlobalSearchResultAppend(), searchElements.globalSearchResults.replaceChildren(), searchElements.globalSearchResults.classList.remove("hidden");
  let nextIndex = appendGlobalSearchResultBatch(
    results,
    0,
    GLOBAL_SEARCH_INITIAL_RENDER_COUNT
  ), appendNextBatch = () => {
    if (globalSearchAppendTimer = 0, !!isCurrentGlobalSearchRender(renderSequence, rawQuery)) {
      if (nextIndex = appendGlobalSearchResultBatch(
        results,
        nextIndex,
        GLOBAL_SEARCH_RENDER_CHUNK_SIZE
      ), nextIndex < results.length) {
        globalSearchAppendTimer = window.setTimeout(appendNextBatch, 0);
        return;
      }
      searchElements.globalSearchResults.removeAttribute("aria-busy");
    }
  };
  nextIndex < results.length ? globalSearchAppendTimer = window.setTimeout(appendNextBatch, 0) : searchElements.globalSearchResults.removeAttribute("aria-busy");
}
async function renderSearchResults(query) {
  let rawQuery = String(query || "").trim();
  if (!searchElements.globalSearchResults) return [];
  cancelGlobalSearchResultAppend();
  let renderSequence = ++globalSearchRenderSequence, renderKey = globalSearchKey(rawQuery);
  if (normalizeSearchResultsDirection(searchElements.globalSearchResults), hideSearchFloatingPreview(), searchElements.globalSearchClear?.classList.toggle("hidden", rawQuery.length === 0), rawQuery.length < 2)
    return catalogSearch.cancel("global"), lastGlobalSearchKey = "", lastGlobalSearchResults = [], searchElements.globalSearchResults.classList.add("hidden"), searchElements.globalSearchResults.removeAttribute("aria-busy"), searchElements.globalSearchResults.innerHTML = "", initSearchStatus(), [];
  let category = getGlobalSearchCategory();
  searchElements.globalSearchResults.setAttribute("aria-busy", "true");
  try {
    let results = await getGlobalSearchResults(rawQuery, 72, {
      isCurrent: () => isCurrentGlobalSearchRender(renderSequence, rawQuery)
    });
    return renderSequence !== globalSearchRenderSequence || renderKey !== globalSearchKey(searchElements.globalSearchInput?.value || "") ? [] : (lastGlobalSearchKey = globalSearchKey(rawQuery), lastGlobalSearchResults = results, results.length ? (renderGlobalSearchResultsProgressively(results, renderSequence, rawQuery), results) : (searchElements.globalSearchResults.removeAttribute("aria-busy"), searchElements.globalSearchResults.classList.remove("hidden"), searchElements.globalSearchResults.innerHTML = searchEmptyStateMarkup(
      rawQuery,
      category ? "נסה שם קצר יותר, חלק מהמילה, או חפש שוב בכל הקטלוגים." : "נסה שם קצר יותר, מספר דגם או חלק מהמילה."
    ), searchElements.globalSearchResults.querySelector("[data-empty-search-clear]")?.addEventListener("click", () => {
      searchElements.globalSearchInput.value = "", renderSearchResults(""), searchElements.globalSearchInput.focus();
    }), []));
  } catch (error) {
    return catalogSearch.isCancelledError(error) || renderSequence !== globalSearchRenderSequence ? [] : (searchState.searchIndexLoadState = "error", searchElements.globalSearchResults.removeAttribute("aria-busy"), searchElements.globalSearchResults.classList.remove("hidden"), searchElements.globalSearchResults.innerHTML = searchIndexErrorMarkup(), searchElements.globalSearchResults.querySelector("[data-global-search-index-retry]")?.addEventListener("click", () => retrySearchIndexLoad()), []);
  }
}
function handleLightboxSearchResultsBackgroundClick(event) {
  let result = eventTargetElement(event.target)?.closest?.("[data-lightbox-search-page]");
  result && searchElements.lightboxSearchResults?.contains(result) || (event.preventDefault(), event.stopPropagation(), hideLightboxSearchResults({ blurTopUiFocus: !0, hideTopUi: !0 }));
}
function attachSearchUiEvents() {
  searchElements.globalSearchOpen?.addEventListener("click", (event) => {
    event.preventDefault(), ensureSearchIndexLoaded().catch(() => {
    }), event.stopPropagation(), getFeatureInterface("catalog-detail")?.close(), closeLightboxCatalogMenu(), closeLightboxSearchScopeMenu(), setGlobalSearchPanelOpen(!isGlobalSearchPanelOpen(), { focus: !0, focusButton: !0 });
  }), searchElements.globalSearchClose?.addEventListener("click", (event) => {
    event.preventDefault(), event.stopPropagation(), closeGlobalSearchPanel({ focusButton: !0 });
  }), searchElements.globalSearchInput?.addEventListener("input", () => {
    scheduleSearchRender("global", searchElements.globalSearchInput.value);
  }), searchElements.globalSearchInput?.addEventListener("focus", () => {
    ensureSearchIndexLoaded().catch(() => {
    }), scheduleSearchRender("global", searchElements.globalSearchInput.value, { immediate: !0 });
  }), searchElements.globalSearchInput?.addEventListener("click", () => scheduleSearchRender("global", searchElements.globalSearchInput.value, { immediate: !0 })), searchElements.globalSearchInput?.addEventListener("keydown", (event) => {
    event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || (event.preventDefault(), submitGlobalSearch().catch(() => {
    }));
  }), searchElements.globalSearchClear?.addEventListener("click", () => {
    cancelScheduledSearch("global"), searchElements.globalSearchInput.value = "", searchElements.globalSearchInput.focus(), renderSearchResults("");
  }), searchElements.globalSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation(), hideSearchFloatingPreview(), getFeatureInterface("catalog-detail")?.close(), closeLightboxCatalogMenu(), closeLightboxSearchScopeMenu(), renderGlobalSearchScopeMenu();
    let isOpen = !searchElements.globalSearchScopeMenu?.classList.contains("hidden");
    searchElements.globalSearchScopeMenu?.classList.toggle("hidden", isOpen), searchElements.globalSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  }), searchElements.globalSearchScopeMenu?.addEventListener("click", (event) => {
    event.stopPropagation();
    let button = eventTargetElement(event.target)?.closest("[data-global-search-category]");
    !isHtmlElement(button) || !searchElements.globalSearchScopeMenu.contains(button) || (setGlobalSearchCategory(button.dataset.globalSearchCategory), searchElements.globalSearchInput?.focus());
  }), searchElements.catalogSearch?.addEventListener("wheel", handleGlobalSearchPanelWheel, { passive: !1 }), searchElements.globalSearchResults?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: !0 }), searchElements.globalSearchScopeMenu?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: !0 }), searchElements.lightboxSearchResults?.addEventListener("wheel", handleSearchPreviewScrollIntent, { passive: !0 }), searchElements.lightboxSearchResults?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: !0 }), searchElements.lightboxSearchScopeMenu?.addEventListener("wheel", handleSearchPreviewScrollIntent, { passive: !0 }), searchElements.lightboxSearchScopeMenu?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: !0 }), searchElements.lightboxSearchInput?.addEventListener("input", () => {
    scheduleSearchRender("viewer", searchElements.lightboxSearchInput.value);
  }), searchElements.lightboxSearchInput?.addEventListener("focus", () => {
    getFeatureInterface("viewer")?.showTopUi?.(), ensureSearchIndexLoaded().catch(() => {
    }), scheduleSearchRender("viewer", searchElements.lightboxSearchInput.value, { immediate: !0 });
  }), searchElements.lightboxSearchInput?.addEventListener("click", () => {
    getFeatureInterface("viewer")?.showTopUi?.(), scheduleSearchRender("viewer", searchElements.lightboxSearchInput.value, { immediate: !0 });
  }), searchElements.lightboxSearchInput?.addEventListener("keydown", (event) => {
    event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || (event.preventDefault(), submitLightboxSearch().catch(() => {
    }));
  }), searchElements.lightboxSearchClear?.addEventListener("click", () => {
    cancelScheduledSearch("viewer"), searchElements.lightboxSearchInput.value = "", searchElements.lightboxSearchInput.focus(), renderLightboxSearchResults(""), getFeatureInterface("viewer")?.showTopUi?.();
  }), searchElements.lightboxMobileSearchToggle?.addEventListener("click", (event) => {
    event.preventDefault(), event.stopPropagation(), setLightboxMobileSearchOpen(!searchState.lightboxMobileSearchOpen, {
      focusInput: !0,
      returnFocus: searchState.lightboxMobileSearchOpen
    });
  }), searchElements.lightboxMobileSearchClose?.addEventListener("click", (event) => {
    event.preventDefault(), event.stopPropagation(), setLightboxMobileSearchOpen(!1, { returnFocus: !0, hideResults: !0 });
  }), searchElements.lightboxSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation(), hideSearchFloatingPreview(), getFeatureInterface("catalog-detail")?.close(), closeLightboxCatalogMenu();
    let isOpen = !searchElements.lightboxSearchScopeMenu?.classList.contains("hidden");
    searchElements.lightboxSearchScopeMenu?.classList.toggle("hidden", isOpen), searchElements.lightboxSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true"), getFeatureInterface("viewer")?.showTopUi?.();
  }), Array.from(searchElements.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]") || []).filter(isHtmlElement).forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation(), setLightboxSearchScope(button.dataset.lightboxSearchScope), getFeatureInterface("viewer")?.showTopUi?.(), searchElements.lightboxSearchInput?.focus();
    });
  }), searchElements.lightboxCatalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation(), getFeatureInterface("catalog-detail")?.close(), closeLightboxSearchScopeMenu(), renderLightboxCatalogMenu();
    let isOpen = !searchElements.lightboxCatalogMenu?.classList.contains("hidden");
    searchElements.lightboxCatalogMenu?.classList.toggle("hidden", isOpen), searchElements.lightboxCatalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true"), getFeatureInterface("viewer")?.showTopUi?.();
  }), searchElements.lightboxCatalogMenu?.addEventListener("click", (event) => event.stopPropagation()), searchElements.lightboxSearchResults?.addEventListener("click", handleLightboxSearchResultsBackgroundClick);
}
function prepareSearchRoute(nextPage) {
  closeGlobalSearchPanel({ focusButton: !1 }), closeGlobalSearchScopeMenu(), closeLightboxSearchScopeMenu(), closeLightboxCatalogMenu(), nextPage !== "viewer" && setLightboxMobileSearchOpen(!1, { hideResults: !0 });
}
function handleSearchDocumentPointer(target) {
  if (!(target instanceof Node))
    return prepareSearchRoute(currentAppPage), !1;
  let insideGlobalSearch = searchElements.catalogSearch.contains(target) || searchElements.globalSearchOpen.contains(target), insideMobileReaderSearch = searchElements.lightboxSearchPanel.contains(target) || searchElements.lightboxMobileSearchToggle.contains(target);
  return insideGlobalSearch ? (!searchElements.globalSearchScopeMenu.contains(target) && !searchElements.globalSearchScopeToggle.contains(target) && closeGlobalSearchScopeMenu(), closeLightboxSearchScopeMenu(), closeLightboxCatalogMenu(), getFeatureInterface("catalog-detail")?.close(), !0) : insideMobileReaderSearch || (searchState.lightboxMobileSearchOpen && setLightboxMobileSearchOpen(!1, { hideResults: !0 }), searchElements.lightboxSearchScopeMenu.contains(target) || searchElements.lightboxSearchScopeToggle.contains(target)) || searchElements.lightboxCatalogMenu.contains(target) || searchElements.lightboxCatalogMenuToggle.contains(target) ? !0 : (closeGlobalSearchPanel({ focusButton: !1 }), closeGlobalSearchScopeMenu(), closeLightboxSearchScopeMenu(), closeLightboxCatalogMenu(), !1);
}
function initializeSearchUi() {
  syncLightboxMobileSearchUi(), renderGlobalSearchScopeMenu(), scheduleSearchIndexPreload(), initSearchStatus();
}
function handleSearchResize() {
  hideSearchFloatingPreview(), updateLightboxSearchResultsLayout(Number(searchElements.lightboxSearchResults.dataset.resultCount || 0)), syncLightboxMobileSearchUi();
}
function handleSearchScroll() {
  hideSearchFloatingPreview();
}
registerFeatureInterface("search", {
  escapePriority: 300,
  closeTopLayer: () => isGlobalSearchPanelOpen() ? (searchElements.globalSearchScopeMenu && !searchElements.globalSearchScopeMenu.classList.contains("hidden") ? closeGlobalSearchScopeMenu() : closeGlobalSearchPanel({ focusButton: !0 }), !0) : !1,
  closeViewerTopLayer: () => searchState.lightboxMobileSearchOpen ? (setLightboxMobileSearchOpen(!1, { returnFocus: !0, hideResults: !0 }), !0) : searchElements.lightboxCatalogMenu && !searchElements.lightboxCatalogMenu.classList.contains("hidden") || searchElements.lightboxSearchScopeMenu && !searchElements.lightboxSearchScopeMenu.classList.contains("hidden") ? (closeLightboxCatalogMenu(), closeLightboxSearchScopeMenu(), !0) : !1,
  isLightboxMobileOpen: () => searchState.lightboxMobileSearchOpen,
  setLightboxMobileOpen: (open, options = {}) => setLightboxMobileSearchOpen(open, options),
  containsLightboxResult: (target) => !!(target?.closest?.("[data-lightbox-search-page]") && searchElements.lightboxSearchResults.contains(target.closest("[data-lightbox-search-page]"))),
  hideViewerResults: (options = {}) => hideLightboxSearchResults(options),
  closeGlobalPanel: (options = {}) => closeGlobalSearchPanel(options),
  attachEvents: attachSearchUiEvents,
  initialize: initializeSearchUi,
  prepareRoute: prepareSearchRoute,
  handleDocumentPointer: handleSearchDocumentPointer,
  handleResize: handleSearchResize,
  handleScroll: handleSearchScroll
});

// src/js/40-catalog-grid.js
function initRevealObserver() {
  let nodes = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("in-view"));
    return;
  }
  let observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      (entry.isIntersecting || entry.intersectionRatio > 0) && (entry.target.classList.add("in-view"), observer.unobserve(entry.target));
    });
  }, { threshold: 0, rootMargin: "0px 0px -1px 0px" });
  nodes.forEach((node) => observer.observe(node));
}
function renderEmptyState() {
  let html = `
    <article class="empty-state ui-state" data-state="empty" role="status">
      <span class="empty-state-icon ui-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path d="M5 4.5h11.2A2.8 2.8 0 0 1 19 7.3v12.2H7.8A2.8 2.8 0 0 1 5 16.7V4.5Z"/><path d="M7.8 19.5A2.8 2.8 0 0 1 5 16.7c0-1.55 1.25-2.8 2.8-2.8H19"/></svg>
      </span>
      <div class="empty-state-copy">
        <strong>עדיין אין קטלוגים להצגה</strong>
        <p>ברגע שיועלו קטלוגים, הם יופיעו כאן לבחירה ולצפייה.</p>
      </div>
    </article>
  `;
  catalogElements.catalogGrid && (catalogElements.catalogGrid.innerHTML = html, catalogElements.catalogGrid.setAttribute("aria-busy", "false"), catalogElements.catalogLoadStatus && (catalogElements.catalogLoadStatus.textContent = "אין קטלוגים זמינים כעת.")), catalogElements.pageGrid && (catalogElements.pageGrid.innerHTML = html, catalogElements.pageGrid.setAttribute("aria-busy", "false")), catalogElements.catalogCount && (catalogElements.catalogCount.textContent = "0"), catalogElements.pageCount && (catalogElements.pageCount.textContent = "0"), renderCategoryNav([]), showCatalogDetail(), catalogElements.catalogTitle.textContent = "עדיין אין קטלוגים להצגה", catalogElements.catalogDescription.textContent = "הקטלוגים יופיעו כאן כשהם יהיו זמינים לצפייה.", catalogElements.catalogMenuToggleText && (catalogElements.catalogMenuToggleText.textContent = "אין קטלוגים"), catalogElements.catalogMenu && (catalogElements.catalogMenu.innerHTML = '<div class="reader-catalog-menu-empty">אין קטלוגים להצגה</div>'), catalogElements.catalogCoverPreview?.removeAttribute("src"), catalogElements.openCatalogEntryFromDetail && (catalogElements.openCatalogEntryFromDetail.disabled = !0);
}
var CATEGORY_NAV_MIN_BUTTON_SCALE = 0.68, CATEGORY_NAV_MIN_FONT_SIZE = 11, CATEGORY_NAV_MIN_BUTTON_HEIGHT = 30, CATEGORY_NAV_MIN_BUTTON_PADDING_X = 5, CATEGORY_NAV_MIN_GAP = 3;
function readPixelValue(value, fallback = 0) {
  let numeric = Number.parseFloat(String(value || ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}
function categoryNavLinkLabel(link) {
  return String(link?.dataset?.categoryLabel || link?.textContent || "").trim();
}
function setCategoryNavLinkTooltip(link, text) {
  link && (setTooltipText(link, text || "", { updateDefault: !0 }), link.removeAttribute("title"));
}
function syncCategoryNavOverflowTooltips(links, enabled = !0) {
  links.forEach((link) => {
    if (!enabled) {
      setCategoryNavLinkTooltip(link, "");
      return;
    }
    let isTextClipped = link.scrollWidth > link.clientWidth + 1;
    setCategoryNavLinkTooltip(link, isTextClipped ? categoryNavLinkLabel(link) : "");
  });
}
function clearCategoryNavFit(header, links = []) {
  header && (header.classList.remove("is-top-nav-compressed", "is-top-nav-tight", "is-top-nav-ellipsized"), header.style.removeProperty("--top-nav-gap"), header.style.removeProperty("--top-nav-button-min-height"), header.style.removeProperty("--top-nav-button-padding-x"), header.style.removeProperty("--top-nav-button-font-size"), syncCategoryNavOverflowTooltips(links, !1));
}
function readCategoryNavBaseMetrics(nav, firstLink) {
  let navStyle = window.getComputedStyle(nav), linkStyle = window.getComputedStyle(firstLink), paddingStart = readPixelValue(linkStyle.paddingInlineStart, 16), paddingEnd = readPixelValue(linkStyle.paddingInlineEnd, paddingStart);
  return {
    gap: readPixelValue(navStyle.columnGap, 8),
    minHeight: readPixelValue(linkStyle.minHeight, 42),
    paddingX: Math.max(paddingStart, paddingEnd),
    fontSize: readPixelValue(linkStyle.fontSize, 16)
  };
}
function categoryNavRequiredWidth(nav, links) {
  if (!links.length) return 0;
  let gap = readPixelValue(window.getComputedStyle(nav).columnGap, 0);
  return links.reduce((sum, link) => sum + Math.ceil(link.scrollWidth), 0) + gap * Math.max(0, links.length - 1);
}
function applyCategoryNavScale(header, metrics, scale) {
  let safeScale = Math.max(CATEGORY_NAV_MIN_BUTTON_SCALE, Math.min(1, scale));
  return header.classList.add("is-top-nav-compressed"), header.style.setProperty("--top-nav-gap", `${Math.max(CATEGORY_NAV_MIN_GAP, metrics.gap * safeScale).toFixed(2)}px`), header.style.setProperty("--top-nav-button-min-height", `${Math.max(CATEGORY_NAV_MIN_BUTTON_HEIGHT, metrics.minHeight * safeScale).toFixed(2)}px`), header.style.setProperty("--top-nav-button-padding-x", `${Math.max(CATEGORY_NAV_MIN_BUTTON_PADDING_X, metrics.paddingX * safeScale).toFixed(2)}px`), header.style.setProperty("--top-nav-button-font-size", `${Math.max(CATEGORY_NAV_MIN_FONT_SIZE, metrics.fontSize * safeScale).toFixed(2)}px`), safeScale;
}
function fitCategoryNavToSingleRow() {
  catalogState.categoryNavFitRaf = 0;
  let nav = catalogElements.categoryNav, header = nav?.closest?.(".site-header");
  if (!nav || !(header instanceof HTMLElement)) return;
  let links = Array.from(nav.querySelectorAll(".category-nav-link")).filter(isHtmlElement);
  if (clearCategoryNavFit(header, links), !links.length) return;
  let firstLink = links[0], metrics = readCategoryNavBaseMetrics(nav, firstLink), requiredWidth = categoryNavRequiredWidth(nav, links), availableWidth = nav.clientWidth;
  if (!availableWidth || requiredWidth <= availableWidth + 1) return;
  let normalScale = applyCategoryNavScale(header, metrics, availableWidth / requiredWidth);
  if (!(requiredWidth * normalScale > nav.clientWidth + 1 || nav.scrollWidth > nav.clientWidth + 1)) {
    syncCategoryNavOverflowTooltips(links);
    return;
  }
  header.classList.add("is-top-nav-tight");
  let tightAvailableWidth = nav.clientWidth;
  applyCategoryNavScale(header, metrics, tightAvailableWidth / requiredWidth), (requiredWidth * CATEGORY_NAV_MIN_BUTTON_SCALE > tightAvailableWidth + 1 || nav.scrollWidth > nav.clientWidth + 1) && header.classList.add("is-top-nav-ellipsized"), syncCategoryNavOverflowTooltips(links);
}
function scheduleCategoryNavFit() {
  catalogElements.categoryNav && (window.cancelAnimationFrame(catalogState.categoryNavFitRaf), catalogState.categoryNavFitRaf = window.requestAnimationFrame(fitCategoryNavToSingleRow));
}
function initCategoryNavFit() {
  catalogElements.categoryNav && (document.querySelectorAll('img[data-brand-logo="1"]').forEach((image) => {
    image.addEventListener("load", scheduleCategoryNavFit);
  }), document.fonts?.ready && document.fonts.ready.then(scheduleCategoryNavFit).catch(() => {
  }), scheduleCategoryNavFit());
}
function renderCategoryNav(groups = getCatalogCategoryGroups()) {
  let links = groups.map((group, index) => {
    let targetId = categorySectionId(group.category, index), sharePath = catalogCategorySharePath(group.category, index);
    return {
      href: categoryDocumentUrl(sharePath),
      targetId,
      sharePath,
      label: group.category
    };
  });
  catalogElements.categoryNav && (catalogElements.categoryNav.innerHTML = links.map((link) => `
      <a class="top-nav-link category-nav-link" href="${escapeHtml(link.href)}" data-category-target="${escapeHtml(link.targetId)}" data-category-share-path="${escapeHtml(link.sharePath)}" data-category-label="${escapeHtml(link.label)}">${escapeHtml(link.label)}</a>
    `).join("")), catalogElements.mobileCategoryMenu && (catalogElements.mobileCategoryMenu.innerHTML = links.length ? links.map((link) => `
          <a class="mobile-category-menu-link category-nav-link" role="menuitem" href="${escapeHtml(link.href)}" data-category-target="${escapeHtml(link.targetId)}" data-category-share-path="${escapeHtml(link.sharePath)}" data-category-label="${escapeHtml(link.label)}">
            <span>${escapeHtml(link.label)}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6" /></svg>
          </a>
        `).join("") : '<div class="mobile-category-menu-empty">אין קטגוריות להצגה</div>'), syncActiveCategoryNavLink(), scheduleCategoryNavFit();
}
function isMobileCategoryMenuOpen() {
  return !!(catalogElements.mobileCategoryMenu && !catalogElements.mobileCategoryMenu.classList.contains("hidden"));
}
function setMobileCategoryMenuOpen(open, options = {}) {
  let shouldOpen = !!open;
  !catalogElements.mobileCategoryMenu || !catalogElements.mobileCategoryMenuToggle || (catalogElements.mobileCategoryMenu.classList.toggle("hidden", !shouldOpen), catalogElements.mobileCategoryMenu.classList.toggle("is-open", shouldOpen), catalogElements.mobileCategoryMenuToggle.classList.toggle("is-active", shouldOpen), catalogElements.mobileCategoryMenuToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false"), catalogElements.mobileCategoryMenuToggle.setAttribute("aria-label", shouldOpen ? "סגירת תפריט קטגוריות" : "פתיחת תפריט קטגוריות"), shouldOpen && options.focusFirst ? window.requestAnimationFrame(() => focusHtmlElement(catalogElements.mobileCategoryMenu?.querySelector(".mobile-category-menu-link"))) : !shouldOpen && options.focusButton && window.requestAnimationFrame(() => catalogElements.mobileCategoryMenuToggle?.focus({ preventScroll: !0 })));
}
function closeMobileCategoryMenu(options = {}) {
  setMobileCategoryMenuOpen(!1, options);
}
function decodeHashTargetId(hash = location.hash) {
  return searchCatalogDomain.decodeCatalogHashTargetId(hash);
}
function isCatalogFocusSection(section) {
  return !!(section instanceof HTMLElement && (section.classList.contains("catalog-category-section") || section.classList.contains("catalog-subcategory-section")));
}
function getCatalogCategorySectionById(id) {
  let sectionId = String(id || ""), section = sectionId ? document.getElementById(sectionId) : null;
  return isCatalogFocusSection(section) ? section : null;
}
function getCatalogCategoryFocusTargetId(section) {
  return section?.dataset?.categoryFocusTarget || section?.id || "";
}
function getCatalogFocusSections() {
  return Array.from(catalogElements.catalogGrid.querySelectorAll(".catalog-category-section, .catalog-subcategory-section")).filter(isHtmlElement);
}
function getCatalogCategorySectionsByTargetId(targetId) {
  let normalizedTargetId = String(targetId || "");
  return normalizedTargetId ? getCatalogFocusSections().filter((section) => {
    let focusTargetId = getCatalogCategoryFocusTargetId(section), parentCategoryTargetId = section?.dataset?.parentCategoryTarget || "";
    return focusTargetId === normalizedTargetId || parentCategoryTargetId === normalizedTargetId || section.id === normalizedTargetId;
  }) : [];
}
function catalogCategorySharePathFromHash(hash = location.hash) {
  let rawHash = String(hash || "");
  if (!rawHash.startsWith("#")) return "";
  let parts = rawHash.slice(1).replace(/^\/+/, "").split("/");
  return parts[0] !== "cat" || !parts[1] ? "" : normalizeShareRoutePath(parts.slice(1).map(decodeHashRouteSegment).join("/"));
}
function getCatalogCategorySectionBySharePath(path) {
  let normalizedPath = normalizeShareRoutePath(path);
  return normalizedPath && getCatalogFocusSections().find((section) => normalizeShareRoutePath(section?.dataset?.categorySharePath) === normalizedPath) || null;
}
function resolveCatalogCategoryTargetIdFromHash(hash = location.hash) {
  let sharePath = catalogCategorySharePathFromHash(hash);
  if (sharePath) {
    let section = getCatalogCategorySectionBySharePath(sharePath);
    return getCatalogCategoryFocusTargetId(section);
  }
  return decodeHashTargetId(hash);
}
function buildCatalogFocusRouteHash(targetId) {
  let section = getCatalogCategorySectionsByTargetId(targetId)[0] || getCatalogCategorySectionById(targetId), sharePath = normalizeShareRoutePath(section?.dataset?.categorySharePath);
  return buildCategoryShareRouteHash(sharePath) || (targetId ? `#${encodeHashRouteSegment(targetId)}` : "");
}
function hasCatalogCategoryFocus(targetId) {
  return getCatalogCategorySectionsByTargetId(targetId).some((section) => section.classList.contains("is-category-focus"));
}
function syncActiveCategoryNavLink(activeId = catalogState.categoryFocusTargetId) {
  let normalizedActiveId = String(activeId || "");
  [catalogElements.categoryNav, catalogElements.mobileCategoryMenu].forEach((container) => {
    Array.from(container?.querySelectorAll(".category-nav-link") || []).filter(isHtmlElement).forEach((link) => {
      let isActive = !!(normalizedActiveId && link.dataset.categoryTarget === normalizedActiveId);
      link.classList.toggle("active", isActive), isActive ? link.setAttribute("aria-current", "location") : link.removeAttribute("aria-current");
    });
  }), Array.from(catalogElements.catalogGrid?.querySelectorAll(".catalog-subcategory-nav-link") || []).filter(isHtmlElement).forEach((link) => {
    let isActive = !!(normalizedActiveId && link.dataset.categoryTarget === normalizedActiveId);
    link.classList.toggle("active", isActive), isActive ? link.setAttribute("aria-current", "location") : link.removeAttribute("aria-current");
  });
}
function clearCatalogCategoryFocus(options = {}) {
  let { clearHash = !1 } = options;
  window.clearTimeout(catalogState.categoryFocusTimer), catalogState.categoryFocusTimer = 0, catalogState.categoryFocusTargetId = "", getCatalogFocusSections().forEach((section) => {
    section.classList.remove("is-category-focus");
  }), syncActiveCategoryNavLink("");
  let hashTargetId = resolveCatalogCategoryTargetIdFromHash();
  return clearHash && hashTargetId && getCatalogCategorySectionsByTargetId(hashTargetId).length && history.replaceState(history.state, "", `${location.pathname}${location.search}`), !0;
}
function markCatalogCategoryFocus(section, options = {}) {
  if (!section) return !1;
  let { animate = !0, targetId: requestedTargetId = "" } = options, targetId = String(requestedTargetId || getCatalogCategoryFocusTargetId(section) || ""), targetSections = getCatalogCategorySectionsByTargetId(targetId);
  return !targetId || !targetSections.length ? !1 : (window.clearTimeout(catalogState.categoryFocusTimer), catalogState.categoryFocusTimer = 0, getCatalogFocusSections().forEach((activeSection) => {
    targetSections.includes(activeSection) || activeSection.classList.remove("is-category-focus");
  }), targetSections.forEach((targetSection) => targetSection.classList.remove("is-category-focus")), animate && targetSections[0].offsetWidth, targetSections.forEach((targetSection) => targetSection.classList.add("is-category-focus")), catalogState.categoryFocusTargetId = targetId, syncActiveCategoryNavLink(targetId), !0);
}
function activateCatalogCategoryTarget(targetId, { toggle = !1 } = {}) {
  let id = String(targetId || "").trim();
  if (!id) return !1;
  if (!isAppPage("home"))
    return navigateTo(`${homeDocumentUrl()}${buildCatalogFocusRouteHash(id)}`), !0;
  if (toggle && catalogState.categoryFocusTargetId === id && hasCatalogCategoryFocus(id))
    return clearCatalogCategoryFocus({ clearHash: !0 }), !0;
  let section = getCatalogCategorySectionById(id) || getCatalogCategorySectionsByTargetId(id)[0];
  return section ? (markCatalogCategoryFocus(section, { targetId: id }), section.scrollIntoView?.({ behavior: "smooth", block: "start" }), location.hash !== buildCatalogFocusRouteHash(id) && (location.hash = buildCatalogFocusRouteHash(id)), !0) : !1;
}
function handleCatalogFocusLinkClick(link, event) {
  let targetId = link?.dataset?.categoryTarget || resolveCatalogCategoryTargetIdFromHash(link?.hash);
  targetId && (event.preventDefault(), activateCatalogCategoryTarget(targetId, { toggle: !0 }));
}
function syncCatalogCategoryFocusFromHash(options = {}) {
  let targetId = resolveCatalogCategoryTargetIdFromHash(), section = getCatalogCategorySectionById(targetId);
  if (!section)
    return clearCatalogCategoryFocus(), !1;
  let { scroll = !1 } = options;
  return scroll && section.scrollIntoView({ behavior: "smooth", block: "start" }), markCatalogCategoryFocus(section, { ...options, targetId });
}
function catalogLayoutColumnCount() {
  return searchCatalogDomain.catalogColumnCount({
    mobile: !!window.matchMedia?.("(max-width: 760px)").matches,
    tablet: !!window.matchMedia?.("(max-width: 1180px)").matches
  });
}
function scheduleCatalogLayoutRefresh() {
  catalogs.length && (window.clearTimeout(catalogState.catalogLayoutResizeTimer), catalogState.catalogLayoutResizeTimer = window.setTimeout(() => {
    catalogLayoutColumnCount() !== catalogState.catalogLayoutColumns && renderCatalogCards();
  }, 120));
}
function renderCatalogCard(catalog, headingLevel = 3) {
  let cover = coverThumbSrc(catalog), safeCatalogId = escapeHtml(catalog.id), safeTitle = escapeHtml(catalog.title), safeHeadingLevel = headingLevel === 4 ? 4 : 3, catalogHref = escapeHtml(catalogDocumentUrl(catalog.id));
  return `
    <article class="catalog-card">
      <a class="catalog-cover-frame catalog-image-frame catalog-cover-button" href="${catalogHref}" data-open-catalog-entry="${safeCatalogId}" aria-label="פתיחת הקטלוג ${safeTitle}">
        <img class="catalog-cover" src="${escapeHtml(cover)}" alt="כריכת ${safeTitle}"${catalogImageDimensionAttributes(catalog, 1)}${catalogCoverLoadingAttributes(catalog)}${catalogImageRecoveryAttributes(catalog, 1, "cover", "catalog-grid")}${catalogImageCrossOriginAttribute(cover)} />
        <span class="catalog-cover-card-entry-hint" aria-hidden="true">פתיחת הקטלוג</span>
      </a>
      <div class="catalog-body">
        <h${safeHeadingLevel}><a href="${catalogHref}" data-open-catalog-preview="${safeCatalogId}">${safeTitle}</a></h${safeHeadingLevel}>
        <p>${escapeHtml(catalog.description || "")}</p>
        <div class="catalog-actions" role="group" aria-label="פעולות עבור ${safeTitle}">
          <a class="button primary catalog-open-button" href="${catalogHref}" data-open-catalog-entry="${safeCatalogId}">פתיחת הקטלוג</a>
          <button class="button soft catalog-preview-button" type="button" data-open-catalog-preview="${safeCatalogId}">תצוגה מקדימה</button>
        </div>
      </div>
    </article>
  `;
}
function renderCatalogSubcategoryNav(segment) {
  if (!segment?.hasSubcategories || !Array.isArray(segment.subcategories) || !segment.subcategories.length) return "";
  let buttons = segment.subcategories.map((group, index) => {
    let targetId = subcategorySectionId(segment.category, segment.groupIndex, group.subcategory, index), sharePath = catalogSubcategorySharePath(segment.category, segment.groupIndex, group.subcategory, index);
    return `<a class="catalog-subcategory-nav-link" href="${escapeHtml(categoryDocumentUrl(categoryShareSlug(segment.category, segment.groupIndex), subcategoryShareSlug(group.subcategory, index)))}" data-category-target="${escapeHtml(targetId)}" data-category-share-path="${escapeHtml(sharePath)}">${escapeHtml(group.subcategory)}</a>`;
  }).join("");
  return `
    <nav class="catalog-subcategory-nav" aria-label="ניווט תתי קטגוריות עבור ${escapeHtml(segment.category)}">
      ${buttons}
    </nav>
  `;
}
function catalogSubcategoryBlockBaseId(segment, block, baseSectionId) {
  return block?.isDirect ? `${baseSectionId}-general` : subcategorySectionId(segment.category, segment.groupIndex, block?.label || block?.blockKey, block?.blockIndex || 0);
}
function renderCatalogSubcategoryBlock(segment, block, options = {}) {
  let { baseSectionId = "" } = options, items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) return "";
  let blockBaseId = catalogSubcategoryBlockBaseId(segment, block, baseSectionId), sharePath = block?.isDirect ? catalogCategorySharePath(segment.category, segment.groupIndex) : catalogSubcategorySharePath(segment.category, segment.groupIndex, block?.label || block?.blockKey, block?.blockIndex || 0), sectionId = block.segmentIndex === 0 ? blockBaseId : `${blockBaseId}-part-${block.segmentIndex + 1}`, titleId = `${sectionId}-title`, title = String(block?.label || "").trim() || "קטלוגים", sectionStyle = `--subcategory-span: ${searchCatalogDomain.clampCatalogSpan(block.span, 3)};`;
  return `
    <section class="catalog-subcategory-section" id="${escapeHtml(sectionId)}" aria-labelledby="${escapeHtml(titleId)}" style="${escapeHtml(sectionStyle)}" data-category-focus-target="${escapeHtml(blockBaseId)}" data-parent-category-target="${escapeHtml(baseSectionId)}" data-category-share-path="${escapeHtml(sharePath)}" data-subcategory-span="${escapeHtml(String(block.span))}" data-inline-divider="${block.inlineDivider ? "1" : "0"}" data-subcategory-continuation="${block.itemOffset > 0 ? "1" : "0"}">
      <div class="catalog-category-head catalog-subcategory-head">
        <h3 id="${escapeHtml(titleId)}">${escapeHtml(title)}</h3>
      </div>
      <div class="catalog-grid catalog-category-grid catalog-subcategory-grid">
        ${items.map((catalog) => renderCatalogCard(catalog, 4)).join("")}
      </div>
    </section>
  `;
}
function renderCatalogCategoryHeaderSegment(segment, columns) {
  let baseSectionId = categorySectionId(segment.category, segment.groupIndex), titleId = `${baseSectionId}-title`, safeColumns = searchCatalogDomain.clampCatalogSpan(columns, 3), sectionStyle = `--category-span: ${safeColumns}; --subcategory-layout-columns: ${safeColumns};`, sharePath = catalogCategorySharePath(segment.category, segment.groupIndex);
  return `
    <section class="catalog-category-section catalog-category-section-with-subcategories catalog-category-section-header-only" id="${escapeHtml(baseSectionId)}" aria-labelledby="${escapeHtml(titleId)}" style="${escapeHtml(sectionStyle)}" data-category-focus-target="${escapeHtml(baseSectionId)}" data-category-share-path="${escapeHtml(sharePath)}" data-category-span="${escapeHtml(String(safeColumns))}" data-inline-divider="0" data-category-continuation="0">
      <div class="catalog-category-head catalog-category-head-with-subcategories">
        <h2 id="${escapeHtml(titleId)}">${escapeHtml(segment.category)}</h2>
        ${renderCatalogSubcategoryNav(segment)}
      </div>
    </section>
  `;
}
function renderCatalogCategorySegment(segment, columns) {
  let baseSectionId = categorySectionId(segment.category, segment.groupIndex), safeColumns = searchCatalogDomain.clampCatalogSpan(columns, 3);
  if (segment.segmentType === "categoryHeader")
    return renderCatalogCategoryHeaderSegment(segment, safeColumns);
  if (segment.segmentType === "subcategory")
    return renderCatalogSubcategoryBlock(segment, segment, { baseSectionId });
  let sectionId = segment.itemOffset === 0 ? baseSectionId : `${baseSectionId}-part-${segment.segmentIndex + 1}`, titleId = `${sectionId}-title`, sectionStyle = `--category-span: ${segment.span}; --subcategory-layout-columns: ${safeColumns};`, sharePath = catalogCategorySharePath(segment.category, segment.groupIndex);
  return `
    <section class="catalog-category-section" id="${escapeHtml(sectionId)}" aria-labelledby="${escapeHtml(titleId)}" style="${escapeHtml(sectionStyle)}" data-category-focus-target="${escapeHtml(baseSectionId)}" data-category-share-path="${escapeHtml(sharePath)}" data-category-span="${escapeHtml(String(segment.span))}" data-inline-divider="${segment.inlineDivider ? "1" : "0"}" data-category-continuation="${segment.itemOffset > 0 ? "1" : "0"}">
      <div class="catalog-category-head">
        <h2 id="${escapeHtml(titleId)}">${escapeHtml(segment.category)}</h2>
      </div>
      <div class="catalog-grid catalog-category-grid">
        ${segment.items.map((catalog) => renderCatalogCard(catalog, 3)).join("")}
      </div>
    </section>
  `;
}
function openCatalogEntry(catalogId, page = void 0) {
  if (!catalogId) return;
  let catalog = catalogs.find((item) => item.id === catalogId) || null;
  if (!catalog) return;
  let targetPage = page === void 0 ? catalogFirstPage(catalog) : page, viewer = getFeatureInterface("viewer");
  if (viewer?.openCatalog) {
    viewer.openCatalog(catalogId, targetPage);
    return;
  }
  navigateTo(viewerDocumentUrl(catalogId, targetPage));
}
function bindCatalogCardEvents() {
  catalogElements.catalogGrid && (Array.from(catalogElements.catalogGrid.querySelectorAll("[data-open-catalog-entry]")).filter(isHtmlElement).forEach((control) => {
    control.addEventListener("click", (event) => {
      !(event instanceof MouseEvent) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (event.preventDefault(), openCatalogEntry(control.dataset.openCatalogEntry));
    });
  }), Array.from(catalogElements.catalogGrid.querySelectorAll("[data-open-catalog-preview]")).filter(isHtmlElement).forEach((control) => {
    control.addEventListener("click", (event) => {
      if (!(event instanceof MouseEvent) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      let catalogId = String(control.dataset.openCatalogPreview || "");
      catalogId && openCatalog(catalogId, { scroll: !0 });
    });
  }));
}
function renderCatalogCards() {
  if (!catalogs.length) {
    renderEmptyState();
    return;
  }
  let groups = getCatalogCategoryGroups(), totalPages = catalogs.reduce((sum, item) => sum + Number(item.pages || 0), 0);
  catalogElements.catalogCount && (catalogElements.catalogCount.textContent = String(catalogs.length)), catalogElements.pageCount && (catalogElements.pageCount.textContent = String(totalPages)), renderCategoryNav(groups);
  let columns = catalogLayoutColumnCount();
  catalogState.catalogLayoutColumns = columns;
  let categorySegments = (
    /** @type {Array<CatalogLayoutSegment>} */
    searchCatalogDomain.catalogCategorySegments(groups, columns)
  );
  if (catalogElements.catalogGrid.style.setProperty("--catalog-layout-columns", String(columns)), catalogElements.catalogGrid.innerHTML = categorySegments.map((segment) => renderCatalogCategorySegment(segment, columns)).join(""), catalogElements.catalogGrid.setAttribute("aria-busy", "false"), catalogElements.catalogLoadStatus) {
    let count = catalogs.length;
    catalogElements.catalogLoadStatus.textContent = count === 1 ? "קטלוג אחד נטען." : `${count} קטלוגים נטענו.`;
  }
  bindCatalogCardEvents(), syncCatalogCategoryFocusFromHash({ animate: !1 });
}
function fillCatalogSelect() {
  updateDetailCatalogMenuLabel();
}
function renderPageGrid() {
  let catalog = activeCatalog();
  if (!catalog) return;
  let cards = [];
  for (let page of catalogPageNumbers(catalog))
    cards.push(`
      <article class="page-card">
        <a class="page-button" href="${escapeHtml(viewerDocumentUrl(catalog.id, page))}" data-open-page="${page}">
          <div class="page-thumb-wrap"${pageAspectVariableStyle(catalog, page, "--page-thumb-aspect-ratio")}>
            <img class="page-thumb" src="${escapeHtml(thumbSrc(catalog, page))}" alt="${escapeHtml(catalog.title)} - עמוד ${page}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async" fetchpriority="low"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "catalog-page-grid")}${catalogImageCrossOriginAttribute(thumbSrc(catalog, page))} />
            <span class="page-number-badge">${page}</span>
          </div>
          <div class="page-card-body">
            <span class="page-card-title">עמוד ${page}</span>
            <span class="page-card-hint">לחץ להגדלה</span>
          </div>
        </a>
      </article>
    `);
  catalogElements.pageGrid.setAttribute("aria-busy", "true"), catalogElements.pageGrid.innerHTML = cards.join(""), catalogElements.pageGrid.setAttribute("aria-busy", "false"), Array.from(catalogElements.pageGrid.querySelectorAll("[data-open-page]")).filter(isHtmlElement).forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!(event instanceof MouseEvent) || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      let page = Number(link.dataset.openPage), viewer = getFeatureInterface("viewer");
      viewer ? viewer.openCatalog(catalog.id, page) : navigateTo(viewerDocumentUrl(catalog.id, page));
    });
  });
}
function showCatalogDetail() {
  catalogElements.catalogDetail && (catalogElements.catalogDetail.classList.remove("hidden"), catalogElements.catalogDetail.classList.add("in-view"));
}
function scrollCatalogDetailIntoView(options = {}) {
  if (!catalogElements.catalogDetail) return;
  let { behavior = "smooth" } = options;
  requestAnimationFrame(() => {
    catalogElements.catalogDetail.scrollIntoView({ behavior, block: "start" }), scheduleCatalogScrollTopButtonUpdate();
  });
}
function positionCatalogScrollTopButton() {
  if (!catalogElements.scrollToTopBtn || !catalogElements.pageGrid) return;
  let gridRect = catalogElements.pageGrid.getBoundingClientRect(), viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0, buttonWidth = Math.max(catalogElements.scrollToTopBtn.offsetWidth || 46, 46), safeInset = 12, gapFromGrid = 12, maxLeft = Math.max(safeInset, viewportWidth - buttonWidth - safeInset), preferredLeft = gridRect.left - buttonWidth - gapFromGrid, left = clampValue(preferredLeft, safeInset, maxLeft);
  catalogElements.scrollToTopBtn.style.setProperty("--catalog-scroll-top-left", `${Math.round(left)}px`);
}
function setCatalogScrollTopButtonVisible(visible) {
  catalogElements.scrollToTopBtn && (catalogElements.scrollToTopBtn.classList.toggle("is-visible", !!visible), catalogElements.scrollToTopBtn.setAttribute("aria-hidden", visible ? "false" : "true"), catalogElements.scrollToTopBtn.tabIndex = visible ? 0 : -1);
}
function updateCatalogScrollTopButton() {
  if (catalogState.catalogScrollTopButtonRaf = 0, !catalogElements.scrollToTopBtn || !catalogElements.catalogDetail || !catalogElements.pageGrid || catalogElements.catalogDetail.classList.contains("hidden") || !activeCatalog() || getFeatureInterface("viewer")?.isViewerOpen?.()) {
    setCatalogScrollTopButtonVisible(!1);
    return;
  }
  positionCatalogScrollTopButton();
  let detailRect = catalogElements.catalogDetail.getBoundingClientRect(), gridRect = catalogElements.pageGrid.getBoundingClientRect(), viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0, headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 90, startedScrollingInsideGrid = gridRect.top < Math.min(headerHeight + 28, viewportHeight * 0.28), stillNearGrid = gridRect.bottom > Math.min(180, viewportHeight * 0.35), detailVisible = detailRect.bottom > 80 && detailRect.top < viewportHeight;
  setCatalogScrollTopButtonVisible(startedScrollingInsideGrid && stillNearGrid && detailVisible);
}
function scheduleCatalogScrollTopButtonUpdate() {
  catalogState.catalogScrollTopButtonRaf || (catalogState.catalogScrollTopButtonRaf = requestAnimationFrame(updateCatalogScrollTopButton));
}
function renderCatalogCategoryMenu(menu, options = {}) {
  let { activeCatalogId = activeCatalog()?.id, onSelect } = options;
  if (!catalogs.length) {
    menu.innerHTML = '<div class="reader-catalog-menu-empty">אין קטלוגים להצגה</div>';
    return;
  }
  let groups = getCatalogCategoryGroups();
  menu.innerHTML = groups.map((group) => `
    <section class="reader-catalog-menu-section">
      <div class="reader-catalog-menu-category">${escapeHtml(group.category)}</div>
      <div class="reader-catalog-menu-items">
        ${group.items.map((catalog) => `
          <button class="reader-catalog-menu-item${activeCatalogId === catalog.id ? " active" : ""}" type="button" role="menuitem" data-catalog-menu-id="${escapeHtml(catalog.id)}"${activeCatalogId === catalog.id ? ' aria-current="true"' : ""}>
            <strong>${escapeHtml(catalog.title)}</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `).join(""), onSelect && Array.from(menu.querySelectorAll("[data-catalog-menu-id]")).filter(isHtmlElement).forEach((button) => {
    button.addEventListener("click", () => {
      let catalogId = String(button.dataset.catalogMenuId || "");
      catalogId && onSelect(catalogId);
    });
  });
}
function updateDetailCatalogMenuLabel(catalog = activeCatalog()) {
  catalogElements.catalogMenuToggleText.textContent = catalog?.title || "בחר קטלוג";
}
function renderDetailCatalogMenu() {
  renderCatalogCategoryMenu(catalogElements.catalogMenu, {
    onSelect: (catalogId) => {
      closeDetailCatalogMenu(), catalogId !== activeCatalog()?.id && navigateTo(catalogDocumentUrl(catalogId));
    }
  });
}
function renderCatalogDetail() {
  let catalog = activeCatalog();
  catalog && (showCatalogDetail(), catalogElements.catalogTitle.textContent = catalog.title, catalogElements.catalogDescription.textContent = catalog.description || "", updateDetailCatalogMenuLabel(catalog), catalogElements.catalogCoverPreview && (applyCatalogImageDimensions(catalogElements.catalogCoverPreview, catalog, catalogFirstPage(catalog)), setCatalogImageSource(catalogElements.catalogCoverPreview, coverThumbSrc(catalog)), catalogElements.catalogCoverPreview.loading = "lazy", catalogElements.catalogCoverPreview.decoding = "async", catalogElements.catalogCoverPreview.alt = `שער ${catalog.title}`), catalogElements.openCatalogEntryFromDetail && (catalogElements.openCatalogEntryFromDetail.disabled = catalog.pages < 1), catalogElements.catalogMenu && !catalogElements.catalogMenu.classList.contains("hidden") && renderDetailCatalogMenu(), renderPageGrid(), scheduleCatalogScrollTopButtonUpdate());
}
function openCatalog(id, options = {}) {
  let { scroll = !1, openPage = null, scrollBehavior = "smooth" } = options, catalog = catalogs.find((item) => item.id === id) || null;
  if (catalog) {
    if (!isAppPage("catalog")) {
      navigateTo(openPage != null ? viewerDocumentUrl(catalog.id, openPage) : catalogDocumentUrl(catalog.id));
      return;
    }
    setActiveLocation(catalog, catalogFirstPage(catalog), activeViewerSource()), renderCatalogDetail(), history.replaceState(history.state, "", catalogDocumentUrl(catalog.id)), scroll && scrollCatalogDetailIntoView({ behavior: scrollBehavior }), openPage != null && navigateTo(viewerDocumentUrl(catalog.id, openPage));
  }
}
function closeDetailCatalogMenu() {
  catalogElements.catalogMenu.classList.add("hidden"), catalogElements.catalogMenuToggle.setAttribute("aria-expanded", "false");
}
function catalogGridContainsMenuTarget(target) {
  return target instanceof Node ? [
    catalogElements.catalogMenu,
    catalogElements.catalogMenuToggle,
    catalogElements.mobileCategoryMenu,
    catalogElements.mobileCategoryMenuToggle
  ].some((element) => element.contains(target)) : !1;
}
function prepareCatalogGridRoute(nextPage) {
  closeMobileCategoryMenu(), closeDetailCatalogMenu(), nextPage !== "catalog" && (catalogElements.catalogDetail.classList.add("hidden"), catalogElements.catalogDetail.classList.remove("in-view"), setCatalogScrollTopButtonVisible(!1));
}
function handleCatalogGridResize() {
  window.innerWidth > 760 && closeMobileCategoryMenu(), scheduleCatalogLayoutRefresh(), scheduleCategoryNavFit(), scheduleCatalogScrollTopButtonUpdate();
}
function handleCatalogGridScroll() {
  scheduleCatalogScrollTopButtonUpdate();
}
function attachCatalogGridEvents() {
  catalogElements.mobileCategoryMenuToggle?.addEventListener("click", (event) => {
    event.preventDefault(), event.stopPropagation(), getFeatureInterface("search")?.closeGlobalPanel({ focusButton: !1 }), setMobileCategoryMenuOpen(!isMobileCategoryMenuOpen());
  }), catalogElements.mobileCategoryMenu?.addEventListener("click", (event) => {
    let link = eventTargetElement(event.target)?.closest(".category-nav-link");
    !(link instanceof HTMLAnchorElement) || !catalogElements.mobileCategoryMenu.contains(link) || (closeMobileCategoryMenu(), handleCatalogFocusLinkClick(link, event));
  }), catalogElements.catalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation(), closeLightboxCatalogMenu(), closeLightboxSearchScopeMenu(), renderDetailCatalogMenu();
    let isOpen = !catalogElements.catalogMenu?.classList.contains("hidden");
    catalogElements.catalogMenu?.classList.toggle("hidden", isOpen), catalogElements.catalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  }), catalogElements.catalogMenu?.addEventListener("click", (event) => event.stopPropagation()), catalogElements.openCatalogEntryFromDetail?.addEventListener("click", () => {
    let catalog = activeCatalog();
    catalog && navigateTo(viewerDocumentUrl(catalog.id, catalogFirstPage(catalog)));
  }), catalogElements.scrollToTopBtn?.addEventListener("click", () => scrollCatalogDetailIntoView()), catalogElements.categoryNav?.addEventListener("click", (event) => {
    let link = eventTargetElement(event.target)?.closest(".category-nav-link");
    !(link instanceof HTMLAnchorElement) || !catalogElements.categoryNav.contains(link) || (closeMobileCategoryMenu(), handleCatalogFocusLinkClick(link, event));
  }), catalogElements.catalogGrid?.addEventListener("click", (event) => {
    let link = eventTargetElement(event.target)?.closest(".catalog-subcategory-nav-link");
    !(link instanceof HTMLAnchorElement) || !catalogElements.catalogGrid.contains(link) || handleCatalogFocusLinkClick(link, event);
  });
}
registerFeatureInterface("catalog-grid", {
  attachEvents: attachCatalogGridEvents,
  initialize: () => {
    initRevealObserver(), initCategoryNavFit();
  },
  renderInitialContent: () => {
    renderCatalogCards(), fillCatalogSelect();
  },
  renderEmptyState,
  openCatalog,
  closeMobileMenu: (options = {}) => closeMobileCategoryMenu(options),
  scheduleLayoutRefresh: scheduleCatalogLayoutRefresh,
  scheduleCategoryNavFit,
  scheduleScrollTopButtonUpdate: scheduleCatalogScrollTopButtonUpdate,
  setScrollTopButtonVisible: setCatalogScrollTopButtonVisible,
  syncCategoryFocusFromHash: (options = {}) => syncCatalogCategoryFocusFromHash(options),
  resolveCategoryTargetIdFromHash: (hash = location.hash) => resolveCatalogCategoryTargetIdFromHash(hash),
  hasCategoryTarget: (targetId) => getCatalogCategorySectionsByTargetId(targetId).length > 0,
  activeCategoryTargetId: () => String(catalogState.categoryFocusTargetId || ""),
  activateCategoryTarget: activateCatalogCategoryTarget,
  layoutColumnCount: catalogLayoutColumnCount,
  hideDetail: () => {
    catalogElements.catalogDetail.classList.add("hidden"), catalogElements.catalogDetail.classList.remove("in-view"), setCatalogScrollTopButtonVisible(!1);
  },
  prepareRoute: prepareCatalogGridRoute,
  containsMenuTarget: catalogGridContainsMenuTarget,
  handleResize: handleCatalogGridResize,
  handleScroll: handleCatalogGridScroll,
  renderCatalogMenu: renderCatalogCategoryMenu,
  syncDetailMenuLabel: updateDetailCatalogMenuLabel,
  renderDetailMenu: renderDetailCatalogMenu
});
registerFeatureInterface("catalog-navigation", {
  escapePriority: 400,
  closeTopLayer: () => isMobileCategoryMenuOpen() ? (closeMobileCategoryMenu({ focusButton: !0 }), !0) : !1
});
registerFeatureInterface("catalog-detail", {
  escapePriority: 200,
  close: closeDetailCatalogMenu,
  containsTarget: (target) => target instanceof Node && (catalogElements.catalogMenu.contains(target) || catalogElements.catalogMenuToggle.contains(target)),
  closeTopLayer: () => catalogElements.catalogMenu.classList.contains("hidden") ? !1 : (closeDetailCatalogMenu(), !0)
});

// src/js/17-viewer-state-transitions.js
var VIEWER_NAVIGATION_SOURCE_BUTTON = "button", VIEWER_NAVIGATION_SOURCE_KEYBOARD = "keyboard", VIEWER_NAVIGATION_SOURCE_HOME_END = "home-end", VIEWER_NAVIGATION_SOURCE_PAGE_RAIL = "page-rail", VIEWER_NAVIGATION_SOURCE_PROGRAMMATIC = "programmatic", VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE = "horizontal-swipe", VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING = "continuous-reading", VIEWER_NAVIGATION_SOURCE_VERTICAL_SWIPE = "vertical-swipe", VIEWER_NAVIGATION_SOURCE_WHEEL = "wheel", VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN = "boundary-pan", VIEWER_NAVIGATION_SOURCE_MOMENTUM = "momentum", DIRECT_NAVIGATION_SOURCES = /* @__PURE__ */ new Set([
  VIEWER_NAVIGATION_SOURCE_BUTTON,
  VIEWER_NAVIGATION_SOURCE_KEYBOARD,
  VIEWER_NAVIGATION_SOURCE_HOME_END,
  VIEWER_NAVIGATION_SOURCE_PAGE_RAIL,
  VIEWER_NAVIGATION_SOURCE_PROGRAMMATIC
]), RESETTABLE_READING_SOURCES = /* @__PURE__ */ new Set([
  VIEWER_NAVIGATION_SOURCE_VERTICAL_SWIPE,
  VIEWER_NAVIGATION_SOURCE_WHEEL,
  VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN,
  VIEWER_NAVIGATION_SOURCE_MOMENTUM
]), VIEWER_NAVIGATION_SOURCES = /* @__PURE__ */ new Set([
  ...DIRECT_NAVIGATION_SOURCES,
  ...RESETTABLE_READING_SOURCES,
  VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING,
  VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE
]), VIEWER_NAVIGATION_POSITION_MODES = /* @__PURE__ */ new Set(["relative", "page-turn", "fit-origin"]), VIEWER_NAVIGATION_ZOOM_MODES = /* @__PURE__ */ new Set(["preserve", "reset"]);
function viewerInvariant(condition, message, context) {
  if (!condition)
    throw new Error(`Viewer state invariant failed (${context}): ${message}`);
}
function captureViewerStateInvariantSnapshot() {
  return viewerInvariant(viewerGestureState.pointers instanceof Map, "gesture pointers are not Map-owned", "capture-state"), {
    phase: viewerSessionState.viewerPhase,
    pointerCount: viewerGestureState.pointers.size,
    momentumActive: !!(viewerGestureState.viewerTouchMomentumRaf || viewerGestureState.viewerTouchMomentumVelocityX || viewerGestureState.viewerTouchMomentumVelocityY || viewerGestureState.viewerTouchMomentumLastTime),
    pendingViewportModes: [
      viewerViewportState.singleImageFitOriginPending,
      !!viewerViewportState.singleImagePendingRelativePosition,
      !!viewerViewportState.singleImagePendingPageTurnOrigin
    ].filter(Boolean).length,
    resolution: {
      hasImage: !!viewerImageState.singleImageResolutionImage,
      hasTarget: !!viewerImageState.singleImageResolutionTargetSrc,
      hasTier: !!viewerImageState.singleImageResolutionTargetTier,
      ready: viewerImageState.singleImageResolutionReady,
      visible: viewerImageState.singleImageResolutionVisible,
      commitPending: viewerImageState.singleImageResolutionCommitPending,
      retainedForSwap: viewerImageState.singleImageResolutionRetainedForSwap,
      loading: !!viewerImageState.singleImageResolutionStop
    }
  };
}
function assertViewerStateInvariants(context = "unspecified") {
  let snapshot = captureViewerStateInvariantSnapshot();
  if (viewerInvariant(Number.isFinite(viewerViewportState.zoom) && viewerViewportState.zoom > 0, "viewport zoom is invalid", context), viewerInvariant(Number.isFinite(viewerViewportState.fitScale) && viewerViewportState.fitScale > 0, "viewport fit scale is invalid", context), viewerInvariant(Number.isFinite(viewerViewportState.panX) && Number.isFinite(viewerViewportState.panY), "viewport pan is not finite", context), viewerInvariant(snapshot.pendingViewportModes <= 1, "viewport has multiple pending position modes", context), viewerViewportState.singleImagePendingRelativePosition) {
    let pending = viewerViewportState.singleImagePendingRelativePosition;
    viewerInvariant(Number.isInteger(pending.page) && pending.page >= 0, "relative viewport target page is invalid", context), viewerInvariant(Number.isFinite(pending.xRatio) && Number.isFinite(pending.yRatio), "relative viewport ratios are not finite", context), viewerInvariant(Math.abs(pending.xRatio) <= 1 && Math.abs(pending.yRatio) <= 1, "relative viewport ratios exceed normalized bounds", context);
  }
  if (viewerViewportState.singleImagePendingPageTurnOrigin) {
    let pending = viewerViewportState.singleImagePendingPageTurnOrigin;
    viewerInvariant(Number.isInteger(pending.page) && pending.page >= 0, "page-turn target page is invalid", context), viewerInvariant(pending.axis === "x" || pending.axis === "y", "page-turn axis is invalid", context), viewerInvariant(pending.direction === -1 || pending.direction === 1, "page-turn direction is invalid", context);
  }
  viewerInvariant(
    Number.isFinite(viewerGestureState.viewerTouchMomentumVelocityX) && Number.isFinite(viewerGestureState.viewerTouchMomentumVelocityY) && Number.isFinite(viewerGestureState.viewerTouchMomentumLastTime),
    "touch momentum contains non-finite values",
    context
  ), viewerInvariant(!(snapshot.momentumActive && snapshot.pointerCount > 0), "touch momentum and active pointers overlap", context), snapshot.phase === "closed" && (viewerInvariant(snapshot.pointerCount === 0, "closed session retains active pointers", context), viewerInvariant(!snapshot.momentumActive, "closed session retains touch momentum", context)), viewerInvariant(
    Number.isInteger(viewerImageState.singleImageLoadToken) && viewerImageState.singleImageLoadToken >= 0,
    "image swap token is invalid",
    context
  ), viewerInvariant(
    Number.isInteger(viewerImageState.singleImageResolutionLoadToken) && viewerImageState.singleImageResolutionLoadToken >= 0,
    "resolution token is invalid",
    context
  );
  let resolution = snapshot.resolution;
  return snapshot.phase === "closed" && viewerInvariant(
    !resolution.hasTarget && !resolution.ready && !resolution.visible && !resolution.commitPending && !resolution.retainedForSwap && !resolution.loading,
    "closed session retains an active resolution lifecycle",
    context
  ), viewerInvariant(resolution.hasTarget === resolution.hasTier, "resolution target source/tier ownership diverged", context), (resolution.ready || resolution.visible || resolution.commitPending || resolution.loading) && (viewerInvariant(resolution.hasTarget, "active resolution lifecycle has no target", context), viewerInvariant(resolution.hasImage, "active resolution lifecycle has no image layer", context)), resolution.visible && viewerInvariant(resolution.ready, "visible resolution layer is not ready", context), resolution.retainedForSwap && (viewerInvariant(resolution.hasImage, "retained resolution layer has no image", context), viewerInvariant(!resolution.hasTarget, "retained resolution layer still owns a target", context), viewerInvariant(
    !resolution.ready && !resolution.visible && !resolution.commitPending && !resolution.loading,
    "retained resolution layer overlaps an active resolution request",
    context
  )), snapshot;
}
function clearViewerPendingViewportPosition() {
  viewerViewportState.singleImageFitOriginPending = !1, viewerViewportState.singleImagePendingRelativePosition = null, viewerViewportState.singleImagePendingPageTurnOrigin = null;
}
function resetViewerGestureCommand(options = {}) {
  options.clearPointers !== !1 && viewerGestureState.pointers.clear(), viewerGestureState.dragStartX = 0, viewerGestureState.dragStartY = 0, viewerGestureState.dragStartPanX = 0, viewerGestureState.dragStartPanY = 0, viewerGestureState.pinchStartDistance = 0, viewerGestureState.pinchStartZoom = AUTO_VIEWER_ZOOM, viewerGestureState.pinchLastMidX = 0, viewerGestureState.pinchLastMidY = 0, viewerGestureState.pointerGestureHadMultiplePointers = !1, viewerGestureState.pointerGestureConsumedPan = !1, options.clearTapHistory && (viewerGestureState.lastTapAt = 0, viewerGestureState.lastTapX = 0, viewerGestureState.lastTapY = 0, viewerGestureState.lastTapSurface = "", viewerGestureState.suppressNextDblClickUntil = 0);
}
function resetViewerNavigationGestureCommand() {
  viewerNavigationState.viewerPageWheelSettleTimer = 0, viewerNavigationState.viewerPageWheelAccumulator = 0, viewerNavigationState.viewerPageWheelBasePage = 0, viewerNavigationState.viewerPageWheelTargetPage = 0, viewerNavigationState.viewerPageWheelResetGestureActive = !1, viewerNavigationState.viewerPageWheelResetLastEventAt = 0, viewerNavigationState.viewerPageWheelResetLastDelta = 0, viewerNavigationState.viewerPageWheelResetDirection = 0;
}
function initializeViewerOpenStateCommand() {
  viewerViewportState.zoom = AUTO_VIEWER_ZOOM, viewerViewportState.panX = 0, viewerViewportState.panY = 0, clearViewerPendingViewportPosition(), viewerViewportState.singleImageFitOriginPending = !0, resetViewerGestureCommand({ clearTapHistory: !0 }), resetViewerNavigationGestureCommand(), assertViewerStateInvariants("initialize-viewer-open");
}
function finalizeViewerClosedStateCommand() {
  clearViewerPendingViewportPosition(), resetViewerGestureCommand({ clearTapHistory: !0 }), resetViewerNavigationGestureCommand(), assertViewerStateInvariants("finalize-viewer-closed");
}
function createViewerNavigationCommand(source, direction, options = {}) {
  if (!VIEWER_NAVIGATION_SOURCES.has(source))
    throw new TypeError(`Unknown Viewer navigation source: ${String(source)}`);
  if (!Number.isFinite(direction))
    throw new TypeError("Viewer navigation direction must be finite.");
  if (options.axis !== void 0 && options.axis !== "x" && options.axis !== "y")
    throw new TypeError(`Invalid Viewer navigation axis: ${String(options.axis)}`);
  if (options.manualZoom !== void 0 && typeof options.manualZoom != "boolean")
    throw new TypeError("Viewer navigation manualZoom must be boolean when provided.");
  if (options.preservePointerInteraction !== void 0 && typeof options.preservePointerInteraction != "boolean")
    throw new TypeError("Viewer navigation preservePointerInteraction must be boolean when provided.");
  let step = direction > 0 ? 1 : direction < 0 ? -1 : 0, axis = source === VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE ? "x" : options.axis || "y", preservePointerInteraction = options.preservePointerInteraction === !0, manualZoom = options.manualZoom ?? Math.abs(viewerViewportState.zoom - AUTO_VIEWER_ZOOM) > 1e-3;
  return source === VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE ? Object.freeze({ source, direction: step, axis, zoomMode: "preserve", positionMode: "page-turn", preservePointerInteraction }) : source === VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING ? Object.freeze({ source, direction: step, axis, zoomMode: "preserve", positionMode: "page-turn", preservePointerInteraction }) : RESETTABLE_READING_SOURCES.has(source) ? Object.freeze(manualZoom ? { source, direction: step, axis, zoomMode: "reset", positionMode: "fit-origin", preservePointerInteraction } : { source, direction: step, axis, zoomMode: "preserve", positionMode: "page-turn", preservePointerInteraction }) : Object.freeze(manualZoom ? { source, direction: step, axis, zoomMode: "preserve", positionMode: "relative", preservePointerInteraction } : { source, direction: step, axis, zoomMode: "preserve", positionMode: "fit-origin", preservePointerInteraction });
}
function assertViewerNavigationCommand(command) {
  if (viewerInvariant(!!(command && typeof command == "object"), "navigation command is missing", "navigation-command"), viewerInvariant(VIEWER_NAVIGATION_SOURCES.has(command.source), "navigation source is invalid", "navigation-command"), viewerInvariant(
    command.direction === -1 || command.direction === 0 || command.direction === 1,
    "navigation direction is not normalized",
    "navigation-command"
  ), viewerInvariant(command.axis === "x" || command.axis === "y", "navigation axis is invalid", "navigation-command"), viewerInvariant(VIEWER_NAVIGATION_ZOOM_MODES.has(command.zoomMode), "navigation zoom mode is invalid", "navigation-command"), viewerInvariant(VIEWER_NAVIGATION_POSITION_MODES.has(command.positionMode), "navigation position mode is invalid", "navigation-command"), viewerInvariant(typeof command.preservePointerInteraction == "boolean", "pointer preservation flag is invalid", "navigation-command"), command.positionMode === "page-turn" && viewerInvariant(command.direction === -1 || command.direction === 1, "page-turn direction must be non-zero", "navigation-command"), command.source === VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE)
    viewerInvariant(
      command.axis === "x" && command.zoomMode === "preserve" && command.positionMode === "page-turn",
      "horizontal swipe policy was overridden",
      "navigation-command"
    );
  else if (command.source === VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING)
    viewerInvariant(
      command.zoomMode === "preserve" && command.positionMode === "page-turn",
      "continuous-reading policy was overridden",
      "navigation-command"
    );
  else if (RESETTABLE_READING_SOURCES.has(command.source)) {
    let preservesAutomaticReading = command.zoomMode === "preserve" && command.positionMode === "page-turn", resetsManualReading = command.zoomMode === "reset" && command.positionMode === "fit-origin";
    viewerInvariant(
      preservesAutomaticReading || resetsManualReading,
      "scroll navigation policy was overridden",
      "navigation-command"
    );
  } else
    viewerInvariant(
      command.zoomMode === "preserve" && (command.positionMode === "relative" || command.positionMode === "fit-origin"),
      "direct navigation policy was overridden",
      "navigation-command"
    );
  return command;
}
function beginViewerPageTransitionCommand(targetPage, command, relativePosition = null) {
  if (!Number.isInteger(targetPage) || targetPage < 0)
    throw new TypeError("Viewer page transition requires a non-negative integer target.");
  let nextPage = targetPage;
  assertViewerNavigationCommand(command);
  let normalizedRelativePosition = null;
  if (command.positionMode === "relative") {
    if (!relativePosition || !Number.isFinite(relativePosition.xRatio) || !Number.isFinite(relativePosition.yRatio))
      throw new TypeError("Relative Viewer navigation requires finite position ratios.");
    normalizedRelativePosition = {
      page: nextPage,
      xRatio: Math.max(-1, Math.min(1, relativePosition.xRatio)),
      yRatio: Math.max(-1, Math.min(1, relativePosition.yRatio))
    };
  }
  clearViewerPendingViewportPosition(), command.zoomMode === "reset" && (viewerViewportState.zoom = AUTO_VIEWER_ZOOM), command.positionMode === "fit-origin" ? (viewerViewportState.panX = 0, viewerViewportState.panY = 0, viewerViewportState.singleImageFitOriginPending = !0) : command.positionMode === "page-turn" ? (viewerViewportState.panX = 0, viewerViewportState.panY = 0, viewerViewportState.singleImagePendingPageTurnOrigin = {
    page: nextPage,
    direction: command.direction > 0 ? 1 : -1,
    axis: command.axis
  }) : viewerViewportState.singleImagePendingRelativePosition = normalizedRelativePosition, command.preservePointerInteraction || resetViewerGestureCommand(), assertViewerStateInvariants(`begin-page-transition:${command.source}`);
}
function beginViewerImageSwapCommand() {
  return viewerImageState.singleImageLoadToken += 1, viewerImageState.singleImageLoadToken;
}
function invalidateViewerImageSwapCommand() {
  return viewerImageState.singleImageLoadToken += 1, viewerImageState.singleImageLoadToken;
}
function isViewerImageSwapCurrent(token) {
  return token === viewerImageState.singleImageLoadToken;
}
function cancelViewerResolutionCommand() {
  viewerImageState.singleImageResolutionLoadToken += 1, viewerImageState.singleImageResolutionStop?.(), viewerImageState.singleImageResolutionStop = null, viewerImageState.singleImageResolutionTargetSrc = "", viewerImageState.singleImageResolutionTargetTier = "", viewerImageState.singleImageResolutionReady = !1, viewerImageState.singleImageResolutionVisible = !1, viewerImageState.singleImageResolutionCommitPending = !1, viewerImageState.singleImageResolutionRetainedForSwap = !1, assertViewerStateInvariants("cancel-resolution");
}
function beginViewerResolutionCommand(targetSrc, targetTier, commitPending) {
  if (typeof targetSrc != "string" || typeof targetTier != "string" || typeof commitPending != "boolean")
    throw new TypeError("Viewer resolution transition requires string targets and a boolean commit policy.");
  let normalizedTargetSrc = targetSrc.trim(), normalizedTargetTier = targetTier.trim();
  if (!normalizedTargetSrc || !normalizedTargetTier)
    throw new TypeError("Viewer resolution transition requires a target source and tier.");
  cancelViewerResolutionCommand();
  let token = viewerImageState.singleImageResolutionLoadToken;
  return viewerImageState.singleImageResolutionTargetSrc = normalizedTargetSrc, viewerImageState.singleImageResolutionTargetTier = normalizedTargetTier, viewerImageState.singleImageResolutionCommitPending = !!commitPending, assertViewerStateInvariants("begin-resolution"), token;
}
function attachViewerResolutionStopCommand(token, stop) {
  if (stop !== null && typeof stop != "function")
    throw new TypeError("Viewer resolution stop handle must be a function or null.");
  return token !== viewerImageState.singleImageResolutionLoadToken ? (stop?.(), !1) : (viewerImageState.singleImageResolutionStop = stop, assertViewerStateInvariants("attach-resolution-stop"), !0);
}
function markViewerResolutionReadyCommand(token) {
  return token !== viewerImageState.singleImageResolutionLoadToken ? !1 : (viewerImageState.singleImageResolutionStop = null, viewerImageState.singleImageResolutionReady = !0, assertViewerStateInvariants("resolution-ready"), !0);
}
function commitViewerResolutionCommand(token) {
  return token !== viewerImageState.singleImageResolutionLoadToken || !viewerImageState.singleImageResolutionReady ? (token === viewerImageState.singleImageResolutionLoadToken && (viewerImageState.singleImageResolutionCommitPending = !0), !1) : (viewerImageState.singleImageResolutionCommitPending = !1, viewerImageState.singleImageResolutionVisible = !0, assertViewerStateInvariants("resolution-visible"), !0);
}
function retainViewerResolutionForSwapCommand() {
  viewerInvariant(
    viewerImageState.singleImageResolutionVisible && viewerImageState.singleImageResolutionReady && !!viewerImageState.singleImageResolutionImage,
    "resolution layer cannot be retained before it is visible and ready",
    "retain-resolution-for-swap"
  ), viewerImageState.singleImageResolutionLoadToken += 1, viewerImageState.singleImageResolutionStop?.(), viewerImageState.singleImageResolutionStop = null, viewerImageState.singleImageResolutionTargetSrc = "", viewerImageState.singleImageResolutionTargetTier = "", viewerImageState.singleImageResolutionReady = !1, viewerImageState.singleImageResolutionVisible = !1, viewerImageState.singleImageResolutionCommitPending = !1, viewerImageState.singleImageResolutionRetainedForSwap = !0, assertViewerStateInvariants("retain-resolution-for-swap");
}
function releaseViewerRetainedResolutionCommand() {
  return viewerImageState.singleImageResolutionRetainedForSwap ? (viewerImageState.singleImageResolutionRetainedForSwap = !1, assertViewerStateInvariants("release-retained-resolution"), !0) : !1;
}

// src/js/51-viewer-session-state.js
var VIEWER_PHASE_TRANSITIONS = Object.freeze({
  [VIEWER_PHASE_CLOSED]: /* @__PURE__ */ new Set([VIEWER_PHASE_CLOSED, VIEWER_PHASE_OPENING]),
  [VIEWER_PHASE_OPENING]: /* @__PURE__ */ new Set([VIEWER_PHASE_OPENING, VIEWER_PHASE_OPEN, VIEWER_PHASE_CLOSING, VIEWER_PHASE_CLOSED]),
  [VIEWER_PHASE_OPEN]: /* @__PURE__ */ new Set([VIEWER_PHASE_OPEN, VIEWER_PHASE_OPENING, VIEWER_PHASE_CLOSING]),
  [VIEWER_PHASE_CLOSING]: /* @__PURE__ */ new Set([VIEWER_PHASE_CLOSING, VIEWER_PHASE_CLOSED, VIEWER_PHASE_OPENING])
}), VIEWER_FULLSCREEN_TRANSITIONS = Object.freeze({
  [VIEWER_FULLSCREEN_INACTIVE]: /* @__PURE__ */ new Set([VIEWER_FULLSCREEN_INACTIVE, VIEWER_FULLSCREEN_ENTERING, VIEWER_FULLSCREEN_ACTIVE]),
  [VIEWER_FULLSCREEN_ENTERING]: /* @__PURE__ */ new Set([VIEWER_FULLSCREEN_ENTERING, VIEWER_FULLSCREEN_ACTIVE, VIEWER_FULLSCREEN_INACTIVE, VIEWER_FULLSCREEN_EXITING]),
  [VIEWER_FULLSCREEN_ACTIVE]: /* @__PURE__ */ new Set([VIEWER_FULLSCREEN_ACTIVE, VIEWER_FULLSCREEN_EXITING, VIEWER_FULLSCREEN_INACTIVE]),
  [VIEWER_FULLSCREEN_EXITING]: /* @__PURE__ */ new Set([VIEWER_FULLSCREEN_EXITING, VIEWER_FULLSCREEN_INACTIVE, VIEWER_FULLSCREEN_ACTIVE, VIEWER_FULLSCREEN_ENTERING])
});
function transitionStatePhase({ current, next, transitions, label, reason }) {
  return transitions[current]?.has(next) ? !0 : (console.warn(`Ignored invalid ${label} transition`, { current, next, reason }), !1);
}
function transitionViewerPhase(nextPhase, reason = "unspecified") {
  let currentPhase = viewerSessionState.viewerPhase || VIEWER_PHASE_CLOSED;
  return transitionStatePhase({
    current: currentPhase,
    next: nextPhase,
    transitions: VIEWER_PHASE_TRANSITIONS,
    label: "viewer phase",
    reason
  }) ? (viewerSessionState.viewerPhase = nextPhase, viewerSessionState.viewerPhaseReason = String(reason || "unspecified"), document.body && (document.body.dataset.viewerPhase = nextPhase), !0) : !1;
}
function isViewerSessionOpen() {
  return viewerSessionState.viewerPhase === VIEWER_PHASE_OPENING || viewerSessionState.viewerPhase === VIEWER_PHASE_OPEN;
}
function transitionViewerFullscreenPhase(nextPhase, reason = "unspecified") {
  let currentPhase = viewerSessionState.viewerFullscreenPhase || VIEWER_FULLSCREEN_INACTIVE;
  return transitionStatePhase({
    current: currentPhase,
    next: nextPhase,
    transitions: VIEWER_FULLSCREEN_TRANSITIONS,
    label: "viewer fullscreen phase",
    reason
  }) ? (viewerSessionState.viewerFullscreenPhase = nextPhase, viewerSessionState.viewerFullscreenReason = String(reason || "unspecified"), document.documentElement && (document.documentElement.dataset.viewerFullscreenPhase = nextPhase), !0) : !1;
}
function isViewerFullscreenPending() {
  return viewerSessionState.viewerFullscreenPhase === VIEWER_FULLSCREEN_ENTERING || viewerSessionState.viewerFullscreenPhase === VIEWER_FULLSCREEN_EXITING;
}

// src/js/54-viewer-geometry.js
function updateHash() {
  let catalog = activeCatalog();
  isAppPage("catalog") && catalog ? history.replaceState(history.state, "", catalogDocumentUrl(catalog.id)) : isAppPage("viewer") && catalog && history.replaceState(history.state, "", viewerDocumentUrl(catalog.id, activePage(), {
    source: isFavoritesLightboxMode() ? LIGHTBOX_SOURCE_FAVORITES : LIGHTBOX_SOURCE_CATALOG
  })), updateDocumentMetadata(catalog);
}
function getPointerList() {
  return Array.from(viewerGestureState.pointers.values());
}
function pointerDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}
function pointerMidpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}
function getMinimumViewerZoom() {
  return MIN_VIEWER_ZOOM;
}
function isAutoViewerZoom(value = viewerViewportState.zoom) {
  let numeric = Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric - AUTO_VIEWER_ZOOM) <= 1e-3;
}
function getSafeViewerZoom(value = viewerViewportState.zoom) {
  let numeric = Number(value);
  return Number.isFinite(numeric) ? clampValue(numeric, getMinimumViewerZoom(), MAX_VIEWER_ZOOM) : AUTO_VIEWER_ZOOM;
}
function normalizeViewerFitMode(fitMode) {
  return fitMode === VIEWER_FIT_WIDTH ? VIEWER_FIT_WIDTH : VIEWER_FIT_HEIGHT;
}
function normalizeViewerFitModeSource(source) {
  return source === VIEWER_FIT_SOURCE_AUTO ? VIEWER_FIT_SOURCE_AUTO : VIEWER_FIT_SOURCE_MANUAL;
}
function viewerUsesAutomaticFitMode() {
  return normalizeViewerFitModeSource(viewerViewportState.imageFitModeSource) === VIEWER_FIT_SOURCE_AUTO;
}
function getViewerFitViewportSize() {
  let stageWidth = Number(viewerElements.stageCanvas?.clientWidth) || 0, stageHeight = Number(viewerElements.stageCanvas?.clientHeight) || 0;
  if (stageWidth > 0 && stageHeight > 0)
    return { width: stageWidth, height: stageHeight };
  let visualWidth = Number(window.visualViewport?.width) || 0, visualHeight = Number(window.visualViewport?.height) || 0;
  return visualWidth > 0 && visualHeight > 0 ? { width: visualWidth, height: visualHeight } : {
    width: Number(window.innerWidth) || Number(document.documentElement?.clientWidth) || 0,
    height: Number(window.innerHeight) || Number(document.documentElement?.clientHeight) || 0
  };
}
function getAutomaticViewerFitMode() {
  let viewport = getViewerFitViewportSize(), naturalSize = getActiveSingleImageNaturalSize();
  if (naturalSize && viewport.width > 0 && viewport.height > 0 && naturalSize.width > 0 && naturalSize.height > 0) {
    let availableWidth = Math.max(1, viewport.width - 18), availableHeight = Math.max(1, viewport.height - 18);
    return naturalSize.width * (availableHeight / naturalSize.height) <= availableWidth + 0.5 ? VIEWER_FIT_HEIGHT : VIEWER_FIT_WIDTH;
  }
  return viewport.height > viewport.width ? VIEWER_FIT_WIDTH : VIEWER_FIT_HEIGHT;
}
function getActiveSingleImageNaturalSize() {
  let configuredSize = activeCatalog() ? pageSize(activeCatalog(), activePage()) : null;
  if (configuredSize) return configuredSize;
  let image = viewerElements.lightboxImage;
  return image?.naturalWidth && image?.naturalHeight ? { width: image.naturalWidth, height: image.naturalHeight } : null;
}
function getSingleImageDisplayMetrics() {
  let naturalSize = getActiveSingleImageNaturalSize(), stage = viewerElements.stageCanvas;
  if (!naturalSize || !stage) return null;
  let safeZoom = getSafeViewerZoom(), width = naturalSize.width * viewerViewportState.fitScale * safeZoom, height = naturalSize.height * viewerViewportState.fitScale * safeZoom;
  return {
    width,
    height,
    overflowX: Math.max(0, (width - stage.clientWidth) / 2),
    overflowY: Math.max(0, (height - stage.clientHeight) / 2)
  };
}
function singleImageCanPan() {
  let metrics = getSingleImageDisplayMetrics();
  return !!(metrics && (metrics.overflowX > 1 || metrics.overflowY > 1));
}
function viewerCanPan() {
  return singleImageCanPan();
}
function singleViewerUsesBoundaryPan() {
  return getSafeViewerZoom() > AUTO_VIEWER_ZOOM + 1e-3 || singleImageCanPan();
}
function getViewerPageTurnBuffer(axis = "y") {
  let stage = viewerElements.stageCanvas, viewportSize = axis === "x" ? stage?.clientWidth || window.innerWidth || 0 : stage?.clientHeight || window.innerHeight || 0;
  return !Number.isFinite(viewportSize) || viewportSize <= 0 ? VIEWER_PAGE_TURN_BUFFER_MIN_PX : clampValue(
    viewportSize * VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO,
    VIEWER_PAGE_TURN_BUFFER_MIN_PX,
    VIEWER_PAGE_TURN_BUFFER_MAX_PX
  );
}
function getSinglePanBounds(options = {}) {
  let metrics = getSingleImageDisplayMetrics();
  if (!metrics) return null;
  let allowPageTurnBuffer = options.allowPageTurnBuffer !== !1 && singleViewerUsesBoundaryPan(), bufferX = allowPageTurnBuffer ? getViewerPageTurnBuffer("x") : 0, bufferY = allowPageTurnBuffer ? getViewerPageTurnBuffer("y") : 0;
  return {
    metrics,
    realLimitX: metrics.overflowX,
    realLimitY: metrics.overflowY,
    limitX: metrics.overflowX + bufferX,
    limitY: metrics.overflowY + bufferY,
    bufferX,
    bufferY
  };
}
function clampSinglePan(options = {}) {
  let bounds = getSinglePanBounds(options);
  return bounds ? (viewerViewportState.panX = bounds.limitX <= 1 ? 0 : clampValue(viewerViewportState.panX, -bounds.limitX, bounds.limitX), viewerViewportState.panY = bounds.limitY <= 1 ? 0 : clampValue(viewerViewportState.panY, -bounds.limitY, bounds.limitY), bounds) : null;
}
function clearSingleImagePendingPosition() {
  viewerViewportState.singleImageFitOriginPending = !1, viewerViewportState.singleImagePendingRelativePosition = null, viewerViewportState.singleImagePendingPageTurnOrigin = null;
}
function captureSingleImageRelativePosition() {
  let metrics = getSingleImageDisplayMetrics();
  return metrics ? {
    xRatio: metrics.overflowX > 1 ? clampValue(viewerViewportState.panX / metrics.overflowX, -1, 1) : 0,
    yRatio: metrics.overflowY > 1 ? clampValue(viewerViewportState.panY / metrics.overflowY, -1, 1) : 0
  } : { xRatio: 0, yRatio: 0 };
}
function resetImagePosition(options = {}) {
  viewerViewportState.panX = 0, viewerViewportState.panY = 0, clearSingleImagePendingPosition(), options.queueSingleFitOrigin && (viewerViewportState.singleImageFitOriginPending = !0);
}
function applyPendingSingleImagePosition() {
  let metrics = getSingleImageDisplayMetrics();
  if (!metrics) return !1;
  let pageTurnOrigin = viewerViewportState.singleImagePendingPageTurnOrigin;
  if (pageTurnOrigin?.page === activePage())
    return viewerViewportState.panX = 0, viewerViewportState.panY = pageTurnOrigin.direction > 0 ? metrics.overflowY : -metrics.overflowY, viewerViewportState.singleImagePendingPageTurnOrigin = null, viewerViewportState.singleImagePendingRelativePosition = null, viewerViewportState.singleImageFitOriginPending = !1, !0;
  let relativePosition = viewerViewportState.singleImagePendingRelativePosition;
  return relativePosition?.page === activePage() ? (viewerViewportState.panX = metrics.overflowX * relativePosition.xRatio, viewerViewportState.panY = metrics.overflowY * relativePosition.yRatio, viewerViewportState.singleImagePendingRelativePosition = null, viewerViewportState.singleImagePendingPageTurnOrigin = null, viewerViewportState.singleImageFitOriginPending = !1, !0) : viewerViewportState.singleImageFitOriginPending ? (viewerViewportState.panX = 0, viewerViewportState.panY = 0, viewerViewportState.imageFitMode === VIEWER_FIT_WIDTH && metrics.overflowY > 1 && (viewerViewportState.panY = metrics.overflowY), viewerViewportState.singleImageFitOriginPending = !1, viewerViewportState.singleImagePendingRelativePosition = null, viewerViewportState.singleImagePendingPageTurnOrigin = null, !0) : !1;
}
function singleImageFitLayout(naturalWidth, naturalHeight) {
  let stage = viewerElements.stageCanvas, width = Number(naturalWidth), height = Number(naturalHeight);
  if (!stage || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  let viewportWidth = Math.max(0, Number(window.visualViewport?.width) || Number(window.innerWidth) || 0), viewportHeight = Math.max(0, Number(window.visualViewport?.height) || Number(window.innerHeight) || 0), stageWidth = Math.max(0, Number(stage.clientWidth) || viewportWidth), stageHeight = Math.max(0, Number(stage.clientHeight) || viewportHeight), availableWidth = Math.max(260, stageWidth - 18), availableHeight = Math.max(260, stageHeight - 18), widthScale = availableWidth / width, heightScale = availableHeight / height, fitScale = viewerViewportState.imageFitMode === VIEWER_FIT_WIDTH ? widthScale : heightScale;
  return {
    fitScale,
    width: Math.max(220, Math.round(width * fitScale)),
    height: Math.max(160, Math.round(height * fitScale))
  };
}
function applyLightboxFrameGeometry(naturalWidth, naturalHeight, options = {}) {
  let frame = viewerElements.lightboxImageFrame, image = viewerElements.lightboxImage, layout = singleImageFitLayout(naturalWidth, naturalHeight);
  if (!frame || !image || !layout) return null;
  options.updateFitScale !== !1 && (viewerViewportState.fitScale = layout.fitScale);
  let nextWidth = `${layout.width}px`, nextHeight = `${layout.height}px`, nextAspectRatio = `${naturalWidth} / ${naturalHeight}`;
  return frame.style.width !== nextWidth && (frame.style.width = nextWidth), frame.style.height !== nextHeight && (frame.style.height = nextHeight), frame.style.aspectRatio !== nextAspectRatio && (frame.style.aspectRatio = nextAspectRatio), image.style.width !== "100%" && (image.style.width = "100%"), image.style.height !== "100%" && (image.style.height = "100%"), layout;
}
function primeLightboxFrameForCatalogPage(catalog, page) {
  let size = pageSize(catalog, page);
  return size ? !!applyLightboxFrameGeometry(size.width, size.height, { updateFitScale: !0 }) : !1;
}
function applySingleZoom() {
  let frame = viewerElements.lightboxImageFrame, naturalSize = getActiveSingleImageNaturalSize();
  !naturalSize || !frame || (applyLightboxFrameGeometry(naturalSize.width, naturalSize.height), !applyPendingSingleImagePosition() && isAutoViewerZoom() && !singleImageCanPan() && (viewerViewportState.panX = 0, viewerViewportState.panY = 0), clampSinglePan(), frame.style.setProperty("--single-pan-x", `${viewerViewportState.panX}px`), frame.style.setProperty("--single-pan-y", `${viewerViewportState.panY}px`), frame.style.setProperty("--single-zoom", String(viewerViewportState.zoom)), frame.style.transform = `translate(-50%, -50%) translate(${viewerViewportState.panX}px, ${viewerViewportState.panY}px) scale(${viewerViewportState.zoom})`);
}
function applyZoom() {
  applySingleZoom();
  let isManualZoom = !isAutoViewerZoom();
  viewerElements.lightbox?.classList.toggle("is-zoomed", isManualZoom || viewerCanPan());
}
function consumeSingleViewerPanInput(deltaX = 0, deltaY = 0) {
  if (!singleViewerUsesBoundaryPan()) return null;
  let safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0, safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0, previousPanX = viewerViewportState.panX, previousPanY = viewerViewportState.panY;
  viewerViewportState.panX = previousPanX - safeDeltaX, viewerViewportState.panY = previousPanY - safeDeltaY;
  let bounds = clampSinglePan({ allowPageTurnBuffer: !0 });
  if (!bounds) return null;
  let moved = Math.abs(viewerViewportState.panX - previousPanX) > 0.01 || Math.abs(viewerViewportState.panY - previousPanY) > 0.01;
  moved && (clearSingleImagePendingPosition(), applySingleZoom());
  let consumedDeltaX = previousPanX - viewerViewportState.panX, consumedDeltaY = previousPanY - viewerViewportState.panY;
  return {
    moved,
    bounds,
    remainingDeltaX: safeDeltaX - consumedDeltaX,
    remainingDeltaY: safeDeltaY - consumedDeltaY
  };
}
function normalizeWheelDeltaToPixels(delta, deltaMode, pageSize2 = 0) {
  let lineMode = typeof WheelEvent < "u" ? WheelEvent.DOM_DELTA_LINE : 1, pageMode = typeof WheelEvent < "u" ? WheelEvent.DOM_DELTA_PAGE : 2;
  return deltaMode === lineMode ? delta * 36 : deltaMode === pageMode ? delta * Math.max(1, pageSize2) : delta;
}

// src/js/56-viewer-shell.js
function showTopUiTemporarily(delay = 2200) {
  viewerElements.lightbox && (window.clearTimeout(viewerChromeState.uiHideTimer), viewerElements.lightbox.classList.add("show-ui"), !(viewerChromeState.topUiPinned || viewerChromeState.viewerMobileMoreOpen) && delay > 0 && (viewerChromeState.uiHideTimer = window.setTimeout(() => {
    !viewerChromeState.topUiPinned && !viewerChromeState.viewerMobileMoreOpen && viewerElements.lightbox.classList.remove("show-ui");
  }, delay)));
}
function getLightboxPinnedTopOffset() {
  if (!viewerChromeState.topUiPinned || !viewerElements.lightboxBar) return 0;
  let rect = viewerElements.lightboxBar.getBoundingClientRect?.(), measuredHeight = rect ? Math.max(rect.height || 0, rect.bottom > 0 ? rect.bottom : 0) : 0, viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0, maxReasonableOffset = Math.max(0, viewportHeight * 0.42);
  return Math.round(clampValue(measuredHeight, 0, maxReasonableOffset));
}
function syncLightboxTopSafeArea() {
  if (!viewerElements.lightbox) return 0;
  let offset = getLightboxPinnedTopOffset();
  return viewerElements.lightbox.style.setProperty("--lightbox-top-safe-offset", `${offset}px`), offset;
}
function syncTopUiPinnedUi() {
  let pinned = !!viewerChromeState.topUiPinned, label = pinned ? "ביטול נעיצת הסרגל העליון" : "נעיצת הסרגל העליון";
  window.clearTimeout(viewerChromeState.uiHideTimer), viewerElements.lightbox?.classList.toggle("top-ui-pinned", pinned), pinned && viewerElements.lightbox?.classList.add("show-ui"), syncLightboxTopSafeArea(), viewerElements.lightboxPinTopBar && (viewerElements.lightboxPinTopBar.dataset.pinned = pinned ? "true" : "false", viewerElements.lightboxPinTopBar.setAttribute("aria-pressed", pinned ? "true" : "false"), viewerElements.lightboxPinTopBar.setAttribute("aria-label", label), setTooltipText(viewerElements.lightboxPinTopBar, label, { updateDefault: !0 }));
}
function getViewportPointer(event) {
  if (!(event instanceof MouseEvent)) return null;
  let x = Number(event.clientX), y = Number(event.clientY);
  return !Number.isFinite(x) || !Number.isFinite(y) ? null : { x, y };
}
function pointInRect(point, rect, padding = 0) {
  return !point || !rect ? !1 : point.x >= rect.left - padding && point.x <= rect.right + padding && point.y >= rect.top - padding && point.y <= rect.bottom + padding;
}
function shouldKeepTopUiOpenForPointer(event = null) {
  if (viewerChromeState.topUiPinned || viewerChromeState.viewerMobileMoreOpen) return !0;
  let point = getViewportPointer(event);
  if (!point || !viewerElements.lightboxBar) return !1;
  let barRect = viewerElements.lightboxBar.getBoundingClientRect(), hotspotRect = viewerElements.topHotspot?.getBoundingClientRect?.();
  if (pointInRect(point, barRect, 1) || pointInRect(point, hotspotRect, 1)) return !0;
  let topHoldBottom = Math.max(2, hotspotRect?.bottom || 0, barRect.top + 2);
  return point.y <= topHoldBottom;
}
function scheduleTopUiClose(event = null) {
  !viewerElements.lightbox || !isViewerSessionOpen() || viewerChromeState.topUiPinned || viewerChromeState.viewerMobileMoreOpen || shouldKeepTopUiOpenForPointer(event) || (window.clearTimeout(viewerChromeState.uiHideTimer), viewerChromeState.uiHideTimer = window.setTimeout(() => {
    !viewerChromeState.topUiPinned && !viewerChromeState.viewerMobileMoreOpen && viewerElements.lightbox?.classList.remove("show-ui");
  }, 420));
}
function shouldKeepPageRailOpenForPointer(event = null) {
  let point = getViewportPointer(event);
  if (!point || !viewerElements.lightboxPageRail) return !1;
  let railRect = viewerElements.lightboxPageRail.getBoundingClientRect(), hotspotRect = viewerElements.lightboxSideHotspot?.getBoundingClientRect?.();
  if (pointInRect(point, railRect, 1) || pointInRect(point, hotspotRect, 1)) return !0;
  let viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0, viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0, hotspotWidth = Math.max(2, Math.round(hotspotRect?.width || 40)), rightHoldLeft = Math.max(0, Math.min(hotspotRect?.left ?? viewportWidth, viewportWidth - hotspotWidth)), rightHoldRight = viewportWidth + 1;
  return point.x >= rightHoldLeft - 1 && point.x <= rightHoldRight + 1 && point.y >= 0 && point.y <= viewportHeight || point.x >= railRect.right - 1 && point.x <= viewportWidth + 1 && point.y >= 0 && point.y <= viewportHeight;
}
function handleLightboxHoverHoldPointerMove(event) {
  shouldUseLightboxHoverPointer(event) && (viewerElements.lightbox?.classList.contains("show-ui") && !shouldKeepTopUiOpenForPointer(event) && scheduleTopUiClose(event), viewerElements.lightbox?.classList.contains("show-page-rail") && !shouldKeepPageRailOpenForPointer(event) && schedulePageRailClose(event));
}
function getViewportSize() {
  return {
    width: window.innerWidth || document.documentElement.clientWidth || 0,
    height: window.innerHeight || document.documentElement.clientHeight || 0
  };
}
function isPointInTopEdgeActivationZone(point) {
  if (!point || viewerChromeState.topUiPinned) return !1;
  let { width } = getViewportSize(), hotspotRect = viewerElements.topHotspot?.getBoundingClientRect?.(), hotspotHeight = Math.max(2, Math.round(hotspotRect?.height || 34)), activationBottom = Math.max(hotspotRect?.bottom || 0, hotspotHeight);
  return point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= activationBottom;
}
function getRightEdgeViewerNavigationRect() {
  let candidates = [viewerElements.prevPageBtn, viewerElements.nextPageBtn].map((button) => button?.getBoundingClientRect?.()).filter((rect) => rect && rect.width > 0 && rect.height > 0);
  return candidates.length ? candidates.reduce((rightmost, rect) => rect.right > rightmost.right ? rect : rightmost) : null;
}
function isPointInPageRailNavigationConflictZone(point) {
  let navigationRect = getRightEdgeViewerNavigationRect();
  return pointInRect(point, navigationRect, 4);
}
function isPointInPageRailEdgeActivationZone(point) {
  if (!point || !viewerElements.lightboxSideHotspot || !viewerElements.lightboxPageRail) return !1;
  let { width, height } = getViewportSize(), hotspotRect = viewerElements.lightboxSideHotspot.getBoundingClientRect(), hotspotWidth = Math.max(2, Math.round(hotspotRect?.width || 40)), activationLeft = Math.max(0, Math.min(hotspotRect?.left ?? width, width - hotspotWidth)), activationRight = width + 1;
  return !(!(point.x >= activationLeft && point.x <= activationRight && point.y >= 0 && point.y <= height) || isPointInPageRailNavigationConflictZone(point) && point.x <= hotspotRect.right);
}
function openLightboxEdgeUiForPointer(point) {
  isPointInTopEdgeActivationZone(point) && showTopUiTemporarily(0), isPointInPageRailEdgeActivationZone(point) && showPageRailTemporarily(0);
}
function handleLightboxEdgeHoverMove(event) {
  if (!shouldUseLightboxHoverPointer(event)) return;
  let point = getViewportPointer(event);
  openLightboxEdgeUiForPointer(point), handleLightboxHoverHoldPointerMove(event);
}
function handleLightboxEdgeHoverViewportExit(event) {
  if (!shouldUseLightboxHoverPointer(event) || event.relatedTarget || event.toElement) return;
  let point = getViewportPointer(event);
  if (!point) return;
  let { width, height } = getViewportSize();
  point.y <= 0 && point.x >= 0 && point.x <= width && showTopUiTemporarily(0), point.x >= width - 1 && point.y >= 0 && point.y <= height && showPageRailTemporarily(0);
}
function hideLightboxFloatingPreview() {
  viewerElements.lightboxFloatingPreview?.classList.remove("visible");
}
function isLightboxPageRailTrigger(button) {
  return !!button?.closest?.(".lightbox-page-rail");
}
function positionLightboxFloatingPreview(button) {
  let preview = viewerElements.lightboxFloatingPreview;
  if (!preview || !button) return;
  let buttonRect = button.getBoundingClientRect(), previewRect = preview.getBoundingClientRect();
  if (isLightboxPageRailTrigger(button)) {
    let previewHeight = previewRect.height || Math.min(620, window.innerHeight * 0.74), railRect = button.closest?.(".lightbox-page-rail")?.getBoundingClientRect?.(), centerY = Math.min(
      window.innerHeight - previewHeight / 2 - 14,
      Math.max(previewHeight / 2 + 14, buttonRect.top + buttonRect.height / 2)
    ), right = Math.max(12, window.innerWidth - (railRect?.left ?? buttonRect.left) + 12);
    preview.style.left = "auto", preview.style.bottom = "auto", preview.style.right = `${right}px`, preview.style.top = `${centerY}px`;
    return;
  }
  let previewWidth = previewRect.width || Math.min(420, window.innerWidth * 0.34), centerX = Math.min(
    window.innerWidth - previewWidth / 2 - 14,
    Math.max(previewWidth / 2 + 14, buttonRect.left + buttonRect.width / 2)
  ), bottom = Math.max(122, window.innerHeight - buttonRect.top + 12);
  preview.style.right = "auto", preview.style.top = "auto", preview.style.left = `${centerX}px`, preview.style.bottom = `${bottom}px`;
}
function showLightboxFloatingPreview(button) {
  if (!button || !viewerElements.lightboxFloatingPreview || !viewerElements.lightboxFloatingPreviewImage) return;
  let previewCatalog = findCatalogById(button.dataset.previewCatalog) || activeCatalog();
  if (!previewCatalog) return;
  let page = clampPage(button.dataset.previewPage || button.dataset.page, previewCatalog), src = button.dataset.previewSrc || pageSrc(previewCatalog, page), previewImage = viewerElements.lightboxFloatingPreviewImage;
  previewImage.removeAttribute("width"), previewImage.removeAttribute("height"), previewImage.onload = () => positionLightboxFloatingPreview(button), setCatalogImageSource(previewImage, src), previewImage.alt = `${previewCatalog.title} - עמוד ${page}`, viewerElements.lightboxFloatingPreviewPage && (viewerElements.lightboxFloatingPreviewPage.textContent = isFavoritesLightboxMode() ? `${previewCatalog.title} · עמוד ${page}` : `עמוד ${page}`), viewerElements.lightboxFloatingPreview.classList.toggle("from-page-rail", isLightboxPageRailTrigger(button)), viewerElements.lightboxFloatingPreview.classList.add("visible"), positionLightboxFloatingPreview(button);
}
function updateLightboxThumbs(options = {}) {
  let { scrollIntoView = !0 } = options, rail = viewerElements.lightboxPageThumbs;
  if (!rail) return;
  let previous = rail.querySelector('.lightbox-page-thumb[aria-current="page"]'), favoriteViewerIndex = getFeatureInterface("favorites")?.viewerIndex() ?? 0, selector = isFavoritesLightboxMode() ? `.lightbox-page-thumb[data-favorite-index="${favoriteViewerIndex}"]` : `.lightbox-page-thumb[data-page="${activePage()}"]`, active = rail.querySelector(selector);
  previous && previous !== active && (previous.classList.remove("active"), previous.removeAttribute("aria-current")), active && (active.classList.add("active"), active.setAttribute("aria-current", "page"), scrollIntoView && viewerElements.lightbox?.classList.contains("show-page-rail") && active.scrollIntoView({ block: "nearest", inline: "nearest" }));
}
function renderLightboxPageRail() {
  let activeCatalogRecord = activeCatalog();
  if (!activeCatalogRecord || !viewerElements.lightboxPageThumbs) return;
  let thumbs = [];
  if (isFavoritesLightboxMode()) {
    let favorites = getFeatureInterface("favorites"), entries = favorites?.entries() || [], favoriteViewerIndex = favorites?.viewerIndex() ?? 0;
    viewerElements.lightboxPageRailTitle && (viewerElements.lightboxPageRailTitle.textContent = "מועדפים"), viewerElements.lightboxPageRail?.setAttribute("aria-label", "מעבר מהיר בין המועדפים"), entries.forEach(({ catalog, page }, index) => {
      let thumb = escapeHtml(thumbSrc(catalog, page)), title = escapeHtml(catalog.title || "קטלוג"), active = index === favoriteViewerIndex;
      thumbs.push(`
        <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${active ? " active" : ""}" type="button" data-favorite-index="${index}" data-preview-catalog="${escapeHtml(catalog.id)}" data-preview-page="${page}" data-preview-src="${thumb}" aria-label="מעבר למועדף ${index + 1}: ${title}, עמוד ${page}"${active ? ' aria-current="page"' : ""}>
          <span class="lightbox-page-thumb-image-wrap">
            <img src="${thumb}" alt=""${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "viewer-thumbnail-rail")}${catalogImageCrossOriginAttribute(thumb)} />
          </span>
          <span class="lightbox-page-thumb-number">${index + 1}</span>
        </button>
      `);
    });
  } else {
    let catalog = activeCatalogRecord;
    viewerElements.lightboxPageRailTitle && (viewerElements.lightboxPageRailTitle.textContent = "עמודים"), viewerElements.lightboxPageRail?.setAttribute("aria-label", "מעבר מהיר בין עמודי הקטלוג");
    for (let page of catalogPageNumbers(catalog)) {
      let thumb = escapeHtml(thumbSrc(catalog, page));
      thumbs.push(`
        <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${page === activePage() ? " active" : ""}" type="button" data-page="${page}" data-preview-catalog="${escapeHtml(catalog.id)}" data-preview-page="${page}" data-preview-src="${thumb}" aria-label="מעבר לעמוד ${page}"${page === activePage() ? ' aria-current="page"' : ""}>
          <span class="lightbox-page-thumb-image-wrap">
            <img src="${thumb}" alt=""${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "viewer-thumbnail-rail")}${catalogImageCrossOriginAttribute(thumb)} />
          </span>
          <span class="lightbox-page-thumb-number">${page}</span>
        </button>
      `);
    }
  }
  viewerElements.lightboxPageThumbs.innerHTML = thumbs.join(""), viewerElements.lightboxPageThumbs.querySelectorAll(".lightbox-page-thumb").forEach((button) => {
    button.addEventListener("pointerenter", () => showLightboxFloatingPreview(button)), button.addEventListener("pointerleave", hideLightboxFloatingPreview), button.addEventListener("focus", () => showLightboxFloatingPreview(button)), button.addEventListener("blur", hideLightboxFloatingPreview);
  });
}
function syncViewerMobileMoreMenuState() {
  let menu = viewerElements.viewerMobileMoreMenu;
  if (!menu) return;
  let fitMode = normalizeViewerFitMode(viewerViewportState.imageFitMode), automatic = viewerUsesAutomaticFitMode(), pinItem = menu.querySelector('[data-viewer-mobile-action="pin"]'), autoItem = menu.querySelector('[data-viewer-mobile-action="fit-auto"]'), heightItem = menu.querySelector('[data-viewer-mobile-action="fit-height"]'), widthItem = menu.querySelector('[data-viewer-mobile-action="fit-width"]'), pinLabel = menu.querySelector("[data-viewer-mobile-pin-label]");
  pinItem?.setAttribute("aria-checked", viewerChromeState.topUiPinned ? "true" : "false"), pinItem?.classList.toggle("active", viewerChromeState.topUiPinned), pinLabel && (pinLabel.textContent = viewerChromeState.topUiPinned ? "ביטול נעיצת הסרגל" : "נעיצת הסרגל"), autoItem?.setAttribute("aria-checked", automatic ? "true" : "false"), autoItem?.classList.toggle("active", automatic), heightItem?.setAttribute("aria-checked", !automatic && fitMode === VIEWER_FIT_HEIGHT ? "true" : "false"), heightItem?.classList.toggle("active", !automatic && fitMode === VIEWER_FIT_HEIGHT), widthItem?.setAttribute("aria-checked", !automatic && fitMode === VIEWER_FIT_WIDTH ? "true" : "false"), widthItem?.classList.toggle("active", !automatic && fitMode === VIEWER_FIT_WIDTH);
}
function syncViewerFitModeUi() {
  let fitMode = normalizeViewerFitMode(viewerViewportState.imageFitMode), automatic = viewerUsesAutomaticFitMode();
  if (viewerViewportState.imageFitMode = fitMode, viewerElements.lightbox?.classList.toggle("fit-height", fitMode === VIEWER_FIT_HEIGHT), viewerElements.lightbox?.classList.toggle("fit-width", fitMode === VIEWER_FIT_WIDTH), viewerElements.fitAutoBtn && (viewerElements.fitAutoBtn.setAttribute("aria-pressed", automatic ? "true" : "false"), viewerElements.fitAutoBtn.setAttribute("aria-label", "התאמת תצוגה אוטומטי"), setTooltipText(viewerElements.fitAutoBtn, "התאמת תצוגה אוטומטי", { updateDefault: !0 })), viewerElements.fitHeightBtn) {
    let isActive = !automatic && fitMode === VIEWER_FIT_HEIGHT;
    viewerElements.fitHeightBtn.setAttribute("aria-pressed", isActive ? "true" : "false"), viewerElements.fitHeightBtn.setAttribute("aria-label", "התאמת התמונה לגובה"), setTooltipText(viewerElements.fitHeightBtn, "התאמה לגובה", { updateDefault: !0 });
  }
  if (viewerElements.fitWidthBtn) {
    let isActive = !automatic && fitMode === VIEWER_FIT_WIDTH;
    viewerElements.fitWidthBtn.setAttribute("aria-pressed", isActive ? "true" : "false"), viewerElements.fitWidthBtn.setAttribute("aria-label", "התאמת התמונה לרוחב"), setTooltipText(viewerElements.fitWidthBtn, "התאמה לרוחב", { updateDefault: !0 });
  }
  syncViewerAutoZoomButtonUi(), syncViewerMobileMoreMenuState();
}
function syncViewerAutoZoomButtonUi() {
  if (!viewerElements.viewerAutoZoomBtn) return;
  let showButton = !!(isViewerSessionOpen() && !isAutoViewerZoom());
  viewerElements.viewerAutoZoomBtn.classList.toggle("hidden", !showButton), viewerElements.viewerAutoZoomBtn.setAttribute("aria-hidden", showButton ? "false" : "true"), viewerElements.viewerAutoZoomBtn.setAttribute("tabindex", showButton ? "0" : "-1"), viewerElements.viewerAutoZoomBtn.setAttribute("aria-label", "חזרה לזום אוטומטי"), setTooltipText(viewerElements.viewerAutoZoomBtn, "חזרה לזום אוטומטי", { updateDefault: !0 });
}
function formatViewerZoomPercent(value = viewerViewportState.zoom) {
  return `${Math.round(getSafeViewerZoom(value) * 100)}%`;
}
function hideViewerZoomIndicator() {
  window.clearTimeout(viewerChromeState.zoomIndicatorHideTimer), viewerChromeState.zoomIndicatorHideTimer = 0, viewerElements.viewerZoomIndicator?.classList.remove("visible");
}
function showViewerZoomIndicator(value = viewerViewportState.zoom) {
  let indicator = viewerElements.viewerZoomIndicator;
  !indicator || !isViewerSessionOpen() || (indicator.textContent = formatViewerZoomPercent(value), indicator.classList.add("visible"), window.clearTimeout(viewerChromeState.zoomIndicatorHideTimer), viewerChromeState.zoomIndicatorHideTimer = window.setTimeout(() => {
    indicator.classList.remove("visible"), viewerChromeState.zoomIndicatorHideTimer = 0;
  }, VIEWER_ZOOM_INDICATOR_HIDE_MS));
}
function syncLightboxModeUi() {
  let favoritesMode = isFavoritesLightboxMode();
  viewerElements.lightbox?.classList.add("catalog-entry-mode"), viewerElements.lightbox?.classList.toggle("favorites-viewer-mode", favoritesMode), getFeatureInterface("favorites")?.syncViewerMode(favoritesMode), viewerElements.prevPageBtn?.setAttribute("aria-label", favoritesMode ? "המועדף הקודם" : "העמוד הקודם"), viewerElements.nextPageBtn?.setAttribute("aria-label", favoritesMode ? "המועדף הבא" : "העמוד הבא"), syncViewerLayoutModeUi(), syncViewerFitModeUi(), viewerElements.lightboxModeLabel && (viewerElements.lightboxModeLabel.textContent = favoritesMode ? "תצוגת מועדפים" : "כניסה לקטלוג");
}
function isObservedMouseHoverEvent(event = null) {
  return event && "pointerType" in event && event.pointerType === "mouse" ? !0 : String(event?.type || "").startsWith("mouse");
}
function markTouchLikeViewportInput(event) {
  (isTouchLikePointer(event) || event?.type === "touchstart") && (viewerChromeState.lastTouchLikeViewportInputAt = Date.now());
}
function hasRecentTouchLikeViewportInput(timeout = 900) {
  return Date.now() - viewerChromeState.lastTouchLikeViewportInputAt < timeout;
}
function openTopUiFromHotspot(event = null) {
  !isViewerSessionOpen() || viewerOnboardingState.viewerOnboardingOpen || (markTouchLikeViewportInput(event), showTopUiTemporarily(0));
}
function markTouchLikeRailInput(event) {
  isTouchLikePointer(event) && (viewerChromeState.lastTouchLikeRailInputAt = Date.now()), markTouchLikeViewportInput(event);
}
function hasRecentTouchLikeRailInput(timeout = 900) {
  return Date.now() - viewerChromeState.lastTouchLikeRailInputAt < timeout;
}
function shouldUseLightboxHoverPointer(event = null) {
  return !isViewerSessionOpen() || isTouchLikePointer(event) || hasRecentTouchLikeViewportInput() ? !1 : isObservedMouseHoverEvent(event) ? !0 : hasHoverPointer();
}
function shouldUsePageRailHover(event = null) {
  return !(!shouldUseLightboxHoverPointer(event) || hasRecentTouchLikeRailInput());
}
function showPageRailTemporarily(delay = 2600, options = {}) {
  let { scrollIntoView = !0 } = options;
  !viewerElements.lightbox || !isViewerSessionOpen() || (window.clearTimeout(viewerChromeState.pageRailHideTimer), viewerElements.lightbox.classList.add("show-page-rail"), updateLightboxThumbs({ scrollIntoView }), delay > 0 && (viewerChromeState.pageRailHideTimer = window.setTimeout(() => {
    viewerElements.lightbox?.classList.remove("show-page-rail");
  }, delay)));
}
function keepPageRailOpen(options = {}) {
  let { scrollIntoView = !0 } = options;
  isViewerSessionOpen() && (window.clearTimeout(viewerChromeState.pageRailHideTimer), viewerElements.lightbox?.classList.add("show-page-rail"), updateLightboxThumbs({ scrollIntoView }));
}
function schedulePageRailClose(event = null) {
  shouldUsePageRailHover(event) && (shouldKeepPageRailOpenForPointer(event) || (window.clearTimeout(viewerChromeState.pageRailHideTimer), viewerChromeState.pageRailHideTimer = window.setTimeout(() => {
    viewerElements.lightbox?.classList.remove("show-page-rail");
  }, 420)));
}
function openPageRailFromTouch(event) {
  isTouchLikePointer(event) && (markTouchLikeRailInput(event), event.preventDefault?.(), keepPageRailOpen());
}
function handleLightboxPageRailEdgePointerDown(event) {
  if (!isTouchLikePointer(event) || !isViewerSessionOpen() || viewerOnboardingState.viewerOnboardingOpen || viewerElements.lightboxPageRail?.contains(eventTargetElement(event.target))) return;
  let point = getViewportPointer(event);
  isPointInPageRailEdgeActivationZone(point) && (markTouchLikeRailInput(event), event.preventDefault?.(), event.stopImmediatePropagation?.(), event.stopPropagation?.(), keepPageRailOpen());
}
function openPageRailFromHotspot(event = null) {
  if (hasRecentTouchLikeRailInput()) {
    keepPageRailOpen();
    return;
  }
  showPageRailTemporarily(shouldUsePageRailHover(event) ? 2600 : 0);
}
function showPageRailFromHover(event = null) {
  shouldUsePageRailHover(event) && showPageRailTemporarily(0);
}
function keepPageRailOpenFromHover(event = null) {
  shouldUsePageRailHover(event) && keepPageRailOpen();
}
function handlePageRailPointerOutside(event) {
  if (!viewerElements.lightbox || !isViewerSessionOpen() || !viewerElements.lightbox.classList.contains("show-page-rail")) return;
  let target = eventTargetElement(event.target);
  viewerElements.lightboxPageRail?.contains(target) || viewerElements.lightboxSideHotspot?.contains(target) || !isTouchLikePointer(event) && shouldUsePageRailHover(event) || (window.clearTimeout(viewerChromeState.pageRailHideTimer), hideLightboxFloatingPreview(), viewerElements.lightbox.classList.remove("show-page-rail"));
}
function hideViewerPageIndicator() {
  window.clearTimeout(viewerChromeState.pageIndicatorHideTimer), viewerChromeState.pageIndicatorHideTimer = 0, viewerElements.viewerPageIndicator?.classList.remove("visible");
}
function showViewerPageIndicatorTemporarily(delay = VIEWER_PAGE_INDICATOR_HIDE_MS) {
  !isViewerSessionOpen() || !viewerElements.viewerPageIndicator || (window.clearTimeout(viewerChromeState.pageIndicatorHideTimer), viewerElements.viewerPageIndicator.classList.add("visible"), !(delay <= 0) && (viewerChromeState.pageIndicatorHideTimer = window.setTimeout(() => {
    viewerElements.viewerPageIndicator?.classList.remove("visible"), viewerChromeState.pageIndicatorHideTimer = 0;
  }, delay)));
}
function syncLightboxProgress(current, total, title, options = {}) {
  if (!viewerElements.lightboxProgress) return;
  let totalItems = Math.max(1, Number.parseInt(String(total), 10) || 1), currentItem = clampValue(Number.parseInt(String(current), 10) || 1, 1, totalItems), ratio = totalItems <= 1 ? 1 : currentItem / totalItems, clampedRatio = Math.min(1, Math.max(0, ratio)), parsedDisplayCurrent = Number.parseInt(String(options.displayCurrent ?? currentItem), 10), parsedDisplayTotal = Number.parseInt(String(options.displayTotal ?? totalItems), 10), displayCurrent = Number.isFinite(parsedDisplayCurrent) ? parsedDisplayCurrent : currentItem, displayTotal = Number.isFinite(parsedDisplayTotal) ? parsedDisplayTotal : totalItems, label = String(options.label || "עמוד"), detail = String(options.detail || "").trim(), accessibleTitle = title || `${label} ${displayCurrent} מתוך ${displayTotal}`;
  viewerElements.lightboxProgress.style.setProperty("--catalog-progress-ratio", String(clampedRatio)), viewerElements.lightboxProgress.style.setProperty("--catalog-progress-percent", `${clampedRatio * 100}%`), viewerElements.lightboxProgress.setAttribute("aria-valuemin", "1"), viewerElements.lightboxProgress.setAttribute("aria-valuemax", String(totalItems)), viewerElements.lightboxProgress.setAttribute("aria-valuenow", String(currentItem)), viewerElements.lightboxProgress.setAttribute("aria-valuetext", accessibleTitle), viewerElements.lightboxProgress.setAttribute("title", accessibleTitle), viewerElements.viewerPageIndicator && (viewerElements.viewerPageIndicatorLabel.textContent = label, viewerElements.viewerPageIndicatorCurrent.textContent = String(displayCurrent), viewerElements.viewerPageIndicatorTotal.textContent = String(displayTotal), viewerElements.viewerPageIndicatorDetail && (viewerElements.viewerPageIndicatorDetail.textContent = detail, viewerElements.viewerPageIndicatorDetail.classList.toggle("hidden", !detail)), viewerElements.viewerPageIndicator.setAttribute("title", accessibleTitle), showViewerPageIndicatorTemporarily());
}
function syncViewerLayoutModeUi() {
  viewerElements.lightbox?.classList.add("viewer-layout-paged"), viewerElements.lightbox?.classList.remove("viewer-layout-scroll", "viewer-layout-side", "viewer-scroll-zoom-isolated"), viewerElements.lightboxImageFrame?.classList.remove("hidden");
}

// src/js/52-viewer-session.js
function getBrowserFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
}
function isBrowserFullscreenActive() {
  return !!getBrowserFullscreenElement();
}
function isBrowserFullscreenSupported() {
  let root = document.documentElement;
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled || document.mozFullScreenEnabled || document.msFullscreenEnabled || root?.requestFullscreen || root?.webkitRequestFullscreen || root?.mozRequestFullScreen || root?.msRequestFullscreen);
}
function reconcileViewerFullscreenPhase(reason = "browser-state") {
  transitionViewerFullscreenPhase(
    isBrowserFullscreenActive() ? VIEWER_FULLSCREEN_ACTIVE : VIEWER_FULLSCREEN_INACTIVE,
    reason
  );
}
function viewerUsesInDocumentFullscreenNavigation() {
  return isBrowserFullscreenActive();
}
function requestBrowserFullscreen() {
  let root = document.documentElement, request = root?.requestFullscreen || root?.webkitRequestFullscreen || root?.mozRequestFullScreen || root?.msRequestFullscreen;
  if (!request) return Promise.reject(new Error("fullscreen-unsupported"));
  let result = request.call(root);
  return result && typeof result.then == "function" ? result : Promise.resolve();
}
function exitBrowserFullscreen() {
  let exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (!exit) return Promise.reject(new Error("fullscreen-exit-unsupported"));
  let result = exit.call(document);
  return result && typeof result.then == "function" ? result : Promise.resolve();
}
function getFullscreenToggleButtons() {
  return viewerElements.fullscreenToggle ? [viewerElements.fullscreenToggle] : [];
}
function syncFullscreenButtonUi() {
  let buttons = getFullscreenToggleButtons();
  if (!buttons.length) return;
  let isActive = isBrowserFullscreenActive(), isSupported = isBrowserFullscreenSupported(), isPending = isViewerFullscreenPending(), label = isActive ? "יציאה ממסך מלא" : "כניסה למסך מלא";
  buttons.forEach((button) => {
    button.dataset.fullscreenActive = isActive ? "true" : "false", button.dataset.fullscreenPhase = viewerSessionState.viewerFullscreenPhase, button.setAttribute("aria-pressed", isActive ? "true" : "false"), button.setAttribute("aria-label", label), setTooltipText(button, label, { updateDefault: !0 }), button.disabled = isPending || !isSupported && !isActive, button.classList.toggle("hidden", !isSupported && !isActive);
  });
}
function handleBrowserFullscreenChange() {
  reconcileViewerFullscreenPhase("fullscreenchange"), syncFullscreenButtonUi(), isViewerSessionOpen() && (getFeatureInterface("viewer")?.handleResize?.(), showTopUiTemporarily(1400));
}
async function toggleBrowserFullscreen(sourceButton = null) {
  let button = sourceButton || viewerElements.fullscreenToggle;
  if (isViewerFullscreenPending()) return;
  let wasActive = isBrowserFullscreenActive();
  transitionViewerFullscreenPhase(
    wasActive ? VIEWER_FULLSCREEN_EXITING : VIEWER_FULLSCREEN_ENTERING,
    wasActive ? "toggle-exit" : "toggle-enter"
  ), syncFullscreenButtonUi();
  try {
    if (wasActive)
      await exitBrowserFullscreen();
    else {
      if (!isBrowserFullscreenSupported()) throw new Error("fullscreen-unsupported");
      await requestBrowserFullscreen();
    }
  } catch (error) {
    let message = wasActive ? "לא הצלחתי לצאת ממסך מלא" : "הדפדפן חסם מסך מלא";
    console.warn("Fullscreen toggle failed", error), flashActionButton(button, message);
  } finally {
    reconcileViewerFullscreenPhase("toggle-settled"), syncFullscreenButtonUi(), isViewerSessionOpen() && showTopUiTemporarily(1400);
  }
}
function returnToMainSiteFromLightbox(event = null) {
  event?.preventDefault?.(), closeLightboxSearchScopeMenu(), closeLightboxCatalogMenu(), navigateTo(homeDocumentUrl());
}

// src/js/53-viewer-image.js
function setViewerLoading(isLoading) {
  viewerElements.viewerLoading.classList.toggle("hidden", !isLoading);
}
function applyStableViewerPageGeometry(catalog, page, image, options = {}) {
  let declaredSize = pageSize(catalog, page), width = Number(declaredSize?.width) || Number(image?.naturalWidth) || 0, height = Number(declaredSize?.height) || Number(image?.naturalHeight) || 0;
  return width <= 0 || height <= 0 ? null : applyLightboxFrameGeometry(width, height, options);
}
function cancelSingleViewerStagePreparation() {
  let controller = viewerImageState.singleImageStageAbortController;
  return controller ? (viewerImageState.singleImageStageAbortController = null, controller.abort(), !0) : !1;
}
function clearViewerNeighborPreloadSchedule() {
  window.clearTimeout(viewerImageState.neighborPreloadTimer), viewerImageState.neighborPreloadTimer = 0;
}
function clearViewerImagePreparations() {
  cancelSingleViewerStagePreparation(), clearViewerNeighborPreloadSchedule();
}
function runViewerPageSwapAnimation(element, options = (
  /** @type {ViewerPageSwapAnimationOptions} */
  { timerKey: "singleImageAnimationTimer" }
)) {
  let { timerKey, root = element?.parentElement } = options;
  !element || !timerKey || !(timerKey in viewerImageState) || (window.clearTimeout(viewerImageState[timerKey]), root?.querySelectorAll?.(".page-swap-enter").forEach((animatedElement) => animatedElement.classList.remove("page-swap-enter")), element.offsetWidth, element.classList.add("page-swap-enter"), viewerImageState[timerKey] = window.setTimeout(() => {
    element.classList.remove("page-swap-enter"), viewerImageState[timerKey] = 0;
  }, VIEWER_PAGE_SWAP_CLEANUP_MS));
}
function runSingleImageSwapAnimation() {
  runViewerPageSwapAnimation(viewerElements.lightboxImageFrame, {
    timerKey: "singleImageAnimationTimer",
    root: viewerElements.stageCanvas
  });
}
function finishSingleImageSwap(token) {
  isViewerImageSwapCurrent(token) && (setViewerLoading(!1), viewerElements.lightbox?.classList.remove("is-page-loading"), viewerElements.lightboxImageFrame?.classList.remove("is-preparing-swap"), syncImagePlaceholderState(viewerElements.lightboxImage), applyZoom());
}
function ensureSingleViewerResolutionImage() {
  if (viewerImageState.singleImageResolutionImage?.isConnected) return viewerImageState.singleImageResolutionImage;
  if (!viewerElements.lightboxImageFrame) return null;
  let image = new Image();
  return image.className = "lightbox-image lightbox-image-resolution", image.alt = "", image.draggable = !1, image.decoding = "async", image.fetchPriority = "high", image.setAttribute("aria-hidden", "true"), image.dataset.placeholderIgnore = "true", viewerElements.lightboxImageFrame.append(image), viewerImageState.singleImageResolutionImage = image, image;
}
function clearSingleViewerResolutionUpgrade() {
  cancelViewerResolutionCommand(), viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading", "is-resolution-upgrade-ready");
  let image = viewerImageState.singleImageResolutionImage;
  image && (image.removeAttribute("src"), delete image.dataset.resolutionRetainedForSwap, delete image.dataset.logicalSrc, delete image.dataset.loadedTier, delete image.dataset.loadedQuality, delete image.dataset.imageLoadPending);
}
function retainSingleViewerResolutionLayerForSwap() {
  let image = viewerImageState.singleImageResolutionImage;
  return viewerImageState.singleImageResolutionRetainedForSwap ? !!(image?.isConnected && image.naturalWidth > 0) : !viewerImageState.singleImageResolutionVisible || !viewerImageState.singleImageResolutionReady || !image?.isConnected || image.naturalWidth <= 0 ? !1 : (retainViewerResolutionForSwapCommand(), image.dataset.resolutionRetainedForSwap = "true", viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading"), viewerElements.lightboxImageFrame?.classList.add("is-resolution-upgrade-ready"), !0);
}
function releaseSingleViewerRetainedResolutionLayer() {
  if (!viewerImageState.singleImageResolutionRetainedForSwap) return !1;
  releaseViewerRetainedResolutionCommand(), viewerElements.lightboxImageFrame?.classList.remove("is-resolution-upgrade-ready");
  let image = viewerImageState.singleImageResolutionImage;
  return image && (image.removeAttribute("src"), delete image.dataset.resolutionRetainedForSwap, delete image.dataset.logicalSrc, delete image.dataset.loadedTier, delete image.dataset.loadedQuality, delete image.dataset.imageLoadPending), !0;
}
function activeSingleViewerImageLogicalSrc() {
  return viewerImageState.singleImageResolutionVisible && viewerImageState.singleImageResolutionTargetSrc ? viewerImageState.singleImageResolutionTargetSrc : normalizeCatalogImageUrl(viewerElements.lightboxImage?.dataset.logicalSrc || viewerElements.lightboxImage?.getAttribute("src") || "");
}
function activeSingleViewerImageTier() {
  return viewerImageState.singleImageResolutionRetainedForSwap ? CATALOG_IMAGE_TIER_FULL : viewerImageState.singleImageResolutionVisible && viewerImageState.singleImageResolutionTargetTier ? viewerImageState.singleImageResolutionTargetTier : String(viewerElements.lightboxImage?.dataset.loadedTier || "");
}
function shouldWarmSingleViewerFullResolution(previousZoom = viewerViewportState.zoom) {
  if (isSaveDataEnabled()) return !1;
  let effectiveType = networkEffectiveType();
  if (effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g") return !1;
  let zoom = Number(viewerViewportState.zoom) || AUTO_VIEWER_ZOOM, previous = Number(previousZoom) || AUTO_VIEWER_ZOOM;
  return zoom > AUTO_VIEWER_ZOOM + VIEWER_FULL_RESOLUTION_WARMUP_ZOOM_EPSILON && zoom > previous + 1e-3;
}
function commitSingleViewerResolutionUpgrade(token = viewerImageState.singleImageResolutionLoadToken) {
  return commitViewerResolutionCommand(token) ? (requestAnimationFrame(() => {
    token !== viewerImageState.singleImageResolutionLoadToken || !viewerImageState.singleImageResolutionVisible || viewerElements.lightboxImageFrame?.classList.add("is-resolution-upgrade-ready");
  }), !0) : !1;
}
function prepareSingleViewerResolutionUpgrade(catalog, page, request, options = {}) {
  if (!catalog || !request?.primarySrc || request.primaryTier !== CATALOG_IMAGE_TIER_FULL) return !1;
  let targetSrc = normalizeCatalogImageUrl(request.primarySrc);
  if (!targetSrc) return !1;
  if (viewerImageState.singleImageResolutionTargetSrc === targetSrc && viewerImageState.singleImageResolutionTargetTier === request.primaryTier)
    return options.commit && commitSingleViewerResolutionUpgrade(), !0;
  let image = ensureSingleViewerResolutionImage();
  if (!image) return !1;
  let token = beginViewerResolutionCommand(targetSrc, request.primaryTier, !!options.commit);
  viewerElements.lightboxImageFrame?.classList.add("is-resolution-loading");
  let stop = loadCatalogImageWithRecovery(image, {
    primarySrc: targetSrc,
    primaryTier: request.primaryTier,
    isCurrent: () => token === viewerImageState.singleImageResolutionLoadToken && isViewerSessionOpen() && activeCatalog() === catalog && activePage() === page && viewerImageState.singleImageResolutionTargetSrc === targetSrc,
    telemetryDetail: "viewer-resolution-upgrade",
    telemetrySurface: "viewer-resolution-upgrade",
    telemetryVisibility: "background",
    onSuccess: (
      /** @param {CatalogImageCandidate} candidate */
      (candidate) => {
        let finishReady = () => {
          if (token !== viewerImageState.singleImageResolutionLoadToken || !image.naturalWidth || !markViewerResolutionReadyCommand(token)) return;
          image.dataset.logicalSrc = targetSrc, image.dataset.loadedTier = candidate.tier || request.primaryTier, image.dataset.loadedQuality = image.dataset.loadedTier, viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading");
          let preferredTier = preferredViewerImageTier(catalog, page);
          (viewerImageState.singleImageResolutionCommitPending || preferredTier === CATALOG_IMAGE_TIER_FULL) && commitSingleViewerResolutionUpgrade(token);
        };
        typeof image.decode == "function" ? image.decode().catch(() => {
        }).then(finishReady) : finishReady();
      }
    ),
    onExhausted: () => {
      token === viewerImageState.singleImageResolutionLoadToken && (cancelViewerResolutionCommand(), viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading", "is-resolution-upgrade-ready"), image.removeAttribute("src"));
    }
  });
  return attachViewerResolutionStopCommand(token, stop), !0;
}
function setSingleViewerImageFeedback(mode = "", message = "") {
  let visible = !!(mode && message), isError = mode === "error";
  viewerElements.viewerImageFeedback?.classList.toggle("hidden", !visible), viewerElements.viewerImageFeedback && (viewerElements.viewerImageFeedback.dataset.mode = visible ? mode : "", viewerElements.viewerImageFeedback.dataset.state = visible ? isError ? "error" : "warning" : "", viewerElements.viewerImageFeedback.setAttribute("role", isError ? "alert" : "status"), viewerElements.viewerImageFeedback.setAttribute("aria-live", isError ? "assertive" : "polite")), viewerElements.viewerImageFeedbackText && (viewerElements.viewerImageFeedbackText.textContent = message), viewerElements.viewerImageRetry?.classList.toggle("hidden", !visible), viewerElements.lightboxImageFrame?.classList.toggle("image-fallback", mode === "fallback"), mode !== "error" && viewerElements.lightboxImageFrame?.classList.remove("image-terminal-error");
}
function showSingleLightboxImage(catalog, page, src, options = {}) {
  if (!viewerElements.lightboxImage || !catalog) return;
  cancelSingleViewerStagePreparation();
  let token = beginViewerImageSwapCommand(), image = viewerElements.lightboxImage, request = options.imageRequest || viewerPageImageRequest(catalog, page, {
    forceFull: !!options.forceFull
  }), primarySrc = normalizeCatalogImageUrl(src || request.primarySrc);
  if (!primarySrc) return;
  let currentLogicalSrc = image.dataset.logicalSrc || normalizeCatalogImageUrl(image.getAttribute("src") || "");
  if (!options.forceRefresh && currentLogicalSrc === primarySrc && image.complete && image.naturalWidth && image.dataset.loadedQuality !== "fallback") {
    applyStableViewerPageGeometry(catalog, page, image, { updateFitScale: !1 }), setSingleViewerImageFeedback(), finishSingleImageSwap(token);
    return;
  }
  let preserveCurrentImage = !!(options.preserveCurrentImage && image.complete && image.naturalWidth > 0 && !viewerElements.lightboxImageFrame?.classList.contains("image-terminal-error"));
  preserveCurrentImage && retainSingleViewerResolutionLayerForSwap() || clearSingleViewerResolutionUpgrade(), setViewerLoading(!0), viewerElements.lightboxImageFrame?.setAttribute("aria-busy", "true"), setSingleViewerImageFeedback(), viewerElements.lightbox?.classList.add("is-page-loading"), viewerElements.lightboxImageFrame?.classList.toggle("is-preparing-swap", !preserveCurrentImage), viewerElements.lightboxImageFrame?.classList.remove("image-terminal-error"), preserveCurrentImage ? image.dataset.placeholderIgnore = "true" : prepareImagePlaceholder(image), image.alt = `${catalog.title} - עמוד ${page}`, applyCatalogImageDimensions(image, catalog, page), image.decoding = "async", image.fetchPriority = "high", image.dataset.logicalSrc = primarySrc;
  let requestIsCurrent = () => isViewerImageSwapCurrent(token) && isViewerSessionOpen() && activeCatalog() === catalog && activePage() === page, commitImageRequest = (initialFailedAttempts = 0, telemetryRequestContext = null) => {
    requestIsCurrent() && loadCatalogImageWithRecovery(image, {
      primarySrc,
      primaryTier: request.primaryTier,
      fallbackCandidates: request.fallbackCandidates,
      forceRefresh: !!options.forceRefresh,
      isCurrent: requestIsCurrent,
      telemetryDetail: "viewer-single",
      telemetrySurface: "viewer-stage",
      telemetryRequestContext,
      initialFailedAttempts,
      onSuccess: (
        /** @param {CatalogImageCandidate} candidate */
        (candidate) => {
          delete image.dataset.placeholderIgnore;
          let loadedTier = candidate.tier || request.primaryTier || CATALOG_IMAGE_TIER_FULL, degraded = catalogImageTierRank(loadedTier) < catalogImageTierRank(request.primaryTier);
          image.dataset.loadedTier = loadedTier, image.dataset.loadedQuality = degraded ? "fallback" : loadedTier, image.naturalWidth && image.naturalHeight && applyStableViewerPageGeometry(catalog, page, image, { updateFitScale: !1 }), releaseSingleViewerRetainedResolutionLayer(), finishSingleImageSwap(token), viewerElements.lightboxImageFrame?.setAttribute("aria-busy", "false"), runSingleImageSwapAnimation(), degraded ? setSingleViewerImageFeedback("fallback", "שכבת התמונה המועדפת לא נטענה. מוצגת חלופה מוקטנת; אפשר לנסות שוב.") : setSingleViewerImageFeedback();
        }
      ),
      onExhausted: () => {
        delete image.dataset.placeholderIgnore, delete image.dataset.loadedTier, delete image.dataset.loadedQuality, releaseSingleViewerRetainedResolutionLayer(), finishSingleImageSwap(token), viewerElements.lightboxImageFrame?.setAttribute("aria-busy", "false"), viewerElements.lightboxImageFrame?.classList.add("image-terminal-error"), setSingleViewerImageFeedback("error", "התמונה לא הצליחה להיטען. אפשר לנסות שוב.");
      }
    });
  };
  if (preserveCurrentImage) {
    let controller = new AbortController();
    viewerImageState.singleImageStageAbortController = controller;
    let telemetryRequestContext = telemetryCreateImageRequestContext(image, primarySrc, {
      detail: "viewer-single",
      surface: "viewer-stage",
      visibility: "visible"
    });
    prepareCatalogImage(primarySrc, {
      priority: "high",
      detail: "viewer-single-stage",
      surface: "viewer-stage",
      visibility: "visible",
      failureAction: "stage",
      cache: !1,
      signal: controller.signal,
      isCurrent: requestIsCurrent,
      terminalOnFailure: !1,
      telemetryRequestContext
    }).then(() => ({ failedAttempts: 0 })).catch((error) => error?.name === "AbortError" || !requestIsCurrent() ? null : { failedAttempts: 1 }).then((result) => {
      result && commitImageRequest(result.failedAttempts, telemetryRequestContext);
    }).finally(() => {
      viewerImageState.singleImageStageAbortController === controller && (viewerImageState.singleImageStageAbortController = null);
    });
  } else
    commitImageRequest();
}
function renderedViewerPagePhysicalLongSide(catalog, page, zoom = viewerViewportState.zoom) {
  let rect = (viewerElements.lightboxImageFrame || null)?.getBoundingClientRect?.(), dpr = Math.max(1, Number(window.devicePixelRatio) || 1);
  if (rect?.width && rect?.height) return Math.max(rect.width, rect.height) * dpr;
  let size = pageSize(catalog, page), stageWidth = Math.max(1, viewerElements.stageCanvas?.clientWidth || window.innerWidth || 1), stageHeight = Math.max(1, viewerElements.stageCanvas?.clientHeight || window.innerHeight || 1);
  if (!size) return Math.max(stageWidth, stageHeight) * dpr;
  let fitMode = String(viewerViewportState.imageFitMode || VIEWER_FIT_HEIGHT), scale = fitMode === VIEWER_FIT_WIDTH ? stageWidth / size.width : fitMode === VIEWER_FIT_HEIGHT ? stageHeight / size.height : Math.min(stageWidth / size.width, stageHeight / size.height);
  return Math.max(size.width, size.height) * Math.max(0.01, scale) * dpr * Math.max(1, Number(zoom) || 1);
}
function preferredViewerImageTier(catalog, page, options = {}) {
  if (options.forceFull || !catalogSupportsImageTier(catalog, CATALOG_IMAGE_TIER_MEDIUM))
    return CATALOG_IMAGE_TIER_FULL;
  if (options.preferMedium) return CATALOG_IMAGE_TIER_MEDIUM;
  let zoom = Number.isFinite(Number(options.zoom)) ? Number(options.zoom) : Number(viewerViewportState.zoom || 1);
  if (zoom >= VIEWER_FULL_RESOLUTION_ZOOM_THRESHOLD) return CATALOG_IMAGE_TIER_FULL;
  if (!isSaveDataEnabled()) {
    let mediumMaxSide = catalogImageTierMaxSide(catalog, CATALOG_IMAGE_TIER_MEDIUM);
    if (renderedViewerPagePhysicalLongSide(catalog, page, zoom) > mediumMaxSide * VIEWER_MEDIUM_OVERSUBSCRIPTION_RATIO)
      return CATALOG_IMAGE_TIER_FULL;
  }
  return CATALOG_IMAGE_TIER_MEDIUM;
}
function viewerPageImageRequest(catalog, page, options = {}) {
  let candidates = (preferredViewerImageTier(catalog, page, options) === CATALOG_IMAGE_TIER_FULL ? [CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_MEDIUM, CATALOG_IMAGE_TIER_THUMB] : [CATALOG_IMAGE_TIER_MEDIUM, CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_THUMB]).filter((tier) => catalogSupportsImageTier(catalog, tier)).map((tier) => ({ tier, src: catalogPageImageSrc(catalog, page, tier) })).filter((candidate) => candidate.src), primary = candidates[0] || { tier: CATALOG_IMAGE_TIER_FULL, src: pageSrc(catalog, page) };
  return {
    primarySrc: primary.src,
    primaryTier: primary.tier,
    fallbackCandidates: candidates.slice(1).map((candidate, index) => ({
      ...candidate,
      role: `fallback-${index + 1}`
    }))
  };
}
function viewerPageSrc(catalog, page, options = {}) {
  return viewerPageImageRequest(catalog, page, options).primarySrc;
}
function catalogImageTierRank(tier) {
  return tier === CATALOG_IMAGE_TIER_FULL ? 3 : tier === CATALOG_IMAGE_TIER_MEDIUM ? 2 : tier === CATALOG_IMAGE_TIER_THUMB ? 1 : 0;
}
function refreshSingleViewerImageResolution(options = {}) {
  let catalog = activeCatalog();
  if (!isViewerSessionOpen() || !catalog || !viewerElements.lightboxImage || viewerImageState.singleImageResolutionRetainedForSwap) return !1;
  let page = activePage(), request = viewerPageImageRequest(catalog, page, options);
  if (options.warmFull && request.primaryTier !== CATALOG_IMAGE_TIER_FULL) {
    let fullRequest = viewerPageImageRequest(catalog, page, { forceFull: !0 });
    prepareSingleViewerResolutionUpgrade(catalog, page, fullRequest, { commit: !1 });
  }
  let currentSrc = activeSingleViewerImageLogicalSrc(), nextSrc = normalizeCatalogImageUrl(request.primarySrc), loadedTier = activeSingleViewerImageTier();
  return currentSrc === nextSrc ? !!options.warmFull : catalogImageTierRank(loadedTier) > catalogImageTierRank(request.primaryTier) ? !1 : request.primaryTier === CATALOG_IMAGE_TIER_FULL ? prepareSingleViewerResolutionUpgrade(catalog, page, request, { commit: !0 }) : (!viewerImageState.singleImageResolutionVisible && !viewerImageState.singleImageResolutionReady && clearSingleViewerResolutionUpgrade(), !1);
}
function runViewerNeighborPreloads(catalog, page, favoriteIndex = -1) {
  let preloadFull = preferredViewerImageTier(catalog, page) === CATALOG_IMAGE_TIER_FULL, radius = preloadFull ? 1 : catalogNeighborPreloadRadius(), requestOptions = preloadFull ? { forceFull: !0 } : { preferMedium: !0 };
  if (!(radius < 1)) {
    if (isFavoritesLightboxMode()) {
      let entries = getFeatureInterface("favorites")?.entries() || [];
      Array.from({ length: radius * 2 }, (_unused, index) => index < radius ? favoriteIndex - (radius - index) : favoriteIndex + (index - radius + 1)).filter((index) => index >= 0 && index < entries.length).forEach((index) => {
        let entry = entries[index];
        prepareCatalogImage(viewerPageSrc(entry.catalog, entry.page, requestOptions), {
          priority: "low",
          detail: "viewer-neighbor-preload",
          surface: "viewer-favorites-neighbor-preload",
          visibility: "preload"
        }).catch(() => {
        });
      });
      return;
    }
    Array.from({ length: radius * 2 }, (_unused, index) => index < radius ? page - (radius - index) : page + (index - radius + 1)).filter((page2) => page2 >= catalogFirstPage(catalog) && page2 <= catalogLastPage(catalog)).forEach((page2) => {
      prepareCatalogImage(viewerPageSrc(catalog, page2, requestOptions), {
        priority: "low",
        detail: "viewer-neighbor-preload",
        surface: "viewer-neighbor-preload",
        visibility: "preload"
      }).catch(() => {
      });
    });
  }
}
function preloadNeighbors() {
  clearViewerNeighborPreloadSchedule();
  let catalog = activeCatalog();
  if (!catalog || !isViewerSessionOpen()) return;
  let page = activePage(), favoritesMode = isFavoritesLightboxMode(), favoriteIndex = favoritesMode ? getFeatureInterface("favorites")?.viewerIndex() ?? 0 : -1;
  viewerImageState.neighborPreloadTimer = window.setTimeout(() => {
    viewerImageState.neighborPreloadTimer = 0, !(!isViewerSessionOpen() || activeCatalog() !== catalog || activePage() !== page) && isFavoritesLightboxMode() === favoritesMode && (favoritesMode && (getFeatureInterface("favorites")?.viewerIndex() ?? 0) !== favoriteIndex || runViewerNeighborPreloads(catalog, page, favoriteIndex));
  }, VIEWER_NEIGHBOR_PRELOAD_SETTLE_MS);
}

// src/js/55-viewer-zoom-controller.js
function clampViewerZoom(value) {
  return getSafeViewerZoom(value);
}
function getDefaultZoomFocalPoint() {
  let rect = viewerElements.stageCanvas?.getBoundingClientRect?.();
  return rect ? {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  } : null;
}
function adjustSinglePanForZoom(nextZoom, focal) {
  let rect = viewerElements.stageCanvas?.getBoundingClientRect?.();
  if (!rect || !focal) return;
  let currentZoom = getSafeViewerZoom(), centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2, contentX = (focal.x - centerX - viewerViewportState.panX) / currentZoom, contentY = (focal.y - centerY - viewerViewportState.panY) / currentZoom;
  viewerViewportState.panX = focal.x - centerX - contentX * nextZoom, viewerViewportState.panY = focal.y - centerY - contentY * nextZoom;
}
function getSingleContentPointFromClientPoint(clientX, clientY) {
  let rect = viewerElements.stageCanvas?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  let currentZoom = getSafeViewerZoom(), centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2;
  return {
    x: (clientX - centerX - viewerViewportState.panX) / currentZoom,
    y: (clientY - centerY - viewerViewportState.panY) / currentZoom
  };
}
function finalizeSingleViewerZoomChange(previousZoom, options = {}) {
  let { showUi = !0 } = options;
  applyZoom(), syncViewerAutoZoomButtonUi(), Math.abs(getSafeViewerZoom(viewerViewportState.zoom) - getSafeViewerZoom(previousZoom)) > 1e-3 && showViewerZoomIndicator(viewerViewportState.zoom), refreshSingleViewerImageResolution({
    warmFull: shouldWarmSingleViewerFullResolution(previousZoom)
  }), showUi && showTopUiTemporarily(1600);
}
function zoomSingleContentPointToViewportCenter(point, nextZoom) {
  if (!point) return !1;
  let previousZoom = viewerViewportState.zoom, zoom = clampViewerZoom(nextZoom);
  return isAutoViewerZoom(zoom) ? (setZoom(AUTO_VIEWER_ZOOM, { showUi: !1 }), !0) : (clearSingleImagePendingPosition(), viewerViewportState.zoom = zoom, viewerViewportState.panX = -point.x * zoom, viewerViewportState.panY = -point.y * zoom, finalizeSingleViewerZoomChange(previousZoom, { showUi: !1 }), !0);
}
function zoomClientPointToViewportCenter(nextZoom, clientX, clientY) {
  return zoomSingleContentPointToViewportCenter(
    getSingleContentPointFromClientPoint(clientX, clientY),
    nextZoom
  );
}
function setZoom(nextZoom, options = {}) {
  let {
    showUi = !0,
    focalClientX = null,
    focalClientY = null
  } = options, previousZoom = viewerViewportState.zoom, zoom = clampViewerZoom(nextZoom), focal = typeof focalClientX == "number" && Number.isFinite(focalClientX) && typeof focalClientY == "number" && Number.isFinite(focalClientY) ? { x: (
    /** @type {number} */
    focalClientX
  ), y: (
    /** @type {number} */
    focalClientY
  ) } : getDefaultZoomFocalPoint();
  isAutoViewerZoom(zoom) ? (viewerViewportState.zoom = AUTO_VIEWER_ZOOM, resetImagePosition({ queueSingleFitOrigin: !0 })) : (clearSingleImagePendingPosition(), focal && Math.abs(zoom - previousZoom) > 1e-3 && adjustSinglePanForZoom(zoom, focal), viewerViewportState.zoom = zoom), finalizeSingleViewerZoomChange(previousZoom, { showUi });
}
function toggleZoomAtPoint(clientX, clientY) {
  if (!isAutoViewerZoom()) {
    setZoom(AUTO_VIEWER_ZOOM, { showUi: !1 });
    return;
  }
  zoomClientPointToViewportCenter(2, clientX, clientY) || setZoom(2, { showUi: !1, focalClientX: clientX, focalClientY: clientY });
}

// src/js/59-viewer-page-controller.js
function catalogPageProgress(catalog, page) {
  let displayTotal = catalogLastPage(catalog);
  return {
    current: catalogPageOrdinal(catalog, page),
    total: catalog.pages,
    title: `עמוד ${page} מתוך ${displayTotal}`,
    options: {
      label: "עמוד",
      displayCurrent: page,
      displayTotal
    }
  };
}
function reconcileAutomaticViewerFitModeForActivePage() {
  if (!viewerUsesAutomaticFitMode()) return !1;
  let nextFitMode = getAutomaticViewerFitMode();
  return nextFitMode === viewerViewportState.imageFitMode ? !1 : (viewerViewportState.imageFitMode = nextFitMode, !0);
}
function updateLightbox(options = {}) {
  if (!activeCatalog()) return;
  let { thumbScrollIntoView = !0, preserveCurrentImage = !1 } = options, favoriteEntries = null, favorites = getFeatureInterface("favorites");
  if (isFavoritesLightboxMode()) {
    if (favoriteEntries = favorites?.entries() || [], !favoriteEntries.length) {
      getFeatureInterface("viewer")?.close({ restoreFavorites: !0 });
      return;
    }
    let currentIndex = favorites?.findViewerEntryIndex(favoriteEntries, activeCatalog()?.id, activePage()) ?? -1;
    favorites?.selectViewerEntry(
      favoriteEntries,
      currentIndex >= 0 ? currentIndex : favorites.viewerIndex()
    );
  }
  let catalog = activeCatalog();
  if (!catalog) return;
  if (setActivePage(clampPage(activePage(), catalog)), reconcileAutomaticViewerFitModeForActivePage(), syncLightboxModeUi(), syncViewerInquiryUi(), syncViewerMobileMoreMenuState(), viewerElements.lightboxTitle.textContent = catalog.title, favoriteEntries) {
    let favoriteViewerIndex = favorites?.viewerIndex() ?? 0, current = favoriteViewerIndex + 1, total = favoriteEntries.length;
    viewerElements.lightboxMeta.textContent = `מועדף ${current} מתוך ${total} · עמוד ${activePage()}`, syncLightboxProgress(current, total, `מועדף ${current} מתוך ${total} · עמוד ${activePage()}`, {
      label: "מועדף",
      detail: `עמוד ${activePage()}`
    }), viewerElements.prevPageBtn.disabled = favoriteViewerIndex <= 0, viewerElements.nextPageBtn.disabled = favoriteViewerIndex >= total - 1;
  } else {
    let progress = catalogPageProgress(catalog, activePage());
    viewerElements.lightboxMeta.textContent = progress.title, syncLightboxProgress(progress.current, progress.total, progress.title, progress.options), viewerElements.prevPageBtn.disabled = activePage() <= catalogFirstPage(catalog), viewerElements.nextPageBtn.disabled = activePage() >= catalogLastPage(catalog);
  }
  favorites?.syncViewerButton(), favoriteEntries || initLightboxSearchStatus();
  let preserveFullResolutionTier = !isAutoViewerZoom() && activeSingleViewerImageTier() === CATALOG_IMAGE_TIER_FULL, request = viewerPageImageRequest(catalog, activePage(), {
    forceFull: preserveFullResolutionTier
  }), src = request.primarySrc;
  activeSingleViewerImageLogicalSrc() !== src ? showSingleLightboxImage(catalog, activePage(), src, { imageRequest: request, preserveCurrentImage }) : (setViewerLoading(!1), viewerElements.lightbox?.classList.remove("is-page-loading"), applyZoom()), updateLightboxThumbs({ scrollIntoView: thumbScrollIntoView }), preloadNeighbors(), updateHash();
}
function beginPageControllerTransition(targetPage, direction, options) {
  let command = options.navigationCommand || createViewerNavigationCommand(
    options.navigationSource || VIEWER_NAVIGATION_SOURCE_PROGRAMMATIC,
    direction
  ), relativePosition = command.positionMode === "relative" ? captureSingleImageRelativePosition() : null;
  return beginViewerPageTransitionCommand(targetPage, command, relativePosition), command;
}
function setLightboxPage(page, options = {}) {
  if (!activeCatalog()) return;
  let nextPage = clampPage(page, activeCatalog());
  if (nextPage === activePage()) return;
  let thumbScrollIntoView = options.thumbScrollIntoView !== !1, previousCatalog = activeCatalog(), previousPage = activePage(), direction = Math.sign(nextPage - previousPage);
  hideLightboxFloatingPreview(), beginPageControllerTransition(nextPage, direction, options), setActivePage(nextPage), reconcileAutomaticViewerFitModeForActivePage();
  let currentCatalog = activeCatalog(), preserveCurrentGeometry = !!(currentCatalog && viewerElements.lightboxImage?.complete && viewerElements.lightboxImage.naturalWidth > 0 && catalogPagesShareAspectRatio(previousCatalog, previousPage, currentCatalog, activePage()));
  currentCatalog && !preserveCurrentGeometry && primeLightboxFrameForCatalogPage(currentCatalog, activePage()) && applyZoom(), updateLightbox({ thumbScrollIntoView, preserveCurrentImage: preserveCurrentGeometry });
}
function setFavoriteViewerIndex(index, options = {}) {
  if (!isFavoritesLightboxMode()) return;
  let favorites = getFeatureInterface("favorites"), entries = favorites?.entries() || [];
  if (!entries.length) {
    getFeatureInterface("viewer")?.close({ restoreFavorites: !0 });
    return;
  }
  let currentFavoriteIndex = favorites?.viewerIndex() ?? 0, nextIndex = clampValue(Number.parseInt(String(index), 10) || 0, 0, entries.length - 1), entry = entries[nextIndex];
  if (!(nextIndex !== currentFavoriteIndex || activeCatalog() !== entry.catalog || activePage() !== entry.page)) return;
  let thumbScrollIntoView = options.thumbScrollIntoView !== !1, previousCatalog = activeCatalog(), previousPage = activePage(), direction = Math.sign(nextIndex - currentFavoriteIndex);
  hideLightboxFloatingPreview(), beginPageControllerTransition(entry.page, direction, options), favorites?.selectViewerEntry(entries, nextIndex), reconcileAutomaticViewerFitModeForActivePage();
  let currentCatalog = activeCatalog(), preserveCurrentGeometry = !!(currentCatalog && viewerElements.lightboxImage?.complete && viewerElements.lightboxImage.naturalWidth > 0 && catalogPagesShareAspectRatio(previousCatalog, previousPage, currentCatalog, activePage()));
  currentCatalog && !preserveCurrentGeometry && primeLightboxFrameForCatalogPage(currentCatalog, activePage()) && applyZoom(), updateLightbox({ thumbScrollIntoView, preserveCurrentImage: preserveCurrentGeometry });
}
function moveLightbox(delta, options = {}) {
  if (activeCatalog()) {
    if (isFavoritesLightboxMode()) {
      setFavoriteViewerIndex((getFeatureInterface("favorites")?.viewerIndex() ?? 0) + delta, options);
      return;
    }
    setLightboxPage(activePage() + delta, options);
  }
}
function handleViewerPageRailClick(event) {
  let button = eventTargetElement(event.target)?.closest(".lightbox-page-thumb");
  if (!(!(button instanceof HTMLButtonElement) || !viewerElements.lightboxPageThumbs?.contains(button))) {
    if (event.preventDefault(), hideLightboxFloatingPreview(), isFavoritesLightboxMode())
      setFavoriteViewerIndex(Number(button.dataset.favoriteIndex), { thumbScrollIntoView: !1, navigationSource: VIEWER_NAVIGATION_SOURCE_PAGE_RAIL });
    else {
      let targetPage = Number(button.dataset.page);
      if (!Number.isFinite(targetPage)) return;
      setLightboxPage(targetPage, { thumbScrollIntoView: !1, navigationSource: VIEWER_NAVIGATION_SOURCE_PAGE_RAIL });
    }
    showPageRailTemporarily(1800, { scrollIntoView: !1 });
  }
}
function attachViewerPageControllerEvents() {
  viewerElements.lightboxPageThumbs?.addEventListener("click", handleViewerPageRailClick);
}

// src/js/58-viewer-navigation.js
function retryCurrentViewerImage() {
  let catalog = activeCatalog();
  if (!isViewerSessionOpen() || !catalog) return;
  let request = viewerPageImageRequest(catalog, activePage());
  showSingleLightboxImage(catalog, activePage(), request.primarySrc, {
    imageRequest: request,
    forceRefresh: !0
  });
}
function getViewerNavigationPosition() {
  return isFavoritesLightboxMode() ? getFeatureInterface("favorites")?.viewerIndex() ?? 0 : activePage() - catalogFirstPage(activeCatalog());
}
function getViewerNavigationMaximumPosition() {
  return isFavoritesLightboxMode() ? Math.max(0, (getFeatureInterface("favorites")?.entries().length || 0) - 1) : Math.max(0, (activeCatalog()?.pages || 1) - 1);
}
function setViewerNavigationPosition(position, options = {}) {
  let maximum = getViewerNavigationMaximumPosition(), target = clampValue(Number.parseInt(String(position), 10) || 0, 0, maximum);
  return target === getViewerNavigationPosition() ? !1 : (isFavoritesLightboxMode() ? setFavoriteViewerIndex(target, options) : setLightboxPage(target + catalogFirstPage(activeCatalog()), options), !0);
}
function canMoveLightbox(direction) {
  let step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (!step) return !1;
  let current = getViewerNavigationPosition();
  return current + step >= 0 && current + step <= getViewerNavigationMaximumPosition();
}
function clearViewerPageWheelGesture() {
  window.clearTimeout(viewerNavigationState.viewerPageWheelSettleTimer), resetViewerNavigationGestureCommand();
}
function scheduleViewerPageWheelSettle() {
  window.clearTimeout(viewerNavigationState.viewerPageWheelSettleTimer), viewerNavigationState.viewerPageWheelSettleTimer = window.setTimeout(
    settleViewerPageWheelGesture,
    VIEWER_PAGE_WHEEL_SETTLE_MS
  );
}
function holdViewerPageWheelAfterManualReset(logicalDelta, eventTime) {
  viewerNavigationState.viewerPageWheelAccumulator = 0, viewerNavigationState.viewerPageWheelBasePage = 0, viewerNavigationState.viewerPageWheelTargetPage = 0, viewerNavigationState.viewerPageWheelResetGestureActive = !0, viewerNavigationState.viewerPageWheelResetLastEventAt = eventTime, viewerNavigationState.viewerPageWheelResetLastDelta = Math.abs(logicalDelta), viewerNavigationState.viewerPageWheelResetDirection = Math.sign(logicalDelta), scheduleViewerPageWheelSettle();
}
function getViewerPageWheelEventTime(event) {
  let eventTime = Number(event?.timeStamp);
  return Number.isFinite(eventTime) && eventTime >= 0 ? eventTime : typeof performance < "u" && typeof performance.now == "function" ? performance.now() : Date.now();
}
function consumeViewerPageWheelResetContinuation(logicalDelta, eventTime) {
  if (!viewerNavigationState.viewerPageWheelResetGestureActive) return !1;
  let direction = Math.sign(logicalDelta), magnitude = Math.abs(logicalDelta), previousDirection = viewerNavigationState.viewerPageWheelResetDirection, previousMagnitude = viewerNavigationState.viewerPageWheelResetLastDelta, elapsed = Math.max(0, eventTime - viewerNavigationState.viewerPageWheelResetLastEventAt), sameDirection = direction !== 0 && direction === previousDirection, accelerated = magnitude >= Math.max(
    previousMagnitude * VIEWER_PAGE_WHEEL_RESET_ACCELERATION_RATIO,
    previousMagnitude + VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX
  ), restartedAfterCadenceBreak = elapsed >= VIEWER_PAGE_WHEEL_RESET_RESTART_GAP_MS;
  return !sameDirection || accelerated || restartedAfterCadenceBreak ? (clearViewerPageWheelGesture(), !1) : (viewerNavigationState.viewerPageWheelResetLastEventAt = eventTime, viewerNavigationState.viewerPageWheelResetLastDelta = magnitude, scheduleViewerPageWheelSettle(), !0);
}
function normalizeViewerPageWheelAxisDelta(rawDelta, deltaMode, viewportSize = 0) {
  let pageMode = typeof WheelEvent < "u" ? WheelEvent.DOM_DELTA_PAGE : 2;
  return deltaMode === pageMode ? (Number(rawDelta) || 0) * VIEWER_PAGE_WHEEL_PAGE_DELTA_PX : normalizeWheelDeltaToPixels(rawDelta, deltaMode, viewportSize);
}
function normalizeViewerPageWheelDeltas(event) {
  let currentTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
  return {
    deltaX: normalizeViewerPageWheelAxisDelta(
      event?.deltaX,
      event?.deltaMode,
      currentTarget?.clientWidth || viewerElements.stageCanvas?.clientWidth || 0
    ),
    deltaY: normalizeViewerPageWheelAxisDelta(
      event?.deltaY,
      event?.deltaMode,
      currentTarget?.clientHeight || viewerElements.stageCanvas?.clientHeight || 0
    )
  };
}
function getViewerPageWheelLogicalDelta(deltaX, deltaY) {
  return Math.abs(deltaY) >= Math.abs(deltaX) ? deltaY : -deltaX;
}
function getViewerPageWheelRequestedSteps(accumulator) {
  let signedAccumulator = Number(accumulator) || 0, magnitude = Math.abs(signedAccumulator);
  if (magnitude < VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX) return 0;
  let wholePageSteps = Math.trunc(magnitude / VIEWER_PAGE_WHEEL_PAGE_DELTA_PX);
  return Math.sign(signedAccumulator) * Math.max(1, wholePageSteps);
}
function getSingleViewerPageTurnIntent(result, deltaX = 0, deltaY = 0) {
  if (!result) return null;
  let remaining = result.remainingDeltaY;
  return Math.abs(remaining) <= VIEWER_PAGE_TURN_REMAINDER_EPSILON ? null : {
    axis: "y",
    direction: remaining > 0 ? 1 : -1
  };
}
function getViewerPageTurnNavigationCommand(direction, axis = "y", options = {}) {
  return createViewerNavigationCommand(
    options.navigationSource || VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING,
    direction,
    {
      axis,
      preservePointerInteraction: options.preservePointerInteraction === !0
    }
  );
}
function moveLightboxFromPageTurn(direction, axis = "y", options = {}) {
  let step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  return !step || !canMoveLightbox(step) ? !1 : (moveLightbox(step, {
    navigationCommand: getViewerPageTurnNavigationCommand(step, axis, options)
  }), !0);
}
function consumeSingleViewerBoundaryInput(deltaX = 0, deltaY = 0, options = {}) {
  let result = consumeSingleViewerPanInput(deltaX, deltaY);
  if (!result) return { handled: !1, turned: !1, moved: !1 };
  let intent = getSingleViewerPageTurnIntent(result, deltaX, deltaY);
  return {
    handled: !0,
    turned: !!(intent && moveLightboxFromPageTurn(intent.direction, intent.axis, {
      preservePointerInteraction: Number.isFinite(options.pointerId),
      navigationSource: options.navigationSource || VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN
    })),
    moved: result.moved,
    intent,
    result
  };
}
function settleViewerPageWheelGesture() {
  clearViewerPageWheelGesture();
}
function handleViewerPageWheel(event) {
  if (!isViewerSessionOpen() || !activeCatalog()) return !1;
  let { deltaX, deltaY } = normalizeViewerPageWheelDeltas(event);
  if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) return !1;
  event.preventDefault();
  let logicalDelta = getViewerPageWheelLogicalDelta(deltaX, deltaY), eventTime = getViewerPageWheelEventTime(event);
  if (consumeViewerPageWheelResetContinuation(logicalDelta, eventTime))
    return !0;
  if (singleViewerUsesBoundaryPan()) {
    let resetManualView = !isAutoViewerZoom();
    return clearViewerPageWheelGesture(), consumeSingleViewerBoundaryInput(deltaX, deltaY, { navigationSource: VIEWER_NAVIGATION_SOURCE_WHEEL }).turned && resetManualView && holdViewerPageWheelAfterManualReset(logicalDelta, eventTime), !0;
  }
  if (Math.abs(logicalDelta) < 0.01) return !0;
  if (!viewerNavigationState.viewerPageWheelBasePage) {
    let currentPosition = getViewerNavigationPosition();
    viewerNavigationState.viewerPageWheelBasePage = currentPosition + 1, viewerNavigationState.viewerPageWheelTargetPage = currentPosition + 1, viewerNavigationState.viewerPageWheelAccumulator = 0;
  }
  viewerNavigationState.viewerPageWheelAccumulator += logicalDelta;
  let requestedSteps = getViewerPageWheelRequestedSteps(viewerNavigationState.viewerPageWheelAccumulator), basePosition = viewerNavigationState.viewerPageWheelBasePage - 1, targetPosition = clampValue(
    basePosition + requestedSteps,
    0,
    getViewerNavigationMaximumPosition()
  ), previousTargetPosition = viewerNavigationState.viewerPageWheelTargetPage - 1;
  if (viewerNavigationState.viewerPageWheelTargetPage = targetPosition + 1, targetPosition !== previousTargetPosition) {
    let direction = Math.sign(targetPosition - previousTargetPosition) || Math.sign(targetPosition - basePosition) || Math.sign(logicalDelta);
    setViewerNavigationPosition(
      targetPosition,
      {
        navigationCommand: getViewerPageTurnNavigationCommand(
          direction,
          Math.abs(deltaY) >= Math.abs(deltaX) ? "y" : "x",
          { navigationSource: VIEWER_NAVIGATION_SOURCE_WHEEL }
        )
      }
    );
  }
  return scheduleViewerPageWheelSettle(), !0;
}

// src/js/57-viewer-fit-controller.js
function setViewerFitMode(fitMode, options = {}) {
  let nextFitMode = normalizeViewerFitMode(fitMode), {
    showUi = !0,
    source = VIEWER_FIT_SOURCE_MANUAL,
    refreshLayout = !0
  } = options, shouldResetView = nextFitMode !== viewerViewportState.imageFitMode;
  viewerViewportState.imageFitModeSource = normalizeViewerFitModeSource(source), viewerViewportState.imageFitMode = nextFitMode, shouldResetView && (clearViewerPageWheelGesture(), viewerViewportState.zoom = AUTO_VIEWER_ZOOM, resetImagePosition({ queueSingleFitOrigin: !0 }), resetViewerGestureCommand()), syncViewerFitModeUi(), refreshLayout && (applyZoom(), refreshSingleViewerImageResolution()), showUi && showTopUiTemporarily(1600);
}
function setViewerAutomaticFitMode(options = {}) {
  setViewerFitMode(getAutomaticViewerFitMode(), {
    ...options,
    source: VIEWER_FIT_SOURCE_AUTO
  });
}
function syncAutomaticViewerFitMode(options = {}) {
  return !viewerUsesAutomaticFitMode() || getAutomaticViewerFitMode() === viewerViewportState.imageFitMode ? !1 : (setViewerAutomaticFitMode(options), !0);
}

// src/js/61-viewer-layout-controller.js
function refreshLightboxLayoutForTopUiChange(options = {}) {
  if (!isViewerSessionOpen()) {
    syncLightboxTopSafeArea();
    return;
  }
  let { resetAutoSingleOrigin = !0 } = options;
  syncLightboxTopSafeArea(), resetAutoSingleOrigin && isAutoViewerZoom() && resetImagePosition({ queueSingleFitOrigin: !0 }), applyZoom(), refreshSingleViewerImageResolution();
}
function setTopUiPinned(pinned) {
  viewerChromeState.topUiPinned = !!pinned, syncTopUiPinnedUi(), refreshLightboxLayoutForTopUiChange(), viewerChromeState.topUiPinned || showTopUiTemporarily(1400);
}
function toggleTopUiPinned() {
  setTopUiPinned(!viewerChromeState.topUiPinned);
}

// src/js/62-viewer-actions.js
var MOBILE_VIEWER_TOOLBAR_MEDIA = "(max-width: 760px)";
function isMobileViewerToolbarMode() {
  return !!window.matchMedia?.(MOBILE_VIEWER_TOOLBAR_MEDIA).matches;
}
function setViewerMobileMoreOpen(open, options = {}) {
  let shouldOpen = !!(open && isViewerSessionOpen() && isMobileViewerToolbarMode());
  viewerChromeState.viewerMobileMoreOpen = shouldOpen, syncViewerMobileMoreMenuState(), viewerElements.viewerMobileMoreMenu?.classList.toggle("hidden", !shouldOpen), viewerElements.viewerMobileMoreMenu?.classList.toggle("visible", shouldOpen), viewerElements.viewerMobileMoreToggle?.setAttribute("aria-expanded", shouldOpen ? "true" : "false"), viewerElements.viewerMobileMoreToggle?.classList.toggle("is-active", shouldOpen), viewerElements.lightbox?.classList.toggle("mobile-more-open", shouldOpen), shouldOpen ? (showTopUiTemporarily(0), window.requestAnimationFrame(() => {
    focusHtmlElement(viewerElements.viewerMobileMoreMenu?.querySelector('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'), { preventScroll: !0 });
  })) : options.returnFocus && viewerElements.viewerMobileMoreToggle?.focus?.({ preventScroll: !0 });
}
function closeViewerMobileMoreMenu(options = {}) {
  setViewerMobileMoreOpen(!1, options);
}
function getViewerMobileMoreItems() {
  return viewerElements.viewerMobileMoreMenu ? Array.from(viewerElements.viewerMobileMoreMenu.querySelectorAll(
    '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
  )).filter(isHtmlElement).filter((item) => !item.classList.contains("hidden") && item.getAttribute("aria-hidden") !== "true") : [];
}
function handleViewerMobileMoreKeydown(event) {
  if (!viewerChromeState.viewerMobileMoreOpen) return;
  let items = getViewerMobileMoreItems();
  if (!items.length) return;
  let currentIndex = Math.max(0, isHtmlElement(document.activeElement) ? items.indexOf(document.activeElement) : 0), nextIndex = -1;
  if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
  else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = items.length - 1;
  else return;
  event.preventDefault(), focusHtmlElement(items[nextIndex], { preventScroll: !0 });
}
function handleViewerMobileMoreAction(event) {
  let item = eventTargetElement(event.target)?.closest("[data-viewer-mobile-action]");
  if (!isHtmlElement(item) || !viewerElements.viewerMobileMoreMenu?.contains(item)) return;
  event.preventDefault(), event.stopPropagation();
  let action = item.dataset.viewerMobileAction;
  action === "download" ? downloadCurrentLightboxImage() : action === "pin" ? toggleTopUiPinned() : action === "fit-auto" ? setViewerAutomaticFitMode({ showUi: !1 }) : action === "fit-height" ? setViewerFitMode(VIEWER_FIT_HEIGHT, { showUi: !1 }) : action === "fit-width" && setViewerFitMode(VIEWER_FIT_WIDTH, { showUi: !1 }), syncViewerMobileMoreMenuState(), closeViewerMobileMoreMenu({ returnFocus: !0 });
}
function attachViewerActionEvents() {
  viewerElements.viewerMobileMoreToggle?.addEventListener("click", (event) => {
    event.preventDefault(), event.stopPropagation(), setViewerMobileMoreOpen(!viewerChromeState.viewerMobileMoreOpen, { returnFocus: viewerChromeState.viewerMobileMoreOpen });
  }), viewerElements.viewerMobileMoreMenu?.addEventListener("click", handleViewerMobileMoreAction), viewerElements.viewerMobileMoreMenu?.addEventListener("keydown", handleViewerMobileMoreKeydown), document.addEventListener("pointerdown", (event) => {
    if (!viewerChromeState.viewerMobileMoreOpen) return;
    let target = event.target instanceof Node ? event.target : null;
    viewerElements.viewerMobileMoreMenu?.contains(target) || viewerElements.viewerMobileMoreToggle?.contains(target) || closeViewerMobileMoreMenu();
  }, { passive: !0 }), window.addEventListener("resize", () => {
    isMobileViewerToolbarMode() || closeViewerMobileMoreMenu();
  });
}

// src/js/65-viewer-onboarding.js
function getViewerOnboardingStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function viewerOnboardingWasSeen() {
  try {
    return getViewerOnboardingStorage()?.getItem(VIEWER_ONBOARDING_STORAGE_KEY) === "1";
  } catch {
    return !1;
  }
}
function markViewerOnboardingSeen() {
  try {
    getViewerOnboardingStorage()?.setItem(VIEWER_ONBOARDING_STORAGE_KEY, "1");
  } catch {
  }
}
function viewerHasTouchCapability() {
  return Number(navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
}
function viewerNavigationOnboardingCopy() {
  return viewerHasTouchCapability() ? "במסך מגע החליקו למעלה, למטה, ימינה או שמאלה כדי לעבור עמוד. אפשר גם להשתמש בחצים שבצדי המסך או במקשי החצים ו־Page Up/Down." : "גללו בעכבר או במשטח המגע, לחצו על החצים שבצדי המסך, או השתמשו במקשי החצים ו־Page Up/Down.";
}
function viewerZoomOnboardingCopy() {
  return viewerHasTouchCapability() ? "במסך מגע צבטו בשתי אצבעות או הקישו פעמיים. בעכבר אפשר ללחוץ פעמיים או להשתמש בגלגלת; לאחר ההגדלה גררו את התמונה." : "לחצו פעמיים על התמונה או השתמשו בגלגלת העכבר להגדלה; לאחר מכן גררו את התמונה למיקום הרצוי.";
}
function getViewerOnboardingSteps() {
  return [
    {
      id: "page-navigation",
      eyebrow: "צפייה פשוטה",
      title: "מעבר בין עמודים",
      description: viewerNavigationOnboardingCopy(),
      note: "למעבר מהיר לעמוד רחוק, פתחו את סרגל התמונות הממוזערות מהקצה הימני.",
      target: () => viewerElements.stageCanvas,
      targetRect: getViewerOnboardingNavigationFocusRect,
      floatingTargets: () => [
        { source: viewerElements.nextPageBtn, id: "next-page" },
        { source: viewerElements.prevPageBtn, id: "previous-page" }
      ],
      preferredPlacement: "above",
      padding: 0,
      radius: 26,
      gesture: "swipe-both"
    },
    {
      id: "zoom",
      eyebrow: "מבט מקרוב",
      title: "הגדלה וגרירת התמונה",
      description: viewerZoomOnboardingCopy(),
      target: () => viewerElements.lightboxImageFrame,
      targetRect: getViewerOnboardingImageFocusRect,
      preferredPlacement: "above",
      padding: 0,
      radius: 24,
      gesture: viewerHasTouchCapability() ? "pinch" : "double-tap"
    },
    {
      id: "inquiry",
      eyebrow: "מצאתם דגם מתאים?",
      title: "שמירה, שיתוף ובירור",
      description: "לחצו על „בירור על הדגם” כדי לפנות עם שם הקטלוג, מספר העמוד וקישור מדויק שכבר מוכנים עבורכם.",
      note: "הכוכב שומר את העמוד במועדפים, וכפתור השיתוף בסרגל העליון שולח קישור ישיר.",
      target: () => getFeatureInterface("inquiry")?.onboardingTarget() || null,
      floatingTargets: () => {
        let inquiryTarget = getFeatureInterface("inquiry")?.onboardingTarget(), favoriteTarget = getFeatureInterface("favorites")?.onboardingTarget();
        return [
          inquiryTarget ? { source: inquiryTarget, id: "inquiry" } : null,
          favoriteTarget ? { source: favoriteTarget, id: "favorite" } : null
        ].filter((target) => target !== null);
      },
      preferredPlacement: "left",
      padding: 8,
      radius: 24,
      gesture: "tap"
    }
  ];
}
function getViewerOnboardingNavigationFocusRect() {
  let source = viewerElements.stageCanvas?.getBoundingClientRect?.() || viewerElements.lightboxStage?.getBoundingClientRect?.();
  if (!source) return null;
  let viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0, viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0, width = Math.min(Math.max(240, source.width * 0.36), 460, Math.max(200, viewportWidth - 42)), height = Math.min(Math.max(150, source.height * 0.24), 230, Math.max(130, viewportHeight - 190)), centerX = source.left + source.width / 2, centerY = source.top + source.height / 2;
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    right: centerX + width / 2,
    bottom: centerY + height / 2,
    width,
    height
  };
}
function getViewerOnboardingImageFocusRect() {
  let source = viewerElements.lightboxImageFrame?.getBoundingClientRect?.() || viewerElements.stageCanvas?.getBoundingClientRect?.();
  if (!source) return null;
  let viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0, viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0, width = Math.min(Math.max(220, source.width * 0.46), 430, Math.max(180, viewportWidth - 36)), height = Math.min(Math.max(170, source.height * 0.38), 300, Math.max(140, viewportHeight - 180));
  return {
    left: source.left + (source.width - width) / 2,
    top: source.top + (source.height - height) / 2,
    right: source.left + (source.width + width) / 2,
    bottom: source.top + (source.height + height) / 2,
    width,
    height
  };
}
function getViewerOnboardingFocusableElements() {
  if (!viewerElements.viewerOnboarding) return [];
  let controls = Array.from(viewerElements.viewerOnboarding.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(isHtmlElement).filter((element) => !element.closest(".hidden")), targetControls = [
    ...(viewerOnboardingState.viewerOnboardingFloatingTargets || []).map((entry) => entry.clone),
    viewerOnboardingState.viewerOnboardingTarget
  ].filter(isHtmlElement).flatMap((target) => [
    ...target.matches?.('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ? [target] : [],
    ...Array.from(target.querySelectorAll?.('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') || [])
  ]);
  return [...new Set([...controls, ...targetControls].filter(isHtmlElement))];
}
function setViewerOnboardingShadeRect(element, left, top, width, height) {
  element && (element.style.left = `${Math.max(0, left)}px`, element.style.top = `${Math.max(0, top)}px`, element.style.width = `${Math.max(0, width)}px`, element.style.height = `${Math.max(0, height)}px`);
}
function normalizeViewerOnboardingRect(rawRect, padding = 0, viewportMargin = 6) {
  if (!rawRect) return null;
  let viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0, viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0, margin = Math.max(0, Number(viewportMargin || 0)), left = Math.max(margin, Number(rawRect.left || 0) - padding), top = Math.max(margin, Number(rawRect.top || 0) - padding), right = Math.min(viewportWidth - margin, Number(rawRect.right || 0) + padding), bottom = Math.min(viewportHeight - margin, Number(rawRect.bottom || 0) + padding);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top)
  };
}
function viewerOnboardingPlacementCandidates(preferred) {
  return [preferred, ...["below", "above", "left", "right"].filter((placement) => placement !== preferred)];
}
function calculateViewerOnboardingCalloutPosition(targetRect, calloutRect, preferredPlacement) {
  let viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0, viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0, margin = 12, gap = 18, coordinates = (placement) => placement === "above" ? { left: targetRect.left + (targetRect.width - calloutRect.width) / 2, top: targetRect.top - calloutRect.height - gap } : placement === "left" ? { left: targetRect.left - calloutRect.width - gap, top: targetRect.top + (targetRect.height - calloutRect.height) / 2 } : placement === "right" ? { left: targetRect.right + gap, top: targetRect.top + (targetRect.height - calloutRect.height) / 2 } : { left: targetRect.left + (targetRect.width - calloutRect.width) / 2, top: targetRect.bottom + gap }, overflowScore = ({ left, top }) => {
    let overflowLeft = Math.max(0, margin - left), overflowTop = Math.max(0, margin - top), overflowRight = Math.max(0, left + calloutRect.width + margin - viewportWidth), overflowBottom = Math.max(0, top + calloutRect.height + margin - viewportHeight);
    return overflowLeft + overflowTop + overflowRight + overflowBottom;
  }, maxLeft = Math.max(margin, viewportWidth - calloutRect.width - margin), maxTop = Math.max(margin, viewportHeight - calloutRect.height - margin), chosen = viewerOnboardingPlacementCandidates(preferredPlacement).map((placement) => {
    let point = coordinates(placement), left = clampValue(point.left, margin, maxLeft), top = clampValue(point.top, margin, maxTop), overlapWidth = Math.max(0, Math.min(left + calloutRect.width, targetRect.right) - Math.max(left, targetRect.left)), overlapHeight = Math.max(0, Math.min(top + calloutRect.height, targetRect.bottom) - Math.max(top, targetRect.top)), overlapArea = overlapWidth * overlapHeight, overflow = overflowScore(point);
    return {
      placement,
      left,
      top,
      overflow,
      overlapArea,
      score: (overlapArea > 0 ? 1e5 + overlapArea : 0) + overflow
    };
  }).sort((a, b) => a.score - b.score)[0];
  return {
    placement: chosen.placement,
    left: chosen.left,
    top: chosen.top
  };
}
function removeViewerOnboardingFloatingTargets() {
  (viewerOnboardingState.viewerOnboardingFloatingTargets || []).forEach((entry) => entry.clone?.remove?.()), viewerOnboardingState.viewerOnboardingFloatingTargets = [];
}
function sanitizeViewerOnboardingFloatingTarget(clone) {
  clone.removeAttribute("id"), clone.removeAttribute("aria-controls"), clone.removeAttribute("aria-describedby"), clone.querySelectorAll?.("[id]").forEach((element) => element.removeAttribute("id")), clone.querySelectorAll?.("[aria-controls]").forEach((element) => element.removeAttribute("aria-controls")), clone.classList.remove("hidden"), clone.removeAttribute("hidden");
}
function syncViewerOnboardingFloatingTargetState(source, clone) {
  ["aria-label", "aria-pressed", "title", "data-pinned", "data-fullscreen-active", "data-favorite-active"].forEach((attribute) => {
    let value = source.getAttribute(attribute);
    value !== null ? clone.setAttribute(attribute, value) : clone.removeAttribute(attribute);
  }), clone.disabled = source.disabled;
}
function getViewerOnboardingFloatingTargetDefinitions(step) {
  return (step.floatingTargets?.() || []).filter((entry) => entry.source instanceof HTMLButtonElement).map((entry, index) => ({
    source: entry.source,
    id: String(entry.id || `target-${index + 1}`)
  }));
}
function viewerOnboardingFloatingTargetsMatch(step, definitions) {
  let current = viewerOnboardingState.viewerOnboardingFloatingTargets || [];
  return current.length === definitions.length && current.every((entry, index) => entry.source === definitions[index].source && entry.id === definitions[index].id && entry.stepId === step.id);
}
function updateViewerOnboardingFloatingTargets(step) {
  let definitions = getViewerOnboardingFloatingTargetDefinitions(step);
  if (!definitions.length || !viewerElements.viewerOnboarding) {
    removeViewerOnboardingFloatingTargets();
    return;
  }
  viewerOnboardingFloatingTargetsMatch(step, definitions) || (removeViewerOnboardingFloatingTargets(), viewerOnboardingState.viewerOnboardingFloatingTargets = definitions.map(({ source, id }) => {
    let clone = (
      /** @type {HTMLButtonElement} */
      source.cloneNode(!0)
    );
    return sanitizeViewerOnboardingFloatingTarget(clone), clone.classList.add("viewer-onboarding-floating-target"), clone.dataset.tourStep = step.id, clone.dataset.tourTarget = id, clone.addEventListener("click", (event) => {
      event.preventDefault(), event.stopPropagation(), source.click(), window.requestAnimationFrame(() => {
        let isCurrentClone = (viewerOnboardingState.viewerOnboardingFloatingTargets || []).some((entry) => entry.clone === clone);
        !viewerOnboardingState.viewerOnboardingOpen || !isCurrentClone || (syncViewerOnboardingFloatingTargetState(source, clone), scheduleViewerOnboardingLayout(30));
      });
    }), viewerElements.viewerOnboarding.appendChild(clone), { source, clone, id, stepId: step.id };
  })), viewerOnboardingState.viewerOnboardingFloatingTargets.forEach(({ source, clone }) => {
    syncViewerOnboardingFloatingTargetState(source, clone);
    let rect = source.getBoundingClientRect();
    clone.style.left = `${rect.left}px`, clone.style.top = `${rect.top}px`, clone.style.width = `${rect.width}px`, clone.style.height = `${rect.height}px`;
  });
}
function layoutViewerOnboarding() {
  if (!viewerOnboardingState.viewerOnboardingOpen || !viewerElements.viewerOnboarding || !viewerElements.viewerOnboardingCard || !viewerElements.viewerOnboardingSpotlight) return;
  let step = getViewerOnboardingSteps()[viewerOnboardingState.viewerOnboardingStep];
  if (!step) return;
  let target = step.target?.() || null;
  viewerOnboardingState.viewerOnboardingTarget = target;
  let rawRect = step.targetRect?.() || target?.getBoundingClientRect?.(), targetRect = normalizeViewerOnboardingRect(
    rawRect,
    Number(step.padding || 0),
    step.viewportMargin === void 0 ? 6 : Number(step.viewportMargin)
  );
  if (!targetRect) return;
  updateViewerOnboardingFloatingTargets(step);
  let viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0, viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  setViewerOnboardingShadeRect(viewerElements.viewerOnboardingShadeTop, 0, 0, viewportWidth, targetRect.top), setViewerOnboardingShadeRect(viewerElements.viewerOnboardingShadeBottom, 0, targetRect.bottom, viewportWidth, viewportHeight - targetRect.bottom), setViewerOnboardingShadeRect(viewerElements.viewerOnboardingShadeLeft, 0, targetRect.top, targetRect.left, targetRect.height), setViewerOnboardingShadeRect(viewerElements.viewerOnboardingShadeRight, targetRect.right, targetRect.top, viewportWidth - targetRect.right, targetRect.height);
  let spotlight = viewerElements.viewerOnboardingSpotlight;
  spotlight.style.left = `${targetRect.left}px`, spotlight.style.top = `${targetRect.top}px`, spotlight.style.width = `${targetRect.width}px`, spotlight.style.height = `${targetRect.height}px`, spotlight.style.borderRadius = `${Number(step.radius || 18)}px`, spotlight.dataset.gesture = step.gesture || "", spotlight.dataset.tourStep = step.id || "";
  let calloutRect = viewerElements.viewerOnboardingCard.getBoundingClientRect(), calloutPosition = calculateViewerOnboardingCalloutPosition(targetRect, calloutRect, step.preferredPlacement || "below");
  viewerElements.viewerOnboardingCard.style.left = `${calloutPosition.left}px`, viewerElements.viewerOnboardingCard.style.top = `${calloutPosition.top}px`, viewerElements.viewerOnboardingCard.dataset.placement = calloutPosition.placement;
}
function scheduleViewerOnboardingLayout(delay = 0) {
  let run = () => {
    window.cancelAnimationFrame(viewerOnboardingState.viewerOnboardingLayoutRaf), viewerOnboardingState.viewerOnboardingLayoutRaf = window.requestAnimationFrame(layoutViewerOnboarding);
  };
  if (delay > 0) {
    window.clearTimeout(viewerOnboardingState.viewerOnboardingLayoutTimer), viewerOnboardingState.viewerOnboardingLayoutTimer = window.setTimeout(run, delay);
    return;
  }
  run();
}
function renderViewerOnboardingStep(options = {}) {
  if (!viewerOnboardingState.viewerOnboardingOpen) return;
  let { focus = !0, scheduleLayout = !0 } = options, steps = getViewerOnboardingSteps();
  viewerOnboardingState.viewerOnboardingStep = clampValue(viewerOnboardingState.viewerOnboardingStep, 0, Math.max(0, steps.length - 1));
  let step = steps[viewerOnboardingState.viewerOnboardingStep];
  if (!step) return;
  (viewerOnboardingState.viewerOnboardingFloatingTargets || []).every((entry) => entry.stepId === step.id) || removeViewerOnboardingFloatingTargets(), viewerElements.lightbox?.classList.toggle("viewer-tour-show-top-ui", !!step.revealTopBar), viewerElements.lightbox?.classList.toggle("viewer-tour-show-page-rail", !!step.revealPageRail), step.revealTopBar && window.clearTimeout(viewerChromeState.uiHideTimer), step.revealPageRail && window.clearTimeout(viewerChromeState.pageRailHideTimer), viewerElements.viewerOnboardingEyebrow && (viewerElements.viewerOnboardingEyebrow.textContent = step.eyebrow || "סיור קצר"), viewerElements.viewerOnboardingTitle && (viewerElements.viewerOnboardingTitle.textContent = step.title), viewerElements.viewerOnboardingDescription && (viewerElements.viewerOnboardingDescription.textContent = step.description), viewerElements.viewerOnboardingCounter && (viewerElements.viewerOnboardingCounter.textContent = `${viewerOnboardingState.viewerOnboardingStep + 1} מתוך ${steps.length}`), viewerElements.viewerOnboardingNote && (viewerElements.viewerOnboardingNote.textContent = step.note || "", viewerElements.viewerOnboardingNote.classList.toggle("hidden", !step.note)), viewerElements.viewerOnboardingPrevious && (viewerElements.viewerOnboardingPrevious.disabled = viewerOnboardingState.viewerOnboardingStep === 0), viewerElements.viewerOnboardingNext && (viewerElements.viewerOnboardingNext.textContent = viewerOnboardingState.viewerOnboardingStep === steps.length - 1 ? "סיום" : "הבא"), viewerElements.viewerOnboardingDots && (viewerElements.viewerOnboardingDots.innerHTML = steps.map((_, index) => `<span${index === viewerOnboardingState.viewerOnboardingStep ? ' class="active"' : ""}></span>`).join("")), scheduleLayout && (scheduleViewerOnboardingLayout(), scheduleViewerOnboardingLayout(260)), focus && window.requestAnimationFrame(() => viewerElements.viewerOnboardingNext?.focus?.({ preventScroll: !0 }));
}
function moveViewerOnboardingStep(delta) {
  if (!viewerOnboardingState.viewerOnboardingOpen) return;
  let steps = getViewerOnboardingSteps(), nextStep = viewerOnboardingState.viewerOnboardingStep + delta;
  if (nextStep >= steps.length) {
    closeViewerOnboarding();
    return;
  }
  viewerOnboardingState.viewerOnboardingStep = clampValue(nextStep, 0, Math.max(0, steps.length - 1)), renderViewerOnboardingStep();
}
function restoreViewerUiAfterOnboarding() {
  let restore = viewerOnboardingState.viewerOnboardingRestoreUi || { showUi: !1, showPageRail: !1 };
  viewerElements.lightbox?.classList.remove("viewer-tour-active", "viewer-tour-show-top-ui", "viewer-tour-show-page-rail"), viewerElements.lightbox && (viewerChromeState.topUiPinned || restore.showUi ? viewerElements.lightbox.classList.add("show-ui") : viewerElements.lightbox.classList.remove("show-ui"), restore.showPageRail ? viewerElements.lightbox.classList.add("show-page-rail") : viewerElements.lightbox.classList.remove("show-page-rail")), viewerOnboardingState.viewerOnboardingRestoreUi = null;
}
function closeViewerOnboarding(options = {}) {
  if (!viewerOnboardingState.viewerOnboardingOpen) return;
  let { restoreFocus = !0, remember = !0 } = options;
  viewerOnboardingState.viewerOnboardingOpen = !1, viewerOnboardingState.viewerOnboardingTarget = null, removeViewerOnboardingFloatingTargets(), window.cancelAnimationFrame(viewerOnboardingState.viewerOnboardingLayoutRaf), window.clearTimeout(viewerOnboardingState.viewerOnboardingLayoutTimer), remember && markViewerOnboardingSeen(), restoreViewerUiAfterOnboarding(), viewerElements.viewerOnboarding?.classList.remove("visible"), viewerElements.viewerOnboarding?.setAttribute("aria-hidden", "true"), window.setTimeout(() => {
    viewerOnboardingState.viewerOnboardingOpen || (viewerElements.viewerOnboarding?.classList.add("hidden"), viewerElements.viewerOnboarding?.classList.remove("layout-ready"));
  }, 220), restoreFocus && viewerElements.stageCanvas?.focus?.({ preventScroll: !0 });
}
function showViewerOnboardingIfNeeded() {
  !isViewerSessionOpen() || !viewerElements.viewerOnboarding || viewerOnboardingState.viewerOnboardingOpen || viewerOnboardingState.viewerOnboardingShownThisSession || viewerOnboardingWasSeen() || (viewerOnboardingState.viewerOnboardingShownThisSession = !0, viewerOnboardingState.viewerOnboardingOpen = !0, viewerOnboardingState.viewerOnboardingStep = 0, viewerOnboardingState.viewerOnboardingRestoreUi = {
    showUi: !!viewerElements.lightbox?.classList.contains("show-ui"),
    showPageRail: !!viewerElements.lightbox?.classList.contains("show-page-rail")
  }, viewerElements.lightbox?.classList.add("viewer-tour-active"), viewerElements.viewerOnboarding.classList.remove("hidden", "visible", "layout-ready"), viewerElements.viewerOnboarding.setAttribute("aria-hidden", "false"), window.requestAnimationFrame(() => {
    viewerOnboardingState.viewerOnboardingOpen && (renderViewerOnboardingStep({ focus: !1, scheduleLayout: !1 }), window.requestAnimationFrame(() => {
      viewerOnboardingState.viewerOnboardingOpen && (layoutViewerOnboarding(), viewerElements.viewerOnboarding.classList.add("layout-ready"), window.requestAnimationFrame(() => {
        viewerOnboardingState.viewerOnboardingOpen && (viewerElements.viewerOnboarding.classList.add("visible"), viewerElements.viewerOnboardingNext?.focus?.({ preventScroll: !0 }), scheduleViewerOnboardingLayout(260));
      }));
    }));
  }));
}
function handleViewerOnboardingKeydown(event) {
  if (!viewerOnboardingState.viewerOnboardingOpen) return !1;
  if (event.key === "Escape")
    return event.preventDefault(), closeViewerOnboarding(), !0;
  if (event.key !== "Tab") return !0;
  let focusable = getViewerOnboardingFocusableElements();
  if (!focusable.length)
    return event.preventDefault(), !0;
  let first = focusable[0], last = focusable[focusable.length - 1];
  return event.shiftKey && document.activeElement === first ? (event.preventDefault(), focusHtmlElement(last)) : !event.shiftKey && document.activeElement === last && (event.preventDefault(), focusHtmlElement(first)), !0;
}
function attachViewerOnboardingEvents() {
  viewerElements.viewerOnboardingPrevious?.addEventListener("click", () => moveViewerOnboardingStep(-1)), viewerElements.viewerOnboardingNext?.addEventListener("click", () => moveViewerOnboardingStep(1)), viewerElements.viewerOnboardingSkip?.addEventListener("click", () => closeViewerOnboarding());
}

// src/js/70-viewer-input.js
function getZoomSurfaceName(surface) {
  return surface === viewerElements.stageCanvas ? "catalog-page" : "";
}
function isActiveZoomSurface(surface) {
  return !!getZoomSurfaceName(surface);
}
function captureViewerPointer(surface, pointerId) {
  if (!surface || !("setPointerCapture" in surface) || typeof surface.setPointerCapture != "function")
    return !1;
  try {
    return surface.setPointerCapture(pointerId), !0;
  } catch (error) {
    if (error && typeof error == "object" && "name" in error && error.name === "NotFoundError")
      return !1;
    throw error;
  }
}
function releaseViewerPointerCapture(surface, pointerId) {
  if (!surface || !("releasePointerCapture" in surface) || typeof surface.releasePointerCapture != "function")
    return !1;
  try {
    return "hasPointerCapture" in surface && typeof surface.hasPointerCapture == "function" && !surface.hasPointerCapture(pointerId) ? !1 : (surface.releasePointerCapture(pointerId), !0);
  } catch (error) {
    if (error && typeof error == "object" && "name" in error && error.name === "NotFoundError")
      return !1;
    throw error;
  }
}
function getViewerPointerEventTime(event) {
  let eventTime = Number(event?.timeStamp);
  return Number.isFinite(eventTime) && eventTime > 0 ? eventTime : Date.now();
}
function stopViewerTouchMomentum() {
  viewerGestureState.viewerTouchMomentumRaf && window.cancelAnimationFrame(viewerGestureState.viewerTouchMomentumRaf), viewerGestureState.viewerTouchMomentumRaf = 0, viewerGestureState.viewerTouchMomentumVelocityX = 0, viewerGestureState.viewerTouchMomentumVelocityY = 0, viewerGestureState.viewerTouchMomentumLastTime = 0;
}
function getViewerPointerMoveSamples(event) {
  let samples = [];
  if (typeof event?.getCoalescedEvents == "function")
    try {
      let coalesced = event.getCoalescedEvents();
      Array.isArray(coalesced) && (samples = coalesced.filter(Boolean));
    } catch {
    }
  let finalSample = samples[samples.length - 1];
  return (!finalSample || finalSample.clientX !== event.clientX || finalSample.clientY !== event.clientY) && samples.push(event), samples;
}
function updateViewerPointerVelocity(point, deltaX, deltaY, sampleTime) {
  let elapsed = sampleTime - point.lastTime, safeElapsed = Number.isFinite(elapsed) && elapsed > 0 ? Math.min(elapsed, VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS) : 16.67, instantVelocityX = deltaX / safeElapsed, instantVelocityY = deltaY / safeElapsed, sampleIsFresh = Number.isFinite(elapsed) && elapsed > 0 && elapsed <= VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS, previousWeight = sampleIsFresh ? 1 - VIEWER_TOUCH_VELOCITY_BLEND : 0, nextWeight = sampleIsFresh ? VIEWER_TOUCH_VELOCITY_BLEND : 1;
  return {
    velocityX: (Number(point.velocityX) || 0) * previousWeight + instantVelocityX * nextWeight,
    velocityY: (Number(point.velocityY) || 0) * previousWeight + instantVelocityY * nextWeight,
    lastTime: sampleTime
  };
}
function consumeViewerPointerPanSamples(event, initialPoint) {
  let point = initialPoint, totalDeltaX = 0, totalDeltaY = 0;
  for (let sample of getViewerPointerMoveSamples(event)) {
    let x = Number(sample.clientX), y = Number(sample.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    let deltaX = point.x - x, deltaY = point.y - y;
    if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) continue;
    let sampleTime = getViewerPointerEventTime(sample), velocity = updateViewerPointerVelocity(point, deltaX, deltaY, sampleTime);
    totalDeltaX += deltaX, totalDeltaY += deltaY, point = {
      ...point,
      x,
      y,
      ...velocity
    };
  }
  if (viewerGestureState.pointers.set(event.pointerId, point), Math.abs(totalDeltaX) < 0.01 && Math.abs(totalDeltaY) < 0.01)
    return { point, handled: !1, moved: !1, turned: !1 };
  let boundary = consumeSingleViewerBoundaryInput(totalDeltaX, totalDeltaY, {
    pointerId: event.pointerId,
    navigationSource: VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN
  });
  return {
    point,
    handled: boundary.handled,
    moved: boundary.moved,
    turned: boundary.turned
  };
}
function clampViewerTouchMomentumVelocity(velocityX, velocityY) {
  let safeVelocityX = Number.isFinite(velocityX) ? velocityX : 0, safeVelocityY = Number.isFinite(velocityY) ? velocityY : 0, speed = Math.hypot(safeVelocityX, safeVelocityY);
  if (speed <= VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS)
    return { velocityX: safeVelocityX, velocityY: safeVelocityY };
  let scale = VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS / speed;
  return {
    velocityX: safeVelocityX * scale,
    velocityY: safeVelocityY * scale
  };
}
function scheduleViewerTouchMomentumFrame() {
  viewerGestureState.viewerTouchMomentumRaf = window.requestAnimationFrame(runViewerTouchMomentumFrame), assertViewerStateInvariants("schedule-touch-momentum");
}
function runViewerTouchMomentumFrame(timestamp) {
  if (viewerGestureState.viewerTouchMomentumRaf = 0, !isViewerSessionOpen() || viewerGestureState.pointers.size > 0 || !singleViewerUsesBoundaryPan()) {
    stopViewerTouchMomentum();
    return;
  }
  let frameTime = Number(timestamp);
  if (!Number.isFinite(frameTime)) {
    stopViewerTouchMomentum();
    return;
  }
  if (!viewerGestureState.viewerTouchMomentumLastTime) {
    viewerGestureState.viewerTouchMomentumLastTime = frameTime, scheduleViewerTouchMomentumFrame();
    return;
  }
  let elapsed = clampValue(
    frameTime - viewerGestureState.viewerTouchMomentumLastTime,
    1,
    VIEWER_TOUCH_MOMENTUM_MAX_FRAME_MS
  );
  viewerGestureState.viewerTouchMomentumLastTime = frameTime;
  let velocityX = viewerGestureState.viewerTouchMomentumVelocityX, velocityY = viewerGestureState.viewerTouchMomentumVelocityY, boundary = consumeSingleViewerBoundaryInput(
    velocityX * elapsed,
    velocityY * elapsed,
    { navigationSource: VIEWER_NAVIGATION_SOURCE_MOMENTUM }
  );
  if (!boundary.handled) {
    stopViewerTouchMomentum();
    return;
  }
  let remainingDeltaX = boundary.result?.remainingDeltaX || 0, remainingDeltaY = boundary.result?.remainingDeltaY || 0;
  Math.abs(remainingDeltaX) > VIEWER_PAGE_TURN_REMAINDER_EPSILON && Math.sign(remainingDeltaX) === Math.sign(velocityX) && (velocityX = 0), !boundary.turned && Math.abs(remainingDeltaY) > VIEWER_PAGE_TURN_REMAINDER_EPSILON && Math.sign(remainingDeltaY) === Math.sign(velocityY) && (velocityY = 0);
  let decay = Math.exp(-VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS * elapsed);
  if (velocityX *= decay, velocityY *= decay, Math.abs(velocityX) < VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS && (velocityX = 0), Math.abs(velocityY) < VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS && (velocityY = 0), viewerGestureState.viewerTouchMomentumVelocityX = velocityX, viewerGestureState.viewerTouchMomentumVelocityY = velocityY, !velocityX && !velocityY) {
    stopViewerTouchMomentum();
    return;
  }
  scheduleViewerTouchMomentumFrame();
}
function startViewerTouchMomentum(velocityX, velocityY) {
  if (stopViewerTouchMomentum(), viewerGestureState.pointers.size > 0) return !1;
  let velocity = clampViewerTouchMomentumVelocity(velocityX, velocityY);
  return Math.hypot(velocity.velocityX, velocity.velocityY) < VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS ? !1 : (viewerGestureState.viewerTouchMomentumVelocityX = velocity.velocityX, viewerGestureState.viewerTouchMomentumVelocityY = velocity.velocityY, scheduleViewerTouchMomentumFrame(), !0);
}
function startPointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;
  stopViewerTouchMomentum(), viewerGestureState.pointers.size === 0 && (viewerGestureState.pointerGestureHadMultiplePointers = !1, viewerGestureState.pointerGestureConsumedPan = !1), viewerGestureState.pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    velocityX: 0,
    velocityY: 0,
    lastTime: getViewerPointerEventTime(event)
  }), viewerGestureState.pointers.size >= 2 && (viewerGestureState.pointerGestureHadMultiplePointers = !0), (singleViewerUsesBoundaryPan() || viewerGestureState.pointers.size >= 2) && captureViewerPointer(event.currentTarget, event.pointerId);
  let pointers = getPointerList();
  if (pointers.length === 1)
    viewerGestureState.dragStartX = event.clientX, viewerGestureState.dragStartY = event.clientY, viewerGestureState.dragStartPanX = viewerViewportState.panX, viewerGestureState.dragStartPanY = viewerViewportState.panY;
  else if (pointers.length === 2) {
    let [first, second] = pointers, mid = pointerMidpoint(first, second);
    viewerGestureState.pinchStartDistance = Math.max(1, pointerDistance(first, second)), viewerGestureState.pinchStartZoom = viewerViewportState.zoom, viewerGestureState.pinchLastMidX = mid.x, viewerGestureState.pinchLastMidY = mid.y;
    for (let pointerId of viewerGestureState.pointers.keys())
      captureViewerPointer(event.currentTarget, pointerId);
    event.preventDefault();
  }
  assertViewerStateInvariants("start-pointer-interaction");
}
function movePointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;
  let previousPoint = viewerGestureState.pointers.get(event.pointerId);
  if (!previousPoint) return;
  let pointerCount = viewerGestureState.pointers.size;
  if (pointerCount >= 2) {
    viewerGestureState.pointers.set(event.pointerId, {
      ...previousPoint,
      x: event.clientX,
      y: event.clientY,
      lastTime: getViewerPointerEventTime(event),
      velocityX: 0,
      velocityY: 0
    });
    let pointers = getPointerList();
    event.preventDefault(), viewerGestureState.pointerGestureConsumedPan = !0;
    let [first, second] = pointers, distance = Math.max(1, pointerDistance(first, second)), mid = pointerMidpoint(first, second);
    viewerViewportState.panX += mid.x - viewerGestureState.pinchLastMidX, viewerViewportState.panY += mid.y - viewerGestureState.pinchLastMidY, viewerGestureState.pinchLastMidX = mid.x, viewerGestureState.pinchLastMidY = mid.y, setZoom(viewerGestureState.pinchStartZoom * (distance / viewerGestureState.pinchStartDistance), {
      showUi: !1,
      focalClientX: mid.x,
      focalClientY: mid.y
    });
    return;
  }
  pointerCount === 1 && singleViewerUsesBoundaryPan() && (event.preventDefault(), consumeViewerPointerPanSamples(event, previousPoint).handled && (viewerGestureState.pointerGestureConsumedPan = !0));
}
function handlePotentialDoubleTap(event, startedX, startedY) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen" || viewerGestureState.pointers.size > 0 || viewerGestureState.pointerGestureConsumedPan) return !1;
  if (Math.hypot(event.clientX - startedX, event.clientY - startedY) > TAP_MOVE_TOLERANCE)
    return viewerGestureState.lastTapAt = 0, !1;
  let now = Date.now(), surface = getZoomSurfaceName(event.currentTarget), closeToLastTap = Math.hypot(event.clientX - viewerGestureState.lastTapX, event.clientY - viewerGestureState.lastTapY) <= DOUBLE_TAP_DISTANCE, isDoubleTap = surface === viewerGestureState.lastTapSurface && now - viewerGestureState.lastTapAt <= DOUBLE_TAP_DELAY && closeToLastTap;
  return viewerGestureState.lastTapAt = now, viewerGestureState.lastTapX = event.clientX, viewerGestureState.lastTapY = event.clientY, viewerGestureState.lastTapSurface = surface, isDoubleTap ? (event.preventDefault(), viewerGestureState.lastTapAt = 0, viewerGestureState.suppressNextDblClickUntil = now + 550, toggleZoomAtPoint(event.clientX, event.clientY), !0) : !1;
}
function handleViewerPageSwipe(event, startedX, startedY) {
  if (!isTouchLikePointer(event) || viewerGestureState.pointers.size > 0 || viewerGestureState.pointerGestureHadMultiplePointers || viewerGestureState.pointerGestureConsumedPan) return !1;
  let dx = event.clientX - startedX, dy = event.clientY - startedY, horizontal = Math.abs(dx) > Math.abs(dy), primaryDistance = Math.abs(horizontal ? dx : dy), secondaryDistance = Math.abs(horizontal ? dy : dx);
  if (primaryDistance <= VIEWER_PAGE_SWIPE_MIN_DISTANCE || primaryDistance <= secondaryDistance * VIEWER_PAGE_SWIPE_AXIS_RATIO)
    return !1;
  event.preventDefault();
  let direction = horizontal ? dx > 0 ? 1 : -1 : dy < 0 ? 1 : -1;
  return horizontal ? moveLightbox(direction, {
    navigationCommand: createViewerNavigationCommand(
      VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE,
      direction,
      { axis: "x" }
    )
  }) : moveLightboxFromPageTurn(direction, "y", { navigationSource: VIEWER_NAVIGATION_SOURCE_VERTICAL_SWIPE }), !0;
}
function endPointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;
  let tracked = viewerGestureState.pointers.get(event.pointerId);
  if (!tracked) return;
  if (viewerGestureState.pointers.size === 1 && singleViewerUsesBoundaryPan() && (Math.abs(tracked.x - event.clientX) >= 0.01 || Math.abs(tracked.y - event.clientY) >= 0.01)) {
    event.preventDefault();
    let finalPan = consumeViewerPointerPanSamples(event, tracked);
    tracked = finalPan.point, finalPan.handled && (viewerGestureState.pointerGestureConsumedPan = !0);
  }
  let velocityAge = getViewerPointerEventTime(event) - tracked.lastTime, velocityIsFresh = velocityAge >= 0 && velocityAge <= VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS, shouldStartMomentum = !!(isTouchLikePointer(event) && viewerGestureState.pointers.size === 1 && !viewerGestureState.pointerGestureHadMultiplePointers && viewerGestureState.pointerGestureConsumedPan && velocityIsFresh);
  viewerGestureState.pointers.delete(event.pointerId), handlePotentialDoubleTap(event, tracked.startX, tracked.startY) || handleViewerPageSwipe(event, tracked.startX, tracked.startY);
  let pointers = getPointerList();
  if (pointers.length === 1) {
    let only = pointers[0];
    viewerGestureState.dragStartX = only.x, viewerGestureState.dragStartY = only.y, viewerGestureState.dragStartPanX = viewerViewportState.panX, viewerGestureState.dragStartPanY = viewerViewportState.panY;
  } else pointers.length === 0 && (viewerGestureState.pointerGestureHadMultiplePointers = !1, viewerGestureState.pointerGestureConsumedPan = !1);
  releaseViewerPointerCapture(event.currentTarget, event.pointerId), shouldStartMomentum && startViewerTouchMomentum(tracked.velocityX, tracked.velocityY), assertViewerStateInvariants("end-pointer-interaction");
}
function cancelPointerInteraction(event) {
  viewerGestureState.pointers.has(event.pointerId) && (viewerGestureState.pointers.delete(event.pointerId), viewerGestureState.pointers.size === 0 && (viewerGestureState.pointerGestureHadMultiplePointers = !1, viewerGestureState.pointerGestureConsumedPan = !1, stopViewerTouchMomentum()), assertViewerStateInvariants("cancel-pointer-interaction"));
}
function getWheelZoomFactor(event) {
  let pixelMode = typeof WheelEvent < "u" ? WheelEvent.DOM_DELTA_PIXEL : 0, lineMode = typeof WheelEvent < "u" ? WheelEvent.DOM_DELTA_LINE : 1, pageMode = typeof WheelEvent < "u" ? WheelEvent.DOM_DELTA_PAGE : 2, rawDelta = Number(event.deltaY), currentTarget = event.currentTarget, pageSize2 = currentTarget && "clientHeight" in currentTarget && Number(currentTarget.clientHeight) || 0, delta = normalizeWheelDeltaToPixels(rawDelta, event.deltaMode, pageSize2);
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return 1;
  let direction = delta < 0 ? 1 : -1, absoluteDelta = Math.abs(delta);
  if (event.deltaMode === lineMode || event.deltaMode === pageMode || event.deltaMode === pixelMode && absoluteDelta >= 40) {
    let detents = event.deltaMode === lineMode ? Math.max(1, Math.abs(rawDelta) / 3) : event.deltaMode === pageMode ? 1 : Math.max(1, absoluteDelta / 100), boundedDetents = clampValue(detents, 1, 3);
    return Math.pow(1.12, direction * boundedDetents);
  }
  let precisionDelta = clampValue(delta, -20, 20);
  return Math.exp(-precisionDelta * 0.011);
}
function handleZoomSurfaceWheel(event) {
  if (!(!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget))) {
    if (stopViewerTouchMomentum(), event.ctrlKey || event.metaKey) {
      event.preventDefault(), event.stopPropagation();
      let factor = getWheelZoomFactor(event);
      if (factor === 1) return;
      setZoom(viewerViewportState.zoom * factor, {
        showUi: !1,
        focalClientX: event.clientX,
        focalClientY: event.clientY
      });
      return;
    }
    handleViewerPageWheel(event);
  }
}
function handleZoomSurfaceDoubleClick(event) {
  !isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget) || Date.now() < viewerGestureState.suppressNextDblClickUntil || (event.preventDefault(), event.stopPropagation(), toggleZoomAtPoint(event.clientX, event.clientY));
}
function attachZoomSurfaceGestures(surface) {
  surface && (surface.addEventListener("pointerdown", startPointerInteraction), surface.addEventListener("pointermove", movePointerInteraction), surface.addEventListener("pointerup", endPointerInteraction), surface.addEventListener("pointercancel", cancelPointerInteraction), surface.addEventListener("wheel", handleZoomSurfaceWheel, { passive: !1 }), surface.addEventListener("dblclick", handleZoomSurfaceDoubleClick));
}
function attachViewerGestures() {
  attachZoomSurfaceGestures(viewerElements.stageCanvas);
}
function isLightboxTopInteractiveTarget(target) {
  let element = eventTargetElement(target);
  if (!element) return !1;
  let interactiveTarget = element.closest(
    ".lightbox-reader-header, .lightbox-search-results, .reader-catalog-menu, .reader-search-scope-menu"
  );
  return !!(interactiveTarget && viewerElements.lightboxBar?.contains(interactiveTarget));
}
function hideLightboxTopSearchFromViewerInteraction(event) {
  return !isViewerSessionOpen() || event?.button !== void 0 && event.button !== 0 || isLightboxTopInteractiveTarget(event?.target) ? !1 : (getFeatureInterface("search")?.isLightboxMobileOpen?.() ? getFeatureInterface("search")?.setLightboxMobileOpen?.(!1, { hideResults: !0, hideTopUi: !0 }) : hideLightboxSearchResults({ blurTopUiFocus: !0, hideTopUi: !0 }), !0);
}
function handleViewerSurfacePointerDown(event) {
  hideLightboxTopSearchFromViewerInteraction(event);
}
function handleLightboxPointerDownCapture(event) {
  stopViewerTouchMomentum(), hideLightboxTopSearchFromViewerInteraction(event);
}

// src/js/60-viewer.js
var viewerLayoutRefreshRaf = 0, viewerStageResizeObserver = null;
function openLightbox(page = void 0, options = {}) {
  let catalog = activeCatalog();
  if (!catalog) return;
  let source = options.source === LIGHTBOX_SOURCE_FAVORITES ? LIGHTBOX_SOURCE_FAVORITES : LIGHTBOX_SOURCE_CATALOG;
  if (!isAppPage("viewer")) {
    navigateTo(viewerDocumentUrl(catalog.id, page, { source }));
    return;
  }
  setActiveViewerSource(source);
  let favorites = getFeatureInterface("favorites");
  source === LIGHTBOX_SOURCE_FAVORITES ? favorites?.setViewerIndex(Math.max(0, Number.parseInt(String(options.favoriteIndex ?? ""), 10) || 0)) : favorites?.resetViewerSession(), setActivePage(clampPage(page, catalog)), viewerViewportState.imageFitModeSource = normalizeViewerFitModeSource(viewerViewportState.imageFitModeSource), viewerViewportState.imageFitMode = viewerUsesAutomaticFitMode() ? getAutomaticViewerFitMode() : normalizeViewerFitMode(viewerViewportState.imageFitMode), stopViewerTouchMomentum(), clearViewerPageWheelGesture(), clearViewerImagePreparations(), initializeViewerOpenStateCommand(), hideViewerZoomIndicator(), closeViewerInquiry({ restoreFocus: !1 }), closeViewerMobileMoreMenu(), transitionViewerPhase(VIEWER_PHASE_OPENING, "open-lightbox"), telemetryTrackCatalogOpen(catalog, activePage(), activeViewerSource()), primeLightboxFrameForCatalogPage(catalog, activePage());
  let initialSrc = viewerPageSrc(catalog, activePage());
  viewerElements.lightboxImage?.getAttribute("src") !== initialSrc && (viewerElements.lightboxImage?.removeAttribute("src"), prepareImagePlaceholder(viewerElements.lightboxImage), viewerElements.lightboxImageFrame?.classList.remove("page-swap-enter")), viewerElements.lightbox.classList.remove("hidden"), viewerElements.lightbox.classList.remove("show-ui", "show-page-rail"), syncTopUiPinnedUi(), syncDocumentLock(), renderLightboxPageRail(), isFavoritesLightboxMode() || renderLightboxCatalogMenu(), resetLightboxSearch(), syncLightboxModeUi(), syncFullscreenButtonUi(), showTopUiTemporarily(1700), updateLightbox(), getFeatureInterface("catalog-grid")?.scheduleScrollTopButtonUpdate?.(), transitionViewerPhase(VIEWER_PHASE_OPEN, "lightbox-ready"), window.requestAnimationFrame(showViewerOnboardingIfNeeded);
}
function hideLightboxUi() {
  transitionViewerPhase(VIEWER_PHASE_CLOSING, "hide-lightbox"), closeViewerOnboarding({ restoreFocus: !1 }), closeViewerInquiry({ restoreFocus: !1 }), closeViewerMobileMoreMenu(), getFeatureInterface("search")?.setLightboxMobileOpen?.(!1, { hideResults: !0 }), invalidateViewerImageSwapCommand(), stopViewerTouchMomentum(), clearViewerPageWheelGesture(), clearSingleImagePendingPosition(), clearViewerImagePreparations(), clearSingleViewerResolutionUpgrade(), window.clearTimeout(viewerImageState.singleImageAnimationTimer), viewerElements.lightbox?.classList.add("hidden"), viewerElements.lightbox?.classList.remove("show-ui", "show-page-rail", "catalog-entry-mode", "favorites-viewer-mode", "viewer-layout-paged", "viewer-layout-scroll", "viewer-layout-side", "viewer-scroll-zoom-isolated", "is-page-loading", "is-zoomed"), syncViewerAutoZoomButtonUi(), hideViewerZoomIndicator(), viewerElements.lightboxImageFrame?.classList.remove("page-swap-enter"), setViewerLoading(!1), hideLightboxFloatingPreview(), window.clearTimeout(viewerChromeState.uiHideTimer), window.clearTimeout(viewerChromeState.pageRailHideTimer), hideViewerPageIndicator(), getFeatureInterface("catalog-grid")?.scheduleScrollTopButtonUpdate?.(), setActiveViewerSource(LIGHTBOX_SOURCE_CATALOG), transitionViewerPhase(VIEWER_PHASE_CLOSED, "lightbox-hidden"), finalizeViewerClosedStateCommand(), syncDocumentLock();
}
function closeLightbox(options = {}) {
  let wasFavoritesViewer = isFavoritesLightboxMode(), { restoreFavorites = wasFavoritesViewer } = options;
  if (isAppPage("viewer")) {
    if ((hasInDocumentRouteSession || canReturnToSameSite()) && window.history.length > 1) {
      navigateBack();
      return;
    }
    let catalogId = activeCatalog()?.id || "", destination = wasFavoritesViewer && restoreFavorites ? favoritesDocumentUrl() : catalogId ? catalogDocumentUrl(catalogId) : homeDocumentUrl();
    navigateTo(destination || homeDocumentUrl(), { replace: !0 });
    return;
  }
  hideLightboxUi();
}
function openCatalogInViewer(id, page = void 0, options = {}) {
  let catalog = catalogs.find((item) => item.id === id) || null;
  if (!catalog) return;
  let source = options.source === LIGHTBOX_SOURCE_FAVORITES ? LIGHTBOX_SOURCE_FAVORITES : LIGHTBOX_SOURCE_CATALOG;
  if (!isAppPage("viewer")) {
    navigateTo(viewerDocumentUrl(catalog.id, page, { source }));
    return;
  }
  setActiveLocation(catalog, clampPage(page, catalog), source), openLightbox(activePage(), { source, favoriteIndex: options.favoriteIndex });
}
function attachViewerEvents() {
  attachViewerShareEvents(), attachViewerPageControllerEvents(), viewerElements.lightboxHomeLink?.addEventListener("click", returnToMainSiteFromLightbox), viewerElements.lightboxPinTopBar?.addEventListener("click", () => {
    toggleTopUiPinned(), syncViewerMobileMoreMenuState(), viewerOnboardingState.viewerOnboardingOpen && scheduleViewerOnboardingLayout(40);
  }), viewerElements.lightboxBackdrop?.addEventListener("click", () => closeLightbox()), viewerElements.lightbox?.addEventListener("pointerdown", handleLightboxPageRailEdgePointerDown, { capture: !0, passive: !1 }), viewerElements.lightbox?.addEventListener("pointerdown", handleLightboxPointerDownCapture, { capture: !0 }), viewerElements.fullscreenToggle?.addEventListener("click", () => toggleBrowserFullscreen(viewerElements.fullscreenToggle)), viewerElements.prevPageBtn?.addEventListener("click", () => moveLightbox(-1, { navigationSource: VIEWER_NAVIGATION_SOURCE_BUTTON })), viewerElements.nextPageBtn?.addEventListener("click", () => moveLightbox(1, { navigationSource: VIEWER_NAVIGATION_SOURCE_BUTTON })), viewerElements.fitAutoBtn?.addEventListener("click", () => {
    setViewerAutomaticFitMode(), syncViewerMobileMoreMenuState();
  }), viewerElements.fitHeightBtn?.addEventListener("click", () => {
    setViewerFitMode(VIEWER_FIT_HEIGHT), syncViewerMobileMoreMenuState();
  }), viewerElements.fitWidthBtn?.addEventListener("click", () => {
    setViewerFitMode(VIEWER_FIT_WIDTH), syncViewerMobileMoreMenuState();
  }), viewerElements.viewerAutoZoomBtn?.addEventListener("click", (event) => {
    event.preventDefault(), event.stopPropagation(), setZoom(AUTO_VIEWER_ZOOM, { showUi: !1 });
  }), viewerElements.viewerAutoZoomBtn?.addEventListener("pointerdown", (event) => event.stopPropagation()), viewerElements.stageCanvas?.addEventListener("pointerdown", handleViewerSurfacePointerDown), viewerElements.viewerImageRetry?.addEventListener("click", retryCurrentViewerImage), attachViewerGestures(), viewerElements.lightboxSideHotspot?.addEventListener("pointerdown", openPageRailFromTouch, { passive: !1 }), viewerElements.lightboxSideHotspot?.addEventListener("mouseenter", showPageRailFromHover), viewerElements.lightboxSideHotspot?.addEventListener("mouseleave", schedulePageRailClose), viewerElements.lightboxSideHotspot?.addEventListener("click", openPageRailFromHotspot), viewerElements.lightboxPageRail?.addEventListener("pointerdown", markTouchLikeRailInput), viewerElements.lightboxPageRail?.addEventListener("mouseenter", keepPageRailOpenFromHover), viewerElements.lightboxPageRail?.addEventListener("mouseleave", (event) => {
    hideLightboxFloatingPreview(), schedulePageRailClose(event);
  }), viewerElements.lightbox?.addEventListener("pointerdown", handlePageRailPointerOutside), viewerElements.lightboxPageRail?.addEventListener("focusin", () => keepPageRailOpen({ scrollIntoView: !1 })), viewerElements.lightboxPageRail?.addEventListener("focusout", schedulePageRailClose), viewerElements.topHotspot?.addEventListener("pointerdown", openTopUiFromHotspot), viewerElements.topHotspot?.addEventListener("mouseenter", openTopUiFromHotspot), viewerElements.topHotspot?.addEventListener("click", openTopUiFromHotspot), viewerElements.lightboxBar?.addEventListener("mouseenter", () => showTopUiTemporarily(0)), viewerElements.lightboxBar?.addEventListener("mouseleave", scheduleTopUiClose), document.addEventListener("pointerdown", markTouchLikeViewportInput, { passive: !0 }), document.addEventListener("touchstart", markTouchLikeViewportInput, { passive: !0 }), document.addEventListener("mousemove", handleLightboxEdgeHoverMove, { passive: !0 }), document.addEventListener("mouseout", handleLightboxEdgeHoverViewportExit, { passive: !0 }), document.documentElement?.addEventListener("mouseleave", handleLightboxEdgeHoverViewportExit, { passive: !0 }), viewerElements.lightboxImage?.addEventListener("load", () => {
    setViewerLoading(!1), viewerElements.lightbox?.classList.remove("is-page-loading"), syncAutomaticViewerFitMode({ showUi: !1, refreshLayout: !1 }), applyZoom();
  }), ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach((eventName) => {
    document.addEventListener(eventName, handleBrowserFullscreenChange);
  }), window.visualViewport?.addEventListener("resize", handleViewerResize, { passive: !0 }), typeof ResizeObserver == "function" && viewerElements.stageCanvas && !viewerStageResizeObserver && (viewerStageResizeObserver = new ResizeObserver(() => handleViewerResize()), viewerStageResizeObserver.observe(viewerElements.stageCanvas)), reconcileViewerFullscreenPhase("viewer-events-attached"), syncFullscreenButtonUi();
}
function flushViewerLayoutRefresh() {
  viewerLayoutRefreshRaf = 0, isViewerSessionOpen() && (hideLightboxFloatingPreview(), syncAutomaticViewerFitMode({ showUi: !1, refreshLayout: !1 }), refreshLightboxLayoutForTopUiChange(), viewerOnboardingState.viewerOnboardingOpen && scheduleViewerOnboardingLayout(40));
}
function handleViewerResize() {
  !isViewerSessionOpen() || viewerLayoutRefreshRaf || (viewerLayoutRefreshRaf = window.requestAnimationFrame(flushViewerLayoutRefresh));
}
function handleViewerGlobalKeydown(event) {
  if (!isViewerSessionOpen()) return !1;
  if (viewerOnboardingState.viewerOnboardingOpen)
    return handleViewerOnboardingKeydown(event), !0;
  let target = eventTargetElement(event.target);
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return !1;
  if (["ArrowDown", "PageDown", "ArrowUp", "PageUp", "ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key) && stopViewerTouchMomentum(), ["ArrowDown", "PageDown"].includes(event.key))
    event.preventDefault(), moveLightbox(1, { navigationSource: VIEWER_NAVIGATION_SOURCE_KEYBOARD });
  else if (["ArrowUp", "PageUp"].includes(event.key))
    event.preventDefault(), moveLightbox(-1, { navigationSource: VIEWER_NAVIGATION_SOURCE_KEYBOARD });
  else if (event.key === "ArrowRight")
    event.preventDefault(), moveLightbox(-1, { navigationSource: VIEWER_NAVIGATION_SOURCE_KEYBOARD });
  else if (event.key === "ArrowLeft")
    event.preventDefault(), moveLightbox(1, { navigationSource: VIEWER_NAVIGATION_SOURCE_KEYBOARD });
  else if (event.key === "Home")
    isFavoritesLightboxMode() ? setFavoriteViewerIndex(0, { navigationSource: VIEWER_NAVIGATION_SOURCE_HOME_END }) : setLightboxPage(catalogFirstPage(activeCatalog()), { navigationSource: VIEWER_NAVIGATION_SOURCE_HOME_END });
  else if (event.key === "End") {
    let catalog = activeCatalog();
    if (!catalog) return !1;
    isFavoritesLightboxMode() ? setFavoriteViewerIndex((getFeatureInterface("favorites")?.entries().length || 0) - 1, { navigationSource: VIEWER_NAVIGATION_SOURCE_HOME_END }) : setLightboxPage(catalogLastPage(catalog), { navigationSource: VIEWER_NAVIGATION_SOURCE_HOME_END });
  } else
    return !1;
  return !0;
}
function prepareViewerRoute(nextPage) {
  nextPage !== "viewer" && isViewerSessionOpen() && hideLightboxUi(), syncFullscreenButtonUi();
}
registerFeatureInterface("viewer", {
  escapePriority: 100,
  requiresDocumentLock: () => isViewerSessionOpen(),
  isViewerOpen: () => isViewerSessionOpen(),
  usesInDocumentFullscreenNavigation: viewerUsesInDocumentFullscreenNavigation,
  attachEvents: () => {
    attachViewerActionEvents(), attachViewerOnboardingEvents(), attachViewerEvents();
  },
  handleResize: handleViewerResize,
  handleGlobalKeydown: handleViewerGlobalKeydown,
  prepareRoute: prepareViewerRoute,
  openCatalog: (catalogId, page = void 0, options = {}) => openCatalogInViewer(catalogId, page, options),
  close: (options = {}) => closeLightbox(options),
  refresh: (options = {}) => updateLightbox(options),
  renderPageRail: renderLightboxPageRail,
  prepareInquiry: () => {
    viewerOnboardingState.viewerOnboardingOpen && closeViewerOnboarding({ restoreFocus: !1 }), closeViewerMobileMoreMenu(), getFeatureInterface("search")?.isLightboxMobileOpen?.() && getFeatureInterface("search")?.setLightboxMobileOpen?.(!1, { hideResults: !0 });
  },
  setPage: (page, options = {}) => setLightboxPage(page, { navigationSource: VIEWER_NAVIGATION_SOURCE_PROGRAMMATIC, ...options }),
  syncMobileSearchUi: (isOpen) => viewerElements.lightbox?.classList.toggle("mobile-search-open", !!isOpen),
  showTopUi: () => showTopUiTemporarily(0),
  containsTopBarElement: (element) => !!(element && viewerElements.lightboxBar?.contains(element)),
  closeMobileMoreMenu: () => closeViewerMobileMoreMenu(),
  hideTopUiForSearch: () => {
    viewerChromeState.topUiPinned || (window.clearTimeout(viewerChromeState.uiHideTimer), viewerElements.lightbox?.classList.remove("show-ui"));
  },
  closeTopLayer: (event) => {
    if (!isViewerSessionOpen()) return !1;
    if (viewerChromeState.viewerMobileMoreOpen)
      return closeViewerMobileMoreMenu({ returnFocus: !0 }), !0;
    if (viewerOnboardingState.viewerOnboardingOpen)
      return closeViewerOnboarding(), !0;
    if (getFeatureInterface("search")?.closeViewerTopLayer?.()) return !0;
    if (isBrowserFullscreenActive())
      return exitBrowserFullscreen().catch(() => {
      }), !0;
    let target = eventTargetElement(event?.target || null);
    return target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ? (getFeatureInterface("search")?.hideViewerResults?.({ blurTopUiFocus: !0 }), !0) : (closeLightbox(), !0);
  }
});

// src/js/80-app-shell.js
function attachShellEvents() {
  let catalogGrid = requireFeatureInterface("catalog-grid"), search = requireFeatureInterface("search");
  document.addEventListener("click", (event) => {
    let target = event.target;
    if (catalogGrid.containsMenuTarget(target) || catalogGrid.closeMobileMenu(), search.handleDocumentPointer(target)) return;
    let catalogDetail = getFeatureInterface("catalog-detail");
    catalogDetail?.containsTarget(target) || catalogDetail?.close();
  }), window.addEventListener("resize", () => {
    catalogGrid.handleResize(), search.handleResize(), getFeatureInterface("viewer")?.handleResize();
  }), window.addEventListener("scroll", () => {
    search.handleScroll(), catalogGrid.handleScroll();
  }, { passive: !0 }), window.addEventListener("keydown", (event) => {
    event.defaultPrevented || handleTopLayerEscape(event) || getFeatureInterface("viewer")?.handleGlobalKeydown(event);
  });
}
function attachFeatureEvents() {
  let catalogGrid = requireFeatureInterface("catalog-grid"), search = requireFeatureInterface("search"), favorites = requireFeatureInterface("favorites");
  bindFeatureEventsOnce("catalog-grid", catalogGrid.attachEvents), bindFeatureEventsOnce("search-ui", search.attachEvents), bindFeatureEventsOnce("shell", attachShellEvents), bindFeatureEventsOnce("favorites-share", favorites.attachEvents);
  let inquiry = getFeatureInterface("inquiry");
  inquiry && bindFeatureEventsOnce("inquiry", inquiry.attachEvents);
  let viewer = getFeatureInterface("viewer");
  viewer && bindFeatureEventsOnce("viewer", viewer.attachEvents), bindFeatureEventsOnce("navigation", navigationFeature().attachEvents);
}
function prepareDocumentRoute(nextPage) {
  let favorites = requireFeatureInterface("favorites"), catalogGrid = requireFeatureInterface("catalog-grid"), search = requireFeatureInterface("search");
  getFeatureInterface("viewer")?.prepareRoute(nextPage), favorites.prepareRoute(nextPage), catalogGrid.prepareRoute(nextPage), search.prepareRoute(nextPage), navigationFeature().setAppPage(nextPage), navigationFeature().syncRouteShell(nextPage), syncDocumentLock();
}
function initDocumentRoute(options = {}) {
  let route = siteRoutes.parseLocation(window.location, navigationFeature().appPage()), favorites = requireFeatureInterface("favorites"), catalogGrid = requireFeatureInterface("catalog-grid");
  if (prepareDocumentRoute(route.page), route.page === "home")
    return clearActiveLocation(), catalogGrid.syncCategoryFocusFromHash({
      animate: !1,
      scroll: !!window.location.hash
    }), updateDocumentMetadata(), window.location.hash || navigationFeature().restoreScroll(options.scrollPosition), !0;
  if (route.page === "favorites")
    return clearActiveLocation(), favorites.openRoute(), navigationFeature().restoreScroll(options.scrollPosition), !0;
  let catalog = findCatalogById(route.catalogId);
  if (!catalog)
    return navigateTo(homeDocumentUrl(), { replace: !0 }), !1;
  if (route.page === "catalog")
    return catalogGrid.openCatalog(catalog.id, { scrollBehavior: "auto" }), navigationFeature().restoreScroll(options.scrollPosition), !0;
  if (route.page === "viewer") {
    if (route.source === LIGHTBOX_SOURCE_FAVORITES) {
      let favoriteIndex = favorites.entries().findIndex((entry) => entry.catalog.id === catalog.id && entry.page === route.currentPage);
      return favoriteIndex < 0 ? (navigateTo(favoritesDocumentUrl(), { replace: !0 }), !1) : (getFeatureInterface("viewer")?.openCatalog(catalog.id, route.currentPage, {
        source: LIGHTBOX_SOURCE_FAVORITES,
        favoriteIndex
      }), !0);
    }
    return getFeatureInterface("viewer")?.openCatalog(catalog.id, route.currentPage), !0;
  }
  return navigateTo(homeDocumentUrl(), { replace: !0 }), !1;
}
function initializeApplicationShell() {
  let catalogGrid = requireFeatureInterface("catalog-grid"), search = requireFeatureInterface("search"), favorites = requireFeatureInterface("favorites");
  return telemetryInit({ recoverCatalogImageAfterInitialFailure }), catalogGrid.initialize(), initImagePlaceholderObserver(), attachFeatureEvents(), search.initialize(), favorites.syncUi(), catalogs.length ? (catalogGrid.renderInitialContent(), initDocumentRoute()) : (catalogGrid.renderEmptyState(), !0);
}
registerFeatureInterface("app-shell", {
  initialize: initializeApplicationShell,
  renderRoute: initDocumentRoute
});

// src/js/90-bootstrap.js
function init() {
  return requireFeatureInterface("app-shell").initialize();
}
var initResult = !0;
try {
  initResult = init();
} catch (error) {
  console.error("Application initialization failed", error), initResult = !1;
} finally {
  initResult !== !1 && markAppReady();
}
