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
  viewerScrollPointerHandoff: null,
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
  viewerOnboardingFloatingTargets: [],
  viewerOnboardingRestoreUi: null,
  viewerOnboardingLayoutRaf: 0,
  viewerOnboardingLayoutTimer: 0,
  actionToastTimer: 0
};

const els = {
  splash: $("splashScreen"),
  catalogsSection: $("catalogs"),
  catalogGrid: $("catalogGrid"),
  catalogLoadStatus: $("catalogLoadStatus"),
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
