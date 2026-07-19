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

function clearViewerScrollPointerHandoff() {
  const handoff = state.viewerScrollPointerHandoff;
  if (handoff?.raf) cancelAnimationFrame(handoff.raf);
  state.viewerScrollPointerHandoff = null;
  els.lightbox?.classList.remove("viewer-touch-handoff-active");
}

function flushViewerScrollPointerHandoff() {
  const handoff = state.viewerScrollPointerHandoff;
  if (!handoff) return;

  handoff.raf = 0;
  const container = els.viewerScrollPages;
  if (!container) return;

  const deltaX = handoff.pendingX;
  const deltaY = handoff.pendingY;
  handoff.pendingX = 0;
  handoff.pendingY = 0;
  if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) return;

  container.scrollBy({
    left: deltaX,
    top: deltaY,
    behavior: "auto"
  });
}

function scheduleViewerScrollPointerHandoffFlush() {
  const handoff = state.viewerScrollPointerHandoff;
  if (!handoff || handoff.raf) return;
  handoff.raf = requestAnimationFrame(flushViewerScrollPointerHandoff);
}

function beginViewerScrollPointerHandoff(event, deltaX = 0, deltaY = 0) {
  if (!isTouchLikePointer(event) || !isViewerScrollIsolatedZoom()) return false;

  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const pointerId = event.pointerId;
  const clientX = event.clientX;
  const clientY = event.clientY;

  // The browser chose touch-action:none when this gesture started inside the
  // isolated zoom surface, so native scrolling cannot take over halfway through
  // the same contact. Exit zoom first, then keep forwarding the current pointer
  // stream to the continuous viewer until pointerup.
  exitViewerScrollIsolatedZoom({ restorePage: true, nextZoom: AUTO_VIEWER_ZOOM });
  state.viewerScrollPointerHandoff = {
    pointerId,
    lastX: clientX,
    lastY: clientY,
    pendingX: safeDeltaX,
    pendingY: safeDeltaY,
    raf: 0
  };
  els.lightbox?.classList.add("viewer-touch-handoff-active");
  scheduleViewerScrollPointerHandoffFlush();
  return true;
}

function continueViewerScrollPointerHandoff(event) {
  const handoff = state.viewerScrollPointerHandoff;
  if (!handoff || handoff.pointerId !== event.pointerId) return false;

  event.preventDefault();
  const deltaX = handoff.lastX - event.clientX;
  const deltaY = handoff.lastY - event.clientY;
  handoff.lastX = event.clientX;
  handoff.lastY = event.clientY;
  if (Number.isFinite(deltaX)) handoff.pendingX += deltaX;
  if (Number.isFinite(deltaY)) handoff.pendingY += deltaY;
  scheduleViewerScrollPointerHandoffFlush();
  return true;
}

function finishViewerScrollPointerHandoff(event) {
  const handoff = state.viewerScrollPointerHandoff;
  if (!handoff || handoff.pointerId !== event.pointerId) return false;

  event.preventDefault?.();
  if (handoff.raf) {
    cancelAnimationFrame(handoff.raf);
    handoff.raf = 0;
  }
  flushViewerScrollPointerHandoff();
  clearViewerScrollPointerHandoff();
  event.currentTarget?.releasePointerCapture?.(event.pointerId);
  return true;
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
  if (
    isViewerScrollIsolatedZoom()
    || ((!isScrollViewerMode() || isViewerScrollIsolatedZoom()) && viewerCanPan())
    || state.pointers.size >= 2
  ) {
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
  if (continueViewerScrollPointerHandoff(event)) return;
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget) || !state.pointers.has(event.pointerId)) return;
  const previousPoint = state.pointers.get(event.pointerId);
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

  if (pointers.length === 1 && isViewerScrollIsolatedZoom() && isTouchLikePointer(event)) {
    event.preventDefault();
    const scrollDeltaX = previousPoint.x - event.clientX;
    const scrollDeltaY = previousPoint.y - event.clientY;
    const result = consumeViewerScrollIsolatedPan(scrollDeltaX, scrollDeltaY);
    if (result?.hasVerticalExitIntent && Math.abs(result.remainingDeltaY) > 0.75) {
      beginViewerScrollPointerHandoff(event, 0, result.remainingDeltaY);
    }
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
  if (finishViewerScrollPointerHandoff(event)) return;
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
  if (finishViewerScrollPointerHandoff(event)) return;
  if (!state.pointers.has(event.pointerId)) return;
  state.pointers.delete(event.pointerId);
  if (state.pointers.size === 0) state.pointerGestureHadMultiplePointers = false;
}

function getWheelZoomFactor(event) {
  const pixelMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PIXEL : 0;
  const lineMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_LINE : 1;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;
  const rawDelta = Number(event.deltaY);
  const delta = normalizeWheelDeltaToPixels(rawDelta, event.deltaMode, event.currentTarget?.clientHeight || 0);
  if (!Number.isFinite(delta) || Math.abs(delta) < 0.01) return 1;

  // Ctrl+mouse-wheel and a trackpad pinch both arrive as wheel events, but they
  // have very different delta shapes. A discrete mouse detent must advance by a
  // small predictable percentage; precision trackpad input keeps the existing
  // continuous curve. This prevents one ordinary wheel notch from behaving like
  // an entire pinch gesture while preserving smooth laptop-trackpad zoom.
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
  if (!state.lightboxOpen || !isActiveZoomSurface(event.currentTarget)) return;

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    // In scroll layout viewerScrollPages is nested inside stageCanvas. Entering
    // isolated zoom changes which parent surface is active during propagation,
    // so the same physical wheel event would otherwise be handled a second time.
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
