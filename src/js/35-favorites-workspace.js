/**
 * Source module: 35-favorites-workspace.js
 * Favorites workspace: notes, catalog filtering, ordering, multi-selection, sharing, and comparison.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

function favoriteWorkspaceEntryKey(entry) {
  return favoriteItemKey({ catalogId: entry?.catalog?.id || entry?.catalogId, page: entry?.page });
}


function favoriteWorkspaceCardKey(card) {
  if (!card) return "";
  return favoriteItemKey({
    catalogId: card.dataset.favoriteCatalog,
    page: card.dataset.favoritePage
  });
}

function favoriteWorkspaceFindCardByKey(key) {
  if (!key || !els.favoritesGrid) return null;
  return Array.from(els.favoritesGrid.querySelectorAll("[data-favorite-catalog][data-favorite-page]"))
    .find((card) => favoriteWorkspaceCardKey(card) === key) || null;
}

function favoriteWorkspaceSelectedEntries(entries = getFavoriteEntries()) {
  return entries.filter((entry) => state.favoritesSelectedKeys.has(favoriteWorkspaceEntryKey(entry)));
}

function favoriteWorkspaceVisibleEntries(entries = getFavoriteEntries()) {
  const filter = String(state.favoritesFilterCatalogId || "");
  return filter ? entries.filter((entry) => String(entry.catalog?.id || entry.catalogId) === filter) : entries;
}

function pruneFavoritesWorkspaceState(entries = getFavoriteEntries()) {
  const validKeys = new Set(entries.map(favoriteWorkspaceEntryKey).filter(Boolean));
  for (const key of state.favoritesSelectedKeys) {
    if (!validKeys.has(key)) state.favoritesSelectedKeys.delete(key);
  }
  if (state.favoriteNoteEditingKey && !validKeys.has(state.favoriteNoteEditingKey)) closeFavoriteNoteEditor({ restoreFocus: false });
  if (state.favoritesCompareOpen && favoriteWorkspaceSelectedEntries(entries).length < FAVORITES_COMPARE_MIN_ITEMS) {
    closeFavoritesCompare({ restoreFocus: false });
  }
  if (state.favoritesFilterCatalogId && !entries.some((entry) => String(entry.catalog?.id || entry.catalogId) === state.favoritesFilterCatalogId)) {
    state.favoritesFilterCatalogId = "";
  }
}

function favoriteWorkspaceFilterOptions(entries) {
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

function syncFavoriteWorkspaceFilter(entries) {
  if (!els.favoritesCatalogFilter) return;
  const options = favoriteWorkspaceFilterOptions(entries);
  const current = String(state.favoritesFilterCatalogId || "");
  els.favoritesCatalogFilter.innerHTML = [
    `<option value="">כל הקטלוגים (${entries.length})</option>`,
    ...options.map(({ id, catalog, count }) => (
      `<option value="${escapeHtml(id)}">${escapeHtml(catalog?.title || id)} (${count})</option>`
    ))
  ].join("");
  els.favoritesCatalogFilter.value = options.some((option) => option.id === current) ? current : "";
  state.favoritesFilterCatalogId = els.favoritesCatalogFilter.value;
}

function favoriteWorkspaceSelectionStatus(entries, visibleEntries) {
  const selectedEntries = favoriteWorkspaceSelectedEntries(entries);
  const selectedVisibleCount = visibleEntries.filter((entry) => state.favoritesSelectedKeys.has(favoriteWorkspaceEntryKey(entry))).length;
  const allVisibleSelected = visibleEntries.length > 0 && selectedVisibleCount === visibleEntries.length;
  return { selectedEntries, selectedVisibleCount, allVisibleSelected };
}

function syncFavoritesWorkspaceToolbar(entries, visibleEntries) {
  const { selectedEntries, allVisibleSelected } = favoriteWorkspaceSelectionStatus(entries, visibleEntries);
  const selectedCount = selectedEntries.length;
  const hasEntries = entries.length > 0;

  els.favoritesTools?.classList.toggle("hidden", !hasEntries);
  if (els.favoritesVisibleCount) {
    els.favoritesVisibleCount.textContent = visibleEntries.length === entries.length
      ? `${entries.length} פריטים` : `${visibleEntries.length} מתוך ${entries.length}`;
  }
  if (els.favoritesSelectAllVisible) {
    els.favoritesSelectAllVisible.disabled = !visibleEntries.length;
    els.favoritesSelectAllVisible.textContent = allVisibleSelected ? "ביטול סימון המוצגים" : "סימון כל המוצגים";
    els.favoritesSelectAllVisible.setAttribute("aria-pressed", allVisibleSelected ? "true" : "false");
  }

  els.favoritesSelectionBar?.classList.toggle("hidden", selectedCount === 0);
  if (els.favoritesSelectionCount) els.favoritesSelectionCount.textContent = String(selectedCount);
  if (els.favoritesShareSelected) els.favoritesShareSelected.disabled = selectedCount === 0;
  if (els.favoritesCompareSelected) {
    const validComparison = selectedCount >= FAVORITES_COMPARE_MIN_ITEMS && selectedCount <= FAVORITES_COMPARE_MAX_ITEMS;
    els.favoritesCompareSelected.disabled = !validComparison;
    els.favoritesCompareSelected.setAttribute("aria-label", validComparison
      ? `השוואת ${selectedCount} פריטים שסומנו`
      : `להשוואה יש לסמן ${FAVORITES_COMPARE_MIN_ITEMS} עד ${FAVORITES_COMPARE_MAX_ITEMS} פריטים`);
  }
}

function favoriteWorkspaceNoteMarkup(entry) {
  const note = String(entry.note || "").trim();
  if (!note) return '<span class="favorite-note-empty">ללא הערה</span>';
  return `<span class="favorite-note-text">${escapeHtml(note)}</span>`;
}

function favoriteWorkspaceCardMarkup(entry, visibleIndex, visibleCount) {
  const { catalog, page } = entry;
  const key = favoriteWorkspaceEntryKey(entry);
  const identityCatalog = escapeHtml(catalog.id);
  const title = escapeHtml(catalog.title || "קטלוג");
  const image = pageSrc(catalog, page);
  const selected = state.favoritesSelectedKeys.has(key);
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
      <button class="favorite-preview-button" type="button" data-open-favorite="1" aria-label="פתיחת ${title}, עמוד ${page}">
        <span class="favorite-image-frame catalog-image-frame"${pageAspectStyle(catalog, page)}>
          <img src="${escapeHtml(image)}" alt="${title} - עמוד ${page}" loading="lazy" decoding="async"${catalogImageCrossOriginAttribute(image)} />
        </span>
        <span class="favorite-card-meta">
          <strong>${title}</strong>
          <span>עמוד ${page}</span>
        </span>
      </button>
      <div class="favorite-note-summary">
        <span class="favorite-note-label">הערה</span>
        ${favoriteWorkspaceNoteMarkup(entry)}
      </div>
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
        <button class="favorite-card-action favorite-remove-inline" type="button" data-remove-favorite="1" aria-label="הסרת ${title}, עמוד ${page} מהמועדפים">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5 17.5 17.5M17.5 6.5 6.5 17.5"/></svg>
          <span>הסרה</span>
        </button>
      </div>
    </article>
  `;
}

function renderFavoritesWorkspace(entries = getFavoriteEntries()) {
  if (!els.favoritesGrid) return;
  pruneFavoritesWorkspaceState(entries);
  const count = entries.length;
  if (els.favoritesCount) els.favoritesCount.textContent = String(count);
  els.favoritesClearButton?.classList.toggle("hidden", count === 0);
  els.favoritesEmpty?.classList.toggle("hidden", count !== 0);
  syncFavoritesShareButton(count);
  syncFavoriteWorkspaceFilter(entries);
  const visibleEntries = favoriteWorkspaceVisibleEntries(entries);
  syncFavoritesWorkspaceToolbar(entries, visibleEntries);
  els.favoritesFilteredEmpty?.classList.toggle("hidden", count === 0 || visibleEntries.length > 0);
  els.favoritesGrid.classList.toggle("hidden", count === 0 || visibleEntries.length === 0);
  els.favoritesGrid.innerHTML = visibleEntries.map((entry, index) => favoriteWorkspaceCardMarkup(entry, index, visibleEntries.length)).join("");
}

function favoriteWorkspaceReorderVisible(orderedVisibleKeys) {
  if (!favoritesStore || !orderedVisibleKeys.length) return false;
  const allItems = favoritesStore.read();
  const visibleSet = new Set(orderedVisibleKeys);
  const itemByKey = new Map(allItems.map((item) => [favoriteItemKey(item), item]));
  if (orderedVisibleKeys.some((key) => !itemByKey.has(key))) return false;
  let visibleIndex = 0;
  const nextItems = allItems.map((item) => {
    const key = favoriteItemKey(item);
    if (!visibleSet.has(key)) return item;
    const replacement = itemByKey.get(orderedVisibleKeys[visibleIndex]);
    visibleIndex += 1;
    return replacement;
  });
  return favoritesStore.replace(nextItems);
}

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
    movedCard?.querySelector(`[data-move-favorite="${direction}"]`)?.focus?.();
  });
  return true;
}

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

function setFavoriteWorkspaceSelection(key, selected) {
  if (!key) return;
  if (selected) state.favoritesSelectedKeys.add(key);
  else state.favoritesSelectedKeys.delete(key);
  renderFavoritesWorkspace(getFavoriteEntries());
}

function toggleAllVisibleFavoritesSelection() {
  const entries = getFavoriteEntries();
  const visibleEntries = favoriteWorkspaceVisibleEntries(entries);
  const visibleKeys = visibleEntries.map(favoriteWorkspaceEntryKey);
  const allSelected = visibleKeys.length > 0 && visibleKeys.every((key) => state.favoritesSelectedKeys.has(key));
  visibleKeys.forEach((key) => {
    if (allSelected) state.favoritesSelectedKeys.delete(key);
    else state.favoritesSelectedKeys.add(key);
  });
  renderFavoritesWorkspace(entries);
}

function clearFavoritesSelection() {
  state.favoritesSelectedKeys.clear();
  renderFavoritesWorkspace(getFavoriteEntries());
}

function favoriteWorkspaceItemUrl(entry) {
  return absoluteDocumentUrl(viewerDocumentUrl(entry.catalog.id, entry.page));
}

function favoriteWorkspaceMessage(entries, options = {}) {
  const { greeting = true } = options;
  const lines = greeting ? ["שלום,", "רציתי לשתף כמה דגמים מתוך קטלוגי רהיטי ברגיג:", ""] : [];
  entries.forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.catalog.title} — עמוד ${entry.page}`);
    if (String(entry.note || "").trim()) lines.push(`הערה: ${String(entry.note).trim()}`);
    lines.push(favoriteWorkspaceItemUrl(entry), "");
  });
  return lines.join("\n").trim();
}

function favoriteWorkspaceSelectionUrl(entries) {
  return buildFavoritesShareUrl(entries.map((entry) => ({ catalogId: entry.catalog.id, page: entry.page })));
}

async function shareFavoriteWorkspaceEntries(entries, button = null) {
  if (!entries.length) return;
  const selectionUrl = favoriteWorkspaceSelectionUrl(entries);
  const text = favoriteWorkspaceMessage(entries);
  const shareData = {
    title: `${entries.length} דגמים לבחירה`,
    text,
    url: selectionUrl
  };
  let canUseNativeShare = typeof navigator.share === "function";
  if (canUseNativeShare && typeof navigator.canShare === "function") {
    try {
      canUseNativeShare = navigator.canShare(shareData);
    } catch (_error) {
      canUseNativeShare = false;
    }
  }
  if (canUseNativeShare) {
    try {
      await navigator.share(shareData);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
    }
  }
  try {
    await copyTextToClipboard(`${text}\n\nרשימת הבחירה: ${selectionUrl}`);
    if (button) flashActionButton(button, "הועתק");
    showActionToast("פרטי הבחירה והקישורים הועתקו", { tone: "link" });
  } catch (_error) {
    window.prompt("אפשר להעתיק את פרטי הבחירה מכאן:", `${text}\n\nרשימת הבחירה: ${selectionUrl}`);
  }
}

async function shareSelectedFavorites() {
  await shareFavoriteWorkspaceEntries(favoriteWorkspaceSelectedEntries(), els.favoritesShareSelected);
}

function favoriteWorkspaceFindEntryByKey(key) {
  return getFavoriteEntries().find((entry) => favoriteWorkspaceEntryKey(entry) === key) || null;
}

function syncFavoriteNoteCount() {
  if (!els.favoriteNoteCount || !els.favoriteNoteInput) return;
  els.favoriteNoteCount.textContent = `${els.favoriteNoteInput.value.length}/${FAVORITES_NOTE_MAX_LENGTH}`;
}

function openFavoriteNoteEditor(key, returnFocus = document.activeElement) {
  const entry = favoriteWorkspaceFindEntryByKey(key);
  if (!entry || !els.favoriteNoteOverlay || !els.favoriteNoteInput) return;
  state.favoriteNoteEditingKey = key;
  state.favoriteNoteReturnFocus = returnFocus;
  if (els.favoriteNoteTitle) els.favoriteNoteTitle.textContent = entry.note ? "עריכת הערה" : "הוספת הערה";
  if (els.favoriteNoteContext) els.favoriteNoteContext.textContent = `${entry.catalog.title} · עמוד ${entry.page}`;
  els.favoriteNoteInput.value = String(entry.note || "");
  syncFavoriteNoteCount();
  els.favoriteNoteOverlay.classList.remove("hidden");
  els.favoriteNoteOverlay.setAttribute("aria-hidden", "false");
  syncDocumentLock();
  requestAnimationFrame(() => {
    els.favoriteNoteInput.focus();
    els.favoriteNoteInput.setSelectionRange(els.favoriteNoteInput.value.length, els.favoriteNoteInput.value.length);
  });
}

function closeFavoriteNoteEditor(options = {}) {
  const { restoreFocus = true } = options;
  const returnFocus = state.favoriteNoteReturnFocus;
  state.favoriteNoteEditingKey = "";
  state.favoriteNoteReturnFocus = null;
  els.favoriteNoteOverlay?.classList.add("hidden");
  els.favoriteNoteOverlay?.setAttribute("aria-hidden", "true");
  syncDocumentLock();
  if (restoreFocus) returnFocus?.focus?.();
}

function saveFavoriteNote() {
  if (!state.favoriteNoteEditingKey || !favoritesStore || !els.favoriteNoteInput) return;
  const entry = favoriteWorkspaceFindEntryByKey(state.favoriteNoteEditingKey);
  if (!entry) return closeFavoriteNoteEditor({ restoreFocus: false });
  favoritesStore.setNote({ catalogId: entry.catalog.id, page: entry.page }, els.favoriteNoteInput.value);
  closeFavoriteNoteEditor({ restoreFocus: false });
  syncFavoritesUi({ renderPanel: true });
  showActionToast(els.favoriteNoteInput.value.trim() ? "ההערה נשמרה" : "ההערה הוסרה", { tone: "saved" });
  requestAnimationFrame(() => {
    favoriteWorkspaceFindCardByKey(favoriteWorkspaceEntryKey(entry))?.querySelector("[data-edit-favorite-note]")?.focus?.();
  });
}

function favoriteWorkspaceFocusable(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll('button:not([disabled]), a[href]:not(.hidden), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'))
    .filter((element) => !element.closest?.(".hidden"));
}

function trapFavoriteWorkspaceDialogFocus(event, container, closeCallback) {
  if (event.key === "Escape") {
    event.preventDefault();
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

function renderFavoritesCompare(entries = favoriteWorkspaceSelectedEntries()) {
  if (!els.favoritesCompareGrid) return;
  els.favoritesCompareGrid.style.setProperty("--favorites-compare-columns", String(Math.max(2, entries.length)));
  els.favoritesCompareGrid.innerHTML = entries.map((entry) => {
    const image = pageSrc(entry.catalog, entry.page);
    const note = String(entry.note || "").trim();
    return `
      <article class="favorites-compare-card">
        <span class="favorites-compare-image catalog-image-frame"${pageAspectStyle(entry.catalog, entry.page)}>
          <img src="${escapeHtml(image)}" alt="${escapeHtml(entry.catalog.title)}, עמוד ${entry.page}" loading="eager" decoding="async"${catalogImageCrossOriginAttribute(image)} />
        </span>
        <div class="favorites-compare-card-copy">
          <strong>${escapeHtml(entry.catalog.title)}</strong>
          <span>עמוד ${entry.page}</span>
          <p class="${note ? "" : "is-empty"}">${note ? escapeHtml(note) : "לא נוספה הערה"}</p>
        </div>
      </article>
    `;
  }).join("");
  if (els.favoritesCompareDescription) els.favoritesCompareDescription.textContent = `${entries.length} דגמים מוצגים זה לצד זה`;
  if (els.favoritesCompareGmail) {
    const email = viewerInquiryEmailAddress();
    const reference = {
      subject: `בירור מרוכז על ${entries.length} דגמים`,
      text: favoriteWorkspaceMessage(entries)
    };
    if (email) {
      els.favoritesCompareGmail.href = viewerInquiryGmailUrl(email, reference);
      els.favoritesCompareGmail.classList.remove("hidden");
      els.favoritesCompareGmail.setAttribute("aria-hidden", "false");
    } else {
      els.favoritesCompareGmail.removeAttribute("href");
      els.favoritesCompareGmail.classList.add("hidden");
      els.favoritesCompareGmail.setAttribute("aria-hidden", "true");
    }
  }
}

function openFavoritesCompare() {
  const entries = favoriteWorkspaceSelectedEntries();
  if (entries.length < FAVORITES_COMPARE_MIN_ITEMS || entries.length > FAVORITES_COMPARE_MAX_ITEMS) {
    showActionToast(`להשוואה יש לסמן ${FAVORITES_COMPARE_MIN_ITEMS} עד ${FAVORITES_COMPARE_MAX_ITEMS} פריטים`);
    return;
  }
  state.favoritesCompareOpen = true;
  state.favoritesCompareReturnFocus = document.activeElement;
  renderFavoritesCompare(entries);
  els.favoritesCompareOverlay?.classList.remove("hidden");
  els.favoritesCompareOverlay?.setAttribute("aria-hidden", "false");
  syncDocumentLock();
  requestAnimationFrame(() => els.favoritesCompareClose?.focus?.());
}

function closeFavoritesCompare(options = {}) {
  const { restoreFocus = true } = options;
  const returnFocus = state.favoritesCompareReturnFocus;
  state.favoritesCompareOpen = false;
  state.favoritesCompareReturnFocus = null;
  els.favoritesCompareOverlay?.classList.add("hidden");
  els.favoritesCompareOverlay?.setAttribute("aria-hidden", "true");
  syncDocumentLock();
  if (restoreFocus) returnFocus?.focus?.();
}

async function shareFavoritesComparison() {
  await shareFavoriteWorkspaceEntries(favoriteWorkspaceSelectedEntries(), els.favoritesCompareShare);
}

async function copyFavoritesComparison() {
  const entries = favoriteWorkspaceSelectedEntries();
  if (!entries.length) return;
  const selectionUrl = favoriteWorkspaceSelectionUrl(entries);
  try {
    await copyTextToClipboard(`${favoriteWorkspaceMessage(entries)}\n\nרשימת הבחירה: ${selectionUrl}`);
    flashActionButton(els.favoritesCompareCopy, "הועתק");
    showActionToast("פרטי ההשוואה הועתקו", { tone: "link" });
  } catch (_error) {
    window.prompt("אפשר להעתיק את פרטי ההשוואה מכאן:", favoriteWorkspaceMessage(entries));
  }
}

function handleFavoritesWorkspaceGridClick(event) {
  const card = event.target.closest?.("[data-favorite-catalog][data-favorite-page]");
  if (!card || !els.favoritesGrid?.contains(card)) return false;
  const key = favoriteWorkspaceCardKey(card);
  if (event.target.closest?.("[data-edit-favorite-note]")) {
    openFavoriteNoteEditor(key, event.target.closest("button"));
    return true;
  }
  const moveButton = event.target.closest?.("[data-move-favorite]");
  if (moveButton) {
    moveFavoriteWithinVisibleOrder(key, Number(moveButton.dataset.moveFavorite));
    return true;
  }
  return false;
}

function handleFavoritesWorkspaceGridChange(event) {
  const checkbox = event.target.closest?.("[data-select-favorite]");
  if (!checkbox) return;
  const card = checkbox.closest("[data-favorite-catalog][data-favorite-page]");
  setFavoriteWorkspaceSelection(favoriteWorkspaceCardKey(card), checkbox.checked);
}

function handleFavoritesWorkspaceDragStart(event) {
  const handle = event.target.closest?.("[data-drag-favorite]");
  const card = handle?.closest?.("[data-favorite-catalog][data-favorite-page]");
  if (!handle || !card) return;
  state.favoritesDragKey = favoriteWorkspaceCardKey(card);
  card.classList.add("is-dragging");
  event.dataTransfer?.setData("text/plain", "favorite-card");
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
}

function handleFavoritesWorkspaceDragOver(event) {
  if (!state.favoritesDragKey) return;
  const card = event.target.closest?.("[data-favorite-catalog][data-favorite-page]");
  if (!card || favoriteWorkspaceCardKey(card) === state.favoritesDragKey) return;
  event.preventDefault();
  els.favoritesGrid?.querySelectorAll(".is-drag-target").forEach((item) => item.classList.remove("is-drag-target"));
  card.classList.add("is-drag-target");
}

function handleFavoritesWorkspaceDrop(event) {
  const card = event.target.closest?.("[data-favorite-catalog][data-favorite-page]");
  if (!card || !state.favoritesDragKey) return;
  event.preventDefault();
  reorderFavoriteByDrop(state.favoritesDragKey, favoriteWorkspaceCardKey(card));
  state.favoritesDragKey = "";
}

function handleFavoritesWorkspaceDragEnd() {
  state.favoritesDragKey = "";
  els.favoritesGrid?.querySelectorAll(".is-dragging, .is-drag-target").forEach((item) => item.classList.remove("is-dragging", "is-drag-target"));
}

function attachFavoritesWorkspaceEvents() {
  els.favoritesCatalogFilter?.addEventListener("change", () => {
    state.favoritesFilterCatalogId = els.favoritesCatalogFilter.value;
    renderFavoritesWorkspace(getFavoriteEntries());
  });
  els.favoritesResetFilter?.addEventListener("click", () => {
    state.favoritesFilterCatalogId = "";
    renderFavoritesWorkspace(getFavoriteEntries());
    requestAnimationFrame(() => els.favoritesCatalogFilter?.focus?.());
  });
  els.favoritesSelectAllVisible?.addEventListener("click", toggleAllVisibleFavoritesSelection);
  els.favoritesClearSelection?.addEventListener("click", clearFavoritesSelection);
  els.favoritesShareSelected?.addEventListener("click", () => shareSelectedFavorites());
  els.favoritesCompareSelected?.addEventListener("click", openFavoritesCompare);
  els.favoritesGrid?.addEventListener("change", handleFavoritesWorkspaceGridChange);
  els.favoritesGrid?.addEventListener("dragstart", handleFavoritesWorkspaceDragStart);
  els.favoritesGrid?.addEventListener("dragover", handleFavoritesWorkspaceDragOver);
  els.favoritesGrid?.addEventListener("drop", handleFavoritesWorkspaceDrop);
  els.favoritesGrid?.addEventListener("dragend", handleFavoritesWorkspaceDragEnd);

  els.favoriteNoteInput?.addEventListener("input", syncFavoriteNoteCount);
  els.favoriteNoteSave?.addEventListener("click", saveFavoriteNote);
  els.favoriteNoteCancel?.addEventListener("click", () => closeFavoriteNoteEditor());
  els.favoriteNoteClose?.addEventListener("click", () => closeFavoriteNoteEditor());
  els.favoriteNoteBackdrop?.addEventListener("click", () => closeFavoriteNoteEditor());
  els.favoriteNoteOverlay?.addEventListener("keydown", (event) => trapFavoriteWorkspaceDialogFocus(event, els.favoriteNoteOverlay, closeFavoriteNoteEditor));

  els.favoritesCompareClose?.addEventListener("click", () => closeFavoritesCompare());
  els.favoritesCompareBackdrop?.addEventListener("click", () => closeFavoritesCompare());
  els.favoritesCompareShare?.addEventListener("click", () => shareFavoritesComparison());
  els.favoritesCompareCopy?.addEventListener("click", () => copyFavoritesComparison());
  els.favoritesCompareGmail?.addEventListener("click", () => window.setTimeout(() => closeFavoritesCompare({ restoreFocus: false }), 0));
  els.favoritesCompareOverlay?.addEventListener("keydown", (event) => trapFavoriteWorkspaceDialogFocus(event, els.favoritesCompareOverlay, closeFavoritesCompare));
}
