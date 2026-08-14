/**
 * Source module: 30-favorites-share.js
 * Favorites storage integration, portable selection links, favorites panels, and link sharing.
 *
 * Runtime dependencies are explicit ES module imports. Route entrypoints are
 * bundled by the pinned esbuild tool into stable browser asset names.
 */

/** @import { DialogCloseOptions, FavoriteEntry, FavoriteItem, FavoriteMutationResult, FavoriteViewerSyncOptions, FavoritesPanelCloseOptions, FavoritesPanelOpenOptions, FavoritesSyncOptions, FavoritesTransfer, FavoritesTransferPrepareOptions } from "../../types/frontend-contracts.js" */

import { normalizeItems as normalizeFavoriteItems } from "../runtime/favorites-store.js";
import { canReturnToSameSite, favoritesDocumentUrl, hasInDocumentRouteSession, homeDocumentUrl, isAppPage, navigateBack, navigateTo, updateDocumentMetadata, viewerDocumentUrl } from "./00-navigation.js";
import { catalogs } from "./03-runtime-context.js";
import { isCatalogPage } from "./06-catalog-page-numbering.js";
import { bindFeatureEventsOnce, getFeatureInterface, registerFeatureInterface } from "./10-app-state.js";
import { LIGHTBOX_SOURCE_CATALOG, LIGHTBOX_SOURCE_FAVORITES } from "./11-navigation-state.js";
import { FAVORITES_SHARE_PARAM, FAVORITES_SHARE_VERSION, favoritesElements, favoritesState, favoritesStore } from "./14-favorites-state.js";
import { telemetryTrackFavorite } from "./15-telemetry.js";
import { activeCatalog, activePage, activeViewerSource, setActiveLocation } from "./18-navigation-feature.js";
import { clampPage, findCatalogById } from "./20-catalog-runtime.js";
import { clampValue } from "./19-shared-pure.js";
import { flashActionButton, focusHtmlElement, isHtmlElement, setTooltipText, showActionToast, syncDocumentLock } from "./21-ui-runtime.js";
import { eventTargetElement } from "./02-dom-contracts.js";
import { createFavoritesPortabilityDomain } from "./29-favorites-portability.js";

function favoriteIdentity(catalog = activeCatalog(), page = activePage()) {
  if (!catalog) return null;
  return {
    catalogId: String(catalog.id || ""),
    page: clampPage(page, catalog)
  };
}

/** @returns {FavoriteEntry[]} */
function getFavoriteEntries() {
  if (!favoritesStore) return [];
  return favoritesStore.read().flatMap((item) => {
    const catalog = findCatalogById(item.catalogId);
    const page = Number.parseInt(String(item.page), 10);
    if (!catalog || !isCatalogPage(catalog, page)) return [];
    return [{ ...item, catalog, page }];
  });
}

/**
 * Display truthful persistence feedback. Favorites continue to work in memory
 * when browser storage is unavailable, but the UI must never describe that
 * fallback as a durable save.
 *
 * @param {FavoriteMutationResult|null|undefined} result
 * @param {{persisted:string, temporary:string, tone?:string, duration?:number}} messages
 * @returns {boolean}
 */
function showFavoritePersistenceFeedback(result, messages) {
  const persisted = result?.persisted !== false;
  showActionToast(persisted ? messages.persisted : messages.temporary, {
    tone: persisted ? (messages.tone || "saved") : "warning",
    duration: persisted ? (messages.duration || 1300) : 4600
  });
  return persisted;
}

/** @param {FavoriteMutationResult|null|undefined} result */
function warnIfFavoriteChangeIsTemporary(result) {
  if (!result?.changed || result.persisted !== false) return;
  showActionToast("השינוי נשמר זמנית בלבד — אחסון המועדפים חסום בדפדפן", {
    tone: "warning",
    duration: 4600
  });
}


/** @returns {FavoriteItem[]} */
function getValidFavoriteItems() {
  return getFavoriteEntries().map(({ catalogId, catalog, page, savedAt, note }) => {
    /** @type {FavoriteItem} */
    const item = {
      catalogId: String(catalogId || catalog?.id || ""),
      page,
      savedAt: Number(savedAt) > 0 ? Number(savedAt) : 0
    };
    if (String(note || "").trim()) item.note = String(note).trim();
    return item;
  });
}

const favoritesPortabilityDomain = createFavoritesPortabilityDomain({
  normalizeItems: normalizeFavoriteItems,
  findCatalogById,
  catalogs: () => catalogs,
  encodeBase64: (value) => window.btoa(value),
  decodeBase64: (value) => window.atob(value),
  shareVersion: FAVORITES_SHARE_VERSION
});

/** @param {unknown} items */
function buildFavoritesShareUrl(items) {
  const url = new URL(favoritesDocumentUrl(), window.location.href);
  url.hash = "";
  url.searchParams.set(FAVORITES_SHARE_PARAM, favoritesPortabilityDomain.buildFavoritesShareToken(items));
  return url.toString();
}

function cleanFavoritesSelectionFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(FAVORITES_SHARE_PARAM)) return;
  url.searchParams.delete(FAVORITES_SHARE_PARAM);
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
}

function syncFavoritesTransferDialogUi() {
  const pending = favoritesState.favoritesTransferPending;
  if (!pending || !favoritesElements.favoritesTransferOverlay) return;
  const existingItems = getValidFavoriteItems();
  if (favoritesElements.favoritesTransferTitle) favoritesElements.favoritesTransferTitle.textContent = "רשימת מועדפים התקבלה";
  if (favoritesElements.favoritesTransferDescription) {
    favoritesElements.favoritesTransferDescription.textContent = "הקישור כולל מועדפים ממחשב אחר. בחרו כיצד לשלב אותם עם הרשימה הקיימת.";
  }
  if (favoritesElements.favoritesTransferSummary) {
    favoritesElements.favoritesTransferSummary.textContent = favoritesPortabilityDomain.favoritesTransferSummary(
      pending,
      existingItems
    );
  }
}

/** @param {FavoritesTransfer} transfer @param {HTMLElement|null} [returnFocus] */
function openFavoritesTransferDialog(transfer, returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null) {
  if (!transfer?.items?.length || !favoritesElements.favoritesTransferOverlay) return false;
  favoritesState.favoritesTransferPending = transfer;
  favoritesState.favoritesTransferReturnFocus = returnFocus;
  syncFavoritesTransferDialogUi();
  favoritesElements.favoritesTransferOverlay.classList.remove("hidden");
  favoritesElements.favoritesTransferOverlay.setAttribute("aria-hidden", "false");
  syncDocumentLock();
  requestAnimationFrame(() => favoritesElements.favoritesTransferMerge?.focus());
  return true;
}

/** @param {DialogCloseOptions} [options] */
function closeFavoritesTransferDialog(options = {}) {
  const { restoreFocus = true, cleanUrl = false } = options;
  const returnFocus = favoritesState.favoritesTransferReturnFocus;
  favoritesState.favoritesTransferPending = null;
  favoritesState.favoritesTransferReturnFocus = null;
  favoritesElements.favoritesTransferOverlay?.classList.add("hidden");
  favoritesElements.favoritesTransferOverlay?.setAttribute("aria-hidden", "true");
  if (cleanUrl) cleanFavoritesSelectionFromUrl();
  syncDocumentLock();
  if (restoreFocus) focusHtmlElement(returnFocus);
}

/** @param {"merge"|"replace"} mode */
function applyFavoritesTransfer(mode) {
  const pending = favoritesState.favoritesTransferPending;
  if (!pending?.items?.length || !favoritesStore) return;
  const timestamp = Date.now();
  const incoming = pending.items.map((item, index) => ({
    ...item,
    savedAt: Number(item.savedAt) > 0 ? Number(item.savedAt) : timestamp - index
  }));
  const comparison = favoritesPortabilityDomain.analyzeFavoriteItemMerge(incoming, getValidFavoriteItems());
  const nextItems = mode === "merge"
    ? comparison.mergedItems
    : incoming;
  const mutation = favoritesStore.replaceDetailed(nextItems);
  closeFavoritesTransferDialog({ restoreFocus: false, cleanUrl: pending.source === "link" });
  syncFavoritesUi({ renderPanel: true });
  syncFavoriteViewerAfterStoreChange();
  const verb = mode === "merge" ? "מוזגה" : "נטענה";
  const rejectedText = pending.rejected ? ` · ${pending.rejected} לא היו זמינים` : "";
  const resultText = mode === "merge"
    ? `${comparison.newItems.length} חדשים · ${comparison.alreadyExistingItems.length} כבר היו שמורים`
    : `${incoming.length} פריטים`;
  showFavoritePersistenceFeedback(mutation, {
    persisted: `הרשימה ${verb}: ${resultText}${rejectedText}`,
    temporary: `הרשימה ${verb} זמנית בלבד: ${resultText}${rejectedText} — האחסון חסום`,
    tone: "saved",
    duration: 2800
  });
  requestAnimationFrame(() => focusHtmlElement(favoritesElements.favoritesGrid.querySelector(".favorite-card")));
}

/** @param {FavoritesTransfer} transfer @param {FavoritesTransferPrepareOptions} [options] */
function prepareIncomingFavoritesTransfer(transfer, options = {}) {
  const { returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null } = options;
  if (!transfer?.valid || !transfer.items.length || !favoritesStore) return false;
  const currentItems = getValidFavoriteItems();
  if (!currentItems.length) {
    favoritesState.favoritesTransferPending = transfer;
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
  const parsed = favoritesPortabilityDomain.parseFavoritesShareToken(token);
  if (!parsed.valid || !parsed.items.length) {
    cleanFavoritesSelectionFromUrl();
    showActionToast("הקישור אינו מכיל רשימת בחירה תקינה");
    return;
  }
  prepareIncomingFavoritesTransfer({ ...parsed, source: "link" }, { returnFocus: favoritesElements.favoritesShareButton });
}

function syncFavoritesShareButton(count = getFavoriteEntries().length) {
  if (!favoritesElements.favoritesShareButton) return;
  const hasItems = count > 0;
  favoritesElements.favoritesShareButton.disabled = !hasItems;
  favoritesElements.favoritesShareButton.setAttribute("aria-label", hasItems
    ? `העתקת קישור לרשימת המועדפים, ${count} עמודים שמורים`
    : "העתקת קישור לרשימת המועדפים — אין עדיין עמודים שמורים");
}

async function shareFavoritesList() {
  const workspace = getFeatureInterface("favorites-workspace");
  if (!workspace?.copyShareLink || !workspace?.shareLinkEntries) return;
  await workspace.copyShareLink(
    workspace.shareLinkEntries(),
    favoritesElements.favoritesShareButton
  );
}

/** @param {KeyboardEvent} event */
function handleFavoritesTransferKeydown(event) {
  if (!favoritesState.favoritesTransferPending || !favoritesElements.favoritesTransferOverlay) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeFavoritesTransferDialog({ cleanUrl: favoritesState.favoritesTransferPending?.source === "link" });
    return;
  }
  if (event.key !== "Tab") return;
  const focusable = Array.from(favoritesElements.favoritesTransferOverlay.querySelectorAll('button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')).filter((element) => element instanceof HTMLElement);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    focusHtmlElement(last);
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    focusHtmlElement(first);
  }
}

function isFavoritesLightboxMode() {
  return activeViewerSource() === LIGHTBOX_SOURCE_FAVORITES;
}

/** @param {FavoriteEntry[]} entries @param {unknown} catalogId @param {unknown} page */
function findFavoriteEntryIndex(entries, catalogId, page) {
  const normalizedCatalogId = String(catalogId || "");
  const normalizedPage = Number.parseInt(String(page), 10);
  return entries.findIndex((entry) => (
    String(entry.catalog?.id || entry.catalogId || "") === normalizedCatalogId &&
    entry.page === normalizedPage
  ));
}

/** @param {FavoriteEntry[]} entries @param {number} index */
function setFavoriteViewerEntry(entries, index) {
  if (!entries.length) return false;
  const nextIndex = clampValue(Number.parseInt(String(index), 10) || 0, 0, entries.length - 1);
  const entry = entries[nextIndex];
  favoritesState.favoritesViewerIndex = nextIndex;
  setActiveLocation(entry.catalog, entry.page, activeViewerSource());
  return true;
}

/** @param {FavoriteViewerSyncOptions} [options] */
function syncFavoriteViewerAfterStoreChange(options = {}) {
  const viewer = getFeatureInterface("viewer");
  if (!viewer?.isViewerOpen?.() || !isFavoritesLightboxMode()) return;

  const { preferredIndex = favoritesState.favoritesViewerIndex } = options;
  const entries = getFavoriteEntries();
  if (!entries.length) {
    viewer.close?.({ restoreFavorites: true });
    return;
  }

  const currentIndex = findFavoriteEntryIndex(entries, activeCatalog()?.id, activePage());
  setFavoriteViewerEntry(entries, currentIndex >= 0 ? currentIndex : preferredIndex);
  viewer.renderPageRail?.();
  viewer.refresh?.({ thumbScrollIntoView: true });
}

/** @param {boolean} favoritesMode */
function syncFavoritesViewerModeUi(favoritesMode) {
  const button = favoritesElements.favoriteOpenCatalogButton;
  button.classList.toggle("hidden", !favoritesMode);
  button.setAttribute("aria-hidden", favoritesMode ? "false" : "true");
  button.setAttribute("tabindex", favoritesMode ? "0" : "-1");
}

/** @param {boolean} open @param {HTMLElement|null} [activeTrigger] */
function syncFavoritesInquiryTriggerState(open, activeTrigger = null) {
  const button = favoritesElements.favoritesInquiryButton;
  button.setAttribute("aria-expanded", open && button === activeTrigger ? "true" : "false");
}

function openCurrentFavoriteInCatalogFromViewer() {
  const catalog = activeCatalog();
  const viewer = getFeatureInterface("viewer");
  if (!catalog || !viewer?.isViewerOpen() || !isFavoritesLightboxMode()) return;
  viewer.openCatalog(catalog.id, activePage(), { source: LIGHTBOX_SOURCE_CATALOG });
}

function syncViewerFavoriteButtonUi() {
  const button = favoritesElements.viewerFavoriteButton;
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
  getFeatureInterface("favorites-workspace")?.render?.(entries);
}

/** @param {HTMLElement|null|undefined} button @param {HTMLElement|null|undefined} countElement @param {number} count */
function syncFavoritesShortcut(button, countElement, count) {
  if (countElement) countElement.textContent = String(count);
  if (!button) return;
  button.classList.toggle("hidden", count === 0);
  button.setAttribute("aria-label", `פתיחת מועדפים, ${count} עמודים שמורים`);
}

/** @param {FavoritesSyncOptions} [options] */
function syncFavoritesUi(options = {}) {
  const { renderPanel = favoritesState.favoritesOpen } = options;
  const entries = getFavoriteEntries();
  getFeatureInterface("favorites-workspace")?.prune?.(entries);
  const count = entries.length;
  syncFavoritesShortcut(favoritesElements.headerFavoritesButton, favoritesElements.headerFavoritesCount, count);
  syncFavoritesShortcut(favoritesElements.lightboxFavoritesButton, favoritesElements.lightboxFavoritesCount, count);
  favoritesElements.lightboxFavoritesSeparator?.classList.toggle("hidden", count === 0);
  favoritesElements.lightboxFavoritesSeparator?.setAttribute("aria-hidden", count === 0 ? "true" : "false");
  syncViewerFavoriteButtonUi();
  syncFavoritesShareButton(count);
  if (renderPanel) {
    renderFavoritesPanel(entries);
    if (favoritesState.favoritesOpen && entries.length === 0) {
      requestAnimationFrame(() => favoritesElements.favoritesCloseButton?.focus());
    }
  }
}

/** @param {FavoritesPanelOpenOptions} [options] */
function openFavoritesPanel(options = {}) {
  const { allowEmpty = false, captureReturnFocus = true } = options;
  const entries = getFavoriteEntries();

  if (!isAppPage("favorites")) {
    if (allowEmpty || entries.length) navigateTo(favoritesDocumentUrl());
    return;
  }

  if (!favoritesElements.favoritesPanel || (!allowEmpty && !entries.length)) return;
  if (captureReturnFocus) favoritesState.favoritesReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  favoritesState.favoritesOpen = true;
  renderFavoritesPanel(entries);
  favoritesElements.favoritesPanel.classList.remove("hidden");
  favoritesElements.favoritesPanel.classList.add("favorites-standalone-page");
  favoritesElements.favoritesPanel.setAttribute("aria-hidden", "false");
  favoritesElements.favoritesPanel.setAttribute("aria-modal", "false");
  syncDocumentLock();
  updateDocumentMetadata();
}

/** @param {FavoritesPanelCloseOptions} [options] */
function hideFavoritesPanelUi(options = {}) {
  const { restoreFocus = false, preserveReturnFocus = false } = options;
  const returnFocus = favoritesState.favoritesReturnFocus;

  favoritesState.favoritesOpen = false;
  favoritesElements.favoritesPanel?.classList.add("hidden");
  favoritesElements.favoritesPanel?.classList.remove("favorites-standalone-page");
  favoritesElements.favoritesPanel?.setAttribute("aria-hidden", "true");
  favoritesElements.favoritesPanel?.setAttribute("aria-modal", "true");
  syncDocumentLock();

  if (restoreFocus) focusHtmlElement(returnFocus);
  if (!preserveReturnFocus) favoritesState.favoritesReturnFocus = null;
}

/** @param {FavoritesPanelCloseOptions} [options] */
function closeFavoritesPanel(options = {}) {
  const { restoreFocus = true, preserveReturnFocus = false } = options;
  if (isAppPage("favorites")) {
    if ((hasInDocumentRouteSession || canReturnToSameSite()) && window.history.length > 1) navigateBack();
    else navigateTo(homeDocumentUrl(), { replace: true });
    return;
  }
  if (!favoritesState.favoritesOpen) return;
  hideFavoritesPanelUi({ restoreFocus, preserveReturnFocus });
}

/** @param {string} catalogId @param {number} page */
function openFavoriteViewer(catalogId, page) {
  const entries = getFavoriteEntries();
  const index = findFavoriteEntryIndex(entries, catalogId, page);
  if (index < 0) return;

  if (!isAppPage("viewer")) {
    navigateTo(viewerDocumentUrl(catalogId, page, { source: LIGHTBOX_SOURCE_FAVORITES }));
    return;
  }

  favoritesState.favoritesViewerOpeningHash = window.location.href;
  favoritesState.favoritesViewerPreviousCatalog = activeCatalog();
  favoritesState.favoritesViewerPreviousPage = activePage();
  setFavoriteViewerEntry(entries, index);
  getFeatureInterface("viewer")?.openCatalog?.(catalogId, page, {
    source: LIGHTBOX_SOURCE_FAVORITES,
    favoriteIndex: index
  });
}

function toggleCurrentPageFavorite() {
  const identity = favoriteIdentity();
  if (!identity || !favoritesStore) return;
  const previousFavoriteIndex = favoritesState.favoritesViewerIndex;
  const mutation = favoritesStore.toggleDetailed({ ...identity, savedAt: Date.now() });
  if (!mutation.changed) return;
  const added = mutation.active === true;
  telemetryTrackFavorite(added ? "add" : "remove", identity.catalogId, identity.page, getFavoriteEntries().length);
  syncFavoritesUi({ renderPanel: true });
  if (isFavoritesLightboxMode() && !added) {
    syncFavoriteViewerAfterStoreChange({ preferredIndex: previousFavoriteIndex });
  }
  if (getFeatureInterface("viewer")?.isViewerOpen?.()) {
    flashActionButton(favoritesElements.viewerFavoriteButton, mutation.persisted === false ? "זמני" : (added ? "נשמר" : "הוסר"));
    showFavoritePersistenceFeedback(mutation, added ? {
      persisted: "נשמר במועדפים",
      temporary: "נשמר זמנית בלבד — אחסון המועדפים חסום בדפדפן",
      tone: "saved"
    } : {
      persisted: "הוסר מהמועדפים",
      temporary: "הוסר מהרשימה הזמנית בלבד — השינוי לא יישמר לאחר רענון",
      tone: "removed"
    });
  }
}

/** @param {string} catalogId @param {number} page */
function removeFavorite(catalogId, page) {
  if (!favoritesStore) return;
  const mutation = favoritesStore.removeDetailed({ catalogId, page });
  if (mutation.changed) {
    favoritesState.favoritesSelectedKeys.delete(favoritesPortabilityDomain.favoriteItemKey({ catalogId, page }));
    telemetryTrackFavorite("remove", catalogId, page, getFavoriteEntries().length);
  }
  syncFavoritesUi({ renderPanel: true });
  if (mutation.changed) showFavoritePersistenceFeedback(mutation, {
    persisted: "הוסר מהמועדפים",
    temporary: "הוסר מהרשימה הזמנית בלבד — השינוי לא יישמר לאחר רענון",
    tone: "removed"
  });
}

function clearAllFavorites() {
  if (!favoritesStore || !getFavoriteEntries().length) return;
  if (!window.confirm("למחוק את כל העמודים מהמועדפים?")) return;
  const mutation = favoritesStore.clearDetailed();
  if (!mutation.changed) return;
  favoritesState.favoritesSelectedKeys.clear();
  favoritesState.favoritesFilterCatalogId = "";
  telemetryTrackFavorite("clear", "", 0, 0);
  syncFavoritesUi({ renderPanel: true });
  showFavoritePersistenceFeedback(mutation, {
    persisted: "כל המועדפים הוסרו",
    temporary: "המועדפים הוסרו זמנית בלבד — הרשימה תחזור לאחר רענון",
    tone: "removed"
  });
}

/** @param {Event} event */
function handleFavoritesGridClick(event) {
  if (getFeatureInterface("favorites-workspace")?.handleGridClick(event)) return;
  const target = eventTargetElement(event.target);
  const card = target?.closest("[data-favorite-catalog][data-favorite-page]");
  if (!(card instanceof HTMLElement) || !favoritesElements.favoritesGrid?.contains(card)) return;
  const catalogId = String(card.dataset.favoriteCatalog || "");
  const page = Number.parseInt(String(card.dataset.favoritePage || ""), 10);
  if (target?.closest("[data-remove-favorite]")) {
    removeFavorite(catalogId, page);
    return;
  }
  if (target?.closest("[data-open-favorite]")) openFavoriteViewer(catalogId, page);
}

/** @param {StorageEvent} event */
function handleFavoritesStorageChange(event) {
  if (!favoritesStore || (event.key !== null && event.key !== favoritesStore.storageKey)) return;
  favoritesStore.reload();
  getFeatureInterface("favorites-workspace")?.prune?.(getFavoriteEntries());
  syncFavoritesUi({ renderPanel: true });
  if (favoritesState.favoritesTransferPending) syncFavoritesTransferDialogUi();
  syncFavoriteViewerAfterStoreChange();
}

/** @param {KeyboardEvent} event */
function handleFavoritesPanelKeydown(event) {
  if (!favoritesState.favoritesOpen || event.key !== "Tab" || !favoritesElements.favoritesPanel) return;
  const focusable = Array.from(favoritesElements.favoritesPanel.querySelectorAll(
    'button:not([disabled]):not(.hidden), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((element) => isHtmlElement(element) && !element.closest(".hidden"));
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    focusHtmlElement(last);
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    focusHtmlElement(first);
  }
}

function currentVisibleDocumentUrl() {
  return window.location.href;
}

/** @param {string} value */
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

function isMobileShareEnvironment() {
  if (typeof navigator.share !== "function") return false;
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || "");
  const iPadDesktopMode = navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1;
  const userAgentDataMobile = navigator.userAgentData?.mobile === true;
  return Boolean(mobileUserAgent || iPadDesktopMode || userAgentDataMobile);
}

function currentShareLabel() {
  const catalog = activeCatalog();
  if (catalog && isAppPage("viewer")) return `${catalog.title} · עמוד ${activePage()}`;
  if (catalog && isAppPage("catalog")) return catalog.title;
  if (isAppPage("favorites")) return "המועדפים שלי · רהיטי ברגיג";
  return "קטלוגי רהיטי ברגיג";
}

/** @param {Element|null|undefined} button */
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
      if (error instanceof DOMException && error.name === "AbortError") return;
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
  await shareOrCopyCurrentLink(favoritesElements.headerCopyLink);
}

function attachFavoritesShareEvents() {
  favoritesElements.headerCopyLink.addEventListener("click", () => shareCurrentMainHeaderLink());
  favoritesElements.viewerFavoriteButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleCurrentPageFavorite();
  });
  favoritesElements.viewerFavoriteButton.addEventListener("pointerdown", (event) => event.stopPropagation());
  favoritesElements.favoriteOpenCatalogButton.addEventListener("click", openCurrentFavoriteInCatalogFromViewer);
  favoritesElements.viewerMobileFavoritesLink.href = favoritesDocumentUrl();
  favoritesElements.viewerMobileFavoritesLink.addEventListener("click", () => {
    getFeatureInterface("viewer")?.closeMobileMoreMenu();
  });
  favoritesElements.favoritesBackdrop?.addEventListener("click", () => closeFavoritesPanel());
  favoritesElements.favoritesCloseButton?.addEventListener("click", () => closeFavoritesPanel());
  favoritesElements.favoritesClearButton?.addEventListener("click", clearAllFavorites);
  favoritesElements.favoritesShareButton?.addEventListener("click", () => shareFavoritesList());
  favoritesElements.favoritesGrid?.addEventListener("click", handleFavoritesGridClick);
  const workspace = getFeatureInterface("favorites-workspace");
  if (workspace?.attachEvents) {
    bindFeatureEventsOnce("favorites-workspace", workspace.attachEvents);
  }
  favoritesElements.favoritesPanel?.addEventListener("keydown", handleFavoritesPanelKeydown);
  favoritesElements.favoritesTransferBackdrop?.addEventListener("click", () => closeFavoritesTransferDialog({ cleanUrl: favoritesState.favoritesTransferPending?.source === "link" }));
  favoritesElements.favoritesTransferCancel?.addEventListener("click", () => closeFavoritesTransferDialog({ cleanUrl: favoritesState.favoritesTransferPending?.source === "link" }));
  favoritesElements.favoritesTransferMerge?.addEventListener("click", () => applyFavoritesTransfer("merge"));
  favoritesElements.favoritesTransferReplace?.addEventListener("click", () => applyFavoritesTransfer("replace"));
  favoritesElements.favoritesTransferOverlay?.addEventListener("keydown", handleFavoritesTransferKeydown);

  window.addEventListener("storage", handleFavoritesStorageChange);
}

registerFeatureInterface("favorites", {
  escapePriority: 500,
  requiresDocumentLock: () => Boolean(
    (favoritesState.favoritesOpen && !isAppPage("favorites")) ||
    favoritesState.favoritesTransferPending ||
    favoritesState.favoriteNoteEditingKey
  ),
  attachEvents: attachFavoritesShareEvents,
  entries: getFavoriteEntries,
  viewerIndex: () => favoritesState.favoritesViewerIndex,
  setViewerIndex: (index) => {
    favoritesState.favoritesViewerIndex = Math.max(0, Number.parseInt(String(index), 10) || 0);
  },
  findViewerEntryIndex: findFavoriteEntryIndex,
  selectViewerEntry: setFavoriteViewerEntry,
  resetViewerSession: () => {
    favoritesState.favoritesViewerIndex = 0;
    favoritesState.favoritesViewerOpeningHash = "";
    favoritesState.favoritesViewerPreviousCatalog = null;
    favoritesState.favoritesViewerPreviousPage = 1;
    favoritesState.favoritesReturnFocus = null;
  },
  syncViewerButton: syncViewerFavoriteButtonUi,
  syncViewerMode: syncFavoritesViewerModeUi,
  syncInquiryTrigger: syncFavoritesInquiryTriggerState,
  onboardingTarget: () => favoritesElements.viewerFavoriteButton,
  prepareRoute: (nextPage) => {
    if (nextPage !== "favorites" && favoritesState.favoritesTransferPending) {
      closeFavoritesTransferDialog({ restoreFocus: false, cleanUrl: true });
    }
    if (nextPage !== "favorites" && favoritesState.favoriteNoteEditingKey) {
      getFeatureInterface("favorites-workspace")?.closeNoteEditor({ restoreFocus: false });
    }
    if (nextPage !== "favorites" && (favoritesState.favoritesOpen || favoritesElements.favoritesPanel.classList.contains("favorites-standalone-page"))) {
      hideFavoritesPanelUi();
    }
  },
  syncUi: () => syncFavoritesUi({ renderPanel: isAppPage("favorites") }),
  openRoute: () => {
    openFavoritesPanel({ allowEmpty: true, captureReturnFocus: false });
    processFavoritesSelectionFromUrl();
  },
  isPanelOpen: () => favoritesState.favoritesOpen,
  closeTopLayer: () => {
    if (favoritesState.favoriteNoteEditingKey) {
      getFeatureInterface("favorites-workspace")?.closeNoteEditor?.();
      return true;
    }
    if (favoritesState.favoritesTransferPending) {
      closeFavoritesTransferDialog({
        cleanUrl: favoritesState.favoritesTransferPending?.source === "link"
      });
      return true;
    }
    if (favoritesState.favoritesOpen) {
      closeFavoritesPanel();
      return true;
    }
    return false;
  }
});

export { buildFavoritesShareUrl, copyTextToClipboard, favoritesPortabilityDomain, getFavoriteEntries, isFavoritesLightboxMode, shareOrCopyCurrentLink, showFavoritePersistenceFeedback, syncFavoritesUi, warnIfFavoriteChangeIsTemporary };
