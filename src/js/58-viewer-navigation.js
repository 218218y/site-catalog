/**
 * Source module: 58-viewer-navigation.js
 * Paged-viewer wheel normalization, edge overscroll, and page-turn command handling.
 *
 * This module translates wheel, trackpad, and boundary-pan intent into the
 * same paged navigation contract used by buttons, keyboard, and touch input.
 */

/** @import { ViewerNavigationSource, ViewerPanInputResult, ViewerSetPageOptions } from "../../types/frontend-contracts.js" */

import { catalogFirstPage } from "./06-catalog-page-numbering.js";
import { getFeatureInterface } from "./10-app-state.js";
import { VIEWER_PAGE_TURN_REMAINDER_EPSILON, VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX, VIEWER_PAGE_WHEEL_PAGE_DELTA_PX, VIEWER_PAGE_WHEEL_RESET_ACCELERATION_RATIO, VIEWER_PAGE_WHEEL_RESET_RESTART_GAP_MS, VIEWER_PAGE_WHEEL_SETTLE_MS, viewerElements, viewerNavigationState } from "./16-viewer-state.js";
import { VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN, VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING, VIEWER_NAVIGATION_SOURCE_WHEEL, createViewerNavigationCommand, resetViewerNavigationGestureCommand } from "./17-viewer-state-transitions.js";
import { activeCatalog, activePage } from "./18-navigation-feature.js";
import { clampValue } from "./20-shared-ui.js";
import { isFavoritesLightboxMode } from "./30-favorites-share.js";
import { isViewerSessionOpen } from "./51-viewer-session-state.js";
import { showSingleLightboxImage, viewerPageImageRequest } from "./53-viewer-image.js";
import { consumeSingleViewerPanInput, isAutoViewerZoom, normalizeWheelDeltaToPixels, singleViewerUsesBoundaryPan } from "./54-viewer-geometry.js";
import { moveLightbox, setFavoriteViewerIndex, setLightboxPage } from "./59-viewer-page-controller.js";

function retryCurrentViewerImage() {
  const catalog = activeCatalog();
  if (!isViewerSessionOpen() || !catalog) return;
  const request = viewerPageImageRequest(catalog, activePage());
  showSingleLightboxImage(catalog, activePage(), request.primarySrc, {
    imageRequest: request,
    forceRefresh: true
  });
}

function getViewerNavigationPosition() {
  return isFavoritesLightboxMode()
    ? (getFeatureInterface("favorites")?.viewerIndex() ?? 0)
    : activePage() - catalogFirstPage(activeCatalog());
}

function getViewerNavigationMaximumPosition() {
  if (isFavoritesLightboxMode()) {
    return Math.max(0, (getFeatureInterface("favorites")?.entries().length || 0) - 1);
  }
  return Math.max(0, (activeCatalog()?.pages || 1) - 1);
}

/** @param {number} position @param {ViewerSetPageOptions} [options] */
function setViewerNavigationPosition(position, options = {}) {
  const maximum = getViewerNavigationMaximumPosition();
  const target = clampValue(Number.parseInt(String(position), 10) || 0, 0, maximum);
  if (target === getViewerNavigationPosition()) return false;

  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex(target, options);
  } else {
    setLightboxPage(target + catalogFirstPage(activeCatalog()), options);
  }
  return true;
}

/** @param {number} direction */
function canMoveLightbox(direction) {
  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (!step) return false;
  const current = getViewerNavigationPosition();
  return current + step >= 0 && current + step <= getViewerNavigationMaximumPosition();
}

function clearViewerPageWheelGesture() {
  window.clearTimeout(viewerNavigationState.viewerPageWheelSettleTimer);
  resetViewerNavigationGestureCommand();
}

function scheduleViewerPageWheelSettle() {
  window.clearTimeout(viewerNavigationState.viewerPageWheelSettleTimer);
  viewerNavigationState.viewerPageWheelSettleTimer = window.setTimeout(
    settleViewerPageWheelGesture,
    VIEWER_PAGE_WHEEL_SETTLE_MS
  );
}

/** @param {number} logicalDelta @param {number} eventTime */
function holdViewerPageWheelAfterManualReset(logicalDelta, eventTime) {
  viewerNavigationState.viewerPageWheelAccumulator = 0;
  viewerNavigationState.viewerPageWheelBasePage = 0;
  viewerNavigationState.viewerPageWheelTargetPage = 0;
  viewerNavigationState.viewerPageWheelResetGestureActive = true;
  viewerNavigationState.viewerPageWheelResetLastEventAt = eventTime;
  viewerNavigationState.viewerPageWheelResetLastDelta = Math.abs(logicalDelta);
  viewerNavigationState.viewerPageWheelResetDirection = Math.sign(logicalDelta);
  scheduleViewerPageWheelSettle();
}

/** @param {WheelEvent} event */
function getViewerPageWheelEventTime(event) {
  const eventTime = Number(event?.timeStamp);
  if (Number.isFinite(eventTime) && eventTime >= 0) return eventTime;
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

/**
 * WheelEvent has no portable gesture-start/gesture-end signal. After a manual
 * zoom edge turn, classify only the decaying same-direction tail as belonging
 * to the completed gesture. A cadence break, direction change, or renewed
 * acceleration marks a fresh gesture and the current event must be processed.
 *
 * @param {number} logicalDelta
 * @param {number} eventTime
 */
function consumeViewerPageWheelResetContinuation(logicalDelta, eventTime) {
  if (!viewerNavigationState.viewerPageWheelResetGestureActive) return false;

  const direction = Math.sign(logicalDelta);
  const magnitude = Math.abs(logicalDelta);
  const previousDirection = viewerNavigationState.viewerPageWheelResetDirection;
  const previousMagnitude = viewerNavigationState.viewerPageWheelResetLastDelta;
  const elapsed = Math.max(0, eventTime - viewerNavigationState.viewerPageWheelResetLastEventAt);
  const sameDirection = direction !== 0 && direction === previousDirection;
  const accelerated = magnitude >= Math.max(
    previousMagnitude * VIEWER_PAGE_WHEEL_RESET_ACCELERATION_RATIO,
    previousMagnitude + VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX
  );
  const restartedAfterCadenceBreak = elapsed >= VIEWER_PAGE_WHEEL_RESET_RESTART_GAP_MS;

  if (
    !sameDirection
    || accelerated
    || restartedAfterCadenceBreak
  ) {
    clearViewerPageWheelGesture();
    return false;
  }

  viewerNavigationState.viewerPageWheelResetLastEventAt = eventTime;
  viewerNavigationState.viewerPageWheelResetLastDelta = magnitude;
  scheduleViewerPageWheelSettle();
  return true;
}

/** @param {number} rawDelta @param {number} deltaMode @param {number} [viewportSize] */
function normalizeViewerPageWheelAxisDelta(rawDelta, deltaMode, viewportSize = 0) {
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;
  if (deltaMode === pageMode) {
    return (Number(rawDelta) || 0) * VIEWER_PAGE_WHEEL_PAGE_DELTA_PX;
  }
  return normalizeWheelDeltaToPixels(rawDelta, deltaMode, viewportSize);
}

/** @param {WheelEvent} event */
function normalizeViewerPageWheelDeltas(event) {
  const currentTarget = event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
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

/** @param {number} deltaX @param {number} deltaY */
function getViewerPageWheelLogicalDelta(deltaX, deltaY) {
  if (Math.abs(deltaY) >= Math.abs(deltaX)) return deltaY;
  // The viewer is RTL: a rightward finger/trackpad gesture (negative wheel
  // deltaX) advances, matching the existing horizontal touch-swipe contract.
  return -deltaX;
}

/** @param {number} accumulator */
function getViewerPageWheelRequestedSteps(accumulator) {
  const signedAccumulator = Number(accumulator) || 0;
  const magnitude = Math.abs(signedAccumulator);
  if (magnitude < VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX) return 0;

  const wholePageSteps = Math.trunc(magnitude / VIEWER_PAGE_WHEEL_PAGE_DELTA_PX);
  return Math.sign(signedAccumulator) * Math.max(1, wholePageSteps);
}

/** @param {ViewerPanInputResult|null} result @param {number} [deltaX] @param {number} [deltaY] @returns {{axis:"y",direction:-1|1}|null} */
function getSingleViewerPageTurnIntent(result, deltaX = 0, deltaY = 0) {
  if (!result) return null;
  // A zoomed/pannable image may expose the same black safety buffer on both
  // axes, but only vertical reading intent is allowed to turn the page. The
  // horizontal buffer is a terminal pan boundary, not another navigation rail.
  const remaining = result.remainingDeltaY;
  if (Math.abs(remaining) <= VIEWER_PAGE_TURN_REMAINDER_EPSILON) return null;

  return {
    axis: "y",
    direction: remaining > 0 ? 1 : -1
  };
}

/**
 * @param {number} direction
 * @param {"x"|"y"} [axis]
 * @param {{preservePointerInteraction?:boolean, navigationSource?:ViewerNavigationSource}} [options]
 */
function getViewerPageTurnNavigationCommand(direction, axis = "y", options = {}) {
  return createViewerNavigationCommand(
    options.navigationSource || VIEWER_NAVIGATION_SOURCE_CONTINUOUS_READING,
    direction,
    {
      axis,
      preservePointerInteraction: options.preservePointerInteraction === true
    }
  );
}

/**
 * @param {number} direction
 * @param {"x"|"y"} [axis]
 * @param {{preservePointerInteraction?:boolean, navigationSource?:ViewerNavigationSource}} [options]
 */
function moveLightboxFromPageTurn(direction, axis = "y", options = {}) {
  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (!step || !canMoveLightbox(step)) return false;

  moveLightbox(step, {
    navigationCommand: getViewerPageTurnNavigationCommand(step, axis, options)
  });
  return true;
}

/**
 * @param {number} [deltaX]
 * @param {number} [deltaY]
 * @param {{pointerId?:number, navigationSource?:ViewerNavigationSource}} [options]
 */
function consumeSingleViewerBoundaryInput(deltaX = 0, deltaY = 0, options = {}) {
  const result = consumeSingleViewerPanInput(deltaX, deltaY);
  if (!result) return { handled: false, turned: false, moved: false };

  const intent = getSingleViewerPageTurnIntent(result, deltaX, deltaY);
  const turned = Boolean(intent && moveLightboxFromPageTurn(intent.direction, intent.axis, {
    preservePointerInteraction: Number.isFinite(options.pointerId),
    navigationSource: options.navigationSource || VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN
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

/** @param {WheelEvent} event */
function handleViewerPageWheel(event) {
  if (!isViewerSessionOpen() || !activeCatalog()) return false;

  const { deltaX, deltaY } = normalizeViewerPageWheelDeltas(event);
  if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) return false;

  event.preventDefault();

  const logicalDelta = getViewerPageWheelLogicalDelta(deltaX, deltaY);
  const eventTime = getViewerPageWheelEventTime(event);

  // A wheel/trackpad stream can emit trailing deltas after a zoomed edge turn.
  // That turn resets the manual view, so the remainder belongs to the gesture
  // that already changed page and must not immediately skip another page.
  if (consumeViewerPageWheelResetContinuation(logicalDelta, eventTime)) {
    return true;
  }

  if (singleViewerUsesBoundaryPan()) {
    const resetManualView = !isAutoViewerZoom();
    clearViewerPageWheelGesture();
    const boundary = consumeSingleViewerBoundaryInput(deltaX, deltaY, { navigationSource: VIEWER_NAVIGATION_SOURCE_WHEEL });
    if (boundary.turned && resetManualView) {
      holdViewerPageWheelAfterManualReset(logicalDelta, eventTime);
    }
    return true;
  }

  if (Math.abs(logicalDelta) < 0.01) return true;

  const gestureStarted = !viewerNavigationState.viewerPageWheelBasePage;
  if (gestureStarted) {
    const currentPosition = getViewerNavigationPosition();
    // Store one-based values so zero remains the explicit "no gesture" sentinel.
    viewerNavigationState.viewerPageWheelBasePage = currentPosition + 1;
    viewerNavigationState.viewerPageWheelTargetPage = currentPosition + 1;
    viewerNavigationState.viewerPageWheelAccumulator = 0;
  }

  viewerNavigationState.viewerPageWheelAccumulator += logicalDelta;
  const requestedSteps = getViewerPageWheelRequestedSteps(viewerNavigationState.viewerPageWheelAccumulator);
  const basePosition = viewerNavigationState.viewerPageWheelBasePage - 1;
  const targetPosition = clampValue(
    basePosition + requestedSteps,
    0,
    getViewerNavigationMaximumPosition()
  );
  const previousTargetPosition = viewerNavigationState.viewerPageWheelTargetPage - 1;
  viewerNavigationState.viewerPageWheelTargetPage = targetPosition + 1;

  if (targetPosition !== previousTargetPosition) {
    const direction = Math.sign(targetPosition - previousTargetPosition)
      || Math.sign(targetPosition - basePosition)
      || Math.sign(logicalDelta);
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

  scheduleViewerPageWheelSettle();
  return true;
}

/* TEST-ONLY EXPORTS: BEGIN */
if (typeof __BARGIG_TEST_EXPORTS__ !== "undefined") {
  __BARGIG_TEST_EXPORTS__["viewer-navigation"] = Object.freeze({
    normalizeViewerPageWheelAxisDelta,
    normalizeViewerPageWheelDeltas,
    getViewerPageWheelLogicalDelta,
    getViewerPageWheelRequestedSteps,
    getSingleViewerPageTurnIntent,
    getViewerPageTurnNavigationCommand,
    moveLightboxFromPageTurn,
    consumeSingleViewerBoundaryInput,
    consumeViewerPageWheelResetContinuation,
    handleViewerPageWheel,
    clearViewerPageWheelGesture,
    retryCurrentViewerImage
  });
}
/* TEST-ONLY EXPORTS: END */

export { clearViewerPageWheelGesture, consumeSingleViewerBoundaryInput, handleViewerPageWheel, moveLightboxFromPageTurn, retryCurrentViewerImage };
