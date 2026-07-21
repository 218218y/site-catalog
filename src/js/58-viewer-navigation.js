/**
 * Source module: 58-viewer-navigation.js
 * Paged-viewer wheel normalization, edge overscroll, and page-turn command handling.
 *
 * This module translates wheel, trackpad, and boundary-pan intent into the
 * same paged navigation contract used by buttons, keyboard, and touch input.
 */

function retryCurrentViewerImage() {
  if (!isViewerSessionOpen() || !state.catalog) return;
  const request = viewerPageImageRequest(state.catalog, state.page);
  showSingleLightboxImage(state.catalog, state.page, request.primarySrc, {
    imageRequest: request,
    forceRefresh: true
  });
}

function getViewerNavigationPosition() {
  return isFavoritesLightboxMode() ? state.favoritesViewerIndex : state.page - 1;
}

function getViewerNavigationMaximumPosition() {
  if (isFavoritesLightboxMode()) return Math.max(0, getFavoriteEntries().length - 1);
  return Math.max(0, (state.catalog?.pages || 1) - 1);
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
  window.clearTimeout(state.viewerPageWheelSettleTimer);
  state.viewerPageWheelSettleTimer = 0;
  state.viewerPageWheelAccumulator = 0;
  state.viewerPageWheelBasePage = 0;
  state.viewerPageWheelTargetPage = 0;
}

function unlockViewerPageWheel() {
  window.clearTimeout(state.viewerPageWheelUnlockTimer);
  state.viewerPageWheelUnlockTimer = 0;
  state.viewerPageWheelLocked = false;
}

function keepViewerPageWheelLockedUntilSettle() {
  state.viewerPageWheelLocked = true;
  window.clearTimeout(state.viewerPageWheelUnlockTimer);
  state.viewerPageWheelUnlockTimer = window.setTimeout(
    unlockViewerPageWheel,
    VIEWER_PAGE_WHEEL_SETTLE_MS
  );
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
      event?.currentTarget?.clientWidth || els.stageCanvas?.clientWidth || 0
    ),
    deltaY: normalizeViewerPageWheelAxisDelta(
      event?.deltaY,
      event?.deltaMode,
      event?.currentTarget?.clientHeight || els.stageCanvas?.clientHeight || 0
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
  const preferVertical = Math.abs(deltaY) >= Math.abs(deltaX);
  const axis = preferVertical ? "y" : "x";
  const remaining = axis === "y" ? result.remainingDeltaY : result.remainingDeltaX;
  if (Math.abs(remaining) <= VIEWER_PAGE_TURN_REMAINDER_EPSILON) return null;

  return {
    axis,
    direction: axis === "y" ? Math.sign(remaining) : -Math.sign(remaining)
  };
}

function moveLightboxFromPageTurn(direction, axis = "y") {
  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (!step || !canMoveLightbox(step)) return false;

  moveLightbox(step, {
    keepZoom: true,
    positionMode: "page-turn",
    pageTurnDirection: step,
    pageTurnAxis: axis
  });
  return true;
}

function consumeSingleViewerBoundaryInput(deltaX = 0, deltaY = 0, options = {}) {
  const result = consumeSingleViewerPanInput(deltaX, deltaY);
  if (!result) return { handled: false, turned: false, moved: false };

  const intent = getSingleViewerPageTurnIntent(result, deltaX, deltaY);
  const turned = Boolean(intent && moveLightboxFromPageTurn(intent.direction, intent.axis));
  if (turned && Number.isFinite(options.pointerId)) {
    state.singlePageTurnPointerId = options.pointerId;
  }

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
  if (!isViewerSessionOpen() || !state.catalog) return false;

  const { deltaX, deltaY } = normalizeViewerPageWheelDeltas(event);
  if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) return false;

  event.preventDefault();

  if (state.viewerPageWheelLocked) {
    keepViewerPageWheelLockedUntilSettle();
    return true;
  }

  if (singleViewerUsesBoundaryPan()) {
    clearViewerPageWheelGesture();
    const boundary = consumeSingleViewerBoundaryInput(deltaX, deltaY);
    if (boundary.turned) keepViewerPageWheelLockedUntilSettle();
    return true;
  }

  const logicalDelta = getViewerPageWheelLogicalDelta(deltaX, deltaY);
  if (Math.abs(logicalDelta) < 0.01) return true;

  const gestureStarted = !state.viewerPageWheelBasePage;
  if (gestureStarted) {
    const currentPosition = getViewerNavigationPosition();
    // Store one-based values so zero remains the explicit "no gesture" sentinel.
    state.viewerPageWheelBasePage = currentPosition + 1;
    state.viewerPageWheelTargetPage = currentPosition + 1;
    state.viewerPageWheelAccumulator = 0;
  }

  state.viewerPageWheelAccumulator += logicalDelta;
  const requestedSteps = getViewerPageWheelRequestedSteps(state.viewerPageWheelAccumulator);
  const basePosition = state.viewerPageWheelBasePage - 1;
  const targetPosition = clampValue(
    basePosition + requestedSteps,
    0,
    getViewerNavigationMaximumPosition()
  );
  const previousTargetPosition = state.viewerPageWheelTargetPage - 1;
  state.viewerPageWheelTargetPage = targetPosition + 1;

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

  window.clearTimeout(state.viewerPageWheelSettleTimer);
  state.viewerPageWheelSettleTimer = window.setTimeout(
    settleViewerPageWheelGesture,
    VIEWER_PAGE_WHEEL_SETTLE_MS
  );
  return true;
}
