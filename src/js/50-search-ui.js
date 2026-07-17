/**
 * Source module: 50-search-ui.js
 * Global and viewer search loading, scopes, result rendering, previews, and search interactions.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function isSearchIndexReady() {
  return Array.isArray(window.BARGIG_CATALOG_SEARCH);
}

function refreshSearchUiAfterIndexLoad() {
  initSearchStatus();
  initLightboxSearchStatus();

  if (isGlobalSearchPanelOpen()) {
    renderSearchResults(els.globalSearchInput?.value || "");
  }
  if (state.lightboxOpen && els.lightboxSearchInput) {
    renderLightboxSearchResults(els.lightboxSearchInput.value);
  }
}

function ensureSearchIndexLoaded() {
  if (isSearchIndexReady()) {
    state.searchIndexLoadState = "ready";
    refreshSearchUiAfterIndexLoad();
    return Promise.resolve(true);
  }

  if (state.searchIndexLoadPromise) return state.searchIndexLoadPromise;

  state.searchIndexLoadState = "loading";
  initLightboxSearchStatus();

  state.searchIndexLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-search-index-src="${SEARCH_INDEX_SCRIPT_SRC}"]`);
    const script = existing || document.createElement("script");

    const handleLoad = () => {
      state.searchIndexLoadState = isSearchIndexReady() ? "ready" : "error";
      state.searchIndexLoadPromise = null;
      refreshSearchUiAfterIndexLoad();
      if (state.searchIndexLoadState === "ready") resolve(true);
      else reject(new Error("Search index loaded without data"));
    };

    const handleError = () => {
      state.searchIndexLoadState = "error";
      state.searchIndexLoadPromise = null;
      script.remove();
      initLightboxSearchStatus();
      reject(new Error("Failed to load the catalog search index"));
    };

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existing) {
      script.src = SEARCH_INDEX_SCRIPT_SRC;
      script.async = true;
      script.dataset.searchIndexSrc = SEARCH_INDEX_SCRIPT_SRC;
      document.head.appendChild(script);
    }
  });

  return state.searchIndexLoadPromise;
}

function scheduleSearchIndexPreload() {
  window.clearTimeout(state.searchIndexPreloadTimer);
  state.searchIndexPreloadTimer = window.setTimeout(() => {
    const preload = () => ensureSearchIndexLoaded().catch(() => {});
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(preload, { timeout: 2500 });
    } else {
      preload();
    }
  }, SEARCH_INDEX_PRELOAD_DELAY_MS);
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
  const selectedCategory = String(state.globalSearchCategory || "").trim();
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
  els.globalSearchScopeMenu?.classList.add("hidden");
  els.globalSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function isGlobalSearchPanelOpen() {
  return Boolean(state.globalSearchOpen && els.catalogSearch && !els.catalogSearch.classList.contains("hidden"));
}

function setGlobalSearchPanelOpen(open, options = {}) {
  const shouldOpen = Boolean(open);
  state.globalSearchOpen = shouldOpen;

  if (!els.catalogSearch) return;

  els.catalogSearch.classList.toggle("hidden", !shouldOpen);
  els.catalogSearch.classList.toggle("is-open", shouldOpen);
  els.catalogSearch.setAttribute("aria-hidden", shouldOpen ? "false" : "true");

  els.globalSearchOpen?.classList.toggle("is-active", shouldOpen);
  els.globalSearchOpen?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");

  if (shouldOpen) {
    renderGlobalSearchScopeMenu();
    renderSearchResults(els.globalSearchInput?.value || "");
    if (options.focus !== false) {
      window.requestAnimationFrame(() => els.globalSearchInput?.focus({ preventScroll: true }));
    }
    return;
  }

  closeGlobalSearchScopeMenu();
  hideSearchFloatingPreview();
  if (options.hideResults !== false) {
    els.globalSearchResults?.classList.add("hidden");
  }
  if (options.focusButton) {
    window.requestAnimationFrame(() => els.globalSearchOpen?.focus({ preventScroll: true }));
  }
}

function openGlobalSearchPanel(options = {}) {
  setGlobalSearchPanelOpen(true, options);
}

function closeGlobalSearchPanel(options = {}) {
  setGlobalSearchPanelOpen(false, options);
}

function renderGlobalSearchScopeMenu() {
  if (!els.globalSearchScopeMenu) return;

  const categories = getGlobalSearchCategories();
  els.globalSearchScopeMenu.innerHTML = `
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
  if (els.globalSearchScopeToggle) {
    els.globalSearchScopeToggle.innerHTML = `${escapeHtml(globalSearchScopeLabel(category))} <span aria-hidden="true">⌄</span>`;
    els.globalSearchScopeToggle.title = category ? `חיפוש רק בקטגוריית ${category}` : "חיפוש בכל הקטלוגים";
  }
  if (els.globalSearchInput) {
    els.globalSearchInput.placeholder = globalSearchPlaceholder();
    els.globalSearchInput.setAttribute("aria-label", globalSearchPlaceholder());
  }
  els.globalSearchScopeMenu?.querySelectorAll("[data-global-search-category]").forEach((button) => {
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

  if (state.globalSearchCategory === nextCategory) {
    syncGlobalSearchScopeUi();
    closeGlobalSearchScopeMenu();
    return;
  }

  state.globalSearchCategory = nextCategory;
  syncGlobalSearchScopeUi();
  closeGlobalSearchScopeMenu();
  initSearchStatus();

  if (options.render !== false && els.globalSearchInput) {
    renderSearchResults(els.globalSearchInput.value);
  }
}

function initSearchStatus() {
  syncGlobalSearchScopeUi();
}

function getLightboxSearchScope() {
  return state.lightboxSearchScope === "all" ? "all" : "catalog";
}

function lightboxSearchScopeLabel(scope = getLightboxSearchScope()) {
  return scope === "all" ? "בכל הקטלוגים" : "בקטלוג הזה";
}

function lightboxSearchPlaceholder() {
  if (getLightboxSearchScope() === "all") return "חיפוש דגם בכל הקטלוגים...";
  const title = String(state.catalog?.title || "").trim();
  return title ? `חיפוש ב: ${title}` : "חיפוש ב...";
}

function closeLightboxSearchScopeMenu() {
  els.lightboxSearchScopeMenu?.classList.add("hidden");
  els.lightboxSearchScopeToggle?.setAttribute("aria-expanded", "false");
}

function closeLightboxCatalogMenu() {
  els.lightboxCatalogMenu?.classList.add("hidden");
  els.lightboxCatalogMenuToggle?.setAttribute("aria-expanded", "false");
}

function isMobileReaderSearchMode() {
  return Boolean(window.matchMedia?.(MOBILE_READER_SEARCH_MEDIA).matches);
}

function syncLightboxMobileSearchUi() {
  const compactMode = isMobileReaderSearchMode();
  const isOpen = compactMode && state.lightboxMobileSearchOpen;

  if (!compactMode) state.lightboxMobileSearchOpen = false;
  els.lightbox?.classList.toggle("mobile-search-open", isOpen);
  els.lightboxMobileSearchToggle?.setAttribute("aria-expanded", isOpen ? "true" : "false");
  els.lightboxSearchPanel?.setAttribute("aria-hidden", compactMode && !isOpen ? "true" : "false");
}

function setLightboxMobileSearchOpen(open, options = {}) {
  const { focusInput = false, returnFocus = false, hideResults = true, hideTopUi = false } = options;
  const shouldOpen = Boolean(open && state.lightboxOpen && isMobileReaderSearchMode());

  state.lightboxMobileSearchOpen = shouldOpen;
  syncLightboxMobileSearchUi();

  if (shouldOpen) {
    closeLightboxCatalogMenu();
    closeLightboxSearchScopeMenu();
    showTopUiTemporarily(0);
    ensureSearchIndexLoaded().catch(() => {});
    if (focusInput) {
      window.requestAnimationFrame(() => els.lightboxSearchInput?.focus());
    }
    return;
  }

  if (hideResults) {
    hideLightboxSearchResults({ blurTopUiFocus: true, hideTopUi });
  }
  if (returnFocus && isMobileReaderSearchMode()) {
    els.lightboxMobileSearchToggle?.focus();
  }
}

function closeDetailCatalogMenu() {
  els.catalogMenu?.classList.add("hidden");
  els.catalogMenuToggle?.setAttribute("aria-expanded", "false");
}

function syncLightboxSearchScopeUi() {
  const scope = getLightboxSearchScope();
  if (els.lightboxSearchScopeToggle) {
    els.lightboxSearchScopeToggle.innerHTML = `${escapeHtml(lightboxSearchScopeLabel(scope))} <span aria-hidden="true">⌄</span>`;
  }
  if (els.lightboxSearchInput) {
    els.lightboxSearchInput.placeholder = lightboxSearchPlaceholder();
    els.lightboxSearchInput.setAttribute("aria-label", lightboxSearchPlaceholder());
  }
  els.lightboxSearchScopeMenu?.querySelectorAll("[data-lightbox-search-scope]").forEach((button) => {
    const selected = button.dataset.lightboxSearchScope === scope;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-checked", selected ? "true" : "false");
  });
}

function setLightboxSearchScope(scope, options = {}) {
  const nextScope = scope === "all" ? "all" : "catalog";
  if (state.lightboxSearchScope === nextScope) {
    syncLightboxSearchScopeUi();
    closeLightboxSearchScopeMenu();
    return;
  }

  state.lightboxSearchScope = nextScope;
  syncLightboxSearchScopeUi();
  closeLightboxSearchScopeMenu();
  initLightboxSearchStatus();

  if (options.render !== false && els.lightboxSearchInput) {
    renderLightboxSearchResults(els.lightboxSearchInput.value);
  }
}

function hideLightboxSearchResults(options = {}) {
  const { blurTopUiFocus = false, hideTopUi = false } = options;

  hideSearchFloatingPreview();
  els.lightboxSearchResults?.classList.add("hidden");
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();

  if (blurTopUiFocus) {
    const activeElement = document.activeElement;
    if (activeElement && els.lightboxBar?.contains(activeElement) && typeof activeElement.blur === "function") {
      activeElement.blur();
    }
  }

  if (hideTopUi && !state.topUiPinned) {
    window.clearTimeout(state.uiHideTimer);
    els.lightbox?.classList.remove("show-ui");
  }
}

function resetLightboxSearch() {
  state.lightboxMobileSearchOpen = false;
  syncLightboxMobileSearchUi();
  if (els.lightboxSearchInput) els.lightboxSearchInput.value = "";
  hideLightboxSearchResults({ blurTopUiFocus: true });
  if (els.lightboxSearchResults) els.lightboxSearchResults.innerHTML = "";
  els.lightboxSearchClear?.classList.add("hidden");
  syncLightboxSearchScopeUi();
  initLightboxSearchStatus();
}

function getLightboxSearchResults(query, limit = 24) {
  const rawQuery = String(query || "").trim();
  if (rawQuery.length < 2 || !catalogSearch?.hasIndex?.()) return [];

  const options = { limit, includeExcerpt: false };
  if (getLightboxSearchScope() !== "all") {
    if (!state.catalog) return [];
    options.catalogId = state.catalog.id;
  }

  const results = catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

function trackCompletedLightboxSearch(completion, query = els.lightboxSearchInput?.value || "") {
  const rawQuery = String(query || "").trim();
  const scope = getLightboxSearchScope();
  const results = getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24);
  telemetryTrackSearch(rawQuery, results.length, {
    surface: "viewer",
    scope,
    catalogId: scope === "all" ? "" : state.catalog?.id,
    completion
  });
  return results;
}

function openLightboxSearchResult(result) {
  if (!result) return false;

  const targetCatalogId = result.catalogId || state.catalog?.id;
  if (!targetCatalogId) return false;

  if (!state.catalog || state.catalog.id !== targetCatalogId) {
    openCatalogInViewer(targetCatalogId, Number(result.page));
    return true;
  }

  const page = clampPage(result.page, state.catalog);
  setLightboxPage(page);
  showTopUiTemporarily(0);
  if (state.lightboxMobileSearchOpen) {
    setLightboxMobileSearchOpen(false, { hideResults: true });
  } else {
    hideLightboxSearchResults();
  }
  return true;
}

function submitLightboxSearch() {
  const rawQuery = String(els.lightboxSearchInput?.value || "").trim();
  renderLightboxSearchResults(rawQuery);
  const results = trackCompletedLightboxSearch("submit", rawQuery);
  return openLightboxSearchResult(results[0]);
}

function initLightboxSearchStatus() {
  if (!els.lightboxSearchStatus) return;

  const hasCatalog = Boolean(state.catalog);
  const hasIndex = Boolean(catalogSearch?.hasIndex?.());
  const indexPending = !hasIndex && state.searchIndexLoadState !== "error";
  if (els.lightboxSearchInput) els.lightboxSearchInput.disabled = !hasCatalog;
  syncLightboxSearchScopeUi();

  if (!hasCatalog) {
    els.lightboxSearchStatus.textContent = "בחר קטלוג כדי לחפש.";
    return;
  }

  if (!hasIndex) {
    els.lightboxSearchStatus.textContent = indexPending
      ? "אינדקס החיפוש נטען לפי הצורך."
      : "אינדקס החיפוש אינו זמין כרגע.";
    return;
  }

  els.lightboxSearchStatus.textContent = getLightboxSearchScope() === "all"
    ? "הקלד לפחות 2 תווים לחיפוש בכל הקטלוגים."
    : "הקלד לפחות 2 תווים לחיפוש בתוך הקטלוג הפתוח.";
}

function hideSearchFloatingPreview() {
  els.searchFloatingPreview?.classList.remove("visible");
}

function isGlobalSearchScopeMenuOpen() {
  return Boolean(els.globalSearchScopeMenu && !els.globalSearchScopeMenu.classList.contains("hidden"));
}

function isLightboxSearchScopeMenuOpen() {
  return Boolean(els.lightboxSearchScopeMenu && !els.lightboxSearchScopeMenu.classList.contains("hidden"));
}

function rememberSearchPreviewPointer(event) {
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

  state.searchPreviewPointerClientX = clientX;
  state.searchPreviewPointerClientY = clientY;
}

function searchPreviewTargetBelongsToOpenResults(target) {
  if (!target || !target.isConnected) return false;

  if (els.globalSearchResults?.contains(target)) {
    return isGlobalSearchPanelOpen() && !els.globalSearchResults.classList.contains("hidden");
  }

  if (els.lightboxSearchResults?.contains(target)) {
    return state.lightboxOpen && !els.lightboxSearchResults.classList.contains("hidden");
  }

  return false;
}

function isSearchPreviewBlockedByOpenMenu(target) {
  if (els.globalSearchResults?.contains(target) && isGlobalSearchScopeMenuOpen()) return true;
  if (els.lightboxSearchResults?.contains(target) && isLightboxSearchScopeMenuOpen()) return true;
  return false;
}

function getSearchPreviewTargetAtLastPointer() {
  const clientX = Number(state.searchPreviewPointerClientX);
  const clientY = Number(state.searchPreviewPointerClientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  if (clientX < 0 || clientY < 0 || clientX > window.innerWidth || clientY > window.innerHeight) return null;

  const element = document.elementFromPoint(clientX, clientY);
  const target = element?.closest?.("[data-search-preview-src]");
  return searchPreviewTargetBelongsToOpenResults(target) ? target : null;
}

function isSearchPreviewSuppressed() {
  return Date.now() < (state.searchPreviewSuppressUntil || 0);
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
  state.searchPreviewSuppressUntil = Math.max(
    state.searchPreviewSuppressUntil || 0,
    Date.now() + delay
  );
  hideSearchFloatingPreview();

  window.clearTimeout(state.searchPreviewSuppressTimer);
  state.searchPreviewSuppressTimer = window.setTimeout(() => {
    state.searchPreviewSuppressTimer = 0;
    if (restoreAfter) restoreSearchFloatingPreviewAfterSuppression();
  }, delay + 20);
}

function searchPreviewPageLabel(target) {
  return String(target?.dataset?.searchPreviewTitle || "קטלוג").trim() || "קטלוג";
}

function positionSearchFloatingPreview(target) {
  const preview = els.searchFloatingPreview;
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
  if (!target || !els.searchFloatingPreview || !els.searchFloatingPreviewImage) return;
  if (!searchPreviewTargetBelongsToOpenResults(target)) return;
  if (isSearchPreviewSuppressed()) return;
  if (isSearchPreviewBlockedByOpenMenu(target)) return;

  const src = String(target.dataset.searchPreviewSrc || "").trim();
  if (!src) return;

  const label = searchPreviewPageLabel(target);
  els.searchFloatingPreviewImage.onload = () => positionSearchFloatingPreview(target);
  setCatalogImageSource(els.searchFloatingPreviewImage, src);
  els.searchFloatingPreviewImage.alt = label;
  if (els.searchFloatingPreviewPage) els.searchFloatingPreviewPage.textContent = label;

  els.searchFloatingPreview.classList.add("visible");
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
  if (isGlobalSearchScopeMenuOpen() && els.globalSearchScopeMenu?.contains(eventTarget)) {
    return els.globalSearchScopeMenu;
  }

  if (els.globalSearchResults && !els.globalSearchResults.classList.contains("hidden")) {
    return els.globalSearchResults;
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
  if (!isGlobalSearchPanelOpen() || !els.catalogSearch?.contains(event.target)) return;

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
  return Math.max(1, Math.min(catalogLayoutColumnCount(), 3));
}

function updateLightboxSearchResultsLayout(count = 0) {
  if (!els.lightboxSearchResults) return;
  normalizeSearchResultsDirection(els.lightboxSearchResults);

  const resultCount = Math.max(0, Number(count) || 0);
  const columns = Math.max(1, Math.min(resultCount || 1, lightboxSearchLayoutColumnLimit()));
  els.lightboxSearchResults.style.setProperty("--reader-search-result-columns", String(columns));
  els.lightboxSearchResults.dataset.resultColumns = String(columns);
  els.lightboxSearchResults.dataset.resultCount = String(resultCount);
}

function searchEmptyStateMarkup(query, message, options = {}) {
  const reader = options.reader === true;
  const wrapperClass = reader
    ? "reader-search-empty lightbox-search-empty empty-state empty-state-dark"
    : "search-empty empty-state";
  const actionAttribute = reader ? "data-lightbox-empty-search-clear" : "data-empty-search-clear";
  return `
    <article class="${wrapperClass}">
      <span class="empty-state-icon" aria-hidden="true">
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

function renderLightboxSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!els.lightboxSearchResults || !els.lightboxSearchStatus) return;

  normalizeSearchResultsDirection(els.lightboxSearchResults);
  hideSearchFloatingPreview();
  updateLightboxSearchResultsLayout(0);
  els.lightboxSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    els.lightboxSearchResults.classList.add("hidden");
    els.lightboxSearchResults.innerHTML = "";
    initLightboxSearchStatus();
    return;
  }

  if (!state.catalog || !catalogSearch?.hasIndex?.()) {
    els.lightboxSearchResults.classList.add("hidden");
    els.lightboxSearchResults.innerHTML = "";
    els.lightboxSearchStatus.textContent = "אין אינדקס חיפוש פעיל לקטלוג הזה.";
    return;
  }

  const scope = getLightboxSearchScope();
  const results = getLightboxSearchResults(rawQuery, scope === "all" ? 48 : 24);
  updateLightboxSearchResultsLayout(results.length);
  els.lightboxSearchResults.classList.remove("hidden");

  if (!results.length) {
    els.lightboxSearchStatus.textContent = scope === "all"
      ? "לא נמצאו תוצאות בכל הקטלוגים."
      : "לא נמצאו תוצאות בקטלוג הפתוח.";
    els.lightboxSearchResults.innerHTML = searchEmptyStateMarkup(
      rawQuery,
      "נסה חלק קצר יותר של הדגם או מילה אחרת.",
      { reader: true }
    );
    els.lightboxSearchResults.querySelector("[data-lightbox-empty-search-clear]")?.addEventListener("click", (event) => {
      event.stopPropagation();
      els.lightboxSearchInput.value = "";
      renderLightboxSearchResults("");
      els.lightboxSearchInput.focus();
    });
    return;
  }

  els.lightboxSearchStatus.textContent = scope === "all"
    ? `נמצאו ${results.length} תוצאות בכל הקטלוגים.`
    : `נמצאו ${results.length} תוצאות בקטלוג הזה.`;
  els.lightboxSearchResults.innerHTML = results.map((result) => {
    const catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId) || state.catalog;
    const page = clampPage(result.page, catalog);
    const rawPreview = result.image || pageSrc(catalog, page);
    const rawThumb = result.thumb || thumbSrc(catalog, page);
    const rawImage = rawPreview || rawThumb;
    const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
    return `
      <button class="reader-search-result lightbox-search-result" type="button" data-lightbox-search-catalog="${escapeHtml(result.catalogId || catalog?.id || "")}" data-lightbox-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
        <span class="reader-search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
        <span class="reader-search-thumb-frame catalog-image-frame">
          <img class="reader-search-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(rawImage)} />
        </span>
      </button>
    `;
  }).join("");

  bindSearchFloatingPreviewEvents(els.lightboxSearchResults);

  els.lightboxSearchResults.querySelectorAll("[data-lightbox-search-page]").forEach((button) => {
    button.addEventListener("click", () => {
      trackCompletedLightboxSearch("result-open");
      hideSearchFloatingPreview();
      openLightboxSearchResult({
        catalogId: button.dataset.lightboxSearchCatalog,
        page: button.dataset.lightboxSearchPage
      });
    });
  });
}

function renderCatalogCategoryMenu(menu, { activeCatalogId = state.catalog?.id } = {}) {
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
  if (!els.lightboxCatalogMenu) return;

  renderCatalogCategoryMenu(els.lightboxCatalogMenu);

  els.lightboxCatalogMenu.querySelectorAll("[data-catalog-menu-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.catalogMenuId;
      closeLightboxCatalogMenu();
      if (!catalogId || catalogId === state.catalog?.id) return;
      openCatalogInViewer(catalogId, 1);
    });
  });
}

function updateDetailCatalogMenuLabel(catalog = state.catalog) {
  if (!els.catalogMenuToggleText) return;
  els.catalogMenuToggleText.textContent = catalog?.title || "בחר קטלוג";
}

function renderDetailCatalogMenu() {
  if (!els.catalogMenu) return;

  renderCatalogCategoryMenu(els.catalogMenu);

  els.catalogMenu.querySelectorAll("[data-catalog-menu-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const catalogId = button.dataset.catalogMenuId;
      closeDetailCatalogMenu();
      if (!catalogId || catalogId === state.catalog?.id) return;
      openCatalog(catalogId);
    });
  });
}

function getGlobalSearchResults(query, limit = 72) {
  const rawQuery = String(query || "").trim();
  const category = getGlobalSearchCategory();
  if (rawQuery.length < 2 || !catalogSearch?.hasIndex?.({ category })) return [];

  const options = { limit, includeExcerpt: false };
  if (category) options.category = category;

  const results = catalogSearch.search(rawQuery, options);
  return Array.isArray(results) ? results : [];
}

function trackCompletedGlobalSearch(completion, query = els.globalSearchInput?.value || "", options = {}) {
  const rawQuery = String(query || "").trim();
  const category = getGlobalSearchCategory();
  const results = getGlobalSearchResults(rawQuery, 72);
  telemetryTrackSearch(rawQuery, results.length, {
    surface: "global",
    scope: category || "all",
    completion,
    immediate: options.immediate === true
  });
  return results;
}

function flushGlobalSearchTelemetryBeforeNavigation() {
  // Search-result clicks leave the current document immediately. Start a
  // keepalive request synchronously instead of relying on the delayed batch
  // timer or on pagehide, both of which can be skipped by fast navigations.
  telemetryFlush().catch(() => {});
}

function openGlobalSearchResult(result) {
  if (!result) return false;
  hideSearchFloatingPreview();
  openCatalog(result.catalogId, { openPage: Number(result.page) });
  closeGlobalSearchPanel({ focusButton: false });
  return true;
}

function submitGlobalSearch() {
  const rawQuery = String(els.globalSearchInput?.value || "").trim();
  renderSearchResults(rawQuery);
  const results = trackCompletedGlobalSearch("submit", rawQuery, { immediate: true });
  flushGlobalSearchTelemetryBeforeNavigation();
  return openGlobalSearchResult(results[0]);
}

function renderSearchResults(query) {
  const rawQuery = String(query || "").trim();
  if (!els.globalSearchResults) return;

  normalizeSearchResultsDirection(els.globalSearchResults);
  hideSearchFloatingPreview();
  els.globalSearchClear?.classList.toggle("hidden", rawQuery.length === 0);

  if (rawQuery.length < 2) {
    els.globalSearchResults.classList.add("hidden");
    els.globalSearchResults.innerHTML = "";
    initSearchStatus();
    return;
  }

  const category = getGlobalSearchCategory();

  if (!catalogSearch?.hasIndex?.({ category })) {
    els.globalSearchResults.classList.add("hidden");
    els.globalSearchResults.innerHTML = "";
    return;
  }

  const results = getGlobalSearchResults(rawQuery, 72);
  if (!results.length) {
    els.globalSearchResults.classList.remove("hidden");
    els.globalSearchResults.innerHTML = searchEmptyStateMarkup(
      rawQuery,
      category
        ? "נסה מספר דגם קצר יותר, חלק מהמילה, או חפש שוב בכל הקטלוגים."
        : "נסה מספר דגם קצר יותר או חלק מהמילה."
    );
    els.globalSearchResults.querySelector("[data-empty-search-clear]")?.addEventListener("click", () => {
      els.globalSearchInput.value = "";
      renderSearchResults("");
      els.globalSearchInput.focus();
    });
    return;
  }

  els.globalSearchResults.classList.remove("hidden");
  els.globalSearchResults.innerHTML = results.map((result) => {
    const catalog = result.catalog || catalogs.find((item) => item.id === result.catalogId);
    const page = clampPage(result.page, catalog);
    const rawThumb = result.thumb || (catalog ? thumbSrc(catalog, page) : "");
    const rawPreview = result.image || (catalog ? pageSrc(catalog, page) : rawThumb);
    const rawImage = rawPreview || rawThumb;
    const catalogTitle = result.catalogTitle || catalog?.title || "קטלוג";
    return `
      <article class="search-result-card">
        <button type="button" class="search-result-button" data-search-catalog="${escapeHtml(result.catalogId)}" data-search-page="${page}" data-search-preview-src="${escapeHtml(rawPreview || rawImage)}" data-search-preview-title="${escapeHtml(catalogTitle)}">
          <span class="search-result-title" title="${escapeHtml(catalogTitle)}">${escapeHtml(catalogTitle)}</span>
          <span class="search-result-thumb-frame catalog-image-frame">
            <img class="search-result-thumb" src="${escapeHtml(rawImage)}" alt="${escapeHtml(catalogTitle)}" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(rawImage)} />
          </span>
        </button>
      </article>
    `;
  }).join("");

  bindSearchFloatingPreviewEvents(els.globalSearchResults);

  els.globalSearchResults.querySelectorAll("[data-search-catalog]").forEach((button) => {
    button.addEventListener("click", () => {
      trackCompletedGlobalSearch("result-open", undefined, { immediate: true });
      flushGlobalSearchTelemetryBeforeNavigation();
      openGlobalSearchResult({ catalogId: button.dataset.searchCatalog, page: button.dataset.searchPage });
    });
  });
}

function attachSearchUiEvents() {
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
}
