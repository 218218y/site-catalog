/**
 * Source module: 48-global-search-ui.js
 * Global catalog search panel, scope, progressive rendering, and navigation.
 */

/** @import { CatalogOcrSearchResult, CatalogSearchResult } from "../../types/frontend-contracts.js" */
/** @typedef {{immediate?:boolean}} SearchScheduleOptions */
/** @typedef {{focus?:boolean, focusButton?:boolean, hideResults?:boolean}} GlobalSearchPanelOptions */
/** @typedef {{render?:boolean}} SearchScopeChangeOptions */
/** @typedef {{isCurrent?:()=>boolean}} SearchRequestControl */
/** @typedef {{limit:number, channel:"global", category?:string}} CatalogSearchRequestOptions */
/** @typedef {{immediate?:boolean}} SearchCompletionOptions */

import { catalogDocumentUrl, navigateTo, viewerDocumentUrl } from "./00-navigation.js";
import { eventTargetElement } from "./02-dom-contracts.js";
import { catalogSearch, catalogs } from "./03-runtime-context.js";
import { getFeatureInterface, requireFeatureInterface } from "./10-app-state.js";
import { SEARCH_INPUT_DEBOUNCE_MS, searchElements, searchState } from "./13-search-state.js";
import { telemetryFlush, telemetryTrackSearch } from "../runtime/telemetry.js";
import { thumbSrc } from "./17-catalog-asset-urls.js";
import { clampValue, escapeHtml } from "./19-shared-pure.js";
import { catalogImageDimensionAttributes, catalogImageRecoveryAttributes, clampPage, getCatalogCategoryGroups } from "./20-catalog-runtime.js";
import { isHtmlElement } from "./21-ui-runtime.js";
import { searchCatalogDomain } from "./39-search-catalog-domain.js";
import { ensureSearchIndexLoaded, normalizeSearchResultsDirection, retrySearchIndexLoad, searchEmptyStateMarkup, searchIndexErrorMarkup } from "./42-search-runtime.js";
import { bindSearchFloatingPreviewEvents, handleSearchPreviewScrollIntent, hideSearchFloatingPreview, suppressSearchFloatingPreview } from "./47-search-preview.js";

let globalSearchRenderTimer = 0;
let globalSearchAppendFrame = 0;
let globalSearchRenderSequence = 0;
/** @type {Array<CatalogSearchResult>} */
let lastGlobalSearchResults = [];
let lastGlobalSearchKey = "";
const GLOBAL_SEARCH_INITIAL_RENDER_COUNT = 3;
const GLOBAL_SEARCH_RENDER_CHUNK_SIZE = 3;

function cancelGlobalSearchResultAppend() {
  window.cancelAnimationFrame(globalSearchAppendFrame);
  globalSearchAppendFrame = 0;
}

function cancelGlobalSearchRender() {
  window.clearTimeout(globalSearchRenderTimer);
  globalSearchRenderTimer = 0;
  cancelGlobalSearchResultAppend();
  globalSearchRenderSequence += 1;
  catalogSearch.cancel("global");
}

/** @param {unknown} query @param {SearchScheduleOptions} [options] */
function scheduleGlobalSearchRender(query, options = {}) {
  catalogSearch.cancel("global");
  cancelGlobalSearchResultAppend();
  globalSearchRenderSequence += 1;
  window.clearTimeout(globalSearchRenderTimer);
  globalSearchRenderTimer = window.setTimeout(
    () => renderSearchResults(query),
    options.immediate ? 0 : SEARCH_INPUT_DEBOUNCE_MS
  );
}

function getGlobalSearchCategories() {
  return getCatalogCategoryGroups()
    .filter((group) => String(group.category || "").trim() && Array.isArray(group.items) && group.items.length)
    .map((group) => ({ category: group.category }));
}

/** @param {unknown} category */
function hasGlobalSearchCategory(category) {
  const requestedCategory = String(category || "").trim();
  if (!requestedCategory) return false;
  return getCatalogCategoryGroups().some((group) => group.category === requestedCategory);
}

function getGlobalSearchCategory() {
  const selectedCategory = String(searchState.globalSearchCategory || "").trim();
  if (!selectedCategory) return "";
  return hasGlobalSearchCategory(selectedCategory) ? selectedCategory : "";
}

function globalSearchScopeLabel(category = getGlobalSearchCategory()) {
  return category ? category : "בכל הקטלוגים";
}

function globalSearchPlaceholder() {
  const category = getGlobalSearchCategory();
  return category
    ? `חיפוש קטלוג, קטגוריה או דגם בתוך ${category}...`
    : "חיפוש קטגוריה, תת קטגוריה, קטלוג, דגם או טקסט...";
}

function closeGlobalSearchScopeMenu() {
  searchElements.globalSearchScopeMenu?.classList.add("hidden");
  searchElements.globalSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function isGlobalSearchPanelOpen() {
  return Boolean(searchState.globalSearchOpen && searchElements.catalogSearch && !searchElements.catalogSearch.classList.contains("hidden"));
}

/** @param {boolean} open @param {GlobalSearchPanelOptions} [options] */
function setGlobalSearchPanelOpen(open, options = {}) {
  const shouldOpen = Boolean(open);
  searchState.globalSearchOpen = shouldOpen;

  if (!searchElements.catalogSearch) return;

  searchElements.catalogSearch.classList.toggle("hidden", !shouldOpen);
  searchElements.catalogSearch.classList.toggle("is-open", shouldOpen);
  searchElements.catalogSearch.setAttribute("aria-hidden", shouldOpen ? "false" : "true");

  searchElements.globalSearchOpen?.classList.toggle("is-active", shouldOpen);
  searchElements.globalSearchOpen?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");

  if (shouldOpen) {
    // Categories are static for the lifetime of the page and the menu is built
    // during initialization. Rebuilding it inside the click interaction adds
    // avoidable DOM/style work to the user's first search response.
    syncGlobalSearchScopeUi();
    renderSearchResults(searchElements.globalSearchInput?.value || "");
    if (options.focus !== false) {
      window.requestAnimationFrame(() => searchElements.globalSearchInput?.focus({ preventScroll: true }));
    }
    return;
  }

  closeGlobalSearchScopeMenu();
  hideSearchFloatingPreview();
  cancelGlobalSearchRender();
  if (options.hideResults !== false) {
    searchElements.globalSearchResults?.classList.add("hidden");
  }
  if (options.focusButton) {
    window.requestAnimationFrame(() => searchElements.globalSearchOpen?.focus({ preventScroll: true }));
  }
}

/** @param {GlobalSearchPanelOptions} [options] */
function openGlobalSearchPanel(options = {}) {
  setGlobalSearchPanelOpen(true, options);
}

/** @param {GlobalSearchPanelOptions} [options] */
function closeGlobalSearchPanel(options = {}) {
  setGlobalSearchPanelOpen(false, options);
}

function renderGlobalSearchScopeMenu() {
  if (!searchElements.globalSearchScopeMenu) return;

  const categories = getGlobalSearchCategories();
  searchElements.globalSearchScopeMenu.innerHTML = `
    <button type="button" role="menuitemradio" aria-checked="true" data-global-search-category="">
      <strong>בכל הקטלוגים</strong>
    </button>
    ${categories.map((group) => `
      <button type="button" role="menuitemradio" aria-checked="false" data-global-search-category="${escapeHtml(group.category)}">
        <strong>${escapeHtml(group.category)}</strong>
      </button>
    `).join("")}
  `;
  syncGlobalSearchScopeUi();
}

function syncGlobalSearchScopeUi() {
  const category = getGlobalSearchCategory();
  if (searchElements.globalSearchScopeToggle) {
    searchElements.globalSearchScopeToggle.innerHTML = `${escapeHtml(globalSearchScopeLabel(category))} <span aria-hidden="true">⌄</span>`;
    searchElements.globalSearchScopeToggle.title = category ? `חיפוש רק בקטגוריית ${category}` : "חיפוש בכל הקטלוגים";
  }
  if (searchElements.globalSearchInput) {
    searchElements.globalSearchInput.placeholder = globalSearchPlaceholder();
    searchElements.globalSearchInput.setAttribute("aria-label", globalSearchPlaceholder());
  }
  Array.from(searchElements.globalSearchScopeMenu?.querySelectorAll("[data-global-search-category]") || []).filter(isHtmlElement).forEach((button) => {
    const selected = String(button.dataset.globalSearchCategory || "") === category;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

/** @param {unknown} category @param {SearchScopeChangeOptions} [options] */
function setGlobalSearchCategory(category, options = {}) {
  const requestedCategory = String(category || "").trim();
  const nextCategory = requestedCategory && hasGlobalSearchCategory(requestedCategory)
    ? requestedCategory
    : "";

  if (searchState.globalSearchCategory === nextCategory) {
    syncGlobalSearchScopeUi();
    closeGlobalSearchScopeMenu();
    return;
  }

  searchState.globalSearchCategory = nextCategory;
  syncGlobalSearchScopeUi();
  closeGlobalSearchScopeMenu();
  initSearchStatus();

  if (options.render !== false && searchElements.globalSearchInput) {
    renderSearchResults(searchElements.globalSearchInput.value);
  }
}

function initSearchStatus() {
  syncGlobalSearchScopeUi();
}

/** @param {WheelEvent} event @param {HTMLElement|null|undefined} scrollTarget */
function normalizedWheelDeltaY(event, scrollTarget) {
  const rawDelta = Number(event?.deltaY) || 0;
  if (!rawDelta) return 0;
  if (event.deltaMode === 1) return rawDelta * 16;
  if (event.deltaMode === 2) return rawDelta * Math.max(1, scrollTarget?.clientHeight || window.innerHeight || 1);
  return rawDelta;
}

/** @param {EventTarget|null} eventTarget @returns {HTMLElement|null} */
function globalSearchWheelTarget(eventTarget) {
  if (eventTarget instanceof Node && searchElements.globalSearchScopeMenu && !searchElements.globalSearchScopeMenu.classList.contains("hidden") && searchElements.globalSearchScopeMenu.contains(eventTarget)) {
    return searchElements.globalSearchScopeMenu;
  }

  if (searchElements.globalSearchResults && !searchElements.globalSearchResults.classList.contains("hidden")) {
    return searchElements.globalSearchResults;
  }

  return null;
}

/** @param {HTMLElement|null} element @param {WheelEvent} event */
function scrollElementByWheel(element, event) {
  if (!element) return false;

  const deltaY = normalizedWheelDeltaY(event, element);
  if (!deltaY) return false;

  const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
  const nextScrollTop = clampValue(element.scrollTop + deltaY, 0, maxScrollTop);
  const didMove = Math.abs(nextScrollTop - element.scrollTop) > 0.5;

  if (didMove) element.scrollTop = nextScrollTop;
  return true;
}

/** @param {WheelEvent} event */
function handleGlobalSearchPanelWheel(event) {
  if (!isGlobalSearchPanelOpen() || !(event.target instanceof Node) || !searchElements.catalogSearch?.contains(event.target)) return;

  handleSearchPreviewScrollIntent(event);

  const scrollTarget = globalSearchWheelTarget(event.target);
  if (scrollTarget) {
    scrollElementByWheel(scrollTarget, event);
  }

  // The search panel floats above the site. Wheel gestures inside its frame should
  // never leak to the page behind it, including when the inner results list is at
  // its top/bottom edge or the pointer is over the panel padding/header.
  event.preventDefault();
  event.stopPropagation();
}

/** @param {unknown} query */
function globalSearchKey(query) {
  return [String(query || "").trim(), getGlobalSearchCategory()].join("\u0000");
}

/** @param {unknown} query @param {number} [limit] @param {SearchRequestControl} [control] @returns {Promise<Array<CatalogOcrSearchResult>>} */
async function getGlobalOcrSearchResults(query, limit = 72, control = {}) {
  const rawQuery = String(query || "").trim();
  const category = getGlobalSearchCategory();
  if (rawQuery.length < 2) return [];
  await ensureSearchIndexLoaded({ trigger: "global-search" });
  if (control.isCurrent && !control.isCurrent()) return [];
  if (!catalogSearch.hasIndex({ category })) return [];

  /** @type {CatalogSearchRequestOptions} */
  const options = { limit, channel: "global" };
  if (category) options.category = category;
  const results = await catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

/** @param {unknown} query @param {number} [limit] @param {SearchRequestControl} [control] @returns {Promise<Array<CatalogSearchResult>>} */
async function getGlobalSearchResults(query, limit = 72, control = {}) {
  const rawQuery = String(query || "").trim();
  const navigationResults = rawQuery.length < 2 ? [] : catalogSearch.searchNavigation(
    getCatalogCategoryGroups(),
    rawQuery,
    { category: getGlobalSearchCategory(), limit: 36 }
  );
  try {
    return catalogSearch.mergeNavigationResults(
      navigationResults,
      await getGlobalOcrSearchResults(rawQuery, limit, control)
    );
  } catch (error) {
    if (!navigationResults.length || catalogSearch.isCancelledError(error)) throw error;
    searchState.searchIndexLoadState = "error";
    return navigationResults;
  }
}

/** @param {string} completion @param {unknown} [query] @param {SearchCompletionOptions} [options] */
async function trackCompletedGlobalSearch(completion, query = searchElements.globalSearchInput?.value || "", options = {}) {
  const rawQuery = String(query || "").trim();
  const category = getGlobalSearchCategory();
  const key = globalSearchKey(rawQuery);
  const results = key === lastGlobalSearchKey
    ? lastGlobalSearchResults
    : await getGlobalSearchResults(rawQuery, 72);
  telemetryTrackSearch(rawQuery, results.length, {
    surface: "global",
    scope: category || "all",
    completion,
    immediate: options.immediate === true
  });
  return results;
}

function flushGlobalSearchTelemetryBeforeNavigation() {
  telemetryFlush().catch(() => {});
}

/** @param {CatalogSearchResult|null|undefined} result */
function openGlobalSearchResult(result) {
  if (!result) return false;
  hideSearchFloatingPreview();
  closeGlobalSearchPanel({ focusButton: false });
  const catalogGrid = requireFeatureInterface("catalog-grid");
  return searchCatalogDomain.executeGlobalSearchResultAction(result, {
    activateCategoryTarget: catalogGrid.activateCategoryTarget,
    openCatalog: (catalogId) => navigateTo(catalogDocumentUrl(catalogId)),
    openViewer: (catalogId, page) => navigateTo(viewerDocumentUrl(catalogId, page))
  });
}

async function submitGlobalSearch() {
  const rawQuery = String(searchElements.globalSearchInput?.value || "").trim();
  const results = await renderSearchResults(rawQuery);
  await trackCompletedGlobalSearch("submit", rawQuery, { immediate: true });
  flushGlobalSearchTelemetryBeforeNavigation();
  return openGlobalSearchResult(results[0]);
}

/** @param {CatalogSearchResult} result */
function globalSearchResultMarkup(result) {
  if (result?.resultType !== "ocr") {
    return catalogSearch ? catalogSearch.navigationResultMarkup(result) : "";
  }

  const catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId);
  const page = clampPage(result.page, catalog);
  const rawThumb = result.thumb || (catalog ? thumbSrc(catalog, page) : "");
  const rawImage = rawThumb || result.image || "";
  const rawPreview = rawThumb || rawImage;
  const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
  return `
    <article class="search-result-card">
      <button type="button" class="search-result-button" data-search-catalog="${escapeHtml(result.catalogId)}" data-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
        <span class="search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
        <span class="search-result-thumb-frame catalog-image-frame">
          <img class="search-result-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "global-search-results")} />
        </span>
        <span class="search-result-copy">${searchCatalogDomain.searchResultDetailsMarkup(result)}</span>
      </button>
    </article>
  `;
}

/** @param {ParentNode} root @param {Array<CatalogSearchResult>} results */
function bindGlobalSearchResultEvents(root, results) {
  bindSearchFloatingPreviewEvents(root);
  Array.from(root.querySelectorAll("[data-search-navigation-type], [data-search-catalog]")).filter(isHtmlElement).forEach((button, index) => {
    button.addEventListener("click", async () => {
      await trackCompletedGlobalSearch("result-open", undefined, { immediate: true });
      flushGlobalSearchTelemetryBeforeNavigation();
      openGlobalSearchResult(results[index]);
    });
  });
}

/** @param {Array<CatalogSearchResult>} results @param {number} start @param {number} count */
function appendGlobalSearchResultBatch(results, start, count) {
  const batch = results.slice(start, start + count);
  const template = document.createElement("template");
  template.innerHTML = batch.map(globalSearchResultMarkup).join("");
  bindGlobalSearchResultEvents(template.content, batch);
  searchElements.globalSearchResults.append(template.content);
  return Math.min(results.length, start + count);
}

/** @param {number} renderSequence @param {unknown} rawQuery */
function isCurrentGlobalSearchRender(renderSequence, rawQuery) {
  return renderSequence === globalSearchRenderSequence
    && globalSearchKey(rawQuery) === globalSearchKey(searchElements.globalSearchInput?.value || "")
    && isGlobalSearchPanelOpen();
}

/** @param {Array<CatalogSearchResult>} results @param {number} renderSequence @param {unknown} rawQuery */
function renderGlobalSearchResultsProgressively(results, renderSequence, rawQuery) {
  cancelGlobalSearchResultAppend();
  searchElements.globalSearchResults.replaceChildren();
  searchElements.globalSearchResults.classList.remove("hidden");

  let nextIndex = appendGlobalSearchResultBatch(
    results,
    0,
    GLOBAL_SEARCH_INITIAL_RENDER_COUNT
  );

  const appendNextBatch = () => {
    globalSearchAppendFrame = 0;
    if (!isCurrentGlobalSearchRender(renderSequence, rawQuery)) return;

    nextIndex = appendGlobalSearchResultBatch(
      results,
      nextIndex,
      GLOBAL_SEARCH_RENDER_CHUNK_SIZE
    );
    if (nextIndex < results.length) {
      // One small batch per frame guarantees a paint/input opportunity between
      // chunks. Back-to-back zero-delay timers can monopolize the main thread
      // under CPU throttling even though each individual batch is small.
      globalSearchAppendFrame = window.requestAnimationFrame(appendNextBatch);
      return;
    }
    searchElements.globalSearchResults.removeAttribute("aria-busy");
  };

  if (nextIndex < results.length) {
    globalSearchAppendFrame = window.requestAnimationFrame(appendNextBatch);
  } else {
    searchElements.globalSearchResults.removeAttribute("aria-busy");
  }
}

/** @param {unknown} query @returns {Promise<Array<CatalogSearchResult>>} */
async function renderSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!searchElements.globalSearchResults) return [];
  cancelGlobalSearchResultAppend();
  const renderSequence = ++globalSearchRenderSequence;
  const renderKey = globalSearchKey(rawQuery);

  normalizeSearchResultsDirection(searchElements.globalSearchResults);
  hideSearchFloatingPreview();
  searchElements.globalSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    catalogSearch.cancel("global");
    lastGlobalSearchKey = "";
    lastGlobalSearchResults = [];
    searchElements.globalSearchResults.classList.add("hidden");
    searchElements.globalSearchResults.removeAttribute("aria-busy");
    searchElements.globalSearchResults.innerHTML = "";
    initSearchStatus();
    return [];
  }

  const category = getGlobalSearchCategory();
  searchElements.globalSearchResults.setAttribute("aria-busy", "true");

  try {
    const results = await getGlobalSearchResults(rawQuery, 72, {
      isCurrent: () => isCurrentGlobalSearchRender(renderSequence, rawQuery)
    });
    if (renderSequence !== globalSearchRenderSequence || renderKey !== globalSearchKey(searchElements.globalSearchInput?.value || "")) {
      return [];
    }

    lastGlobalSearchKey = globalSearchKey(rawQuery);
    lastGlobalSearchResults = results;
    if (!results.length) {
      searchElements.globalSearchResults.removeAttribute("aria-busy");
      searchElements.globalSearchResults.classList.remove("hidden");
      searchElements.globalSearchResults.innerHTML = searchEmptyStateMarkup(
        rawQuery,
        category
          ? "נסה שם קצר יותר, חלק מהמילה, או חפש שוב בכל הקטלוגים."
          : "נסה שם קצר יותר, מספר דגם או חלק מהמילה."
      );
      searchElements.globalSearchResults.querySelector("[data-empty-search-clear]")?.addEventListener("click", () => {
        searchElements.globalSearchInput.value = "";
        renderSearchResults("");
        searchElements.globalSearchInput.focus();
      });
      return [];
    }

    renderGlobalSearchResultsProgressively(results, renderSequence, rawQuery);
    return results;
  } catch (error) {
    if (catalogSearch.isCancelledError(error) || renderSequence !== globalSearchRenderSequence) return [];
    searchState.searchIndexLoadState = "error";
    searchElements.globalSearchResults.removeAttribute("aria-busy");
    searchElements.globalSearchResults.classList.remove("hidden");
    searchElements.globalSearchResults.innerHTML = searchIndexErrorMarkup();
    searchElements.globalSearchResults.querySelector("[data-global-search-index-retry]")?.addEventListener("click", () => { retrySearchIndexLoad("global-retry").finally(() => renderSearchResults(searchElements.globalSearchInput?.value || "")); });
    return [];
  }
}

export {
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
};
