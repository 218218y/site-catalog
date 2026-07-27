/**
 * Source module: 60-viewer.js
 * Viewer lifecycle, page selection, route entry, and event ownership.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function updateLightbox(options = {}) {
  if (!navigationState.catalog) return;
  const { thumbScrollIntoView = true, preserveCurrentImage = false } = options;
  let favoriteEntries = null;

  if (isFavoritesLightboxMode()) {
    favoriteEntries = getFavoriteEntries();
    if (!favoriteEntries.length) {
      closeLightbox({ restoreFavorites: true });
      return;
    }

    const currentIndex = findFavoriteEntryIndex(favoriteEntries, navigationState.catalog?.id, navigationState.page);
    setFavoriteViewerEntry(favoriteEntries, currentIndex >= 0 ? currentIndex : favoritesState.favoritesViewerIndex);
  }

  const catalog = navigationState.catalog;
  navigationState.page = clampPage(navigationState.page, catalog);
  syncLightboxModeUi();
  syncViewerInquiryUi();
  syncViewerMobileMoreMenuState();

  viewerElements.lightboxTitle.textContent = catalog.title;
  if (favoriteEntries) {
    const current = favoritesState.favoritesViewerIndex + 1;
    const total = favoriteEntries.length;
    viewerElements.lightboxMeta.textContent = `מועדף ${current} מתוך ${total} · עמוד ${navigationState.page}`;
    syncLightboxProgress(current, total, `מועדף ${current} מתוך ${total} · עמוד ${navigationState.page}`, {
      label: "מועדף",
      detail: `עמוד ${navigationState.page}`
    });
    viewerElements.prevPageBtn.disabled = favoritesState.favoritesViewerIndex <= 0;
    viewerElements.nextPageBtn.disabled = favoritesState.favoritesViewerIndex >= total - 1;
  } else {
    viewerElements.lightboxMeta.textContent = `עמוד ${navigationState.page} מתוך ${catalog.pages}`;
    syncLightboxProgress(navigationState.page, catalog.pages, `עמוד ${navigationState.page} מתוך ${catalog.pages}`, {
      label: "עמוד"
    });
    viewerElements.prevPageBtn.disabled = navigationState.page <= 1;
    viewerElements.nextPageBtn.disabled = navigationState.page >= catalog.pages;
  }

  syncViewerFavoriteButtonUi();
  if (!favoriteEntries) initLightboxSearchStatus();

  const preserveFullResolutionTier = !isAutoViewerZoom()
    && activeSingleViewerImageTier() === CATALOG_IMAGE_TIER_FULL;
  const request = viewerPageImageRequest(catalog, navigationState.page, {
    forceFull: preserveFullResolutionTier
  });
  const src = request.primarySrc;
  const currentSrc = activeSingleViewerImageLogicalSrc();
  if (currentSrc !== src) {
    showSingleLightboxImage(catalog, navigationState.page, src, { imageRequest: request, preserveCurrentImage });
  } else {
    setViewerLoading(false);
    viewerElements.lightbox?.classList.remove("is-page-loading");
    applyZoom();
  }

  updateLightboxThumbs({ scrollIntoView: thumbScrollIntoView });
  preloadNeighbors();
  updateHash();
}

function openLightbox(page = 1, options = {}) {
  if (!navigationState.catalog) return;
  const source = options.source === LIGHTBOX_SOURCE_FAVORITES
    ? LIGHTBOX_SOURCE_FAVORITES
    : LIGHTBOX_SOURCE_CATALOG;

  if (!isAppPage("viewer")) {
    navigateTo(viewerDocumentUrl(navigationState.catalog.id, page, { source }));
    return;
  }

  navigationState.lightboxSource = source;
  if (source === LIGHTBOX_SOURCE_FAVORITES) {
    favoritesState.favoritesViewerIndex = Math.max(0, Number.parseInt(options.favoriteIndex, 10) || 0);
  } else {
    favoritesState.favoritesViewerIndex = 0;
    favoritesState.favoritesViewerOpeningHash = "";
    favoritesState.favoritesViewerPreviousCatalog = null;
    favoritesState.favoritesViewerPreviousPage = 1;
    favoritesState.favoritesReturnFocus = null;
  }
  viewerState.imageFitModeSource = normalizeViewerFitModeSource(viewerState.imageFitModeSource);
  viewerState.imageFitMode = viewerUsesAutomaticFitMode()
    ? getAutomaticViewerFitMode()
    : normalizeViewerFitMode(viewerState.imageFitMode);
  stopViewerTouchMomentum();
  clearViewerPageWheelGesture();
  navigationState.page = clampPage(page, navigationState.catalog);
  viewerState.zoom = AUTO_VIEWER_ZOOM;
  resetImagePosition({ queueSingleFitOrigin: true });
  viewerState.pointers.clear();
  hideViewerZoomIndicator();
  closeViewerInquiry({ restoreFocus: false });
  closeViewerMobileMoreMenu();
  transitionViewerPhase(VIEWER_PHASE_OPENING, "open-lightbox");
  telemetryTrackCatalogOpen(navigationState.catalog, navigationState.page, navigationState.lightboxSource);
  primeLightboxFrameForCatalogPage(navigationState.catalog, navigationState.page);
  const initialSrc = viewerPageSrc(navigationState.catalog, navigationState.page);
  if (viewerElements.lightboxImage?.getAttribute("src") !== initialSrc) {
    viewerElements.lightboxImage?.removeAttribute("src");
    prepareImagePlaceholder(viewerElements.lightboxImage);
    viewerElements.lightboxImageFrame?.classList.remove("page-swap-enter");
  }
  viewerElements.lightbox.classList.remove("hidden");
  viewerElements.lightbox.classList.remove("show-ui", "show-page-rail");
  syncTopUiPinnedUi();
  syncDocumentLock();
  renderLightboxPageRail();
  if (!isFavoritesLightboxMode()) renderLightboxCatalogMenu();
  resetLightboxSearch();
  syncLightboxModeUi();
  showTopUiTemporarily(1700);
  updateLightbox();
  getFeatureInterface("catalog-grid")?.scheduleScrollTopButtonUpdate?.();
  transitionViewerPhase(VIEWER_PHASE_OPEN, "lightbox-ready");
  window.requestAnimationFrame(showViewerOnboardingIfNeeded);

}

function hideLightboxUi() {
  transitionViewerPhase(VIEWER_PHASE_CLOSING, "hide-lightbox");
  closeViewerOnboarding({ restoreFocus: false });
  closeViewerInquiry({ restoreFocus: false });
  closeViewerMobileMoreMenu();
  getFeatureInterface("search")?.setLightboxMobileOpen?.(false, { hideResults: true });
  viewerState.singleImageLoadToken += 1;
  stopViewerTouchMomentum();
  clearViewerPageWheelGesture();
  clearSingleImagePendingPosition();
  clearSingleViewerResolutionUpgrade();
  window.clearTimeout(viewerState.singleImageAnimationTimer);
  viewerElements.lightbox?.classList.add("hidden");
  viewerElements.lightbox?.classList.remove("show-ui", "show-page-rail", "catalog-entry-mode", "favorites-viewer-mode", "viewer-layout-paged", "viewer-layout-scroll", "viewer-layout-side", "viewer-scroll-zoom-isolated", "is-page-loading", "is-zoomed");
  syncViewerAutoZoomButtonUi();
  hideViewerZoomIndicator();
  viewerElements.lightboxImageFrame?.classList.remove("page-swap-enter");
  setViewerLoading(false);
  hideLightboxFloatingPreview();
  window.clearTimeout(viewerState.uiHideTimer);
  window.clearTimeout(viewerState.pageRailHideTimer);
  hideViewerPageIndicator();
  getFeatureInterface("catalog-grid")?.scheduleScrollTopButtonUpdate?.();
  navigationState.lightboxSource = LIGHTBOX_SOURCE_CATALOG;
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
      : catalogDocumentUrl(navigationState.catalog?.id);
    navigateTo(destination || homeDocumentUrl(), { replace: true });
    return;
  }

  hideLightboxUi();
}

function setLightboxPage(page, options = {}) {
  if (!navigationState.catalog) return;
  const nextPage = clampPage(page, navigationState.catalog);
  if (nextPage === navigationState.page) return;

  const {
    thumbScrollIntoView = true,
    keepZoom = true,
    resetZoom = false,
    resetPosition = isAutoViewerZoom(),
    positionMode = "auto",
    pageTurnDirection = Math.sign(nextPage - navigationState.page),
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
  if (shouldResetZoom) viewerState.zoom = AUTO_VIEWER_ZOOM;

  if (positionMode === "page-turn") {
    queueSingleImagePageTurnOrigin(nextPage, pageTurnDirection, pageTurnAxis);
  } else if (shouldResetPosition) {
    resetImagePosition({ queueSingleFitOrigin: true });
  } else if (relativePosition) {
    queueSingleImageRelativePosition(nextPage, relativePosition);
  }

  if (!preservePointerInteraction) viewerState.pointers.clear();
  const previousCatalog = navigationState.catalog;
  const previousPage = navigationState.page;
  navigationState.page = nextPage;
  const preserveCurrentGeometry = Boolean(
    viewerElements.lightboxImage?.complete
    && viewerElements.lightboxImage.naturalWidth > 0
    && catalogPagesShareAspectRatio(previousCatalog, previousPage, navigationState.catalog, navigationState.page)
  );
  const geometryPrimed = !preserveCurrentGeometry
    && primeLightboxFrameForCatalogPage(navigationState.catalog, navigationState.page);
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
    pageTurnDirection = Math.sign((Number.parseInt(index, 10) || 0) - favoritesState.favoritesViewerIndex),
    pageTurnAxis = "y",
    preservePointerInteraction = false
  } = options;
  const nextIndex = clampValue(Number.parseInt(index, 10) || 0, 0, entries.length - 1);
  const entry = entries[nextIndex];
  const itemChanged = nextIndex !== favoritesState.favoritesViewerIndex || navigationState.catalog !== entry.catalog || navigationState.page !== entry.page;
  if (!itemChanged) return;

  const shouldResetZoom = resetZoom || keepZoom === false;
  const shouldResetPosition = shouldResetZoom || resetPosition;
  const preserveRelativePosition = positionMode !== "page-turn"
    && shouldPreserveSingleManualPosition({ keepZoom, resetZoom, resetPosition });
  const relativePosition = preserveRelativePosition
    ? captureSingleImageRelativePosition()
    : null;

  hideLightboxFloatingPreview();
  if (shouldResetZoom) viewerState.zoom = AUTO_VIEWER_ZOOM;

  if (positionMode === "page-turn") {
    queueSingleImagePageTurnOrigin(entry.page, pageTurnDirection, pageTurnAxis);
  } else if (shouldResetPosition) {
    resetImagePosition({ queueSingleFitOrigin: true });
  } else if (relativePosition) {
    queueSingleImageRelativePosition(entry.page, relativePosition);
  }
  if (!preservePointerInteraction) viewerState.pointers.clear();

  const previousCatalog = navigationState.catalog;
  const previousPage = navigationState.page;
  setFavoriteViewerEntry(entries, nextIndex);
  const preserveCurrentGeometry = Boolean(
    viewerElements.lightboxImage?.complete
    && viewerElements.lightboxImage.naturalWidth > 0
    && catalogPagesShareAspectRatio(previousCatalog, previousPage, navigationState.catalog, navigationState.page)
  );
  const geometryPrimed = !preserveCurrentGeometry
    && primeLightboxFrameForCatalogPage(navigationState.catalog, navigationState.page);
  if (geometryPrimed) applyZoom();
  updateLightbox({ thumbScrollIntoView, preserveCurrentImage: preserveCurrentGeometry });
}

function moveLightbox(delta, options = {}) {
  if (!navigationState.catalog) return;
  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex(favoritesState.favoritesViewerIndex + delta, options);
    return;
  }
  setLightboxPage(navigationState.page + delta, options);
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

  navigationState.catalog = catalog;
  navigationState.page = clampPage(page, catalog);
  openLightbox(navigationState.page, { source, favoriteIndex: options.favoriteIndex });
}

function openCurrentFavoriteInCatalog() {
  if (!isViewerSessionOpen() || !isFavoritesLightboxMode() || !navigationState.catalog) return;

  const catalogId = navigationState.catalog.id;
  const page = navigationState.page;

  // Re-enter through the canonical catalog-viewer lifecycle instead of
  // partially mutating favorites state in place. Both routes now share the same
  // single-image renderer, so the transition receives one complete clean state.
  openCatalogInViewer(catalogId, page, { source: LIGHTBOX_SOURCE_CATALOG });
}

function attachViewerEvents() {
  attachViewerShareEvents();
  viewerElements.lightboxHomeLink?.addEventListener("click", returnToMainSiteFromLightbox);
  favoritesElements.favoriteOpenCatalogButton?.addEventListener("click", openCurrentFavoriteInCatalog);
  viewerElements.lightboxPinTopBar?.addEventListener("click", () => {
    toggleTopUiPinned();
    if (viewerState.viewerOnboardingOpen) scheduleViewerOnboardingLayout(40);
  });
  viewerElements.lightboxBackdrop?.addEventListener("click", closeLightbox);
  viewerElements.lightbox?.addEventListener("pointerdown", handleLightboxPageRailEdgePointerDown, { capture: true, passive: false });
  viewerElements.lightbox?.addEventListener("pointerdown", handleLightboxPointerDownCapture, { capture: true });
  viewerElements.fullscreenToggle?.addEventListener("click", () => toggleBrowserFullscreen(viewerElements.fullscreenToggle));
  viewerElements.prevPageBtn?.addEventListener("click", () => moveLightbox(-1));
  viewerElements.nextPageBtn?.addEventListener("click", () => moveLightbox(1));
  viewerElements.fitAutoBtn?.addEventListener("click", () => setViewerAutomaticFitMode());
  viewerElements.fitHeightBtn?.addEventListener("click", () => setViewerFitMode(VIEWER_FIT_HEIGHT));
  viewerElements.fitWidthBtn?.addEventListener("click", () => setViewerFitMode(VIEWER_FIT_WIDTH));
  viewerElements.viewerAutoZoomBtn?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
  });
  viewerElements.viewerAutoZoomBtn?.addEventListener("pointerdown", (event) => event.stopPropagation());
  favoritesElements.viewerFavoriteButton?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleCurrentPageFavorite();
  });
  favoritesElements.viewerFavoriteButton?.addEventListener("pointerdown", (event) => event.stopPropagation());
  viewerElements.stageCanvas?.addEventListener("pointerdown", handleViewerSurfacePointerDown);
  viewerElements.viewerImageRetry?.addEventListener("click", retryCurrentViewerImage);

  attachViewerGestures();

  viewerElements.lightboxSideHotspot?.addEventListener("pointerdown", openPageRailFromTouch, { passive: false });
  viewerElements.lightboxSideHotspot?.addEventListener("mouseenter", showPageRailFromHover);
  viewerElements.lightboxSideHotspot?.addEventListener("mouseleave", schedulePageRailClose);
  viewerElements.lightboxSideHotspot?.addEventListener("click", openPageRailFromHotspot);
  viewerElements.lightboxPageRail?.addEventListener("pointerdown", markTouchLikeRailInput);
  viewerElements.lightboxPageRail?.addEventListener("mouseenter", keepPageRailOpenFromHover);
  viewerElements.lightboxPageRail?.addEventListener("mouseleave", (event) => {
    hideLightboxFloatingPreview();
    schedulePageRailClose(event);
  });
  viewerElements.lightbox?.addEventListener("pointerdown", handlePageRailPointerOutside);
  viewerElements.lightboxPageRail?.addEventListener("focusin", () => keepPageRailOpen({ scrollIntoView: false }));
  viewerElements.lightboxPageRail?.addEventListener("focusout", schedulePageRailClose);

  // Pointer-down is the reliable first event on touch devices; opening here
  // avoids depending on synthetic hover/click events after the hotspot moves
  // behind the revealed toolbar. Native click keeps keyboard activation intact.
  viewerElements.topHotspot?.addEventListener("pointerdown", openTopUiFromHotspot);
  viewerElements.topHotspot?.addEventListener("mouseenter", openTopUiFromHotspot);
  viewerElements.topHotspot?.addEventListener("click", openTopUiFromHotspot);
  viewerElements.lightboxBar?.addEventListener("mouseenter", () => showTopUiTemporarily(0));
  viewerElements.lightboxBar?.addEventListener("mouseleave", scheduleTopUiClose);
  document.addEventListener("pointerdown", markTouchLikeViewportInput, { passive: true });
  document.addEventListener("touchstart", markTouchLikeViewportInput, { passive: true });
  document.addEventListener("mousemove", handleLightboxEdgeHoverMove, { passive: true });
  document.addEventListener("mouseout", handleLightboxEdgeHoverViewportExit, { passive: true });
  document.documentElement?.addEventListener("mouseleave", handleLightboxEdgeHoverViewportExit, { passive: true });

  viewerElements.lightboxImage?.addEventListener("load", () => {
    setViewerLoading(false);
    viewerElements.lightbox?.classList.remove("is-page-loading");
    applyZoom();
  });

  ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach((eventName) => {
    document.addEventListener(eventName, handleBrowserFullscreenChange);
  });

  reconcileViewerFullscreenPhase("viewer-events-attached");
  syncFullscreenButtonUi();
}

function handleViewerResize() {
  if (!isViewerSessionOpen()) return;
  hideLightboxFloatingPreview();
  syncAutomaticViewerFitMode({ showUi: false, refreshLayout: false });
  refreshLightboxLayoutForTopUiChange();
  if (viewerState.viewerOnboardingOpen) scheduleViewerOnboardingLayout(40);
}

function handleViewerGlobalKeydown(event) {
  if (!isViewerSessionOpen()) return false;
  if (viewerState.viewerOnboardingOpen) {
    handleViewerOnboardingKeydown(event);
    return true;
  }

  const target = event.target;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return false;

  if (["ArrowDown", "PageDown", "ArrowUp", "PageUp", "ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) {
    stopViewerTouchMomentum();
  }

  if (["ArrowDown", "PageDown"].includes(event.key)) {
    event.preventDefault();
    moveLightbox(1);
  } else if (["ArrowUp", "PageUp"].includes(event.key)) {
    event.preventDefault();
    moveLightbox(-1);
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    moveLightbox(-1);
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveLightbox(1);
  } else if (event.key === "Home") {
    if (isFavoritesLightboxMode()) setFavoriteViewerIndex(0);
    else setLightboxPage(1);
  } else if (event.key === "End" && navigationState.catalog) {
    if (isFavoritesLightboxMode()) setFavoriteViewerIndex(getFavoriteEntries().length - 1);
    else setLightboxPage(navigationState.catalog.pages);
  } else {
    return false;
  }
  return true;
}

function prepareViewerRoute(nextPage) {
  if (nextPage !== "viewer" && isViewerSessionOpen()) hideLightboxUi();
  syncFullscreenButtonUi();
}

registerFeatureInterface("viewer", {
  escapePriority: 100,
  requiresDocumentLock: () => isViewerSessionOpen(),
  isViewerOpen: () => isViewerSessionOpen(),
  usesInDocumentFullscreenNavigation: viewerUsesInDocumentFullscreenNavigation,
  attachEvents: () => {
    attachViewerActionEvents();
    attachViewerOnboardingEvents();
    attachViewerEvents();
  },
  handleResize: handleViewerResize,
  handleGlobalKeydown: handleViewerGlobalKeydown,
  prepareRoute: prepareViewerRoute,
  openCatalog: (catalogId, page = 1, options = {}) => openCatalogInViewer(catalogId, page, options),
  close: (options = {}) => closeLightbox(options),
  refresh: (options = {}) => updateLightbox(options),
  renderPageRail: renderLightboxPageRail,
  prepareInquiry: () => {
    if (viewerState.viewerOnboardingOpen) closeViewerOnboarding({ restoreFocus: false });
    closeViewerMobileMoreMenu();
    if (getFeatureInterface("search")?.isLightboxMobileOpen?.()) {
      getFeatureInterface("search")?.setLightboxMobileOpen?.(false, { hideResults: true });
    }
  },
  setPage: (page, options = {}) => setLightboxPage(page, options),
  syncMobileSearchUi: (isOpen) => viewerElements.lightbox?.classList.toggle("mobile-search-open", Boolean(isOpen)),
  showTopUi: () => showTopUiTemporarily(0),
  containsTopBarElement: (element) => Boolean(element && viewerElements.lightboxBar?.contains(element)),
  hideTopUiForSearch: () => {
    if (viewerState.topUiPinned) return;
    window.clearTimeout(viewerState.uiHideTimer);
    viewerElements.lightbox?.classList.remove("show-ui");
  },
  closeTopLayer: (event) => {
    if (!isViewerSessionOpen()) return false;
    if (viewerState.viewerMobileMoreOpen) {
      closeViewerMobileMoreMenu({ returnFocus: true });
      return true;
    }
    if (viewerState.viewerOnboardingOpen) {
      closeViewerOnboarding();
      return true;
    }
    if (getFeatureInterface("search")?.closeViewerTopLayer?.()) return true;
    if (isBrowserFullscreenActive()) {
      exitBrowserFullscreen().catch(() => {});
      return true;
    }

    const target = event?.target;
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
      getFeatureInterface("search")?.hideViewerResults?.({ blurTopUiFocus: true });
      return true;
    }
    closeLightbox();
    return true;
  }
});
