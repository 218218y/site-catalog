/**
 * Source module: 54-viewer-geometry.js
 * Viewer fit geometry, zoom, pan bounds, and focal-point transforms.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function updateHash() {
  if (!window.history?.replaceState) return;

  if (isAppPage("catalog") && state.catalog) {
    history.replaceState(history.state, "", catalogDocumentUrl(state.catalog.id));
  } else if (isAppPage("viewer") && state.catalog) {
    history.replaceState(history.state, "", viewerDocumentUrl(state.catalog.id, state.page, {
      source: isFavoritesLightboxMode() ? LIGHTBOX_SOURCE_FAVORITES : LIGHTBOX_SOURCE_CATALOG
    }));
  }

  updateDocumentMetadata(state.catalog);
}

function getPointerList() {
  return Array.from(state.pointers.values());
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

function clampValue(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getMinimumViewerZoom() {
  // Manual zoom-out must be available in both fit modes. The fit mode defines
  // the automatic base size; the manual zoom layer should use one shared lower
  // bound so fit-height can shrink just like fit-width.
  return MIN_VIEWER_ZOOM;
}

function isAutoViewerZoom(value = state.zoom) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric - AUTO_VIEWER_ZOOM) <= 0.001;
}

function getSafeViewerZoom(value = state.zoom) {
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

function isScrollViewerMode() {
  return state.viewerLayoutMode === VIEWER_LAYOUT_SCROLL && !isFavoritesLightboxMode();
}

function isViewerScrollIsolatedZoom() {
  return isScrollViewerMode() && Boolean(state.viewerScrollIsolatedZoom);
}

function viewerScrollUsesFreePositioning() {
  return (
    isScrollViewerMode()
    && !isViewerScrollIsolatedZoom()
    && state.imageFitMode === VIEWER_FIT_WIDTH
  );
}

function getActiveSingleImageNaturalSize() {
  if (isViewerScrollIsolatedZoom() && state.catalog) {
    return pageSize(state.catalog, state.viewerScrollIsolatedPage || state.page);
  }

  const image = els.lightboxImage;
  if (image?.naturalWidth && image?.naturalHeight) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }

  return null;
}

function getSingleImageDisplayMetrics() {
  if (isScrollViewerMode() && !isViewerScrollIsolatedZoom()) return null;
  const naturalSize = getActiveSingleImageNaturalSize();
  const stage = els.stageCanvas;
  if (!naturalSize || !stage) return null;

  const safeZoom = getSafeViewerZoom();
  const width = naturalSize.width * state.fitScale * safeZoom;
  const height = naturalSize.height * state.fitScale * safeZoom;
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

function getViewerScrollIsolatedExitBuffer() {
  if (!isViewerScrollIsolatedZoom()) return 0;

  const viewportHeight = els.stageCanvas?.clientHeight || window.innerHeight || 0;
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    return VIEWER_SCROLL_ZOOM_EXIT_BUFFER_MIN_PX;
  }

  return clampValue(
    viewportHeight * VIEWER_SCROLL_ZOOM_EXIT_BUFFER_VIEWPORT_RATIO,
    VIEWER_SCROLL_ZOOM_EXIT_BUFFER_MIN_PX,
    VIEWER_SCROLL_ZOOM_EXIT_BUFFER_MAX_PX
  );
}

function clampSinglePan() {
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return;

  if (metrics.overflowX <= 1) state.panX = 0;
  else state.panX = clampValue(state.panX, -metrics.overflowX, metrics.overflowX);

  // In the continuous viewer, manual zoom is intentionally allowed to travel
  // beyond the real vertical image edge before it hands control back to page
  // scrolling. The exposed area is the viewer's black canvas, so the reader can
  // inspect the last part of the image without an accidental zoom dismissal.
  const verticalExitBuffer = getViewerScrollIsolatedExitBuffer();
  const verticalPanLimit = metrics.overflowY + verticalExitBuffer;
  if (verticalPanLimit <= 1) state.panY = 0;
  else state.panY = clampValue(state.panY, -verticalPanLimit, verticalPanLimit);
}

function shouldPreserveSingleManualPosition(options = {}) {
  return (
    options.keepZoom !== false &&
    options.resetZoom !== true &&
    options.resetPosition !== true &&
    !isAutoViewerZoom()
  );
}





function resetImagePosition(options = {}) {
  state.panX = 0;
  state.panY = 0;
  if (options.queueSingleFitOrigin) {
    state.singleImageFitOriginPending = true;
  }
}

function applyPendingSingleImageFitOrigin() {
  if (!state.singleImageFitOriginPending) return;

  state.panX = 0;
  state.panY = 0;

  const metrics = getSingleImageDisplayMetrics();
  if (metrics && state.imageFitMode === VIEWER_FIT_WIDTH && metrics.overflowY > 1) {
    // Fit-width pages are often taller than the viewport. Start at the real
    // top of the page instead of vertically centering and hiding the header.
    state.panY = metrics.overflowY;
  }

  state.singleImageFitOriginPending = false;
}

function singleImageFitLayout(naturalWidth, naturalHeight) {
  const stage = els.stageCanvas;
  const width = Number(naturalWidth);
  const height = Number(naturalHeight);
  if (!stage || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

  const availableWidth = Math.max(260, stage.clientWidth - 18);
  const availableHeight = Math.max(260, stage.clientHeight - 18);
  const widthScale = availableWidth / width;
  const heightScale = availableHeight / height;
  const fitScale = state.imageFitMode === VIEWER_FIT_WIDTH ? widthScale : heightScale;
  return {
    fitScale,
    width: Math.max(220, Math.round(width * fitScale)),
    height: Math.max(160, Math.round(height * fitScale))
  };
}

function applyLightboxFrameGeometry(naturalWidth, naturalHeight, options = {}) {
  const frame = els.lightboxImageFrame;
  const image = els.lightboxImage;
  const layout = singleImageFitLayout(naturalWidth, naturalHeight);
  if (!frame || !image || !layout) return null;

  if (options.updateFitScale !== false) state.fitScale = layout.fitScale;
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
  return Boolean(applyLightboxFrameGeometry(size.width, size.height, { updateFitScale: false }));
}

function applySingleZoom() {
  const frame = els.lightboxImageFrame;
  const naturalSize = getActiveSingleImageNaturalSize();
  if (!naturalSize || !frame) return;

  applyLightboxFrameGeometry(naturalSize.width, naturalSize.height);

  if (state.singleImageFitOriginPending) {
    applyPendingSingleImageFitOrigin();
  } else if (isAutoViewerZoom() && !singleImageCanPan()) {
    resetImagePosition();
  }
  clampSinglePan();
  frame.style.setProperty("--single-pan-x", `${state.panX}px`);
  frame.style.setProperty("--single-pan-y", `${state.panY}px`);
  frame.style.setProperty("--single-zoom", String(state.zoom));
  frame.style.transform = `translate(-50%, -50%) translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
}


function applyZoom(options = {}) {
  if (isScrollViewerMode()) {
    if (isViewerScrollIsolatedZoom()) {
      applySingleZoom();
    } else {
      applyViewerScrollZoom(options.scrollAnchor || null);
    }
    els.lightbox?.classList.toggle("is-zoomed", !isAutoViewerZoom());
    syncViewerAutoZoomButtonUi();
    return;
  }

  applySingleZoom();

  const isManualZoom = !isAutoViewerZoom();
  els.lightbox?.classList.toggle("is-zoomed", isManualZoom || viewerCanPan());
  syncViewerAutoZoomButtonUi();
}

function getSingleKeyboardPanStep() {
  const viewportHeight = els.stageCanvas?.clientHeight || window.innerHeight || 720;
  const viewportStep = Math.round(viewportHeight * SINGLE_KEYBOARD_PAN_VIEWPORT_RATIO);
  const baseStep = clampValue(viewportStep, SINGLE_KEYBOARD_PAN_MIN_STEP, SINGLE_KEYBOARD_PAN_MAX_STEP);
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics?.overflowY) return baseStep;

  const remainingVerticalRange = metrics.overflowY * 2;
  return Math.max(12, Math.min(baseStep, Math.ceil(remainingVerticalRange / 8)));
}

function panSingleImageBy(deltaX, deltaY) {
  if (!singleImageCanPan()) return false;

  state.panX += deltaX;
  state.panY += deltaY;
  clampSinglePan();
  state.singleImageFitOriginPending = false;
  applyZoom();
  return true;
}

function getDefaultZoomFocalPoint() {
  const surface = els.stageCanvas;
  const rect = surface?.getBoundingClientRect?.();
  if (!rect) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

function adjustSinglePanForZoom(nextZoom, focal) {
  const stage = els.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !focal) return;

  const currentZoom = getSafeViewerZoom();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const contentX = (focal.x - centerX - state.panX) / currentZoom;
  const contentY = (focal.y - centerY - state.panY) / currentZoom;

  state.panX = focal.x - centerX - contentX * nextZoom;
  state.panY = focal.y - centerY - contentY * nextZoom;
}


function adjustPanForZoom(nextZoom, focal) {
  adjustSinglePanForZoom(nextZoom, focal);
}

function getSingleContentPointFromClientPoint(clientX, clientY) {
  const stage = els.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  const currentZoom = getSafeViewerZoom();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return {
    x: (clientX - centerX - state.panX) / currentZoom,
    y: (clientY - centerY - state.panY) / currentZoom
  };
}


function zoomSingleContentPointToViewportCenter(point, nextZoom) {
  if (!point) return false;
  const zoom = clampViewerZoom(nextZoom);
  if (isAutoViewerZoom(zoom)) {
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
    return true;
  }

  state.zoom = zoom;
  state.panX = -point.x * zoom;
  state.panY = -point.y * zoom;
  applyZoom();
  showViewerZoomIndicator(zoom);
  return true;
}


function zoomClientPointToViewportCenter(nextZoom, clientX, clientY) {
  if (isScrollViewerMode()) {
    setZoom(nextZoom, {
      showUi: false,
      focalClientX: clientX,
      focalClientY: clientY
    });
    return true;
  }

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
  const previousZoom = state.zoom;
  const zoom = clampViewerZoom(nextZoom);
  const hasFocal = Number.isFinite(focalClientX) && Number.isFinite(focalClientY);
  const focal = hasFocal
    ? { x: focalClientX, y: focalClientY }
    : getDefaultZoomFocalPoint();

  if (isScrollViewerMode()) {
    if (zoom > AUTO_VIEWER_ZOOM + 0.001) {
      if (!isViewerScrollIsolatedZoom()) {
        enterViewerScrollIsolatedZoom(zoom, focal?.x, focal?.y);
      } else {
        if (focal && Math.abs(zoom - previousZoom) > 0.001) {
          adjustPanForZoom(zoom, focal);
        }
        state.zoom = zoom;
        applyZoom();
      }
    } else {
      const scrollAnchor = isViewerScrollIsolatedZoom()
        ? null
        : getViewerScrollZoomAnchor(focal?.x, focal?.y);
      if (isViewerScrollIsolatedZoom()) {
        exitViewerScrollIsolatedZoom({ restorePage: true, nextZoom: zoom });
      } else {
        state.zoom = isAutoViewerZoom(zoom) ? AUTO_VIEWER_ZOOM : zoom;
        applyZoom({ scrollAnchor });
      }
    }
  } else {
    if (isAutoViewerZoom(zoom)) {
      state.zoom = AUTO_VIEWER_ZOOM;
      resetImagePosition({ queueSingleFitOrigin: true });
    } else {
      if (focal && Math.abs(zoom - previousZoom) > 0.001) {
        adjustPanForZoom(zoom, focal);
      }
      state.zoom = zoom;
    }
    applyZoom();
  }

  if (Math.abs(getSafeViewerZoom(state.zoom) - getSafeViewerZoom(previousZoom)) > 0.001) {
    showViewerZoomIndicator(state.zoom);
  }
  if (showUi) showTopUiTemporarily(1600);
}

function toggleZoomAtPoint(clientX, clientY) {
  if (state.zoom > 1.01) {
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
    return;
  }

  if (!zoomClientPointToViewportCenter(2, clientX, clientY)) {
    setZoom(2, { showUi: false, focalClientX: clientX, focalClientY: clientY });
  }
}
