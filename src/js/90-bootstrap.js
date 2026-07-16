/**
 * Source module: 90-bootstrap.js
 * Application composition root: feature registration, route preparation, and startup.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function attachShellEvents() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    const insideGlobalSearch = Boolean(els.catalogSearch?.contains(target) || els.globalSearchOpen?.contains(target));
    const insideMobileReaderSearch = Boolean(
      els.lightboxSearchPanel?.contains(target) || els.lightboxMobileSearchToggle?.contains(target)
    );

    if (!els.mobileCategoryMenu?.contains(target) && !els.mobileCategoryMenuToggle?.contains(target)) {
      closeMobileCategoryMenu();
    }

    if (insideGlobalSearch) {
      if (!els.globalSearchScopeMenu?.contains(target) && !els.globalSearchScopeToggle?.contains(target)) {
        closeGlobalSearchScopeMenu();
      }
      closeLightboxSearchScopeMenu();
      closeLightboxCatalogMenu();
      closeDetailCatalogMenu();
      return;
    }
    if (insideMobileReaderSearch) return;
    if (state.lightboxMobileSearchOpen) {
      setLightboxMobileSearchOpen(false, { hideResults: true });
    }
    if (els.lightboxSearchScopeMenu?.contains(target) || els.lightboxSearchScopeToggle?.contains(target)) return;
    if (els.lightboxCatalogMenu?.contains(target) || els.lightboxCatalogMenuToggle?.contains(target)) return;
    if (els.catalogMenu?.contains(target) || els.catalogMenuToggle?.contains(target)) return;
    closeGlobalSearchPanel({ focusButton: false });
    closeGlobalSearchScopeMenu();
    closeLightboxSearchScopeMenu();
    closeLightboxCatalogMenu();
    closeDetailCatalogMenu();
  });

  window.addEventListener("resize", () => {
    if (!window.matchMedia("(max-width: 760px)").matches) closeMobileCategoryMenu();
    scheduleCatalogLayoutRefresh();
    scheduleCategoryNavFit();
    hideSearchFloatingPreview();
    scheduleCatalogScrollTopButtonUpdate();
    updateLightboxSearchResultsLayout(els.lightboxSearchResults?.dataset.resultCount || 0);
    syncLightboxMobileSearchUi();
    if (state.lightboxOpen) {
      hideLightboxFloatingPreview();
      refreshLightboxLayoutForTopUiChange();
      if (state.viewerOnboardingOpen) scheduleViewerOnboardingLayout(40);
    }
  });
  window.addEventListener("scroll", () => {
    hideSearchFloatingPreview();
    scheduleCatalogScrollTopButtonUpdate();
  }, { passive: true });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.favoritesOpen) {
      event.preventDefault();
      closeFavoritesPanel();
      return;
    }
    if (event.key === "Escape" && isMobileCategoryMenuOpen()) {
      event.preventDefault();
      closeMobileCategoryMenu({ focusButton: true });
      return;
    }
    if (event.key === "Escape" && isGlobalSearchPanelOpen()) {
      event.preventDefault();
      if (els.globalSearchScopeMenu && !els.globalSearchScopeMenu.classList.contains("hidden")) {
        closeGlobalSearchScopeMenu();
        return;
      }
      closeGlobalSearchPanel({ focusButton: true });
      return;
    }
    if (event.key === "Escape" && els.catalogMenu && !els.catalogMenu.classList.contains("hidden")) {
      event.preventDefault();
      closeDetailCatalogMenu();
      return;
    }
    if (!state.lightboxOpen) return;
    if (state.viewerOnboardingOpen) {
      handleViewerOnboardingKeydown(event);
      return;
    }
    if (event.key === "Escape" && state.lightboxMobileSearchOpen) {
      event.preventDefault();
      setLightboxMobileSearchOpen(false, { returnFocus: true, hideResults: true });
      return;
    }
    if (event.key === "Escape" && ((els.lightboxCatalogMenu && !els.lightboxCatalogMenu.classList.contains("hidden")) || (els.lightboxSearchScopeMenu && !els.lightboxSearchScopeMenu.classList.contains("hidden")))) {
      event.preventDefault();
      closeLightboxCatalogMenu();
      closeLightboxSearchScopeMenu();
      return;
    }
    if (event.key === "Escape" && isBrowserFullscreenActive()) {
      event.preventDefault();
      exitBrowserFullscreen().catch(() => {});
      return;
    }
    const target = event.target;
    const isTyping = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    if (isTyping) {
      if (event.key === "Escape") {
        hideLightboxSearchResults({ blurTopUiFocus: true });
      }
      return;
    }
    if (event.key === "Escape") closeLightbox();
    else if (event.key === "ArrowDown" && scrollViewerByViewport(1)) event.preventDefault();
    else if (event.key === "ArrowUp" && scrollViewerByViewport(-1)) event.preventDefault();
    else if (event.key === "ArrowDown" && panSingleImageBy(0, -getSingleKeyboardPanStep())) event.preventDefault();
    else if (event.key === "ArrowUp" && panSingleImageBy(0, getSingleKeyboardPanStep())) event.preventDefault();
    else if (event.key === "ArrowRight") moveLightbox(-1);
    else if (event.key === "ArrowLeft") moveLightbox(1);
    else if (event.key === "Home") {
      if (isFavoritesLightboxMode()) setFavoriteViewerIndex(0);
      else setLightboxPage(1);
    } else if (event.key === "End" && state.catalog) {
      if (isFavoritesLightboxMode()) setFavoriteViewerIndex(getFavoriteEntries().length - 1);
      else setLightboxPage(state.catalog.pages);
    }
  });
}

function attachEvents() {
  bindFeatureEventsOnce("catalog-grid", attachCatalogGridEvents);
  bindFeatureEventsOnce("search-ui", attachSearchUiEvents);
  bindFeatureEventsOnce("shell", attachShellEvents);
  bindFeatureEventsOnce("favorites-share", attachFavoritesShareEvents);
  bindFeatureEventsOnce("viewer-onboarding", attachViewerOnboardingEvents);
  bindFeatureEventsOnce("viewer", attachViewerEvents);
  bindFeatureEventsOnce("navigation", attachNavigationEvents);
}

function hideCatalogDetailUi() {
  els.catalogDetail?.classList.add("hidden");
  els.catalogDetail?.classList.remove("in-view");
  setCatalogScrollTopButtonVisible(false);
}

function prepareDocumentRoute(nextPage) {
  if (nextPage !== "viewer" && state.lightboxOpen) hideLightboxUi();
  if (nextPage !== "favorites" && state.favoritesTransferPending) {
    closeFavoritesTransferDialog({ restoreFocus: false, cleanUrl: true });
  }
  if (nextPage !== "favorites" && (state.favoritesOpen || els.favoritesPanel?.classList.contains("favorites-standalone-page"))) {
    hideFavoritesPanelUi();
  }
  if (nextPage !== "catalog") hideCatalogDetailUi();

  closeMobileCategoryMenu();
  closeGlobalSearchPanel({ focusButton: false });
  closeGlobalSearchScopeMenu();
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();
  closeDetailCatalogMenu();

  setCurrentAppPage(nextPage);
  syncDocumentLock();
  syncFullscreenButtonUi();
}

function restoreDocumentRouteScroll(position) {
  if (!position) return;
  const x = Number.isFinite(Number(position.x)) ? Number(position.x) : 0;
  const y = Number.isFinite(Number(position.y)) ? Number(position.y) : 0;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => window.scrollTo(x, y));
  });
}

function initDocumentRoute(options = {}) {
  const route = siteRoutes?.parseLocation?.(window.location) || {
    page: currentAppPage,
    catalogId: "",
    currentPage: 1,
    source: LIGHTBOX_SOURCE_CATALOG
  };

  prepareDocumentRoute(route.page);
  if (route.page === "home") {
    state.catalog = null;
    state.page = 1;
    syncCatalogCategoryFocusFromHash({ animate: false, scroll: Boolean(window.location.hash) });
    updateDocumentMetadata();
    if (!window.location.hash) restoreDocumentRouteScroll(options.scrollPosition);
    return true;
  }

  if (route.page === "favorites") {
    state.catalog = null;
    state.page = 1;
    openFavoritesPanel({ allowEmpty: true, captureReturnFocus: false });
    processFavoritesSelectionFromUrl();
    restoreDocumentRouteScroll(options.scrollPosition);
    return true;
  }

  const catalog = findCatalogById(route.catalogId);
  if (!catalog) {
    navigateTo(homeDocumentUrl(), { replace: true });
    return false;
  }

  if (route.page === "catalog") {
    openCatalog(catalog.id, { scrollBehavior: "auto" });
    restoreDocumentRouteScroll(options.scrollPosition);
    return true;
  }

  if (route.page === "viewer") {
    if (route.source === LIGHTBOX_SOURCE_FAVORITES) {
      const entries = getFavoriteEntries();
      const favoriteIndex = findFavoriteEntryIndex(entries, catalog.id, route.currentPage);
      if (favoriteIndex < 0) {
        navigateTo(favoritesDocumentUrl(), { replace: true });
        return false;
      }
      openCatalogInViewer(catalog.id, route.currentPage, {
        source: LIGHTBOX_SOURCE_FAVORITES,
        favoriteIndex
      });
      return true;
    }

    openCatalogInViewer(catalog.id, route.currentPage);
    return true;
  }

  navigateTo(homeDocumentUrl(), { replace: true });
  return false;
}

function init() {
  telemetryInit();
  initRevealObserver();
  initCategoryNavFit();
  initImagePlaceholderObserver();
  attachEvents();
  syncLightboxMobileSearchUi();
  syncFavoritesUi({ renderPanel: isAppPage("favorites") });

  if (!catalogs.length) {
    renderEmptyState();
    return true;
  }

  renderCatalogCards();
  renderGlobalSearchScopeMenu();
  scheduleSearchIndexPreload();
  fillCatalogSelect();
  initSearchStatus();
  return initDocumentRoute();
}

let initResult = true;
try {
  initResult = init();
} finally {
  if (initResult !== false) markAppReady();
}
