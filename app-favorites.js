/*
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Browser bundle: app-favorites.js
 * ES module entrypoint: src/entries/favorites.js
 * Bundled ES module graph:
 *   - src/entries/favorites.js
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
 *   - src/js/17-catalog-asset-urls.js
 *   - src/js/18-navigation-feature.js
 *   - src/js/19-shared-pure.js
 *   - src/js/20-catalog-runtime.js
 *   - src/js/21-ui-runtime.js
 *   - src/js/29-favorites-portability.js
 *   - src/js/30-favorites-share.js
 *   - src/js/32-shared-inquiry.js
 *   - src/js/35-favorites-workspace.js
 *   - src/js/39-search-catalog-domain.js
 *   - src/js/40-catalog-grid.js
 *   - src/js/50-search-ui.js
 *   - src/js/80-app-shell.js
 *   - src/js/90-bootstrap.js
 * External browser modules:
 *   - catalog-assets.config.js
 *   - src/runtime/catalog-search.js
 *   - src/runtime/tooltip-manager.js
 *   - src/runtime/favorites-store.js
 *   - src/runtime/site-routes.js
 *   - catalogs.generated.module.js
 *   - catalog-taxonomy.generated.module.js
 * Compiler virtual inputs: <define:__BARGIG_FEATURE_CAPABILITIES__>
 * Output format: native browser ES module
 * Bundler: esbuild 0.28.2 (lockfile-selected direct devDependency)
 * Build command: python tools/build_frontend_assets.py
 */
// <define:__BARGIG_FEATURE_CAPABILITIES__>
var define_BARGIG_FEATURE_CAPABILITIES_default = { viewer: !1, favoritesWorkspace: !0, catalogGrid: !0, search: !0 };

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
var uiRuntime = {
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
import { catalogAssetBaseUrl, catalogImageDeliveryMode as configuredCatalogImageDeliveryMode } from "./catalog-assets.config.js";
import { catalogSearch } from "./catalog-search.js";
import { siteRoutes } from "./site-routes.js";
import { catalogs } from "./catalogs.generated.module.js";
import { catalogTaxonomy } from "./catalog-taxonomy.generated.module.js";

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
function normalizedCatalogAssetBaseUrl() {
  let rawBase = String(catalogAssetBaseUrl || "").trim();
  return rawBase ? rawBase.endsWith("/") ? rawBase : `${rawBase}/` : "";
}
function isAbsoluteAssetUrl(path) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith("//") || path.startsWith("data:");
}
function resolveCatalogAssetUrl(path) {
  let cleanPath = String(path || "").trim();
  if (!cleanPath || isAbsoluteAssetUrl(cleanPath)) return cleanPath;
  let baseUrl = normalizedCatalogAssetBaseUrl();
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
var TELEMETRY_ENDPOINT = "/api/telemetry", TELEMETRY_SCHEMA_VERSION = 4, TELEMETRY_BATCH_LIMIT = 20, TELEMETRY_QUEUE_LIMIT = 60, TELEMETRY_FLUSH_DELAY_MS = 900, TELEMETRY_SEARCH_DEDUP_MS = 1200, TELEMETRY_ALLOWED_HOSTS = /* @__PURE__ */ new Set([
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
var TELEMETRY_IMAGE_VISIBILITY = /* @__PURE__ */ new Set(["visible", "hidden", "preload", "background", "unknown"]), TELEMETRY_IMAGE_TIERS = /* @__PURE__ */ new Set(["thumb", "medium", "full", "unknown"]);
function telemetryCleanVisibility(value) {
  let visibility = telemetryCleanToken(value, 20);
  return TELEMETRY_IMAGE_VISIBILITY.has(visibility) ? visibility : "unknown";
}
function telemetryCleanImageTier(value) {
  let tier = telemetryCleanToken(value, 16);
  return TELEMETRY_IMAGE_TIERS.has(tier) ? tier : "unknown";
}
function telemetryNetworkState() {
  return navigator.onLine === !1 ? "offline" : navigator.onLine === !0 ? "online" : "unknown";
}
function telemetryCleanNetworkState(value) {
  let state = telemetryCleanToken(value, 16);
  return ["online", "offline", "unknown"].includes(state) ? state : "unknown";
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
    pageNumber: telemetryNumber(fields.pageNumber, 0, 1e5),
    secondaryValue: telemetryNumber(fields.secondaryValue, -1e6, 1e6),
    releaseId: telemetryCleanText(fields.releaseId || TELEMETRY_RELEASE_ID, 64),
    component: telemetryCleanToken(fields.component || "", 50),
    surface: telemetryCleanToken(fields.surface || "", 50),
    requestId: telemetryCleanRequestId(fields.requestId),
    visibility: telemetryCleanVisibility(fields.visibility),
    requestedTier: telemetryCleanImageTier(fields.requestedTier),
    networkState: telemetryCleanNetworkState(fields.networkState)
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
    requestedTier: telemetryCleanImageTier(options.requestedTier || img?.dataset?.telemetryRequestedTier),
    networkState: telemetryNetworkState(),
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
    requestedTier: context.requestedTier,
    networkState: context.networkState,
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

// src/js/19-shared-pure.js
function buildViewerInquiryMailtoUrl(emailAddress, reference) {
  let subject = encodeURIComponent(String(reference?.subject || "")), body = encodeURIComponent(String(reference?.text || "").replace(/\r?\n/g, `\r
`));
  return `mailto:${String(emailAddress || "")}?subject=${subject}&body=${body}`;
}
function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
function escapeHtml(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

// src/js/20-catalog-runtime.js
var observedCatalogPageSizes = /* @__PURE__ */ new WeakMap();
function networkInformation() {
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}
function isSaveDataEnabled() {
  return !!networkInformation()?.saveData;
}
function catalogImageDeliveryMode() {
  return String(configuredCatalogImageDeliveryMode || "").trim().toLowerCase() === CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY ? CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY : CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE;
}
function catalogMediumImagesEnabled() {
  return catalogImageDeliveryMode() === CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE;
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
    visibility: options.telemetryVisibility,
    requestedTier: options.telemetryRequestedTier || options.primaryTier
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
    img.addEventListener("load", () => settle(!0), { once: !0 }), img.addEventListener("error", () => settle(!1), { once: !0 }), options.onAttempt?.(candidate, { failedAttempts, attempts: index }), img.src = candidate.src, img.complete && queueMicrotask(() => settle(!!img.naturalWidth));
  };
  return attempt(), () => {
    stopped = !0;
  };
}
function catalogImageRecoveryAttributes(catalog, page, detail = "thumbnail", surface = detail) {
  let catalogId = escapeHtml(catalog?.id || ""), safePage = Math.max(0, Number.parseInt(String(page), 10) || 0), safeDetail = escapeHtml(detail || "thumbnail"), safeSurface = escapeHtml(surface || detail || "image");
  return ` data-catalog-image-recovery="lightweight" data-catalog-id="${catalogId}" data-page="${safePage}" data-telemetry-detail="${safeDetail}" data-telemetry-surface="${safeSurface}" data-telemetry-requested-tier="thumb"`;
}
function recoverCatalogImageAfterInitialFailure(img) {
  if (!img || img.dataset.catalogImageRecovery !== "lightweight") return !1;
  if (img.dataset.catalogImageRecoveryStarted === "true") return !0;
  let failedSrc = String(img.currentSrc || img.getAttribute("src") || "");
  if (!failedSrc) return !1;
  let detail = telemetryCleanText(img.dataset.telemetryDetail || telemetryCatalogImageContext(img).detail, 40), requestContext = telemetryCreateImageRequestContext(img, failedSrc, {
    detail,
    surface: img.dataset.telemetrySurface || detail,
    requestedTier: img.dataset.telemetryRequestedTier || "thumb"
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
function padImagePage(value) {
  return String(value).padStart(3, "0");
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
function mediumSrc(catalog, page) {
  let variant = catalogImageVariant(catalog, CATALOG_IMAGE_TIER_MEDIUM);
  if (!variant) return "";
  let directory = String(variant.directory || "medium").trim().replace(/^\/+|\/+$/g, "") || "medium";
  return withAssetVersion(
    `${catalogDir(catalog)}/${directory}/page-${padImagePage(displayPageToAssetPage(catalog, page))}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_MEDIUM
  );
}
function pageSize(catalog, page) {
  let assetPage = displayPageToAssetPage(catalog, page), observed = catalog ? observedCatalogPageSizes.get(catalog)?.get(assetPage) : null;
  if (observed) return observed;
  let size = (Array.isArray(catalog?.pageSizes) ? catalog.pageSizes : [])[assetPage - 1];
  if (!Array.isArray(size) || size.length < 2) return null;
  let width = Number(size[0]), height = Number(size[1]);
  return !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 ? null : { width, height };
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
var CATALOG_CATEGORY_SHARE_SLUGS = new Map(
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
function clampPage(page, catalog = activeCatalog()) {
  return clampCatalogPage(page, catalog);
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

// src/js/21-ui-runtime.js
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
function hasHoverPointer() {
  if (typeof window.matchMedia != "function") return !0;
  let primaryFineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches, anyFineHover = window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;
  return primaryFineHover || anyFineHover;
}
function isTouchLikePointer(event) {
  return !!(event && "pointerType" in event && (event.pointerType === "touch" || event.pointerType === "pen"));
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

// src/js/32-shared-inquiry.js
var inquiryState = {
  open: !1,
  returnFocus: null,
  reference: null,
  tipOpenCount: 0,
  tipShown: !1
}, inquiryElements = Object.freeze({
  viewerInquiryButton: $requiredButton("viewerInquiryButton"),
  viewerInquiryOverlay: requiredElement("viewerInquiryOverlay"),
  viewerInquiryBackdrop: requiredElement("viewerInquiryBackdrop"),
  viewerInquiryClose: $requiredButton("viewerInquiryClose"),
  viewerInquiryEyebrow: requiredElement("viewerInquiryEyebrow"),
  viewerInquiryTitle: requiredElement("viewerInquiryTitle"),
  viewerInquiryDescription: requiredElement("viewerInquiryDescription"),
  viewerInquiryFavoritesTip: requiredElement("viewerInquiryFavoritesTip"),
  viewerInquiryReference: requiredElement("viewerInquiryReference"),
  viewerInquiryCatalog: requiredElement("viewerInquiryCatalog"),
  viewerInquiryPage: requiredElement("viewerInquiryPage"),
  viewerInquiryPreview: $requiredImage("viewerInquiryPreview"),
  viewerInquiryGmail: $requiredAnchor("viewerInquiryGmail"),
  viewerInquiryEmail: $requiredAnchor("viewerInquiryEmail"),
  viewerInquiryShare: $requiredButton("viewerInquiryShare"),
  viewerInquiryCopy: $requiredButton("viewerInquiryCopy")
});
function viewerInquiryFooterEmail() {
  let link = document.querySelector('.site-footer-contact-list a[href^="mailto:"]');
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
  if (inquiryElements.viewerInquiryEyebrow.textContent = reference.eyebrow || "פרטי הבירור מצורפים אוטומטית", inquiryElements.viewerInquiryTitle.textContent = reference.title || "בירור על הדגם", inquiryElements.viewerInquiryDescription.textContent = reference.description || "פרטי הבירור והקישורים מוכנים מראש.", inquiryElements.viewerInquiryCatalog.textContent = reference.referenceTitle || reference.title, inquiryElements.viewerInquiryPage.textContent = reference.pageLabel || "", inquiryElements.viewerInquiryReference.classList.toggle("is-bulk", reference.kind === "favorites"), reference.kind === "viewer") {
    let label = `בירור על הדגם — ${reference.referenceTitle}, עמוד ${reference.page}`;
    inquiryElements.viewerInquiryButton.setAttribute("aria-label", label);
  }
  let previewCatalog = reference.previewCatalog || reference.catalog, rawPreviewPage = reference.previewPage ?? reference.page, previewPage = Number.isFinite(Number(rawPreviewPage)) ? Number(rawPreviewPage) : 1;
  if (previewCatalog) {
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
  if (!reference) return;
  getFeatureInterface("viewer")?.prepareInquiry?.();
  let returnFocus = isHtmlElement(options.returnFocus) ? options.returnFocus : isHtmlElement(document.activeElement) ? document.activeElement : inquiryElements.viewerInquiryButton;
  inquiryState.reference = reference, inquiryState.open = !0, inquiryState.returnFocus = returnFocus, syncViewerInquiryUi(reference);
  let showTip = reference.kind === "viewer" && !inquiryState.tipShown && ++inquiryState.tipOpenCount >= 2;
  showTip && (inquiryState.tipShown = !0), inquiryElements.viewerInquiryFavoritesTip.hidden = !showTip, inquiryElements.viewerInquiryOverlay.classList.remove("hidden"), inquiryElements.viewerInquiryOverlay.setAttribute("aria-hidden", "false"), setViewerInquiryTriggerState(!0, returnFocus), syncDocumentLock(), window.requestAnimationFrame(() => {
    inquiryState.open && (inquiryElements.viewerInquiryOverlay.classList.add("visible"), focusHtmlElement(inquiryElements.viewerInquiryClose, { preventScroll: !0 }));
  });
}
function closeViewerInquiry(options = {}) {
  if (!inquiryState.open) return;
  let { restoreFocus = !0 } = options, returnFocus = inquiryState.returnFocus;
  inquiryState.open = !1, inquiryState.returnFocus = null, inquiryState.reference = null, inquiryElements.viewerInquiryFavoritesTip.hidden = !0, inquiryElements.viewerInquiryOverlay.classList.remove("visible"), inquiryElements.viewerInquiryOverlay.setAttribute("aria-hidden", "true"), setViewerInquiryTriggerState(!1), syncDocumentLock(), window.setTimeout(() => {
    inquiryState.open || inquiryElements.viewerInquiryOverlay.classList.add("hidden");
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
  inquiryElements.viewerInquiryButton.addEventListener("click", (event) => {
    event.preventDefault(), event.stopPropagation(), openViewerInquiry({ returnFocus: inquiryElements.viewerInquiryButton });
  }), inquiryElements.viewerInquiryBackdrop.addEventListener("click", () => closeViewerInquiry()), inquiryElements.viewerInquiryClose.addEventListener("click", () => closeViewerInquiry()), inquiryElements.viewerInquiryShare.addEventListener("click", () => shareViewerInquiryReference()), inquiryElements.viewerInquiryCopy.addEventListener("click", () => copyViewerInquiryReference()), inquiryElements.viewerInquiryOverlay.addEventListener("keydown", handleViewerInquiryKeydown), [inquiryElements.viewerInquiryGmail, inquiryElements.viewerInquiryEmail].forEach((link) => {
    link.addEventListener("click", () => window.setTimeout(() => closeViewerInquiry({ restoreFocus: !1 }), 0));
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
          <img src="${escapeHtml(image)}" alt="${title} - עמוד ${page}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "favorites-grid")} />
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
var initialLayoutHydrator;
function setInitialLayoutHydrator(hydrator) {
  initialLayoutHydrator = hydrator;
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
        <img class="catalog-cover" src="${escapeHtml(cover)}" alt="כריכת ${safeTitle}"${catalogImageDimensionAttributes(catalog, 1)}${catalogCoverLoadingAttributes(catalog)}${catalogImageRecoveryAttributes(catalog, 1, "cover", "catalog-grid")} />
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
  if (catalogState.catalogLayoutColumns = columns, catalogElements.catalogGrid.style.setProperty("--catalog-layout-columns", String(columns)), !initialLayoutHydrator?.(catalogElements.catalogGrid, columns, catalogs)) {
    let categorySegments = (
      /** @type {Array<CatalogLayoutSegment>} */
      searchCatalogDomain.catalogCategorySegments(groups, columns)
    );
    catalogElements.catalogGrid.innerHTML = categorySegments.map((segment) => renderCatalogCategorySegment(segment, columns)).join("");
  }
  if (catalogElements.catalogGrid.setAttribute("aria-busy", "false"), catalogElements.catalogLoadStatus) {
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
            <img class="page-thumb" src="${escapeHtml(thumbSrc(catalog, page))}" alt="${escapeHtml(catalog.title)} - עמוד ${page}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async" fetchpriority="low"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "catalog-page-grid")} />
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
  catalog && (showCatalogDetail(), catalogElements.catalogTitle.textContent = catalog.title, catalogElements.catalogDescription.textContent = catalog.description || "", updateDetailCatalogMenuLabel(catalog), catalogElements.catalogCoverPreview && (applyCatalogImageDimensions(catalogElements.catalogCoverPreview, catalog, catalogFirstPage(catalog)), catalogElements.catalogCoverPreview.src = coverThumbSrc(catalog), catalogElements.catalogCoverPreview.loading = "lazy", catalogElements.catalogCoverPreview.decoding = "async", catalogElements.catalogCoverPreview.alt = `שער ${catalog.title}`), catalogElements.openCatalogEntryFromDetail && (catalogElements.openCatalogEntryFromDetail.disabled = catalog.pages < 1), catalogElements.catalogMenu && !catalogElements.catalogMenu.classList.contains("hidden") && renderDetailCatalogMenu(), renderPageGrid(), scheduleCatalogScrollTopButtonUpdate());
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
    event.preventDefault(), event.stopPropagation(), requireFeatureInterface("search").closeGlobalPanel({ focusButton: !1 }), setMobileCategoryMenuOpen(!isMobileCategoryMenuOpen());
  }), catalogElements.mobileCategoryMenu?.addEventListener("click", (event) => {
    let link = eventTargetElement(event.target)?.closest(".category-nav-link");
    !(link instanceof HTMLAnchorElement) || !catalogElements.mobileCategoryMenu.contains(link) || (closeMobileCategoryMenu(), handleCatalogFocusLinkClick(link, event));
  }), catalogElements.catalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation(), requireFeatureInterface("search").closeViewerMenus(), renderDetailCatalogMenu();
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
  setInitialLayoutHydrator,
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
var globalSearchRenderTimer = 0, lightboxSearchRenderTimer = 0, globalSearchAppendFrame = 0, globalSearchRenderSequence = 0, lightboxSearchRenderSequence = 0, lastGlobalSearchResults = [], lastLightboxSearchResults = [], lastGlobalSearchKey = "", lastLightboxSearchKey = "", GLOBAL_SEARCH_INITIAL_RENDER_COUNT = 3, GLOBAL_SEARCH_RENDER_CHUNK_SIZE = 3;
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
  channel === "global" ? (window.clearTimeout(globalSearchRenderTimer), window.cancelAnimationFrame(globalSearchAppendFrame), globalSearchRenderTimer = 0, globalSearchAppendFrame = 0, globalSearchRenderSequence += 1) : (window.clearTimeout(lightboxSearchRenderTimer), lightboxSearchRenderTimer = 0, lightboxSearchRenderSequence += 1), catalogSearch.cancel(channel);
}
function cancelGlobalSearchResultAppend() {
  window.cancelAnimationFrame(globalSearchAppendFrame), globalSearchAppendFrame = 0;
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
      syncGlobalSearchScopeUi(), renderSearchResults(searchElements.globalSearchInput?.value || ""), options.focus !== !1 && window.requestAnimationFrame(() => searchElements.globalSearchInput?.focus({ preventScroll: !0 }));
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
function closeLightboxViewerMenus() {
  closeLightboxCatalogMenu(), closeLightboxSearchScopeMenu();
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
    closeLightboxViewerMenus(), getFeatureInterface("viewer")?.showTopUi?.(), ensureSearchIndexLoaded().catch(() => {
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
  if (hideSearchFloatingPreview(), searchElements.lightboxSearchResults?.classList.add("hidden"), closeLightboxViewerMenus(), blurTopUiFocus) {
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
  previewImage.removeAttribute("width"), previewImage.removeAttribute("height"), previewImage.onload = () => positionSearchFloatingPreview(target), previewImage.src = src, searchElements.searchFloatingPreviewImage.alt = label, searchElements.searchFloatingPreviewPage && (searchElements.searchFloatingPreviewPage.textContent = label), searchElements.searchFloatingPreview.classList.add("visible"), positionSearchFloatingPreview(target);
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
            <img class="reader-search-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "viewer-search-results")} />
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
function prepareViewerSearch(options = {}) {
  options.renderCatalogMenu !== !1 && renderLightboxCatalogMenu(), resetLightboxSearch();
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
          <img class="search-result-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "global-search-results")} />
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
    if (globalSearchAppendFrame = 0, !!isCurrentGlobalSearchRender(renderSequence, rawQuery)) {
      if (nextIndex = appendGlobalSearchResultBatch(
        results,
        nextIndex,
        GLOBAL_SEARCH_RENDER_CHUNK_SIZE
      ), nextIndex < results.length) {
        globalSearchAppendFrame = window.requestAnimationFrame(appendNextBatch);
        return;
      }
      searchElements.globalSearchResults.removeAttribute("aria-busy");
    }
  };
  nextIndex < results.length ? globalSearchAppendFrame = window.requestAnimationFrame(appendNextBatch) : searchElements.globalSearchResults.removeAttribute("aria-busy");
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
    }), event.stopPropagation(), getFeatureInterface("catalog-detail")?.close(), closeLightboxViewerMenus(), setGlobalSearchPanelOpen(!isGlobalSearchPanelOpen(), { focus: !0, focusButton: !0 });
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
    event.stopPropagation(), hideSearchFloatingPreview(), getFeatureInterface("catalog-detail")?.close(), closeLightboxViewerMenus(), renderGlobalSearchScopeMenu();
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
  closeGlobalSearchPanel({ focusButton: !1 }), closeGlobalSearchScopeMenu(), closeLightboxViewerMenus(), nextPage !== "viewer" && setLightboxMobileSearchOpen(!1, { hideResults: !0 });
}
function handleSearchDocumentPointer(target) {
  if (!(target instanceof Node))
    return prepareSearchRoute(currentAppPage), !1;
  let insideGlobalSearch = searchElements.catalogSearch.contains(target) || searchElements.globalSearchOpen.contains(target), insideMobileReaderSearch = searchElements.lightboxSearchPanel.contains(target) || searchElements.lightboxMobileSearchToggle.contains(target);
  return insideGlobalSearch ? (!searchElements.globalSearchScopeMenu.contains(target) && !searchElements.globalSearchScopeToggle.contains(target) && closeGlobalSearchScopeMenu(), closeLightboxViewerMenus(), getFeatureInterface("catalog-detail")?.close(), !0) : insideMobileReaderSearch || (searchState.lightboxMobileSearchOpen && setLightboxMobileSearchOpen(!1, { hideResults: !0 }), searchElements.lightboxSearchScopeMenu.contains(target) || searchElements.lightboxSearchScopeToggle.contains(target)) || searchElements.lightboxCatalogMenu.contains(target) || searchElements.lightboxCatalogMenuToggle.contains(target) ? !0 : (closeGlobalSearchPanel({ focusButton: !1 }), closeGlobalSearchScopeMenu(), closeLightboxViewerMenus(), !1);
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
  closeViewerTopLayer: () => searchState.lightboxMobileSearchOpen ? (setLightboxMobileSearchOpen(!1, { returnFocus: !0, hideResults: !0 }), !0) : searchElements.lightboxCatalogMenu && !searchElements.lightboxCatalogMenu.classList.contains("hidden") || searchElements.lightboxSearchScopeMenu && !searchElements.lightboxSearchScopeMenu.classList.contains("hidden") ? (closeLightboxViewerMenus(), !0) : !1,
  isLightboxMobileOpen: () => searchState.lightboxMobileSearchOpen,
  setLightboxMobileOpen: (open, options = {}) => setLightboxMobileSearchOpen(open, options),
  containsLightboxResult: (target) => !!(target?.closest?.("[data-lightbox-search-page]") && searchElements.lightboxSearchResults.contains(target.closest("[data-lightbox-search-page]"))),
  prepareViewer: (options = {}) => prepareViewerSearch(options),
  syncViewerStatus: initLightboxSearchStatus,
  closeViewerMenus: closeLightboxViewerMenus,
  hideViewerResults: (options = {}) => hideLightboxSearchResults(options),
  closeGlobalPanel: (options = {}) => closeGlobalSearchPanel(options),
  attachEvents: attachSearchUiEvents,
  initialize: initializeSearchUi,
  prepareRoute: prepareSearchRoute,
  handleDocumentPointer: handleSearchDocumentPointer,
  handleResize: handleSearchResize,
  handleScroll: handleSearchScroll
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
