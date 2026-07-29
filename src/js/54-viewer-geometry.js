/**
 * Source module: 54-viewer-geometry.js
 * Viewer fit geometry, zoom, pan bounds, relative-position transfer, and edge-turn overscroll.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function updateHash() {
  if (!window.history?.replaceState) return;

  if (isAppPage("catalog") && navigationState.catalog) {
    history.replaceState(history.state, "", catalogDocumentUrl(navigationState.catalog.id));
  } else if (isAppPage("viewer") && navigationState.catalog) {
    history.replaceState(history.state, "", viewerDocumentUrl(navigationState.catalog.id, navigationState.page, {
      source: isFavoritesLightboxMode() ? LIGHTBOX_SOURCE_FAVORITES : LIGHTBOX_SOURCE_CATALOG
    }));
  }

  updateDocumentMetadata(navigationState.catalog);
}

function getPointerList() {
  return Array.from(viewerState.pointers.values());
}

function pointerDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function pointerMidpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}

function getMinimumViewerZoom() {
  return MIN_VIEWER_ZOOM;
}

function isAutoViewerZoom(value = viewerState.zoom) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric - AUTO_VIEWER_ZOOM) <= 0.001;
}

function getSafeViewerZoom(value = viewerState.zoom) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return AUTO_VIEWER_ZOOM;
  return clampValue(numeric, getMinimumViewerZoom(), MAX_VIEWER_ZOOM);
}

function clampViewerZoom(value) {
  return getSafeViewerZoom(value);
}

function normalizeViewerFitMode(fitMode) {
  return fitMode === VIEWER_FIT_WIDTH ? VIEWER_FIT_WIDTH : VIEWER_FIT_HEIGHT;
}

function normalizeViewerFitModeSource(source) {
  return source === VIEWER_FIT_SOURCE_AUTO
    ? VIEWER_FIT_SOURCE_AUTO
    : VIEWER_FIT_SOURCE_MANUAL;
}

function viewerUsesAutomaticFitMode() {
  return normalizeViewerFitModeSource(viewerState.imageFitModeSource) === VIEWER_FIT_SOURCE_AUTO;
}

function getViewerFitViewportSize() {
  const stageWidth = Number(viewerElements.stageCanvas?.clientWidth) || 0;
  const stageHeight = Number(viewerElements.stageCanvas?.clientHeight) || 0;
  if (stageWidth > 0 && stageHeight > 0) {
    return { width: stageWidth, height: stageHeight };
  }

  const visualWidth = Number(window.visualViewport?.width) || 0;
  const visualHeight = Number(window.visualViewport?.height) || 0;
  if (visualWidth > 0 && visualHeight > 0) {
    return { width: visualWidth, height: visualHeight };
  }

  return {
    width: Number(window.innerWidth) || Number(document.documentElement?.clientWidth) || 0,
    height: Number(window.innerHeight) || Number(document.documentElement?.clientHeight) || 0
  };
}

function getAutomaticViewerFitMode() {
  const viewport = getViewerFitViewportSize();
  return viewport.height > viewport.width ? VIEWER_FIT_WIDTH : VIEWER_FIT_HEIGHT;
}

function getActiveSingleImageNaturalSize() {
  const configuredSize = navigationState.catalog ? pageSize(navigationState.catalog, navigationState.page) : null;
  if (configuredSize) return configuredSize;

  const image = viewerElements.lightboxImage;
  if (image?.naturalWidth && image?.naturalHeight) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }

  return null;
}

function getSingleImageDisplayMetrics() {
  const naturalSize = getActiveSingleImageNaturalSize();
  const stage = viewerElements.stageCanvas;
  if (!naturalSize || !stage) return null;

  const safeZoom = getSafeViewerZoom();
  const width = naturalSize.width * viewerState.fitScale * safeZoom;
  const height = naturalSize.height * viewerState.fitScale * safeZoom;
  return {
    width,
    height,
    overflowX: Math.max(0, (width - stage.clientWidth) / 2),
    overflowY: Math.max(0, (height - stage.clientHeight) / 2)
  };
}

function singleImageCanPan() {
  const metrics = getSingleImageDisplayMetrics();
  return Boolean(metrics && (metrics.overflowX > 1 || metrics.overflowY > 1));
}

function viewerCanPan() {
  return singleImageCanPan();
}

function singleViewerUsesBoundaryPan() {
  return getSafeViewerZoom() > AUTO_VIEWER_ZOOM + 0.001 || singleImageCanPan();
}

function getViewerPageTurnBuffer(axis = "y") {
  const stage = viewerElements.stageCanvas;
  const viewportSize = axis === "x"
    ? (stage?.clientWidth || window.innerWidth || 0)
    : (stage?.clientHeight || window.innerHeight || 0);
  if (!Number.isFinite(viewportSize) || viewportSize <= 0) {
    return VIEWER_PAGE_TURN_BUFFER_MIN_PX;
  }

  return clampValue(
    viewportSize * VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO,
    VIEWER_PAGE_TURN_BUFFER_MIN_PX,
    VIEWER_PAGE_TURN_BUFFER_MAX_PX
  );
}

function getSinglePanBounds(options = {}) {
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return null;

  const allowPageTurnBuffer = options.allowPageTurnBuffer !== false && singleViewerUsesBoundaryPan();
  const bufferX = allowPageTurnBuffer ? getViewerPageTurnBuffer("x") : 0;
  const bufferY = allowPageTurnBuffer ? getViewerPageTurnBuffer("y") : 0;
  return {
    metrics,
    realLimitX: metrics.overflowX,
    realLimitY: metrics.overflowY,
    limitX: metrics.overflowX + bufferX,
    limitY: metrics.overflowY + bufferY,
    bufferX,
    bufferY
  };
}

function clampSinglePan(options = {}) {
  const bounds = getSinglePanBounds(options);
  if (!bounds) return null;

  viewerState.panX = bounds.limitX <= 1 ? 0 : clampValue(viewerState.panX, -bounds.limitX, bounds.limitX);
  viewerState.panY = bounds.limitY <= 1 ? 0 : clampValue(viewerState.panY, -bounds.limitY, bounds.limitY);
  return bounds;
}

function clearSingleImagePendingPosition() {
  viewerState.singleImageFitOriginPending = false;
  viewerState.singleImagePendingRelativePosition = null;
  viewerState.singleImagePendingPageTurnOrigin = null;
}

function captureSingleImageRelativePosition() {
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return { xRatio: 0, yRatio: 0 };

  return {
    xRatio: metrics.overflowX > 1
      ? clampValue(viewerState.panX / metrics.overflowX, -1, 1)
      : 0,
    yRatio: metrics.overflowY > 1
      ? clampValue(viewerState.panY / metrics.overflowY, -1, 1)
      : 0
  };
}

function queueSingleImageRelativePosition(page, position = null) {
  const nextPage = Number.parseInt(page, 10);
  if (!Number.isFinite(nextPage)) return;
  const normalized = position || captureSingleImageRelativePosition();
  viewerState.singleImageFitOriginPending = false;
  viewerState.singleImagePendingPageTurnOrigin = null;
  viewerState.singleImagePendingRelativePosition = {
    page: nextPage,
    xRatio: clampValue(Number(normalized.xRatio) || 0, -1, 1),
    yRatio: clampValue(Number(normalized.yRatio) || 0, -1, 1)
  };
}

function queueSingleImagePageTurnOrigin(page, direction, axis = "y") {
  const nextPage = Number.parseInt(page, 10);
  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (!Number.isFinite(nextPage) || !step) return;

  viewerState.singleImageFitOriginPending = false;
  viewerState.singleImagePendingRelativePosition = null;
  viewerState.singleImagePendingPageTurnOrigin = {
    page: nextPage,
    direction: step,
    axis: axis === "x" ? "x" : "y"
  };
  viewerState.panX = 0;
  viewerState.panY = 0;
}

function resetImagePosition(options = {}) {
  viewerState.panX = 0;
  viewerState.panY = 0;
  clearSingleImagePendingPosition();
  if (options.queueSingleFitOrigin) {
    viewerState.singleImageFitOriginPending = true;
  }
}

function applyPendingSingleImagePosition() {
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return false;

  const pageTurnOrigin = viewerState.singleImagePendingPageTurnOrigin;
  if (pageTurnOrigin?.page === navigationState.page) {
    // Edge-driven navigation behaves like continuous reading: moving forward
    // opens the target at its top, while moving backward enters from its bottom.
    // Horizontal page turns still use the same vertical reading origin and keep
    // the image centered horizontally.
    viewerState.panX = 0;
    viewerState.panY = pageTurnOrigin.direction > 0 ? metrics.overflowY : -metrics.overflowY;
    viewerState.singleImagePendingPageTurnOrigin = null;
    viewerState.singleImagePendingRelativePosition = null;
    viewerState.singleImageFitOriginPending = false;
    return true;
  }

  const relativePosition = viewerState.singleImagePendingRelativePosition;
  if (relativePosition?.page === navigationState.page) {
    viewerState.panX = metrics.overflowX * relativePosition.xRatio;
    viewerState.panY = metrics.overflowY * relativePosition.yRatio;
    viewerState.singleImagePendingRelativePosition = null;
    viewerState.singleImagePendingPageTurnOrigin = null;
    viewerState.singleImageFitOriginPending = false;
    return true;
  }

  if (!viewerState.singleImageFitOriginPending) return false;

  viewerState.panX = 0;
  viewerState.panY = 0;
  if (viewerState.imageFitMode === VIEWER_FIT_WIDTH && metrics.overflowY > 1) {
    viewerState.panY = metrics.overflowY;
  }
  viewerState.singleImageFitOriginPending = false;
  viewerState.singleImagePendingRelativePosition = null;
  viewerState.singleImagePendingPageTurnOrigin = null;
  return true;
}

function shouldPreserveSingleManualPosition(options = {}) {
  return (
    options.keepZoom !== false
    && options.resetZoom !== true
    && options.resetPosition !== true
    && !isAutoViewerZoom()
  );
}

function singleImageFitLayout(naturalWidth, naturalHeight) {
  const stage = viewerElements.stageCanvas;
  const width = Number(naturalWidth);
  const height = Number(naturalHeight);
  if (!stage || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

  const availableWidth = Math.max(260, stage.clientWidth - 18);
  const availableHeight = Math.max(260, stage.clientHeight - 18);
  const widthScale = availableWidth / width;
  const heightScale = availableHeight / height;
  const fitScale = viewerState.imageFitMode === VIEWER_FIT_WIDTH ? widthScale : heightScale;
  return {
    fitScale,
    width: Math.max(220, Math.round(width * fitScale)),
    height: Math.max(160, Math.round(height * fitScale))
  };
}

function applyLightboxFrameGeometry(naturalWidth, naturalHeight, options = {}) {
  const frame = viewerElements.lightboxImageFrame;
  const image = viewerElements.lightboxImage;
  const layout = singleImageFitLayout(naturalWidth, naturalHeight);
  if (!frame || !image || !layout) return null;

  if (options.updateFitScale !== false) viewerState.fitScale = layout.fitScale;
  const nextWidth = `${layout.width}px`;
  const nextHeight = `${layout.height}px`;
  const nextAspectRatio = `${naturalWidth} / ${naturalHeight}`;
  if (frame.style.width !== nextWidth) frame.style.width = nextWidth;
  if (frame.style.height !== nextHeight) frame.style.height = nextHeight;
  if (frame.style.aspectRatio !== nextAspectRatio) frame.style.aspectRatio = nextAspectRatio;
  if (image.style.width !== "100%") image.style.width = "100%";
  if (image.style.height !== "100%") image.style.height = "100%";
  return layout;
}

function primeLightboxFrameForCatalogPage(catalog, page) {
  const size = pageSize(catalog, page);
  if (!size) return false;
  return Boolean(applyLightboxFrameGeometry(size.width, size.height, { updateFitScale: true }));
}

function applySingleZoom() {
  const frame = viewerElements.lightboxImageFrame;
  const naturalSize = getActiveSingleImageNaturalSize();
  if (!naturalSize || !frame) return;

  applyLightboxFrameGeometry(naturalSize.width, naturalSize.height);
  if (!applyPendingSingleImagePosition() && isAutoViewerZoom() && !singleImageCanPan()) {
    viewerState.panX = 0;
    viewerState.panY = 0;
  }

  clampSinglePan();
  frame.style.setProperty("--single-pan-x", `${viewerState.panX}px`);
  frame.style.setProperty("--single-pan-y", `${viewerState.panY}px`);
  frame.style.setProperty("--single-zoom", String(viewerState.zoom));
  frame.style.transform = `translate(-50%, -50%) translate(${viewerState.panX}px, ${viewerState.panY}px) scale(${viewerState.zoom})`;
}

function applyZoom() {
  applySingleZoom();
  const isManualZoom = !isAutoViewerZoom();
  viewerElements.lightbox?.classList.toggle("is-zoomed", isManualZoom || viewerCanPan());
  syncViewerAutoZoomButtonUi();
}

function consumeSingleViewerPanInput(deltaX = 0, deltaY = 0) {
  if (!singleViewerUsesBoundaryPan()) return null;

  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const previousPanX = viewerState.panX;
  const previousPanY = viewerState.panY;

  viewerState.panX = previousPanX - safeDeltaX;
  viewerState.panY = previousPanY - safeDeltaY;
  const bounds = clampSinglePan({ allowPageTurnBuffer: true });
  if (!bounds) return null;

  const moved = Math.abs(viewerState.panX - previousPanX) > 0.01 || Math.abs(viewerState.panY - previousPanY) > 0.01;
  if (moved) {
    clearSingleImagePendingPosition();
    applySingleZoom();
  }

  const consumedDeltaX = previousPanX - viewerState.panX;
  const consumedDeltaY = previousPanY - viewerState.panY;
  return {
    moved,
    bounds,
    remainingDeltaX: safeDeltaX - consumedDeltaX,
    remainingDeltaY: safeDeltaY - consumedDeltaY
  };
}

function getDefaultZoomFocalPoint() {
  const surface = viewerElements.stageCanvas;
  const rect = surface?.getBoundingClientRect?.();
  if (!rect) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function adjustSinglePanForZoom(nextZoom, focal) {
  const stage = viewerElements.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !focal) return;

  const currentZoom = getSafeViewerZoom();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const contentX = (focal.x - centerX - viewerState.panX) / currentZoom;
  const contentY = (focal.y - centerY - viewerState.panY) / currentZoom;

  viewerState.panX = focal.x - centerX - contentX * nextZoom;
  viewerState.panY = focal.y - centerY - contentY * nextZoom;
}

function getSingleContentPointFromClientPoint(clientX, clientY) {
  const stage = viewerElements.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  const currentZoom = getSafeViewerZoom();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return {
    x: (clientX - centerX - viewerState.panX) / currentZoom,
    y: (clientY - centerY - viewerState.panY) / currentZoom
  };
}

function finalizeSingleViewerZoomChange(previousZoom, options = {}) {
  const { showUi = true } = options;
  applyZoom();

  if (Math.abs(getSafeViewerZoom(viewerState.zoom) - getSafeViewerZoom(previousZoom)) > 0.001) {
    showViewerZoomIndicator(viewerState.zoom);
  }
  refreshSingleViewerImageResolution({
    warmFull: shouldWarmSingleViewerFullResolution(previousZoom)
  });
  if (showUi) showTopUiTemporarily(1600);
}

function zoomSingleContentPointToViewportCenter(point, nextZoom) {
  if (!point) return false;
  const previousZoom = viewerState.zoom;
  const zoom = clampViewerZoom(nextZoom);
  if (isAutoViewerZoom(zoom)) {
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
    return true;
  }

  clearSingleImagePendingPosition();
  viewerState.zoom = zoom;
  viewerState.panX = -point.x * zoom;
  viewerState.panY = -point.y * zoom;
  finalizeSingleViewerZoomChange(previousZoom, { showUi: false });
  return true;
}

function zoomClientPointToViewportCenter(nextZoom, clientX, clientY) {
  return zoomSingleContentPointToViewportCenter(
    getSingleContentPointFromClientPoint(clientX, clientY),
    nextZoom
  );
}

function setZoom(nextZoom, options = {}) {
  const {
    showUi = true,
    focalClientX = null,
    focalClientY = null
  } = options;
  const previousZoom = viewerState.zoom;
  const zoom = clampViewerZoom(nextZoom);
  const hasFocal = Number.isFinite(focalClientX) && Number.isFinite(focalClientY);
  const focal = hasFocal
    ? { x: focalClientX, y: focalClientY }
    : getDefaultZoomFocalPoint();

  if (isAutoViewerZoom(zoom)) {
    viewerState.zoom = AUTO_VIEWER_ZOOM;
    resetImagePosition({ queueSingleFitOrigin: true });
  } else {
    clearSingleImagePendingPosition();
    if (focal && Math.abs(zoom - previousZoom) > 0.001) {
      adjustSinglePanForZoom(zoom, focal);
    }
    viewerState.zoom = zoom;
  }
  finalizeSingleViewerZoomChange(previousZoom, { showUi });
}

function toggleZoomAtPoint(clientX, clientY) {
  // A double-click enters 200% only from the canonical automatic state.
  // Any manual zoom, including values below 100%, resets to automatic first.
  if (!isAutoViewerZoom()) {
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
    return;
  }

  if (!zoomClientPointToViewportCenter(2, clientX, clientY)) {
    setZoom(2, { showUi: false, focalClientX: clientX, focalClientY: clientY });
  }
}
