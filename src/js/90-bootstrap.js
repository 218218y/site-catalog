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
    const insideGlobalSearch = Boolean(searchElements.catalogSearch?.contains(target) || searchElements.globalSearchOpen?.contains(target));
    const insideMobileReaderSearch = Boolean(
      searchElements.lightboxSearchPanel?.contains(target) || searchElements.lightboxMobileSearchToggle?.contains(target)
    );

    if (
      featureCapabilities.catalogGrid &&
      !shellElements.mobileCategoryMenu?.contains(target) &&
      !shellElements.mobileCategoryMenuToggle?.contains(target)
    ) {
      getFeatureInterface("catalog-grid")?.closeMobileMenu?.();
    }

    if (insideGlobalSearch) {
      if (!searchElements.globalSearchScopeMenu?.contains(target) && !searchElements.globalSearchScopeToggle?.contains(target)) {
        closeGlobalSearchScopeMenu();
      }
      closeLightboxSearchScopeMenu();
      closeLightboxCatalogMenu();
      closeDetailCatalogMenu();
      return;
    }
    if (insideMobileReaderSearch) return;
    if (searchState.lightboxMobileSearchOpen) {
      setLightboxMobileSearchOpen(false, { hideResults: true });
    }
    if (searchElements.lightboxSearchScopeMenu?.contains(target) || searchElements.lightboxSearchScopeToggle?.contains(target)) return;
    if (searchElements.lightboxCatalogMenu?.contains(target) || searchElements.lightboxCatalogMenuToggle?.contains(target)) return;
    if (catalogElements.catalogMenu?.contains(target) || catalogElements.catalogMenuToggle?.contains(target)) return;
    closeGlobalSearchPanel({ focusButton: false });
    closeGlobalSearchScopeMenu();
    closeLightboxSearchScopeMenu();
    closeLightboxCatalogMenu();
    closeDetailCatalogMenu();
  });

  window.addEventListener("resize", () => {
    if (featureCapabilities.catalogGrid) {
      const catalogGrid = getFeatureInterface("catalog-grid");
      if (!window.matchMedia("(max-width: 760px)").matches) catalogGrid?.closeMobileMenu?.();
      catalogGrid?.scheduleLayoutRefresh?.();
      catalogGrid?.scheduleCategoryNavFit?.();
    }
    hideSearchFloatingPreview();
    if (featureCapabilities.catalogGrid) getFeatureInterface("catalog-grid")?.scheduleScrollTopButtonUpdate?.();
    if (featureCapabilities.search) {
      updateLightboxSearchResultsLayout(searchElements.lightboxSearchResults?.dataset.resultCount || 0);
      syncLightboxMobileSearchUi();
    }
    getFeatureInterface("viewer")?.handleResize?.();
  });
  window.addEventListener("scroll", () => {
    hideSearchFloatingPreview();
    if (featureCapabilities.catalogGrid) getFeatureInterface("catalog-grid")?.scheduleScrollTopButtonUpdate?.();
  }, { passive: true });

  window.addEventListener("keydown", (event) => {
    // Nested dialogs handle their own focus trap before the event reaches
    // window. Respect an event they already consumed, then use the shared
    // hierarchy for every remaining Escape press.
    if (event.defaultPrevented) return;
    if (handleTopLayerEscape(event)) return;
    getFeatureInterface("viewer")?.handleGlobalKeydown?.(event);
  });
}

function attachEvents() {
  const catalogGrid = getFeatureInterface("catalog-grid");
  if (featureCapabilities.catalogGrid && catalogGrid?.attachEvents) {
    bindFeatureEventsOnce("catalog-grid", catalogGrid.attachEvents);
  }
  if (featureCapabilities.search) bindFeatureEventsOnce("search-ui", attachSearchUiEvents);
  bindFeatureEventsOnce("shell", attachShellEvents);
  bindFeatureEventsOnce("favorites-share", attachFavoritesShareEvents);
  const inquiry = getFeatureInterface("inquiry");
  if (inquiry?.attachEvents) bindFeatureEventsOnce("inquiry", inquiry.attachEvents);
  const viewer = getFeatureInterface("viewer");
  if (featureCapabilities.viewer && viewer?.attachEvents) {
    bindFeatureEventsOnce("viewer", viewer.attachEvents);
  }
  bindFeatureEventsOnce("navigation", attachNavigationEvents);
}

function hideCatalogDetailUi() {
  getFeatureInterface("catalog-grid")?.hideDetail?.();
}

function syncDocumentRouteShell(nextPage) {
  const showCatalogs = nextPage === "home";
  if (shellElements.catalogsSection) {
    shellElements.catalogsSection.classList.toggle("hidden", !showCatalogs);
    if (showCatalogs) {
      shellElements.catalogsSection.removeAttribute("aria-hidden");
      // A route can start from a generated viewer/catalog document where the
      // home section is initially hidden. Reveal it deterministically instead
      // of waiting for an observer that may have skipped the hidden element.
      shellElements.catalogsSection.classList.add("in-view");
    } else {
      shellElements.catalogsSection.setAttribute("aria-hidden", "true");
    }
  }
}

function prepareDocumentRoute(nextPage) {
  getFeatureInterface("viewer")?.prepareRoute?.(nextPage);
  if (nextPage !== "favorites" && favoritesState.favoritesTransferPending) {
    closeFavoritesTransferDialog({ restoreFocus: false, cleanUrl: true });
  }
  if (featureCapabilities.favoritesWorkspace && nextPage !== "favorites" && favoritesState.favoriteNoteEditingKey) {
    getFeatureInterface("favorites-workspace")?.closeNoteEditor?.({ restoreFocus: false });
  }
  if (nextPage !== "favorites" && (favoritesState.favoritesOpen || favoritesElements.favoritesPanel?.classList.contains("favorites-standalone-page"))) {
    hideFavoritesPanelUi();
  }
  if (nextPage !== "catalog") hideCatalogDetailUi();

  if (featureCapabilities.catalogGrid) getFeatureInterface("catalog-grid")?.closeMobileMenu?.();
  if (featureCapabilities.search) {
    closeGlobalSearchPanel({ focusButton: false });
    closeGlobalSearchScopeMenu();
    closeLightboxSearchScopeMenu();
    closeLightboxCatalogMenu();
    closeDetailCatalogMenu();
  }

  setCurrentAppPage(nextPage);
  syncDocumentRouteShell(nextPage);
  syncDocumentLock();

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
    navigationState.catalog = null;
    navigationState.page = 1;
    if (featureCapabilities.catalogGrid) {
      getFeatureInterface("catalog-grid")?.syncCategoryFocusFromHash?.({ animate: false, scroll: Boolean(window.location.hash) });
    }
    updateDocumentMetadata();
    if (!window.location.hash) restoreDocumentRouteScroll(options.scrollPosition);
    return true;
  }

  if (route.page === "favorites") {
    navigationState.catalog = null;
    navigationState.page = 1;
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
    getFeatureInterface("catalog-grid")?.openCatalog?.(catalog.id, { scrollBehavior: "auto" });
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
      getFeatureInterface("viewer")?.openCatalog?.(catalog.id, route.currentPage, {
        source: LIGHTBOX_SOURCE_FAVORITES,
        favoriteIndex
      });
      return true;
    }

    getFeatureInterface("viewer")?.openCatalog?.(catalog.id, route.currentPage);
    return true;
  }

  navigateTo(homeDocumentUrl(), { replace: true });
  return false;
}

function init() {
  telemetryInit();
  if (featureCapabilities.catalogGrid) {
    getFeatureInterface("catalog-grid")?.initialize?.();
  }
  initImagePlaceholderObserver();
  attachEvents();
  if (featureCapabilities.search) syncLightboxMobileSearchUi();
  syncFavoritesUi({ renderPanel: isAppPage("favorites") });

  if (!catalogs.length) {
    if (featureCapabilities.catalogGrid) getFeatureInterface("catalog-grid")?.renderEmptyState?.();
    return true;
  }

  if (featureCapabilities.catalogGrid) getFeatureInterface("catalog-grid")?.renderInitialContent?.();
  if (featureCapabilities.search) {
    renderGlobalSearchScopeMenu();
    scheduleSearchIndexPreload();
    initSearchStatus();
  }
  return initDocumentRoute();
}

let initResult = true;
try {
  initResult = init();
} finally {
  if (initResult !== false) markAppReady();
}
