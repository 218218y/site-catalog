"use strict";

import { state } from "../core/state.js";
import { errorMessage, escapeHtml, eventElement, groupKey, groupLabel, moveDirection } from "../core/format.js";

/** @param {string | undefined} field @returns {'id' | 'title' | 'description' | 'category' | 'subcategory' | null} */
function catalogTextField(field) {
  switch (field) {
    case "id":
    case "title":
    case "description":
    case "category":
    case "subcategory":
      return field;
    default:
      return null;
  }
}

/**
 * @param {{
 *   elements: ReturnType<typeof import("../core/dom.js").createControlPanelDom>["catalogs"],
 *   controlApi: typeof import("../core/api.js").controlApi,
 *   applyCanonicalState: (state: ControlPanelStateDto, options?: {clearPendingAssetDeletes?: boolean}) => void,
 *   taxonomy: { payload: () => ControlTaxonomyDraftDto, reconcileFromCatalogs: (options?: {render?: boolean}) => void, markUnsaved: () => void },
 *   onCountsChanged: () => void,
 *   onPdfRequested: (index: number) => void
 * }} dependencies
 */
export function createCatalogsFeature({ elements, controlApi, applyCanonicalState, taxonomy, onCountsChanged, onPdfRequested }) {
  const els = {
    rows: elements.rows, filter: elements.filter, save: elements.save, saveStatus: elements.saveStatus,
    deleteCatalogBackdrop: elements.deleteCatalogBackdrop, deleteCatalogTitle: elements.deleteCatalogTitle,
    deleteCatalogSummary: elements.deleteCatalogSummary, deleteCatalogCancel: elements.deleteCatalogCancel,
    deleteCatalogListOnly: elements.deleteCatalogListOnly, deleteCatalogWithAssets: elements.deleteCatalogWithAssets
  };

  function isFilterActive() {
    return Boolean(els.filter.value.trim());
  }

  /** @param {string} [message] */
  function markUnsaved(message = 'יש שינויים שלא נשמרו.') {
    setSaveStatus(message, '');
  }

  /** @param {ControlCatalogDto | undefined} a @param {ControlCatalogDto | undefined} b @returns {boolean} */
  function sameCatalogGroup(a, b) {
    return Boolean(a && b && groupKey(a.category) === groupKey(b.category) && groupKey(a.subcategory) === groupKey(b.subcategory));
  }

  /** @returns {CatalogBlock[]} */
  function consecutiveCategoryBlocks() {
    /** @type {CatalogBlock[]} */
    const blocks = [];
    for (let index = 0; index < state.catalogs.length; index += 1) {
      const catalog = state.catalogs[index];
      const key = groupKey(catalog.category);
      const previous = blocks[blocks.length - 1];
      if (previous && previous.key === key) {
        previous.end = index;
        previous.count += 1;
      } else {
        blocks.push({ key, label: groupLabel(catalog.category, 'ללא קטגוריה'), start: index, end: index, count: 1 });
      }
    }
    return blocks;
  }

  /** @param {CatalogBlock} categoryBlock @returns {SubcategoryBlock[]} */
  function consecutiveSubcategoryBlocks(categoryBlock) {
    /** @type {SubcategoryBlock[]} */
    const blocks = [];
    for (let index = categoryBlock.start; index <= categoryBlock.end; index += 1) {
      const catalog = state.catalogs[index];
      const key = groupKey(catalog.subcategory);
      const previous = blocks[blocks.length - 1];
      if (previous && previous.key === key) {
        previous.end = index;
        previous.count += 1;
      } else {
        blocks.push({ key, label: groupLabel(catalog.subcategory, 'ללא תת־קטגוריה'), start: index, end: index, count: 1, categoryStart: categoryBlock.start, categoryEnd: categoryBlock.end });
      }
    }
    return blocks;
  }

  /** @param {'category' | 'subcategory'} type @param {CatalogBlock | SubcategoryBlock} block @param {number} blockIndex @param {number} blockCount @param {boolean} showSubcategory @param {number | null} [parentCategoryBlockIndex] @returns {string} */
  function separatorRow(type, block, blockIndex, blockCount, showSubcategory, parentCategoryBlockIndex = null) {
    const isCategory = type === 'category';
    const label = isCategory ? block.label : block.label;
    const kicker = isCategory ? 'קטגוריה' : 'תת־קטגוריה';
    const itemText = block.count === 1 ? 'קטלוג אחד' : `${block.count} קטלוגים`;
    const moveAttr = isCategory ? 'data-move-category' : 'data-move-subcategory';
    const indexAttr = isCategory ? 'data-category-block-index' : 'data-subcategory-block-index';
    const className = isCategory ? 'category-strip' : 'subcategory-strip';
    const titlePrefix = isCategory ? 'החלף את כל הקטגוריה עם הקטגוריה' : 'החלף את כל תת־הקטגוריה עם תת־הקטגוריה';
    const hiddenAttribute = (!isCategory && !showSubcategory) ? ' hidden' : '';
    const disabledUp = blockIndex === 0 || isFilterActive() ? 'disabled' : '';
    const disabledDown = blockIndex === blockCount - 1 || isFilterActive() ? 'disabled' : '';
    const parentAttr = !isCategory && Number.isInteger(parentCategoryBlockIndex) ? ` data-parent-category-block-index="${parentCategoryBlockIndex}"` : '';
    return `<tr class="group-separator ${isCategory ? 'category-separator' : 'subcategory-separator'}"${hiddenAttribute}>
      <td colspan="11">
        <div class="group-strip ${className}">
          <div class="group-title">
            <span class="group-kicker">${escapeHtml(kicker)}</span>
            <span>${escapeHtml(label)}</span>
            <span class="group-count">${escapeHtml(itemText)}</span>
          </div>
          <div class="group-actions">
            <button class="icon-btn" type="button" ${moveAttr}="up" ${indexAttr}="${blockIndex}"${parentAttr} title="${titlePrefix} שמעליה" ${disabledUp}>↑</button>
            <button class="icon-btn" type="button" ${moveAttr}="down" ${indexAttr}="${blockIndex}"${parentAttr} title="${titlePrefix} שמתחתיה" ${disabledDown}>↓</button>
          </div>
        </div>
      </td>
    </tr>`;
  }

  /** @param {ControlCatalogDto} catalog @param {number} index @returns {string} */
  function catalogRow(catalog, index) {
    const status = catalog.status || { state: 'missing', label: 'לא הומר' };
    const filterActive = isFilterActive();
    const canMoveUp = index > 0 && sameCatalogGroup(catalog, state.catalogs[index - 1]) && !filterActive;
    const canMoveDown = index < state.catalogs.length - 1 && sameCatalogGroup(catalog, state.catalogs[index + 1]) && !filterActive;
    return `<tr data-index="${index}">
      <td class="order-cell">
        <div class="order-controls">
          <span class="order-number">${index + 1}</span>
          <button class="icon-btn" type="button" data-move="up" title="העבר קטלוג אחד למעלה בתוך אותה קטגוריה/תת־קטגוריה" ${canMoveUp ? '' : 'disabled'}>↑</button>
          <button class="icon-btn" type="button" data-move="down" title="העבר קטלוג אחד למטה בתוך אותה קטגוריה/תת־קטגוריה" ${canMoveDown ? '' : 'disabled'}>↓</button>
        </div>
      </td>
      <td>
        <label class="toggle" title="האם להריץ OCR בקטלוג הזה">
          <input type="checkbox" data-field="ocr" ${catalog.ocr !== false ? 'checked' : ''} />
          <span class="switch" aria-hidden="true"></span>
          <span>${catalog.ocr !== false ? 'כן' : 'לא'}</span>
        </label>
      </td>
      <td>
        <select class="page-number-start-select" data-field="pageNumberStart" title="בחר 0 כאשר תמונת השער אינה ממוספרת והעמוד שאחריה הוא עמוד 1">
          <option value="1" ${catalog.pageNumberStart === 0 ? '' : 'selected'}>מתחיל ב־1 (ברירת מחדל)</option>
          <option value="0" ${catalog.pageNumberStart === 0 ? 'selected' : ''}>מתחיל ב־0 (שער לא ממוספר)</option>
        </select>
      </td>
      <td><input class="title-input" type="text" data-field="title" value="${escapeHtml(catalog.title || '')}" /></td>
      <td><textarea class="description-input" data-field="description" placeholder="תיאור קצר שיופיע באתר">${escapeHtml(catalog.description || '')}</textarea></td>
      <td><input class="category-input" type="text" data-field="category" value="${escapeHtml(catalog.category || '')}" /></td>
      <td><input class="subcategory-input" type="text" data-field="subcategory" value="${escapeHtml(catalog.subcategory || '')}" /></td>
      <td><span class="badge ${escapeHtml(status.state)}">${escapeHtml(status.label)}</span></td>
      <td><input class="id-input" type="text" data-field="id" value="${escapeHtml(catalog.id || '')}" pattern="[a-z0-9][a-z0-9-]*" title="ID חייב להיות באנגלית קטנה, מספרים ומקפים בלבד. ID מקורי: ${escapeHtml(catalog.originalId || catalog.id || '')}" /></td>
      <td class="pdf-cell">
        <div class="pdf-control">
          <button class="pdf-select-btn secondary" type="button" data-pdf-select="catalog" title="בחר PDF בחלון מקומי שנפתח כברירת מחדל בתוך assets/pdfs">בחר PDF</button>
          <span class="pdf-path" title="${escapeHtml(catalog.pdf)}">${escapeHtml(catalog.pdf)}</span>
        </div>
      </td>
      <td><button class="icon-btn delete-btn" type="button" data-delete="catalog" title="הסר את הקטלוג מהרשימה">מחק</button></td>
    </tr>`;
  }

  function renderCatalogs() {
    const query = els.filter.value.trim().toLowerCase();
    const filterActive = isFilterActive();
    if (filterActive) {
      const rows = state.catalogs
        .map((catalog, index) => ({ catalog, index }))
        .filter(({catalog}) => [catalog.id, catalog.title, catalog.description, catalog.category, catalog.subcategory, catalog.pdf].join(' ').toLowerCase().includes(query))
        .map(({catalog, index}) => catalogRow(catalog, index))
        .join('');
      els.rows.innerHTML = rows || '<tr><td colspan="11">לא נמצאו קטלוגים.</td></tr>';
      return;
    }

    const categoryBlocks = consecutiveCategoryBlocks();
    /** @type {string[]} */
    const rows = [];
    categoryBlocks.forEach((categoryBlock, categoryBlockIndex) => {
      rows.push(separatorRow('category', categoryBlock, categoryBlockIndex, categoryBlocks.length, true));
      const subcategoryBlocks = consecutiveSubcategoryBlocks(categoryBlock);
      const showSubcategoryRows = subcategoryBlocks.length > 1 || subcategoryBlocks.some(block => block.key);
      subcategoryBlocks.forEach((subcategoryBlock, subcategoryBlockIndex) => {
        rows.push(separatorRow('subcategory', subcategoryBlock, subcategoryBlockIndex, subcategoryBlocks.length, showSubcategoryRows, categoryBlockIndex));
        for (let index = subcategoryBlock.start; index <= subcategoryBlock.end; index += 1) {
          rows.push(catalogRow(state.catalogs[index], index));
        }
      });
    });
    els.rows.innerHTML = rows.join('') || '<tr><td colspan="11">לא נמצאו קטלוגים.</td></tr>';
  }

  /** @param {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} input */
  function syncCatalogFromInput(input) {
    const row = input.closest('tr');
    if (!row) return;
    const index = Number(row.dataset.index);
    const field = input.dataset.field;
    if (!Number.isInteger(index) || !state.catalogs[index] || !field) return;
    if (field === 'ocr') {
      if (!(input instanceof HTMLInputElement)) return;
      state.catalogs[index].ocr = input.checked;
      const label = input.parentElement?.querySelector('span:last-child');
      if (label) label.textContent = input.checked ? 'כן' : 'לא';
    } else if (field === 'pageNumberStart') {
      if (!(input instanceof HTMLSelectElement)) return;
      state.catalogs[index].pageNumberStart = input.value === '0' ? 0 : 1;
    } else {
      const textField = catalogTextField(field);
      if (!textField) return;
      state.catalogs[index][textField] = input.value;
    }
    if (field === 'id') {
      markUnsaved('יש שינוי ID. בשמירה תתבצע החלפת שם לתיקיית assets/pages ועדכון search-overrides אם צריך. ה-ID חייב להיות באנגלית קטנה, מספרים ומקפים.');
    } else if (field === 'category' || field === 'subcategory') {
      markUnsaved('יש שינוי קטגוריה/תת־קטגוריה. בשמירה הקטלוגים יקובצו מחדש לפי הסדר המעודכן.');
    } else if (field === 'pageNumberStart') {
      markUnsaved('מספור העמודים השתנה. התמונות נשארות ללא שינוי, ובשמירה האתר ימפה מחדש את הכתובות, החיפוש והצגת העמודים.');
    } else {
      markUnsaved('יש שינויים שלא נשמרו.');
    }
  }

  /** @param {number} index @param {'up' | 'down'} direction */
  function moveCatalog(index, direction) {
    if (isFilterActive()) {
      setSaveStatus('כדי לשנות סדר בלי הפתעות, נקה קודם את שדה החיפוש.', 'err');
      return;
    }
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= state.catalogs.length) return;
    if (!sameCatalogGroup(state.catalogs[index], state.catalogs[target])) {
      setSaveStatus('קטלוג בודד אפשר להזיז רק בתוך אותה קטגוריה ותת־קטגוריה. להזזת בלוק שלם השתמש בחצי ההפרדה.', 'err');
      return;
    }
    [state.catalogs[index], state.catalogs[target]] = [state.catalogs[target], state.catalogs[index]];
    renderCatalogs();
    markUnsaved('הסדר השתנה. לחץ שמור שינויים כדי לעדכן את הקובץ והאתר.');
  }

  /** @param {number} firstStart @param {number} firstEnd @param {number} secondStart @param {number} secondEnd */
  function swapAdjacentRanges(firstStart, firstEnd, secondStart, secondEnd) {
    const first = state.catalogs.slice(firstStart, firstEnd);
    const second = state.catalogs.slice(secondStart, secondEnd);
    state.catalogs.splice(firstStart, secondEnd - firstStart, ...second, ...first);
  }

  /** @param {number} blockIndex @param {'up' | 'down'} direction */
  function moveCategoryBlock(blockIndex, direction) {
    if (isFilterActive()) {
      setSaveStatus('כדי לשנות סדר בלי הפתעות, נקה קודם את שדה החיפוש.', 'err');
      return;
    }
    const blocks = consecutiveCategoryBlocks();
    const current = blocks[blockIndex];
    if (!current) return;
    if (direction === 'up') {
      const previous = blocks[blockIndex - 1];
      if (!previous) return;
      swapAdjacentRanges(previous.start, previous.end + 1, current.start, current.end + 1);
    } else {
      const next = blocks[blockIndex + 1];
      if (!next) return;
      swapAdjacentRanges(current.start, current.end + 1, next.start, next.end + 1);
    }
    renderCatalogs();
    markUnsaved('סדר הקטגוריות השתנה. לחץ שמור שינויים כדי לעדכן את הקובץ והאתר.');
  }

  /** @param {number} blockIndex @param {'up' | 'down'} direction @param {HTMLButtonElement} button */
  function moveSubcategoryBlock(blockIndex, direction, button) {
    if (isFilterActive()) {
      setSaveStatus('כדי לשנות סדר בלי הפתעות, נקה קודם את שדה החיפוש.', 'err');
      return;
    }
    const categoryBlockIndex = Number(button.dataset.parentCategoryBlockIndex);
    const categoryBlock = consecutiveCategoryBlocks()[categoryBlockIndex];
    if (!categoryBlock) return;
    const blocks = consecutiveSubcategoryBlocks(categoryBlock);
    const current = blocks[blockIndex];
    if (!current) return;
    if (direction === 'up') {
      const previous = blocks[blockIndex - 1];
      if (!previous) return;
      swapAdjacentRanges(previous.start, previous.end + 1, current.start, current.end + 1);
    } else {
      const next = blocks[blockIndex + 1];
      if (!next) return;
      swapAdjacentRanges(current.start, current.end + 1, next.start, next.end + 1);
    }
    renderCatalogs();
    markUnsaved('סדר תתי־הקטגוריות השתנה. לחץ שמור שינויים כדי לעדכן את הקובץ והאתר.');
  }

  /** @param {ControlCatalogDto} catalog @param {boolean} deleteAssets @returns {ControlAssetDeleteDto} */
  function catalogDeleteRequest(catalog, deleteAssets) {
    return {
      id: catalog.id || '',
      originalId: catalog.originalId || catalog.id || '',
      pdf: catalog.pdf || '',
      deletePdf: Boolean(deleteAssets),
      deletePages: Boolean(deleteAssets)
    };
  }

  /** @param {number} index */
  function openDeleteCatalogDialog(index) {
    const catalog = state.catalogs[index];
    if (!catalog) return;
    state.deleteDialogIndex = index;
    const label = catalog.title || catalog.id || `קטלוג #${index + 1}`;
    const id = catalog.id || '';
    const originalId = catalog.originalId || id;
    const pages = originalId ? `assets/pages/${originalId}` : 'assets/pages/[ללא ID]';
    els.deleteCatalogTitle.textContent = `מחיקת קטלוג · ${label}`;
    els.deleteCatalogSummary.innerHTML = `
      <strong>${escapeHtml(label)}</strong>
      <code>ID: ${escapeHtml(id || '—')}</code>
      <code>PDF: ${escapeHtml(catalog.pdf || '—')}</code>
      <code>תמונות: ${escapeHtml(pages)}</code>
    `;
    els.deleteCatalogBackdrop.hidden = false;
    setTimeout(() => els.deleteCatalogListOnly.focus(), 0);
  }

  function closeDeleteCatalogDialog() {
    els.deleteCatalogBackdrop.hidden = true;
    state.deleteDialogIndex = null;
  }

  /** @param {boolean} deleteAssets */
  function confirmDeleteCatalog(deleteAssets) {
    const index = state.deleteDialogIndex;
    if (index === null || !Number.isInteger(index)) {
      closeDeleteCatalogDialog();
      return;
    }
    const catalog = state.catalogs[index];
    if (!catalog) {
      closeDeleteCatalogDialog();
      return;
    }
    state.pendingAssetDeletes.push(catalogDeleteRequest(catalog, deleteAssets));
    state.catalogs.splice(index, 1);
    closeDeleteCatalogDialog();
    renderCatalogs();
    state.counts = {
      ...state.counts,
      catalogs: state.catalogs.length,
      converted: state.catalogs.filter(item => item.status && item.status.state === 'ready').length,
      ocrDisabled: state.catalogs.filter(item => item.ocr === false).length
    };
    onCountsChanged();
    markUnsaved(deleteAssets
      ? 'הקטלוג הוסר מהרשימה וסומנה מחיקה של ה־PDF ותיקיית התמונות. הפעולה הפיזית תתבצע בלחיצה על שמור שינויים.'
      : 'הקטלוג הוסר מהרשימה בלבד. לחץ שמור שינויים כדי לעדכן את הקובץ והאתר.');
  }

  async function saveCatalogs() {
    setSaveStatus('בודק שינויי ID, מחיקות נכסים ושומר בעסקה קנונית אחת...', '');
    els.save.disabled = true;
    try {
      taxonomy.reconcileFromCatalogs({ render: false });
      const payload = await controlApi.saveCatalogs({ catalogs: state.catalogs, taxonomy: taxonomy.payload(), assetDeletes: state.pendingAssetDeletes });
      applyCanonicalState(payload.state, { clearPendingAssetDeletes: true });
      const warnings = payload.warnings || [];
      const deletedAssets = payload.deletedAssets || [];
      const routeLockUpdates = payload.routeLockUpdates || [];
      const routeLockText = routeLockUpdates.length
        ? ` נעילת כתובות SEO עודכנה אוטומטית עבור ${routeLockUpdates.length} נתיבים חדשים.`
        : '';
      const successText = deletedAssets.length
        ? `נשמר בהצלחה. נמחקו נכסים פיזיים: ${deletedAssets.join(' | ')}.${routeLockText}`
        : `נשמר בהצלחה.${routeLockText}`;
      setSaveStatus(warnings.length ? `נשמר, אבל: ${warnings.join(' | ')}` : successText, warnings.length ? 'err' : 'ok');
    } catch (error) {
      setSaveStatus(errorMessage(error), 'err');
    } finally {
      els.save.disabled = false;
    }
  }

  /** @param {string} text @param {string} kind */
  function setSaveStatus(text, kind) {
    els.saveStatus.textContent = text;
    els.saveStatus.className = `toast ${kind || ''}`;
  }

  /** @param {ControlJobDto | null | undefined} job */

  /** @param {PdfSelectionResponseDto} payload @param {number} index */
  function applyPdfSelection(payload, index) {
    const catalog = state.catalogs[index];
    if (!catalog || !payload.pdf.path) throw new Error("השרת לא החזיר נתיב PDF תקין");
    catalog.pdf = payload.pdf.path;
    state.pdfFiles = payload.pdfFiles.map(item => ({ ...item }));
    state.counts = { ...payload.state.counts };
    onCountsChanged();
    renderCatalogs();
    const labels = /** @type {Record<string, string>} */ ({ selected: "נבחר PDF מתוך assets/pdfs.", existing: "נבחר PDF שכבר נמצא בתוך assets/pdfs.", copied: "ה־PDF הועתק אל assets/pdfs.", created: "ה־PDF נשמר בתוך assets/pdfs." });
    const text = labels[payload.pdf.status || ""] || "מקור ה־PDF עודכן.";
    markUnsaved(`${text} לחץ שמור שינויים כדי לעדכן את catalogs.config.json; אחר כך הרץ המרה רגילה כדי לבנות תמונות מה־PDF החדש.`);
  }

  function bind() {
    els.rows.addEventListener("input", event => {
      const input = eventElement(event)?.closest("input, textarea, select");
      if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) syncCatalogFromInput(input);
    });
    els.rows.addEventListener("change", event => {
      const input = eventElement(event)?.closest("input, textarea, select");
      if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) return;
      syncCatalogFromInput(input);
      if (input.dataset.field === "category" || input.dataset.field === "subcategory") {
        taxonomy.reconcileFromCatalogs();
        taxonomy.markUnsaved();
      }
    });
    els.rows.addEventListener("click", event => {
      const button = eventElement(event)?.closest("button");
      if (!(button instanceof HTMLButtonElement)) return;
      const categoryDirection = moveDirection(button.dataset.moveCategory);
      if (categoryDirection) { moveCategoryBlock(Number(button.dataset.categoryBlockIndex), categoryDirection); return; }
      const subcategoryDirection = moveDirection(button.dataset.moveSubcategory);
      if (subcategoryDirection) { moveSubcategoryBlock(Number(button.dataset.subcategoryBlockIndex), subcategoryDirection, button); return; }
      const row = button.closest("tr");
      const index = Number(row && row.dataset.index);
      if (!Number.isInteger(index)) return;
      if (button.dataset.pdfSelect) { onPdfRequested(index); return; }
      const catalogDirection = moveDirection(button.dataset.move);
      if (catalogDirection) moveCatalog(index, catalogDirection);
      if (button.dataset.delete) openDeleteCatalogDialog(index);
    });
    els.filter.addEventListener("input", renderCatalogs);
    els.save.addEventListener("click", saveCatalogs);
    els.deleteCatalogCancel.addEventListener("click", closeDeleteCatalogDialog);
    els.deleteCatalogListOnly.addEventListener("click", () => confirmDeleteCatalog(false));
    els.deleteCatalogWithAssets.addEventListener("click", () => confirmDeleteCatalog(true));
    els.deleteCatalogBackdrop.addEventListener("click", event => { if (event.target === els.deleteCatalogBackdrop) closeDeleteCatalogDialog(); });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !els.deleteCatalogBackdrop.hidden) closeDeleteCatalogDialog(); });
  }

  function showLoadError() {
    els.rows.innerHTML = '<tr><td colspan="11">לא ניתן לטעון קטלוגים כי שרת ה־API של לוח השליטה לא פעיל.</td></tr>';
  }

  /** @param {number} index @returns {ControlCatalogDto | undefined} */
  function catalogAt(index) { return state.catalogs[index]; }

  return Object.freeze({
    bind, render: renderCatalogs, markUnsaved, setSaveStatus, applyPdfSelection, catalogAt, showLoadError
  });
}
