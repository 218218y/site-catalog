/**
 * Source module: 60-viewer.js
 * Viewer lifecycle, page selection, route entry, and event ownership.
 *
 * Runtime dependencies are explicit ES module imports. Route entrypoints are
 * bundled by the pinned esbuild tool into stable browser asset names.
 */

import { canReturnToSameSite, catalogDocumentUrl, favoritesDocumentUrl, hasInDocumentRouteSession, homeDocumentUrl, isAppPage, navigateBack, navigateTo, viewerDocumentUrl } from "./00-navigation.js";
import { catalogs } from "./03-runtime-context.js";
import { CATALOG_IMAGE_TIER_FULL, getFeatureInterface, registerFeatureInterface } from "./10-app-state.js";
import { LIGHTBOX_SOURCE_CATALOG, LIGHTBOX_SOURCE_FAVORITES } from "./11-navigation-state.js";
import { telemetryTrackCatalogOpen } from "./15-telemetry.js";
import { AUTO_VIEWER_ZOOM, VIEWER_FIT_HEIGHT, VIEWER_FIT_WIDTH, VIEWER_PHASE_CLOSED, VIEWER_PHASE_CLOSING, VIEWER_PHASE_OPEN, VIEWER_PHASE_OPENING, viewerElements, viewerState } from "./16-viewer-state.js";
import { activeCatalog, activePage, activeViewerSource, setActiveLocation, setActivePage, setActiveViewerSource } from "./18-navigation-feature.js";
import { catalogPagesShareAspectRatio, clampPage, clampValue, prepareImagePlaceholder, syncDocumentLock } from "./20-shared-ui.js";
import { eventTargetElement } from "./02-dom-contracts.js";
import { isFavoritesLightboxMode } from "./30-favorites-share.js";
import { attachViewerShareEvents } from "./31-viewer-share.js";
import { closeViewerInquiry, syncViewerInquiryUi } from "./32-shared-inquiry.js";
import { initLightboxSearchStatus, renderLightboxCatalogMenu, resetLightboxSearch } from "./50-search-ui.js";
import { exitBrowserFullscreen, handleBrowserFullscreenChange, isBrowserFullscreenActive, isViewerSessionOpen, reconcileViewerFullscreenPhase, returnToMainSiteFromLightbox, syncFullscreenButtonUi, toggleBrowserFullscreen, transitionViewerPhase, viewerUsesInDocumentFullscreenNavigation } from "./52-viewer-session.js";
import { activeSingleViewerImageLogicalSrc, activeSingleViewerImageTier, clearSingleViewerResolutionUpgrade, preloadNeighbors, showSingleLightboxImage, viewerPageImageRequest, viewerPageSrc } from "./53-viewer-image.js";
import { applyZoom, captureSingleImageRelativePosition, clearSingleImagePendingPosition, getAutomaticViewerFitMode, isAutoViewerZoom, normalizeViewerFitMode, normalizeViewerFitModeSource, primeLightboxFrameForCatalogPage, queueSingleImagePageTurnOrigin, queueSingleImageRelativePosition, resetImagePosition, setZoom, shouldPreserveSingleManualPosition, updateHash, viewerUsesAutomaticFitMode } from "./54-viewer-geometry.js";
import { handleLightboxEdgeHoverMove, handleLightboxEdgeHoverViewportExit, handleLightboxPageRailEdgePointerDown, handlePageRailPointerOutside, hideLightboxFloatingPreview, hideViewerPageIndicator, hideViewerZoomIndicator, keepPageRailOpen, keepPageRailOpenFromHover, markTouchLikeRailInput, markTouchLikeViewportInput, openPageRailFromHotspot, openPageRailFromTouch, openTopUiFromHotspot, refreshLightboxLayoutForTopUiChange, renderLightboxPageRail, schedulePageRailClose, scheduleTopUiClose, setViewerAutomaticFitMode, setViewerFitMode, setViewerLoading, showPageRailFromHover, showTopUiTemporarily, syncAutomaticViewerFitMode, syncLightboxModeUi, syncLightboxProgress, syncTopUiPinnedUi, syncViewerAutoZoomButtonUi, toggleTopUiPinned, updateLightboxThumbs } from "./56-viewer-shell.js";
import { clearViewerPageWheelGesture, retryCurrentViewerImage } from "./58-viewer-navigation.js";
import { attachViewerActionEvents, closeViewerMobileMoreMenu, syncViewerMobileMoreMenuState } from "./62-viewer-actions.js";
import { attachViewerOnboardingEvents, closeViewerOnboarding, handleViewerOnboardingKeydown, scheduleViewerOnboardingLayout, showViewerOnboardingIfNeeded } from "./65-viewer-onboarding.js";
import { attachViewerGestures, handleLightboxPointerDownCapture, handleViewerSurfacePointerDown, stopViewerTouchMomentum } from "./70-viewer-input.js";

/** @param {ViewerRefreshOptions} [options] */
function updateLightbox(options = {}) {
  if (!activeCatalog()) return;
  const { thumbScrollIntoView = true, preserveCurrentImage = false } = options;
  let favoriteEntries = null;
  const favorites = getFeatureInterface("favorites");

  if (isFavoritesLightboxMode()) {
    favoriteEntries = favorites?.entries() || [];
    if (!favoriteEntries.length) {
      closeLightbox({ restoreFavorites: true });
      return;
    }

    const currentIndex = favorites?.findViewerEntryIndex(favoriteEntries, activeCatalog()?.id, activePage()) ?? -1;
    favorites?.selectViewerEntry(
      favoriteEntries,
      currentIndex >= 0 ? currentIndex : favorites.viewerIndex()
    );
  }

  const catalog = activeCatalog();
  if (!catalog) return;
  setActivePage(clampPage(activePage(), catalog));
  syncLightboxModeUi();
  syncViewerInquiryUi();
  syncViewerMobileMoreMenuState();

  viewerElements.lightboxTitle.textContent = catalog.title;
  if (favoriteEntries) {
    const favoriteViewerIndex = favorites?.viewerIndex() ?? 0;
    const current = favoriteViewerIndex + 1;
    const total = favoriteEntries.length;
    viewerElements.lightboxMeta.textContent = `מועדף ${current} מתוך ${total} · עמוד ${activePage()}`;
    syncLightboxProgress(current, total, `מועדף ${current} מתוך ${total} · עמוד ${activePage()}`, {
      label: "מועדף",
      detail: `עמוד ${activePage()}`
    });
    viewerElements.prevPageBtn.disabled = favoriteViewerIndex <= 0;
    viewerElements.nextPageBtn.disabled = favoriteViewerIndex >= total - 1;
  } else {
    viewerElements.lightboxMeta.textContent = `עמוד ${activePage()} מתוך ${catalog.pages}`;
    syncLightboxProgress(activePage(), catalog.pages, `עמוד ${activePage()} מתוך ${catalog.pages}`, {
      label: "עמוד"
    });
    viewerElements.prevPageBtn.disabled = activePage() <= 1;
    viewerElements.nextPageBtn.disabled = activePage() >= catalog.pages;
  }

  favorites?.syncViewerButton();
  if (!favoriteEntries) initLightboxSearchStatus();

  const preserveFullResolutionTier = !isAutoViewerZoom()
    && activeSingleViewerImageTier() === CATALOG_IMAGE_TIER_FULL;
  const request = viewerPageImageRequest(catalog, activePage(), {
    forceFull: preserveFullResolutionTier
  });
  const src = request.primarySrc;
  const currentSrc = activeSingleViewerImageLogicalSrc();
  if (currentSrc !== src) {
    showSingleLightboxImage(catalog, activePage(), src, { imageRequest: request, preserveCurrentImage });
  } else {
    setViewerLoading(false);
    viewerElements.lightbox?.classList.remove("is-page-loading");
    applyZoom();
  }

  updateLightboxThumbs({ scrollIntoView: thumbScrollIntoView });
  preloadNeighbors();
  updateHash();
}

/** @param {number} [page] @param {ViewerOpenOptions} [options] */
function openLightbox(page = 1, options = {}) {
  const catalog = activeCatalog();
  if (!catalog) return;
  const source = options.source === LIGHTBOX_SOURCE_FAVORITES
    ? LIGHTBOX_SOURCE_FAVORITES
    : LIGHTBOX_SOURCE_CATALOG;

  if (!isAppPage("viewer")) {
    navigateTo(viewerDocumentUrl(catalog.id, page, { source }));
    return;
  }

  setActiveViewerSource(source);
  const favorites = getFeatureInterface("favorites");
  if (source === LIGHTBOX_SOURCE_FAVORITES) {
    favorites?.setViewerIndex(Math.max(0, Number.parseInt(String(options.favoriteIndex ?? ""), 10) || 0));
  } else {
    favorites?.resetViewerSession();
  }
  viewerState.imageFitModeSource = normalizeViewerFitModeSource(viewerState.imageFitModeSource);
  viewerState.imageFitMode = viewerUsesAutomaticFitMode()
    ? getAutomaticViewerFitMode()
    : normalizeViewerFitMode(viewerState.imageFitMode);
  stopViewerTouchMomentum();
  clearViewerPageWheelGesture();
  setActivePage(clampPage(page, catalog));
  viewerState.zoom = AUTO_VIEWER_ZOOM;
  resetImagePosition({ queueSingleFitOrigin: true });
  viewerState.pointers.clear();
  hideViewerZoomIndicator();
  closeViewerInquiry({ restoreFocus: false });
  closeViewerMobileMoreMenu();
  transitionViewerPhase(VIEWER_PHASE_OPENING, "open-lightbox");
  telemetryTrackCatalogOpen(catalog, activePage(), activeViewerSource());
  primeLightboxFrameForCatalogPage(catalog, activePage());
  const initialSrc = viewerPageSrc(catalog, activePage());
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
  setActiveViewerSource(LIGHTBOX_SOURCE_CATALOG);
  transitionViewerPhase(VIEWER_PHASE_CLOSED, "lightbox-hidden");
  syncDocumentLock();
}

/** @param {ViewerCloseOptions} [options] */
function closeLightbox(options = {}) {
  const wasFavoritesViewer = isFavoritesLightboxMode();
  const { restoreFavorites = wasFavoritesViewer } = options;

  if (isAppPage("viewer")) {
    if ((hasInDocumentRouteSession || canReturnToSameSite()) && window.history.length > 1) {
      navigateBack();
      return;
    }
    const catalogId = activeCatalog()?.id || "";
    const destination = wasFavoritesViewer && restoreFavorites
      ? favoritesDocumentUrl()
      : (catalogId ? catalogDocumentUrl(catalogId) : homeDocumentUrl());
    navigateTo(destination || homeDocumentUrl(), { replace: true });
    return;
  }

  hideLightboxUi();
}

/** @param {number} page @param {ViewerSetPageOptions} [options] */
function setLightboxPage(page, options = {}) {
  if (!activeCatalog()) return;
  const nextPage = clampPage(page, activeCatalog());
  if (nextPage === activePage()) return;

  const {
    thumbScrollIntoView = true,
    keepZoom = true,
    resetZoom = false,
    resetPosition = isAutoViewerZoom(),
    positionMode = "auto",
    pageTurnDirection = Math.sign(nextPage - activePage()),
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
  const previousCatalog = activeCatalog();
  const previousPage = activePage();
  setActivePage(nextPage);
  const currentCatalog = activeCatalog();
  const preserveCurrentGeometry = Boolean(
    currentCatalog
    && viewerElements.lightboxImage?.complete
    && viewerElements.lightboxImage.naturalWidth > 0
    && catalogPagesShareAspectRatio(previousCatalog, previousPage, currentCatalog, activePage())
  );
  const geometryPrimed = Boolean(currentCatalog && !preserveCurrentGeometry
    && primeLightboxFrameForCatalogPage(currentCatalog, activePage()));
  if (geometryPrimed) applyZoom();
  updateLightbox({ thumbScrollIntoView, preserveCurrentImage: preserveCurrentGeometry });
}

/** @param {number} index @param {ViewerSetPageOptions} [options] */
function setFavoriteViewerIndex(index, options = {}) {
  if (!isFavoritesLightboxMode()) return;
  const favorites = getFeatureInterface("favorites");
  const entries = favorites?.entries() || [];
  if (!entries.length) {
    closeLightbox({ restoreFavorites: true });
    return;
  }

  const currentFavoriteIndex = favorites?.viewerIndex() ?? 0;
  const {
    thumbScrollIntoView = true,
    keepZoom = true,
    resetZoom = false,
    resetPosition = isAutoViewerZoom(),
    positionMode = "auto",
    pageTurnDirection = Math.sign((Number.parseInt(String(index), 10) || 0) - currentFavoriteIndex),
    pageTurnAxis = "y",
    preservePointerInteraction = false
  } = options;
  const nextIndex = clampValue(Number.parseInt(String(index), 10) || 0, 0, entries.length - 1);
  const entry = entries[nextIndex];
  const itemChanged = nextIndex !== currentFavoriteIndex || activeCatalog() !== entry.catalog || activePage() !== entry.page;
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

  const previousCatalog = activeCatalog();
  const previousPage = activePage();
  favorites?.selectViewerEntry(entries, nextIndex);
  const currentCatalog = activeCatalog();
  const preserveCurrentGeometry = Boolean(
    currentCatalog
    && viewerElements.lightboxImage?.complete
    && viewerElements.lightboxImage.naturalWidth > 0
    && catalogPagesShareAspectRatio(previousCatalog, previousPage, currentCatalog, activePage())
  );
  const geometryPrimed = Boolean(currentCatalog && !preserveCurrentGeometry
    && primeLightboxFrameForCatalogPage(currentCatalog, activePage()));
  if (geometryPrimed) applyZoom();
  updateLightbox({ thumbScrollIntoView, preserveCurrentImage: preserveCurrentGeometry });
}

/** @param {number} delta @param {ViewerSetPageOptions} [options] */
function moveLightbox(delta, options = {}) {
  if (!activeCatalog()) return;
  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex((getFeatureInterface("favorites")?.viewerIndex() ?? 0) + delta, options);
    return;
  }
  setLightboxPage(activePage() + delta, options);
}

/** @param {string} id @param {number} [page] @param {ViewerOpenOptions} [options] */
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

  setActiveLocation(catalog, clampPage(page, catalog), source);
  openLightbox(activePage(), { source, favoriteIndex: options.favoriteIndex });
}

function attachViewerEvents() {
  attachViewerShareEvents();
  viewerElements.lightboxHomeLink?.addEventListener("click", returnToMainSiteFromLightbox);
  viewerElements.lightboxPinTopBar?.addEventListener("click", () => {
    toggleTopUiPinned();
    if (viewerState.viewerOnboardingOpen) scheduleViewerOnboardingLayout(40);
  });
  viewerElements.lightboxBackdrop?.addEventListener("click", () => closeLightbox());
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

/** @param {KeyboardEvent} event */
function handleViewerGlobalKeydown(event) {
  if (!isViewerSessionOpen()) return false;
  if (viewerState.viewerOnboardingOpen) {
    handleViewerOnboardingKeydown(event);
    return true;
  }

  const target = eventTargetElement(event.target);
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
  } else if (event.key === "End") {
    const catalog = activeCatalog();
    if (!catalog) return false;
    if (isFavoritesLightboxMode()) {
      setFavoriteViewerIndex((getFeatureInterface("favorites")?.entries().length || 0) - 1);
    }
    else setLightboxPage(catalog.pages);
  } else {
    return false;
  }
  return true;
}

/** @param {string} nextPage */
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
  closeMobileMoreMenu: () => closeViewerMobileMoreMenu(),
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

    const target = eventTargetElement(event?.target || null);
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
      getFeatureInterface("search")?.hideViewerResults?.({ blurTopUiFocus: true });
      return true;
    }
    closeLightbox();
    return true;
  }
});

export { moveLightbox, setFavoriteViewerIndex, setLightboxPage };
