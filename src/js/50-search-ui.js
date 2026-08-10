/**
 * Source module: 50-search-ui.js
 * Global and viewer search loading, scopes, result rendering, previews, and search interactions.
 *
 * Runtime dependencies are explicit ES module imports. Route entrypoints are
 * bundled by the pinned esbuild tool into stable browser asset names.
 */

/** @import { CatalogSearchResult } from "../../types/frontend-contracts.js" */

import { tooltips } from "../runtime/tooltip-manager.js";
import { catalogDocumentUrl, currentAppPage, navigateTo, viewerDocumentUrl } from "./00-navigation.js";
import { catalogSearch, catalogs } from "./03-runtime-context.js";
import { getFeatureInterface, registerFeatureInterface, requireFeatureInterface } from "./10-app-state.js";
import { MOBILE_READER_SEARCH_MEDIA, SEARCH_INDEX_PRELOAD_DELAY_MS, SEARCH_INPUT_DEBOUNCE_MS, SEARCH_PREVIEW_SCROLL_SUPPRESS_MS, searchElements, searchState } from "./13-search-state.js";
import { telemetryCleanText, telemetryFlush, telemetryTrackSearch, telemetryTrackSearchIndexFailure } from "./15-telemetry.js";
import { activeCatalog } from "./18-navigation-feature.js";
import { catalogImageCrossOriginAttribute, catalogImageDimensionAttributes, catalogImageRecoveryAttributes, clampPage, clampValue, escapeHtml, getCatalogCategoryGroups, hasHoverPointer, isHtmlElement, isSaveDataEnabled, isTouchLikePointer, mediumSrc, pageSrc, setCatalogImageSource, thumbSrc } from "./20-shared-ui.js";
import { eventTargetElement } from "./02-dom-contracts.js";
import { searchCatalogDomain } from "./39-search-catalog-domain.js";

/** @typedef {"global"|"viewer"} SearchChannel */
/** @typedef {{trigger?:string}} SearchIndexLoadOptions */
/** @typedef {{immediate?:boolean}} SearchScheduleOptions */
/** @typedef {{focus?:boolean, focusButton?:boolean, hideResults?:boolean}} GlobalSearchPanelOptions */
/** @typedef {{render?:boolean}} SearchScopeChangeOptions */
/** @typedef {{focusInput?:boolean, returnFocus?:boolean, hideResults?:boolean, hideTopUi?:boolean}} LightboxMobileSearchOptions */
/** @typedef {{blurTopUiFocus?:boolean, hideTopUi?:boolean}} LightboxSearchHideOptions */
/** @typedef {{isCurrent?:()=>boolean}} SearchRequestControl */
/** @typedef {{limit:number, channel:SearchChannel, catalogId?:string, category?:string}} CatalogSearchRequestOptions */
/** @typedef {{restoreAfter?:boolean}} SearchPreviewSuppressionOptions */
/** @typedef {{reader?:boolean}} SearchMarkupOptions */
/** @typedef {{immediate?:boolean}} SearchCompletionOptions */

let globalSearchRenderTimer = 0;
let lightboxSearchRenderTimer = 0;
let globalSearchAppendFrame = 0;
let globalSearchRenderSequence = 0;
let lightboxSearchRenderSequence = 0;
/** @type {Array<CatalogSearchResult>} */
let lastGlobalSearchResults = [];
/** @type {Array<CatalogSearchResult>} */
let lastLightboxSearchResults = [];
let lastGlobalSearchKey = "";
let lastLightboxSearchKey = "";
const GLOBAL_SEARCH_INITIAL_RENDER_COUNT = 3;
const GLOBAL_SEARCH_RENDER_CHUNK_SIZE = 3;

function isSearchIndexReady() {
  return catalogSearch.isReady();
}

function refreshSearchUiAfterIndexLoad() {
  initSearchStatus();
  initLightboxSearchStatus();
  // Search renderers already await the shared index-load promise. Starting a
  // second render here creates two requests on the same worker channel: the
  // newer render can be cancelled by the older waiter when it resumes. Status
  // refresh is sufficient; the renderer that owns the current input continues
  // as soon as this promise resolves.
}

/** @param {SearchIndexLoadOptions} [options] @returns {Promise<boolean>} */
function ensureSearchIndexLoaded(options = {}) {
  if (isSearchIndexReady()) {
    searchState.searchIndexLoadState = "ready";
    return Promise.resolve(true);
  }
  if (searchState.searchIndexLoadPromise) return searchState.searchIndexLoadPromise;

  searchState.searchIndexLoadState = "loading";
  initLightboxSearchStatus();
  const loadTrigger = telemetryCleanText(options.trigger || "interactive", 40);
  searchState.searchIndexLoadPromise = catalogSearch.ensureReady()
    .then(() => {
      searchState.searchIndexLoadState = "ready";
      searchState.searchIndexLoadPromise = null;
      refreshSearchUiAfterIndexLoad();
      return true;
    })
    .catch((error) => {
      searchState.searchIndexLoadState = "error";
      searchState.searchIndexLoadPromise = null;
      telemetryTrackSearchIndexFailure("network-error", { trigger: loadTrigger });
      initSearchStatus();
      initLightboxSearchStatus();
      throw error;
    });
  return searchState.searchIndexLoadPromise;
}

function scheduleSearchIndexPreload() {
  window.clearTimeout(searchState.searchIndexPreloadTimer);
  if (isSaveDataEnabled()) return;
  searchState.searchIndexPreloadTimer = window.setTimeout(() => {
    if (isSaveDataEnabled()) return;
    const preload = () => ensureSearchIndexLoaded({ trigger: "preload" }).catch(() => {});
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preload, { timeout: 2500 });
    } else {
      preload();
    }
  }, SEARCH_INDEX_PRELOAD_DELAY_MS);
}

/** @param {SearchChannel} channel */
function cancelScheduledSearch(channel) {
  if (channel === "global") {
    window.clearTimeout(globalSearchRenderTimer);
    window.cancelAnimationFrame(globalSearchAppendFrame);
    globalSearchRenderTimer = 0;
    globalSearchAppendFrame = 0;
    globalSearchRenderSequence += 1;
  } else {
    window.clearTimeout(lightboxSearchRenderTimer);
    lightboxSearchRenderTimer = 0;
    lightboxSearchRenderSequence += 1;
  }
  catalogSearch.cancel(channel);
}

function cancelGlobalSearchResultAppend() {
  window.cancelAnimationFrame(globalSearchAppendFrame);
  globalSearchAppendFrame = 0;
}

/** @param {SearchChannel} channel @param {unknown} query @param {SearchScheduleOptions} [options] */
function scheduleSearchRender(channel, query, options = {}) {
  const delay = options.immediate ? 0 : SEARCH_INPUT_DEBOUNCE_MS;
  const callback = channel === "global"
    ? () => renderSearchResults(query)
    : () => renderLightboxSearchResults(query);
  catalogSearch.cancel(channel);
  if (channel === "global") {
    cancelGlobalSearchResultAppend();
    globalSearchRenderSequence += 1;
    window.clearTimeout(globalSearchRenderTimer);
    globalSearchRenderTimer = window.setTimeout(callback, delay);
  } else {
    lightboxSearchRenderSequence += 1;
    window.clearTimeout(lightboxSearchRenderTimer);
    lightboxSearchRenderTimer = window.setTimeout(callback, delay);
  }
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
  cancelScheduledSearch("global");
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

function getLightboxSearchScope() {
  return searchState.lightboxSearchScope === "all" ? "all" : "catalog";
}

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
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
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
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();

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

/** @param {unknown} query @param {number} [limit] @param {SearchRequestControl} [control] @returns {Promise<Array<CatalogSearchResult>>} */
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

/** @param {CatalogSearchResult|null|undefined} result */
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

function hideSearchFloatingPreview() {
  searchElements.searchFloatingPreview?.classList.remove("visible");
}

function isGlobalSearchScopeMenuOpen() {
  return Boolean(searchElements.globalSearchScopeMenu && !searchElements.globalSearchScopeMenu.classList.contains("hidden"));
}

function isLightboxSearchScopeMenuOpen() {
  return Boolean(searchElements.lightboxSearchScopeMenu && !searchElements.lightboxSearchScopeMenu.classList.contains("hidden"));
}

/** @param {MouseEvent|PointerEvent|WheelEvent} event */
function rememberSearchPreviewPointer(event) {
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

  searchState.searchPreviewPointerClientX = clientX;
  searchState.searchPreviewPointerClientY = clientY;
}

/** @param {Element|null|undefined} target */
function searchPreviewTargetBelongsToOpenResults(target) {
  if (!target || !target.isConnected) return false;

  if (searchElements.globalSearchResults?.contains(target)) {
    return isGlobalSearchPanelOpen() && !searchElements.globalSearchResults.classList.contains("hidden");
  }

  if (searchElements.lightboxSearchResults?.contains(target)) {
    return Boolean(getFeatureInterface("viewer")?.isViewerOpen?.()) && !searchElements.lightboxSearchResults.classList.contains("hidden");
  }

  return false;
}

/** @param {Element|null|undefined} target */
function isSearchPreviewBlockedByOpenMenu(target) {
  if (!(target instanceof Node)) return false;
  if (searchElements.globalSearchResults?.contains(target) && isGlobalSearchScopeMenuOpen()) return true;
  if (searchElements.lightboxSearchResults?.contains(target) && isLightboxSearchScopeMenuOpen()) return true;
  return false;
}

function getSearchPreviewTargetAtLastPointer() {
  const clientX = Number(searchState.searchPreviewPointerClientX);
  const clientY = Number(searchState.searchPreviewPointerClientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  if (clientX < 0 || clientY < 0 || clientX > window.innerWidth || clientY > window.innerHeight) return null;

  const element = document.elementFromPoint(clientX, clientY);
  const target = element?.closest?.("[data-search-preview-src]");
  return target instanceof HTMLElement && searchPreviewTargetBelongsToOpenResults(target) ? target : null;
}

function isSearchPreviewSuppressed() {
  return Date.now() < (searchState.searchPreviewSuppressUntil || 0);
}

function restoreSearchFloatingPreviewAfterSuppression() {
  if (isSearchPreviewSuppressed() || !hasHoverPointer()) return;

  const target = getSearchPreviewTargetAtLastPointer();
  if (!target || isSearchPreviewBlockedByOpenMenu(target)) return;

  showSearchFloatingPreview(target);
}

/** @param {number} [duration] @param {SearchPreviewSuppressionOptions} [options] */
function suppressSearchFloatingTooltip(duration = SEARCH_PREVIEW_SCROLL_SUPPRESS_MS, options = {}) {
  tooltips.suppress(duration, options);
}

/** @param {number} [duration] @param {SearchPreviewSuppressionOptions} [options] */
function suppressSearchFloatingPreview(duration = SEARCH_PREVIEW_SCROLL_SUPPRESS_MS, options = {}) {
  const { restoreAfter = true } = options;
  const delay = Math.max(0, Number(duration) || 0);
  suppressSearchFloatingTooltip(delay, { restoreAfter });
  searchState.searchPreviewSuppressUntil = Math.max(
    searchState.searchPreviewSuppressUntil || 0,
    Date.now() + delay
  );
  hideSearchFloatingPreview();

  window.clearTimeout(searchState.searchPreviewSuppressTimer);
  searchState.searchPreviewSuppressTimer = window.setTimeout(() => {
    searchState.searchPreviewSuppressTimer = 0;
    if (restoreAfter) restoreSearchFloatingPreviewAfterSuppression();
  }, delay + 20);
}

/** @param {HTMLElement|null|undefined} target */
function searchPreviewPageLabel(target) {
  return String(target?.dataset?.searchPreviewTitle || "קטלוג").trim() || "קטלוג";
}

/** @param {HTMLElement|null|undefined} target */
function positionSearchFloatingPreview(target) {
  const preview = searchElements.searchFloatingPreview;
  if (!preview || !target) return;

  const targetRect = target.getBoundingClientRect();
  const gap = 16;
  const safeMargin = 12;
  const fallbackWidth = Math.min(430, Math.max(180, window.innerWidth * 0.34));
  const fallbackHeight = Math.min(620, Math.max(180, window.innerHeight * 0.64));
  const previewRect = preview.getBoundingClientRect();
  const previewWidth = previewRect.width || fallbackWidth;
  const previewHeight = previewRect.height || fallbackHeight;

  let left;
  if (targetRect.left - gap - previewWidth >= safeMargin) {
    left = targetRect.left - gap - previewWidth;
  } else if (targetRect.right + gap + previewWidth <= window.innerWidth - safeMargin) {
    left = targetRect.right + gap;
  } else {
    left = targetRect.left + (targetRect.width / 2) - (previewWidth / 2);
  }

  const top = targetRect.top + (targetRect.height / 2) - (previewHeight / 2);
  preview.style.left = `${clampValue(left, safeMargin, Math.max(safeMargin, window.innerWidth - previewWidth - safeMargin))}px`;
  preview.style.top = `${clampValue(top, safeMargin, Math.max(safeMargin, window.innerHeight - previewHeight - safeMargin))}px`;
}

/** @param {HTMLElement|null|undefined} target */
function showSearchFloatingPreview(target) {
  if (!target || !searchElements.searchFloatingPreview || !searchElements.searchFloatingPreviewImage) return;
  if (!searchPreviewTargetBelongsToOpenResults(target)) return;
  if (isSearchPreviewSuppressed()) return;
  if (isSearchPreviewBlockedByOpenMenu(target)) return;

  const src = String(target.dataset.searchPreviewSrc || "").trim();
  if (!src) return;

  const label = searchPreviewPageLabel(target);
  const previewImage = searchElements.searchFloatingPreviewImage;
  previewImage.removeAttribute("width");
  previewImage.removeAttribute("height");
  previewImage.onload = () => positionSearchFloatingPreview(target);
  setCatalogImageSource(previewImage, src);
  searchElements.searchFloatingPreviewImage.alt = label;
  if (searchElements.searchFloatingPreviewPage) searchElements.searchFloatingPreviewPage.textContent = label;

  searchElements.searchFloatingPreview.classList.add("visible");
  positionSearchFloatingPreview(target);
}

/** @param {ParentNode|null|undefined} container */
function bindSearchFloatingPreviewEvents(container) {
  if (!container) return;

  container.querySelectorAll("[data-search-preview-src]").forEach((candidate) => {
    if (!(candidate instanceof HTMLElement)) return;
    const target = candidate;
    target.addEventListener("pointerenter", (event) => {
      rememberSearchPreviewPointer(event);
      if (!hasHoverPointer() || isTouchLikePointer(event) || isSearchPreviewSuppressed()) return;
      showSearchFloatingPreview(target);
    });
    target.addEventListener("pointermove", (event) => {
      rememberSearchPreviewPointer(event);
      if (!hasHoverPointer() || isTouchLikePointer(event)) return;
      if (isSearchPreviewSuppressed()) {
        hideSearchFloatingPreview();
        return;
      }
      positionSearchFloatingPreview(target);
    });
    target.addEventListener("pointerleave", (event) => {
      rememberSearchPreviewPointer(event);
      hideSearchFloatingPreview();
    });
    target.addEventListener("focus", () => showSearchFloatingPreview(target));
    target.addEventListener("blur", hideSearchFloatingPreview);
  });
}

/** @param {WheelEvent} event */
function handleSearchPreviewScrollIntent(event) {
  rememberSearchPreviewPointer(event);
  suppressSearchFloatingPreview();
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
  if (eventTarget instanceof Node && isGlobalSearchScopeMenuOpen() && searchElements.globalSearchScopeMenu?.contains(eventTarget)) {
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

/** @param {HTMLElement|null|undefined} container */
function normalizeSearchResultsDirection(container) {
  if (!container) return;
  container.setAttribute("dir", "rtl");
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

/** @param {unknown} query @param {string} message @param {SearchMarkupOptions} [options] */
function searchEmptyStateMarkup(query, message, options = {}) {
  const reader = options.reader === true;
  const wrapperClass = reader
    ? "reader-search-empty lightbox-search-empty empty-state ui-state empty-state-dark"
    : "search-empty empty-state ui-state";
  const actionAttribute = reader ? "data-lightbox-empty-search-clear" : "data-empty-search-clear";
  return `
    <article class="${wrapperClass}" data-state="empty" role="status">
      <span class="empty-state-icon ui-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <circle cx="10.5" cy="10.5" r="5.8"></circle>
          <path d="m15 15 4.2 4.2M8.2 8.2l4.6 4.6M12.8 8.2l-4.6 4.6"></path>
        </svg>
      </span>
      <div class="empty-state-copy">
        <strong>לא נמצאו תוצאות עבור “${escapeHtml(query)}”</strong>
        <p>${escapeHtml(message)}</p>
      </div>
      <button class="button soft empty-state-action" type="button" ${actionAttribute}>נקה וחפש מחדש</button>
    </article>
  `;
}

/** @param {SearchMarkupOptions} [options] */
function searchIndexErrorMarkup(options = {}) {
  const reader = options.reader === true;
  const wrapperClass = reader
    ? "reader-search-empty lightbox-search-empty empty-state ui-state empty-state-dark"
    : "search-empty empty-state ui-state";
  const retryAttribute = reader ? "data-lightbox-search-index-retry" : "data-global-search-index-retry";
  return `
    <article class="${wrapperClass}" data-state="error" role="alert">
      <span class="empty-state-icon ui-state-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path d="M12 3.5 21 19H3L12 3.5Z"/><path d="M12 9v4.5M12 16.8h.01"/></svg>
      </span>
      <div class="empty-state-copy">
        <strong>החיפוש אינו זמין כרגע</strong>
        <p>אינדקס החיפוש לא הצליח להיטען. אפשר לנסות שוב בלי לרענן את העמוד.</p>
      </div>
      <button class="button soft empty-state-action" type="button" ${retryAttribute}>נסה לטעון שוב</button>
    </article>
  `;
}

/** @param {SearchMarkupOptions} [options] */
function retrySearchIndexLoad(options = {}) {
  searchState.searchIndexLoadPromise = null;
  searchState.searchIndexLoadState = "idle";
  ensureSearchIndexLoaded({ trigger: "retry" })
    .then(() => {
      if (options.reader) renderLightboxSearchResults(searchElements.lightboxSearchInput?.value || "");
      else renderSearchResults(searchElements.globalSearchInput?.value || "");
    })
    .catch(() => {
      if (options.reader) renderLightboxSearchResults(searchElements.lightboxSearchInput?.value || "");
      else renderSearchResults(searchElements.globalSearchInput?.value || "");
    });
}

/** @param {unknown} query @returns {Promise<Array<CatalogSearchResult>>} */
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
            <img class="reader-search-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "viewer-search-results")}${catalogImageCrossOriginAttribute(rawImage)} />
          </span>
          <span class="reader-search-result-copy">${searchCatalogDomain.searchResultDetailsMarkup(result)}</span>
        </button>
      `;
    }).join("");

    bindSearchFloatingPreviewEvents(searchElements.lightboxSearchResults);
    Array.from(searchElements.lightboxSearchResults.querySelectorAll("[data-lightbox-search-page]")).filter(isHtmlElement).forEach((button) => {
      button.addEventListener("click", async () => {
        await trackCompletedLightboxSearch("result-open");
        hideSearchFloatingPreview();
        openLightboxSearchResult({
          catalogId: button.dataset.lightboxSearchCatalog,
          page: button.dataset.lightboxSearchPage
        });
      });
    });
    return results;
  } catch (error) {
    if (catalogSearch.isCancelledError(error) || renderSequence !== lightboxSearchRenderSequence) return [];
    searchState.searchIndexLoadState = "error";
    searchElements.lightboxSearchResults.removeAttribute("aria-busy");
    searchElements.lightboxSearchResults.classList.remove("hidden");
    searchElements.lightboxSearchResults.innerHTML = searchIndexErrorMarkup({ reader: true });
    searchElements.lightboxSearchResults.querySelector("[data-lightbox-search-index-retry]")?.addEventListener("click", () => retrySearchIndexLoad({ reader: true }));
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

/** @param {unknown} query */
function globalSearchKey(query) {
  return [String(query || "").trim(), getGlobalSearchCategory()].join("\u0000");
}

/** @param {unknown} query @param {number} [limit] @param {SearchRequestControl} [control] @returns {Promise<Array<CatalogSearchResult>>} */
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
  const rawPreview = result.image || (catalog ? (mediumSrc(catalog, page) || pageSrc(catalog, page)) : rawThumb);
  const rawImage = rawThumb || rawPreview;
  const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
  return `
    <article class="search-result-card">
      <button type="button" class="search-result-button" data-search-catalog="${escapeHtml(result.catalogId)}" data-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
        <span class="search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
        <span class="search-result-thumb-frame catalog-image-frame">
          <img class="search-result-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "global-search-results")}${catalogImageCrossOriginAttribute(rawImage)} />
        </span>
        <span class="search-result-copy">${searchCatalogDomain.searchResultDetailsMarkup(result)}</span>
      </button>
    </article>
  `;
}

/** @param {ParentNode} root */
function bindGlobalSearchResultEvents(root) {
  bindSearchFloatingPreviewEvents(root);
  Array.from(root.querySelectorAll("[data-search-navigation-type], [data-search-catalog]")).filter(isHtmlElement).forEach((button) => {
    button.addEventListener("click", async () => {
      await trackCompletedGlobalSearch("result-open", undefined, { immediate: true });
      flushGlobalSearchTelemetryBeforeNavigation();
      openGlobalSearchResult(button.dataset.searchNavigationType ? {
        resultType: button.dataset.searchNavigationType,
        targetId: button.dataset.searchNavigationTarget,
        catalogId: button.dataset.searchNavigationCatalog
      } : {
        resultType: "ocr",
        catalogId: button.dataset.searchCatalog,
        page: button.dataset.searchPage
      });
    });
  });
}

/** @param {Array<CatalogSearchResult>} results @param {number} start @param {number} count */
function appendGlobalSearchResultBatch(results, start, count) {
  const template = document.createElement("template");
  template.innerHTML = results
    .slice(start, start + count)
    .map(globalSearchResultMarkup)
    .join("");
  bindGlobalSearchResultEvents(template.content);
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
    searchElements.globalSearchResults.querySelector("[data-global-search-index-retry]")?.addEventListener("click", () => retrySearchIndexLoad());
    return [];
  }
}

/** @param {Event} event */
function handleLightboxSearchResultsBackgroundClick(event) {
  const result = eventTargetElement(event.target)?.closest?.("[data-lightbox-search-page]");
  if (result && searchElements.lightboxSearchResults?.contains(result)) return;

  event.preventDefault();
  event.stopPropagation();
  hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi: true });
}

function attachSearchUiEvents() {
  searchElements.globalSearchOpen?.addEventListener("click", (event) => {
    event.preventDefault();
    ensureSearchIndexLoaded().catch(() => {});
    event.stopPropagation();
    getFeatureInterface("catalog-detail")?.close();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    setGlobalSearchPanelOpen(!isGlobalSearchPanelOpen(), { focus: true, focusButton: true });
  });
  searchElements.globalSearchClose?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    closeGlobalSearchPanel({ focusButton: true });
  });

  searchElements.globalSearchInput?.addEventListener("input", () => {
    scheduleSearchRender("global", searchElements.globalSearchInput.value);
  });
  searchElements.globalSearchInput?.addEventListener("focus", () => {
    ensureSearchIndexLoaded().catch(() => {});
    scheduleSearchRender("global", searchElements.globalSearchInput.value, { immediate: true });
  });
  searchElements.globalSearchInput?.addEventListener("click", () => scheduleSearchRender("global", searchElements.globalSearchInput.value, { immediate: true }));
  searchElements.globalSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitGlobalSearch().catch(() => {});
  });
  searchElements.globalSearchClear?.addEventListener("click", () => {
    cancelScheduledSearch("global");
    searchElements.globalSearchInput.value = "";
    searchElements.globalSearchInput.focus();
    renderSearchResults("");
  });

  searchElements.globalSearchScopeToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    hideSearchFloatingPreview();
    getFeatureInterface("catalog-detail")?.close();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
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
    scheduleSearchRender("viewer", searchElements.lightboxSearchInput.value);
  });
  searchElements.lightboxSearchInput?.addEventListener("focus", () => {
    getFeatureInterface("viewer")?.showTopUi?.();
    ensureSearchIndexLoaded().catch(() => {});
    scheduleSearchRender("viewer", searchElements.lightboxSearchInput.value, { immediate: true });
  });
  searchElements.lightboxSearchInput?.addEventListener("click", () => {
    getFeatureInterface("viewer")?.showTopUi?.();
    scheduleSearchRender("viewer", searchElements.lightboxSearchInput.value, { immediate: true });
  });
  searchElements.lightboxSearchInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    submitLightboxSearch().catch(() => {});
  });
  searchElements.lightboxSearchClear?.addEventListener("click", () => {
    cancelScheduledSearch("viewer");
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
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();
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
    if (!searchElements.globalSearchScopeMenu.contains(target) && !searchElements.globalSearchScopeToggle.contains(target)) {
      closeGlobalSearchScopeMenu();
    }
    closeLightboxSearchScopeMenu();
    closeLightboxCatalogMenu();
    getFeatureInterface("catalog-detail")?.close();
    return true;
  }
  if (insideMobileReaderSearch) return true;
  if (searchState.lightboxMobileSearchOpen) setLightboxMobileSearchOpen(false, { hideResults: true });
  if (searchElements.lightboxSearchScopeMenu.contains(target) || searchElements.lightboxSearchScopeToggle.contains(target)) return true;
  if (searchElements.lightboxCatalogMenu.contains(target) || searchElements.lightboxCatalogMenuToggle.contains(target)) return true;
  closeGlobalSearchPanel({ focusButton: false });
  closeGlobalSearchScopeMenu();
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();
  return false;
}

function initializeSearchUi() {
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
    if (searchElements.globalSearchScopeMenu && !searchElements.globalSearchScopeMenu.classList.contains("hidden")) {
      closeGlobalSearchScopeMenu();
    } else {
      closeGlobalSearchPanel({ focusButton: true });
    }
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
      closeLightboxCatalogMenu();
      closeLightboxSearchScopeMenu();
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
  hideViewerResults: (options = {}) => hideLightboxSearchResults(options),
  closeGlobalPanel: (options = {}) => closeGlobalSearchPanel(options),
  attachEvents: attachSearchUiEvents,
  initialize: initializeSearchUi,
  prepareRoute: prepareSearchRoute,
  handleDocumentPointer: handleSearchDocumentPointer,
  handleResize: handleSearchResize,
  handleScroll: handleSearchScroll
});

export { closeLightboxCatalogMenu, closeLightboxSearchScopeMenu, hideLightboxSearchResults, initLightboxSearchStatus, renderLightboxCatalogMenu, resetLightboxSearch };
