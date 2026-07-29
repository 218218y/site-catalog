/**
 * Source module: 16-viewer-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

import { $requiredAnchor, $requiredButton, $requiredImage, requiredElement } from "./02-dom-contracts.js";

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

/** @type {Readonly<{
 *   lightbox: HTMLElement,
 *   lightboxBackdrop: HTMLElement,
 *   lightboxBar: HTMLElement,
 *   topHotspot: HTMLButtonElement,
 *   lightboxScreenshot: HTMLButtonElement,
 *   lightboxCopyLink: HTMLButtonElement,
 *   lightboxHomeLink: HTMLAnchorElement,
 *   lightboxPinTopBar: HTMLButtonElement,
 *   lightboxModeLabel: HTMLElement,
 *   lightboxTitle: HTMLElement,
 *   lightboxMeta: HTMLElement,
 *   lightboxProgress: HTMLElement,
 *   viewerPageIndicator: HTMLElement,
 *   viewerPageIndicatorLabel: HTMLElement,
 *   viewerPageIndicatorCurrent: HTMLElement,
 *   viewerPageIndicatorTotal: HTMLElement,
 *   viewerPageIndicatorDetail: HTMLElement,
 *   lightboxImage: HTMLImageElement,
 *   lightboxImageFrame: HTMLElement,
 *   viewerImageFeedback: HTMLElement,
 *   viewerImageFeedbackText: HTMLElement,
 *   viewerImageRetry: HTMLButtonElement,
 *   lightboxStage: HTMLElement,
 *   lightboxSideHotspot: HTMLElement,
 *   lightboxPageRail: HTMLElement,
 *   lightboxPageRailTitle: HTMLElement,
 *   lightboxPageThumbs: HTMLElement,
 *   lightboxFloatingPreview: HTMLElement,
 *   lightboxFloatingPreviewImage: HTMLImageElement,
 *   lightboxFloatingPreviewPage: HTMLElement,
 *   stageCanvas: HTMLElement,
 *   viewerLoading: HTMLElement,
 *   prevPageBtn: HTMLButtonElement,
 *   nextPageBtn: HTMLButtonElement,
 *   fullscreenToggle: HTMLButtonElement,
 *   fitAutoBtn: HTMLButtonElement,
 *   fitHeightBtn: HTMLButtonElement,
 *   fitWidthBtn: HTMLButtonElement,
 *   viewerAutoZoomBtn: HTMLButtonElement,
 *   viewerZoomIndicator: HTMLElement,
 *   viewerMobileMoreToggle: HTMLButtonElement,
 *   viewerMobileMoreMenu: HTMLElement,
 *   viewerOnboarding: HTMLElement,
 *   viewerOnboardingCard: HTMLElement,
 *   viewerOnboardingSpotlight: HTMLElement,
 *   viewerOnboardingGesture: HTMLElement,
 *   viewerOnboardingTitle: HTMLElement,
 *   viewerOnboardingDescription: HTMLElement,
 *   viewerOnboardingEyebrow: HTMLElement,
 *   viewerOnboardingNote: HTMLElement,
 *   viewerOnboardingCounter: HTMLElement,
 *   viewerOnboardingDots: HTMLElement,
 *   viewerOnboardingPrevious: HTMLButtonElement,
 *   viewerOnboardingNext: HTMLButtonElement,
 *   viewerOnboardingSkip: HTMLButtonElement,
 *   viewerOnboardingShadeTop: HTMLElement,
 *   viewerOnboardingShadeRight: HTMLElement,
 *   viewerOnboardingShadeBottom: HTMLElement,
 *   viewerOnboardingShadeLeft: HTMLElement|null
 * }>} */
const viewerElements = Object.freeze({
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
  viewerOnboardingShadeLeft: requiredElement("viewerOnboardingShadeLeft"),
});

export { AUTO_VIEWER_ZOOM, DOUBLE_TAP_DELAY, DOUBLE_TAP_DISTANCE, MAX_VIEWER_ZOOM, MIN_VIEWER_ZOOM, TAP_MOVE_TOLERANCE, VIEWER_FIT_HEIGHT, VIEWER_FIT_SOURCE_AUTO, VIEWER_FIT_SOURCE_MANUAL, VIEWER_FIT_WIDTH, VIEWER_FULLSCREEN_ACTIVE, VIEWER_FULLSCREEN_ENTERING, VIEWER_FULLSCREEN_EXITING, VIEWER_FULLSCREEN_INACTIVE, VIEWER_FULL_RESOLUTION_WARMUP_ZOOM_EPSILON, VIEWER_FULL_RESOLUTION_ZOOM_THRESHOLD, VIEWER_MEDIUM_OVERSUBSCRIPTION_RATIO, VIEWER_ONBOARDING_STORAGE_KEY, VIEWER_PAGE_INDICATOR_HIDE_MS, VIEWER_PAGE_SWAP_CLEANUP_MS, VIEWER_PAGE_SWIPE_AXIS_RATIO, VIEWER_PAGE_SWIPE_MIN_DISTANCE, VIEWER_PAGE_TURN_BUFFER_MAX_PX, VIEWER_PAGE_TURN_BUFFER_MIN_PX, VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO, VIEWER_PAGE_TURN_REMAINDER_EPSILON, VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX, VIEWER_PAGE_WHEEL_PAGE_DELTA_PX, VIEWER_PAGE_WHEEL_SETTLE_MS, VIEWER_PHASE_CLOSED, VIEWER_PHASE_CLOSING, VIEWER_PHASE_OPEN, VIEWER_PHASE_OPENING, VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS, VIEWER_TOUCH_MOMENTUM_MAX_FRAME_MS, VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS, VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS, VIEWER_TOUCH_VELOCITY_BLEND, VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS, VIEWER_ZOOM_INDICATOR_HIDE_MS, viewerElements, viewerState };
