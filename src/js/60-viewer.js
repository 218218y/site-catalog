/**
 * Source module: 60-viewer.js
 * Catalog viewer lifecycle, page loading, layout, fullscreen, top controls, page rail, and zoom state.
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

function normalizeViewerLayoutMode(layoutMode) {
  return layoutMode === VIEWER_LAYOUT_SCROLL ? VIEWER_LAYOUT_SCROLL : VIEWER_LAYOUT_SIDE;
}

function isScrollViewerMode() {
  return state.viewerLayoutMode === VIEWER_LAYOUT_SCROLL && !isFavoritesLightboxMode();
}

function isViewerScrollIsolatedZoom() {
  return isScrollViewerMode() && Boolean(state.viewerScrollIsolatedZoom);
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

function clampSinglePan() {
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return;

  if (metrics.overflowX <= 1) state.panX = 0;
  else state.panX = clampValue(state.panX, -metrics.overflowX, metrics.overflowX);

  if (metrics.overflowY <= 1) state.panY = 0;
  else state.panY = clampValue(state.panY, -metrics.overflowY, metrics.overflowY);
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

function showTopUiTemporarily(delay = 2200) {
  if (!els.lightbox) return;
  window.clearTimeout(state.uiHideTimer);
  els.lightbox.classList.add("show-ui");
  if (state.topUiPinned) return;
  if (delay > 0) {
    state.uiHideTimer = window.setTimeout(() => {
      if (!state.topUiPinned) els.lightbox.classList.remove("show-ui");
    }, delay);
  }
}


function getLightboxPinnedTopOffset() {
  if (!state.topUiPinned || !els.lightboxBar) return 0;

  const rect = els.lightboxBar.getBoundingClientRect?.();
  const measuredHeight = rect ? Math.max(rect.height || 0, rect.bottom > 0 ? rect.bottom : 0) : 0;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  const maxReasonableOffset = Math.max(0, viewportHeight * 0.42);
  return Math.round(clampValue(measuredHeight, 0, maxReasonableOffset));
}

function syncLightboxTopSafeArea() {
  if (!els.lightbox) return 0;

  const offset = getLightboxPinnedTopOffset();
  els.lightbox.style.setProperty("--lightbox-top-safe-offset", `${offset}px`);
  return offset;
}

function refreshLightboxLayoutForTopUiChange(options = {}) {
  if (!state.lightboxOpen) {
    syncLightboxTopSafeArea();
    return;
  }

  const { resetAutoSingleOrigin = true } = options;
  syncLightboxTopSafeArea();

  if (isScrollViewerMode()) {
    refreshViewerScrollPageGeometry({
      preservePage: true,
      zoomAnchor: getViewerScrollZoomAnchor()
    });
    return;
  }

  if (resetAutoSingleOrigin && isAutoViewerZoom()) {
    resetImagePosition({ queueSingleFitOrigin: true });
  }

  applyZoom();

}

function syncTopUiPinnedUi() {
  const pinned = Boolean(state.topUiPinned);
  const label = pinned ? "ביטול נעיצת הסרגל העליון" : "נעיצת הסרגל העליון";

  window.clearTimeout(state.uiHideTimer);
  els.lightbox?.classList.toggle("top-ui-pinned", pinned);
  if (pinned) els.lightbox?.classList.add("show-ui");
  syncLightboxTopSafeArea();

  if (!els.lightboxPinTopBar) return;
  els.lightboxPinTopBar.dataset.pinned = pinned ? "true" : "false";
  els.lightboxPinTopBar.setAttribute("aria-pressed", pinned ? "true" : "false");
  els.lightboxPinTopBar.setAttribute("aria-label", label);
  setTooltipText(els.lightboxPinTopBar, label, { updateDefault: true });
}

function setTopUiPinned(pinned) {
  state.topUiPinned = Boolean(pinned);
  syncTopUiPinnedUi();
  refreshLightboxLayoutForTopUiChange();
  if (!state.topUiPinned) showTopUiTemporarily(1400);
}

function toggleTopUiPinned() {
  setTopUiPinned(!state.topUiPinned);
}

function getViewportPointer(event) {
  const x = Number(event?.clientX);
  const y = Number(event?.clientY);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

function pointInRect(point, rect, padding = 0) {
  if (!point || !rect) return false;
  return point.x >= rect.left - padding && point.x <= rect.right + padding && point.y >= rect.top - padding && point.y <= rect.bottom + padding;
}

function shouldKeepTopUiOpenForPointer(event = null) {
  if (state.topUiPinned) return true;
  const point = getViewportPointer(event);
  if (!point || !els.lightboxBar) return false;

  const barRect = els.lightboxBar.getBoundingClientRect();
  const hotspotRect = els.topHotspot?.getBoundingClientRect?.();
  if (pointInRect(point, barRect, 1) || pointInRect(point, hotspotRect, 1)) return true;

  // During the slide-in animation the toolbar may still be above the viewport,
  // so the pointer can be in the top trigger strip before it is geometrically
  // inside the toolbar. Keep the toolbar open for that whole top-edge region
  // instead of requiring the user to wait until the transition finishes.
  const topHoldBottom = Math.max(2, hotspotRect?.bottom || 0, barRect.top + 2);
  if (point.y <= topHoldBottom) return true;

  return false;
}

function scheduleTopUiClose(event = null) {
  if (!els.lightbox || !state.lightboxOpen || state.topUiPinned) return;
  if (shouldKeepTopUiOpenForPointer(event)) return;
  window.clearTimeout(state.uiHideTimer);
  state.uiHideTimer = window.setTimeout(() => {
    if (!state.topUiPinned) els.lightbox?.classList.remove("show-ui");
  }, 420);
}

function shouldKeepPageRailOpenForPointer(event = null) {
  const point = getViewportPointer(event);
  if (!point || !els.lightboxPageRail) return false;

  const railRect = els.lightboxPageRail.getBoundingClientRect();
  const hotspotRect = els.lightboxSideHotspot?.getBoundingClientRect?.();
  if (pointInRect(point, railRect, 1) || pointInRect(point, hotspotRect, 1)) return true;

  // During the slide-in animation the rail can still be geometrically outside
  // the viewport, while the pointer is already on the right activation strip or
  // in the tiny edge gap. Keep the rail open for that whole right-edge region
  // instead of requiring the user to wait until the transition finishes.
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const hotspotWidth = Math.max(2, Math.round(hotspotRect?.width || 34));
  const rightHoldLeft = Math.max(0, Math.min(hotspotRect?.left ?? viewportWidth, viewportWidth - hotspotWidth));
  const rightHoldRight = viewportWidth + 1;
  const isInRightHoldRegion = point.x >= rightHoldLeft - 1 && point.x <= rightHoldRight + 1 && point.y >= 0 && point.y <= viewportHeight;
  if (isInRightHoldRegion) return true;

  // The rail is intentionally offset a few pixels from the right viewport edge.
  // Treat that physical edge as a hover hold zone so a fast move to the right
  // edge does not start the rail animation and immediately close it.
  const reachedRightEdgeFromRail = point.x >= railRect.right - 1 && point.x <= viewportWidth + 1 && point.y >= 0 && point.y <= viewportHeight;
  if (reachedRightEdgeFromRail) return true;

  return false;
}

function handleLightboxHoverHoldPointerMove(event) {
  if (!shouldUseLightboxHoverPointer(event)) return;

  if (els.lightbox?.classList.contains("show-ui") && !shouldKeepTopUiOpenForPointer(event)) {
    scheduleTopUiClose(event);
  }

  if (els.lightbox?.classList.contains("show-page-rail") && !shouldKeepPageRailOpenForPointer(event)) {
    schedulePageRailClose(event);
  }
}

function getViewportSize() {
  return {
    width: window.innerWidth || document.documentElement.clientWidth || 0,
    height: window.innerHeight || document.documentElement.clientHeight || 0
  };
}

function isPointInTopEdgeActivationZone(point) {
  if (!point || state.topUiPinned) return false;
  const { width } = getViewportSize();
  const hotspotRect = els.topHotspot?.getBoundingClientRect?.();
  const hotspotHeight = Math.max(2, Math.round(hotspotRect?.height || 34));
  const activationBottom = Math.max(hotspotRect?.bottom || 0, hotspotHeight);
  return point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= activationBottom;
}

function isPointInPageRailEdgeActivationZone(point) {
  if (!point || !els.lightboxSideHotspot || !els.lightboxPageRail) return false;
  const { width, height } = getViewportSize();
  const hotspotRect = els.lightboxSideHotspot.getBoundingClientRect();
  const hotspotWidth = Math.max(2, Math.round(hotspotRect?.width || 34));
  const activationLeft = Math.max(0, Math.min(hotspotRect?.left ?? width, width - hotspotWidth));
  // Coordinate-based hover activation is allowed up to the physical viewport
  // edge, because a fast mouse move can land beyond the visible hotspot strip
  // and would otherwise miss it.
  const activationRight = width;
  return point.x >= activationLeft && point.x <= activationRight && point.y >= 0 && point.y <= height;
}

function openLightboxEdgeUiForPointer(point) {
  if (isPointInTopEdgeActivationZone(point)) {
    showTopUiTemporarily(0);
  }

  if (isPointInPageRailEdgeActivationZone(point)) {
    showPageRailTemporarily(0);
  }
}

function handleLightboxEdgeHoverMove(event) {
  if (!shouldUseLightboxHoverPointer(event)) return;
  const point = getViewportPointer(event);
  openLightboxEdgeUiForPointer(point);
  handleLightboxHoverHoldPointerMove(event);
}

function handleLightboxEdgeHoverViewportExit(event) {
  if (!shouldUseLightboxHoverPointer(event)) return;
  if (event.relatedTarget || event.toElement) return;

  const point = getViewportPointer(event);
  if (!point) return;

  const { width, height } = getViewportSize();
  if (point.y <= 0 && point.x >= 0 && point.x <= width) {
    showTopUiTemporarily(0);
  }

  if (point.x >= width - 1 && point.y >= 0 && point.y <= height) {
    showPageRailTemporarily(0);
  }
}

function getBrowserFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
}

function isBrowserFullscreenActive() {
  return Boolean(getBrowserFullscreenElement());
}

function isBrowserFullscreenSupported() {
  const root = document.documentElement;
  return Boolean(
    document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.mozFullScreenEnabled ||
    document.msFullscreenEnabled ||
    root?.requestFullscreen ||
    root?.webkitRequestFullscreen ||
    root?.mozRequestFullScreen ||
    root?.msRequestFullscreen
  );
}

function requestBrowserFullscreen() {
  const root = document.documentElement;
  const request = root?.requestFullscreen || root?.webkitRequestFullscreen || root?.mozRequestFullScreen || root?.msRequestFullscreen;
  if (!request) return Promise.reject(new Error("fullscreen-unsupported"));
  const result = request.call(root);
  return result && typeof result.then === "function" ? result : Promise.resolve();
}

function exitBrowserFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (!exit) return Promise.reject(new Error("fullscreen-exit-unsupported"));
  const result = exit.call(document);
  return result && typeof result.then === "function" ? result : Promise.resolve();
}

function getFullscreenToggleButtons() {
  return els.fullscreenToggle ? [els.fullscreenToggle] : [];
}

function syncFullscreenButtonUi() {
  const buttons = getFullscreenToggleButtons();
  if (!buttons.length) return;

  const isActive = isBrowserFullscreenActive();
  const isSupported = isBrowserFullscreenSupported();
  const label = isActive ? "יציאה ממסך מלא" : "כניסה למסך מלא";

  buttons.forEach((button) => {
    button.dataset.fullscreenActive = isActive ? "true" : "false";
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.setAttribute("aria-label", label);
    setTooltipText(button, label, { updateDefault: true });
    button.disabled = !isSupported && !isActive;
    button.classList.toggle("hidden", !isSupported && !isActive);
  });
}

async function toggleBrowserFullscreen(sourceButton = null) {
  const button = sourceButton || els.fullscreenToggle;
  const wasActive = isBrowserFullscreenActive();

  try {
    if (wasActive) {
      await exitBrowserFullscreen();
    } else {
      if (!isBrowserFullscreenSupported()) throw new Error("fullscreen-unsupported");
      await requestBrowserFullscreen();
    }
  } catch (error) {
    const message = wasActive ? "לא הצלחתי לצאת ממסך מלא" : "הדפדפן חסם מסך מלא";
    console.warn("Fullscreen toggle failed", error);
    flashActionButton(button, message);
  } finally {
    syncFullscreenButtonUi();
    if (state.lightboxOpen) showTopUiTemporarily(1400);
  }
}

function returnToMainSiteFromLightbox(event = null) {
  event?.preventDefault?.();
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();
  navigateTo(homeDocumentUrl());
}


function setViewerLoading(isLoading) {
  els.viewerLoading.classList.toggle("hidden", !isLoading);
}


function hideLightboxFloatingPreview() {
  els.lightboxFloatingPreview?.classList.remove("visible");
}

function isLightboxPageRailTrigger(button) {
  return Boolean(button?.closest?.(".lightbox-page-rail"));
}

function normalizeWheelDeltaToPixels(delta, deltaMode, pageSize = 0) {
  const lineMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_LINE : 1;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;

  if (deltaMode === lineMode) return delta * 36;
  if (deltaMode === pageMode) return delta * Math.max(1, pageSize);
  return delta;
}

function positionLightboxFloatingPreview(button) {
  const preview = els.lightboxFloatingPreview;
  if (!preview || !button) return;

  const buttonRect = button.getBoundingClientRect();

  if (isLightboxPageRailTrigger(button)) {
    const previewHeight = Math.max(240, preview.offsetHeight || Math.min(620, window.innerHeight * 0.74));
    const railRect = button.closest?.(".lightbox-page-rail")?.getBoundingClientRect?.();
    const centerY = Math.min(
      window.innerHeight - (previewHeight / 2) - 14,
      Math.max((previewHeight / 2) + 14, buttonRect.top + (buttonRect.height / 2))
    );
    const right = Math.max(12, window.innerWidth - (railRect?.left ?? buttonRect.left) + 12);

    preview.style.left = "auto";
    preview.style.bottom = "auto";
    preview.style.right = `${right}px`;
    preview.style.top = `${centerY}px`;
    return;
  }

  const previewWidth = Math.max(240, preview.offsetWidth || Math.min(420, window.innerWidth * 0.34));
  const centerX = Math.min(
    window.innerWidth - (previewWidth / 2) - 14,
    Math.max((previewWidth / 2) + 14, buttonRect.left + (buttonRect.width / 2))
  );
  const bottom = Math.max(122, window.innerHeight - buttonRect.top + 12);

  preview.style.right = "auto";
  preview.style.top = "auto";
  preview.style.left = `${centerX}px`;
  preview.style.bottom = `${bottom}px`;
}

function showLightboxFloatingPreview(button) {
  if (!button || !els.lightboxFloatingPreview || !els.lightboxFloatingPreviewImage) return;

  const previewCatalog = findCatalogById(button.dataset.previewCatalog) || state.catalog;
  if (!previewCatalog) return;
  const page = clampPage(button.dataset.previewPage || button.dataset.page, previewCatalog);
  const src = button.dataset.previewSrc || pageSrc(previewCatalog, page);
  setCatalogImageSource(els.lightboxFloatingPreviewImage, src);
  els.lightboxFloatingPreviewImage.alt = `${previewCatalog.title} - עמוד ${page}`;
  if (els.lightboxFloatingPreviewPage) {
    els.lightboxFloatingPreviewPage.textContent = isFavoritesLightboxMode()
      ? `${previewCatalog.title} · עמוד ${page}`
      : `עמוד ${page}`;
  }
  els.lightboxFloatingPreview.classList.toggle("from-page-rail", isLightboxPageRailTrigger(button));
  els.lightboxFloatingPreview.classList.add("visible");
  positionLightboxFloatingPreview(button);
}

function updateLightboxThumbs(options = {}) {
  const { scrollIntoView = true } = options;
  const rail = els.lightboxPageThumbs;
  if (!rail) return;

  const previous = rail.querySelector('.lightbox-page-thumb[aria-current="page"]');
  const selector = isFavoritesLightboxMode()
    ? `.lightbox-page-thumb[data-favorite-index="${state.favoritesViewerIndex}"]`
    : `.lightbox-page-thumb[data-page="${state.page}"]`;
  const active = rail.querySelector(selector);

  if (previous && previous !== active) {
    previous.classList.remove("active");
    previous.removeAttribute("aria-current");
  }
  if (!active) return;

  active.classList.add("active");
  active.setAttribute("aria-current", "page");
  if (scrollIntoView && els.lightbox?.classList.contains("show-page-rail")) {
    active.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
}

function handleLightboxPageRailSelection(button) {
  if (!button) return;

  hideLightboxFloatingPreview();

  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex(Number(button.dataset.favoriteIndex), { thumbScrollIntoView: false });
  } else {
    const targetPage = Number(button.dataset.page);
    if (!Number.isFinite(targetPage)) return;
    setLightboxPage(targetPage, {
      thumbScrollIntoView: false,
      scrollBehavior: "auto",
      animateScrollPage: true
    });
  }

  showPageRailTemporarily(1800, { scrollIntoView: false });
}

function renderLightboxPageRail() {
  if (!state.catalog || !els.lightboxPageThumbs) return;
  const thumbs = [];

  if (isFavoritesLightboxMode()) {
    const entries = getFavoriteEntries();
    if (els.lightboxPageRailTitle) els.lightboxPageRailTitle.textContent = "מועדפים";
    els.lightboxPageRail?.setAttribute("aria-label", "מעבר מהיר בין המועדפים");

    entries.forEach(({ catalog, page }, index) => {
      const thumb = escapeHtml(thumbSrc(catalog, page));
      const title = escapeHtml(catalog.title || "קטלוג");
      const active = index === state.favoritesViewerIndex;
      thumbs.push(`
        <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${active ? " active" : ""}" type="button" data-favorite-index="${index}" data-preview-catalog="${escapeHtml(catalog.id)}" data-preview-page="${page}" data-preview-src="${thumb}" aria-label="מעבר למועדף ${index + 1}: ${title}, עמוד ${page}"${active ? ' aria-current="page"' : ""}>
          <span class="lightbox-page-thumb-image-wrap">
            <img src="${thumb}" alt="" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumb)} />
          </span>
          <span class="lightbox-page-thumb-number">${index + 1}</span>
        </button>
      `);
    });
  } else {
    const catalog = state.catalog;
    if (els.lightboxPageRailTitle) els.lightboxPageRailTitle.textContent = "עמודים";
    els.lightboxPageRail?.setAttribute("aria-label", "מעבר מהיר בין עמודי הקטלוג");

    for (let page = 1; page <= catalog.pages; page += 1) {
      const thumb = escapeHtml(thumbSrc(catalog, page));
      thumbs.push(`
        <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${page === state.page ? " active" : ""}" type="button" data-page="${page}" data-preview-catalog="${escapeHtml(catalog.id)}" data-preview-page="${page}" data-preview-src="${thumb}" aria-label="מעבר לעמוד ${page}"${page === state.page ? ' aria-current="page"' : ""}>
          <span class="lightbox-page-thumb-image-wrap">
            <img src="${thumb}" alt="" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumb)} />
          </span>
          <span class="lightbox-page-thumb-number">${page}</span>
        </button>
      `);
    }
  }

  els.lightboxPageThumbs.innerHTML = thumbs.join("");
  els.lightboxPageThumbs.querySelectorAll(".lightbox-page-thumb").forEach((button) => {
    button.addEventListener("pointerenter", () => showLightboxFloatingPreview(button));
    button.addEventListener("pointerleave", hideLightboxFloatingPreview);
    button.addEventListener("focus", () => showLightboxFloatingPreview(button));
    button.addEventListener("blur", hideLightboxFloatingPreview);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      handleLightboxPageRailSelection(button);
    });
  });
}

function syncViewerFitModeUi() {
  const fitMode = normalizeViewerFitMode(state.imageFitMode);
  state.imageFitMode = fitMode;

  els.lightbox?.classList.toggle("fit-height", fitMode === VIEWER_FIT_HEIGHT);
  els.lightbox?.classList.toggle("fit-width", fitMode === VIEWER_FIT_WIDTH);

  if (els.fitHeightBtn) {
    const isActive = fitMode === VIEWER_FIT_HEIGHT;
    els.fitHeightBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    els.fitHeightBtn.setAttribute("aria-label", "התאמת התמונה לגובה");
    setTooltipText(els.fitHeightBtn, "התאמה לגובה", { updateDefault: true });
  }

  if (els.fitWidthBtn) {
    const isActive = fitMode === VIEWER_FIT_WIDTH;
    els.fitWidthBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    els.fitWidthBtn.setAttribute("aria-label", "התאמת התמונה לרוחב");
    setTooltipText(els.fitWidthBtn, "התאמה לרוחב", { updateDefault: true });
  }

  syncViewerAutoZoomButtonUi();
}


function syncViewerAutoZoomButtonUi() {
  if (!els.viewerAutoZoomBtn) return;

  const showButton = Boolean(state.lightboxOpen && !isAutoViewerZoom());

  els.viewerAutoZoomBtn.classList.toggle("hidden", !showButton);
  els.viewerAutoZoomBtn.setAttribute("aria-hidden", showButton ? "false" : "true");
  els.viewerAutoZoomBtn.setAttribute("aria-label", "חזרה לזום אוטומטי");

  // Keep the button itself icon-only and stationary; the clear explanation lives
  // in the shared floating tooltip so hover/focus never changes the button size.
  setTooltipText(els.viewerAutoZoomBtn, "חזרה לזום אוטומטי", { updateDefault: true });
}

function formatViewerZoomPercent(value = state.zoom) {
  return `${Math.round(getSafeViewerZoom(value) * 100)}%`;
}

function hideViewerZoomIndicator() {
  window.clearTimeout(state.zoomIndicatorHideTimer);
  state.zoomIndicatorHideTimer = 0;
  els.viewerZoomIndicator?.classList.remove("visible");
}

function showViewerZoomIndicator(value = state.zoom) {
  const indicator = els.viewerZoomIndicator;
  if (!indicator || !state.lightboxOpen) return;

  indicator.textContent = formatViewerZoomPercent(value);
  indicator.classList.add("visible");

  window.clearTimeout(state.zoomIndicatorHideTimer);
  state.zoomIndicatorHideTimer = window.setTimeout(() => {
    indicator.classList.remove("visible");
    state.zoomIndicatorHideTimer = 0;
  }, VIEWER_ZOOM_INDICATOR_HIDE_MS);
}

function setViewerFitMode(fitMode, options = {}) {
  const nextFitMode = normalizeViewerFitMode(fitMode);
  const { showUi = true } = options;
  const shouldResetView = nextFitMode !== state.imageFitMode;

  state.imageFitMode = nextFitMode;
  if (shouldResetView) {
    if (isViewerScrollIsolatedZoom()) {
      exitViewerScrollIsolatedZoom({ restorePage: false, nextZoom: AUTO_VIEWER_ZOOM });
    }
    state.zoom = AUTO_VIEWER_ZOOM;
    resetImagePosition({ queueSingleFitOrigin: true });
    state.pointers.clear();
  }

  syncViewerFitModeUi();
  if (isScrollViewerMode()) {
    refreshViewerScrollPageGeometry({ preservePage: true });
  } else {
    applyZoom();
  }
  if (showUi) showTopUiTemporarily(1600);
}

function syncLightboxModeUi() {
  const favoritesMode = isFavoritesLightboxMode();
  els.lightbox?.classList.add("catalog-entry-mode");
  els.lightbox?.classList.toggle("favorites-viewer-mode", favoritesMode);
  els.favoriteOpenCatalogButton?.classList.toggle("hidden", !favoritesMode);
  els.favoriteOpenCatalogButton?.setAttribute("aria-hidden", favoritesMode ? "false" : "true");
  els.prevPageBtn?.setAttribute("aria-label", favoritesMode ? "המועדף הקודם" : "העמוד הקודם");
  els.nextPageBtn?.setAttribute("aria-label", favoritesMode ? "המועדף הבא" : "העמוד הבא");
  syncViewerLayoutModeUi();
  syncViewerFitModeUi();
  syncFullscreenButtonUi();

  if (els.lightboxModeLabel) {
    els.lightboxModeLabel.textContent = favoritesMode ? "תצוגת מועדפים" : "כניסה לקטלוג";
  }
}



function hasHoverPointer() {
  if (typeof window.matchMedia !== "function") return true;
  const primaryFineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const anyFineHover = window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;
  return primaryFineHover || anyFineHover;
}

function isTouchLikePointer(event) {
  return event?.pointerType === "touch" || event?.pointerType === "pen";
}

function markTouchLikeViewportInput(event) {
  if (isTouchLikePointer(event) || event?.type === "touchstart") {
    state.lastTouchLikeViewportInputAt = Date.now();
  }
}

function hasRecentTouchLikeViewportInput(timeout = 900) {
  return Date.now() - state.lastTouchLikeViewportInputAt < timeout;
}

function markTouchLikeRailInput(event) {
  if (isTouchLikePointer(event)) {
    state.lastTouchLikeRailInputAt = Date.now();
  }
  markTouchLikeViewportInput(event);
}

function hasRecentTouchLikeRailInput(timeout = 900) {
  return Date.now() - state.lastTouchLikeRailInputAt < timeout;
}

function shouldUseLightboxHoverPointer(event = null) {
  if (!state.lightboxOpen || !hasHoverPointer()) return false;
  if (isTouchLikePointer(event) || hasRecentTouchLikeViewportInput()) return false;
  return true;
}

function shouldUsePageRailHover(event = null) {
  if (!shouldUseLightboxHoverPointer(event)) return false;
  if (hasRecentTouchLikeRailInput()) return false;
  return true;
}

function showPageRailTemporarily(delay = 2600, options = {}) {
  const { scrollIntoView = true } = options;
  if (!els.lightbox || !state.lightboxOpen) return;
  window.clearTimeout(state.pageRailHideTimer);
  els.lightbox.classList.add("show-page-rail");
  updateLightboxThumbs({ scrollIntoView });
  if (delay > 0) {
    state.pageRailHideTimer = window.setTimeout(() => {
      els.lightbox?.classList.remove("show-page-rail");
    }, delay);
  }
}

function keepPageRailOpen(options = {}) {
  const { scrollIntoView = true } = options;
  if (!state.lightboxOpen) return;
  window.clearTimeout(state.pageRailHideTimer);
  els.lightbox?.classList.add("show-page-rail");
  updateLightboxThumbs({ scrollIntoView });
}

function schedulePageRailClose(event = null) {
  if (!shouldUsePageRailHover(event)) return;
  if (shouldKeepPageRailOpenForPointer(event)) return;
  window.clearTimeout(state.pageRailHideTimer);
  state.pageRailHideTimer = window.setTimeout(() => {
    els.lightbox?.classList.remove("show-page-rail");
  }, 420);
}

function openPageRailFromTouch(event) {
  if (!isTouchLikePointer(event)) return;
  markTouchLikeRailInput(event);
  event.preventDefault?.();
  keepPageRailOpen();
}

function openPageRailFromHotspot(event = null) {
  if (hasRecentTouchLikeRailInput()) {
    keepPageRailOpen();
    return;
  }
  showPageRailTemporarily(shouldUsePageRailHover(event) ? 2600 : 0);
}

function showPageRailFromHover(event = null) {
  if (shouldUsePageRailHover(event)) showPageRailTemporarily(0);
}

function keepPageRailOpenFromHover(event = null) {
  if (shouldUsePageRailHover(event)) keepPageRailOpen();
}

function handlePageRailPointerOutside(event) {
  if (!els.lightbox || !state.lightboxOpen) return;
  if (!els.lightbox.classList.contains("show-page-rail")) return;

  const target = event.target;
  if (els.lightboxPageRail?.contains(target) || els.lightboxSideHotspot?.contains(target)) return;
  if (!isTouchLikePointer(event) && shouldUsePageRailHover(event)) return;

  window.clearTimeout(state.pageRailHideTimer);
  hideLightboxFloatingPreview();
  els.lightbox.classList.remove("show-page-rail");
}
















function hideViewerPageIndicator() {
  window.clearTimeout(state.pageIndicatorHideTimer);
  state.pageIndicatorHideTimer = 0;
  els.viewerPageIndicator?.classList.remove("visible");
}

function showViewerPageIndicatorTemporarily(delay = VIEWER_PAGE_INDICATOR_HIDE_MS) {
  if (!state.lightboxOpen || !els.viewerPageIndicator) return;

  window.clearTimeout(state.pageIndicatorHideTimer);
  els.viewerPageIndicator.classList.add("visible");
  if (delay <= 0) return;

  state.pageIndicatorHideTimer = window.setTimeout(() => {
    els.viewerPageIndicator?.classList.remove("visible");
    state.pageIndicatorHideTimer = 0;
  }, delay);
}

function syncLightboxProgress(current, total, title, options = {}) {
  if (!els.lightboxProgress) return;
  const totalItems = Math.max(1, Number.parseInt(total, 10) || 1);
  const currentItem = clampValue(Number.parseInt(current, 10) || 1, 1, totalItems);
  const ratio = totalItems <= 1 ? 1 : currentItem / totalItems;
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const label = String(options.label || "עמוד");
  const detail = String(options.detail || "").trim();
  const accessibleTitle = title || `${label} ${currentItem} מתוך ${totalItems}`;

  els.lightboxProgress.style.setProperty("--catalog-progress-ratio", String(clampedRatio));
  els.lightboxProgress.style.setProperty("--catalog-progress-percent", `${clampedRatio * 100}%`);
  els.lightboxProgress.setAttribute("aria-valuemin", "1");
  els.lightboxProgress.setAttribute("aria-valuemax", String(totalItems));
  els.lightboxProgress.setAttribute("aria-valuenow", String(currentItem));
  els.lightboxProgress.setAttribute("aria-valuetext", accessibleTitle);
  els.lightboxProgress.setAttribute("title", accessibleTitle);

  if (els.viewerPageIndicator) {
    els.viewerPageIndicatorLabel.textContent = label;
    els.viewerPageIndicatorCurrent.textContent = String(currentItem);
    els.viewerPageIndicatorTotal.textContent = String(totalItems);
    if (els.viewerPageIndicatorDetail) {
      els.viewerPageIndicatorDetail.textContent = detail;
      els.viewerPageIndicatorDetail.classList.toggle("hidden", !detail);
    }
    els.viewerPageIndicator.setAttribute("title", accessibleTitle);
    showViewerPageIndicatorTemporarily();
  }
}


function syncViewerLayoutModeUi() {
  const favoritesMode = isFavoritesLightboxMode();
  if (favoritesMode && state.viewerLayoutMode !== VIEWER_LAYOUT_SIDE) {
    state.viewerLayoutMode = VIEWER_LAYOUT_SIDE;
  }

  const scrollMode = isScrollViewerMode();
  const isolatedZoom = scrollMode && isViewerScrollIsolatedZoom();
  els.lightbox?.classList.toggle("viewer-layout-side", !scrollMode);
  els.lightbox?.classList.toggle("viewer-layout-scroll", scrollMode);
  els.lightbox?.classList.toggle("viewer-scroll-zoom-isolated", isolatedZoom);
  els.lightboxImageFrame?.classList.toggle("hidden", scrollMode && !isolatedZoom);
  els.viewerScrollPages?.classList.toggle("hidden", !scrollMode);

  const button = els.viewerLayoutToggle;
  if (!button) return;
  button.classList.toggle("hidden", favoritesMode);
  button.dataset.viewerLayout = scrollMode ? VIEWER_LAYOUT_SCROLL : VIEWER_LAYOUT_SIDE;
  button.setAttribute("aria-pressed", scrollMode ? "true" : "false");
  const label = scrollMode ? "מעבר לתצוגת צדדים" : "מעבר לתצוגת גלילה";
  button.setAttribute("aria-label", label);
  setTooltipText(button, label, { updateDefault: true });
}

function getViewerScrollPageLayout(page) {
  const container = els.viewerScrollPages;
  const size = pageSize(state.catalog, page) || { width: 1400, height: 1000 };
  const viewportWidth = container?.clientWidth
    || els.stageCanvas?.clientWidth
    || window.innerWidth
    || 320;
  const viewportHeight = container?.clientHeight
    || els.stageCanvas?.clientHeight
    || window.innerHeight
    || 480;
  const containerStyle = container ? window.getComputedStyle(container) : null;
  const horizontalInset = containerStyle
    ? Math.max(0, Number.parseFloat(containerStyle.paddingLeft) || 0)
    : 17;
  const verticalInset = containerStyle
    ? Math.max(0, Number.parseFloat(containerStyle.paddingTop) || 0)
    : 17;
  const availableWidth = Math.max(220, viewportWidth - horizontalInset * 2);
  const availableHeight = Math.max(220, viewportHeight - verticalInset * 2);
  const widthScale = availableWidth / size.width;
  const heightScale = availableHeight / size.height;
  const scale = state.imageFitMode === VIEWER_FIT_WIDTH ? widthScale : heightScale;

  return {
    width: Math.max(180, Math.round(size.width * scale)),
    height: Math.max(140, Math.round(size.height * scale))
  };
}

function getViewerScrollPageFrame(page) {
  return els.viewerScrollPages?.querySelector?.(`[data-scroll-page="${page}"]`) || null;
}

function getViewerScrollFrameFocal(page, clientX = null, clientY = null) {
  const frame = getViewerScrollPageFrame(page);
  const container = els.viewerScrollPages;
  if (!frame || !container) return null;

  const frameRect = frame.getBoundingClientRect?.();
  const containerRect = container.getBoundingClientRect?.();
  if (!frameRect?.width || !frameRect?.height || !containerRect?.width || !containerRect?.height) return null;

  const fallbackX = frameRect.left + frameRect.width / 2;
  const fallbackY = frameRect.top + frameRect.height / 2;
  const pointX = Number.isFinite(clientX)
    ? clampValue(clientX, frameRect.left, frameRect.right)
    : clampValue(containerRect.left + containerRect.width / 2, frameRect.left, frameRect.right);
  const pointY = Number.isFinite(clientY)
    ? clampValue(clientY, frameRect.top, frameRect.bottom)
    : clampValue(containerRect.top + containerRect.height / 2, frameRect.top, frameRect.bottom);

  return {
    clientX: Number.isFinite(pointX) ? pointX : fallbackX,
    clientY: Number.isFinite(pointY) ? pointY : fallbackY,
    ratioX: clampValue((pointX - frameRect.left) / frameRect.width, 0, 1),
    ratioY: clampValue((pointY - frameRect.top) / frameRect.height, 0, 1)
  };
}

function syncViewerScrollIsolatedZoomUi() {
  const isolatedZoom = isViewerScrollIsolatedZoom();
  els.lightbox?.classList.toggle("viewer-scroll-zoom-isolated", isolatedZoom);
  els.lightboxImageFrame?.classList.toggle("hidden", isScrollViewerMode() && !isolatedZoom);
}

function prepareViewerScrollIsolatedImage(page) {
  if (!state.catalog || !els.lightboxImage) return;
  const targetPage = clampPage(page, state.catalog);
  const src = pageSrc(state.catalog, targetPage);

  primeLightboxFrameForCatalogPage(state.catalog, targetPage);
  if (els.lightboxImage.getAttribute("src") !== src) {
    els.lightboxImage.removeAttribute("src");
    prepareImagePlaceholder(els.lightboxImage);
  }
  showSingleLightboxImage(state.catalog, targetPage, src);
}

function enterViewerScrollIsolatedZoom(nextZoom, focalClientX = null, focalClientY = null) {
  if (!isScrollViewerMode() || !state.catalog) return false;

  const page = clampPage(state.page, state.catalog);
  const focal = getViewerScrollFrameFocal(page, focalClientX, focalClientY);
  const naturalSize = pageSize(state.catalog, page);
  const stageRect = els.stageCanvas?.getBoundingClientRect?.();
  if (!naturalSize || !stageRect) return false;

  state.viewerScrollIsolatedZoom = true;
  state.viewerScrollIsolatedPage = page;
  state.singleImageFitOriginPending = false;
  state.panX = 0;
  state.panY = 0;
  syncViewerScrollIsolatedZoomUi();

  const layout = applyLightboxFrameGeometry(naturalSize.width, naturalSize.height);
  const zoom = clampViewerZoom(nextZoom);
  if (layout && focal) {
    const contentX = (focal.ratioX - 0.5) * layout.width;
    const contentY = (focal.ratioY - 0.5) * layout.height;
    const centerX = stageRect.left + stageRect.width / 2;
    const centerY = stageRect.top + stageRect.height / 2;
    state.panX = focal.clientX - centerX - contentX * zoom;
    state.panY = focal.clientY - centerY - contentY * zoom;
  }

  state.zoom = zoom;
  applySingleZoom();
  prepareViewerScrollIsolatedImage(page);
  return true;
}

function exitViewerScrollIsolatedZoom(options = {}) {
  if (!state.viewerScrollIsolatedZoom) return false;
  const { restorePage = true, nextZoom = AUTO_VIEWER_ZOOM } = options;

  state.viewerScrollIsolatedZoom = false;
  state.viewerScrollIsolatedPage = 0;
  state.singleImageLoadToken += 1;
  state.zoom = clampViewerZoom(nextZoom);
  resetImagePosition();
  state.pointers.clear();
  syncViewerScrollIsolatedZoomUi();
  els.lightboxImageFrame?.classList.remove("page-swap-enter", "is-preparing-swap");
  setViewerLoading(false);
  els.lightbox?.classList.remove("is-page-loading");
  applyViewerScrollZoom(null, { immediate: true });
  els.lightbox?.classList.toggle("is-zoomed", !isAutoViewerZoom());
  syncViewerAutoZoomButtonUi();

  if (restorePage) {
    requestAnimationFrame(() => scrollViewerToPage(state.page, { behavior: "auto" }));
  }
  return true;
}

function resumeViewerScrollFromIsolatedZoom(deltaX = 0, deltaY = 0) {
  if (!isViewerScrollIsolatedZoom()) return false;
  exitViewerScrollIsolatedZoom({ restorePage: true, nextZoom: AUTO_VIEWER_ZOOM });
  requestAnimationFrame(() => {
    const container = els.viewerScrollPages;
    if (!container) return;
    container.scrollBy({
      left: Number.isFinite(deltaX) ? deltaX : 0,
      top: Number.isFinite(deltaY) ? deltaY : 0,
      behavior: "auto"
    });
  });
  return true;
}

function panViewerScrollIsolatedZoomByWheel(deltaX = 0, deltaY = 0) {
  if (!isViewerScrollIsolatedZoom()) return false;

  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return false;

  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const previousPanX = state.panX;
  const previousPanY = state.panY;

  // A normal wheel/trackpad gesture first pans the enlarged standalone image.
  // Only the vertical remainder that cannot be consumed inside the image is
  // handed back to the continuous viewer, so reaching an edge feels like one
  // uninterrupted scroll instead of an immediate zoom dismissal.
  state.panX = previousPanX - safeDeltaX;
  state.panY = previousPanY - safeDeltaY;
  clampSinglePan();

  const moved = Math.abs(state.panX - previousPanX) > 0.01 || Math.abs(state.panY - previousPanY) > 0.01;
  if (moved) {
    state.singleImageFitOriginPending = false;
    applySingleZoom();
  }

  const consumedDeltaY = previousPanY - state.panY;
  const remainingDeltaY = safeDeltaY - consumedDeltaY;
  const hasVerticalExitIntent = Math.abs(safeDeltaY) > Math.abs(safeDeltaX) * 0.5;
  if (hasVerticalExitIntent && Math.abs(remainingDeltaY) > 0.75) {
    resumeViewerScrollFromIsolatedZoom(0, remainingDeltaY);
  }

  return true;
}

function runViewerScrollPageSwapAnimation(page) {
  const frame = getViewerScrollPageFrame(page);
  if (!frame) return;

  // The target page has already been positioned with an immediate jump. Reuse
  // the single-page viewer's entrance mechanism so arrows, rail selection and
  // touch swipes all produce one identical non-scrolling transition.
  runViewerPageSwapAnimation(frame, {
    timerKey: "viewerScrollPageAnimationTimer",
    root: els.viewerScrollPages
  });
}

function getViewerScrollZoomAnchor(clientX = null, clientY = null) {
  const container = els.viewerScrollPages;
  if (!container || !isScrollViewerMode()) return null;

  const containerRect = container.getBoundingClientRect?.();
  if (!containerRect?.width || !containerRect?.height) return null;

  const viewportX = Number.isFinite(clientX)
    ? clampValue(clientX - containerRect.left, 0, containerRect.width)
    : containerRect.width / 2;
  const viewportY = Number.isFinite(clientY)
    ? clampValue(clientY - containerRect.top, 0, containerRect.height)
    : containerRect.height / 2;
  const pointX = containerRect.left + viewportX;
  const pointY = containerRect.top + viewportY;

  let frame = document.elementFromPoint?.(pointX, pointY)?.closest?.("[data-scroll-page]") || null;
  if (!frame || !container.contains(frame)) {
    frame = getViewerScrollPageFrame(findViewerScrollCenterPage());
  }
  if (!frame) return null;

  const frameRect = frame.getBoundingClientRect?.();
  if (!frameRect?.width || !frameRect?.height) return null;

  return {
    page: Number.parseInt(frame.dataset.scrollPage, 10) || state.page,
    ratioX: clampValue((pointX - frameRect.left) / frameRect.width, 0, 1),
    ratioY: clampValue((pointY - frameRect.top) / frameRect.height, 0, 1),
    viewportX,
    viewportY
  };
}

function restoreViewerScrollZoomAnchor(anchor) {
  const container = els.viewerScrollPages;
  if (!container || !anchor) return false;
  const frame = getViewerScrollPageFrame(anchor.page);
  if (!frame) return false;

  const targetLeft = frame.offsetLeft + frame.offsetWidth * anchor.ratioX - anchor.viewportX;
  const targetTop = frame.offsetTop + frame.offsetHeight * anchor.ratioY - anchor.viewportY;
  const maxLeft = Math.max(0, container.scrollWidth - container.clientWidth);
  const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);

  container.scrollLeft = clampValue(targetLeft, 0, maxLeft);
  container.scrollTop = clampValue(targetTop, 0, maxTop);
  return true;
}

function flushViewerScrollZoom() {
  const container = els.viewerScrollPages;
  state.viewerScrollZoomRaf = 0;
  if (!container || !isScrollViewerMode() || isViewerScrollIsolatedZoom()) {
    state.viewerScrollZoomAnchor = null;
    return;
  }

  const zoom = Math.min(AUTO_VIEWER_ZOOM, getSafeViewerZoom());
  container.querySelectorAll("[data-scroll-page]").forEach((frame) => {
    const baseWidth = Number(frame.dataset.scrollBaseWidth);
    const baseHeight = Number(frame.dataset.scrollBaseHeight);
    if (!Number.isFinite(baseWidth) || !Number.isFinite(baseHeight)) return;
    frame.style.setProperty("--viewer-scroll-page-width", `${Math.max(1, Math.round(baseWidth * zoom))}px`);
    frame.style.setProperty("--viewer-scroll-page-height", `${Math.max(1, Math.round(baseHeight * zoom))}px`);
  });

  const anchor = state.viewerScrollZoomAnchor;
  state.viewerScrollZoomAnchor = null;
  if (anchor) restoreViewerScrollZoomAnchor(anchor);
}

function applyViewerScrollZoom(anchor = null, options = {}) {
  if (anchor) state.viewerScrollZoomAnchor = anchor;
  if (options.immediate) {
    if (state.viewerScrollZoomRaf) cancelAnimationFrame(state.viewerScrollZoomRaf);
    flushViewerScrollZoom();
    return;
  }

  if (!state.viewerScrollZoomRaf) {
    state.viewerScrollZoomRaf = requestAnimationFrame(flushViewerScrollZoom);
  }
}

function refreshViewerScrollPageGeometry(options = {}) {
  if (!isScrollViewerMode() || !els.viewerScrollPages || !state.catalog) return;
  const { preservePage = false, zoomAnchor = null } = options;
  const currentPage = state.page;

  els.viewerScrollPages.querySelectorAll("[data-scroll-page]").forEach((frame) => {
    const page = Number.parseInt(frame.dataset.scrollPage, 10);
    if (!Number.isFinite(page)) return;
    const layout = getViewerScrollPageLayout(page);
    frame.dataset.scrollBaseWidth = String(layout.width);
    frame.dataset.scrollBaseHeight = String(layout.height);
  });

  applyViewerScrollZoom(zoomAnchor, { immediate: true });

  if (preservePage && !zoomAnchor) {
    // Reading the target offsets after the CSS variables changed forces the
    // new geometry to be resolved now. Recenter in the same task so an
    // over-wide fit-height page can never be painted against an edge first.
    scrollViewerToPage(currentPage, { behavior: "auto" });
  }
}

function renderViewerScrollPages() {
  const container = els.viewerScrollPages;
  const catalog = state.catalog;
  if (!container || !catalog || isFavoritesLightboxMode()) return;

  const alreadyRendered = state.viewerScrollCatalogId === catalog.id
    && container.children.length === catalog.pages;
  if (!alreadyRendered) {
    state.viewerScrollLoadToken += 1;
    state.viewerScrollCatalogId = catalog.id;
    const title = escapeHtml(catalog.title || "קטלוג");
    const zoom = Math.min(AUTO_VIEWER_ZOOM, getSafeViewerZoom());
    container.innerHTML = Array.from({ length: catalog.pages }, (_unused, index) => {
      const page = index + 1;
      const size = pageSize(catalog, page) || { width: 1400, height: 1000 };
      const layout = getViewerScrollPageLayout(page);
      const width = Math.max(1, Math.round(layout.width * zoom));
      const height = Math.max(1, Math.round(layout.height * zoom));
      return `
        <div class="viewer-scroll-page viewer-scroll-page-frame image-placeholder-frame image-loading" data-scroll-page="${page}" data-scroll-base-width="${layout.width}" data-scroll-base-height="${layout.height}" role="listitem" aria-label="${title}, עמוד ${page}" style="--viewer-scroll-page-width:${width}px;--viewer-scroll-page-height:${height}px;aspect-ratio:${size.width} / ${size.height}">
          <img data-viewer-scroll-image="${page}" alt="${title} - עמוד ${page}" draggable="false" decoding="async" />
          <span class="viewer-scroll-page-number" aria-hidden="true">${page}</span>
        </div>
      `;
    }).join("");
  }

  refreshViewerScrollPageGeometry();
  loadViewerScrollWindow(state.page);
}

function loadViewerScrollPage(page, priority = "low") {
  if (!isScrollViewerMode() || !state.catalog) return;
  const frame = getViewerScrollPageFrame(page);
  const image = frame?.querySelector?.("[data-viewer-scroll-image]");
  if (!image) return;

  const src = pageSrc(state.catalog, page);
  if (image.dataset.loadedSrc === src || image.dataset.loadingSrc === src) return;
  image.dataset.loadingSrc = src;
  image.loading = priority === "high" ? "eager" : "lazy";
  image.fetchPriority = priority;
  prepareImagePlaceholder(image);

  const token = state.viewerScrollLoadToken;
  let settled = false;
  const settle = (loaded) => {
    if (settled) return;
    settled = true;
    if (token !== state.viewerScrollLoadToken || !isScrollViewerMode() || !state.catalog) return;
    if (pageSrc(state.catalog, page) !== src || image.getAttribute("src") !== src) return;

    delete image.dataset.loadingSrc;
    if (loaded) {
      image.dataset.loadedSrc = src;
    } else {
      delete image.dataset.loadedSrc;
      telemetryTrackImageFailure(src, { detail: "viewer-scroll" });
    }
    syncImagePlaceholderState(image);
  };

  image.addEventListener("load", () => settle(true), { once: true });
  image.addEventListener("error", () => settle(false), { once: true });

  // Assign the request to the element the user actually sees. Preloading with
  // a separate Image used to gate this assignment and could leave the frame
  // forever empty when a large WebP decode stalled or memory became tight.
  setCatalogImageSource(image, src);
  if (image.complete) queueMicrotask(() => settle(Boolean(image.naturalWidth)));
}

function loadViewerScrollWindow(centerPage) {
  if (!state.catalog || !isScrollViewerMode()) return;
  const center = clampPage(centerPage, state.catalog);
  for (let page = Math.max(1, center - 2); page <= Math.min(state.catalog.pages, center + 2); page += 1) {
    loadViewerScrollPage(page, page === center ? "high" : "low");
  }
}

function clearViewerScrollTarget() {
  window.clearTimeout(state.viewerScrollSettleTimer);
  state.viewerScrollSettleTimer = 0;
  state.viewerScrollTargetPage = 0;
}

function resetViewerScrollCommandSequence() {
  state.viewerScrollLastCommandAt = 0;
}

function clearViewerScrollWheelGesture() {
  window.clearTimeout(state.viewerScrollWheelSettleTimer);
  state.viewerScrollWheelSettleTimer = 0;
  state.viewerScrollWheelAccumulator = 0;
  state.viewerScrollWheelBasePage = 0;
  state.viewerScrollWheelTargetPage = 0;
}

function getViewerScrollPagePosition(page) {
  const container = els.viewerScrollPages;
  const frame = getViewerScrollPageFrame(page);
  if (!container || !frame) return null;

  return {
    top: Math.max(0, frame.offsetTop - Math.max(0, (container.clientHeight - frame.offsetHeight) / 2)),
    // Center pages on the horizontal viewport even when fit-height makes them
    // wider than the container. Clamping the size difference before subtracting
    // it leaves over-wide pages at scrollLeft 0 and exposes only one side.
    left: Math.max(0, frame.offsetLeft + (frame.offsetWidth - container.clientWidth) / 2)
  };
}

function settleViewerScrollWheelGesture() {
  const targetPage = state.viewerScrollWheelTargetPage || state.page;
  clearViewerScrollWheelGesture();
  if (!isScrollViewerMode() || !state.catalog) return;
  loadViewerScrollWindow(targetPage);
  // Wheel and precision-touchpad gestures are page commands. Settlement must
  // preserve the exact page position rather than introduce a native smooth
  // scroll after the final input event.
  scrollViewerToPage(targetPage);
}

function normalizeViewerScrollWheelDelta(event) {
  const rawDelta = Number(event?.deltaY) || 0;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;

  // One page-mode unit already represents one deliberate page command. Line
  // and pixel modes are normalized through the shared pixel converter so a
  // three-line mouse detent (~108 px) and a 100 px precision-wheel stream carry
  // the same intent instead of following browser-specific native distances.
  if (event?.deltaMode === pageMode) return rawDelta * VIEWER_SCROLL_WHEEL_PAGE_DELTA_PX;
  return normalizeWheelDeltaToPixels(rawDelta, event?.deltaMode, els.viewerScrollPages?.clientHeight || 0);
}

function getViewerScrollWheelRequestedSteps(accumulator) {
  const signedAccumulator = Number(accumulator) || 0;
  const magnitude = Math.abs(signedAccumulator);
  if (magnitude < VIEWER_SCROLL_WHEEL_FIRST_PAGE_DELTA_PX) return 0;

  // The first committed page deliberately has a lower activation threshold so
  // a precision touchpad does not need to land inside a narrow 100–199 px band.
  // After activation, every additional page keeps the original 100 px cadence:
  // 20–199 => one page, 200–299 => two pages, 300–399 => three pages, and so on.
  const wholePageSteps = Math.trunc(magnitude / VIEWER_SCROLL_WHEEL_PAGE_DELTA_PX);
  return Math.sign(signedAccumulator) * Math.max(1, wholePageSteps);
}

function handleViewerScrollWheel(event) {
  const container = els.viewerScrollPages;
  if (!state.lightboxOpen || !isScrollViewerMode() || isViewerScrollIsolatedZoom() || !state.catalog || !container) {
    return false;
  }

  const deltaY = normalizeViewerScrollWheelDelta(event);
  const deltaX = normalizeWheelDeltaToPixels(
    Number(event?.deltaX) || 0,
    event?.deltaMode,
    container.clientWidth
  );
  if (!Number.isFinite(deltaY) || Math.abs(deltaY) < 0.01) return false;

  // Preserve deliberate horizontal panning for fit-height pages that overflow
  // sideways. Every vertically dominant wheel stream—mouse or touchpad—uses
  // the exact same page-intent accumulator below.
  if (Math.abs(deltaX) > Math.abs(deltaY)) return false;

  event.preventDefault();

  const gestureStarted = !state.viewerScrollWheelBasePage;
  if (gestureStarted) {
    const intendedPage = state.viewerScrollTargetPage || findViewerScrollCenterPage() || state.page;
    clearViewerScrollTarget();
    state.viewerScrollWheelBasePage = clampPage(intendedPage, state.catalog);
    state.viewerScrollWheelTargetPage = state.viewerScrollWheelBasePage;
    state.viewerScrollWheelAccumulator = 0;
  }

  state.viewerScrollWheelAccumulator += deltaY;
  const requestedSteps = getViewerScrollWheelRequestedSteps(
    state.viewerScrollWheelAccumulator
  );
  const targetPage = clampPage(state.viewerScrollWheelBasePage + requestedSteps, state.catalog);
  const previousTargetPage = state.viewerScrollWheelTargetPage;
  state.viewerScrollWheelTargetPage = targetPage;

  // Pixel-mode touchpads report one gesture as many small wheel events, while a
  // mouse detent often reaches the page threshold in a single event. Those
  // sub-threshold values are input intent only: applying them to scrollTop made
  // touchpads visibly drag the current image before the same page swap that a
  // mouse performs immediately. Keep the viewport locked to an exact page and
  // move it only when the shared accumulator commits one or more whole steps.
  if (gestureStarted || targetPage !== previousTargetPage) {
    loadViewerScrollWindow(targetPage);
    const position = getViewerScrollPagePosition(targetPage);
    if (position) {
      container.scrollTop = position.top;
      container.scrollLeft = position.left;
    }
  }
  syncViewerScrollActivePage(targetPage);
  if (targetPage !== previousTargetPage) runViewerScrollPageSwapAnimation(targetPage);

  window.clearTimeout(state.viewerScrollWheelSettleTimer);
  state.viewerScrollWheelSettleTimer = window.setTimeout(
    settleViewerScrollWheelGesture,
    VIEWER_SCROLL_WHEEL_SETTLE_MS
  );
  return true;
}

function shouldJumpViewerScrollCommand(options = {}) {
  const now = performance.now();
  const elapsed = state.viewerScrollLastCommandAt > 0
    ? now - state.viewerScrollLastCommandAt
    : Number.POSITIVE_INFINITY;
  const isRapidFollowUp = elapsed <= VIEWER_SCROLL_MULTI_COMMAND_WINDOW_MS;
  state.viewerScrollLastCommandAt = now;

  // A single page command keeps the polished smooth movement. Once another
  // command joins the same sequence, native smooth scrolling becomes a queue:
  // each destination is animated from an in-flight position and held keys feel
  // progressively slower. Jumping the accumulated destination cancels that
  // native animation immediately while preserving exact page alignment.
  return Boolean(options.repeated || isRapidFollowUp || state.viewerScrollTargetPage);
}

function scrollViewerToPage(page, options = {}) {
  const container = els.viewerScrollPages;
  if (!container) return false;
  const targetPage = state.catalog ? clampPage(page, state.catalog) : Number(page) || 1;
  const behavior = options.behavior === "smooth" ? "smooth" : "auto";
  const position = getViewerScrollPagePosition(targetPage);
  if (!position) return false;
  const { top, left } = position;

  clearViewerScrollWheelGesture();
  clearViewerScrollTarget();
  if (behavior === "smooth") {
    state.viewerScrollTargetPage = targetPage;
    state.viewerScrollSettleTimer = window.setTimeout(() => {
      state.viewerScrollSettleTimer = 0;
      state.viewerScrollTargetPage = 0;
      syncViewerScrollActivePage(findViewerScrollCenterPage());
    }, 760);
    container.scrollTo({ top, left, behavior: "smooth" });
  } else {
    // Direct assignment deliberately bypasses CSS/native smooth scrolling. A
    // far-away rail selection must not make the browser animate every page in
    // between or decode them while travelling to the destination.
    container.scrollTop = top;
    container.scrollLeft = left;
    syncViewerScrollActivePage(targetPage);
  }

  // The scroll-mode page change may itself run inside requestAnimationFrame.
  // Starting the animation in another frame lets the fully visible target page
  // paint once before it jumps back to the animation's start state. Apply the
  // class synchronously after positioning so the first paint already contains
  // the same fade/blur/scale start state as the single-page viewer.
  if (options.animate) runViewerScrollPageSwapAnimation(targetPage);
  return true;
}

function findViewerScrollCenterPage() {
  const container = els.viewerScrollPages;
  const frames = container?.children;
  if (!container || !frames?.length) return state.page;

  const target = container.scrollTop + container.clientHeight / 2;
  let low = 0;
  let high = frames.length - 1;
  let best = frames[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const frame = frames[mid];
    const center = frame.offsetTop + frame.offsetHeight / 2;
    const distance = Math.abs(center - target);
    if (distance < bestDistance) {
      best = frame;
      bestDistance = distance;
    }
    if (center < target) low = mid + 1;
    else high = mid - 1;
  }

  return Number.parseInt(best.dataset.scrollPage, 10) || state.page;
}

function syncViewerScrollActivePage(page) {
  if (!state.catalog || !isScrollViewerMode()) return;
  const nextPage = clampPage(page, state.catalog);
  loadViewerScrollWindow(nextPage);

  if (state.viewerScrollTargetPage) {
    if (nextPage !== state.viewerScrollTargetPage) return;
    clearViewerScrollTarget();
  }

  if (nextPage === state.page) return;

  state.page = nextPage;
  els.lightboxMeta.textContent = `עמוד ${state.page} מתוך ${state.catalog.pages}`;
  syncLightboxProgress(state.page, state.catalog.pages, `עמוד ${state.page} מתוך ${state.catalog.pages}`, {
    label: "עמוד"
  });
  els.prevPageBtn.disabled = state.page <= 1;
  els.nextPageBtn.disabled = state.page >= state.catalog.pages;
  syncViewerFavoriteButtonUi();
  updateLightboxThumbs({ scrollIntoView: false });
  updateHash();
}

function handleViewerScrollPagesScroll() {
  if (!isScrollViewerMode() || state.viewerScrollRaf) return;
  state.viewerScrollRaf = requestAnimationFrame(() => {
    state.viewerScrollRaf = 0;
    syncViewerScrollActivePage(findViewerScrollCenterPage());
  });
}

function scrollViewerByViewport(direction, options = {}) {
  if (!isScrollViewerMode() || !els.viewerScrollPages || !state.catalog) return false;

  const step = direction > 0 ? 1 : direction < 0 ? -1 : 0;
  if (!step) return true;

  // Keyboard page navigation is page-based, not distance-based. Using a
  // percentage of the viewport made repeated presses accumulate from an
  // in-flight scroll position and could stop halfway through a page. While a
  // smooth navigation is running, build the next press from its intended page
  // so every command has one stable, exact destination.
  const basePage = state.viewerScrollTargetPage || state.page;
  const targetPage = clampPage(basePage + step, state.catalog);
  if (targetPage === basePage) return true;
  const jumpImmediately = shouldJumpViewerScrollCommand(options);

  if (isViewerScrollIsolatedZoom()) {
    exitViewerScrollIsolatedZoom({ restorePage: false, nextZoom: AUTO_VIEWER_ZOOM });
  }

  loadViewerScrollWindow(targetPage);
  scrollViewerToPage(targetPage, {
    behavior: jumpImmediately ? "auto" : "smooth",
    animate: jumpImmediately
  });
  return true;
}

function setViewerLayoutMode(layoutMode, options = {}) {
  const requestedMode = normalizeViewerLayoutMode(layoutMode);
  const nextMode = isFavoritesLightboxMode() ? VIEWER_LAYOUT_SIDE : requestedMode;
  const changed = nextMode !== state.viewerLayoutMode;
  state.viewerLayoutMode = nextMode;
  if (!isFavoritesLightboxMode() && options.persist !== false) {
    writeViewerLayoutPreference(nextMode);
  }
  state.viewerScrollIsolatedZoom = false;
  state.viewerScrollIsolatedPage = 0;
  state.zoom = AUTO_VIEWER_ZOOM;
  resetImagePosition({ queueSingleFitOrigin: true });
  state.pointers.clear();
  hideViewerZoomIndicator();
  state.singleImageLoadToken += 1;
  clearViewerScrollWheelGesture();
  clearViewerScrollTarget();
  resetViewerScrollCommandSequence();
  syncViewerLayoutModeUi();

  if (isScrollViewerMode()) {
    setViewerLoading(false);
    els.lightbox?.classList.remove("is-page-loading", "is-zoomed");
    renderViewerScrollPages();
    const positionActivePage = () => scrollViewerToPage(state.page, {
      behavior: options.behavior || "auto"
    });
    if (options.behavior === "smooth") requestAnimationFrame(positionActivePage);
    else positionActivePage();
  } else if (state.lightboxOpen && state.catalog) {
    updateLightbox();
  }

  if (changed && options.showUi !== false) showTopUiTemporarily(1800);
}

function toggleViewerLayoutMode() {
  setViewerLayoutMode(isScrollViewerMode() ? VIEWER_LAYOUT_SIDE : VIEWER_LAYOUT_SCROLL);
}

function updateLightbox(options = {}) {
  if (!state.catalog) return;
  const {
    thumbScrollIntoView = true,
    scrollToPage = false,
    scrollBehavior = "auto",
    animateScrollPage = false
  } = options;
  let favoriteEntries = null;

  if (isFavoritesLightboxMode()) {
    favoriteEntries = getFavoriteEntries();
    if (!favoriteEntries.length) {
      closeLightbox({ restoreFavorites: true });
      return;
    }

    const currentIndex = findFavoriteEntryIndex(favoriteEntries, state.catalog?.id, state.page);
    setFavoriteViewerEntry(favoriteEntries, currentIndex >= 0 ? currentIndex : state.favoritesViewerIndex);
  }

  const catalog = state.catalog;
  state.page = clampPage(state.page, catalog);
  syncLightboxModeUi();

  els.lightboxTitle.textContent = catalog.title;
  if (favoriteEntries) {
    const current = state.favoritesViewerIndex + 1;
    const total = favoriteEntries.length;
    els.lightboxMeta.textContent = `מועדף ${current} מתוך ${total} · עמוד ${state.page}`;
    syncLightboxProgress(current, total, `מועדף ${current} מתוך ${total} · עמוד ${state.page}`, {
      label: "מועדף",
      detail: `עמוד ${state.page}`
    });
    els.prevPageBtn.disabled = state.favoritesViewerIndex <= 0;
    els.nextPageBtn.disabled = state.favoritesViewerIndex >= total - 1;
  } else {
    els.lightboxMeta.textContent = `עמוד ${state.page} מתוך ${catalog.pages}`;
    syncLightboxProgress(state.page, catalog.pages, `עמוד ${state.page} מתוך ${catalog.pages}`, {
      label: "עמוד"
    });
    els.prevPageBtn.disabled = state.page <= 1;
    els.nextPageBtn.disabled = state.page >= catalog.pages;
  }

  syncViewerFavoriteButtonUi();
  if (!favoriteEntries) initLightboxSearchStatus();

  if (!favoriteEntries && isScrollViewerMode()) {
    state.singleImageLoadToken += 1;
    setViewerLoading(false);
    els.lightbox?.classList.remove("is-page-loading", "is-zoomed");
    renderViewerScrollPages();
    loadViewerScrollWindow(state.page);
    if (scrollToPage) {
      const positionActivePage = () => scrollViewerToPage(state.page, {
        behavior: scrollBehavior,
        animate: animateScrollPage
      });
      if (scrollBehavior === "smooth") requestAnimationFrame(positionActivePage);
      else positionActivePage();
    }
    updateLightboxThumbs({ scrollIntoView: thumbScrollIntoView });
    updateHash();
    return;
  }

  const src = pageSrc(catalog, state.page);
  const currentSrc = els.lightboxImage.getAttribute("src");
  if (currentSrc !== src) {
    showSingleLightboxImage(catalog, state.page, src);
  } else {
    setViewerLoading(false);
    els.lightbox?.classList.remove("is-page-loading");
    applyZoom();
  }

  updateLightboxThumbs({ scrollIntoView: thumbScrollIntoView });
  preloadNeighbors();
  updateHash();
}

function syncDocumentLock() {
  const modalFavoritesOpen = state.favoritesOpen && !isAppPage("favorites");
  const transferOpen = Boolean(state.favoritesTransferPending);
  document.body.classList.toggle("no-scroll", state.lightboxOpen || modalFavoritesOpen || transferOpen);
  document.documentElement.classList.toggle("viewer-open", state.lightboxOpen);
}

function openLightbox(page = 1, options = {}) {
  if (!state.catalog) return;
  const source = options.source === LIGHTBOX_SOURCE_FAVORITES
    ? LIGHTBOX_SOURCE_FAVORITES
    : LIGHTBOX_SOURCE_CATALOG;

  if (!isAppPage("viewer")) {
    navigateTo(viewerDocumentUrl(state.catalog.id, page, { source }));
    return;
  }

  state.lightboxSource = source;
  if (source === LIGHTBOX_SOURCE_FAVORITES) {
    state.favoritesViewerIndex = Math.max(0, Number.parseInt(options.favoriteIndex, 10) || 0);
  } else {
    state.favoritesViewerIndex = 0;
    state.favoritesViewerOpeningHash = "";
    state.favoritesViewerPreviousCatalog = null;
    state.favoritesViewerPreviousPage = 1;
    state.favoritesReturnFocus = null;
  }
  state.imageFitMode = VIEWER_FIT_HEIGHT;
  state.viewerLayoutMode = source === LIGHTBOX_SOURCE_FAVORITES
    ? VIEWER_LAYOUT_SIDE
    : readViewerLayoutPreference();
  state.viewerScrollCatalogId = "";
  state.viewerScrollLoadToken += 1;
  state.viewerScrollIsolatedZoom = false;
  state.viewerScrollIsolatedPage = 0;
  state.page = clampPage(page, state.catalog);
  state.zoom = AUTO_VIEWER_ZOOM;
  resetImagePosition({ queueSingleFitOrigin: true });
  state.pointers.clear();
  hideViewerZoomIndicator();
  state.lightboxOpen = true;
  telemetryTrackCatalogOpen(state.catalog, state.page, state.lightboxSource);
  primeLightboxFrameForCatalogPage(state.catalog, state.page);
  const initialSrc = pageSrc(state.catalog, state.page);
  if (els.lightboxImage?.getAttribute("src") !== initialSrc) {
    els.lightboxImage?.removeAttribute("src");
    prepareImagePlaceholder(els.lightboxImage);
    els.lightboxImageFrame?.classList.remove("page-swap-enter");
  }
  els.lightbox.classList.remove("hidden");
  els.lightbox.classList.remove("show-ui", "show-page-rail");
  syncTopUiPinnedUi();
  syncDocumentLock();
  renderLightboxPageRail();
  if (!isFavoritesLightboxMode()) renderLightboxCatalogMenu();
  resetLightboxSearch();
  syncLightboxModeUi();
  showTopUiTemporarily(1700);
  updateLightbox({
    scrollToPage: isScrollViewerMode(),
    scrollBehavior: "auto",
    animateScrollPage: false
  });
  scheduleCatalogScrollTopButtonUpdate();
  window.requestAnimationFrame(showViewerOnboardingIfNeeded);

}

function hideLightboxUi() {
  closeViewerOnboarding({ restoreFocus: false });
  state.lightboxOpen = false;
  state.lightboxMobileSearchOpen = false;
  syncLightboxMobileSearchUi();
  state.singleImageLoadToken += 1;
  state.viewerScrollLoadToken += 1;
  state.viewerLayoutMode = VIEWER_LAYOUT_SIDE;
  state.viewerScrollCatalogId = "";
  if (state.viewerScrollRaf) cancelAnimationFrame(state.viewerScrollRaf);
  state.viewerScrollRaf = 0;
  if (state.viewerScrollZoomRaf) cancelAnimationFrame(state.viewerScrollZoomRaf);
  state.viewerScrollZoomRaf = 0;
  state.viewerScrollZoomAnchor = null;
  state.viewerScrollIsolatedZoom = false;
  state.viewerScrollIsolatedPage = 0;
  window.clearTimeout(state.viewerScrollPageAnimationTimer);
  state.viewerScrollPageAnimationTimer = 0;
  clearViewerScrollWheelGesture();
  clearViewerScrollTarget();
  resetViewerScrollCommandSequence();
  window.clearTimeout(state.singleImageAnimationTimer);
  if (els.viewerScrollPages) els.viewerScrollPages.innerHTML = "";
  els.lightbox?.classList.add("hidden");
  els.lightbox?.classList.remove("show-ui", "show-page-rail", "catalog-entry-mode", "favorites-viewer-mode", "viewer-layout-scroll", "viewer-scroll-zoom-isolated", "is-page-loading", "is-zoomed");
  syncViewerAutoZoomButtonUi();
  hideViewerZoomIndicator();
  els.lightboxImageFrame?.classList.remove("page-swap-enter");
  setViewerLoading(false);
  hideLightboxFloatingPreview();
  window.clearTimeout(state.uiHideTimer);
  window.clearTimeout(state.pageRailHideTimer);
  hideViewerPageIndicator();
  scheduleCatalogScrollTopButtonUpdate();
  state.lightboxSource = LIGHTBOX_SOURCE_CATALOG;
  syncDocumentLock();
}

function closeLightbox(options = {}) {
  const wasFavoritesViewer = isFavoritesLightboxMode();
  const { restoreFavorites = wasFavoritesViewer } = options;

  if (isAppPage("viewer")) {
    if ((hasInDocumentRouteSession || canReturnToSameSite()) && window.history.length > 1) {
      navigateBack();
      return;
    }
    const destination = wasFavoritesViewer && restoreFavorites
      ? favoritesDocumentUrl()
      : catalogDocumentUrl(state.catalog?.id);
    navigateTo(destination || homeDocumentUrl(), { replace: true });
    return;
  }

  hideLightboxUi();
}

function setLightboxPage(page, options = {}) {
  if (!state.catalog) return;
  const nextPage = clampPage(page, state.catalog);

  // Boundary navigation must be a true no-op. Previously the clamped page was
  // rendered again, which retriggered the scroll-page jump animation even
  // though the viewer was already on page 1 or on the final page.
  if (nextPage === state.page) return;

  const {
    thumbScrollIntoView = true,
    keepZoom = true,
    resetZoom = false,
    resetPosition = isAutoViewerZoom()
  } = options;
  const shouldResetZoom = resetZoom || keepZoom === false;
  const shouldResetPosition = shouldResetZoom || resetPosition;

  hideLightboxFloatingPreview();
  if (isViewerScrollIsolatedZoom()) {
    exitViewerScrollIsolatedZoom({ restorePage: false, nextZoom: AUTO_VIEWER_ZOOM });
  } else if (shouldResetZoom) {
    state.zoom = AUTO_VIEWER_ZOOM;
  }

  // Auto zoom gets a clean page origin. Manual zoom keeps the same pan between
  // pages, so moving with arrows or selecting a page does not reopen the next
  // image unexpectedly higher/lower after the user already positioned it.
  if (shouldResetPosition) {
    resetImagePosition({ queueSingleFitOrigin: true });
  } else if (shouldPreserveSingleManualPosition({ keepZoom, resetZoom, resetPosition })) {
    state.singleImageFitOriginPending = false;
  }
  state.pointers.clear();
  state.page = nextPage;
  updateLightbox({
    thumbScrollIntoView,
    scrollToPage: isScrollViewerMode(),
    scrollBehavior: isScrollViewerMode() ? "auto" : (options.scrollBehavior || "smooth"),
    animateScrollPage: isScrollViewerMode() && options.animateScrollPage !== false
  });

}

function setFavoriteViewerIndex(index, options = {}) {
  if (!isFavoritesLightboxMode()) return;
  const entries = getFavoriteEntries();
  if (!entries.length) {
    closeLightbox({ restoreFavorites: true });
    return;
  }

  const {
    thumbScrollIntoView = true,
    keepZoom = true,
    resetZoom = false,
    resetPosition = isAutoViewerZoom()
  } = options;
  const nextIndex = clampValue(Number.parseInt(index, 10) || 0, 0, entries.length - 1);
  const entry = entries[nextIndex];
  const itemChanged = nextIndex !== state.favoritesViewerIndex || state.catalog !== entry.catalog || state.page !== entry.page;
  const shouldResetZoom = resetZoom || keepZoom === false;
  const shouldResetPosition = shouldResetZoom || resetPosition;

  if (itemChanged) {
    hideLightboxFloatingPreview();
    if (shouldResetZoom) state.zoom = AUTO_VIEWER_ZOOM;
    if (shouldResetPosition) {
      resetImagePosition({ queueSingleFitOrigin: true });
    } else if (shouldPreserveSingleManualPosition({ keepZoom, resetZoom, resetPosition })) {
      state.singleImageFitOriginPending = false;
    }
    state.pointers.clear();
  }

  setFavoriteViewerEntry(entries, nextIndex);
  updateLightbox({ thumbScrollIntoView });
}

function moveLightbox(delta) {
  if (!state.catalog) return;
  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex(state.favoritesViewerIndex + delta);
    return;
  }
  setLightboxPage(state.page + delta);
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


function openCatalog(id, options = {}) {
  const { scroll = false, openPage = null, scrollBehavior = "smooth" } = options;
  const catalog = catalogs.find((item) => item.id === id) || null;
  if (!catalog) return;

  if (!isAppPage("catalog")) {
    navigateTo(openPage != null
      ? viewerDocumentUrl(catalog.id, openPage)
      : catalogDocumentUrl(catalog.id));
    return;
  }

  state.catalog = catalog;
  state.page = 1;
  renderCatalogDetail();
  updateHash();

  if (scroll) scrollCatalogDetailIntoView({ behavior: scrollBehavior });
  if (openPage != null) openLightbox(openPage);
}

function openCatalogInViewer(id, page = 1, options = {}) {
  const catalog = catalogs.find((item) => item.id === id) || null;
  if (!catalog) return;
  const source = options.source === LIGHTBOX_SOURCE_FAVORITES
    ? LIGHTBOX_SOURCE_FAVORITES
    : LIGHTBOX_SOURCE_CATALOG;

  if (!isAppPage("viewer")) {
    navigateTo(viewerDocumentUrl(catalog.id, page, { source }));
    return;
  }

  state.catalog = catalog;
  state.page = clampPage(page, catalog);
  renderCatalogDetail();
  openLightbox(state.page, { source, favoriteIndex: options.favoriteIndex });
}

function openCurrentFavoriteInCatalog() {
  if (!state.lightboxOpen || !isFavoritesLightboxMode() || !state.catalog) return;

  const catalogId = state.catalog.id;
  const page = state.page;

  // Re-enter through the canonical catalog-viewer lifecycle instead of
  // partially mutating favorites state in place. The old shortcut skipped the
  // scroll viewer's initial positioning step: it loaded pages around the saved
  // favorite but left scrollTop at page 1, so the visible frame had no src and
  // the user saw only the viewer background.
  openCatalogInViewer(catalogId, page, { source: LIGHTBOX_SOURCE_CATALOG });
}

function attachViewerEvents() {
  els.lightboxHomeLink?.addEventListener("click", returnToMainSiteFromLightbox);
  els.favoriteOpenCatalogButton?.addEventListener("click", openCurrentFavoriteInCatalog);
  els.lightboxPinTopBar?.addEventListener("click", () => {
    toggleTopUiPinned();
    if (state.viewerOnboardingOpen) scheduleViewerOnboardingLayout(40);
  });
  els.lightboxBackdrop?.addEventListener("click", closeLightbox);
  els.lightbox?.addEventListener("pointerdown", handleLightboxPointerDownCapture, { capture: true });
  els.fullscreenToggle?.addEventListener("click", () => toggleBrowserFullscreen(els.fullscreenToggle));
  els.viewerLayoutToggle?.addEventListener("click", toggleViewerLayoutMode);
  els.prevPageBtn?.addEventListener("click", () => moveLightbox(-1));
  els.nextPageBtn?.addEventListener("click", () => moveLightbox(1));
  els.fitHeightBtn?.addEventListener("click", () => setViewerFitMode(VIEWER_FIT_HEIGHT));
  els.fitWidthBtn?.addEventListener("click", () => setViewerFitMode(VIEWER_FIT_WIDTH));
  els.viewerAutoZoomBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
  });
  els.viewerAutoZoomBtn?.addEventListener("pointerdown", (event) => event.stopPropagation());
  els.viewerFavoriteButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleCurrentPageFavorite();
  });
  els.viewerFavoriteButton?.addEventListener("pointerdown", (event) => event.stopPropagation());
  els.stageCanvas?.addEventListener("pointerdown", handleViewerSurfacePointerDown);
  els.viewerScrollPages?.addEventListener("scroll", handleViewerScrollPagesScroll, { passive: true });

  attachViewerGestures();

  els.lightboxSideHotspot?.addEventListener("pointerdown", openPageRailFromTouch, { passive: false });
  els.lightboxSideHotspot?.addEventListener("mouseenter", showPageRailFromHover);
  els.lightboxSideHotspot?.addEventListener("mouseleave", schedulePageRailClose);
  els.lightboxSideHotspot?.addEventListener("click", openPageRailFromHotspot);
  els.lightboxPageRail?.addEventListener("pointerdown", markTouchLikeRailInput);
  els.lightboxPageRail?.addEventListener("mouseenter", keepPageRailOpenFromHover);
  els.lightboxPageRail?.addEventListener("mouseleave", (event) => {
    hideLightboxFloatingPreview();
    schedulePageRailClose(event);
  });
  els.lightbox?.addEventListener("pointerdown", handlePageRailPointerOutside);
  els.lightboxPageRail?.addEventListener("focusin", () => keepPageRailOpen({ scrollIntoView: false }));
  els.lightboxPageRail?.addEventListener("focusout", schedulePageRailClose);

  els.topHotspot?.addEventListener("mouseenter", () => showTopUiTemporarily(0));
  els.lightboxBar?.addEventListener("mouseenter", () => showTopUiTemporarily(0));
  els.lightboxBar?.addEventListener("mouseleave", scheduleTopUiClose);
  document.addEventListener("pointerdown", markTouchLikeViewportInput, { passive: true });
  document.addEventListener("touchstart", markTouchLikeViewportInput, { passive: true });
  document.addEventListener("mousemove", handleLightboxEdgeHoverMove, { passive: true });
  document.addEventListener("mouseout", handleLightboxEdgeHoverViewportExit, { passive: true });
  document.documentElement?.addEventListener("mouseleave", handleLightboxEdgeHoverViewportExit, { passive: true });

  els.lightboxImage?.addEventListener("load", () => {
    setViewerLoading(false);
    els.lightbox?.classList.remove("is-page-loading");
    applyZoom();
  });

  ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach((eventName) => {
    document.addEventListener(eventName, syncFullscreenButtonUi);
  });

  syncFullscreenButtonUi();
}
