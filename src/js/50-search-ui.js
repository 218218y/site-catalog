/**
 * Source module: 50-search-ui.js
 * Global and viewer search loading, scopes, result rendering, previews, and search interactions.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

let globalSearchRenderTimer = 0;
let lightboxSearchRenderTimer = 0;
let globalSearchRenderSequence = 0;
let lightboxSearchRenderSequence = 0;
let lastGlobalSearchResults = [];
let lastLightboxSearchResults = [];
let lastGlobalSearchKey = "";
let lastLightboxSearchKey = "";

function isSearchIndexReady() {
  return Boolean(catalogSearch?.isReady?.());
}

function refreshSearchUiAfterIndexLoad() {
  initSearchStatus();
  initLightboxSearchStatus();

  if (isGlobalSearchPanelOpen()) {
    renderSearchResults(searchElements.globalSearchInput?.value || "");
  }
  if (getFeatureInterface("viewer")?.isViewerOpen?.() && searchElements.lightboxSearchInput) {
    renderLightboxSearchResults(searchElements.lightboxSearchInput.value);
  }
}

function ensureSearchIndexLoaded(options = {}) {
  if (!catalogSearch?.ensureReady) {
    searchState.searchIndexLoadState = "error";
    return Promise.reject(new Error("Catalog search runtime is unavailable"));
  }
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

function cancelScheduledSearch(channel) {
  if (channel === "global") {
    window.clearTimeout(globalSearchRenderTimer);
    globalSearchRenderTimer = 0;
    globalSearchRenderSequence += 1;
  } else {
    window.clearTimeout(lightboxSearchRenderTimer);
    lightboxSearchRenderTimer = 0;
    lightboxSearchRenderSequence += 1;
  }
  catalogSearch?.cancel?.(channel);
}

function scheduleSearchRender(channel, query, options = {}) {
  const delay = options.immediate ? 0 : SEARCH_INPUT_DEBOUNCE_MS;
  const callback = channel === "global"
    ? () => renderSearchResults(query)
    : () => renderLightboxSearchResults(query);
  catalogSearch?.cancel?.(channel);
  if (channel === "global") {
    globalSearchRenderSequence += 1;
    window.clearTimeout(globalSearchRenderTimer);
    globalSearchRenderTimer = window.setTimeout(callback, delay);
  } else {
    lightboxSearchRenderSequence += 1;
    window.clearTimeout(lightboxSearchRenderTimer);
    lightboxSearchRenderTimer = window.setTimeout(callback, delay);
  }
}

function highlightedSearchText(text, ranges = []) {
  const raw = String(text || "");
  if (!raw) return "";
  const normalizedRanges = Array.isArray(ranges)
    ? ranges
      .map((range) => ({
        start: Math.max(0, Math.min(raw.length, Number(range?.start) || 0)),
        end: Math.max(0, Math.min(raw.length, Number(range?.end) || 0))
      }))
      .filter((range) => range.end > range.start)
      .sort((a, b) => a.start - b.start || a.end - b.end)
    : [];
  let cursor = 0;
  let markup = "";
  normalizedRanges.forEach((range) => {
    if (range.start < cursor) return;
    markup += escapeHtml(raw.slice(cursor, range.start));
    markup += `<mark class="search-match-highlight">${escapeHtml(raw.slice(range.start, range.end))}</mark>`;
    cursor = range.end;
  });
  return markup + escapeHtml(raw.slice(cursor));
}

function searchResultDetailsMarkup(result) {
  const page = Math.max(1, Number(result?.page) || 1);
  const reason = String(result?.matchReason || "התאמה בטקסט הקטלוג");
  const excerpt = highlightedSearchText(result?.excerpt || "", result?.highlights || []);
  return `
    <span class="search-result-meta">עמוד ${page} · ${escapeHtml(reason)}</span>
    ${excerpt ? `<span class="search-result-excerpt">${excerpt}</span>` : ""}
  `;
}

function getGlobalSearchCategories() {
  return getCatalogCategoryGroups()
    .filter((group) => String(group.category || "").trim() && Array.isArray(group.items) && group.items.length)
    .map((group) => ({ category: group.category }));
}

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
    ? `חיפוש דגם בקטגוריית ${category}...`
    : "הקלד דגם, מספר, שם מוצר או מילה מהקטלוג...";
}

function closeGlobalSearchScopeMenu() {
  searchElements.globalSearchScopeMenu?.classList.add("hidden");
  searchElements.globalSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function isGlobalSearchPanelOpen() {
  return Boolean(searchState.globalSearchOpen && searchElements.catalogSearch && !searchElements.catalogSearch.classList.contains("hidden"));
}

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
    renderGlobalSearchScopeMenu();
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

function openGlobalSearchPanel(options = {}) {
  setGlobalSearchPanelOpen(true, options);
}

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
  searchElements.globalSearchScopeMenu?.querySelectorAll("[data-global-search-category]").forEach((button) => {
    const selected = String(button.dataset.globalSearchCategory || "") === category;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

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
  const title = String(navigationState.catalog?.title || "").trim();
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

function closeDetailCatalogMenu() {
  catalogElements.catalogMenu?.classList.add("hidden");
  catalogElements.catalogMenuToggle?.setAttribute("aria-expanded", "false");
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
  searchElements.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]").forEach((button) => {
    const selected = button.dataset.lightboxSearchScope === scope;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

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

function hideLightboxSearchResults(options = {}) {
  const { blurTopUiFocus = false, hideTopUi = false } = options;

  hideSearchFloatingPreview();
  searchElements.lightboxSearchResults?.classList.add("hidden");
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();

  if (blurTopUiFocus) {
    const activeElement = document.activeElement;
    if (
      activeElement &&
      getFeatureInterface("viewer")?.containsTopBarElement?.(activeElement) &&
      typeof activeElement.blur === "function"
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

function lightboxSearchKey(query) {
  const scope = getLightboxSearchScope();
  return [String(query || "").trim(), scope, scope === "all" ? "" : (navigationState.catalog?.id || "")].join("\u0000");
}

async function getLightboxSearchResults(query, limit = 24) {
  const rawQuery = String(query || "").trim();
  if (rawQuery.length < 2) return [];
  await ensureSearchIndexLoaded({ trigger: "viewer-search" });
  if (!catalogSearch?.hasIndex?.()) return [];

  const options = { limit, channel: "viewer" };
  if (getLightboxSearchScope() !== "all") {
    if (!navigationState.catalog) return [];
    options.catalogId = navigationState.catalog.id;
  }
  const results = await catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

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
    catalogId: scope === "all" ? "" : navigationState.catalog?.id,
    completion
  });
  return results;
}

function openLightboxSearchResult(result) {
  if (!result) return false;

  const targetCatalogId = result.catalogId || navigationState.catalog?.id;
  if (!targetCatalogId) return false;

  if (!navigationState.catalog || navigationState.catalog.id !== targetCatalogId) {
    getFeatureInterface("viewer")?.openCatalog?.(targetCatalogId, Number(result.page));
    return true;
  }

  const page = clampPage(result.page, navigationState.catalog);
  getFeatureInterface("viewer")?.setPage?.(page);
  getFeatureInterface("viewer")?.showTopUi?.();
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

  const hasCatalog = Boolean(navigationState.catalog);
  const hasIndex = Boolean(catalogSearch?.hasIndex?.());
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

function rememberSearchPreviewPointer(event) {
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

  searchState.searchPreviewPointerClientX = clientX;
  searchState.searchPreviewPointerClientY = clientY;
}

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

function isSearchPreviewBlockedByOpenMenu(target) {
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
  return searchPreviewTargetBelongsToOpenResults(target) ? target : null;
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

function suppressSearchFloatingTooltip(duration = SEARCH_PREVIEW_SCROLL_SUPPRESS_MS, options = {}) {
  window.BargigTooltips?.suppress?.(duration, options);
}

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

function searchPreviewPageLabel(target) {
  return String(target?.dataset?.searchPreviewTitle || "קטלוג").trim() || "קטלוג";
}

function positionSearchFloatingPreview(target) {
  const preview = searchElements.searchFloatingPreview;
  if (!preview || !target) return;

  const targetRect = target.getBoundingClientRect();
  const gap = 16;
  const safeMargin = 12;
  const fallbackWidth = Math.min(430, Math.max(260, window.innerWidth * 0.34));
  const previewWidth = Math.max(240, preview.offsetWidth || fallbackWidth);
  const fallbackHeight = Math.min(620, Math.max(280, window.innerHeight * 0.64));
  const previewHeight = Math.max(240, preview.offsetHeight || fallbackHeight);

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

function showSearchFloatingPreview(target) {
  if (!target || !searchElements.searchFloatingPreview || !searchElements.searchFloatingPreviewImage) return;
  if (!searchPreviewTargetBelongsToOpenResults(target)) return;
  if (isSearchPreviewSuppressed()) return;
  if (isSearchPreviewBlockedByOpenMenu(target)) return;

  const src = String(target.dataset.searchPreviewSrc || "").trim();
  if (!src) return;

  const label = searchPreviewPageLabel(target);
  const previewCatalog = findCatalogById(target.dataset.searchCatalog || target.dataset.lightboxSearchCatalog);
  const previewPage = clampPage(target.dataset.searchPage || target.dataset.lightboxSearchPage, previewCatalog);
  applyCatalogImageDimensions(searchElements.searchFloatingPreviewImage, previewCatalog, previewPage);
  searchElements.searchFloatingPreviewImage.onload = () => positionSearchFloatingPreview(target);
  setCatalogImageSource(searchElements.searchFloatingPreviewImage, src);
  searchElements.searchFloatingPreviewImage.alt = label;
  if (searchElements.searchFloatingPreviewPage) searchElements.searchFloatingPreviewPage.textContent = label;

  searchElements.searchFloatingPreview.classList.add("visible");
  positionSearchFloatingPreview(target);
}

function bindSearchFloatingPreviewEvents(container) {
  if (!container) return;

  container.querySelectorAll("[data-search-preview-src]").forEach((target) => {
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

function handleSearchPreviewScrollIntent(event) {
  rememberSearchPreviewPointer(event);
  suppressSearchFloatingPreview();
}

function normalizedWheelDeltaY(event, scrollTarget) {
  const rawDelta = Number(event?.deltaY) || 0;
  if (!rawDelta) return 0;
  if (event.deltaMode === 1) return rawDelta * 16;
  if (event.deltaMode === 2) return rawDelta * Math.max(1, scrollTarget?.clientHeight || window.innerHeight || 1);
  return rawDelta;
}

function globalSearchWheelTarget(eventTarget) {
  if (isGlobalSearchScopeMenuOpen() && searchElements.globalSearchScopeMenu?.contains(eventTarget)) {
    return searchElements.globalSearchScopeMenu;
  }

  if (searchElements.globalSearchResults && !searchElements.globalSearchResults.classList.contains("hidden")) {
    return searchElements.globalSearchResults;
  }

  return null;
}

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

function handleGlobalSearchPanelWheel(event) {
  if (!isGlobalSearchPanelOpen() || !searchElements.catalogSearch?.contains(event.target)) return;

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

function normalizeSearchResultsDirection(container) {
  if (!container) return;
  container.setAttribute("dir", "rtl");
}

function lightboxSearchLayoutColumnLimit() {
  const columns = getFeatureInterface("catalog-grid")?.layoutColumnCount?.();
  if (Number.isFinite(Number(columns))) {
    return Math.max(1, Math.min(Number(columns), 3));
  }
  const width = Math.max(0, window.innerWidth || document.documentElement?.clientWidth || 0);
  return width >= 1180 ? 3 : width >= 760 ? 2 : 1;
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

async function renderLightboxSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!searchElements.lightboxSearchResults || !searchElements.lightboxSearchStatus) return [];
  const renderSequence = ++lightboxSearchRenderSequence;

  normalizeSearchResultsDirection(searchElements.lightboxSearchResults);
  hideSearchFloatingPreview();
  updateLightboxSearchResultsLayout(0);
  searchElements.lightboxSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    catalogSearch?.cancel?.("viewer");
    lastLightboxSearchKey = "";
    lastLightboxSearchResults = [];
    searchElements.lightboxSearchResults.classList.add("hidden");
    searchElements.lightboxSearchResults.removeAttribute("aria-busy");
    searchElements.lightboxSearchResults.innerHTML = "";
    initLightboxSearchStatus();
    return [];
  }

  if (!navigationState.catalog) {
    searchElements.lightboxSearchResults.classList.add("hidden");
    searchElements.lightboxSearchStatus.textContent = "בחר קטלוג כדי לחפש.";
    return [];
  }

  searchElements.lightboxSearchResults.setAttribute("aria-busy", "true");
  searchElements.lightboxSearchStatus.textContent = "מחפש באינדקס…";

  try {
    const scope = getLightboxSearchScope();
    const results = await getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24);
    if (renderSequence !== lightboxSearchRenderSequence || lightboxSearchKey(rawQuery) !== lightboxSearchKey(searchElements.lightboxSearchInput?.value || "")) {
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
      const catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId) || navigationState.catalog;
      const page = clampPage(result.page, catalog);
      const rawPreview = result.image || mediumSrc(catalog, page) || pageSrc(catalog, page);
      const rawThumb = result.thumb || thumbSrc(catalog, page);
      const rawImage = rawThumb || rawPreview;
      const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
      return `
        <button class="reader-search-result lightbox-search-result" type="button" data-lightbox-search-catalog="${escapeHtml(result.catalogId || catalog?.id || "")}" data-lightbox-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
          <span class="reader-search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
          <span class="reader-search-thumb-frame catalog-image-frame">
            <img class="reader-search-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(rawImage)} />
          </span>
          <span class="reader-search-result-copy">${searchResultDetailsMarkup(result)}</span>
        </button>
      `;
    }).join("");

    bindSearchFloatingPreviewEvents(searchElements.lightboxSearchResults);
    searchElements.lightboxSearchResults.querySelectorAll("[data-lightbox-search-page]").forEach((button) => {
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
    if (catalogSearch?.isCancelledError?.(error) || renderSequence !== lightboxSearchRenderSequence) return [];
    searchState.searchIndexLoadState = "error";
    searchElements.lightboxSearchResults.removeAttribute("aria-busy");
    searchElements.lightboxSearchResults.classList.remove("hidden");
    searchElements.lightboxSearchResults.innerHTML = searchIndexErrorMarkup({ reader: true });
    searchElements.lightboxSearchResults.querySelector("[data-lightbox-search-index-retry]")?.addEventListener("click", () => retrySearchIndexLoad({ reader: true }));
    searchElements.lightboxSearchStatus.textContent = "אינדקס החיפוש אינו זמין כרגע.";
    return [];
  }
}

function renderCatalogCategoryMenu(menu, { activeCatalogId = navigationState.catalog?.id } = {}) {
  if (!menu) return;

  if (!catalogs.length) {
    menu.innerHTML = `<div class="reader-catalog-menu-empty">אין קטלוגים להצגה</div>`;
    return;
  }

  const groups = getCatalogCategoryGroups();
  menu.innerHTML = groups.map((group) => `
    <section class="reader-catalog-menu-section">
      <div class="reader-catalog-menu-category">${escapeHtml(group.category)}</div>
      <div class="reader-catalog-menu-items">
        ${group.items.map((catalog) => `
          <button class="reader-catalog-menu-item${activeCatalogId === catalog.id ? " active" : ""}" type="button" role="menuitem" data-catalog-menu-id="${escapeHtml(catalog.id)}"${activeCatalogId === catalog.id ? ' aria-current="true"' : ""}>
            <strong>${escapeHtml(catalog.title)}</strong>
          </button>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function renderLightboxCatalogMenu() {
  if (!searchElements.lightboxCatalogMenu) return;

  renderCatalogCategoryMenu(searchElements.lightboxCatalogMenu);

  searchElements.lightboxCatalogMenu.querySelectorAll("[data-catalog-menu-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.catalogMenuId;
      closeLightboxCatalogMenu();
      if (!catalogId || catalogId === navigationState.catalog?.id) return;
      getFeatureInterface("viewer")?.openCatalog?.(catalogId, 1);
    });
  });
}

function updateDetailCatalogMenuLabel(catalog = navigationState.catalog) {
  if (!catalogElements.catalogMenuToggleText) return;
  catalogElements.catalogMenuToggleText.textContent = catalog?.title || "בחר קטלוג";
}

function renderDetailCatalogMenu() {
  if (!catalogElements.catalogMenu) return;

  renderCatalogCategoryMenu(catalogElements.catalogMenu);

  catalogElements.catalogMenu.querySelectorAll("[data-catalog-menu-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.catalogMenuId;
      closeDetailCatalogMenu();
      if (!catalogId || catalogId === navigationState.catalog?.id) return;
      navigateTo(catalogDocumentUrl(catalogId));
    });
  });
}

function globalSearchKey(query) {
  return [String(query || "").trim(), getGlobalSearchCategory()].join("\u0000");
}

async function getGlobalSearchResults(query, limit = 72) {
  const rawQuery = String(query || "").trim();
  const category = getGlobalSearchCategory();
  if (rawQuery.length < 2) return [];
  await ensureSearchIndexLoaded({ trigger: "global-search" });
  if (!catalogSearch?.hasIndex?.({ category })) return [];

  const options = { limit, channel: "global" };
  if (category) options.category = category;
  const results = await catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

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

function openGlobalSearchResult(result) {
  if (!result) return false;
  hideSearchFloatingPreview();
  navigateTo(viewerDocumentUrl(result.catalogId, Number(result.page)));
  closeGlobalSearchPanel({ focusButton: false });
  return true;
}

async function submitGlobalSearch() {
  const rawQuery = String(searchElements.globalSearchInput?.value || "").trim();
  const results = await renderSearchResults(rawQuery);
  await trackCompletedGlobalSearch("submit", rawQuery, { immediate: true });
  flushGlobalSearchTelemetryBeforeNavigation();
  return openGlobalSearchResult(results[0]);
}

async function renderSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!searchElements.globalSearchResults) return [];
  const renderSequence = ++globalSearchRenderSequence;

  normalizeSearchResultsDirection(searchElements.globalSearchResults);
  hideSearchFloatingPreview();
  searchElements.globalSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    catalogSearch?.cancel?.("global");
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
    const results = await getGlobalSearchResults(rawQuery, 72);
    if (renderSequence !== globalSearchRenderSequence || globalSearchKey(rawQuery) !== globalSearchKey(searchElements.globalSearchInput?.value || "")) {
      return [];
    }

    lastGlobalSearchKey = globalSearchKey(rawQuery);
    lastGlobalSearchResults = results;
    searchElements.globalSearchResults.removeAttribute("aria-busy");
    if (!results.length) {
      searchElements.globalSearchResults.classList.remove("hidden");
      searchElements.globalSearchResults.innerHTML = searchEmptyStateMarkup(
        rawQuery,
        category
          ? "נסה מספר דגם קצר יותר, חלק מהמילה, או חפש שוב בכל הקטלוגים."
          : "נסה מספר דגם קצר יותר או חלק מהמילה."
      );
      searchElements.globalSearchResults.querySelector("[data-empty-search-clear]")?.addEventListener("click", () => {
        searchElements.globalSearchInput.value = "";
        renderSearchResults("");
        searchElements.globalSearchInput.focus();
      });
      return [];
    }

    searchElements.globalSearchResults.classList.remove("hidden");
    searchElements.globalSearchResults.innerHTML = results.map((result) => {
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
              <img class="search-result-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(rawImage)} />
            </span>
            <span class="search-result-copy">${searchResultDetailsMarkup(result)}</span>
          </button>
        </article>
      `;
    }).join("");

    bindSearchFloatingPreviewEvents(searchElements.globalSearchResults);
    searchElements.globalSearchResults.querySelectorAll("[data-search-catalog]").forEach((button) => {
      button.addEventListener("click", async () => {
        await trackCompletedGlobalSearch("result-open", undefined, { immediate: true });
        flushGlobalSearchTelemetryBeforeNavigation();
        openGlobalSearchResult({ catalogId: button.dataset.searchCatalog, page: button.dataset.searchPage });
      });
    });
    return results;
  } catch (error) {
    if (catalogSearch?.isCancelledError?.(error) || renderSequence !== globalSearchRenderSequence) return [];
    searchState.searchIndexLoadState = "error";
    searchElements.globalSearchResults.removeAttribute("aria-busy");
    searchElements.globalSearchResults.classList.remove("hidden");
    searchElements.globalSearchResults.innerHTML = searchIndexErrorMarkup();
    searchElements.globalSearchResults.querySelector("[data-global-search-index-retry]")?.addEventListener("click", () => retrySearchIndexLoad());
    return [];
  }
}

function handleLightboxSearchResultsBackgroundClick(event) {
  const result = event.target?.closest?.("[data-lightbox-search-page]");
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
    closeDetailCatalogMenu();
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
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    renderGlobalSearchScopeMenu();
    const isOpen = !searchElements.globalSearchScopeMenu?.classList.contains("hidden");
    searchElements.globalSearchScopeMenu?.classList.toggle("hidden", isOpen);
    searchElements.globalSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
  });
  searchElements.globalSearchScopeMenu?.addEventListener("click", (event) => {
    event.stopPropagation();
    const button = event.target.closest?.("[data-global-search-category]");
    if (!button || !searchElements.globalSearchScopeMenu.contains(button)) return;
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
    closeDetailCatalogMenu();
    closeLightboxCatalogMenu();
    const isOpen = !searchElements.lightboxSearchScopeMenu?.classList.contains("hidden");
    searchElements.lightboxSearchScopeMenu?.classList.toggle("hidden", isOpen);
    searchElements.lightboxSearchScopeToggle.setAttribute("aria-expanded", isOpen ? "false" : "true");
    getFeatureInterface("viewer")?.showTopUi?.();
  });
  searchElements.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      setLightboxSearchScope(button.dataset.lightboxSearchScope);
      getFeatureInterface("viewer")?.showTopUi?.();
      searchElements.lightboxSearchInput?.focus();
    });
  });
  searchElements.lightboxCatalogMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    closeDetailCatalogMenu();
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
    searchElements.lightboxSearchResults?.contains(target.closest("[data-lightbox-search-page]"))
  ),
  hideViewerResults: (options = {}) => hideLightboxSearchResults(options)
});
