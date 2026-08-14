/**
 * Source module: 35-favorites-workspace.js
 * Favorites workspace: notes, catalog filtering, ordering, focused selection, sharing, and bulk inquiry.
 *
 * Runtime dependencies are explicit ES module imports. Route entrypoints are
 * bundled by the pinned esbuild tool into stable browser asset names.
 */

/** @import { CatalogRecord } from "../../types/catalog-data.generated.js" */
/** @import { FavoriteEntry, FavoriteWorkspaceInquiryOptions, FavoriteWorkspaceMessageOptions, InquiryReference, NoteEditorCloseOptions } from "../../types/frontend-contracts.js" */

import { absoluteDocumentUrl, viewerDocumentUrl } from "./00-navigation.js";
import { getFeatureInterface, registerFeatureInterface } from "./10-app-state.js";
import { FAVORITES_NOTE_MAX_LENGTH, favoritesElements, favoritesState, favoritesStore } from "./14-favorites-state.js";
import { catalogImageDimensionAttributes, catalogImageRecoveryAttributes, pageAspectStyle } from "./20-catalog-runtime.js";
import { escapeHtml } from "./19-shared-pure.js";
import { flashActionButton, focusHtmlElement, isHtmlElement, showActionToast, syncDocumentLock } from "./21-ui-runtime.js";
import { eventTargetElement } from "./02-dom-contracts.js";
import { thumbSrc } from "./17-catalog-asset-urls.js";
import { buildFavoritesShareUrl, copyTextToClipboard, favoritesPortabilityDomain, getFavoriteEntries, showFavoritePersistenceFeedback, syncFavoritesUi, warnIfFavoriteChangeIsTemporary } from "./30-favorites-share.js";

/** @param {FavoriteEntry} entry */
function favoriteWorkspaceEntryKey(entry) {
  return favoritesPortabilityDomain.favoriteItemKey({ catalogId: entry?.catalog?.id || entry?.catalogId, page: entry?.page });
}

/** @param {Element|null|undefined} card */
function favoriteWorkspaceCardKey(card) {
  if (!(card instanceof HTMLElement)) return "";
  return favoritesPortabilityDomain.favoriteItemKey({
    catalogId: card.dataset.favoriteCatalog,
    page: card.dataset.favoritePage
  });
}

/** @param {string} key @returns {HTMLElement|null} */
function favoriteWorkspaceFindCardByKey(key) {
  if (!key || !favoritesElements.favoritesGrid) return null;
  const cards = /** @type {NodeListOf<HTMLElement>} */ (
    favoritesElements.favoritesGrid.querySelectorAll("[data-favorite-catalog][data-favorite-page]")
  );
  return Array.from(cards).find((card) => favoriteWorkspaceCardKey(card) === key) || null;
}

/** @param {Array<FavoriteEntry>} [entries] @returns {Array<FavoriteEntry>} */
function favoriteWorkspaceSelectedEntries(entries = getFavoriteEntries()) {
  return entries.filter((entry) => favoritesState.favoritesSelectedKeys.has(favoriteWorkspaceEntryKey(entry)));
}

/** @param {Array<FavoriteEntry>} [entries] @returns {Array<FavoriteEntry>} */
function favoriteWorkspaceVisibleEntries(entries = getFavoriteEntries()) {
  const filter = String(favoritesState.favoritesFilterCatalogId || "");
  return filter ? entries.filter((entry) => String(entry.catalog?.id || entry.catalogId) === filter) : entries;
}

/** @param {Array<FavoriteEntry>} [entries] @returns {Array<FavoriteEntry>} */
function favoriteWorkspaceShareLinkEntries(entries = getFavoriteEntries()) {
  const selectedEntries = favoriteWorkspaceSelectedEntries(entries);
  return selectedEntries.length ? selectedEntries : entries;
}

/** @param {Array<FavoriteEntry>} [entries] */
function pruneFavoritesWorkspaceState(entries = getFavoriteEntries()) {
  const validKeys = new Set(entries.map(favoriteWorkspaceEntryKey).filter(Boolean));
  for (const key of favoritesState.favoritesSelectedKeys) {
    if (!validKeys.has(key)) favoritesState.favoritesSelectedKeys.delete(key);
  }
  if (favoritesState.favoriteNoteEditingKey && !validKeys.has(favoritesState.favoriteNoteEditingKey)) {
    closeFavoriteNoteEditor({ restoreFocus: false });
  }
  if (favoritesState.favoritesFilterCatalogId && !entries.some((entry) => String(entry.catalog?.id || entry.catalogId) === favoritesState.favoritesFilterCatalogId)) {
    favoritesState.favoritesFilterCatalogId = "";
  }
}

/** @param {Array<FavoriteEntry>} entries */
function favoriteWorkspaceFilterOptions(entries) {
  /** @type {Map<string,{catalog:CatalogRecord,count:number}>} */
  const catalogCounts = new Map();
  entries.forEach((entry) => {
    const id = String(entry.catalog?.id || entry.catalogId || "");
    if (!id) return;
    const current = catalogCounts.get(id) || { catalog: entry.catalog, count: 0 };
    current.count += 1;
    catalogCounts.set(id, current);
  });
  return [...catalogCounts.entries()].map(([id, value]) => ({ id, ...value }));
}

/** @param {Array<FavoriteEntry>} entries */
function syncFavoriteWorkspaceFilter(entries) {
  if (!favoritesElements.favoritesCatalogFilter) return;
  const options = favoriteWorkspaceFilterOptions(entries);
  const current = String(favoritesState.favoritesFilterCatalogId || "");
  favoritesElements.favoritesCatalogFilter.innerHTML = [
    '<option value="">כל הקטלוגים</option>',
    ...options.map(({ id, catalog, count }) => (
      `<option value="${escapeHtml(id)}">${escapeHtml(catalog?.title || id)} (${count})</option>`
    ))
  ].join("");
  favoritesElements.favoritesCatalogFilter.value = options.some((option) => option.id === current) ? current : "";
  favoritesState.favoritesFilterCatalogId = favoritesElements.favoritesCatalogFilter.value;
}

/** @param {Array<FavoriteEntry>} entries @param {FavoriteWorkspaceInquiryOptions} [options] @returns {InquiryReference|null} */
function favoriteWorkspaceInquiryReference(entries, options = {}) {
  if (!entries.length) return null;
  const selected = Boolean(options.selected);
  const firstEntry = entries[0];
  const count = entries.length;
  const scopeLabel = selected ? "הדגמים שנבחרו" : "כל המועדפים";
  const title = selected ? "בירור על הדגמים שנבחרו" : "בירור על הדגמים";
  const selectionUrl = favoriteWorkspaceSelectionUrl(entries);
  const shareText = favoriteWorkspaceMessage(entries, { purpose: "inquiry" });
  const text = `${shareText}

קישור לרשימת הדגמים: ${selectionUrl}`;
  return {
    kind: "favorites",
    source: "favorites-inquiry",
    entries,
    count,
    selected,
    title,
    eyebrow: "הדגמים וההערות מצורפים אוטומטית",
    description: "אפשר לפתוח הודעה מוכנה ב-Gmail, להשתמש בתוכנת דואר, לשתף דרך המכשיר או להעתיק. כל הדגמים, ההערות והקישורים הישירים כבר מוכנים.",
    referenceTitle: `${count} ${count === 1 ? "דגם" : "דגמים"} מהמועדפים`,
    pageLabel: `${scopeLabel} · כולל הערות וקישורים`,
    subject: `${title} – ${count} ${count === 1 ? "דגם" : "דגמים"}`,
    shareText,
    text,
    url: selectionUrl,
    previewCatalog: firstEntry.catalog,
    previewPage: firstEntry.page,
    telemetry: { source: "favorites-inquiry", value: count }
  };
}

function openFavoriteWorkspaceInquiry() {
  const entries = getFavoriteEntries();
  const selectedEntries = favoriteWorkspaceSelectedEntries(entries);
  const actionEntries = selectedEntries.length ? selectedEntries : entries;
  const reference = favoriteWorkspaceInquiryReference(actionEntries, { selected: selectedEntries.length > 0 });
  if (!reference) return;
  getFeatureInterface("inquiry")?.openInquiry?.({
    reference,
    returnFocus: favoritesElements.favoritesInquiryButton
  });
}

/** @param {Array<FavoriteEntry>} entries @param {Array<FavoriteEntry>} visibleEntries */
function syncFavoriteWorkspaceHeaderActions(entries, visibleEntries) {
  const selectedEntries = favoriteWorkspaceSelectedEntries(entries);
  const selectedCount = selectedEntries.length;
  const inquiryEntries = selectedCount ? selectedEntries : entries;
  const shareEntries = selectedCount ? selectedEntries : entries;
  const hasEntries = entries.length > 0;

  favoritesElements.favoritesHeaderWorkspace?.classList.toggle("hidden", !hasEntries);
  if (favoritesElements.favoritesCatalogFilter) favoritesElements.favoritesCatalogFilter.disabled = !hasEntries;
  if (favoritesElements.favoritesVisibleCount) {
    favoritesElements.favoritesVisibleCount.textContent = visibleEntries.length === entries.length
      ? `${entries.length} פריטים`
      : `${visibleEntries.length} מתוך ${entries.length}`;
  }

  if (favoritesElements.favoritesShareButton) {
    favoritesElements.favoritesShareButton.disabled = shareEntries.length === 0;
    favoritesElements.favoritesShareButton.setAttribute("aria-label", shareEntries.length
      ? (selectedCount
        ? `העתקת קישור עבור ${selectedCount} פריטים שסומנו`
        : `העתקת קישור לכל ${entries.length} המועדפים`)
      : "העתקת קישור למועדפים — אין עדיין פריטים");
  }
  if (favoritesElements.favoritesShareLabel) {
    favoritesElements.favoritesShareLabel.textContent = selectedCount ? "שיתוף הבחירה" : "שיתוף הרשימה";
  }

  if (favoritesElements.favoritesInquiryButton) {
    favoritesElements.favoritesInquiryButton.classList.toggle("hidden", !hasEntries);
    favoritesElements.favoritesInquiryButton.disabled = inquiryEntries.length === 0;
    favoritesElements.favoritesInquiryButton.setAttribute("aria-label", selectedCount
      ? `בירור על ${selectedCount} הדגמים שנבחרו`
      : `בירור על כל ${entries.length} הדגמים במועדפים`);
  }
  if (favoritesElements.favoritesInquiryLabel) {
    favoritesElements.favoritesInquiryLabel.textContent = selectedCount ? "בירור על הדגמים שנבחרו" : "בירור על הדגמים";
  }

  favoritesElements.favoritesSelectionBar?.classList.toggle("hidden", selectedCount === 0);
  if (favoritesElements.favoritesSelectionCount) favoritesElements.favoritesSelectionCount.textContent = String(selectedCount);
}

/** @param {FavoriteEntry} entry */
function favoriteWorkspaceNoteMarkup(entry) {
  const note = String(entry.note || "").trim();
  if (!note) return "";
  return `
    <div class="favorite-note-summary">
      <span class="favorite-note-label">הערה</span>
      <span class="favorite-note-text">${escapeHtml(note)}</span>
    </div>
  `;
}

/** @param {FavoriteEntry} entry @param {number} visibleIndex @param {number} visibleCount */
function favoriteWorkspaceCardMarkup(entry, visibleIndex, visibleCount) {
  const { catalog, page } = entry;
  const key = favoriteWorkspaceEntryKey(entry);
  const identityCatalog = escapeHtml(catalog.id);
  const title = escapeHtml(catalog.title || "קטלוג");
  const image = thumbSrc(catalog, page);
  const selected = favoritesState.favoritesSelectedKeys.has(key);
  const note = String(entry.note || "").trim();
  const noteActionLabel = note ? "עריכת ההערה" : "הוספת הערה";
  const upDisabled = visibleIndex === 0 ? " disabled" : "";
  const downDisabled = visibleIndex === visibleCount - 1 ? " disabled" : "";

  return `
    <article class="favorite-card${selected ? " is-selected" : ""}" data-favorite-catalog="${identityCatalog}" data-favorite-page="${page}" draggable="false">
      <label class="favorite-select-control">
        <input type="checkbox" data-select-favorite="1" ${selected ? "checked" : ""} aria-label="סימון ${title}, עמוד ${page}" />
        <span aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m6.5 12.4 3.3 3.3 7.7-8"/></svg></span>
      </label>
      <button class="favorite-remove-button" type="button" data-remove-favorite="1" aria-label="הסרת ${title}, עמוד ${page} מהמועדפים" title="הסרה מהמועדפים">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/></svg>
      </button>
      <button class="favorite-preview-button" type="button" data-open-favorite="1" aria-label="פתיחת ${title}, עמוד ${page}">
        <span class="favorite-image-frame catalog-image-frame"${pageAspectStyle(catalog, page)}>
          <img src="${escapeHtml(image)}" alt="${title} - עמוד ${page}"${catalogImageDimensionAttributes(catalog, page)} loading="lazy" decoding="async"${catalogImageRecoveryAttributes(catalog, page, "thumbnail", "favorites-grid")} />
        </span>
        <span class="favorite-card-meta">
          <strong>${title}</strong>
          <span>עמוד ${page}</span>
        </span>
      </button>
      ${favoriteWorkspaceNoteMarkup(entry)}
      <div class="favorite-card-actions">
        <button class="favorite-card-action favorite-note-button" type="button" data-edit-favorite-note="1" aria-label="${noteActionLabel} עבור ${title}, עמוד ${page}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4.5h14v12H9l-4 3v-15Z"/><path d="M8 8h8M8 11.5h5"/></svg>
          <span>${noteActionLabel}</span>
        </button>
        <div class="favorite-order-controls" aria-label="שינוי סדר הפריט">
          <button class="favorite-order-button" type="button" data-move-favorite="-1" aria-label="העברת ${title}, עמוד ${page} למעלה"${upDisabled}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg>
          </button>
          <button class="favorite-drag-handle" type="button" draggable="true" data-drag-favorite="1" aria-label="גרירת ${title}, עמוד ${page} לשינוי סדר" title="גרירה לשינוי סדר">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg>
          </button>
          <button class="favorite-order-button" type="button" data-move-favorite="1" aria-label="העברת ${title}, עמוד ${page} למטה"${downDisabled}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>
          </button>
        </div>
      </div>
    </article>
  `;
}

/** @param {Array<FavoriteEntry>} [entries] */
function renderFavoritesWorkspace(entries = getFavoriteEntries()) {
  if (!favoritesElements.favoritesGrid) return;
  pruneFavoritesWorkspaceState(entries);
  const count = entries.length;
  favoritesElements.favoritesClearButton?.classList.toggle("hidden", count === 0);
  favoritesElements.favoritesEmpty?.classList.toggle("hidden", count !== 0);
  syncFavoriteWorkspaceFilter(entries);
  const visibleEntries = favoriteWorkspaceVisibleEntries(entries);
  syncFavoriteWorkspaceHeaderActions(entries, visibleEntries);
  favoritesElements.favoritesFilteredEmpty?.classList.toggle("hidden", count === 0 || visibleEntries.length > 0);
  favoritesElements.favoritesGrid.classList.toggle("hidden", count === 0 || visibleEntries.length === 0);
  favoritesElements.favoritesGrid.innerHTML = visibleEntries.map((entry, index) => favoriteWorkspaceCardMarkup(entry, index, visibleEntries.length)).join("");
}

/** @param {Array<string>} orderedVisibleKeys */
function favoriteWorkspaceReorderVisible(orderedVisibleKeys) {
  if (!favoritesStore || !orderedVisibleKeys.length) return false;
  const allItems = favoritesStore.read();
  const visibleSet = new Set(orderedVisibleKeys);
  const itemByKey = new Map(allItems.map((item) => [favoritesPortabilityDomain.favoriteItemKey(item), item]));
  if (orderedVisibleKeys.some((key) => !itemByKey.has(key))) return false;
  let visibleIndex = 0;
  const nextItems = allItems.map((item) => {
    const key = favoritesPortabilityDomain.favoriteItemKey(item);
    if (!visibleSet.has(key)) return item;
    const replacement = itemByKey.get(orderedVisibleKeys[visibleIndex]);
    visibleIndex += 1;
    return replacement || item;
  });
  const mutation = favoritesStore.replaceDetailed(nextItems);
  warnIfFavoriteChangeIsTemporary(mutation);
  return mutation.changed;
}

/** @param {string} key @param {number} direction */
function moveFavoriteWithinVisibleOrder(key, direction) {
  const entries = getFavoriteEntries();
  const visibleEntries = favoriteWorkspaceVisibleEntries(entries);
  const keys = visibleEntries.map(favoriteWorkspaceEntryKey);
  const index = keys.indexOf(key);
  const targetIndex = index + Number(direction || 0);
  if (index < 0 || targetIndex < 0 || targetIndex >= keys.length) return false;
  [keys[index], keys[targetIndex]] = [keys[targetIndex], keys[index]];
  favoriteWorkspaceReorderVisible(keys);
  syncFavoritesUi({ renderPanel: true });
  requestAnimationFrame(() => {
    const movedCard = favoriteWorkspaceFindCardByKey(key);
    focusHtmlElement(movedCard?.querySelector(`[data-move-favorite="${direction}"]`));
  });
  return true;
}

/** @param {string} sourceKey @param {string} targetKey */
function reorderFavoriteByDrop(sourceKey, targetKey) {
  if (!sourceKey || !targetKey || sourceKey === targetKey) return false;
  const visibleKeys = favoriteWorkspaceVisibleEntries().map(favoriteWorkspaceEntryKey);
  const from = visibleKeys.indexOf(sourceKey);
  const to = visibleKeys.indexOf(targetKey);
  if (from < 0 || to < 0) return false;
  visibleKeys.splice(to, 0, visibleKeys.splice(from, 1)[0]);
  favoriteWorkspaceReorderVisible(visibleKeys);
  syncFavoritesUi({ renderPanel: true });
  return true;
}

/** @param {string} key @param {boolean} selected */
function setFavoriteWorkspaceSelection(key, selected) {
  if (!key) return;
  if (selected) favoritesState.favoritesSelectedKeys.add(key);
  else favoritesState.favoritesSelectedKeys.delete(key);
  renderFavoritesWorkspace(getFavoriteEntries());
}

function clearFavoritesSelection() {
  favoritesState.favoritesSelectedKeys.clear();
  renderFavoritesWorkspace(getFavoriteEntries());
}

/** @param {FavoriteEntry} entry */
function favoriteWorkspaceItemUrl(entry) {
  return absoluteDocumentUrl(viewerDocumentUrl(entry.catalog.id, entry.page));
}

/** @param {Array<FavoriteEntry>} entries @param {FavoriteWorkspaceMessageOptions} [options] */
function favoriteWorkspaceMessage(entries, options = {}) {
  const purpose = options.purpose === "inquiry" ? "inquiry" : "share";
  const lines = purpose === "inquiry"
    ? ["שלום,", "רציתי לברר לגבי הדגמים הבאים מתוך קטלוגי רהיטי ברגיג:", ""]
    : ["שלום,", "רציתי לשתף כמה דגמים מתוך קטלוגי רהיטי ברגיג:", ""];
  entries.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.catalog.title} — עמוד ${entry.page}`);
    if (String(entry.note || "").trim()) lines.push(`הערה: ${String(entry.note).trim()}`);
    lines.push(favoriteWorkspaceItemUrl(entry), "");
  });
  return lines.join("\n").trim();
}

/** @param {Array<FavoriteEntry>} entries */
function favoriteWorkspaceSelectionUrl(entries) {
  return buildFavoritesShareUrl(entries.map((entry) => ({ catalogId: entry.catalog.id, page: entry.page })));
}

/**
 * @param {FavoriteEntry[]} entries
 * @param {Element|null} [button]
 */
async function copyFavoriteWorkspaceLink(entries, button = null) {
  if (!entries.length) return;
  const selectionUrl = favoriteWorkspaceSelectionUrl(entries);
  try {
    await copyTextToClipboard(selectionUrl);
    if (button) flashActionButton(button, "הקישור הועתק");
    showActionToast("קישור המועדפים הועתק", { tone: "link" });
  } catch (_error) {
    window.prompt("אפשר להעתיק את קישור המועדפים מכאן:", selectionUrl);
  }
}

/** @param {string} key @returns {FavoriteEntry|null} */
function favoriteWorkspaceFindEntryByKey(key) {
  return getFavoriteEntries().find((entry) => favoriteWorkspaceEntryKey(entry) === key) || null;
}

function syncFavoriteNoteCount() {
  if (!favoritesElements.favoriteNoteCount || !favoritesElements.favoriteNoteInput) return;
  favoritesElements.favoriteNoteCount.textContent = `${favoritesElements.favoriteNoteInput.value.length}/${FAVORITES_NOTE_MAX_LENGTH}`;
}

/**
 * @param {string} key
 * @param {HTMLElement|null} [returnFocus]
 */
function openFavoriteNoteEditor(key, returnFocus = isHtmlElement(document.activeElement) ? document.activeElement : null) {
  const entry = favoriteWorkspaceFindEntryByKey(key);
  if (!entry || !favoritesElements.favoriteNoteOverlay || !favoritesElements.favoriteNoteInput) return;
  favoritesState.favoriteNoteEditingKey = key;
  favoritesState.favoriteNoteReturnFocus = returnFocus;
  if (favoritesElements.favoriteNoteTitle) favoritesElements.favoriteNoteTitle.textContent = entry.note ? "עריכת הערה" : "הוספת הערה";
  if (favoritesElements.favoriteNoteContext) favoritesElements.favoriteNoteContext.textContent = `${entry.catalog.title} · עמוד ${entry.page}`;
  favoritesElements.favoriteNoteInput.value = String(entry.note || "");
  syncFavoriteNoteCount();
  favoritesElements.favoriteNoteOverlay.classList.remove("hidden");
  favoritesElements.favoriteNoteOverlay.setAttribute("aria-hidden", "false");
  syncDocumentLock();
  requestAnimationFrame(() => {
    favoritesElements.favoriteNoteInput.focus();
    favoritesElements.favoriteNoteInput.setSelectionRange(favoritesElements.favoriteNoteInput.value.length, favoritesElements.favoriteNoteInput.value.length);
  });
}

/** @param {NoteEditorCloseOptions} [options] */
function closeFavoriteNoteEditor(options = {}) {
  const { restoreFocus = true } = options;
  const returnFocus = favoritesState.favoriteNoteReturnFocus;
  favoritesState.favoriteNoteEditingKey = "";
  favoritesState.favoriteNoteReturnFocus = null;
  favoritesElements.favoriteNoteOverlay?.classList.add("hidden");
  favoritesElements.favoriteNoteOverlay?.setAttribute("aria-hidden", "true");
  syncDocumentLock();
  if (restoreFocus) returnFocus?.focus?.();
}

function saveFavoriteNote() {
  if (!favoritesState.favoriteNoteEditingKey || !favoritesStore || !favoritesElements.favoriteNoteInput) return;
  const entry = favoriteWorkspaceFindEntryByKey(favoritesState.favoriteNoteEditingKey);
  if (!entry) return closeFavoriteNoteEditor({ restoreFocus: false });
  const hasNote = Boolean(favoritesElements.favoriteNoteInput.value.trim());
  const mutation = favoritesStore.setNoteDetailed(
    { catalogId: entry.catalog.id, page: entry.page },
    favoritesElements.favoriteNoteInput.value
  );
  closeFavoriteNoteEditor({ restoreFocus: false });
  syncFavoritesUi({ renderPanel: true });
  if (mutation.changed) showFavoritePersistenceFeedback(mutation, hasNote ? {
    persisted: "ההערה נשמרה",
    temporary: "ההערה נשמרה זמנית בלבד — היא תיעלם לאחר רענון",
    tone: "saved"
  } : {
    persisted: "ההערה הוסרה",
    temporary: "ההערה הוסרה זמנית בלבד — השינוי לא יישמר לאחר רענון",
    tone: "removed"
  });
  requestAnimationFrame(() => {
    focusHtmlElement(favoriteWorkspaceFindCardByKey(favoriteWorkspaceEntryKey(entry))?.querySelector("[data-edit-favorite-note]"));
  });
}

/**
 * @param {Element|null} container
 * @returns {HTMLElement[]}
 */
function favoriteWorkspaceFocusable(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('button:not([disabled]), a[href]:not(.hidden), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter(isHtmlElement)
    .filter((element) => !element.closest(".hidden"));
}

/** @param {KeyboardEvent} event @param {Element|null} container @param {()=>void} closeCallback */
function trapFavoriteWorkspaceDialogFocus(event, container, closeCallback) {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeCallback();
    return true;
  }
  if (event.key !== "Tab") return false;
  const focusable = favoriteWorkspaceFocusable(container);
  if (!focusable.length) return false;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
  return true;
}

/** @param {Event} event */
function handleFavoritesWorkspaceGridClick(event) {
  const target = eventTargetElement(event.target);
  const card = target?.closest("[data-favorite-catalog][data-favorite-page]");
  if (!card || !favoritesElements.favoritesGrid?.contains(card)) return false;
  const key = favoriteWorkspaceCardKey(card);
  if (target?.closest("[data-edit-favorite-note]")) {
    const button = target.closest("button");
    openFavoriteNoteEditor(key, isHtmlElement(button) ? button : null);
    return true;
  }
  const moveButton = target?.closest("[data-move-favorite]");
  if (moveButton instanceof HTMLElement) {
    moveFavoriteWithinVisibleOrder(key, Number(moveButton.dataset.moveFavorite));
    return true;
  }
  return false;
}

/** @param {Event} event */
function handleFavoritesWorkspaceGridChange(event) {
  const target = eventTargetElement(event.target);
  const checkbox = target?.closest("[data-select-favorite]");
  if (!(checkbox instanceof HTMLInputElement)) return;
  const card = checkbox.closest("[data-favorite-catalog][data-favorite-page]");
  setFavoriteWorkspaceSelection(favoriteWorkspaceCardKey(card), checkbox.checked);
}

/** @param {DragEvent} event */
function handleFavoritesWorkspaceDragStart(event) {
  const target = eventTargetElement(event.target);
  const handle = target?.closest("[data-drag-favorite]");
  const card = handle?.closest("[data-favorite-catalog][data-favorite-page]");
  if (!handle || !card) return;
  favoritesState.favoritesDragKey = favoriteWorkspaceCardKey(card);
  card.classList.add("is-dragging");
  event.dataTransfer?.setData("text/plain", "favorite-card");
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

/** @param {DragEvent} event */
function handleFavoritesWorkspaceDragOver(event) {
  if (!favoritesState.favoritesDragKey) return;
  const card = eventTargetElement(event.target)?.closest("[data-favorite-catalog][data-favorite-page]");
  if (!card || favoriteWorkspaceCardKey(card) === favoritesState.favoritesDragKey) return;
  event.preventDefault();
  favoritesElements.favoritesGrid?.querySelectorAll(".is-drag-target").forEach((item) => item.classList.remove("is-drag-target"));
  card.classList.add("is-drag-target");
}

/** @param {DragEvent} event */
function handleFavoritesWorkspaceDrop(event) {
  const card = eventTargetElement(event.target)?.closest("[data-favorite-catalog][data-favorite-page]");
  if (!card || !favoritesState.favoritesDragKey) return;
  event.preventDefault();
  reorderFavoriteByDrop(favoritesState.favoritesDragKey, favoriteWorkspaceCardKey(card));
  favoritesState.favoritesDragKey = "";
}

function handleFavoritesWorkspaceDragEnd() {
  favoritesState.favoritesDragKey = "";
  favoritesElements.favoritesGrid?.querySelectorAll(".is-dragging, .is-drag-target").forEach((item) => item.classList.remove("is-dragging", "is-drag-target"));
}

function attachFavoritesWorkspaceEvents() {
  favoritesElements.favoritesCatalogFilter?.addEventListener("change", () => {
    favoritesState.favoritesFilterCatalogId = favoritesElements.favoritesCatalogFilter.value;
    renderFavoritesWorkspace(getFavoriteEntries());
  });
  favoritesElements.favoritesResetFilter?.addEventListener("click", () => {
    favoritesState.favoritesFilterCatalogId = "";
    renderFavoritesWorkspace(getFavoriteEntries());
    requestAnimationFrame(() => favoritesElements.favoritesCatalogFilter?.focus?.());
  });
  favoritesElements.favoritesClearSelection?.addEventListener("click", clearFavoritesSelection);
  favoritesElements.favoritesInquiryButton?.addEventListener("click", openFavoriteWorkspaceInquiry);
  favoritesElements.favoritesGrid?.addEventListener("change", handleFavoritesWorkspaceGridChange);
  favoritesElements.favoritesGrid?.addEventListener("dragstart", handleFavoritesWorkspaceDragStart);
  favoritesElements.favoritesGrid?.addEventListener("dragover", handleFavoritesWorkspaceDragOver);
  favoritesElements.favoritesGrid?.addEventListener("drop", handleFavoritesWorkspaceDrop);
  favoritesElements.favoritesGrid?.addEventListener("dragend", handleFavoritesWorkspaceDragEnd);

  favoritesElements.favoriteNoteInput?.addEventListener("input", syncFavoriteNoteCount);
  favoritesElements.favoriteNoteSave?.addEventListener("click", saveFavoriteNote);
  favoritesElements.favoriteNoteCancel?.addEventListener("click", () => closeFavoriteNoteEditor());
  favoritesElements.favoriteNoteClose?.addEventListener("click", () => closeFavoriteNoteEditor());
  favoritesElements.favoriteNoteBackdrop?.addEventListener("click", () => closeFavoriteNoteEditor());
  favoritesElements.favoriteNoteOverlay?.addEventListener("keydown", (event) => trapFavoriteWorkspaceDialogFocus(event, favoritesElements.favoriteNoteOverlay, closeFavoriteNoteEditor));
}
registerFeatureInterface("favorites-workspace", {
  attachEvents: attachFavoritesWorkspaceEvents,
  shareLinkEntries: (entries = getFavoriteEntries()) => favoriteWorkspaceShareLinkEntries(entries),
  copyShareLink: (entries, button = null) => copyFavoriteWorkspaceLink(entries, button),
  render: (entries = getFavoriteEntries()) => renderFavoritesWorkspace(entries),
  prune: (entries = getFavoriteEntries()) => pruneFavoritesWorkspaceState(entries),
  handleGridClick: (event) => handleFavoritesWorkspaceGridClick(event),
  closeNoteEditor: (options = {}) => closeFavoriteNoteEditor(options)
});

export {
  favoriteWorkspaceInquiryReference,
  openFavoriteWorkspaceInquiry
};
