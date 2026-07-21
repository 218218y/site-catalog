/**
 * Source module: 70-viewer-input.js
 * Viewer input boundary: pointer pan/pinch, wheel zoom/page turns, double-click/tap, and discrete swipes.
 *
 * Keeping raw input translation separate from viewer rendering makes interaction changes
 * testable without mixing them into page loading, layout, or route behavior.
 */

function getZoomSurfaceName(surface) {
  return surface === els.stageCanvas ? "catalog-page" : "";
}

function isActiveZoomSurface(surface) {
  return Boolean(getZoomSurfaceName(surface));
}

function startPointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;

  if (state.pointers.size === 0) {
    state.pointerGestureHadMultiplePointers = false;
    state.pointerGestureConsumedPan = false;
    state.singlePageTurnPointerId = null;
  }

  state.pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY
  });
  if (state.pointers.size >= 2) state.pointerGestureHadMultiplePointers = true;

  if (singleViewerUsesBoundaryPan() || state.pointers.size >= 2) {
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
    for (const pointerId of state.pointers.keys()) {
      event.currentTarget.setPointerCapture?.(pointerId);
    }
    event.preventDefault();
  }
}

function movePointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;

  if (state.singlePageTurnPointerId === event.pointerId) {
    event.preventDefault();
    return;
  }

  const previousPoint = state.pointers.get(event.pointerId);
  if (!previousPoint) return;
  state.pointers.set(event.pointerId, {
    ...previousPoint,
    x: event.clientX,
    y: event.clientY
  });
  const pointers = getPointerList();

  if (pointers.length >= 2) {
    event.preventDefault();
    state.pointerGestureConsumedPan = true;
    const [first, second] = pointers;
    const distance = Math.max(1, pointerDistance(first, second));
    const mid = pointerMidpoint(first, second);
    state.panX += mid.x - state.pinchLastMidX;
    state.panY += mid.y - state.pinchLastMidY;
    state.pinchLastMidX = mid.x;
    state.pinchLastMidY = mid.y;
    setZoom(state.pinchStartZoom * (distance / state.pinchStartDistance), {
      showUi: false,
      focalClientX: mid.x,
      focalClientY: mid.y
    });
    return;
  }

  if (pointers.length === 1 && singleViewerUsesBoundaryPan()) {
    event.preventDefault();
    const deltaX = previousPoint.x - event.clientX;
    const deltaY = previousPoint.y - event.clientY;
    const boundary = consumeSingleViewerBoundaryInput(deltaX, deltaY, {
      pointerId: event.pointerId
    });
    if (boundary.moved || boundary.turned) state.pointerGestureConsumedPan = true;
  }
}

function handlePotentialDoubleTap(event, startedX, startedY) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return false;
  if (state.pointers.size > 0 || state.pointerGestureConsumedPan) return false;

  const moved = Math.hypot(event.clientX - startedX, event.clientY - startedY);
  if (moved > TAP_MOVE_TOLERANCE) {
    state.lastTapAt = 0;
    return false;
  }

  const now = Date.now();
  const surface = getZoomSurfaceName(event.currentTarget);
  const closeToLastTap = Math.hypot(event.clientX - state.lastTapX, event.clientY - state.lastTapY) <= DOUBLE_TAP_DISTANCE;
  const isDoubleTap =
    surface === state.lastTapSurface
    && now - state.lastTapAt <= DOUBLE_TAP_DELAY
    && closeToLastTap;

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
  if (!isTouchLikePointer(event)) return false;
  if (state.pointers.size > 0 || state.pointerGestureHadMultiplePointers || state.pointerGestureConsumedPan) return false;

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
  if (state.singlePageTurnPointerId === event.pointerId) {
    state.singlePageTurnPointerId = null;
    state.pointers.delete(event.pointerId);
    event.preventDefault?.();
    event.currentTarget?.releasePointerCapture?.(event.pointerId);
    if (state.pointers.size === 0) {
      state.pointerGestureHadMultiplePointers = false;
      state.pointerGestureConsumedPan = false;
    }
    return;
  }

  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;
  const tracked = state.pointers.get(event.pointerId);
  if (!tracked) return;
  state.pointers.delete(event.pointerId);

  const handledDoubleTap = handlePotentialDoubleTap(event, tracked.startX, tracked.startY);
  if (!handledDoubleTap) handleViewerPageSwipe(event, tracked.startX, tracked.startY);

  const pointers = getPointerList();
  if (pointers.length === 1) {
    const only = pointers[0];
    state.dragStartX = only.x;
    state.dragStartY = only.y;
    state.dragStartPanX = state.panX;
    state.dragStartPanY = state.panY;
  } else if (pointers.length === 0) {
    state.pointerGestureHadMultiplePointers = false;
    state.pointerGestureConsumedPan = false;
  }
  event.currentTarget?.releasePointerCapture?.(event.pointerId);
}

function cancelPointerInteraction(event) {
  if (state.singlePageTurnPointerId === event.pointerId) state.singlePageTurnPointerId = null;
  if (!state.pointers.has(event.pointerId)) return;
  state.pointers.delete(event.pointerId);
  if (state.pointers.size === 0) {
    state.pointerGestureHadMultiplePointers = false;
    state.pointerGestureConsumedPan = false;
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

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    event.stopPropagation();
    const factor = getWheelZoomFactor(event);
    if (factor === 1) return;
    setZoom(state.zoom * factor, {
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
  if (Date.now() < state.suppressNextDblClickUntil) return;

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
}

function isLightboxTopInteractiveTarget(target) {
  if (!target || typeof target.closest !== "function") return false;

  const interactiveTarget = target.closest(
    ".lightbox-reader-header, .lightbox-search-results, .reader-catalog-menu, .reader-search-scope-menu"
  );
  return Boolean(interactiveTarget && els.lightboxBar?.contains(interactiveTarget));
}

function hideLightboxTopSearchFromViewerInteraction(event) {
  if (!isViewerSessionOpen()) return false;
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
