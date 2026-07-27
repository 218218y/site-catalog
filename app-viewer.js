/*
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Browser bundle: app-viewer.js
 * Source modules:
 *   - src/js/00-navigation.js
 *   - src/js/05-app-contracts.js
 *   - src/js/10-app-state.js
 *   - src/js/11-navigation-state.js
 *   - src/js/12-catalog-state.js
 *   - src/js/13-search-state.js
 *   - src/js/14-favorites-state.js
 *   - src/js/15-telemetry.js
 *   - src/js/16-viewer-state.js
 *   - src/js/20-shared-ui.js
 *   - src/js/30-favorites-share.js
 *   - src/js/31-viewer-share.js
 *   - src/js/32-shared-inquiry.js
 *   - src/js/35-favorites-workspace.js
 *   - src/js/40-catalog-grid.js
 *   - src/js/50-search-ui.js
 *   - src/js/52-viewer-session.js
 *   - src/js/53-viewer-image.js
 *   - src/js/54-viewer-geometry.js
 *   - src/js/56-viewer-shell.js
 *   - src/js/58-viewer-navigation.js
 *   - src/js/60-viewer.js
 *   - src/js/62-viewer-actions.js
 *   - src/js/65-viewer-onboarding.js
 *   - src/js/70-viewer-input.js
 *   - src/js/90-bootstrap.js
 * Build command: python tools/build_frontend_assets.py
 */

(() => {
"use strict";

/** @type {FeatureCapabilities} */
const featureCapabilities = Object.freeze({"viewer":true,"favoritesWorkspace":true,"catalogGrid":true,"search":true});

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
 * Result returned by persistence-aware favorites mutations. ``persisted=false``
 * means the in-memory list changed but browser storage rejected the write.
 *
 * @typedef {Object} FavoriteMutationResult
 * @property {string} operation
 * @property {boolean} changed
 * @property {boolean} persisted
 * @property {string} reason
 * @property {Array<Record<string, unknown>>} items
 * @property {boolean} [active]
 */
/**
 * @typedef {Object} FavoritesStore
 * @property {string} storageKey
 * @property {()=>Array<Record<string, unknown>>} read
 * @property {()=>Array<Record<string, unknown>>} reload
 * @property {()=>({persisted:boolean, reason:string})} status
 * @property {()=>FavoriteMutationResult|null} lastMutation
 * @property {(item:Record<string, unknown>)=>boolean} toggle
 * @property {(item:Record<string, unknown>)=>FavoriteMutationResult} toggleDetailed
 * @property {(item:Record<string, unknown>)=>boolean} remove
 * @property {(item:Record<string, unknown>)=>FavoriteMutationResult} removeDetailed
 * @property {()=>boolean} clear
 * @property {()=>FavoriteMutationResult} clearDetailed
 * @property {(items:Array<Record<string, unknown>>)=>Array<Record<string, unknown>>} replace
 * @property {(items:Array<Record<string, unknown>>)=>FavoriteMutationResult} replaceDetailed
 * @property {(item:Record<string, unknown>, note:string)=>boolean} setNote
 * @property {(item:Record<string, unknown>, note:string)=>FavoriteMutationResult} setNoteDetailed
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
    clsLastEntry: 0,
    interactions: new Map()
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

function telemetryWebVitalsSnapshot() {
  const runtime = telemetryRuntime.webVitals;
  return {
    LCP: Math.max(0, Number(runtime.lcp) || 0),
    INP: Math.max(0, Number(runtime.inp) || 0),
    CLS: Math.max(0, Number(runtime.cls) || 0)
  };
}

function telemetryPublishWebVitalsDiagnostics() {
  if (window.__BARGIG_ENABLE_VITALS_DIAGNOSTICS__ !== true) return;
  window.__BARGIG_WEB_VITALS__ = telemetryWebVitalsSnapshot();
}

function telemetryRecordInteractionTiming(entry) {
  const interactionId = Number(entry?.interactionId) || 0;
  if (!interactionId) return;
  const runtime = telemetryRuntime.webVitals;
  const duration = Math.max(0, Number(entry?.duration) || 0);
  runtime.interactions.set(interactionId, Math.max(duration, runtime.interactions.get(interactionId) || 0));
  if (runtime.interactions.size > 300) {
    const oldest = runtime.interactions.keys().next().value;
    runtime.interactions.delete(oldest);
  }
  const candidates = Array.from(runtime.interactions.values()).sort((left, right) => right - left);
  // INP uses a high-percentile interaction rather than a permanently growing
  // maximum. For fewer than 50 interactions this correctly resolves to the
  // slowest interaction; each additional 50 interactions excludes one outlier.
  const candidateIndex = Math.min(candidates.length - 1, Math.floor(candidates.length / 50));
  runtime.inp = candidates[candidateIndex] || 0;
  telemetryPublishWebVitalsDiagnostics();
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
        telemetryPublishWebVitalsDiagnostics();
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
          telemetryPublishWebVitalsDiagnostics();
        }
      }).observe({ type: "layout-shift", buffered: true });
    } catch (_error) {}
  }

  if (supported.has("event")) {
    runtime.supported.add("INP");
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) telemetryRecordInteractionTiming(entry);
      }).observe({ type: "event", buffered: true, durationThreshold: 16 });
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

/* ===== BEGIN SOURCE: src/js/16-viewer-state.js ===== */
/**
 * Source module: 16-viewer-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

const AUTO_VIEWER_ZOOM = 1;
const MIN_VIEWER_ZOOM = 0.35;
const MAX_VIEWER_ZOOM = 5;
const VIEWER_FIT_HEIGHT = "height";
const VIEWER_FIT_WIDTH = "width";
const VIEWER_FIT_SOURCE_AUTO = "auto";
const VIEWER_FIT_SOURCE_MANUAL = "manual";
const VIEWER_PHASE_CLOSED = "closed";
const VIEWER_PHASE_OPENING = "opening";
const VIEWER_PHASE_OPEN = "open";
const VIEWER_PHASE_CLOSING = "closing";
const VIEWER_FULLSCREEN_INACTIVE = "inactive";
const VIEWER_FULLSCREEN_ENTERING = "entering";
const VIEWER_FULLSCREEN_ACTIVE = "active";
const VIEWER_FULLSCREEN_EXITING = "exiting";
const VIEWER_FULL_RESOLUTION_ZOOM_THRESHOLD = 1.35;
const VIEWER_MEDIUM_OVERSUBSCRIPTION_RATIO = 0.96;
const VIEWER_FULL_RESOLUTION_WARMUP_ZOOM_EPSILON = 0.01;
const VIEWER_ONBOARDING_STORAGE_KEY = "bargig.viewer-onboarding.v2";
const DOUBLE_TAP_DELAY = 320;
const DOUBLE_TAP_DISTANCE = 34;
const TAP_MOVE_TOLERANCE = 14;
const VIEWER_PAGE_SWIPE_MIN_DISTANCE = 46;
const VIEWER_PAGE_SWIPE_AXIS_RATIO = 1.35;
const VIEWER_ZOOM_INDICATOR_HIDE_MS = 760;
const VIEWER_PAGE_INDICATOR_HIDE_MS = 1000;
const VIEWER_PAGE_SWAP_CLEANUP_MS = 240;
const VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX = 20;
const VIEWER_PAGE_WHEEL_PAGE_DELTA_PX = 100;
const VIEWER_PAGE_WHEEL_SETTLE_MS = 150;
const VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO = 0.36;
const VIEWER_PAGE_TURN_BUFFER_MIN_PX = 144;
const VIEWER_PAGE_TURN_BUFFER_MAX_PX = 330;
const VIEWER_PAGE_TURN_REMAINDER_EPSILON = 0.75;
const VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS = 0.08;
const VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS = 2.6;
const VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS = 0.0048;
const VIEWER_TOUCH_MOMENTUM_MAX_FRAME_MS = 34;
const VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS = 80;
const VIEWER_TOUCH_VELOCITY_BLEND = 0.45;
/** @type {ViewerState} */
const viewerState = {
  zoom: 1,
  fitScale: 1,
  imageFitMode: VIEWER_FIT_HEIGHT,
  imageFitModeSource: VIEWER_FIT_SOURCE_AUTO,
  singleImageFitOriginPending: false,
  singleImagePendingRelativePosition: null,
  singleImagePendingPageTurnOrigin: null,
  panX: 0,
  panY: 0,
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
  pinchStartZoom: 1,
  pinchLastMidX: 0,
  pinchLastMidY: 0,
  pointerGestureHadMultiplePointers: false,
  pointerGestureConsumedPan: false,
  pointers: new Map(),
  viewerTouchMomentumRaf: 0,
  viewerTouchMomentumVelocityX: 0,
  viewerTouchMomentumVelocityY: 0,
  viewerTouchMomentumLastTime: 0,
  viewerPhase: VIEWER_PHASE_CLOSED,
  viewerPhaseReason: "initial",
  viewerFullscreenPhase: VIEWER_FULLSCREEN_INACTIVE,
  viewerFullscreenReason: "initial",
  topUiPinned: false,
  uiHideTimer: 0,
  pageRailHideTimer: 0,
  lastTouchLikeViewportInputAt: 0,
  lastTouchLikeRailInputAt: 0,
  zoomIndicatorHideTimer: 0,
  pageIndicatorHideTimer: 0,
  viewerMobileMoreOpen: false,
  singleImageLoadToken: 0,
  singleImageAnimationTimer: 0,
  singleImageResolutionLoadToken: 0,
  singleImageResolutionStop: null,
  singleImageResolutionImage: null,
  singleImageResolutionTargetSrc: "",
  singleImageResolutionTargetTier: "",
  singleImageResolutionReady: false,
  singleImageResolutionVisible: false,
  singleImageResolutionCommitPending: false,
  singleImageResolutionRetainedForSwap: false,
  viewerPageWheelAccumulator: 0,
  viewerPageWheelBasePage: 0,
  viewerPageWheelTargetPage: 0,
  viewerPageWheelSettleTimer: 0,
  viewerOnboardingOpen: false,
  viewerOnboardingShownThisSession: false,
  viewerOnboardingStep: 0,
  viewerOnboardingTarget: null,
  viewerOnboardingFloatingTargets: [],
  viewerOnboardingRestoreUi: null,
  viewerOnboardingLayoutRaf: 0,
  viewerOnboardingLayoutTimer: 0,
};

/** @type {Readonly<Record<string, HTMLElement | null>>} */
const viewerElements = Object.freeze({
  lightbox: $("lightbox"),
  lightboxBackdrop: $("lightboxBackdrop"),
  lightboxBar: $("lightboxBar"),
  topHotspot: $("topHotspot"),
  lightboxScreenshot: $("lightboxScreenshot"),
  lightboxCopyLink: $("lightboxCopyLink"),
  lightboxHomeLink: $("lightboxHomeLink"),
  lightboxPinTopBar: $("lightboxPinTopBar"),
  lightboxModeLabel: $("lightboxModeLabel"),
  lightboxTitle: $("lightboxTitle"),
  lightboxMeta: $("lightboxMeta"),
  lightboxProgress: $("lightboxProgress"),
  viewerPageIndicator: $("viewerPageIndicator"),
  viewerPageIndicatorLabel: $("viewerPageIndicatorLabel"),
  viewerPageIndicatorCurrent: $("viewerPageIndicatorCurrent"),
  viewerPageIndicatorTotal: $("viewerPageIndicatorTotal"),
  viewerPageIndicatorDetail: $("viewerPageIndicatorDetail"),
  lightboxImage: $("lightboxImage"),
  lightboxImageFrame: $("lightboxImageFrame"),
  viewerImageFeedback: $("viewerImageFeedback"),
  viewerImageFeedbackText: $("viewerImageFeedbackText"),
  viewerImageRetry: $("viewerImageRetry"),
  lightboxStage: $("lightboxStage"),
  lightboxSideHotspot: $("lightboxSideHotspot"),
  lightboxPageRail: $("lightboxPageRail"),
  lightboxPageRailTitle: $("lightboxPageRailTitle"),
  lightboxPageThumbs: $("lightboxPageThumbs"),
  lightboxFloatingPreview: $("lightboxFloatingPreview"),
  lightboxFloatingPreviewImage: $("lightboxFloatingPreviewImage"),
  lightboxFloatingPreviewPage: $("lightboxFloatingPreviewPage"),
  stageCanvas: $("stageCanvas"),
  viewerLoading: $("viewerLoading"),
  prevPageBtn: $("prevPageBtn"),
  nextPageBtn: $("nextPageBtn"),
  fullscreenToggle: $("fullscreenToggle"),
  fitAutoBtn: $("fitAutoBtn"),
  fitHeightBtn: $("fitHeightBtn"),
  fitWidthBtn: $("fitWidthBtn"),
  viewerAutoZoomBtn: $("viewerAutoZoomBtn"),
  viewerZoomIndicator: $("viewerZoomIndicator"),
  viewerMobileMoreToggle: $("viewerMobileMoreToggle"),
  viewerMobileMoreMenu: $("viewerMobileMoreMenu"),
  viewerOnboarding: $("viewerOnboarding"),
  viewerOnboardingCard: $("viewerOnboardingCard"),
  viewerOnboardingSpotlight: $("viewerOnboardingSpotlight"),
  viewerOnboardingGesture: $("viewerOnboardingGesture"),
  viewerOnboardingTitle: $("viewerOnboardingTitle"),
  viewerOnboardingDescription: $("viewerOnboardingDescription"),
  viewerOnboardingEyebrow: $("viewerOnboardingEyebrow"),
  viewerOnboardingNote: $("viewerOnboardingNote"),
  viewerOnboardingCounter: $("viewerOnboardingCounter"),
  viewerOnboardingDots: $("viewerOnboardingDots"),
  viewerOnboardingPrevious: $("viewerOnboardingPrevious"),
  viewerOnboardingNext: $("viewerOnboardingNext"),
  viewerOnboardingSkip: $("viewerOnboardingSkip"),
  viewerOnboardingShadeTop: $("viewerOnboardingShadeTop"),
  viewerOnboardingShadeRight: $("viewerOnboardingShadeRight"),
  viewerOnboardingShadeBottom: $("viewerOnboardingShadeBottom"),
  viewerOnboardingShadeLeft: $("viewerOnboardingShadeLeft"),
});
/* ===== END SOURCE: src/js/16-viewer-state.js ===== */

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

/**
 * Display truthful persistence feedback. Favorites continue to work in memory
 * when browser storage is unavailable, but the UI must never describe that
 * fallback as a durable save.
 *
 * @param {FavoriteMutationResult|null|undefined} result
 * @param {{persisted:string, temporary:string, tone?:string, duration?:number}} messages
 * @returns {boolean}
 */
function showFavoritePersistenceFeedback(result, messages) {
  const persisted = result?.persisted !== false;
  showActionToast(persisted ? messages.persisted : messages.temporary, {
    tone: persisted ? (messages.tone || "saved") : "warning",
    duration: persisted ? (messages.duration || 1300) : 4600
  });
  return persisted;
}

/** @param {FavoriteMutationResult|null|undefined} result */
function warnIfFavoriteChangeIsTemporary(result) {
  if (!result?.changed || result.persisted !== false) return;
  showActionToast("השינוי נשמר זמנית בלבד — אחסון המועדפים חסום בדפדפן", {
    tone: "warning",
    duration: 4600
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
  const mutation = favoritesStore.replaceDetailed(nextItems);
  closeFavoritesTransferDialog({ restoreFocus: false, cleanUrl: pending.source === "link" });
  syncFavoritesUi({ renderPanel: true });
  syncFavoriteViewerAfterStoreChange();
  const verb = mode === "merge" ? "מוזגה" : "נטענה";
  const rejectedText = pending.rejected ? ` · ${pending.rejected} לא היו זמינים` : "";
  const resultText = mode === "merge"
    ? `${comparison.newItems.length} חדשים · ${comparison.alreadyExistingItems.length} כבר היו שמורים`
    : `${incoming.length} פריטים`;
  showFavoritePersistenceFeedback(mutation, {
    persisted: `הרשימה ${verb}: ${resultText}${rejectedText}`,
    temporary: `הרשימה ${verb} זמנית בלבד: ${resultText}${rejectedText} — האחסון חסום`,
    tone: "saved",
    duration: 2800
  });
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
  const mutation = favoritesStore.toggleDetailed({ ...identity, savedAt: Date.now() });
  if (!mutation.changed) return;
  const added = mutation.active === true;
  telemetryTrackFavorite(added ? "add" : "remove", identity.catalogId, identity.page, getFavoriteEntries().length);
  syncFavoritesUi({ renderPanel: true });
  if (isFavoritesLightboxMode() && !added) {
    syncFavoriteViewerAfterStoreChange({ preferredIndex: previousFavoriteIndex });
  }
  if (getFeatureInterface("viewer")?.isViewerOpen?.()) {
    flashActionButton(favoritesElements.viewerFavoriteButton, mutation.persisted === false ? "זמני" : (added ? "נשמר" : "הוסר"));
    showFavoritePersistenceFeedback(mutation, added ? {
      persisted: "נשמר במועדפים",
      temporary: "נשמר זמנית בלבד — אחסון המועדפים חסום בדפדפן",
      tone: "saved"
    } : {
      persisted: "הוסר מהמועדפים",
      temporary: "הוסר מהרשימה הזמנית בלבד — השינוי לא יישמר לאחר רענון",
      tone: "removed"
    });
  }
}

function removeFavorite(catalogId, page) {
  if (!favoritesStore) return;
  const mutation = favoritesStore.removeDetailed({ catalogId, page });
  if (mutation.changed) {
    favoritesState.favoritesSelectedKeys.delete(favoriteItemKey({ catalogId, page }));
    telemetryTrackFavorite("remove", catalogId, page, getFavoriteEntries().length);
  }
  syncFavoritesUi({ renderPanel: true });
  if (mutation.changed) showFavoritePersistenceFeedback(mutation, {
    persisted: "הוסר מהמועדפים",
    temporary: "הוסר מהרשימה הזמנית בלבד — השינוי לא יישמר לאחר רענון",
    tone: "removed"
  });
}

function clearAllFavorites() {
  if (!favoritesStore || !getFavoriteEntries().length) return;
  if (!window.confirm("למחוק את כל העמודים מהמועדפים?")) return;
  const mutation = favoritesStore.clearDetailed();
  if (!mutation.changed) return;
  favoritesState.favoritesSelectedKeys.clear();
  favoritesState.favoritesFilterCatalogId = "";
  telemetryTrackFavorite("clear", "", 0, 0);
  syncFavoritesUi({ renderPanel: true });
  showFavoritePersistenceFeedback(mutation, {
    persisted: "כל המועדפים הוסרו",
    temporary: "המועדפים הוסרו זמנית בלבד — הרשימה תחזור לאחר רענון",
    tone: "removed"
  });
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

/* ===== BEGIN SOURCE: src/js/31-viewer-share.js ===== */
/**
 * Source module: 31-viewer-share.js
 * Viewer-only adapters for snapshot and link-sharing controls.
 *
 * The reusable sharing implementation remains in the favorites/share feature;
 * this bridge owns only Viewer DOM bindings and is absent from catalog routes.
 */

function downloadCurrentLightboxImage() {
  if (!navigationState.catalog) return;
  downloadCatalogPageSnapshot(
    navigationState.catalog,
    navigationState.page,
    viewerElements.lightboxScreenshot
  );
}

async function shareCurrentLightboxLink() {
  await shareOrCopyCurrentLink(viewerElements.lightboxCopyLink);
}

function attachViewerShareEvents() {
  viewerElements.lightboxScreenshot?.addEventListener("click", downloadCurrentLightboxImage);
  viewerElements.lightboxCopyLink?.addEventListener("click", shareCurrentLightboxLink);
}
/* ===== END SOURCE: src/js/31-viewer-share.js ===== */

/* ===== BEGIN SOURCE: src/js/32-shared-inquiry.js ===== */
/**
 * Source module: 32-shared-inquiry.js
 * Inquiry dialog shared by the Viewer and the favorites workspace.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into route-specific browser bundles.
 */

const inquiryState = {
  open: false,
  returnFocus: null,
  reference: null
};

const inquiryElements = Object.freeze({
  viewerInquiryButton: $("viewerInquiryButton"),
  viewerInquiryOverlay: $("viewerInquiryOverlay"),
  viewerInquiryBackdrop: $("viewerInquiryBackdrop"),
  viewerInquiryClose: $("viewerInquiryClose"),
  viewerInquiryEyebrow: $("viewerInquiryEyebrow"),
  viewerInquiryTitle: $("viewerInquiryTitle"),
  viewerInquiryDescription: $("viewerInquiryDescription"),
  viewerInquiryReference: $("viewerInquiryReference"),
  viewerInquiryCatalog: $("viewerInquiryCatalog"),
  viewerInquiryPage: $("viewerInquiryPage"),
  viewerInquiryPreview: $("viewerInquiryPreview"),
  viewerInquiryActions: $("viewerInquiryActions"),
  viewerInquiryGmail: $("viewerInquiryGmail"),
  viewerInquiryEmail: $("viewerInquiryEmail"),
  viewerInquiryShare: $("viewerInquiryShare"),
  viewerInquiryCopy: $("viewerInquiryCopy")
});

function viewerInquiryFooterEmail() {
  return Array.from(document.querySelectorAll(".site-footer-contact-list a[href]"))
    .find((link) => String(link.getAttribute("href") || "").startsWith("mailto:")) || null;
}

function viewerInquiryEmailAddress() {
  const emailHref = String(viewerInquiryFooterEmail()?.getAttribute?.("href") || "").trim();
  return emailHref.replace(/^mailto:/i, "").split("?")[0].trim();
}

function viewerPageInquiryReference() {
  if (!navigationState.catalog) return null;
  const page = clampPage(navigationState.page, navigationState.catalog);
  const url = absoluteDocumentUrl(viewerDocumentUrl(navigationState.catalog.id, page));
  const title = String(navigationState.catalog.title || "קטלוג").trim() || "קטלוג";
  const pageLabel = `עמוד ${page} מתוך ${Math.max(1, Number(navigationState.catalog.pages) || 1)}`;
  const subject = `בירור על דגם – ${title}, עמוד ${page}`;
  const shareText = [
    "שלום,",
    "רציתי לברר לגבי הדגם הבא:",
    `קטלוג: ${title}`,
    `עמוד: ${page}`
  ].join("\n");
  const text = `${shareText}\nקישור ישיר: ${url}`;
  return {
    kind: "viewer",
    source: "viewer-inquiry",
    catalog: navigationState.catalog,
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
    previewCatalog: navigationState.catalog,
    previewPage: page,
    telemetry: {
      source: "viewer-inquiry",
      catalogId: navigationState.catalog.id,
      pageNumber: page
    }
  };
}

function viewerInquiryReference() {
  return inquiryState.reference || viewerPageInquiryReference();
}

function viewerInquiryGmailUrl(emailAddress, reference) {
  const query = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: emailAddress,
    su: reference.subject,
    body: reference.text
  });
  return `https://mail.google.com/mail/?${query.toString()}`;
}

function viewerInquiryMailtoUrl(emailAddress, reference) {
  const subject = encodeURIComponent(String(reference?.subject || ""));
  const body = encodeURIComponent(
    String(reference?.text || "").replace(/\r?\n/g, "\r\n")
  );
  return `mailto:${emailAddress}?subject=${subject}&body=${body}`;
}

function viewerInquiryTelemetryFields(reference, action, detail = "") {
  const telemetry = reference?.telemetry || {};
  return {
    action,
    detail,
    source: telemetry.source || reference?.source || "viewer-inquiry",
    catalogId: telemetry.catalogId || reference?.catalog?.id || "",
    pageNumber: telemetry.pageNumber || reference?.page || 0,
    value: telemetry.value || reference?.count || 0
  };
}

function syncViewerInquiryContactLink(link, href, reference, action) {
  if (!link) return;
  const available = Boolean(href);
  link.classList.toggle("hidden", !available);
  link.setAttribute("aria-hidden", available ? "false" : "true");
  if (!available) {
    link.removeAttribute("href");
    delete link.dataset.contactSource;
    delete link.dataset.contactAction;
    delete link.dataset.contactCatalogId;
    delete link.dataset.contactPage;
    return;
  }
  const telemetry = viewerInquiryTelemetryFields(reference, action);
  link.href = href;
  link.dataset.contactSource = telemetry.source;
  link.dataset.contactAction = action;
  if (telemetry.catalogId) link.dataset.contactCatalogId = telemetry.catalogId;
  else delete link.dataset.contactCatalogId;
  if (telemetry.pageNumber) link.dataset.contactPage = String(telemetry.pageNumber);
  else delete link.dataset.contactPage;
}

function syncViewerInquiryUi(reference = viewerInquiryReference()) {
  if (!reference) return;

  if (inquiryElements.viewerInquiryEyebrow) inquiryElements.viewerInquiryEyebrow.textContent = reference.eyebrow || "פרטי הבירור מצורפים אוטומטית";
  if (inquiryElements.viewerInquiryTitle) inquiryElements.viewerInquiryTitle.textContent = reference.title || "בירור על הדגם";
  if (inquiryElements.viewerInquiryDescription) inquiryElements.viewerInquiryDescription.textContent = reference.description || "פרטי הבירור והקישורים מוכנים מראש.";
  if (inquiryElements.viewerInquiryCatalog) inquiryElements.viewerInquiryCatalog.textContent = reference.referenceTitle || reference.title;
  if (inquiryElements.viewerInquiryPage) inquiryElements.viewerInquiryPage.textContent = reference.pageLabel || "";
  inquiryElements.viewerInquiryReference?.classList.toggle("is-bulk", reference.kind === "favorites");

  if (inquiryElements.viewerInquiryButton && reference.kind === "viewer") {
    const label = `בירור על הדגם — ${reference.referenceTitle}, עמוד ${reference.page}`;
    inquiryElements.viewerInquiryButton.setAttribute("aria-label", label);
  }

  const previewCatalog = reference.previewCatalog || reference.catalog;
  const previewPage = Number(reference.previewPage || reference.page) || 1;
  if (inquiryElements.viewerInquiryPreview && previewCatalog) {
    const preview = thumbSrc(previewCatalog, previewPage) || pageSrc(previewCatalog, previewPage);
    if (inquiryElements.viewerInquiryPreview.getAttribute("src") !== preview) {
      inquiryElements.viewerInquiryPreview.src = preview;
    }
    inquiryElements.viewerInquiryPreview.alt = reference.kind === "favorites"
      ? `תצוגה מקדימה של ${reference.referenceTitle}`
      : `${reference.referenceTitle}, עמוד ${previewPage}`;
  }

  const emailAddress = viewerInquiryEmailAddress();
  const emailAvailable = Boolean(emailAddress);
  syncViewerInquiryContactLink(
    inquiryElements.viewerInquiryEmail,
    emailAvailable ? viewerInquiryMailtoUrl(emailAddress, reference) : "",
    reference,
    "email"
  );
  syncViewerInquiryContactLink(
    inquiryElements.viewerInquiryGmail,
    emailAvailable ? viewerInquiryGmailUrl(emailAddress, reference) : "",
    reference,
    "gmail"
  );
}

function setViewerInquiryTriggerState(open, activeTrigger = null) {
  [inquiryElements.viewerInquiryButton, favoritesElements.favoritesInquiryButton].forEach((button) => {
    if (!button) return;
    button.setAttribute("aria-expanded", open && button === activeTrigger ? "true" : "false");
  });
}

function getViewerInquiryFocusableElements() {
  if (!inquiryElements.viewerInquiryOverlay) return [];
  return Array.from(inquiryElements.viewerInquiryOverlay.querySelectorAll(
    'button:not([disabled]), a[href]:not(.hidden), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.closest?.(".hidden"));
}

function openViewerInquiry(options = {}) {
  const reference = options.reference || viewerPageInquiryReference();
  if (!reference || !inquiryElements.viewerInquiryOverlay) return;
  getFeatureInterface("viewer")?.prepareInquiry?.();

  const returnFocus = options.returnFocus || document.activeElement || inquiryElements.viewerInquiryButton;
  inquiryState.reference = reference;
  inquiryState.open = true;
  inquiryState.returnFocus = returnFocus;
  syncViewerInquiryUi(reference);
  inquiryElements.viewerInquiryOverlay.classList.remove("hidden");
  inquiryElements.viewerInquiryOverlay.setAttribute("aria-hidden", "false");
  setViewerInquiryTriggerState(true, returnFocus);
  syncDocumentLock();
  window.requestAnimationFrame(() => {
    if (!inquiryState.open) return;
    inquiryElements.viewerInquiryOverlay?.classList.add("visible");
    (inquiryElements.viewerInquiryClose || getViewerInquiryFocusableElements()[0])?.focus?.({ preventScroll: true });
  });
}

function closeViewerInquiry(options = {}) {
  if (!inquiryState.open && inquiryElements.viewerInquiryOverlay?.classList.contains("hidden")) return;
  const { restoreFocus = true } = options;
  const returnFocus = inquiryState.returnFocus;
  inquiryState.open = false;
  inquiryState.returnFocus = null;
  inquiryState.reference = null;
  inquiryElements.viewerInquiryOverlay?.classList.remove("visible");
  inquiryElements.viewerInquiryOverlay?.setAttribute("aria-hidden", "true");
  setViewerInquiryTriggerState(false);
  syncDocumentLock();
  window.setTimeout(() => {
    if (!inquiryState.open) inquiryElements.viewerInquiryOverlay?.classList.add("hidden");
  }, 180);
  if (restoreFocus) (returnFocus || inquiryElements.viewerInquiryButton)?.focus?.({ preventScroll: true });
}

function handleViewerInquiryKeydown(event) {
  if (!inquiryState.open) return false;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeViewerInquiry();
    return true;
  }
  if (event.key !== "Tab") return true;

  const focusable = getViewerInquiryFocusableElements();
  if (!focusable.length) {
    event.preventDefault();
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
  return true;
}

async function copyViewerInquiryReference() {
  const reference = viewerInquiryReference();
  if (!reference) return;
  try {
    await copyTextToClipboard(reference.text);
    telemetryTrack("contact", viewerInquiryTelemetryFields(reference, "copy"), { immediate: true });
    showActionToast(reference.kind === "favorites" ? "פרטי הדגמים הועתקו" : "פרטי הדגם הועתקו", { tone: "link" });
    closeViewerInquiry();
  } catch (_error) {
    window.prompt("אפשר להעתיק את פרטי הבירור מכאן:", reference.text);
  }
}

async function shareViewerInquiryReference() {
  const reference = viewerInquiryReference();
  if (!reference) return;

  const shareData = {
    title: reference.subject,
    text: reference.shareText,
    url: reference.url
  };
  let canUseNativeShare = typeof navigator.share === "function";
  if (canUseNativeShare && typeof navigator.canShare === "function") {
    try {
      canUseNativeShare = navigator.canShare(shareData);
    } catch (_error) {
      canUseNativeShare = false;
    }
  }

  if (canUseNativeShare) {
    try {
      await navigator.share(shareData);
      telemetryTrack("contact", viewerInquiryTelemetryFields(reference, "share"), { immediate: true });
      closeViewerInquiry({ restoreFocus: false });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await copyTextToClipboard(reference.text);
    telemetryTrack("contact", viewerInquiryTelemetryFields(reference, "share", "copy-fallback"), { immediate: true });
    showActionToast(
      reference.kind === "favorites"
        ? "אפשרויות שיתוף אינן זמינות — פרטי הדגמים הועתקו"
        : "אפשרויות שיתוף אינן זמינות — פרטי הדגם הועתקו",
      { tone: "link" }
    );
    closeViewerInquiry();
  } catch (_error) {
    window.prompt("אפשר להעתיק ולשתף את פרטי הבירור מכאן:", reference.text);
  }
}

function attachSharedInquiryEvents() {
  inquiryElements.viewerInquiryButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openViewerInquiry({ returnFocus: inquiryElements.viewerInquiryButton });
  });
  inquiryElements.viewerInquiryBackdrop?.addEventListener("click", () => closeViewerInquiry());
  inquiryElements.viewerInquiryClose?.addEventListener("click", () => closeViewerInquiry());
  inquiryElements.viewerInquiryShare?.addEventListener("click", () => shareViewerInquiryReference());
  inquiryElements.viewerInquiryCopy?.addEventListener("click", () => copyViewerInquiryReference());
  inquiryElements.viewerInquiryOverlay?.addEventListener("keydown", handleViewerInquiryKeydown);
  [inquiryElements.viewerInquiryGmail, inquiryElements.viewerInquiryEmail].forEach((link) => {
    link?.addEventListener("click", () => window.setTimeout(() => closeViewerInquiry({ restoreFocus: false }), 0));
  });
}

registerFeatureInterface("inquiry", {
  escapePriority: 600,
  requiresDocumentLock: () => inquiryState.open,
  isOpen: () => inquiryState.open,
  attachEvents: attachSharedInquiryEvents,
  openInquiry: (options = {}) => openViewerInquiry(options),
  close: (options = {}) => closeViewerInquiry(options),
  closeTopLayer: () => {
    if (!inquiryState.open) return false;
    closeViewerInquiry();
    return true;
  }
});
/* ===== END SOURCE: src/js/32-shared-inquiry.js ===== */

/* ===== BEGIN SOURCE: src/js/35-favorites-workspace.js ===== */
/**
 * Source module: 35-favorites-workspace.js
 * Favorites workspace: notes, catalog filtering, ordering, focused selection, sharing, and bulk inquiry.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function favoriteWorkspaceEntryKey(entry) {
  return favoriteItemKey({ catalogId: entry?.catalog?.id || entry?.catalogId, page: entry?.page });
}

function favoriteWorkspaceCardKey(card) {
  if (!card) return "";
  return favoriteItemKey({
    catalogId: card.dataset.favoriteCatalog,
    page: card.dataset.favoritePage
  });
}

function favoriteWorkspaceFindCardByKey(key) {
  if (!key || !favoritesElements.favoritesGrid) return null;
  return Array.from(favoritesElements.favoritesGrid.querySelectorAll("[data-favorite-catalog][data-favorite-page]"))
    .find((card) => favoriteWorkspaceCardKey(card) === key) || null;
}

function favoriteWorkspaceSelectedEntries(entries = getFavoriteEntries()) {
  return entries.filter((entry) => favoritesState.favoritesSelectedKeys.has(favoriteWorkspaceEntryKey(entry)));
}

function favoriteWorkspaceVisibleEntries(entries = getFavoriteEntries()) {
  const filter = String(favoritesState.favoritesFilterCatalogId || "");
  return filter ? entries.filter((entry) => String(entry.catalog?.id || entry.catalogId) === filter) : entries;
}

function favoriteWorkspaceShareLinkEntries(entries = getFavoriteEntries()) {
  const selectedEntries = favoriteWorkspaceSelectedEntries(entries);
  return selectedEntries.length ? selectedEntries : entries;
}

function pruneFavoritesWorkspaceState(entries = getFavoriteEntries()) {
  const validKeys = new Set(entries.map(favoriteWorkspaceEntryKey).filter(Boolean));
  for (const key of favoritesState.favoritesSelectedKeys) {
    if (!validKeys.has(key)) favoritesState.favoritesSelectedKeys.delete(key);
  }
  if (favoritesState.favoriteNoteEditingKey && !validKeys.has(favoritesState.favoriteNoteEditingKey)) {
    closeFavoriteNoteEditor({ restoreFocus: false });
  }
  if (favoritesState.favoritesFilterCatalogId && !entries.some((entry) => String(entry.catalog?.id || entry.catalogId) === favoritesState.favoritesFilterCatalogId)) {
    favoritesState.favoritesFilterCatalogId = "";
  }
}

function favoriteWorkspaceFilterOptions(entries) {
  const catalogCounts = new Map();
  entries.forEach((entry) => {
    const id = String(entry.catalog?.id || entry.catalogId || "");
    if (!id) return;
    const current = catalogCounts.get(id) || { catalog: entry.catalog, count: 0 };
    current.count += 1;
    catalogCounts.set(id, current);
  });
  return [...catalogCounts.entries()].map(([id, value]) => ({ id, ...value }));
}

function syncFavoriteWorkspaceFilter(entries) {
  if (!favoritesElements.favoritesCatalogFilter) return;
  const options = favoriteWorkspaceFilterOptions(entries);
  const current = String(favoritesState.favoritesFilterCatalogId || "");
  favoritesElements.favoritesCatalogFilter.innerHTML = [
    '<option value="">כל הקטלוגים</option>',
    ...options.map(({ id, catalog, count }) => (
      `<option value="${escapeHtml(id)}">${escapeHtml(catalog?.title || id)} (${count})</option>`
    ))
  ].join("");
  favoritesElements.favoritesCatalogFilter.value = options.some((option) => option.id === current) ? current : "";
  favoritesState.favoritesFilterCatalogId = favoritesElements.favoritesCatalogFilter.value;
}

function favoriteWorkspaceInquiryReference(entries, options = {}) {
  if (!entries.length) return null;
  const selected = Boolean(options.selected);
  const firstEntry = entries[0];
  const count = entries.length;
  const scopeLabel = selected ? "הדגמים שנבחרו" : "כל המועדפים";
  const title = selected ? "בירור על הדגמים שנבחרו" : "בירור על הדגמים";
  const selectionUrl = favoriteWorkspaceSelectionUrl(entries);
  const shareText = favoriteWorkspaceMessage(entries, { purpose: "inquiry" });
  const text = `${shareText}

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
  const entries = getFavoriteEntries();
  const selectedEntries = favoriteWorkspaceSelectedEntries(entries);
  const actionEntries = selectedEntries.length ? selectedEntries : entries;
  const reference = favoriteWorkspaceInquiryReference(actionEntries, { selected: selectedEntries.length > 0 });
  if (!reference) return;
  getFeatureInterface("inquiry")?.openInquiry?.({
    reference,
    returnFocus: favoritesElements.favoritesInquiryButton
  });
}

function syncFavoriteWorkspaceHeaderActions(entries, visibleEntries) {
  const selectedEntries = favoriteWorkspaceSelectedEntries(entries);
  const selectedCount = selectedEntries.length;
  const inquiryEntries = selectedCount ? selectedEntries : entries;
  const shareEntries = selectedCount ? selectedEntries : entries;
  const hasEntries = entries.length > 0;

  favoritesElements.favoritesHeaderWorkspace?.classList.toggle("hidden", !hasEntries);
  if (favoritesElements.favoritesCatalogFilter) favoritesElements.favoritesCatalogFilter.disabled = !hasEntries;
  if (favoritesElements.favoritesVisibleCount) {
    favoritesElements.favoritesVisibleCount.textContent = visibleEntries.length === entries.length
      ? `${entries.length} פריטים`
      : `${visibleEntries.length} מתוך ${entries.length}`;
  }

  if (favoritesElements.favoritesShareButton) {
    favoritesElements.favoritesShareButton.disabled = shareEntries.length === 0;
    favoritesElements.favoritesShareButton.setAttribute("aria-label", shareEntries.length
      ? (selectedCount
        ? `העתקת קישור עבור ${selectedCount} פריטים שסומנו`
        : `העתקת קישור לכל ${entries.length} המועדפים`)
      : "העתקת קישור למועדפים — אין עדיין פריטים");
  }
  if (favoritesElements.favoritesShareLabel) {
    favoritesElements.favoritesShareLabel.textContent = selectedCount ? "שיתוף הבחירה" : "שיתוף הרשימה";
  }

  if (favoritesElements.favoritesInquiryButton) {
    favoritesElements.favoritesInquiryButton.classList.toggle("hidden", !hasEntries);
    favoritesElements.favoritesInquiryButton.disabled = inquiryEntries.length === 0;
    favoritesElements.favoritesInquiryButton.setAttribute("aria-label", selectedCount
      ? `בירור על ${selectedCount} הדגמים שנבחרו`
      : `בירור על כל ${entries.length} הדגמים במועדפים`);
  }
  if (favoritesElements.favoritesInquiryLabel) {
    favoritesElements.favoritesInquiryLabel.textContent = selectedCount ? "בירור על הדגמים שנבחרו" : "בירור על הדגמים";
  }

  favoritesElements.favoritesSelectionBar?.classList.toggle("hidden", selectedCount === 0);
  if (favoritesElements.favoritesSelectionCount) favoritesElements.favoritesSelectionCount.textContent = String(selectedCount);
}

function favoriteWorkspaceNoteMarkup(entry) {
  const note = String(entry.note || "").trim();
  if (!note) return "";
  return `
    <div class="favorite-note-summary">
      <span class="favorite-note-label">הערה</span>
      <span class="favorite-note-text">${escapeHtml(note)}</span>
    </div>
  `;
}

function favoriteWorkspaceCardMarkup(entry, visibleIndex, visibleCount) {
  const { catalog, page } = entry;
  const key = favoriteWorkspaceEntryKey(entry);
  const identityCatalog = escapeHtml(catalog.id);
  const title = escapeHtml(catalog.title || "קטלוג");
  const image = thumbSrc(catalog, page);
  const selected = favoritesState.favoritesSelectedKeys.has(key);
  const note = String(entry.note || "").trim();
  const noteActionLabel = note ? "עריכת ההערה" : "הוספת הערה";
  const upDisabled = visibleIndex === 0 ? " disabled" : "";
  const downDisabled = visibleIndex === visibleCount - 1 ? " disabled" : "";

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
          <img src="${escapeHtml(image)}" alt="${title} - עמוד ${page}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(image)} />
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
  const count = entries.length;
  favoritesElements.favoritesClearButton?.classList.toggle("hidden", count === 0);
  favoritesElements.favoritesEmpty?.classList.toggle("hidden", count !== 0);
  syncFavoriteWorkspaceFilter(entries);
  const visibleEntries = favoriteWorkspaceVisibleEntries(entries);
  syncFavoriteWorkspaceHeaderActions(entries, visibleEntries);
  favoritesElements.favoritesFilteredEmpty?.classList.toggle("hidden", count === 0 || visibleEntries.length > 0);
  favoritesElements.favoritesGrid.classList.toggle("hidden", count === 0 || visibleEntries.length === 0);
  favoritesElements.favoritesGrid.innerHTML = visibleEntries.map((entry, index) => favoriteWorkspaceCardMarkup(entry, index, visibleEntries.length)).join("");
}

function favoriteWorkspaceReorderVisible(orderedVisibleKeys) {
  if (!favoritesStore || !orderedVisibleKeys.length) return false;
  const allItems = favoritesStore.read();
  const visibleSet = new Set(orderedVisibleKeys);
  const itemByKey = new Map(allItems.map((item) => [favoriteItemKey(item), item]));
  if (orderedVisibleKeys.some((key) => !itemByKey.has(key))) return false;
  let visibleIndex = 0;
  const nextItems = allItems.map((item) => {
    const key = favoriteItemKey(item);
    if (!visibleSet.has(key)) return item;
    const replacement = itemByKey.get(orderedVisibleKeys[visibleIndex]);
    visibleIndex += 1;
    return replacement;
  });
  const mutation = favoritesStore.replaceDetailed(nextItems);
  warnIfFavoriteChangeIsTemporary(mutation);
  return mutation.changed;
}

function moveFavoriteWithinVisibleOrder(key, direction) {
  const entries = getFavoriteEntries();
  const visibleEntries = favoriteWorkspaceVisibleEntries(entries);
  const keys = visibleEntries.map(favoriteWorkspaceEntryKey);
  const index = keys.indexOf(key);
  const targetIndex = index + Number(direction || 0);
  if (index < 0 || targetIndex < 0 || targetIndex >= keys.length) return false;
  [keys[index], keys[targetIndex]] = [keys[targetIndex], keys[index]];
  favoriteWorkspaceReorderVisible(keys);
  syncFavoritesUi({ renderPanel: true });
  requestAnimationFrame(() => {
    const movedCard = favoriteWorkspaceFindCardByKey(key);
    movedCard?.querySelector(`[data-move-favorite="${direction}"]`)?.focus?.();
  });
  return true;
}

function reorderFavoriteByDrop(sourceKey, targetKey) {
  if (!sourceKey || !targetKey || sourceKey === targetKey) return false;
  const visibleKeys = favoriteWorkspaceVisibleEntries().map(favoriteWorkspaceEntryKey);
  const from = visibleKeys.indexOf(sourceKey);
  const to = visibleKeys.indexOf(targetKey);
  if (from < 0 || to < 0) return false;
  visibleKeys.splice(to, 0, visibleKeys.splice(from, 1)[0]);
  favoriteWorkspaceReorderVisible(visibleKeys);
  syncFavoritesUi({ renderPanel: true });
  return true;
}

function setFavoriteWorkspaceSelection(key, selected) {
  if (!key) return;
  if (selected) favoritesState.favoritesSelectedKeys.add(key);
  else favoritesState.favoritesSelectedKeys.delete(key);
  renderFavoritesWorkspace(getFavoriteEntries());
}

function clearFavoritesSelection() {
  favoritesState.favoritesSelectedKeys.clear();
  renderFavoritesWorkspace(getFavoriteEntries());
}

function favoriteWorkspaceItemUrl(entry) {
  return absoluteDocumentUrl(viewerDocumentUrl(entry.catalog.id, entry.page));
}

function favoriteWorkspaceMessage(entries, options = {}) {
  const purpose = options.purpose === "inquiry" ? "inquiry" : "share";
  const lines = purpose === "inquiry"
    ? ["שלום,", "רציתי לברר לגבי הדגמים הבאים מתוך קטלוגי רהיטי ברגיג:", ""]
    : ["שלום,", "רציתי לשתף כמה דגמים מתוך קטלוגי רהיטי ברגיג:", ""];
  entries.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.catalog.title} — עמוד ${entry.page}`);
    if (String(entry.note || "").trim()) lines.push(`הערה: ${String(entry.note).trim()}`);
    lines.push(favoriteWorkspaceItemUrl(entry), "");
  });
  return lines.join("\n").trim();
}

function favoriteWorkspaceSelectionUrl(entries) {
  return buildFavoritesShareUrl(entries.map((entry) => ({ catalogId: entry.catalog.id, page: entry.page })));
}

async function copyFavoriteWorkspaceLink(entries, button = null) {
  if (!entries.length) return;
  const selectionUrl = favoriteWorkspaceSelectionUrl(entries);
  try {
    await copyTextToClipboard(selectionUrl);
    if (button) flashActionButton(button, "הקישור הועתק");
    showActionToast("קישור המועדפים הועתק", { tone: "link" });
  } catch (_error) {
    window.prompt("אפשר להעתיק את קישור המועדפים מכאן:", selectionUrl);
  }
}

function favoriteWorkspaceFindEntryByKey(key) {
  return getFavoriteEntries().find((entry) => favoriteWorkspaceEntryKey(entry) === key) || null;
}

function syncFavoriteNoteCount() {
  if (!favoritesElements.favoriteNoteCount || !favoritesElements.favoriteNoteInput) return;
  favoritesElements.favoriteNoteCount.textContent = `${favoritesElements.favoriteNoteInput.value.length}/${FAVORITES_NOTE_MAX_LENGTH}`;
}

function openFavoriteNoteEditor(key, returnFocus = document.activeElement) {
  const entry = favoriteWorkspaceFindEntryByKey(key);
  if (!entry || !favoritesElements.favoriteNoteOverlay || !favoritesElements.favoriteNoteInput) return;
  favoritesState.favoriteNoteEditingKey = key;
  favoritesState.favoriteNoteReturnFocus = returnFocus;
  if (favoritesElements.favoriteNoteTitle) favoritesElements.favoriteNoteTitle.textContent = entry.note ? "עריכת הערה" : "הוספת הערה";
  if (favoritesElements.favoriteNoteContext) favoritesElements.favoriteNoteContext.textContent = `${entry.catalog.title} · עמוד ${entry.page}`;
  favoritesElements.favoriteNoteInput.value = String(entry.note || "");
  syncFavoriteNoteCount();
  favoritesElements.favoriteNoteOverlay.classList.remove("hidden");
  favoritesElements.favoriteNoteOverlay.setAttribute("aria-hidden", "false");
  syncDocumentLock();
  requestAnimationFrame(() => {
    favoritesElements.favoriteNoteInput.focus();
    favoritesElements.favoriteNoteInput.setSelectionRange(favoritesElements.favoriteNoteInput.value.length, favoritesElements.favoriteNoteInput.value.length);
  });
}

function closeFavoriteNoteEditor(options = {}) {
  const { restoreFocus = true } = options;
  const returnFocus = favoritesState.favoriteNoteReturnFocus;
  favoritesState.favoriteNoteEditingKey = "";
  favoritesState.favoriteNoteReturnFocus = null;
  favoritesElements.favoriteNoteOverlay?.classList.add("hidden");
  favoritesElements.favoriteNoteOverlay?.setAttribute("aria-hidden", "true");
  syncDocumentLock();
  if (restoreFocus) returnFocus?.focus?.();
}

function saveFavoriteNote() {
  if (!favoritesState.favoriteNoteEditingKey || !favoritesStore || !favoritesElements.favoriteNoteInput) return;
  const entry = favoriteWorkspaceFindEntryByKey(favoritesState.favoriteNoteEditingKey);
  if (!entry) return closeFavoriteNoteEditor({ restoreFocus: false });
  const hasNote = Boolean(favoritesElements.favoriteNoteInput.value.trim());
  const mutation = favoritesStore.setNoteDetailed(
    { catalogId: entry.catalog.id, page: entry.page },
    favoritesElements.favoriteNoteInput.value
  );
  closeFavoriteNoteEditor({ restoreFocus: false });
  syncFavoritesUi({ renderPanel: true });
  if (mutation.changed) showFavoritePersistenceFeedback(mutation, hasNote ? {
    persisted: "ההערה נשמרה",
    temporary: "ההערה נשמרה זמנית בלבד — היא תיעלם לאחר רענון",
    tone: "saved"
  } : {
    persisted: "ההערה הוסרה",
    temporary: "ההערה הוסרה זמנית בלבד — השינוי לא יישמר לאחר רענון",
    tone: "removed"
  });
  requestAnimationFrame(() => {
    favoriteWorkspaceFindCardByKey(favoriteWorkspaceEntryKey(entry))?.querySelector("[data-edit-favorite-note]")?.focus?.();
  });
}

function favoriteWorkspaceFocusable(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('button:not([disabled]), a[href]:not(.hidden), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter((element) => !element.closest?.(".hidden"));
}

function trapFavoriteWorkspaceDialogFocus(event, container, closeCallback) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeCallback();
    return true;
  }
  if (event.key !== "Tab") return false;
  const focusable = favoriteWorkspaceFocusable(container);
  if (!focusable.length) return false;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
  return true;
}

function handleFavoritesWorkspaceGridClick(event) {
  const card = event.target.closest?.("[data-favorite-catalog][data-favorite-page]");
  if (!card || !favoritesElements.favoritesGrid?.contains(card)) return false;
  const key = favoriteWorkspaceCardKey(card);
  if (event.target.closest?.("[data-edit-favorite-note]")) {
    openFavoriteNoteEditor(key, event.target.closest("button"));
    return true;
  }
  const moveButton = event.target.closest?.("[data-move-favorite]");
  if (moveButton) {
    moveFavoriteWithinVisibleOrder(key, Number(moveButton.dataset.moveFavorite));
    return true;
  }
  return false;
}

function handleFavoritesWorkspaceGridChange(event) {
  const checkbox = event.target.closest?.("[data-select-favorite]");
  if (!checkbox) return;
  const card = checkbox.closest("[data-favorite-catalog][data-favorite-page]");
  setFavoriteWorkspaceSelection(favoriteWorkspaceCardKey(card), checkbox.checked);
}

function handleFavoritesWorkspaceDragStart(event) {
  const handle = event.target.closest?.("[data-drag-favorite]");
  const card = handle?.closest?.("[data-favorite-catalog][data-favorite-page]");
  if (!handle || !card) return;
  favoritesState.favoritesDragKey = favoriteWorkspaceCardKey(card);
  card.classList.add("is-dragging");
  event.dataTransfer?.setData("text/plain", "favorite-card");
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

function handleFavoritesWorkspaceDragOver(event) {
  if (!favoritesState.favoritesDragKey) return;
  const card = event.target.closest?.("[data-favorite-catalog][data-favorite-page]");
  if (!card || favoriteWorkspaceCardKey(card) === favoritesState.favoritesDragKey) return;
  event.preventDefault();
  favoritesElements.favoritesGrid?.querySelectorAll(".is-drag-target").forEach((item) => item.classList.remove("is-drag-target"));
  card.classList.add("is-drag-target");
}

function handleFavoritesWorkspaceDrop(event) {
  const card = event.target.closest?.("[data-favorite-catalog][data-favorite-page]");
  if (!card || !favoritesState.favoritesDragKey) return;
  event.preventDefault();
  reorderFavoriteByDrop(favoritesState.favoritesDragKey, favoriteWorkspaceCardKey(card));
  favoritesState.favoritesDragKey = "";
}

function handleFavoritesWorkspaceDragEnd() {
  favoritesState.favoritesDragKey = "";
  favoritesElements.favoritesGrid?.querySelectorAll(".is-dragging, .is-drag-target").forEach((item) => item.classList.remove("is-dragging", "is-drag-target"));
}

function attachFavoritesWorkspaceEvents() {
  favoritesElements.favoritesCatalogFilter?.addEventListener("change", () => {
    favoritesState.favoritesFilterCatalogId = favoritesElements.favoritesCatalogFilter.value;
    renderFavoritesWorkspace(getFavoriteEntries());
  });
  favoritesElements.favoritesResetFilter?.addEventListener("click", () => {
    favoritesState.favoritesFilterCatalogId = "";
    renderFavoritesWorkspace(getFavoriteEntries());
    requestAnimationFrame(() => favoritesElements.favoritesCatalogFilter?.focus?.());
  });
  favoritesElements.favoritesClearSelection?.addEventListener("click", clearFavoritesSelection);
  favoritesElements.favoritesInquiryButton?.addEventListener("click", openFavoriteWorkspaceInquiry);
  favoritesElements.favoritesGrid?.addEventListener("change", handleFavoritesWorkspaceGridChange);
  favoritesElements.favoritesGrid?.addEventListener("dragstart", handleFavoritesWorkspaceDragStart);
  favoritesElements.favoritesGrid?.addEventListener("dragover", handleFavoritesWorkspaceDragOver);
  favoritesElements.favoritesGrid?.addEventListener("drop", handleFavoritesWorkspaceDrop);
  favoritesElements.favoritesGrid?.addEventListener("dragend", handleFavoritesWorkspaceDragEnd);

  favoritesElements.favoriteNoteInput?.addEventListener("input", syncFavoriteNoteCount);
  favoritesElements.favoriteNoteSave?.addEventListener("click", saveFavoriteNote);
  favoritesElements.favoriteNoteCancel?.addEventListener("click", () => closeFavoriteNoteEditor());
  favoritesElements.favoriteNoteClose?.addEventListener("click", () => closeFavoriteNoteEditor());
  favoritesElements.favoriteNoteBackdrop?.addEventListener("click", () => closeFavoriteNoteEditor());
  favoritesElements.favoriteNoteOverlay?.addEventListener("keydown", (event) => trapFavoriteWorkspaceDialogFocus(event, favoritesElements.favoriteNoteOverlay, closeFavoriteNoteEditor));
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
/* ===== END SOURCE: src/js/35-favorites-workspace.js ===== */

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

/* ===== BEGIN SOURCE: src/js/52-viewer-session.js ===== */
/**
 * Source module: 52-viewer-session.js
 * Explicit viewer lifecycle and browser Fullscreen API state transitions.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

const VIEWER_PHASE_TRANSITIONS = Object.freeze({
  [VIEWER_PHASE_CLOSED]: new Set([VIEWER_PHASE_CLOSED, VIEWER_PHASE_OPENING]),
  [VIEWER_PHASE_OPENING]: new Set([VIEWER_PHASE_OPENING, VIEWER_PHASE_OPEN, VIEWER_PHASE_CLOSING, VIEWER_PHASE_CLOSED]),
  [VIEWER_PHASE_OPEN]: new Set([VIEWER_PHASE_OPEN, VIEWER_PHASE_OPENING, VIEWER_PHASE_CLOSING]),
  [VIEWER_PHASE_CLOSING]: new Set([VIEWER_PHASE_CLOSING, VIEWER_PHASE_CLOSED, VIEWER_PHASE_OPENING])
});

const VIEWER_FULLSCREEN_TRANSITIONS = Object.freeze({
  [VIEWER_FULLSCREEN_INACTIVE]: new Set([VIEWER_FULLSCREEN_INACTIVE, VIEWER_FULLSCREEN_ENTERING, VIEWER_FULLSCREEN_ACTIVE]),
  [VIEWER_FULLSCREEN_ENTERING]: new Set([VIEWER_FULLSCREEN_ENTERING, VIEWER_FULLSCREEN_ACTIVE, VIEWER_FULLSCREEN_INACTIVE, VIEWER_FULLSCREEN_EXITING]),
  [VIEWER_FULLSCREEN_ACTIVE]: new Set([VIEWER_FULLSCREEN_ACTIVE, VIEWER_FULLSCREEN_EXITING, VIEWER_FULLSCREEN_INACTIVE]),
  [VIEWER_FULLSCREEN_EXITING]: new Set([VIEWER_FULLSCREEN_EXITING, VIEWER_FULLSCREEN_INACTIVE, VIEWER_FULLSCREEN_ACTIVE, VIEWER_FULLSCREEN_ENTERING])
});

function transitionStatePhase({ current, next, transitions, label, reason }) {
  const allowed = transitions[current];
  if (!allowed?.has(next)) {
    console.warn(`Ignored invalid ${label} transition`, { current, next, reason });
    return false;
  }
  return true;
}

function transitionViewerPhase(nextPhase, reason = "unspecified") {
  const currentPhase = viewerState.viewerPhase || VIEWER_PHASE_CLOSED;
  if (!transitionStatePhase({
    current: currentPhase,
    next: nextPhase,
    transitions: VIEWER_PHASE_TRANSITIONS,
    label: "viewer phase",
    reason
  })) return false;

  viewerState.viewerPhase = nextPhase;
  viewerState.viewerPhaseReason = String(reason || "unspecified");
  if (document.body) document.body.dataset.viewerPhase = nextPhase;
  return true;
}

function isViewerSessionOpen() {
  return viewerState.viewerPhase === VIEWER_PHASE_OPENING || viewerState.viewerPhase === VIEWER_PHASE_OPEN;
}

function isViewerSessionVisible() {
  return isViewerSessionOpen() || viewerState.viewerPhase === VIEWER_PHASE_CLOSING;
}

function transitionViewerFullscreenPhase(nextPhase, reason = "unspecified") {
  const currentPhase = viewerState.viewerFullscreenPhase || VIEWER_FULLSCREEN_INACTIVE;
  if (!transitionStatePhase({
    current: currentPhase,
    next: nextPhase,
    transitions: VIEWER_FULLSCREEN_TRANSITIONS,
    label: "viewer fullscreen phase",
    reason
  })) return false;

  viewerState.viewerFullscreenPhase = nextPhase;
  viewerState.viewerFullscreenReason = String(reason || "unspecified");
  if (document.documentElement) document.documentElement.dataset.viewerFullscreenPhase = nextPhase;
  return true;
}

function getBrowserFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
}

function isBrowserFullscreenActive() {
  return Boolean(getBrowserFullscreenElement());
}

function isBrowserFullscreenSupported() {
  const root = document.documentElement;
  return Boolean(
    document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.mozFullScreenEnabled ||
    document.msFullscreenEnabled ||
    root?.requestFullscreen ||
    root?.webkitRequestFullscreen ||
    root?.mozRequestFullScreen ||
    root?.msRequestFullscreen
  );
}

function isViewerFullscreenPending() {
  return viewerState.viewerFullscreenPhase === VIEWER_FULLSCREEN_ENTERING || viewerState.viewerFullscreenPhase === VIEWER_FULLSCREEN_EXITING;
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
  const root = document.documentElement;
  const request = root?.requestFullscreen || root?.webkitRequestFullscreen || root?.mozRequestFullScreen || root?.msRequestFullscreen;
  if (!request) return Promise.reject(new Error("fullscreen-unsupported"));
  const result = request.call(root);
  return result && typeof result.then === "function" ? result : Promise.resolve();
}

function exitBrowserFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (!exit) return Promise.reject(new Error("fullscreen-exit-unsupported"));
  const result = exit.call(document);
  return result && typeof result.then === "function" ? result : Promise.resolve();
}

function getFullscreenToggleButtons() {
  return viewerElements.fullscreenToggle ? [viewerElements.fullscreenToggle] : [];
}

function syncFullscreenButtonUi() {
  const buttons = getFullscreenToggleButtons();
  if (!buttons.length) return;

  const isActive = isBrowserFullscreenActive();
  const isSupported = isBrowserFullscreenSupported();
  const isPending = isViewerFullscreenPending();
  const label = isActive ? "יציאה ממסך מלא" : "כניסה למסך מלא";

  buttons.forEach((button) => {
    button.dataset.fullscreenActive = isActive ? "true" : "false";
    button.dataset.fullscreenPhase = viewerState.viewerFullscreenPhase;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.setAttribute("aria-label", label);
    setTooltipText(button, label, { updateDefault: true });
    button.disabled = isPending || (!isSupported && !isActive);
    button.classList.toggle("hidden", !isSupported && !isActive);
  });
}

function handleBrowserFullscreenChange() {
  reconcileViewerFullscreenPhase("fullscreenchange");
  syncFullscreenButtonUi();
  if (isViewerSessionOpen()) {
    refreshLightboxLayoutForTopUiChange({ resetAutoSingleOrigin: false });
    showTopUiTemporarily(1400);
  }
}

async function toggleBrowserFullscreen(sourceButton = null) {
  const button = sourceButton || viewerElements.fullscreenToggle;
  if (isViewerFullscreenPending()) return;
  const wasActive = isBrowserFullscreenActive();

  transitionViewerFullscreenPhase(
    wasActive ? VIEWER_FULLSCREEN_EXITING : VIEWER_FULLSCREEN_ENTERING,
    wasActive ? "toggle-exit" : "toggle-enter"
  );
  syncFullscreenButtonUi();

  try {
    if (wasActive) {
      await exitBrowserFullscreen();
    } else {
      if (!isBrowserFullscreenSupported()) throw new Error("fullscreen-unsupported");
      await requestBrowserFullscreen();
    }
  } catch (error) {
    const message = wasActive ? "לא הצלחתי לצאת ממסך מלא" : "הדפדפן חסם מסך מלא";
    console.warn("Fullscreen toggle failed", error);
    flashActionButton(button, message);
  } finally {
    reconcileViewerFullscreenPhase("toggle-settled");
    syncFullscreenButtonUi();
    if (isViewerSessionOpen()) showTopUiTemporarily(1400);
  }
}

function returnToMainSiteFromLightbox(event = null) {
  event?.preventDefault?.();
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();
  navigateTo(homeDocumentUrl());
}
/* ===== END SOURCE: src/js/52-viewer-session.js ===== */

/* ===== BEGIN SOURCE: src/js/53-viewer-image.js ===== */
/**
 * Source module: 53-viewer-image.js
 * Viewer-only image swaps, resolution selection, and progressive upgrade lifecycle.
 */

function runViewerPageSwapAnimation(element, options = {}) {
  const { timerKey, root = element?.parentElement } = options;
  if (!element || !timerKey || !(timerKey in viewerState)) return;

  window.clearTimeout(viewerState[timerKey]);
  root?.querySelectorAll?.(".page-swap-enter")
    .forEach((animatedElement) => animatedElement.classList.remove("page-swap-enter"));

  // Restart the entrance animation only after the target page geometry and
  // positioning are ready, so the incoming single frame never animates from a
  // stale size or location.
  void element.offsetWidth;
  element.classList.add("page-swap-enter");
  viewerState[timerKey] = window.setTimeout(() => {
    element.classList.remove("page-swap-enter");
    viewerState[timerKey] = 0;
  }, VIEWER_PAGE_SWAP_CLEANUP_MS);
}

function runSingleImageSwapAnimation() {
  runViewerPageSwapAnimation(viewerElements.lightboxImageFrame, {
    timerKey: "singleImageAnimationTimer",
    root: viewerElements.stageCanvas
  });
}


function finishSingleImageSwap(token) {
  if (token !== viewerState.singleImageLoadToken) return;
  setViewerLoading(false);
  viewerElements.lightbox?.classList.remove("is-page-loading");
  viewerElements.lightboxImageFrame?.classList.remove("is-preparing-swap");
  syncImagePlaceholderState(viewerElements.lightboxImage);
  applyZoom();
}

function ensureSingleViewerResolutionImage() {
  if (viewerState.singleImageResolutionImage?.isConnected) return viewerState.singleImageResolutionImage;
  if (!viewerElements.lightboxImageFrame) return null;

  const image = new Image();
  image.className = "lightbox-image lightbox-image-resolution";
  image.alt = "";
  image.draggable = false;
  image.decoding = "async";
  image.fetchPriority = "high";
  image.setAttribute("aria-hidden", "true");
  image.dataset.placeholderIgnore = "true";
  viewerElements.lightboxImageFrame.append(image);
  viewerState.singleImageResolutionImage = image;
  return image;
}

function clearSingleViewerResolutionUpgrade() {
  viewerState.singleImageResolutionLoadToken += 1;
  viewerState.singleImageResolutionStop?.();
  viewerState.singleImageResolutionStop = null;
  viewerState.singleImageResolutionTargetSrc = "";
  viewerState.singleImageResolutionTargetTier = "";
  viewerState.singleImageResolutionReady = false;
  viewerState.singleImageResolutionVisible = false;
  viewerState.singleImageResolutionCommitPending = false;
  viewerState.singleImageResolutionRetainedForSwap = false;
  viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading", "is-resolution-upgrade-ready");

  const image = viewerState.singleImageResolutionImage;
  if (!image) return;
  image.removeAttribute("src");
  delete image.dataset.resolutionRetainedForSwap;
  delete image.dataset.logicalSrc;
  delete image.dataset.loadedTier;
  delete image.dataset.loadedQuality;
  delete image.dataset.imageLoadPending;
}

function retainSingleViewerResolutionLayerForSwap() {
  const image = viewerState.singleImageResolutionImage;
  if (viewerState.singleImageResolutionRetainedForSwap) {
    return Boolean(image?.isConnected && image.naturalWidth > 0);
  }
  if (
    !viewerState.singleImageResolutionVisible
    || !viewerState.singleImageResolutionReady
    || !image?.isConnected
    || image.naturalWidth <= 0
  ) {
    return false;
  }

  // Freeze the already-decoded high-resolution layer as the visual front buffer.
  // Its ownership metadata is retired immediately, so it cannot be mistaken for
  // the target page, but its pixels remain painted until the next page is decoded.
  viewerState.singleImageResolutionLoadToken += 1;
  viewerState.singleImageResolutionStop?.();
  viewerState.singleImageResolutionStop = null;
  viewerState.singleImageResolutionTargetSrc = "";
  viewerState.singleImageResolutionTargetTier = "";
  viewerState.singleImageResolutionReady = false;
  viewerState.singleImageResolutionVisible = false;
  viewerState.singleImageResolutionCommitPending = false;
  viewerState.singleImageResolutionRetainedForSwap = true;
  image.dataset.resolutionRetainedForSwap = "true";
  viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading");
  viewerElements.lightboxImageFrame?.classList.add("is-resolution-upgrade-ready");
  return true;
}

function releaseSingleViewerRetainedResolutionLayer() {
  if (!viewerState.singleImageResolutionRetainedForSwap) return false;
  viewerState.singleImageResolutionRetainedForSwap = false;
  viewerElements.lightboxImageFrame?.classList.remove("is-resolution-upgrade-ready");

  const image = viewerState.singleImageResolutionImage;
  if (!image) return true;
  image.removeAttribute("src");
  delete image.dataset.resolutionRetainedForSwap;
  delete image.dataset.logicalSrc;
  delete image.dataset.loadedTier;
  delete image.dataset.loadedQuality;
  delete image.dataset.imageLoadPending;
  return true;
}

function activeSingleViewerImageLogicalSrc() {
  if (viewerState.singleImageResolutionVisible && viewerState.singleImageResolutionTargetSrc) {
    return viewerState.singleImageResolutionTargetSrc;
  }
  return normalizeCatalogImageUrl(viewerElements.lightboxImage?.dataset.logicalSrc || viewerElements.lightboxImage?.getAttribute("src") || "");
}

function activeSingleViewerImageTier() {
  if (viewerState.singleImageResolutionRetainedForSwap) return CATALOG_IMAGE_TIER_FULL;
  if (viewerState.singleImageResolutionVisible && viewerState.singleImageResolutionTargetTier) {
    return viewerState.singleImageResolutionTargetTier;
  }
  return String(viewerElements.lightboxImage?.dataset.loadedTier || "");
}

function shouldWarmSingleViewerFullResolution(previousZoom = viewerState.zoom) {
  if (isSaveDataEnabled()) return false;
  const effectiveType = networkEffectiveType();
  if (effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g") return false;

  const zoom = Number(viewerState.zoom) || AUTO_VIEWER_ZOOM;
  const previous = Number(previousZoom) || AUTO_VIEWER_ZOOM;
  return zoom > AUTO_VIEWER_ZOOM + VIEWER_FULL_RESOLUTION_WARMUP_ZOOM_EPSILON
    && zoom > previous + 0.001;
}

function commitSingleViewerResolutionUpgrade(token = viewerState.singleImageResolutionLoadToken) {
  if (token !== viewerState.singleImageResolutionLoadToken || !viewerState.singleImageResolutionReady) {
    viewerState.singleImageResolutionCommitPending = true;
    return false;
  }

  viewerState.singleImageResolutionCommitPending = false;
  viewerState.singleImageResolutionVisible = true;
  requestAnimationFrame(() => {
    if (token !== viewerState.singleImageResolutionLoadToken || !viewerState.singleImageResolutionVisible) return;
    viewerElements.lightboxImageFrame?.classList.add("is-resolution-upgrade-ready");
  });
  return true;
}

function prepareSingleViewerResolutionUpgrade(catalog, page, request, options = {}) {
  if (!catalog || !request?.primarySrc || request.primaryTier !== CATALOG_IMAGE_TIER_FULL) return false;
  const targetSrc = normalizeCatalogImageUrl(request.primarySrc);
  if (!targetSrc) return false;

  const sameTarget = viewerState.singleImageResolutionTargetSrc === targetSrc
    && viewerState.singleImageResolutionTargetTier === request.primaryTier;
  if (sameTarget) {
    if (options.commit) {
      viewerState.singleImageResolutionCommitPending = true;
      if (viewerState.singleImageResolutionReady) commitSingleViewerResolutionUpgrade();
    }
    return true;
  }

  clearSingleViewerResolutionUpgrade();
  const image = ensureSingleViewerResolutionImage();
  if (!image) return false;

  const token = ++viewerState.singleImageResolutionLoadToken;
  viewerState.singleImageResolutionTargetSrc = targetSrc;
  viewerState.singleImageResolutionTargetTier = request.primaryTier;
  viewerState.singleImageResolutionCommitPending = Boolean(options.commit);
  viewerElements.lightboxImageFrame?.classList.add("is-resolution-loading");

  viewerState.singleImageResolutionStop = loadCatalogImageWithRecovery(image, {
    primarySrc: targetSrc,
    primaryTier: request.primaryTier,
    isCurrent: () => (
      token === viewerState.singleImageResolutionLoadToken
      && isViewerSessionOpen()
      && navigationState.catalog === catalog
      && navigationState.page === page
      && viewerState.singleImageResolutionTargetSrc === targetSrc
    ),
    telemetryDetail: "viewer-resolution-upgrade",
    onSuccess: (candidate) => {
      const finishReady = () => {
        if (token !== viewerState.singleImageResolutionLoadToken || !image.naturalWidth) return;
        viewerState.singleImageResolutionStop = null;
        viewerState.singleImageResolutionReady = true;
        image.dataset.logicalSrc = targetSrc;
        image.dataset.loadedTier = candidate.tier || request.primaryTier;
        image.dataset.loadedQuality = image.dataset.loadedTier;
        viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading");

        const preferredTier = preferredViewerImageTier(catalog, page);
        if (viewerState.singleImageResolutionCommitPending || preferredTier === CATALOG_IMAGE_TIER_FULL) {
          commitSingleViewerResolutionUpgrade(token);
        }
      };

      if (typeof image.decode === "function") {
        image.decode().catch(() => {}).then(finishReady);
      } else {
        finishReady();
      }
    },
    onExhausted: () => {
      if (token !== viewerState.singleImageResolutionLoadToken) return;
      viewerState.singleImageResolutionStop = null;
      viewerState.singleImageResolutionTargetSrc = "";
      viewerState.singleImageResolutionTargetTier = "";
      viewerState.singleImageResolutionReady = false;
      viewerState.singleImageResolutionVisible = false;
      viewerState.singleImageResolutionCommitPending = false;
      viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading", "is-resolution-upgrade-ready");
      image.removeAttribute("src");
    }
  });
  return true;
}

function setSingleViewerImageFeedback(mode = "", message = "") {
  const visible = Boolean(mode && message);
  const isError = mode === "error";
  viewerElements.viewerImageFeedback?.classList.toggle("hidden", !visible);
  if (viewerElements.viewerImageFeedback) {
    viewerElements.viewerImageFeedback.dataset.mode = visible ? mode : "";
    viewerElements.viewerImageFeedback.dataset.state = visible ? (isError ? "error" : "warning") : "";
    viewerElements.viewerImageFeedback.setAttribute("role", isError ? "alert" : "status");
    viewerElements.viewerImageFeedback.setAttribute("aria-live", isError ? "assertive" : "polite");
  }
  if (viewerElements.viewerImageFeedbackText) viewerElements.viewerImageFeedbackText.textContent = message;
  viewerElements.viewerImageRetry?.classList.toggle("hidden", !visible);
  viewerElements.lightboxImageFrame?.classList.toggle("image-fallback", mode === "fallback");
  if (mode !== "error") viewerElements.lightboxImageFrame?.classList.remove("image-terminal-error");
}

function showSingleLightboxImage(catalog, page, src, options = {}) {
  if (!viewerElements.lightboxImage || !catalog) return;

  const token = ++viewerState.singleImageLoadToken;
  const image = viewerElements.lightboxImage;
  const request = options.imageRequest || viewerPageImageRequest(catalog, page, {
    forceFull: Boolean(options.forceFull)
  });
  const primarySrc = normalizeCatalogImageUrl(src || request.primarySrc);
  if (!primarySrc) return;
  const currentLogicalSrc = image.dataset.logicalSrc || normalizeCatalogImageUrl(image.getAttribute("src") || "");
  if (!options.forceRefresh && currentLogicalSrc === primarySrc && image.complete && image.naturalWidth && image.dataset.loadedQuality !== "fallback") {
    applyLightboxFrameGeometry(image.naturalWidth, image.naturalHeight, { updateFitScale: false });
    setSingleViewerImageFeedback();
    finishSingleImageSwap(token);
    return;
  }

  const preserveCurrentImage = Boolean(
    options.preserveCurrentImage
    && image.complete
    && image.naturalWidth > 0
    && !viewerElements.lightboxImageFrame?.classList.contains("image-terminal-error")
  );
  const retainedResolutionLayer = preserveCurrentImage
    && retainSingleViewerResolutionLayerForSwap();
  if (!retainedResolutionLayer) clearSingleViewerResolutionUpgrade();
  setViewerLoading(true);
  viewerElements.lightboxImageFrame?.setAttribute("aria-busy", "true");
  setSingleViewerImageFeedback();
  viewerElements.lightbox?.classList.add("is-page-loading");
  viewerElements.lightboxImageFrame?.classList.toggle("is-preparing-swap", !preserveCurrentImage);
  viewerElements.lightboxImageFrame?.classList.remove("image-terminal-error");
  if (preserveCurrentImage) {
    // Keep the decoded current page painted while the browser's pending image
    // request is replaced. The frame receives only a slight loading dim instead
    // of exposing the viewer background between pages.
    image.dataset.placeholderIgnore = "true";
  } else {
    prepareImagePlaceholder(image);
  }
  image.alt = `${catalog.title} - עמוד ${page}`;
  applyCatalogImageDimensions(image, catalog, page);
  image.decoding = "async";
  image.fetchPriority = "high";
  image.dataset.logicalSrc = primarySrc;

  const requestIsCurrent = () => (
    token === viewerState.singleImageLoadToken
    && isViewerSessionOpen()
    && navigationState.catalog === catalog
    && navigationState.page === page
  );
  const commitImageRequest = () => {
    if (!requestIsCurrent()) return;
    loadCatalogImageWithRecovery(image, {
      primarySrc,
      primaryTier: request.primaryTier,
      fallbackCandidates: request.fallbackCandidates,
      forceRefresh: Boolean(options.forceRefresh),
      isCurrent: requestIsCurrent,
      telemetryDetail: "viewer-single",
      onSuccess: (candidate) => {
        delete image.dataset.placeholderIgnore;
        const loadedTier = candidate.tier || request.primaryTier || CATALOG_IMAGE_TIER_FULL;
        const degraded = catalogImageTierRank(loadedTier) < catalogImageTierRank(request.primaryTier);
        image.dataset.loadedTier = loadedTier;
        image.dataset.loadedQuality = degraded ? "fallback" : loadedTier;
        if (image.naturalWidth && image.naturalHeight) {
          applyLightboxFrameGeometry(image.naturalWidth, image.naturalHeight, { updateFitScale: false });
        }
        releaseSingleViewerRetainedResolutionLayer();
        finishSingleImageSwap(token);
        viewerElements.lightboxImageFrame?.setAttribute("aria-busy", "false");
        runSingleImageSwapAnimation();
        if (degraded) {
          setSingleViewerImageFeedback("fallback", "שכבת התמונה המועדפת לא נטענה. מוצגת חלופה מוקטנת; אפשר לנסות שוב.");
        } else {
          setSingleViewerImageFeedback();
        }
      },
      onExhausted: () => {
        delete image.dataset.placeholderIgnore;
        delete image.dataset.loadedTier;
        delete image.dataset.loadedQuality;
        releaseSingleViewerRetainedResolutionLayer();
        finishSingleImageSwap(token);
        viewerElements.lightboxImageFrame?.setAttribute("aria-busy", "false");
        viewerElements.lightboxImageFrame?.classList.add("image-terminal-error");
        setSingleViewerImageFeedback("error", "התמונה לא הצליחה להיטען. אפשר לנסות שוב.");
      }
    });
  };

  if (preserveCurrentImage) {
    // Decode the target in a detached image first. Only then replace the visible
    // image source, so even browsers that clear an <img> during a src change can
    // reuse a decoded resource instead of exposing the viewer background.
    prepareCatalogImage(primarySrc, { priority: "high", detail: "viewer-page-stage" })
      .catch(() => null)
      .then(commitImageRequest);
  } else {
    commitImageRequest();
  }
}

function renderedViewerPagePhysicalLongSide(catalog, page, zoom = viewerState.zoom) {
  const frame = viewerElements.lightboxImageFrame || null;
  const rect = frame?.getBoundingClientRect?.();
  const dpr = Math.max(1, Number(window.devicePixelRatio) || 1);
  if (rect?.width && rect?.height) return Math.max(rect.width, rect.height) * dpr;

  const size = pageSize(catalog, page);
  const stageWidth = Math.max(1, viewerElements.stageCanvas?.clientWidth || window.innerWidth || 1);
  const stageHeight = Math.max(1, viewerElements.stageCanvas?.clientHeight || window.innerHeight || 1);
  if (!size) return Math.max(stageWidth, stageHeight) * dpr;

  const fitMode = String(viewerState.imageFitMode || VIEWER_FIT_HEIGHT);
  const scale = fitMode === VIEWER_FIT_WIDTH
    ? stageWidth / size.width
    : fitMode === VIEWER_FIT_HEIGHT
      ? stageHeight / size.height
      : Math.min(stageWidth / size.width, stageHeight / size.height);
  return Math.max(size.width, size.height) * Math.max(0.01, scale) * dpr * Math.max(1, Number(zoom) || 1);
}

function preferredViewerImageTier(catalog, page, options = {}) {
  if (options.forceFull || !catalogSupportsImageTier(catalog, CATALOG_IMAGE_TIER_MEDIUM)) {
    return CATALOG_IMAGE_TIER_FULL;
  }
  if (options.preferMedium) return CATALOG_IMAGE_TIER_MEDIUM;

  const zoom = Number.isFinite(Number(options.zoom)) ? Number(options.zoom) : Number(viewerState.zoom || 1);
  if (zoom >= VIEWER_FULL_RESOLUTION_ZOOM_THRESHOLD) return CATALOG_IMAGE_TIER_FULL;

  if (!isSaveDataEnabled()) {
    const mediumMaxSide = catalogImageTierMaxSide(catalog, CATALOG_IMAGE_TIER_MEDIUM);
    const requiredPixels = renderedViewerPagePhysicalLongSide(catalog, page, zoom);
    if (requiredPixels > mediumMaxSide * VIEWER_MEDIUM_OVERSUBSCRIPTION_RATIO) {
      return CATALOG_IMAGE_TIER_FULL;
    }
  }
  return CATALOG_IMAGE_TIER_MEDIUM;
}

function viewerPageImageRequest(catalog, page, options = {}) {
  const primaryTier = preferredViewerImageTier(catalog, page, options);
  const tierOrder = primaryTier === CATALOG_IMAGE_TIER_FULL
    ? [CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_MEDIUM, CATALOG_IMAGE_TIER_THUMB]
    : [CATALOG_IMAGE_TIER_MEDIUM, CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_THUMB];
  const candidates = tierOrder
    .filter((tier) => catalogSupportsImageTier(catalog, tier))
    .map((tier) => ({ tier, src: catalogPageImageSrc(catalog, page, tier) }))
    .filter((candidate) => candidate.src);
  const primary = candidates[0] || { tier: CATALOG_IMAGE_TIER_FULL, src: pageSrc(catalog, page) };
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
  if (tier === CATALOG_IMAGE_TIER_FULL) return 3;
  if (tier === CATALOG_IMAGE_TIER_MEDIUM) return 2;
  if (tier === CATALOG_IMAGE_TIER_THUMB) return 1;
  return 0;
}

function refreshSingleViewerImageResolution(options = {}) {
  if (!isViewerSessionOpen() || !navigationState.catalog || !viewerElements.lightboxImage) return false;
  if (viewerState.singleImageResolutionRetainedForSwap) return false;
  const request = viewerPageImageRequest(navigationState.catalog, navigationState.page, options);

  if (options.warmFull && request.primaryTier !== CATALOG_IMAGE_TIER_FULL) {
    const fullRequest = viewerPageImageRequest(navigationState.catalog, navigationState.page, { forceFull: true });
    prepareSingleViewerResolutionUpgrade(navigationState.catalog, navigationState.page, fullRequest, { commit: false });
  }

  const currentSrc = activeSingleViewerImageLogicalSrc();
  const nextSrc = normalizeCatalogImageUrl(request.primarySrc);
  const loadedTier = activeSingleViewerImageTier();
  if (currentSrc === nextSrc) return Boolean(options.warmFull);
  if (catalogImageTierRank(loadedTier) > catalogImageTierRank(request.primaryTier)) return false;

  if (request.primaryTier === CATALOG_IMAGE_TIER_FULL) {
    return prepareSingleViewerResolutionUpgrade(navigationState.catalog, navigationState.page, request, { commit: true });
  }

  if (!viewerState.singleImageResolutionVisible && !viewerState.singleImageResolutionReady) {
    clearSingleViewerResolutionUpgrade();
  }
  return false;
}

function preloadNeighbors() {
  if (!navigationState.catalog) return;
  const preferredTier = preferredViewerImageTier(navigationState.catalog, navigationState.page);
  const preloadFull = preferredTier === CATALOG_IMAGE_TIER_FULL;
  const radius = preloadFull ? 1 : catalogNeighborPreloadRadius();
  const requestOptions = preloadFull ? { forceFull: true } : { preferMedium: true };
  if (radius < 1) return;

  if (isFavoritesLightboxMode()) {
    const entries = getFavoriteEntries();
    Array.from({ length: radius * 2 }, (_unused, index) => (
      index < radius
        ? favoritesState.favoritesViewerIndex - (radius - index)
        : favoritesState.favoritesViewerIndex + (index - radius + 1)
    ))
      .filter((index) => index >= 0 && index < entries.length)
      .forEach((index) => {
        const entry = entries[index];
        prepareCatalogImage(viewerPageSrc(entry.catalog, entry.page, requestOptions), { priority: "low" }).catch(() => {});
      });
    return;
  }

  Array.from({ length: radius * 2 }, (_unused, index) => (
    index < radius
      ? navigationState.page - (radius - index)
      : navigationState.page + (index - radius + 1)
  ))
    .filter((page) => page >= 1 && page <= navigationState.catalog.pages)
    .forEach((page) => {
      prepareCatalogImage(viewerPageSrc(navigationState.catalog, page, requestOptions), { priority: "low" }).catch(() => {});
    });
}
/* ===== END SOURCE: src/js/53-viewer-image.js ===== */

/* ===== BEGIN SOURCE: src/js/54-viewer-geometry.js ===== */
/**
 * Source module: 54-viewer-geometry.js
 * Viewer fit geometry, zoom, pan bounds, relative-position transfer, and edge-turn overscroll.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function updateHash() {
  if (!window.history?.replaceState) return;

  if (isAppPage("catalog") && navigationState.catalog) {
    history.replaceState(history.state, "", catalogDocumentUrl(navigationState.catalog.id));
  } else if (isAppPage("viewer") && navigationState.catalog) {
    history.replaceState(history.state, "", viewerDocumentUrl(navigationState.catalog.id, navigationState.page, {
      source: isFavoritesLightboxMode() ? LIGHTBOX_SOURCE_FAVORITES : LIGHTBOX_SOURCE_CATALOG
    }));
  }

  updateDocumentMetadata(navigationState.catalog);
}

function getPointerList() {
  return Array.from(viewerState.pointers.values());
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

function isAutoViewerZoom(value = viewerState.zoom) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric - AUTO_VIEWER_ZOOM) <= 0.001;
}

function getSafeViewerZoom(value = viewerState.zoom) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return AUTO_VIEWER_ZOOM;
  return clampValue(numeric, getMinimumViewerZoom(), MAX_VIEWER_ZOOM);
}

function clampViewerZoom(value) {
  return getSafeViewerZoom(value);
}

function normalizeViewerFitMode(fitMode) {
  return fitMode === VIEWER_FIT_WIDTH ? VIEWER_FIT_WIDTH : VIEWER_FIT_HEIGHT;
}

function normalizeViewerFitModeSource(source) {
  return source === VIEWER_FIT_SOURCE_AUTO
    ? VIEWER_FIT_SOURCE_AUTO
    : VIEWER_FIT_SOURCE_MANUAL;
}

function viewerUsesAutomaticFitMode() {
  return normalizeViewerFitModeSource(viewerState.imageFitModeSource) === VIEWER_FIT_SOURCE_AUTO;
}

function getViewerFitViewportSize() {
  const stageWidth = Number(viewerElements.stageCanvas?.clientWidth) || 0;
  const stageHeight = Number(viewerElements.stageCanvas?.clientHeight) || 0;
  if (stageWidth > 0 && stageHeight > 0) {
    return { width: stageWidth, height: stageHeight };
  }

  const visualWidth = Number(window.visualViewport?.width) || 0;
  const visualHeight = Number(window.visualViewport?.height) || 0;
  if (visualWidth > 0 && visualHeight > 0) {
    return { width: visualWidth, height: visualHeight };
  }

  return {
    width: Number(window.innerWidth) || Number(document.documentElement?.clientWidth) || 0,
    height: Number(window.innerHeight) || Number(document.documentElement?.clientHeight) || 0
  };
}

function getAutomaticViewerFitMode() {
  const viewport = getViewerFitViewportSize();
  return viewport.height > viewport.width ? VIEWER_FIT_WIDTH : VIEWER_FIT_HEIGHT;
}

function getActiveSingleImageNaturalSize() {
  const configuredSize = navigationState.catalog ? pageSize(navigationState.catalog, navigationState.page) : null;
  if (configuredSize) return configuredSize;

  const image = viewerElements.lightboxImage;
  if (image?.naturalWidth && image?.naturalHeight) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }

  return null;
}

function getSingleImageDisplayMetrics() {
  const naturalSize = getActiveSingleImageNaturalSize();
  const stage = viewerElements.stageCanvas;
  if (!naturalSize || !stage) return null;

  const safeZoom = getSafeViewerZoom();
  const width = naturalSize.width * viewerState.fitScale * safeZoom;
  const height = naturalSize.height * viewerState.fitScale * safeZoom;
  return {
    width,
    height,
    overflowX: Math.max(0, (width - stage.clientWidth) / 2),
    overflowY: Math.max(0, (height - stage.clientHeight) / 2)
  };
}

function singleImageCanPan() {
  const metrics = getSingleImageDisplayMetrics();
  return Boolean(metrics && (metrics.overflowX > 1 || metrics.overflowY > 1));
}

function viewerCanPan() {
  return singleImageCanPan();
}

function singleViewerUsesBoundaryPan() {
  return getSafeViewerZoom() > AUTO_VIEWER_ZOOM + 0.001 || singleImageCanPan();
}

function getViewerPageTurnBuffer(axis = "y") {
  const stage = viewerElements.stageCanvas;
  const viewportSize = axis === "x"
    ? (stage?.clientWidth || window.innerWidth || 0)
    : (stage?.clientHeight || window.innerHeight || 0);
  if (!Number.isFinite(viewportSize) || viewportSize <= 0) {
    return VIEWER_PAGE_TURN_BUFFER_MIN_PX;
  }

  return clampValue(
    viewportSize * VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO,
    VIEWER_PAGE_TURN_BUFFER_MIN_PX,
    VIEWER_PAGE_TURN_BUFFER_MAX_PX
  );
}

function getSinglePanBounds(options = {}) {
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return null;

  const allowPageTurnBuffer = options.allowPageTurnBuffer !== false && singleViewerUsesBoundaryPan();
  const bufferX = allowPageTurnBuffer ? getViewerPageTurnBuffer("x") : 0;
  const bufferY = allowPageTurnBuffer ? getViewerPageTurnBuffer("y") : 0;
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
  const bounds = getSinglePanBounds(options);
  if (!bounds) return null;

  viewerState.panX = bounds.limitX <= 1 ? 0 : clampValue(viewerState.panX, -bounds.limitX, bounds.limitX);
  viewerState.panY = bounds.limitY <= 1 ? 0 : clampValue(viewerState.panY, -bounds.limitY, bounds.limitY);
  return bounds;
}

function clearSingleImagePendingPosition() {
  viewerState.singleImageFitOriginPending = false;
  viewerState.singleImagePendingRelativePosition = null;
  viewerState.singleImagePendingPageTurnOrigin = null;
}

function captureSingleImageRelativePosition() {
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return { xRatio: 0, yRatio: 0 };

  return {
    xRatio: metrics.overflowX > 1
      ? clampValue(viewerState.panX / metrics.overflowX, -1, 1)
      : 0,
    yRatio: metrics.overflowY > 1
      ? clampValue(viewerState.panY / metrics.overflowY, -1, 1)
      : 0
  };
}

function queueSingleImageRelativePosition(page, position = null) {
  const nextPage = Number.parseInt(page, 10);
  if (!Number.isFinite(nextPage)) return;
  const normalized = position || captureSingleImageRelativePosition();
  viewerState.singleImageFitOriginPending = false;
  viewerState.singleImagePendingPageTurnOrigin = null;
  viewerState.singleImagePendingRelativePosition = {
    page: nextPage,
    xRatio: clampValue(Number(normalized.xRatio) || 0, -1, 1),
    yRatio: clampValue(Number(normalized.yRatio) || 0, -1, 1)
  };
}

function queueSingleImagePageTurnOrigin(page, direction, axis = "y") {
  const nextPage = Number.parseInt(page, 10);
  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (!Number.isFinite(nextPage) || !step) return;

  viewerState.singleImageFitOriginPending = false;
  viewerState.singleImagePendingRelativePosition = null;
  viewerState.singleImagePendingPageTurnOrigin = {
    page: nextPage,
    direction: step,
    axis: axis === "x" ? "x" : "y"
  };
  viewerState.panX = 0;
  viewerState.panY = 0;
}

function resetImagePosition(options = {}) {
  viewerState.panX = 0;
  viewerState.panY = 0;
  clearSingleImagePendingPosition();
  if (options.queueSingleFitOrigin) {
    viewerState.singleImageFitOriginPending = true;
  }
}

function applyPendingSingleImagePosition() {
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return false;

  const pageTurnOrigin = viewerState.singleImagePendingPageTurnOrigin;
  if (pageTurnOrigin?.page === navigationState.page) {
    // Edge-driven navigation behaves like continuous reading: moving forward
    // opens the target at its top, while moving backward enters from its bottom.
    // Horizontal page turns still use the same vertical reading origin and keep
    // the image centered horizontally.
    viewerState.panX = 0;
    viewerState.panY = pageTurnOrigin.direction > 0 ? metrics.overflowY : -metrics.overflowY;
    viewerState.singleImagePendingPageTurnOrigin = null;
    viewerState.singleImagePendingRelativePosition = null;
    viewerState.singleImageFitOriginPending = false;
    return true;
  }

  const relativePosition = viewerState.singleImagePendingRelativePosition;
  if (relativePosition?.page === navigationState.page) {
    viewerState.panX = metrics.overflowX * relativePosition.xRatio;
    viewerState.panY = metrics.overflowY * relativePosition.yRatio;
    viewerState.singleImagePendingRelativePosition = null;
    viewerState.singleImagePendingPageTurnOrigin = null;
    viewerState.singleImageFitOriginPending = false;
    return true;
  }

  if (!viewerState.singleImageFitOriginPending) return false;

  viewerState.panX = 0;
  viewerState.panY = 0;
  if (viewerState.imageFitMode === VIEWER_FIT_WIDTH && metrics.overflowY > 1) {
    viewerState.panY = metrics.overflowY;
  }
  viewerState.singleImageFitOriginPending = false;
  viewerState.singleImagePendingRelativePosition = null;
  viewerState.singleImagePendingPageTurnOrigin = null;
  return true;
}

function shouldPreserveSingleManualPosition(options = {}) {
  return (
    options.keepZoom !== false
    && options.resetZoom !== true
    && options.resetPosition !== true
    && !isAutoViewerZoom()
  );
}

function singleImageFitLayout(naturalWidth, naturalHeight) {
  const stage = viewerElements.stageCanvas;
  const width = Number(naturalWidth);
  const height = Number(naturalHeight);
  if (!stage || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

  const availableWidth = Math.max(260, stage.clientWidth - 18);
  const availableHeight = Math.max(260, stage.clientHeight - 18);
  const widthScale = availableWidth / width;
  const heightScale = availableHeight / height;
  const fitScale = viewerState.imageFitMode === VIEWER_FIT_WIDTH ? widthScale : heightScale;
  return {
    fitScale,
    width: Math.max(220, Math.round(width * fitScale)),
    height: Math.max(160, Math.round(height * fitScale))
  };
}

function applyLightboxFrameGeometry(naturalWidth, naturalHeight, options = {}) {
  const frame = viewerElements.lightboxImageFrame;
  const image = viewerElements.lightboxImage;
  const layout = singleImageFitLayout(naturalWidth, naturalHeight);
  if (!frame || !image || !layout) return null;

  if (options.updateFitScale !== false) viewerState.fitScale = layout.fitScale;
  const nextWidth = `${layout.width}px`;
  const nextHeight = `${layout.height}px`;
  const nextAspectRatio = `${naturalWidth} / ${naturalHeight}`;
  if (frame.style.width !== nextWidth) frame.style.width = nextWidth;
  if (frame.style.height !== nextHeight) frame.style.height = nextHeight;
  if (frame.style.aspectRatio !== nextAspectRatio) frame.style.aspectRatio = nextAspectRatio;
  if (image.style.width !== "100%") image.style.width = "100%";
  if (image.style.height !== "100%") image.style.height = "100%";
  return layout;
}

function primeLightboxFrameForCatalogPage(catalog, page) {
  const size = pageSize(catalog, page);
  if (!size) return false;
  return Boolean(applyLightboxFrameGeometry(size.width, size.height, { updateFitScale: true }));
}

function applySingleZoom() {
  const frame = viewerElements.lightboxImageFrame;
  const naturalSize = getActiveSingleImageNaturalSize();
  if (!naturalSize || !frame) return;

  applyLightboxFrameGeometry(naturalSize.width, naturalSize.height);
  if (!applyPendingSingleImagePosition() && isAutoViewerZoom() && !singleImageCanPan()) {
    viewerState.panX = 0;
    viewerState.panY = 0;
  }

  clampSinglePan();
  frame.style.setProperty("--single-pan-x", `${viewerState.panX}px`);
  frame.style.setProperty("--single-pan-y", `${viewerState.panY}px`);
  frame.style.setProperty("--single-zoom", String(viewerState.zoom));
  frame.style.transform = `translate(-50%, -50%) translate(${viewerState.panX}px, ${viewerState.panY}px) scale(${viewerState.zoom})`;
}

function applyZoom() {
  applySingleZoom();
  const isManualZoom = !isAutoViewerZoom();
  viewerElements.lightbox?.classList.toggle("is-zoomed", isManualZoom || viewerCanPan());
  syncViewerAutoZoomButtonUi();
}

function consumeSingleViewerPanInput(deltaX = 0, deltaY = 0) {
  if (!singleViewerUsesBoundaryPan()) return null;

  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const previousPanX = viewerState.panX;
  const previousPanY = viewerState.panY;

  viewerState.panX = previousPanX - safeDeltaX;
  viewerState.panY = previousPanY - safeDeltaY;
  const bounds = clampSinglePan({ allowPageTurnBuffer: true });
  if (!bounds) return null;

  const moved = Math.abs(viewerState.panX - previousPanX) > 0.01 || Math.abs(viewerState.panY - previousPanY) > 0.01;
  if (moved) {
    clearSingleImagePendingPosition();
    applySingleZoom();
  }

  const consumedDeltaX = previousPanX - viewerState.panX;
  const consumedDeltaY = previousPanY - viewerState.panY;
  return {
    moved,
    bounds,
    remainingDeltaX: safeDeltaX - consumedDeltaX,
    remainingDeltaY: safeDeltaY - consumedDeltaY
  };
}

function getDefaultZoomFocalPoint() {
  const surface = viewerElements.stageCanvas;
  const rect = surface?.getBoundingClientRect?.();
  if (!rect) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function adjustSinglePanForZoom(nextZoom, focal) {
  const stage = viewerElements.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !focal) return;

  const currentZoom = getSafeViewerZoom();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const contentX = (focal.x - centerX - viewerState.panX) / currentZoom;
  const contentY = (focal.y - centerY - viewerState.panY) / currentZoom;

  viewerState.panX = focal.x - centerX - contentX * nextZoom;
  viewerState.panY = focal.y - centerY - contentY * nextZoom;
}

function getSingleContentPointFromClientPoint(clientX, clientY) {
  const stage = viewerElements.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  const currentZoom = getSafeViewerZoom();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return {
    x: (clientX - centerX - viewerState.panX) / currentZoom,
    y: (clientY - centerY - viewerState.panY) / currentZoom
  };
}

function finalizeSingleViewerZoomChange(previousZoom, options = {}) {
  const { showUi = true } = options;
  applyZoom();

  if (Math.abs(getSafeViewerZoom(viewerState.zoom) - getSafeViewerZoom(previousZoom)) > 0.001) {
    showViewerZoomIndicator(viewerState.zoom);
  }
  refreshSingleViewerImageResolution({
    warmFull: shouldWarmSingleViewerFullResolution(previousZoom)
  });
  if (showUi) showTopUiTemporarily(1600);
}

function zoomSingleContentPointToViewportCenter(point, nextZoom) {
  if (!point) return false;
  const previousZoom = viewerState.zoom;
  const zoom = clampViewerZoom(nextZoom);
  if (isAutoViewerZoom(zoom)) {
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
    return true;
  }

  clearSingleImagePendingPosition();
  viewerState.zoom = zoom;
  viewerState.panX = -point.x * zoom;
  viewerState.panY = -point.y * zoom;
  finalizeSingleViewerZoomChange(previousZoom, { showUi: false });
  return true;
}

function zoomClientPointToViewportCenter(nextZoom, clientX, clientY) {
  return zoomSingleContentPointToViewportCenter(
    getSingleContentPointFromClientPoint(clientX, clientY),
    nextZoom
  );
}

function setZoom(nextZoom, options = {}) {
  const {
    showUi = true,
    focalClientX = null,
    focalClientY = null
  } = options;
  const previousZoom = viewerState.zoom;
  const zoom = clampViewerZoom(nextZoom);
  const hasFocal = Number.isFinite(focalClientX) && Number.isFinite(focalClientY);
  const focal = hasFocal
    ? { x: focalClientX, y: focalClientY }
    : getDefaultZoomFocalPoint();

  if (isAutoViewerZoom(zoom)) {
    viewerState.zoom = AUTO_VIEWER_ZOOM;
    resetImagePosition({ queueSingleFitOrigin: true });
  } else {
    clearSingleImagePendingPosition();
    if (focal && Math.abs(zoom - previousZoom) > 0.001) {
      adjustSinglePanForZoom(zoom, focal);
    }
    viewerState.zoom = zoom;
  }
  finalizeSingleViewerZoomChange(previousZoom, { showUi });
}

function toggleZoomAtPoint(clientX, clientY) {
  if (viewerState.zoom > 1.01) {
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
    return;
  }

  if (!zoomClientPointToViewportCenter(2, clientX, clientY)) {
    setZoom(2, { showUi: false, focalClientX: clientX, focalClientY: clientY });
  }
}
/* ===== END SOURCE: src/js/54-viewer-geometry.js ===== */

/* ===== BEGIN SOURCE: src/js/56-viewer-shell.js ===== */
/**
 * Source module: 56-viewer-shell.js
 * Viewer chrome, top controls, page rail, progress indicators, and fit-mode UI.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function showTopUiTemporarily(delay = 2200) {
  if (!viewerElements.lightbox) return;
  window.clearTimeout(viewerState.uiHideTimer);
  viewerElements.lightbox.classList.add("show-ui");
  if (viewerState.topUiPinned || viewerState.viewerMobileMoreOpen) return;
  if (delay > 0) {
    viewerState.uiHideTimer = window.setTimeout(() => {
      if (!viewerState.topUiPinned && !viewerState.viewerMobileMoreOpen) viewerElements.lightbox.classList.remove("show-ui");
    }, delay);
  }
}


function getLightboxPinnedTopOffset() {
  if (!viewerState.topUiPinned || !viewerElements.lightboxBar) return 0;

  const rect = viewerElements.lightboxBar.getBoundingClientRect?.();
  const measuredHeight = rect ? Math.max(rect.height || 0, rect.bottom > 0 ? rect.bottom : 0) : 0;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  const maxReasonableOffset = Math.max(0, viewportHeight * 0.42);
  return Math.round(clampValue(measuredHeight, 0, maxReasonableOffset));
}

function syncLightboxTopSafeArea() {
  if (!viewerElements.lightbox) return 0;

  const offset = getLightboxPinnedTopOffset();
  viewerElements.lightbox.style.setProperty("--lightbox-top-safe-offset", `${offset}px`);
  return offset;
}

function refreshLightboxLayoutForTopUiChange(options = {}) {
  if (!isViewerSessionOpen()) {
    syncLightboxTopSafeArea();
    return;
  }

  const { resetAutoSingleOrigin = true } = options;
  syncLightboxTopSafeArea();

  if (resetAutoSingleOrigin && isAutoViewerZoom()) {
    resetImagePosition({ queueSingleFitOrigin: true });
  }

  applyZoom();
  refreshSingleViewerImageResolution();

}

function syncTopUiPinnedUi() {
  const pinned = Boolean(viewerState.topUiPinned);
  const label = pinned ? "ביטול נעיצת הסרגל העליון" : "נעיצת הסרגל העליון";

  window.clearTimeout(viewerState.uiHideTimer);
  viewerElements.lightbox?.classList.toggle("top-ui-pinned", pinned);
  if (pinned) viewerElements.lightbox?.classList.add("show-ui");
  syncLightboxTopSafeArea();
  syncViewerMobileMoreMenuState();

  if (!viewerElements.lightboxPinTopBar) return;
  viewerElements.lightboxPinTopBar.dataset.pinned = pinned ? "true" : "false";
  viewerElements.lightboxPinTopBar.setAttribute("aria-pressed", pinned ? "true" : "false");
  viewerElements.lightboxPinTopBar.setAttribute("aria-label", label);
  setTooltipText(viewerElements.lightboxPinTopBar, label, { updateDefault: true });
}

function setTopUiPinned(pinned) {
  viewerState.topUiPinned = Boolean(pinned);
  syncTopUiPinnedUi();
  refreshLightboxLayoutForTopUiChange();
  if (!viewerState.topUiPinned) showTopUiTemporarily(1400);
}

function toggleTopUiPinned() {
  setTopUiPinned(!viewerState.topUiPinned);
}

function getViewportPointer(event) {
  const x = Number(event?.clientX);
  const y = Number(event?.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function pointInRect(point, rect, padding = 0) {
  if (!point || !rect) return false;
  return point.x >= rect.left - padding && point.x <= rect.right + padding && point.y >= rect.top - padding && point.y <= rect.bottom + padding;
}

function shouldKeepTopUiOpenForPointer(event = null) {
  if (viewerState.topUiPinned || viewerState.viewerMobileMoreOpen) return true;
  const point = getViewportPointer(event);
  if (!point || !viewerElements.lightboxBar) return false;

  const barRect = viewerElements.lightboxBar.getBoundingClientRect();
  const hotspotRect = viewerElements.topHotspot?.getBoundingClientRect?.();
  if (pointInRect(point, barRect, 1) || pointInRect(point, hotspotRect, 1)) return true;

  // During the slide-in animation the toolbar may still be above the viewport,
  // so the pointer can be in the top trigger strip before it is geometrically
  // inside the toolbar. Keep the toolbar open for that whole top-edge region
  // instead of requiring the user to wait until the transition finishes.
  const topHoldBottom = Math.max(2, hotspotRect?.bottom || 0, barRect.top + 2);
  if (point.y <= topHoldBottom) return true;

  return false;
}

function scheduleTopUiClose(event = null) {
  if (!viewerElements.lightbox || !isViewerSessionOpen() || viewerState.topUiPinned || viewerState.viewerMobileMoreOpen) return;
  if (shouldKeepTopUiOpenForPointer(event)) return;
  window.clearTimeout(viewerState.uiHideTimer);
  viewerState.uiHideTimer = window.setTimeout(() => {
    if (!viewerState.topUiPinned && !viewerState.viewerMobileMoreOpen) viewerElements.lightbox?.classList.remove("show-ui");
  }, 420);
}

function shouldKeepPageRailOpenForPointer(event = null) {
  const point = getViewportPointer(event);
  if (!point || !viewerElements.lightboxPageRail) return false;

  const railRect = viewerElements.lightboxPageRail.getBoundingClientRect();
  const hotspotRect = viewerElements.lightboxSideHotspot?.getBoundingClientRect?.();
  if (pointInRect(point, railRect, 1) || pointInRect(point, hotspotRect, 1)) return true;

  // During the slide-in animation the rail can still be geometrically outside
  // the viewport, while the pointer is already on the right activation strip or
  // in the tiny edge gap. Keep the rail open for that whole right-edge region
  // instead of requiring the user to wait until the transition finishes.
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const hotspotWidth = Math.max(2, Math.round(hotspotRect?.width || 40));
  const rightHoldLeft = Math.max(0, Math.min(hotspotRect?.left ?? viewportWidth, viewportWidth - hotspotWidth));
  const rightHoldRight = viewportWidth + 1;
  const isInRightHoldRegion = point.x >= rightHoldLeft - 1 && point.x <= rightHoldRight + 1 && point.y >= 0 && point.y <= viewportHeight;
  if (isInRightHoldRegion) return true;

  // The rail is intentionally offset a few pixels from the right viewport edge.
  // Treat that physical edge as a hover hold zone so a fast move to the right
  // edge does not start the rail animation and immediately close it.
  const reachedRightEdgeFromRail = point.x >= railRect.right - 1 && point.x <= viewportWidth + 1 && point.y >= 0 && point.y <= viewportHeight;
  if (reachedRightEdgeFromRail) return true;

  return false;
}

function handleLightboxHoverHoldPointerMove(event) {
  if (!shouldUseLightboxHoverPointer(event)) return;

  if (viewerElements.lightbox?.classList.contains("show-ui") && !shouldKeepTopUiOpenForPointer(event)) {
    scheduleTopUiClose(event);
  }

  if (viewerElements.lightbox?.classList.contains("show-page-rail") && !shouldKeepPageRailOpenForPointer(event)) {
    schedulePageRailClose(event);
  }
}

function getViewportSize() {
  return {
    width: window.innerWidth || document.documentElement.clientWidth || 0,
    height: window.innerHeight || document.documentElement.clientHeight || 0
  };
}

function isPointInTopEdgeActivationZone(point) {
  if (!point || viewerState.topUiPinned) return false;
  const { width } = getViewportSize();
  const hotspotRect = viewerElements.topHotspot?.getBoundingClientRect?.();
  const hotspotHeight = Math.max(2, Math.round(hotspotRect?.height || 34));
  const activationBottom = Math.max(hotspotRect?.bottom || 0, hotspotHeight);
  return point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= activationBottom;
}

function getRightEdgeViewerNavigationRect() {
  const candidates = [viewerElements.prevPageBtn, viewerElements.nextPageBtn]
    .map((button) => button?.getBoundingClientRect?.())
    .filter((rect) => rect && rect.width > 0 && rect.height > 0);
  if (!candidates.length) return null;
  return candidates.reduce((rightmost, rect) => rect.right > rightmost.right ? rect : rightmost);
}

function isPointInPageRailNavigationConflictZone(point) {
  const navigationRect = getRightEdgeViewerNavigationRect();
  return pointInRect(point, navigationRect, 4);
}

function isPointInPageRailEdgeActivationZone(point) {
  if (!point || !viewerElements.lightboxSideHotspot || !viewerElements.lightboxPageRail) return false;
  const { width, height } = getViewportSize();
  const hotspotRect = viewerElements.lightboxSideHotspot.getBoundingClientRect();
  const hotspotWidth = Math.max(2, Math.round(hotspotRect?.width || 40));
  const activationLeft = Math.max(0, Math.min(hotspotRect?.left ?? width, width - hotspotWidth));
  // Coordinate-based activation reaches the physical viewport edge even when a
  // fast mouse move lands beyond the DOM hotspot. The page-navigation button on
  // the same side keeps its own compact hit area, so merely aiming for that
  // control does not unexpectedly reveal the thumbnail rail.
  const activationRight = width + 1;
  const insideEdgeStrip = point.x >= activationLeft && point.x <= activationRight && point.y >= 0 && point.y <= height;
  if (!insideEdgeStrip) return false;
  if (isPointInPageRailNavigationConflictZone(point) && point.x <= hotspotRect.right) return false;
  return true;
}

function openLightboxEdgeUiForPointer(point) {
  if (isPointInTopEdgeActivationZone(point)) {
    showTopUiTemporarily(0);
  }

  if (isPointInPageRailEdgeActivationZone(point)) {
    showPageRailTemporarily(0);
  }
}

function handleLightboxEdgeHoverMove(event) {
  if (!shouldUseLightboxHoverPointer(event)) return;
  const point = getViewportPointer(event);
  openLightboxEdgeUiForPointer(point);
  handleLightboxHoverHoldPointerMove(event);
}

function handleLightboxEdgeHoverViewportExit(event) {
  if (!shouldUseLightboxHoverPointer(event)) return;
  if (event.relatedTarget || event.toElement) return;

  const point = getViewportPointer(event);
  if (!point) return;

  const { width, height } = getViewportSize();
  if (point.y <= 0 && point.x >= 0 && point.x <= width) {
    showTopUiTemporarily(0);
  }

  if (point.x >= width - 1 && point.y >= 0 && point.y <= height) {
    showPageRailTemporarily(0);
  }
}

function setViewerLoading(isLoading) {
  viewerElements.viewerLoading.classList.toggle("hidden", !isLoading);
}


function hideLightboxFloatingPreview() {
  viewerElements.lightboxFloatingPreview?.classList.remove("visible");
}

function isLightboxPageRailTrigger(button) {
  return Boolean(button?.closest?.(".lightbox-page-rail"));
}

function normalizeWheelDeltaToPixels(delta, deltaMode, pageSize = 0) {
  const lineMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_LINE : 1;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;

  if (deltaMode === lineMode) return delta * 36;
  if (deltaMode === pageMode) return delta * Math.max(1, pageSize);
  return delta;
}

function positionLightboxFloatingPreview(button) {
  const preview = viewerElements.lightboxFloatingPreview;
  if (!preview || !button) return;

  const buttonRect = button.getBoundingClientRect();

  if (isLightboxPageRailTrigger(button)) {
    const previewHeight = Math.max(240, preview.offsetHeight || Math.min(620, window.innerHeight * 0.74));
    const railRect = button.closest?.(".lightbox-page-rail")?.getBoundingClientRect?.();
    const centerY = Math.min(
      window.innerHeight - (previewHeight / 2) - 14,
      Math.max((previewHeight / 2) + 14, buttonRect.top + (buttonRect.height / 2))
    );
    const right = Math.max(12, window.innerWidth - (railRect?.left ?? buttonRect.left) + 12);

    preview.style.left = "auto";
    preview.style.bottom = "auto";
    preview.style.right = `${right}px`;
    preview.style.top = `${centerY}px`;
    return;
  }

  const previewWidth = Math.max(240, preview.offsetWidth || Math.min(420, window.innerWidth * 0.34));
  const centerX = Math.min(
    window.innerWidth - (previewWidth / 2) - 14,
    Math.max((previewWidth / 2) + 14, buttonRect.left + (buttonRect.width / 2))
  );
  const bottom = Math.max(122, window.innerHeight - buttonRect.top + 12);

  preview.style.right = "auto";
  preview.style.top = "auto";
  preview.style.left = `${centerX}px`;
  preview.style.bottom = `${bottom}px`;
}

function showLightboxFloatingPreview(button) {
  if (!button || !viewerElements.lightboxFloatingPreview || !viewerElements.lightboxFloatingPreviewImage) return;

  const previewCatalog = findCatalogById(button.dataset.previewCatalog) || navigationState.catalog;
  if (!previewCatalog) return;
  const page = clampPage(button.dataset.previewPage || button.dataset.page, previewCatalog);
  const src = button.dataset.previewSrc || pageSrc(previewCatalog, page);
  applyCatalogImageDimensions(viewerElements.lightboxFloatingPreviewImage, previewCatalog, page);
  setCatalogImageSource(viewerElements.lightboxFloatingPreviewImage, src);
  viewerElements.lightboxFloatingPreviewImage.alt = `${previewCatalog.title} - עמוד ${page}`;
  if (viewerElements.lightboxFloatingPreviewPage) {
    viewerElements.lightboxFloatingPreviewPage.textContent = isFavoritesLightboxMode()
      ? `${previewCatalog.title} · עמוד ${page}`
      : `עמוד ${page}`;
  }
  viewerElements.lightboxFloatingPreview.classList.toggle("from-page-rail", isLightboxPageRailTrigger(button));
  viewerElements.lightboxFloatingPreview.classList.add("visible");
  positionLightboxFloatingPreview(button);
}

function updateLightboxThumbs(options = {}) {
  const { scrollIntoView = true } = options;
  const rail = viewerElements.lightboxPageThumbs;
  if (!rail) return;

  const previous = rail.querySelector('.lightbox-page-thumb[aria-current="page"]');
  const selector = isFavoritesLightboxMode()
    ? `.lightbox-page-thumb[data-favorite-index="${favoritesState.favoritesViewerIndex}"]`
    : `.lightbox-page-thumb[data-page="${navigationState.page}"]`;
  const active = rail.querySelector(selector);

  if (previous && previous !== active) {
    previous.classList.remove("active");
    previous.removeAttribute("aria-current");
  }
  if (!active) return;

  active.classList.add("active");
  active.setAttribute("aria-current", "page");
  if (scrollIntoView && viewerElements.lightbox?.classList.contains("show-page-rail")) {
    active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function handleLightboxPageRailSelection(button) {
  if (!button) return;

  hideLightboxFloatingPreview();

  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex(Number(button.dataset.favoriteIndex), { thumbScrollIntoView: false });
  } else {
    const targetPage = Number(button.dataset.page);
    if (!Number.isFinite(targetPage)) return;
    setLightboxPage(targetPage, { thumbScrollIntoView: false });
  }

  showPageRailTemporarily(1800, { scrollIntoView: false });
}

function renderLightboxPageRail() {
  if (!navigationState.catalog || !viewerElements.lightboxPageThumbs) return;
  const thumbs = [];

  if (isFavoritesLightboxMode()) {
    const entries = getFavoriteEntries();
    if (viewerElements.lightboxPageRailTitle) viewerElements.lightboxPageRailTitle.textContent = "מועדפים";
    viewerElements.lightboxPageRail?.setAttribute("aria-label", "מעבר מהיר בין המועדפים");

    entries.forEach(({ catalog, page }, index) => {
      const thumb = escapeHtml(thumbSrc(catalog, page));
      const title = escapeHtml(catalog.title || "קטלוג");
      const active = index === favoritesState.favoritesViewerIndex;
      thumbs.push(`
        <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${active ? " active" : ""}" type="button" data-favorite-index="${index}" data-preview-catalog="${escapeHtml(catalog.id)}" data-preview-page="${page}" data-preview-src="${thumb}" aria-label="מעבר למועדף ${index + 1}: ${title}, עמוד ${page}"${active ? ' aria-current="page"' : ""}>
          <span class="lightbox-page-thumb-image-wrap">
            <img src="${thumb}" alt=""${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumb)} />
          </span>
          <span class="lightbox-page-thumb-number">${index + 1}</span>
        </button>
      `);
    });
  } else {
    const catalog = navigationState.catalog;
    if (viewerElements.lightboxPageRailTitle) viewerElements.lightboxPageRailTitle.textContent = "עמודים";
    viewerElements.lightboxPageRail?.setAttribute("aria-label", "מעבר מהיר בין עמודי הקטלוג");

    for (let page = 1; page <= catalog.pages; page += 1) {
      const thumb = escapeHtml(thumbSrc(catalog, page));
      thumbs.push(`
        <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${page === navigationState.page ? " active" : ""}" type="button" data-page="${page}" data-preview-catalog="${escapeHtml(catalog.id)}" data-preview-page="${page}" data-preview-src="${thumb}" aria-label="מעבר לעמוד ${page}"${page === navigationState.page ? ' aria-current="page"' : ""}>
          <span class="lightbox-page-thumb-image-wrap">
            <img src="${thumb}" alt=""${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumb)} />
          </span>
          <span class="lightbox-page-thumb-number">${page}</span>
        </button>
      `);
    }
  }

  viewerElements.lightboxPageThumbs.innerHTML = thumbs.join("");
  viewerElements.lightboxPageThumbs.querySelectorAll(".lightbox-page-thumb").forEach((button) => {
    button.addEventListener("pointerenter", () => showLightboxFloatingPreview(button));
    button.addEventListener("pointerleave", hideLightboxFloatingPreview);
    button.addEventListener("focus", () => showLightboxFloatingPreview(button));
    button.addEventListener("blur", hideLightboxFloatingPreview);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      handleLightboxPageRailSelection(button);
    });
  });
}

function syncViewerFitModeUi() {
  const fitMode = normalizeViewerFitMode(viewerState.imageFitMode);
  const automatic = viewerUsesAutomaticFitMode();
  viewerState.imageFitMode = fitMode;

  viewerElements.lightbox?.classList.toggle("fit-height", fitMode === VIEWER_FIT_HEIGHT);
  viewerElements.lightbox?.classList.toggle("fit-width", fitMode === VIEWER_FIT_WIDTH);

  if (viewerElements.fitAutoBtn) {
    viewerElements.fitAutoBtn.setAttribute("aria-pressed", automatic ? "true" : "false");
    viewerElements.fitAutoBtn.setAttribute("aria-label", "התאמת תצוגה אוטומטי");
    setTooltipText(viewerElements.fitAutoBtn, "התאמת תצוגה אוטומטי", { updateDefault: true });
  }

  if (viewerElements.fitHeightBtn) {
    const isActive = !automatic && fitMode === VIEWER_FIT_HEIGHT;
    viewerElements.fitHeightBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    viewerElements.fitHeightBtn.setAttribute("aria-label", "התאמת התמונה לגובה");
    setTooltipText(viewerElements.fitHeightBtn, "התאמה לגובה", { updateDefault: true });
  }

  if (viewerElements.fitWidthBtn) {
    const isActive = !automatic && fitMode === VIEWER_FIT_WIDTH;
    viewerElements.fitWidthBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    viewerElements.fitWidthBtn.setAttribute("aria-label", "התאמת התמונה לרוחב");
    setTooltipText(viewerElements.fitWidthBtn, "התאמה לרוחב", { updateDefault: true });
  }

  syncViewerAutoZoomButtonUi();
  syncViewerMobileMoreMenuState();
}


function syncViewerAutoZoomButtonUi() {
  if (!viewerElements.viewerAutoZoomBtn) return;

  const showButton = Boolean(isViewerSessionOpen() && !isAutoViewerZoom());

  viewerElements.viewerAutoZoomBtn.classList.toggle("hidden", !showButton);
  viewerElements.viewerAutoZoomBtn.setAttribute("aria-hidden", showButton ? "false" : "true");
  viewerElements.viewerAutoZoomBtn.setAttribute("tabindex", showButton ? "0" : "-1");
  viewerElements.viewerAutoZoomBtn.setAttribute("aria-label", "חזרה לזום אוטומטי");

  // Keep the button itself icon-only and stationary; the clear explanation lives
  // in the shared floating tooltip so hover/focus never changes the button size.
  setTooltipText(viewerElements.viewerAutoZoomBtn, "חזרה לזום אוטומטי", { updateDefault: true });
}

function formatViewerZoomPercent(value = viewerState.zoom) {
  return `${Math.round(getSafeViewerZoom(value) * 100)}%`;
}

function hideViewerZoomIndicator() {
  window.clearTimeout(viewerState.zoomIndicatorHideTimer);
  viewerState.zoomIndicatorHideTimer = 0;
  viewerElements.viewerZoomIndicator?.classList.remove("visible");
}

function showViewerZoomIndicator(value = viewerState.zoom) {
  const indicator = viewerElements.viewerZoomIndicator;
  if (!indicator || !isViewerSessionOpen()) return;

  indicator.textContent = formatViewerZoomPercent(value);
  indicator.classList.add("visible");

  window.clearTimeout(viewerState.zoomIndicatorHideTimer);
  viewerState.zoomIndicatorHideTimer = window.setTimeout(() => {
    indicator.classList.remove("visible");
    viewerState.zoomIndicatorHideTimer = 0;
  }, VIEWER_ZOOM_INDICATOR_HIDE_MS);
}

function setViewerFitMode(fitMode, options = {}) {
  const nextFitMode = normalizeViewerFitMode(fitMode);
  const {
    showUi = true,
    source = VIEWER_FIT_SOURCE_MANUAL,
    refreshLayout = true
  } = options;
  const shouldResetView = nextFitMode !== viewerState.imageFitMode;

  viewerState.imageFitModeSource = normalizeViewerFitModeSource(source);
  viewerState.imageFitMode = nextFitMode;
  if (shouldResetView) {
    clearViewerPageWheelGesture();
    viewerState.zoom = AUTO_VIEWER_ZOOM;
    resetImagePosition({ queueSingleFitOrigin: true });
    viewerState.pointers.clear();
  }

  syncViewerFitModeUi();
  if (refreshLayout) {
    applyZoom();
    refreshSingleViewerImageResolution();
  }
  if (showUi) showTopUiTemporarily(1600);
}

function setViewerAutomaticFitMode(options = {}) {
  setViewerFitMode(getAutomaticViewerFitMode(), {
    ...options,
    source: VIEWER_FIT_SOURCE_AUTO
  });
}

function syncAutomaticViewerFitMode(options = {}) {
  if (!viewerUsesAutomaticFitMode()) return false;

  const nextFitMode = getAutomaticViewerFitMode();
  if (nextFitMode === viewerState.imageFitMode) return false;

  setViewerAutomaticFitMode(options);
  return true;
}

function syncLightboxModeUi() {
  const favoritesMode = isFavoritesLightboxMode();
  viewerElements.lightbox?.classList.add("catalog-entry-mode");
  viewerElements.lightbox?.classList.toggle("favorites-viewer-mode", favoritesMode);
  favoritesElements.favoriteOpenCatalogButton?.classList.toggle("hidden", !favoritesMode);
  favoritesElements.favoriteOpenCatalogButton?.setAttribute("aria-hidden", favoritesMode ? "false" : "true");
  favoritesElements.favoriteOpenCatalogButton?.setAttribute("tabindex", favoritesMode ? "0" : "-1");
  viewerElements.prevPageBtn?.setAttribute("aria-label", favoritesMode ? "המועדף הקודם" : "העמוד הקודם");
  viewerElements.nextPageBtn?.setAttribute("aria-label", favoritesMode ? "המועדף הבא" : "העמוד הבא");
  syncViewerLayoutModeUi();
  syncViewerFitModeUi();
  syncFullscreenButtonUi();

  if (viewerElements.lightboxModeLabel) {
    viewerElements.lightboxModeLabel.textContent = favoritesMode ? "תצוגת מועדפים" : "כניסה לקטלוג";
  }
}



function isObservedMouseHoverEvent(event = null) {
  if (event?.pointerType === "mouse") return true;
  return String(event?.type || "").startsWith("mouse");
}

function markTouchLikeViewportInput(event) {
  if (isTouchLikePointer(event) || event?.type === "touchstart") {
    viewerState.lastTouchLikeViewportInputAt = Date.now();
  }
}

function hasRecentTouchLikeViewportInput(timeout = 900) {
  return Date.now() - viewerState.lastTouchLikeViewportInputAt < timeout;
}

function openTopUiFromHotspot(event = null) {
  if (!isViewerSessionOpen() || viewerState.viewerOnboardingOpen) return;
  markTouchLikeViewportInput(event);
  showTopUiTemporarily(0);
}

function markTouchLikeRailInput(event) {
  if (isTouchLikePointer(event)) {
    viewerState.lastTouchLikeRailInputAt = Date.now();
  }
  markTouchLikeViewportInput(event);
}

function hasRecentTouchLikeRailInput(timeout = 900) {
  return Date.now() - viewerState.lastTouchLikeRailInputAt < timeout;
}

function shouldUseLightboxHoverPointer(event = null) {
  if (!isViewerSessionOpen()) return false;
  if (isTouchLikePointer(event) || hasRecentTouchLikeViewportInput()) return false;

  // Hybrid Windows devices can keep reporting a coarse/no-hover primary input
  // even while a real mouse is actively producing mouse events. Trust observed
  // mouse input first; the recent-touch guard above still filters the synthetic
  // mouse events browsers may emit after a tap.
  if (isObservedMouseHoverEvent(event)) return true;
  return hasHoverPointer();
}

function shouldUsePageRailHover(event = null) {
  if (!shouldUseLightboxHoverPointer(event)) return false;
  if (hasRecentTouchLikeRailInput()) return false;
  return true;
}

function showPageRailTemporarily(delay = 2600, options = {}) {
  const { scrollIntoView = true } = options;
  if (!viewerElements.lightbox || !isViewerSessionOpen()) return;
  window.clearTimeout(viewerState.pageRailHideTimer);
  viewerElements.lightbox.classList.add("show-page-rail");
  updateLightboxThumbs({ scrollIntoView });
  if (delay > 0) {
    viewerState.pageRailHideTimer = window.setTimeout(() => {
      viewerElements.lightbox?.classList.remove("show-page-rail");
    }, delay);
  }
}

function keepPageRailOpen(options = {}) {
  const { scrollIntoView = true } = options;
  if (!isViewerSessionOpen()) return;
  window.clearTimeout(viewerState.pageRailHideTimer);
  viewerElements.lightbox?.classList.add("show-page-rail");
  updateLightboxThumbs({ scrollIntoView });
}

function schedulePageRailClose(event = null) {
  if (!shouldUsePageRailHover(event)) return;
  if (shouldKeepPageRailOpenForPointer(event)) return;
  window.clearTimeout(viewerState.pageRailHideTimer);
  viewerState.pageRailHideTimer = window.setTimeout(() => {
    viewerElements.lightbox?.classList.remove("show-page-rail");
  }, 420);
}

function openPageRailFromTouch(event) {
  if (!isTouchLikePointer(event)) return;
  markTouchLikeRailInput(event);
  event.preventDefault?.();
  keepPageRailOpen();
}

function handleLightboxPageRailEdgePointerDown(event) {
  if (!isTouchLikePointer(event) || !isViewerSessionOpen() || viewerState.viewerOnboardingOpen) return;
  if (viewerElements.lightboxPageRail?.contains(event.target)) return;

  const point = getViewportPointer(event);
  if (!isPointInPageRailEdgeActivationZone(point)) return;

  markTouchLikeRailInput(event);
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  event.stopPropagation?.();
  keepPageRailOpen();
}

function openPageRailFromHotspot(event = null) {
  if (hasRecentTouchLikeRailInput()) {
    keepPageRailOpen();
    return;
  }
  showPageRailTemporarily(shouldUsePageRailHover(event) ? 2600 : 0);
}

function showPageRailFromHover(event = null) {
  if (shouldUsePageRailHover(event)) showPageRailTemporarily(0);
}

function keepPageRailOpenFromHover(event = null) {
  if (shouldUsePageRailHover(event)) keepPageRailOpen();
}

function handlePageRailPointerOutside(event) {
  if (!viewerElements.lightbox || !isViewerSessionOpen()) return;
  if (!viewerElements.lightbox.classList.contains("show-page-rail")) return;

  const target = event.target;
  if (viewerElements.lightboxPageRail?.contains(target) || viewerElements.lightboxSideHotspot?.contains(target)) return;
  if (!isTouchLikePointer(event) && shouldUsePageRailHover(event)) return;

  window.clearTimeout(viewerState.pageRailHideTimer);
  hideLightboxFloatingPreview();
  viewerElements.lightbox.classList.remove("show-page-rail");
}
















function hideViewerPageIndicator() {
  window.clearTimeout(viewerState.pageIndicatorHideTimer);
  viewerState.pageIndicatorHideTimer = 0;
  viewerElements.viewerPageIndicator?.classList.remove("visible");
}

function showViewerPageIndicatorTemporarily(delay = VIEWER_PAGE_INDICATOR_HIDE_MS) {
  if (!isViewerSessionOpen() || !viewerElements.viewerPageIndicator) return;

  window.clearTimeout(viewerState.pageIndicatorHideTimer);
  viewerElements.viewerPageIndicator.classList.add("visible");
  if (delay <= 0) return;

  viewerState.pageIndicatorHideTimer = window.setTimeout(() => {
    viewerElements.viewerPageIndicator?.classList.remove("visible");
    viewerState.pageIndicatorHideTimer = 0;
  }, delay);
}

function syncLightboxProgress(current, total, title, options = {}) {
  if (!viewerElements.lightboxProgress) return;
  const totalItems = Math.max(1, Number.parseInt(total, 10) || 1);
  const currentItem = clampValue(Number.parseInt(current, 10) || 1, 1, totalItems);
  const ratio = totalItems <= 1 ? 1 : currentItem / totalItems;
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const label = String(options.label || "עמוד");
  const detail = String(options.detail || "").trim();
  const accessibleTitle = title || `${label} ${currentItem} מתוך ${totalItems}`;

  viewerElements.lightboxProgress.style.setProperty("--catalog-progress-ratio", String(clampedRatio));
  viewerElements.lightboxProgress.style.setProperty("--catalog-progress-percent", `${clampedRatio * 100}%`);
  viewerElements.lightboxProgress.setAttribute("aria-valuemin", "1");
  viewerElements.lightboxProgress.setAttribute("aria-valuemax", String(totalItems));
  viewerElements.lightboxProgress.setAttribute("aria-valuenow", String(currentItem));
  viewerElements.lightboxProgress.setAttribute("aria-valuetext", accessibleTitle);
  viewerElements.lightboxProgress.setAttribute("title", accessibleTitle);

  if (viewerElements.viewerPageIndicator) {
    viewerElements.viewerPageIndicatorLabel.textContent = label;
    viewerElements.viewerPageIndicatorCurrent.textContent = String(currentItem);
    viewerElements.viewerPageIndicatorTotal.textContent = String(totalItems);
    if (viewerElements.viewerPageIndicatorDetail) {
      viewerElements.viewerPageIndicatorDetail.textContent = detail;
      viewerElements.viewerPageIndicatorDetail.classList.toggle("hidden", !detail);
    }
    viewerElements.viewerPageIndicator.setAttribute("title", accessibleTitle);
    showViewerPageIndicatorTemporarily();
  }
}


function syncViewerLayoutModeUi() {
  // The catalog and favorites routes now share one paged, single-image renderer.
  // Keeping one rendering contract avoids decoded multi-page DOM state while all
  // input methods still resolve to the same previous/next-page operation.
  viewerElements.lightbox?.classList.add("viewer-layout-paged");
  viewerElements.lightbox?.classList.remove("viewer-layout-scroll", "viewer-layout-side", "viewer-scroll-zoom-isolated");
  viewerElements.lightboxImageFrame?.classList.remove("hidden");
}
/* ===== END SOURCE: src/js/56-viewer-shell.js ===== */

/* ===== BEGIN SOURCE: src/js/58-viewer-navigation.js ===== */
/**
 * Source module: 58-viewer-navigation.js
 * Paged-viewer wheel normalization, edge overscroll, and page-turn command handling.
 *
 * This module translates wheel, trackpad, and boundary-pan intent into the
 * same paged navigation contract used by buttons, keyboard, and touch input.
 */

function retryCurrentViewerImage() {
  if (!isViewerSessionOpen() || !navigationState.catalog) return;
  const request = viewerPageImageRequest(navigationState.catalog, navigationState.page);
  showSingleLightboxImage(navigationState.catalog, navigationState.page, request.primarySrc, {
    imageRequest: request,
    forceRefresh: true
  });
}

function getViewerNavigationPosition() {
  return isFavoritesLightboxMode() ? favoritesState.favoritesViewerIndex : navigationState.page - 1;
}

function getViewerNavigationMaximumPosition() {
  if (isFavoritesLightboxMode()) return Math.max(0, getFavoriteEntries().length - 1);
  return Math.max(0, (navigationState.catalog?.pages || 1) - 1);
}

function setViewerNavigationPosition(position, options = {}) {
  const maximum = getViewerNavigationMaximumPosition();
  const target = clampValue(Number.parseInt(position, 10) || 0, 0, maximum);
  if (target === getViewerNavigationPosition()) return false;

  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex(target, options);
  } else {
    setLightboxPage(target + 1, options);
  }
  return true;
}

function canMoveLightbox(direction) {
  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (!step) return false;
  const current = getViewerNavigationPosition();
  return current + step >= 0 && current + step <= getViewerNavigationMaximumPosition();
}

function clearViewerPageWheelGesture() {
  window.clearTimeout(viewerState.viewerPageWheelSettleTimer);
  viewerState.viewerPageWheelSettleTimer = 0;
  viewerState.viewerPageWheelAccumulator = 0;
  viewerState.viewerPageWheelBasePage = 0;
  viewerState.viewerPageWheelTargetPage = 0;
}

function normalizeViewerPageWheelAxisDelta(rawDelta, deltaMode, viewportSize = 0) {
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;
  if (deltaMode === pageMode) {
    return (Number(rawDelta) || 0) * VIEWER_PAGE_WHEEL_PAGE_DELTA_PX;
  }
  return normalizeWheelDeltaToPixels(rawDelta, deltaMode, viewportSize);
}

function normalizeViewerPageWheelDeltas(event) {
  return {
    deltaX: normalizeViewerPageWheelAxisDelta(
      event?.deltaX,
      event?.deltaMode,
      event?.currentTarget?.clientWidth || viewerElements.stageCanvas?.clientWidth || 0
    ),
    deltaY: normalizeViewerPageWheelAxisDelta(
      event?.deltaY,
      event?.deltaMode,
      event?.currentTarget?.clientHeight || viewerElements.stageCanvas?.clientHeight || 0
    )
  };
}

function getViewerPageWheelLogicalDelta(deltaX, deltaY) {
  if (Math.abs(deltaY) >= Math.abs(deltaX)) return deltaY;
  // The viewer is RTL: a rightward finger/trackpad gesture (negative wheel
  // deltaX) advances, matching the existing horizontal touch-swipe contract.
  return -deltaX;
}

function getViewerPageWheelRequestedSteps(accumulator) {
  const signedAccumulator = Number(accumulator) || 0;
  const magnitude = Math.abs(signedAccumulator);
  if (magnitude < VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX) return 0;

  const wholePageSteps = Math.trunc(magnitude / VIEWER_PAGE_WHEEL_PAGE_DELTA_PX);
  return Math.sign(signedAccumulator) * Math.max(1, wholePageSteps);
}

function getSingleViewerPageTurnIntent(result, deltaX = 0, deltaY = 0) {
  if (!result) return null;
  // A zoomed/pannable image may expose the same black safety buffer on both
  // axes, but only vertical reading intent is allowed to turn the page. The
  // horizontal buffer is a terminal pan boundary, not another navigation rail.
  const remaining = result.remainingDeltaY;
  if (Math.abs(remaining) <= VIEWER_PAGE_TURN_REMAINDER_EPSILON) return null;

  return {
    axis: "y",
    direction: Math.sign(remaining)
  };
}

function moveLightboxFromPageTurn(direction, axis = "y", options = {}) {
  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (!step || !canMoveLightbox(step)) return false;

  moveLightbox(step, {
    keepZoom: true,
    positionMode: "page-turn",
    pageTurnDirection: step,
    pageTurnAxis: axis,
    preservePointerInteraction: options.preservePointerInteraction === true
  });
  return true;
}

function consumeSingleViewerBoundaryInput(deltaX = 0, deltaY = 0, options = {}) {
  const result = consumeSingleViewerPanInput(deltaX, deltaY);
  if (!result) return { handled: false, turned: false, moved: false };

  const intent = getSingleViewerPageTurnIntent(result, deltaX, deltaY);
  const turned = Boolean(intent && moveLightboxFromPageTurn(intent.direction, intent.axis, {
    preservePointerInteraction: Number.isFinite(options.pointerId)
  }));

  return {
    handled: true,
    turned,
    moved: result.moved,
    intent,
    result
  };
}

function settleViewerPageWheelGesture() {
  clearViewerPageWheelGesture();
}

function handleViewerPageWheel(event) {
  if (!isViewerSessionOpen() || !navigationState.catalog) return false;

  const { deltaX, deltaY } = normalizeViewerPageWheelDeltas(event);
  if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) return false;

  event.preventDefault();

  if (singleViewerUsesBoundaryPan()) {
    clearViewerPageWheelGesture();
    consumeSingleViewerBoundaryInput(deltaX, deltaY);
    return true;
  }

  const logicalDelta = getViewerPageWheelLogicalDelta(deltaX, deltaY);
  if (Math.abs(logicalDelta) < 0.01) return true;

  const gestureStarted = !viewerState.viewerPageWheelBasePage;
  if (gestureStarted) {
    const currentPosition = getViewerNavigationPosition();
    // Store one-based values so zero remains the explicit "no gesture" sentinel.
    viewerState.viewerPageWheelBasePage = currentPosition + 1;
    viewerState.viewerPageWheelTargetPage = currentPosition + 1;
    viewerState.viewerPageWheelAccumulator = 0;
  }

  viewerState.viewerPageWheelAccumulator += logicalDelta;
  const requestedSteps = getViewerPageWheelRequestedSteps(viewerState.viewerPageWheelAccumulator);
  const basePosition = viewerState.viewerPageWheelBasePage - 1;
  const targetPosition = clampValue(
    basePosition + requestedSteps,
    0,
    getViewerNavigationMaximumPosition()
  );
  const previousTargetPosition = viewerState.viewerPageWheelTargetPage - 1;
  viewerState.viewerPageWheelTargetPage = targetPosition + 1;

  if (targetPosition !== previousTargetPosition) {
    const direction = Math.sign(targetPosition - previousTargetPosition)
      || Math.sign(targetPosition - basePosition)
      || Math.sign(logicalDelta);
    setViewerNavigationPosition(targetPosition, {
      keepZoom: true,
      positionMode: "page-turn",
      pageTurnDirection: direction,
      pageTurnAxis: Math.abs(deltaY) >= Math.abs(deltaX) ? "y" : "x"
    });
  }

  window.clearTimeout(viewerState.viewerPageWheelSettleTimer);
  viewerState.viewerPageWheelSettleTimer = window.setTimeout(
    settleViewerPageWheelGesture,
    VIEWER_PAGE_WHEEL_SETTLE_MS
  );
  return true;
}
/* ===== END SOURCE: src/js/58-viewer-navigation.js ===== */

/* ===== BEGIN SOURCE: src/js/60-viewer.js ===== */
/**
 * Source module: 60-viewer.js
 * Viewer lifecycle, page selection, route entry, and event ownership.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function updateLightbox(options = {}) {
  if (!navigationState.catalog) return;
  const { thumbScrollIntoView = true, preserveCurrentImage = false } = options;
  let favoriteEntries = null;

  if (isFavoritesLightboxMode()) {
    favoriteEntries = getFavoriteEntries();
    if (!favoriteEntries.length) {
      closeLightbox({ restoreFavorites: true });
      return;
    }

    const currentIndex = findFavoriteEntryIndex(favoriteEntries, navigationState.catalog?.id, navigationState.page);
    setFavoriteViewerEntry(favoriteEntries, currentIndex >= 0 ? currentIndex : favoritesState.favoritesViewerIndex);
  }

  const catalog = navigationState.catalog;
  navigationState.page = clampPage(navigationState.page, catalog);
  syncLightboxModeUi();
  syncViewerInquiryUi();
  syncViewerMobileMoreMenuState();

  viewerElements.lightboxTitle.textContent = catalog.title;
  if (favoriteEntries) {
    const current = favoritesState.favoritesViewerIndex + 1;
    const total = favoriteEntries.length;
    viewerElements.lightboxMeta.textContent = `מועדף ${current} מתוך ${total} · עמוד ${navigationState.page}`;
    syncLightboxProgress(current, total, `מועדף ${current} מתוך ${total} · עמוד ${navigationState.page}`, {
      label: "מועדף",
      detail: `עמוד ${navigationState.page}`
    });
    viewerElements.prevPageBtn.disabled = favoritesState.favoritesViewerIndex <= 0;
    viewerElements.nextPageBtn.disabled = favoritesState.favoritesViewerIndex >= total - 1;
  } else {
    viewerElements.lightboxMeta.textContent = `עמוד ${navigationState.page} מתוך ${catalog.pages}`;
    syncLightboxProgress(navigationState.page, catalog.pages, `עמוד ${navigationState.page} מתוך ${catalog.pages}`, {
      label: "עמוד"
    });
    viewerElements.prevPageBtn.disabled = navigationState.page <= 1;
    viewerElements.nextPageBtn.disabled = navigationState.page >= catalog.pages;
  }

  syncViewerFavoriteButtonUi();
  if (!favoriteEntries) initLightboxSearchStatus();

  const preserveFullResolutionTier = !isAutoViewerZoom()
    && activeSingleViewerImageTier() === CATALOG_IMAGE_TIER_FULL;
  const request = viewerPageImageRequest(catalog, navigationState.page, {
    forceFull: preserveFullResolutionTier
  });
  const src = request.primarySrc;
  const currentSrc = activeSingleViewerImageLogicalSrc();
  if (currentSrc !== src) {
    showSingleLightboxImage(catalog, navigationState.page, src, { imageRequest: request, preserveCurrentImage });
  } else {
    setViewerLoading(false);
    viewerElements.lightbox?.classList.remove("is-page-loading");
    applyZoom();
  }

  updateLightboxThumbs({ scrollIntoView: thumbScrollIntoView });
  preloadNeighbors();
  updateHash();
}

function openLightbox(page = 1, options = {}) {
  if (!navigationState.catalog) return;
  const source = options.source === LIGHTBOX_SOURCE_FAVORITES
    ? LIGHTBOX_SOURCE_FAVORITES
    : LIGHTBOX_SOURCE_CATALOG;

  if (!isAppPage("viewer")) {
    navigateTo(viewerDocumentUrl(navigationState.catalog.id, page, { source }));
    return;
  }

  navigationState.lightboxSource = source;
  if (source === LIGHTBOX_SOURCE_FAVORITES) {
    favoritesState.favoritesViewerIndex = Math.max(0, Number.parseInt(options.favoriteIndex, 10) || 0);
  } else {
    favoritesState.favoritesViewerIndex = 0;
    favoritesState.favoritesViewerOpeningHash = "";
    favoritesState.favoritesViewerPreviousCatalog = null;
    favoritesState.favoritesViewerPreviousPage = 1;
    favoritesState.favoritesReturnFocus = null;
  }
  viewerState.imageFitModeSource = normalizeViewerFitModeSource(viewerState.imageFitModeSource);
  viewerState.imageFitMode = viewerUsesAutomaticFitMode()
    ? getAutomaticViewerFitMode()
    : normalizeViewerFitMode(viewerState.imageFitMode);
  stopViewerTouchMomentum();
  clearViewerPageWheelGesture();
  navigationState.page = clampPage(page, navigationState.catalog);
  viewerState.zoom = AUTO_VIEWER_ZOOM;
  resetImagePosition({ queueSingleFitOrigin: true });
  viewerState.pointers.clear();
  hideViewerZoomIndicator();
  closeViewerInquiry({ restoreFocus: false });
  closeViewerMobileMoreMenu();
  transitionViewerPhase(VIEWER_PHASE_OPENING, "open-lightbox");
  telemetryTrackCatalogOpen(navigationState.catalog, navigationState.page, navigationState.lightboxSource);
  primeLightboxFrameForCatalogPage(navigationState.catalog, navigationState.page);
  const initialSrc = viewerPageSrc(navigationState.catalog, navigationState.page);
  if (viewerElements.lightboxImage?.getAttribute("src") !== initialSrc) {
    viewerElements.lightboxImage?.removeAttribute("src");
    prepareImagePlaceholder(viewerElements.lightboxImage);
    viewerElements.lightboxImageFrame?.classList.remove("page-swap-enter");
  }
  viewerElements.lightbox.classList.remove("hidden");
  viewerElements.lightbox.classList.remove("show-ui", "show-page-rail");
  syncTopUiPinnedUi();
  syncDocumentLock();
  renderLightboxPageRail();
  if (!isFavoritesLightboxMode()) renderLightboxCatalogMenu();
  resetLightboxSearch();
  syncLightboxModeUi();
  showTopUiTemporarily(1700);
  updateLightbox();
  getFeatureInterface("catalog-grid")?.scheduleScrollTopButtonUpdate?.();
  transitionViewerPhase(VIEWER_PHASE_OPEN, "lightbox-ready");
  window.requestAnimationFrame(showViewerOnboardingIfNeeded);

}

function hideLightboxUi() {
  transitionViewerPhase(VIEWER_PHASE_CLOSING, "hide-lightbox");
  closeViewerOnboarding({ restoreFocus: false });
  closeViewerInquiry({ restoreFocus: false });
  closeViewerMobileMoreMenu();
  getFeatureInterface("search")?.setLightboxMobileOpen?.(false, { hideResults: true });
  viewerState.singleImageLoadToken += 1;
  stopViewerTouchMomentum();
  clearViewerPageWheelGesture();
  clearSingleImagePendingPosition();
  clearSingleViewerResolutionUpgrade();
  window.clearTimeout(viewerState.singleImageAnimationTimer);
  viewerElements.lightbox?.classList.add("hidden");
  viewerElements.lightbox?.classList.remove("show-ui", "show-page-rail", "catalog-entry-mode", "favorites-viewer-mode", "viewer-layout-paged", "viewer-layout-scroll", "viewer-layout-side", "viewer-scroll-zoom-isolated", "is-page-loading", "is-zoomed");
  syncViewerAutoZoomButtonUi();
  hideViewerZoomIndicator();
  viewerElements.lightboxImageFrame?.classList.remove("page-swap-enter");
  setViewerLoading(false);
  hideLightboxFloatingPreview();
  window.clearTimeout(viewerState.uiHideTimer);
  window.clearTimeout(viewerState.pageRailHideTimer);
  hideViewerPageIndicator();
  getFeatureInterface("catalog-grid")?.scheduleScrollTopButtonUpdate?.();
  navigationState.lightboxSource = LIGHTBOX_SOURCE_CATALOG;
  transitionViewerPhase(VIEWER_PHASE_CLOSED, "lightbox-hidden");
  syncDocumentLock();
}

function closeLightbox(options = {}) {
  const wasFavoritesViewer = isFavoritesLightboxMode();
  const { restoreFavorites = wasFavoritesViewer } = options;

  if (isAppPage("viewer")) {
    if ((hasInDocumentRouteSession || canReturnToSameSite()) && window.history.length > 1) {
      navigateBack();
      return;
    }
    const destination = wasFavoritesViewer && restoreFavorites
      ? favoritesDocumentUrl()
      : catalogDocumentUrl(navigationState.catalog?.id);
    navigateTo(destination || homeDocumentUrl(), { replace: true });
    return;
  }

  hideLightboxUi();
}

function setLightboxPage(page, options = {}) {
  if (!navigationState.catalog) return;
  const nextPage = clampPage(page, navigationState.catalog);
  if (nextPage === navigationState.page) return;

  const {
    thumbScrollIntoView = true,
    keepZoom = true,
    resetZoom = false,
    resetPosition = isAutoViewerZoom(),
    positionMode = "auto",
    pageTurnDirection = Math.sign(nextPage - navigationState.page),
    pageTurnAxis = "y",
    preservePointerInteraction = false
  } = options;
  const shouldResetZoom = resetZoom || keepZoom === false;
  const shouldResetPosition = shouldResetZoom || resetPosition;
  const preserveRelativePosition = positionMode !== "page-turn"
    && shouldPreserveSingleManualPosition({ keepZoom, resetZoom, resetPosition });
  const relativePosition = preserveRelativePosition
    ? captureSingleImageRelativePosition()
    : null;

  hideLightboxFloatingPreview();
  if (shouldResetZoom) viewerState.zoom = AUTO_VIEWER_ZOOM;

  if (positionMode === "page-turn") {
    queueSingleImagePageTurnOrigin(nextPage, pageTurnDirection, pageTurnAxis);
  } else if (shouldResetPosition) {
    resetImagePosition({ queueSingleFitOrigin: true });
  } else if (relativePosition) {
    queueSingleImageRelativePosition(nextPage, relativePosition);
  }

  if (!preservePointerInteraction) viewerState.pointers.clear();
  const previousCatalog = navigationState.catalog;
  const previousPage = navigationState.page;
  navigationState.page = nextPage;
  const preserveCurrentGeometry = Boolean(
    viewerElements.lightboxImage?.complete
    && viewerElements.lightboxImage.naturalWidth > 0
    && catalogPagesShareAspectRatio(previousCatalog, previousPage, navigationState.catalog, navigationState.page)
  );
  const geometryPrimed = !preserveCurrentGeometry
    && primeLightboxFrameForCatalogPage(navigationState.catalog, navigationState.page);
  if (geometryPrimed) applyZoom();
  updateLightbox({ thumbScrollIntoView, preserveCurrentImage: preserveCurrentGeometry });
}

function setFavoriteViewerIndex(index, options = {}) {
  if (!isFavoritesLightboxMode()) return;
  const entries = getFavoriteEntries();
  if (!entries.length) {
    closeLightbox({ restoreFavorites: true });
    return;
  }

  const {
    thumbScrollIntoView = true,
    keepZoom = true,
    resetZoom = false,
    resetPosition = isAutoViewerZoom(),
    positionMode = "auto",
    pageTurnDirection = Math.sign((Number.parseInt(index, 10) || 0) - favoritesState.favoritesViewerIndex),
    pageTurnAxis = "y",
    preservePointerInteraction = false
  } = options;
  const nextIndex = clampValue(Number.parseInt(index, 10) || 0, 0, entries.length - 1);
  const entry = entries[nextIndex];
  const itemChanged = nextIndex !== favoritesState.favoritesViewerIndex || navigationState.catalog !== entry.catalog || navigationState.page !== entry.page;
  if (!itemChanged) return;

  const shouldResetZoom = resetZoom || keepZoom === false;
  const shouldResetPosition = shouldResetZoom || resetPosition;
  const preserveRelativePosition = positionMode !== "page-turn"
    && shouldPreserveSingleManualPosition({ keepZoom, resetZoom, resetPosition });
  const relativePosition = preserveRelativePosition
    ? captureSingleImageRelativePosition()
    : null;

  hideLightboxFloatingPreview();
  if (shouldResetZoom) viewerState.zoom = AUTO_VIEWER_ZOOM;

  if (positionMode === "page-turn") {
    queueSingleImagePageTurnOrigin(entry.page, pageTurnDirection, pageTurnAxis);
  } else if (shouldResetPosition) {
    resetImagePosition({ queueSingleFitOrigin: true });
  } else if (relativePosition) {
    queueSingleImageRelativePosition(entry.page, relativePosition);
  }
  if (!preservePointerInteraction) viewerState.pointers.clear();

  const previousCatalog = navigationState.catalog;
  const previousPage = navigationState.page;
  setFavoriteViewerEntry(entries, nextIndex);
  const preserveCurrentGeometry = Boolean(
    viewerElements.lightboxImage?.complete
    && viewerElements.lightboxImage.naturalWidth > 0
    && catalogPagesShareAspectRatio(previousCatalog, previousPage, navigationState.catalog, navigationState.page)
  );
  const geometryPrimed = !preserveCurrentGeometry
    && primeLightboxFrameForCatalogPage(navigationState.catalog, navigationState.page);
  if (geometryPrimed) applyZoom();
  updateLightbox({ thumbScrollIntoView, preserveCurrentImage: preserveCurrentGeometry });
}

function moveLightbox(delta, options = {}) {
  if (!navigationState.catalog) return;
  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex(favoritesState.favoritesViewerIndex + delta, options);
    return;
  }
  setLightboxPage(navigationState.page + delta, options);
}

function openCatalogInViewer(id, page = 1, options = {}) {
  const catalog = catalogs.find((item) => item.id === id) || null;
  if (!catalog) return;
  const source = options.source === LIGHTBOX_SOURCE_FAVORITES
    ? LIGHTBOX_SOURCE_FAVORITES
    : LIGHTBOX_SOURCE_CATALOG;

  if (!isAppPage("viewer")) {
    navigateTo(viewerDocumentUrl(catalog.id, page, { source }));
    return;
  }

  navigationState.catalog = catalog;
  navigationState.page = clampPage(page, catalog);
  openLightbox(navigationState.page, { source, favoriteIndex: options.favoriteIndex });
}

function openCurrentFavoriteInCatalog() {
  if (!isViewerSessionOpen() || !isFavoritesLightboxMode() || !navigationState.catalog) return;

  const catalogId = navigationState.catalog.id;
  const page = navigationState.page;

  // Re-enter through the canonical catalog-viewer lifecycle instead of
  // partially mutating favorites state in place. Both routes now share the same
  // single-image renderer, so the transition receives one complete clean state.
  openCatalogInViewer(catalogId, page, { source: LIGHTBOX_SOURCE_CATALOG });
}

function attachViewerEvents() {
  attachViewerShareEvents();
  viewerElements.lightboxHomeLink?.addEventListener("click", returnToMainSiteFromLightbox);
  favoritesElements.favoriteOpenCatalogButton?.addEventListener("click", openCurrentFavoriteInCatalog);
  viewerElements.lightboxPinTopBar?.addEventListener("click", () => {
    toggleTopUiPinned();
    if (viewerState.viewerOnboardingOpen) scheduleViewerOnboardingLayout(40);
  });
  viewerElements.lightboxBackdrop?.addEventListener("click", closeLightbox);
  viewerElements.lightbox?.addEventListener("pointerdown", handleLightboxPageRailEdgePointerDown, { capture: true, passive: false });
  viewerElements.lightbox?.addEventListener("pointerdown", handleLightboxPointerDownCapture, { capture: true });
  viewerElements.fullscreenToggle?.addEventListener("click", () => toggleBrowserFullscreen(viewerElements.fullscreenToggle));
  viewerElements.prevPageBtn?.addEventListener("click", () => moveLightbox(-1));
  viewerElements.nextPageBtn?.addEventListener("click", () => moveLightbox(1));
  viewerElements.fitAutoBtn?.addEventListener("click", () => setViewerAutomaticFitMode());
  viewerElements.fitHeightBtn?.addEventListener("click", () => setViewerFitMode(VIEWER_FIT_HEIGHT));
  viewerElements.fitWidthBtn?.addEventListener("click", () => setViewerFitMode(VIEWER_FIT_WIDTH));
  viewerElements.viewerAutoZoomBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
  });
  viewerElements.viewerAutoZoomBtn?.addEventListener("pointerdown", (event) => event.stopPropagation());
  favoritesElements.viewerFavoriteButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleCurrentPageFavorite();
  });
  favoritesElements.viewerFavoriteButton?.addEventListener("pointerdown", (event) => event.stopPropagation());
  viewerElements.stageCanvas?.addEventListener("pointerdown", handleViewerSurfacePointerDown);
  viewerElements.viewerImageRetry?.addEventListener("click", retryCurrentViewerImage);

  attachViewerGestures();

  viewerElements.lightboxSideHotspot?.addEventListener("pointerdown", openPageRailFromTouch, { passive: false });
  viewerElements.lightboxSideHotspot?.addEventListener("mouseenter", showPageRailFromHover);
  viewerElements.lightboxSideHotspot?.addEventListener("mouseleave", schedulePageRailClose);
  viewerElements.lightboxSideHotspot?.addEventListener("click", openPageRailFromHotspot);
  viewerElements.lightboxPageRail?.addEventListener("pointerdown", markTouchLikeRailInput);
  viewerElements.lightboxPageRail?.addEventListener("mouseenter", keepPageRailOpenFromHover);
  viewerElements.lightboxPageRail?.addEventListener("mouseleave", (event) => {
    hideLightboxFloatingPreview();
    schedulePageRailClose(event);
  });
  viewerElements.lightbox?.addEventListener("pointerdown", handlePageRailPointerOutside);
  viewerElements.lightboxPageRail?.addEventListener("focusin", () => keepPageRailOpen({ scrollIntoView: false }));
  viewerElements.lightboxPageRail?.addEventListener("focusout", schedulePageRailClose);

  // Pointer-down is the reliable first event on touch devices; opening here
  // avoids depending on synthetic hover/click events after the hotspot moves
  // behind the revealed toolbar. Native click keeps keyboard activation intact.
  viewerElements.topHotspot?.addEventListener("pointerdown", openTopUiFromHotspot);
  viewerElements.topHotspot?.addEventListener("mouseenter", openTopUiFromHotspot);
  viewerElements.topHotspot?.addEventListener("click", openTopUiFromHotspot);
  viewerElements.lightboxBar?.addEventListener("mouseenter", () => showTopUiTemporarily(0));
  viewerElements.lightboxBar?.addEventListener("mouseleave", scheduleTopUiClose);
  document.addEventListener("pointerdown", markTouchLikeViewportInput, { passive: true });
  document.addEventListener("touchstart", markTouchLikeViewportInput, { passive: true });
  document.addEventListener("mousemove", handleLightboxEdgeHoverMove, { passive: true });
  document.addEventListener("mouseout", handleLightboxEdgeHoverViewportExit, { passive: true });
  document.documentElement?.addEventListener("mouseleave", handleLightboxEdgeHoverViewportExit, { passive: true });

  viewerElements.lightboxImage?.addEventListener("load", () => {
    setViewerLoading(false);
    viewerElements.lightbox?.classList.remove("is-page-loading");
    applyZoom();
  });

  ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach((eventName) => {
    document.addEventListener(eventName, handleBrowserFullscreenChange);
  });

  reconcileViewerFullscreenPhase("viewer-events-attached");
  syncFullscreenButtonUi();
}

function handleViewerResize() {
  if (!isViewerSessionOpen()) return;
  hideLightboxFloatingPreview();
  syncAutomaticViewerFitMode({ showUi: false, refreshLayout: false });
  refreshLightboxLayoutForTopUiChange();
  if (viewerState.viewerOnboardingOpen) scheduleViewerOnboardingLayout(40);
}

function handleViewerGlobalKeydown(event) {
  if (!isViewerSessionOpen()) return false;
  if (viewerState.viewerOnboardingOpen) {
    handleViewerOnboardingKeydown(event);
    return true;
  }

  const target = event.target;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return false;

  if (["ArrowDown", "PageDown", "ArrowUp", "PageUp", "ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
    stopViewerTouchMomentum();
  }

  if (["ArrowDown", "PageDown"].includes(event.key)) {
    event.preventDefault();
    moveLightbox(1);
  } else if (["ArrowUp", "PageUp"].includes(event.key)) {
    event.preventDefault();
    moveLightbox(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    moveLightbox(-1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveLightbox(1);
  } else if (event.key === "Home") {
    if (isFavoritesLightboxMode()) setFavoriteViewerIndex(0);
    else setLightboxPage(1);
  } else if (event.key === "End" && navigationState.catalog) {
    if (isFavoritesLightboxMode()) setFavoriteViewerIndex(getFavoriteEntries().length - 1);
    else setLightboxPage(navigationState.catalog.pages);
  } else {
    return false;
  }
  return true;
}

function prepareViewerRoute(nextPage) {
  if (nextPage !== "viewer" && isViewerSessionOpen()) hideLightboxUi();
  syncFullscreenButtonUi();
}

registerFeatureInterface("viewer", {
  escapePriority: 100,
  requiresDocumentLock: () => isViewerSessionOpen(),
  isViewerOpen: () => isViewerSessionOpen(),
  usesInDocumentFullscreenNavigation: viewerUsesInDocumentFullscreenNavigation,
  attachEvents: () => {
    attachViewerActionEvents();
    attachViewerOnboardingEvents();
    attachViewerEvents();
  },
  handleResize: handleViewerResize,
  handleGlobalKeydown: handleViewerGlobalKeydown,
  prepareRoute: prepareViewerRoute,
  openCatalog: (catalogId, page = 1, options = {}) => openCatalogInViewer(catalogId, page, options),
  close: (options = {}) => closeLightbox(options),
  refresh: (options = {}) => updateLightbox(options),
  renderPageRail: renderLightboxPageRail,
  prepareInquiry: () => {
    if (viewerState.viewerOnboardingOpen) closeViewerOnboarding({ restoreFocus: false });
    closeViewerMobileMoreMenu();
    if (getFeatureInterface("search")?.isLightboxMobileOpen?.()) {
      getFeatureInterface("search")?.setLightboxMobileOpen?.(false, { hideResults: true });
    }
  },
  setPage: (page, options = {}) => setLightboxPage(page, options),
  syncMobileSearchUi: (isOpen) => viewerElements.lightbox?.classList.toggle("mobile-search-open", Boolean(isOpen)),
  showTopUi: () => showTopUiTemporarily(0),
  containsTopBarElement: (element) => Boolean(element && viewerElements.lightboxBar?.contains(element)),
  hideTopUiForSearch: () => {
    if (viewerState.topUiPinned) return;
    window.clearTimeout(viewerState.uiHideTimer);
    viewerElements.lightbox?.classList.remove("show-ui");
  },
  closeTopLayer: (event) => {
    if (!isViewerSessionOpen()) return false;
    if (viewerState.viewerMobileMoreOpen) {
      closeViewerMobileMoreMenu({ returnFocus: true });
      return true;
    }
    if (viewerState.viewerOnboardingOpen) {
      closeViewerOnboarding();
      return true;
    }
    if (getFeatureInterface("search")?.closeViewerTopLayer?.()) return true;
    if (isBrowserFullscreenActive()) {
      exitBrowserFullscreen().catch(() => {});
      return true;
    }

    const target = event?.target;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
      getFeatureInterface("search")?.hideViewerResults?.({ blurTopUiFocus: true });
      return true;
    }
    closeLightbox();
    return true;
  }
});
/* ===== END SOURCE: src/js/60-viewer.js ===== */

/* ===== BEGIN SOURCE: src/js/62-viewer-actions.js ===== */
/**
 * Source module: 62-viewer-actions.js
 * Compact Viewer mobile utility menu.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into route-specific browser bundles.
 */

const MOBILE_VIEWER_TOOLBAR_MEDIA = "(max-width: 760px)";

function isMobileViewerToolbarMode() {
  return Boolean(window.matchMedia?.(MOBILE_VIEWER_TOOLBAR_MEDIA).matches);
}

function syncViewerMobileMoreMenuState() {
  const menu = viewerElements.viewerMobileMoreMenu;
  if (!menu) return;
  const fitMode = normalizeViewerFitMode(viewerState.imageFitMode);
  const automatic = viewerUsesAutomaticFitMode();
  const pinItem = menu.querySelector('[data-viewer-mobile-action="pin"]');
  const autoItem = menu.querySelector('[data-viewer-mobile-action="fit-auto"]');
  const heightItem = menu.querySelector('[data-viewer-mobile-action="fit-height"]');
  const widthItem = menu.querySelector('[data-viewer-mobile-action="fit-width"]');
  const pinLabel = menu.querySelector("[data-viewer-mobile-pin-label]");

  pinItem?.setAttribute("aria-checked", viewerState.topUiPinned ? "true" : "false");
  pinItem?.classList.toggle("active", viewerState.topUiPinned);
  if (pinLabel) pinLabel.textContent = viewerState.topUiPinned ? "ביטול נעיצת הסרגל" : "נעיצת הסרגל";
  autoItem?.setAttribute("aria-checked", automatic ? "true" : "false");
  autoItem?.classList.toggle("active", automatic);
  heightItem?.setAttribute("aria-checked", !automatic && fitMode === VIEWER_FIT_HEIGHT ? "true" : "false");
  heightItem?.classList.toggle("active", !automatic && fitMode === VIEWER_FIT_HEIGHT);
  widthItem?.setAttribute("aria-checked", !automatic && fitMode === VIEWER_FIT_WIDTH ? "true" : "false");
  widthItem?.classList.toggle("active", !automatic && fitMode === VIEWER_FIT_WIDTH);
  if (favoritesElements.viewerMobileFavoritesLink) favoritesElements.viewerMobileFavoritesLink.href = favoritesDocumentUrl();
}

function setViewerMobileMoreOpen(open, options = {}) {
  const shouldOpen = Boolean(open && isViewerSessionOpen() && isMobileViewerToolbarMode());
  viewerState.viewerMobileMoreOpen = shouldOpen;
  syncViewerMobileMoreMenuState();
  viewerElements.viewerMobileMoreMenu?.classList.toggle("hidden", !shouldOpen);
  viewerElements.viewerMobileMoreMenu?.classList.toggle("visible", shouldOpen);
  viewerElements.viewerMobileMoreToggle?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  viewerElements.viewerMobileMoreToggle?.classList.toggle("is-active", shouldOpen);
  viewerElements.lightbox?.classList.toggle("mobile-more-open", shouldOpen);

  if (shouldOpen) {
    showTopUiTemporarily(0);
    window.requestAnimationFrame(() => {
      viewerElements.viewerMobileMoreMenu?.querySelector('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')?.focus?.({ preventScroll: true });
    });
  } else if (options.returnFocus) {
    viewerElements.viewerMobileMoreToggle?.focus?.({ preventScroll: true });
  }
}

function closeViewerMobileMoreMenu(options = {}) {
  setViewerMobileMoreOpen(false, options);
}

function getViewerMobileMoreItems() {
  if (!viewerElements.viewerMobileMoreMenu) return [];
  return Array.from(viewerElements.viewerMobileMoreMenu.querySelectorAll(
    '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
  )).filter((item) => !item.classList.contains("hidden") && item.getAttribute("aria-hidden") !== "true");
}

function handleViewerMobileMoreKeydown(event) {
  if (!viewerState.viewerMobileMoreOpen) return;
  const items = getViewerMobileMoreItems();
  if (!items.length) return;

  const currentIndex = Math.max(0, items.indexOf(document.activeElement));
  let nextIndex = -1;
  if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % items.length;
  else if (event.key === "ArrowUp") nextIndex = (currentIndex - 1 + items.length) % items.length;
  else if (event.key === "Home") nextIndex = 0;
  else if (event.key === "End") nextIndex = items.length - 1;
  else return;

  event.preventDefault();
  items[nextIndex]?.focus?.({ preventScroll: true });
}

function handleViewerMobileMoreAction(event) {
  const item = event.target.closest?.("[data-viewer-mobile-action]");
  if (!item || !viewerElements.viewerMobileMoreMenu?.contains(item)) return;
  event.preventDefault();
  event.stopPropagation();
  const action = item.dataset.viewerMobileAction;

  if (action === "download") downloadCurrentLightboxImage();
  else if (action === "pin") toggleTopUiPinned();
  else if (action === "fit-auto") setViewerAutomaticFitMode({ showUi: false });
  else if (action === "fit-height") setViewerFitMode(VIEWER_FIT_HEIGHT, { showUi: false });
  else if (action === "fit-width") setViewerFitMode(VIEWER_FIT_WIDTH, { showUi: false });

  syncViewerMobileMoreMenuState();
  closeViewerMobileMoreMenu({ returnFocus: true });
}

function attachViewerActionEvents() {
  viewerElements.viewerMobileMoreToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setViewerMobileMoreOpen(!viewerState.viewerMobileMoreOpen, { returnFocus: viewerState.viewerMobileMoreOpen });
  });
  viewerElements.viewerMobileMoreMenu?.addEventListener("click", handleViewerMobileMoreAction);
  viewerElements.viewerMobileMoreMenu?.addEventListener("keydown", handleViewerMobileMoreKeydown);
  favoritesElements.viewerMobileFavoritesLink?.addEventListener("click", () => closeViewerMobileMoreMenu());

  document.addEventListener("pointerdown", (event) => {
    if (!viewerState.viewerMobileMoreOpen) return;
    if (viewerElements.viewerMobileMoreMenu?.contains(event.target) || viewerElements.viewerMobileMoreToggle?.contains(event.target)) return;
    closeViewerMobileMoreMenu();
  }, { passive: true });

  window.addEventListener("resize", () => {
    if (!isMobileViewerToolbarMode()) closeViewerMobileMoreMenu();
  });
}
/* ===== END SOURCE: src/js/62-viewer-actions.js ===== */

/* ===== BEGIN SOURCE: src/js/65-viewer-onboarding.js ===== */
/**
 * Source module: 65-viewer-onboarding.js
 * First-run viewer tour: steps, spotlight geometry, cloned controls, focus handling, and cleanup.
 *
 * Event ownership lives beside the feature. The generated browser bundle still exposes
 * no runtime module requests; tools/build_frontend_assets.py concatenates all sources.
 */

function getViewerOnboardingStorage() {
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
}

function viewerOnboardingWasSeen() {
  try {
    return getViewerOnboardingStorage()?.getItem(VIEWER_ONBOARDING_STORAGE_KEY) === "1";
  } catch (_error) {
    return false;
  }
}

function markViewerOnboardingSeen() {
  try {
    getViewerOnboardingStorage()?.setItem(VIEWER_ONBOARDING_STORAGE_KEY, "1");
  } catch (_error) {
    // The in-memory flag still prevents repeat display during this visit.
  }
}

function viewerHasTouchCapability() {
  return Number(navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
}

function viewerNavigationOnboardingCopy() {
  if (viewerHasTouchCapability()) {
    return "במסך מגע החליקו למעלה, למטה, ימינה או שמאלה כדי לעבור עמוד. בהגדלה, גררו בתוך התמונה; מעבר לקצה יעביר לעמוד הבא בלי לבטל את הזום. אפשר גם להשתמש בחצים שבצדי המסך או במקשי החצים ו־Page Up/Down.";
  }
  return "גללו בעכבר או במשטח המגע, לחצו על החצים שבצדי המסך, או השתמשו במקשי החצים ו־Page Up/Down. בהגדלה, הגלילה מזיזה את התמונה ומעבר לקצה מעביר עמוד בלי לבטל את הזום.";
}

function viewerZoomOnboardingCopy() {
  if (viewerHasTouchCapability()) {
    return "במסך מגע צבטו בשתי אצבעות או הקישו פעמיים. בעכבר אפשר ללחוץ פעמיים או להשתמש בגלגלת; לאחר ההגדלה גררו את התמונה.";
  }
  return "לחצו פעמיים על התמונה או השתמשו בגלגלת העכבר להגדלה; לאחר מכן גררו את התמונה למיקום הרצוי.";
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
      target: () => inquiryElements.viewerInquiryButton,
      floatingTargets: () => [
        { source: inquiryElements.viewerInquiryButton, id: "inquiry" },
        { source: favoritesElements.viewerFavoriteButton, id: "favorite" }
      ],
      preferredPlacement: "left",
      padding: 8,
      radius: 24,
      gesture: "tap"
    }
  ];
}

function getViewerOnboardingTopBarFocusRect() {
  const header = viewerElements.lightboxBar?.querySelector?.(".lightbox-reader-header");
  return header?.getBoundingClientRect?.() || viewerElements.lightboxBar?.getBoundingClientRect?.() || null;
}

function getViewerOnboardingPinFocusRect() {
  const source = viewerElements.lightboxPinTopBar?.getBoundingClientRect?.();
  if (!source) return null;

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const desiredPadding = 12;

  // The pin button sits close to the viewport's top edge. A regular padded
  // rectangle gets clipped only at the top and therefore looks shifted down.
  // Use the same available padding on opposite sides so the frame remains
  // visually centred around the real button even near a viewport boundary.
  const horizontalPadding = Math.max(0, Math.min(
    desiredPadding,
    Number(source.left || 0),
    Math.max(0, viewportWidth - Number(source.right || 0))
  ));
  const verticalPadding = Math.max(0, Math.min(
    desiredPadding,
    Number(source.top || 0),
    Math.max(0, viewportHeight - Number(source.bottom || 0))
  ));

  return {
    left: source.left - horizontalPadding,
    top: source.top - verticalPadding,
    right: source.right + horizontalPadding,
    bottom: source.bottom + verticalPadding,
    width: source.width + horizontalPadding * 2,
    height: source.height + verticalPadding * 2
  };
}

function getViewerOnboardingNavigationFocusRect() {
  const source = viewerElements.stageCanvas?.getBoundingClientRect?.() || viewerElements.lightboxStage?.getBoundingClientRect?.();
  if (!source) return null;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const width = Math.min(Math.max(240, source.width * 0.36), 460, Math.max(200, viewportWidth - 42));
  const height = Math.min(Math.max(150, source.height * 0.24), 230, Math.max(130, viewportHeight - 190));
  const centerX = source.left + source.width / 2;
  const centerY = source.top + source.height / 2;
  return {
    left: centerX - width / 2,
    top: centerY - height / 2,
    right: centerX + width / 2,
    bottom: centerY + height / 2,
    width,
    height
  };
}

function getViewerOnboardingPageRailFocusRect() {
  const source = viewerElements.lightboxPageRail?.getBoundingClientRect?.();
  if (!source) return null;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  if (viewportWidth > 700) return source;
  const height = Math.min(300, Math.max(220, source.height * 0.34));
  return {
    left: source.left,
    top: source.top,
    right: source.right,
    bottom: Math.min(source.bottom, source.top + height),
    width: source.width,
    height: Math.min(height, source.height)
  };
}

function getViewerOnboardingImageFocusRect() {
  const activeImageSurface = viewerElements.lightboxImageFrame;
  const source = activeImageSurface?.getBoundingClientRect?.() || viewerElements.stageCanvas?.getBoundingClientRect?.();
  if (!source) return null;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const width = Math.min(Math.max(220, source.width * 0.46), 430, Math.max(180, viewportWidth - 36));
  const height = Math.min(Math.max(170, source.height * 0.38), 300, Math.max(140, viewportHeight - 180));
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
  const controls = Array.from(viewerElements.viewerOnboarding.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.closest?.(".hidden"));
  const targets = [
    ...(viewerState.viewerOnboardingFloatingTargets || []).map((entry) => entry.clone),
    viewerState.viewerOnboardingTarget
  ].filter(Boolean);
  const targetControls = targets.flatMap((target) => [
    ...(target.matches?.('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ? [target] : []),
    ...Array.from(target.querySelectorAll?.('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') || [])
  ]);
  return [...new Set([...controls, ...targetControls])];
}

function setViewerOnboardingShadeRect(element, left, top, width, height) {
  if (!element) return;
  element.style.left = `${Math.max(0, left)}px`;
  element.style.top = `${Math.max(0, top)}px`;
  element.style.width = `${Math.max(0, width)}px`;
  element.style.height = `${Math.max(0, height)}px`;
}

function normalizeViewerOnboardingRect(rawRect, padding = 0, viewportMargin = 6) {
  if (!rawRect) return null;
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const margin = Math.max(0, Number(viewportMargin || 0));
  const left = Math.max(margin, Number(rawRect.left || 0) - padding);
  const top = Math.max(margin, Number(rawRect.top || 0) - padding);
  const right = Math.min(viewportWidth - margin, Number(rawRect.right || 0) + padding);
  const bottom = Math.min(viewportHeight - margin, Number(rawRect.bottom || 0) + padding);
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
  const all = ["below", "above", "left", "right"];
  return [preferred, ...all.filter((placement) => placement !== preferred)];
}

function calculateViewerOnboardingCalloutPosition(targetRect, calloutRect, preferredPlacement) {
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const margin = 12;
  const gap = 18;

  const coordinates = (placement) => {
    if (placement === "above") {
      return { left: targetRect.left + (targetRect.width - calloutRect.width) / 2, top: targetRect.top - calloutRect.height - gap };
    }
    if (placement === "left") {
      return { left: targetRect.left - calloutRect.width - gap, top: targetRect.top + (targetRect.height - calloutRect.height) / 2 };
    }
    if (placement === "right") {
      return { left: targetRect.right + gap, top: targetRect.top + (targetRect.height - calloutRect.height) / 2 };
    }
    return { left: targetRect.left + (targetRect.width - calloutRect.width) / 2, top: targetRect.bottom + gap };
  };

  const overflowScore = ({ left, top }) => {
    const overflowLeft = Math.max(0, margin - left);
    const overflowTop = Math.max(0, margin - top);
    const overflowRight = Math.max(0, left + calloutRect.width + margin - viewportWidth);
    const overflowBottom = Math.max(0, top + calloutRect.height + margin - viewportHeight);
    return overflowLeft + overflowTop + overflowRight + overflowBottom;
  };

  const maxLeft = Math.max(margin, viewportWidth - calloutRect.width - margin);
  const maxTop = Math.max(margin, viewportHeight - calloutRect.height - margin);
  const candidates = viewerOnboardingPlacementCandidates(preferredPlacement).map((placement) => {
    const point = coordinates(placement);
    const left = clampValue(point.left, margin, maxLeft);
    const top = clampValue(point.top, margin, maxTop);
    const overlapWidth = Math.max(0, Math.min(left + calloutRect.width, targetRect.right) - Math.max(left, targetRect.left));
    const overlapHeight = Math.max(0, Math.min(top + calloutRect.height, targetRect.bottom) - Math.max(top, targetRect.top));
    const overlapArea = overlapWidth * overlapHeight;
    const overflow = overflowScore(point);
    return {
      placement,
      left,
      top,
      overflow,
      overlapArea,
      score: (overlapArea > 0 ? 100000 + overlapArea : 0) + overflow
    };
  });
  const chosen = candidates.sort((a, b) => a.score - b.score)[0];
  return {
    placement: chosen.placement,
    left: chosen.left,
    top: chosen.top
  };
}

function removeViewerOnboardingFloatingTargets() {
  (viewerState.viewerOnboardingFloatingTargets || []).forEach((entry) => entry.clone?.remove?.());
  viewerState.viewerOnboardingFloatingTargets = [];
}

function sanitizeViewerOnboardingFloatingTarget(clone) {
  clone.removeAttribute("id");
  clone.removeAttribute("aria-controls");
  clone.removeAttribute("aria-describedby");
  clone.querySelectorAll?.("[id]").forEach((element) => element.removeAttribute("id"));
  clone.querySelectorAll?.("[aria-controls]").forEach((element) => element.removeAttribute("aria-controls"));
  clone.classList.remove("hidden");
  clone.removeAttribute("hidden");
}

function syncViewerOnboardingFloatingTargetState(source, clone) {
  ["aria-label", "aria-pressed", "title", "data-pinned", "data-fullscreen-active", "data-favorite-active"].forEach((attribute) => {
    if (source.hasAttribute(attribute)) clone.setAttribute(attribute, source.getAttribute(attribute));
    else clone.removeAttribute(attribute);
  });
  clone.disabled = Boolean(source.disabled);
}

function getViewerOnboardingFloatingTargetDefinitions(step) {
  const configured = step.floatingTargets?.()
    || (step.floatingTarget ? [{ source: step.floatingTarget(), id: "primary" }] : []);
  return configured.map((entry, index) => {
    const source = entry?.source || entry;
    if (!source) return null;
    return {
      source,
      id: String(entry?.id || `target-${index + 1}`)
    };
  }).filter(Boolean);
}

function viewerOnboardingFloatingTargetsMatch(step, definitions) {
  const current = viewerState.viewerOnboardingFloatingTargets || [];
  return current.length === definitions.length && current.every((entry, index) => (
    entry.source === definitions[index].source
    && entry.id === definitions[index].id
    && entry.stepId === step.id
  ));
}

function updateViewerOnboardingFloatingTargets(step) {
  const definitions = getViewerOnboardingFloatingTargetDefinitions(step);
  if (!definitions.length || !viewerElements.viewerOnboarding) {
    removeViewerOnboardingFloatingTargets();
    return;
  }

  if (!viewerOnboardingFloatingTargetsMatch(step, definitions)) {
    removeViewerOnboardingFloatingTargets();
    viewerState.viewerOnboardingFloatingTargets = definitions.map(({ source, id }) => {
      const clone = source.cloneNode(true);
      sanitizeViewerOnboardingFloatingTarget(clone);
      clone.classList.add("viewer-onboarding-floating-target");
      clone.dataset.tourStep = step.id;
      clone.dataset.tourTarget = id;
      clone.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        source.click();
        window.requestAnimationFrame(() => {
          const isCurrentClone = (viewerState.viewerOnboardingFloatingTargets || [])
            .some((entry) => entry.clone === clone);
          if (!viewerState.viewerOnboardingOpen || !isCurrentClone) return;
          syncViewerOnboardingFloatingTargetState(source, clone);
          scheduleViewerOnboardingLayout(30);
        });
      });
      viewerElements.viewerOnboarding.appendChild(clone);
      return { source, clone, id, stepId: step.id };
    });
  }

  viewerState.viewerOnboardingFloatingTargets.forEach(({ source, clone }) => {
    syncViewerOnboardingFloatingTargetState(source, clone);
    const rect = source.getBoundingClientRect();
    clone.style.left = `${rect.left}px`;
    clone.style.top = `${rect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
  });
}

function layoutViewerOnboarding() {
  if (!viewerState.viewerOnboardingOpen || !viewerElements.viewerOnboarding || !viewerElements.viewerOnboardingCard || !viewerElements.viewerOnboardingSpotlight) return;
  const steps = getViewerOnboardingSteps();
  const step = steps[viewerState.viewerOnboardingStep];
  if (!step) return;

  const target = step.target?.() || null;
  viewerState.viewerOnboardingTarget = target;
  const rawRect = step.targetRect?.() || target?.getBoundingClientRect?.();
  const targetRect = normalizeViewerOnboardingRect(
    rawRect,
    Number(step.padding || 0),
    step.viewportMargin === undefined ? 6 : Number(step.viewportMargin)
  );
  if (!targetRect) return;

  updateViewerOnboardingFloatingTargets(step);

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  setViewerOnboardingShadeRect(viewerElements.viewerOnboardingShadeTop, 0, 0, viewportWidth, targetRect.top);
  setViewerOnboardingShadeRect(viewerElements.viewerOnboardingShadeBottom, 0, targetRect.bottom, viewportWidth, viewportHeight - targetRect.bottom);
  setViewerOnboardingShadeRect(viewerElements.viewerOnboardingShadeLeft, 0, targetRect.top, targetRect.left, targetRect.height);
  setViewerOnboardingShadeRect(viewerElements.viewerOnboardingShadeRight, targetRect.right, targetRect.top, viewportWidth - targetRect.right, targetRect.height);

  const spotlight = viewerElements.viewerOnboardingSpotlight;
  spotlight.style.left = `${targetRect.left}px`;
  spotlight.style.top = `${targetRect.top}px`;
  spotlight.style.width = `${targetRect.width}px`;
  spotlight.style.height = `${targetRect.height}px`;
  spotlight.style.borderRadius = `${Number(step.radius || 18)}px`;
  spotlight.dataset.gesture = step.gesture || "";
  spotlight.dataset.tourStep = step.id || "";

  const calloutRect = viewerElements.viewerOnboardingCard.getBoundingClientRect();
  const calloutPosition = calculateViewerOnboardingCalloutPosition(targetRect, calloutRect, step.preferredPlacement || "below");
  viewerElements.viewerOnboardingCard.style.left = `${calloutPosition.left}px`;
  viewerElements.viewerOnboardingCard.style.top = `${calloutPosition.top}px`;
  viewerElements.viewerOnboardingCard.dataset.placement = calloutPosition.placement;
}

function scheduleViewerOnboardingLayout(delay = 0) {
  const run = () => {
    window.cancelAnimationFrame(viewerState.viewerOnboardingLayoutRaf);
    viewerState.viewerOnboardingLayoutRaf = window.requestAnimationFrame(layoutViewerOnboarding);
  };

  if (delay > 0) {
    // Keep the immediate layout that was scheduled for this step. The delayed
    // pass only re-measures after toolbar/callout transitions have settled.
    window.clearTimeout(viewerState.viewerOnboardingLayoutTimer);
    viewerState.viewerOnboardingLayoutTimer = window.setTimeout(run, delay);
    return;
  }

  run();
}

function renderViewerOnboardingStep(options = {}) {
  if (!viewerState.viewerOnboardingOpen) return;
  const { focus = true, scheduleLayout = true } = options;
  const steps = getViewerOnboardingSteps();
  viewerState.viewerOnboardingStep = clampValue(viewerState.viewerOnboardingStep, 0, Math.max(0, steps.length - 1));
  const step = steps[viewerState.viewerOnboardingStep];
  if (!step) return;

  const floatingTargetsBelongToStep = (viewerState.viewerOnboardingFloatingTargets || [])
    .every((entry) => entry.stepId === step.id);
  if (!floatingTargetsBelongToStep) {
    removeViewerOnboardingFloatingTargets();
  }

  viewerElements.lightbox?.classList.toggle("viewer-tour-show-top-ui", Boolean(step.revealTopBar));
  viewerElements.lightbox?.classList.toggle("viewer-tour-show-page-rail", Boolean(step.revealPageRail));
  if (step.revealTopBar) window.clearTimeout(viewerState.uiHideTimer);
  if (step.revealPageRail) window.clearTimeout(viewerState.pageRailHideTimer);

  if (viewerElements.viewerOnboardingEyebrow) viewerElements.viewerOnboardingEyebrow.textContent = step.eyebrow || "סיור קצר";
  if (viewerElements.viewerOnboardingTitle) viewerElements.viewerOnboardingTitle.textContent = step.title;
  if (viewerElements.viewerOnboardingDescription) viewerElements.viewerOnboardingDescription.textContent = step.description;
  if (viewerElements.viewerOnboardingCounter) viewerElements.viewerOnboardingCounter.textContent = `${viewerState.viewerOnboardingStep + 1} מתוך ${steps.length}`;
  if (viewerElements.viewerOnboardingNote) {
    viewerElements.viewerOnboardingNote.textContent = step.note || "";
    viewerElements.viewerOnboardingNote.classList.toggle("hidden", !step.note);
  }
  if (viewerElements.viewerOnboardingPrevious) viewerElements.viewerOnboardingPrevious.disabled = viewerState.viewerOnboardingStep === 0;
  if (viewerElements.viewerOnboardingNext) {
    viewerElements.viewerOnboardingNext.textContent = viewerState.viewerOnboardingStep === steps.length - 1 ? "סיום" : "הבא";
  }
  if (viewerElements.viewerOnboardingDots) {
    viewerElements.viewerOnboardingDots.innerHTML = steps.map((_, index) => (
      `<span${index === viewerState.viewerOnboardingStep ? ' class="active"' : ""}></span>`
    )).join("");
  }

  if (scheduleLayout) {
    scheduleViewerOnboardingLayout();
    scheduleViewerOnboardingLayout(260);
  }
  if (focus) window.requestAnimationFrame(() => viewerElements.viewerOnboardingNext?.focus?.({ preventScroll: true }));
}

function moveViewerOnboardingStep(delta) {
  if (!viewerState.viewerOnboardingOpen) return;
  const steps = getViewerOnboardingSteps();
  const nextStep = viewerState.viewerOnboardingStep + delta;
  if (nextStep >= steps.length) {
    closeViewerOnboarding();
    return;
  }
  viewerState.viewerOnboardingStep = clampValue(nextStep, 0, Math.max(0, steps.length - 1));
  renderViewerOnboardingStep();
}

function restoreViewerUiAfterOnboarding() {
  const restore = viewerState.viewerOnboardingRestoreUi || {};
  viewerElements.lightbox?.classList.remove("viewer-tour-active", "viewer-tour-show-top-ui", "viewer-tour-show-page-rail");
  if (viewerElements.lightbox) {
    if (viewerState.topUiPinned || restore.showUi) viewerElements.lightbox.classList.add("show-ui");
    else viewerElements.lightbox.classList.remove("show-ui");
    if (restore.showPageRail) viewerElements.lightbox.classList.add("show-page-rail");
    else viewerElements.lightbox.classList.remove("show-page-rail");
  }
  viewerState.viewerOnboardingRestoreUi = null;
}

function closeViewerOnboarding(options = {}) {
  if (!viewerState.viewerOnboardingOpen) return;
  const { restoreFocus = true, remember = true } = options;
  viewerState.viewerOnboardingOpen = false;
  viewerState.viewerOnboardingTarget = null;
  removeViewerOnboardingFloatingTargets();
  window.cancelAnimationFrame(viewerState.viewerOnboardingLayoutRaf);
  window.clearTimeout(viewerState.viewerOnboardingLayoutTimer);
  if (remember) markViewerOnboardingSeen();
  restoreViewerUiAfterOnboarding();
  viewerElements.viewerOnboarding?.classList.remove("visible");
  viewerElements.viewerOnboarding?.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    if (viewerState.viewerOnboardingOpen) return;
    viewerElements.viewerOnboarding?.classList.add("hidden");
    viewerElements.viewerOnboarding?.classList.remove("layout-ready");
  }, 220);
  if (restoreFocus) viewerElements.stageCanvas?.focus?.({ preventScroll: true });
}

function showViewerOnboardingIfNeeded() {
  if (!isViewerSessionOpen() || !viewerElements.viewerOnboarding || viewerState.viewerOnboardingOpen) return;
  if (viewerState.viewerOnboardingShownThisSession || viewerOnboardingWasSeen()) return;

  viewerState.viewerOnboardingShownThisSession = true;
  viewerState.viewerOnboardingOpen = true;
  viewerState.viewerOnboardingStep = 0;
  viewerState.viewerOnboardingRestoreUi = {
    showUi: Boolean(viewerElements.lightbox?.classList.contains("show-ui")),
    showPageRail: Boolean(viewerElements.lightbox?.classList.contains("show-page-rail"))
  };
  viewerElements.lightbox?.classList.add("viewer-tour-active");
  viewerElements.viewerOnboarding.classList.remove("hidden", "visible", "layout-ready");
  viewerElements.viewerOnboarding.setAttribute("aria-hidden", "false");

  // Build and measure the first step while the tour is still transparent.
  // Waiting one frame after revealing the real toolbar lets its layout settle,
  // so the callout is already in its final position before the fade-in begins.
  window.requestAnimationFrame(() => {
    if (!viewerState.viewerOnboardingOpen) return;
    renderViewerOnboardingStep({ focus: false, scheduleLayout: false });
    window.requestAnimationFrame(() => {
      if (!viewerState.viewerOnboardingOpen) return;
      layoutViewerOnboarding();
      viewerElements.viewerOnboarding.classList.add("layout-ready");
      window.requestAnimationFrame(() => {
        if (!viewerState.viewerOnboardingOpen) return;
        viewerElements.viewerOnboarding.classList.add("visible");
        viewerElements.viewerOnboardingNext?.focus?.({ preventScroll: true });
        scheduleViewerOnboardingLayout(260);
      });
    });
  });
}

function handleViewerOnboardingKeydown(event) {
  if (!viewerState.viewerOnboardingOpen) return false;
  if (event.key === "Escape") {
    event.preventDefault();
    closeViewerOnboarding();
    return true;
  }
  if (event.key !== "Tab") return true;

  const focusable = getViewerOnboardingFocusableElements();
  if (!focusable.length) {
    event.preventDefault();
    return true;
  }
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
  return true;
}

function attachViewerOnboardingEvents() {
  viewerElements.viewerOnboardingPrevious?.addEventListener("click", () => moveViewerOnboardingStep(-1));
  viewerElements.viewerOnboardingNext?.addEventListener("click", () => moveViewerOnboardingStep(1));
  viewerElements.viewerOnboardingSkip?.addEventListener("click", () => closeViewerOnboarding());
}
/* ===== END SOURCE: src/js/65-viewer-onboarding.js ===== */

/* ===== BEGIN SOURCE: src/js/70-viewer-input.js ===== */
/**
 * Source module: 70-viewer-input.js
 * Viewer input boundary: pointer pan/pinch, wheel zoom/page turns, double-click/tap, and discrete swipes.
 *
 * Keeping raw input translation separate from viewer rendering makes interaction changes
 * testable without mixing them into page loading, layout, or route behavior.
 */

function getZoomSurfaceName(surface) {
  return surface === viewerElements.stageCanvas ? "catalog-page" : "";
}

function isActiveZoomSurface(surface) {
  return Boolean(getZoomSurfaceName(surface));
}

function captureViewerPointer(surface, pointerId) {
  if (!surface || typeof surface.setPointerCapture !== "function") return false;

  try {
    surface.setPointerCapture(pointerId);
    return true;
  } catch (error) {
    // Synthetic pointer events and a pointer that ended during a browser-driven
    // transition may not be eligible for capture. The gesture remains usable
    // without capture, so only suppress the expected lifecycle exception.
    if (error?.name === "NotFoundError") return false;
    throw error;
  }
}

function releaseViewerPointerCapture(surface, pointerId) {
  if (!surface || typeof surface.releasePointerCapture !== "function") return false;

  try {
    if (typeof surface.hasPointerCapture === "function" && !surface.hasPointerCapture(pointerId)) {
      return false;
    }
    surface.releasePointerCapture(pointerId);
    return true;
  } catch (error) {
    // Pointer capture can be released implicitly before pointerup/pointercancel
    // reaches this handler. That is a normal browser lifecycle race, not an app
    // failure. Preserve unexpected exceptions so real defects remain visible.
    if (error?.name === "NotFoundError") return false;
    throw error;
  }
}

function getViewerPointerEventTime(event) {
  const eventTime = Number(event?.timeStamp);
  if (Number.isFinite(eventTime) && eventTime > 0) return eventTime;
  return Date.now();
}

function stopViewerTouchMomentum() {
  if (viewerState.viewerTouchMomentumRaf) {
    window.cancelAnimationFrame(viewerState.viewerTouchMomentumRaf);
  }
  viewerState.viewerTouchMomentumRaf = 0;
  viewerState.viewerTouchMomentumVelocityX = 0;
  viewerState.viewerTouchMomentumVelocityY = 0;
  viewerState.viewerTouchMomentumLastTime = 0;
}

function getViewerPointerMoveSamples(event) {
  let samples = [];
  if (typeof event?.getCoalescedEvents === "function") {
    try {
      const coalesced = event.getCoalescedEvents();
      if (Array.isArray(coalesced)) samples = coalesced.filter(Boolean);
    } catch (_error) {
      // Some browser/device combinations expose the method but reject calls
      // outside their native dispatch path. The primary event is sufficient.
    }
  }

  const finalSample = samples[samples.length - 1];
  if (
    !finalSample
    || finalSample.clientX !== event.clientX
    || finalSample.clientY !== event.clientY
  ) {
    samples.push(event);
  }
  return samples;
}

function updateViewerPointerVelocity(point, deltaX, deltaY, sampleTime) {
  const elapsed = sampleTime - point.lastTime;
  const safeElapsed = Number.isFinite(elapsed) && elapsed > 0
    ? Math.min(elapsed, VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS)
    : 16.67;
  const instantVelocityX = deltaX / safeElapsed;
  const instantVelocityY = deltaY / safeElapsed;
  const sampleIsFresh = Number.isFinite(elapsed)
    && elapsed > 0
    && elapsed <= VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS;
  const previousWeight = sampleIsFresh ? 1 - VIEWER_TOUCH_VELOCITY_BLEND : 0;
  const nextWeight = sampleIsFresh ? VIEWER_TOUCH_VELOCITY_BLEND : 1;

  return {
    velocityX: (Number(point.velocityX) || 0) * previousWeight + instantVelocityX * nextWeight,
    velocityY: (Number(point.velocityY) || 0) * previousWeight + instantVelocityY * nextWeight,
    lastTime: sampleTime
  };
}

function consumeViewerPointerPanSamples(event, initialPoint) {
  let point = initialPoint;
  let totalDeltaX = 0;
  let totalDeltaY = 0;

  for (const sample of getViewerPointerMoveSamples(event)) {
    const x = Number(sample.clientX);
    const y = Number(sample.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const deltaX = point.x - x;
    const deltaY = point.y - y;
    if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) continue;

    const sampleTime = getViewerPointerEventTime(sample);
    const velocity = updateViewerPointerVelocity(point, deltaX, deltaY, sampleTime);
    totalDeltaX += deltaX;
    totalDeltaY += deltaY;
    point = {
      ...point,
      x,
      y,
      ...velocity
    };
  }

  viewerState.pointers.set(event.pointerId, point);
  if (Math.abs(totalDeltaX) < 0.01 && Math.abs(totalDeltaY) < 0.01) {
    return { point, handled: false, moved: false, turned: false };
  }

  const boundary = consumeSingleViewerBoundaryInput(totalDeltaX, totalDeltaY, {
    pointerId: event.pointerId
  });
  return {
    point,
    handled: boundary.handled,
    moved: boundary.moved,
    turned: boundary.turned
  };
}

function clampViewerTouchMomentumVelocity(velocityX, velocityY) {
  const safeVelocityX = Number.isFinite(velocityX) ? velocityX : 0;
  const safeVelocityY = Number.isFinite(velocityY) ? velocityY : 0;
  const speed = Math.hypot(safeVelocityX, safeVelocityY);
  if (speed <= VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS) {
    return { velocityX: safeVelocityX, velocityY: safeVelocityY };
  }

  const scale = VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS / speed;
  return {
    velocityX: safeVelocityX * scale,
    velocityY: safeVelocityY * scale
  };
}

function scheduleViewerTouchMomentumFrame() {
  viewerState.viewerTouchMomentumRaf = window.requestAnimationFrame(runViewerTouchMomentumFrame);
}

function runViewerTouchMomentumFrame(timestamp) {
  viewerState.viewerTouchMomentumRaf = 0;
  if (
    !isViewerSessionOpen()
    || viewerState.pointers.size > 0
    || !singleViewerUsesBoundaryPan()
  ) {
    stopViewerTouchMomentum();
    return;
  }

  const frameTime = Number(timestamp);
  if (!Number.isFinite(frameTime)) {
    stopViewerTouchMomentum();
    return;
  }
  if (!viewerState.viewerTouchMomentumLastTime) {
    viewerState.viewerTouchMomentumLastTime = frameTime;
    scheduleViewerTouchMomentumFrame();
    return;
  }

  const elapsed = clampValue(
    frameTime - viewerState.viewerTouchMomentumLastTime,
    1,
    VIEWER_TOUCH_MOMENTUM_MAX_FRAME_MS
  );
  viewerState.viewerTouchMomentumLastTime = frameTime;

  let velocityX = viewerState.viewerTouchMomentumVelocityX;
  let velocityY = viewerState.viewerTouchMomentumVelocityY;
  const boundary = consumeSingleViewerBoundaryInput(
    velocityX * elapsed,
    velocityY * elapsed
  );
  if (!boundary.handled) {
    stopViewerTouchMomentum();
    return;
  }

  const remainingDeltaX = boundary.result?.remainingDeltaX || 0;
  const remainingDeltaY = boundary.result?.remainingDeltaY || 0;
  if (
    Math.abs(remainingDeltaX) > VIEWER_PAGE_TURN_REMAINDER_EPSILON
    && Math.sign(remainingDeltaX) === Math.sign(velocityX)
  ) {
    velocityX = 0;
  }
  if (
    !boundary.turned
    && Math.abs(remainingDeltaY) > VIEWER_PAGE_TURN_REMAINDER_EPSILON
    && Math.sign(remainingDeltaY) === Math.sign(velocityY)
  ) {
    velocityY = 0;
  }

  const decay = Math.exp(-VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS * elapsed);
  velocityX *= decay;
  velocityY *= decay;
  if (Math.abs(velocityX) < VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS) velocityX = 0;
  if (Math.abs(velocityY) < VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS) velocityY = 0;

  viewerState.viewerTouchMomentumVelocityX = velocityX;
  viewerState.viewerTouchMomentumVelocityY = velocityY;
  if (!velocityX && !velocityY) {
    stopViewerTouchMomentum();
    return;
  }
  scheduleViewerTouchMomentumFrame();
}

function startViewerTouchMomentum(velocityX, velocityY) {
  stopViewerTouchMomentum();
  const velocity = clampViewerTouchMomentumVelocity(velocityX, velocityY);
  if (
    Math.hypot(velocity.velocityX, velocity.velocityY)
    < VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS
  ) {
    return false;
  }

  viewerState.viewerTouchMomentumVelocityX = velocity.velocityX;
  viewerState.viewerTouchMomentumVelocityY = velocity.velocityY;
  scheduleViewerTouchMomentumFrame();
  return true;
}

function startPointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;

  stopViewerTouchMomentum();

  if (viewerState.pointers.size === 0) {
    viewerState.pointerGestureHadMultiplePointers = false;
    viewerState.pointerGestureConsumedPan = false;
  }

  viewerState.pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    velocityX: 0,
    velocityY: 0,
    lastTime: getViewerPointerEventTime(event)
  });
  if (viewerState.pointers.size >= 2) viewerState.pointerGestureHadMultiplePointers = true;

  if (singleViewerUsesBoundaryPan() || viewerState.pointers.size >= 2) {
    captureViewerPointer(event.currentTarget, event.pointerId);
  }

  const pointers = getPointerList();
  if (pointers.length === 1) {
    viewerState.dragStartX = event.clientX;
    viewerState.dragStartY = event.clientY;
    viewerState.dragStartPanX = viewerState.panX;
    viewerState.dragStartPanY = viewerState.panY;
  } else if (pointers.length === 2) {
    const [first, second] = pointers;
    const mid = pointerMidpoint(first, second);
    viewerState.pinchStartDistance = Math.max(1, pointerDistance(first, second));
    viewerState.pinchStartZoom = viewerState.zoom;
    viewerState.pinchLastMidX = mid.x;
    viewerState.pinchLastMidY = mid.y;
    for (const pointerId of viewerState.pointers.keys()) {
      captureViewerPointer(event.currentTarget, pointerId);
    }
    event.preventDefault();
  }
}

function movePointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;

  const previousPoint = viewerState.pointers.get(event.pointerId);
  if (!previousPoint) return;
  const pointerCount = viewerState.pointers.size;

  if (pointerCount >= 2) {
    viewerState.pointers.set(event.pointerId, {
      ...previousPoint,
      x: event.clientX,
      y: event.clientY,
      lastTime: getViewerPointerEventTime(event),
      velocityX: 0,
      velocityY: 0
    });
    const pointers = getPointerList();
    event.preventDefault();
    viewerState.pointerGestureConsumedPan = true;
    const [first, second] = pointers;
    const distance = Math.max(1, pointerDistance(first, second));
    const mid = pointerMidpoint(first, second);
    viewerState.panX += mid.x - viewerState.pinchLastMidX;
    viewerState.panY += mid.y - viewerState.pinchLastMidY;
    viewerState.pinchLastMidX = mid.x;
    viewerState.pinchLastMidY = mid.y;
    setZoom(viewerState.pinchStartZoom * (distance / viewerState.pinchStartDistance), {
      showUi: false,
      focalClientX: mid.x,
      focalClientY: mid.y
    });
    return;
  }

  if (pointerCount === 1 && singleViewerUsesBoundaryPan()) {
    event.preventDefault();
    const pan = consumeViewerPointerPanSamples(event, previousPoint);
    // Once a pannable/zoomed surface owns a real one-finger movement, the
    // release must not fall through to the separate page-swipe recognizer.
    // This remains true at a clamped horizontal safety edge where no pixels move.
    if (pan.handled) viewerState.pointerGestureConsumedPan = true;
  }
}

function handlePotentialDoubleTap(event, startedX, startedY) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return false;
  if (viewerState.pointers.size > 0 || viewerState.pointerGestureConsumedPan) return false;

  const moved = Math.hypot(event.clientX - startedX, event.clientY - startedY);
  if (moved > TAP_MOVE_TOLERANCE) {
    viewerState.lastTapAt = 0;
    return false;
  }

  const now = Date.now();
  const surface = getZoomSurfaceName(event.currentTarget);
  const closeToLastTap = Math.hypot(event.clientX - viewerState.lastTapX, event.clientY - viewerState.lastTapY) <= DOUBLE_TAP_DISTANCE;
  const isDoubleTap =
    surface === viewerState.lastTapSurface
    && now - viewerState.lastTapAt <= DOUBLE_TAP_DELAY
    && closeToLastTap;

  viewerState.lastTapAt = now;
  viewerState.lastTapX = event.clientX;
  viewerState.lastTapY = event.clientY;
  viewerState.lastTapSurface = surface;

  if (!isDoubleTap) return false;

  event.preventDefault();
  viewerState.lastTapAt = 0;
  viewerState.suppressNextDblClickUntil = now + 550;
  toggleZoomAtPoint(event.clientX, event.clientY);
  return true;
}

function handleViewerPageSwipe(event, startedX, startedY) {
  if (!isTouchLikePointer(event)) return false;
  if (viewerState.pointers.size > 0 || viewerState.pointerGestureHadMultiplePointers || viewerState.pointerGestureConsumedPan) return false;

  const dx = event.clientX - startedX;
  const dy = event.clientY - startedY;
  const horizontal = Math.abs(dx) > Math.abs(dy);
  const primaryDistance = horizontal ? Math.abs(dx) : Math.abs(dy);
  const secondaryDistance = horizontal ? Math.abs(dy) : Math.abs(dx);
  if (
    primaryDistance <= VIEWER_PAGE_SWIPE_MIN_DISTANCE
    || primaryDistance <= secondaryDistance * VIEWER_PAGE_SWIPE_AXIS_RATIO
  ) {
    return false;
  }

  event.preventDefault();
  const direction = horizontal
    ? (dx > 0 ? 1 : -1)
    : (dy < 0 ? 1 : -1);
  moveLightbox(direction, {
    keepZoom: true,
    positionMode: "page-turn",
    pageTurnDirection: direction,
    pageTurnAxis: horizontal ? "x" : "y"
  });
  return true;
}

function endPointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;
  let tracked = viewerState.pointers.get(event.pointerId);
  if (!tracked) return;
  if (
    viewerState.pointers.size === 1
    && singleViewerUsesBoundaryPan()
    && (
      Math.abs(tracked.x - event.clientX) >= 0.01
      || Math.abs(tracked.y - event.clientY) >= 0.01
    )
  ) {
    event.preventDefault();
    const finalPan = consumeViewerPointerPanSamples(event, tracked);
    tracked = finalPan.point;
    if (finalPan.handled) viewerState.pointerGestureConsumedPan = true;
  }
  const releaseTime = getViewerPointerEventTime(event);
  const velocityAge = releaseTime - tracked.lastTime;
  const velocityIsFresh = velocityAge >= 0 && velocityAge <= VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS;
  const shouldStartMomentum = Boolean(
    isTouchLikePointer(event)
    && viewerState.pointers.size === 1
    && !viewerState.pointerGestureHadMultiplePointers
    && viewerState.pointerGestureConsumedPan
    && velocityIsFresh
  );
  viewerState.pointers.delete(event.pointerId);

  const handledDoubleTap = handlePotentialDoubleTap(event, tracked.startX, tracked.startY);
  if (!handledDoubleTap) handleViewerPageSwipe(event, tracked.startX, tracked.startY);

  const pointers = getPointerList();
  if (pointers.length === 1) {
    const only = pointers[0];
    viewerState.dragStartX = only.x;
    viewerState.dragStartY = only.y;
    viewerState.dragStartPanX = viewerState.panX;
    viewerState.dragStartPanY = viewerState.panY;
  } else if (pointers.length === 0) {
    viewerState.pointerGestureHadMultiplePointers = false;
    viewerState.pointerGestureConsumedPan = false;
  }
  releaseViewerPointerCapture(event.currentTarget, event.pointerId);
  if (shouldStartMomentum) {
    startViewerTouchMomentum(tracked.velocityX, tracked.velocityY);
  }
}

function cancelPointerInteraction(event) {
  if (!viewerState.pointers.has(event.pointerId)) return;
  viewerState.pointers.delete(event.pointerId);
  if (viewerState.pointers.size === 0) {
    viewerState.pointerGestureHadMultiplePointers = false;
    viewerState.pointerGestureConsumedPan = false;
    stopViewerTouchMomentum();
  }
}

function getWheelZoomFactor(event) {
  const pixelMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PIXEL : 0;
  const lineMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_LINE : 1;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;
  const rawDelta = Number(event.deltaY);
  const delta = normalizeWheelDeltaToPixels(rawDelta, event.deltaMode, event.currentTarget?.clientHeight || 0);
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return 1;

  const direction = delta < 0 ? 1 : -1;
  const absoluteDelta = Math.abs(delta);
  const looksLikeDiscreteWheel =
    event.deltaMode === lineMode
    || event.deltaMode === pageMode
    || (event.deltaMode === pixelMode && absoluteDelta >= 40);

  if (looksLikeDiscreteWheel) {
    const detents = event.deltaMode === lineMode
      ? Math.max(1, Math.abs(rawDelta) / 3)
      : event.deltaMode === pageMode
        ? 1
        : Math.max(1, absoluteDelta / 100);
    const boundedDetents = clampValue(detents, 1, 3);
    return Math.pow(1.12, direction * boundedDetents);
  }

  const precisionDelta = clampValue(delta, -20, 20);
  return Math.exp(-precisionDelta * 0.011);
}

function handleZoomSurfaceWheel(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;

  stopViewerTouchMomentum();

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    event.stopPropagation();
    const factor = getWheelZoomFactor(event);
    if (factor === 1) return;
    setZoom(viewerState.zoom * factor, {
      showUi: false,
      focalClientX: event.clientX,
      focalClientY: event.clientY
    });
    return;
  }

  handleViewerPageWheel(event);
}

function handleZoomSurfaceDoubleClick(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;
  if (Date.now() < viewerState.suppressNextDblClickUntil) return;

  event.preventDefault();
  event.stopPropagation();
  toggleZoomAtPoint(event.clientX, event.clientY);
}

function attachZoomSurfaceGestures(surface) {
  if (!surface) return;
  surface.addEventListener("pointerdown", startPointerInteraction);
  surface.addEventListener("pointermove", movePointerInteraction);
  surface.addEventListener("pointerup", endPointerInteraction);
  surface.addEventListener("pointercancel", cancelPointerInteraction);
  surface.addEventListener("wheel", handleZoomSurfaceWheel, { passive: false });
  surface.addEventListener("dblclick", handleZoomSurfaceDoubleClick);
}

function attachViewerGestures() {
  attachZoomSurfaceGestures(viewerElements.stageCanvas);
}

function isLightboxTopInteractiveTarget(target) {
  if (!target || typeof target.closest !== "function") return false;

  const interactiveTarget = target.closest(
    ".lightbox-reader-header, .lightbox-search-results, .reader-catalog-menu, .reader-search-scope-menu"
  );
  return Boolean(interactiveTarget && viewerElements.lightboxBar?.contains(interactiveTarget));
}

function hideLightboxTopSearchFromViewerInteraction(event) {
  if (!isViewerSessionOpen()) return false;
  if (event?.button !== undefined && event.button !== 0) return false;
  if (isLightboxTopInteractiveTarget(event?.target)) return false;

  if (getFeatureInterface("search")?.isLightboxMobileOpen?.()) {
    getFeatureInterface("search")?.setLightboxMobileOpen?.(false, { hideResults: true, hideTopUi: true });
  } else {
    hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi: true });
  }
  return true;
}

function handleViewerSurfacePointerDown(event) {
  hideLightboxTopSearchFromViewerInteraction(event);
}

function handleLightboxPointerDownCapture(event) {
  stopViewerTouchMomentum();
  hideLightboxTopSearchFromViewerInteraction(event);
}
/* ===== END SOURCE: src/js/70-viewer-input.js ===== */

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
