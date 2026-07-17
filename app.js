/*
 * GENERATED FILE — DO NOT EDIT DIRECTLY.
 * Browser bundle: app.js
 * Source modules:
 *   - src/js/00-navigation.js
 *   - src/js/10-app-state.js
 *   - src/js/15-telemetry.js
 *   - src/js/20-shared-ui.js
 *   - src/js/30-favorites-share.js
 *   - src/js/40-catalog-grid.js
 *   - src/js/50-search-ui.js
 *   - src/js/60-viewer.js
 *   - src/js/62-viewer-actions.js
 *   - src/js/65-viewer-onboarding.js
 *   - src/js/70-viewer-input.js
 *   - src/js/90-bootstrap.js
 * Build command: python tools/build_frontend_assets.py
 */

(() => {
"use strict";

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
    isBrowserFullscreenActive() &&
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
    targetUrl = new URL(target, window.location.href);
  } catch (_error) {
    targetUrl = null;
  }

  if (targetUrl && canNavigateWithinCurrentDocument(targetUrl)) {
    navigateWithinCurrentDocument(targetUrl, options);
    return;
  }

  if (options.replace) window.location.replace(target);
  else window.location.assign(target);
}

function navigateBack() {
  window.history.back();
}

function handleInternalAppLinkClick(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (!isBrowserFullscreenActive()) return;

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
  return siteRoutes?.catalogUrl?.(catalogId) || `catalog.html?catalog=${encodeURIComponent(String(catalogId || ""))}`;
}

function favoritesDocumentUrl() {
  return siteRoutes?.favoritesUrl?.() || "favorites.html";
}

function viewerDocumentUrl(catalogId, page = 1, options = {}) {
  return siteRoutes?.viewerUrl?.(catalogId, page, options) || `viewer.html?catalog=${encodeURIComponent(String(catalogId || ""))}&page=${Math.max(1, Number.parseInt(page, 10) || 1)}`;
}

function absoluteDocumentUrl(relativeUrl) {
  return new URL(relativeUrl, window.location.href).href;
}

function updateDocumentMetadata(catalog = state?.catalog || null) {
  const brand = "רהיטי ברגיג";
  if (isAppPage("catalog") && catalog) {
    document.title = `${catalog.title} | ${brand}`;
  } else if (isAppPage("viewer") && catalog) {
    document.title = `${catalog.title} — עמוד ${state.page} | ${brand}`;
  } else if (isAppPage("favorites")) {
    document.title = `המועדפים שלי | ${brand}`;
  } else {
    document.title = `קטלוגים | ${brand}`;
  }

  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.href = window.location.href.split("#")[0];
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
    syncCatalogCategoryFocusFromHash();
  });
}
/* ===== END SOURCE: src/js/00-navigation.js ===== */

/* ===== BEGIN SOURCE: src/js/10-app-state.js ===== */
/**
 * Source module: 10-app-state.js
 * Shared runtime constants, persistent stores, application state, and cached DOM references.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

const AUTO_VIEWER_ZOOM = 1;
const MIN_VIEWER_ZOOM = 0.35;
const MAX_VIEWER_ZOOM = 5;
const VIEWER_FIT_HEIGHT = "height";
const VIEWER_FIT_WIDTH = "width";
const VIEWER_LAYOUT_SIDE = "side";
const VIEWER_LAYOUT_SCROLL = "scroll";
const LIGHTBOX_SOURCE_CATALOG = "catalog";
const LIGHTBOX_SOURCE_FAVORITES = "favorites";
const SEARCH_INDEX_SCRIPT_SRC = "catalogs.search.js";
const SEARCH_INDEX_PRELOAD_DELAY_MS = 6000;
const MOBILE_READER_SEARCH_MEDIA = "(max-width: 760px)";
const VIEWER_ONBOARDING_STORAGE_KEY = "bargig.viewer-onboarding.v2";
const FAVORITES_SHARE_PARAM = "selection";
const FAVORITES_SHARE_VERSION = 2;
const FAVORITES_SHARE_LEGACY_VERSION = 1;

function getFavoritesStorage() {
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
}

const favoritesStore = window.BargigFavorites?.createStore?.({ storage: getFavoritesStorage() }) || null;

const DOUBLE_TAP_DELAY = 320;
const DOUBLE_TAP_DISTANCE = 34;
const TAP_MOVE_TOLERANCE = 14;
const VIEWER_PAGE_SWIPE_MIN_DISTANCE = 46;
const VIEWER_PAGE_SWIPE_AXIS_RATIO = 1.35;
const SINGLE_KEYBOARD_PAN_VIEWPORT_RATIO = 0.06;
const SINGLE_KEYBOARD_PAN_MIN_STEP = 24;
const SINGLE_KEYBOARD_PAN_MAX_STEP = 52;
const VIEWER_ZOOM_INDICATOR_HIDE_MS = 760;
const VIEWER_PAGE_INDICATOR_HIDE_MS = 1000;
const VIEWER_PAGE_SWAP_CLEANUP_MS = 240;
const SEARCH_PREVIEW_SCROLL_SUPPRESS_MS = 260;
const VIEWER_SCROLL_MULTI_COMMAND_WINDOW_MS = 260;
const VIEWER_SCROLL_WHEEL_FIRST_PAGE_DELTA_PX = 20;
const VIEWER_SCROLL_WHEEL_PAGE_DELTA_PX = 100;
const VIEWER_SCROLL_WHEEL_SETTLE_MS = 150;
const CATALOG_IMAGE_PRELOAD_CACHE_LIMIT = 24;
const CATALOG_IMAGE_RETRY_PARAM = "bargig_retry";

const boundEventFeatures = new Set();

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

const state = {
  catalog: null,
  page: 1,
  zoom: 1,
  fitScale: 1,
  imageFitMode: VIEWER_FIT_HEIGHT,
  viewerLayoutMode: VIEWER_LAYOUT_SCROLL,
  singleImageFitOriginPending: false,
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
  pointers: new Map(),
  lightboxOpen: false,
  lightboxSource: LIGHTBOX_SOURCE_CATALOG,
  favoritesViewerIndex: 0,
  favoritesViewerOpeningHash: "",
  favoritesViewerPreviousCatalog: null,
  favoritesViewerPreviousPage: 1,
  topUiPinned: false,
  uiHideTimer: 0,
  pageRailHideTimer: 0,
  lastTouchLikeViewportInputAt: 0,
  lastTouchLikeRailInputAt: 0,
  zoomIndicatorHideTimer: 0,
  pageIndicatorHideTimer: 0,
  globalSearchCategory: "",
  globalSearchOpen: false,
  lightboxSearchScope: "catalog",
  lightboxMobileSearchOpen: false,
  viewerMobileMoreOpen: false,
  viewerInquiryOpen: false,
  viewerInquiryReturnFocus: null,
  singleImageLoadToken: 0,
  singleImageAnimationTimer: 0,
  viewerScrollCatalogId: "",
  viewerScrollLoadToken: 0,
  viewerScrollRaf: 0,
  viewerScrollZoomRaf: 0,
  viewerScrollZoomAnchor: null,
  viewerScrollIsolatedZoom: false,
  viewerScrollIsolatedPage: 0,
  viewerScrollPageAnimationTimer: 0,
  viewerScrollSettleTimer: 0,
  viewerScrollTargetPage: 0,
  viewerScrollLastCommandAt: 0,
  viewerScrollWheelAccumulator: 0,
  viewerScrollWheelBasePage: 0,
  viewerScrollWheelTargetPage: 0,
  viewerScrollWheelSettleTimer: 0,
  catalogImageLoadCache: new Map(),
  catalogLayoutColumns: 0,
  catalogLayoutResizeTimer: 0,
  categoryFocusTimer: 0,
  categoryFocusTargetId: "",
  categoryNavFitRaf: 0,
  searchIndexLoadState: Array.isArray(window.BARGIG_CATALOG_SEARCH) ? "ready" : "idle",
  searchIndexLoadPromise: null,
  searchIndexPreloadTimer: 0,
  catalogScrollTopButtonRaf: 0,
  searchPreviewSuppressUntil: 0,
  searchPreviewSuppressTimer: 0,
  searchPreviewPointerClientX: null,
  searchPreviewPointerClientY: null,
  favoritesOpen: false,
  favoritesReturnFocus: null,
  favoritesTransferPending: null,
  favoritesTransferReturnFocus: null,
  viewerOnboardingOpen: false,
  viewerOnboardingShownThisSession: false,
  viewerOnboardingStep: 0,
  viewerOnboardingTarget: null,
  viewerOnboardingFloatingTarget: null,
  viewerOnboardingFloatingSource: null,
  viewerOnboardingRestoreUi: null,
  viewerOnboardingLayoutRaf: 0,
  viewerOnboardingLayoutTimer: 0,
  actionToastTimer: 0
};

const els = {
  splash: $("splashScreen"),
  catalogGrid: $("catalogGrid"),
  categoryNav: $("categoryNav"),
  mobileCategoryMenuToggle: $("mobileCategoryMenuToggle"),
  mobileCategoryMenu: $("mobileCategoryMenu"),
  catalogCount: $("catalogCount"),
  pageCount: $("pageCount"),
  catalogSearch: $("catalogSearch"),
  globalSearchOpen: $("globalSearchOpen"),
  headerFavoritesButton: $("headerFavoritesButton"),
  headerFavoritesCount: $("headerFavoritesCount"),
  lightboxFavoritesButton: $("lightboxFavoritesButton"),
  lightboxFavoritesCount: $("lightboxFavoritesCount"),
  headerCopyLink: $("headerCopyLink"),
  globalSearchClose: $("globalSearchClose"),
  globalSearchInput: $("globalSearchInput"),
  globalSearchResults: $("globalSearchResults"),
  globalSearchClear: $("globalSearchClear"),
  globalSearchScopeToggle: $("globalSearchScopeToggle"),
  globalSearchScopeMenu: $("globalSearchScopeMenu"),
  searchFloatingPreview: $("searchFloatingPreview"),
  searchFloatingPreviewImage: $("searchFloatingPreviewImage"),
  searchFloatingPreviewPage: $("searchFloatingPreviewPage"),
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
  favoritesPanel: $("favoritesPanel"),
  favoritesBackdrop: $("favoritesBackdrop"),
  favoritesCloseButton: $("favoritesCloseButton"),
  favoritesClearButton: $("favoritesClearButton"),
  favoritesShareButton: $("favoritesShareButton"),
  favoritesCount: $("favoritesCount"),
  favoritesGrid: $("favoritesGrid"),
  favoritesEmpty: $("favoritesEmpty"),
  favoritesTransferOverlay: $("favoritesTransferOverlay"),
  favoritesTransferBackdrop: $("favoritesTransferBackdrop"),
  favoritesTransferTitle: $("favoritesTransferTitle"),
  favoritesTransferDescription: $("favoritesTransferDescription"),
  favoritesTransferSummary: $("favoritesTransferSummary"),
  favoritesTransferMerge: $("favoritesTransferMerge"),
  favoritesTransferReplace: $("favoritesTransferReplace"),
  favoritesTransferCancel: $("favoritesTransferCancel"),
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
  favoriteOpenCatalogButton: $("favoriteOpenCatalogButton"),
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
  stageCanvas: $("stageCanvas"),
  viewerLoading: $("viewerLoading"),
  prevPageBtn: $("prevPageBtn"),
  nextPageBtn: $("nextPageBtn"),
  fullscreenToggle: $("fullscreenToggle"),
  viewerScrollPages: $("viewerScrollPages"),
  fitHeightBtn: $("fitHeightBtn"),
  fitWidthBtn: $("fitWidthBtn"),
  viewerAutoZoomBtn: $("viewerAutoZoomBtn"),
  viewerFavoriteButton: $("viewerFavoriteButton"),
  viewerInquiryButton: $("viewerInquiryButton"),
  viewerInquiryOverlay: $("viewerInquiryOverlay"),
  viewerInquiryBackdrop: $("viewerInquiryBackdrop"),
  viewerInquiryClose: $("viewerInquiryClose"),
  viewerInquiryCatalog: $("viewerInquiryCatalog"),
  viewerInquiryPage: $("viewerInquiryPage"),
  viewerInquiryPreview: $("viewerInquiryPreview"),
  viewerInquiryActions: $("viewerInquiryActions"),
  viewerInquiryGmail: $("viewerInquiryGmail"),
  viewerInquiryEmail: $("viewerInquiryEmail"),
  viewerInquiryEmailLabel: $("viewerInquiryEmailLabel"),
  viewerInquiryShare: $("viewerInquiryShare"),
  viewerInquiryCopy: $("viewerInquiryCopy"),
  viewerZoomIndicator: $("viewerZoomIndicator"),
  lightboxSearchInput: $("lightboxSearchInput"),
  lightboxSearchPanel: $("lightboxSearchPanel"),
  lightboxMobileSearchToggle: $("lightboxMobileSearchToggle"),
  lightboxMobileSearchClose: $("lightboxMobileSearchClose"),
  viewerMobileMoreToggle: $("viewerMobileMoreToggle"),
  viewerMobileMoreMenu: $("viewerMobileMoreMenu"),
  viewerMobileFavoritesLink: $("viewerMobileFavoritesLink"),
  lightboxSearchResults: $("lightboxSearchResults"),
  lightboxSearchStatus: $("lightboxSearchStatus"),
  lightboxSearchClear: $("lightboxSearchClear"),
  lightboxSearchScopeToggle: $("lightboxSearchScopeToggle"),
  lightboxSearchScopeMenu: $("lightboxSearchScopeMenu"),
  lightboxCatalogMenuToggle: $("lightboxCatalogMenuToggle"),
  lightboxCatalogMenu: $("lightboxCatalogMenu"),
  lightboxFloatingPreview: $("lightboxFloatingPreview"),
  lightboxFloatingPreviewImage: $("lightboxFloatingPreviewImage"),
  lightboxFloatingPreviewPage: $("lightboxFloatingPreviewPage"),
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
  siteActionToast: $("siteActionToast")
};
/* ===== END SOURCE: src/js/10-app-state.js ===== */

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
const TELEMETRY_SCHEMA_VERSION = 1;
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
  "image_error"
]);

const telemetryRuntime = {
  enabled: null,
  queue: [],
  flushTimer: 0,
  flushing: false,
  catalogKey: "",
  catalogAt: 0,
  searchKeys: new Map(),
  imageFailures: new Set(),
  initialized: false
};

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
    secondaryValue: telemetryNumber(fields.secondaryValue, -1_000_000, 1_000_000)
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

function telemetryCatalogImageContext(img, src = "") {
  const value = String(src || img?.currentSrc || img?.getAttribute?.("src") || "");
  const match = value.match(/\/assets\/pages\/([^/]+)\/(?:thumbs\/)?page-(\d+)/i);
  const catalogId = telemetryCleanText(match?.[1] || img?.dataset?.catalogId || state.catalog?.id || "", 100);
  const pageNumber = Number.parseInt(match?.[2] || img?.dataset?.page || state.page || 0, 10) || 0;
  let detail = "image";
  if (/\/thumbs\//i.test(value)) detail = "thumbnail";
  else if (img === els.lightboxImage || img?.id === "lightboxImage") detail = "viewer";
  else if (img?.classList?.contains("catalog-cover")) detail = "cover";
  return { catalogId, pageNumber, detail, value };
}

function telemetryStableImageFailureKey(value, detail) {
  const clean = String(value || "")
    .replace(new RegExp(`([?&])${CATALOG_IMAGE_RETRY_PARAM}=[^&#]*&?`, "g"), "$1")
    .replace(/[?&]$/, "")
    .split("#")[0];
  return `${telemetryCleanText(clean, 220)}|${telemetryCleanText(detail, 50)}`;
}

function telemetryTrackImageFailure(src, options = {}) {
  const context = telemetryCatalogImageContext(options.img, src);
  const detail = telemetryCleanText(options.detail || context.detail, 50);
  const failureKey = telemetryStableImageFailureKey(context.value, detail)
    || `${context.catalogId}|${context.pageNumber}|${detail}`;
  if (telemetryRuntime.imageFailures.has(failureKey)) return;
  telemetryRuntime.imageFailures.add(failureKey);
  const source = telemetryCleanText(context.value.split("?")[0].split("#")[0].split("/").pop(), 80);
  telemetryTrack("image_error", {
    catalogId: context.catalogId,
    pageNumber: context.pageNumber,
    detail,
    source,
    error: telemetryErrorFingerprint(["image", context.catalogId, context.pageNumber, detail, source])
  }, { immediate: true });
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

function telemetryTrackRuntimeError(event) {
  const filename = String(event?.filename || "");
  const sourceName = telemetryCleanText(filename.split("?")[0].split("/").pop(), 80);
  const errorName = telemetryCleanText(event?.error?.name || "Error", 40);
  const message = telemetryCleanText(event?.message || event?.error?.message || "JavaScript error", 120);
  telemetryTrack("js_error", {
    catalogId: state.catalog?.id || "",
    action: errorName,
    detail: message,
    scope: telemetryErrorSourceScope(filename),
    source: sourceName,
    pageNumber: Number(event?.lineno) || 0,
    secondaryValue: Number(event?.colno) || 0,
    error: telemetryErrorFingerprint([errorName, message, sourceName, event?.lineno, event?.colno])
  }, { immediate: true });
}

function telemetryTrackUnhandledRejection(event) {
  const reason = event?.reason;
  const errorName = telemetryCleanText(reason?.name || "UnhandledRejection", 40);
  const message = telemetryCleanText(reason?.message || reason || "Unhandled promise rejection", 120);
  telemetryTrack("js_error", {
    catalogId: state.catalog?.id || "",
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
    if (event.target instanceof HTMLImageElement) {
      if (event.target.dataset.telemetryManaged !== "true") {
        telemetryTrackImageFailure(event.target.currentSrc || event.target.src, { img: event.target });
      }
      return;
    }
    telemetryTrackRuntimeError(event);
  }, true);
  window.addEventListener("unhandledrejection", telemetryTrackUnhandledRejection);
  document.addEventListener("click", telemetryHandleDocumentClick, true);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") telemetryFlush({ beacon: true }).catch(() => {});
  });
  window.addEventListener("pagehide", () => telemetryFlush({ beacon: true }).catch(() => {}));
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
  const push = (src, role) => {
    if (!src || candidates.some((candidate) => candidate.src === src)) return;
    candidates.push({ src, role, fallback: role === "fallback" });
  };

  push(options.forceRefresh ? cacheBustedCatalogImageUrl(primary) : primary, options.forceRefresh ? "manual" : "primary");
  push(cacheBustedCatalogImageUrl(primary), "retry");
  if (fallback && fallback !== primary) push(fallback, "fallback");
  return candidates;
}

function loadCatalogImageWithRecovery(img, options = {}) {
  const candidates = catalogImageRecoveryCandidates(options.primarySrc, options.fallbackSrc, options);
  const isCurrent = typeof options.isCurrent === "function" ? options.isCurrent : () => true;
  let index = 0;
  let stopped = false;

  img.dataset.telemetryManaged = "true";

  const attempt = () => {
    if (stopped || !isCurrent() || index >= candidates.length) {
      if (!stopped && isCurrent()) options.onExhausted?.();
      return;
    }

    const candidate = candidates[index++];
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
        options.onSuccess?.(candidate);
        return;
      }
      options.onFailure?.(candidate);
      attempt();
    };

    img.addEventListener("load", () => settle(true), { once: true });
    img.addEventListener("error", () => settle(false), { once: true });
    options.onAttempt?.(candidate);
    setCatalogImageSource(img, candidate.src);
    if (img.complete) queueMicrotask(() => settle(Boolean(img.naturalWidth)));
  };

  attempt();
  return () => { stopped = true; };
}

function prepareCatalogImage(url, options = {}) {
  const src = String(url || "");
  if (!src) return Promise.reject(new Error("missing-image-src"));

  const cached = state.catalogImageLoadCache.get(src);
  if (cached) return cached;

  const image = new Image();
  applyCatalogImageCrossOrigin(image);
  image.decoding = "async";
  image.fetchPriority = options.priority || "auto";

  const promise = new Promise((resolve, reject) => {
    image.addEventListener("load", () => {
      // Keep only lightweight readiness metadata in the promise cache. Returning
      // the Image object itself retained its decoded bitmap indefinitely, which
      // made a browsing session accumulate tens or hundreds of megabytes.
      resolve({
        width: Number(image.naturalWidth) || 0,
        height: Number(image.naturalHeight) || 0
      });
    }, { once: true });

    image.addEventListener("error", () => {
      state.catalogImageLoadCache.delete(src);
      telemetryTrackImageFailure(src, { detail: options.detail || "preload" });
      reject(new Error("image-load-failed"));
    }, { once: true });

    image.src = src;
  });

  if (state.catalogImageLoadCache.size >= CATALOG_IMAGE_PRELOAD_CACHE_LIMIT) {
    const oldestSrc = state.catalogImageLoadCache.keys().next().value;
    if (oldestSrc) state.catalogImageLoadCache.delete(oldestSrc);
  }
  state.catalogImageLoadCache.set(src, promise);
  return promise;
}

function runViewerPageSwapAnimation(element, options = {}) {
  const { timerKey, root = element?.parentElement } = options;
  if (!element || !timerKey || !(timerKey in state)) return;

  window.clearTimeout(state[timerKey]);
  root?.querySelectorAll?.(".page-swap-enter")
    .forEach((animatedElement) => animatedElement.classList.remove("page-swap-enter"));

  // Restart the exact same entrance animation for both the single-page frame
  // and the active frame in continuous-scroll mode. Page positioning is
  // already complete before this reflow, so only the incoming page animates.
  void element.offsetWidth;
  element.classList.add("page-swap-enter");
  state[timerKey] = window.setTimeout(() => {
    element.classList.remove("page-swap-enter");
    state[timerKey] = 0;
  }, VIEWER_PAGE_SWAP_CLEANUP_MS);
}

function runSingleImageSwapAnimation() {
  runViewerPageSwapAnimation(els.lightboxImageFrame, {
    timerKey: "singleImageAnimationTimer",
    root: els.stageCanvas
  });
}


function finishSingleImageSwap(token) {
  if (token !== state.singleImageLoadToken) return;
  setViewerLoading(false);
  els.lightbox?.classList.remove("is-page-loading");
  els.lightboxImageFrame?.classList.remove("is-preparing-swap");
  syncImagePlaceholderState(els.lightboxImage);
  applyZoom();
}

function setSingleViewerImageFeedback(mode = "", message = "") {
  const visible = Boolean(mode && message);
  els.viewerImageFeedback?.classList.toggle("hidden", !visible);
  if (els.viewerImageFeedback) els.viewerImageFeedback.dataset.mode = visible ? mode : "";
  if (els.viewerImageFeedbackText) els.viewerImageFeedbackText.textContent = message;
  els.viewerImageRetry?.classList.toggle("hidden", !visible);
  els.lightboxImageFrame?.classList.toggle("image-fallback", mode === "fallback");
  if (mode !== "error") els.lightboxImageFrame?.classList.remove("image-terminal-error");
}

function showSingleLightboxImage(catalog, page, src) {
  const options = arguments[3] || {};
  if (!els.lightboxImage || !catalog || !src) return;

  const token = ++state.singleImageLoadToken;
  const image = els.lightboxImage;
  const primarySrc = normalizeCatalogImageUrl(src);
  const currentLogicalSrc = image.dataset.logicalSrc || normalizeCatalogImageUrl(image.getAttribute("src") || "");
  if (!options.forceRefresh && currentLogicalSrc === primarySrc && image.complete && image.naturalWidth && image.dataset.loadedQuality !== "fallback") {
    applyLightboxFrameGeometry(image.naturalWidth, image.naturalHeight, { updateFitScale: false });
    setSingleViewerImageFeedback();
    finishSingleImageSwap(token);
    return;
  }

  setViewerLoading(true);
  setSingleViewerImageFeedback();
  els.lightbox?.classList.add("is-page-loading");
  els.lightboxImageFrame?.classList.add("is-preparing-swap");
  els.lightboxImageFrame?.classList.remove("image-terminal-error");
  prepareImagePlaceholder(image);
  image.alt = `${catalog.title} - עמוד ${page}`;
  image.decoding = "async";
  image.fetchPriority = "high";
  image.dataset.logicalSrc = primarySrc;

  loadCatalogImageWithRecovery(image, {
    primarySrc,
    fallbackSrc: thumbSrc(catalog, page),
    forceRefresh: Boolean(options.forceRefresh),
    isCurrent: () => (
      token === state.singleImageLoadToken
      && state.lightboxOpen
      && state.catalog === catalog
      && state.page === page
    ),
    onFailure: (candidate) => {
      telemetryTrackImageFailure(candidate.src, {
        img: image,
        detail: `viewer-single-${candidate.role}`
      });
    },
    onSuccess: (candidate) => {
      image.dataset.loadedQuality = candidate.fallback ? "fallback" : "full";
      if (image.naturalWidth && image.naturalHeight) {
        applyLightboxFrameGeometry(image.naturalWidth, image.naturalHeight, { updateFitScale: false });
      }
      finishSingleImageSwap(token);
      runSingleImageSwapAnimation();
      if (candidate.fallback) {
        setSingleViewerImageFeedback("fallback", "התמונה המלאה לא נטענה. מוצגת תצוגה מוקטנת; אפשר לנסות שוב.");
      } else {
        setSingleViewerImageFeedback();
      }
    },
    onExhausted: () => {
      delete image.dataset.loadedQuality;
      finishSingleImageSwap(token);
      els.lightboxImageFrame?.classList.add("image-terminal-error");
      setSingleViewerImageFeedback("error", "התמונה לא הצליחה להיטען. אפשר לנסות שוב.");
    }
  });
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

const CATALOG_CATEGORY_SHARE_SLUGS = new Map([
  ["ארונות פתיחה", "opening-wardrobes"],
  ["ארונות הזזה", "sliding-wardrobes"],
  ["חדרי ילדים", "kids"],
  ["חדרי שינה", "bedrooms"],
  ["ספריות קודש", "libraries"]
]);

const CATALOG_SUBCATEGORY_SHARE_SLUGS = new Map([
  ["חדרי ילדים קומפלט", "kids-rooms"],
  ["מיטות נגר", "wood-beds"],
  ["היי ריזר", "hi-riser"],
  ["מרופדים עיצוב אישי", "custom-upholstered"],
  ["מרופדים", "upholstered"],
  ["חדרי שינה", "bedrooms"]
]);

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

function withAssetVersion(url, catalog) {
  const version = String(catalog?.assetVersion || "").trim();
  if (!version) return url;
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}

function pageSrc(catalog, page) {
  return withAssetVersion(`${catalogDir(catalog)}/page-${pad(page)}.${imageExt(catalog)}`, catalog);
}

function thumbSrc(catalog, page) {
  return withAssetVersion(`${catalogDir(catalog)}/thumbs/page-${pad(page)}.${imageExt(catalog)}`, catalog);
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
  if (!state.catalog || !Number.isFinite(page) || page < 1) return;

  if (!Array.isArray(state.catalog.pageSizes)) state.catalog.pageSizes = [];
  state.catalog.pageSizes[page - 1] = [width, height];

}

function watchLoadedPageAspect(img) {
  if (!img) return;

  if (img.complete && img.naturalWidth && img.naturalHeight) {
    applyLoadedPageAspect(img);
    return;
  }

  img.addEventListener("load", () => applyLoadedPageAspect(img), { once: true });
}

function clampPage(page, catalog = state.catalog) {
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
  if (!els.siteActionToast || !message) return;
  const normalizedOptions = typeof options === "number" ? { duration: options } : options;
  const duration = Math.max(1000, Number(normalizedOptions.duration) || 1000);

  window.clearTimeout(state.actionToastTimer);
  els.siteActionToast.textContent = message;
  els.siteActionToast.dataset.tone = normalizedOptions.tone || actionToastTone(message);
  els.siteActionToast.classList.remove("hidden", "visible");
  void els.siteActionToast.offsetWidth;
  window.requestAnimationFrame(() => els.siteActionToast.classList.add("visible"));
  state.actionToastTimer = window.setTimeout(() => {
    els.siteActionToast.classList.remove("visible");
    window.setTimeout(() => {
      if (!els.siteActionToast.classList.contains("visible")) {
        els.siteActionToast.classList.add("hidden");
      }
    }, 180);
  }, duration);
}

const IMAGE_PLACEHOLDER_FRAME_SELECTOR = [
  ".catalog-image-frame",
  ".lightbox-image-frame",
  ".viewer-scroll-page-frame",
  ".search-result-thumb-frame",
  ".reader-search-thumb-frame",
  ".favorite-image-frame",
  ".lightbox-page-thumb-frame",
  ".reader-page-frame",
  ".reader-page-thumb-frame"
].join(", ");

function imagePlaceholderFrame(img) {
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

function getCurrentCatalogFocusUrlTargetId() {
  const hashTargetId = resolveCatalogCategoryTargetIdFromHash();
  if (hashTargetId && getCatalogCategorySectionsByTargetId(hashTargetId).length) {
    return hashTargetId;
  }

  const activeTargetId = String(state.categoryFocusTargetId || "");
  if (activeTargetId && getCatalogCategorySectionsByTargetId(activeTargetId).length) {
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
/* ===== END SOURCE: src/js/20-shared-ui.js ===== */

/* ===== BEGIN SOURCE: src/js/30-favorites-share.js ===== */
/**
 * Source module: 30-favorites-share.js
 * Favorites storage integration, portable selection links, favorites panels, and link sharing.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function favoriteIdentity(catalog = state.catalog, page = state.page) {
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
  return getFavoriteEntries().map(({ catalogId, catalog, page, savedAt }) => ({
    catalogId: String(catalogId || catalog?.id || ""),
    page,
    savedAt: Number(savedAt) > 0 ? Number(savedAt) : 0
  }));
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
  const incomingItems = window.BargigFavorites?.normalizeItems?.(incoming) || [];
  const existingItems = window.BargigFavorites?.normalizeItems?.(existing) || [];
  const existingKeys = new Set(existingItems.map(favoriteItemKey).filter(Boolean));
  const incomingKeys = new Set(incomingItems.map(favoriteItemKey).filter(Boolean));
  const newItems = incomingItems.filter((item) => !existingKeys.has(favoriteItemKey(item)));
  const alreadyExistingItems = incomingItems.filter((item) => existingKeys.has(favoriteItemKey(item)));
  const preservedExistingItems = existingItems.filter((item) => !incomingKeys.has(favoriteItemKey(item)));

  return {
    incomingItems,
    existingItems,
    newItems,
    alreadyExistingItems,
    mergedItems: [...incomingItems, ...preservedExistingItems]
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

function parseLegacyFavoritesShareToken(rawToken) {
  const prefix = `v${FAVORITES_SHARE_LEGACY_VERSION}.`;
  if (!rawToken.startsWith(prefix)) return { items: [], rejected: 0, valid: false };
  try {
    const payload = JSON.parse(decodeBase64UrlUtf8(rawToken.slice(prefix.length)));
    if (!payload || payload.v !== FAVORITES_SHARE_LEGACY_VERSION || !Array.isArray(payload.c) || !Array.isArray(payload.i)) {
      return { items: [], rejected: 0, valid: false };
    }
    const rawItems = payload.i.map((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return null;
      const catalogIndex = Number.parseInt(entry[0], 10);
      return { catalogId: payload.c[catalogIndex], page: entry[1], savedAt: 0 };
    });
    return { ...normalizeFavoriteTransferItems(rawItems), valid: true };
  } catch (_error) {
    return { items: [], rejected: 0, valid: false };
  }
}

function parseFavoritesShareToken(token) {
  const rawToken = String(token || "").trim();
  const prefix = `v${FAVORITES_SHARE_VERSION}.`;
  if (!rawToken.startsWith(prefix)) return parseLegacyFavoritesShareToken(rawToken);

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
  const pending = state.favoritesTransferPending;
  if (!pending || !els.favoritesTransferOverlay) return;
  const comparison = analyzeFavoriteItemMerge(pending.items, getValidFavoriteItems());
  const incomingCount = comparison.incomingItems.length;
  const currentCount = comparison.existingItems.length;
  const newCount = comparison.newItems.length;
  const alreadyExistingCount = comparison.alreadyExistingItems.length;
  if (els.favoritesTransferTitle) els.favoritesTransferTitle.textContent = "רשימת מועדפים התקבלה";
  if (els.favoritesTransferDescription) {
    els.favoritesTransferDescription.textContent = "הקישור כולל מועדפים ממחשב אחר. בחרו כיצד לשלב אותם עם הרשימה הקיימת.";
  }
  if (els.favoritesTransferSummary) {
    const rejectedText = pending.rejected ? ` · ${pending.rejected} פריטים לא היו זמינים באתר זה` : "";
    const existingLabel = alreadyExistingCount === 1 ? "קיים" : "קיימים";
    const newLabel = newCount === 1 ? "חדש" : "חדשים";
    const overlapText = alreadyExistingCount > 0
      ? `\nמתוכם ${alreadyExistingCount} ${existingLabel} ו-${newCount} ${newLabel}`
      : "";
    els.favoritesTransferSummary.textContent = `${incomingCount} פריטים ברשימה שהתקבלה · ${currentCount} פריטים שמורים כעת${rejectedText}${overlapText}`;
  }
}

function openFavoritesTransferDialog(transfer, returnFocus = document.activeElement) {
  if (!transfer?.items?.length || !els.favoritesTransferOverlay) return false;
  state.favoritesTransferPending = transfer;
  state.favoritesTransferReturnFocus = returnFocus;
  syncFavoritesTransferDialogUi();
  els.favoritesTransferOverlay.classList.remove("hidden");
  els.favoritesTransferOverlay.setAttribute("aria-hidden", "false");
  syncDocumentLock();
  requestAnimationFrame(() => els.favoritesTransferMerge?.focus());
  return true;
}

function closeFavoritesTransferDialog(options = {}) {
  const { restoreFocus = true, cleanUrl = false } = options;
  const returnFocus = state.favoritesTransferReturnFocus;
  state.favoritesTransferPending = null;
  state.favoritesTransferReturnFocus = null;
  els.favoritesTransferOverlay?.classList.add("hidden");
  els.favoritesTransferOverlay?.setAttribute("aria-hidden", "true");
  if (cleanUrl) cleanFavoritesSelectionFromUrl();
  syncDocumentLock();
  if (restoreFocus && returnFocus?.focus) returnFocus.focus();
}

function applyFavoritesTransfer(mode) {
  const pending = state.favoritesTransferPending;
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
  requestAnimationFrame(() => els.favoritesGrid?.querySelector(".favorite-card")?.focus?.());
}

function prepareIncomingFavoritesTransfer(transfer, options = {}) {
  const { returnFocus = document.activeElement } = options;
  if (!transfer?.valid || !transfer.items.length || !favoritesStore) return false;
  const currentItems = getValidFavoriteItems();
  if (!currentItems.length) {
    state.favoritesTransferPending = transfer;
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
  prepareIncomingFavoritesTransfer({ ...parsed, source: "link" }, { returnFocus: els.favoritesShareButton });
}

function syncFavoritesShareButton(count = getFavoriteEntries().length) {
  if (!els.favoritesShareButton) return;
  const hasItems = count > 0;
  els.favoritesShareButton.disabled = !hasItems;
  els.favoritesShareButton.setAttribute("aria-label", hasItems
    ? `שיתוף רשימת המועדפים, ${count} עמודים שמורים`
    : "שיתוף רשימת המועדפים — אין עדיין עמודים שמורים");
}

async function shareFavoritesList() {
  const items = getFavoriteEntries().map(({ catalogId, catalog, page }) => ({
    catalogId: String(catalogId || catalog?.id || ""),
    page
  }));
  if (!items.length) return;
  const link = buildFavoritesShareUrl(items);

  if (isMobileShareEnvironment()) {
    try {
      await navigator.share({
        title: "המועדפים שלי",
        text: `${items.length} עמודים שמורים מתוך קטלוגי רהיטי ברגיג`,
        url: link
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await copyTextToClipboard(link);
    flashActionButton(els.favoritesShareButton, "הקישור הועתק");
    showActionToast("הקישור לרשימת המועדפים הועתק", { tone: "link" });
  } catch (_error) {
    window.prompt("אפשר להעתיק את הקישור מכאן:", link);
  }
}

function handleFavoritesTransferKeydown(event) {
  if (!state.favoritesTransferPending || !els.favoritesTransferOverlay) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeFavoritesTransferDialog({ cleanUrl: state.favoritesTransferPending?.source === "link" });
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = Array.from(els.favoritesTransferOverlay.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
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
  return state.lightboxSource === LIGHTBOX_SOURCE_FAVORITES;
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
  state.favoritesViewerIndex = nextIndex;
  state.catalog = entry.catalog;
  state.page = entry.page;
  return true;
}

function syncFavoriteViewerAfterStoreChange(options = {}) {
  if (!state.lightboxOpen || !isFavoritesLightboxMode()) return;

  const { preferredIndex = state.favoritesViewerIndex } = options;
  const entries = getFavoriteEntries();
  if (!entries.length) {
    closeLightbox({ restoreFavorites: true });
    return;
  }

  const currentIndex = findFavoriteEntryIndex(entries, state.catalog?.id, state.page);
  setFavoriteViewerEntry(entries, currentIndex >= 0 ? currentIndex : preferredIndex);
  renderLightboxPageRail();
  updateLightbox({ thumbScrollIntoView: true });
}

function syncViewerFavoriteButtonUi() {
  const button = els.viewerFavoriteButton;
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
  if (!els.favoritesGrid) return;
  const count = entries.length;
  if (els.favoritesCount) els.favoritesCount.textContent = String(count);
  els.favoritesClearButton?.classList.toggle("hidden", count === 0);
  els.favoritesEmpty?.classList.toggle("hidden", count !== 0);
  syncFavoritesShareButton(count);

  els.favoritesGrid.innerHTML = entries.map(({ catalog, page }) => {
    const identityCatalog = escapeHtml(catalog.id);
    const title = escapeHtml(catalog.title || "קטלוג");
    const image = pageSrc(catalog, page);
    return `
      <article class="favorite-card" data-favorite-catalog="${identityCatalog}" data-favorite-page="${page}">
        <button class="favorite-preview-button" type="button" data-open-favorite="1" aria-label="פתיחת ${title}, עמוד ${page}">
          <span class="favorite-image-frame catalog-image-frame"${pageAspectStyle(catalog, page)}>
            <img src="${escapeHtml(image)}" alt="${title} - עמוד ${page}" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(image)} />
          </span>
          <span class="favorite-card-meta">
            <strong>${title}</strong>
            <span>עמוד ${page}</span>
          </span>
        </button>
        <button class="favorite-remove-button" type="button" data-remove-favorite="1" aria-label="הסרת ${title}, עמוד ${page} מהמועדפים" title="הסרה מהמועדפים">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" /></svg>
        </button>
      </article>
    `;
  }).join("");
}

function syncFavoritesShortcut(button, countElement, count) {
  if (countElement) countElement.textContent = String(count);
  if (!button) return;
  button.classList.toggle("hidden", count === 0);
  button.setAttribute("aria-label", `פתיחת מועדפים, ${count} עמודים שמורים`);
}

function syncFavoritesUi(options = {}) {
  const { renderPanel = state.favoritesOpen } = options;
  const entries = getFavoriteEntries();
  const count = entries.length;
  syncFavoritesShortcut(els.headerFavoritesButton, els.headerFavoritesCount, count);
  syncFavoritesShortcut(els.lightboxFavoritesButton, els.lightboxFavoritesCount, count);
  syncViewerFavoriteButtonUi();
  syncFavoritesShareButton(count);
  if (renderPanel) {
    renderFavoritesPanel(entries);
    if (state.favoritesOpen && entries.length === 0) {
      requestAnimationFrame(() => els.favoritesCloseButton?.focus());
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

  if (!els.favoritesPanel || (!allowEmpty && !entries.length)) return;
  if (captureReturnFocus) state.favoritesReturnFocus = document.activeElement;
  state.favoritesOpen = true;
  renderFavoritesPanel(entries);
  els.favoritesPanel.classList.remove("hidden");
  els.favoritesPanel.classList.add("favorites-standalone-page");
  els.favoritesPanel.setAttribute("aria-hidden", "false");
  els.favoritesPanel.setAttribute("aria-modal", "false");
  syncDocumentLock();
  updateDocumentMetadata();
}

function hideFavoritesPanelUi(options = {}) {
  const { restoreFocus = false, preserveReturnFocus = false } = options;
  const returnFocus = state.favoritesReturnFocus;

  state.favoritesOpen = false;
  els.favoritesPanel?.classList.add("hidden");
  els.favoritesPanel?.classList.remove("favorites-standalone-page");
  els.favoritesPanel?.setAttribute("aria-hidden", "true");
  els.favoritesPanel?.setAttribute("aria-modal", "true");
  syncDocumentLock();

  if (restoreFocus && returnFocus?.focus) returnFocus.focus();
  if (!preserveReturnFocus) state.favoritesReturnFocus = null;
}

function closeFavoritesPanel(options = {}) {
  const { restoreFocus = true, preserveReturnFocus = false } = options;
  if (isAppPage("favorites")) {
    if ((hasInDocumentRouteSession || canReturnToSameSite()) && window.history.length > 1) navigateBack();
    else navigateTo(homeDocumentUrl(), { replace: true });
    return;
  }
  if (!state.favoritesOpen) return;
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

  state.favoritesViewerOpeningHash = window.location.href;
  state.favoritesViewerPreviousCatalog = state.catalog;
  state.favoritesViewerPreviousPage = state.page;
  setFavoriteViewerEntry(entries, index);
  openLightbox(state.page, {
    source: LIGHTBOX_SOURCE_FAVORITES,
    favoriteIndex: index
  });
}

function toggleCurrentPageFavorite() {
  const identity = favoriteIdentity();
  if (!identity || !favoritesStore) return;
  const previousFavoriteIndex = state.favoritesViewerIndex;
  const added = favoritesStore.toggle({ ...identity, savedAt: Date.now() });
  telemetryTrackFavorite(added ? "add" : "remove", identity.catalogId, identity.page, getFavoriteEntries().length);
  syncFavoritesUi({ renderPanel: true });
  if (isFavoritesLightboxMode() && !added) {
    syncFavoriteViewerAfterStoreChange({ preferredIndex: previousFavoriteIndex });
  }
  if (state.lightboxOpen) {
    const feedback = added ? "נשמר" : "הוסר";
    flashActionButton(els.viewerFavoriteButton, feedback);
    showActionToast(feedback, { tone: added ? "saved" : "removed" });
  }
}

function removeFavorite(catalogId, page) {
  if (!favoritesStore) return;
  const removed = favoritesStore.remove({ catalogId, page });
  if (removed !== false) telemetryTrackFavorite("remove", catalogId, page, getFavoriteEntries().length);
  syncFavoritesUi({ renderPanel: true });
  if (removed !== false) showActionToast("הוסר", { tone: "removed" });
}

function clearAllFavorites() {
  if (!favoritesStore || !getFavoriteEntries().length) return;
  if (!window.confirm("למחוק את כל העמודים מהמועדפים?")) return;
  favoritesStore.clear();
  telemetryTrackFavorite("clear", "", 0, 0);
  syncFavoritesUi({ renderPanel: true });
  showActionToast("כל המועדפים הוסרו", { tone: "removed" });
}

function handleFavoritesGridClick(event) {
  const card = event.target.closest?.("[data-favorite-catalog][data-favorite-page]");
  if (!card || !els.favoritesGrid?.contains(card)) return;
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
  syncFavoritesUi({ renderPanel: true });
  if (state.favoritesTransferPending) syncFavoritesTransferDialogUi();
  syncFavoriteViewerAfterStoreChange();
}

function handleFavoritesPanelKeydown(event) {
  if (!state.favoritesOpen || event.key !== "Tab" || !els.favoritesPanel) return;
  const focusable = Array.from(els.favoritesPanel.querySelectorAll(
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

function downloadCurrentLightboxImage() {
  if (!state.catalog) return;
  downloadCatalogPageSnapshot(state.catalog, state.page, els.lightboxScreenshot);
}

function isMobileShareEnvironment() {
  if (typeof navigator.share !== "function") return false;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  const iPadDesktopMode = navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1;
  const userAgentDataMobile = navigator.userAgentData?.mobile === true;
  return Boolean(mobileUserAgent || iPadDesktopMode || userAgentDataMobile);
}

function currentShareLabel() {
  if (state.catalog && isAppPage("viewer")) return `${state.catalog.title} · עמוד ${state.page}`;
  if (state.catalog && isAppPage("catalog")) return state.catalog.title;
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
  await shareOrCopyCurrentLink(els.headerCopyLink);
}

async function shareCurrentLightboxLink() {
  await shareOrCopyCurrentLink(els.lightboxCopyLink);
}

function attachFavoritesShareEvents() {
  els.headerCopyLink?.addEventListener("click", () => shareCurrentMainHeaderLink());
  els.favoritesBackdrop?.addEventListener("click", closeFavoritesPanel);
  els.favoritesCloseButton?.addEventListener("click", closeFavoritesPanel);
  els.favoritesClearButton?.addEventListener("click", clearAllFavorites);
  els.favoritesShareButton?.addEventListener("click", () => shareFavoritesList());
  els.favoritesGrid?.addEventListener("click", handleFavoritesGridClick);
  els.favoritesPanel?.addEventListener("keydown", handleFavoritesPanelKeydown);
  els.favoritesTransferBackdrop?.addEventListener("click", () => closeFavoritesTransferDialog({ cleanUrl: state.favoritesTransferPending?.source === "link" }));
  els.favoritesTransferCancel?.addEventListener("click", () => closeFavoritesTransferDialog({ cleanUrl: state.favoritesTransferPending?.source === "link" }));
  els.favoritesTransferMerge?.addEventListener("click", () => applyFavoritesTransfer("merge"));
  els.favoritesTransferReplace?.addEventListener("click", () => applyFavoritesTransfer("replace"));
  els.favoritesTransferOverlay?.addEventListener("keydown", handleFavoritesTransferKeydown);
  els.lightboxScreenshot?.addEventListener("click", () => downloadCurrentLightboxImage());
  els.lightboxCopyLink?.addEventListener("click", () => shareCurrentLightboxLink());

  window.addEventListener("storage", handleFavoritesStorageChange);
}
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
    <article class="empty-state">
      <strong>עדיין אין קטלוגים להצגה</strong>
      <p>ברגע שיועלו קטלוגים, הם יופיעו כאן לבחירה ולצפייה.</p>
    </article>
  `;

  if (els.catalogGrid) els.catalogGrid.innerHTML = html;
  if (els.pageGrid) els.pageGrid.innerHTML = html;
  if (els.catalogCount) els.catalogCount.textContent = "0";
  if (els.pageCount) els.pageCount.textContent = "0";
  renderCategoryNav([]);
  showCatalogDetail();
  els.catalogTitle.textContent = "עדיין אין קטלוגים להצגה";
  els.catalogDescription.textContent = "הקטלוגים יופיעו כאן כשהם יהיו זמינים לצפייה.";
  if (els.catalogMenuToggleText) els.catalogMenuToggleText.textContent = "אין קטלוגים";
  if (els.catalogMenu) els.catalogMenu.innerHTML = `<div class="reader-catalog-menu-empty">אין קטלוגים להצגה</div>`;
  els.catalogCoverPreview?.removeAttribute("src");
  if (els.openCatalogEntryFromDetail) els.openCatalogEntryFromDetail.disabled = true;
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
  state.categoryNavFitRaf = 0;
  const nav = els.categoryNav;
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
  if (!els.categoryNav) return;
  window.cancelAnimationFrame(state.categoryNavFitRaf);
  state.categoryNavFitRaf = window.requestAnimationFrame(fitCategoryNavToSingleRow);
}

function initCategoryNavFit() {
  if (!els.categoryNav) return;
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
      href: buildCategoryShareRouteHash(sharePath),
      targetId,
      sharePath,
      label: group.category
    };
  });

  if (els.categoryNav) {
    els.categoryNav.innerHTML = links.map((link) => `
      <a class="top-nav-link category-nav-link" href="${escapeHtml(link.href)}" data-category-target="${escapeHtml(link.targetId)}" data-category-share-path="${escapeHtml(link.sharePath)}" data-category-label="${escapeHtml(link.label)}">${escapeHtml(link.label)}</a>
    `).join("");
  }

  if (els.mobileCategoryMenu) {
    els.mobileCategoryMenu.innerHTML = links.length
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
  return Boolean(els.mobileCategoryMenu && !els.mobileCategoryMenu.classList.contains("hidden"));
}

function setMobileCategoryMenuOpen(open, options = {}) {
  const shouldOpen = Boolean(open);
  if (!els.mobileCategoryMenu || !els.mobileCategoryMenuToggle) return;

  els.mobileCategoryMenu.classList.toggle("hidden", !shouldOpen);
  els.mobileCategoryMenu.classList.toggle("is-open", shouldOpen);
  els.mobileCategoryMenuToggle.classList.toggle("is-active", shouldOpen);
  els.mobileCategoryMenuToggle.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  els.mobileCategoryMenuToggle.setAttribute("aria-label", shouldOpen ? "סגירת תפריט קטגוריות" : "פתיחת תפריט קטגוריות");

  if (shouldOpen && options.focusFirst) {
    window.requestAnimationFrame(() => els.mobileCategoryMenu?.querySelector(".mobile-category-menu-link")?.focus());
  } else if (!shouldOpen && options.focusButton) {
    window.requestAnimationFrame(() => els.mobileCategoryMenuToggle?.focus({ preventScroll: true }));
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
  if (!els.catalogGrid) return [];
  return Array.from(els.catalogGrid.querySelectorAll(".catalog-category-section, .catalog-subcategory-section"));
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

function syncActiveCategoryNavLink(activeId = state.categoryFocusTargetId) {
  const normalizedActiveId = String(activeId || "");

  [els.categoryNav, els.mobileCategoryMenu].forEach((container) => {
    container?.querySelectorAll(".category-nav-link").forEach((link) => {
      const isActive = Boolean(normalizedActiveId && link.dataset.categoryTarget === normalizedActiveId);
      link.classList.toggle("active", isActive);
      if (isActive) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  });

  els.catalogGrid?.querySelectorAll(".catalog-subcategory-nav-link").forEach((link) => {
    const isActive = Boolean(normalizedActiveId && link.dataset.categoryTarget === normalizedActiveId);
    link.classList.toggle("active", isActive);
    if (isActive) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function clearCatalogCategoryFocus(options = {}) {
  const { clearHash = false } = options;

  window.clearTimeout(state.categoryFocusTimer);
  state.categoryFocusTimer = 0;
  state.categoryFocusTargetId = "";
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

  window.clearTimeout(state.categoryFocusTimer);
  state.categoryFocusTimer = 0;

  getCatalogFocusSections().forEach((activeSection) => {
    if (!targetSections.includes(activeSection)) activeSection.classList.remove("is-category-focus");
  });

  targetSections.forEach((targetSection) => targetSection.classList.remove("is-category-focus"));
  if (animate) {
    // Restart the pulse cleanly across every visible segment of the selected category or subcategory.
    void targetSections[0].offsetWidth;
  }
  targetSections.forEach((targetSection) => targetSection.classList.add("is-category-focus"));

  state.categoryFocusTargetId = targetId;
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

  if (state.categoryFocusTargetId === targetId && hasCatalogCategoryFocus(targetId)) {
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
  window.clearTimeout(state.catalogLayoutResizeTimer);
  state.catalogLayoutResizeTimer = window.setTimeout(() => {
    const nextColumns = catalogLayoutColumnCount();
    if (nextColumns !== state.catalogLayoutColumns) renderCatalogCards();
  }, 120);
}

function renderCatalogCard(catalog, headingLevel = 3) {
  const cover = coverThumbSrc(catalog);
  const safeCatalogId = escapeHtml(catalog.id);
  const safeTitle = escapeHtml(catalog.title);
  const safeHeadingLevel = headingLevel === 4 ? 4 : 3;
  return `
    <article class="catalog-card">
      <button class="catalog-cover-frame catalog-image-frame catalog-cover-button" type="button" data-open-catalog-entry="${safeCatalogId}" aria-label="פתיחת הקטלוג ${safeTitle}">
        <img class="catalog-cover" src="${escapeHtml(cover)}" alt="כריכת ${safeTitle}" loading="lazy" decoding="async" fetchpriority="low"${catalogImageCrossOriginAttribute(cover)} />
        <span class="catalog-cover-card-entry-hint" aria-hidden="true">פתיחת הקטלוג</span>
      </button>
      <div class="catalog-body">
        <h${safeHeadingLevel}>${safeTitle}</h${safeHeadingLevel}>
        <p>${escapeHtml(catalog.description || "")}</p>
        <div class="catalog-actions" role="group" aria-label="פעולות עבור ${safeTitle}">
          <button class="button primary catalog-open-button" type="button" data-open-catalog-entry="${safeCatalogId}">פתיחת הקטלוג</button>
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
    return `<a class="catalog-subcategory-nav-link" href="${escapeHtml(buildCategoryShareRouteHash(sharePath))}" data-category-target="${escapeHtml(targetId)}" data-category-share-path="${escapeHtml(sharePath)}">${escapeHtml(group.subcategory)}</a>`;
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
  openCatalogInViewer(catalogId, page);
}

function bindCatalogCardEvents() {
  if (!els.catalogGrid) return;

  els.catalogGrid.querySelectorAll("[data-open-catalog-entry]").forEach((button) => {
    button.addEventListener("click", () => openCatalogEntry(button.dataset.openCatalogEntry));
  });

  els.catalogGrid.querySelectorAll("[data-open-catalog-preview]").forEach((button) => {
    button.addEventListener("click", () => {
      openCatalog(button.dataset.openCatalogPreview, { scroll: true });
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
  if (els.catalogCount) els.catalogCount.textContent = String(catalogs.length);
  if (els.pageCount) els.pageCount.textContent = String(totalPages);
  renderCategoryNav(groups);

  const columns = catalogLayoutColumnCount();
  state.catalogLayoutColumns = columns;
  const categorySegments = catalogCategorySegments(groups, columns);

  els.catalogGrid.style.setProperty("--catalog-layout-columns", String(columns));
  els.catalogGrid.innerHTML = categorySegments.map((segment) => renderCatalogCategorySegment(segment, columns)).join("");

  bindCatalogCardEvents();
  syncCatalogCategoryFocusFromHash({ animate: false });
}


function fillCatalogSelect() {
  updateDetailCatalogMenuLabel();
}


function renderPageGrid() {
  if (!state.catalog) return;
  // Keep generated page cards visually stable during scroll.
  // Older versions attached scroll-time observers here for reveal animation
  // and thumb activation; that caused work exactly when a card entered view.

  const catalog = state.catalog;
  const cards = [];
  for (let page = 1; page <= catalog.pages; page += 1) {
    cards.push(`
      <article class="page-card">
        <button class="page-button" type="button" data-open-page="${page}">
          <div class="page-thumb-wrap"${pageAspectVariableStyle(catalog, page, "--page-thumb-aspect-ratio")}>
            <img class="page-thumb" src="${escapeHtml(thumbSrc(catalog, page))}" alt="${escapeHtml(catalog.title)} - עמוד ${page}" loading="lazy" decoding="async" fetchpriority="low"${catalogImageCrossOriginAttribute(thumbSrc(catalog, page))} />
            <span class="page-number-badge">${page}</span>
          </div>
          <div class="page-card-body">
            <span class="page-card-title">עמוד ${page}</span>
            <span class="page-card-hint">לחץ להגדלה</span>
          </div>
        </button>
      </article>
    `);
  }
  els.pageGrid.innerHTML = cards.join("");

  els.pageGrid.querySelectorAll("[data-open-page]").forEach((button) => {
    button.addEventListener("click", () => openLightbox(Number(button.dataset.openPage)));
  });
}

function showCatalogDetail() {
  if (!els.catalogDetail) return;
  els.catalogDetail.classList.remove("hidden");
  els.catalogDetail.classList.add("in-view");
}

function scrollCatalogDetailIntoView(options = {}) {
  if (!els.catalogDetail) return;
  const { behavior = "smooth" } = options;
  requestAnimationFrame(() => {
    els.catalogDetail.scrollIntoView({ behavior, block: "start" });
    scheduleCatalogScrollTopButtonUpdate();
  });
}

function positionCatalogScrollTopButton() {
  if (!els.scrollToTopBtn || !els.pageGrid) return;

  const gridRect = els.pageGrid.getBoundingClientRect();
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const buttonWidth = Math.max(els.scrollToTopBtn.offsetWidth || 46, 46);
  const safeInset = 12;
  const gapFromGrid = 12;
  const maxLeft = Math.max(safeInset, viewportWidth - buttonWidth - safeInset);
  const preferredLeft = gridRect.left - buttonWidth - gapFromGrid;
  const left = clampValue(preferredLeft, safeInset, maxLeft);

  els.scrollToTopBtn.style.setProperty("--catalog-scroll-top-left", `${Math.round(left)}px`);
}

function setCatalogScrollTopButtonVisible(visible) {
  if (!els.scrollToTopBtn) return;
  els.scrollToTopBtn.classList.toggle("is-visible", Boolean(visible));
  els.scrollToTopBtn.setAttribute("aria-hidden", visible ? "false" : "true");
  els.scrollToTopBtn.tabIndex = visible ? 0 : -1;
}

function updateCatalogScrollTopButton() {
  state.catalogScrollTopButtonRaf = 0;
  if (!els.scrollToTopBtn || !els.catalogDetail || !els.pageGrid || els.catalogDetail.classList.contains("hidden") || !state.catalog || state.lightboxOpen) {
    setCatalogScrollTopButtonVisible(false);
    return;
  }

  positionCatalogScrollTopButton();

  const detailRect = els.catalogDetail.getBoundingClientRect();
  const gridRect = els.pageGrid.getBoundingClientRect();
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const headerHeight = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 90;
  const startedScrollingInsideGrid = gridRect.top < Math.min(headerHeight + 28, viewportHeight * 0.28);
  const stillNearGrid = gridRect.bottom > Math.min(180, viewportHeight * 0.35);
  const detailVisible = detailRect.bottom > 80 && detailRect.top < viewportHeight;
  setCatalogScrollTopButtonVisible(startedScrollingInsideGrid && stillNearGrid && detailVisible);
}

function scheduleCatalogScrollTopButtonUpdate() {
  if (state.catalogScrollTopButtonRaf) return;
  state.catalogScrollTopButtonRaf = requestAnimationFrame(updateCatalogScrollTopButton);
}

function renderCatalogDetail() {
  if (!state.catalog) return;
  const catalog = state.catalog;
  showCatalogDetail();
  els.catalogTitle.textContent = catalog.title;
  els.catalogDescription.textContent = catalog.description || "";
  updateDetailCatalogMenuLabel(catalog);
  if (els.catalogCoverPreview) {
    setCatalogImageSource(els.catalogCoverPreview, catalogCoverSrc(catalog));
    els.catalogCoverPreview.loading = "lazy";
    els.catalogCoverPreview.decoding = "async";
    els.catalogCoverPreview.alt = `שער ${catalog.title}`;
  }
  if (els.openCatalogEntryFromDetail) els.openCatalogEntryFromDetail.disabled = catalog.pages < 1;
  if (els.catalogMenu && !els.catalogMenu.classList.contains("hidden")) renderDetailCatalogMenu();
  renderPageGrid();
  scheduleCatalogScrollTopButtonUpdate();
}

function preloadNeighbors() {
  if (!state.catalog) return;

  if (isFavoritesLightboxMode()) {
    const entries = getFavoriteEntries();
    [state.favoritesViewerIndex - 2, state.favoritesViewerIndex - 1, state.favoritesViewerIndex + 1, state.favoritesViewerIndex + 2]
      .filter((index) => index >= 0 && index < entries.length)
      .forEach((index) => {
        const entry = entries[index];
        prepareCatalogImage(pageSrc(entry.catalog, entry.page), { priority: "low" }).catch(() => {});
      });
    return;
  }

  [state.page - 2, state.page - 1, state.page + 1, state.page + 2]
    .filter((page) => page >= 1 && page <= state.catalog.pages)
    .forEach((page) => {
      prepareCatalogImage(pageSrc(state.catalog, page), { priority: "low" }).catch(() => {});
    });
}

function attachCatalogGridEvents() {
  els.mobileCategoryMenuToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeGlobalSearchPanel({ focusButton: false });
    setMobileCategoryMenuOpen(!isMobileCategoryMenuOpen());
  });

  els.mobileCategoryMenu?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".category-nav-link");
    if (!link || !els.mobileCategoryMenu.contains(link)) return;
    closeMobileCategoryMenu();
    handleCatalogFocusLinkClick(link, event);
  });

  els.catalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderDetailCatalogMenu();
    const isOpen = !els.catalogMenu?.classList.contains("hidden");
    els.catalogMenu?.classList.toggle("hidden", isOpen);
    els.catalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  els.catalogMenu?.addEventListener("click", (event) => event.stopPropagation());

  els.openCatalogEntryFromDetail?.addEventListener("click", () => openLightbox(1));
  els.scrollToTopBtn?.addEventListener("click", () => scrollCatalogDetailIntoView());

  els.categoryNav?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".category-nav-link");
    if (!link || !els.categoryNav.contains(link)) return;
    closeMobileCategoryMenu();
    handleCatalogFocusLinkClick(link, event);
  });

  els.catalogGrid?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".catalog-subcategory-nav-link");
    if (!link || !els.catalogGrid.contains(link)) return;
    handleCatalogFocusLinkClick(link, event);
  });
}
/* ===== END SOURCE: src/js/40-catalog-grid.js ===== */

/* ===== BEGIN SOURCE: src/js/50-search-ui.js ===== */
/**
 * Source module: 50-search-ui.js
 * Global and viewer search loading, scopes, result rendering, previews, and search interactions.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function isSearchIndexReady() {
  return Array.isArray(window.BARGIG_CATALOG_SEARCH);
}

function refreshSearchUiAfterIndexLoad() {
  initSearchStatus();
  initLightboxSearchStatus();

  if (isGlobalSearchPanelOpen()) {
    renderSearchResults(els.globalSearchInput?.value || "");
  }
  if (state.lightboxOpen && els.lightboxSearchInput) {
    renderLightboxSearchResults(els.lightboxSearchInput.value);
  }
}

function ensureSearchIndexLoaded() {
  if (isSearchIndexReady()) {
    state.searchIndexLoadState = "ready";
    refreshSearchUiAfterIndexLoad();
    return Promise.resolve(true);
  }

  if (state.searchIndexLoadPromise) return state.searchIndexLoadPromise;

  state.searchIndexLoadState = "loading";
  initLightboxSearchStatus();

  state.searchIndexLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-search-index-src="${SEARCH_INDEX_SCRIPT_SRC}"]`);
    const script = existing || document.createElement("script");

    const handleLoad = () => {
      state.searchIndexLoadState = isSearchIndexReady() ? "ready" : "error";
      state.searchIndexLoadPromise = null;
      refreshSearchUiAfterIndexLoad();
      if (state.searchIndexLoadState === "ready") resolve(true);
      else reject(new Error("Search index loaded without data"));
    };

    const handleError = () => {
      state.searchIndexLoadState = "error";
      state.searchIndexLoadPromise = null;
      script.remove();
      initLightboxSearchStatus();
      reject(new Error("Failed to load the catalog search index"));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existing) {
      script.src = SEARCH_INDEX_SCRIPT_SRC;
      script.async = true;
      script.dataset.searchIndexSrc = SEARCH_INDEX_SCRIPT_SRC;
      document.head.appendChild(script);
    }
  });

  return state.searchIndexLoadPromise;
}

function scheduleSearchIndexPreload() {
  window.clearTimeout(state.searchIndexPreloadTimer);
  state.searchIndexPreloadTimer = window.setTimeout(() => {
    const preload = () => ensureSearchIndexLoaded().catch(() => {});
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preload, { timeout: 2500 });
    } else {
      preload();
    }
  }, SEARCH_INDEX_PRELOAD_DELAY_MS);
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
  const selectedCategory = String(state.globalSearchCategory || "").trim();
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
  els.globalSearchScopeMenu?.classList.add("hidden");
  els.globalSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function isGlobalSearchPanelOpen() {
  return Boolean(state.globalSearchOpen && els.catalogSearch && !els.catalogSearch.classList.contains("hidden"));
}

function setGlobalSearchPanelOpen(open, options = {}) {
  const shouldOpen = Boolean(open);
  state.globalSearchOpen = shouldOpen;

  if (!els.catalogSearch) return;

  els.catalogSearch.classList.toggle("hidden", !shouldOpen);
  els.catalogSearch.classList.toggle("is-open", shouldOpen);
  els.catalogSearch.setAttribute("aria-hidden", shouldOpen ? "false" : "true");

  els.globalSearchOpen?.classList.toggle("is-active", shouldOpen);
  els.globalSearchOpen?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");

  if (shouldOpen) {
    renderGlobalSearchScopeMenu();
    renderSearchResults(els.globalSearchInput?.value || "");
    if (options.focus !== false) {
      window.requestAnimationFrame(() => els.globalSearchInput?.focus({ preventScroll: true }));
    }
    return;
  }

  closeGlobalSearchScopeMenu();
  hideSearchFloatingPreview();
  if (options.hideResults !== false) {
    els.globalSearchResults?.classList.add("hidden");
  }
  if (options.focusButton) {
    window.requestAnimationFrame(() => els.globalSearchOpen?.focus({ preventScroll: true }));
  }
}

function openGlobalSearchPanel(options = {}) {
  setGlobalSearchPanelOpen(true, options);
}

function closeGlobalSearchPanel(options = {}) {
  setGlobalSearchPanelOpen(false, options);
}

function renderGlobalSearchScopeMenu() {
  if (!els.globalSearchScopeMenu) return;

  const categories = getGlobalSearchCategories();
  els.globalSearchScopeMenu.innerHTML = `
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
  if (els.globalSearchScopeToggle) {
    els.globalSearchScopeToggle.innerHTML = `${escapeHtml(globalSearchScopeLabel(category))} <span aria-hidden="true">⌄</span>`;
    els.globalSearchScopeToggle.title = category ? `חיפוש רק בקטגוריית ${category}` : "חיפוש בכל הקטלוגים";
  }
  if (els.globalSearchInput) {
    els.globalSearchInput.placeholder = globalSearchPlaceholder();
    els.globalSearchInput.setAttribute("aria-label", globalSearchPlaceholder());
  }
  els.globalSearchScopeMenu?.querySelectorAll("[data-global-search-category]").forEach((button) => {
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

  if (state.globalSearchCategory === nextCategory) {
    syncGlobalSearchScopeUi();
    closeGlobalSearchScopeMenu();
    return;
  }

  state.globalSearchCategory = nextCategory;
  syncGlobalSearchScopeUi();
  closeGlobalSearchScopeMenu();
  initSearchStatus();

  if (options.render !== false && els.globalSearchInput) {
    renderSearchResults(els.globalSearchInput.value);
  }
}

function initSearchStatus() {
  syncGlobalSearchScopeUi();
}

function getLightboxSearchScope() {
  return state.lightboxSearchScope === "all" ? "all" : "catalog";
}

function lightboxSearchScopeLabel(scope = getLightboxSearchScope()) {
  return scope === "all" ? "בכל הקטלוגים" : "בקטלוג הזה";
}

function lightboxSearchPlaceholder() {
  if (getLightboxSearchScope() === "all") return "חיפוש דגם בכל הקטלוגים...";
  const title = String(state.catalog?.title || "").trim();
  return title ? `חיפוש דגם בקטלוג הזה: ${title}` : "חיפוש דגם בקטלוג הזה...";
}

function closeLightboxSearchScopeMenu() {
  els.lightboxSearchScopeMenu?.classList.add("hidden");
  els.lightboxSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function closeLightboxCatalogMenu() {
  els.lightboxCatalogMenu?.classList.add("hidden");
  els.lightboxCatalogMenuToggle?.setAttribute("aria-expanded", "false");
}

function isMobileReaderSearchMode() {
  return Boolean(window.matchMedia?.(MOBILE_READER_SEARCH_MEDIA).matches);
}

function syncLightboxMobileSearchUi() {
  const compactMode = isMobileReaderSearchMode();
  const isOpen = compactMode && state.lightboxMobileSearchOpen;

  if (!compactMode) state.lightboxMobileSearchOpen = false;
  els.lightbox?.classList.toggle("mobile-search-open", isOpen);
  els.lightboxMobileSearchToggle?.setAttribute("aria-expanded", isOpen ? "true" : "false");
  els.lightboxSearchPanel?.setAttribute("aria-hidden", compactMode && !isOpen ? "true" : "false");
}

function setLightboxMobileSearchOpen(open, options = {}) {
  const { focusInput = false, returnFocus = false, hideResults = true, hideTopUi = false } = options;
  const shouldOpen = Boolean(open && state.lightboxOpen && isMobileReaderSearchMode());

  state.lightboxMobileSearchOpen = shouldOpen;
  syncLightboxMobileSearchUi();

  if (shouldOpen) {
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    showTopUiTemporarily(0);
    ensureSearchIndexLoaded().catch(() => {});
    if (focusInput) {
      window.requestAnimationFrame(() => els.lightboxSearchInput?.focus());
    }
    return;
  }

  if (hideResults) {
    hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi });
  }
  if (returnFocus && isMobileReaderSearchMode()) {
    els.lightboxMobileSearchToggle?.focus();
  }
}

function closeDetailCatalogMenu() {
  els.catalogMenu?.classList.add("hidden");
  els.catalogMenuToggle?.setAttribute("aria-expanded", "false");
}

function syncLightboxSearchScopeUi() {
  const scope = getLightboxSearchScope();
  if (els.lightboxSearchScopeToggle) {
    els.lightboxSearchScopeToggle.innerHTML = `${escapeHtml(lightboxSearchScopeLabel(scope))} <span aria-hidden="true">⌄</span>`;
  }
  if (els.lightboxSearchInput) {
    els.lightboxSearchInput.placeholder = lightboxSearchPlaceholder();
    els.lightboxSearchInput.setAttribute("aria-label", lightboxSearchPlaceholder());
  }
  els.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]").forEach((button) => {
    const selected = button.dataset.lightboxSearchScope === scope;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

function setLightboxSearchScope(scope, options = {}) {
  const nextScope = scope === "all" ? "all" : "catalog";
  if (state.lightboxSearchScope === nextScope) {
    syncLightboxSearchScopeUi();
    closeLightboxSearchScopeMenu();
    return;
  }

  state.lightboxSearchScope = nextScope;
  syncLightboxSearchScopeUi();
  closeLightboxSearchScopeMenu();
  initLightboxSearchStatus();

  if (options.render !== false && els.lightboxSearchInput) {
    renderLightboxSearchResults(els.lightboxSearchInput.value);
  }
}

function hideLightboxSearchResults(options = {}) {
  const { blurTopUiFocus = false, hideTopUi = false } = options;

  hideSearchFloatingPreview();
  els.lightboxSearchResults?.classList.add("hidden");
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();

  if (blurTopUiFocus) {
    const activeElement = document.activeElement;
    if (activeElement && els.lightboxBar?.contains(activeElement) && typeof activeElement.blur === "function") {
      activeElement.blur();
    }
  }

  if (hideTopUi && !state.topUiPinned) {
    window.clearTimeout(state.uiHideTimer);
    els.lightbox?.classList.remove("show-ui");
  }
}

function resetLightboxSearch() {
  state.lightboxMobileSearchOpen = false;
  syncLightboxMobileSearchUi();
  if (els.lightboxSearchInput) els.lightboxSearchInput.value = "";
  hideLightboxSearchResults({ blurTopUiFocus: true });
  if (els.lightboxSearchResults) els.lightboxSearchResults.innerHTML = "";
  els.lightboxSearchClear?.classList.add("hidden");
  syncLightboxSearchScopeUi();
  initLightboxSearchStatus();
}

function getLightboxSearchResults(query, limit = 24) {
  const rawQuery = String(query || "").trim();
  if (rawQuery.length < 2 || !catalogSearch?.hasIndex?.()) return [];

  const options = { limit, includeExcerpt: false };
  if (getLightboxSearchScope() !== "all") {
    if (!state.catalog) return [];
    options.catalogId = state.catalog.id;
  }

  const results = catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

function trackCompletedLightboxSearch(completion, query = els.lightboxSearchInput?.value || "") {
  const rawQuery = String(query || "").trim();
  const scope = getLightboxSearchScope();
  const results = getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24);
  telemetryTrackSearch(rawQuery, results.length, {
    surface: "viewer",
    scope,
    catalogId: scope === "all" ? "" : state.catalog?.id,
    completion
  });
  return results;
}

function openLightboxSearchResult(result) {
  if (!result) return false;

  const targetCatalogId = result.catalogId || state.catalog?.id;
  if (!targetCatalogId) return false;

  if (!state.catalog || state.catalog.id !== targetCatalogId) {
    openCatalogInViewer(targetCatalogId, Number(result.page));
    return true;
  }

  const page = clampPage(result.page, state.catalog);
  setLightboxPage(page);
  showTopUiTemporarily(0);
  if (state.lightboxMobileSearchOpen) {
    setLightboxMobileSearchOpen(false, { hideResults: true });
  } else {
    hideLightboxSearchResults();
  }
  return true;
}

function submitLightboxSearch() {
  const rawQuery = String(els.lightboxSearchInput?.value || "").trim();
  renderLightboxSearchResults(rawQuery);
  const results = trackCompletedLightboxSearch("submit", rawQuery);
  return openLightboxSearchResult(results[0]);
}

function initLightboxSearchStatus() {
  if (!els.lightboxSearchStatus) return;

  const hasCatalog = Boolean(state.catalog);
  const hasIndex = Boolean(catalogSearch?.hasIndex?.());
  const indexPending = !hasIndex && state.searchIndexLoadState !== "error";
  if (els.lightboxSearchInput) els.lightboxSearchInput.disabled = !hasCatalog;
  syncLightboxSearchScopeUi();

  if (!hasCatalog) {
    els.lightboxSearchStatus.textContent = "בחר קטלוג כדי לחפש.";
    return;
  }

  if (!hasIndex) {
    els.lightboxSearchStatus.textContent = indexPending
      ? "אינדקס החיפוש נטען לפי הצורך."
      : "אינדקס החיפוש אינו זמין כרגע.";
    return;
  }

  els.lightboxSearchStatus.textContent = getLightboxSearchScope() === "all"
    ? "הקלד לפחות 2 תווים לחיפוש בכל הקטלוגים."
    : "הקלד לפחות 2 תווים לחיפוש בתוך הקטלוג הפתוח.";
}

function hideSearchFloatingPreview() {
  els.searchFloatingPreview?.classList.remove("visible");
}

function isGlobalSearchScopeMenuOpen() {
  return Boolean(els.globalSearchScopeMenu && !els.globalSearchScopeMenu.classList.contains("hidden"));
}

function isLightboxSearchScopeMenuOpen() {
  return Boolean(els.lightboxSearchScopeMenu && !els.lightboxSearchScopeMenu.classList.contains("hidden"));
}

function rememberSearchPreviewPointer(event) {
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

  state.searchPreviewPointerClientX = clientX;
  state.searchPreviewPointerClientY = clientY;
}

function searchPreviewTargetBelongsToOpenResults(target) {
  if (!target || !target.isConnected) return false;

  if (els.globalSearchResults?.contains(target)) {
    return isGlobalSearchPanelOpen() && !els.globalSearchResults.classList.contains("hidden");
  }

  if (els.lightboxSearchResults?.contains(target)) {
    return state.lightboxOpen && !els.lightboxSearchResults.classList.contains("hidden");
  }

  return false;
}

function isSearchPreviewBlockedByOpenMenu(target) {
  if (els.globalSearchResults?.contains(target) && isGlobalSearchScopeMenuOpen()) return true;
  if (els.lightboxSearchResults?.contains(target) && isLightboxSearchScopeMenuOpen()) return true;
  return false;
}

function getSearchPreviewTargetAtLastPointer() {
  const clientX = Number(state.searchPreviewPointerClientX);
  const clientY = Number(state.searchPreviewPointerClientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  if (clientX < 0 || clientY < 0 || clientX > window.innerWidth || clientY > window.innerHeight) return null;

  const element = document.elementFromPoint(clientX, clientY);
  const target = element?.closest?.("[data-search-preview-src]");
  return searchPreviewTargetBelongsToOpenResults(target) ? target : null;
}

function isSearchPreviewSuppressed() {
  return Date.now() < (state.searchPreviewSuppressUntil || 0);
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
  state.searchPreviewSuppressUntil = Math.max(
    state.searchPreviewSuppressUntil || 0,
    Date.now() + delay
  );
  hideSearchFloatingPreview();

  window.clearTimeout(state.searchPreviewSuppressTimer);
  state.searchPreviewSuppressTimer = window.setTimeout(() => {
    state.searchPreviewSuppressTimer = 0;
    if (restoreAfter) restoreSearchFloatingPreviewAfterSuppression();
  }, delay + 20);
}

function searchPreviewPageLabel(target) {
  return String(target?.dataset?.searchPreviewTitle || "קטלוג").trim() || "קטלוג";
}

function positionSearchFloatingPreview(target) {
  const preview = els.searchFloatingPreview;
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
  if (!target || !els.searchFloatingPreview || !els.searchFloatingPreviewImage) return;
  if (!searchPreviewTargetBelongsToOpenResults(target)) return;
  if (isSearchPreviewSuppressed()) return;
  if (isSearchPreviewBlockedByOpenMenu(target)) return;

  const src = String(target.dataset.searchPreviewSrc || "").trim();
  if (!src) return;

  const label = searchPreviewPageLabel(target);
  els.searchFloatingPreviewImage.onload = () => positionSearchFloatingPreview(target);
  setCatalogImageSource(els.searchFloatingPreviewImage, src);
  els.searchFloatingPreviewImage.alt = label;
  if (els.searchFloatingPreviewPage) els.searchFloatingPreviewPage.textContent = label;

  els.searchFloatingPreview.classList.add("visible");
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
  if (isGlobalSearchScopeMenuOpen() && els.globalSearchScopeMenu?.contains(eventTarget)) {
    return els.globalSearchScopeMenu;
  }

  if (els.globalSearchResults && !els.globalSearchResults.classList.contains("hidden")) {
    return els.globalSearchResults;
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
  if (!isGlobalSearchPanelOpen() || !els.catalogSearch?.contains(event.target)) return;

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
  return Math.max(1, Math.min(catalogLayoutColumnCount(), 3));
}

function updateLightboxSearchResultsLayout(count = 0) {
  if (!els.lightboxSearchResults) return;
  normalizeSearchResultsDirection(els.lightboxSearchResults);

  const resultCount = Math.max(0, Number(count) || 0);
  const columns = Math.max(1, Math.min(resultCount || 1, lightboxSearchLayoutColumnLimit()));
  els.lightboxSearchResults.style.setProperty("--reader-search-result-columns", String(columns));
  els.lightboxSearchResults.dataset.resultColumns = String(columns);
  els.lightboxSearchResults.dataset.resultCount = String(resultCount);
}

function searchEmptyStateMarkup(query, message, options = {}) {
  const reader = options.reader === true;
  const wrapperClass = reader
    ? "reader-search-empty lightbox-search-empty empty-state empty-state-dark"
    : "search-empty empty-state";
  const actionAttribute = reader ? "data-lightbox-empty-search-clear" : "data-empty-search-clear";
  return `
    <article class="${wrapperClass}">
      <span class="empty-state-icon" aria-hidden="true">
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

function renderLightboxSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!els.lightboxSearchResults || !els.lightboxSearchStatus) return;

  normalizeSearchResultsDirection(els.lightboxSearchResults);
  hideSearchFloatingPreview();
  updateLightboxSearchResultsLayout(0);
  els.lightboxSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    els.lightboxSearchResults.classList.add("hidden");
    els.lightboxSearchResults.innerHTML = "";
    initLightboxSearchStatus();
    return;
  }

  if (!state.catalog || !catalogSearch?.hasIndex?.()) {
    els.lightboxSearchResults.classList.add("hidden");
    els.lightboxSearchResults.innerHTML = "";
    els.lightboxSearchStatus.textContent = "אין אינדקס חיפוש פעיל לקטלוג הזה.";
    return;
  }

  const scope = getLightboxSearchScope();
  const results = getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24);
  updateLightboxSearchResultsLayout(results.length);
  els.lightboxSearchResults.classList.remove("hidden");

  if (!results.length) {
    els.lightboxSearchStatus.textContent = scope === "all"
      ? "לא נמצאו תוצאות בכל הקטלוגים."
      : "לא נמצאו תוצאות בקטלוג הפתוח.";
    els.lightboxSearchResults.innerHTML = searchEmptyStateMarkup(
      rawQuery,
      "נסה חלק קצר יותר של הדגם או מילה אחרת.",
      { reader: true }
    );
    els.lightboxSearchResults.querySelector("[data-lightbox-empty-search-clear]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      els.lightboxSearchInput.value = "";
      renderLightboxSearchResults("");
      els.lightboxSearchInput.focus();
    });
    return;
  }

  els.lightboxSearchStatus.textContent = scope === "all"
    ? `נמצאו ${results.length} תוצאות בכל הקטלוגים.`
    : `נמצאו ${results.length} תוצאות בקטלוג הזה.`;
  els.lightboxSearchResults.innerHTML = results.map((result) => {
    const catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId) || state.catalog;
    const page = clampPage(result.page, catalog);
    const rawPreview = result.image || pageSrc(catalog, page);
    const rawThumb = result.thumb || thumbSrc(catalog, page);
    const rawImage = rawPreview || rawThumb;
    const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
    return `
      <button class="reader-search-result lightbox-search-result" type="button" data-lightbox-search-catalog="${escapeHtml(result.catalogId || catalog?.id || "")}" data-lightbox-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
        <span class="reader-search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
        <span class="reader-search-thumb-frame catalog-image-frame">
          <img class="reader-search-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(rawImage)} />
        </span>
      </button>
    `;
  }).join("");

  bindSearchFloatingPreviewEvents(els.lightboxSearchResults);

  els.lightboxSearchResults.querySelectorAll("[data-lightbox-search-page]").forEach((button) => {
    button.addEventListener("click", () => {
      trackCompletedLightboxSearch("result-open");
      hideSearchFloatingPreview();
      openLightboxSearchResult({
        catalogId: button.dataset.lightboxSearchCatalog,
        page: button.dataset.lightboxSearchPage
      });
    });
  });
}

function renderCatalogCategoryMenu(menu, { activeCatalogId = state.catalog?.id } = {}) {
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
  if (!els.lightboxCatalogMenu) return;

  renderCatalogCategoryMenu(els.lightboxCatalogMenu);

  els.lightboxCatalogMenu.querySelectorAll("[data-catalog-menu-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.catalogMenuId;
      closeLightboxCatalogMenu();
      if (!catalogId || catalogId === state.catalog?.id) return;
      openCatalogInViewer(catalogId, 1);
    });
  });
}

function updateDetailCatalogMenuLabel(catalog = state.catalog) {
  if (!els.catalogMenuToggleText) return;
  els.catalogMenuToggleText.textContent = catalog?.title || "בחר קטלוג";
}

function renderDetailCatalogMenu() {
  if (!els.catalogMenu) return;

  renderCatalogCategoryMenu(els.catalogMenu);

  els.catalogMenu.querySelectorAll("[data-catalog-menu-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.catalogMenuId;
      closeDetailCatalogMenu();
      if (!catalogId || catalogId === state.catalog?.id) return;
      openCatalog(catalogId);
    });
  });
}

function getGlobalSearchResults(query, limit = 72) {
  const rawQuery = String(query || "").trim();
  const category = getGlobalSearchCategory();
  if (rawQuery.length < 2 || !catalogSearch?.hasIndex?.({ category })) return [];

  const options = { limit, includeExcerpt: false };
  if (category) options.category = category;

  const results = catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

function trackCompletedGlobalSearch(completion, query = els.globalSearchInput?.value || "", options = {}) {
  const rawQuery = String(query || "").trim();
  const category = getGlobalSearchCategory();
  const results = getGlobalSearchResults(rawQuery, 72);
  telemetryTrackSearch(rawQuery, results.length, {
    surface: "global",
    scope: category || "all",
    completion,
    immediate: options.immediate === true
  });
  return results;
}

function flushGlobalSearchTelemetryBeforeNavigation() {
  // Search-result clicks leave the current document immediately. Start a
  // keepalive request synchronously instead of relying on the delayed batch
  // timer or on pagehide, both of which can be skipped by fast navigations.
  telemetryFlush().catch(() => {});
}

function openGlobalSearchResult(result) {
  if (!result) return false;
  hideSearchFloatingPreview();
  openCatalog(result.catalogId, { openPage: Number(result.page) });
  closeGlobalSearchPanel({ focusButton: false });
  return true;
}

function submitGlobalSearch() {
  const rawQuery = String(els.globalSearchInput?.value || "").trim();
  renderSearchResults(rawQuery);
  const results = trackCompletedGlobalSearch("submit", rawQuery, { immediate: true });
  flushGlobalSearchTelemetryBeforeNavigation();
  return openGlobalSearchResult(results[0]);
}

function renderSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!els.globalSearchResults) return;

  normalizeSearchResultsDirection(els.globalSearchResults);
  hideSearchFloatingPreview();
  els.globalSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    els.globalSearchResults.classList.add("hidden");
    els.globalSearchResults.innerHTML = "";
    initSearchStatus();
    return;
  }

  const category = getGlobalSearchCategory();

  if (!catalogSearch?.hasIndex?.({ category })) {
    els.globalSearchResults.classList.add("hidden");
    els.globalSearchResults.innerHTML = "";
    return;
  }

  const results = getGlobalSearchResults(rawQuery, 72);
  if (!results.length) {
    els.globalSearchResults.classList.remove("hidden");
    els.globalSearchResults.innerHTML = searchEmptyStateMarkup(
      rawQuery,
      category
        ? "נסה מספר דגם קצר יותר, חלק מהמילה, או חפש שוב בכל הקטלוגים."
        : "נסה מספר דגם קצר יותר או חלק מהמילה."
    );
    els.globalSearchResults.querySelector("[data-empty-search-clear]")?.addEventListener("click", () => {
      els.globalSearchInput.value = "";
      renderSearchResults("");
      els.globalSearchInput.focus();
    });
    return;
  }

  els.globalSearchResults.classList.remove("hidden");
  els.globalSearchResults.innerHTML = results.map((result) => {
    const catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId);
    const page = clampPage(result.page, catalog);
    const rawThumb = result.thumb || (catalog ? thumbSrc(catalog, page) : "");
    const rawPreview = result.image || (catalog ? pageSrc(catalog, page) : rawThumb);
    const rawImage = rawPreview || rawThumb;
    const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
    return `
      <article class="search-result-card">
        <button type="button" class="search-result-button" data-search-catalog="${escapeHtml(result.catalogId)}" data-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
          <span class="search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
          <span class="search-result-thumb-frame catalog-image-frame">
            <img class="search-result-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(rawImage)} />
          </span>
        </button>
      </article>
    `;
  }).join("");

  bindSearchFloatingPreviewEvents(els.globalSearchResults);

  els.globalSearchResults.querySelectorAll("[data-search-catalog]").forEach((button) => {
    button.addEventListener("click", () => {
      trackCompletedGlobalSearch("result-open", undefined, { immediate: true });
      flushGlobalSearchTelemetryBeforeNavigation();
      openGlobalSearchResult({ catalogId: button.dataset.searchCatalog, page: button.dataset.searchPage });
    });
  });
}

function attachSearchUiEvents() {
  els.globalSearchOpen?.addEventListener("click", (event) => {
    event.preventDefault();
    ensureSearchIndexLoaded().catch(() => {});
    event.stopPropagation();
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    setGlobalSearchPanelOpen(!isGlobalSearchPanelOpen(), { focus: true, focusButton: true });
  });
  els.globalSearchClose?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeGlobalSearchPanel({ focusButton: true });
  });

  els.globalSearchInput?.addEventListener("input", () => {
    ensureSearchIndexLoaded().then(() => renderSearchResults(els.globalSearchInput.value)).catch(() => renderSearchResults(els.globalSearchInput.value));
  });
  els.globalSearchInput?.addEventListener("focus", () => {
    ensureSearchIndexLoaded().then(() => renderSearchResults(els.globalSearchInput.value)).catch(() => renderSearchResults(els.globalSearchInput.value));
  });
  els.globalSearchInput?.addEventListener("click", () => renderSearchResults(els.globalSearchInput.value));
  els.globalSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitGlobalSearch();
  });
  els.globalSearchClear?.addEventListener("click", () => {
    els.globalSearchInput.value = "";
    els.globalSearchInput.focus();
    renderSearchResults("");
  });

  els.globalSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    hideSearchFloatingPreview();
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderGlobalSearchScopeMenu();
    const isOpen = !els.globalSearchScopeMenu?.classList.contains("hidden");
    els.globalSearchScopeMenu?.classList.toggle("hidden", isOpen);
    els.globalSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  els.globalSearchScopeMenu?.addEventListener("click", (event) => {
    event.stopPropagation();
    const button = event.target.closest?.("[data-global-search-category]");
    if (!button || !els.globalSearchScopeMenu.contains(button)) return;
    setGlobalSearchCategory(button.dataset.globalSearchCategory);
    els.globalSearchInput?.focus();
  });
  els.catalogSearch?.addEventListener("wheel", handleGlobalSearchPanelWheel, { passive: false });
  els.globalSearchResults?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });
  els.globalSearchScopeMenu?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });
  els.lightboxSearchResults?.addEventListener("wheel", handleSearchPreviewScrollIntent, { passive: true });
  els.lightboxSearchResults?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });
  els.lightboxSearchScopeMenu?.addEventListener("wheel", handleSearchPreviewScrollIntent, { passive: true });
  els.lightboxSearchScopeMenu?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });

  els.lightboxSearchInput?.addEventListener("input", () => {
    ensureSearchIndexLoaded().then(() => renderLightboxSearchResults(els.lightboxSearchInput.value)).catch(() => renderLightboxSearchResults(els.lightboxSearchInput.value));
  });
  els.lightboxSearchInput?.addEventListener("focus", () => {
    showTopUiTemporarily(0);
    ensureSearchIndexLoaded().then(() => renderLightboxSearchResults(els.lightboxSearchInput.value)).catch(() => renderLightboxSearchResults(els.lightboxSearchInput.value));
  });
  els.lightboxSearchInput?.addEventListener("click", () => {
    showTopUiTemporarily(0);
    renderLightboxSearchResults(els.lightboxSearchInput.value);
  });
  els.lightboxSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitLightboxSearch();
  });
  els.lightboxSearchClear?.addEventListener("click", () => {
    els.lightboxSearchInput.value = "";
    els.lightboxSearchInput.focus();
    renderLightboxSearchResults("");
    showTopUiTemporarily(0);
  });

  els.lightboxMobileSearchToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLightboxMobileSearchOpen(!state.lightboxMobileSearchOpen, {
      focusInput: true,
      returnFocus: state.lightboxMobileSearchOpen
    });
  });
  els.lightboxMobileSearchClose?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLightboxMobileSearchOpen(false, { returnFocus: true, hideResults: true });
  });

  els.lightboxSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    hideSearchFloatingPreview();
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    const isOpen = !els.lightboxSearchScopeMenu?.classList.contains("hidden");
    els.lightboxSearchScopeMenu?.classList.toggle("hidden", isOpen);
    els.lightboxSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    showTopUiTemporarily(0);
  });
  els.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setLightboxSearchScope(button.dataset.lightboxSearchScope);
      showTopUiTemporarily(0);
      els.lightboxSearchInput?.focus();
    });
  });
  els.lightboxCatalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeDetailCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderLightboxCatalogMenu();
    const isOpen = !els.lightboxCatalogMenu?.classList.contains("hidden");
    els.lightboxCatalogMenu?.classList.toggle("hidden", isOpen);
    els.lightboxCatalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    showTopUiTemporarily(0);
  });
  els.lightboxCatalogMenu?.addEventListener("click", (event) => event.stopPropagation());
  els.lightboxSearchResults?.addEventListener("click", handleLightboxSearchResultsBackgroundClick);
}
/* ===== END SOURCE: src/js/50-search-ui.js ===== */

/* ===== BEGIN SOURCE: src/js/60-viewer.js ===== */
/**
 * Source module: 60-viewer.js
 * Catalog viewer lifecycle, page loading, layout, fullscreen, top controls, page rail, and zoom state.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function updateHash() {
  if (!window.history?.replaceState) return;

  if (isAppPage("catalog") && state.catalog) {
    history.replaceState(history.state, "", catalogDocumentUrl(state.catalog.id));
  } else if (isAppPage("viewer") && state.catalog) {
    history.replaceState(history.state, "", viewerDocumentUrl(state.catalog.id, state.page, {
      source: isFavoritesLightboxMode() ? LIGHTBOX_SOURCE_FAVORITES : LIGHTBOX_SOURCE_CATALOG
    }));
  }

  updateDocumentMetadata(state.catalog);
}

function getPointerList() {
  return Array.from(state.pointers.values());
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

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getMinimumViewerZoom() {
  // Manual zoom-out must be available in both fit modes. The fit mode defines
  // the automatic base size; the manual zoom layer should use one shared lower
  // bound so fit-height can shrink just like fit-width.
  return MIN_VIEWER_ZOOM;
}

function isAutoViewerZoom(value = state.zoom) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric - AUTO_VIEWER_ZOOM) <= 0.001;
}

function getSafeViewerZoom(value = state.zoom) {
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

function isScrollViewerMode() {
  return state.viewerLayoutMode === VIEWER_LAYOUT_SCROLL && !isFavoritesLightboxMode();
}

function isViewerScrollIsolatedZoom() {
  return isScrollViewerMode() && Boolean(state.viewerScrollIsolatedZoom);
}

function getActiveSingleImageNaturalSize() {
  if (isViewerScrollIsolatedZoom() && state.catalog) {
    return pageSize(state.catalog, state.viewerScrollIsolatedPage || state.page);
  }

  const image = els.lightboxImage;
  if (image?.naturalWidth && image?.naturalHeight) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }

  return null;
}

function getSingleImageDisplayMetrics() {
  if (isScrollViewerMode() && !isViewerScrollIsolatedZoom()) return null;
  const naturalSize = getActiveSingleImageNaturalSize();
  const stage = els.stageCanvas;
  if (!naturalSize || !stage) return null;

  const safeZoom = getSafeViewerZoom();
  const width = naturalSize.width * state.fitScale * safeZoom;
  const height = naturalSize.height * state.fitScale * safeZoom;
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

function clampSinglePan() {
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return;

  if (metrics.overflowX <= 1) state.panX = 0;
  else state.panX = clampValue(state.panX, -metrics.overflowX, metrics.overflowX);

  if (metrics.overflowY <= 1) state.panY = 0;
  else state.panY = clampValue(state.panY, -metrics.overflowY, metrics.overflowY);
}

function shouldPreserveSingleManualPosition(options = {}) {
  return (
    options.keepZoom !== false &&
    options.resetZoom !== true &&
    options.resetPosition !== true &&
    !isAutoViewerZoom()
  );
}





function resetImagePosition(options = {}) {
  state.panX = 0;
  state.panY = 0;
  if (options.queueSingleFitOrigin) {
    state.singleImageFitOriginPending = true;
  }
}

function applyPendingSingleImageFitOrigin() {
  if (!state.singleImageFitOriginPending) return;

  state.panX = 0;
  state.panY = 0;

  const metrics = getSingleImageDisplayMetrics();
  if (metrics && state.imageFitMode === VIEWER_FIT_WIDTH && metrics.overflowY > 1) {
    // Fit-width pages are often taller than the viewport. Start at the real
    // top of the page instead of vertically centering and hiding the header.
    state.panY = metrics.overflowY;
  }

  state.singleImageFitOriginPending = false;
}

function singleImageFitLayout(naturalWidth, naturalHeight) {
  const stage = els.stageCanvas;
  const width = Number(naturalWidth);
  const height = Number(naturalHeight);
  if (!stage || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

  const availableWidth = Math.max(260, stage.clientWidth - 18);
  const availableHeight = Math.max(260, stage.clientHeight - 18);
  const widthScale = availableWidth / width;
  const heightScale = availableHeight / height;
  const fitScale = state.imageFitMode === VIEWER_FIT_WIDTH ? widthScale : heightScale;
  return {
    fitScale,
    width: Math.max(220, Math.round(width * fitScale)),
    height: Math.max(160, Math.round(height * fitScale))
  };
}

function applyLightboxFrameGeometry(naturalWidth, naturalHeight, options = {}) {
  const frame = els.lightboxImageFrame;
  const image = els.lightboxImage;
  const layout = singleImageFitLayout(naturalWidth, naturalHeight);
  if (!frame || !image || !layout) return null;

  if (options.updateFitScale !== false) state.fitScale = layout.fitScale;
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
  return Boolean(applyLightboxFrameGeometry(size.width, size.height, { updateFitScale: false }));
}

function applySingleZoom() {
  const frame = els.lightboxImageFrame;
  const naturalSize = getActiveSingleImageNaturalSize();
  if (!naturalSize || !frame) return;

  applyLightboxFrameGeometry(naturalSize.width, naturalSize.height);

  if (state.singleImageFitOriginPending) {
    applyPendingSingleImageFitOrigin();
  } else if (isAutoViewerZoom() && !singleImageCanPan()) {
    resetImagePosition();
  }
  clampSinglePan();
  frame.style.setProperty("--single-pan-x", `${state.panX}px`);
  frame.style.setProperty("--single-pan-y", `${state.panY}px`);
  frame.style.setProperty("--single-zoom", String(state.zoom));
  frame.style.transform = `translate(-50%, -50%) translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
}


function applyZoom(options = {}) {
  if (isScrollViewerMode()) {
    if (isViewerScrollIsolatedZoom()) {
      applySingleZoom();
    } else {
      applyViewerScrollZoom(options.scrollAnchor || null);
    }
    els.lightbox?.classList.toggle("is-zoomed", !isAutoViewerZoom());
    syncViewerAutoZoomButtonUi();
    return;
  }

  applySingleZoom();

  const isManualZoom = !isAutoViewerZoom();
  els.lightbox?.classList.toggle("is-zoomed", isManualZoom || viewerCanPan());
  syncViewerAutoZoomButtonUi();
}

function showTopUiTemporarily(delay = 2200) {
  if (!els.lightbox) return;
  window.clearTimeout(state.uiHideTimer);
  els.lightbox.classList.add("show-ui");
  if (state.topUiPinned || state.viewerMobileMoreOpen) return;
  if (delay > 0) {
    state.uiHideTimer = window.setTimeout(() => {
      if (!state.topUiPinned && !state.viewerMobileMoreOpen) els.lightbox.classList.remove("show-ui");
    }, delay);
  }
}


function getLightboxPinnedTopOffset() {
  if (!state.topUiPinned || !els.lightboxBar) return 0;

  const rect = els.lightboxBar.getBoundingClientRect?.();
  const measuredHeight = rect ? Math.max(rect.height || 0, rect.bottom > 0 ? rect.bottom : 0) : 0;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  const maxReasonableOffset = Math.max(0, viewportHeight * 0.42);
  return Math.round(clampValue(measuredHeight, 0, maxReasonableOffset));
}

function syncLightboxTopSafeArea() {
  if (!els.lightbox) return 0;

  const offset = getLightboxPinnedTopOffset();
  els.lightbox.style.setProperty("--lightbox-top-safe-offset", `${offset}px`);
  return offset;
}

function refreshLightboxLayoutForTopUiChange(options = {}) {
  if (!state.lightboxOpen) {
    syncLightboxTopSafeArea();
    return;
  }

  const { resetAutoSingleOrigin = true } = options;
  syncLightboxTopSafeArea();

  if (isScrollViewerMode()) {
    refreshViewerScrollPageGeometry({
      preservePage: true,
      zoomAnchor: getViewerScrollZoomAnchor()
    });
    return;
  }

  if (resetAutoSingleOrigin && isAutoViewerZoom()) {
    resetImagePosition({ queueSingleFitOrigin: true });
  }

  applyZoom();

}

function syncTopUiPinnedUi() {
  const pinned = Boolean(state.topUiPinned);
  const label = pinned ? "ביטול נעיצת הסרגל העליון" : "נעיצת הסרגל העליון";

  window.clearTimeout(state.uiHideTimer);
  els.lightbox?.classList.toggle("top-ui-pinned", pinned);
  if (pinned) els.lightbox?.classList.add("show-ui");
  syncLightboxTopSafeArea();
  syncViewerMobileMoreMenuState();

  if (!els.lightboxPinTopBar) return;
  els.lightboxPinTopBar.dataset.pinned = pinned ? "true" : "false";
  els.lightboxPinTopBar.setAttribute("aria-pressed", pinned ? "true" : "false");
  els.lightboxPinTopBar.setAttribute("aria-label", label);
  setTooltipText(els.lightboxPinTopBar, label, { updateDefault: true });
}

function setTopUiPinned(pinned) {
  state.topUiPinned = Boolean(pinned);
  syncTopUiPinnedUi();
  refreshLightboxLayoutForTopUiChange();
  if (!state.topUiPinned) showTopUiTemporarily(1400);
}

function toggleTopUiPinned() {
  setTopUiPinned(!state.topUiPinned);
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
  if (state.topUiPinned || state.viewerMobileMoreOpen) return true;
  const point = getViewportPointer(event);
  if (!point || !els.lightboxBar) return false;

  const barRect = els.lightboxBar.getBoundingClientRect();
  const hotspotRect = els.topHotspot?.getBoundingClientRect?.();
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
  if (!els.lightbox || !state.lightboxOpen || state.topUiPinned || state.viewerMobileMoreOpen) return;
  if (shouldKeepTopUiOpenForPointer(event)) return;
  window.clearTimeout(state.uiHideTimer);
  state.uiHideTimer = window.setTimeout(() => {
    if (!state.topUiPinned && !state.viewerMobileMoreOpen) els.lightbox?.classList.remove("show-ui");
  }, 420);
}

function shouldKeepPageRailOpenForPointer(event = null) {
  const point = getViewportPointer(event);
  if (!point || !els.lightboxPageRail) return false;

  const railRect = els.lightboxPageRail.getBoundingClientRect();
  const hotspotRect = els.lightboxSideHotspot?.getBoundingClientRect?.();
  if (pointInRect(point, railRect, 1) || pointInRect(point, hotspotRect, 1)) return true;

  // During the slide-in animation the rail can still be geometrically outside
  // the viewport, while the pointer is already on the right activation strip or
  // in the tiny edge gap. Keep the rail open for that whole right-edge region
  // instead of requiring the user to wait until the transition finishes.
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const hotspotWidth = Math.max(2, Math.round(hotspotRect?.width || 34));
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

  if (els.lightbox?.classList.contains("show-ui") && !shouldKeepTopUiOpenForPointer(event)) {
    scheduleTopUiClose(event);
  }

  if (els.lightbox?.classList.contains("show-page-rail") && !shouldKeepPageRailOpenForPointer(event)) {
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
  if (!point || state.topUiPinned) return false;
  const { width } = getViewportSize();
  const hotspotRect = els.topHotspot?.getBoundingClientRect?.();
  const hotspotHeight = Math.max(2, Math.round(hotspotRect?.height || 34));
  const activationBottom = Math.max(hotspotRect?.bottom || 0, hotspotHeight);
  return point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= activationBottom;
}

function isPointInPageRailEdgeActivationZone(point) {
  if (!point || !els.lightboxSideHotspot || !els.lightboxPageRail) return false;
  const { width, height } = getViewportSize();
  const hotspotRect = els.lightboxSideHotspot.getBoundingClientRect();
  const hotspotWidth = Math.max(2, Math.round(hotspotRect?.width || 34));
  const activationLeft = Math.max(0, Math.min(hotspotRect?.left ?? width, width - hotspotWidth));
  // Coordinate-based hover activation is allowed up to the physical viewport
  // edge, because a fast mouse move can land beyond the visible hotspot strip
  // and would otherwise miss it.
  const activationRight = width;
  return point.x >= activationLeft && point.x <= activationRight && point.y >= 0 && point.y <= height;
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
  return els.fullscreenToggle ? [els.fullscreenToggle] : [];
}

function syncFullscreenButtonUi() {
  const buttons = getFullscreenToggleButtons();
  if (!buttons.length) return;

  const isActive = isBrowserFullscreenActive();
  const isSupported = isBrowserFullscreenSupported();
  const label = isActive ? "יציאה ממסך מלא" : "כניסה למסך מלא";

  buttons.forEach((button) => {
    button.dataset.fullscreenActive = isActive ? "true" : "false";
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.setAttribute("aria-label", label);
    setTooltipText(button, label, { updateDefault: true });
    button.disabled = !isSupported && !isActive;
    button.classList.toggle("hidden", !isSupported && !isActive);
  });
}

async function toggleBrowserFullscreen(sourceButton = null) {
  const button = sourceButton || els.fullscreenToggle;
  const wasActive = isBrowserFullscreenActive();

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
    syncFullscreenButtonUi();
    if (state.lightboxOpen) showTopUiTemporarily(1400);
  }
}

function returnToMainSiteFromLightbox(event = null) {
  event?.preventDefault?.();
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();
  navigateTo(homeDocumentUrl());
}


function setViewerLoading(isLoading) {
  els.viewerLoading.classList.toggle("hidden", !isLoading);
}


function hideLightboxFloatingPreview() {
  els.lightboxFloatingPreview?.classList.remove("visible");
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
  const preview = els.lightboxFloatingPreview;
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
  if (!button || !els.lightboxFloatingPreview || !els.lightboxFloatingPreviewImage) return;

  const previewCatalog = findCatalogById(button.dataset.previewCatalog) || state.catalog;
  if (!previewCatalog) return;
  const page = clampPage(button.dataset.previewPage || button.dataset.page, previewCatalog);
  const src = button.dataset.previewSrc || pageSrc(previewCatalog, page);
  setCatalogImageSource(els.lightboxFloatingPreviewImage, src);
  els.lightboxFloatingPreviewImage.alt = `${previewCatalog.title} - עמוד ${page}`;
  if (els.lightboxFloatingPreviewPage) {
    els.lightboxFloatingPreviewPage.textContent = isFavoritesLightboxMode()
      ? `${previewCatalog.title} · עמוד ${page}`
      : `עמוד ${page}`;
  }
  els.lightboxFloatingPreview.classList.toggle("from-page-rail", isLightboxPageRailTrigger(button));
  els.lightboxFloatingPreview.classList.add("visible");
  positionLightboxFloatingPreview(button);
}

function updateLightboxThumbs(options = {}) {
  const { scrollIntoView = true } = options;
  const rail = els.lightboxPageThumbs;
  if (!rail) return;

  const previous = rail.querySelector('.lightbox-page-thumb[aria-current="page"]');
  const selector = isFavoritesLightboxMode()
    ? `.lightbox-page-thumb[data-favorite-index="${state.favoritesViewerIndex}"]`
    : `.lightbox-page-thumb[data-page="${state.page}"]`;
  const active = rail.querySelector(selector);

  if (previous && previous !== active) {
    previous.classList.remove("active");
    previous.removeAttribute("aria-current");
  }
  if (!active) return;

  active.classList.add("active");
  active.setAttribute("aria-current", "page");
  if (scrollIntoView && els.lightbox?.classList.contains("show-page-rail")) {
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
    setLightboxPage(targetPage, {
      thumbScrollIntoView: false,
      scrollBehavior: "auto",
      animateScrollPage: true
    });
  }

  showPageRailTemporarily(1800, { scrollIntoView: false });
}

function renderLightboxPageRail() {
  if (!state.catalog || !els.lightboxPageThumbs) return;
  const thumbs = [];

  if (isFavoritesLightboxMode()) {
    const entries = getFavoriteEntries();
    if (els.lightboxPageRailTitle) els.lightboxPageRailTitle.textContent = "מועדפים";
    els.lightboxPageRail?.setAttribute("aria-label", "מעבר מהיר בין המועדפים");

    entries.forEach(({ catalog, page }, index) => {
      const thumb = escapeHtml(thumbSrc(catalog, page));
      const title = escapeHtml(catalog.title || "קטלוג");
      const active = index === state.favoritesViewerIndex;
      thumbs.push(`
        <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${active ? " active" : ""}" type="button" data-favorite-index="${index}" data-preview-catalog="${escapeHtml(catalog.id)}" data-preview-page="${page}" data-preview-src="${thumb}" aria-label="מעבר למועדף ${index + 1}: ${title}, עמוד ${page}"${active ? ' aria-current="page"' : ""}>
          <span class="lightbox-page-thumb-image-wrap">
            <img src="${thumb}" alt="" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumb)} />
          </span>
          <span class="lightbox-page-thumb-number">${index + 1}</span>
        </button>
      `);
    });
  } else {
    const catalog = state.catalog;
    if (els.lightboxPageRailTitle) els.lightboxPageRailTitle.textContent = "עמודים";
    els.lightboxPageRail?.setAttribute("aria-label", "מעבר מהיר בין עמודי הקטלוג");

    for (let page = 1; page <= catalog.pages; page += 1) {
      const thumb = escapeHtml(thumbSrc(catalog, page));
      thumbs.push(`
        <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${page === state.page ? " active" : ""}" type="button" data-page="${page}" data-preview-catalog="${escapeHtml(catalog.id)}" data-preview-page="${page}" data-preview-src="${thumb}" aria-label="מעבר לעמוד ${page}"${page === state.page ? ' aria-current="page"' : ""}>
          <span class="lightbox-page-thumb-image-wrap">
            <img src="${thumb}" alt="" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumb)} />
          </span>
          <span class="lightbox-page-thumb-number">${page}</span>
        </button>
      `);
    }
  }

  els.lightboxPageThumbs.innerHTML = thumbs.join("");
  els.lightboxPageThumbs.querySelectorAll(".lightbox-page-thumb").forEach((button) => {
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
  const fitMode = normalizeViewerFitMode(state.imageFitMode);
  state.imageFitMode = fitMode;

  els.lightbox?.classList.toggle("fit-height", fitMode === VIEWER_FIT_HEIGHT);
  els.lightbox?.classList.toggle("fit-width", fitMode === VIEWER_FIT_WIDTH);

  if (els.fitHeightBtn) {
    const isActive = fitMode === VIEWER_FIT_HEIGHT;
    els.fitHeightBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    els.fitHeightBtn.setAttribute("aria-label", "התאמת התמונה לגובה");
    setTooltipText(els.fitHeightBtn, "התאמה לגובה", { updateDefault: true });
  }

  if (els.fitWidthBtn) {
    const isActive = fitMode === VIEWER_FIT_WIDTH;
    els.fitWidthBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    els.fitWidthBtn.setAttribute("aria-label", "התאמת התמונה לרוחב");
    setTooltipText(els.fitWidthBtn, "התאמה לרוחב", { updateDefault: true });
  }

  syncViewerAutoZoomButtonUi();
  syncViewerMobileMoreMenuState();
}


function syncViewerAutoZoomButtonUi() {
  if (!els.viewerAutoZoomBtn) return;

  const showButton = Boolean(state.lightboxOpen && !isAutoViewerZoom());

  els.viewerAutoZoomBtn.classList.toggle("hidden", !showButton);
  els.viewerAutoZoomBtn.setAttribute("aria-hidden", showButton ? "false" : "true");
  els.viewerAutoZoomBtn.setAttribute("aria-label", "חזרה לזום אוטומטי");

  // Keep the button itself icon-only and stationary; the clear explanation lives
  // in the shared floating tooltip so hover/focus never changes the button size.
  setTooltipText(els.viewerAutoZoomBtn, "חזרה לזום אוטומטי", { updateDefault: true });
}

function formatViewerZoomPercent(value = state.zoom) {
  return `${Math.round(getSafeViewerZoom(value) * 100)}%`;
}

function hideViewerZoomIndicator() {
  window.clearTimeout(state.zoomIndicatorHideTimer);
  state.zoomIndicatorHideTimer = 0;
  els.viewerZoomIndicator?.classList.remove("visible");
}

function showViewerZoomIndicator(value = state.zoom) {
  const indicator = els.viewerZoomIndicator;
  if (!indicator || !state.lightboxOpen) return;

  indicator.textContent = formatViewerZoomPercent(value);
  indicator.classList.add("visible");

  window.clearTimeout(state.zoomIndicatorHideTimer);
  state.zoomIndicatorHideTimer = window.setTimeout(() => {
    indicator.classList.remove("visible");
    state.zoomIndicatorHideTimer = 0;
  }, VIEWER_ZOOM_INDICATOR_HIDE_MS);
}

function setViewerFitMode(fitMode, options = {}) {
  const nextFitMode = normalizeViewerFitMode(fitMode);
  const { showUi = true } = options;
  const shouldResetView = nextFitMode !== state.imageFitMode;

  state.imageFitMode = nextFitMode;
  if (shouldResetView) {
    if (isViewerScrollIsolatedZoom()) {
      exitViewerScrollIsolatedZoom({ restorePage: false, nextZoom: AUTO_VIEWER_ZOOM });
    }
    state.zoom = AUTO_VIEWER_ZOOM;
    resetImagePosition({ queueSingleFitOrigin: true });
    state.pointers.clear();
  }

  syncViewerFitModeUi();
  if (isScrollViewerMode()) {
    refreshViewerScrollPageGeometry({ preservePage: true });
  } else {
    applyZoom();
  }
  if (showUi) showTopUiTemporarily(1600);
}

function syncLightboxModeUi() {
  const favoritesMode = isFavoritesLightboxMode();
  els.lightbox?.classList.add("catalog-entry-mode");
  els.lightbox?.classList.toggle("favorites-viewer-mode", favoritesMode);
  els.favoriteOpenCatalogButton?.classList.toggle("hidden", !favoritesMode);
  els.favoriteOpenCatalogButton?.setAttribute("aria-hidden", favoritesMode ? "false" : "true");
  els.prevPageBtn?.setAttribute("aria-label", favoritesMode ? "המועדף הקודם" : "העמוד הקודם");
  els.nextPageBtn?.setAttribute("aria-label", favoritesMode ? "המועדף הבא" : "העמוד הבא");
  syncViewerLayoutModeUi();
  syncViewerFitModeUi();
  syncFullscreenButtonUi();

  if (els.lightboxModeLabel) {
    els.lightboxModeLabel.textContent = favoritesMode ? "תצוגת מועדפים" : "כניסה לקטלוג";
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

function markTouchLikeViewportInput(event) {
  if (isTouchLikePointer(event) || event?.type === "touchstart") {
    state.lastTouchLikeViewportInputAt = Date.now();
  }
}

function hasRecentTouchLikeViewportInput(timeout = 900) {
  return Date.now() - state.lastTouchLikeViewportInputAt < timeout;
}

function markTouchLikeRailInput(event) {
  if (isTouchLikePointer(event)) {
    state.lastTouchLikeRailInputAt = Date.now();
  }
  markTouchLikeViewportInput(event);
}

function hasRecentTouchLikeRailInput(timeout = 900) {
  return Date.now() - state.lastTouchLikeRailInputAt < timeout;
}

function shouldUseLightboxHoverPointer(event = null) {
  if (!state.lightboxOpen || !hasHoverPointer()) return false;
  if (isTouchLikePointer(event) || hasRecentTouchLikeViewportInput()) return false;
  return true;
}

function shouldUsePageRailHover(event = null) {
  if (!shouldUseLightboxHoverPointer(event)) return false;
  if (hasRecentTouchLikeRailInput()) return false;
  return true;
}

function showPageRailTemporarily(delay = 2600, options = {}) {
  const { scrollIntoView = true } = options;
  if (!els.lightbox || !state.lightboxOpen) return;
  window.clearTimeout(state.pageRailHideTimer);
  els.lightbox.classList.add("show-page-rail");
  updateLightboxThumbs({ scrollIntoView });
  if (delay > 0) {
    state.pageRailHideTimer = window.setTimeout(() => {
      els.lightbox?.classList.remove("show-page-rail");
    }, delay);
  }
}

function keepPageRailOpen(options = {}) {
  const { scrollIntoView = true } = options;
  if (!state.lightboxOpen) return;
  window.clearTimeout(state.pageRailHideTimer);
  els.lightbox?.classList.add("show-page-rail");
  updateLightboxThumbs({ scrollIntoView });
}

function schedulePageRailClose(event = null) {
  if (!shouldUsePageRailHover(event)) return;
  if (shouldKeepPageRailOpenForPointer(event)) return;
  window.clearTimeout(state.pageRailHideTimer);
  state.pageRailHideTimer = window.setTimeout(() => {
    els.lightbox?.classList.remove("show-page-rail");
  }, 420);
}

function openPageRailFromTouch(event) {
  if (!isTouchLikePointer(event)) return;
  markTouchLikeRailInput(event);
  event.preventDefault?.();
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
  if (!els.lightbox || !state.lightboxOpen) return;
  if (!els.lightbox.classList.contains("show-page-rail")) return;

  const target = event.target;
  if (els.lightboxPageRail?.contains(target) || els.lightboxSideHotspot?.contains(target)) return;
  if (!isTouchLikePointer(event) && shouldUsePageRailHover(event)) return;

  window.clearTimeout(state.pageRailHideTimer);
  hideLightboxFloatingPreview();
  els.lightbox.classList.remove("show-page-rail");
}
















function hideViewerPageIndicator() {
  window.clearTimeout(state.pageIndicatorHideTimer);
  state.pageIndicatorHideTimer = 0;
  els.viewerPageIndicator?.classList.remove("visible");
}

function showViewerPageIndicatorTemporarily(delay = VIEWER_PAGE_INDICATOR_HIDE_MS) {
  if (!state.lightboxOpen || !els.viewerPageIndicator) return;

  window.clearTimeout(state.pageIndicatorHideTimer);
  els.viewerPageIndicator.classList.add("visible");
  if (delay <= 0) return;

  state.pageIndicatorHideTimer = window.setTimeout(() => {
    els.viewerPageIndicator?.classList.remove("visible");
    state.pageIndicatorHideTimer = 0;
  }, delay);
}

function syncLightboxProgress(current, total, title, options = {}) {
  if (!els.lightboxProgress) return;
  const totalItems = Math.max(1, Number.parseInt(total, 10) || 1);
  const currentItem = clampValue(Number.parseInt(current, 10) || 1, 1, totalItems);
  const ratio = totalItems <= 1 ? 1 : currentItem / totalItems;
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const label = String(options.label || "עמוד");
  const detail = String(options.detail || "").trim();
  const accessibleTitle = title || `${label} ${currentItem} מתוך ${totalItems}`;

  els.lightboxProgress.style.setProperty("--catalog-progress-ratio", String(clampedRatio));
  els.lightboxProgress.style.setProperty("--catalog-progress-percent", `${clampedRatio * 100}%`);
  els.lightboxProgress.setAttribute("aria-valuemin", "1");
  els.lightboxProgress.setAttribute("aria-valuemax", String(totalItems));
  els.lightboxProgress.setAttribute("aria-valuenow", String(currentItem));
  els.lightboxProgress.setAttribute("aria-valuetext", accessibleTitle);
  els.lightboxProgress.setAttribute("title", accessibleTitle);

  if (els.viewerPageIndicator) {
    els.viewerPageIndicatorLabel.textContent = label;
    els.viewerPageIndicatorCurrent.textContent = String(currentItem);
    els.viewerPageIndicatorTotal.textContent = String(totalItems);
    if (els.viewerPageIndicatorDetail) {
      els.viewerPageIndicatorDetail.textContent = detail;
      els.viewerPageIndicatorDetail.classList.toggle("hidden", !detail);
    }
    els.viewerPageIndicator.setAttribute("title", accessibleTitle);
    showViewerPageIndicatorTemporarily();
  }
}


function syncViewerLayoutModeUi() {
  const favoritesMode = isFavoritesLightboxMode();
  const requiredMode = favoritesMode ? VIEWER_LAYOUT_SIDE : VIEWER_LAYOUT_SCROLL;

  // Layout is a source-level product rule, not a user preference: ordinary
  // catalogs always use continuous scrolling, while favorites retain the
  // side-by-side viewer until that dedicated flow is redesigned.
  if (state.viewerLayoutMode !== requiredMode) {
    state.viewerLayoutMode = requiredMode;
  }

  const scrollMode = isScrollViewerMode();
  const isolatedZoom = scrollMode && isViewerScrollIsolatedZoom();
  els.lightbox?.classList.toggle("viewer-layout-side", !scrollMode);
  els.lightbox?.classList.toggle("viewer-layout-scroll", scrollMode);
  els.lightbox?.classList.toggle("viewer-scroll-zoom-isolated", isolatedZoom);
  els.lightboxImageFrame?.classList.toggle("hidden", scrollMode && !isolatedZoom);
  els.viewerScrollPages?.classList.toggle("hidden", !scrollMode);
}

function getViewerScrollPageLayout(page) {
  const container = els.viewerScrollPages;
  const size = pageSize(state.catalog, page) || { width: 1400, height: 1000 };
  const viewportWidth = container?.clientWidth
    || els.stageCanvas?.clientWidth
    || window.innerWidth
    || 320;
  const viewportHeight = container?.clientHeight
    || els.stageCanvas?.clientHeight
    || window.innerHeight
    || 480;
  const containerStyle = container ? window.getComputedStyle(container) : null;
  const horizontalInset = containerStyle
    ? Math.max(0, Number.parseFloat(containerStyle.paddingLeft) || 0)
    : 17;
  const verticalInset = containerStyle
    ? Math.max(0, Number.parseFloat(containerStyle.paddingTop) || 0)
    : 17;
  const availableWidth = Math.max(220, viewportWidth - horizontalInset * 2);
  const availableHeight = Math.max(220, viewportHeight - verticalInset * 2);
  const widthScale = availableWidth / size.width;
  const heightScale = availableHeight / size.height;
  const scale = state.imageFitMode === VIEWER_FIT_WIDTH ? widthScale : heightScale;

  return {
    width: Math.max(180, Math.round(size.width * scale)),
    height: Math.max(140, Math.round(size.height * scale))
  };
}

function getViewerScrollPageFrame(page) {
  return els.viewerScrollPages?.querySelector?.(`[data-scroll-page="${page}"]`) || null;
}

function getViewerScrollFrameFocal(page, clientX = null, clientY = null) {
  const frame = getViewerScrollPageFrame(page);
  const container = els.viewerScrollPages;
  if (!frame || !container) return null;

  const frameRect = frame.getBoundingClientRect?.();
  const containerRect = container.getBoundingClientRect?.();
  if (!frameRect?.width || !frameRect?.height || !containerRect?.width || !containerRect?.height) return null;

  const fallbackX = frameRect.left + frameRect.width / 2;
  const fallbackY = frameRect.top + frameRect.height / 2;
  const pointX = Number.isFinite(clientX)
    ? clampValue(clientX, frameRect.left, frameRect.right)
    : clampValue(containerRect.left + containerRect.width / 2, frameRect.left, frameRect.right);
  const pointY = Number.isFinite(clientY)
    ? clampValue(clientY, frameRect.top, frameRect.bottom)
    : clampValue(containerRect.top + containerRect.height / 2, frameRect.top, frameRect.bottom);

  return {
    clientX: Number.isFinite(pointX) ? pointX : fallbackX,
    clientY: Number.isFinite(pointY) ? pointY : fallbackY,
    ratioX: clampValue((pointX - frameRect.left) / frameRect.width, 0, 1),
    ratioY: clampValue((pointY - frameRect.top) / frameRect.height, 0, 1)
  };
}

function syncViewerScrollIsolatedZoomUi() {
  const isolatedZoom = isViewerScrollIsolatedZoom();
  els.lightbox?.classList.toggle("viewer-scroll-zoom-isolated", isolatedZoom);
  els.lightboxImageFrame?.classList.toggle("hidden", isScrollViewerMode() && !isolatedZoom);
}

function prepareViewerScrollIsolatedImage(page) {
  if (!state.catalog || !els.lightboxImage) return;
  const targetPage = clampPage(page, state.catalog);
  const src = pageSrc(state.catalog, targetPage);

  primeLightboxFrameForCatalogPage(state.catalog, targetPage);
  if (els.lightboxImage.getAttribute("src") !== src) {
    els.lightboxImage.removeAttribute("src");
    prepareImagePlaceholder(els.lightboxImage);
  }
  showSingleLightboxImage(state.catalog, targetPage, src);
}

function enterViewerScrollIsolatedZoom(nextZoom, focalClientX = null, focalClientY = null) {
  if (!isScrollViewerMode() || !state.catalog) return false;

  const page = clampPage(state.page, state.catalog);
  const focal = getViewerScrollFrameFocal(page, focalClientX, focalClientY);
  const naturalSize = pageSize(state.catalog, page);
  const stageRect = els.stageCanvas?.getBoundingClientRect?.();
  if (!naturalSize || !stageRect) return false;

  state.viewerScrollIsolatedZoom = true;
  state.viewerScrollIsolatedPage = page;
  state.singleImageFitOriginPending = false;
  state.panX = 0;
  state.panY = 0;
  syncViewerScrollIsolatedZoomUi();

  const layout = applyLightboxFrameGeometry(naturalSize.width, naturalSize.height);
  const zoom = clampViewerZoom(nextZoom);
  if (layout && focal) {
    const contentX = (focal.ratioX - 0.5) * layout.width;
    const contentY = (focal.ratioY - 0.5) * layout.height;
    const centerX = stageRect.left + stageRect.width / 2;
    const centerY = stageRect.top + stageRect.height / 2;
    state.panX = focal.clientX - centerX - contentX * zoom;
    state.panY = focal.clientY - centerY - contentY * zoom;
  }

  state.zoom = zoom;
  applySingleZoom();
  prepareViewerScrollIsolatedImage(page);
  return true;
}

function exitViewerScrollIsolatedZoom(options = {}) {
  if (!state.viewerScrollIsolatedZoom) return false;
  const { restorePage = true, nextZoom = AUTO_VIEWER_ZOOM } = options;

  state.viewerScrollIsolatedZoom = false;
  state.viewerScrollIsolatedPage = 0;
  state.singleImageLoadToken += 1;
  state.zoom = clampViewerZoom(nextZoom);
  resetImagePosition();
  state.pointers.clear();
  syncViewerScrollIsolatedZoomUi();
  els.lightboxImageFrame?.classList.remove("page-swap-enter", "is-preparing-swap");
  setViewerLoading(false);
  els.lightbox?.classList.remove("is-page-loading");
  applyViewerScrollZoom(null, { immediate: true });
  els.lightbox?.classList.toggle("is-zoomed", !isAutoViewerZoom());
  syncViewerAutoZoomButtonUi();

  if (restorePage) {
    requestAnimationFrame(() => scrollViewerToPage(state.page, { behavior: "auto" }));
  }
  return true;
}

function resumeViewerScrollFromIsolatedZoom(deltaX = 0, deltaY = 0) {
  if (!isViewerScrollIsolatedZoom()) return false;
  exitViewerScrollIsolatedZoom({ restorePage: true, nextZoom: AUTO_VIEWER_ZOOM });
  requestAnimationFrame(() => {
    const container = els.viewerScrollPages;
    if (!container) return;
    container.scrollBy({
      left: Number.isFinite(deltaX) ? deltaX : 0,
      top: Number.isFinite(deltaY) ? deltaY : 0,
      behavior: "auto"
    });
  });
  return true;
}

function panViewerScrollIsolatedZoomByWheel(deltaX = 0, deltaY = 0) {
  if (!isViewerScrollIsolatedZoom()) return false;

  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return false;

  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const previousPanX = state.panX;
  const previousPanY = state.panY;

  // A normal wheel/trackpad gesture first pans the enlarged standalone image.
  // Only the vertical remainder that cannot be consumed inside the image is
  // handed back to the continuous viewer, so reaching an edge feels like one
  // uninterrupted scroll instead of an immediate zoom dismissal.
  state.panX = previousPanX - safeDeltaX;
  state.panY = previousPanY - safeDeltaY;
  clampSinglePan();

  const moved = Math.abs(state.panX - previousPanX) > 0.01 || Math.abs(state.panY - previousPanY) > 0.01;
  if (moved) {
    state.singleImageFitOriginPending = false;
    applySingleZoom();
  }

  const consumedDeltaY = previousPanY - state.panY;
  const remainingDeltaY = safeDeltaY - consumedDeltaY;
  const hasVerticalExitIntent = Math.abs(safeDeltaY) > Math.abs(safeDeltaX) * 0.5;
  if (hasVerticalExitIntent && Math.abs(remainingDeltaY) > 0.75) {
    resumeViewerScrollFromIsolatedZoom(0, remainingDeltaY);
  }

  return true;
}

function runViewerScrollPageSwapAnimation(page) {
  const frame = getViewerScrollPageFrame(page);
  if (!frame) return;

  // The target page has already been positioned with an immediate jump. Reuse
  // the single-page viewer's entrance mechanism so arrows, rail selection and
  // touch swipes all produce one identical non-scrolling transition.
  runViewerPageSwapAnimation(frame, {
    timerKey: "viewerScrollPageAnimationTimer",
    root: els.viewerScrollPages
  });
}

function getViewerScrollZoomAnchor(clientX = null, clientY = null) {
  const container = els.viewerScrollPages;
  if (!container || !isScrollViewerMode()) return null;

  const containerRect = container.getBoundingClientRect?.();
  if (!containerRect?.width || !containerRect?.height) return null;

  const viewportX = Number.isFinite(clientX)
    ? clampValue(clientX - containerRect.left, 0, containerRect.width)
    : containerRect.width / 2;
  const viewportY = Number.isFinite(clientY)
    ? clampValue(clientY - containerRect.top, 0, containerRect.height)
    : containerRect.height / 2;
  const pointX = containerRect.left + viewportX;
  const pointY = containerRect.top + viewportY;

  let frame = document.elementFromPoint?.(pointX, pointY)?.closest?.("[data-scroll-page]") || null;
  if (!frame || !container.contains(frame)) {
    frame = getViewerScrollPageFrame(findViewerScrollCenterPage());
  }
  if (!frame) return null;

  const frameRect = frame.getBoundingClientRect?.();
  if (!frameRect?.width || !frameRect?.height) return null;

  return {
    page: Number.parseInt(frame.dataset.scrollPage, 10) || state.page,
    ratioX: clampValue((pointX - frameRect.left) / frameRect.width, 0, 1),
    ratioY: clampValue((pointY - frameRect.top) / frameRect.height, 0, 1),
    viewportX,
    viewportY
  };
}

function restoreViewerScrollZoomAnchor(anchor) {
  const container = els.viewerScrollPages;
  if (!container || !anchor) return false;
  const frame = getViewerScrollPageFrame(anchor.page);
  if (!frame) return false;

  const targetLeft = frame.offsetLeft + frame.offsetWidth * anchor.ratioX - anchor.viewportX;
  const targetTop = frame.offsetTop + frame.offsetHeight * anchor.ratioY - anchor.viewportY;
  const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);

  container.scrollLeft = clampValue(targetLeft, 0, maxLeft);
  container.scrollTop = clampValue(targetTop, 0, maxTop);
  return true;
}

function flushViewerScrollZoom() {
  const container = els.viewerScrollPages;
  state.viewerScrollZoomRaf = 0;
  if (!container || !isScrollViewerMode() || isViewerScrollIsolatedZoom()) {
    state.viewerScrollZoomAnchor = null;
    return;
  }

  const zoom = Math.min(AUTO_VIEWER_ZOOM, getSafeViewerZoom());
  container.querySelectorAll("[data-scroll-page]").forEach((frame) => {
    const baseWidth = Number(frame.dataset.scrollBaseWidth);
    const baseHeight = Number(frame.dataset.scrollBaseHeight);
    if (!Number.isFinite(baseWidth) || !Number.isFinite(baseHeight)) return;
    frame.style.setProperty("--viewer-scroll-page-width", `${Math.max(1, Math.round(baseWidth * zoom))}px`);
    frame.style.setProperty("--viewer-scroll-page-height", `${Math.max(1, Math.round(baseHeight * zoom))}px`);
  });

  const anchor = state.viewerScrollZoomAnchor;
  state.viewerScrollZoomAnchor = null;
  if (anchor) restoreViewerScrollZoomAnchor(anchor);
}

function applyViewerScrollZoom(anchor = null, options = {}) {
  if (anchor) state.viewerScrollZoomAnchor = anchor;
  if (options.immediate) {
    if (state.viewerScrollZoomRaf) cancelAnimationFrame(state.viewerScrollZoomRaf);
    flushViewerScrollZoom();
    return;
  }

  if (!state.viewerScrollZoomRaf) {
    state.viewerScrollZoomRaf = requestAnimationFrame(flushViewerScrollZoom);
  }
}

function refreshViewerScrollPageGeometry(options = {}) {
  if (!isScrollViewerMode() || !els.viewerScrollPages || !state.catalog) return;
  const { preservePage = false, zoomAnchor = null } = options;
  const currentPage = state.page;

  els.viewerScrollPages.querySelectorAll("[data-scroll-page]").forEach((frame) => {
    const page = Number.parseInt(frame.dataset.scrollPage, 10);
    if (!Number.isFinite(page)) return;
    const layout = getViewerScrollPageLayout(page);
    frame.dataset.scrollBaseWidth = String(layout.width);
    frame.dataset.scrollBaseHeight = String(layout.height);
  });

  applyViewerScrollZoom(zoomAnchor, { immediate: true });

  if (preservePage && !zoomAnchor) {
    // Reading the target offsets after the CSS variables changed forces the
    // new geometry to be resolved now. Recenter in the same task so an
    // over-wide fit-height page can never be painted against an edge first.
    scrollViewerToPage(currentPage, { behavior: "auto" });
  }
}

function renderViewerScrollPages() {
  const container = els.viewerScrollPages;
  const catalog = state.catalog;
  if (!container || !catalog || isFavoritesLightboxMode()) return;

  const alreadyRendered = state.viewerScrollCatalogId === catalog.id
    && container.children.length === catalog.pages;
  if (!alreadyRendered) {
    state.viewerScrollLoadToken += 1;
    state.viewerScrollCatalogId = catalog.id;
    const title = escapeHtml(catalog.title || "קטלוג");
    const zoom = Math.min(AUTO_VIEWER_ZOOM, getSafeViewerZoom());
    container.innerHTML = Array.from({ length: catalog.pages }, (_unused, index) => {
      const page = index + 1;
      const size = pageSize(catalog, page) || { width: 1400, height: 1000 };
      const layout = getViewerScrollPageLayout(page);
      const width = Math.max(1, Math.round(layout.width * zoom));
      const height = Math.max(1, Math.round(layout.height * zoom));
      return `
        <div class="viewer-scroll-page viewer-scroll-page-frame image-placeholder-frame image-loading" data-scroll-page="${page}" data-scroll-base-width="${layout.width}" data-scroll-base-height="${layout.height}" role="listitem" aria-label="${title}, עמוד ${page}" style="--viewer-scroll-page-width:${width}px;--viewer-scroll-page-height:${height}px;aspect-ratio:${size.width} / ${size.height}">
          <img data-viewer-scroll-image="${page}" alt="${title} - עמוד ${page}" draggable="false" decoding="async" />
          <span class="viewer-scroll-page-number" aria-hidden="true">${page}</span>
        </div>
      `;
    }).join("");
  }

  refreshViewerScrollPageGeometry();
  loadViewerScrollWindow(state.page);
}

function setViewerScrollImageFeedback(frame, page, mode = "") {
  if (!frame) return;
  let feedback = frame.querySelector?.("[data-scroll-image-feedback]");
  if (!mode) {
    feedback?.remove?.();
    frame.classList.remove("image-fallback", "image-terminal-error");
    return;
  }

  if (!feedback) {
    feedback = document.createElement("div");
    feedback.className = "viewer-scroll-image-feedback";
    feedback.dataset.scrollImageFeedback = "true";
    feedback.innerHTML = `
      <span data-scroll-image-feedback-text></span>
      <button type="button" data-retry-scroll-page="${page}">נסה שוב</button>
    `;
    frame.appendChild(feedback);
  }
  const text = feedback.querySelector("[data-scroll-image-feedback-text]");
  if (text) {
    text.textContent = mode === "fallback"
      ? "מוצגת תצוגה מוקטנת."
      : "התמונה לא נטענה.";
  }
  frame.classList.toggle("image-fallback", mode === "fallback");
  frame.classList.toggle("image-terminal-error", mode === "error");
}

function loadViewerScrollPage(page, priority = "low") {
  const options = arguments[2] || {};
  if (!isScrollViewerMode() || !state.catalog) return;
  const frame = getViewerScrollPageFrame(page);
  const image = frame?.querySelector?.("[data-viewer-scroll-image]");
  if (!image) return;

  const catalog = state.catalog;
  const src = normalizeCatalogImageUrl(pageSrc(catalog, page));
  if (!options.forceRefresh && image.dataset.loadedSrc === src && image.dataset.loadedQuality !== "fallback") return;
  if (!options.forceRefresh && image.dataset.loadingSrc === src) return;
  image.dataset.loadingSrc = src;
  image.dataset.logicalSrc = src;
  image.loading = priority === "high" ? "eager" : "lazy";
  image.fetchPriority = priority;
  setViewerScrollImageFeedback(frame, page);
  prepareImagePlaceholder(image);

  const token = state.viewerScrollLoadToken;
  loadCatalogImageWithRecovery(image, {
    primarySrc: src,
    fallbackSrc: thumbSrc(catalog, page),
    forceRefresh: Boolean(options.forceRefresh),
    isCurrent: () => (
      token === state.viewerScrollLoadToken
      && isScrollViewerMode()
      && state.catalog === catalog
      && normalizeCatalogImageUrl(pageSrc(catalog, page)) === src
    ),
    onFailure: (candidate) => {
      telemetryTrackImageFailure(candidate.src, {
        img: image,
        detail: `viewer-scroll-${candidate.role}`
      });
    },
    onSuccess: (candidate) => {
      delete image.dataset.loadingSrc;
      image.dataset.loadedSrc = src;
      image.dataset.loadedQuality = candidate.fallback ? "fallback" : "full";
      syncImagePlaceholderState(image);
      setViewerScrollImageFeedback(frame, page, candidate.fallback ? "fallback" : "");
    },
    onExhausted: () => {
      delete image.dataset.loadingSrc;
      delete image.dataset.loadedSrc;
      delete image.dataset.loadedQuality;
      syncImagePlaceholderState(image);
      setViewerScrollImageFeedback(frame, page, "error");
    }
  });
}

function handleViewerScrollImageRetry(event) {
  const button = event.target?.closest?.("[data-retry-scroll-page]");
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  const page = Number.parseInt(button.dataset.retryScrollPage || "", 10);
  if (Number.isFinite(page)) loadViewerScrollPage(page, "high", { forceRefresh: true });
}

function retryCurrentViewerImage() {
  if (!state.lightboxOpen || !state.catalog) return;
  showSingleLightboxImage(state.catalog, state.page, pageSrc(state.catalog, state.page), { forceRefresh: true });
}

function loadViewerScrollWindow(centerPage) {
  if (!state.catalog || !isScrollViewerMode()) return;
  const center = clampPage(centerPage, state.catalog);
  for (let page = Math.max(1, center - 2); page <= Math.min(state.catalog.pages, center + 2); page += 1) {
    loadViewerScrollPage(page, page === center ? "high" : "low");
  }
}

function clearViewerScrollTarget() {
  window.clearTimeout(state.viewerScrollSettleTimer);
  state.viewerScrollSettleTimer = 0;
  state.viewerScrollTargetPage = 0;
}

function resetViewerScrollCommandSequence() {
  state.viewerScrollLastCommandAt = 0;
}

function clearViewerScrollWheelGesture() {
  window.clearTimeout(state.viewerScrollWheelSettleTimer);
  state.viewerScrollWheelSettleTimer = 0;
  state.viewerScrollWheelAccumulator = 0;
  state.viewerScrollWheelBasePage = 0;
  state.viewerScrollWheelTargetPage = 0;
}

function getViewerScrollPagePosition(page) {
  const container = els.viewerScrollPages;
  const frame = getViewerScrollPageFrame(page);
  if (!container || !frame) return null;

  return {
    top: Math.max(0, frame.offsetTop - Math.max(0, (container.clientHeight - frame.offsetHeight) / 2)),
    // Center pages on the horizontal viewport even when fit-height makes them
    // wider than the container. Clamping the size difference before subtracting
    // it leaves over-wide pages at scrollLeft 0 and exposes only one side.
    left: Math.max(0, frame.offsetLeft + (frame.offsetWidth - container.clientWidth) / 2)
  };
}

function settleViewerScrollWheelGesture() {
  const targetPage = state.viewerScrollWheelTargetPage || state.page;
  clearViewerScrollWheelGesture();
  if (!isScrollViewerMode() || !state.catalog) return;
  loadViewerScrollWindow(targetPage);
  // Wheel and precision-touchpad gestures are page commands. Settlement must
  // preserve the exact page position rather than introduce a native smooth
  // scroll after the final input event.
  scrollViewerToPage(targetPage);
}

function normalizeViewerScrollWheelDelta(event) {
  const rawDelta = Number(event?.deltaY) || 0;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;

  // One page-mode unit already represents one deliberate page command. Line
  // and pixel modes are normalized through the shared pixel converter so a
  // three-line mouse detent (~108 px) and a 100 px precision-wheel stream carry
  // the same intent instead of following browser-specific native distances.
  if (event?.deltaMode === pageMode) return rawDelta * VIEWER_SCROLL_WHEEL_PAGE_DELTA_PX;
  return normalizeWheelDeltaToPixels(rawDelta, event?.deltaMode, els.viewerScrollPages?.clientHeight || 0);
}

function getViewerScrollWheelRequestedSteps(accumulator) {
  const signedAccumulator = Number(accumulator) || 0;
  const magnitude = Math.abs(signedAccumulator);
  if (magnitude < VIEWER_SCROLL_WHEEL_FIRST_PAGE_DELTA_PX) return 0;

  // The first committed page deliberately has a lower activation threshold so
  // a precision touchpad does not need to land inside a narrow 100–199 px band.
  // After activation, every additional page keeps the original 100 px cadence:
  // 20–199 => one page, 200–299 => two pages, 300–399 => three pages, and so on.
  const wholePageSteps = Math.trunc(magnitude / VIEWER_SCROLL_WHEEL_PAGE_DELTA_PX);
  return Math.sign(signedAccumulator) * Math.max(1, wholePageSteps);
}

function handleViewerScrollWheel(event) {
  const container = els.viewerScrollPages;
  if (!state.lightboxOpen || !isScrollViewerMode() || isViewerScrollIsolatedZoom() || !state.catalog || !container) {
    return false;
  }

  const deltaY = normalizeViewerScrollWheelDelta(event);
  const deltaX = normalizeWheelDeltaToPixels(
    Number(event?.deltaX) || 0,
    event?.deltaMode,
    container.clientWidth
  );
  if (!Number.isFinite(deltaY) || Math.abs(deltaY) < 0.01) return false;

  // Preserve deliberate horizontal panning for fit-height pages that overflow
  // sideways. Every vertically dominant wheel stream—mouse or touchpad—uses
  // the exact same page-intent accumulator below.
  if (Math.abs(deltaX) > Math.abs(deltaY)) return false;

  event.preventDefault();

  const gestureStarted = !state.viewerScrollWheelBasePage;
  if (gestureStarted) {
    const intendedPage = state.viewerScrollTargetPage || findViewerScrollCenterPage() || state.page;
    clearViewerScrollTarget();
    state.viewerScrollWheelBasePage = clampPage(intendedPage, state.catalog);
    state.viewerScrollWheelTargetPage = state.viewerScrollWheelBasePage;
    state.viewerScrollWheelAccumulator = 0;
  }

  state.viewerScrollWheelAccumulator += deltaY;
  const requestedSteps = getViewerScrollWheelRequestedSteps(
    state.viewerScrollWheelAccumulator
  );
  const targetPage = clampPage(state.viewerScrollWheelBasePage + requestedSteps, state.catalog);
  const previousTargetPage = state.viewerScrollWheelTargetPage;
  state.viewerScrollWheelTargetPage = targetPage;

  // Pixel-mode touchpads report one gesture as many small wheel events, while a
  // mouse detent often reaches the page threshold in a single event. Those
  // sub-threshold values are input intent only: applying them to scrollTop made
  // touchpads visibly drag the current image before the same page swap that a
  // mouse performs immediately. Keep the viewport locked to an exact page and
  // move it only when the shared accumulator commits one or more whole steps.
  if (gestureStarted || targetPage !== previousTargetPage) {
    loadViewerScrollWindow(targetPage);
    const position = getViewerScrollPagePosition(targetPage);
    if (position) {
      container.scrollTop = position.top;
      container.scrollLeft = position.left;
    }
  }
  syncViewerScrollActivePage(targetPage);
  if (targetPage !== previousTargetPage) runViewerScrollPageSwapAnimation(targetPage);

  window.clearTimeout(state.viewerScrollWheelSettleTimer);
  state.viewerScrollWheelSettleTimer = window.setTimeout(
    settleViewerScrollWheelGesture,
    VIEWER_SCROLL_WHEEL_SETTLE_MS
  );
  return true;
}

function shouldJumpViewerScrollCommand(options = {}) {
  const now = performance.now();
  const elapsed = state.viewerScrollLastCommandAt > 0
    ? now - state.viewerScrollLastCommandAt
    : Number.POSITIVE_INFINITY;
  const isRapidFollowUp = elapsed <= VIEWER_SCROLL_MULTI_COMMAND_WINDOW_MS;
  state.viewerScrollLastCommandAt = now;

  // A single page command keeps the polished smooth movement. Once another
  // command joins the same sequence, native smooth scrolling becomes a queue:
  // each destination is animated from an in-flight position and held keys feel
  // progressively slower. Jumping the accumulated destination cancels that
  // native animation immediately while preserving exact page alignment.
  return Boolean(options.repeated || isRapidFollowUp || state.viewerScrollTargetPage);
}

function scrollViewerToPage(page, options = {}) {
  const container = els.viewerScrollPages;
  if (!container) return false;
  const targetPage = state.catalog ? clampPage(page, state.catalog) : Number(page) || 1;
  const behavior = options.behavior === "smooth" ? "smooth" : "auto";
  const position = getViewerScrollPagePosition(targetPage);
  if (!position) return false;
  const { top, left } = position;

  clearViewerScrollWheelGesture();
  clearViewerScrollTarget();
  if (behavior === "smooth") {
    state.viewerScrollTargetPage = targetPage;
    state.viewerScrollSettleTimer = window.setTimeout(() => {
      state.viewerScrollSettleTimer = 0;
      state.viewerScrollTargetPage = 0;
      syncViewerScrollActivePage(findViewerScrollCenterPage());
    }, 760);
    container.scrollTo({ top, left, behavior: "smooth" });
  } else {
    // Direct assignment deliberately bypasses CSS/native smooth scrolling. A
    // far-away rail selection must not make the browser animate every page in
    // between or decode them while travelling to the destination.
    container.scrollTop = top;
    container.scrollLeft = left;
    syncViewerScrollActivePage(targetPage);
  }

  // The scroll-mode page change may itself run inside requestAnimationFrame.
  // Starting the animation in another frame lets the fully visible target page
  // paint once before it jumps back to the animation's start state. Apply the
  // class synchronously after positioning so the first paint already contains
  // the same fade/blur/scale start state as the single-page viewer.
  if (options.animate) runViewerScrollPageSwapAnimation(targetPage);
  return true;
}

function findViewerScrollCenterPage() {
  const container = els.viewerScrollPages;
  const frames = container?.children;
  if (!container || !frames?.length) return state.page;

  const target = container.scrollTop + container.clientHeight / 2;
  let low = 0;
  let high = frames.length - 1;
  let best = frames[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const frame = frames[mid];
    const center = frame.offsetTop + frame.offsetHeight / 2;
    const distance = Math.abs(center - target);
    if (distance < bestDistance) {
      best = frame;
      bestDistance = distance;
    }
    if (center < target) low = mid + 1;
    else high = mid - 1;
  }

  return Number.parseInt(best.dataset.scrollPage, 10) || state.page;
}

function syncViewerScrollActivePage(page) {
  if (!state.catalog || !isScrollViewerMode()) return;
  const nextPage = clampPage(page, state.catalog);
  loadViewerScrollWindow(nextPage);

  if (state.viewerScrollTargetPage) {
    if (nextPage !== state.viewerScrollTargetPage) return;
    clearViewerScrollTarget();
  }

  if (nextPage === state.page) return;

  state.page = nextPage;
  els.lightboxMeta.textContent = `עמוד ${state.page} מתוך ${state.catalog.pages}`;
  syncLightboxProgress(state.page, state.catalog.pages, `עמוד ${state.page} מתוך ${state.catalog.pages}`, {
    label: "עמוד"
  });
  els.prevPageBtn.disabled = state.page <= 1;
  els.nextPageBtn.disabled = state.page >= state.catalog.pages;
  syncViewerFavoriteButtonUi();
  syncViewerInquiryUi();
  updateLightboxThumbs({ scrollIntoView: false });
  updateHash();
}

function handleViewerScrollPagesScroll() {
  if (!isScrollViewerMode() || state.viewerScrollRaf) return;
  state.viewerScrollRaf = requestAnimationFrame(() => {
    state.viewerScrollRaf = 0;
    syncViewerScrollActivePage(findViewerScrollCenterPage());
  });
}

function scrollViewerByViewport(direction, options = {}) {
  if (!isScrollViewerMode() || !els.viewerScrollPages || !state.catalog) return false;

  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (!step) return true;

  // Keyboard page navigation is page-based, not distance-based. Using a
  // percentage of the viewport made repeated presses accumulate from an
  // in-flight scroll position and could stop halfway through a page. While a
  // smooth navigation is running, build the next press from its intended page
  // so every command has one stable, exact destination.
  const basePage = state.viewerScrollTargetPage || state.page;
  const targetPage = clampPage(basePage + step, state.catalog);
  if (targetPage === basePage) return true;
  const jumpImmediately = shouldJumpViewerScrollCommand(options);

  if (isViewerScrollIsolatedZoom()) {
    exitViewerScrollIsolatedZoom({ restorePage: false, nextZoom: AUTO_VIEWER_ZOOM });
  }

  loadViewerScrollWindow(targetPage);
  scrollViewerToPage(targetPage, {
    behavior: jumpImmediately ? "auto" : "smooth",
    animate: jumpImmediately
  });
  return true;
}

function updateLightbox(options = {}) {
  if (!state.catalog) return;
  const {
    thumbScrollIntoView = true,
    scrollToPage = false,
    scrollBehavior = "auto",
    animateScrollPage = false
  } = options;
  let favoriteEntries = null;

  if (isFavoritesLightboxMode()) {
    favoriteEntries = getFavoriteEntries();
    if (!favoriteEntries.length) {
      closeLightbox({ restoreFavorites: true });
      return;
    }

    const currentIndex = findFavoriteEntryIndex(favoriteEntries, state.catalog?.id, state.page);
    setFavoriteViewerEntry(favoriteEntries, currentIndex >= 0 ? currentIndex : state.favoritesViewerIndex);
  }

  const catalog = state.catalog;
  state.page = clampPage(state.page, catalog);
  syncLightboxModeUi();
  syncViewerInquiryUi();
  syncViewerMobileMoreMenuState();

  els.lightboxTitle.textContent = catalog.title;
  if (favoriteEntries) {
    const current = state.favoritesViewerIndex + 1;
    const total = favoriteEntries.length;
    els.lightboxMeta.textContent = `מועדף ${current} מתוך ${total} · עמוד ${state.page}`;
    syncLightboxProgress(current, total, `מועדף ${current} מתוך ${total} · עמוד ${state.page}`, {
      label: "מועדף",
      detail: `עמוד ${state.page}`
    });
    els.prevPageBtn.disabled = state.favoritesViewerIndex <= 0;
    els.nextPageBtn.disabled = state.favoritesViewerIndex >= total - 1;
  } else {
    els.lightboxMeta.textContent = `עמוד ${state.page} מתוך ${catalog.pages}`;
    syncLightboxProgress(state.page, catalog.pages, `עמוד ${state.page} מתוך ${catalog.pages}`, {
      label: "עמוד"
    });
    els.prevPageBtn.disabled = state.page <= 1;
    els.nextPageBtn.disabled = state.page >= catalog.pages;
  }

  syncViewerFavoriteButtonUi();
  if (!favoriteEntries) initLightboxSearchStatus();

  if (!favoriteEntries && isScrollViewerMode()) {
    state.singleImageLoadToken += 1;
    setViewerLoading(false);
    els.lightbox?.classList.remove("is-page-loading", "is-zoomed");
    renderViewerScrollPages();
    loadViewerScrollWindow(state.page);
    if (scrollToPage) {
      const positionActivePage = () => scrollViewerToPage(state.page, {
        behavior: scrollBehavior,
        animate: animateScrollPage
      });
      if (scrollBehavior === "smooth") requestAnimationFrame(positionActivePage);
      else positionActivePage();
    }
    updateLightboxThumbs({ scrollIntoView: thumbScrollIntoView });
    updateHash();
    return;
  }

  const src = pageSrc(catalog, state.page);
  const currentSrc = els.lightboxImage.getAttribute("src");
  if (currentSrc !== src) {
    showSingleLightboxImage(catalog, state.page, src);
  } else {
    setViewerLoading(false);
    els.lightbox?.classList.remove("is-page-loading");
    applyZoom();
  }

  updateLightboxThumbs({ scrollIntoView: thumbScrollIntoView });
  preloadNeighbors();
  updateHash();
}

function syncDocumentLock() {
  const modalFavoritesOpen = state.favoritesOpen && !isAppPage("favorites");
  const transferOpen = Boolean(state.favoritesTransferPending);
  document.body.classList.toggle("no-scroll", state.lightboxOpen || modalFavoritesOpen || transferOpen);
  document.documentElement.classList.toggle("viewer-open", state.lightboxOpen);
}

function openLightbox(page = 1, options = {}) {
  if (!state.catalog) return;
  const source = options.source === LIGHTBOX_SOURCE_FAVORITES
    ? LIGHTBOX_SOURCE_FAVORITES
    : LIGHTBOX_SOURCE_CATALOG;

  if (!isAppPage("viewer")) {
    navigateTo(viewerDocumentUrl(state.catalog.id, page, { source }));
    return;
  }

  state.lightboxSource = source;
  if (source === LIGHTBOX_SOURCE_FAVORITES) {
    state.favoritesViewerIndex = Math.max(0, Number.parseInt(options.favoriteIndex, 10) || 0);
  } else {
    state.favoritesViewerIndex = 0;
    state.favoritesViewerOpeningHash = "";
    state.favoritesViewerPreviousCatalog = null;
    state.favoritesViewerPreviousPage = 1;
    state.favoritesReturnFocus = null;
  }
  state.imageFitMode = VIEWER_FIT_HEIGHT;
  state.viewerLayoutMode = source === LIGHTBOX_SOURCE_FAVORITES
    ? VIEWER_LAYOUT_SIDE
    : VIEWER_LAYOUT_SCROLL;
  state.viewerScrollCatalogId = "";
  state.viewerScrollLoadToken += 1;
  state.viewerScrollIsolatedZoom = false;
  state.viewerScrollIsolatedPage = 0;
  state.page = clampPage(page, state.catalog);
  state.zoom = AUTO_VIEWER_ZOOM;
  resetImagePosition({ queueSingleFitOrigin: true });
  state.pointers.clear();
  hideViewerZoomIndicator();
  closeViewerInquiry({ restoreFocus: false });
  closeViewerMobileMoreMenu();
  state.lightboxOpen = true;
  telemetryTrackCatalogOpen(state.catalog, state.page, state.lightboxSource);
  primeLightboxFrameForCatalogPage(state.catalog, state.page);
  const initialSrc = pageSrc(state.catalog, state.page);
  if (els.lightboxImage?.getAttribute("src") !== initialSrc) {
    els.lightboxImage?.removeAttribute("src");
    prepareImagePlaceholder(els.lightboxImage);
    els.lightboxImageFrame?.classList.remove("page-swap-enter");
  }
  els.lightbox.classList.remove("hidden");
  els.lightbox.classList.remove("show-ui", "show-page-rail");
  syncTopUiPinnedUi();
  syncDocumentLock();
  renderLightboxPageRail();
  if (!isFavoritesLightboxMode()) renderLightboxCatalogMenu();
  resetLightboxSearch();
  syncLightboxModeUi();
  showTopUiTemporarily(1700);
  updateLightbox({
    scrollToPage: isScrollViewerMode(),
    scrollBehavior: "auto",
    animateScrollPage: false
  });
  scheduleCatalogScrollTopButtonUpdate();
  window.requestAnimationFrame(showViewerOnboardingIfNeeded);

}

function hideLightboxUi() {
  closeViewerOnboarding({ restoreFocus: false });
  closeViewerInquiry({ restoreFocus: false });
  closeViewerMobileMoreMenu();
  state.lightboxOpen = false;
  state.lightboxMobileSearchOpen = false;
  syncLightboxMobileSearchUi();
  state.singleImageLoadToken += 1;
  state.viewerScrollLoadToken += 1;
  state.viewerLayoutMode = VIEWER_LAYOUT_SCROLL;
  state.viewerScrollCatalogId = "";
  if (state.viewerScrollRaf) cancelAnimationFrame(state.viewerScrollRaf);
  state.viewerScrollRaf = 0;
  if (state.viewerScrollZoomRaf) cancelAnimationFrame(state.viewerScrollZoomRaf);
  state.viewerScrollZoomRaf = 0;
  state.viewerScrollZoomAnchor = null;
  state.viewerScrollIsolatedZoom = false;
  state.viewerScrollIsolatedPage = 0;
  window.clearTimeout(state.viewerScrollPageAnimationTimer);
  state.viewerScrollPageAnimationTimer = 0;
  clearViewerScrollWheelGesture();
  clearViewerScrollTarget();
  resetViewerScrollCommandSequence();
  window.clearTimeout(state.singleImageAnimationTimer);
  if (els.viewerScrollPages) els.viewerScrollPages.innerHTML = "";
  els.lightbox?.classList.add("hidden");
  els.lightbox?.classList.remove("show-ui", "show-page-rail", "catalog-entry-mode", "favorites-viewer-mode", "viewer-layout-scroll", "viewer-scroll-zoom-isolated", "is-page-loading", "is-zoomed");
  syncViewerAutoZoomButtonUi();
  hideViewerZoomIndicator();
  els.lightboxImageFrame?.classList.remove("page-swap-enter");
  setViewerLoading(false);
  hideLightboxFloatingPreview();
  window.clearTimeout(state.uiHideTimer);
  window.clearTimeout(state.pageRailHideTimer);
  hideViewerPageIndicator();
  scheduleCatalogScrollTopButtonUpdate();
  state.lightboxSource = LIGHTBOX_SOURCE_CATALOG;
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
      : catalogDocumentUrl(state.catalog?.id);
    navigateTo(destination || homeDocumentUrl(), { replace: true });
    return;
  }

  hideLightboxUi();
}

function setLightboxPage(page, options = {}) {
  if (!state.catalog) return;
  const nextPage = clampPage(page, state.catalog);

  // Boundary navigation must be a true no-op. Previously the clamped page was
  // rendered again, which retriggered the scroll-page jump animation even
  // though the viewer was already on page 1 or on the final page.
  if (nextPage === state.page) return;

  const {
    thumbScrollIntoView = true,
    keepZoom = true,
    resetZoom = false,
    resetPosition = isAutoViewerZoom()
  } = options;
  const shouldResetZoom = resetZoom || keepZoom === false;
  const shouldResetPosition = shouldResetZoom || resetPosition;

  hideLightboxFloatingPreview();
  if (isViewerScrollIsolatedZoom()) {
    exitViewerScrollIsolatedZoom({ restorePage: false, nextZoom: AUTO_VIEWER_ZOOM });
  } else if (shouldResetZoom) {
    state.zoom = AUTO_VIEWER_ZOOM;
  }

  // Auto zoom gets a clean page origin. Manual zoom keeps the same pan between
  // pages, so moving with arrows or selecting a page does not reopen the next
  // image unexpectedly higher/lower after the user already positioned it.
  if (shouldResetPosition) {
    resetImagePosition({ queueSingleFitOrigin: true });
  } else if (shouldPreserveSingleManualPosition({ keepZoom, resetZoom, resetPosition })) {
    state.singleImageFitOriginPending = false;
  }
  state.pointers.clear();
  state.page = nextPage;
  updateLightbox({
    thumbScrollIntoView,
    scrollToPage: isScrollViewerMode(),
    scrollBehavior: isScrollViewerMode() ? "auto" : (options.scrollBehavior || "smooth"),
    animateScrollPage: isScrollViewerMode() && options.animateScrollPage !== false
  });

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
    resetPosition = isAutoViewerZoom()
  } = options;
  const nextIndex = clampValue(Number.parseInt(index, 10) || 0, 0, entries.length - 1);
  const entry = entries[nextIndex];
  const itemChanged = nextIndex !== state.favoritesViewerIndex || state.catalog !== entry.catalog || state.page !== entry.page;
  const shouldResetZoom = resetZoom || keepZoom === false;
  const shouldResetPosition = shouldResetZoom || resetPosition;

  if (itemChanged) {
    hideLightboxFloatingPreview();
    if (shouldResetZoom) state.zoom = AUTO_VIEWER_ZOOM;
    if (shouldResetPosition) {
      resetImagePosition({ queueSingleFitOrigin: true });
    } else if (shouldPreserveSingleManualPosition({ keepZoom, resetZoom, resetPosition })) {
      state.singleImageFitOriginPending = false;
    }
    state.pointers.clear();
  }

  setFavoriteViewerEntry(entries, nextIndex);
  updateLightbox({ thumbScrollIntoView });
}

function moveLightbox(delta) {
  if (!state.catalog) return;
  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex(state.favoritesViewerIndex + delta);
    return;
  }
  setLightboxPage(state.page + delta);
}

function getSingleKeyboardPanStep() {
  const viewportHeight = els.stageCanvas?.clientHeight || window.innerHeight || 720;
  const viewportStep = Math.round(viewportHeight * SINGLE_KEYBOARD_PAN_VIEWPORT_RATIO);
  const baseStep = clampValue(viewportStep, SINGLE_KEYBOARD_PAN_MIN_STEP, SINGLE_KEYBOARD_PAN_MAX_STEP);
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics?.overflowY) return baseStep;

  const remainingVerticalRange = metrics.overflowY * 2;
  return Math.max(12, Math.min(baseStep, Math.ceil(remainingVerticalRange / 8)));
}

function panSingleImageBy(deltaX, deltaY) {
  if (!singleImageCanPan()) return false;

  state.panX += deltaX;
  state.panY += deltaY;
  clampSinglePan();
  state.singleImageFitOriginPending = false;
  applyZoom();
  return true;
}

function getDefaultZoomFocalPoint() {
  const surface = els.stageCanvas;
  const rect = surface?.getBoundingClientRect?.();
  if (!rect) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function adjustSinglePanForZoom(nextZoom, focal) {
  const stage = els.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !focal) return;

  const currentZoom = getSafeViewerZoom();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const contentX = (focal.x - centerX - state.panX) / currentZoom;
  const contentY = (focal.y - centerY - state.panY) / currentZoom;

  state.panX = focal.x - centerX - contentX * nextZoom;
  state.panY = focal.y - centerY - contentY * nextZoom;
}


function adjustPanForZoom(nextZoom, focal) {
  adjustSinglePanForZoom(nextZoom, focal);
}

function getSingleContentPointFromClientPoint(clientX, clientY) {
  const stage = els.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  const currentZoom = getSafeViewerZoom();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return {
    x: (clientX - centerX - state.panX) / currentZoom,
    y: (clientY - centerY - state.panY) / currentZoom
  };
}


function zoomSingleContentPointToViewportCenter(point, nextZoom) {
  if (!point) return false;
  const zoom = clampViewerZoom(nextZoom);
  if (isAutoViewerZoom(zoom)) {
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
    return true;
  }

  state.zoom = zoom;
  state.panX = -point.x * zoom;
  state.panY = -point.y * zoom;
  applyZoom();
  showViewerZoomIndicator(zoom);
  return true;
}


function zoomClientPointToViewportCenter(nextZoom, clientX, clientY) {
  if (isScrollViewerMode()) {
    setZoom(nextZoom, {
      showUi: false,
      focalClientX: clientX,
      focalClientY: clientY
    });
    return true;
  }

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
  const previousZoom = state.zoom;
  const zoom = clampViewerZoom(nextZoom);
  const hasFocal = Number.isFinite(focalClientX) && Number.isFinite(focalClientY);
  const focal = hasFocal
    ? { x: focalClientX, y: focalClientY }
    : getDefaultZoomFocalPoint();

  if (isScrollViewerMode()) {
    if (zoom > AUTO_VIEWER_ZOOM + 0.001) {
      if (!isViewerScrollIsolatedZoom()) {
        enterViewerScrollIsolatedZoom(zoom, focal?.x, focal?.y);
      } else {
        if (focal && Math.abs(zoom - previousZoom) > 0.001) {
          adjustPanForZoom(zoom, focal);
        }
        state.zoom = zoom;
        applyZoom();
      }
    } else {
      const scrollAnchor = isViewerScrollIsolatedZoom()
        ? null
        : getViewerScrollZoomAnchor(focal?.x, focal?.y);
      if (isViewerScrollIsolatedZoom()) {
        exitViewerScrollIsolatedZoom({ restorePage: true, nextZoom: zoom });
      } else {
        state.zoom = isAutoViewerZoom(zoom) ? AUTO_VIEWER_ZOOM : zoom;
        applyZoom({ scrollAnchor });
      }
    }
  } else {
    if (isAutoViewerZoom(zoom)) {
      state.zoom = AUTO_VIEWER_ZOOM;
      resetImagePosition({ queueSingleFitOrigin: true });
    } else {
      if (focal && Math.abs(zoom - previousZoom) > 0.001) {
        adjustPanForZoom(zoom, focal);
      }
      state.zoom = zoom;
    }
    applyZoom();
  }

  if (Math.abs(getSafeViewerZoom(state.zoom) - getSafeViewerZoom(previousZoom)) > 0.001) {
    showViewerZoomIndicator(state.zoom);
  }
  if (showUi) showTopUiTemporarily(1600);
}

function toggleZoomAtPoint(clientX, clientY) {
  if (state.zoom > 1.01) {
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
    return;
  }

  if (!zoomClientPointToViewportCenter(2, clientX, clientY)) {
    setZoom(2, { showUi: false, focalClientX: clientX, focalClientY: clientY });
  }
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

  state.catalog = catalog;
  state.page = 1;
  renderCatalogDetail();
  updateHash();

  if (scroll) scrollCatalogDetailIntoView({ behavior: scrollBehavior });
  if (openPage != null) openLightbox(openPage);
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

  state.catalog = catalog;
  state.page = clampPage(page, catalog);
  renderCatalogDetail();
  openLightbox(state.page, { source, favoriteIndex: options.favoriteIndex });
}

function openCurrentFavoriteInCatalog() {
  if (!state.lightboxOpen || !isFavoritesLightboxMode() || !state.catalog) return;

  const catalogId = state.catalog.id;
  const page = state.page;

  // Re-enter through the canonical catalog-viewer lifecycle instead of
  // partially mutating favorites state in place. The old shortcut skipped the
  // scroll viewer's initial positioning step: it loaded pages around the saved
  // favorite but left scrollTop at page 1, so the visible frame had no src and
  // the user saw only the viewer background.
  openCatalogInViewer(catalogId, page, { source: LIGHTBOX_SOURCE_CATALOG });
}

function attachViewerEvents() {
  els.lightboxHomeLink?.addEventListener("click", returnToMainSiteFromLightbox);
  els.favoriteOpenCatalogButton?.addEventListener("click", openCurrentFavoriteInCatalog);
  els.lightboxPinTopBar?.addEventListener("click", () => {
    toggleTopUiPinned();
    if (state.viewerOnboardingOpen) scheduleViewerOnboardingLayout(40);
  });
  els.lightboxBackdrop?.addEventListener("click", closeLightbox);
  els.lightbox?.addEventListener("pointerdown", handleLightboxPointerDownCapture, { capture: true });
  els.fullscreenToggle?.addEventListener("click", () => toggleBrowserFullscreen(els.fullscreenToggle));
  els.prevPageBtn?.addEventListener("click", () => moveLightbox(-1));
  els.nextPageBtn?.addEventListener("click", () => moveLightbox(1));
  els.fitHeightBtn?.addEventListener("click", () => setViewerFitMode(VIEWER_FIT_HEIGHT));
  els.fitWidthBtn?.addEventListener("click", () => setViewerFitMode(VIEWER_FIT_WIDTH));
  els.viewerAutoZoomBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
  });
  els.viewerAutoZoomBtn?.addEventListener("pointerdown", (event) => event.stopPropagation());
  els.viewerFavoriteButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleCurrentPageFavorite();
  });
  els.viewerFavoriteButton?.addEventListener("pointerdown", (event) => event.stopPropagation());
  els.stageCanvas?.addEventListener("pointerdown", handleViewerSurfacePointerDown);
  els.viewerImageRetry?.addEventListener("click", retryCurrentViewerImage);
  els.viewerScrollPages?.addEventListener("click", handleViewerScrollImageRetry);
  els.viewerScrollPages?.addEventListener("scroll", handleViewerScrollPagesScroll, { passive: true });

  attachViewerGestures();

  els.lightboxSideHotspot?.addEventListener("pointerdown", openPageRailFromTouch, { passive: false });
  els.lightboxSideHotspot?.addEventListener("mouseenter", showPageRailFromHover);
  els.lightboxSideHotspot?.addEventListener("mouseleave", schedulePageRailClose);
  els.lightboxSideHotspot?.addEventListener("click", openPageRailFromHotspot);
  els.lightboxPageRail?.addEventListener("pointerdown", markTouchLikeRailInput);
  els.lightboxPageRail?.addEventListener("mouseenter", keepPageRailOpenFromHover);
  els.lightboxPageRail?.addEventListener("mouseleave", (event) => {
    hideLightboxFloatingPreview();
    schedulePageRailClose(event);
  });
  els.lightbox?.addEventListener("pointerdown", handlePageRailPointerOutside);
  els.lightboxPageRail?.addEventListener("focusin", () => keepPageRailOpen({ scrollIntoView: false }));
  els.lightboxPageRail?.addEventListener("focusout", schedulePageRailClose);

  els.topHotspot?.addEventListener("mouseenter", () => showTopUiTemporarily(0));
  els.lightboxBar?.addEventListener("mouseenter", () => showTopUiTemporarily(0));
  els.lightboxBar?.addEventListener("mouseleave", scheduleTopUiClose);
  document.addEventListener("pointerdown", markTouchLikeViewportInput, { passive: true });
  document.addEventListener("touchstart", markTouchLikeViewportInput, { passive: true });
  document.addEventListener("mousemove", handleLightboxEdgeHoverMove, { passive: true });
  document.addEventListener("mouseout", handleLightboxEdgeHoverViewportExit, { passive: true });
  document.documentElement?.addEventListener("mouseleave", handleLightboxEdgeHoverViewportExit, { passive: true });

  els.lightboxImage?.addEventListener("load", () => {
    setViewerLoading(false);
    els.lightbox?.classList.remove("is-page-loading");
    applyZoom();
  });

  ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach((eventName) => {
    document.addEventListener(eventName, syncFullscreenButtonUi);
  });

  syncFullscreenButtonUi();
}
/* ===== END SOURCE: src/js/60-viewer.js ===== */

/* ===== BEGIN SOURCE: src/js/62-viewer-actions.js ===== */
/**
 * Source module: 62-viewer-actions.js
 * Viewer inquiry workflow and compact mobile utility menu.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

const MOBILE_VIEWER_TOOLBAR_MEDIA = "(max-width: 760px)";

function isMobileViewerToolbarMode() {
  return Boolean(window.matchMedia?.(MOBILE_VIEWER_TOOLBAR_MEDIA).matches);
}

function viewerInquiryFooterEmail() {
  return Array.from(document.querySelectorAll(".site-footer-contact-list a[href]"))
    .find((link) => String(link.getAttribute("href") || "").startsWith("mailto:")) || null;
}

function viewerInquiryEmailAddress() {
  const emailHref = String(viewerInquiryFooterEmail()?.getAttribute?.("href") || "").trim();
  return emailHref.replace(/^mailto:/i, "").split("?")[0].trim();
}

function viewerInquiryReference() {
  if (!state.catalog) return null;
  const page = clampPage(state.page, state.catalog);
  const url = absoluteDocumentUrl(viewerDocumentUrl(state.catalog.id, page));
  const title = String(state.catalog.title || "קטלוג").trim() || "קטלוג";
  const pageLabel = `עמוד ${page} מתוך ${Math.max(1, Number(state.catalog.pages) || 1)}`;
  const subject = `בירור על דגם – ${title}, עמוד ${page}`;
  const shareText = [
    "שלום,",
    "רציתי לברר לגבי הדגם הבא:",
    `קטלוג: ${title}`,
    `עמוד: ${page}`
  ].join("\n");
  const text = `${shareText}\nקישור ישיר: ${url}`;
  return { catalog: state.catalog, page, title, pageLabel, subject, shareText, text, url };
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

function syncViewerInquiryContactLink(link, href, reference, action) {
  if (!link) return;
  const available = Boolean(href);
  link.classList.toggle("hidden", !available);
  link.setAttribute("aria-hidden", available ? "false" : "true");
  if (!available) {
    link.removeAttribute("href");
    return;
  }
  link.href = href;
  link.dataset.contactSource = "viewer-inquiry";
  link.dataset.contactAction = action;
  link.dataset.contactCatalogId = reference.catalog.id;
  link.dataset.contactPage = String(reference.page);
}

function syncViewerInquiryUi() {
  const reference = viewerInquiryReference();
  if (!reference) return;

  if (els.viewerInquiryCatalog) els.viewerInquiryCatalog.textContent = reference.title;
  if (els.viewerInquiryPage) els.viewerInquiryPage.textContent = reference.pageLabel;
  if (els.viewerInquiryButton) {
    const label = `בירור על הדגם — ${reference.title}, עמוד ${reference.page}`;
    els.viewerInquiryButton.setAttribute("aria-label", label);
    setTooltipText(els.viewerInquiryButton, label, { updateDefault: true });
  }

  if (els.viewerInquiryPreview) {
    const preview = thumbSrc(reference.catalog, reference.page) || pageSrc(reference.catalog, reference.page);
    if (els.viewerInquiryPreview.getAttribute("src") !== preview) {
      els.viewerInquiryPreview.src = preview;
    }
    els.viewerInquiryPreview.alt = `${reference.title}, עמוד ${reference.page}`;
  }

  const emailAddress = viewerInquiryEmailAddress();
  const emailAvailable = Boolean(emailAddress);
  if (els.viewerInquiryEmailLabel) els.viewerInquiryEmailLabel.textContent = emailAddress;

  const mailtoQuery = new URLSearchParams({ subject: reference.subject, body: reference.text });
  syncViewerInquiryContactLink(
    els.viewerInquiryEmail,
    emailAvailable ? `mailto:${emailAddress}?${mailtoQuery.toString()}` : "",
    reference,
    "email"
  );
  syncViewerInquiryContactLink(
    els.viewerInquiryGmail,
    emailAvailable ? viewerInquiryGmailUrl(emailAddress, reference) : "",
    reference,
    "gmail"
  );

  if (els.viewerInquiryEmail) {
    els.viewerInquiryEmail.title = emailAvailable
      ? `פתיחה בתוכנת הדואר המוגדרת · ${emailAddress}`
      : "לא הוגדרה כתובת דואר";
  }
  if (els.viewerInquiryGmail) {
    els.viewerInquiryGmail.title = emailAvailable
      ? `פתיחת הודעה חדשה ב-Gmail אל ${emailAddress}`
      : "לא הוגדרה כתובת דואר";
  }
}

function getViewerInquiryFocusableElements() {
  if (!els.viewerInquiryOverlay) return [];
  return Array.from(els.viewerInquiryOverlay.querySelectorAll(
    'button:not([disabled]), a[href]:not(.hidden), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.closest?.(".hidden"));
}

function openViewerInquiry() {
  if (!state.lightboxOpen || !state.catalog || !els.viewerInquiryOverlay) return;
  if (state.viewerOnboardingOpen) closeViewerOnboarding({ restoreFocus: false });
  closeViewerMobileMoreMenu();
  if (state.lightboxMobileSearchOpen) {
    setLightboxMobileSearchOpen(false, { hideResults: true });
  }
  syncViewerInquiryUi();
  state.viewerInquiryOpen = true;
  state.viewerInquiryReturnFocus = document.activeElement || els.viewerInquiryButton;
  els.viewerInquiryOverlay.classList.remove("hidden");
  els.viewerInquiryOverlay.setAttribute("aria-hidden", "false");
  els.viewerInquiryButton?.setAttribute("aria-expanded", "true");
  window.requestAnimationFrame(() => {
    if (!state.viewerInquiryOpen) return;
    els.viewerInquiryOverlay?.classList.add("visible");
    (els.viewerInquiryClose || getViewerInquiryFocusableElements()[0])?.focus?.({ preventScroll: true });
  });
}

function closeViewerInquiry(options = {}) {
  if (!state.viewerInquiryOpen && els.viewerInquiryOverlay?.classList.contains("hidden")) return;
  const { restoreFocus = true } = options;
  const returnFocus = state.viewerInquiryReturnFocus;
  state.viewerInquiryOpen = false;
  state.viewerInquiryReturnFocus = null;
  els.viewerInquiryOverlay?.classList.remove("visible");
  els.viewerInquiryOverlay?.setAttribute("aria-hidden", "true");
  els.viewerInquiryButton?.setAttribute("aria-expanded", "false");
  window.setTimeout(() => {
    if (!state.viewerInquiryOpen) els.viewerInquiryOverlay?.classList.add("hidden");
  }, 180);
  if (restoreFocus) (returnFocus || els.viewerInquiryButton)?.focus?.({ preventScroll: true });
}

function handleViewerInquiryKeydown(event) {
  if (!state.viewerInquiryOpen) return false;
  if (event.key === "Escape") {
    event.preventDefault();
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
    telemetryTrack("contact", {
      action: "copy",
      source: "viewer-inquiry",
      catalogId: reference.catalog.id,
      pageNumber: reference.page
    }, { immediate: true });
    showActionToast("פרטי הדגם הועתקו", { tone: "link" });
    closeViewerInquiry();
  } catch (_error) {
    window.prompt("אפשר להעתיק את פרטי הדגם מכאן:", reference.text);
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
      telemetryTrack("contact", {
        action: "share",
        source: "viewer-inquiry",
        catalogId: reference.catalog.id,
        pageNumber: reference.page
      }, { immediate: true });
      closeViewerInquiry({ restoreFocus: false });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await copyTextToClipboard(reference.text);
    telemetryTrack("contact", {
      action: "share",
      detail: "copy-fallback",
      source: "viewer-inquiry",
      catalogId: reference.catalog.id,
      pageNumber: reference.page
    }, { immediate: true });
    showActionToast("אפשרויות שיתוף אינן זמינות — פרטי הדגם הועתקו", { tone: "link" });
    closeViewerInquiry();
  } catch (_error) {
    window.prompt("אפשר להעתיק ולשתף את פרטי הדגם מכאן:", reference.text);
  }
}

function syncViewerMobileMoreMenuState() {
  const menu = els.viewerMobileMoreMenu;
  if (!menu) return;
  const fitMode = normalizeViewerFitMode(state.imageFitMode);
  const pinItem = menu.querySelector('[data-viewer-mobile-action="pin"]');
  const heightItem = menu.querySelector('[data-viewer-mobile-action="fit-height"]');
  const widthItem = menu.querySelector('[data-viewer-mobile-action="fit-width"]');
  const pinLabel = menu.querySelector("[data-viewer-mobile-pin-label]");

  pinItem?.setAttribute("aria-checked", state.topUiPinned ? "true" : "false");
  pinItem?.classList.toggle("active", state.topUiPinned);
  if (pinLabel) pinLabel.textContent = state.topUiPinned ? "ביטול נעיצת הסרגל" : "נעיצת הסרגל";
  heightItem?.setAttribute("aria-checked", fitMode === VIEWER_FIT_HEIGHT ? "true" : "false");
  heightItem?.classList.toggle("active", fitMode === VIEWER_FIT_HEIGHT);
  widthItem?.setAttribute("aria-checked", fitMode === VIEWER_FIT_WIDTH ? "true" : "false");
  widthItem?.classList.toggle("active", fitMode === VIEWER_FIT_WIDTH);
  if (els.viewerMobileFavoritesLink) els.viewerMobileFavoritesLink.href = favoritesDocumentUrl();
}

function setViewerMobileMoreOpen(open, options = {}) {
  const shouldOpen = Boolean(open && state.lightboxOpen && isMobileViewerToolbarMode());
  state.viewerMobileMoreOpen = shouldOpen;
  syncViewerMobileMoreMenuState();
  els.viewerMobileMoreMenu?.classList.toggle("hidden", !shouldOpen);
  els.viewerMobileMoreMenu?.classList.toggle("visible", shouldOpen);
  els.viewerMobileMoreToggle?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
  els.viewerMobileMoreToggle?.classList.toggle("is-active", shouldOpen);
  els.lightbox?.classList.toggle("mobile-more-open", shouldOpen);

  if (shouldOpen) {
    showTopUiTemporarily(0);
    window.requestAnimationFrame(() => {
      els.viewerMobileMoreMenu?.querySelector('[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]')?.focus?.({ preventScroll: true });
    });
  } else if (options.returnFocus) {
    els.viewerMobileMoreToggle?.focus?.({ preventScroll: true });
  }
}

function closeViewerMobileMoreMenu(options = {}) {
  setViewerMobileMoreOpen(false, options);
}

function getViewerMobileMoreItems() {
  if (!els.viewerMobileMoreMenu) return [];
  return Array.from(els.viewerMobileMoreMenu.querySelectorAll(
    '[role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]'
  )).filter((item) => !item.classList.contains("hidden") && item.getAttribute("aria-hidden") !== "true");
}

function handleViewerMobileMoreKeydown(event) {
  if (!state.viewerMobileMoreOpen) return;
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
  if (!item || !els.viewerMobileMoreMenu?.contains(item)) return;
  event.preventDefault();
  event.stopPropagation();
  const action = item.dataset.viewerMobileAction;

  if (action === "download") downloadCurrentLightboxImage();
  else if (action === "pin") toggleTopUiPinned();
  else if (action === "fit-height") setViewerFitMode(VIEWER_FIT_HEIGHT, { showUi: false });
  else if (action === "fit-width") setViewerFitMode(VIEWER_FIT_WIDTH, { showUi: false });

  syncViewerMobileMoreMenuState();
  closeViewerMobileMoreMenu({ returnFocus: true });
}

function attachViewerActionEvents() {
  els.viewerInquiryButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openViewerInquiry();
  });
  els.viewerInquiryBackdrop?.addEventListener("click", () => closeViewerInquiry());
  els.viewerInquiryClose?.addEventListener("click", () => closeViewerInquiry());
  els.viewerInquiryShare?.addEventListener("click", () => shareViewerInquiryReference());
  els.viewerInquiryCopy?.addEventListener("click", () => copyViewerInquiryReference());
  els.viewerInquiryOverlay?.addEventListener("keydown", handleViewerInquiryKeydown);
  [els.viewerInquiryGmail, els.viewerInquiryEmail].forEach((link) => {
    link?.addEventListener("click", () => window.setTimeout(() => closeViewerInquiry({ restoreFocus: false }), 0));
  });

  els.viewerMobileMoreToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setViewerMobileMoreOpen(!state.viewerMobileMoreOpen, { returnFocus: state.viewerMobileMoreOpen });
  });
  els.viewerMobileMoreMenu?.addEventListener("click", handleViewerMobileMoreAction);
  els.viewerMobileMoreMenu?.addEventListener("keydown", handleViewerMobileMoreKeydown);
  els.viewerMobileFavoritesLink?.addEventListener("click", () => closeViewerMobileMoreMenu());

  document.addEventListener("pointerdown", (event) => {
    if (!state.viewerMobileMoreOpen) return;
    if (els.viewerMobileMoreMenu?.contains(event.target) || els.viewerMobileMoreToggle?.contains(event.target)) return;
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
    return "במסך מגע החליקו ימינה או שמאלה. אפשר גם ללחוץ על החצים שבצדי המסך או להשתמש במקשי החצים במקלדת.";
  }
  return "לחצו על החצים שבצדי המסך או השתמשו במקשי החצים במקלדת.";
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
      target: () => els.stageCanvas,
      targetRect: getViewerOnboardingNavigationFocusRect,
      floatingTarget: () => els.nextPageBtn,
      preferredPlacement: "above",
      padding: 0,
      radius: 26,
      gesture: "swipe"
    },
    {
      id: "zoom",
      eyebrow: "מבט מקרוב",
      title: "הגדלה וגרירת התמונה",
      description: viewerZoomOnboardingCopy(),
      target: () => isScrollViewerMode()
        ? (getViewerScrollPageFrame(state.page) || els.viewerScrollPages)
        : els.lightboxImageFrame,
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
      target: () => els.viewerInquiryButton,
      floatingTarget: () => els.viewerInquiryButton,
      preferredPlacement: "left",
      padding: 8,
      radius: 24,
      gesture: "tap"
    }
  ];
}

function getViewerOnboardingTopBarFocusRect() {
  const header = els.lightboxBar?.querySelector?.(".lightbox-reader-header");
  return header?.getBoundingClientRect?.() || els.lightboxBar?.getBoundingClientRect?.() || null;
}

function getViewerOnboardingPinFocusRect() {
  const source = els.lightboxPinTopBar?.getBoundingClientRect?.();
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
  const source = els.stageCanvas?.getBoundingClientRect?.() || els.lightboxStage?.getBoundingClientRect?.();
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
  const source = els.lightboxPageRail?.getBoundingClientRect?.();
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
  const activeImageSurface = isScrollViewerMode()
    ? (getViewerScrollPageFrame(state.page) || els.viewerScrollPages)
    : els.lightboxImageFrame;
  const source = activeImageSurface?.getBoundingClientRect?.() || els.stageCanvas?.getBoundingClientRect?.();
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
  if (!els.viewerOnboarding) return [];
  const controls = Array.from(els.viewerOnboarding.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.closest?.(".hidden"));
  const target = state.viewerOnboardingFloatingTarget || state.viewerOnboardingTarget;
  const targetControls = target
    ? [
        ...(target.matches?.('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ? [target] : []),
        ...Array.from(target.querySelectorAll?.('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') || [])
      ]
    : [];
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

function removeViewerOnboardingFloatingTarget() {
  state.viewerOnboardingFloatingTarget?.remove?.();
  state.viewerOnboardingFloatingTarget = null;
  state.viewerOnboardingFloatingSource = null;
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

function updateViewerOnboardingFloatingTarget(step) {
  const source = step.floatingTarget?.() || null;
  if (!source || !els.viewerOnboarding) {
    removeViewerOnboardingFloatingTarget();
    return;
  }

  let clone = state.viewerOnboardingFloatingTarget;
  if (!clone || state.viewerOnboardingFloatingSource !== source || clone.dataset.tourStep !== step.id) {
    removeViewerOnboardingFloatingTarget();
    clone = source.cloneNode(true);
    sanitizeViewerOnboardingFloatingTarget(clone);
    clone.classList.add("viewer-onboarding-floating-target");
    clone.dataset.tourStep = step.id;
    clone.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      source.click();
      window.requestAnimationFrame(() => {
        if (!state.viewerOnboardingOpen || state.viewerOnboardingFloatingTarget !== clone) return;
        syncViewerOnboardingFloatingTargetState(source, clone);
        scheduleViewerOnboardingLayout(30);
      });
    });
    els.viewerOnboarding.appendChild(clone);
    state.viewerOnboardingFloatingTarget = clone;
    state.viewerOnboardingFloatingSource = source;
  }

  syncViewerOnboardingFloatingTargetState(source, clone);
  const rect = source.getBoundingClientRect();
  clone.style.left = `${rect.left}px`;
  clone.style.top = `${rect.top}px`;
  clone.style.width = `${rect.width}px`;
  clone.style.height = `${rect.height}px`;
}

function layoutViewerOnboarding() {
  if (!state.viewerOnboardingOpen || !els.viewerOnboarding || !els.viewerOnboardingCard || !els.viewerOnboardingSpotlight) return;
  const steps = getViewerOnboardingSteps();
  const step = steps[state.viewerOnboardingStep];
  if (!step) return;

  const target = step.target?.() || null;
  state.viewerOnboardingTarget = target;
  const rawRect = step.targetRect?.() || target?.getBoundingClientRect?.();
  const targetRect = normalizeViewerOnboardingRect(
    rawRect,
    Number(step.padding || 0),
    step.viewportMargin === undefined ? 6 : Number(step.viewportMargin)
  );
  if (!targetRect) return;

  updateViewerOnboardingFloatingTarget(step);

  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  setViewerOnboardingShadeRect(els.viewerOnboardingShadeTop, 0, 0, viewportWidth, targetRect.top);
  setViewerOnboardingShadeRect(els.viewerOnboardingShadeBottom, 0, targetRect.bottom, viewportWidth, viewportHeight - targetRect.bottom);
  setViewerOnboardingShadeRect(els.viewerOnboardingShadeLeft, 0, targetRect.top, targetRect.left, targetRect.height);
  setViewerOnboardingShadeRect(els.viewerOnboardingShadeRight, targetRect.right, targetRect.top, viewportWidth - targetRect.right, targetRect.height);

  const spotlight = els.viewerOnboardingSpotlight;
  spotlight.style.left = `${targetRect.left}px`;
  spotlight.style.top = `${targetRect.top}px`;
  spotlight.style.width = `${targetRect.width}px`;
  spotlight.style.height = `${targetRect.height}px`;
  spotlight.style.borderRadius = `${Number(step.radius || 18)}px`;
  spotlight.dataset.gesture = step.gesture || "";
  spotlight.dataset.tourStep = step.id || "";

  const calloutRect = els.viewerOnboardingCard.getBoundingClientRect();
  const calloutPosition = calculateViewerOnboardingCalloutPosition(targetRect, calloutRect, step.preferredPlacement || "below");
  els.viewerOnboardingCard.style.left = `${calloutPosition.left}px`;
  els.viewerOnboardingCard.style.top = `${calloutPosition.top}px`;
  els.viewerOnboardingCard.dataset.placement = calloutPosition.placement;
}

function scheduleViewerOnboardingLayout(delay = 0) {
  const run = () => {
    window.cancelAnimationFrame(state.viewerOnboardingLayoutRaf);
    state.viewerOnboardingLayoutRaf = window.requestAnimationFrame(layoutViewerOnboarding);
  };

  if (delay > 0) {
    // Keep the immediate layout that was scheduled for this step. The delayed
    // pass only re-measures after toolbar/callout transitions have settled.
    window.clearTimeout(state.viewerOnboardingLayoutTimer);
    state.viewerOnboardingLayoutTimer = window.setTimeout(run, delay);
    return;
  }

  run();
}

function renderViewerOnboardingStep(options = {}) {
  if (!state.viewerOnboardingOpen) return;
  const { focus = true, scheduleLayout = true } = options;
  const steps = getViewerOnboardingSteps();
  state.viewerOnboardingStep = clampValue(state.viewerOnboardingStep, 0, Math.max(0, steps.length - 1));
  const step = steps[state.viewerOnboardingStep];
  if (!step) return;

  if (state.viewerOnboardingFloatingTarget?.dataset?.tourStep !== step.id) {
    removeViewerOnboardingFloatingTarget();
  }

  els.lightbox?.classList.toggle("viewer-tour-show-top-ui", Boolean(step.revealTopBar));
  els.lightbox?.classList.toggle("viewer-tour-show-page-rail", Boolean(step.revealPageRail));
  if (step.revealTopBar) window.clearTimeout(state.uiHideTimer);
  if (step.revealPageRail) window.clearTimeout(state.pageRailHideTimer);

  if (els.viewerOnboardingEyebrow) els.viewerOnboardingEyebrow.textContent = step.eyebrow || "סיור קצר";
  if (els.viewerOnboardingTitle) els.viewerOnboardingTitle.textContent = step.title;
  if (els.viewerOnboardingDescription) els.viewerOnboardingDescription.textContent = step.description;
  if (els.viewerOnboardingCounter) els.viewerOnboardingCounter.textContent = `${state.viewerOnboardingStep + 1} מתוך ${steps.length}`;
  if (els.viewerOnboardingNote) {
    els.viewerOnboardingNote.textContent = step.note || "";
    els.viewerOnboardingNote.classList.toggle("hidden", !step.note);
  }
  if (els.viewerOnboardingPrevious) els.viewerOnboardingPrevious.disabled = state.viewerOnboardingStep === 0;
  if (els.viewerOnboardingNext) {
    els.viewerOnboardingNext.textContent = state.viewerOnboardingStep === steps.length - 1 ? "סיום" : "הבא";
  }
  if (els.viewerOnboardingDots) {
    els.viewerOnboardingDots.innerHTML = steps.map((_, index) => (
      `<span${index === state.viewerOnboardingStep ? ' class="active"' : ""}></span>`
    )).join("");
  }

  if (scheduleLayout) {
    scheduleViewerOnboardingLayout();
    scheduleViewerOnboardingLayout(260);
  }
  if (focus) window.requestAnimationFrame(() => els.viewerOnboardingNext?.focus?.({ preventScroll: true }));
}

function moveViewerOnboardingStep(delta) {
  if (!state.viewerOnboardingOpen) return;
  const steps = getViewerOnboardingSteps();
  const nextStep = state.viewerOnboardingStep + delta;
  if (nextStep >= steps.length) {
    closeViewerOnboarding();
    return;
  }
  state.viewerOnboardingStep = clampValue(nextStep, 0, Math.max(0, steps.length - 1));
  renderViewerOnboardingStep();
}

function restoreViewerUiAfterOnboarding() {
  const restore = state.viewerOnboardingRestoreUi || {};
  els.lightbox?.classList.remove("viewer-tour-active", "viewer-tour-show-top-ui", "viewer-tour-show-page-rail");
  if (els.lightbox) {
    if (state.topUiPinned || restore.showUi) els.lightbox.classList.add("show-ui");
    else els.lightbox.classList.remove("show-ui");
    if (restore.showPageRail) els.lightbox.classList.add("show-page-rail");
    else els.lightbox.classList.remove("show-page-rail");
  }
  state.viewerOnboardingRestoreUi = null;
}

function closeViewerOnboarding(options = {}) {
  if (!state.viewerOnboardingOpen) return;
  const { restoreFocus = true, remember = true } = options;
  state.viewerOnboardingOpen = false;
  state.viewerOnboardingTarget = null;
  removeViewerOnboardingFloatingTarget();
  window.cancelAnimationFrame(state.viewerOnboardingLayoutRaf);
  window.clearTimeout(state.viewerOnboardingLayoutTimer);
  if (remember) markViewerOnboardingSeen();
  restoreViewerUiAfterOnboarding();
  els.viewerOnboarding?.classList.remove("visible");
  els.viewerOnboarding?.setAttribute("aria-hidden", "true");
  window.setTimeout(() => {
    if (state.viewerOnboardingOpen) return;
    els.viewerOnboarding?.classList.add("hidden");
    els.viewerOnboarding?.classList.remove("layout-ready");
  }, 220);
  if (restoreFocus) els.stageCanvas?.focus?.({ preventScroll: true });
}

function showViewerOnboardingIfNeeded() {
  if (!state.lightboxOpen || !els.viewerOnboarding || state.viewerOnboardingOpen) return;
  if (state.viewerOnboardingShownThisSession || viewerOnboardingWasSeen()) return;

  state.viewerOnboardingShownThisSession = true;
  state.viewerOnboardingOpen = true;
  state.viewerOnboardingStep = 0;
  state.viewerOnboardingRestoreUi = {
    showUi: Boolean(els.lightbox?.classList.contains("show-ui")),
    showPageRail: Boolean(els.lightbox?.classList.contains("show-page-rail"))
  };
  els.lightbox?.classList.add("viewer-tour-active");
  els.viewerOnboarding.classList.remove("hidden", "visible", "layout-ready");
  els.viewerOnboarding.setAttribute("aria-hidden", "false");

  // Build and measure the first step while the tour is still transparent.
  // Waiting one frame after revealing the real toolbar lets its layout settle,
  // so the callout is already in its final position before the fade-in begins.
  window.requestAnimationFrame(() => {
    if (!state.viewerOnboardingOpen) return;
    renderViewerOnboardingStep({ focus: false, scheduleLayout: false });
    window.requestAnimationFrame(() => {
      if (!state.viewerOnboardingOpen) return;
      layoutViewerOnboarding();
      els.viewerOnboarding.classList.add("layout-ready");
      window.requestAnimationFrame(() => {
        if (!state.viewerOnboardingOpen) return;
        els.viewerOnboarding.classList.add("visible");
        els.viewerOnboardingNext?.focus?.({ preventScroll: true });
        scheduleViewerOnboardingLayout(260);
      });
    });
  });
}

function handleViewerOnboardingKeydown(event) {
  if (!state.viewerOnboardingOpen) return false;
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
  els.viewerOnboardingPrevious?.addEventListener("click", () => moveViewerOnboardingStep(-1));
  els.viewerOnboardingNext?.addEventListener("click", () => moveViewerOnboardingStep(1));
  els.viewerOnboardingSkip?.addEventListener("click", () => closeViewerOnboarding());
}
/* ===== END SOURCE: src/js/65-viewer-onboarding.js ===== */

/* ===== BEGIN SOURCE: src/js/70-viewer-input.js ===== */
/**
 * Source module: 70-viewer-input.js
 * Viewer input boundary: pointer tracking, pan/pinch, wheel zoom, double-click/tap, and surface gestures.
 *
 * Keeping raw input translation separate from viewer rendering makes interaction changes
 * testable without mixing them into page loading, layout, or route behavior.
 */

function getZoomSurfaceName(surface) {
  if (surface === els.stageCanvas && (!isScrollViewerMode() || isViewerScrollIsolatedZoom())) return "catalog-entry";
  if (surface === els.viewerScrollPages && isScrollViewerMode()) return "catalog-scroll";
  return "";
}

function isActiveZoomSurface(surface) {
  return Boolean(getZoomSurfaceName(surface));
}

function startPointerInteraction(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget)) return;

  if (
    isViewerScrollIsolatedZoom()
    && event.currentTarget === els.stageCanvas
    && !els.lightboxImageFrame?.contains(event.target)
  ) {
    event.preventDefault();
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
    return;
  }

  if (state.pointers.size === 0) state.pointerGestureHadMultiplePointers = false;
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (state.pointers.size >= 2) state.pointerGestureHadMultiplePointers = true;
  if (((!isScrollViewerMode() || isViewerScrollIsolatedZoom()) && viewerCanPan()) || state.pointers.size >= 2) {
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  const pointers = getPointerList();
  if (pointers.length === 1) {
    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;
    state.dragStartPanX = state.panX;
    state.dragStartPanY = state.panY;
  } else if (pointers.length === 2) {
    const [first, second] = pointers;
    const mid = pointerMidpoint(first, second);
    state.pinchStartDistance = Math.max(1, pointerDistance(first, second));
    state.pinchStartZoom = state.zoom;
    state.pinchLastMidX = mid.x;
    state.pinchLastMidY = mid.y;
    if (isScrollViewerMode()) {
      for (const pointerId of state.pointers.keys()) {
        event.currentTarget.setPointerCapture?.(pointerId);
      }
    }
    event.preventDefault();
  }
}

function movePointerInteraction(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget) || !state.pointers.has(event.pointerId)) return;
  state.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const pointers = getPointerList();

  if (pointers.length >= 2) {
    event.preventDefault();
    const [first, second] = pointers;
    const distance = Math.max(1, pointerDistance(first, second));
    const mid = pointerMidpoint(first, second);
    if (!isScrollViewerMode() || isViewerScrollIsolatedZoom()) {
      state.panX += mid.x - state.pinchLastMidX;
      state.panY += mid.y - state.pinchLastMidY;
    }
    state.pinchLastMidX = mid.x;
    state.pinchLastMidY = mid.y;
    setZoom(state.pinchStartZoom * (distance / state.pinchStartDistance), {
      showUi: false,
      focalClientX: mid.x,
      focalClientY: mid.y
    });
    return;
  }

  if (pointers.length === 1 && viewerCanPan()) {
    event.preventDefault();
    state.panX = state.dragStartPanX + (event.clientX - state.dragStartX);
    state.panY = state.dragStartPanY + (event.clientY - state.dragStartY);
    applyZoom();
  }
}

function handlePotentialDoubleTap(event, startedX, startedY) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return false;
  if (state.pointers.size > 0) return false;

  const moved = Math.hypot(event.clientX - startedX, event.clientY - startedY);
  if (moved > TAP_MOVE_TOLERANCE) {
    state.lastTapAt = 0;
    return false;
  }

  const now = Date.now();
  const surface = getZoomSurfaceName(event.currentTarget);
  const closeToLastTap = Math.hypot(event.clientX - state.lastTapX, event.clientY - state.lastTapY) <= DOUBLE_TAP_DISTANCE;
  const isDoubleTap =
    surface === state.lastTapSurface &&
    now - state.lastTapAt <= DOUBLE_TAP_DELAY &&
    closeToLastTap;

  state.lastTapAt = now;
  state.lastTapX = event.clientX;
  state.lastTapY = event.clientY;
  state.lastTapSurface = surface;

  if (!isDoubleTap) return false;

  event.preventDefault();
  state.lastTapAt = 0;
  state.suppressNextDblClickUntil = now + 550;
  toggleZoomAtPoint(event.clientX, event.clientY);
  return true;
}

function handleViewerPageSwipe(event, startedX, startedY) {
  if (state.pointers.size > 0 || state.pointerGestureHadMultiplePointers) return false;

  const scrollMode = isScrollViewerMode();
  if (scrollMode) {
    if (isViewerScrollIsolatedZoom() || !isTouchLikePointer(event)) return false;
  } else if (state.zoom > AUTO_VIEWER_ZOOM + 0.01) {
    return false;
  }

  const dx = event.clientX - startedX;
  const dy = event.clientY - startedY;
  if (
    Math.abs(dx) <= VIEWER_PAGE_SWIPE_MIN_DISTANCE
    || Math.abs(dx) <= Math.abs(dy) * VIEWER_PAGE_SWIPE_AXIS_RATIO
  ) {
    return false;
  }

  event.preventDefault();
  const direction = dx > 0 ? 1 : -1;

  // A horizontal swipe is a discrete page command, just like the visible
  // left/right controls and keyboard arrows. It must not enter the continuous
  // viewer's native smooth-scroll path.
  moveLightbox(direction);
  return true;
}

function endPointerInteraction(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget) || !state.pointers.has(event.pointerId)) return;
  const startedX = state.dragStartX;
  const startedY = state.dragStartY;
  state.pointers.delete(event.pointerId);

  const handledDoubleTap = handlePotentialDoubleTap(event, startedX, startedY);
  if (!handledDoubleTap) handleViewerPageSwipe(event, startedX, startedY);

  const pointers = getPointerList();
  if (pointers.length === 1) {
    const only = pointers[0];
    state.dragStartX = only.x;
    state.dragStartY = only.y;
    state.dragStartPanX = state.panX;
    state.dragStartPanY = state.panY;
  } else if (pointers.length === 0) {
    state.pointerGestureHadMultiplePointers = false;
  }
}

function cancelPointerInteraction(event) {
  if (!state.pointers.has(event.pointerId)) return;
  state.pointers.delete(event.pointerId);
  if (state.pointers.size === 0) state.pointerGestureHadMultiplePointers = false;
}

function getWheelZoomFactor(event) {
  const lineMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_LINE : 1;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;
  const delta = normalizeWheelDeltaToPixels(event.deltaY, event.deltaMode, event.currentTarget?.clientHeight || 0);
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return 1;

  // Trackpad pinch is delivered by Chromium/Edge as a high-frequency ctrl+wheel
  // stream with pixel deltas. Use a gesture-like curve so it reacts closer to
  // a real two-finger touch pinch, while capping one event so a mouse wheel
  // cannot jump wildly across the whole zoom range.
  const speed = event.deltaMode === lineMode ? 0.0065 : event.deltaMode === pageMode ? 0.0035 : 0.011;
  const maxStep = Math.log(2.35);
  return Math.exp(clampValue(-delta * speed, -maxStep, maxStep));
}

function handleZoomSurfaceWheel(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget)) return;

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    const factor = getWheelZoomFactor(event);
    if (factor === 1) return;
    setZoom(state.zoom * factor, {
      showUi: false,
      focalClientX: event.clientX,
      focalClientY: event.clientY
    });
    return;
  }

  if (isViewerScrollIsolatedZoom()) {
    event.preventDefault();
    const deltaX = normalizeWheelDeltaToPixels(event.deltaX, event.deltaMode, event.currentTarget.clientWidth);
    const deltaY = normalizeWheelDeltaToPixels(event.deltaY, event.deltaMode, event.currentTarget.clientHeight);
    panViewerScrollIsolatedZoomByWheel(deltaX, deltaY);
    return;
  }

  if (isScrollViewerMode()) {
    handleViewerScrollWheel(event);
    return;
  }

  if (viewerCanPan()) {
    event.preventDefault();
    state.panX -= normalizeWheelDeltaToPixels(event.deltaX, event.deltaMode, event.currentTarget.clientWidth);
    state.panY -= normalizeWheelDeltaToPixels(event.deltaY, event.deltaMode, event.currentTarget.clientHeight);
    applyZoom();
  }
}

function handleZoomSurfaceDoubleClick(event) {
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget)) return;
  if (Date.now() < state.suppressNextDblClickUntil) return;

  // viewerScrollPages is nested inside stageCanvas and both are valid zoom
  // surfaces in different viewer states. A double-click that enters isolated
  // scroll zoom makes stageCanvas active before the same bubbling event reaches
  // it, so without stopping propagation the event is handled twice: zoom in,
  // then immediately reset to automatic zoom.
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
  attachZoomSurfaceGestures(els.stageCanvas);
  attachZoomSurfaceGestures(els.viewerScrollPages);
}

function isLightboxTopInteractiveTarget(target) {
  if (!target || typeof target.closest !== "function") return false;

  const interactiveTarget = target.closest(
    ".lightbox-reader-header, .lightbox-search-results, .reader-catalog-menu, .reader-search-scope-menu"
  );
  return Boolean(interactiveTarget && els.lightboxBar?.contains(interactiveTarget));
}

function hideLightboxTopSearchFromViewerInteraction(event) {
  if (!state.lightboxOpen) return false;
  if (event?.button !== undefined && event.button !== 0) return false;
  if (isLightboxTopInteractiveTarget(event?.target)) return false;

  if (state.lightboxMobileSearchOpen) {
    setLightboxMobileSearchOpen(false, { hideResults: true, hideTopUi: true });
  } else {
    hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi: true });
  }
  return true;
}

function handleViewerSurfacePointerDown(event) {
  hideLightboxTopSearchFromViewerInteraction(event);
}

function handleLightboxPointerDownCapture(event) {
  hideLightboxTopSearchFromViewerInteraction(event);
}

function handleLightboxSearchResultsBackgroundClick(event) {
  const resultButton = event.target.closest?.("[data-lightbox-search-page]");
  if (resultButton && els.lightboxSearchResults?.contains(resultButton)) return;

  event.preventDefault();
  event.stopPropagation();
  hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi: true });
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
    const insideGlobalSearch = Boolean(els.catalogSearch?.contains(target) || els.globalSearchOpen?.contains(target));
    const insideMobileReaderSearch = Boolean(
      els.lightboxSearchPanel?.contains(target) || els.lightboxMobileSearchToggle?.contains(target)
    );

    if (!els.mobileCategoryMenu?.contains(target) && !els.mobileCategoryMenuToggle?.contains(target)) {
      closeMobileCategoryMenu();
    }

    if (insideGlobalSearch) {
      if (!els.globalSearchScopeMenu?.contains(target) && !els.globalSearchScopeToggle?.contains(target)) {
        closeGlobalSearchScopeMenu();
      }
      closeLightboxSearchScopeMenu();
      closeLightboxCatalogMenu();
      closeDetailCatalogMenu();
      return;
    }
    if (insideMobileReaderSearch) return;
    if (state.lightboxMobileSearchOpen) {
      setLightboxMobileSearchOpen(false, { hideResults: true });
    }
    if (els.lightboxSearchScopeMenu?.contains(target) || els.lightboxSearchScopeToggle?.contains(target)) return;
    if (els.lightboxCatalogMenu?.contains(target) || els.lightboxCatalogMenuToggle?.contains(target)) return;
    if (els.catalogMenu?.contains(target) || els.catalogMenuToggle?.contains(target)) return;
    closeGlobalSearchPanel({ focusButton: false });
    closeGlobalSearchScopeMenu();
    closeLightboxSearchScopeMenu();
    closeLightboxCatalogMenu();
    closeDetailCatalogMenu();
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 760px)").matches) closeMobileCategoryMenu();
    scheduleCatalogLayoutRefresh();
    scheduleCategoryNavFit();
    hideSearchFloatingPreview();
    scheduleCatalogScrollTopButtonUpdate();
    updateLightboxSearchResultsLayout(els.lightboxSearchResults?.dataset.resultCount || 0);
    syncLightboxMobileSearchUi();
    if (state.lightboxOpen) {
      hideLightboxFloatingPreview();
      refreshLightboxLayoutForTopUiChange();
      if (state.viewerOnboardingOpen) scheduleViewerOnboardingLayout(40);
    }
  });
  window.addEventListener("scroll", () => {
    hideSearchFloatingPreview();
    scheduleCatalogScrollTopButtonUpdate();
  }, { passive: true });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.favoritesOpen) {
      event.preventDefault();
      closeFavoritesPanel();
      return;
    }
    if (event.key === "Escape" && isMobileCategoryMenuOpen()) {
      event.preventDefault();
      closeMobileCategoryMenu({ focusButton: true });
      return;
    }
    if (event.key === "Escape" && isGlobalSearchPanelOpen()) {
      event.preventDefault();
      if (els.globalSearchScopeMenu && !els.globalSearchScopeMenu.classList.contains("hidden")) {
        closeGlobalSearchScopeMenu();
        return;
      }
      closeGlobalSearchPanel({ focusButton: true });
      return;
    }
    if (event.key === "Escape" && els.catalogMenu && !els.catalogMenu.classList.contains("hidden")) {
      event.preventDefault();
      closeDetailCatalogMenu();
      return;
    }
    if (!state.lightboxOpen) return;
    if (state.viewerInquiryOpen) {
      handleViewerInquiryKeydown(event);
      return;
    }
    if (event.key === "Escape" && state.viewerMobileMoreOpen) {
      event.preventDefault();
      closeViewerMobileMoreMenu({ returnFocus: true });
      return;
    }
    if (state.viewerOnboardingOpen) {
      handleViewerOnboardingKeydown(event);
      return;
    }
    if (event.key === "Escape" && state.lightboxMobileSearchOpen) {
      event.preventDefault();
      setLightboxMobileSearchOpen(false, { returnFocus: true, hideResults: true });
      return;
    }
    if (event.key === "Escape" && ((els.lightboxCatalogMenu && !els.lightboxCatalogMenu.classList.contains("hidden")) || (els.lightboxSearchScopeMenu && !els.lightboxSearchScopeMenu.classList.contains("hidden")))) {
      event.preventDefault();
      closeLightboxCatalogMenu();
      closeLightboxSearchScopeMenu();
      return;
    }
    if (event.key === "Escape" && isBrowserFullscreenActive()) {
      event.preventDefault();
      exitBrowserFullscreen().catch(() => {});
      return;
    }
    const target = event.target;
    const isTyping = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    if (isTyping) {
      if (event.key === "Escape") {
        hideLightboxSearchResults({ blurTopUiFocus: true });
      }
      return;
    }
    if (event.key === "Escape") closeLightbox();
    else if (["ArrowDown", "PageDown"].includes(event.key) && scrollViewerByViewport(1, { repeated: event.repeat })) event.preventDefault();
    else if (["ArrowUp", "PageUp"].includes(event.key) && scrollViewerByViewport(-1, { repeated: event.repeat })) event.preventDefault();
    else if (event.key === "ArrowDown" && panSingleImageBy(0, -getSingleKeyboardPanStep())) event.preventDefault();
    else if (event.key === "ArrowUp" && panSingleImageBy(0, getSingleKeyboardPanStep())) event.preventDefault();
    else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveLightbox(-1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveLightbox(1);
    }
    else if (event.key === "Home") {
      if (isFavoritesLightboxMode()) setFavoriteViewerIndex(0);
      else setLightboxPage(1);
    } else if (event.key === "End" && state.catalog) {
      if (isFavoritesLightboxMode()) setFavoriteViewerIndex(getFavoriteEntries().length - 1);
      else setLightboxPage(state.catalog.pages);
    }
  });
}

function attachEvents() {
  bindFeatureEventsOnce("catalog-grid", attachCatalogGridEvents);
  bindFeatureEventsOnce("search-ui", attachSearchUiEvents);
  bindFeatureEventsOnce("shell", attachShellEvents);
  bindFeatureEventsOnce("favorites-share", attachFavoritesShareEvents);
  bindFeatureEventsOnce("viewer-actions", attachViewerActionEvents);
  bindFeatureEventsOnce("viewer-onboarding", attachViewerOnboardingEvents);
  bindFeatureEventsOnce("viewer", attachViewerEvents);
  bindFeatureEventsOnce("navigation", attachNavigationEvents);
}

function hideCatalogDetailUi() {
  els.catalogDetail?.classList.add("hidden");
  els.catalogDetail?.classList.remove("in-view");
  setCatalogScrollTopButtonVisible(false);
}

function prepareDocumentRoute(nextPage) {
  if (nextPage !== "viewer" && state.lightboxOpen) hideLightboxUi();
  if (nextPage !== "favorites" && state.favoritesTransferPending) {
    closeFavoritesTransferDialog({ restoreFocus: false, cleanUrl: true });
  }
  if (nextPage !== "favorites" && (state.favoritesOpen || els.favoritesPanel?.classList.contains("favorites-standalone-page"))) {
    hideFavoritesPanelUi();
  }
  if (nextPage !== "catalog") hideCatalogDetailUi();

  closeMobileCategoryMenu();
  closeGlobalSearchPanel({ focusButton: false });
  closeGlobalSearchScopeMenu();
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();
  closeDetailCatalogMenu();

  setCurrentAppPage(nextPage);
  syncDocumentLock();
  syncFullscreenButtonUi();
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
    state.catalog = null;
    state.page = 1;
    syncCatalogCategoryFocusFromHash({ animate: false, scroll: Boolean(window.location.hash) });
    updateDocumentMetadata();
    if (!window.location.hash) restoreDocumentRouteScroll(options.scrollPosition);
    return true;
  }

  if (route.page === "favorites") {
    state.catalog = null;
    state.page = 1;
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
    openCatalog(catalog.id, { scrollBehavior: "auto" });
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
      openCatalogInViewer(catalog.id, route.currentPage, {
        source: LIGHTBOX_SOURCE_FAVORITES,
        favoriteIndex
      });
      return true;
    }

    openCatalogInViewer(catalog.id, route.currentPage);
    return true;
  }

  navigateTo(homeDocumentUrl(), { replace: true });
  return false;
}

function init() {
  telemetryInit();
  initRevealObserver();
  initCategoryNavFit();
  initImagePlaceholderObserver();
  attachEvents();
  syncLightboxMobileSearchUi();
  syncFavoritesUi({ renderPanel: isAppPage("favorites") });

  if (!catalogs.length) {
    renderEmptyState();
    return true;
  }

  renderCatalogCards();
  renderGlobalSearchScopeMenu();
  scheduleSearchIndexPreload();
  fillCatalogSelect();
  initSearchStatus();
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
