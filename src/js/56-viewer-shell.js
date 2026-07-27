/**
 * Source module: 56-viewer-shell.js
 * Viewer chrome, top controls, page rail, progress indicators, and fit-mode UI.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function showTopUiTemporarily(delay = 2200) {
  if (!viewerElements.lightbox) return;
  window.clearTimeout(viewerState.uiHideTimer);
  viewerElements.lightbox.classList.add("show-ui");
  if (viewerState.topUiPinned || viewerState.viewerMobileMoreOpen) return;
  if (delay > 0) {
    viewerState.uiHideTimer = window.setTimeout(() => {
      if (!viewerState.topUiPinned && !viewerState.viewerMobileMoreOpen) viewerElements.lightbox.classList.remove("show-ui");
    }, delay);
  }
}


function getLightboxPinnedTopOffset() {
  if (!viewerState.topUiPinned || !viewerElements.lightboxBar) return 0;

  const rect = viewerElements.lightboxBar.getBoundingClientRect?.();
  const measuredHeight = rect ? Math.max(rect.height || 0, rect.bottom > 0 ? rect.bottom : 0) : 0;
  const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  const maxReasonableOffset = Math.max(0, viewportHeight * 0.42);
  return Math.round(clampValue(measuredHeight, 0, maxReasonableOffset));
}

function syncLightboxTopSafeArea() {
  if (!viewerElements.lightbox) return 0;

  const offset = getLightboxPinnedTopOffset();
  viewerElements.lightbox.style.setProperty("--lightbox-top-safe-offset", `${offset}px`);
  return offset;
}

function refreshLightboxLayoutForTopUiChange(options = {}) {
  if (!isViewerSessionOpen()) {
    syncLightboxTopSafeArea();
    return;
  }

  const { resetAutoSingleOrigin = true } = options;
  syncLightboxTopSafeArea();

  if (resetAutoSingleOrigin && isAutoViewerZoom()) {
    resetImagePosition({ queueSingleFitOrigin: true });
  }

  applyZoom();
  refreshSingleViewerImageResolution();

}

function syncTopUiPinnedUi() {
  const pinned = Boolean(viewerState.topUiPinned);
  const label = pinned ? "ביטול נעיצת הסרגל העליון" : "נעיצת הסרגל העליון";

  window.clearTimeout(viewerState.uiHideTimer);
  viewerElements.lightbox?.classList.toggle("top-ui-pinned", pinned);
  if (pinned) viewerElements.lightbox?.classList.add("show-ui");
  syncLightboxTopSafeArea();
  syncViewerMobileMoreMenuState();

  if (!viewerElements.lightboxPinTopBar) return;
  viewerElements.lightboxPinTopBar.dataset.pinned = pinned ? "true" : "false";
  viewerElements.lightboxPinTopBar.setAttribute("aria-pressed", pinned ? "true" : "false");
  viewerElements.lightboxPinTopBar.setAttribute("aria-label", label);
  setTooltipText(viewerElements.lightboxPinTopBar, label, { updateDefault: true });
}

function setTopUiPinned(pinned) {
  viewerState.topUiPinned = Boolean(pinned);
  syncTopUiPinnedUi();
  refreshLightboxLayoutForTopUiChange();
  if (!viewerState.topUiPinned) showTopUiTemporarily(1400);
}

function toggleTopUiPinned() {
  setTopUiPinned(!viewerState.topUiPinned);
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
  if (viewerState.topUiPinned || viewerState.viewerMobileMoreOpen) return true;
  const point = getViewportPointer(event);
  if (!point || !viewerElements.lightboxBar) return false;

  const barRect = viewerElements.lightboxBar.getBoundingClientRect();
  const hotspotRect = viewerElements.topHotspot?.getBoundingClientRect?.();
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
  if (!viewerElements.lightbox || !isViewerSessionOpen() || viewerState.topUiPinned || viewerState.viewerMobileMoreOpen) return;
  if (shouldKeepTopUiOpenForPointer(event)) return;
  window.clearTimeout(viewerState.uiHideTimer);
  viewerState.uiHideTimer = window.setTimeout(() => {
    if (!viewerState.topUiPinned && !viewerState.viewerMobileMoreOpen) viewerElements.lightbox?.classList.remove("show-ui");
  }, 420);
}

function shouldKeepPageRailOpenForPointer(event = null) {
  const point = getViewportPointer(event);
  if (!point || !viewerElements.lightboxPageRail) return false;

  const railRect = viewerElements.lightboxPageRail.getBoundingClientRect();
  const hotspotRect = viewerElements.lightboxSideHotspot?.getBoundingClientRect?.();
  if (pointInRect(point, railRect, 1) || pointInRect(point, hotspotRect, 1)) return true;

  // During the slide-in animation the rail can still be geometrically outside
  // the viewport, while the pointer is already on the right activation strip or
  // in the tiny edge gap. Keep the rail open for that whole right-edge region
  // instead of requiring the user to wait until the transition finishes.
  const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  const hotspotWidth = Math.max(2, Math.round(hotspotRect?.width || 40));
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

  if (viewerElements.lightbox?.classList.contains("show-ui") && !shouldKeepTopUiOpenForPointer(event)) {
    scheduleTopUiClose(event);
  }

  if (viewerElements.lightbox?.classList.contains("show-page-rail") && !shouldKeepPageRailOpenForPointer(event)) {
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
  if (!point || viewerState.topUiPinned) return false;
  const { width } = getViewportSize();
  const hotspotRect = viewerElements.topHotspot?.getBoundingClientRect?.();
  const hotspotHeight = Math.max(2, Math.round(hotspotRect?.height || 34));
  const activationBottom = Math.max(hotspotRect?.bottom || 0, hotspotHeight);
  return point.x >= 0 && point.x <= width && point.y >= 0 && point.y <= activationBottom;
}

function getRightEdgeViewerNavigationRect() {
  const candidates = [viewerElements.prevPageBtn, viewerElements.nextPageBtn]
    .map((button) => button?.getBoundingClientRect?.())
    .filter((rect) => rect && rect.width > 0 && rect.height > 0);
  if (!candidates.length) return null;
  return candidates.reduce((rightmost, rect) => rect.right > rightmost.right ? rect : rightmost);
}

function isPointInPageRailNavigationConflictZone(point) {
  const navigationRect = getRightEdgeViewerNavigationRect();
  return pointInRect(point, navigationRect, 4);
}

function isPointInPageRailEdgeActivationZone(point) {
  if (!point || !viewerElements.lightboxSideHotspot || !viewerElements.lightboxPageRail) return false;
  const { width, height } = getViewportSize();
  const hotspotRect = viewerElements.lightboxSideHotspot.getBoundingClientRect();
  const hotspotWidth = Math.max(2, Math.round(hotspotRect?.width || 40));
  const activationLeft = Math.max(0, Math.min(hotspotRect?.left ?? width, width - hotspotWidth));
  // Coordinate-based activation reaches the physical viewport edge even when a
  // fast mouse move lands beyond the DOM hotspot. The page-navigation button on
  // the same side keeps its own compact hit area, so merely aiming for that
  // control does not unexpectedly reveal the thumbnail rail.
  const activationRight = width + 1;
  const insideEdgeStrip = point.x >= activationLeft && point.x <= activationRight && point.y >= 0 && point.y <= height;
  if (!insideEdgeStrip) return false;
  if (isPointInPageRailNavigationConflictZone(point) && point.x <= hotspotRect.right) return false;
  return true;
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

function setViewerLoading(isLoading) {
  viewerElements.viewerLoading.classList.toggle("hidden", !isLoading);
}


function hideLightboxFloatingPreview() {
  viewerElements.lightboxFloatingPreview?.classList.remove("visible");
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
  const preview = viewerElements.lightboxFloatingPreview;
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
  if (!button || !viewerElements.lightboxFloatingPreview || !viewerElements.lightboxFloatingPreviewImage) return;

  const previewCatalog = findCatalogById(button.dataset.previewCatalog) || navigationState.catalog;
  if (!previewCatalog) return;
  const page = clampPage(button.dataset.previewPage || button.dataset.page, previewCatalog);
  const src = button.dataset.previewSrc || pageSrc(previewCatalog, page);
  applyCatalogImageDimensions(viewerElements.lightboxFloatingPreviewImage, previewCatalog, page);
  setCatalogImageSource(viewerElements.lightboxFloatingPreviewImage, src);
  viewerElements.lightboxFloatingPreviewImage.alt = `${previewCatalog.title} - עמוד ${page}`;
  if (viewerElements.lightboxFloatingPreviewPage) {
    viewerElements.lightboxFloatingPreviewPage.textContent = isFavoritesLightboxMode()
      ? `${previewCatalog.title} · עמוד ${page}`
      : `עמוד ${page}`;
  }
  viewerElements.lightboxFloatingPreview.classList.toggle("from-page-rail", isLightboxPageRailTrigger(button));
  viewerElements.lightboxFloatingPreview.classList.add("visible");
  positionLightboxFloatingPreview(button);
}

function updateLightboxThumbs(options = {}) {
  const { scrollIntoView = true } = options;
  const rail = viewerElements.lightboxPageThumbs;
  if (!rail) return;

  const previous = rail.querySelector('.lightbox-page-thumb[aria-current="page"]');
  const selector = isFavoritesLightboxMode()
    ? `.lightbox-page-thumb[data-favorite-index="${favoritesState.favoritesViewerIndex}"]`
    : `.lightbox-page-thumb[data-page="${navigationState.page}"]`;
  const active = rail.querySelector(selector);

  if (previous && previous !== active) {
    previous.classList.remove("active");
    previous.removeAttribute("aria-current");
  }
  if (!active) return;

  active.classList.add("active");
  active.setAttribute("aria-current", "page");
  if (scrollIntoView && viewerElements.lightbox?.classList.contains("show-page-rail")) {
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
    setLightboxPage(targetPage, { thumbScrollIntoView: false });
  }

  showPageRailTemporarily(1800, { scrollIntoView: false });
}

function renderLightboxPageRail() {
  if (!navigationState.catalog || !viewerElements.lightboxPageThumbs) return;
  const thumbs = [];

  if (isFavoritesLightboxMode()) {
    const entries = getFavoriteEntries();
    if (viewerElements.lightboxPageRailTitle) viewerElements.lightboxPageRailTitle.textContent = "מועדפים";
    viewerElements.lightboxPageRail?.setAttribute("aria-label", "מעבר מהיר בין המועדפים");

    entries.forEach(({ catalog, page }, index) => {
      const thumb = escapeHtml(thumbSrc(catalog, page));
      const title = escapeHtml(catalog.title || "קטלוג");
      const active = index === favoritesState.favoritesViewerIndex;
      thumbs.push(`
        <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${active ? " active" : ""}" type="button" data-favorite-index="${index}" data-preview-catalog="${escapeHtml(catalog.id)}" data-preview-page="${page}" data-preview-src="${thumb}" aria-label="מעבר למועדף ${index + 1}: ${title}, עמוד ${page}"${active ? ' aria-current="page"' : ""}>
          <span class="lightbox-page-thumb-image-wrap">
            <img src="${thumb}" alt=""${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumb)} />
          </span>
          <span class="lightbox-page-thumb-number">${index + 1}</span>
        </button>
      `);
    });
  } else {
    const catalog = navigationState.catalog;
    if (viewerElements.lightboxPageRailTitle) viewerElements.lightboxPageRailTitle.textContent = "עמודים";
    viewerElements.lightboxPageRail?.setAttribute("aria-label", "מעבר מהיר בין עמודי הקטלוג");

    for (let page = 1; page <= catalog.pages; page += 1) {
      const thumb = escapeHtml(thumbSrc(catalog, page));
      thumbs.push(`
        <button class="lightbox-page-thumb lightbox-page-thumb-frame catalog-image-frame${page === navigationState.page ? " active" : ""}" type="button" data-page="${page}" data-preview-catalog="${escapeHtml(catalog.id)}" data-preview-page="${page}" data-preview-src="${thumb}" aria-label="מעבר לעמוד ${page}"${page === navigationState.page ? ' aria-current="page"' : ""}>
          <span class="lightbox-page-thumb-image-wrap">
            <img src="${thumb}" alt=""${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumb)} />
          </span>
          <span class="lightbox-page-thumb-number">${page}</span>
        </button>
      `);
    }
  }

  viewerElements.lightboxPageThumbs.innerHTML = thumbs.join("");
  viewerElements.lightboxPageThumbs.querySelectorAll(".lightbox-page-thumb").forEach((button) => {
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
  const fitMode = normalizeViewerFitMode(viewerState.imageFitMode);
  const automatic = viewerUsesAutomaticFitMode();
  viewerState.imageFitMode = fitMode;

  viewerElements.lightbox?.classList.toggle("fit-height", fitMode === VIEWER_FIT_HEIGHT);
  viewerElements.lightbox?.classList.toggle("fit-width", fitMode === VIEWER_FIT_WIDTH);

  if (viewerElements.fitAutoBtn) {
    viewerElements.fitAutoBtn.setAttribute("aria-pressed", automatic ? "true" : "false");
    viewerElements.fitAutoBtn.setAttribute("aria-label", "התאמת תצוגה אוטומטי");
    setTooltipText(viewerElements.fitAutoBtn, "התאמת תצוגה אוטומטי", { updateDefault: true });
  }

  if (viewerElements.fitHeightBtn) {
    const isActive = !automatic && fitMode === VIEWER_FIT_HEIGHT;
    viewerElements.fitHeightBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    viewerElements.fitHeightBtn.setAttribute("aria-label", "התאמת התמונה לגובה");
    setTooltipText(viewerElements.fitHeightBtn, "התאמה לגובה", { updateDefault: true });
  }

  if (viewerElements.fitWidthBtn) {
    const isActive = !automatic && fitMode === VIEWER_FIT_WIDTH;
    viewerElements.fitWidthBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    viewerElements.fitWidthBtn.setAttribute("aria-label", "התאמת התמונה לרוחב");
    setTooltipText(viewerElements.fitWidthBtn, "התאמה לרוחב", { updateDefault: true });
  }

  syncViewerAutoZoomButtonUi();
  syncViewerMobileMoreMenuState();
}


function syncViewerAutoZoomButtonUi() {
  if (!viewerElements.viewerAutoZoomBtn) return;

  const showButton = Boolean(isViewerSessionOpen() && !isAutoViewerZoom());

  viewerElements.viewerAutoZoomBtn.classList.toggle("hidden", !showButton);
  viewerElements.viewerAutoZoomBtn.setAttribute("aria-hidden", showButton ? "false" : "true");
  viewerElements.viewerAutoZoomBtn.setAttribute("tabindex", showButton ? "0" : "-1");
  viewerElements.viewerAutoZoomBtn.setAttribute("aria-label", "חזרה לזום אוטומטי");

  // Keep the button itself icon-only and stationary; the clear explanation lives
  // in the shared floating tooltip so hover/focus never changes the button size.
  setTooltipText(viewerElements.viewerAutoZoomBtn, "חזרה לזום אוטומטי", { updateDefault: true });
}

function formatViewerZoomPercent(value = viewerState.zoom) {
  return `${Math.round(getSafeViewerZoom(value) * 100)}%`;
}

function hideViewerZoomIndicator() {
  window.clearTimeout(viewerState.zoomIndicatorHideTimer);
  viewerState.zoomIndicatorHideTimer = 0;
  viewerElements.viewerZoomIndicator?.classList.remove("visible");
}

function showViewerZoomIndicator(value = viewerState.zoom) {
  const indicator = viewerElements.viewerZoomIndicator;
  if (!indicator || !isViewerSessionOpen()) return;

  indicator.textContent = formatViewerZoomPercent(value);
  indicator.classList.add("visible");

  window.clearTimeout(viewerState.zoomIndicatorHideTimer);
  viewerState.zoomIndicatorHideTimer = window.setTimeout(() => {
    indicator.classList.remove("visible");
    viewerState.zoomIndicatorHideTimer = 0;
  }, VIEWER_ZOOM_INDICATOR_HIDE_MS);
}

function setViewerFitMode(fitMode, options = {}) {
  const nextFitMode = normalizeViewerFitMode(fitMode);
  const {
    showUi = true,
    source = VIEWER_FIT_SOURCE_MANUAL,
    refreshLayout = true
  } = options;
  const shouldResetView = nextFitMode !== viewerState.imageFitMode;

  viewerState.imageFitModeSource = normalizeViewerFitModeSource(source);
  viewerState.imageFitMode = nextFitMode;
  if (shouldResetView) {
    clearViewerPageWheelGesture();
    viewerState.zoom = AUTO_VIEWER_ZOOM;
    resetImagePosition({ queueSingleFitOrigin: true });
    viewerState.pointers.clear();
  }

  syncViewerFitModeUi();
  if (refreshLayout) {
    applyZoom();
    refreshSingleViewerImageResolution();
  }
  if (showUi) showTopUiTemporarily(1600);
}

function setViewerAutomaticFitMode(options = {}) {
  setViewerFitMode(getAutomaticViewerFitMode(), {
    ...options,
    source: VIEWER_FIT_SOURCE_AUTO
  });
}

function syncAutomaticViewerFitMode(options = {}) {
  if (!viewerUsesAutomaticFitMode()) return false;

  const nextFitMode = getAutomaticViewerFitMode();
  if (nextFitMode === viewerState.imageFitMode) return false;

  setViewerAutomaticFitMode(options);
  return true;
}

function syncLightboxModeUi() {
  const favoritesMode = isFavoritesLightboxMode();
  viewerElements.lightbox?.classList.add("catalog-entry-mode");
  viewerElements.lightbox?.classList.toggle("favorites-viewer-mode", favoritesMode);
  favoritesElements.favoriteOpenCatalogButton?.classList.toggle("hidden", !favoritesMode);
  favoritesElements.favoriteOpenCatalogButton?.setAttribute("aria-hidden", favoritesMode ? "false" : "true");
  favoritesElements.favoriteOpenCatalogButton?.setAttribute("tabindex", favoritesMode ? "0" : "-1");
  viewerElements.prevPageBtn?.setAttribute("aria-label", favoritesMode ? "המועדף הקודם" : "העמוד הקודם");
  viewerElements.nextPageBtn?.setAttribute("aria-label", favoritesMode ? "המועדף הבא" : "העמוד הבא");
  syncViewerLayoutModeUi();
  syncViewerFitModeUi();
  syncFullscreenButtonUi();

  if (viewerElements.lightboxModeLabel) {
    viewerElements.lightboxModeLabel.textContent = favoritesMode ? "תצוגת מועדפים" : "כניסה לקטלוג";
  }
}



function isObservedMouseHoverEvent(event = null) {
  if (event?.pointerType === "mouse") return true;
  return String(event?.type || "").startsWith("mouse");
}

function markTouchLikeViewportInput(event) {
  if (isTouchLikePointer(event) || event?.type === "touchstart") {
    viewerState.lastTouchLikeViewportInputAt = Date.now();
  }
}

function hasRecentTouchLikeViewportInput(timeout = 900) {
  return Date.now() - viewerState.lastTouchLikeViewportInputAt < timeout;
}

function openTopUiFromHotspot(event = null) {
  if (!isViewerSessionOpen() || viewerState.viewerOnboardingOpen) return;
  markTouchLikeViewportInput(event);
  showTopUiTemporarily(0);
}

function markTouchLikeRailInput(event) {
  if (isTouchLikePointer(event)) {
    viewerState.lastTouchLikeRailInputAt = Date.now();
  }
  markTouchLikeViewportInput(event);
}

function hasRecentTouchLikeRailInput(timeout = 900) {
  return Date.now() - viewerState.lastTouchLikeRailInputAt < timeout;
}

function shouldUseLightboxHoverPointer(event = null) {
  if (!isViewerSessionOpen()) return false;
  if (isTouchLikePointer(event) || hasRecentTouchLikeViewportInput()) return false;

  // Hybrid Windows devices can keep reporting a coarse/no-hover primary input
  // even while a real mouse is actively producing mouse events. Trust observed
  // mouse input first; the recent-touch guard above still filters the synthetic
  // mouse events browsers may emit after a tap.
  if (isObservedMouseHoverEvent(event)) return true;
  return hasHoverPointer();
}

function shouldUsePageRailHover(event = null) {
  if (!shouldUseLightboxHoverPointer(event)) return false;
  if (hasRecentTouchLikeRailInput()) return false;
  return true;
}

function showPageRailTemporarily(delay = 2600, options = {}) {
  const { scrollIntoView = true } = options;
  if (!viewerElements.lightbox || !isViewerSessionOpen()) return;
  window.clearTimeout(viewerState.pageRailHideTimer);
  viewerElements.lightbox.classList.add("show-page-rail");
  updateLightboxThumbs({ scrollIntoView });
  if (delay > 0) {
    viewerState.pageRailHideTimer = window.setTimeout(() => {
      viewerElements.lightbox?.classList.remove("show-page-rail");
    }, delay);
  }
}

function keepPageRailOpen(options = {}) {
  const { scrollIntoView = true } = options;
  if (!isViewerSessionOpen()) return;
  window.clearTimeout(viewerState.pageRailHideTimer);
  viewerElements.lightbox?.classList.add("show-page-rail");
  updateLightboxThumbs({ scrollIntoView });
}

function schedulePageRailClose(event = null) {
  if (!shouldUsePageRailHover(event)) return;
  if (shouldKeepPageRailOpenForPointer(event)) return;
  window.clearTimeout(viewerState.pageRailHideTimer);
  viewerState.pageRailHideTimer = window.setTimeout(() => {
    viewerElements.lightbox?.classList.remove("show-page-rail");
  }, 420);
}

function openPageRailFromTouch(event) {
  if (!isTouchLikePointer(event)) return;
  markTouchLikeRailInput(event);
  event.preventDefault?.();
  keepPageRailOpen();
}

function handleLightboxPageRailEdgePointerDown(event) {
  if (!isTouchLikePointer(event) || !isViewerSessionOpen() || viewerState.viewerOnboardingOpen) return;
  if (viewerElements.lightboxPageRail?.contains(event.target)) return;

  const point = getViewportPointer(event);
  if (!isPointInPageRailEdgeActivationZone(point)) return;

  markTouchLikeRailInput(event);
  event.preventDefault?.();
  event.stopImmediatePropagation?.();
  event.stopPropagation?.();
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
  if (!viewerElements.lightbox || !isViewerSessionOpen()) return;
  if (!viewerElements.lightbox.classList.contains("show-page-rail")) return;

  const target = event.target;
  if (viewerElements.lightboxPageRail?.contains(target) || viewerElements.lightboxSideHotspot?.contains(target)) return;
  if (!isTouchLikePointer(event) && shouldUsePageRailHover(event)) return;

  window.clearTimeout(viewerState.pageRailHideTimer);
  hideLightboxFloatingPreview();
  viewerElements.lightbox.classList.remove("show-page-rail");
}
















function hideViewerPageIndicator() {
  window.clearTimeout(viewerState.pageIndicatorHideTimer);
  viewerState.pageIndicatorHideTimer = 0;
  viewerElements.viewerPageIndicator?.classList.remove("visible");
}

function showViewerPageIndicatorTemporarily(delay = VIEWER_PAGE_INDICATOR_HIDE_MS) {
  if (!isViewerSessionOpen() || !viewerElements.viewerPageIndicator) return;

  window.clearTimeout(viewerState.pageIndicatorHideTimer);
  viewerElements.viewerPageIndicator.classList.add("visible");
  if (delay <= 0) return;

  viewerState.pageIndicatorHideTimer = window.setTimeout(() => {
    viewerElements.viewerPageIndicator?.classList.remove("visible");
    viewerState.pageIndicatorHideTimer = 0;
  }, delay);
}

function syncLightboxProgress(current, total, title, options = {}) {
  if (!viewerElements.lightboxProgress) return;
  const totalItems = Math.max(1, Number.parseInt(total, 10) || 1);
  const currentItem = clampValue(Number.parseInt(current, 10) || 1, 1, totalItems);
  const ratio = totalItems <= 1 ? 1 : currentItem / totalItems;
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const label = String(options.label || "עמוד");
  const detail = String(options.detail || "").trim();
  const accessibleTitle = title || `${label} ${currentItem} מתוך ${totalItems}`;

  viewerElements.lightboxProgress.style.setProperty("--catalog-progress-ratio", String(clampedRatio));
  viewerElements.lightboxProgress.style.setProperty("--catalog-progress-percent", `${clampedRatio * 100}%`);
  viewerElements.lightboxProgress.setAttribute("aria-valuemin", "1");
  viewerElements.lightboxProgress.setAttribute("aria-valuemax", String(totalItems));
  viewerElements.lightboxProgress.setAttribute("aria-valuenow", String(currentItem));
  viewerElements.lightboxProgress.setAttribute("aria-valuetext", accessibleTitle);
  viewerElements.lightboxProgress.setAttribute("title", accessibleTitle);

  if (viewerElements.viewerPageIndicator) {
    viewerElements.viewerPageIndicatorLabel.textContent = label;
    viewerElements.viewerPageIndicatorCurrent.textContent = String(currentItem);
    viewerElements.viewerPageIndicatorTotal.textContent = String(totalItems);
    if (viewerElements.viewerPageIndicatorDetail) {
      viewerElements.viewerPageIndicatorDetail.textContent = detail;
      viewerElements.viewerPageIndicatorDetail.classList.toggle("hidden", !detail);
    }
    viewerElements.viewerPageIndicator.setAttribute("title", accessibleTitle);
    showViewerPageIndicatorTemporarily();
  }
}


function syncViewerLayoutModeUi() {
  // The catalog and favorites routes now share one paged, single-image renderer.
  // Keeping one rendering contract avoids decoded multi-page DOM state while all
  // input methods still resolve to the same previous/next-page operation.
  viewerElements.lightbox?.classList.add("viewer-layout-paged");
  viewerElements.lightbox?.classList.remove("viewer-layout-scroll", "viewer-layout-side", "viewer-scroll-zoom-isolated");
  viewerElements.lightboxImageFrame?.classList.remove("hidden");
}
