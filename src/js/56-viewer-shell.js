/**
 * Source module: 56-viewer-shell.js
 * Viewer chrome, top controls, page rail, progress indicators, and fit-mode UI.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function showTopUiTemporarily(delay = 2200) {
  if (!els.lightbox) return;
  window.clearTimeout(state.uiHideTimer);
  els.lightbox.classList.add("show-ui");
  if (state.topUiPinned || state.viewerMobileMoreOpen) return;
  if (delay > 0) {
    state.uiHideTimer = window.setTimeout(() => {
      if (!state.topUiPinned && !state.viewerMobileMoreOpen) els.lightbox.classList.remove("show-ui");
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
  refreshSingleViewerImageResolution({ reason: "layout-change" });

}

function syncTopUiPinnedUi() {
  const pinned = Boolean(state.topUiPinned);
  const label = pinned ? "ביטול נעיצת הסרגל העליון" : "נעיצת הסרגל העליון";

  window.clearTimeout(state.uiHideTimer);
  els.lightbox?.classList.toggle("top-ui-pinned", pinned);
  if (pinned) els.lightbox?.classList.add("show-ui");
  syncLightboxTopSafeArea();
  syncViewerMobileMoreMenuState();

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
  if (state.topUiPinned || state.viewerMobileMoreOpen) return true;
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
  if (!els.lightbox || !isViewerSessionOpen() || state.topUiPinned || state.viewerMobileMoreOpen) return;
  if (shouldKeepTopUiOpenForPointer(event)) return;
  window.clearTimeout(state.uiHideTimer);
  state.uiHideTimer = window.setTimeout(() => {
    if (!state.topUiPinned && !state.viewerMobileMoreOpen) els.lightbox?.classList.remove("show-ui");
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

function getRightEdgeViewerNavigationRect() {
  const candidates = [els.prevPageBtn, els.nextPageBtn]
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
  if (!point || !els.lightboxSideHotspot || !els.lightboxPageRail) return false;
  const { width, height } = getViewportSize();
  const hotspotRect = els.lightboxSideHotspot.getBoundingClientRect();
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
  applyCatalogImageDimensions(els.lightboxFloatingPreviewImage, previewCatalog, page);
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
            <img src="${thumb}" alt=""${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumb)} />
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
            <img src="${thumb}" alt=""${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(thumb)} />
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
  const automatic = viewerUsesAutomaticFitMode();
  state.imageFitMode = fitMode;

  els.lightbox?.classList.toggle("fit-height", fitMode === VIEWER_FIT_HEIGHT);
  els.lightbox?.classList.toggle("fit-width", fitMode === VIEWER_FIT_WIDTH);

  if (els.fitAutoBtn) {
    els.fitAutoBtn.setAttribute("aria-pressed", automatic ? "true" : "false");
    els.fitAutoBtn.setAttribute("aria-label", "התאמת תצוגה אוטומטי");
    setTooltipText(els.fitAutoBtn, "התאמת תצוגה אוטומטי", { updateDefault: true });
  }

  if (els.fitHeightBtn) {
    const isActive = !automatic && fitMode === VIEWER_FIT_HEIGHT;
    els.fitHeightBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    els.fitHeightBtn.setAttribute("aria-label", "התאמת התמונה לגובה");
    setTooltipText(els.fitHeightBtn, "התאמה לגובה", { updateDefault: true });
  }

  if (els.fitWidthBtn) {
    const isActive = !automatic && fitMode === VIEWER_FIT_WIDTH;
    els.fitWidthBtn.setAttribute("aria-pressed", isActive ? "true" : "false");
    els.fitWidthBtn.setAttribute("aria-label", "התאמת התמונה לרוחב");
    setTooltipText(els.fitWidthBtn, "התאמה לרוחב", { updateDefault: true });
  }

  syncViewerAutoZoomButtonUi();
  syncViewerMobileMoreMenuState();
}


function syncViewerAutoZoomButtonUi() {
  if (!els.viewerAutoZoomBtn) return;

  const showButton = Boolean(isViewerSessionOpen() && !isAutoViewerZoom());

  els.viewerAutoZoomBtn.classList.toggle("hidden", !showButton);
  els.viewerAutoZoomBtn.setAttribute("aria-hidden", showButton ? "false" : "true");
  els.viewerAutoZoomBtn.setAttribute("tabindex", showButton ? "0" : "-1");
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
  if (!indicator || !isViewerSessionOpen()) return;

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
  const {
    showUi = true,
    source = VIEWER_FIT_SOURCE_MANUAL,
    refreshLayout = true
  } = options;
  const shouldResetView = nextFitMode !== state.imageFitMode;

  state.imageFitModeSource = normalizeViewerFitModeSource(source);
  state.imageFitMode = nextFitMode;
  if (shouldResetView) {
    clearViewerPageWheelGesture();
    state.zoom = AUTO_VIEWER_ZOOM;
    resetImagePosition({ queueSingleFitOrigin: true });
    state.pointers.clear();
  }

  syncViewerFitModeUi();
  if (refreshLayout) applyZoom();
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
  if (nextFitMode === state.imageFitMode) return false;

  setViewerAutomaticFitMode(options);
  return true;
}

function syncLightboxModeUi() {
  const favoritesMode = isFavoritesLightboxMode();
  els.lightbox?.classList.add("catalog-entry-mode");
  els.lightbox?.classList.toggle("favorites-viewer-mode", favoritesMode);
  els.favoriteOpenCatalogButton?.classList.toggle("hidden", !favoritesMode);
  els.favoriteOpenCatalogButton?.setAttribute("aria-hidden", favoritesMode ? "false" : "true");
  els.favoriteOpenCatalogButton?.setAttribute("tabindex", favoritesMode ? "0" : "-1");
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

function isObservedMouseHoverEvent(event = null) {
  if (event?.pointerType === "mouse") return true;
  return String(event?.type || "").startsWith("mouse");
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

function openTopUiFromHotspot(event = null) {
  if (!isViewerSessionOpen() || state.viewerOnboardingOpen) return;
  markTouchLikeViewportInput(event);
  showTopUiTemporarily(0);
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
  if (!els.lightbox || !isViewerSessionOpen()) return;
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
  if (!isViewerSessionOpen()) return;
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

function handleLightboxPageRailEdgePointerDown(event) {
  if (!isTouchLikePointer(event) || !isViewerSessionOpen() || state.viewerOnboardingOpen) return;
  if (els.lightboxPageRail?.contains(event.target)) return;

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
  if (!els.lightbox || !isViewerSessionOpen()) return;
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
  if (!isViewerSessionOpen() || !els.viewerPageIndicator) return;

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
  // The catalog and favorites routes now share one paged, single-image renderer.
  // Keeping one rendering contract avoids decoded multi-page DOM state while all
  // input methods still resolve to the same previous/next-page operation.
  els.lightbox?.classList.add("viewer-layout-paged");
  els.lightbox?.classList.remove("viewer-layout-scroll", "viewer-layout-side", "viewer-scroll-zoom-isolated");
  els.lightboxImageFrame?.classList.remove("hidden");
}
