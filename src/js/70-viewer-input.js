/**
 * Source module: 70-viewer-input.js
 * Viewer input boundary: pointer pan/pinch, wheel zoom/page turns, double-click/tap, and discrete swipes.
 *
 * Keeping raw input translation separate from viewer rendering makes interaction changes
 * testable without mixing them into page loading, layout, or route behavior.
 */

import { getFeatureInterface } from "./10-app-state.js";
import { DOUBLE_TAP_DELAY, DOUBLE_TAP_DISTANCE, TAP_MOVE_TOLERANCE, VIEWER_PAGE_SWIPE_AXIS_RATIO, VIEWER_PAGE_SWIPE_MIN_DISTANCE, VIEWER_PAGE_TURN_REMAINDER_EPSILON, VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS, VIEWER_TOUCH_MOMENTUM_MAX_FRAME_MS, VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS, VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS, VIEWER_TOUCH_VELOCITY_BLEND, VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS, viewerElements, viewerState } from "./16-viewer-state.js";
import { clampValue, isTouchLikePointer } from "./20-shared-ui.js";
import { eventTargetElement } from "./02-dom-contracts.js";
import { hideLightboxSearchResults } from "./50-search-ui.js";
import { isViewerSessionOpen } from "./52-viewer-session.js";
import { getPointerList, pointerDistance, pointerMidpoint, setZoom, singleViewerUsesBoundaryPan, toggleZoomAtPoint } from "./54-viewer-geometry.js";
import { normalizeWheelDeltaToPixels } from "./56-viewer-shell.js";
import { consumeSingleViewerBoundaryInput, handleViewerPageWheel } from "./58-viewer-navigation.js";
import { moveLightbox } from "./60-viewer.js";

/** @param {EventTarget|null} surface */
function getZoomSurfaceName(surface) {
  return surface === viewerElements.stageCanvas ? "catalog-page" : "";
}

/** @param {EventTarget|null} surface */
function isActiveZoomSurface(surface) {
  return Boolean(getZoomSurfaceName(surface));
}

/** @param {EventTarget|null} surface @param {number} pointerId */
function captureViewerPointer(surface, pointerId) {
  if (!surface || !("setPointerCapture" in surface) || typeof surface.setPointerCapture !== "function") {
    return false;
  }

  try {
    surface.setPointerCapture(pointerId);
    return true;
  } catch (error) {
    // Synthetic pointer events and a pointer that ended during a browser-driven
    // transition may not be eligible for capture. The gesture remains usable
    // without capture, so only suppress the expected lifecycle exception.
    if (error && typeof error === "object" && "name" in error && error.name === "NotFoundError") {
      return false;
    }
    throw error;
  }
}

/** @param {EventTarget|null} surface @param {number} pointerId */
function releaseViewerPointerCapture(surface, pointerId) {
  if (!surface || !("releasePointerCapture" in surface) || typeof surface.releasePointerCapture !== "function") {
    return false;
  }

  try {
    if ("hasPointerCapture" in surface
      && typeof surface.hasPointerCapture === "function"
      && !surface.hasPointerCapture(pointerId)) {
      return false;
    }
    surface.releasePointerCapture(pointerId);
    return true;
  } catch (error) {
    // Pointer capture can be released implicitly before pointerup/pointercancel
    // reaches this handler. That is a normal browser lifecycle race, not an app
    // failure. Preserve unexpected exceptions so real defects remain visible.
    if (error && typeof error === "object" && "name" in error && error.name === "NotFoundError") {
      return false;
    }
    throw error;
  }
}

/** @param {PointerEvent} event */
function getViewerPointerEventTime(event) {
  const eventTime = Number(event?.timeStamp);
  if (Number.isFinite(eventTime) && eventTime > 0) return eventTime;
  return Date.now();
}

function stopViewerTouchMomentum() {
  if (viewerState.viewerTouchMomentumRaf) {
    window.cancelAnimationFrame(viewerState.viewerTouchMomentumRaf);
  }
  viewerState.viewerTouchMomentumRaf = 0;
  viewerState.viewerTouchMomentumVelocityX = 0;
  viewerState.viewerTouchMomentumVelocityY = 0;
  viewerState.viewerTouchMomentumLastTime = 0;
}

/** @param {PointerEvent} event */
function getViewerPointerMoveSamples(event) {
  /** @type {PointerEvent[]} */
  let samples = [];
  if (typeof event?.getCoalescedEvents === "function") {
    try {
      const coalesced = event.getCoalescedEvents();
      if (Array.isArray(coalesced)) samples = coalesced.filter(Boolean);
    } catch (_error) {
      // Some browser/device combinations expose the method but reject calls
      // outside their native dispatch path. The primary event is sufficient.
    }
  }

  const finalSample = samples[samples.length - 1];
  if (
    !finalSample
    || finalSample.clientX !== event.clientX
    || finalSample.clientY !== event.clientY
  ) {
    samples.push(event);
  }
  return samples;
}

/** @param {ViewerPointerPoint} point @param {number} deltaX @param {number} deltaY @param {number} sampleTime */
function updateViewerPointerVelocity(point, deltaX, deltaY, sampleTime) {
  const elapsed = sampleTime - point.lastTime;
  const safeElapsed = Number.isFinite(elapsed) && elapsed > 0
    ? Math.min(elapsed, VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS)
    : 16.67;
  const instantVelocityX = deltaX / safeElapsed;
  const instantVelocityY = deltaY / safeElapsed;
  const sampleIsFresh = Number.isFinite(elapsed)
    && elapsed > 0
    && elapsed <= VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS;
  const previousWeight = sampleIsFresh ? 1 - VIEWER_TOUCH_VELOCITY_BLEND : 0;
  const nextWeight = sampleIsFresh ? VIEWER_TOUCH_VELOCITY_BLEND : 1;

  return {
    velocityX: (Number(point.velocityX) || 0) * previousWeight + instantVelocityX * nextWeight,
    velocityY: (Number(point.velocityY) || 0) * previousWeight + instantVelocityY * nextWeight,
    lastTime: sampleTime
  };
}

/**
 * @param {PointerEvent} event
 * @param {ViewerPointerPoint} initialPoint
 * @returns {{point:ViewerPointerPoint, handled:boolean, moved:boolean, turned:boolean}}
 */
/** @param {PointerEvent} event @param {ViewerPointerPoint} initialPoint */
function consumeViewerPointerPanSamples(event, initialPoint) {
  let point = initialPoint;
  let totalDeltaX = 0;
  let totalDeltaY = 0;

  for (const sample of getViewerPointerMoveSamples(event)) {
    const x = Number(sample.clientX);
    const y = Number(sample.clientY);
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

    const deltaX = point.x - x;
    const deltaY = point.y - y;
    if (Math.abs(deltaX) < 0.01 && Math.abs(deltaY) < 0.01) continue;

    const sampleTime = getViewerPointerEventTime(sample);
    const velocity = updateViewerPointerVelocity(point, deltaX, deltaY, sampleTime);
    totalDeltaX += deltaX;
    totalDeltaY += deltaY;
    point = {
      ...point,
      x,
      y,
      ...velocity
    };
  }

  viewerState.pointers.set(event.pointerId, point);
  if (Math.abs(totalDeltaX) < 0.01 && Math.abs(totalDeltaY) < 0.01) {
    return { point, handled: false, moved: false, turned: false };
  }

  const boundary = consumeSingleViewerBoundaryInput(totalDeltaX, totalDeltaY, {
    pointerId: event.pointerId
  });
  return {
    point,
    handled: boundary.handled,
    moved: boundary.moved,
    turned: boundary.turned
  };
}

/** @param {number} velocityX @param {number} velocityY */
function clampViewerTouchMomentumVelocity(velocityX, velocityY) {
  const safeVelocityX = Number.isFinite(velocityX) ? velocityX : 0;
  const safeVelocityY = Number.isFinite(velocityY) ? velocityY : 0;
  const speed = Math.hypot(safeVelocityX, safeVelocityY);
  if (speed <= VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS) {
    return { velocityX: safeVelocityX, velocityY: safeVelocityY };
  }

  const scale = VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS / speed;
  return {
    velocityX: safeVelocityX * scale,
    velocityY: safeVelocityY * scale
  };
}

function scheduleViewerTouchMomentumFrame() {
  viewerState.viewerTouchMomentumRaf = window.requestAnimationFrame(runViewerTouchMomentumFrame);
}

/** @param {number} timestamp */
function runViewerTouchMomentumFrame(timestamp) {
  viewerState.viewerTouchMomentumRaf = 0;
  if (
    !isViewerSessionOpen()
    || viewerState.pointers.size > 0
    || !singleViewerUsesBoundaryPan()
  ) {
    stopViewerTouchMomentum();
    return;
  }

  const frameTime = Number(timestamp);
  if (!Number.isFinite(frameTime)) {
    stopViewerTouchMomentum();
    return;
  }
  if (!viewerState.viewerTouchMomentumLastTime) {
    viewerState.viewerTouchMomentumLastTime = frameTime;
    scheduleViewerTouchMomentumFrame();
    return;
  }

  const elapsed = clampValue(
    frameTime - viewerState.viewerTouchMomentumLastTime,
    1,
    VIEWER_TOUCH_MOMENTUM_MAX_FRAME_MS
  );
  viewerState.viewerTouchMomentumLastTime = frameTime;

  let velocityX = viewerState.viewerTouchMomentumVelocityX;
  let velocityY = viewerState.viewerTouchMomentumVelocityY;
  const boundary = consumeSingleViewerBoundaryInput(
    velocityX * elapsed,
    velocityY * elapsed
  );
  if (!boundary.handled) {
    stopViewerTouchMomentum();
    return;
  }

  const remainingDeltaX = boundary.result?.remainingDeltaX || 0;
  const remainingDeltaY = boundary.result?.remainingDeltaY || 0;
  if (
    Math.abs(remainingDeltaX) > VIEWER_PAGE_TURN_REMAINDER_EPSILON
    && Math.sign(remainingDeltaX) === Math.sign(velocityX)
  ) {
    velocityX = 0;
  }
  if (
    !boundary.turned
    && Math.abs(remainingDeltaY) > VIEWER_PAGE_TURN_REMAINDER_EPSILON
    && Math.sign(remainingDeltaY) === Math.sign(velocityY)
  ) {
    velocityY = 0;
  }

  const decay = Math.exp(-VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS * elapsed);
  velocityX *= decay;
  velocityY *= decay;
  if (Math.abs(velocityX) < VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS) velocityX = 0;
  if (Math.abs(velocityY) < VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS) velocityY = 0;

  viewerState.viewerTouchMomentumVelocityX = velocityX;
  viewerState.viewerTouchMomentumVelocityY = velocityY;
  if (!velocityX && !velocityY) {
    stopViewerTouchMomentum();
    return;
  }
  scheduleViewerTouchMomentumFrame();
}

/** @param {number} velocityX @param {number} velocityY */
function startViewerTouchMomentum(velocityX, velocityY) {
  stopViewerTouchMomentum();
  const velocity = clampViewerTouchMomentumVelocity(velocityX, velocityY);
  if (
    Math.hypot(velocity.velocityX, velocity.velocityY)
    < VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS
  ) {
    return false;
  }

  viewerState.viewerTouchMomentumVelocityX = velocity.velocityX;
  viewerState.viewerTouchMomentumVelocityY = velocity.velocityY;
  scheduleViewerTouchMomentumFrame();
  return true;
}

/** @param {PointerEvent} event */
function startPointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;

  stopViewerTouchMomentum();

  if (viewerState.pointers.size === 0) {
    viewerState.pointerGestureHadMultiplePointers = false;
    viewerState.pointerGestureConsumedPan = false;
  }

  viewerState.pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    velocityX: 0,
    velocityY: 0,
    lastTime: getViewerPointerEventTime(event)
  });
  if (viewerState.pointers.size >= 2) viewerState.pointerGestureHadMultiplePointers = true;

  if (singleViewerUsesBoundaryPan() || viewerState.pointers.size >= 2) {
    captureViewerPointer(event.currentTarget, event.pointerId);
  }

  const pointers = getPointerList();
  if (pointers.length === 1) {
    viewerState.dragStartX = event.clientX;
    viewerState.dragStartY = event.clientY;
    viewerState.dragStartPanX = viewerState.panX;
    viewerState.dragStartPanY = viewerState.panY;
  } else if (pointers.length === 2) {
    const [first, second] = pointers;
    const mid = pointerMidpoint(first, second);
    viewerState.pinchStartDistance = Math.max(1, pointerDistance(first, second));
    viewerState.pinchStartZoom = viewerState.zoom;
    viewerState.pinchLastMidX = mid.x;
    viewerState.pinchLastMidY = mid.y;
    for (const pointerId of viewerState.pointers.keys()) {
      captureViewerPointer(event.currentTarget, pointerId);
    }
    event.preventDefault();
  }
}

/** @param {PointerEvent} event */
function movePointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;

  const previousPoint = viewerState.pointers.get(event.pointerId);
  if (!previousPoint) return;
  const pointerCount = viewerState.pointers.size;

  if (pointerCount >= 2) {
    viewerState.pointers.set(event.pointerId, {
      ...previousPoint,
      x: event.clientX,
      y: event.clientY,
      lastTime: getViewerPointerEventTime(event),
      velocityX: 0,
      velocityY: 0
    });
    const pointers = getPointerList();
    event.preventDefault();
    viewerState.pointerGestureConsumedPan = true;
    const [first, second] = pointers;
    const distance = Math.max(1, pointerDistance(first, second));
    const mid = pointerMidpoint(first, second);
    viewerState.panX += mid.x - viewerState.pinchLastMidX;
    viewerState.panY += mid.y - viewerState.pinchLastMidY;
    viewerState.pinchLastMidX = mid.x;
    viewerState.pinchLastMidY = mid.y;
    setZoom(viewerState.pinchStartZoom * (distance / viewerState.pinchStartDistance), {
      showUi: false,
      focalClientX: mid.x,
      focalClientY: mid.y
    });
    return;
  }

  if (pointerCount === 1 && singleViewerUsesBoundaryPan()) {
    event.preventDefault();
    const pan = consumeViewerPointerPanSamples(event, previousPoint);
    // Once a pannable/zoomed surface owns a real one-finger movement, the
    // release must not fall through to the separate page-swipe recognizer.
    // This remains true at a clamped horizontal safety edge where no pixels move.
    if (pan.handled) viewerState.pointerGestureConsumedPan = true;
  }
}

/** @param {PointerEvent} event @param {number} startedX @param {number} startedY */
function handlePotentialDoubleTap(event, startedX, startedY) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return false;
  if (viewerState.pointers.size > 0 || viewerState.pointerGestureConsumedPan) return false;

  const moved = Math.hypot(event.clientX - startedX, event.clientY - startedY);
  if (moved > TAP_MOVE_TOLERANCE) {
    viewerState.lastTapAt = 0;
    return false;
  }

  const now = Date.now();
  const surface = getZoomSurfaceName(event.currentTarget);
  const closeToLastTap = Math.hypot(event.clientX - viewerState.lastTapX, event.clientY - viewerState.lastTapY) <= DOUBLE_TAP_DISTANCE;
  const isDoubleTap =
    surface === viewerState.lastTapSurface
    && now - viewerState.lastTapAt <= DOUBLE_TAP_DELAY
    && closeToLastTap;

  viewerState.lastTapAt = now;
  viewerState.lastTapX = event.clientX;
  viewerState.lastTapY = event.clientY;
  viewerState.lastTapSurface = surface;

  if (!isDoubleTap) return false;

  event.preventDefault();
  viewerState.lastTapAt = 0;
  viewerState.suppressNextDblClickUntil = now + 550;
  toggleZoomAtPoint(event.clientX, event.clientY);
  return true;
}

/** @param {PointerEvent} event @param {number} startedX @param {number} startedY */
function handleViewerPageSwipe(event, startedX, startedY) {
  if (!isTouchLikePointer(event)) return false;
  if (viewerState.pointers.size > 0 || viewerState.pointerGestureHadMultiplePointers || viewerState.pointerGestureConsumedPan) return false;

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

/** @param {PointerEvent} event */
function endPointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;
  let tracked = viewerState.pointers.get(event.pointerId);
  if (!tracked) return;
  if (
    viewerState.pointers.size === 1
    && singleViewerUsesBoundaryPan()
    && (
      Math.abs(tracked.x - event.clientX) >= 0.01
      || Math.abs(tracked.y - event.clientY) >= 0.01
    )
  ) {
    event.preventDefault();
    const finalPan = consumeViewerPointerPanSamples(event, tracked);
    tracked = finalPan.point;
    if (finalPan.handled) viewerState.pointerGestureConsumedPan = true;
  }
  const releaseTime = getViewerPointerEventTime(event);
  const velocityAge = releaseTime - tracked.lastTime;
  const velocityIsFresh = velocityAge >= 0 && velocityAge <= VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS;
  const shouldStartMomentum = Boolean(
    isTouchLikePointer(event)
    && viewerState.pointers.size === 1
    && !viewerState.pointerGestureHadMultiplePointers
    && viewerState.pointerGestureConsumedPan
    && velocityIsFresh
  );
  viewerState.pointers.delete(event.pointerId);

  const handledDoubleTap = handlePotentialDoubleTap(event, tracked.startX, tracked.startY);
  if (!handledDoubleTap) handleViewerPageSwipe(event, tracked.startX, tracked.startY);

  const pointers = getPointerList();
  if (pointers.length === 1) {
    const only = pointers[0];
    viewerState.dragStartX = only.x;
    viewerState.dragStartY = only.y;
    viewerState.dragStartPanX = viewerState.panX;
    viewerState.dragStartPanY = viewerState.panY;
  } else if (pointers.length === 0) {
    viewerState.pointerGestureHadMultiplePointers = false;
    viewerState.pointerGestureConsumedPan = false;
  }
  releaseViewerPointerCapture(event.currentTarget, event.pointerId);
  if (shouldStartMomentum) {
    startViewerTouchMomentum(tracked.velocityX, tracked.velocityY);
  }
}

/** @param {PointerEvent} event */
function cancelPointerInteraction(event) {
  if (!viewerState.pointers.has(event.pointerId)) return;
  viewerState.pointers.delete(event.pointerId);
  if (viewerState.pointers.size === 0) {
    viewerState.pointerGestureHadMultiplePointers = false;
    viewerState.pointerGestureConsumedPan = false;
    stopViewerTouchMomentum();
  }
}

/** @param {WheelEvent} event */
function getWheelZoomFactor(event) {
  const pixelMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PIXEL : 0;
  const lineMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_LINE : 1;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;
  const rawDelta = Number(event.deltaY);
  const currentTarget = event.currentTarget;
  const pageSize = currentTarget && "clientHeight" in currentTarget
    ? Number(currentTarget.clientHeight) || 0
    : 0;
  const delta = normalizeWheelDeltaToPixels(rawDelta, event.deltaMode, pageSize);
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

/** @param {WheelEvent} event */
function handleZoomSurfaceWheel(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;

  stopViewerTouchMomentum();

  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    event.stopPropagation();
    const factor = getWheelZoomFactor(event);
    if (factor === 1) return;
    setZoom(viewerState.zoom * factor, {
      showUi: false,
      focalClientX: event.clientX,
      focalClientY: event.clientY
    });
    return;
  }

  handleViewerPageWheel(event);
}

/** @param {MouseEvent} event */
function handleZoomSurfaceDoubleClick(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;
  if (Date.now() < viewerState.suppressNextDblClickUntil) return;

  event.preventDefault();
  event.stopPropagation();
  toggleZoomAtPoint(event.clientX, event.clientY);
}

/** @param {HTMLElement} surface */
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
  attachZoomSurfaceGestures(viewerElements.stageCanvas);
}

/** @param {EventTarget|null} target */
function isLightboxTopInteractiveTarget(target) {
  const element = eventTargetElement(target);
  if (!element) return false;

  const interactiveTarget = element.closest(
    ".lightbox-reader-header, .lightbox-search-results, .reader-catalog-menu, .reader-search-scope-menu"
  );
  return Boolean(interactiveTarget && viewerElements.lightboxBar?.contains(interactiveTarget));
}

/** @param {PointerEvent} event */
function hideLightboxTopSearchFromViewerInteraction(event) {
  if (!isViewerSessionOpen()) return false;
  if (event?.button !== undefined && event.button !== 0) return false;
  if (isLightboxTopInteractiveTarget(event?.target)) return false;

  if (getFeatureInterface("search")?.isLightboxMobileOpen?.()) {
    getFeatureInterface("search")?.setLightboxMobileOpen?.(false, { hideResults: true, hideTopUi: true });
  } else {
    hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi: true });
  }
  return true;
}

/** @param {PointerEvent} event */
function handleViewerSurfacePointerDown(event) {
  hideLightboxTopSearchFromViewerInteraction(event);
}

/** @param {PointerEvent} event */
function handleLightboxPointerDownCapture(event) {
  stopViewerTouchMomentum();
  hideLightboxTopSearchFromViewerInteraction(event);
}

/* TEST-ONLY EXPORTS: BEGIN */
if (typeof __BARGIG_TEST_EXPORTS__ !== "undefined") {
  __BARGIG_TEST_EXPORTS__["viewer-input"] = Object.freeze({
    captureViewerPointer,
    releaseViewerPointerCapture,
    getViewerPointerEventTime,
    stopViewerTouchMomentum,
    getViewerPointerMoveSamples,
    updateViewerPointerVelocity,
    consumeViewerPointerPanSamples,
    clampViewerTouchMomentumVelocity,
    runViewerTouchMomentumFrame,
    startViewerTouchMomentum,
    getWheelZoomFactor,
    handleZoomSurfaceWheel
  });
}
/* TEST-ONLY EXPORTS: END */

export { attachViewerGestures, handleLightboxPointerDownCapture, handleViewerSurfacePointerDown, stopViewerTouchMomentum };
