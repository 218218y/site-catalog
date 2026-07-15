/**
 * Source module: 90-bootstrap.js
 * Cross-feature event wiring, route preparation, initialization, and application startup.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function attachEvents() {
  els.mobileCategoryMenuToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeGlobalSearchPanel({ focusButton: false });
    setMobileCategoryMenuOpen(!isMobileCategoryMenuOpen());
  });

  els.mobileCategoryMenu?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".category-nav-link");
    if (!link || !els.mobileCategoryMenu.contains(link)) return;
    closeMobileCategoryMenu();
    handleCatalogFocusLinkClick(link, event);
  });

  els.globalSearchOpen?.addEventListener("click", (event) => {
    event.preventDefault();
    ensureSearchIndexLoaded().catch(() => {});
    event.stopPropagation();
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    setGlobalSearchPanelOpen(!isGlobalSearchPanelOpen(), { focus: true, focusButton: true });
  });
  els.globalSearchClose?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeGlobalSearchPanel({ focusButton: true });
  });

  els.globalSearchInput?.addEventListener("input", () => {
    ensureSearchIndexLoaded().then(() => renderSearchResults(els.globalSearchInput.value)).catch(() => renderSearchResults(els.globalSearchInput.value));
  });
  els.globalSearchInput?.addEventListener("focus", () => {
    ensureSearchIndexLoaded().then(() => renderSearchResults(els.globalSearchInput.value)).catch(() => renderSearchResults(els.globalSearchInput.value));
  });
  els.globalSearchInput?.addEventListener("click", () => renderSearchResults(els.globalSearchInput.value));
  els.globalSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitGlobalSearch();
  });
  els.globalSearchClear?.addEventListener("click", () => {
    els.globalSearchInput.value = "";
    els.globalSearchInput.focus();
    renderSearchResults("");
  });

  els.globalSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    hideSearchFloatingPreview();
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderGlobalSearchScopeMenu();
    const isOpen = !els.globalSearchScopeMenu?.classList.contains("hidden");
    els.globalSearchScopeMenu?.classList.toggle("hidden", isOpen);
    els.globalSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  els.globalSearchScopeMenu?.addEventListener("click", (event) => {
    event.stopPropagation();
    const button = event.target.closest?.("[data-global-search-category]");
    if (!button || !els.globalSearchScopeMenu.contains(button)) return;
    setGlobalSearchCategory(button.dataset.globalSearchCategory);
    els.globalSearchInput?.focus();
  });
  els.catalogSearch?.addEventListener("wheel", handleGlobalSearchPanelWheel, { passive: false });
  els.globalSearchResults?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });
  els.globalSearchScopeMenu?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });
  els.lightboxSearchResults?.addEventListener("wheel", handleSearchPreviewScrollIntent, { passive: true });
  els.lightboxSearchResults?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });
  els.lightboxSearchScopeMenu?.addEventListener("wheel", handleSearchPreviewScrollIntent, { passive: true });
  els.lightboxSearchScopeMenu?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });

  els.lightboxSearchInput?.addEventListener("input", () => {
    ensureSearchIndexLoaded().then(() => renderLightboxSearchResults(els.lightboxSearchInput.value)).catch(() => renderLightboxSearchResults(els.lightboxSearchInput.value));
  });
  els.lightboxSearchInput?.addEventListener("focus", () => {
    showTopUiTemporarily(0);
    ensureSearchIndexLoaded().then(() => renderLightboxSearchResults(els.lightboxSearchInput.value)).catch(() => renderLightboxSearchResults(els.lightboxSearchInput.value));
  });
  els.lightboxSearchInput?.addEventListener("click", () => {
    showTopUiTemporarily(0);
    renderLightboxSearchResults(els.lightboxSearchInput.value);
  });
  els.lightboxSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitLightboxSearch();
  });
  els.lightboxSearchClear?.addEventListener("click", () => {
    els.lightboxSearchInput.value = "";
    els.lightboxSearchInput.focus();
    renderLightboxSearchResults("");
    showTopUiTemporarily(0);
  });

  els.lightboxMobileSearchToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLightboxMobileSearchOpen(!state.lightboxMobileSearchOpen, {
      focusInput: true,
      returnFocus: state.lightboxMobileSearchOpen
    });
  });
  els.lightboxMobileSearchClose?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLightboxMobileSearchOpen(false, { returnFocus: true, hideResults: true });
  });

  els.lightboxSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    hideSearchFloatingPreview();
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    const isOpen = !els.lightboxSearchScopeMenu?.classList.contains("hidden");
    els.lightboxSearchScopeMenu?.classList.toggle("hidden", isOpen);
    els.lightboxSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    showTopUiTemporarily(0);
  });
  els.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setLightboxSearchScope(button.dataset.lightboxSearchScope);
      showTopUiTemporarily(0);
      els.lightboxSearchInput?.focus();
    });
  });
  els.lightboxCatalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeDetailCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderLightboxCatalogMenu();
    const isOpen = !els.lightboxCatalogMenu?.classList.contains("hidden");
    els.lightboxCatalogMenu?.classList.toggle("hidden", isOpen);
    els.lightboxCatalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    showTopUiTemporarily(0);
  });
  els.lightboxCatalogMenu?.addEventListener("click", (event) => event.stopPropagation());
  els.lightboxSearchResults?.addEventListener("click", handleLightboxSearchResultsBackgroundClick);

  els.catalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderDetailCatalogMenu();
    const isOpen = !els.catalogMenu?.classList.contains("hidden");
    els.catalogMenu?.classList.toggle("hidden", isOpen);
    els.catalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  els.catalogMenu?.addEventListener("click", (event) => event.stopPropagation());

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

  els.openCatalogEntryFromDetail?.addEventListener("click", () => openLightbox(1));
  els.scrollToTopBtn?.addEventListener("click", () => scrollCatalogDetailIntoView());

  els.categoryNav?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".category-nav-link");
    if (!link || !els.categoryNav.contains(link)) return;
    closeMobileCategoryMenu();
    handleCatalogFocusLinkClick(link, event);
  });

  els.catalogGrid?.addEventListener("click", (event) => {
    const link = event.target.closest?.(".catalog-subcategory-nav-link");
    if (!link || !els.catalogGrid.contains(link)) return;
    handleCatalogFocusLinkClick(link, event);
  });

  els.headerCopyLink?.addEventListener("click", () => shareCurrentMainHeaderLink());
  els.favoritesBackdrop?.addEventListener("click", closeFavoritesPanel);
  els.favoritesCloseButton?.addEventListener("click", closeFavoritesPanel);
  els.favoritesClearButton?.addEventListener("click", clearAllFavorites);
  els.favoritesShareButton?.addEventListener("click", () => shareFavoritesList());
  els.favoritesGrid?.addEventListener("click", handleFavoritesGridClick);
  els.favoritesPanel?.addEventListener("keydown", handleFavoritesPanelKeydown);
  els.favoritesTransferBackdrop?.addEventListener("click", () => closeFavoritesTransferDialog({ cleanUrl: state.favoritesTransferPending?.source === "link" }));
  els.favoritesTransferCancel?.addEventListener("click", () => closeFavoritesTransferDialog({ cleanUrl: state.favoritesTransferPending?.source === "link" }));
  els.favoritesTransferMerge?.addEventListener("click", () => applyFavoritesTransfer("merge"));
  els.favoritesTransferReplace?.addEventListener("click", () => applyFavoritesTransfer("replace"));
  els.favoritesTransferOverlay?.addEventListener("keydown", handleFavoritesTransferKeydown);
  els.lightboxScreenshot?.addEventListener("click", () => downloadCurrentLightboxImage());
  els.lightboxCopyLink?.addEventListener("click", () => shareCurrentLightboxLink());
  els.viewerOnboardingPrevious?.addEventListener("click", () => moveViewerOnboardingStep(-1));
  els.viewerOnboardingNext?.addEventListener("click", () => moveViewerOnboardingStep(1));
  els.viewerOnboardingSkip?.addEventListener("click", () => closeViewerOnboarding());
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


  window.addEventListener("storage", handleFavoritesStorageChange);

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

  ["fullscreenchange", "webkitfullscreenchange", "mozfullscreenchange", "MSFullscreenChange"].forEach((eventName) => {
    document.addEventListener(eventName, syncFullscreenButtonUi);
  });

  syncFullscreenButtonUi();

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

  document.addEventListener("click", handleInternalAppLinkClick);

  window.addEventListener("popstate", (event) => {
    const routeState = event.state && typeof event.state === "object" ? event.state : null;
    if (!hasInDocumentRouteSession && !routeState?.[IN_DOCUMENT_ROUTE_STATE_KEY]) return;

    hasInDocumentRouteSession = true;
    initDocumentRoute({
      scrollPosition: {
        x: routeState?.scrollX || 0,
        y: routeState?.scrollY || 0
      }
    });
  });

  window.addEventListener("hashchange", () => {
    if (!isAppPage("home")) return;
    syncCatalogCategoryFocusFromHash();
  });

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
