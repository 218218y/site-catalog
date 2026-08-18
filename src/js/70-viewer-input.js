/**
 * Source module: 70-viewer-input.js
 * Viewer input boundary: pointer pan/pinch, wheel zoom/page turns, double-click/tap, and discrete swipes.
 *
 * Keeping raw input translation separate from viewer rendering makes interaction changes
 * testable without mixing them into page loading, layout, or route behavior.
 */

/** @import { ViewerPointerPoint } from "../../types/frontend-contracts.js" */
import { isTouchLikePointer } from "./21-ui-runtime.js";

import { requireFeatureInterface } from "./10-app-state.js";
import { DOUBLE_TAP_DELAY, DOUBLE_TAP_DISTANCE, TAP_MOVE_TOLERANCE, VIEWER_PAGE_SWIPE_AXIS_RATIO, VIEWER_PAGE_SWIPE_MIN_DISTANCE, VIEWER_PAGE_TURN_REMAINDER_EPSILON, VIEWER_TOUCH_MOMENTUM_FRICTION_PER_MS, VIEWER_TOUCH_MOMENTUM_MAX_FRAME_MS, VIEWER_TOUCH_MOMENTUM_MAX_SPEED_PX_PER_MS, VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS, VIEWER_TOUCH_VELOCITY_BLEND, VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS, viewerElements, viewerGestureState, viewerViewportState } from "./16-viewer-state.js";
import { VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN, VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE, VIEWER_NAVIGATION_SOURCE_MOMENTUM, VIEWER_NAVIGATION_SOURCE_VERTICAL_SWIPE, assertViewerStateInvariants, createViewerNavigationCommand } from "./17-viewer-state-transitions.js";
import { clampValue } from "./19-shared-pure.js";
import { eventTargetElement } from "./02-dom-contracts.js";
import { isViewerSessionOpen } from "./51-viewer-session-state.js";
import { getPointerList, normalizeWheelDeltaToPixels, pointerDistance, pointerMidpoint, singleViewerUsesBoundaryPan } from "./54-viewer-geometry.js";
import { setZoom, toggleZoomAtPoint } from "./55-viewer-zoom-controller.js";
import { consumeSingleViewerBoundaryInput, handleViewerPageWheel, moveLightboxFromPageTurn } from "./58-viewer-navigation.js";
import { moveLightbox } from "./59-viewer-page-controller.js";

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
  if (viewerGestureState.viewerTouchMomentumRaf) {
    window.cancelAnimationFrame(viewerGestureState.viewerTouchMomentumRaf);
  }
  viewerGestureState.viewerTouchMomentumRaf = 0;
  viewerGestureState.viewerTouchMomentumVelocityX = 0;
  viewerGestureState.viewerTouchMomentumVelocityY = 0;
  viewerGestureState.viewerTouchMomentumLastTime = 0;
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

  viewerGestureState.pointers.set(event.pointerId, point);
  if (Math.abs(totalDeltaX) < 0.01 && Math.abs(totalDeltaY) < 0.01) {
    return { point, handled: false, moved: false, turned: false };
  }

  const boundary = consumeSingleViewerBoundaryInput(totalDeltaX, totalDeltaY, {
    pointerId: event.pointerId,
    navigationSource: VIEWER_NAVIGATION_SOURCE_BOUNDARY_PAN
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
  viewerGestureState.viewerTouchMomentumRaf = window.requestAnimationFrame(runViewerTouchMomentumFrame);
  assertViewerStateInvariants("schedule-touch-momentum");
}

/** @param {number} timestamp */
function runViewerTouchMomentumFrame(timestamp) {
  viewerGestureState.viewerTouchMomentumRaf = 0;
  if (
    !isViewerSessionOpen()
    || viewerGestureState.pointers.size > 0
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
  if (!viewerGestureState.viewerTouchMomentumLastTime) {
    viewerGestureState.viewerTouchMomentumLastTime = frameTime;
    scheduleViewerTouchMomentumFrame();
    return;
  }

  const elapsed = clampValue(
    frameTime - viewerGestureState.viewerTouchMomentumLastTime,
    1,
    VIEWER_TOUCH_MOMENTUM_MAX_FRAME_MS
  );
  viewerGestureState.viewerTouchMomentumLastTime = frameTime;

  let velocityX = viewerGestureState.viewerTouchMomentumVelocityX;
  let velocityY = viewerGestureState.viewerTouchMomentumVelocityY;
  const boundary = consumeSingleViewerBoundaryInput(
    velocityX * elapsed,
    velocityY * elapsed,
    { navigationSource: VIEWER_NAVIGATION_SOURCE_MOMENTUM }
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

  viewerGestureState.viewerTouchMomentumVelocityX = velocityX;
  viewerGestureState.viewerTouchMomentumVelocityY = velocityY;
  if (!velocityX && !velocityY) {
    stopViewerTouchMomentum();
    return;
  }
  scheduleViewerTouchMomentumFrame();
}

/** @param {number} velocityX @param {number} velocityY */
function startViewerTouchMomentum(velocityX, velocityY) {
  stopViewerTouchMomentum();
  if (viewerGestureState.pointers.size > 0) return false;
  const velocity = clampViewerTouchMomentumVelocity(velocityX, velocityY);
  if (
    Math.hypot(velocity.velocityX, velocity.velocityY)
    < VIEWER_TOUCH_MOMENTUM_MIN_SPEED_PX_PER_MS
  ) {
    return false;
  }

  viewerGestureState.viewerTouchMomentumVelocityX = velocity.velocityX;
  viewerGestureState.viewerTouchMomentumVelocityY = velocity.velocityY;
  scheduleViewerTouchMomentumFrame();
  return true;
}

/** @param {PointerEvent} event */
function startPointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;

  stopViewerTouchMomentum();

  if (viewerGestureState.pointers.size === 0) {
    viewerGestureState.pointerGestureHadMultiplePointers = false;
    viewerGestureState.pointerGestureConsumedPan = false;
  }

  viewerGestureState.pointers.set(event.pointerId, {
    x: event.clientX,
    y: event.clientY,
    startX: event.clientX,
    startY: event.clientY,
    velocityX: 0,
    velocityY: 0,
    lastTime: getViewerPointerEventTime(event)
  });
  if (viewerGestureState.pointers.size >= 2) viewerGestureState.pointerGestureHadMultiplePointers = true;

  if (singleViewerUsesBoundaryPan() || viewerGestureState.pointers.size >= 2) {
    captureViewerPointer(event.currentTarget, event.pointerId);
  }

  const pointers = getPointerList();
  if (pointers.length === 1) {
    viewerGestureState.dragStartX = event.clientX;
    viewerGestureState.dragStartY = event.clientY;
    viewerGestureState.dragStartPanX = viewerViewportState.panX;
    viewerGestureState.dragStartPanY = viewerViewportState.panY;
  } else if (pointers.length === 2) {
    const [first, second] = pointers;
    const mid = pointerMidpoint(first, second);
    viewerGestureState.pinchStartDistance = Math.max(1, pointerDistance(first, second));
    viewerGestureState.pinchStartZoom = viewerViewportState.zoom;
    viewerGestureState.pinchLastMidX = mid.x;
    viewerGestureState.pinchLastMidY = mid.y;
    for (const pointerId of viewerGestureState.pointers.keys()) {
      captureViewerPointer(event.currentTarget, pointerId);
    }
    event.preventDefault();
  }
  assertViewerStateInvariants("start-pointer-interaction");
}

/** @param {PointerEvent} event */
function movePointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;

  const previousPoint = viewerGestureState.pointers.get(event.pointerId);
  if (!previousPoint) return;
  const pointerCount = viewerGestureState.pointers.size;

  if (pointerCount >= 2) {
    viewerGestureState.pointers.set(event.pointerId, {
      ...previousPoint,
      x: event.clientX,
      y: event.clientY,
      lastTime: getViewerPointerEventTime(event),
      velocityX: 0,
      velocityY: 0
    });
    const pointers = getPointerList();
    event.preventDefault();
    viewerGestureState.pointerGestureConsumedPan = true;
    const [first, second] = pointers;
    const distance = Math.max(1, pointerDistance(first, second));
    const mid = pointerMidpoint(first, second);
    viewerViewportState.panX += mid.x - viewerGestureState.pinchLastMidX;
    viewerViewportState.panY += mid.y - viewerGestureState.pinchLastMidY;
    viewerGestureState.pinchLastMidX = mid.x;
    viewerGestureState.pinchLastMidY = mid.y;
    setZoom(viewerGestureState.pinchStartZoom * (distance / viewerGestureState.pinchStartDistance), {
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
    if (pan.handled) viewerGestureState.pointerGestureConsumedPan = true;
  }
}

/** @param {PointerEvent} event @param {number} startedX @param {number} startedY */
function handlePotentialDoubleTap(event, startedX, startedY) {
  if (event.pointerType !== "touch" && event.pointerType !== "pen") return false;
  if (viewerGestureState.pointers.size > 0 || viewerGestureState.pointerGestureConsumedPan) return false;

  const moved = Math.hypot(event.clientX - startedX, event.clientY - startedY);
  if (moved > TAP_MOVE_TOLERANCE) {
    viewerGestureState.lastTapAt = 0;
    return false;
  }

  const now = Date.now();
  const surface = getZoomSurfaceName(event.currentTarget);
  const closeToLastTap = Math.hypot(event.clientX - viewerGestureState.lastTapX, event.clientY - viewerGestureState.lastTapY) <= DOUBLE_TAP_DISTANCE;
  const isDoubleTap =
    surface === viewerGestureState.lastTapSurface
    && now - viewerGestureState.lastTapAt <= DOUBLE_TAP_DELAY
    && closeToLastTap;

  viewerGestureState.lastTapAt = now;
  viewerGestureState.lastTapX = event.clientX;
  viewerGestureState.lastTapY = event.clientY;
  viewerGestureState.lastTapSurface = surface;

  if (!isDoubleTap) return false;

  event.preventDefault();
  viewerGestureState.lastTapAt = 0;
  viewerGestureState.suppressNextDblClickUntil = now + 550;
  toggleZoomAtPoint(event.clientX, event.clientY);
  return true;
}

/** @param {PointerEvent} event @param {number} startedX @param {number} startedY */
function handleViewerPageSwipe(event, startedX, startedY) {
  if (!isTouchLikePointer(event)) return false;
  if (viewerGestureState.pointers.size > 0 || viewerGestureState.pointerGestureHadMultiplePointers || viewerGestureState.pointerGestureConsumedPan) return false;

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
  if (horizontal) {
    moveLightbox(direction, {
      navigationCommand: createViewerNavigationCommand(
        VIEWER_NAVIGATION_SOURCE_HORIZONTAL_SWIPE,
        direction,
        { axis: "x" }
      )
    });
  } else {
    moveLightboxFromPageTurn(direction, "y", { navigationSource: VIEWER_NAVIGATION_SOURCE_VERTICAL_SWIPE });
  }
  return true;
}

/** @param {PointerEvent} event */
function endPointerInteraction(event) {
  if (!isViewerSessionOpen() || !isActiveZoomSurface(event.currentTarget)) return;
  let tracked = viewerGestureState.pointers.get(event.pointerId);
  if (!tracked) return;
  if (
    viewerGestureState.pointers.size === 1
    && singleViewerUsesBoundaryPan()
    && (
      Math.abs(tracked.x - event.clientX) >= 0.01
      || Math.abs(tracked.y - event.clientY) >= 0.01
    )
  ) {
    event.preventDefault();
    const finalPan = consumeViewerPointerPanSamples(event, tracked);
    tracked = finalPan.point;
    if (finalPan.handled) viewerGestureState.pointerGestureConsumedPan = true;
  }
  const releaseTime = getViewerPointerEventTime(event);
  const velocityAge = releaseTime - tracked.lastTime;
  const velocityIsFresh = velocityAge >= 0 && velocityAge <= VIEWER_TOUCH_VELOCITY_SAMPLE_MAX_AGE_MS;
  const shouldStartMomentum = Boolean(
    isTouchLikePointer(event)
    && viewerGestureState.pointers.size === 1
    && !viewerGestureState.pointerGestureHadMultiplePointers
    && viewerGestureState.pointerGestureConsumedPan
    && velocityIsFresh
  );
  viewerGestureState.pointers.delete(event.pointerId);

  const handledDoubleTap = handlePotentialDoubleTap(event, tracked.startX, tracked.startY);
  if (!handledDoubleTap) handleViewerPageSwipe(event, tracked.startX, tracked.startY);

  const pointers = getPointerList();
  if (pointers.length === 1) {
    const only = pointers[0];
    viewerGestureState.dragStartX = only.x;
    viewerGestureState.dragStartY = only.y;
    viewerGestureState.dragStartPanX = viewerViewportState.panX;
    viewerGestureState.dragStartPanY = viewerViewportState.panY;
  } else if (pointers.length === 0) {
    viewerGestureState.pointerGestureHadMultiplePointers = false;
    viewerGestureState.pointerGestureConsumedPan = false;
  }
  releaseViewerPointerCapture(event.currentTarget, event.pointerId);
  if (shouldStartMomentum) {
    startViewerTouchMomentum(tracked.velocityX, tracked.velocityY);
  }
  assertViewerStateInvariants("end-pointer-interaction");
}

/** @param {PointerEvent} event */
function cancelPointerInteraction(event) {
  if (!viewerGestureState.pointers.has(event.pointerId)) return;
  viewerGestureState.pointers.delete(event.pointerId);
  if (viewerGestureState.pointers.size === 0) {
    viewerGestureState.pointerGestureHadMultiplePointers = false;
    viewerGestureState.pointerGestureConsumedPan = false;
    stopViewerTouchMomentum();
  }
  assertViewerStateInvariants("cancel-pointer-interaction");
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
    setZoom(viewerViewportState.zoom * factor, {
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
  if (Date.now() < viewerGestureState.suppressNextDblClickUntil) return;

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

  const search = requireFeatureInterface("search");
  if (search.isLightboxMobileOpen()) {
    search.setLightboxMobileOpen(false, { hideResults: true, hideTopUi: true });
  } else {
    search.hideViewerResults({ blurTopUiFocus: true, hideTopUi: true });
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


export {
  attachViewerGestures,
  captureViewerPointer,
  clampViewerTouchMomentumVelocity,
  consumeViewerPointerPanSamples,
  getViewerPointerEventTime,
  getViewerPointerMoveSamples,
  getWheelZoomFactor,
  handleLightboxPointerDownCapture,
  handleViewerPageSwipe,
  handleViewerSurfacePointerDown,
  handleZoomSurfaceWheel,
  releaseViewerPointerCapture,
  runViewerTouchMomentumFrame,
  startViewerTouchMomentum,
  stopViewerTouchMomentum,
  updateViewerPointerVelocity
};
