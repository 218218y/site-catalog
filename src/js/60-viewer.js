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


function getSingleImageDisplayMetrics() {
  const image = els.lightboxImage;
  const stage = els.stageCanvas;
  if (!image?.naturalWidth || !image?.naturalHeight || !stage) return null;

  const safeZoom = getSafeViewerZoom();
  const width = image.naturalWidth * state.fitScale * safeZoom;
  const height = image.naturalHeight * state.fitScale * safeZoom;
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
  frame.style.width = `${layout.width}px`;
  frame.style.height = `${layout.height}px`;
  frame.style.aspectRatio = `${naturalWidth} / ${naturalHeight}`;
  image.style.width = "100%";
  image.style.height = "100%";
  return layout;
}

function primeLightboxFrameForCatalogPage(catalog, page) {
  const size = pageSize(catalog, page);
  if (!size) return false;
  return Boolean(applyLightboxFrameGeometry(size.width, size.height, { updateFitScale: false }));
}

function applySingleZoom() {
  const image = els.lightboxImage;
  const frame = els.lightboxImageFrame;
  if (!image?.naturalWidth || !image?.naturalHeight || !frame) return;

  applyLightboxFrameGeometry(image.naturalWidth, image.naturalHeight);

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


function applyZoom() {
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
  const pageRailIsVisible = Boolean(els.lightbox?.classList.contains("show-page-rail"));

  els.lightboxPageThumbs?.querySelectorAll(".lightbox-page-thumb").forEach((button) => {
    const active = isFavoritesLightboxMode()
      ? Number(button.dataset.favoriteIndex) === state.favoritesViewerIndex
      : Number(button.dataset.page) === state.page;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");

    if (active && scrollIntoView && pageRailIsVisible) {
      button.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  });
}

function handleLightboxPageRailSelection(button) {
  if (!button) return;

  hideLightboxFloatingPreview();

  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex(Number(button.dataset.favoriteIndex), { thumbScrollIntoView: false });
  } else {
    const targetPage = Number(button.dataset.page);
    if (!Number.isFinite(targetPage)) return;
    setLightboxPage(targetPage, { thumbScrollIntoView: false });
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
    state.zoom = AUTO_VIEWER_ZOOM;
    resetImagePosition({ queueSingleFitOrigin: true });
    state.pointers.clear();
  }

  syncViewerFitModeUi();
  applyZoom();
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

function updateLightbox(options = {}) {
  if (!state.catalog) return;
  const { thumbScrollIntoView = true } = options;
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
  state.page = clampPage(page, state.catalog);
  state.zoom = AUTO_VIEWER_ZOOM;
  resetImagePosition({ queueSingleFitOrigin: true });
  state.pointers.clear();
  hideViewerZoomIndicator();
  state.lightboxOpen = true;
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
  updateLightbox();
  scheduleCatalogScrollTopButtonUpdate();
  window.requestAnimationFrame(showViewerOnboardingIfNeeded);

}

function hideLightboxUi() {
  closeViewerOnboarding({ restoreFocus: false });
  state.lightboxOpen = false;
  state.lightboxMobileSearchOpen = false;
  syncLightboxMobileSearchUi();
  state.singleImageLoadToken += 1;
  window.clearTimeout(state.singleImageAnimationTimer);
  els.lightbox?.classList.add("hidden");
  els.lightbox?.classList.remove("show-ui", "show-page-rail", "catalog-entry-mode", "favorites-viewer-mode", "is-page-loading", "is-zoomed");
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
  const {
    thumbScrollIntoView = true,
    keepZoom = true,
    resetZoom = false,
    resetPosition = isAutoViewerZoom()
  } = options;
  const nextPage = clampPage(page, state.catalog);
  const shouldResetZoom = resetZoom || keepZoom === false;
  const shouldResetPosition = shouldResetZoom || resetPosition;

  if (nextPage !== state.page) {
    hideLightboxFloatingPreview();
    if (shouldResetZoom) {
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
  }
  state.page = nextPage;
  updateLightbox({ thumbScrollIntoView });

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

  state.lightboxSource = LIGHTBOX_SOURCE_CATALOG;
  state.favoritesViewerIndex = 0;
  state.favoritesViewerOpeningHash = "";
  state.favoritesViewerPreviousCatalog = null;
  state.favoritesViewerPreviousPage = 1;
  state.favoritesReturnFocus = null;

  renderCatalogDetail();
  renderLightboxPageRail();
  renderLightboxCatalogMenu();
  resetLightboxSearch();
  syncLightboxModeUi();
  updateLightbox();
  updateHash();
  showTopUiTemporarily(1700);
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
