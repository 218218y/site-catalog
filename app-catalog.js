/*
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Browser bundle: app-catalog.js
 * Source modules:
 *   - src/js/00-navigation.js
 *   - src/js/05-app-contracts.js
 *   - src/js/10-app-state.js
 *   - src/js/11-navigation-state.js
 *   - src/js/12-catalog-state.js
 *   - src/js/13-search-state.js
 *   - src/js/14-favorites-state.js
 *   - src/js/15-telemetry.js
 *   - src/js/20-shared-ui.js
 *   - src/js/30-favorites-share.js
 *   - src/js/40-catalog-grid.js
 *   - src/js/50-search-ui.js
 *   - src/js/90-bootstrap.js
 * Build command: python tools/build_frontend_assets.py
 */

(() => {
"use strict";

/** @type {FeatureCapabilities} */
const featureCapabilities = Object.freeze({"viewer":false,"favoritesWorkspace":false,"catalogGrid":true,"search":true});

/* ===== BEGIN SOURCE: src/js/00-navigation.js ===== */
/**
 * Source module: 00-navigation.js
 * Application routing, document metadata, and fullscreen-safe in-document navigation.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

const catalogs = Array.isArray(window.BARGIG_CATALOGS) ? window.BARGIG_CATALOGS : [];
const catalogSearch = window.BargigCatalogSearch || null;
const siteRoutes = window.BargigRoutes || null;
let currentAppPage = siteRoutes?.pageFromLocation?.(window.location, document.body?.dataset?.page) || "home";
const IN_DOCUMENT_ROUTE_STATE_KEY = "__bargigInDocumentRoute";
let hasInDocumentRouteSession = false;

const $ = (id) => document.getElementById(id);

function isAppPage(page) {
  return currentAppPage === page;
}

function setCurrentAppPage(page) {
  currentAppPage = siteRoutes?.normalizePage?.(page) || String(page || "home");
  if (document.body) document.body.dataset.page = currentAppPage;
}

function historyStateWithRouteData(values = {}) {
  const currentState = history.state && typeof history.state === "object" ? history.state : {};
  return { ...currentState, [IN_DOCUMENT_ROUTE_STATE_KEY]: true, ...values };
}

function saveCurrentRouteScrollPosition() {
  if (!window.history?.replaceState) return;
  history.replaceState(historyStateWithRouteData({
    scrollX: window.scrollX || 0,
    scrollY: window.scrollY || 0
  }), "", window.location.href);
}

function isInternalAppDocumentUrl(url) {
  return Boolean(
    url &&
    siteRoutes?.isSameAppDocumentLocation?.(window.location, url, currentAppPage)
  );
}

function canNavigateWithinCurrentDocument(url) {
  return Boolean(
    featureCapabilities.viewer &&
    getFeatureInterface("viewer")?.usesInDocumentFullscreenNavigation?.() &&
    window.history?.pushState &&
    window.history?.replaceState &&
    isInternalAppDocumentUrl(url)
  );
}

function navigateWithinCurrentDocument(url, options = {}) {
  hasInDocumentRouteSession = true;
  saveCurrentRouteScrollPosition();

  const nextState = historyStateWithRouteData({ scrollX: 0, scrollY: 0 });
  const sameUrl = url.href === window.location.href;
  if (options.replace || sameUrl) history.replaceState(nextState, "", url.href);
  else history.pushState(nextState, "", url.href);

  initDocumentRoute({ scrollPosition: { x: 0, y: 0 } });
}

function navigateTo(relativeUrl, options = {}) {
  const target = String(relativeUrl || "").trim();
  if (!target) return;

  let targetUrl = null;
  try {
    targetUrl = new URL(target, document.baseURI || window.location.href);
  } catch (_error) {
    targetUrl = null;
  }

  if (targetUrl && canNavigateWithinCurrentDocument(targetUrl)) {
    navigateWithinCurrentDocument(targetUrl, options);
    return;
  }

  if (options.replace) window.location.replace(targetUrl?.href || target);
  else window.location.assign(targetUrl?.href || target);
}

function navigateBack() {
  window.history.back();
}

function handleInternalAppLinkClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!featureCapabilities.viewer || !getFeatureInterface("viewer")?.usesInDocumentFullscreenNavigation?.()) return;

  const link = event.target.closest?.("a[href]");
  if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;

  let targetUrl = null;
  try {
    targetUrl = new URL(link.href, window.location.href);
  } catch (_error) {
    return;
  }

  const sameDocumentHashNavigation = targetUrl.pathname === window.location.pathname
    && targetUrl.search === window.location.search
    && targetUrl.hash
    && targetUrl.hash !== window.location.hash;
  if (sameDocumentHashNavigation || !canNavigateWithinCurrentDocument(targetUrl)) return;

  event.preventDefault();
  navigateWithinCurrentDocument(targetUrl);
}

function markAppReady() {
  document.body?.setAttribute("data-app-ready", "true");
}

function canReturnToSameSite() {
  if (!document.referrer) return false;
  try {
    return new URL(document.referrer).origin === window.location.origin;
  } catch (_error) {
    return false;
  }
}

function homeDocumentUrl() {
  return siteRoutes?.homeUrl?.() || "index.html";
}

function catalogDocumentUrl(catalogId) {
  return siteRoutes?.catalogUrl?.(catalogId) || `/catalog/${encodeURIComponent(String(catalogId || ""))}/`;
}

function favoritesDocumentUrl() {
  return siteRoutes?.favoritesUrl?.() || "favorites.html";
}

function viewerDocumentUrl(catalogId, page = 1, options = {}) {
  return siteRoutes?.viewerUrl?.(catalogId, page, options) || `/catalog/${encodeURIComponent(String(catalogId || ""))}/page/${Math.max(1, Number.parseInt(page, 10) || 1)}/`;
}

function categoryDocumentUrl(categorySlugValue, subcategorySlugValue = "") {
  return siteRoutes?.categoryUrl?.(categorySlugValue, subcategorySlugValue) || homeDocumentUrl();
}

function absoluteDocumentUrl(relativeUrl) {
  return new URL(relativeUrl, document.baseURI || window.location.href).href;
}

function setMetadataContent(selector, value, attribute = "content") {
  const element = document.querySelector(selector);
  if (element && value) element.setAttribute(attribute, value);
}

function currentDocumentMetadata(catalog = navigationState?.catalog || null) {
  const brand = "רהיטי ברגיג";
  if (isAppPage("catalog") && catalog) {
    return {
      title: `${catalog.title} | קטלוג ריהוט | ${brand}`,
      description: `${catalog.description || "קטלוג ריהוט"}. צפייה נוחה ב־${catalog.pages} עמודי הקטלוג.`,
      url: absoluteDocumentUrl(catalogDocumentUrl(catalog.id)),
      image: coverThumbSrc(catalog),
      imageAlt: `שער ${catalog.title}`
    };
  }
  if (isAppPage("viewer") && catalog) {
    return {
      title: `${catalog.title} — עמוד ${navigationState.page} | ${brand}`,
      description: `צפייה בעמוד ${navigationState.page} מתוך ${catalog.pages} בקטלוג ${catalog.title}.`,
      url: absoluteDocumentUrl(viewerDocumentUrl(catalog.id, navigationState.page)),
      image: pageSrc(catalog, navigationState.page),
      imageAlt: `${catalog.title} — עמוד ${navigationState.page}`
    };
  }
  if (isAppPage("favorites")) {
    return {
      title: `המועדפים שלי | ${brand}`,
      description: "עמודי הקטלוג ששמרת במועדפים, עם הערות, סינון ושיתוף מרוכז.",
      url: absoluteDocumentUrl(favoritesDocumentUrl())
    };
  }
  return {
    title: `קטלוגים | ${brand}`,
    description: "גלריית הקטלוגים של רהיטי ברגיג — בחירת קטלוג, חיפוש מהיר ופתיחה נוחה.",
    url: absoluteDocumentUrl(homeDocumentUrl())
  };
}

function updateDocumentMetadata(catalog = navigationState?.catalog || null) {
  const metadata = currentDocumentMetadata(catalog);
  document.title = metadata.title;
  setMetadataContent('meta[name="description"]', metadata.description);
  setMetadataContent('link[rel="canonical"]', metadata.url, "href");
  setMetadataContent('meta[property="og:title"]', metadata.title);
  setMetadataContent('meta[property="og:description"]', metadata.description);
  setMetadataContent('meta[property="og:url"]', metadata.url);
  setMetadataContent('meta[name="twitter:title"]', metadata.title);
  setMetadataContent('meta[name="twitter:description"]', metadata.description);
  if (metadata.image) {
    setMetadataContent('meta[property="og:image"]', metadata.image);
    setMetadataContent('meta[property="og:image:secure_url"]', metadata.image);
    setMetadataContent('meta[property="og:image:alt"]', metadata.imageAlt || metadata.title);
    setMetadataContent('meta[name="twitter:image"]', metadata.image);
    setMetadataContent('meta[name="twitter:image:alt"]', metadata.imageAlt || metadata.title);
  }
}

function attachNavigationEvents() {
  document.addEventListener("click", handleInternalAppLinkClick);

  window.addEventListener("popstate", (event) => {
    const routeState = event.state && typeof event.state === "object" ? event.state : null;
    if (!hasInDocumentRouteSession && !routeState?.[IN_DOCUMENT_ROUTE_STATE_KEY]) return;

    hasInDocumentRouteSession = true;
    initDocumentRoute({
      scrollPosition: {
        x: routeState?.scrollX || 0,
        y: routeState?.scrollY || 0
      }
    });
  });

  window.addEventListener("hashchange", () => {
    if (!isAppPage("home")) return;
    getFeatureInterface("catalog-grid")?.syncCategoryFocusFromHash?.();
  });
}
/* ===== END SOURCE: src/js/00-navigation.js ===== */

/* ===== BEGIN SOURCE: src/js/05-app-contracts.js ===== */
/**
 * Source module: 05-app-contracts.js
 * JSDoc contracts shared by every route bundle.
 */

/**
 * @typedef {Object} CatalogRecord
 * @property {string} id
 * @property {string} title
 * @property {string} [description]
 * @property {string} [category]
 * @property {string} [subcategory]
 * @property {number} pages
 * @property {string} [dir]
 * @property {string} [format]
 * @property {string} [thumbDir]
 * @property {string} [mediumDir]
 * @property {Array<[number, number]>} [pageSizes]
 */

/** @typedef {{catalog: CatalogRecord|null, page: number, lightboxSource: string}} NavigationState */
/** @typedef {{catalogLayoutColumns:number, catalogLayoutResizeTimer:number, catalogScrollTopButtonRaf:number, categoryFocusTargetId:string, categoryFocusTimer:number, categoryNavFitRaf:number}} CatalogState */
/** @typedef {{globalSearchCategory:string, globalSearchOpen:boolean, lightboxSearchScope:string, lightboxMobileSearchOpen:boolean, searchIndexLoadState:string, searchIndexLoadPromise:Promise<boolean>|null, searchIndexPreloadTimer:number, searchPreviewSuppressUntil:number, searchPreviewSuppressTimer:number, searchPreviewPointerClientX:number|null, searchPreviewPointerClientY:number|null}} SearchState */
/** @typedef {{favoritesViewerIndex:number, favoritesViewerOpeningHash:string, favoritesViewerPreviousCatalog:CatalogRecord|null, favoritesViewerPreviousPage:number, favoritesOpen:boolean, favoritesReturnFocus:Element|null, favoritesTransferPending:Record<string, unknown>|null, favoritesTransferReturnFocus:Element|null, favoritesFilterCatalogId:string, favoritesSelectedKeys:Set<string>, favoritesDragKey:string, favoriteNoteEditingKey:string, favoriteNoteReturnFocus:Element|null}} FavoritesState */
/**
 * @typedef {Object} ViewerState
 * @property {number} zoom
 * @property {number} fitScale
 * @property {string} imageFitMode
 * @property {string} imageFitModeSource
 * @property {boolean} singleImageFitOriginPending
 * @property {Record<string, number>|null} singleImagePendingRelativePosition
 * @property {Record<string, unknown>|null} singleImagePendingPageTurnOrigin
 * @property {number} panX
 * @property {number} panY
 * @property {number} dragStartX
 * @property {number} dragStartY
 * @property {number} dragStartPanX
 * @property {number} dragStartPanY
 * @property {number} lastTapAt
 * @property {number} lastTapX
 * @property {number} lastTapY
 * @property {string} lastTapSurface
 * @property {number} suppressNextDblClickUntil
 * @property {number} pinchStartDistance
 * @property {number} pinchStartZoom
 * @property {number} pinchLastMidX
 * @property {number} pinchLastMidY
 * @property {boolean} pointerGestureHadMultiplePointers
 * @property {boolean} pointerGestureConsumedPan
 * @property {Map<number, Record<string, unknown>>} pointers
 * @property {number} viewerTouchMomentumRaf
 * @property {number} viewerTouchMomentumVelocityX
 * @property {number} viewerTouchMomentumVelocityY
 * @property {number} viewerTouchMomentumLastTime
 * @property {string} viewerPhase
 * @property {string} viewerPhaseReason
 * @property {string} viewerFullscreenPhase
 * @property {string} viewerFullscreenReason
 * @property {boolean} topUiPinned
 * @property {number} uiHideTimer
 * @property {number} pageRailHideTimer
 * @property {number} lastTouchLikeViewportInputAt
 * @property {number} lastTouchLikeRailInputAt
 * @property {number} zoomIndicatorHideTimer
 * @property {number} pageIndicatorHideTimer
 * @property {boolean} viewerMobileMoreOpen
 * @property {number} singleImageLoadToken
 * @property {number} singleImageAnimationTimer
 * @property {number} singleImageResolutionLoadToken
 * @property {(()=>void)|null} singleImageResolutionStop
 * @property {HTMLImageElement|null} singleImageResolutionImage
 * @property {string} singleImageResolutionTargetSrc
 * @property {string} singleImageResolutionTargetTier
 * @property {boolean} singleImageResolutionReady
 * @property {boolean} singleImageResolutionVisible
 * @property {boolean} singleImageResolutionCommitPending
 * @property {boolean} singleImageResolutionRetainedForSwap
 * @property {number} viewerPageWheelAccumulator
 * @property {number} viewerPageWheelBasePage
 * @property {number} viewerPageWheelTargetPage
 * @property {number} viewerPageWheelSettleTimer
 * @property {boolean} viewerOnboardingOpen
 * @property {boolean} viewerOnboardingShownThisSession
 * @property {number} viewerOnboardingStep
 * @property {Element|null} viewerOnboardingTarget
 * @property {Array<Element>} viewerOnboardingFloatingTargets
 * @property {Record<string, unknown>|null} viewerOnboardingRestoreUi
 * @property {number} viewerOnboardingLayoutRaf
 * @property {number} viewerOnboardingLayoutTimer
 */

/** @typedef {{viewer:boolean, favoritesWorkspace:boolean, catalogGrid:boolean, search:boolean}} FeatureCapabilities */

/** @typedef {{imageLoadCache: Map<string, Promise<unknown>>}} CatalogAssetState */
/** @typedef {{actionToastTimer:number}} UiRuntimeState */
/**
 * @typedef {Object} FavoritesStore
 * @property {string} storageKey
 * @property {()=>Array<Record<string, unknown>>} read
 * @property {()=>Array<Record<string, unknown>>} reload
 * @property {(item:Record<string, unknown>)=>boolean} toggle
 * @property {(item:Record<string, unknown>)=>boolean} remove
 * @property {()=>void} clear
 * @property {(items:Array<Record<string, unknown>>)=>unknown} replace
 * @property {(item:Record<string, unknown>, note:string)=>unknown} setNote
 */
/**
 * Stable public surface registered by an optional frontend feature. All members
 * are optional because each route loads a different capability set. Callers
 * must resolve the feature by name and use only this interface; direct access to
 * another feature's state or DOM owner is rejected by the build contracts.
 *
 * @typedef {Object} FeatureInterface
 * @property {string} [name]
 * @property {number} [escapePriority]
 * @property {()=>boolean} [closeTopLayer]
 * @property {(event?:KeyboardEvent)=>boolean} [closeViewerTopLayer]
 * @property {()=>boolean} [requiresDocumentLock]
 * @property {()=>boolean} [isViewerOpen]
 * @property {()=>boolean} [isOpen]
 * @property {()=>boolean} [usesInDocumentFullscreenNavigation]
 * @property {()=>void} [attachEvents]
 * @property {()=>void} [initialize]
 * @property {()=>void} [renderInitialContent]
 * @property {()=>void} [renderEmptyState]
 * @property {(nextPage:string)=>void} [prepareRoute]
 * @property {()=>void} [handleResize]
 * @property {(event:KeyboardEvent)=>boolean} [handleGlobalKeydown]
 * @property {(catalogId:string, page?:number, options?:Record<string, unknown>)=>void} [openCatalog]
 * @property {(options?:Record<string, unknown>)=>void} [close]
 * @property {(options?:Record<string, unknown>)=>void} [refresh]
 * @property {()=>void} [renderPageRail]
 * @property {(options?:Record<string, unknown>)=>void} [openInquiry]
 * @property {()=>void} [prepareInquiry]
 * @property {(page:number, options?:Record<string, unknown>)=>void} [setPage]
 * @property {(isOpen:boolean)=>void} [syncMobileSearchUi]
 * @property {()=>void} [showTopUi]
 * @property {(element:Element|null)=>boolean} [containsTopBarElement]
 * @property {()=>void} [hideTopUiForSearch]
 * @property {(options?:Record<string, unknown>)=>void} [closeMobileMenu]
 * @property {()=>void} [scheduleLayoutRefresh]
 * @property {()=>void} [scheduleCategoryNavFit]
 * @property {()=>void} [scheduleScrollTopButtonUpdate]
 * @property {(visible:boolean)=>void} [setScrollTopButtonVisible]
 * @property {(options?:Record<string, unknown>)=>void} [syncCategoryFocusFromHash]
 * @property {(hash?:string)=>string} [resolveCategoryTargetIdFromHash]
 * @property {(targetId:string)=>boolean} [hasCategoryTarget]
 * @property {()=>string} [activeCategoryTargetId]
 * @property {()=>number} [layoutColumnCount]
 * @property {()=>void} [hideDetail]
 * @property {(entries?:Array<Record<string, unknown>>)=>Array<Record<string, unknown>>} [shareLinkEntries]
 * @property {(entries:Array<Record<string, unknown>>, button?:Element|null)=>Promise<unknown>|unknown} [copyShareLink]
 * @property {(entries?:Array<Record<string, unknown>>)=>void} [render]
 * @property {(entries?:Array<Record<string, unknown>>)=>void} [prune]
 * @property {(event:Event)=>void} [handleGridClick]
 * @property {(options?:Record<string, unknown>)=>void} [closeNoteEditor]
 * @property {()=>boolean} [isLightboxMobileOpen]
 * @property {(open:boolean, options?:Record<string, unknown>)=>void} [setLightboxMobileOpen]
 * @property {(target:Element|null)=>boolean} [containsLightboxResult]
 * @property {(options?:Record<string, unknown>)=>void} [hideViewerResults]
 */
/* ===== END SOURCE: src/js/05-app-contracts.js ===== */

/* ===== BEGIN SOURCE: src/js/10-app-state.js ===== */
/**
 * Source module: 10-app-state.js
 * Route-neutral runtime services and feature interface registration.
 *
 * Feature constants and mutable state belong to their feature modules. Keeping
 * this module route-neutral is what allows the catalog and favorites bundles to
 * omit the Viewer implementation completely rather than merely disable it.
 */

const CATALOG_IMAGE_TIER_THUMB = "thumb";
const CATALOG_IMAGE_TIER_MEDIUM = "medium";
const CATALOG_IMAGE_TIER_FULL = "full";
const CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE = "responsive";
const CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY = "full-only";
const DEFAULT_CATALOG_MEDIUM_MAX_SIDE = 1600;
const CATALOG_IMAGE_PRELOAD_CACHE_LIMIT = 24;
const CATALOG_EAGER_COVER_COUNT = 2;
const CATALOG_IMAGE_RETRY_PARAM = "bargig_retry";
const CATALOG_ASSET_VERSION_PARAM = "v";
const CATALOG_ASSET_URL_SCHEMA_VERSION = 2;

/** @type {CatalogAssetState} */
const catalogAssetState = {
  imageLoadCache: new Map(),
};

/** @type {UiRuntimeState} */
const uiRuntime = {
  actionToastTimer: 0,
};

/** @type {Map<string, FeatureInterface>} */
const featureInterfaces = new Map();

/**
 * Register one immutable feature boundary. Duplicate names are rejected so a
 * route cannot silently replace another feature implementation.
 * @param {string} name
 * @param {FeatureInterface} api
 */
function registerFeatureInterface(name, api) {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) throw new TypeError("Feature interface requires a stable name");
  if (!api || typeof api !== "object") {
    throw new TypeError(`Feature interface must be an object: ${normalizedName}`);
  }
  if (featureInterfaces.has(normalizedName)) {
    throw new Error(`Feature interface was registered twice: ${normalizedName}`);
  }
  featureInterfaces.set(normalizedName, Object.freeze({ ...api, name: normalizedName }));
}

/** @param {string} name @returns {FeatureInterface|null} */
function getFeatureInterface(name) {
  return featureInterfaces.get(String(name || "")) || null;
}

function featureInterfacesByEscapePriority() {
  return [...featureInterfaces.values()]
    .filter((api) => typeof api.closeTopLayer === "function")
    .sort((first, second) => Number(second.escapePriority || 0) - Number(first.escapePriority || 0));
}

const boundEventFeatures = new Set();

/**
 * @param {string} featureName
 * @param {()=>void} binder
 * @returns {boolean}
 */
function bindFeatureEventsOnce(featureName, binder) {
  const name = String(featureName || "").trim();
  if (!name) throw new TypeError("Feature event binding requires a stable name");
  if (boundEventFeatures.has(name)) return false;
  if (typeof binder !== "function") throw new TypeError(`Feature event binder is not callable: ${name}`);

  // Mark only after a successful bind. A thrown setup error therefore cannot leave
  // the application believing that a half-bound feature is healthy.
  binder();
  boundEventFeatures.add(name);
  return true;
}
/* ===== END SOURCE: src/js/10-app-state.js ===== */

/* ===== BEGIN SOURCE: src/js/11-navigation-state.js ===== */
/**
 * Source module: 11-navigation-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

const LIGHTBOX_SOURCE_CATALOG = "catalog";
const LIGHTBOX_SOURCE_FAVORITES = "favorites";
/** @type {NavigationState} */
const navigationState = {
  catalog: null,
  page: 1,
  lightboxSource: LIGHTBOX_SOURCE_CATALOG,
};

/** @type {Readonly<Record<string, HTMLElement | null>>} */
const shellElements = Object.freeze({
  splash: $("splashScreen"),
  catalogsSection: $("catalogs"),
  categoryNav: $("categoryNav"),
  mobileCategoryMenuToggle: $("mobileCategoryMenuToggle"),
  mobileCategoryMenu: $("mobileCategoryMenu"),
  catalogCount: $("catalogCount"),
  pageCount: $("pageCount"),
  headerFavoritesButton: $("headerFavoritesButton"),
  headerFavoritesCount: $("headerFavoritesCount"),
  headerCopyLink: $("headerCopyLink"),
  siteActionToast: $("siteActionToast"),
});
/* ===== END SOURCE: src/js/11-navigation-state.js ===== */

/* ===== BEGIN SOURCE: src/js/12-catalog-state.js ===== */
/**
 * Source module: 12-catalog-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

/** @type {CatalogState} */
const catalogState = {
  catalogLayoutColumns: 0,
  catalogLayoutResizeTimer: 0,
  catalogScrollTopButtonRaf: 0,
  categoryFocusTargetId: "",
  categoryFocusTimer: 0,
  categoryNavFitRaf: 0,
};

/** @type {Readonly<Record<string, HTMLElement | null>>} */
const catalogElements = Object.freeze({
  catalogGrid: $("catalogGrid"),
  catalogLoadStatus: $("catalogLoadStatus"),
  catalogDetail: $("catalogDetail"),
  catalogTitle: $("catalogDetailTitle"),
  catalogDescription: $("catalogDescription"),
  catalogMenuToggle: $("catalogMenuToggle"),
  catalogMenuToggleText: $("catalogMenuToggleText"),
  catalogMenu: $("catalogMenu"),
  catalogCoverPreview: $("catalogCoverPreview"),
  pageGrid: $("pageGrid"),
  openCatalogEntryFromDetail: $("openCatalogEntryFromDetail"),
  scrollToTopBtn: $("scrollToTopBtn"),
});
/* ===== END SOURCE: src/js/12-catalog-state.js ===== */

/* ===== BEGIN SOURCE: src/js/13-search-state.js ===== */
/**
 * Source module: 13-search-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

const SEARCH_INPUT_DEBOUNCE_MS = 90;
const SEARCH_INDEX_PRELOAD_DELAY_MS = 6000;
const MOBILE_READER_SEARCH_MEDIA = "(max-width: 760px)";
const SEARCH_PREVIEW_SCROLL_SUPPRESS_MS = 260;
/** @type {SearchState} */
const searchState = {
  globalSearchCategory: "",
  globalSearchOpen: false,
  lightboxSearchScope: "catalog",
  lightboxMobileSearchOpen: false,
  searchIndexLoadState: catalogSearch?.isReady?.() ? "ready" : "idle",
  searchIndexLoadPromise: null,
  searchIndexPreloadTimer: 0,
  searchPreviewSuppressUntil: 0,
  searchPreviewSuppressTimer: 0,
  searchPreviewPointerClientX: null,
  searchPreviewPointerClientY: null,
};

/** @type {Readonly<Record<string, HTMLElement | null>>} */
const searchElements = Object.freeze({
  catalogSearch: $("catalogSearch"),
  globalSearchOpen: $("globalSearchOpen"),
  globalSearchClose: $("globalSearchClose"),
  globalSearchInput: $("globalSearchInput"),
  globalSearchResults: $("globalSearchResults"),
  globalSearchClear: $("globalSearchClear"),
  globalSearchScopeToggle: $("globalSearchScopeToggle"),
  globalSearchScopeMenu: $("globalSearchScopeMenu"),
  searchFloatingPreview: $("searchFloatingPreview"),
  searchFloatingPreviewImage: $("searchFloatingPreviewImage"),
  searchFloatingPreviewPage: $("searchFloatingPreviewPage"),
  lightboxSearchInput: $("lightboxSearchInput"),
  lightboxSearchPanel: $("lightboxSearchPanel"),
  lightboxMobileSearchToggle: $("lightboxMobileSearchToggle"),
  lightboxMobileSearchClose: $("lightboxMobileSearchClose"),
  lightboxSearchResults: $("lightboxSearchResults"),
  lightboxSearchStatus: $("lightboxSearchStatus"),
  lightboxSearchClear: $("lightboxSearchClear"),
  lightboxSearchScopeToggle: $("lightboxSearchScopeToggle"),
  lightboxSearchScopeMenu: $("lightboxSearchScopeMenu"),
  lightboxCatalogMenuToggle: $("lightboxCatalogMenuToggle"),
  lightboxCatalogMenu: $("lightboxCatalogMenu"),
});
/* ===== END SOURCE: src/js/13-search-state.js ===== */

/* ===== BEGIN SOURCE: src/js/14-favorites-state.js ===== */
/**
 * Source module: 14-favorites-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

const FAVORITES_SHARE_PARAM = "selection";
const FAVORITES_SHARE_VERSION = 2;
const FAVORITES_NOTE_MAX_LENGTH = 280;

function getFavoritesStorage() {
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
}

/** @type {FavoritesStore|null} */
const favoritesStore = /** @type {FavoritesStore|null} */ (
  window.BargigFavorites?.createStore?.({ storage: getFavoritesStorage() }) || null
);
/** @type {FavoritesState} */
const favoritesState = {
  favoritesViewerIndex: 0,
  favoritesViewerOpeningHash: "",
  favoritesViewerPreviousCatalog: null,
  favoritesViewerPreviousPage: 1,
  favoritesOpen: false,
  favoritesReturnFocus: null,
  favoritesTransferPending: null,
  favoritesTransferReturnFocus: null,
  favoritesFilterCatalogId: "",
  favoritesSelectedKeys: new Set(),
  favoritesDragKey: "",
  favoriteNoteEditingKey: "",
  favoriteNoteReturnFocus: null,
};

/** @type {Readonly<Record<string, HTMLElement | null>>} */
const favoritesElements = Object.freeze({
  lightboxFavoritesButton: $("lightboxFavoritesButton"),
  lightboxFavoritesCount: $("lightboxFavoritesCount"),
  lightboxFavoritesSeparator: $("lightboxFavoritesSeparator"),
  favoritesPanel: $("favoritesPanel"),
  favoritesBackdrop: $("favoritesBackdrop"),
  favoritesCloseButton: $("favoritesCloseButton"),
  favoritesClearButton: $("favoritesClearButton"),
  favoritesShareButton: $("favoritesShareButton"),
  favoritesShareLabel: $("favoritesShareLabel"),
  favoritesInquiryButton: $("favoritesInquiryButton"),
  favoritesInquiryLabel: $("favoritesInquiryLabel"),
  favoritesHeaderWorkspace: $("favoritesHeaderWorkspace"),
  favoritesGrid: $("favoritesGrid"),
  favoritesEmpty: $("favoritesEmpty"),
  favoritesFilteredEmpty: $("favoritesFilteredEmpty"),
  favoritesResetFilter: $("favoritesResetFilter"),
  favoritesCatalogFilter: $("favoritesCatalogFilter"),
  favoritesVisibleCount: $("favoritesVisibleCount"),
  favoritesSelectionBar: $("favoritesSelectionBar"),
  favoritesSelectionCount: $("favoritesSelectionCount"),
  favoritesClearSelection: $("favoritesClearSelection"),
  favoriteNoteOverlay: $("favoriteNoteOverlay"),
  favoriteNoteBackdrop: $("favoriteNoteBackdrop"),
  favoriteNoteTitle: $("favoriteNoteTitle"),
  favoriteNoteContext: $("favoriteNoteContext"),
  favoriteNoteInput: $("favoriteNoteInput"),
  favoriteNoteCount: $("favoriteNoteCount"),
  favoriteNoteSave: $("favoriteNoteSave"),
  favoriteNoteCancel: $("favoriteNoteCancel"),
  favoriteNoteClose: $("favoriteNoteClose"),
  favoritesTransferOverlay: $("favoritesTransferOverlay"),
  favoritesTransferBackdrop: $("favoritesTransferBackdrop"),
  favoritesTransferTitle: $("favoritesTransferTitle"),
  favoritesTransferDescription: $("favoritesTransferDescription"),
  favoritesTransferSummary: $("favoritesTransferSummary"),
  favoritesTransferMerge: $("favoritesTransferMerge"),
  favoritesTransferReplace: $("favoritesTransferReplace"),
  favoritesTransferCancel: $("favoritesTransferCancel"),
  favoriteOpenCatalogButton: $("favoriteOpenCatalogButton"),
  viewerFavoriteButton: $("viewerFavoriteButton"),
  viewerMobileFavoritesLink: $("viewerMobileFavoritesLink"),
});
/* ===== END SOURCE: src/js/14-favorites-state.js ===== */

/* ===== BEGIN SOURCE: src/js/15-telemetry.js ===== */
/**
 * Source module: 15-telemetry.js
 * Privacy-first business telemetry and runtime error reporting.
 *
 * The browser sends only whitelisted, coarse events to the same-origin Pages Function.
 * No cookie, persistent visitor id, IP address, full referrer, user agent, or error stack is sent.
 * Respect for Global Privacy Control and Do Not Track is built in.
 */

const TELEMETRY_ENDPOINT = "/api/telemetry";
const TELEMETRY_SCHEMA_VERSION = 2;
const TELEMETRY_BATCH_LIMIT = 20;
const TELEMETRY_QUEUE_LIMIT = 60;
const TELEMETRY_FLUSH_DELAY_MS = 900;
const TELEMETRY_SEARCH_DEDUP_MS = 1200;
const TELEMETRY_ALLOWED_HOSTS = new Set([
  "bargig-furniture.com",
  "www.bargig-furniture.com"
]);
const TELEMETRY_EVENT_NAMES = new Set([
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
]);

const telemetryRuntime = {
  enabled: null,
  queue: [],
  flushTimer: 0,
  flushing: false,
  catalogKey: "",
  catalogAt: 0,
  searchKeys: new Map(),
  diagnosticEvents: new Set(),
  webVitals: {
    supported: new Set(),
    reported: new Set(),
    lcp: 0,
    inp: 0,
    cls: 0,
    clsSessionValue: 0,
    clsSessionStart: 0,
    clsLastEntry: 0
  },
  initialized: false
};

function telemetryResolveReleaseId() {
  const explicit = String(window.__BARGIG_RELEASE_ID__ || "").trim();
  if (explicit) return telemetryCleanText(explicit, 64);

  const scriptSrc = String(document.currentScript?.src || "");
  const filename = scriptSrc.split("?")[0].split("#")[0].split("/").pop() || "";
  const fingerprint = filename.match(/^app\.([a-f0-9]{8,64})\.js$/i)?.[1];
  if (fingerprint) return `app-${fingerprint.slice(0, 16).toLowerCase()}`;
  return filename === "app.js" ? "app-unversioned" : "unknown-release";
}

const TELEMETRY_RELEASE_ID = telemetryResolveReleaseId();

function telemetryCleanText(value, limit = 120) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function telemetryCleanPathname(value = window.location.pathname) {
  const pathname = telemetryCleanText(value, 180) || "/";
  return pathname.startsWith("/") ? pathname : `/${pathname}`;
}

function telemetryViewportBucket() {
  const width = Math.max(0, Number(window.innerWidth) || 0);
  if (width < 480) return "xs";
  if (width < 760) return "sm";
  if (width < 1100) return "md";
  if (width < 1600) return "lg";
  return "xl";
}

function telemetryPrivacySignalEnabled() {
  if (navigator.globalPrivacyControl === true) return true;
  const dnt = String(navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack || "").toLowerCase();
  return dnt === "1" || dnt === "yes";
}

function telemetryIsEnabled() {
  if (telemetryRuntime.enabled !== null) return telemetryRuntime.enabled;
  if (window.__BARGIG_DISABLE_TELEMETRY__ === true || telemetryPrivacySignalEnabled()) {
    telemetryRuntime.enabled = false;
    return false;
  }

  const forced = window.__BARGIG_ENABLE_TELEMETRY__ === true;
  const productionHost = TELEMETRY_ALLOWED_HOSTS.has(window.location.hostname.toLowerCase());
  telemetryRuntime.enabled = Boolean(forced || productionHost);
  return telemetryRuntime.enabled;
}

function telemetryNumber(value, min = 0, max = 86_400_000) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(max, Math.max(min, number));
}

function telemetryErrorFingerprint(parts) {
  const source = parts.map((part) => telemetryCleanText(part, 160)).join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `e${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function telemetryNormalizeEvent(name, fields = {}) {
  const eventName = telemetryCleanText(name, 40);
  if (!TELEMETRY_EVENT_NAMES.has(eventName)) return null;

  return {
    name: eventName,
    page: telemetryCleanText(fields.page || currentAppPage || document.body?.dataset?.page || "", 30),
    path: telemetryCleanPathname(fields.path),
    catalogId: telemetryCleanText(fields.catalogId, 100),
    query: telemetryCleanText(fields.query, 80),
    scope: telemetryCleanText(fields.scope, 50),
    action: telemetryCleanText(fields.action, 50),
    detail: telemetryCleanText(fields.detail, 120),
    error: telemetryCleanText(fields.error, 80),
    viewport: telemetryViewportBucket(),
    source: telemetryCleanText(fields.source, 50),
    value: telemetryNumber(fields.value, -1_000_000, 1_000_000),
    durationMs: telemetryNumber(fields.durationMs),
    pageNumber: telemetryNumber(fields.pageNumber, 0, 100_000),
    secondaryValue: telemetryNumber(fields.secondaryValue, -1_000_000, 1_000_000),
    releaseId: telemetryCleanText(fields.releaseId || TELEMETRY_RELEASE_ID, 64)
  };
}

function telemetryScheduleFlush(delay = TELEMETRY_FLUSH_DELAY_MS) {
  window.clearTimeout(telemetryRuntime.flushTimer);
  telemetryRuntime.flushTimer = window.setTimeout(() => {
    telemetryRuntime.flushTimer = 0;
    telemetryFlush().catch(() => {});
  }, Math.max(0, delay));
}

function telemetryTrack(name, fields = {}, options = {}) {
  if (!telemetryIsEnabled()) return false;
  const event = telemetryNormalizeEvent(name, fields);
  if (!event) return false;

  if (telemetryRuntime.queue.length >= TELEMETRY_QUEUE_LIMIT) {
    telemetryRuntime.queue.splice(0, telemetryRuntime.queue.length - TELEMETRY_QUEUE_LIMIT + 1);
  }
  telemetryRuntime.queue.push(event);
  telemetryScheduleFlush(options.immediate ? 0 : TELEMETRY_FLUSH_DELAY_MS);
  return true;
}

async function telemetryFlush(options = {}) {
  if (!telemetryIsEnabled() || telemetryRuntime.flushing || !telemetryRuntime.queue.length) return false;

  window.clearTimeout(telemetryRuntime.flushTimer);
  telemetryRuntime.flushTimer = 0;
  const events = telemetryRuntime.queue.splice(0, TELEMETRY_BATCH_LIMIT);
  const body = JSON.stringify({ version: TELEMETRY_SCHEMA_VERSION, events });
  telemetryRuntime.flushing = true;

  try {
    if (options.beacon && typeof navigator.sendBeacon === "function") {
      const queued = navigator.sendBeacon(TELEMETRY_ENDPOINT, new Blob([body], { type: "application/json" }));
      if (!queued) telemetryRuntime.queue.unshift(...events);
      return queued;
    }

    const response = await fetch(TELEMETRY_ENDPOINT, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      cache: "no-store",
      keepalive: true,
      redirect: "error"
    });
    if (!response.ok && response.status !== 202 && response.status !== 204) {
      throw new Error(`telemetry-http-${response.status}`);
    }
    return true;
  } catch (_error) {
    // Telemetry must never interfere with the catalog. Events are deliberately
    // not persisted or retried across page loads, which also protects privacy.
    return false;
  } finally {
    telemetryRuntime.flushing = false;
    if (telemetryRuntime.queue.length) telemetryScheduleFlush(250);
  }
}

function telemetryTrackCatalogOpen(catalog, page, source = LIGHTBOX_SOURCE_CATALOG) {
  if (!catalog) return;
  const now = Date.now();
  const key = `${catalog.id}|${source}`;
  if (key === telemetryRuntime.catalogKey && now - telemetryRuntime.catalogAt < 1200) return;
  telemetryRuntime.catalogKey = key;
  telemetryRuntime.catalogAt = now;
  telemetryTrack("catalog_open", {
    page: "viewer",
    catalogId: catalog.id,
    pageNumber: page,
    source
  });
}

function telemetryTrackSearch(query, resultCount, options = {}) {
  if (!telemetryIsEnabled()) return false;
  const cleanQuery = telemetryCleanText(query, 80);
  if (cleanQuery.length < 2) return false;

  const surface = telemetryCleanText(options.surface || "global", 30);
  const scope = telemetryCleanText(options.scope || "all", 50);
  const catalogId = telemetryCleanText(options.catalogId, 100);
  const completion = telemetryCleanText(options.completion || "submit", 30);
  const count = Math.max(0, Number(resultCount) || 0);
  const key = `${surface}|${cleanQuery}|${count}|${scope}|${catalogId}|${completion}`;
  const now = Date.now();
  const previous = telemetryRuntime.searchKeys.get(key) || 0;
  if (now - previous < TELEMETRY_SEARCH_DEDUP_MS) return false;
  telemetryRuntime.searchKeys.set(key, now);

  if (telemetryRuntime.searchKeys.size > 80) {
    for (const [storedKey, timestamp] of telemetryRuntime.searchKeys) {
      if (now - timestamp > 60_000) telemetryRuntime.searchKeys.delete(storedKey);
    }
  }

  return telemetryTrack("search", {
    query: cleanQuery,
    scope,
    catalogId,
    source: surface,
    action: completion,
    value: count
  }, { immediate: options.immediate === true });
}

function telemetryTrackFavorite(action, catalogId = "", pageNumber = 0, count = 0) {
  telemetryTrack("favorite", {
    action,
    catalogId,
    pageNumber,
    value: count
  });
}

const TELEMETRY_WEB_VITAL_THRESHOLDS = Object.freeze({
  LCP: [2500, 4000],
  INP: [200, 500],
  CLS: [0.1, 0.25]
});

function telemetryWebVitalRating(name, value) {
  const thresholds = TELEMETRY_WEB_VITAL_THRESHOLDS[name];
  if (!thresholds) return "unknown";
  if (value <= thresholds[0]) return "good";
  if (value <= thresholds[1]) return "needs-improvement";
  return "poor";
}

function telemetryNavigationType() {
  const navigation = performance.getEntriesByType?.("navigation")?.[0];
  return telemetryCleanText(navigation?.type || "navigate", 30);
}

function telemetryReportWebVitals() {
  const runtime = telemetryRuntime.webVitals;
  for (const name of ["LCP", "INP", "CLS"]) {
    if (!runtime.supported.has(name) || runtime.reported.has(name)) continue;
    const value = Number(runtime[name.toLowerCase()]);
    if (!Number.isFinite(value) || value < 0) continue;
    if ((name === "LCP" || name === "INP") && value === 0) continue;
    runtime.reported.add(name);
    telemetryTrack("web_vital", {
      action: name,
      detail: telemetryWebVitalRating(name, value),
      source: telemetryNavigationType(),
      value
    }, { immediate: true });
  }
}

function telemetryObserveWebVitals() {
  if (typeof PerformanceObserver !== "function") return;
  const supported = new Set(PerformanceObserver.supportedEntryTypes || []);
  const runtime = telemetryRuntime.webVitals;

  if (supported.has("largest-contentful-paint")) {
    runtime.supported.add("LCP");
    try {
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const latest = entries[entries.length - 1];
        if (latest) runtime.lcp = Math.max(0, Number(latest.startTime) || 0);
      }).observe({ type: "largest-contentful-paint", buffered: true });
    } catch (_error) {}
  }

  if (supported.has("layout-shift")) {
    runtime.supported.add("CLS");
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.hadRecentInput) continue;
          const start = Number(entry.startTime) || 0;
          const value = Number(entry.value) || 0;
          const sameSession = runtime.clsLastEntry
            && start - runtime.clsLastEntry < 1000
            && start - runtime.clsSessionStart < 5000;
          if (sameSession) {
            runtime.clsSessionValue += value;
          } else {
            runtime.clsSessionValue = value;
            runtime.clsSessionStart = start;
          }
          runtime.clsLastEntry = start;
          runtime.cls = Math.max(runtime.cls, runtime.clsSessionValue);
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch (_error) {}
  }

  if (supported.has("event")) {
    runtime.supported.add("INP");
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!Number(entry.interactionId)) continue;
          runtime.inp = Math.max(runtime.inp, Number(entry.duration) || 0);
        }
      }).observe({ type: "event", buffered: true, durationThreshold: 40 });
    } catch (_error) {}
  }
}

function telemetryCatalogImageContext(img, src = "") {
  const value = String(src || img?.currentSrc || img?.getAttribute?.("src") || "");
  const match = value.match(/\/assets\/pages\/([^/]+)\/(?:thumbs\/)?page-(\d+)/i);
  const catalogId = telemetryCleanText(match?.[1] || img?.dataset?.catalogId || navigationState.catalog?.id || "", 100);
  const pageNumber = Number.parseInt(match?.[2] || img?.dataset?.page || navigationState.page || 0, 10) || 0;
  let detail = "image";
  if (/\/thumbs\//i.test(value)) detail = "thumbnail";
  else if (img?.id === "lightboxImage") detail = "viewer";
  else if (img?.classList?.contains("catalog-cover")) detail = "cover";
  return { catalogId, pageNumber, detail, value };
}

function telemetryStableResourceUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw, window.location.href);
    parsed.hash = "";
    parsed.searchParams.delete(CATALOG_IMAGE_RETRY_PARAM);
    return parsed.href;
  } catch {
    return raw
      .replace(new RegExp(`([?&])${CATALOG_IMAGE_RETRY_PARAM}=[^&#]*&?`, "g"), "$1")
      .replace(/[?&]$/, "")
      .split("#")[0];
  }
}

function telemetryResourceSourceName(value) {
  const clean = telemetryStableResourceUrl(value);
  if (!clean) return "inline";
  try {
    const parsed = new URL(clean, window.location.href);
    if (["data:", "blob:"].includes(parsed.protocol)) return parsed.protocol.slice(0, -1);
    return telemetryCleanText(parsed.pathname.split("/").pop() || "root", 80);
  } catch {
    return telemetryCleanText(clean.split("/").pop() || "unknown", 80);
  }
}

function telemetryDiagnosticOnce(key) {
  const cleanKey = telemetryCleanText(key, 320);
  if (!cleanKey || telemetryRuntime.diagnosticEvents.has(cleanKey)) return false;
  telemetryRuntime.diagnosticEvents.add(cleanKey);
  if (telemetryRuntime.diagnosticEvents.size > 240) {
    telemetryRuntime.diagnosticEvents.delete(telemetryRuntime.diagnosticEvents.values().next().value);
  }
  return true;
}

function telemetryTrackImageEvent(name, src, options = {}) {
  const context = telemetryCatalogImageContext(options.img, src);
  const detail = telemetryCleanText(options.detail || context.detail, 50);
  const action = telemetryCleanText(options.action || "", 50);
  const stableUrl = telemetryStableResourceUrl(context.value);
  const source = telemetryResourceSourceName(stableUrl);
  const eventKey = [name, stableUrl, context.catalogId, context.pageNumber, detail, action].join("|");
  if (!telemetryDiagnosticOnce(eventKey)) return false;

  return telemetryTrack(name, {
    catalogId: context.catalogId,
    pageNumber: context.pageNumber,
    detail,
    action,
    source,
    value: telemetryNumber(options.failedAttempts ?? options.attempt ?? options.value, 0, 100),
    error: telemetryErrorFingerprint([name, context.catalogId, context.pageNumber, detail, action, source])
  }, { immediate: true });
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
  const value = String(filename || "").toLowerCase();
  if (!value) return "inline";
  if (/^(?:chrome|moz|safari)-extension:/.test(value)) return "extension";
  try {
    const parsed = new URL(value, window.location.href);
    return parsed.origin === window.location.origin ? "site" : "external";
  } catch {
    return "unknown";
  }
}

function telemetryIsRuntimeErrorEvent(event) {
  if (!event) return false;
  if (typeof ErrorEvent === "function" && event instanceof ErrorEvent) return true;
  return Object.prototype.toString.call(event) === "[object ErrorEvent]";
}

function telemetryClassifyWindowError(event) {
  if (typeof HTMLImageElement === "function" && event?.target instanceof HTMLImageElement) return "image";
  if (telemetryIsRuntimeErrorEvent(event)) return "runtime";
  if (typeof Element === "function" && event?.target instanceof Element) return "resource";
  return "ignored";
}

function telemetryTrackRuntimeError(event) {
  if (!telemetryIsRuntimeErrorEvent(event)) return false;
  const filename = String(event.filename || "");
  const sourceName = telemetryResourceSourceName(filename);
  const errorName = telemetryCleanText(event.error?.name || "Error", 40);
  const message = telemetryCleanText(event.message || event.error?.message || "JavaScript error", 120);
  return telemetryTrack("js_error", {
    catalogId: navigationState.catalog?.id || "",
    action: errorName,
    detail: message,
    scope: telemetryErrorSourceScope(filename),
    source: sourceName,
    pageNumber: Number(event.lineno) || 0,
    secondaryValue: Number(event.colno) || 0,
    error: telemetryErrorFingerprint([errorName, message, sourceName, event.lineno, event.colno])
  }, { immediate: true });
}

function telemetryResourceElementUrl(target) {
  return String(target?.currentSrc || target?.src || target?.href || target?.data || "");
}

function telemetryResourceRole(target) {
  const explicit = telemetryCleanText(target?.dataset?.telemetryResourceRole, 50);
  if (explicit) return explicit;
  if (target?.dataset?.searchIndexSrc) return "search-index";

  const tag = String(target?.tagName || "").toLowerCase();
  if (tag === "link") {
    const rel = telemetryCleanText(target.rel || target.getAttribute?.("rel") || "link", 24);
    const asType = telemetryCleanText(target.as || target.getAttribute?.("as") || "", 24);
    return asType ? `${rel}:${asType}` : rel;
  }
  return tag || "resource";
}

function telemetryTrackSearchIndexFailure(reason, options = {}) {
  const src = String(options.src || telemetryResourceElementUrl(options.target) || SEARCH_INDEX_SCRIPT_SRC || "");
  const source = telemetryResourceSourceName(src);
  const action = telemetryCleanText(reason || "load-error", 50);
  const detail = telemetryCleanText(options.trigger || options.target?.dataset?.telemetrySearchTrigger || "unknown", 50);
  const scope = telemetryErrorSourceScope(src);
  const key = ["search_index_load_failed", source, action, scope, detail].join("|");
  if (!telemetryDiagnosticOnce(key)) return false;
  return telemetryTrack("search_index_load_failed", {
    action,
    detail,
    scope,
    source,
    error: telemetryErrorFingerprint(["search-index", action, source, scope])
  }, { immediate: true });
}

function telemetryTrackResourceError(target) {
  const src = telemetryResourceElementUrl(target);
  const role = telemetryResourceRole(target);
  if (role === "search-index") {
    return telemetryTrackSearchIndexFailure("network-error", { target, src });
  }

  const tag = telemetryCleanText(String(target?.tagName || "resource").toLowerCase(), 30);
  const source = telemetryResourceSourceName(src);
  const scope = telemetryErrorSourceScope(src);
  const key = ["resource_error", tag, role, source, scope].join("|");
  if (!telemetryDiagnosticOnce(key)) return false;
  return telemetryTrack("resource_error", {
    action: tag,
    detail: role,
    scope,
    source,
    error: telemetryErrorFingerprint(["resource", tag, role, source, scope])
  }, { immediate: true });
}

function telemetryTrackUnhandledRejection(event) {
  const reason = event?.reason;
  const errorName = telemetryCleanText(reason?.name || "UnhandledRejection", 40);
  const message = telemetryCleanText(reason?.message || reason || "Unhandled promise rejection", 120);
  telemetryTrack("js_error", {
    catalogId: navigationState.catalog?.id || "",
    action: errorName,
    detail: message,
    scope: "promise",
    error: telemetryErrorFingerprint([errorName, message, "promise"]),
    source: "promise"
  }, { immediate: true });
}

function telemetryHandleDocumentClick(event) {
  const link = event.target?.closest?.("a[href]");
  if (!link) return;
  const href = String(link.getAttribute("href") || "").trim();
  let action = telemetryCleanText(link.dataset.contactAction, 50);
  if (!action && href.startsWith("tel:")) action = "phone";
  else if (!action && href.startsWith("mailto:")) action = "email";
  else if (!action && (link.classList.contains("site-footer-gmail-link") || /mail\.google\.com/i.test(href))) action = "gmail";
  if (action) {
    telemetryTrack("contact", {
      action,
      source: link.dataset.contactSource || "footer",
      catalogId: link.dataset.contactCatalogId || "",
      pageNumber: link.dataset.contactPage || 0
    }, { immediate: true });
  }
}

function telemetryInit() {
  if (telemetryRuntime.initialized) return;
  telemetryRuntime.initialized = true;
  if (!telemetryIsEnabled()) return;

  window.addEventListener("error", (event) => {
    const classification = telemetryClassifyWindowError(event);
    if (classification === "image") {
      if (event.target.dataset.telemetryManaged !== "true") {
        telemetryTrackImageTerminalFailure(event.target.currentSrc || event.target.src, {
          img: event.target,
          detail: telemetryCatalogImageContext(event.target).detail,
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
    if (classification === "resource") telemetryTrackResourceError(event.target);
  }, true);
  window.addEventListener("unhandledrejection", telemetryTrackUnhandledRejection);
  document.addEventListener("click", telemetryHandleDocumentClick, true);
  telemetryObserveWebVitals();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") return;
    telemetryReportWebVitals();
    telemetryFlush({ beacon: true }).catch(() => {});
  });
  window.addEventListener("pagehide", () => {
    telemetryReportWebVitals();
    telemetryFlush({ beacon: true }).catch(() => {});
  });
}
/* ===== END SOURCE: src/js/15-telemetry.js ===== */

/* ===== BEGIN SOURCE: src/js/20-shared-ui.js ===== */
/**
 * Source module: 20-shared-ui.js
 * Shared media loading, image placeholders, action feedback, asset paths, snapshots, and route helpers.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function catalogAssetBaseUrl() {
  const rawBase = String(window.BARGIG_CATALOG_ASSET_BASE_URL || "").trim();
  if (!rawBase) return "";
  return rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
}

function isAbsoluteAssetUrl(path) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path) || path.startsWith("//") || path.startsWith("data:");
}

function resolveCatalogAssetUrl(path) {
  const cleanPath = String(path || "").trim();
  if (!cleanPath || isAbsoluteAssetUrl(cleanPath)) return cleanPath;

  const baseUrl = catalogAssetBaseUrl();
  if (!baseUrl) return cleanPath;

  try {
    return new URL(cleanPath.replace(/^\/+/, ""), baseUrl).href;
  } catch {
    return `${baseUrl}${cleanPath.replace(/^\/+/, "")}`;
  }
}

function catalogImageCrossOriginAttribute() {
  return "";
}

function applyCatalogImageCrossOrigin(img) {
  if (img) img.removeAttribute("crossorigin");
}

function setCatalogImageSource(img, url) {
  if (!img) return;
  applyCatalogImageCrossOrigin(img);
  img.src = url;
}

function networkInformation() {
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

function isSaveDataEnabled() {
  return Boolean(networkInformation()?.saveData);
}

function catalogImageDeliveryMode() {
  const configured = String(window.BARGIG_CATALOG_IMAGE_DELIVERY_MODE || "").trim().toLowerCase();
  return configured === CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY
    ? CATALOG_IMAGE_DELIVERY_MODE_FULL_ONLY
    : CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE;
}

function catalogMediumImagesEnabled() {
  return catalogImageDeliveryMode() === CATALOG_IMAGE_DELIVERY_MODE_RESPONSIVE;
}

function networkEffectiveType() {
  return String(networkInformation()?.effectiveType || "").trim().toLowerCase();
}

function catalogNeighborPreloadRadius() {
  if (isSaveDataEnabled()) return 1;
  const effectiveType = networkEffectiveType();
  if (effectiveType === "slow-2g" || effectiveType === "2g") return 1;
  if (effectiveType === "3g") return 1;
  if (!catalogMediumImagesEnabled()) return 1;
  return 2;
}

function normalizeCatalogImageUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  try {
    const parsed = new URL(value, window.location.href);
    parsed.searchParams.delete(CATALOG_IMAGE_RETRY_PARAM);
    return parsed.href;
  } catch {
    return value.replace(new RegExp(`([?&])${CATALOG_IMAGE_RETRY_PARAM}=[^&#]*&?`, "g"), "$1")
      .replace(/[?&]$/, "");
  }
}

function unversionedCatalogImageUrl(url) {
  const value = normalizeCatalogImageUrl(url);
  if (!value) return "";
  try {
    const parsed = new URL(value, window.location.href);
    parsed.searchParams.delete(CATALOG_ASSET_VERSION_PARAM);
    return parsed.href;
  } catch {
    return value.replace(new RegExp(`([?&])${CATALOG_ASSET_VERSION_PARAM}=[^&#]*&?`, "g"), "$1")
      .replace(/[?&]$/, "");
  }
}

function cacheBustedCatalogImageUrl(url) {
  const value = normalizeCatalogImageUrl(url);
  if (!value) return "";
  try {
    const parsed = new URL(value, window.location.href);
    parsed.searchParams.set(CATALOG_IMAGE_RETRY_PARAM, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    return parsed.href;
  } catch {
    const separator = value.includes("?") ? "&" : "?";
    return `${value}${separator}${CATALOG_IMAGE_RETRY_PARAM}=${Date.now()}`;
  }
}

function catalogImageRecoveryCandidates(primarySrc, fallbackSrc = "", options = {}) {
  const primary = normalizeCatalogImageUrl(primarySrc);
  const fallback = normalizeCatalogImageUrl(fallbackSrc);
  const candidates = [];
  const push = (src, role, tier = "") => {
    if (!src || candidates.some((candidate) => candidate.src === src)) return;
    candidates.push({ src, role, tier, fallback: role.startsWith("fallback") });
  };

  const primaryTier = String(options.primaryTier || "");
  push(
    options.forceRefresh ? cacheBustedCatalogImageUrl(primary) : primary,
    options.forceRefresh ? "manual" : "primary",
    primaryTier
  );
  const unversionedPrimary = unversionedCatalogImageUrl(primary);
  if (unversionedPrimary && unversionedPrimary !== primary) {
    push(cacheBustedCatalogImageUrl(unversionedPrimary), "direct-retry", primaryTier);
  }
  if (fallback && fallback !== primary) push(fallback, "fallback", String(options.fallbackTier || ""));
  (Array.isArray(options.fallbackCandidates) ? options.fallbackCandidates : []).forEach((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return;
    push(
      normalizeCatalogImageUrl(candidate.src),
      String(candidate.role || `fallback-${index + 1}`),
      String(candidate.tier || "")
    );
  });
  return candidates;
}

function loadCatalogImageWithRecovery(img, options = {}) {
  const candidates = catalogImageRecoveryCandidates(options.primarySrc, options.fallbackSrc, options);
  const isCurrent = typeof options.isCurrent === "function" ? options.isCurrent : () => true;
  const telemetryDetail = telemetryCleanText(options.telemetryDetail, 40);
  let index = 0;
  let stopped = false;
  let failedAttempts = 0;
  let lastCandidate = null;

  img.dataset.telemetryManaged = "true";

  const attempt = () => {
    if (stopped || !isCurrent() || index >= candidates.length) {
      if (!stopped && isCurrent()) {
        if (telemetryDetail && lastCandidate) {
          telemetryTrackImageTerminalFailure(lastCandidate.src, {
            img,
            detail: telemetryDetail,
            action: lastCandidate.role,
            failedAttempts
          });
        }
        options.onExhausted?.({ failedAttempts, lastCandidate });
      }
      return;
    }

    const candidate = candidates[index++];
    lastCandidate = candidate;
    img.dataset.imageLoadPending = "true";
    prepareImagePlaceholder(img);
    let settled = false;
    const settle = (loaded) => {
      if (settled) return;
      settled = true;
      delete img.dataset.imageLoadPending;
      if (stopped || !isCurrent() || img.getAttribute("src") !== candidate.src) return;
      if (loaded && img.naturalWidth > 0) {
        syncImagePlaceholderState(img);
        if (telemetryDetail && failedAttempts > 0) {
          telemetryTrackImageRecovery(candidate.src, {
            img,
            detail: telemetryDetail,
            action: candidate.role,
            failedAttempts
          });
        }
        options.onSuccess?.(candidate, { failedAttempts, attempts: index });
        return;
      }
      failedAttempts += 1;
      if (telemetryDetail) {
        telemetryTrackImageAttemptFailure(candidate.src, {
          img,
          detail: `${telemetryDetail}-${candidate.role}`,
          action: candidate.role,
          attempt: failedAttempts
        });
      }
      options.onFailure?.(candidate, { failedAttempts, attempts: index });
      attempt();
    };

    img.addEventListener("load", () => settle(true), { once: true });
    img.addEventListener("error", () => settle(false), { once: true });
    options.onAttempt?.(candidate, { failedAttempts, attempts: index });
    setCatalogImageSource(img, candidate.src);
    if (img.complete) queueMicrotask(() => settle(Boolean(img.naturalWidth)));
  };

  attempt();
  return () => { stopped = true; };
}

function prepareCatalogImage(url, options = {}) {
  const src = String(url || "");
  if (!src) return Promise.reject(new Error("missing-image-src"));

  const cached = catalogAssetState.imageLoadCache.get(src);
  if (cached) return cached;

  const image = new Image();
  applyCatalogImageCrossOrigin(image);
  image.decoding = "async";
  image.fetchPriority = options.priority || "auto";

  const promise = new Promise((resolve, reject) => {
    image.addEventListener("load", async () => {
      // Preloads should be decode-ready, not merely network-complete. Otherwise a
      // neighboring page can still pause on its first paint even though its bytes
      // already arrived. Decode failures are non-fatal when the image itself loaded.
      if (typeof image.decode === "function") {
        try {
          await image.decode();
        } catch (_error) {
          // The load event and natural dimensions remain the source of truth.
        }
      }

      // Keep only lightweight readiness metadata in the promise cache. Returning
      // the Image object itself retained its decoded bitmap indefinitely, which
      // made a browsing session accumulate tens or hundreds of megabytes.
      resolve({
        width: Number(image.naturalWidth) || 0,
        height: Number(image.naturalHeight) || 0
      });
    }, { once: true });

    image.addEventListener("error", () => {
      catalogAssetState.imageLoadCache.delete(src);
      telemetryTrackImageAttemptFailure(src, {
        detail: options.detail || "preload",
        action: "preload",
        attempt: 1
      });
      reject(new Error("image-load-failed"));
    }, { once: true });

    image.src = src;
  });

  if (catalogAssetState.imageLoadCache.size >= CATALOG_IMAGE_PRELOAD_CACHE_LIMIT) {
    const oldestSrc = catalogAssetState.imageLoadCache.keys().next().value;
    if (oldestSrc) catalogAssetState.imageLoadCache.delete(oldestSrc);
  }
  catalogAssetState.imageLoadCache.set(src, promise);
  return promise;
}

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pad(num) {
  return String(num).padStart(3, "0");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function catalogCategoryName(catalog) {
  const category = String(catalog?.category || "").trim();
  return category || "קטלוגים";
}

function catalogSubcategoryName(catalog) {
  const value = catalog?.subcategory ?? catalog?.subCategory ?? catalog?.sub_category ?? catalog?.subcategories ?? catalog?.["תת קטגוריה"] ?? catalog?.["תת_קטגוריה"] ?? "";
  const rawSubcategory = Array.isArray(value) ? value.find((item) => String(item || "").trim()) : value;
  const subcategory = String(rawSubcategory || "").trim();
  return subcategory;
}

function categorySlug(value) {
  return String(value || "catalog")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u0590-\u05ff]+/g, "-")
    .replace(/^-+|-+$/g, "") || "catalog";
}

function categorySectionId(category, index) {
  return `catalog-category-${categorySlug(category)}-${index + 1}`;
}

function subcategorySectionId(category, categoryIndex, subcategory, subcategoryIndex) {
  return `${categorySectionId(category, categoryIndex)}-sub-${categorySlug(subcategory)}-${subcategoryIndex + 1}`;
}

const catalogTaxonomy = window.BARGIG_CATALOG_TAXONOMY || { categories: [], subcategories: [] };
const CATALOG_CATEGORY_SHARE_SLUGS = new Map(
  (Array.isArray(catalogTaxonomy.categories) ? catalogTaxonomy.categories : [])
    .map((item) => [String(item?.name || "").trim(), String(item?.slug || "").trim()])
    .filter(([name, slug]) => name && slug)
);
const CATALOG_SUBCATEGORY_SHARE_SLUGS = new Map(
  (Array.isArray(catalogTaxonomy.subcategories) ? catalogTaxonomy.subcategories : [])
    .map((item) => [String(item?.name || "").trim(), String(item?.slug || "").trim()])
    .filter(([name, slug]) => name && slug)
);

function normalizeShareRouteToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeShareRoutePath(value) {
  return String(value || "")
    .split("/")
    .map(normalizeShareRouteToken)
    .filter(Boolean)
    .join("/");
}

function categoryShareSlug(category, index) {
  const mapped = CATALOG_CATEGORY_SHARE_SLUGS.get(String(category || "").trim());
  return normalizeShareRouteToken(mapped) || normalizeShareRouteToken(category) || `category-${index + 1}`;
}

function subcategoryShareSlug(subcategory, index) {
  const mapped = CATALOG_SUBCATEGORY_SHARE_SLUGS.get(String(subcategory || "").trim());
  return normalizeShareRouteToken(mapped) || normalizeShareRouteToken(subcategory) || `sub-${index + 1}`;
}

function catalogCategorySharePath(category, index) {
  return categoryShareSlug(category, index);
}

function catalogSubcategorySharePath(category, categoryIndex, subcategory, subcategoryIndex) {
  return `${categoryShareSlug(category, categoryIndex)}/${subcategoryShareSlug(subcategory, subcategoryIndex)}`;
}

function getCatalogCategoryGroups() {
  const groups = [];
  const groupByCategory = new Map();

  catalogs.forEach((catalog) => {
    const category = catalogCategoryName(catalog);
    if (!groupByCategory.has(category)) {
      const group = {
        category,
        items: [],
        directItems: [],
        subcategories: [],
        subcategoryMap: new Map()
      };
      groupByCategory.set(category, group);
      groups.push(group);
    }

    const group = groupByCategory.get(category);
    const subcategory = catalogSubcategoryName(catalog);
    group.items.push(catalog);

    if (!subcategory) {
      group.directItems.push(catalog);
      return;
    }

    if (!group.subcategoryMap.has(subcategory)) {
      const subcategoryGroup = { subcategory, items: [] };
      group.subcategoryMap.set(subcategory, subcategoryGroup);
      group.subcategories.push(subcategoryGroup);
    }
    group.subcategoryMap.get(subcategory).items.push(catalog);
  });

  groups.forEach((group) => {
    group.hasSubcategories = group.subcategories.length > 0;
    delete group.subcategoryMap;
  });

  return groups;
}

function imageExt(catalog) {
  return catalog?.imageExt || "jpg";
}

function catalogDir(catalog) {
  return resolveCatalogAssetUrl(catalog?.dir || `assets/pages/${catalog.id}`);
}

function catalogAssetVersionForTier(catalog, tier) {
  const normalizedTier = String(tier || CATALOG_IMAGE_TIER_FULL);
  const variantVersion = String(catalog?.imageVariants?.[normalizedTier]?.version || "").trim();
  const baseVersion = variantVersion || String(catalog?.assetVersion || "").trim();
  if (!baseVersion) return "";
  return `${baseVersion}-${normalizedTier}-u${CATALOG_ASSET_URL_SCHEMA_VERSION}`;
}

function withAssetVersion(url, catalog, tier = CATALOG_IMAGE_TIER_FULL) {
  const version = catalogAssetVersionForTier(catalog, tier);
  if (!version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}${CATALOG_ASSET_VERSION_PARAM}=${encodeURIComponent(version)}`;
}

function pageSrc(catalog, page) {
  return withAssetVersion(
    `${catalogDir(catalog)}/page-${pad(page)}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_FULL
  );
}

function thumbSrc(catalog, page) {
  return withAssetVersion(
    `${catalogDir(catalog)}/thumbs/page-${pad(page)}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_THUMB
  );
}

function catalogImageVariant(catalog, tier) {
  if (tier === CATALOG_IMAGE_TIER_MEDIUM && !catalogMediumImagesEnabled()) return null;
  const variants = catalog?.imageVariants;
  if (variants && typeof variants === "object" && variants[tier] && typeof variants[tier] === "object") {
    return variants[tier];
  }
  if (tier === CATALOG_IMAGE_TIER_THUMB) return { directory: "thumbs", maxSide: 420 };
  if (tier === CATALOG_IMAGE_TIER_FULL) {
    const size = pageSize(catalog, 1);
    return { directory: "", maxSide: size ? Math.max(size.width, size.height) : 2800 };
  }
  return null;
}

function catalogSupportsImageTier(catalog, tier) {
  return Boolean(catalogImageVariant(catalog, tier));
}

function catalogImageTierMaxSide(catalog, tier) {
  const value = Number(catalogImageVariant(catalog, tier)?.maxSide);
  if (Number.isFinite(value) && value > 0) return value;
  return tier === CATALOG_IMAGE_TIER_MEDIUM ? DEFAULT_CATALOG_MEDIUM_MAX_SIDE : 0;
}

function mediumSrc(catalog, page) {
  const variant = catalogImageVariant(catalog, CATALOG_IMAGE_TIER_MEDIUM);
  if (!variant) return "";
  const directory = String(variant.directory || "medium").trim().replace(/^\/+|\/+$/g, "") || "medium";
  return withAssetVersion(
    `${catalogDir(catalog)}/${directory}/page-${pad(page)}.${imageExt(catalog)}`,
    catalog,
    CATALOG_IMAGE_TIER_MEDIUM
  );
}

function catalogPageImageSrc(catalog, page, tier) {
  if (tier === CATALOG_IMAGE_TIER_THUMB) return thumbSrc(catalog, page);
  if (tier === CATALOG_IMAGE_TIER_MEDIUM) return mediumSrc(catalog, page);
  return pageSrc(catalog, page);
}

function catalogCoverSrc(catalog) {
  return catalog?.cover ? withAssetVersion(resolveCatalogAssetUrl(catalog.cover), catalog) : pageSrc(catalog, 1);
}

function coverThumbSrc(catalog) {
  return thumbSrc(catalog, 1);
}

function pageSize(catalog, page) {
  const sizes = Array.isArray(catalog?.pageSizes) ? catalog.pageSizes : [];
  const size = sizes[page - 1];
  if (!Array.isArray(size) || size.length < 2) return null;
  const width = Number(size[0]);
  const height = Number(size[1]);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

function catalogPagesShareAspectRatio(firstCatalog, firstPage, secondCatalog, secondPage) {
  const firstSize = pageSize(firstCatalog, firstPage);
  const secondSize = pageSize(secondCatalog, secondPage);
  if (!firstSize || !secondSize) return false;

  const firstRatio = firstSize.width / firstSize.height;
  const secondRatio = secondSize.width / secondSize.height;
  return Math.abs(firstRatio - secondRatio) <= 0.001;
}

function catalogImageDimensionAttributes(catalog, page) {
  const size = pageSize(catalog, page);
  return size ? ` width="${size.width}" height="${size.height}"` : "";
}

function applyCatalogImageDimensions(image, catalog, page) {
  if (!image) return;
  const size = pageSize(catalog, page);
  if (!size) {
    image.removeAttribute("width");
    image.removeAttribute("height");
    return;
  }
  image.width = size.width;
  image.height = size.height;
}

function catalogCoverLoadingAttributes(catalog) {
  const index = catalogs.findIndex((item) => item?.id === catalog?.id);
  const eager = index >= 0 && index < CATALOG_EAGER_COVER_COUNT;
  return eager
    ? ' loading="eager" decoding="async" fetchpriority="high"'
    : ' loading="lazy" decoding="async" fetchpriority="low"';
}

function pageAspectStyle(catalog, page) {
  const size = pageSize(catalog, page);
  return size ? ` style="aspect-ratio: ${size.width} / ${size.height}"` : "";
}

function pageAspectVariableStyle(catalog, page, variableName = "--page-aspect-ratio") {
  const size = pageSize(catalog, page);
  return size ? ` style="${variableName}: ${size.width} / ${size.height}"` : "";
}

function applyLoadedPageAspect(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return;

  const frame = img.closest?.(".reader-page-frame");
  if (!frame) return;

  const width = Number(img.naturalWidth);
  const height = Number(img.naturalHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return;

  frame.style.aspectRatio = `${width} / ${height}`;

  const page = Number.parseInt(frame.dataset.page || "", 10);
  if (!navigationState.catalog || !Number.isFinite(page) || page < 1) return;

  if (!Array.isArray(navigationState.catalog.pageSizes)) navigationState.catalog.pageSizes = [];
  navigationState.catalog.pageSizes[page - 1] = [width, height];

}

function watchLoadedPageAspect(img) {
  if (!img) return;

  if (img.complete && img.naturalWidth && img.naturalHeight) {
    applyLoadedPageAspect(img);
    return;
  }

  img.addEventListener("load", () => applyLoadedPageAspect(img), { once: true });
}

function clampPage(page, catalog = navigationState.catalog) {
  const parsed = Number.parseInt(page, 10);
  if (!Number.isFinite(parsed)) return 1;
  const maxPage = Math.max(1, Number(catalog?.pages || 1));
  return Math.min(Math.max(parsed, 1), maxPage);
}

function safeFilePart(value) {
  return String(value || "catalog")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72) || "catalog";
}

function getTooltipText(button) {
  return window.BargigTooltips?.getText?.(button) || button?.getAttribute?.("title") || "";
}

function setTooltipText(button, text, options = {}) {
  if (!button) return;
  if (window.BargigTooltips?.setText) {
    window.BargigTooltips.setText(button, text, options);
    return;
  }

  if (text) button.setAttribute("title", text);
  else button.removeAttribute("title");
}

function flashActionButton(button, message) {
  if (!button || !message) return;
  const originalTooltip = getTooltipText(button);
  setTooltipText(button, message);
  button.classList.remove("reader-icon-button-feedback");
  void button.offsetWidth;
  button.classList.add("reader-icon-button-done", "reader-icon-button-feedback");
  window.setTimeout(() => {
    setTooltipText(button, originalTooltip);
    button.classList.remove("reader-icon-button-done", "reader-icon-button-feedback");
  }, 1200);
}

function actionToastTone(message) {
  if (message === "נשמר" || message === "התמונה נשמרה") return "saved";
  if (message === "הוסר" || message.includes("הוסרו")) return "removed";
  if (message.includes("קישור")) return "link";
  return "info";
}

function showActionToast(message, options = {}) {
  if (!shellElements.siteActionToast || !message) return;
  const normalizedOptions = typeof options === "number" ? { duration: options } : options;
  const duration = Math.max(1000, Number(normalizedOptions.duration) || 1000);

  window.clearTimeout(uiRuntime.actionToastTimer);
  shellElements.siteActionToast.textContent = message;
  shellElements.siteActionToast.dataset.tone = normalizedOptions.tone || actionToastTone(message);
  shellElements.siteActionToast.classList.remove("hidden", "visible");
  void shellElements.siteActionToast.offsetWidth;
  window.requestAnimationFrame(() => shellElements.siteActionToast.classList.add("visible"));
  uiRuntime.actionToastTimer = window.setTimeout(() => {
    shellElements.siteActionToast.classList.remove("visible");
    window.setTimeout(() => {
      if (!shellElements.siteActionToast.classList.contains("visible")) {
        shellElements.siteActionToast.classList.add("hidden");
      }
    }, 180);
  }, duration);
}

const IMAGE_PLACEHOLDER_FRAME_SELECTOR = [
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
  return img?.closest?.(IMAGE_PLACEHOLDER_FRAME_SELECTOR) || null;
}

function syncImagePlaceholderState(img) {
  const frame = imagePlaceholderFrame(img);
  if (!frame) return;

  frame.classList.add("image-placeholder-frame");
  const pending = img.dataset.imageLoadPending === "true";
  const isReady = !pending && Boolean(img.complete && img.naturalWidth > 0);
  const isError = !pending && Boolean(img.complete && !img.naturalWidth && (img.currentSrc || img.getAttribute("src")));
  frame.classList.toggle("image-ready", isReady);
  frame.classList.toggle("image-error", isError);
  frame.classList.toggle("image-loading", pending || (!isReady && !isError));
}

function prepareImagePlaceholder(img) {
  const frame = imagePlaceholderFrame(img);
  if (!frame) return;
  frame.classList.add("image-placeholder-frame");
  if (img.dataset.imageLoadPending === "true") {
    frame.classList.remove("image-ready", "image-error");
    frame.classList.add("image-loading");
    return;
  }
  if (img.complete) {
    syncImagePlaceholderState(img);
    return;
  }
  frame.classList.remove("image-ready", "image-error");
  frame.classList.add("image-loading");
}

function initImagePlaceholderObserver() {
  document.querySelectorAll(`${IMAGE_PLACEHOLDER_FRAME_SELECTOR} img`).forEach(prepareImagePlaceholder);

  document.addEventListener("load", (event) => {
    if (event.target instanceof HTMLImageElement) syncImagePlaceholderState(event.target);
  }, true);
  document.addEventListener("error", (event) => {
    if (event.target instanceof HTMLImageElement) syncImagePlaceholderState(event.target);
  }, true);

  if (!("MutationObserver" in window) || !document.body) return;
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes" && mutation.target instanceof HTMLImageElement) {
        prepareImagePlaceholder(mutation.target);
        return;
      }
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (node.matches?.("img")) prepareImagePlaceholder(node);
        node.querySelectorAll?.("img").forEach(prepareImagePlaceholder);
      });
    });
  });
  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["src", "data-src"]
  });
}

function loadDeferredImage(img) {
  const src = img?.dataset?.src;
  if (!src) return;

  const markLoaded = () => {
    applyLoadedPageAspect(img);
    img.classList.add("loaded");
    img.removeAttribute("data-src");
  };

  if (img.getAttribute("src") === src) {
    if (img.complete && img.naturalWidth) markLoaded();
    return;
  }

  img.addEventListener("load", markLoaded, { once: true });
  setCatalogImageSource(img, src);
}




function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 900);
}

async function downloadCatalogPageSnapshot(catalog, page, button) {
  if (!catalog) return;
  const currentPage = clampPage(page, catalog);
  const src = pageSrc(catalog, currentPage);

  try {
    if (!window.CatalogSnapshot?.buildSnapshotBlob) {
      throw new Error("snapshot-exporter-missing");
    }

    const blob = await window.CatalogSnapshot.buildSnapshotBlob(src);
    const extension = window.CatalogSnapshot.extension || "jpg";
    saveBlob(blob, `${safeFilePart(catalog.title || catalog.id)}-page-${pad(currentPage)}.${extension}`);
    flashActionButton(button, "נשמר");
    showActionToast("התמונה נשמרה", { tone: "saved" });
  } catch (error) {
    console.error("[CatalogSnapshot] Failed to export catalog page", {
      catalogId: catalog.id,
      page: currentPage,
      src,
      error
    });
    window.alert("לא הצלחתי ליצור את תמונת העמוד. יש לוודא שמדיניות CORS של מאגר התמונות מאפשרת קריאה מהאתר.");
  }
}

function hasHoverPointer() {
  if (typeof window.matchMedia !== "function") return true;
  const primaryFineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const anyFineHover = window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;
  return primaryFineHover || anyFineHover;
}

function isTouchLikePointer(event) {
  return event?.pointerType === "touch" || event?.pointerType === "pen";
}

function getCurrentCatalogFocusUrlTargetId() {
  const catalogGrid = getFeatureInterface("catalog-grid");
  const hashTargetId = catalogGrid?.resolveCategoryTargetIdFromHash?.() || "";
  if (hashTargetId && catalogGrid?.hasCategoryTarget?.(hashTargetId)) {
    return hashTargetId;
  }

  const activeTargetId = catalogGrid?.activeCategoryTargetId?.() || "";
  if (activeTargetId && catalogGrid?.hasCategoryTarget?.(activeTargetId)) {
    return activeTargetId;
  }

  return "";
}

function encodeHashRouteSegment(value) {
  return encodeURIComponent(String(value ?? ""));
}

function decodeHashRouteSegment(value) {
  const segment = String(value || "");
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function encodeShareRoutePath(path) {
  const normalizedPath = normalizeShareRoutePath(path);
  if (!normalizedPath) return "";
  return normalizedPath.split("/").map(encodeHashRouteSegment).join("/");
}

function buildCategoryShareRouteHash(path) {
  const encodedPath = encodeShareRoutePath(path);
  return encodedPath ? `#cat/${encodedPath}` : "";
}

function findCatalogById(id) {
  const catalogId = String(id || "");
  return catalogs.find((item) => String(item.id || "") === catalogId) || null;
}

function syncDocumentLock() {
  let documentLocked = false;
  let viewerOpen = false;
  featureInterfaces.forEach((api) => {
    if (typeof api.requiresDocumentLock === "function" && api.requiresDocumentLock()) {
      documentLocked = true;
    }
    if (typeof api.isViewerOpen === "function" && api.isViewerOpen()) {
      viewerOpen = true;
    }
  });
  document.body.classList.toggle("no-scroll", documentLocked);
  document.documentElement.classList.toggle("viewer-open", viewerOpen);
}

function handleTopLayerEscape(event) {
  if (event.key !== "Escape" || event.defaultPrevented) return false;

  for (const api of featureInterfacesByEscapePriority()) {
    if (api.closeTopLayer(event) !== true) continue;
    event.preventDefault();
    return true;
  }
  return false;
}
/* ===== END SOURCE: src/js/20-shared-ui.js ===== */

/* ===== BEGIN SOURCE: src/js/30-favorites-share.js ===== */
/**
 * Source module: 30-favorites-share.js
 * Favorites storage integration, portable selection links, favorites panels, and link sharing.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function favoriteIdentity(catalog = navigationState.catalog, page = navigationState.page) {
  if (!catalog) return null;
  return {
    catalogId: String(catalog.id || ""),
    page: clampPage(page, catalog)
  };
}

function getFavoriteEntries() {
  if (!favoritesStore) return [];
  return favoritesStore.read().flatMap((item) => {
    const catalog = findCatalogById(item.catalogId);
    const page = Number.parseInt(item.page, 10);
    const maxPage = Number.parseInt(catalog?.pages, 10);
    if (!catalog || !Number.isFinite(page) || page < 1 || !Number.isFinite(maxPage) || page > maxPage) return [];
    return [{ ...item, catalog, page }];
  });
}


function getValidFavoriteItems() {
  return getFavoriteEntries().map(({ catalogId, catalog, page, savedAt, note }) => {
    const item = {
      catalogId: String(catalogId || catalog?.id || ""),
      page,
      savedAt: Number(savedAt) > 0 ? Number(savedAt) : 0
    };
    if (String(note || "").trim()) item.note = String(note).trim();
    return item;
  });
}

function favoriteItemKey(item) {
  const catalogId = String(item?.catalogId || item?.catalog?.id || "").trim();
  const page = Number.parseInt(item?.page, 10);
  return catalogId && Number.isFinite(page) && page > 0 ? `${catalogId}\u0000${page}` : "";
}

function normalizeFavoriteTransferItems(values) {
  const normalized = window.BargigFavorites?.normalizeItems?.(values) || [];
  const accepted = [];
  let rejected = Math.max(0, Array.isArray(values) ? values.length - normalized.length : 0);

  normalized.forEach((item) => {
    const catalog = findCatalogById(item.catalogId);
    const pageCount = Number.parseInt(catalog?.pages, 10);
    if (!catalog || !Number.isFinite(pageCount) || item.page > pageCount) {
      rejected += 1;
      return;
    }
    accepted.push({
      catalogId: item.catalogId,
      page: item.page,
      savedAt: Number(item.savedAt) > 0 ? Number(item.savedAt) : 0
    });
  });

  return { items: accepted, rejected };
}

function analyzeFavoriteItemMerge(incoming, existing = getValidFavoriteItems()) {
  const incomingItems = normalizeFavoriteTransferItems(incoming).items;
  const existingItems = window.BargigFavorites?.normalizeItems?.(existing) || [];
  const existingByKey = new Map(existingItems.map((item) => [favoriteItemKey(item), item]));
  const incomingKeys = new Set(incomingItems.map(favoriteItemKey).filter(Boolean));
  const newItems = incomingItems.filter((item) => !existingByKey.has(favoriteItemKey(item)));
  const alreadyExistingItems = incomingItems.filter((item) => existingByKey.has(favoriteItemKey(item)));
  const mergedIncomingItems = incomingItems.map((item) => {
    const existingItem = existingByKey.get(favoriteItemKey(item));
    if (!existingItem) return item;
    return {
      ...item,
      savedAt: Number(existingItem.savedAt) > 0 ? Number(existingItem.savedAt) : Number(item.savedAt) || 0,
      ...(String(existingItem.note || "").trim() ? { note: String(existingItem.note).trim() } : {})
    };
  });
  const preservedExistingItems = existingItems.filter((item) => !incomingKeys.has(favoriteItemKey(item)));

  return {
    incomingItems,
    existingItems,
    newItems,
    alreadyExistingItems,
    mergedItems: [...mergedIncomingItems, ...preservedExistingItems]
  };
}

function mergeFavoriteItemLists(incoming, existing = getValidFavoriteItems()) {
  return analyzeFavoriteItemMerge(incoming, existing).mergedItems;
}

function encodeBase64UrlUtf8(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return window.btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64UrlUtf8(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = window.atob(`${normalized}${padding}`);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function canonicalizeFavoriteShareItems(items) {
  const normalized = normalizeFavoriteTransferItems(items).items.map(({ catalogId, page }) => ({ catalogId, page }));
  const catalogOrder = new Map(catalogs.map((catalog, index) => [String(catalog.id || ""), index]));
  return normalized.sort((a, b) => {
    const aIndex = catalogOrder.has(a.catalogId) ? catalogOrder.get(a.catalogId) : Number.MAX_SAFE_INTEGER;
    const bIndex = catalogOrder.has(b.catalogId) ? catalogOrder.get(b.catalogId) : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    const catalogCompare = a.catalogId.localeCompare(b.catalogId, "he");
    return catalogCompare || a.page - b.page;
  });
}

function encodeFavoritePageRanges(pages) {
  const sorted = [...new Set(pages.map((page) => Number.parseInt(page, 10)).filter((page) => Number.isFinite(page) && page > 0))]
    .sort((a, b) => a - b);
  const ranges = [];
  for (let index = 0; index < sorted.length;) {
    const start = sorted[index];
    let end = start;
    while (index + 1 < sorted.length && sorted[index + 1] === end + 1) {
      index += 1;
      end = sorted[index];
    }
    const encodedStart = start.toString(36);
    ranges.push(end === start ? encodedStart : `${encodedStart}-${end.toString(36)}`);
    index += 1;
  }
  return ranges.join(",");
}

function decodeFavoritePageRanges(value) {
  const pages = [];
  String(value || "").split(",").forEach((part) => {
    if (!part) return;
    const [rawStart, rawEnd = rawStart] = part.split("-", 2);
    const start = Number.parseInt(rawStart, 36);
    const end = Number.parseInt(rawEnd, 36);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start || end - start > 1000) return;
    for (let page = start; page <= end; page += 1) pages.push(page);
  });
  return pages;
}

function buildFavoritesShareToken(items) {
  const grouped = new Map();
  canonicalizeFavoriteShareItems(items).forEach(({ catalogId, page }) => {
    if (!grouped.has(catalogId)) grouped.set(catalogId, []);
    grouped.get(catalogId).push(page);
  });
  const payload = [...grouped.entries()]
    .map(([catalogId, pages]) => `${encodeURIComponent(catalogId)}~${encodeFavoritePageRanges(pages)}`)
    .join("|");
  return `v${FAVORITES_SHARE_VERSION}.${encodeBase64UrlUtf8(payload)}`;
}

function parseFavoritesShareToken(token) {
  const rawToken = String(token || "").trim();
  const prefix = `v${FAVORITES_SHARE_VERSION}.`;
  if (!rawToken.startsWith(prefix)) return { items: [], rejected: 0, valid: false };

  try {
    const payload = decodeBase64UrlUtf8(rawToken.slice(prefix.length));
    const rawItems = [];
    if (payload) {
      payload.split("|").forEach((group) => {
        const separatorIndex = group.indexOf("~");
        if (separatorIndex < 1) return;
        const catalogId = decodeURIComponent(group.slice(0, separatorIndex));
        decodeFavoritePageRanges(group.slice(separatorIndex + 1)).forEach((page) => {
          rawItems.push({ catalogId, page, savedAt: 0 });
        });
      });
    }
    const normalized = normalizeFavoriteTransferItems(rawItems);
    return { ...normalized, valid: true };
  } catch (_error) {
    return { items: [], rejected: 0, valid: false };
  }
}

function buildFavoritesShareUrl(items) {
  const url = new URL(favoritesDocumentUrl(), window.location.href);
  url.hash = "";
  url.searchParams.set(FAVORITES_SHARE_PARAM, buildFavoritesShareToken(items));
  return url.toString();
}

function cleanFavoritesSelectionFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(FAVORITES_SHARE_PARAM)) return;
  url.searchParams.delete(FAVORITES_SHARE_PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function syncFavoritesTransferDialogUi() {
  const pending = favoritesState.favoritesTransferPending;
  if (!pending || !favoritesElements.favoritesTransferOverlay) return;
  const comparison = analyzeFavoriteItemMerge(pending.items, getValidFavoriteItems());
  const incomingCount = comparison.incomingItems.length;
  const currentCount = comparison.existingItems.length;
  const newCount = comparison.newItems.length;
  const alreadyExistingCount = comparison.alreadyExistingItems.length;
  if (favoritesElements.favoritesTransferTitle) favoritesElements.favoritesTransferTitle.textContent = "רשימת מועדפים התקבלה";
  if (favoritesElements.favoritesTransferDescription) {
    favoritesElements.favoritesTransferDescription.textContent = "הקישור כולל מועדפים ממחשב אחר. בחרו כיצד לשלב אותם עם הרשימה הקיימת.";
  }
  if (favoritesElements.favoritesTransferSummary) {
    const rejectedText = pending.rejected ? ` · ${pending.rejected} פריטים לא היו זמינים באתר זה` : "";
    const existingLabel = alreadyExistingCount === 1 ? "קיים" : "קיימים";
    const newLabel = newCount === 1 ? "חדש" : "חדשים";
    const overlapText = alreadyExistingCount > 0
      ? `\nמתוכם ${alreadyExistingCount} ${existingLabel} ו-${newCount} ${newLabel}`
      : "";
    favoritesElements.favoritesTransferSummary.textContent = `${incomingCount} פריטים ברשימה שהתקבלה · ${currentCount} פריטים שמורים כעת${rejectedText}${overlapText}`;
  }
}

function openFavoritesTransferDialog(transfer, returnFocus = document.activeElement) {
  if (!transfer?.items?.length || !favoritesElements.favoritesTransferOverlay) return false;
  favoritesState.favoritesTransferPending = transfer;
  favoritesState.favoritesTransferReturnFocus = returnFocus;
  syncFavoritesTransferDialogUi();
  favoritesElements.favoritesTransferOverlay.classList.remove("hidden");
  favoritesElements.favoritesTransferOverlay.setAttribute("aria-hidden", "false");
  syncDocumentLock();
  requestAnimationFrame(() => favoritesElements.favoritesTransferMerge?.focus());
  return true;
}

function closeFavoritesTransferDialog(options = {}) {
  const { restoreFocus = true, cleanUrl = false } = options;
  const returnFocus = favoritesState.favoritesTransferReturnFocus;
  favoritesState.favoritesTransferPending = null;
  favoritesState.favoritesTransferReturnFocus = null;
  favoritesElements.favoritesTransferOverlay?.classList.add("hidden");
  favoritesElements.favoritesTransferOverlay?.setAttribute("aria-hidden", "true");
  if (cleanUrl) cleanFavoritesSelectionFromUrl();
  syncDocumentLock();
  if (restoreFocus && returnFocus?.focus) returnFocus.focus();
}

function applyFavoritesTransfer(mode) {
  const pending = favoritesState.favoritesTransferPending;
  if (!pending?.items?.length || !favoritesStore) return;
  const timestamp = Date.now();
  const incoming = pending.items.map((item, index) => ({
    ...item,
    savedAt: Number(item.savedAt) > 0 ? Number(item.savedAt) : timestamp - index
  }));
  const comparison = analyzeFavoriteItemMerge(incoming, getValidFavoriteItems());
  const nextItems = mode === "merge"
    ? comparison.mergedItems
    : incoming;
  favoritesStore.replace(nextItems);
  closeFavoritesTransferDialog({ restoreFocus: false, cleanUrl: pending.source === "link" });
  syncFavoritesUi({ renderPanel: true });
  syncFavoriteViewerAfterStoreChange();
  const verb = mode === "merge" ? "מוזגה" : "נטענה";
  const rejectedText = pending.rejected ? ` · ${pending.rejected} לא היו זמינים` : "";
  const resultText = mode === "merge"
    ? `${comparison.newItems.length} חדשים · ${comparison.alreadyExistingItems.length} כבר היו שמורים`
    : `${incoming.length} פריטים`;
  showActionToast(`הרשימה ${verb}: ${resultText}${rejectedText}`, { tone: "saved", duration: 2800 });
  requestAnimationFrame(() => favoritesElements.favoritesGrid?.querySelector(".favorite-card")?.focus?.());
}

function prepareIncomingFavoritesTransfer(transfer, options = {}) {
  const { returnFocus = document.activeElement } = options;
  if (!transfer?.valid || !transfer.items.length || !favoritesStore) return false;
  const currentItems = getValidFavoriteItems();
  if (!currentItems.length) {
    favoritesState.favoritesTransferPending = transfer;
    applyFavoritesTransfer("replace");
    return true;
  }
  return openFavoritesTransferDialog(transfer, returnFocus);
}

function processFavoritesSelectionFromUrl() {
  if (!isAppPage("favorites")) return;
  const url = new URL(window.location.href);
  const token = url.searchParams.get(FAVORITES_SHARE_PARAM);
  if (!token) return;
  const parsed = parseFavoritesShareToken(token);
  if (!parsed.valid || !parsed.items.length) {
    cleanFavoritesSelectionFromUrl();
    showActionToast("הקישור אינו מכיל רשימת בחירה תקינה");
    return;
  }
  prepareIncomingFavoritesTransfer({ ...parsed, source: "link" }, { returnFocus: favoritesElements.favoritesShareButton });
}

function syncFavoritesShareButton(count = getFavoriteEntries().length) {
  if (!favoritesElements.favoritesShareButton) return;
  const hasItems = count > 0;
  favoritesElements.favoritesShareButton.disabled = !hasItems;
  favoritesElements.favoritesShareButton.setAttribute("aria-label", hasItems
    ? `העתקת קישור לרשימת המועדפים, ${count} עמודים שמורים`
    : "העתקת קישור לרשימת המועדפים — אין עדיין עמודים שמורים");
}

async function shareFavoritesList() {
  const workspace = getFeatureInterface("favorites-workspace");
  if (!workspace?.copyShareLink || !workspace?.shareLinkEntries) return;
  await workspace.copyShareLink(
    workspace.shareLinkEntries(),
    favoritesElements.favoritesShareButton
  );
}

function handleFavoritesTransferKeydown(event) {
  if (!favoritesState.favoritesTransferPending || !favoritesElements.favoritesTransferOverlay) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeFavoritesTransferDialog({ cleanUrl: favoritesState.favoritesTransferPending?.source === "link" });
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = Array.from(favoritesElements.favoritesTransferOverlay.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function isFavoritesLightboxMode() {
  return navigationState.lightboxSource === LIGHTBOX_SOURCE_FAVORITES;
}

function findFavoriteEntryIndex(entries, catalogId, page) {
  const normalizedCatalogId = String(catalogId || "");
  const normalizedPage = Number.parseInt(page, 10);
  return entries.findIndex((entry) => (
    String(entry.catalog?.id || entry.catalogId || "") === normalizedCatalogId &&
    entry.page === normalizedPage
  ));
}

function setFavoriteViewerEntry(entries, index) {
  if (!entries.length) return false;
  const nextIndex = clampValue(Number.parseInt(index, 10) || 0, 0, entries.length - 1);
  const entry = entries[nextIndex];
  favoritesState.favoritesViewerIndex = nextIndex;
  navigationState.catalog = entry.catalog;
  navigationState.page = entry.page;
  return true;
}

function syncFavoriteViewerAfterStoreChange(options = {}) {
  const viewer = getFeatureInterface("viewer");
  if (!viewer?.isViewerOpen?.() || !isFavoritesLightboxMode()) return;

  const { preferredIndex = favoritesState.favoritesViewerIndex } = options;
  const entries = getFavoriteEntries();
  if (!entries.length) {
    viewer.close?.({ restoreFavorites: true });
    return;
  }

  const currentIndex = findFavoriteEntryIndex(entries, navigationState.catalog?.id, navigationState.page);
  setFavoriteViewerEntry(entries, currentIndex >= 0 ? currentIndex : preferredIndex);
  viewer.renderPageRail?.();
  viewer.refresh?.({ thumbScrollIntoView: true });
}

function syncViewerFavoriteButtonUi() {
  const button = favoritesElements.viewerFavoriteButton;
  if (!button) return;
  const identity = favoriteIdentity();
  const isFavorite = Boolean(identity && favoritesStore?.has(identity));
  const label = isFavorite ? "הסרת העמוד מהמועדפים" : "הוספת העמוד למועדפים";
  button.dataset.favoriteActive = isFavorite ? "true" : "false";
  button.setAttribute("aria-pressed", isFavorite ? "true" : "false");
  button.setAttribute("aria-label", label);
  setTooltipText(button, label, { updateDefault: true });
  const hiddenLabel = button.querySelector(".visually-hidden");
  if (hiddenLabel) hiddenLabel.textContent = label;
}

function renderFavoritesPanel(entries = getFavoriteEntries()) {
  getFeatureInterface("favorites-workspace")?.render?.(entries);
}

function syncFavoritesShortcut(button, countElement, count) {
  if (countElement) countElement.textContent = String(count);
  if (!button) return;
  button.classList.toggle("hidden", count === 0);
  button.setAttribute("aria-label", `פתיחת מועדפים, ${count} עמודים שמורים`);
}

function syncFavoritesUi(options = {}) {
  const { renderPanel = favoritesState.favoritesOpen } = options;
  const entries = getFavoriteEntries();
  getFeatureInterface("favorites-workspace")?.prune?.(entries);
  const count = entries.length;
  syncFavoritesShortcut(shellElements.headerFavoritesButton, shellElements.headerFavoritesCount, count);
  syncFavoritesShortcut(favoritesElements.lightboxFavoritesButton, favoritesElements.lightboxFavoritesCount, count);
  favoritesElements.lightboxFavoritesSeparator?.classList.toggle("hidden", count === 0);
  favoritesElements.lightboxFavoritesSeparator?.setAttribute("aria-hidden", count === 0 ? "true" : "false");
  syncViewerFavoriteButtonUi();
  syncFavoritesShareButton(count);
  if (renderPanel) {
    renderFavoritesPanel(entries);
    if (favoritesState.favoritesOpen && entries.length === 0) {
      requestAnimationFrame(() => favoritesElements.favoritesCloseButton?.focus());
    }
  }
}

function openFavoritesPanel(options = {}) {
  const { allowEmpty = false, captureReturnFocus = true } = options;
  const entries = getFavoriteEntries();

  if (!isAppPage("favorites")) {
    if (allowEmpty || entries.length) navigateTo(favoritesDocumentUrl());
    return;
  }

  if (!favoritesElements.favoritesPanel || (!allowEmpty && !entries.length)) return;
  if (captureReturnFocus) favoritesState.favoritesReturnFocus = document.activeElement;
  favoritesState.favoritesOpen = true;
  renderFavoritesPanel(entries);
  favoritesElements.favoritesPanel.classList.remove("hidden");
  favoritesElements.favoritesPanel.classList.add("favorites-standalone-page");
  favoritesElements.favoritesPanel.setAttribute("aria-hidden", "false");
  favoritesElements.favoritesPanel.setAttribute("aria-modal", "false");
  syncDocumentLock();
  updateDocumentMetadata();
}

function hideFavoritesPanelUi(options = {}) {
  const { restoreFocus = false, preserveReturnFocus = false } = options;
  const returnFocus = favoritesState.favoritesReturnFocus;

  favoritesState.favoritesOpen = false;
  favoritesElements.favoritesPanel?.classList.add("hidden");
  favoritesElements.favoritesPanel?.classList.remove("favorites-standalone-page");
  favoritesElements.favoritesPanel?.setAttribute("aria-hidden", "true");
  favoritesElements.favoritesPanel?.setAttribute("aria-modal", "true");
  syncDocumentLock();

  if (restoreFocus && returnFocus?.focus) returnFocus.focus();
  if (!preserveReturnFocus) favoritesState.favoritesReturnFocus = null;
}

function closeFavoritesPanel(options = {}) {
  const { restoreFocus = true, preserveReturnFocus = false } = options;
  if (isAppPage("favorites")) {
    if ((hasInDocumentRouteSession || canReturnToSameSite()) && window.history.length > 1) navigateBack();
    else navigateTo(homeDocumentUrl(), { replace: true });
    return;
  }
  if (!favoritesState.favoritesOpen) return;
  hideFavoritesPanelUi({ restoreFocus, preserveReturnFocus });
}

function openFavoriteViewer(catalogId, page) {
  const entries = getFavoriteEntries();
  const index = findFavoriteEntryIndex(entries, catalogId, page);
  if (index < 0) return;

  if (!isAppPage("viewer")) {
    navigateTo(viewerDocumentUrl(catalogId, page, { source: LIGHTBOX_SOURCE_FAVORITES }));
    return;
  }

  favoritesState.favoritesViewerOpeningHash = window.location.href;
  favoritesState.favoritesViewerPreviousCatalog = navigationState.catalog;
  favoritesState.favoritesViewerPreviousPage = navigationState.page;
  setFavoriteViewerEntry(entries, index);
  getFeatureInterface("viewer")?.openCatalog?.(catalogId, page, {
    source: LIGHTBOX_SOURCE_FAVORITES,
    favoriteIndex: index
  });
}

function toggleCurrentPageFavorite() {
  const identity = favoriteIdentity();
  if (!identity || !favoritesStore) return;
  const previousFavoriteIndex = favoritesState.favoritesViewerIndex;
  const added = favoritesStore.toggle({ ...identity, savedAt: Date.now() });
  telemetryTrackFavorite(added ? "add" : "remove", identity.catalogId, identity.page, getFavoriteEntries().length);
  syncFavoritesUi({ renderPanel: true });
  if (isFavoritesLightboxMode() && !added) {
    syncFavoriteViewerAfterStoreChange({ preferredIndex: previousFavoriteIndex });
  }
  if (getFeatureInterface("viewer")?.isViewerOpen?.()) {
    const feedback = added ? "נשמר" : "הוסר";
    flashActionButton(favoritesElements.viewerFavoriteButton, feedback);
    showActionToast(feedback, { tone: added ? "saved" : "removed" });
  }
}

function removeFavorite(catalogId, page) {
  if (!favoritesStore) return;
  const removed = favoritesStore.remove({ catalogId, page });
  if (removed !== false) {
    favoritesState.favoritesSelectedKeys.delete(favoriteItemKey({ catalogId, page }));
    telemetryTrackFavorite("remove", catalogId, page, getFavoriteEntries().length);
  }
  syncFavoritesUi({ renderPanel: true });
  if (removed !== false) showActionToast("הוסר", { tone: "removed" });
}

function clearAllFavorites() {
  if (!favoritesStore || !getFavoriteEntries().length) return;
  if (!window.confirm("למחוק את כל העמודים מהמועדפים?")) return;
  favoritesStore.clear();
  favoritesState.favoritesSelectedKeys.clear();
  favoritesState.favoritesFilterCatalogId = "";
  telemetryTrackFavorite("clear", "", 0, 0);
  syncFavoritesUi({ renderPanel: true });
  showActionToast("כל המועדפים הוסרו", { tone: "removed" });
}

function handleFavoritesGridClick(event) {
  if (getFeatureInterface("favorites-workspace")?.handleGridClick?.(event)) return;
  const card = event.target.closest?.("[data-favorite-catalog][data-favorite-page]");
  if (!card || !favoritesElements.favoritesGrid?.contains(card)) return;
  const catalogId = card.dataset.favoriteCatalog;
  const page = Number.parseInt(card.dataset.favoritePage, 10);
  if (event.target.closest?.("[data-remove-favorite]")) {
    removeFavorite(catalogId, page);
    return;
  }
  if (event.target.closest?.("[data-open-favorite]")) openFavoriteViewer(catalogId, page);
}

function handleFavoritesStorageChange(event) {
  if (!favoritesStore || (event.key !== null && event.key !== favoritesStore.storageKey)) return;
  favoritesStore.reload();
  getFeatureInterface("favorites-workspace")?.prune?.(getFavoriteEntries());
  syncFavoritesUi({ renderPanel: true });
  if (favoritesState.favoritesTransferPending) syncFavoritesTransferDialogUi();
  syncFavoriteViewerAfterStoreChange();
}

function handleFavoritesPanelKeydown(event) {
  if (!favoritesState.favoritesOpen || event.key !== "Tab" || !favoritesElements.favoritesPanel) return;
  const focusable = Array.from(favoritesElements.favoritesPanel.querySelectorAll(
    'button:not([disabled]):not(.hidden), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.closest?.(".hidden"));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function currentVisibleDocumentUrl() {
  return window.location.href;
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.top = "-1000px";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function isMobileShareEnvironment() {
  if (typeof navigator.share !== "function") return false;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  const iPadDesktopMode = navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1;
  const userAgentDataMobile = navigator.userAgentData?.mobile === true;
  return Boolean(mobileUserAgent || iPadDesktopMode || userAgentDataMobile);
}

function currentShareLabel() {
  if (navigationState.catalog && isAppPage("viewer")) return `${navigationState.catalog.title} · עמוד ${navigationState.page}`;
  if (navigationState.catalog && isAppPage("catalog")) return navigationState.catalog.title;
  if (isAppPage("favorites")) return "המועדפים שלי · רהיטי ברגיג";
  return "קטלוגי רהיטי ברגיג";
}

async function shareOrCopyCurrentLink(button) {
  const link = currentVisibleDocumentUrl();

  if (isMobileShareEnvironment()) {
    try {
      await navigator.share({
        title: document.title,
        text: currentShareLabel(),
        url: link
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await copyTextToClipboard(link);
    flashActionButton(button, "הקישור הועתק");
    showActionToast("הקישור הועתק", { tone: "link" });
  } catch (_error) {
    showActionToast("לא ניתן להעתיק אוטומטית — אפשר להעתיק מהחלון שנפתח");
    window.prompt("אפשר להעתיק את הקישור מכאן:", link);
  }
}

async function shareCurrentMainHeaderLink() {
  await shareOrCopyCurrentLink(shellElements.headerCopyLink);
}

function attachFavoritesShareEvents() {
  shellElements.headerCopyLink?.addEventListener("click", () => shareCurrentMainHeaderLink());
  favoritesElements.favoritesBackdrop?.addEventListener("click", closeFavoritesPanel);
  favoritesElements.favoritesCloseButton?.addEventListener("click", closeFavoritesPanel);
  favoritesElements.favoritesClearButton?.addEventListener("click", clearAllFavorites);
  favoritesElements.favoritesShareButton?.addEventListener("click", () => shareFavoritesList());
  favoritesElements.favoritesGrid?.addEventListener("click", handleFavoritesGridClick);
  const workspace = getFeatureInterface("favorites-workspace");
  if (workspace?.attachEvents) {
    bindFeatureEventsOnce("favorites-workspace", workspace.attachEvents);
  }
  favoritesElements.favoritesPanel?.addEventListener("keydown", handleFavoritesPanelKeydown);
  favoritesElements.favoritesTransferBackdrop?.addEventListener("click", () => closeFavoritesTransferDialog({ cleanUrl: favoritesState.favoritesTransferPending?.source === "link" }));
  favoritesElements.favoritesTransferCancel?.addEventListener("click", () => closeFavoritesTransferDialog({ cleanUrl: favoritesState.favoritesTransferPending?.source === "link" }));
  favoritesElements.favoritesTransferMerge?.addEventListener("click", () => applyFavoritesTransfer("merge"));
  favoritesElements.favoritesTransferReplace?.addEventListener("click", () => applyFavoritesTransfer("replace"));
  favoritesElements.favoritesTransferOverlay?.addEventListener("keydown", handleFavoritesTransferKeydown);

  window.addEventListener("storage", handleFavoritesStorageChange);
}

registerFeatureInterface("favorites", {
  escapePriority: 500,
  requiresDocumentLock: () => Boolean(
    (favoritesState.favoritesOpen && !isAppPage("favorites")) ||
    favoritesState.favoritesTransferPending ||
    favoritesState.favoriteNoteEditingKey
  ),
  closeTopLayer: () => {
    if (favoritesState.favoriteNoteEditingKey) {
      getFeatureInterface("favorites-workspace")?.closeNoteEditor?.();
      return true;
    }
    if (favoritesState.favoritesTransferPending) {
      closeFavoritesTransferDialog({
        cleanUrl: favoritesState.favoritesTransferPending?.source === "link"
      });
      return true;
    }
    if (favoritesState.favoritesOpen) {
      closeFavoritesPanel();
      return true;
    }
    return false;
  }
});
/* ===== END SOURCE: src/js/30-favorites-share.js ===== */

/* ===== BEGIN SOURCE: src/js/40-catalog-grid.js ===== */
/**
 * Source module: 40-catalog-grid.js
 * Catalog navigation, category layout, catalog cards, preview grids, and catalog detail rendering.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function initRevealObserver() {
  const nodes = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window)) {
    nodes.forEach((node) => node.classList.add("in-view"));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting || entry.intersectionRatio > 0) {
        entry.target.classList.add("in-view");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0, rootMargin: "0px 0px -1px 0px" });

  nodes.forEach((node) => observer.observe(node));
}

function renderEmptyState() {
  const html = `
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

  if (catalogElements.catalogGrid) {
    catalogElements.catalogGrid.innerHTML = html;
    catalogElements.catalogGrid.setAttribute("aria-busy", "false");
    if (catalogElements.catalogLoadStatus) catalogElements.catalogLoadStatus.textContent = "אין קטלוגים זמינים כעת.";
  }
  if (catalogElements.pageGrid) {
    catalogElements.pageGrid.innerHTML = html;
    catalogElements.pageGrid.setAttribute("aria-busy", "false");
  }
  if (shellElements.catalogCount) shellElements.catalogCount.textContent = "0";
  if (shellElements.pageCount) shellElements.pageCount.textContent = "0";
  renderCategoryNav([]);
  showCatalogDetail();
  catalogElements.catalogTitle.textContent = "עדיין אין קטלוגים להצגה";
  catalogElements.catalogDescription.textContent = "הקטלוגים יופיעו כאן כשהם יהיו זמינים לצפייה.";
  if (catalogElements.catalogMenuToggleText) catalogElements.catalogMenuToggleText.textContent = "אין קטלוגים";
  if (catalogElements.catalogMenu) catalogElements.catalogMenu.innerHTML = `<div class="reader-catalog-menu-empty">אין קטלוגים להצגה</div>`;
  catalogElements.catalogCoverPreview?.removeAttribute("src");
  if (catalogElements.openCatalogEntryFromDetail) catalogElements.openCatalogEntryFromDetail.disabled = true;
}


const CATEGORY_NAV_MIN_BUTTON_SCALE = 0.68;
const CATEGORY_NAV_MIN_FONT_SIZE = 11;
const CATEGORY_NAV_MIN_BUTTON_HEIGHT = 30;
const CATEGORY_NAV_MIN_BUTTON_PADDING_X = 5;
const CATEGORY_NAV_MIN_GAP = 3;

function readPixelValue(value, fallback = 0) {
  const numeric = Number.parseFloat(String(value || ""));
  return Number.isFinite(numeric) ? numeric : fallback;
}

function categoryNavLinkLabel(link) {
  return String(link?.dataset?.categoryLabel || link?.textContent || "").trim();
}

function setCategoryNavLinkTooltip(link, text) {
  if (!link) return;
  setTooltipText(link, text || "", { updateDefault: true });
  link.removeAttribute("title");
}

function syncCategoryNavOverflowTooltips(links, enabled = true) {
  links.forEach((link) => {
    if (!enabled) {
      setCategoryNavLinkTooltip(link, "");
      return;
    }

    const isTextClipped = link.scrollWidth > link.clientWidth + 1;
    setCategoryNavLinkTooltip(link, isTextClipped ? categoryNavLinkLabel(link) : "");
  });
}

function clearCategoryNavFit(header, links = []) {
  if (!header) return;
  header.classList.remove("is-top-nav-compressed", "is-top-nav-tight", "is-top-nav-ellipsized");
  header.style.removeProperty("--top-nav-gap");
  header.style.removeProperty("--top-nav-button-min-height");
  header.style.removeProperty("--top-nav-button-padding-x");
  header.style.removeProperty("--top-nav-button-font-size");
  syncCategoryNavOverflowTooltips(links, false);
}

function readCategoryNavBaseMetrics(nav, firstLink) {
  const navStyle = window.getComputedStyle(nav);
  const linkStyle = window.getComputedStyle(firstLink);
  const paddingStart = readPixelValue(linkStyle.paddingInlineStart, 16);
  const paddingEnd = readPixelValue(linkStyle.paddingInlineEnd, paddingStart);

  return {
    gap: readPixelValue(navStyle.columnGap, 8),
    minHeight: readPixelValue(linkStyle.minHeight, 42),
    paddingX: Math.max(paddingStart, paddingEnd),
    fontSize: readPixelValue(linkStyle.fontSize, 16)
  };
}

function categoryNavRequiredWidth(nav, links) {
  if (!links.length) return 0;
  const gap = readPixelValue(window.getComputedStyle(nav).columnGap, 0);
  const linkWidth = links.reduce((sum, link) => sum + Math.ceil(link.scrollWidth), 0);
  return linkWidth + (gap * Math.max(0, links.length - 1));
}

function applyCategoryNavScale(header, metrics, scale) {
  const safeScale = Math.max(CATEGORY_NAV_MIN_BUTTON_SCALE, Math.min(1, scale));
  header.classList.add("is-top-nav-compressed");
  header.style.setProperty("--top-nav-gap", `${Math.max(CATEGORY_NAV_MIN_GAP, metrics.gap * safeScale).toFixed(2)}px`);
  header.style.setProperty("--top-nav-button-min-height", `${Math.max(CATEGORY_NAV_MIN_BUTTON_HEIGHT, metrics.minHeight * safeScale).toFixed(2)}px`);
  header.style.setProperty("--top-nav-button-padding-x", `${Math.max(CATEGORY_NAV_MIN_BUTTON_PADDING_X, metrics.paddingX * safeScale).toFixed(2)}px`);
  header.style.setProperty("--top-nav-button-font-size", `${Math.max(CATEGORY_NAV_MIN_FONT_SIZE, metrics.fontSize * safeScale).toFixed(2)}px`);
  return safeScale;
}

function fitCategoryNavToSingleRow() {
  catalogState.categoryNavFitRaf = 0;
  const nav = shellElements.categoryNav;
  const header = nav?.closest?.(".site-header");
  if (!nav || !header) return;

  const links = Array.from(nav.querySelectorAll(".category-nav-link"));
  clearCategoryNavFit(header, links);
  if (!links.length) return;

  const firstLink = links[0];
  const metrics = readCategoryNavBaseMetrics(nav, firstLink);
  const requiredWidth = categoryNavRequiredWidth(nav, links);
  const availableWidth = nav.clientWidth;

  if (!availableWidth || requiredWidth <= availableWidth + 1) return;

  const normalScale = applyCategoryNavScale(header, metrics, availableWidth / requiredWidth);
  const stillOverflows = requiredWidth * normalScale > nav.clientWidth + 1 || nav.scrollWidth > nav.clientWidth + 1;
  if (!stillOverflows) {
    syncCategoryNavOverflowTooltips(links);
    return;
  }

  header.classList.add("is-top-nav-tight");
  const tightAvailableWidth = nav.clientWidth;
  applyCategoryNavScale(header, metrics, tightAvailableWidth / requiredWidth);

  if (requiredWidth * CATEGORY_NAV_MIN_BUTTON_SCALE > tightAvailableWidth + 1 || nav.scrollWidth > nav.clientWidth + 1) {
    header.classList.add("is-top-nav-ellipsized");
  }

  syncCategoryNavOverflowTooltips(links);
}

function scheduleCategoryNavFit() {
  if (!shellElements.categoryNav) return;
  window.cancelAnimationFrame(catalogState.categoryNavFitRaf);
  catalogState.categoryNavFitRaf = window.requestAnimationFrame(fitCategoryNavToSingleRow);
}

function initCategoryNavFit() {
  if (!shellElements.categoryNav) return;
  document.querySelectorAll('img[data-brand-logo="1"]').forEach((image) => {
    image.addEventListener("load", scheduleCategoryNavFit);
  });
  if (document.fonts?.ready) {
    document.fonts.ready.then(scheduleCategoryNavFit).catch(() => {});
  }
  scheduleCategoryNavFit();
}


function renderCategoryNav(groups = getCatalogCategoryGroups()) {
  const links = groups.map((group, index) => {
    const targetId = categorySectionId(group.category, index);
    const sharePath = catalogCategorySharePath(group.category, index);
    return {
      href: categoryDocumentUrl(sharePath),
      targetId,
      sharePath,
      label: group.category
    };
  });

  if (shellElements.categoryNav) {
    shellElements.categoryNav.innerHTML = links.map((link) => `
      <a class="top-nav-link category-nav-link" href="${escapeHtml(link.href)}" data-category-target="${escapeHtml(link.targetId)}" data-category-share-path="${escapeHtml(link.sharePath)}" data-category-label="${escapeHtml(link.label)}">${escapeHtml(link.label)}</a>
    `).join("");
  }

  if (shellElements.mobileCategoryMenu) {
    shellElements.mobileCategoryMenu.innerHTML = links.length
      ? links.map((link) => `
          <a class="mobile-category-menu-link category-nav-link" role="menuitem" href="${escapeHtml(link.href)}" data-category-target="${escapeHtml(link.targetId)}" data-category-share-path="${escapeHtml(link.sharePath)}" data-category-label="${escapeHtml(link.label)}">
            <span>${escapeHtml(link.label)}</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m9 6 6 6-6 6" /></svg>
          </a>
        `).join("")
      : '<div class="mobile-category-menu-empty">אין קטגוריות להצגה</div>';
  }

  syncActiveCategoryNavLink();
  scheduleCategoryNavFit();
}

function isMobileCategoryMenuOpen() {
  return Boolean(shellElements.mobileCategoryMenu && !shellElements.mobileCategoryMenu.classList.contains("hidden"));
}

function setMobileCategoryMenuOpen(open, options = {}) {
  const shouldOpen = Boolean(open);
  if (!shellElements.mobileCategoryMenu || !shellElements.mobileCategoryMenuToggle) return;

  shellElements.mobileCategoryMenu.classList.toggle("hidden", !shouldOpen);
  shellElements.mobileCategoryMenu.classList.toggle("is-open", shouldOpen);
  shellElements.mobileCategoryMenuToggle.classList.toggle("is-active", shouldOpen);
  shellElements.mobileCategoryMenuToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  shellElements.mobileCategoryMenuToggle.setAttribute("aria-label", shouldOpen ? "סגירת תפריט קטגוריות" : "פתיחת תפריט קטגוריות");

  if (shouldOpen && options.focusFirst) {
    window.requestAnimationFrame(() => shellElements.mobileCategoryMenu?.querySelector(".mobile-category-menu-link")?.focus());
  } else if (!shouldOpen && options.focusButton) {
    window.requestAnimationFrame(() => shellElements.mobileCategoryMenuToggle?.focus({ preventScroll: true }));
  }
}

function closeMobileCategoryMenu(options = {}) {
  setMobileCategoryMenuOpen(false, options);
}

function decodeHashTargetId(hash = location.hash) {
  const rawHash = String(hash || "");
  if (!rawHash.startsWith("#")) return "";

  const rawId = rawHash.slice(1);
  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
}

function isCatalogFocusSection(section) {
  return Boolean(section?.classList?.contains("catalog-category-section") || section?.classList?.contains("catalog-subcategory-section"));
}

function getCatalogCategorySectionById(id) {
  const section = id ? document.getElementById(id) : null;
  return isCatalogFocusSection(section) ? section : null;
}

function getCatalogCategorySectionFromHash(hash = location.hash) {
  return getCatalogCategorySectionById(decodeHashTargetId(hash));
}

function getCatalogCategoryFocusTargetId(section) {
  return section?.dataset?.categoryFocusTarget || section?.id || "";
}

function getCatalogFocusSections() {
  if (!catalogElements.catalogGrid) return [];
  return Array.from(catalogElements.catalogGrid.querySelectorAll(".catalog-category-section, .catalog-subcategory-section"));
}

function getCatalogCategorySectionsByTargetId(targetId) {
  const normalizedTargetId = String(targetId || "");
  if (!normalizedTargetId) return [];

  return getCatalogFocusSections()
    .filter((section) => {
      const focusTargetId = getCatalogCategoryFocusTargetId(section);
      const parentCategoryTargetId = section?.dataset?.parentCategoryTarget || "";
      return focusTargetId === normalizedTargetId
        || parentCategoryTargetId === normalizedTargetId
        || section.id === normalizedTargetId;
    });
}

function catalogCategorySharePathFromHash(hash = location.hash) {
  const rawHash = String(hash || "");
  if (!rawHash.startsWith("#")) return "";

  const rawRoute = rawHash.slice(1).replace(/^\/+/, "");
  const parts = rawRoute.split("/");
  if (parts[0] !== "cat" || !parts[1]) return "";

  return normalizeShareRoutePath(parts.slice(1).map(decodeHashRouteSegment).join("/"));
}

function getCatalogCategorySectionBySharePath(path) {
  const normalizedPath = normalizeShareRoutePath(path);
  if (!normalizedPath) return null;

  return getCatalogFocusSections().find((section) => normalizeShareRoutePath(section?.dataset?.categorySharePath) === normalizedPath) || null;
}

function resolveCatalogCategoryTargetIdFromHash(hash = location.hash) {
  const sharePath = catalogCategorySharePathFromHash(hash);
  if (sharePath) {
    const section = getCatalogCategorySectionBySharePath(sharePath);
    return getCatalogCategoryFocusTargetId(section);
  }

  return decodeHashTargetId(hash);
}

function buildCatalogFocusRouteHash(targetId) {
  const section = getCatalogCategorySectionsByTargetId(targetId)[0] || getCatalogCategorySectionById(targetId);
  const sharePath = normalizeShareRoutePath(section?.dataset?.categorySharePath);
  return buildCategoryShareRouteHash(sharePath) || (targetId ? `#${encodeHashRouteSegment(targetId)}` : "");
}

function hasCatalogCategoryFocus(targetId) {
  return getCatalogCategorySectionsByTargetId(targetId)
    .some((section) => section.classList.contains("is-category-focus"));
}

function syncActiveCategoryNavLink(activeId = catalogState.categoryFocusTargetId) {
  const normalizedActiveId = String(activeId || "");

  [shellElements.categoryNav, shellElements.mobileCategoryMenu].forEach((container) => {
    container?.querySelectorAll(".category-nav-link").forEach((link) => {
      const isActive = Boolean(normalizedActiveId && link.dataset.categoryTarget === normalizedActiveId);
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  });

  catalogElements.catalogGrid?.querySelectorAll(".catalog-subcategory-nav-link").forEach((link) => {
    const isActive = Boolean(normalizedActiveId && link.dataset.categoryTarget === normalizedActiveId);
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function clearCatalogCategoryFocus(options = {}) {
  const { clearHash = false } = options;

  window.clearTimeout(catalogState.categoryFocusTimer);
  catalogState.categoryFocusTimer = 0;
  catalogState.categoryFocusTargetId = "";
  getCatalogFocusSections().forEach((section) => {
    section.classList.remove("is-category-focus");
  });
  syncActiveCategoryNavLink("");

  const hashTargetId = resolveCatalogCategoryTargetIdFromHash();
  if (clearHash && hashTargetId && getCatalogCategorySectionsByTargetId(hashTargetId).length && window.history?.replaceState) {
    history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  }

  return true;
}

function markCatalogCategoryFocus(section, options = {}) {
  if (!section) return false;

  const { animate = true, targetId: requestedTargetId = "" } = options;
  const targetId = String(requestedTargetId || getCatalogCategoryFocusTargetId(section) || "");
  const targetSections = getCatalogCategorySectionsByTargetId(targetId);
  if (!targetId || !targetSections.length) return false;

  window.clearTimeout(catalogState.categoryFocusTimer);
  catalogState.categoryFocusTimer = 0;

  getCatalogFocusSections().forEach((activeSection) => {
    if (!targetSections.includes(activeSection)) activeSection.classList.remove("is-category-focus");
  });

  targetSections.forEach((targetSection) => targetSection.classList.remove("is-category-focus"));
  if (animate) {
    // Restart the pulse cleanly across every visible segment of the selected category or subcategory.
    void targetSections[0].offsetWidth;
  }
  targetSections.forEach((targetSection) => targetSection.classList.add("is-category-focus"));

  catalogState.categoryFocusTargetId = targetId;
  syncActiveCategoryNavLink(targetId);
  return true;
}

function markCatalogCategoryFocusById(id, options = {}) {
  return markCatalogCategoryFocus(getCatalogCategorySectionById(id), { ...options, targetId: id });
}

function handleCatalogFocusLinkClick(link, event) {
  const targetId = link?.dataset?.categoryTarget || resolveCatalogCategoryTargetIdFromHash(link?.hash);
  if (!targetId) return;

  event.preventDefault();

  if (!isAppPage("home")) {
    navigateTo(`${homeDocumentUrl()}${buildCatalogFocusRouteHash(targetId)}`);
    return;
  }

  if (catalogState.categoryFocusTargetId === targetId && hasCatalogCategoryFocus(targetId)) {
    clearCatalogCategoryFocus({ clearHash: true });
    return;
  }

  const section = getCatalogCategorySectionById(targetId) || getCatalogCategorySectionsByTargetId(targetId)[0];
  markCatalogCategoryFocus(section, { targetId });
  section?.scrollIntoView?.({ behavior: "smooth", block: "start" });

  const hash = buildCatalogFocusRouteHash(targetId);
  if (hash) {
    location.hash = hash;
  }
}

function syncCatalogCategoryFocusFromHash(options = {}) {
  const targetId = resolveCatalogCategoryTargetIdFromHash();
  const section = getCatalogCategorySectionById(targetId);
  if (!section) {
    clearCatalogCategoryFocus();
    return false;
  }

  const { scroll = false } = options;
  if (scroll) section.scrollIntoView({ behavior: "smooth", block: "start" });
  return markCatalogCategoryFocus(section, { ...options, targetId });
}


function catalogLayoutColumnCount() {
  if (typeof window === "undefined" || !window.matchMedia) return 3;
  if (window.matchMedia("(max-width: 760px)").matches) return 1;
  if (window.matchMedia("(max-width: 1180px)").matches) return 2;
  return 3;
}

function clampCategorySpan(value, columns) {
  return Math.min(columns, Math.max(1, Number(value || 1)));
}

function catalogSubcategorySourceBlocks(source) {
  const sourceBlocks = [];

  if (Array.isArray(source?.directItems) && source.directItems.length) {
    sourceBlocks.push({
      blockKey: "__direct__",
      blockIndex: -1,
      label: "קטלוגים כלליים",
      isDirect: true,
      items: source.directItems
    });
  }

  (Array.isArray(source?.subcategories) ? source.subcategories : []).forEach((group, index) => {
    const subcategory = String(group?.subcategory || "").trim();
    const items = Array.isArray(group?.items) ? group.items : [];
    if (!subcategory || !items.length) return;

    sourceBlocks.push({
      blockKey: subcategory,
      blockIndex: index,
      label: subcategory,
      isDirect: false,
      items
    });
  });

  return sourceBlocks;
}

function catalogCategorySegments(groups, columns = catalogLayoutColumnCount()) {
  const safeColumns = clampCategorySpan(columns, 3);
  const segments = [];
  let occupied = 0;

  const appendCardBlockSegments = (group, groupIndex, block, options = {}) => {
    const items = Array.isArray(block?.items) ? block.items : [];
    if (!items.length) return;

    const segmentType = options.segmentType || "category";
    const layoutBlockKey = options.layoutBlockKey || `${segmentType}:${groupIndex}:${block?.blockKey || "main"}`;
    let itemOffset = 0;
    let segmentIndex = 0;

    while (itemOffset < items.length) {
      if (occupied >= safeColumns) occupied = 0;
      const availableInRow = occupied > 0 ? safeColumns - occupied : safeColumns;
      const span = Math.min(availableInRow, items.length - itemOffset, safeColumns);

      const segment = {
        category: group.category,
        groupIndex,
        segmentIndex,
        itemOffset,
        span,
        items: items.slice(itemOffset, itemOffset + span),
        hasSubcategories: Boolean(options.hasSubcategories),
        segmentType,
        layoutBlockKey,
        inlineDivider: false
      };

      if (segmentType === "subcategory") {
        Object.assign(segment, {
          blockKey: block.blockKey,
          blockIndex: block.blockIndex,
          blockOrder: options.blockOrder,
          label: block.label,
          isDirect: Boolean(block.isDirect)
        });
      }

      segments.push(segment);
      itemOffset += span;
      segmentIndex += 1;
      occupied += span;
      if (occupied >= safeColumns) occupied = 0;
    }
  };

  groups.forEach((group, groupIndex) => {
    const items = Array.isArray(group?.items) ? group.items : [];
    if (!items.length) return;

    if (group?.hasSubcategories) {
      if (occupied > 0) occupied = 0;

      segments.push({
        category: group.category,
        groupIndex,
        segmentIndex: 0,
        itemOffset: 0,
        span: safeColumns,
        items: [],
        directItems: Array.isArray(group.directItems) ? group.directItems : [],
        subcategories: Array.isArray(group.subcategories) ? group.subcategories : [],
        hasSubcategories: true,
        segmentType: "categoryHeader",
        layoutBlockKey: `category-header:${groupIndex}`,
        inlineDivider: false
      });
      occupied = 0;

      catalogSubcategorySourceBlocks(group).forEach((block, blockOrder) => {
        appendCardBlockSegments(group, groupIndex, block, {
          segmentType: "subcategory",
          hasSubcategories: true,
          blockOrder,
          layoutBlockKey: `subcategory:${groupIndex}:${block.blockKey}:${blockOrder}`
        });
      });
      return;
    }

    appendCardBlockSegments(group, groupIndex, { blockKey: "__category__", items }, {
      segmentType: "category",
      hasSubcategories: false,
      layoutBlockKey: `category:${groupIndex}`
    });
  });

  occupied = 0;
  segments.forEach((segment, index) => {
    const span = clampCategorySpan(segment.span, safeColumns);
    if (occupied + span > safeColumns) occupied = 0;

    const rowEnd = occupied + span;
    const nextSegment = segments[index + 1];
    const nextSpan = nextSegment ? clampCategorySpan(nextSegment.span, safeColumns) : 0;
    const sameLayoutBlock = Boolean(nextSegment && nextSegment.layoutBlockKey === segment.layoutBlockKey);
    segment.inlineDivider = Boolean(
      nextSegment
      && !sameLayoutBlock
      && segment.segmentType !== "categoryHeader"
      && nextSegment.segmentType !== "categoryHeader"
      && rowEnd < safeColumns
      && nextSpan <= safeColumns - rowEnd
    );

    occupied = rowEnd >= safeColumns ? 0 : rowEnd;
  });

  return segments;
}

function scheduleCatalogLayoutRefresh() {
  if (!catalogs.length) return;
  window.clearTimeout(catalogState.catalogLayoutResizeTimer);
  catalogState.catalogLayoutResizeTimer = window.setTimeout(() => {
    const nextColumns = catalogLayoutColumnCount();
    if (nextColumns !== catalogState.catalogLayoutColumns) renderCatalogCards();
  }, 120);
}

function renderCatalogCard(catalog, headingLevel = 3) {
  const cover = coverThumbSrc(catalog);
  const safeCatalogId = escapeHtml(catalog.id);
  const safeTitle = escapeHtml(catalog.title);
  const safeHeadingLevel = headingLevel === 4 ? 4 : 3;
  const catalogHref = escapeHtml(catalogDocumentUrl(catalog.id));
  return `
    <article class="catalog-card">
      <a class="catalog-cover-frame catalog-image-frame catalog-cover-button" href="${catalogHref}" data-open-catalog-entry="${safeCatalogId}" aria-label="פתיחת הקטלוג ${safeTitle}">
        <img class="catalog-cover" src="${escapeHtml(cover)}" alt="כריכת ${safeTitle}"${catalogImageDimensionAttributes(catalog, 1)}${catalogCoverLoadingAttributes(catalog)}${catalogImageCrossOriginAttribute(cover)} />
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

  const buttons = segment.subcategories.map((group, index) => {
    const targetId = subcategorySectionId(segment.category, segment.groupIndex, group.subcategory, index);
    const sharePath = catalogSubcategorySharePath(segment.category, segment.groupIndex, group.subcategory, index);
    return `<a class="catalog-subcategory-nav-link" href="${escapeHtml(categoryDocumentUrl(categoryShareSlug(segment.category, segment.groupIndex), subcategoryShareSlug(group.subcategory, index)))}" data-category-target="${escapeHtml(targetId)}" data-category-share-path="${escapeHtml(sharePath)}">${escapeHtml(group.subcategory)}</a>`;
  }).join("");

  return `
    <nav class="catalog-subcategory-nav" aria-label="ניווט תתי קטגוריות עבור ${escapeHtml(segment.category)}">
      ${buttons}
    </nav>
  `;
}

function catalogSubcategoryLayoutSegments(segment, columns = catalogLayoutColumnCount()) {
  const safeColumns = clampCategorySpan(columns, 3);
  const sourceBlocks = [];

  if (Array.isArray(segment.directItems) && segment.directItems.length) {
    sourceBlocks.push({
      blockKey: "__direct__",
      blockIndex: -1,
      label: "קטלוגים כלליים",
      isDirect: true,
      items: segment.directItems
    });
  }

  (Array.isArray(segment.subcategories) ? segment.subcategories : []).forEach((group, index) => {
    const subcategory = String(group?.subcategory || "").trim();
    const items = Array.isArray(group?.items) ? group.items : [];
    if (!subcategory || !items.length) return;

    sourceBlocks.push({
      blockKey: subcategory,
      blockIndex: index,
      label: subcategory,
      isDirect: false,
      items
    });
  });

  const layoutSegments = [];
  let occupied = 0;

  sourceBlocks.forEach((block, blockOrder) => {
    let itemOffset = 0;
    let segmentIndex = 0;

    while (itemOffset < block.items.length) {
      if (occupied >= safeColumns) occupied = 0;
      const availableInRow = occupied > 0 ? safeColumns - occupied : safeColumns;
      const span = Math.min(availableInRow, block.items.length - itemOffset, safeColumns);

      layoutSegments.push({
        ...block,
        blockOrder,
        segmentIndex,
        itemOffset,
        span,
        items: block.items.slice(itemOffset, itemOffset + span),
        inlineDivider: false
      });

      itemOffset += span;
      segmentIndex += 1;
      occupied += span;
      if (occupied >= safeColumns) occupied = 0;
    }
  });

  occupied = 0;
  layoutSegments.forEach((block, index) => {
    const span = clampCategorySpan(block.span, safeColumns);
    if (occupied + span > safeColumns) occupied = 0;

    const rowEnd = occupied + span;
    const nextBlock = layoutSegments[index + 1];
    const nextSpan = nextBlock ? clampCategorySpan(nextBlock.span, safeColumns) : 0;
    block.inlineDivider = Boolean(
      nextBlock
      && nextBlock.blockOrder !== block.blockOrder
      && rowEnd < safeColumns
      && nextSpan <= safeColumns - rowEnd
    );

    occupied = rowEnd >= safeColumns ? 0 : rowEnd;
  });

  return layoutSegments;
}

function catalogSubcategoryBlockBaseId(segment, block, baseSectionId) {
  if (block?.isDirect) return `${baseSectionId}-general`;
  return subcategorySectionId(segment.category, segment.groupIndex, block?.label || block?.blockKey, block?.blockIndex || 0);
}

function renderCatalogSubcategoryBlock(segment, block, options = {}) {
  const { baseSectionId = "" } = options;
  const items = Array.isArray(block?.items) ? block.items : [];
  if (!items.length) return "";

  const blockBaseId = catalogSubcategoryBlockBaseId(segment, block, baseSectionId);
  const sharePath = block?.isDirect
    ? catalogCategorySharePath(segment.category, segment.groupIndex)
    : catalogSubcategorySharePath(segment.category, segment.groupIndex, block?.label || block?.blockKey, block?.blockIndex || 0);
  const sectionId = block.segmentIndex === 0 ? blockBaseId : `${blockBaseId}-part-${block.segmentIndex + 1}`;
  const titleId = `${sectionId}-title`;
  const title = String(block?.label || "").trim() || "קטלוגים";
  const sectionStyle = `--subcategory-span: ${clampCategorySpan(block.span, 3)};`;

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
  const baseSectionId = categorySectionId(segment.category, segment.groupIndex);
  const titleId = `${baseSectionId}-title`;
  const safeColumns = clampCategorySpan(columns, 3);
  const sectionStyle = `--category-span: ${safeColumns}; --subcategory-layout-columns: ${safeColumns};`;
  const sharePath = catalogCategorySharePath(segment.category, segment.groupIndex);

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
  const baseSectionId = categorySectionId(segment.category, segment.groupIndex);
  const safeColumns = clampCategorySpan(columns, 3);

  if (segment.segmentType === "categoryHeader") {
    return renderCatalogCategoryHeaderSegment(segment, safeColumns);
  }

  if (segment.segmentType === "subcategory") {
    return renderCatalogSubcategoryBlock(segment, segment, { baseSectionId });
  }

  const sectionId = segment.itemOffset === 0 ? baseSectionId : `${baseSectionId}-part-${segment.segmentIndex + 1}`;
  const titleId = `${sectionId}-title`;
  const sectionStyle = `--category-span: ${segment.span}; --subcategory-layout-columns: ${safeColumns};`;
  const sharePath = catalogCategorySharePath(segment.category, segment.groupIndex);

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

function openCatalogEntry(catalogId, page = 1) {
  if (!catalogId) return;
  const viewer = getFeatureInterface("viewer");
  if (viewer?.openCatalog) {
    viewer.openCatalog(catalogId, page);
    return;
  }
  navigateTo(viewerDocumentUrl(catalogId, page));
}

function bindCatalogCardEvents() {
  if (!catalogElements.catalogGrid) return;

  catalogElements.catalogGrid.querySelectorAll("[data-open-catalog-entry]").forEach((control) => {
    control.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openCatalogEntry(control.dataset.openCatalogEntry);
    });
  });

  catalogElements.catalogGrid.querySelectorAll("[data-open-catalog-preview]").forEach((control) => {
    control.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openCatalog(control.dataset.openCatalogPreview, { scroll: true });
    });
  });
}

function renderCatalogCards() {
  if (!catalogs.length) {
    renderEmptyState();
    return;
  }

  const groups = getCatalogCategoryGroups();
  const totalPages = catalogs.reduce((sum, item) => sum + Number(item.pages || 0), 0);
  if (shellElements.catalogCount) shellElements.catalogCount.textContent = String(catalogs.length);
  if (shellElements.pageCount) shellElements.pageCount.textContent = String(totalPages);
  renderCategoryNav(groups);

  const columns = catalogLayoutColumnCount();
  catalogState.catalogLayoutColumns = columns;
  const categorySegments = catalogCategorySegments(groups, columns);

  catalogElements.catalogGrid.style.setProperty("--catalog-layout-columns", String(columns));
  catalogElements.catalogGrid.innerHTML = categorySegments.map((segment) => renderCatalogCategorySegment(segment, columns)).join("");
  catalogElements.catalogGrid.setAttribute("aria-busy", "false");
  if (catalogElements.catalogLoadStatus) {
    const count = catalogs.length;
    catalogElements.catalogLoadStatus.textContent = count === 1 ? "קטלוג אחד נטען." : `${count} קטלוגים נטענו.`;
  }

  bindCatalogCardEvents();
  syncCatalogCategoryFocusFromHash({ animate: false });
}


function fillCatalogSelect() {
  updateDetailCatalogMenuLabel();
}


function renderPageGrid() {
  if (!navigationState.catalog) return;
  // Keep generated page cards visually stable during scroll.
  // Older versions attached scroll-time observers here for reveal animation
  // and thumb activation; that caused work exactly when a card entered view.

  const catalog = navigationState.catalog;
  const cards = [];
  for (let page = 1; page <= catalog.pages; page += 1) {
    cards.push(`
      <article class="page-card">
        <a class="page-button" href="${escapeHtml(viewerDocumentUrl(catalog.id, page))}" data-open-page="${page}">
          <div class="page-thumb-wrap"${pageAspectVariableStyle(catalog, page, "--page-thumb-aspect-ratio")}>
            <img class="page-thumb" src="${escapeHtml(thumbSrc(catalog, page))}" alt="${escapeHtml(catalog.title)} - עמוד ${page}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async" fetchpriority="low"${catalogImageCrossOriginAttribute(thumbSrc(catalog, page))} />
            <span class="page-number-badge">${page}</span>
          </div>
          <div class="page-card-body">
            <span class="page-card-title">עמוד ${page}</span>
            <span class="page-card-hint">לחץ להגדלה</span>
          </div>
        </a>
      </article>
    `);
  }
  catalogElements.pageGrid.setAttribute("aria-busy", "true");
  catalogElements.pageGrid.innerHTML = cards.join("");
  catalogElements.pageGrid.setAttribute("aria-busy", "false");

  catalogElements.pageGrid.querySelectorAll("[data-open-page]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      const page = Number(link.dataset.openPage);
      const viewer = getFeatureInterface("viewer");
      if (viewer?.openCatalog && navigationState.catalog) {
        viewer.openCatalog(navigationState.catalog.id, page);
      } else if (navigationState.catalog) {
        navigateTo(viewerDocumentUrl(navigationState.catalog.id, page));
      }
    });
  });
}

function showCatalogDetail() {
  if (!catalogElements.catalogDetail) return;
  catalogElements.catalogDetail.classList.remove("hidden");
  catalogElements.catalogDetail.classList.add("in-view");
}

function scrollCatalogDetailIntoView(options = {}) {
  if (!catalogElements.catalogDetail) return;
  const { behavior = "smooth" } = options;
  requestAnimationFrame(() => {
    catalogElements.catalogDetail.scrollIntoView({ behavior, block: "start" });
    scheduleCatalogScrollTopButtonUpdate();
  });
}

function positionCatalogScrollTopButton() {
  if (!catalogElements.scrollToTopBtn || !catalogElements.pageGrid) return;

  const gridRect = catalogElements.pageGrid.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const buttonWidth = Math.max(catalogElements.scrollToTopBtn.offsetWidth || 46, 46);
  const safeInset = 12;
  const gapFromGrid = 12;
  const maxLeft = Math.max(safeInset, viewportWidth - buttonWidth - safeInset);
  const preferredLeft = gridRect.left - buttonWidth - gapFromGrid;
  const left = clampValue(preferredLeft, safeInset, maxLeft);

  catalogElements.scrollToTopBtn.style.setProperty("--catalog-scroll-top-left", `${Math.round(left)}px`);
}

function setCatalogScrollTopButtonVisible(visible) {
  if (!catalogElements.scrollToTopBtn) return;
  catalogElements.scrollToTopBtn.classList.toggle("is-visible", Boolean(visible));
  catalogElements.scrollToTopBtn.setAttribute("aria-hidden", visible ? "false" : "true");
  catalogElements.scrollToTopBtn.tabIndex = visible ? 0 : -1;
}

function updateCatalogScrollTopButton() {
  catalogState.catalogScrollTopButtonRaf = 0;
  if (!catalogElements.scrollToTopBtn || !catalogElements.catalogDetail || !catalogElements.pageGrid || catalogElements.catalogDetail.classList.contains("hidden") || !navigationState.catalog || getFeatureInterface("viewer")?.isViewerOpen?.()) {
    setCatalogScrollTopButtonVisible(false);
    return;
  }

  positionCatalogScrollTopButton();

  const detailRect = catalogElements.catalogDetail.getBoundingClientRect();
  const gridRect = catalogElements.pageGrid.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 90;
  const startedScrollingInsideGrid = gridRect.top < Math.min(headerHeight + 28, viewportHeight * 0.28);
  const stillNearGrid = gridRect.bottom > Math.min(180, viewportHeight * 0.35);
  const detailVisible = detailRect.bottom > 80 && detailRect.top < viewportHeight;
  setCatalogScrollTopButtonVisible(startedScrollingInsideGrid && stillNearGrid && detailVisible);
}

function scheduleCatalogScrollTopButtonUpdate() {
  if (catalogState.catalogScrollTopButtonRaf) return;
  catalogState.catalogScrollTopButtonRaf = requestAnimationFrame(updateCatalogScrollTopButton);
}

function renderCatalogDetail() {
  if (!navigationState.catalog) return;
  const catalog = navigationState.catalog;
  showCatalogDetail();
  catalogElements.catalogTitle.textContent = catalog.title;
  catalogElements.catalogDescription.textContent = catalog.description || "";
  updateDetailCatalogMenuLabel(catalog);
  if (catalogElements.catalogCoverPreview) {
    applyCatalogImageDimensions(catalogElements.catalogCoverPreview, catalog, 1);
    setCatalogImageSource(catalogElements.catalogCoverPreview, coverThumbSrc(catalog));
    catalogElements.catalogCoverPreview.loading = "lazy";
    catalogElements.catalogCoverPreview.decoding = "async";
    catalogElements.catalogCoverPreview.alt = `שער ${catalog.title}`;
  }
  if (catalogElements.openCatalogEntryFromDetail) catalogElements.openCatalogEntryFromDetail.disabled = catalog.pages < 1;
  if (catalogElements.catalogMenu && !catalogElements.catalogMenu.classList.contains("hidden")) renderDetailCatalogMenu();
  renderPageGrid();
  scheduleCatalogScrollTopButtonUpdate();
}

function openCatalog(id, options = {}) {
  const { scroll = false, openPage = null, scrollBehavior = "smooth" } = options;
  const catalog = catalogs.find((item) => item.id === id) || null;
  if (!catalog) return;

  if (!isAppPage("catalog")) {
    navigateTo(openPage != null
      ? viewerDocumentUrl(catalog.id, openPage)
      : catalogDocumentUrl(catalog.id));
    return;
  }

  navigationState.catalog = catalog;
  navigationState.page = 1;
  renderCatalogDetail();
  if (window.history?.replaceState) {
    history.replaceState(history.state, "", catalogDocumentUrl(catalog.id));
  }

  if (scroll) scrollCatalogDetailIntoView({ behavior: scrollBehavior });
  if (openPage != null) navigateTo(viewerDocumentUrl(catalog.id, openPage));
}

function attachCatalogGridEvents() {
  shellElements.mobileCategoryMenuToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeGlobalSearchPanel({ focusButton: false });
    setMobileCategoryMenuOpen(!isMobileCategoryMenuOpen());
  });

  shellElements.mobileCategoryMenu?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".category-nav-link");
    if (!link || !shellElements.mobileCategoryMenu.contains(link)) return;
    closeMobileCategoryMenu();
    handleCatalogFocusLinkClick(link, event);
  });

  catalogElements.catalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderDetailCatalogMenu();
    const isOpen = !catalogElements.catalogMenu?.classList.contains("hidden");
    catalogElements.catalogMenu?.classList.toggle("hidden", isOpen);
    catalogElements.catalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  catalogElements.catalogMenu?.addEventListener("click", (event) => event.stopPropagation());

  catalogElements.openCatalogEntryFromDetail?.addEventListener("click", () => {
    if (!navigationState.catalog) return;
    navigateTo(viewerDocumentUrl(navigationState.catalog.id, 1));
  });
  catalogElements.scrollToTopBtn?.addEventListener("click", () => scrollCatalogDetailIntoView());

  shellElements.categoryNav?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".category-nav-link");
    if (!link || !shellElements.categoryNav.contains(link)) return;
    closeMobileCategoryMenu();
    handleCatalogFocusLinkClick(link, event);
  });

  catalogElements.catalogGrid?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".catalog-subcategory-nav-link");
    if (!link || !catalogElements.catalogGrid.contains(link)) return;
    handleCatalogFocusLinkClick(link, event);
  });
}

registerFeatureInterface("catalog-grid", {
  attachEvents: attachCatalogGridEvents,
  initialize: () => {
    initRevealObserver();
    initCategoryNavFit();
  },
  renderInitialContent: () => {
    renderCatalogCards();
    fillCatalogSelect();
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
  layoutColumnCount: catalogLayoutColumnCount,
  hideDetail: () => {
    catalogElements.catalogDetail?.classList.add("hidden");
    catalogElements.catalogDetail?.classList.remove("in-view");
    setCatalogScrollTopButtonVisible(false);
  }
});

registerFeatureInterface("catalog-navigation", {
  escapePriority: 400,
  closeTopLayer: () => {
    if (!isMobileCategoryMenuOpen()) return false;
    closeMobileCategoryMenu({ focusButton: true });
    return true;
  }
});

registerFeatureInterface("catalog-detail", {
  escapePriority: 200,
  closeTopLayer: () => {
    if (!catalogElements.catalogMenu || catalogElements.catalogMenu.classList.contains("hidden")) return false;
    closeDetailCatalogMenu();
    return true;
  }
});
/* ===== END SOURCE: src/js/40-catalog-grid.js ===== */

/* ===== BEGIN SOURCE: src/js/50-search-ui.js ===== */
/**
 * Source module: 50-search-ui.js
 * Global and viewer search loading, scopes, result rendering, previews, and search interactions.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

let globalSearchRenderTimer = 0;
let lightboxSearchRenderTimer = 0;
let globalSearchRenderSequence = 0;
let lightboxSearchRenderSequence = 0;
let lastGlobalSearchResults = [];
let lastLightboxSearchResults = [];
let lastGlobalSearchKey = "";
let lastLightboxSearchKey = "";

function isSearchIndexReady() {
  return Boolean(catalogSearch?.isReady?.());
}

function refreshSearchUiAfterIndexLoad() {
  initSearchStatus();
  initLightboxSearchStatus();

  if (isGlobalSearchPanelOpen()) {
    renderSearchResults(searchElements.globalSearchInput?.value || "");
  }
  if (getFeatureInterface("viewer")?.isViewerOpen?.() && searchElements.lightboxSearchInput) {
    renderLightboxSearchResults(searchElements.lightboxSearchInput.value);
  }
}

function ensureSearchIndexLoaded(options = {}) {
  if (!catalogSearch?.ensureReady) {
    searchState.searchIndexLoadState = "error";
    return Promise.reject(new Error("Catalog search runtime is unavailable"));
  }
  if (isSearchIndexReady()) {
    searchState.searchIndexLoadState = "ready";
    return Promise.resolve(true);
  }
  if (searchState.searchIndexLoadPromise) return searchState.searchIndexLoadPromise;

  searchState.searchIndexLoadState = "loading";
  initLightboxSearchStatus();
  const loadTrigger = telemetryCleanText(options.trigger || "interactive", 40);
  searchState.searchIndexLoadPromise = catalogSearch.ensureReady()
    .then(() => {
      searchState.searchIndexLoadState = "ready";
      searchState.searchIndexLoadPromise = null;
      refreshSearchUiAfterIndexLoad();
      return true;
    })
    .catch((error) => {
      searchState.searchIndexLoadState = "error";
      searchState.searchIndexLoadPromise = null;
      telemetryTrackSearchIndexFailure("network-error", { trigger: loadTrigger });
      initSearchStatus();
      initLightboxSearchStatus();
      throw error;
    });
  return searchState.searchIndexLoadPromise;
}

function scheduleSearchIndexPreload() {
  window.clearTimeout(searchState.searchIndexPreloadTimer);
  if (isSaveDataEnabled()) return;
  searchState.searchIndexPreloadTimer = window.setTimeout(() => {
    if (isSaveDataEnabled()) return;
    const preload = () => ensureSearchIndexLoaded({ trigger: "preload" }).catch(() => {});
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preload, { timeout: 2500 });
    } else {
      preload();
    }
  }, SEARCH_INDEX_PRELOAD_DELAY_MS);
}

function cancelScheduledSearch(channel) {
  if (channel === "global") {
    window.clearTimeout(globalSearchRenderTimer);
    globalSearchRenderTimer = 0;
    globalSearchRenderSequence += 1;
  } else {
    window.clearTimeout(lightboxSearchRenderTimer);
    lightboxSearchRenderTimer = 0;
    lightboxSearchRenderSequence += 1;
  }
  catalogSearch?.cancel?.(channel);
}

function scheduleSearchRender(channel, query, options = {}) {
  const delay = options.immediate ? 0 : SEARCH_INPUT_DEBOUNCE_MS;
  const callback = channel === "global"
    ? () => renderSearchResults(query)
    : () => renderLightboxSearchResults(query);
  catalogSearch?.cancel?.(channel);
  if (channel === "global") {
    globalSearchRenderSequence += 1;
    window.clearTimeout(globalSearchRenderTimer);
    globalSearchRenderTimer = window.setTimeout(callback, delay);
  } else {
    lightboxSearchRenderSequence += 1;
    window.clearTimeout(lightboxSearchRenderTimer);
    lightboxSearchRenderTimer = window.setTimeout(callback, delay);
  }
}

function highlightedSearchText(text, ranges = []) {
  const raw = String(text || "");
  if (!raw) return "";
  const normalizedRanges = Array.isArray(ranges)
    ? ranges
      .map((range) => ({
        start: Math.max(0, Math.min(raw.length, Number(range?.start) || 0)),
        end: Math.max(0, Math.min(raw.length, Number(range?.end) || 0))
      }))
      .filter((range) => range.end > range.start)
      .sort((a, b) => a.start - b.start || a.end - b.end)
    : [];
  let cursor = 0;
  let markup = "";
  normalizedRanges.forEach((range) => {
    if (range.start < cursor) return;
    markup += escapeHtml(raw.slice(cursor, range.start));
    markup += `<mark class="search-match-highlight">${escapeHtml(raw.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  });
  return markup + escapeHtml(raw.slice(cursor));
}

function searchResultDetailsMarkup(result) {
  const page = Math.max(1, Number(result?.page) || 1);
  const reason = String(result?.matchReason || "התאמה בטקסט הקטלוג");
  const excerpt = highlightedSearchText(result?.excerpt || "", result?.highlights || []);
  return `
    <span class="search-result-meta">עמוד ${page} · ${escapeHtml(reason)}</span>
    ${excerpt ? `<span class="search-result-excerpt">${excerpt}</span>` : ""}
  `;
}

function getGlobalSearchCategories() {
  return getCatalogCategoryGroups()
    .filter((group) => String(group.category || "").trim() && Array.isArray(group.items) && group.items.length)
    .map((group) => ({ category: group.category }));
}

function hasGlobalSearchCategory(category) {
  const requestedCategory = String(category || "").trim();
  if (!requestedCategory) return false;
  return getCatalogCategoryGroups().some((group) => group.category === requestedCategory);
}

function getGlobalSearchCategory() {
  const selectedCategory = String(searchState.globalSearchCategory || "").trim();
  if (!selectedCategory) return "";
  return hasGlobalSearchCategory(selectedCategory) ? selectedCategory : "";
}

function globalSearchScopeLabel(category = getGlobalSearchCategory()) {
  return category ? category : "בכל הקטלוגים";
}

function globalSearchPlaceholder() {
  const category = getGlobalSearchCategory();
  return category
    ? `חיפוש דגם בקטגוריית ${category}...`
    : "הקלד דגם, מספר, שם מוצר או מילה מהקטלוג...";
}

function closeGlobalSearchScopeMenu() {
  searchElements.globalSearchScopeMenu?.classList.add("hidden");
  searchElements.globalSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function isGlobalSearchPanelOpen() {
  return Boolean(searchState.globalSearchOpen && searchElements.catalogSearch && !searchElements.catalogSearch.classList.contains("hidden"));
}

function setGlobalSearchPanelOpen(open, options = {}) {
  const shouldOpen = Boolean(open);
  searchState.globalSearchOpen = shouldOpen;

  if (!searchElements.catalogSearch) return;

  searchElements.catalogSearch.classList.toggle("hidden", !shouldOpen);
  searchElements.catalogSearch.classList.toggle("is-open", shouldOpen);
  searchElements.catalogSearch.setAttribute("aria-hidden", shouldOpen ? "false" : "true");

  searchElements.globalSearchOpen?.classList.toggle("is-active", shouldOpen);
  searchElements.globalSearchOpen?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");

  if (shouldOpen) {
    renderGlobalSearchScopeMenu();
    renderSearchResults(searchElements.globalSearchInput?.value || "");
    if (options.focus !== false) {
      window.requestAnimationFrame(() => searchElements.globalSearchInput?.focus({ preventScroll: true }));
    }
    return;
  }

  closeGlobalSearchScopeMenu();
  hideSearchFloatingPreview();
  cancelScheduledSearch("global");
  if (options.hideResults !== false) {
    searchElements.globalSearchResults?.classList.add("hidden");
  }
  if (options.focusButton) {
    window.requestAnimationFrame(() => searchElements.globalSearchOpen?.focus({ preventScroll: true }));
  }
}

function openGlobalSearchPanel(options = {}) {
  setGlobalSearchPanelOpen(true, options);
}

function closeGlobalSearchPanel(options = {}) {
  setGlobalSearchPanelOpen(false, options);
}

function renderGlobalSearchScopeMenu() {
  if (!searchElements.globalSearchScopeMenu) return;

  const categories = getGlobalSearchCategories();
  searchElements.globalSearchScopeMenu.innerHTML = `
    <button type="button" role="menuitemradio" aria-checked="true" data-global-search-category="">
      <strong>בכל הקטלוגים</strong>
    </button>
    ${categories.map((group) => `
      <button type="button" role="menuitemradio" aria-checked="false" data-global-search-category="${escapeHtml(group.category)}">
        <strong>${escapeHtml(group.category)}</strong>
      </button>
    `).join("")}
  `;
  syncGlobalSearchScopeUi();
}

function syncGlobalSearchScopeUi() {
  const category = getGlobalSearchCategory();
  if (searchElements.globalSearchScopeToggle) {
    searchElements.globalSearchScopeToggle.innerHTML = `${escapeHtml(globalSearchScopeLabel(category))} <span aria-hidden="true">⌄</span>`;
    searchElements.globalSearchScopeToggle.title = category ? `חיפוש רק בקטגוריית ${category}` : "חיפוש בכל הקטלוגים";
  }
  if (searchElements.globalSearchInput) {
    searchElements.globalSearchInput.placeholder = globalSearchPlaceholder();
    searchElements.globalSearchInput.setAttribute("aria-label", globalSearchPlaceholder());
  }
  searchElements.globalSearchScopeMenu?.querySelectorAll("[data-global-search-category]").forEach((button) => {
    const selected = String(button.dataset.globalSearchCategory || "") === category;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

function setGlobalSearchCategory(category, options = {}) {
  const requestedCategory = String(category || "").trim();
  const nextCategory = requestedCategory && hasGlobalSearchCategory(requestedCategory)
    ? requestedCategory
    : "";

  if (searchState.globalSearchCategory === nextCategory) {
    syncGlobalSearchScopeUi();
    closeGlobalSearchScopeMenu();
    return;
  }

  searchState.globalSearchCategory = nextCategory;
  syncGlobalSearchScopeUi();
  closeGlobalSearchScopeMenu();
  initSearchStatus();

  if (options.render !== false && searchElements.globalSearchInput) {
    renderSearchResults(searchElements.globalSearchInput.value);
  }
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
  const title = String(navigationState.catalog?.title || "").trim();
  return title ? `חיפוש ב: ${title}` : "חיפוש ב...";
}

function closeLightboxSearchScopeMenu() {
  searchElements.lightboxSearchScopeMenu?.classList.add("hidden");
  searchElements.lightboxSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function closeLightboxCatalogMenu() {
  searchElements.lightboxCatalogMenu?.classList.add("hidden");
  searchElements.lightboxCatalogMenuToggle?.setAttribute("aria-expanded", "false");
}

function isMobileReaderSearchMode() {
  return Boolean(window.matchMedia?.(MOBILE_READER_SEARCH_MEDIA).matches);
}

function syncLightboxMobileSearchUi() {
  const compactMode = isMobileReaderSearchMode();
  const isOpen = compactMode && searchState.lightboxMobileSearchOpen;

  if (!compactMode) searchState.lightboxMobileSearchOpen = false;
  getFeatureInterface("viewer")?.syncMobileSearchUi?.(isOpen);
  searchElements.lightboxMobileSearchToggle?.setAttribute("aria-expanded", isOpen ? "true" : "false");
  searchElements.lightboxSearchPanel?.setAttribute("aria-hidden", compactMode && !isOpen ? "true" : "false");
}

function setLightboxMobileSearchOpen(open, options = {}) {
  const { focusInput = false, returnFocus = false, hideResults = true, hideTopUi = false } = options;
  const shouldOpen = Boolean(
    open &&
    getFeatureInterface("viewer")?.isViewerOpen?.() &&
    isMobileReaderSearchMode()
  );

  searchState.lightboxMobileSearchOpen = shouldOpen;
  syncLightboxMobileSearchUi();

  if (shouldOpen) {
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    getFeatureInterface("viewer")?.showTopUi?.();
    ensureSearchIndexLoaded().catch(() => {});
    if (focusInput) {
      window.requestAnimationFrame(() => searchElements.lightboxSearchInput?.focus());
    }
    return;
  }

  if (hideResults) {
    hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi });
  }
  if (returnFocus && isMobileReaderSearchMode()) {
    searchElements.lightboxMobileSearchToggle?.focus();
  }
}

function closeDetailCatalogMenu() {
  catalogElements.catalogMenu?.classList.add("hidden");
  catalogElements.catalogMenuToggle?.setAttribute("aria-expanded", "false");
}

function syncLightboxSearchScopeUi() {
  const scope = getLightboxSearchScope();
  if (searchElements.lightboxSearchScopeToggle) {
    searchElements.lightboxSearchScopeToggle.innerHTML = `${escapeHtml(lightboxSearchScopeLabel(scope))} <span aria-hidden="true">⌄</span>`;
  }
  if (searchElements.lightboxSearchInput) {
    searchElements.lightboxSearchInput.placeholder = lightboxSearchPlaceholder();
    searchElements.lightboxSearchInput.setAttribute("aria-label", lightboxSearchPlaceholder());
  }
  searchElements.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]").forEach((button) => {
    const selected = button.dataset.lightboxSearchScope === scope;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

function setLightboxSearchScope(scope, options = {}) {
  const nextScope = scope === "all" ? "all" : "catalog";
  if (searchState.lightboxSearchScope === nextScope) {
    syncLightboxSearchScopeUi();
    closeLightboxSearchScopeMenu();
    return;
  }

  searchState.lightboxSearchScope = nextScope;
  syncLightboxSearchScopeUi();
  closeLightboxSearchScopeMenu();
  initLightboxSearchStatus();

  if (options.render !== false && searchElements.lightboxSearchInput) {
    renderLightboxSearchResults(searchElements.lightboxSearchInput.value);
  }
}

function hideLightboxSearchResults(options = {}) {
  const { blurTopUiFocus = false, hideTopUi = false } = options;

  hideSearchFloatingPreview();
  searchElements.lightboxSearchResults?.classList.add("hidden");
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();

  if (blurTopUiFocus) {
    const activeElement = document.activeElement;
    if (
      activeElement &&
      getFeatureInterface("viewer")?.containsTopBarElement?.(activeElement) &&
      typeof activeElement.blur === "function"
    ) {
      activeElement.blur();
    }
  }

  if (hideTopUi) getFeatureInterface("viewer")?.hideTopUiForSearch?.();
}

function resetLightboxSearch() {
  searchState.lightboxMobileSearchOpen = false;
  syncLightboxMobileSearchUi();
  if (searchElements.lightboxSearchInput) searchElements.lightboxSearchInput.value = "";
  hideLightboxSearchResults({ blurTopUiFocus: true });
  if (searchElements.lightboxSearchResults) searchElements.lightboxSearchResults.innerHTML = "";
  searchElements.lightboxSearchClear?.classList.add("hidden");
  syncLightboxSearchScopeUi();
  initLightboxSearchStatus();
}

function lightboxSearchKey(query) {
  const scope = getLightboxSearchScope();
  return [String(query || "").trim(), scope, scope === "all" ? "" : (navigationState.catalog?.id || "")].join("\u0000");
}

async function getLightboxSearchResults(query, limit = 24) {
  const rawQuery = String(query || "").trim();
  if (rawQuery.length < 2) return [];
  await ensureSearchIndexLoaded({ trigger: "viewer-search" });
  if (!catalogSearch?.hasIndex?.()) return [];

  const options = { limit, channel: "viewer" };
  if (getLightboxSearchScope() !== "all") {
    if (!navigationState.catalog) return [];
    options.catalogId = navigationState.catalog.id;
  }
  const results = await catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

async function trackCompletedLightboxSearch(completion, query = searchElements.lightboxSearchInput?.value || "") {
  const rawQuery = String(query || "").trim();
  const scope = getLightboxSearchScope();
  const key = lightboxSearchKey(rawQuery);
  const results = key === lastLightboxSearchKey
    ? lastLightboxSearchResults
    : await getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24);
  telemetryTrackSearch(rawQuery, results.length, {
    surface: "viewer",
    scope,
    catalogId: scope === "all" ? "" : navigationState.catalog?.id,
    completion
  });
  return results;
}

function openLightboxSearchResult(result) {
  if (!result) return false;

  const targetCatalogId = result.catalogId || navigationState.catalog?.id;
  if (!targetCatalogId) return false;

  if (!navigationState.catalog || navigationState.catalog.id !== targetCatalogId) {
    getFeatureInterface("viewer")?.openCatalog?.(targetCatalogId, Number(result.page));
    return true;
  }

  const page = clampPage(result.page, navigationState.catalog);
  getFeatureInterface("viewer")?.setPage?.(page);
  getFeatureInterface("viewer")?.showTopUi?.();
  if (searchState.lightboxMobileSearchOpen) {
    setLightboxMobileSearchOpen(false, { hideResults: true });
  } else {
    hideLightboxSearchResults();
  }
  return true;
}

async function submitLightboxSearch() {
  const rawQuery = String(searchElements.lightboxSearchInput?.value || "").trim();
  const results = await renderLightboxSearchResults(rawQuery);
  await trackCompletedLightboxSearch("submit", rawQuery);
  return openLightboxSearchResult(results[0]);
}

function initLightboxSearchStatus() {
  if (!searchElements.lightboxSearchStatus) return;

  const hasCatalog = Boolean(navigationState.catalog);
  const hasIndex = Boolean(catalogSearch?.hasIndex?.());
  const indexPending = !hasIndex && searchState.searchIndexLoadState !== "error";
  if (searchElements.lightboxSearchInput) searchElements.lightboxSearchInput.disabled = !hasCatalog;
  syncLightboxSearchScopeUi();

  if (!hasCatalog) {
    searchElements.lightboxSearchStatus.textContent = "בחר קטלוג כדי לחפש.";
    return;
  }

  if (!hasIndex) {
    searchElements.lightboxSearchStatus.textContent = indexPending
      ? "אינדקס החיפוש נטען לפי הצורך."
      : "אינדקס החיפוש אינו זמין כרגע.";
    return;
  }

  searchElements.lightboxSearchStatus.textContent = getLightboxSearchScope() === "all"
    ? "הקלד לפחות 2 תווים לחיפוש בכל הקטלוגים."
    : "הקלד לפחות 2 תווים לחיפוש בתוך הקטלוג הפתוח.";
}

function hideSearchFloatingPreview() {
  searchElements.searchFloatingPreview?.classList.remove("visible");
}

function isGlobalSearchScopeMenuOpen() {
  return Boolean(searchElements.globalSearchScopeMenu && !searchElements.globalSearchScopeMenu.classList.contains("hidden"));
}

function isLightboxSearchScopeMenuOpen() {
  return Boolean(searchElements.lightboxSearchScopeMenu && !searchElements.lightboxSearchScopeMenu.classList.contains("hidden"));
}

function rememberSearchPreviewPointer(event) {
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

  searchState.searchPreviewPointerClientX = clientX;
  searchState.searchPreviewPointerClientY = clientY;
}

function searchPreviewTargetBelongsToOpenResults(target) {
  if (!target || !target.isConnected) return false;

  if (searchElements.globalSearchResults?.contains(target)) {
    return isGlobalSearchPanelOpen() && !searchElements.globalSearchResults.classList.contains("hidden");
  }

  if (searchElements.lightboxSearchResults?.contains(target)) {
    return Boolean(getFeatureInterface("viewer")?.isViewerOpen?.()) && !searchElements.lightboxSearchResults.classList.contains("hidden");
  }

  return false;
}

function isSearchPreviewBlockedByOpenMenu(target) {
  if (searchElements.globalSearchResults?.contains(target) && isGlobalSearchScopeMenuOpen()) return true;
  if (searchElements.lightboxSearchResults?.contains(target) && isLightboxSearchScopeMenuOpen()) return true;
  return false;
}

function getSearchPreviewTargetAtLastPointer() {
  const clientX = Number(searchState.searchPreviewPointerClientX);
  const clientY = Number(searchState.searchPreviewPointerClientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  if (clientX < 0 || clientY < 0 || clientX > window.innerWidth || clientY > window.innerHeight) return null;

  const element = document.elementFromPoint(clientX, clientY);
  const target = element?.closest?.("[data-search-preview-src]");
  return searchPreviewTargetBelongsToOpenResults(target) ? target : null;
}

function isSearchPreviewSuppressed() {
  return Date.now() < (searchState.searchPreviewSuppressUntil || 0);
}

function restoreSearchFloatingPreviewAfterSuppression() {
  if (isSearchPreviewSuppressed() || !hasHoverPointer()) return;

  const target = getSearchPreviewTargetAtLastPointer();
  if (!target || isSearchPreviewBlockedByOpenMenu(target)) return;

  showSearchFloatingPreview(target);
}

function suppressSearchFloatingTooltip(duration = SEARCH_PREVIEW_SCROLL_SUPPRESS_MS, options = {}) {
  window.BargigTooltips?.suppress?.(duration, options);
}

function suppressSearchFloatingPreview(duration = SEARCH_PREVIEW_SCROLL_SUPPRESS_MS, options = {}) {
  const { restoreAfter = true } = options;
  const delay = Math.max(0, Number(duration) || 0);
  suppressSearchFloatingTooltip(delay, { restoreAfter });
  searchState.searchPreviewSuppressUntil = Math.max(
    searchState.searchPreviewSuppressUntil || 0,
    Date.now() + delay
  );
  hideSearchFloatingPreview();

  window.clearTimeout(searchState.searchPreviewSuppressTimer);
  searchState.searchPreviewSuppressTimer = window.setTimeout(() => {
    searchState.searchPreviewSuppressTimer = 0;
    if (restoreAfter) restoreSearchFloatingPreviewAfterSuppression();
  }, delay + 20);
}

function searchPreviewPageLabel(target) {
  return String(target?.dataset?.searchPreviewTitle || "קטלוג").trim() || "קטלוג";
}

function positionSearchFloatingPreview(target) {
  const preview = searchElements.searchFloatingPreview;
  if (!preview || !target) return;

  const targetRect = target.getBoundingClientRect();
  const gap = 16;
  const safeMargin = 12;
  const fallbackWidth = Math.min(430, Math.max(260, window.innerWidth * 0.34));
  const previewWidth = Math.max(240, preview.offsetWidth || fallbackWidth);
  const fallbackHeight = Math.min(620, Math.max(280, window.innerHeight * 0.64));
  const previewHeight = Math.max(240, preview.offsetHeight || fallbackHeight);

  let left;
  if (targetRect.left - gap - previewWidth >= safeMargin) {
    left = targetRect.left - gap - previewWidth;
  } else if (targetRect.right + gap + previewWidth <= window.innerWidth - safeMargin) {
    left = targetRect.right + gap;
  } else {
    left = targetRect.left + (targetRect.width / 2) - (previewWidth / 2);
  }

  const top = targetRect.top + (targetRect.height / 2) - (previewHeight / 2);
  preview.style.left = `${clampValue(left, safeMargin, Math.max(safeMargin, window.innerWidth - previewWidth - safeMargin))}px`;
  preview.style.top = `${clampValue(top, safeMargin, Math.max(safeMargin, window.innerHeight - previewHeight - safeMargin))}px`;
}

function showSearchFloatingPreview(target) {
  if (!target || !searchElements.searchFloatingPreview || !searchElements.searchFloatingPreviewImage) return;
  if (!searchPreviewTargetBelongsToOpenResults(target)) return;
  if (isSearchPreviewSuppressed()) return;
  if (isSearchPreviewBlockedByOpenMenu(target)) return;

  const src = String(target.dataset.searchPreviewSrc || "").trim();
  if (!src) return;

  const label = searchPreviewPageLabel(target);
  const previewCatalog = findCatalogById(target.dataset.searchCatalog || target.dataset.lightboxSearchCatalog);
  const previewPage = clampPage(target.dataset.searchPage || target.dataset.lightboxSearchPage, previewCatalog);
  applyCatalogImageDimensions(searchElements.searchFloatingPreviewImage, previewCatalog, previewPage);
  searchElements.searchFloatingPreviewImage.onload = () => positionSearchFloatingPreview(target);
  setCatalogImageSource(searchElements.searchFloatingPreviewImage, src);
  searchElements.searchFloatingPreviewImage.alt = label;
  if (searchElements.searchFloatingPreviewPage) searchElements.searchFloatingPreviewPage.textContent = label;

  searchElements.searchFloatingPreview.classList.add("visible");
  positionSearchFloatingPreview(target);
}

function bindSearchFloatingPreviewEvents(container) {
  if (!container) return;

  container.querySelectorAll("[data-search-preview-src]").forEach((target) => {
    target.addEventListener("pointerenter", (event) => {
      rememberSearchPreviewPointer(event);
      if (!hasHoverPointer() || isTouchLikePointer(event) || isSearchPreviewSuppressed()) return;
      showSearchFloatingPreview(target);
    });
    target.addEventListener("pointermove", (event) => {
      rememberSearchPreviewPointer(event);
      if (!hasHoverPointer() || isTouchLikePointer(event)) return;
      if (isSearchPreviewSuppressed()) {
        hideSearchFloatingPreview();
        return;
      }
      positionSearchFloatingPreview(target);
    });
    target.addEventListener("pointerleave", (event) => {
      rememberSearchPreviewPointer(event);
      hideSearchFloatingPreview();
    });
    target.addEventListener("focus", () => showSearchFloatingPreview(target));
    target.addEventListener("blur", hideSearchFloatingPreview);
  });
}

function handleSearchPreviewScrollIntent(event) {
  rememberSearchPreviewPointer(event);
  suppressSearchFloatingPreview();
}

function normalizedWheelDeltaY(event, scrollTarget) {
  const rawDelta = Number(event?.deltaY) || 0;
  if (!rawDelta) return 0;
  if (event.deltaMode === 1) return rawDelta * 16;
  if (event.deltaMode === 2) return rawDelta * Math.max(1, scrollTarget?.clientHeight || window.innerHeight || 1);
  return rawDelta;
}

function globalSearchWheelTarget(eventTarget) {
  if (isGlobalSearchScopeMenuOpen() && searchElements.globalSearchScopeMenu?.contains(eventTarget)) {
    return searchElements.globalSearchScopeMenu;
  }

  if (searchElements.globalSearchResults && !searchElements.globalSearchResults.classList.contains("hidden")) {
    return searchElements.globalSearchResults;
  }

  return null;
}

function scrollElementByWheel(element, event) {
  if (!element) return false;

  const deltaY = normalizedWheelDeltaY(event, element);
  if (!deltaY) return false;

  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
  const nextScrollTop = clampValue(element.scrollTop + deltaY, 0, maxScrollTop);
  const didMove = Math.abs(nextScrollTop - element.scrollTop) > 0.5;

  if (didMove) element.scrollTop = nextScrollTop;
  return true;
}

function handleGlobalSearchPanelWheel(event) {
  if (!isGlobalSearchPanelOpen() || !searchElements.catalogSearch?.contains(event.target)) return;

  handleSearchPreviewScrollIntent(event);

  const scrollTarget = globalSearchWheelTarget(event.target);
  if (scrollTarget) {
    scrollElementByWheel(scrollTarget, event);
  }

  // The search panel floats above the site. Wheel gestures inside its frame should
  // never leak to the page behind it, including when the inner results list is at
  // its top/bottom edge or the pointer is over the panel padding/header.
  event.preventDefault();
  event.stopPropagation();
}

function normalizeSearchResultsDirection(container) {
  if (!container) return;
  container.setAttribute("dir", "rtl");
}

function lightboxSearchLayoutColumnLimit() {
  const columns = getFeatureInterface("catalog-grid")?.layoutColumnCount?.();
  if (Number.isFinite(Number(columns))) {
    return Math.max(1, Math.min(Number(columns), 3));
  }
  const width = Math.max(0, window.innerWidth || document.documentElement?.clientWidth || 0);
  return width >= 1180 ? 3 : width >= 760 ? 2 : 1;
}

function updateLightboxSearchResultsLayout(count = 0) {
  if (!searchElements.lightboxSearchResults) return;
  normalizeSearchResultsDirection(searchElements.lightboxSearchResults);

  const resultCount = Math.max(0, Number(count) || 0);
  const columns = Math.max(1, Math.min(resultCount || 1, lightboxSearchLayoutColumnLimit()));
  searchElements.lightboxSearchResults.style.setProperty("--reader-search-result-columns", String(columns));
  searchElements.lightboxSearchResults.dataset.resultColumns = String(columns);
  searchElements.lightboxSearchResults.dataset.resultCount = String(resultCount);
}

function searchEmptyStateMarkup(query, message, options = {}) {
  const reader = options.reader === true;
  const wrapperClass = reader
    ? "reader-search-empty lightbox-search-empty empty-state ui-state empty-state-dark"
    : "search-empty empty-state ui-state";
  const actionAttribute = reader ? "data-lightbox-empty-search-clear" : "data-empty-search-clear";
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
  const reader = options.reader === true;
  const wrapperClass = reader
    ? "reader-search-empty lightbox-search-empty empty-state ui-state empty-state-dark"
    : "search-empty empty-state ui-state";
  const retryAttribute = reader ? "data-lightbox-search-index-retry" : "data-global-search-index-retry";
  return `
    <article class="${wrapperClass}" data-state="error" role="alert">
      <span class="empty-state-icon ui-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 9v4.5M12 16.8h.01"/></svg>
      </span>
      <div class="empty-state-copy">
        <strong>החיפוש אינו זמין כרגע</strong>
        <p>אינדקס החיפוש לא הצליח להיטען. אפשר לנסות שוב בלי לרענן את העמוד.</p>
      </div>
      <button class="button soft empty-state-action" type="button" ${retryAttribute}>נסה לטעון שוב</button>
    </article>
  `;
}

function retrySearchIndexLoad(options = {}) {
  searchState.searchIndexLoadPromise = null;
  searchState.searchIndexLoadState = "idle";
  ensureSearchIndexLoaded({ trigger: "retry" })
    .then(() => {
      if (options.reader) renderLightboxSearchResults(searchElements.lightboxSearchInput?.value || "");
      else renderSearchResults(searchElements.globalSearchInput?.value || "");
    })
    .catch(() => {
      if (options.reader) renderLightboxSearchResults(searchElements.lightboxSearchInput?.value || "");
      else renderSearchResults(searchElements.globalSearchInput?.value || "");
    });
}

async function renderLightboxSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!searchElements.lightboxSearchResults || !searchElements.lightboxSearchStatus) return [];
  const renderSequence = ++lightboxSearchRenderSequence;

  normalizeSearchResultsDirection(searchElements.lightboxSearchResults);
  hideSearchFloatingPreview();
  updateLightboxSearchResultsLayout(0);
  searchElements.lightboxSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    catalogSearch?.cancel?.("viewer");
    lastLightboxSearchKey = "";
    lastLightboxSearchResults = [];
    searchElements.lightboxSearchResults.classList.add("hidden");
    searchElements.lightboxSearchResults.removeAttribute("aria-busy");
    searchElements.lightboxSearchResults.innerHTML = "";
    initLightboxSearchStatus();
    return [];
  }

  if (!navigationState.catalog) {
    searchElements.lightboxSearchResults.classList.add("hidden");
    searchElements.lightboxSearchStatus.textContent = "בחר קטלוג כדי לחפש.";
    return [];
  }

  searchElements.lightboxSearchResults.setAttribute("aria-busy", "true");
  searchElements.lightboxSearchStatus.textContent = "מחפש באינדקס…";

  try {
    const scope = getLightboxSearchScope();
    const results = await getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24);
    if (renderSequence !== lightboxSearchRenderSequence || lightboxSearchKey(rawQuery) !== lightboxSearchKey(searchElements.lightboxSearchInput?.value || "")) {
      return [];
    }

    lastLightboxSearchKey = lightboxSearchKey(rawQuery);
    lastLightboxSearchResults = results;
    updateLightboxSearchResultsLayout(results.length);
    searchElements.lightboxSearchResults.classList.remove("hidden");
    searchElements.lightboxSearchResults.removeAttribute("aria-busy");

    if (!results.length) {
      searchElements.lightboxSearchStatus.textContent = scope === "all"
        ? "לא נמצאו תוצאות בכל הקטלוגים."
        : "לא נמצאו תוצאות בקטלוג הפתוח.";
      searchElements.lightboxSearchResults.innerHTML = searchEmptyStateMarkup(
        rawQuery,
        "נסה חלק קצר יותר של הדגם או מילה אחרת.",
        { reader: true }
      );
      searchElements.lightboxSearchResults.querySelector("[data-lightbox-empty-search-clear]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        searchElements.lightboxSearchInput.value = "";
        renderLightboxSearchResults("");
        searchElements.lightboxSearchInput.focus();
      });
      return [];
    }

    searchElements.lightboxSearchStatus.textContent = scope === "all"
      ? `נמצאו ${results.length} תוצאות בכל הקטלוגים.`
      : `נמצאו ${results.length} תוצאות בקטלוג הזה.`;
    searchElements.lightboxSearchResults.innerHTML = results.map((result) => {
      const catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId) || navigationState.catalog;
      const page = clampPage(result.page, catalog);
      const rawPreview = result.image || mediumSrc(catalog, page) || pageSrc(catalog, page);
      const rawThumb = result.thumb || thumbSrc(catalog, page);
      const rawImage = rawThumb || rawPreview;
      const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
      return `
        <button class="reader-search-result lightbox-search-result" type="button" data-lightbox-search-catalog="${escapeHtml(result.catalogId || catalog?.id || "")}" data-lightbox-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
          <span class="reader-search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
          <span class="reader-search-thumb-frame catalog-image-frame">
            <img class="reader-search-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(rawImage)} />
          </span>
          <span class="reader-search-result-copy">${searchResultDetailsMarkup(result)}</span>
        </button>
      `;
    }).join("");

    bindSearchFloatingPreviewEvents(searchElements.lightboxSearchResults);
    searchElements.lightboxSearchResults.querySelectorAll("[data-lightbox-search-page]").forEach((button) => {
      button.addEventListener("click", async () => {
        await trackCompletedLightboxSearch("result-open");
        hideSearchFloatingPreview();
        openLightboxSearchResult({
          catalogId: button.dataset.lightboxSearchCatalog,
          page: button.dataset.lightboxSearchPage
        });
      });
    });
    return results;
  } catch (error) {
    if (catalogSearch?.isCancelledError?.(error) || renderSequence !== lightboxSearchRenderSequence) return [];
    searchState.searchIndexLoadState = "error";
    searchElements.lightboxSearchResults.removeAttribute("aria-busy");
    searchElements.lightboxSearchResults.classList.remove("hidden");
    searchElements.lightboxSearchResults.innerHTML = searchIndexErrorMarkup({ reader: true });
    searchElements.lightboxSearchResults.querySelector("[data-lightbox-search-index-retry]")?.addEventListener("click", () => retrySearchIndexLoad({ reader: true }));
    searchElements.lightboxSearchStatus.textContent = "אינדקס החיפוש אינו זמין כרגע.";
    return [];
  }
}

function renderCatalogCategoryMenu(menu, { activeCatalogId = navigationState.catalog?.id } = {}) {
  if (!menu) return;

  if (!catalogs.length) {
    menu.innerHTML = `<div class="reader-catalog-menu-empty">אין קטלוגים להצגה</div>`;
    return;
  }

  const groups = getCatalogCategoryGroups();
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
  `).join("");
}

function renderLightboxCatalogMenu() {
  if (!searchElements.lightboxCatalogMenu) return;

  renderCatalogCategoryMenu(searchElements.lightboxCatalogMenu);

  searchElements.lightboxCatalogMenu.querySelectorAll("[data-catalog-menu-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.catalogMenuId;
      closeLightboxCatalogMenu();
      if (!catalogId || catalogId === navigationState.catalog?.id) return;
      getFeatureInterface("viewer")?.openCatalog?.(catalogId, 1);
    });
  });
}

function updateDetailCatalogMenuLabel(catalog = navigationState.catalog) {
  if (!catalogElements.catalogMenuToggleText) return;
  catalogElements.catalogMenuToggleText.textContent = catalog?.title || "בחר קטלוג";
}

function renderDetailCatalogMenu() {
  if (!catalogElements.catalogMenu) return;

  renderCatalogCategoryMenu(catalogElements.catalogMenu);

  catalogElements.catalogMenu.querySelectorAll("[data-catalog-menu-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.catalogMenuId;
      closeDetailCatalogMenu();
      if (!catalogId || catalogId === navigationState.catalog?.id) return;
      navigateTo(catalogDocumentUrl(catalogId));
    });
  });
}

function globalSearchKey(query) {
  return [String(query || "").trim(), getGlobalSearchCategory()].join("\u0000");
}

async function getGlobalSearchResults(query, limit = 72) {
  const rawQuery = String(query || "").trim();
  const category = getGlobalSearchCategory();
  if (rawQuery.length < 2) return [];
  await ensureSearchIndexLoaded({ trigger: "global-search" });
  if (!catalogSearch?.hasIndex?.({ category })) return [];

  const options = { limit, channel: "global" };
  if (category) options.category = category;
  const results = await catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

async function trackCompletedGlobalSearch(completion, query = searchElements.globalSearchInput?.value || "", options = {}) {
  const rawQuery = String(query || "").trim();
  const category = getGlobalSearchCategory();
  const key = globalSearchKey(rawQuery);
  const results = key === lastGlobalSearchKey
    ? lastGlobalSearchResults
    : await getGlobalSearchResults(rawQuery, 72);
  telemetryTrackSearch(rawQuery, results.length, {
    surface: "global",
    scope: category || "all",
    completion,
    immediate: options.immediate === true
  });
  return results;
}

function flushGlobalSearchTelemetryBeforeNavigation() {
  telemetryFlush().catch(() => {});
}

function openGlobalSearchResult(result) {
  if (!result) return false;
  hideSearchFloatingPreview();
  navigateTo(viewerDocumentUrl(result.catalogId, Number(result.page)));
  closeGlobalSearchPanel({ focusButton: false });
  return true;
}

async function submitGlobalSearch() {
  const rawQuery = String(searchElements.globalSearchInput?.value || "").trim();
  const results = await renderSearchResults(rawQuery);
  await trackCompletedGlobalSearch("submit", rawQuery, { immediate: true });
  flushGlobalSearchTelemetryBeforeNavigation();
  return openGlobalSearchResult(results[0]);
}

async function renderSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!searchElements.globalSearchResults) return [];
  const renderSequence = ++globalSearchRenderSequence;

  normalizeSearchResultsDirection(searchElements.globalSearchResults);
  hideSearchFloatingPreview();
  searchElements.globalSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    catalogSearch?.cancel?.("global");
    lastGlobalSearchKey = "";
    lastGlobalSearchResults = [];
    searchElements.globalSearchResults.classList.add("hidden");
    searchElements.globalSearchResults.removeAttribute("aria-busy");
    searchElements.globalSearchResults.innerHTML = "";
    initSearchStatus();
    return [];
  }

  const category = getGlobalSearchCategory();
  searchElements.globalSearchResults.setAttribute("aria-busy", "true");

  try {
    const results = await getGlobalSearchResults(rawQuery, 72);
    if (renderSequence !== globalSearchRenderSequence || globalSearchKey(rawQuery) !== globalSearchKey(searchElements.globalSearchInput?.value || "")) {
      return [];
    }

    lastGlobalSearchKey = globalSearchKey(rawQuery);
    lastGlobalSearchResults = results;
    searchElements.globalSearchResults.removeAttribute("aria-busy");
    if (!results.length) {
      searchElements.globalSearchResults.classList.remove("hidden");
      searchElements.globalSearchResults.innerHTML = searchEmptyStateMarkup(
        rawQuery,
        category
          ? "נסה מספר דגם קצר יותר, חלק מהמילה, או חפש שוב בכל הקטלוגים."
          : "נסה מספר דגם קצר יותר או חלק מהמילה."
      );
      searchElements.globalSearchResults.querySelector("[data-empty-search-clear]")?.addEventListener("click", () => {
        searchElements.globalSearchInput.value = "";
        renderSearchResults("");
        searchElements.globalSearchInput.focus();
      });
      return [];
    }

    searchElements.globalSearchResults.classList.remove("hidden");
    searchElements.globalSearchResults.innerHTML = results.map((result) => {
      const catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId);
      const page = clampPage(result.page, catalog);
      const rawThumb = result.thumb || (catalog ? thumbSrc(catalog, page) : "");
      const rawPreview = result.image || (catalog ? (mediumSrc(catalog, page) || pageSrc(catalog, page)) : rawThumb);
      const rawImage = rawThumb || rawPreview;
      const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
      return `
        <article class="search-result-card">
          <button type="button" class="search-result-button" data-search-catalog="${escapeHtml(result.catalogId)}" data-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
            <span class="search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
            <span class="search-result-thumb-frame catalog-image-frame">
              <img class="search-result-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(rawImage)} />
            </span>
            <span class="search-result-copy">${searchResultDetailsMarkup(result)}</span>
          </button>
        </article>
      `;
    }).join("");

    bindSearchFloatingPreviewEvents(searchElements.globalSearchResults);
    searchElements.globalSearchResults.querySelectorAll("[data-search-catalog]").forEach((button) => {
      button.addEventListener("click", async () => {
        await trackCompletedGlobalSearch("result-open", undefined, { immediate: true });
        flushGlobalSearchTelemetryBeforeNavigation();
        openGlobalSearchResult({ catalogId: button.dataset.searchCatalog, page: button.dataset.searchPage });
      });
    });
    return results;
  } catch (error) {
    if (catalogSearch?.isCancelledError?.(error) || renderSequence !== globalSearchRenderSequence) return [];
    searchState.searchIndexLoadState = "error";
    searchElements.globalSearchResults.removeAttribute("aria-busy");
    searchElements.globalSearchResults.classList.remove("hidden");
    searchElements.globalSearchResults.innerHTML = searchIndexErrorMarkup();
    searchElements.globalSearchResults.querySelector("[data-global-search-index-retry]")?.addEventListener("click", () => retrySearchIndexLoad());
    return [];
  }
}

function handleLightboxSearchResultsBackgroundClick(event) {
  const result = event.target?.closest?.("[data-lightbox-search-page]");
  if (result && searchElements.lightboxSearchResults?.contains(result)) return;

  event.preventDefault();
  event.stopPropagation();
  hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi: true });
}

function attachSearchUiEvents() {
  searchElements.globalSearchOpen?.addEventListener("click", (event) => {
    event.preventDefault();
    ensureSearchIndexLoaded().catch(() => {});
    event.stopPropagation();
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    setGlobalSearchPanelOpen(!isGlobalSearchPanelOpen(), { focus: true, focusButton: true });
  });
  searchElements.globalSearchClose?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeGlobalSearchPanel({ focusButton: true });
  });

  searchElements.globalSearchInput?.addEventListener("input", () => {
    scheduleSearchRender("global", searchElements.globalSearchInput.value);
  });
  searchElements.globalSearchInput?.addEventListener("focus", () => {
    ensureSearchIndexLoaded().catch(() => {});
    scheduleSearchRender("global", searchElements.globalSearchInput.value, { immediate: true });
  });
  searchElements.globalSearchInput?.addEventListener("click", () => scheduleSearchRender("global", searchElements.globalSearchInput.value, { immediate: true }));
  searchElements.globalSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitGlobalSearch().catch(() => {});
  });
  searchElements.globalSearchClear?.addEventListener("click", () => {
    cancelScheduledSearch("global");
    searchElements.globalSearchInput.value = "";
    searchElements.globalSearchInput.focus();
    renderSearchResults("");
  });

  searchElements.globalSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    hideSearchFloatingPreview();
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderGlobalSearchScopeMenu();
    const isOpen = !searchElements.globalSearchScopeMenu?.classList.contains("hidden");
    searchElements.globalSearchScopeMenu?.classList.toggle("hidden", isOpen);
    searchElements.globalSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  searchElements.globalSearchScopeMenu?.addEventListener("click", (event) => {
    event.stopPropagation();
    const button = event.target.closest?.("[data-global-search-category]");
    if (!button || !searchElements.globalSearchScopeMenu.contains(button)) return;
    setGlobalSearchCategory(button.dataset.globalSearchCategory);
    searchElements.globalSearchInput?.focus();
  });
  searchElements.catalogSearch?.addEventListener("wheel", handleGlobalSearchPanelWheel, { passive: false });
  searchElements.globalSearchResults?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });
  searchElements.globalSearchScopeMenu?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });
  searchElements.lightboxSearchResults?.addEventListener("wheel", handleSearchPreviewScrollIntent, { passive: true });
  searchElements.lightboxSearchResults?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });
  searchElements.lightboxSearchScopeMenu?.addEventListener("wheel", handleSearchPreviewScrollIntent, { passive: true });
  searchElements.lightboxSearchScopeMenu?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });

  searchElements.lightboxSearchInput?.addEventListener("input", () => {
    scheduleSearchRender("viewer", searchElements.lightboxSearchInput.value);
  });
  searchElements.lightboxSearchInput?.addEventListener("focus", () => {
    getFeatureInterface("viewer")?.showTopUi?.();
    ensureSearchIndexLoaded().catch(() => {});
    scheduleSearchRender("viewer", searchElements.lightboxSearchInput.value, { immediate: true });
  });
  searchElements.lightboxSearchInput?.addEventListener("click", () => {
    getFeatureInterface("viewer")?.showTopUi?.();
    scheduleSearchRender("viewer", searchElements.lightboxSearchInput.value, { immediate: true });
  });
  searchElements.lightboxSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitLightboxSearch().catch(() => {});
  });
  searchElements.lightboxSearchClear?.addEventListener("click", () => {
    cancelScheduledSearch("viewer");
    searchElements.lightboxSearchInput.value = "";
    searchElements.lightboxSearchInput.focus();
    renderLightboxSearchResults("");
    getFeatureInterface("viewer")?.showTopUi?.();
  });

  searchElements.lightboxMobileSearchToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLightboxMobileSearchOpen(!searchState.lightboxMobileSearchOpen, {
      focusInput: true,
      returnFocus: searchState.lightboxMobileSearchOpen
    });
  });
  searchElements.lightboxMobileSearchClose?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLightboxMobileSearchOpen(false, { returnFocus: true, hideResults: true });
  });

  searchElements.lightboxSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    hideSearchFloatingPreview();
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    const isOpen = !searchElements.lightboxSearchScopeMenu?.classList.contains("hidden");
    searchElements.lightboxSearchScopeMenu?.classList.toggle("hidden", isOpen);
    searchElements.lightboxSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    getFeatureInterface("viewer")?.showTopUi?.();
  });
  searchElements.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setLightboxSearchScope(button.dataset.lightboxSearchScope);
      getFeatureInterface("viewer")?.showTopUi?.();
      searchElements.lightboxSearchInput?.focus();
    });
  });
  searchElements.lightboxCatalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeDetailCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderLightboxCatalogMenu();
    const isOpen = !searchElements.lightboxCatalogMenu?.classList.contains("hidden");
    searchElements.lightboxCatalogMenu?.classList.toggle("hidden", isOpen);
    searchElements.lightboxCatalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    getFeatureInterface("viewer")?.showTopUi?.();
  });
  searchElements.lightboxCatalogMenu?.addEventListener("click", (event) => event.stopPropagation());
  searchElements.lightboxSearchResults?.addEventListener("click", handleLightboxSearchResultsBackgroundClick);
}

registerFeatureInterface("search", {
  escapePriority: 300,
  closeTopLayer: () => {
    if (!isGlobalSearchPanelOpen()) return false;
    if (searchElements.globalSearchScopeMenu && !searchElements.globalSearchScopeMenu.classList.contains("hidden")) {
      closeGlobalSearchScopeMenu();
    } else {
      closeGlobalSearchPanel({ focusButton: true });
    }
    return true;
  },
  closeViewerTopLayer: () => {
    if (searchState.lightboxMobileSearchOpen) {
      setLightboxMobileSearchOpen(false, { returnFocus: true, hideResults: true });
      return true;
    }
    if (
      (searchElements.lightboxCatalogMenu && !searchElements.lightboxCatalogMenu.classList.contains("hidden")) ||
      (searchElements.lightboxSearchScopeMenu && !searchElements.lightboxSearchScopeMenu.classList.contains("hidden"))
    ) {
      closeLightboxCatalogMenu();
      closeLightboxSearchScopeMenu();
      return true;
    }
    return false;
  },
  isLightboxMobileOpen: () => searchState.lightboxMobileSearchOpen,
  setLightboxMobileOpen: (open, options = {}) => setLightboxMobileSearchOpen(open, options),
  containsLightboxResult: (target) => Boolean(
    target?.closest?.("[data-lightbox-search-page]") &&
    searchElements.lightboxSearchResults?.contains(target.closest("[data-lightbox-search-page]"))
  ),
  hideViewerResults: (options = {}) => hideLightboxSearchResults(options)
});
/* ===== END SOURCE: src/js/50-search-ui.js ===== */

/* ===== BEGIN SOURCE: src/js/90-bootstrap.js ===== */
/**
 * Source module: 90-bootstrap.js
 * Application composition root: feature registration, route preparation, and startup.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function attachShellEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    const insideGlobalSearch = Boolean(searchElements.catalogSearch?.contains(target) || searchElements.globalSearchOpen?.contains(target));
    const insideMobileReaderSearch = Boolean(
      searchElements.lightboxSearchPanel?.contains(target) || searchElements.lightboxMobileSearchToggle?.contains(target)
    );

    if (
      featureCapabilities.catalogGrid &&
      !shellElements.mobileCategoryMenu?.contains(target) &&
      !shellElements.mobileCategoryMenuToggle?.contains(target)
    ) {
      getFeatureInterface("catalog-grid")?.closeMobileMenu?.();
    }

    if (insideGlobalSearch) {
      if (!searchElements.globalSearchScopeMenu?.contains(target) && !searchElements.globalSearchScopeToggle?.contains(target)) {
        closeGlobalSearchScopeMenu();
      }
      closeLightboxSearchScopeMenu();
      closeLightboxCatalogMenu();
      closeDetailCatalogMenu();
      return;
    }
    if (insideMobileReaderSearch) return;
    if (searchState.lightboxMobileSearchOpen) {
      setLightboxMobileSearchOpen(false, { hideResults: true });
    }
    if (searchElements.lightboxSearchScopeMenu?.contains(target) || searchElements.lightboxSearchScopeToggle?.contains(target)) return;
    if (searchElements.lightboxCatalogMenu?.contains(target) || searchElements.lightboxCatalogMenuToggle?.contains(target)) return;
    if (catalogElements.catalogMenu?.contains(target) || catalogElements.catalogMenuToggle?.contains(target)) return;
    closeGlobalSearchPanel({ focusButton: false });
    closeGlobalSearchScopeMenu();
    closeLightboxSearchScopeMenu();
    closeLightboxCatalogMenu();
    closeDetailCatalogMenu();
  });

  window.addEventListener("resize", () => {
    if (featureCapabilities.catalogGrid) {
      const catalogGrid = getFeatureInterface("catalog-grid");
      if (!window.matchMedia("(max-width: 760px)").matches) catalogGrid?.closeMobileMenu?.();
      catalogGrid?.scheduleLayoutRefresh?.();
      catalogGrid?.scheduleCategoryNavFit?.();
    }
    hideSearchFloatingPreview();
    if (featureCapabilities.catalogGrid) getFeatureInterface("catalog-grid")?.scheduleScrollTopButtonUpdate?.();
    if (featureCapabilities.search) {
      updateLightboxSearchResultsLayout(searchElements.lightboxSearchResults?.dataset.resultCount || 0);
      syncLightboxMobileSearchUi();
    }
    getFeatureInterface("viewer")?.handleResize?.();
  });
  window.addEventListener("scroll", () => {
    hideSearchFloatingPreview();
    if (featureCapabilities.catalogGrid) getFeatureInterface("catalog-grid")?.scheduleScrollTopButtonUpdate?.();
  }, { passive: true });

  window.addEventListener("keydown", (event) => {
    // Nested dialogs handle their own focus trap before the event reaches
    // window. Respect an event they already consumed, then use the shared
    // hierarchy for every remaining Escape press.
    if (event.defaultPrevented) return;
    if (handleTopLayerEscape(event)) return;
    getFeatureInterface("viewer")?.handleGlobalKeydown?.(event);
  });
}

function attachEvents() {
  const catalogGrid = getFeatureInterface("catalog-grid");
  if (featureCapabilities.catalogGrid && catalogGrid?.attachEvents) {
    bindFeatureEventsOnce("catalog-grid", catalogGrid.attachEvents);
  }
  if (featureCapabilities.search) bindFeatureEventsOnce("search-ui", attachSearchUiEvents);
  bindFeatureEventsOnce("shell", attachShellEvents);
  bindFeatureEventsOnce("favorites-share", attachFavoritesShareEvents);
  const inquiry = getFeatureInterface("inquiry");
  if (inquiry?.attachEvents) bindFeatureEventsOnce("inquiry", inquiry.attachEvents);
  const viewer = getFeatureInterface("viewer");
  if (featureCapabilities.viewer && viewer?.attachEvents) {
    bindFeatureEventsOnce("viewer", viewer.attachEvents);
  }
  bindFeatureEventsOnce("navigation", attachNavigationEvents);
}

function hideCatalogDetailUi() {
  getFeatureInterface("catalog-grid")?.hideDetail?.();
}

function syncDocumentRouteShell(nextPage) {
  const showCatalogs = nextPage === "home";
  if (shellElements.catalogsSection) {
    shellElements.catalogsSection.classList.toggle("hidden", !showCatalogs);
    if (showCatalogs) {
      shellElements.catalogsSection.removeAttribute("aria-hidden");
      // A route can start from a generated viewer/catalog document where the
      // home section is initially hidden. Reveal it deterministically instead
      // of waiting for an observer that may have skipped the hidden element.
      shellElements.catalogsSection.classList.add("in-view");
    } else {
      shellElements.catalogsSection.setAttribute("aria-hidden", "true");
    }
  }
}

function prepareDocumentRoute(nextPage) {
  getFeatureInterface("viewer")?.prepareRoute?.(nextPage);
  if (nextPage !== "favorites" && favoritesState.favoritesTransferPending) {
    closeFavoritesTransferDialog({ restoreFocus: false, cleanUrl: true });
  }
  if (featureCapabilities.favoritesWorkspace && nextPage !== "favorites" && favoritesState.favoriteNoteEditingKey) {
    getFeatureInterface("favorites-workspace")?.closeNoteEditor?.({ restoreFocus: false });
  }
  if (nextPage !== "favorites" && (favoritesState.favoritesOpen || favoritesElements.favoritesPanel?.classList.contains("favorites-standalone-page"))) {
    hideFavoritesPanelUi();
  }
  if (nextPage !== "catalog") hideCatalogDetailUi();

  if (featureCapabilities.catalogGrid) getFeatureInterface("catalog-grid")?.closeMobileMenu?.();
  if (featureCapabilities.search) {
    closeGlobalSearchPanel({ focusButton: false });
    closeGlobalSearchScopeMenu();
    closeLightboxSearchScopeMenu();
    closeLightboxCatalogMenu();
    closeDetailCatalogMenu();
  }

  setCurrentAppPage(nextPage);
  syncDocumentRouteShell(nextPage);
  syncDocumentLock();

}

function restoreDocumentRouteScroll(position) {
  if (!position) return;
  const x = Number.isFinite(Number(position.x)) ? Number(position.x) : 0;
  const y = Number.isFinite(Number(position.y)) ? Number(position.y) : 0;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.scrollTo(x, y));
  });
}

function initDocumentRoute(options = {}) {
  const route = siteRoutes?.parseLocation?.(window.location) || {
    page: currentAppPage,
    catalogId: "",
    currentPage: 1,
    source: LIGHTBOX_SOURCE_CATALOG
  };

  prepareDocumentRoute(route.page);
  if (route.page === "home") {
    navigationState.catalog = null;
    navigationState.page = 1;
    if (featureCapabilities.catalogGrid) {
      getFeatureInterface("catalog-grid")?.syncCategoryFocusFromHash?.({ animate: false, scroll: Boolean(window.location.hash) });
    }
    updateDocumentMetadata();
    if (!window.location.hash) restoreDocumentRouteScroll(options.scrollPosition);
    return true;
  }

  if (route.page === "favorites") {
    navigationState.catalog = null;
    navigationState.page = 1;
    openFavoritesPanel({ allowEmpty: true, captureReturnFocus: false });
    processFavoritesSelectionFromUrl();
    restoreDocumentRouteScroll(options.scrollPosition);
    return true;
  }

  const catalog = findCatalogById(route.catalogId);
  if (!catalog) {
    navigateTo(homeDocumentUrl(), { replace: true });
    return false;
  }

  if (route.page === "catalog") {
    getFeatureInterface("catalog-grid")?.openCatalog?.(catalog.id, { scrollBehavior: "auto" });
    restoreDocumentRouteScroll(options.scrollPosition);
    return true;
  }

  if (route.page === "viewer") {
    if (route.source === LIGHTBOX_SOURCE_FAVORITES) {
      const entries = getFavoriteEntries();
      const favoriteIndex = findFavoriteEntryIndex(entries, catalog.id, route.currentPage);
      if (favoriteIndex < 0) {
        navigateTo(favoritesDocumentUrl(), { replace: true });
        return false;
      }
      getFeatureInterface("viewer")?.openCatalog?.(catalog.id, route.currentPage, {
        source: LIGHTBOX_SOURCE_FAVORITES,
        favoriteIndex
      });
      return true;
    }

    getFeatureInterface("viewer")?.openCatalog?.(catalog.id, route.currentPage);
    return true;
  }

  navigateTo(homeDocumentUrl(), { replace: true });
  return false;
}

function init() {
  telemetryInit();
  if (featureCapabilities.catalogGrid) {
    getFeatureInterface("catalog-grid")?.initialize?.();
  }
  initImagePlaceholderObserver();
  attachEvents();
  if (featureCapabilities.search) syncLightboxMobileSearchUi();
  syncFavoritesUi({ renderPanel: isAppPage("favorites") });

  if (!catalogs.length) {
    if (featureCapabilities.catalogGrid) getFeatureInterface("catalog-grid")?.renderEmptyState?.();
    return true;
  }

  if (featureCapabilities.catalogGrid) getFeatureInterface("catalog-grid")?.renderInitialContent?.();
  if (featureCapabilities.search) {
    renderGlobalSearchScopeMenu();
    scheduleSearchIndexPreload();
    initSearchStatus();
  }
  return initDocumentRoute();
}

let initResult = true;
try {
  initResult = init();
} finally {
  if (initResult !== false) markAppReady();
}
/* ===== END SOURCE: src/js/90-bootstrap.js ===== */

})();
