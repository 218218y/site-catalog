/**
 * Source module: 60-viewer.js
 * Viewer lifecycle, page selection, route entry, and event ownership.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function updateLightbox(options = {}) {
  if (!state.catalog) return;
  const { thumbScrollIntoView = true, preserveCurrentImage = false } = options;
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
  syncViewerInquiryUi();
  syncViewerMobileMoreMenuState();

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

  const preserveFullResolutionTier = !isAutoViewerZoom()
    && activeSingleViewerImageTier() === CATALOG_IMAGE_TIER_FULL;
  const request = viewerPageImageRequest(catalog, state.page, {
    forceFull: preserveFullResolutionTier
  });
  const src = request.primarySrc;
  const currentSrc = activeSingleViewerImageLogicalSrc();
  if (currentSrc !== src) {
    showSingleLightboxImage(catalog, state.page, src, { imageRequest: request, preserveCurrentImage });
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
  const favoritesWorkspaceDialogOpen = Boolean(state.favoriteNoteEditingKey);
  document.body.classList.toggle("no-scroll", isViewerSessionOpen() || modalFavoritesOpen || transferOpen || favoritesWorkspaceDialogOpen || state.viewerInquiryOpen);
  document.documentElement.classList.toggle("viewer-open", isViewerSessionOpen());
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
  state.imageFitModeSource = normalizeViewerFitModeSource(state.imageFitModeSource);
  state.imageFitMode = viewerUsesAutomaticFitMode()
    ? getAutomaticViewerFitMode()
    : normalizeViewerFitMode(state.imageFitMode);
  clearViewerPageWheelGesture();
  state.page = clampPage(page, state.catalog);
  state.zoom = AUTO_VIEWER_ZOOM;
  resetImagePosition({ queueSingleFitOrigin: true });
  state.pointers.clear();
  hideViewerZoomIndicator();
  closeViewerInquiry({ restoreFocus: false });
  closeViewerMobileMoreMenu();
  transitionViewerPhase(VIEWER_PHASE_OPENING, "open-lightbox");
  telemetryTrackCatalogOpen(state.catalog, state.page, state.lightboxSource);
  primeLightboxFrameForCatalogPage(state.catalog, state.page);
  const initialSrc = viewerPageSrc(state.catalog, state.page);
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
  transitionViewerPhase(VIEWER_PHASE_OPEN, "lightbox-ready");
  window.requestAnimationFrame(showViewerOnboardingIfNeeded);

}

function hideLightboxUi() {
  transitionViewerPhase(VIEWER_PHASE_CLOSING, "hide-lightbox");
  closeViewerOnboarding({ restoreFocus: false });
  closeViewerInquiry({ restoreFocus: false });
  closeViewerMobileMoreMenu();
  state.lightboxMobileSearchOpen = false;
  syncLightboxMobileSearchUi();
  state.singleImageLoadToken += 1;
  clearViewerPageWheelGesture();
  clearSingleImagePendingPosition();
  clearSingleViewerResolutionUpgrade();
  window.clearTimeout(state.singleImageAnimationTimer);
  els.lightbox?.classList.add("hidden");
  els.lightbox?.classList.remove("show-ui", "show-page-rail", "catalog-entry-mode", "favorites-viewer-mode", "viewer-layout-paged", "viewer-layout-scroll", "viewer-layout-side", "viewer-scroll-zoom-isolated", "is-page-loading", "is-zoomed");
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
  transitionViewerPhase(VIEWER_PHASE_CLOSED, "lightbox-hidden");
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
  if (nextPage === state.page) return;

  const {
    thumbScrollIntoView = true,
    keepZoom = true,
    resetZoom = false,
    resetPosition = isAutoViewerZoom(),
    positionMode = "auto",
    pageTurnDirection = Math.sign(nextPage - state.page),
    pageTurnAxis = "y",
    preservePointerInteraction = false
  } = options;
  const shouldResetZoom = resetZoom || keepZoom === false;
  const shouldResetPosition = shouldResetZoom || resetPosition;
  const preserveRelativePosition = positionMode !== "page-turn"
    && shouldPreserveSingleManualPosition({ keepZoom, resetZoom, resetPosition });
  const relativePosition = preserveRelativePosition
    ? captureSingleImageRelativePosition()
    : null;

  hideLightboxFloatingPreview();
  if (shouldResetZoom) state.zoom = AUTO_VIEWER_ZOOM;

  if (positionMode === "page-turn") {
    queueSingleImagePageTurnOrigin(nextPage, pageTurnDirection, pageTurnAxis);
  } else if (shouldResetPosition) {
    resetImagePosition({ queueSingleFitOrigin: true });
  } else if (relativePosition) {
    queueSingleImageRelativePosition(nextPage, relativePosition);
  }

  if (!preservePointerInteraction) state.pointers.clear();
  const previousCatalog = state.catalog;
  const previousPage = state.page;
  state.page = nextPage;
  const preserveCurrentGeometry = Boolean(
    els.lightboxImage?.complete
    && els.lightboxImage.naturalWidth > 0
    && catalogPagesShareAspectRatio(previousCatalog, previousPage, state.catalog, state.page)
  );
  const geometryPrimed = !preserveCurrentGeometry
    && primeLightboxFrameForCatalogPage(state.catalog, state.page);
  if (geometryPrimed) applyZoom();
  updateLightbox({ thumbScrollIntoView, preserveCurrentImage: preserveCurrentGeometry });
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
    resetPosition = isAutoViewerZoom(),
    positionMode = "auto",
    pageTurnDirection = Math.sign((Number.parseInt(index, 10) || 0) - state.favoritesViewerIndex),
    pageTurnAxis = "y",
    preservePointerInteraction = false
  } = options;
  const nextIndex = clampValue(Number.parseInt(index, 10) || 0, 0, entries.length - 1);
  const entry = entries[nextIndex];
  const itemChanged = nextIndex !== state.favoritesViewerIndex || state.catalog !== entry.catalog || state.page !== entry.page;
  if (!itemChanged) return;

  const shouldResetZoom = resetZoom || keepZoom === false;
  const shouldResetPosition = shouldResetZoom || resetPosition;
  const preserveRelativePosition = positionMode !== "page-turn"
    && shouldPreserveSingleManualPosition({ keepZoom, resetZoom, resetPosition });
  const relativePosition = preserveRelativePosition
    ? captureSingleImageRelativePosition()
    : null;

  hideLightboxFloatingPreview();
  if (shouldResetZoom) state.zoom = AUTO_VIEWER_ZOOM;

  if (positionMode === "page-turn") {
    queueSingleImagePageTurnOrigin(entry.page, pageTurnDirection, pageTurnAxis);
  } else if (shouldResetPosition) {
    resetImagePosition({ queueSingleFitOrigin: true });
  } else if (relativePosition) {
    queueSingleImageRelativePosition(entry.page, relativePosition);
  }
  if (!preservePointerInteraction) state.pointers.clear();

  const previousCatalog = state.catalog;
  const previousPage = state.page;
  setFavoriteViewerEntry(entries, nextIndex);
  const preserveCurrentGeometry = Boolean(
    els.lightboxImage?.complete
    && els.lightboxImage.naturalWidth > 0
    && catalogPagesShareAspectRatio(previousCatalog, previousPage, state.catalog, state.page)
  );
  const geometryPrimed = !preserveCurrentGeometry
    && primeLightboxFrameForCatalogPage(state.catalog, state.page);
  if (geometryPrimed) applyZoom();
  updateLightbox({ thumbScrollIntoView, preserveCurrentImage: preserveCurrentGeometry });
}

function moveLightbox(delta, options = {}) {
  if (!state.catalog) return;
  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex(state.favoritesViewerIndex + delta, options);
    return;
  }
  setLightboxPage(state.page + delta, options);
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
  if (!isViewerSessionOpen() || !isFavoritesLightboxMode() || !state.catalog) return;

  const catalogId = state.catalog.id;
  const page = state.page;

  // Re-enter through the canonical catalog-viewer lifecycle instead of
  // partially mutating favorites state in place. Both routes now share the same
  // single-image renderer, so the transition receives one complete clean state.
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
  els.lightbox?.addEventListener("pointerdown", handleLightboxPageRailEdgePointerDown, { capture: true, passive: false });
  els.lightbox?.addEventListener("pointerdown", handleLightboxPointerDownCapture, { capture: true });
  els.fullscreenToggle?.addEventListener("click", () => toggleBrowserFullscreen(els.fullscreenToggle));
  els.prevPageBtn?.addEventListener("click", () => moveLightbox(-1));
  els.nextPageBtn?.addEventListener("click", () => moveLightbox(1));
  els.fitAutoBtn?.addEventListener("click", () => setViewerAutomaticFitMode());
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
  els.viewerImageRetry?.addEventListener("click", retryCurrentViewerImage);

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

  // Pointer-down is the reliable first event on touch devices; opening here
  // avoids depending on synthetic hover/click events after the hotspot moves
  // behind the revealed toolbar. Native click keeps keyboard activation intact.
  els.topHotspot?.addEventListener("pointerdown", openTopUiFromHotspot);
  els.topHotspot?.addEventListener("mouseenter", openTopUiFromHotspot);
  els.topHotspot?.addEventListener("click", openTopUiFromHotspot);
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
    document.addEventListener(eventName, handleBrowserFullscreenChange);
  });

  reconcileViewerFullscreenPhase("viewer-events-attached");
  syncFullscreenButtonUi();
}
