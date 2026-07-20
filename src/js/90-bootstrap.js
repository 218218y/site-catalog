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
    if (isViewerSessionOpen()) {
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
    // Nested dialogs handle their own focus trap before the event reaches
    // window. Respect an event they already consumed, then use the shared
    // hierarchy for every remaining Escape press.
    if (event.defaultPrevented) return;
    if (handleTopLayerEscape(event)) return;
    if (!isViewerSessionOpen()) return;
    if (state.viewerInquiryOpen) {
      handleViewerInquiryKeydown(event);
      return;
    }
    if (state.viewerOnboardingOpen) {
      handleViewerOnboardingKeydown(event);
      return;
    }

    const target = event.target;
    const isTyping = target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    if (isTyping) return;

    if (["ArrowDown", "PageDown"].includes(event.key) && scrollViewerByViewport(1, { repeated: event.repeat })) event.preventDefault();
    else if (["ArrowUp", "PageUp"].includes(event.key) && scrollViewerByViewport(-1, { repeated: event.repeat })) event.preventDefault();
    else if (event.key === "ArrowDown" && panSingleImageBy(0, -getSingleKeyboardPanStep())) event.preventDefault();
    else if (event.key === "ArrowUp" && panSingleImageBy(0, getSingleKeyboardPanStep())) event.preventDefault();
    else if (event.key === "ArrowRight") {
      event.preventDefault();
      moveLightbox(-1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveLightbox(1);
    }
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
  bindFeatureEventsOnce("viewer-actions", attachViewerActionEvents);
  bindFeatureEventsOnce("viewer-onboarding", attachViewerOnboardingEvents);
  bindFeatureEventsOnce("viewer", attachViewerEvents);
  bindFeatureEventsOnce("navigation", attachNavigationEvents);
}

function hideCatalogDetailUi() {
  els.catalogDetail?.classList.add("hidden");
  els.catalogDetail?.classList.remove("in-view");
  setCatalogScrollTopButtonVisible(false);
}

function syncDocumentRouteShell(nextPage) {
  const showCatalogs = nextPage === "home";
  if (els.catalogsSection) {
    els.catalogsSection.classList.toggle("hidden", !showCatalogs);
    if (showCatalogs) {
      els.catalogsSection.removeAttribute("aria-hidden");
      // A route can start from a generated viewer/catalog document where the
      // home section is initially hidden. Reveal it deterministically instead
      // of waiting for an observer that may have skipped the hidden element.
      els.catalogsSection.classList.add("in-view");
    } else {
      els.catalogsSection.setAttribute("aria-hidden", "true");
    }
  }
}

function prepareDocumentRoute(nextPage) {
  if (nextPage !== "viewer" && isViewerSessionOpen()) hideLightboxUi();
  if (nextPage !== "favorites" && state.favoritesTransferPending) {
    closeFavoritesTransferDialog({ restoreFocus: false, cleanUrl: true });
  }
  if (nextPage !== "favorites" && state.favoriteNoteEditingKey) closeFavoriteNoteEditor({ restoreFocus: false });
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
  syncDocumentRouteShell(nextPage);
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
