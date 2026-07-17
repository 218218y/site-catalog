/**
 * Source module: 30-favorites-share.js
 * Favorites storage integration, portable selection links, favorites panels, and link sharing.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function favoriteIdentity(catalog = state.catalog, page = state.page) {
  if (!catalog) return null;
  return {
    catalogId: String(catalog.id || ""),
    page: clampPage(page, catalog)
  };
}

function getFavoriteEntries() {
  if (!favoritesStore) return [];
  return favoritesStore.read().flatMap((item) => {
    const catalog = findCatalogById(item.catalogId);
    const page = Number.parseInt(item.page, 10);
    const maxPage = Number.parseInt(catalog?.pages, 10);
    if (!catalog || !Number.isFinite(page) || page < 1 || !Number.isFinite(maxPage) || page > maxPage) return [];
    return [{ ...item, catalog, page }];
  });
}


function getValidFavoriteItems() {
  return getFavoriteEntries().map(({ catalogId, catalog, page, savedAt }) => ({
    catalogId: String(catalogId || catalog?.id || ""),
    page,
    savedAt: Number(savedAt) > 0 ? Number(savedAt) : 0
  }));
}

function favoriteItemKey(item) {
  const catalogId = String(item?.catalogId || item?.catalog?.id || "").trim();
  const page = Number.parseInt(item?.page, 10);
  return catalogId && Number.isFinite(page) && page > 0 ? `${catalogId}\u0000${page}` : "";
}

function normalizeFavoriteTransferItems(values) {
  const normalized = window.BargigFavorites?.normalizeItems?.(values) || [];
  const accepted = [];
  let rejected = Math.max(0, Array.isArray(values) ? values.length - normalized.length : 0);

  normalized.forEach((item) => {
    const catalog = findCatalogById(item.catalogId);
    const pageCount = Number.parseInt(catalog?.pages, 10);
    if (!catalog || !Number.isFinite(pageCount) || item.page > pageCount) {
      rejected += 1;
      return;
    }
    accepted.push({
      catalogId: item.catalogId,
      page: item.page,
      savedAt: Number(item.savedAt) > 0 ? Number(item.savedAt) : 0
    });
  });

  return { items: accepted, rejected };
}

function analyzeFavoriteItemMerge(incoming, existing = getValidFavoriteItems()) {
  const incomingItems = window.BargigFavorites?.normalizeItems?.(incoming) || [];
  const existingItems = window.BargigFavorites?.normalizeItems?.(existing) || [];
  const existingKeys = new Set(existingItems.map(favoriteItemKey).filter(Boolean));
  const incomingKeys = new Set(incomingItems.map(favoriteItemKey).filter(Boolean));
  const newItems = incomingItems.filter((item) => !existingKeys.has(favoriteItemKey(item)));
  const alreadyExistingItems = incomingItems.filter((item) => existingKeys.has(favoriteItemKey(item)));
  const preservedExistingItems = existingItems.filter((item) => !incomingKeys.has(favoriteItemKey(item)));

  return {
    incomingItems,
    existingItems,
    newItems,
    alreadyExistingItems,
    mergedItems: [...incomingItems, ...preservedExistingItems]
  };
}

function mergeFavoriteItemLists(incoming, existing = getValidFavoriteItems()) {
  return analyzeFavoriteItemMerge(incoming, existing).mergedItems;
}

function encodeBase64UrlUtf8(value) {
  const bytes = new TextEncoder().encode(String(value || ""));
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return window.btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function decodeBase64UrlUtf8(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = window.atob(`${normalized}${padding}`);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function canonicalizeFavoriteShareItems(items) {
  const normalized = normalizeFavoriteTransferItems(items).items.map(({ catalogId, page }) => ({ catalogId, page }));
  const catalogOrder = new Map(catalogs.map((catalog, index) => [String(catalog.id || ""), index]));
  return normalized.sort((a, b) => {
    const aIndex = catalogOrder.has(a.catalogId) ? catalogOrder.get(a.catalogId) : Number.MAX_SAFE_INTEGER;
    const bIndex = catalogOrder.has(b.catalogId) ? catalogOrder.get(b.catalogId) : Number.MAX_SAFE_INTEGER;
    if (aIndex !== bIndex) return aIndex - bIndex;
    const catalogCompare = a.catalogId.localeCompare(b.catalogId, "he");
    return catalogCompare || a.page - b.page;
  });
}

function encodeFavoritePageRanges(pages) {
  const sorted = [...new Set(pages.map((page) => Number.parseInt(page, 10)).filter((page) => Number.isFinite(page) && page > 0))]
    .sort((a, b) => a - b);
  const ranges = [];
  for (let index = 0; index < sorted.length;) {
    const start = sorted[index];
    let end = start;
    while (index + 1 < sorted.length && sorted[index + 1] === end + 1) {
      index += 1;
      end = sorted[index];
    }
    const encodedStart = start.toString(36);
    ranges.push(end === start ? encodedStart : `${encodedStart}-${end.toString(36)}`);
    index += 1;
  }
  return ranges.join(",");
}

function decodeFavoritePageRanges(value) {
  const pages = [];
  String(value || "").split(",").forEach((part) => {
    if (!part) return;
    const [rawStart, rawEnd = rawStart] = part.split("-", 2);
    const start = Number.parseInt(rawStart, 36);
    const end = Number.parseInt(rawEnd, 36);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 1 || end < start || end - start > 1000) return;
    for (let page = start; page <= end; page += 1) pages.push(page);
  });
  return pages;
}

function buildFavoritesShareToken(items) {
  const grouped = new Map();
  canonicalizeFavoriteShareItems(items).forEach(({ catalogId, page }) => {
    if (!grouped.has(catalogId)) grouped.set(catalogId, []);
    grouped.get(catalogId).push(page);
  });
  const payload = [...grouped.entries()]
    .map(([catalogId, pages]) => `${encodeURIComponent(catalogId)}~${encodeFavoritePageRanges(pages)}`)
    .join("|");
  return `v${FAVORITES_SHARE_VERSION}.${encodeBase64UrlUtf8(payload)}`;
}

function parseLegacyFavoritesShareToken(rawToken) {
  const prefix = `v${FAVORITES_SHARE_LEGACY_VERSION}.`;
  if (!rawToken.startsWith(prefix)) return { items: [], rejected: 0, valid: false };
  try {
    const payload = JSON.parse(decodeBase64UrlUtf8(rawToken.slice(prefix.length)));
    if (!payload || payload.v !== FAVORITES_SHARE_LEGACY_VERSION || !Array.isArray(payload.c) || !Array.isArray(payload.i)) {
      return { items: [], rejected: 0, valid: false };
    }
    const rawItems = payload.i.map((entry) => {
      if (!Array.isArray(entry) || entry.length < 2) return null;
      const catalogIndex = Number.parseInt(entry[0], 10);
      return { catalogId: payload.c[catalogIndex], page: entry[1], savedAt: 0 };
    });
    return { ...normalizeFavoriteTransferItems(rawItems), valid: true };
  } catch (_error) {
    return { items: [], rejected: 0, valid: false };
  }
}

function parseFavoritesShareToken(token) {
  const rawToken = String(token || "").trim();
  const prefix = `v${FAVORITES_SHARE_VERSION}.`;
  if (!rawToken.startsWith(prefix)) return parseLegacyFavoritesShareToken(rawToken);

  try {
    const payload = decodeBase64UrlUtf8(rawToken.slice(prefix.length));
    const rawItems = [];
    if (payload) {
      payload.split("|").forEach((group) => {
        const separatorIndex = group.indexOf("~");
        if (separatorIndex < 1) return;
        const catalogId = decodeURIComponent(group.slice(0, separatorIndex));
        decodeFavoritePageRanges(group.slice(separatorIndex + 1)).forEach((page) => {
          rawItems.push({ catalogId, page, savedAt: 0 });
        });
      });
    }
    const normalized = normalizeFavoriteTransferItems(rawItems);
    return { ...normalized, valid: true };
  } catch (_error) {
    return { items: [], rejected: 0, valid: false };
  }
}

function buildFavoritesShareUrl(items) {
  const url = new URL(favoritesDocumentUrl(), window.location.href);
  url.hash = "";
  url.searchParams.set(FAVORITES_SHARE_PARAM, buildFavoritesShareToken(items));
  return url.toString();
}

function cleanFavoritesSelectionFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(FAVORITES_SHARE_PARAM)) return;
  url.searchParams.delete(FAVORITES_SHARE_PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function syncFavoritesTransferDialogUi() {
  const pending = state.favoritesTransferPending;
  if (!pending || !els.favoritesTransferOverlay) return;
  const comparison = analyzeFavoriteItemMerge(pending.items, getValidFavoriteItems());
  const incomingCount = comparison.incomingItems.length;
  const currentCount = comparison.existingItems.length;
  const newCount = comparison.newItems.length;
  const alreadyExistingCount = comparison.alreadyExistingItems.length;
  if (els.favoritesTransferTitle) els.favoritesTransferTitle.textContent = "רשימת מועדפים התקבלה";
  if (els.favoritesTransferDescription) {
    els.favoritesTransferDescription.textContent = "הקישור כולל מועדפים ממחשב אחר. בחרו כיצד לשלב אותם עם הרשימה הקיימת.";
  }
  if (els.favoritesTransferSummary) {
    const rejectedText = pending.rejected ? ` · ${pending.rejected} פריטים לא היו זמינים באתר זה` : "";
    const existingLabel = alreadyExistingCount === 1 ? "קיים" : "קיימים";
    const newLabel = newCount === 1 ? "חדש" : "חדשים";
    const overlapText = alreadyExistingCount > 0
      ? `\nמתוכם ${alreadyExistingCount} ${existingLabel} ו-${newCount} ${newLabel}`
      : "";
    els.favoritesTransferSummary.textContent = `${incomingCount} פריטים ברשימה שהתקבלה · ${currentCount} פריטים שמורים כעת${rejectedText}${overlapText}`;
  }
}

function openFavoritesTransferDialog(transfer, returnFocus = document.activeElement) {
  if (!transfer?.items?.length || !els.favoritesTransferOverlay) return false;
  state.favoritesTransferPending = transfer;
  state.favoritesTransferReturnFocus = returnFocus;
  syncFavoritesTransferDialogUi();
  els.favoritesTransferOverlay.classList.remove("hidden");
  els.favoritesTransferOverlay.setAttribute("aria-hidden", "false");
  syncDocumentLock();
  requestAnimationFrame(() => els.favoritesTransferMerge?.focus());
  return true;
}

function closeFavoritesTransferDialog(options = {}) {
  const { restoreFocus = true, cleanUrl = false } = options;
  const returnFocus = state.favoritesTransferReturnFocus;
  state.favoritesTransferPending = null;
  state.favoritesTransferReturnFocus = null;
  els.favoritesTransferOverlay?.classList.add("hidden");
  els.favoritesTransferOverlay?.setAttribute("aria-hidden", "true");
  if (cleanUrl) cleanFavoritesSelectionFromUrl();
  syncDocumentLock();
  if (restoreFocus && returnFocus?.focus) returnFocus.focus();
}

function applyFavoritesTransfer(mode) {
  const pending = state.favoritesTransferPending;
  if (!pending?.items?.length || !favoritesStore) return;
  const timestamp = Date.now();
  const incoming = pending.items.map((item, index) => ({
    ...item,
    savedAt: Number(item.savedAt) > 0 ? Number(item.savedAt) : timestamp - index
  }));
  const comparison = analyzeFavoriteItemMerge(incoming, getValidFavoriteItems());
  const nextItems = mode === "merge"
    ? comparison.mergedItems
    : incoming;
  favoritesStore.replace(nextItems);
  closeFavoritesTransferDialog({ restoreFocus: false, cleanUrl: pending.source === "link" });
  syncFavoritesUi({ renderPanel: true });
  syncFavoriteViewerAfterStoreChange();
  const verb = mode === "merge" ? "מוזגה" : "נטענה";
  const rejectedText = pending.rejected ? ` · ${pending.rejected} לא היו זמינים` : "";
  const resultText = mode === "merge"
    ? `${comparison.newItems.length} חדשים · ${comparison.alreadyExistingItems.length} כבר היו שמורים`
    : `${incoming.length} פריטים`;
  showActionToast(`הרשימה ${verb}: ${resultText}${rejectedText}`, { tone: "saved", duration: 2800 });
  requestAnimationFrame(() => els.favoritesGrid?.querySelector(".favorite-card")?.focus?.());
}

function prepareIncomingFavoritesTransfer(transfer, options = {}) {
  const { returnFocus = document.activeElement } = options;
  if (!transfer?.valid || !transfer.items.length || !favoritesStore) return false;
  const currentItems = getValidFavoriteItems();
  if (!currentItems.length) {
    state.favoritesTransferPending = transfer;
    applyFavoritesTransfer("replace");
    return true;
  }
  return openFavoritesTransferDialog(transfer, returnFocus);
}

function processFavoritesSelectionFromUrl() {
  if (!isAppPage("favorites")) return;
  const url = new URL(window.location.href);
  const token = url.searchParams.get(FAVORITES_SHARE_PARAM);
  if (!token) return;
  const parsed = parseFavoritesShareToken(token);
  if (!parsed.valid || !parsed.items.length) {
    cleanFavoritesSelectionFromUrl();
    showActionToast("הקישור אינו מכיל רשימת בחירה תקינה");
    return;
  }
  prepareIncomingFavoritesTransfer({ ...parsed, source: "link" }, { returnFocus: els.favoritesShareButton });
}

function syncFavoritesShareButton(count = getFavoriteEntries().length) {
  if (!els.favoritesShareButton) return;
  const hasItems = count > 0;
  els.favoritesShareButton.disabled = !hasItems;
  els.favoritesShareButton.setAttribute("aria-label", hasItems
    ? `שיתוף רשימת המועדפים, ${count} עמודים שמורים`
    : "שיתוף רשימת המועדפים — אין עדיין עמודים שמורים");
}

async function shareFavoritesList() {
  const items = getFavoriteEntries().map(({ catalogId, catalog, page }) => ({
    catalogId: String(catalogId || catalog?.id || ""),
    page
  }));
  if (!items.length) return;
  const link = buildFavoritesShareUrl(items);

  if (isMobileShareEnvironment()) {
    try {
      await navigator.share({
        title: "המועדפים שלי",
        text: `${items.length} עמודים שמורים מתוך קטלוגי רהיטי ברגיג`,
        url: link
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await copyTextToClipboard(link);
    flashActionButton(els.favoritesShareButton, "הקישור הועתק");
    showActionToast("הקישור לרשימת המועדפים הועתק", { tone: "link" });
  } catch (_error) {
    window.prompt("אפשר להעתיק את הקישור מכאן:", link);
  }
}

function handleFavoritesTransferKeydown(event) {
  if (!state.favoritesTransferPending || !els.favoritesTransferOverlay) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeFavoritesTransferDialog({ cleanUrl: state.favoritesTransferPending?.source === "link" });
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = Array.from(els.favoritesTransferOverlay.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function isFavoritesLightboxMode() {
  return state.lightboxSource === LIGHTBOX_SOURCE_FAVORITES;
}

function findFavoriteEntryIndex(entries, catalogId, page) {
  const normalizedCatalogId = String(catalogId || "");
  const normalizedPage = Number.parseInt(page, 10);
  return entries.findIndex((entry) => (
    String(entry.catalog?.id || entry.catalogId || "") === normalizedCatalogId &&
    entry.page === normalizedPage
  ));
}

function setFavoriteViewerEntry(entries, index) {
  if (!entries.length) return false;
  const nextIndex = clampValue(Number.parseInt(index, 10) || 0, 0, entries.length - 1);
  const entry = entries[nextIndex];
  state.favoritesViewerIndex = nextIndex;
  state.catalog = entry.catalog;
  state.page = entry.page;
  return true;
}

function syncFavoriteViewerAfterStoreChange(options = {}) {
  if (!state.lightboxOpen || !isFavoritesLightboxMode()) return;

  const { preferredIndex = state.favoritesViewerIndex } = options;
  const entries = getFavoriteEntries();
  if (!entries.length) {
    closeLightbox({ restoreFavorites: true });
    return;
  }

  const currentIndex = findFavoriteEntryIndex(entries, state.catalog?.id, state.page);
  setFavoriteViewerEntry(entries, currentIndex >= 0 ? currentIndex : preferredIndex);
  renderLightboxPageRail();
  updateLightbox({ thumbScrollIntoView: true });
}

function syncViewerFavoriteButtonUi() {
  const button = els.viewerFavoriteButton;
  if (!button) return;
  const identity = favoriteIdentity();
  const isFavorite = Boolean(identity && favoritesStore?.has(identity));
  const label = isFavorite ? "הסרת העמוד מהמועדפים" : "הוספת העמוד למועדפים";
  button.dataset.favoriteActive = isFavorite ? "true" : "false";
  button.setAttribute("aria-pressed", isFavorite ? "true" : "false");
  button.setAttribute("aria-label", label);
  setTooltipText(button, label, { updateDefault: true });
  const hiddenLabel = button.querySelector(".visually-hidden");
  if (hiddenLabel) hiddenLabel.textContent = label;
}

function renderFavoritesPanel(entries = getFavoriteEntries()) {
  if (!els.favoritesGrid) return;
  const count = entries.length;
  if (els.favoritesCount) els.favoritesCount.textContent = String(count);
  els.favoritesClearButton?.classList.toggle("hidden", count === 0);
  els.favoritesEmpty?.classList.toggle("hidden", count !== 0);
  syncFavoritesShareButton(count);

  els.favoritesGrid.innerHTML = entries.map(({ catalog, page }) => {
    const identityCatalog = escapeHtml(catalog.id);
    const title = escapeHtml(catalog.title || "קטלוג");
    const image = pageSrc(catalog, page);
    return `
      <article class="favorite-card" data-favorite-catalog="${identityCatalog}" data-favorite-page="${page}">
        <button class="favorite-preview-button" type="button" data-open-favorite="1" aria-label="פתיחת ${title}, עמוד ${page}">
          <span class="favorite-image-frame catalog-image-frame"${pageAspectStyle(catalog, page)}>
            <img src="${escapeHtml(image)}" alt="${title} - עמוד ${page}" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(image)} />
          </span>
          <span class="favorite-card-meta">
            <strong>${title}</strong>
            <span>עמוד ${page}</span>
          </span>
        </button>
        <button class="favorite-remove-button" type="button" data-remove-favorite="1" aria-label="הסרת ${title}, עמוד ${page} מהמועדפים" title="הסרה מהמועדפים">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5" /></svg>
        </button>
      </article>
    `;
  }).join("");
}

function syncFavoritesShortcut(button, countElement, count) {
  if (countElement) countElement.textContent = String(count);
  if (!button) return;
  button.classList.toggle("hidden", count === 0);
  button.setAttribute("aria-label", `פתיחת מועדפים, ${count} עמודים שמורים`);
}

function syncFavoritesUi(options = {}) {
  const { renderPanel = state.favoritesOpen } = options;
  const entries = getFavoriteEntries();
  const count = entries.length;
  syncFavoritesShortcut(els.headerFavoritesButton, els.headerFavoritesCount, count);
  syncFavoritesShortcut(els.lightboxFavoritesButton, els.lightboxFavoritesCount, count);
  syncViewerFavoriteButtonUi();
  syncFavoritesShareButton(count);
  if (renderPanel) {
    renderFavoritesPanel(entries);
    if (state.favoritesOpen && entries.length === 0) {
      requestAnimationFrame(() => els.favoritesCloseButton?.focus());
    }
  }
}

function openFavoritesPanel(options = {}) {
  const { allowEmpty = false, captureReturnFocus = true } = options;
  const entries = getFavoriteEntries();

  if (!isAppPage("favorites")) {
    if (allowEmpty || entries.length) navigateTo(favoritesDocumentUrl());
    return;
  }

  if (!els.favoritesPanel || (!allowEmpty && !entries.length)) return;
  if (captureReturnFocus) state.favoritesReturnFocus = document.activeElement;
  state.favoritesOpen = true;
  renderFavoritesPanel(entries);
  els.favoritesPanel.classList.remove("hidden");
  els.favoritesPanel.classList.add("favorites-standalone-page");
  els.favoritesPanel.setAttribute("aria-hidden", "false");
  els.favoritesPanel.setAttribute("aria-modal", "false");
  syncDocumentLock();
  updateDocumentMetadata();
}

function hideFavoritesPanelUi(options = {}) {
  const { restoreFocus = false, preserveReturnFocus = false } = options;
  const returnFocus = state.favoritesReturnFocus;

  state.favoritesOpen = false;
  els.favoritesPanel?.classList.add("hidden");
  els.favoritesPanel?.classList.remove("favorites-standalone-page");
  els.favoritesPanel?.setAttribute("aria-hidden", "true");
  els.favoritesPanel?.setAttribute("aria-modal", "true");
  syncDocumentLock();

  if (restoreFocus && returnFocus?.focus) returnFocus.focus();
  if (!preserveReturnFocus) state.favoritesReturnFocus = null;
}

function closeFavoritesPanel(options = {}) {
  const { restoreFocus = true, preserveReturnFocus = false } = options;
  if (isAppPage("favorites")) {
    if ((hasInDocumentRouteSession || canReturnToSameSite()) && window.history.length > 1) navigateBack();
    else navigateTo(homeDocumentUrl(), { replace: true });
    return;
  }
  if (!state.favoritesOpen) return;
  hideFavoritesPanelUi({ restoreFocus, preserveReturnFocus });
}

function openFavoriteViewer(catalogId, page) {
  const entries = getFavoriteEntries();
  const index = findFavoriteEntryIndex(entries, catalogId, page);
  if (index < 0) return;

  if (!isAppPage("viewer")) {
    navigateTo(viewerDocumentUrl(catalogId, page, { source: LIGHTBOX_SOURCE_FAVORITES }));
    return;
  }

  state.favoritesViewerOpeningHash = window.location.href;
  state.favoritesViewerPreviousCatalog = state.catalog;
  state.favoritesViewerPreviousPage = state.page;
  setFavoriteViewerEntry(entries, index);
  openLightbox(state.page, {
    source: LIGHTBOX_SOURCE_FAVORITES,
    favoriteIndex: index
  });
}

function toggleCurrentPageFavorite() {
  const identity = favoriteIdentity();
  if (!identity || !favoritesStore) return;
  const previousFavoriteIndex = state.favoritesViewerIndex;
  const added = favoritesStore.toggle({ ...identity, savedAt: Date.now() });
  telemetryTrackFavorite(added ? "add" : "remove", identity.catalogId, identity.page, getFavoriteEntries().length);
  syncFavoritesUi({ renderPanel: true });
  if (isFavoritesLightboxMode() && !added) {
    syncFavoriteViewerAfterStoreChange({ preferredIndex: previousFavoriteIndex });
  }
  if (state.lightboxOpen) {
    const feedback = added ? "נשמר" : "הוסר";
    flashActionButton(els.viewerFavoriteButton, feedback);
    showActionToast(feedback, { tone: added ? "saved" : "removed" });
  }
}

function removeFavorite(catalogId, page) {
  if (!favoritesStore) return;
  const removed = favoritesStore.remove({ catalogId, page });
  if (removed !== false) telemetryTrackFavorite("remove", catalogId, page, getFavoriteEntries().length);
  syncFavoritesUi({ renderPanel: true });
  if (removed !== false) showActionToast("הוסר", { tone: "removed" });
}

function clearAllFavorites() {
  if (!favoritesStore || !getFavoriteEntries().length) return;
  if (!window.confirm("למחוק את כל העמודים מהמועדפים?")) return;
  favoritesStore.clear();
  telemetryTrackFavorite("clear", "", 0, 0);
  syncFavoritesUi({ renderPanel: true });
  showActionToast("כל המועדפים הוסרו", { tone: "removed" });
}

function handleFavoritesGridClick(event) {
  const card = event.target.closest?.("[data-favorite-catalog][data-favorite-page]");
  if (!card || !els.favoritesGrid?.contains(card)) return;
  const catalogId = card.dataset.favoriteCatalog;
  const page = Number.parseInt(card.dataset.favoritePage, 10);
  if (event.target.closest?.("[data-remove-favorite]")) {
    removeFavorite(catalogId, page);
    return;
  }
  if (event.target.closest?.("[data-open-favorite]")) openFavoriteViewer(catalogId, page);
}

function handleFavoritesStorageChange(event) {
  if (!favoritesStore || (event.key !== null && event.key !== favoritesStore.storageKey)) return;
  favoritesStore.reload();
  syncFavoritesUi({ renderPanel: true });
  if (state.favoritesTransferPending) syncFavoritesTransferDialogUi();
  syncFavoriteViewerAfterStoreChange();
}

function handleFavoritesPanelKeydown(event) {
  if (!state.favoritesOpen || event.key !== "Tab" || !els.favoritesPanel) return;
  const focusable = Array.from(els.favoritesPanel.querySelectorAll(
    'button:not([disabled]):not(.hidden), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => !element.closest?.(".hidden"));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function currentVisibleDocumentUrl() {
  return window.location.href;
}

async function copyTextToClipboard(value) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.top = "-1000px";
  document.body.appendChild(input);
  input.select();
  document.execCommand("copy");
  input.remove();
}

function downloadCurrentLightboxImage() {
  if (!state.catalog) return;
  downloadCatalogPageSnapshot(state.catalog, state.page, els.lightboxScreenshot);
}

function isMobileShareEnvironment() {
  if (typeof navigator.share !== "function") return false;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  const iPadDesktopMode = navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1;
  const userAgentDataMobile = navigator.userAgentData?.mobile === true;
  return Boolean(mobileUserAgent || iPadDesktopMode || userAgentDataMobile);
}

function currentShareLabel() {
  if (state.catalog && isAppPage("viewer")) return `${state.catalog.title} · עמוד ${state.page}`;
  if (state.catalog && isAppPage("catalog")) return state.catalog.title;
  if (isAppPage("favorites")) return "המועדפים שלי · רהיטי ברגיג";
  return "קטלוגי רהיטי ברגיג";
}

async function shareOrCopyCurrentLink(button) {
  const link = currentVisibleDocumentUrl();

  if (isMobileShareEnvironment()) {
    try {
      await navigator.share({
        title: document.title,
        text: currentShareLabel(),
        url: link
      });
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }

  try {
    await copyTextToClipboard(link);
    flashActionButton(button, "הקישור הועתק");
    showActionToast("הקישור הועתק", { tone: "link" });
  } catch (_error) {
    showActionToast("לא ניתן להעתיק אוטומטית — אפשר להעתיק מהחלון שנפתח");
    window.prompt("אפשר להעתיק את הקישור מכאן:", link);
  }
}

async function shareCurrentMainHeaderLink() {
  await shareOrCopyCurrentLink(els.headerCopyLink);
}

async function shareCurrentLightboxLink() {
  await shareOrCopyCurrentLink(els.lightboxCopyLink);
}

function attachFavoritesShareEvents() {
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

  window.addEventListener("storage", handleFavoritesStorageChange);
}
