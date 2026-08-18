/**
 * Source module: 60-viewer.js
 * Viewer lifecycle and composition root.
 *
 * This module assembles the Viewer feature, owns open/close lifecycle and event
 * wiring, and registers the public feature boundary. No Viewer submodule imports
 * this file; reusable commands live in their dedicated lower-level owners.
 */

/** @import { ViewerCloseOptions, ViewerOpenOptions } from "../../types/frontend-contracts.js" */

import { canReturnToSameSite, catalogDocumentUrl, favoritesDocumentUrl, hasInDocumentRouteSession, homeDocumentUrl, isAppPage, navigateBack, navigateTo, viewerDocumentUrl } from "./00-navigation.js";
import { catalogs } from "./03-runtime-context.js";
import { catalogFirstPage, catalogLastPage } from "./06-catalog-page-numbering.js";
import { getFeatureInterface, registerFeatureInterface, requireFeatureInterface } from "./10-app-state.js";
import { LIGHTBOX_SOURCE_CATALOG, LIGHTBOX_SOURCE_FAVORITES } from "./11-navigation-state.js";
import { telemetryTrackCatalogOpen } from "./15-telemetry.js";
import { AUTO_VIEWER_ZOOM, VIEWER_FIT_HEIGHT, VIEWER_FIT_WIDTH, VIEWER_PHASE_CLOSED, VIEWER_PHASE_CLOSING, VIEWER_PHASE_OPEN, VIEWER_PHASE_OPENING, viewerChromeState, viewerElements, viewerImageState, viewerOnboardingState, viewerViewportState } from "./16-viewer-state.js";
import { VIEWER_NAVIGATION_SOURCE_BUTTON, VIEWER_NAVIGATION_SOURCE_HOME_END, VIEWER_NAVIGATION_SOURCE_KEYBOARD, VIEWER_NAVIGATION_SOURCE_PROGRAMMATIC, finalizeViewerClosedStateCommand, initializeViewerOpenStateCommand, invalidateViewerImageSwapCommand } from "./17-viewer-state-transitions.js";
import { activeCatalog, activePage, activeViewerSource, setActiveLocation, setActivePage, setActiveViewerSource } from "./18-navigation-feature.js";
import { clampPage, prepareImagePlaceholder } from "./20-catalog-runtime.js";
import { syncDocumentLock } from "./21-ui-runtime.js";
import { eventTargetElement } from "./02-dom-contracts.js";
import { isFavoritesLightboxMode } from "./30-favorites-share.js";
import { attachViewerShareEvents } from "./31-viewer-share.js";
import { closeViewerInquiry } from "./32-shared-inquiry.js";
import { isViewerSessionOpen, transitionViewerPhase } from "./51-viewer-session-state.js";
import { exitBrowserFullscreen, handleBrowserFullscreenChange, isBrowserFullscreenActive, reconcileViewerFullscreenPhase, returnToMainSiteFromLightbox, syncFullscreenButtonUi, toggleBrowserFullscreen, viewerUsesInDocumentFullscreenNavigation } from "./52-viewer-session.js";
import { clearSingleViewerResolutionUpgrade, clearViewerImagePreparations, setViewerLoading, viewerPageSrc } from "./53-viewer-image.js";
import { applyZoom, clearSingleImagePendingPosition, getAutomaticViewerFitMode, normalizeViewerFitMode, normalizeViewerFitModeSource, primeLightboxFrameForCatalogPage, resetImagePosition, viewerUsesAutomaticFitMode } from "./54-viewer-geometry.js";
import { setZoom } from "./55-viewer-zoom-controller.js";
import { handleLightboxEdgeHoverMove, handleLightboxEdgeHoverViewportExit, handleLightboxPageRailEdgePointerDown, handlePageRailPointerOutside, hideLightboxFloatingPreview, hideViewerPageIndicator, hideViewerZoomIndicator, keepPageRailOpen, keepPageRailOpenFromHover, markTouchLikeRailInput, markTouchLikeViewportInput, openPageRailFromHotspot, openPageRailFromTouch, openTopUiFromHotspot, renderLightboxPageRail, schedulePageRailClose, scheduleTopUiClose, showPageRailFromHover, showTopUiTemporarily, syncLightboxModeUi, syncTopUiPinnedUi, syncViewerAutoZoomButtonUi, syncViewerMobileMoreMenuState } from "./56-viewer-shell.js";
import { setViewerAutomaticFitMode, setViewerFitMode, syncAutomaticViewerFitMode } from "./57-viewer-fit-controller.js";
import { clearViewerPageWheelGesture, retryCurrentViewerImage } from "./58-viewer-navigation.js";
import { attachViewerPageControllerEvents, moveLightbox, setFavoriteViewerIndex, setLightboxPage, updateLightbox } from "./59-viewer-page-controller.js";
import { refreshLightboxLayoutForTopUiChange, toggleTopUiPinned } from "./61-viewer-layout-controller.js";
import { attachViewerActionEvents, closeViewerMobileMoreMenu } from "./62-viewer-actions.js";
import { attachViewerOnboardingEvents, closeViewerOnboarding, handleViewerOnboardingKeydown, scheduleViewerOnboardingLayout, showViewerOnboardingIfNeeded } from "./65-viewer-onboarding.js";
import { attachViewerGestures, handleLightboxPointerDownCapture, handleViewerSurfacePointerDown, stopViewerTouchMomentum } from "./70-viewer-input.js";

let viewerLayoutRefreshRaf = 0;
/** @type {ResizeObserver|null} */
let viewerStageResizeObserver = null;

/** @param {number} [page] @param {ViewerOpenOptions} [options] */
function openLightbox(page = undefined, options = {}) {
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
  setActivePage(clampPage(page, catalog));
  viewerViewportState.imageFitModeSource = normalizeViewerFitModeSource(viewerViewportState.imageFitModeSource);
  viewerViewportState.imageFitMode = viewerUsesAutomaticFitMode()
    ? getAutomaticViewerFitMode()
    : normalizeViewerFitMode(viewerViewportState.imageFitMode);
  stopViewerTouchMomentum();
  clearViewerPageWheelGesture();
  clearViewerImagePreparations();
  initializeViewerOpenStateCommand();
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
  requireFeatureInterface("search").prepareViewer({
    renderCatalogMenu: !isFavoritesLightboxMode()
  });
  syncLightboxModeUi();
  syncFullscreenButtonUi();
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
  requireFeatureInterface("search").setLightboxMobileOpen(false, { hideResults: true });
  invalidateViewerImageSwapCommand();
  stopViewerTouchMomentum();
  clearViewerPageWheelGesture();
  clearSingleImagePendingPosition();
  clearViewerImagePreparations();
  clearSingleViewerResolutionUpgrade();
  window.clearTimeout(viewerImageState.singleImageAnimationTimer);
  viewerElements.lightbox?.classList.add("hidden");
  viewerElements.lightbox?.classList.remove("show-ui", "show-page-rail", "catalog-entry-mode", "favorites-viewer-mode", "viewer-layout-paged", "viewer-layout-scroll", "viewer-layout-side", "viewer-scroll-zoom-isolated", "is-page-loading", "is-zoomed");
  syncViewerAutoZoomButtonUi();
  hideViewerZoomIndicator();
  viewerElements.lightboxImageFrame?.classList.remove("page-swap-enter");
  setViewerLoading(false);
  hideLightboxFloatingPreview();
  window.clearTimeout(viewerChromeState.uiHideTimer);
  window.clearTimeout(viewerChromeState.pageRailHideTimer);
  hideViewerPageIndicator();
  getFeatureInterface("catalog-grid")?.scheduleScrollTopButtonUpdate?.();
  setActiveViewerSource(LIGHTBOX_SOURCE_CATALOG);
  transitionViewerPhase(VIEWER_PHASE_CLOSED, "lightbox-hidden");
  finalizeViewerClosedStateCommand();
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

/** @param {string} id @param {number} [page] @param {ViewerOpenOptions} [options] */
function openCatalogInViewer(id, page = undefined, options = {}) {
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
  attachViewerPageControllerEvents();
  viewerElements.lightboxHomeLink?.addEventListener("click", returnToMainSiteFromLightbox);
  viewerElements.lightboxPinTopBar?.addEventListener("click", () => {
    toggleTopUiPinned();
    syncViewerMobileMoreMenuState();
    if (viewerOnboardingState.viewerOnboardingOpen) scheduleViewerOnboardingLayout(40);
  });
  viewerElements.lightboxBackdrop?.addEventListener("click", () => closeLightbox());
  viewerElements.lightbox?.addEventListener("pointerdown", handleLightboxPageRailEdgePointerDown, { capture: true, passive: false });
  viewerElements.lightbox?.addEventListener("pointerdown", handleLightboxPointerDownCapture, { capture: true });
  viewerElements.fullscreenToggle?.addEventListener("click", () => toggleBrowserFullscreen(viewerElements.fullscreenToggle));
  viewerElements.prevPageBtn?.addEventListener("click", () => moveLightbox(-1, { navigationSource: VIEWER_NAVIGATION_SOURCE_BUTTON }));
  viewerElements.nextPageBtn?.addEventListener("click", () => moveLightbox(1, { navigationSource: VIEWER_NAVIGATION_SOURCE_BUTTON }));
  viewerElements.fitAutoBtn?.addEventListener("click", () => {
    setViewerAutomaticFitMode();
    syncViewerMobileMoreMenuState();
  });
  viewerElements.fitHeightBtn?.addEventListener("click", () => {
    setViewerFitMode(VIEWER_FIT_HEIGHT);
    syncViewerMobileMoreMenuState();
  });
  viewerElements.fitWidthBtn?.addEventListener("click", () => {
    setViewerFitMode(VIEWER_FIT_WIDTH);
    syncViewerMobileMoreMenuState();
  });
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
    syncAutomaticViewerFitMode({ showUi: false, refreshLayout: false });
    applyZoom();
  });

  ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach((eventName) => {
    document.addEventListener(eventName, handleBrowserFullscreenChange);
  });

  window.visualViewport?.addEventListener("resize", handleViewerResize, { passive: true });
  if (typeof ResizeObserver === "function" && viewerElements.stageCanvas && !viewerStageResizeObserver) {
    viewerStageResizeObserver = new ResizeObserver(() => handleViewerResize());
    viewerStageResizeObserver.observe(viewerElements.stageCanvas);
  }

  reconcileViewerFullscreenPhase("viewer-events-attached");
  syncFullscreenButtonUi();
}

function flushViewerLayoutRefresh() {
  viewerLayoutRefreshRaf = 0;
  if (!isViewerSessionOpen()) return;
  hideLightboxFloatingPreview();
  syncAutomaticViewerFitMode({ showUi: false, refreshLayout: false });
  refreshLightboxLayoutForTopUiChange();
  if (viewerOnboardingState.viewerOnboardingOpen) scheduleViewerOnboardingLayout(40);
}

function handleViewerResize() {
  if (!isViewerSessionOpen() || viewerLayoutRefreshRaf) return;
  viewerLayoutRefreshRaf = window.requestAnimationFrame(flushViewerLayoutRefresh);
}

/** @param {KeyboardEvent} event */
function handleViewerGlobalKeydown(event) {
  if (!isViewerSessionOpen()) return false;
  if (viewerOnboardingState.viewerOnboardingOpen) {
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
    moveLightbox(1, { navigationSource: VIEWER_NAVIGATION_SOURCE_KEYBOARD });
  } else if (["ArrowUp", "PageUp"].includes(event.key)) {
    event.preventDefault();
    moveLightbox(-1, { navigationSource: VIEWER_NAVIGATION_SOURCE_KEYBOARD });
  } else if (event.key === "ArrowRight") {
    event.preventDefault();
    moveLightbox(-1, { navigationSource: VIEWER_NAVIGATION_SOURCE_KEYBOARD });
  } else if (event.key === "ArrowLeft") {
    event.preventDefault();
    moveLightbox(1, { navigationSource: VIEWER_NAVIGATION_SOURCE_KEYBOARD });
  } else if (event.key === "Home") {
    if (isFavoritesLightboxMode()) setFavoriteViewerIndex(0, { navigationSource: VIEWER_NAVIGATION_SOURCE_HOME_END });
    else setLightboxPage(catalogFirstPage(activeCatalog()), { navigationSource: VIEWER_NAVIGATION_SOURCE_HOME_END });
  } else if (event.key === "End") {
    const catalog = activeCatalog();
    if (!catalog) return false;
    if (isFavoritesLightboxMode()) {
      setFavoriteViewerIndex((getFeatureInterface("favorites")?.entries().length || 0) - 1, { navigationSource: VIEWER_NAVIGATION_SOURCE_HOME_END });
    }
    else setLightboxPage(catalogLastPage(catalog), { navigationSource: VIEWER_NAVIGATION_SOURCE_HOME_END });
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
  openCatalog: (catalogId, page = undefined, options = {}) => openCatalogInViewer(catalogId, page, options),
  close: (options = {}) => closeLightbox(options),
  refresh: (options = {}) => updateLightbox(options),
  renderPageRail: renderLightboxPageRail,
  prepareInquiry: () => {
    if (viewerOnboardingState.viewerOnboardingOpen) closeViewerOnboarding({ restoreFocus: false });
    closeViewerMobileMoreMenu();
    const search = requireFeatureInterface("search");
    if (search.isLightboxMobileOpen()) {
      search.setLightboxMobileOpen(false, { hideResults: true });
    }
  },
  setPage: (page, options = {}) => setLightboxPage(page, { navigationSource: VIEWER_NAVIGATION_SOURCE_PROGRAMMATIC, ...options }),
  syncMobileSearchUi: (isOpen) => viewerElements.lightbox?.classList.toggle("mobile-search-open", Boolean(isOpen)),
  showTopUi: () => showTopUiTemporarily(0),
  containsTopBarElement: (element) => Boolean(element && viewerElements.lightboxBar?.contains(element)),
  closeMobileMoreMenu: () => closeViewerMobileMoreMenu(),
  hideTopUiForSearch: () => {
    if (viewerChromeState.topUiPinned) return;
    window.clearTimeout(viewerChromeState.uiHideTimer);
    viewerElements.lightbox?.classList.remove("show-ui");
  },
  closeTopLayer: (event) => {
    if (!isViewerSessionOpen()) return false;
    if (viewerChromeState.viewerMobileMoreOpen) {
      closeViewerMobileMoreMenu({ returnFocus: true });
      return true;
    }
    if (viewerOnboardingState.viewerOnboardingOpen) {
      closeViewerOnboarding();
      return true;
    }
    const search = requireFeatureInterface("search");
    if (search.closeViewerTopLayer()) return true;
    if (isBrowserFullscreenActive()) {
      exitBrowserFullscreen().catch(() => {});
      return true;
    }

    const target = eventTargetElement(event?.target || null);
    if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
      search.hideViewerResults({ blurTopUiFocus: true });
      return true;
    }
    closeLightbox();
    return true;
  }
});
