/**
 * Source module: 17-viewer-state-transitions.js
 * Canonical commands for cross-domain Viewer state transitions and invariants.
 * DOM effects stay in feature owners; state mutation shared by multiple owners
 * must pass through this module.
 */

/** @import { CatalogImageTier, ViewerNavigationCommand, ViewerNavigationSource, ViewerRelativePosition, ViewerStateInvariantSnapshot } from "../../types/frontend-contracts.js" */

import {
  AUTO_VIEWER_ZOOM,
  viewerGestureState,
  viewerImageState,
  viewerNavigationState,
  viewerSessionState,
  viewerViewportState
} from "./16-viewer-state.js";

const VIEWER_NAVIGATION_SOURCE_BUTTON = "button";
const VIEWER_NAVIGATION_SOURCE_KEYBOARD = "keyboard";
const VIEWER_NAVIGATION_SOURCE_HOME_END = "home-end";
const VIEWER_NAVIGATION_SOURCE_PAGE_RAIL = "page-rail";
const VIEWER_NAVIGATION_SOURCE_PROGRAMMATIC = "programmatic";
const VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE = "horizontal-swipe";
const VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING = "continuous-reading";
const VIEWER_NAVIGATION_SOURCE_VERTICAL_SWIPE = "vertical-swipe";
const VIEWER_NAVIGATION_SOURCE_WHEEL = "wheel";
const VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN = "boundary-pan";
const VIEWER_NAVIGATION_SOURCE_MOMENTUM = "momentum";

const DIRECT_NAVIGATION_SOURCES = new Set([
  VIEWER_NAVIGATION_SOURCE_BUTTON,
  VIEWER_NAVIGATION_SOURCE_KEYBOARD,
  VIEWER_NAVIGATION_SOURCE_HOME_END,
  VIEWER_NAVIGATION_SOURCE_PAGE_RAIL,
  VIEWER_NAVIGATION_SOURCE_PROGRAMMATIC
]);
const RESETTABLE_READING_SOURCES = new Set([
  VIEWER_NAVIGATION_SOURCE_VERTICAL_SWIPE,
  VIEWER_NAVIGATION_SOURCE_WHEEL,
  VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN,
  VIEWER_NAVIGATION_SOURCE_MOMENTUM
]);
const VIEWER_NAVIGATION_SOURCES = new Set([
  ...DIRECT_NAVIGATION_SOURCES,
  ...RESETTABLE_READING_SOURCES,
  VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING,
  VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE
]);
const VIEWER_NAVIGATION_POSITION_MODES = new Set(["relative", "page-turn", "fit-origin"]);
const VIEWER_NAVIGATION_ZOOM_MODES = new Set(["preserve", "reset"]);

/** @param {boolean} condition @param {string} message @param {string} context */
function viewerInvariant(condition, message, context) {
  if (condition) return;
  throw new Error(`Viewer state invariant failed (${context}): ${message}`);
}

/** @returns {ViewerStateInvariantSnapshot} */
function captureViewerStateInvariantSnapshot() {
  viewerInvariant(viewerGestureState.pointers instanceof Map, "gesture pointers are not Map-owned", "capture-state");
  return {
    phase: viewerSessionState.viewerPhase,
    pointerCount: viewerGestureState.pointers.size,
    momentumActive: Boolean(
      viewerGestureState.viewerTouchMomentumRaf
      || viewerGestureState.viewerTouchMomentumVelocityX
      || viewerGestureState.viewerTouchMomentumVelocityY
      || viewerGestureState.viewerTouchMomentumLastTime
    ),
    pendingViewportModes: [
      viewerViewportState.singleImageFitOriginPending,
      Boolean(viewerViewportState.singleImagePendingRelativePosition),
      Boolean(viewerViewportState.singleImagePendingPageTurnOrigin)
    ].filter(Boolean).length,
    resolution: {
      hasImage: Boolean(viewerImageState.singleImageResolutionImage),
      hasTarget: Boolean(viewerImageState.singleImageResolutionTargetSrc),
      hasTier: Boolean(viewerImageState.singleImageResolutionTargetTier),
      ready: viewerImageState.singleImageResolutionReady,
      visible: viewerImageState.singleImageResolutionVisible,
      commitPending: viewerImageState.singleImageResolutionCommitPending,
      retainedForSwap: viewerImageState.singleImageResolutionRetainedForSwap,
      loading: Boolean(viewerImageState.singleImageResolutionStop)
    }
  };
}

/** @param {string} [context] */
function assertViewerStateInvariants(context = "unspecified") {
  const snapshot = captureViewerStateInvariantSnapshot();
  viewerInvariant(Number.isFinite(viewerViewportState.zoom) && viewerViewportState.zoom > 0, "viewport zoom is invalid", context);
  viewerInvariant(Number.isFinite(viewerViewportState.fitScale) && viewerViewportState.fitScale > 0, "viewport fit scale is invalid", context);
  viewerInvariant(Number.isFinite(viewerViewportState.panX) && Number.isFinite(viewerViewportState.panY), "viewport pan is not finite", context);
  viewerInvariant(snapshot.pendingViewportModes <= 1, "viewport has multiple pending position modes", context);
  if (viewerViewportState.singleImagePendingRelativePosition) {
    const pending = viewerViewportState.singleImagePendingRelativePosition;
    viewerInvariant(Number.isInteger(pending.page) && pending.page >= 0, "relative viewport target page is invalid", context);
    viewerInvariant(Number.isFinite(pending.xRatio) && Number.isFinite(pending.yRatio), "relative viewport ratios are not finite", context);
    viewerInvariant(Math.abs(pending.xRatio) <= 1 && Math.abs(pending.yRatio) <= 1, "relative viewport ratios exceed normalized bounds", context);
  }
  if (viewerViewportState.singleImagePendingPageTurnOrigin) {
    const pending = viewerViewportState.singleImagePendingPageTurnOrigin;
    viewerInvariant(Number.isInteger(pending.page) && pending.page >= 0, "page-turn target page is invalid", context);
    viewerInvariant(pending.axis === "x" || pending.axis === "y", "page-turn axis is invalid", context);
    viewerInvariant(pending.direction === -1 || pending.direction === 1, "page-turn direction is invalid", context);
  }
  viewerInvariant(
    Number.isFinite(viewerGestureState.viewerTouchMomentumVelocityX)
      && Number.isFinite(viewerGestureState.viewerTouchMomentumVelocityY)
      && Number.isFinite(viewerGestureState.viewerTouchMomentumLastTime),
    "touch momentum contains non-finite values",
    context
  );
  viewerInvariant(!(snapshot.momentumActive && snapshot.pointerCount > 0), "touch momentum and active pointers overlap", context);
  if (snapshot.phase === "closed") {
    viewerInvariant(snapshot.pointerCount === 0, "closed session retains active pointers", context);
    viewerInvariant(!snapshot.momentumActive, "closed session retains touch momentum", context);
  }

  viewerInvariant(Number.isInteger(viewerImageState.singleImageLoadToken) && viewerImageState.singleImageLoadToken >= 0,
    "image swap token is invalid", context);
  viewerInvariant(Number.isInteger(viewerImageState.singleImageResolutionLoadToken) && viewerImageState.singleImageResolutionLoadToken >= 0,
    "resolution token is invalid", context);
  const resolution = snapshot.resolution;
  if (snapshot.phase === "closed") {
    viewerInvariant(
      !resolution.hasTarget
        && !resolution.ready
        && !resolution.visible
        && !resolution.commitPending
        && !resolution.retainedForSwap
        && !resolution.loading,
      "closed session retains an active resolution lifecycle",
      context
    );
  }
  viewerInvariant(resolution.hasTarget === resolution.hasTier, "resolution target source/tier ownership diverged", context);
  if (resolution.ready || resolution.visible || resolution.commitPending || resolution.loading) {
    viewerInvariant(resolution.hasTarget, "active resolution lifecycle has no target", context);
    viewerInvariant(resolution.hasImage, "active resolution lifecycle has no image layer", context);
  }
  if (resolution.visible) {
    viewerInvariant(resolution.ready, "visible resolution layer is not ready", context);
  }
  if (resolution.retainedForSwap) {
    viewerInvariant(resolution.hasImage, "retained resolution layer has no image", context);
    viewerInvariant(!resolution.hasTarget, "retained resolution layer still owns a target", context);
    viewerInvariant(!resolution.ready && !resolution.visible && !resolution.commitPending && !resolution.loading,
      "retained resolution layer overlaps an active resolution request", context);
  }
  return snapshot;
}

function clearViewerPendingViewportPosition() {
  viewerViewportState.singleImageFitOriginPending = false;
  viewerViewportState.singleImagePendingRelativePosition = null;
  viewerViewportState.singleImagePendingPageTurnOrigin = null;
}

/** @param {{clearPointers?:boolean, clearTapHistory?:boolean}} [options] */
function resetViewerGestureCommand(options = {}) {
  if (options.clearPointers !== false) viewerGestureState.pointers.clear();
  viewerGestureState.dragStartX = 0;
  viewerGestureState.dragStartY = 0;
  viewerGestureState.dragStartPanX = 0;
  viewerGestureState.dragStartPanY = 0;
  viewerGestureState.pinchStartDistance = 0;
  viewerGestureState.pinchStartZoom = AUTO_VIEWER_ZOOM;
  viewerGestureState.pinchLastMidX = 0;
  viewerGestureState.pinchLastMidY = 0;
  viewerGestureState.pointerGestureHadMultiplePointers = false;
  viewerGestureState.pointerGestureConsumedPan = false;
  if (options.clearTapHistory) {
    viewerGestureState.lastTapAt = 0;
    viewerGestureState.lastTapX = 0;
    viewerGestureState.lastTapY = 0;
    viewerGestureState.lastTapSurface = "";
    viewerGestureState.suppressNextDblClickUntil = 0;
  }
}

function resetViewerNavigationGestureCommand() {
  viewerNavigationState.viewerPageWheelSettleTimer = 0;
  viewerNavigationState.viewerPageWheelAccumulator = 0;
  viewerNavigationState.viewerPageWheelBasePage = 0;
  viewerNavigationState.viewerPageWheelTargetPage = 0;
  viewerNavigationState.viewerPageWheelResetGestureActive = false;
  viewerNavigationState.viewerPageWheelResetLastEventAt = 0;
  viewerNavigationState.viewerPageWheelResetLastDelta = 0;
  viewerNavigationState.viewerPageWheelResetDirection = 0;
}

function initializeViewerOpenStateCommand() {
  viewerViewportState.zoom = AUTO_VIEWER_ZOOM;
  viewerViewportState.panX = 0;
  viewerViewportState.panY = 0;
  clearViewerPendingViewportPosition();
  viewerViewportState.singleImageFitOriginPending = true;
  resetViewerGestureCommand({ clearTapHistory: true });
  resetViewerNavigationGestureCommand();
  assertViewerStateInvariants("initialize-viewer-open");
}

function finalizeViewerClosedStateCommand() {
  clearViewerPendingViewportPosition();
  resetViewerGestureCommand({ clearTapHistory: true });
  resetViewerNavigationGestureCommand();
  assertViewerStateInvariants("finalize-viewer-closed");
}

/**
 * @param {ViewerNavigationSource} source
 * @param {number} direction
 * @param {{axis?:"x"|"y", preservePointerInteraction?:boolean, manualZoom?:boolean}} [options]
 * @returns {ViewerNavigationCommand}
 */
function createViewerNavigationCommand(source, direction, options = {}) {
  if (!VIEWER_NAVIGATION_SOURCES.has(source)) {
    throw new TypeError(`Unknown Viewer navigation source: ${String(source)}`);
  }
  if (!Number.isFinite(direction)) {
    throw new TypeError("Viewer navigation direction must be finite.");
  }
  if (options.axis !== undefined && options.axis !== "x" && options.axis !== "y") {
    throw new TypeError(`Invalid Viewer navigation axis: ${String(options.axis)}`);
  }
  if (options.manualZoom !== undefined && typeof options.manualZoom !== "boolean") {
    throw new TypeError("Viewer navigation manualZoom must be boolean when provided.");
  }
  if (options.preservePointerInteraction !== undefined && typeof options.preservePointerInteraction !== "boolean") {
    throw new TypeError("Viewer navigation preservePointerInteraction must be boolean when provided.");
  }

  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  const axis = source === VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE ? "x" : (options.axis || "y");
  const preservePointerInteraction = options.preservePointerInteraction === true;
  const manualZoom = options.manualZoom ?? Math.abs(viewerViewportState.zoom - AUTO_VIEWER_ZOOM) > 0.001;

  if (source === VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE) {
    return Object.freeze({ source, direction: step, axis, zoomMode: "preserve", positionMode: "page-turn", preservePointerInteraction });
  }
  if (source === VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING) {
    return Object.freeze({ source, direction: step, axis, zoomMode: "preserve", positionMode: "page-turn", preservePointerInteraction });
  }
  if (RESETTABLE_READING_SOURCES.has(source)) {
    if (manualZoom) {
      return Object.freeze({ source, direction: step, axis, zoomMode: "reset", positionMode: "fit-origin", preservePointerInteraction });
    }
    return Object.freeze({ source, direction: step, axis, zoomMode: "preserve", positionMode: "page-turn", preservePointerInteraction });
  }
  if (!manualZoom) {
    return Object.freeze({ source, direction: step, axis, zoomMode: "preserve", positionMode: "fit-origin", preservePointerInteraction });
  }
  return Object.freeze({ source, direction: step, axis, zoomMode: "preserve", positionMode: "relative", preservePointerInteraction });
}

/** @param {ViewerNavigationCommand} command */
function assertViewerNavigationCommand(command) {
  viewerInvariant(Boolean(command && typeof command === "object"), "navigation command is missing", "navigation-command");
  viewerInvariant(VIEWER_NAVIGATION_SOURCES.has(command.source), "navigation source is invalid", "navigation-command");
  viewerInvariant(command.direction === -1 || command.direction === 0 || command.direction === 1,
    "navigation direction is not normalized", "navigation-command");
  viewerInvariant(command.axis === "x" || command.axis === "y", "navigation axis is invalid", "navigation-command");
  viewerInvariant(VIEWER_NAVIGATION_ZOOM_MODES.has(command.zoomMode), "navigation zoom mode is invalid", "navigation-command");
  viewerInvariant(VIEWER_NAVIGATION_POSITION_MODES.has(command.positionMode), "navigation position mode is invalid", "navigation-command");
  viewerInvariant(typeof command.preservePointerInteraction === "boolean", "pointer preservation flag is invalid", "navigation-command");

  if (command.positionMode === "page-turn") {
    viewerInvariant(command.direction === -1 || command.direction === 1, "page-turn direction must be non-zero", "navigation-command");
  }
  if (command.source === VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE) {
    viewerInvariant(command.axis === "x" && command.zoomMode === "preserve" && command.positionMode === "page-turn",
      "horizontal swipe policy was overridden", "navigation-command");
  } else if (command.source === VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING) {
    viewerInvariant(command.zoomMode === "preserve" && command.positionMode === "page-turn",
      "continuous-reading policy was overridden", "navigation-command");
  } else if (RESETTABLE_READING_SOURCES.has(command.source)) {
    const preservesAutomaticReading = command.zoomMode === "preserve" && command.positionMode === "page-turn";
    const resetsManualReading = command.zoomMode === "reset" && command.positionMode === "fit-origin";
    viewerInvariant(preservesAutomaticReading || resetsManualReading,
      "scroll navigation policy was overridden", "navigation-command");
  } else {
    viewerInvariant(command.zoomMode === "preserve" && (command.positionMode === "relative" || command.positionMode === "fit-origin"),
      "direct navigation policy was overridden", "navigation-command");
  }
  return command;
}

/**
 * @param {number} targetPage
 * @param {ViewerNavigationCommand} command
 * @param {{xRatio:number,yRatio:number}|null} [relativePosition]
 */
function beginViewerPageTransitionCommand(targetPage, command, relativePosition = null) {
  if (!Number.isInteger(targetPage) || targetPage < 0) {
    throw new TypeError("Viewer page transition requires a non-negative integer target.");
  }
  const nextPage = targetPage;
  assertViewerNavigationCommand(command);

  /** @type {ViewerRelativePosition|null} */
  let normalizedRelativePosition = null;
  if (command.positionMode === "relative") {
    if (!relativePosition || !Number.isFinite(relativePosition.xRatio) || !Number.isFinite(relativePosition.yRatio)) {
      throw new TypeError("Relative Viewer navigation requires finite position ratios.");
    }
    normalizedRelativePosition = {
      page: nextPage,
      xRatio: Math.max(-1, Math.min(1, relativePosition.xRatio)),
      yRatio: Math.max(-1, Math.min(1, relativePosition.yRatio))
    };
  }

  clearViewerPendingViewportPosition();
  if (command.zoomMode === "reset") viewerViewportState.zoom = AUTO_VIEWER_ZOOM;
  if (command.positionMode === "fit-origin") {
    viewerViewportState.panX = 0;
    viewerViewportState.panY = 0;
    viewerViewportState.singleImageFitOriginPending = true;
  } else if (command.positionMode === "page-turn") {
    viewerViewportState.panX = 0;
    viewerViewportState.panY = 0;
    viewerViewportState.singleImagePendingPageTurnOrigin = {
      page: nextPage,
      direction: command.direction > 0 ? 1 : -1,
      axis: command.axis
    };
  } else {
    viewerViewportState.singleImagePendingRelativePosition = normalizedRelativePosition;
  }

  if (!command.preservePointerInteraction) resetViewerGestureCommand();
  assertViewerStateInvariants(`begin-page-transition:${command.source}`);
}


function beginViewerImageSwapCommand() {
  viewerImageState.singleImageLoadToken += 1;
  return viewerImageState.singleImageLoadToken;
}

function invalidateViewerImageSwapCommand() {
  viewerImageState.singleImageLoadToken += 1;
  return viewerImageState.singleImageLoadToken;
}

/** @param {number} token */
function isViewerImageSwapCurrent(token) {
  return token === viewerImageState.singleImageLoadToken;
}
function cancelViewerResolutionCommand() {
  viewerImageState.singleImageResolutionLoadToken += 1;
  viewerImageState.singleImageResolutionStop?.();
  viewerImageState.singleImageResolutionStop = null;
  viewerImageState.singleImageResolutionTargetSrc = "";
  viewerImageState.singleImageResolutionTargetTier = "";
  viewerImageState.singleImageResolutionReady = false;
  viewerImageState.singleImageResolutionVisible = false;
  viewerImageState.singleImageResolutionCommitPending = false;
  viewerImageState.singleImageResolutionRetainedForSwap = false;
  assertViewerStateInvariants("cancel-resolution");
}

/** @param {string} targetSrc @param {CatalogImageTier} targetTier @param {boolean} commitPending */
function beginViewerResolutionCommand(targetSrc, targetTier, commitPending) {
  if (typeof targetSrc !== "string" || typeof targetTier !== "string" || typeof commitPending !== "boolean") {
    throw new TypeError("Viewer resolution transition requires string targets and a boolean commit policy.");
  }
  const normalizedTargetSrc = targetSrc.trim();
  if (!normalizedTargetSrc || !targetTier) {
    throw new TypeError("Viewer resolution transition requires a target source and tier.");
  }
  cancelViewerResolutionCommand();
  const token = viewerImageState.singleImageResolutionLoadToken;
  viewerImageState.singleImageResolutionTargetSrc = normalizedTargetSrc;
  viewerImageState.singleImageResolutionTargetTier = targetTier;
  viewerImageState.singleImageResolutionCommitPending = Boolean(commitPending);
  assertViewerStateInvariants("begin-resolution");
  return token;
}

/** @param {number} token @param {(() => void)|null} stop */
function attachViewerResolutionStopCommand(token, stop) {
  if (stop !== null && typeof stop !== "function") {
    throw new TypeError("Viewer resolution stop handle must be a function or null.");
  }
  if (token !== viewerImageState.singleImageResolutionLoadToken) {
    stop?.();
    return false;
  }
  viewerImageState.singleImageResolutionStop = stop;
  assertViewerStateInvariants("attach-resolution-stop");
  return true;
}

/** @param {number} token */
function markViewerResolutionReadyCommand(token) {
  if (token !== viewerImageState.singleImageResolutionLoadToken) return false;
  viewerImageState.singleImageResolutionStop = null;
  viewerImageState.singleImageResolutionReady = true;
  assertViewerStateInvariants("resolution-ready");
  return true;
}

/** @param {number} token */
function commitViewerResolutionCommand(token) {
  if (token !== viewerImageState.singleImageResolutionLoadToken || !viewerImageState.singleImageResolutionReady) {
    if (token === viewerImageState.singleImageResolutionLoadToken) viewerImageState.singleImageResolutionCommitPending = true;
    return false;
  }
  viewerImageState.singleImageResolutionCommitPending = false;
  viewerImageState.singleImageResolutionVisible = true;
  assertViewerStateInvariants("resolution-visible");
  return true;
}

function retainViewerResolutionForSwapCommand() {
  viewerInvariant(
    viewerImageState.singleImageResolutionVisible
      && viewerImageState.singleImageResolutionReady
      && Boolean(viewerImageState.singleImageResolutionImage),
    "resolution layer cannot be retained before it is visible and ready",
    "retain-resolution-for-swap"
  );
  viewerImageState.singleImageResolutionLoadToken += 1;
  viewerImageState.singleImageResolutionStop?.();
  viewerImageState.singleImageResolutionStop = null;
  viewerImageState.singleImageResolutionTargetSrc = "";
  viewerImageState.singleImageResolutionTargetTier = "";
  viewerImageState.singleImageResolutionReady = false;
  viewerImageState.singleImageResolutionVisible = false;
  viewerImageState.singleImageResolutionCommitPending = false;
  viewerImageState.singleImageResolutionRetainedForSwap = true;
  assertViewerStateInvariants("retain-resolution-for-swap");
}

function releaseViewerRetainedResolutionCommand() {
  if (!viewerImageState.singleImageResolutionRetainedForSwap) return false;
  viewerImageState.singleImageResolutionRetainedForSwap = false;
  assertViewerStateInvariants("release-retained-resolution");
  return true;
}


export {
  assertViewerNavigationCommand,
  assertViewerStateInvariants,
  attachViewerResolutionStopCommand,
  beginViewerImageSwapCommand,
  beginViewerPageTransitionCommand,
  beginViewerResolutionCommand,
  cancelViewerResolutionCommand,
  captureViewerStateInvariantSnapshot,
  commitViewerResolutionCommand,
  createViewerNavigationCommand,
  finalizeViewerClosedStateCommand,
  initializeViewerOpenStateCommand,
  invalidateViewerImageSwapCommand,
  isViewerImageSwapCurrent,
  markViewerResolutionReadyCommand,
  releaseViewerRetainedResolutionCommand,
  resetViewerGestureCommand,
  resetViewerNavigationGestureCommand,
  retainViewerResolutionForSwapCommand,
  VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN,
  VIEWER_NAVIGATION_SOURCE_BUTTON,
  VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING,
  VIEWER_NAVIGATION_SOURCE_HOME_END,
  VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE,
  VIEWER_NAVIGATION_SOURCE_KEYBOARD,
  VIEWER_NAVIGATION_SOURCE_MOMENTUM,
  VIEWER_NAVIGATION_SOURCE_PAGE_RAIL,
  VIEWER_NAVIGATION_SOURCE_PROGRAMMATIC,
  VIEWER_NAVIGATION_SOURCE_VERTICAL_SWIPE,
  VIEWER_NAVIGATION_SOURCE_WHEEL
};
