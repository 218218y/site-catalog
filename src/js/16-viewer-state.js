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
  viewerInquiryOpen: false,
  viewerInquiryReturnFocus: null,
  viewerInquiryContext: null,
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
  viewerInquiryCopy: $("viewerInquiryCopy"),
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
