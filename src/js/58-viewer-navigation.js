/**
 * Source module: 58-viewer-navigation.js
 * Paged-viewer wheel normalization, edge overscroll, and page-turn command handling.
 *
 * This module translates wheel, trackpad, and boundary-pan intent into the
 * same paged navigation contract used by buttons, keyboard, and touch input.
 */

import { catalogFirstPage } from "./06-catalog-page-numbering.js";
import { getFeatureInterface } from "./10-app-state.js";
import { VIEWER_PAGE_TURN_REMAINDER_EPSILON, VIEWER_PAGE_WHEEL_FIRST_PAGE_DELTA_PX, VIEWER_PAGE_WHEEL_PAGE_DELTA_PX, VIEWER_PAGE_WHEEL_SETTLE_MS, viewerElements, viewerState } from "./16-viewer-state.js";
import { activeCatalog, activePage } from "./18-navigation-feature.js";
import { clampValue } from "./20-shared-ui.js";
import { isFavoritesLightboxMode } from "./30-favorites-share.js";
import { isViewerSessionOpen } from "./52-viewer-session.js";
import { showSingleLightboxImage, viewerPageImageRequest } from "./53-viewer-image.js";
import { consumeSingleViewerPanInput, isAutoViewerZoom, singleViewerUsesBoundaryPan } from "./54-viewer-geometry.js";
import { normalizeWheelDeltaToPixels } from "./56-viewer-shell.js";
import { moveLightbox, setFavoriteViewerIndex, setLightboxPage } from "./60-viewer.js";

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
  window.clearTimeout(viewerState.viewerPageWheelSettleTimer);
  viewerState.viewerPageWheelSettleTimer = 0;
  viewerState.viewerPageWheelAccumulator = 0;
  viewerState.viewerPageWheelBasePage = 0;
  viewerState.viewerPageWheelTargetPage = 0;
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

/** @param {ViewerPanInputResult|null} result @param {number} [deltaX] @param {number} [deltaY] */
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

/**
 * @param {number} direction
 * @param {string} [axis]
 * @param {{preservePointerInteraction?:boolean, resetViewOnPageTurn?:boolean}} [options]
 */
function getViewerPageTurnNavigationOptions(direction, axis = "y", options = {}) {
  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  const preservePointerInteraction = options.preservePointerInteraction === true;
  const shouldResetView = options.resetViewOnPageTurn === true && !isAutoViewerZoom();

  if (shouldResetView) {
    return {
      keepZoom: false,
      resetZoom: true,
      resetPosition: true,
      positionMode: "auto",
      preservePointerInteraction
    };
  }

  return {
    keepZoom: true,
    positionMode: "page-turn",
    pageTurnDirection: step,
    pageTurnAxis: axis === "x" ? "x" : "y",
    preservePointerInteraction
  };
}

/**
 * @param {number} direction
 * @param {string} [axis]
 * @param {{preservePointerInteraction?:boolean, resetViewOnPageTurn?:boolean}} [options]
 */
function moveLightboxFromPageTurn(direction, axis = "y", options = {}) {
  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (!step || !canMoveLightbox(step)) return false;

  moveLightbox(step, getViewerPageTurnNavigationOptions(step, axis, options));
  return true;
}

/**
 * @param {number} [deltaX]
 * @param {number} [deltaY]
 * @param {{pointerId?:number, resetViewOnPageTurn?:boolean}} [options]
 */
function consumeSingleViewerBoundaryInput(deltaX = 0, deltaY = 0, options = {}) {
  const result = consumeSingleViewerPanInput(deltaX, deltaY);
  if (!result) return { handled: false, turned: false, moved: false };

  const intent = getSingleViewerPageTurnIntent(result, deltaX, deltaY);
  const turned = Boolean(intent && moveLightboxFromPageTurn(intent.direction, intent.axis, {
    preservePointerInteraction: Number.isFinite(options.pointerId),
    resetViewOnPageTurn: options.resetViewOnPageTurn === true
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

  if (singleViewerUsesBoundaryPan()) {
    clearViewerPageWheelGesture();
    consumeSingleViewerBoundaryInput(deltaX, deltaY, { resetViewOnPageTurn: true });
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
    setViewerNavigationPosition(
      targetPosition,
      getViewerPageTurnNavigationOptions(
        direction,
        Math.abs(deltaY) >= Math.abs(deltaX) ? "y" : "x",
        { resetViewOnPageTurn: true }
      )
    );
  }

  window.clearTimeout(viewerState.viewerPageWheelSettleTimer);
  viewerState.viewerPageWheelSettleTimer = window.setTimeout(
    settleViewerPageWheelGesture,
    VIEWER_PAGE_WHEEL_SETTLE_MS
  );
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
    getViewerPageTurnNavigationOptions,
    moveLightboxFromPageTurn,
    consumeSingleViewerBoundaryInput,
    handleViewerPageWheel
  });
}
/* TEST-ONLY EXPORTS: END */

export { clearViewerPageWheelGesture, consumeSingleViewerBoundaryInput, handleViewerPageWheel, moveLightboxFromPageTurn, retryCurrentViewerImage };
