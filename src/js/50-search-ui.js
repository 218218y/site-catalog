/**
 * Source module: 50-search-ui.js
 * Search composition root. Global, reader, runtime, and preview capabilities
 * remain separate owners while cross-surface coordination lives here.
 */

import { currentAppPage } from "./00-navigation.js";
import { eventTargetElement } from "./02-dom-contracts.js";
import { getFeatureInterface, registerFeatureInterface } from "./10-app-state.js";
import { searchElements, searchState } from "./13-search-state.js";
import { isHtmlElement } from "./21-ui-runtime.js";
import { configureSearchIndexStatusRefresh, ensureSearchIndexLoaded, scheduleSearchIndexPreload } from "./42-search-runtime.js";
import { handleSearchPreviewScrollIntent, hideSearchFloatingPreview, suppressSearchFloatingPreview } from "./47-search-preview.js";
import {
  cancelGlobalSearchRender,
  closeGlobalSearchPanel,
  closeGlobalSearchScopeMenu,
  handleGlobalSearchPanelWheel,
  initSearchStatus,
  isGlobalSearchPanelOpen,
  renderGlobalSearchScopeMenu,
  renderSearchResults,
  scheduleGlobalSearchRender,
  setGlobalSearchCategory,
  setGlobalSearchPanelOpen,
  submitGlobalSearch
} from "./48-global-search-ui.js";
import {
  cancelViewerSearchRender,
  closeLightboxCatalogMenu,
  closeLightboxSearchScopeMenu,
  closeLightboxViewerMenus,
  handleLightboxSearchResultsBackgroundClick,
  hideLightboxSearchResults,
  initLightboxSearchStatus,
  prepareViewerSearch,
  renderLightboxCatalogMenu,
  renderLightboxSearchResults,
  scheduleViewerSearchRender,
  setLightboxMobileSearchOpen,
  setLightboxSearchScope,
  submitLightboxSearch,
  syncLightboxMobileSearchUi,
  updateLightboxSearchResultsLayout
} from "./49-search-reader-ui.js";

function attachSearchUiEvents() {
  searchElements.globalSearchOpen?.addEventListener("click", (event) => {
    event.preventDefault();
    ensureSearchIndexLoaded().catch(() => {});
    event.stopPropagation();
    getFeatureInterface("catalog-detail")?.close();
    closeLightboxViewerMenus();
    setGlobalSearchPanelOpen(!isGlobalSearchPanelOpen(), { focus: true, focusButton: true });
  });
  searchElements.globalSearchClose?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeGlobalSearchPanel({ focusButton: true });
  });
  searchElements.globalSearchInput?.addEventListener("input", () => {
    scheduleGlobalSearchRender(searchElements.globalSearchInput.value);
  });
  searchElements.globalSearchInput?.addEventListener("focus", () => {
    ensureSearchIndexLoaded().catch(() => {});
    scheduleGlobalSearchRender(searchElements.globalSearchInput.value, { immediate: true });
  });
  searchElements.globalSearchInput?.addEventListener("click", () => scheduleGlobalSearchRender(searchElements.globalSearchInput.value, { immediate: true }));
  searchElements.globalSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitGlobalSearch().catch(() => {});
  });
  searchElements.globalSearchClear?.addEventListener("click", () => {
    cancelGlobalSearchRender();
    searchElements.globalSearchInput.value = "";
    searchElements.globalSearchInput.focus();
    renderSearchResults("");
  });
  searchElements.globalSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    hideSearchFloatingPreview();
    getFeatureInterface("catalog-detail")?.close();
    closeLightboxViewerMenus();
    renderGlobalSearchScopeMenu();
    const isOpen = !searchElements.globalSearchScopeMenu?.classList.contains("hidden");
    searchElements.globalSearchScopeMenu?.classList.toggle("hidden", isOpen);
    searchElements.globalSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  searchElements.globalSearchScopeMenu?.addEventListener("click", (event) => {
    event.stopPropagation();
    const button = eventTargetElement(event.target)?.closest("[data-global-search-category]");
    if (!isHtmlElement(button) || !searchElements.globalSearchScopeMenu.contains(button)) return;
    setGlobalSearchCategory(button.dataset.globalSearchCategory);
    searchElements.globalSearchInput?.focus();
  });
  searchElements.catalogSearch?.addEventListener("wheel", handleGlobalSearchPanelWheel, { passive: false });
  searchElements.globalSearchResults?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });
  searchElements.globalSearchScopeMenu?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });
  searchElements.lightboxSearchResults?.addEventListener("wheel", handleSearchPreviewScrollIntent, { passive: true });
  searchElements.lightboxSearchResults?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });
  searchElements.lightboxSearchScopeMenu?.addEventListener("wheel", handleSearchPreviewScrollIntent, { passive: true });
  searchElements.lightboxSearchScopeMenu?.addEventListener("scroll", () => suppressSearchFloatingPreview(), { passive: true });

  searchElements.lightboxSearchInput?.addEventListener("input", () => {
    scheduleViewerSearchRender(searchElements.lightboxSearchInput.value);
  });
  searchElements.lightboxSearchInput?.addEventListener("focus", () => {
    getFeatureInterface("viewer")?.showTopUi?.();
    ensureSearchIndexLoaded().catch(() => {});
    scheduleViewerSearchRender(searchElements.lightboxSearchInput.value, { immediate: true });
  });
  searchElements.lightboxSearchInput?.addEventListener("click", () => {
    getFeatureInterface("viewer")?.showTopUi?.();
    scheduleViewerSearchRender(searchElements.lightboxSearchInput.value, { immediate: true });
  });
  searchElements.lightboxSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitLightboxSearch().catch(() => {});
  });
  searchElements.lightboxSearchClear?.addEventListener("click", () => {
    cancelViewerSearchRender();
    searchElements.lightboxSearchInput.value = "";
    searchElements.lightboxSearchInput.focus();
    renderLightboxSearchResults("");
    getFeatureInterface("viewer")?.showTopUi?.();
  });
  searchElements.lightboxMobileSearchToggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLightboxMobileSearchOpen(!searchState.lightboxMobileSearchOpen, {
      focusInput: true,
      returnFocus: searchState.lightboxMobileSearchOpen
    });
  });
  searchElements.lightboxMobileSearchClose?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    setLightboxMobileSearchOpen(false, { returnFocus: true, hideResults: true });
  });
  searchElements.lightboxSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    hideSearchFloatingPreview();
    getFeatureInterface("catalog-detail")?.close();
    closeLightboxCatalogMenu();
    const isOpen = !searchElements.lightboxSearchScopeMenu?.classList.contains("hidden");
    searchElements.lightboxSearchScopeMenu?.classList.toggle("hidden", isOpen);
    searchElements.lightboxSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    getFeatureInterface("viewer")?.showTopUi?.();
  });
  Array.from(searchElements.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]") || []).filter(isHtmlElement).forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setLightboxSearchScope(button.dataset.lightboxSearchScope);
      getFeatureInterface("viewer")?.showTopUi?.();
      searchElements.lightboxSearchInput?.focus();
    });
  });
  searchElements.lightboxCatalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    getFeatureInterface("catalog-detail")?.close();
    closeLightboxSearchScopeMenu();
    renderLightboxCatalogMenu();
    const isOpen = !searchElements.lightboxCatalogMenu?.classList.contains("hidden");
    searchElements.lightboxCatalogMenu?.classList.toggle("hidden", isOpen);
    searchElements.lightboxCatalogMenuToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    getFeatureInterface("viewer")?.showTopUi?.();
  });
  searchElements.lightboxCatalogMenu?.addEventListener("click", (event) => event.stopPropagation());
  searchElements.lightboxSearchResults?.addEventListener("click", handleLightboxSearchResultsBackgroundClick);
}

/** @param {string} nextPage */
function prepareSearchRoute(nextPage) {
  closeGlobalSearchPanel({ focusButton: false });
  closeGlobalSearchScopeMenu();
  closeLightboxViewerMenus();
  if (nextPage !== "viewer") setLightboxMobileSearchOpen(false, { hideResults: true });
}

/** @param {EventTarget|null} target */
function handleSearchDocumentPointer(target) {
  if (!(target instanceof Node)) {
    prepareSearchRoute(currentAppPage);
    return false;
  }
  const insideGlobalSearch = searchElements.catalogSearch.contains(target) || searchElements.globalSearchOpen.contains(target);
  const insideMobileReaderSearch = searchElements.lightboxSearchPanel.contains(target) || searchElements.lightboxMobileSearchToggle.contains(target);
  if (insideGlobalSearch) {
    if (!searchElements.globalSearchScopeMenu.contains(target) && !searchElements.globalSearchScopeToggle.contains(target)) closeGlobalSearchScopeMenu();
    closeLightboxViewerMenus();
    getFeatureInterface("catalog-detail")?.close();
    return true;
  }
  if (insideMobileReaderSearch) return true;
  if (searchState.lightboxMobileSearchOpen) setLightboxMobileSearchOpen(false, { hideResults: true });
  if (searchElements.lightboxSearchScopeMenu.contains(target) || searchElements.lightboxSearchScopeToggle.contains(target)) return true;
  if (searchElements.lightboxCatalogMenu.contains(target) || searchElements.lightboxCatalogMenuToggle.contains(target)) return true;
  closeGlobalSearchPanel({ focusButton: false });
  closeGlobalSearchScopeMenu();
  closeLightboxViewerMenus();
  return false;
}

function initializeSearchUi() {
  configureSearchIndexStatusRefresh(() => {
    initSearchStatus();
    initLightboxSearchStatus();
  });
  syncLightboxMobileSearchUi();
  renderGlobalSearchScopeMenu();
  scheduleSearchIndexPreload();
  initSearchStatus();
}

function handleSearchResize() {
  hideSearchFloatingPreview();
  updateLightboxSearchResultsLayout(Number(searchElements.lightboxSearchResults.dataset.resultCount || 0));
  syncLightboxMobileSearchUi();
}

function handleSearchScroll() {
  hideSearchFloatingPreview();
}

registerFeatureInterface("search", {
  escapePriority: 300,
  closeTopLayer: () => {
    if (!isGlobalSearchPanelOpen()) return false;
    if (searchElements.globalSearchScopeMenu && !searchElements.globalSearchScopeMenu.classList.contains("hidden")) closeGlobalSearchScopeMenu();
    else closeGlobalSearchPanel({ focusButton: true });
    return true;
  },
  closeViewerTopLayer: () => {
    if (searchState.lightboxMobileSearchOpen) {
      setLightboxMobileSearchOpen(false, { returnFocus: true, hideResults: true });
      return true;
    }
    if (
      (searchElements.lightboxCatalogMenu && !searchElements.lightboxCatalogMenu.classList.contains("hidden")) ||
      (searchElements.lightboxSearchScopeMenu && !searchElements.lightboxSearchScopeMenu.classList.contains("hidden"))
    ) {
      closeLightboxViewerMenus();
      return true;
    }
    return false;
  },
  isLightboxMobileOpen: () => searchState.lightboxMobileSearchOpen,
  setLightboxMobileOpen: (open, options = {}) => setLightboxMobileSearchOpen(open, options),
  containsLightboxResult: (target) => Boolean(
    target?.closest?.("[data-lightbox-search-page]") &&
    searchElements.lightboxSearchResults.contains(target.closest("[data-lightbox-search-page]"))
  ),
  prepareViewer: (options = {}) => prepareViewerSearch(options),
  syncViewerStatus: initLightboxSearchStatus,
  closeViewerMenus: closeLightboxViewerMenus,
  hideViewerResults: (options = {}) => hideLightboxSearchResults(options),
  closeGlobalPanel: (options = {}) => closeGlobalSearchPanel(options),
  attachEvents: attachSearchUiEvents,
  initialize: initializeSearchUi,
  prepareRoute: prepareSearchRoute,
  handleDocumentPointer: handleSearchDocumentPointer,
  handleResize: handleSearchResize,
  handleScroll: handleSearchScroll
});
