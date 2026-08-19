/**
 * Source module: 49-viewer-search-ui.js
 * Viewer search scope, mobile reader controls, results, and catalog menu.
 */

/** @import { CatalogOcrSearchResult, LightboxSearchScope, SearchViewerPrepareOptions } from "../../types/frontend-contracts.js" */
/** @typedef {{immediate?:boolean}} SearchScheduleOptions */
/** @typedef {{render?:boolean}} SearchScopeChangeOptions */
/** @typedef {{focusInput?:boolean, returnFocus?:boolean, hideResults?:boolean, hideTopUi?:boolean}} LightboxMobileSearchOptions */
/** @typedef {{blurTopUiFocus?:boolean, hideTopUi?:boolean}} LightboxSearchHideOptions */
/** @typedef {{isCurrent?:()=>boolean}} SearchRequestControl */
/** @typedef {{limit:number, channel:"viewer", catalogId?:string}} CatalogSearchRequestOptions */

import { eventTargetElement } from "./02-dom-contracts.js";
import { catalogSearch, catalogs } from "./03-runtime-context.js";
import { getFeatureInterface, requireFeatureInterface } from "./10-app-state.js";
import { MOBILE_READER_SEARCH_MEDIA, SEARCH_INPUT_DEBOUNCE_MS, searchElements, searchState } from "./13-search-state.js";
import { telemetryTrackSearch } from "../runtime/telemetry.js";
import { pageSrc, thumbSrc } from "./17-catalog-asset-urls.js";
import { activeCatalog } from "./18-navigation-feature.js";
import { escapeHtml } from "./19-shared-pure.js";
import { catalogImageDimensionAttributes, catalogImageRecoveryAttributes, clampPage, mediumSrc } from "./20-catalog-runtime.js";
import { isHtmlElement } from "./21-ui-runtime.js";
import { searchCatalogDomain } from "./39-search-catalog-domain.js";
import { ensureSearchIndexLoaded, normalizeSearchResultsDirection, retrySearchIndexLoad, searchEmptyStateMarkup, searchIndexErrorMarkup } from "./42-search-runtime.js";
import { bindSearchFloatingPreviewEvents, handleSearchPreviewScrollIntent, hideSearchFloatingPreview, suppressSearchFloatingPreview } from "./47-search-preview.js";

let lightboxSearchRenderTimer = 0;
let lightboxSearchRenderSequence = 0;
/** @type {Array<CatalogOcrSearchResult>} */
let lastLightboxSearchResults = [];
let lastLightboxSearchKey = "";

function cancelViewerSearchRender() {
  window.clearTimeout(lightboxSearchRenderTimer);
  lightboxSearchRenderTimer = 0;
  lightboxSearchRenderSequence += 1;
  catalogSearch.cancel("viewer");
}

/** @param {unknown} query @param {SearchScheduleOptions} [options] */
function scheduleViewerSearchRender(query, options = {}) {
  catalogSearch.cancel("viewer");
  lightboxSearchRenderSequence += 1;
  window.clearTimeout(lightboxSearchRenderTimer);
  lightboxSearchRenderTimer = window.setTimeout(
    () => renderLightboxSearchResults(query),
    options.immediate ? 0 : SEARCH_INPUT_DEBOUNCE_MS
  );
}

/** @returns {LightboxSearchScope} */
function getLightboxSearchScope() {
  return searchState.lightboxSearchScope === "all" ? "all" : "catalog";
}

/** @param {LightboxSearchScope} [scope] */
function lightboxSearchScopeLabel(scope = getLightboxSearchScope()) {
  return scope === "all" ? "בכל הקטלוגים" : "בקטלוג הזה";
}

function lightboxSearchPlaceholder() {
  if (getLightboxSearchScope() === "all") return "חיפוש דגם בכל הקטלוגים...";
  const title = String(activeCatalog()?.title || "").trim();
  return title ? `חיפוש ב: ${title}` : "חיפוש ב...";
}

function closeLightboxSearchScopeMenu() {
  searchElements.lightboxSearchScopeMenu?.classList.add("hidden");
  searchElements.lightboxSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function closeLightboxCatalogMenu() {
  searchElements.lightboxCatalogMenu?.classList.add("hidden");
  searchElements.lightboxCatalogMenuToggle?.setAttribute("aria-expanded", "false");
}

function closeLightboxViewerMenus() {
  closeLightboxCatalogMenu();
  closeLightboxSearchScopeMenu();
}

function isMobileReaderSearchMode() {
  return Boolean(window.matchMedia?.(MOBILE_READER_SEARCH_MEDIA).matches);
}

function syncLightboxMobileSearchUi() {
  const compactMode = isMobileReaderSearchMode();
  const isOpen = compactMode && searchState.lightboxMobileSearchOpen;

  if (!compactMode) searchState.lightboxMobileSearchOpen = false;
  getFeatureInterface("viewer")?.syncMobileSearchUi?.(isOpen);
  searchElements.lightboxMobileSearchToggle?.setAttribute("aria-expanded", isOpen ? "true" : "false");
  searchElements.lightboxSearchPanel?.setAttribute("aria-hidden", compactMode && !isOpen ? "true" : "false");
}

/** @param {boolean} open @param {LightboxMobileSearchOptions} [options] */
function setLightboxMobileSearchOpen(open, options = {}) {
  const { focusInput = false, returnFocus = false, hideResults = true, hideTopUi = false } = options;
  const shouldOpen = Boolean(
    open &&
    getFeatureInterface("viewer")?.isViewerOpen?.() &&
    isMobileReaderSearchMode()
  );

  searchState.lightboxMobileSearchOpen = shouldOpen;
  syncLightboxMobileSearchUi();

  if (shouldOpen) {
    closeLightboxViewerMenus();
    getFeatureInterface("viewer")?.showTopUi?.();
    ensureSearchIndexLoaded().catch(() => {});
    if (focusInput) {
      window.requestAnimationFrame(() => searchElements.lightboxSearchInput?.focus());
    }
    return;
  }

  if (hideResults) {
    hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi });
  }
  if (returnFocus && isMobileReaderSearchMode()) {
    searchElements.lightboxMobileSearchToggle?.focus();
  }
}

function syncLightboxSearchScopeUi() {
  const scope = getLightboxSearchScope();
  if (searchElements.lightboxSearchScopeToggle) {
    searchElements.lightboxSearchScopeToggle.innerHTML = `${escapeHtml(lightboxSearchScopeLabel(scope))} <span aria-hidden="true">⌄</span>`;
  }
  if (searchElements.lightboxSearchInput) {
    searchElements.lightboxSearchInput.placeholder = lightboxSearchPlaceholder();
    searchElements.lightboxSearchInput.setAttribute("aria-label", lightboxSearchPlaceholder());
  }
  Array.from(searchElements.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]") || []).filter(isHtmlElement).forEach((button) => {
    const selected = button.dataset.lightboxSearchScope === scope;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

/** @param {unknown} scope @param {SearchScopeChangeOptions} [options] */
function setLightboxSearchScope(scope, options = {}) {
  const nextScope = scope === "all" ? "all" : "catalog";
  if (searchState.lightboxSearchScope === nextScope) {
    syncLightboxSearchScopeUi();
    closeLightboxSearchScopeMenu();
    return;
  }

  searchState.lightboxSearchScope = nextScope;
  syncLightboxSearchScopeUi();
  closeLightboxSearchScopeMenu();
  initLightboxSearchStatus();

  if (options.render !== false && searchElements.lightboxSearchInput) {
    renderLightboxSearchResults(searchElements.lightboxSearchInput.value);
  }
}

/** @param {LightboxSearchHideOptions} [options] */
function hideLightboxSearchResults(options = {}) {
  const { blurTopUiFocus = false, hideTopUi = false } = options;

  hideSearchFloatingPreview();
  searchElements.lightboxSearchResults?.classList.add("hidden");
  closeLightboxViewerMenus();

  if (blurTopUiFocus) {
    const activeElement = document.activeElement;
    if (
      isHtmlElement(activeElement) &&
      getFeatureInterface("viewer")?.containsTopBarElement(activeElement)
    ) {
      activeElement.blur();
    }
  }

  if (hideTopUi) getFeatureInterface("viewer")?.hideTopUiForSearch?.();
}

function resetLightboxSearch() {
  searchState.lightboxMobileSearchOpen = false;
  syncLightboxMobileSearchUi();
  if (searchElements.lightboxSearchInput) searchElements.lightboxSearchInput.value = "";
  hideLightboxSearchResults({ blurTopUiFocus: true });
  if (searchElements.lightboxSearchResults) searchElements.lightboxSearchResults.innerHTML = "";
  searchElements.lightboxSearchClear?.classList.add("hidden");
  syncLightboxSearchScopeUi();
  initLightboxSearchStatus();
}

/** @param {unknown} query */
function lightboxSearchKey(query) {
  const scope = getLightboxSearchScope();
  return [String(query || "").trim(), scope, scope === "all" ? "" : (activeCatalog()?.id || "")].join("\u0000");
}

/** @param {unknown} query @param {number} [limit] @param {SearchRequestControl} [control] @returns {Promise<Array<CatalogOcrSearchResult>>} */
async function getLightboxSearchResults(query, limit = 24, control = {}) {
  const rawQuery = String(query || "").trim();
  if (rawQuery.length < 2) return [];
  await ensureSearchIndexLoaded({ trigger: "viewer-search" });
  if (control.isCurrent && !control.isCurrent()) return [];
  if (!catalogSearch.hasIndex()) return [];

  /** @type {CatalogSearchRequestOptions} */
  const options = { limit, channel: "viewer" };
  if (getLightboxSearchScope() !== "all") {
    const catalog = activeCatalog();
    if (!catalog) return [];
    options.catalogId = catalog.id;
  }
  const results = await catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

/** @param {string} completion @param {unknown} [query] */
async function trackCompletedLightboxSearch(completion, query = searchElements.lightboxSearchInput?.value || "") {
  const rawQuery = String(query || "").trim();
  const scope = getLightboxSearchScope();
  const key = lightboxSearchKey(rawQuery);
  const results = key === lastLightboxSearchKey
    ? lastLightboxSearchResults
    : await getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24);
  telemetryTrackSearch(rawQuery, results.length, {
    surface: "viewer",
    scope,
    catalogId: scope === "all" ? "" : activeCatalog()?.id,
    completion
  });
  return results;
}

/** @param {CatalogOcrSearchResult|null|undefined} result */
function openLightboxSearchResult(result) {
  if (!result) return false;
  const catalog = activeCatalog();
  const targetCatalogId = String(result.catalogId || catalog?.id || "").trim();
  const sameCatalog = Boolean(catalog && String(catalog.id) === targetCatalogId);
  const viewer = requireFeatureInterface("viewer");
  const handled = searchCatalogDomain.executeLightboxSearchResultAction(result, catalog, {
    openCatalog: viewer.openCatalog,
    setPage: viewer.setPage,
    showTopUi: viewer.showTopUi
  });
  if (!handled || !sameCatalog) return handled;

  if (searchState.lightboxMobileSearchOpen) {
    setLightboxMobileSearchOpen(false, { hideResults: true });
  } else {
    hideLightboxSearchResults();
  }
  return true;
}

async function submitLightboxSearch() {
  const rawQuery = String(searchElements.lightboxSearchInput?.value || "").trim();
  const results = await renderLightboxSearchResults(rawQuery);
  await trackCompletedLightboxSearch("submit", rawQuery);
  return openLightboxSearchResult(results[0]);
}

function initLightboxSearchStatus() {
  if (!searchElements.lightboxSearchStatus) return;

  const hasCatalog = Boolean(activeCatalog());
  const hasIndex = Boolean(catalogSearch.hasIndex());
  const indexPending = !hasIndex && searchState.searchIndexLoadState !== "error";
  if (searchElements.lightboxSearchInput) searchElements.lightboxSearchInput.disabled = !hasCatalog;
  syncLightboxSearchScopeUi();

  if (!hasCatalog) {
    searchElements.lightboxSearchStatus.textContent = "בחר קטלוג כדי לחפש.";
    return;
  }

  if (!hasIndex) {
    searchElements.lightboxSearchStatus.textContent = indexPending
      ? "אינדקס החיפוש נטען לפי הצורך."
      : "אינדקס החיפוש אינו זמין כרגע.";
    return;
  }

  searchElements.lightboxSearchStatus.textContent = getLightboxSearchScope() === "all"
    ? "הקלד לפחות 2 תווים לחיפוש בכל הקטלוגים."
    : "הקלד לפחות 2 תווים לחיפוש בתוך הקטלוג הפתוח.";
}

function lightboxSearchLayoutColumnLimit() {
  const columns = getFeatureInterface("catalog-grid")?.layoutColumnCount?.();
  const width = Math.max(0, window.innerWidth || document.documentElement?.clientWidth || 0);
  return searchCatalogDomain.lightboxSearchColumnLimit(columns, width);
}

function updateLightboxSearchResultsLayout(count = 0) {
  if (!searchElements.lightboxSearchResults) return;
  normalizeSearchResultsDirection(searchElements.lightboxSearchResults);

  const resultCount = Math.max(0, Number(count) || 0);
  const columns = Math.max(1, Math.min(resultCount || 1, lightboxSearchLayoutColumnLimit()));
  searchElements.lightboxSearchResults.style.setProperty("--reader-search-result-columns", String(columns));
  searchElements.lightboxSearchResults.dataset.resultColumns = String(columns);
  searchElements.lightboxSearchResults.dataset.resultCount = String(resultCount);
}

/** @param {unknown} query @returns {Promise<Array<CatalogOcrSearchResult>>} */
async function renderLightboxSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!searchElements.lightboxSearchResults || !searchElements.lightboxSearchStatus) return [];
  const renderSequence = ++lightboxSearchRenderSequence;
  const renderKey = lightboxSearchKey(rawQuery);

  normalizeSearchResultsDirection(searchElements.lightboxSearchResults);
  hideSearchFloatingPreview();
  updateLightboxSearchResultsLayout(0);
  searchElements.lightboxSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    catalogSearch.cancel("viewer");
    lastLightboxSearchKey = "";
    lastLightboxSearchResults = [];
    searchElements.lightboxSearchResults.classList.add("hidden");
    searchElements.lightboxSearchResults.removeAttribute("aria-busy");
    searchElements.lightboxSearchResults.innerHTML = "";
    initLightboxSearchStatus();
    return [];
  }

  if (!activeCatalog()) {
    searchElements.lightboxSearchResults.classList.add("hidden");
    searchElements.lightboxSearchStatus.textContent = "בחר קטלוג כדי לחפש.";
    return [];
  }

  searchElements.lightboxSearchResults.setAttribute("aria-busy", "true");
  searchElements.lightboxSearchStatus.textContent = "מחפש באינדקס…";

  try {
    const scope = getLightboxSearchScope();
    const results = await getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24, {
      isCurrent: () => (
        renderSequence === lightboxSearchRenderSequence
        && renderKey === lightboxSearchKey(searchElements.lightboxSearchInput?.value || "")
      )
    });
    if (renderSequence !== lightboxSearchRenderSequence || renderKey !== lightboxSearchKey(searchElements.lightboxSearchInput?.value || "")) {
      return [];
    }

    lastLightboxSearchKey = lightboxSearchKey(rawQuery);
    lastLightboxSearchResults = results;
    updateLightboxSearchResultsLayout(results.length);
    searchElements.lightboxSearchResults.classList.remove("hidden");
    searchElements.lightboxSearchResults.removeAttribute("aria-busy");

    if (!results.length) {
      searchElements.lightboxSearchStatus.textContent = scope === "all"
        ? "לא נמצאו תוצאות בכל הקטלוגים."
        : "לא נמצאו תוצאות בקטלוג הפתוח.";
      searchElements.lightboxSearchResults.innerHTML = searchEmptyStateMarkup(
        rawQuery,
        "נסה חלק קצר יותר של הדגם או מילה אחרת.",
        { reader: true }
      );
      searchElements.lightboxSearchResults.querySelector("[data-lightbox-empty-search-clear]")?.addEventListener("click", (event) => {
        event.stopPropagation();
        searchElements.lightboxSearchInput.value = "";
        renderLightboxSearchResults("");
        searchElements.lightboxSearchInput.focus();
      });
      return [];
    }

    searchElements.lightboxSearchStatus.textContent = scope === "all"
      ? `נמצאו ${results.length} תוצאות בכל הקטלוגים.`
      : `נמצאו ${results.length} תוצאות בקטלוג הזה.`;
    searchElements.lightboxSearchResults.innerHTML = results.map((result) => {
      const catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId) || activeCatalog();
      if (!catalog) return "";
      const page = clampPage(result.page, catalog);
      const rawPreview = result.image || mediumSrc(catalog, page) || pageSrc(catalog, page);
      const rawThumb = result.thumb || thumbSrc(catalog, page);
      const rawImage = rawThumb || rawPreview;
      const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
      return `
        <button class="reader-search-result lightbox-search-result" type="button" data-lightbox-search-catalog="${escapeHtml(result.catalogId || catalog?.id || "")}" data-lightbox-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
          <span class="reader-search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
          <span class="reader-search-thumb-frame catalog-image-frame">
            <img class="reader-search-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "viewer-search-results")} />
          </span>
          <span class="reader-search-result-copy">${searchCatalogDomain.searchResultDetailsMarkup(result)}</span>
        </button>
      `;
    }).join("");

    bindSearchFloatingPreviewEvents(searchElements.lightboxSearchResults);
    Array.from(searchElements.lightboxSearchResults.querySelectorAll("[data-lightbox-search-page]")).filter(isHtmlElement).forEach((button, index) => {
      button.addEventListener("click", async () => {
        await trackCompletedLightboxSearch("result-open");
        hideSearchFloatingPreview();
        openLightboxSearchResult(results[index]);
      });
    });
    return results;
  } catch (error) {
    if (catalogSearch.isCancelledError(error) || renderSequence !== lightboxSearchRenderSequence) return [];
    searchState.searchIndexLoadState = "error";
    searchElements.lightboxSearchResults.removeAttribute("aria-busy");
    searchElements.lightboxSearchResults.classList.remove("hidden");
    searchElements.lightboxSearchResults.innerHTML = searchIndexErrorMarkup({ reader: true });
    searchElements.lightboxSearchResults.querySelector("[data-lightbox-search-index-retry]")?.addEventListener("click", () => { retrySearchIndexLoad("viewer-retry").finally(() => renderLightboxSearchResults(searchElements.lightboxSearchInput?.value || "")); });
    searchElements.lightboxSearchStatus.textContent = "אינדקס החיפוש אינו זמין כרגע.";
    return [];
  }
}

function renderLightboxCatalogMenu() {
  getFeatureInterface("catalog-grid")?.renderCatalogMenu(searchElements.lightboxCatalogMenu, {
    onSelect: (catalogId) => {
      closeLightboxCatalogMenu();
      if (catalogId === activeCatalog()?.id) return;
      getFeatureInterface("viewer")?.openCatalog(catalogId);
    }
  });
}

/** @param {SearchViewerPrepareOptions} [options] */
function prepareViewerSearch(options = {}) {
  if (options.renderCatalogMenu !== false) renderLightboxCatalogMenu();
  resetLightboxSearch();
}

/** @param {Event} event */
function handleLightboxSearchResultsBackgroundClick(event) {
  const result = eventTargetElement(event.target)?.closest?.("[data-lightbox-search-page]");
  if (result && searchElements.lightboxSearchResults?.contains(result)) return;

  event.preventDefault();
  event.stopPropagation();
  hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi: true });
}

export {
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
};
