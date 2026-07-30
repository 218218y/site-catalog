"use strict";

import { state } from "../core/state.js";
import { errorMessage, escapeHtml, eventElement, groupKey, moveDirection, taxonomyKind } from "../core/format.js";

/**
 * @param {{
 *   elements: ReturnType<typeof import("../core/dom.js").createControlPanelDom>["taxonomy"],
 *   controlApi: typeof import("../core/api.js").controlApi,
 *   applyCanonicalState: (state: ControlPanelStateDto) => void,
 *   onCatalogsChanged: () => void,
 *   onCountsChanged: () => void,
 *   onTaxonomyChanged: () => void
 * }} dependencies
 */
export function createTaxonomyFeature({ elements, controlApi, applyCanonicalState, onCatalogsChanged, onCountsChanged, onTaxonomyChanged }) {
  const els = {
    taxonomySummary: elements.summary,
    taxonomyAlert: elements.alert,
    taxonomyCategories: elements.categories,
    taxonomySubcategories: elements.subcategories,
    taxonomySave: elements.save,
    taxonomySaveStatus: elements.saveStatus,
    taxonomyAddCategory: elements.addCategory,
    taxonomyAddSubcategory: elements.addSubcategory
  };

  /** @param {string} name @returns {number} */
  function taxonomyCategoryUsage(name) {
    return state.catalogs.filter(catalog => groupKey(catalog.category) === groupKey(name)).length;
  }

  /** @param {string} category @param {string} name @returns {number} */
  function taxonomySubcategoryUsage(category, name) {
    return state.catalogs.filter(catalog => groupKey(catalog.category) === groupKey(category) && groupKey(catalog.subcategory) === groupKey(name)).length;
  }

  /** @returns {string[]} */
  function taxonomyIssuesForState() {
    const issues = [];
    for (const category of state.taxonomy.categories || []) {
      if (!groupKey(category.slug)) issues.push(`${groupKey(category.name) || 'קטגוריה'}: חסר slug`);
      if (!groupKey(category.description)) issues.push(`${groupKey(category.name) || 'קטגוריה'}: חסר תיאור`);
    }
    for (const subcategory of state.taxonomy.subcategories || []) {
      const prefix = `${groupKey(subcategory.category) || 'ללא קטגוריה'} / ${groupKey(subcategory.name) || 'תת־קטגוריה'}`;
      if (!groupKey(subcategory.slug)) issues.push(`${prefix}: חסר slug`);
      if (!groupKey(subcategory.description)) issues.push(`${prefix}: חסר תיאור`);
    }
    return issues;
  }

  /** @returns {{categories: ControlTaxonomyItemDto[], subcategories: ControlTaxonomyItemDto[]}} */
  function taxonomyPayload() {
    return {
      categories: (state.taxonomy.categories || []).map(item => ({
        name: groupKey(item.name),
        slug: groupKey(item.slug).toLowerCase(),
        description: groupKey(item.description),
        originalName: groupKey(item.originalName || item.name)
      })),
      subcategories: (state.taxonomy.subcategories || []).map(item => ({
        category: groupKey(item.category),
        name: groupKey(item.name),
        slug: groupKey(item.slug).toLowerCase(),
        description: groupKey(item.description),
        originalCategory: groupKey(item.originalCategory || item.category),
        originalName: groupKey(item.originalName || item.name)
      }))
    };
  }

  function reconcileTaxonomyDraftFromCatalogs({ render = true } = {}) {
    const current = taxonomyPayload();
    const categoryMap = new Map(current.categories.map(item => [item.name, item]));
    const activeCategories = [];
    const activeCategorySet = new Set();
    const activeSubcategories = new Map();
    for (const catalog of state.catalogs) {
      const category = groupKey(catalog.category);
      const subcategory = groupKey(catalog.subcategory);
      if (category && !activeCategorySet.has(category)) {
        activeCategorySet.add(category);
        activeCategories.push(category);
      }
      if (category && subcategory) {
        const values = activeSubcategories.get(category) || [];
        if (!values.includes(subcategory)) values.push(subcategory);
        activeSubcategories.set(category, values);
      }
    }

    const categories = activeCategories.map(name => categoryMap.get(name) || { name, slug: '', description: '', originalName: name });
    for (const item of current.categories) {
      if (!activeCategorySet.has(item.name)) categories.push(item);
    }

    const subcategoryMap = new Map(current.subcategories.map(item => [`${item.category}\u0000${item.name}`, item]));
    const usedKeys = new Set();
    const subcategories = [];
    for (const category of categories.map(item => item.name)) {
      for (const name of activeSubcategories.get(category) || []) {
        const key = `${category}\u0000${name}`;
        usedKeys.add(key);
        subcategories.push(subcategoryMap.get(key) || { category, name, slug: '', description: '', originalCategory: category, originalName: name });
      }
      for (const item of current.subcategories) {
        const key = `${item.category}\u0000${item.name}`;
        if (item.category === category && !usedKeys.has(key)) {
          usedKeys.add(key);
          subcategories.push(item);
        }
      }
    }
    state.taxonomy = { ...state.taxonomy, categories, subcategories };
    if (render) renderTaxonomyEditor();
  }

  /** @param {string} selected @returns {string} */
  function taxonomyCategoryOptions(selected) {
    return (state.taxonomy.categories || []).map(item => `<option value="${escapeHtml(item.name)}" ${item.name === selected ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('');
  }

  /** @param {ControlTaxonomyItemDto} item @param {number} index @returns {string} */
  function taxonomyCategoryMarkup(item, index) {
    const usage = taxonomyCategoryUsage(item.name);
    const incomplete = !groupKey(item.slug) || !groupKey(item.description);
    const hasSubcategories = (state.taxonomy.subcategories || []).some(sub => sub.category === item.name);
    return `<article class="taxonomy-row ${incomplete ? 'is-incomplete' : ''} ${usage ? '' : 'is-unused'}" data-taxonomy-kind="category" data-index="${index}">
      <div class="taxonomy-row-head">
        <div class="taxonomy-row-title">
          <span>קטגוריה ${index + 1}</span>
          <span class="taxonomy-usage">${usage ? `${usage} קטלוגים` : 'לא בשימוש'}</span>
        </div>
        <div class="taxonomy-row-actions">
          <button class="secondary" type="button" data-taxonomy-move="up" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button class="secondary" type="button" data-taxonomy-move="down" ${index === state.taxonomy.categories.length - 1 ? 'disabled' : ''}>↓</button>
          <button class="danger" type="button" data-taxonomy-delete="category" ${usage || hasSubcategories ? 'disabled' : ''}>מחק</button>
        </div>
      </div>
      <div class="taxonomy-fields">
        <div class="taxonomy-field">
          <label>שם הקטגוריה</label>
          <input type="text" data-taxonomy-field="name" value="${escapeHtml(item.name)}" required />
        </div>
        <div class="taxonomy-field">
          <label>slug לכתובת</label>
          <input class="${groupKey(item.slug) ? '' : 'missing-field'}" type="text" dir="ltr" data-taxonomy-field="slug" value="${escapeHtml(item.slug)}" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="חסר — לדוגמה dining-tables" />
          <small>אנגלית קטנה, מספרים ומקפים בלבד.</small>
        </div>
        <div class="taxonomy-field">
          <label>תיאור לעמוד הקטגוריה</label>
          <textarea class="${groupKey(item.description) ? '' : 'missing-field'}" data-taxonomy-field="description" placeholder="חסר — יש להשלים תיאור ייחודי">${escapeHtml(item.description)}</textarea>
        </div>
      </div>
    </article>`;
  }

  /** @param {ControlTaxonomyItemDto} item @param {number} index @returns {string} */
  function taxonomySubcategoryMarkup(item, index) {
    const usage = taxonomySubcategoryUsage(item.category || '', item.name);
    const incomplete = !groupKey(item.slug) || !groupKey(item.description);
    const canMoveUp = index > 0 && state.taxonomy.subcategories[index - 1].category === item.category;
    const canMoveDown = index < state.taxonomy.subcategories.length - 1 && state.taxonomy.subcategories[index + 1].category === item.category;
    return `<article class="taxonomy-row ${incomplete ? 'is-incomplete' : ''} ${usage ? '' : 'is-unused'}" data-taxonomy-kind="subcategory" data-index="${index}">
      <div class="taxonomy-row-head">
        <div class="taxonomy-row-title">
          <span>${escapeHtml(item.category)} / ${escapeHtml(item.name)}</span>
          <span class="taxonomy-usage">${usage ? `${usage} קטלוגים` : 'לא בשימוש'}</span>
        </div>
        <div class="taxonomy-row-actions">
          <button class="secondary" type="button" data-taxonomy-move="up" ${canMoveUp ? '' : 'disabled'}>↑</button>
          <button class="secondary" type="button" data-taxonomy-move="down" ${canMoveDown ? '' : 'disabled'}>↓</button>
          <button class="danger" type="button" data-taxonomy-delete="subcategory" ${usage ? 'disabled' : ''}>מחק</button>
        </div>
      </div>
      <div class="taxonomy-fields">
        <div class="taxonomy-field">
          <label>קטגוריית אב</label>
          <select data-taxonomy-field="category">${taxonomyCategoryOptions(item.category || '')}</select>
          <label>שם תת־הקטגוריה</label>
          <input type="text" data-taxonomy-field="name" value="${escapeHtml(item.name)}" required />
        </div>
        <div class="taxonomy-field">
          <label>slug לכתובת</label>
          <input class="${groupKey(item.slug) ? '' : 'missing-field'}" type="text" dir="ltr" data-taxonomy-field="slug" value="${escapeHtml(item.slug)}" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" placeholder="חסר — לדוגמה kids-rooms" />
          <small>ה־slug יתווסף אחרי כתובת קטגוריית האב.</small>
        </div>
        <div class="taxonomy-field">
          <label>תיאור לעמוד תת־הקטגוריה</label>
          <textarea class="${groupKey(item.description) ? '' : 'missing-field'}" data-taxonomy-field="description" placeholder="חסר — יש להשלים תיאור ייחודי">${escapeHtml(item.description)}</textarea>
        </div>
      </div>
    </article>`;
  }

  function renderTaxonomyEditor() {
    const issues = taxonomyIssuesForState();
    state.taxonomy.issues = issues;
    state.taxonomy.complete = issues.length === 0;
    state.counts.taxonomyMissing = issues.length;
    onCountsChanged();
    els.taxonomySummary.innerHTML = `<span class="taxonomy-status ${issues.length ? 'incomplete' : 'ready'}">${issues.length ? `דורש השלמה · ${issues.length} שדות` : 'מוכן לבנייה'}</span>`;
    const added = state.taxonomy.autoAdded || { categories: [], subcategories: [] };
    const addedItems = [...(added.categories || []), ...(added.subcategories || [])];
    if (issues.length || addedItems.length) {
      const details = addedItems.length ? ` נוספו אוטומטית: ${addedItems.join(' | ')}.` : '';
      els.taxonomyAlert.hidden = false;
      els.taxonomyAlert.className = 'taxonomy-alert';
      els.taxonomyAlert.textContent = `${issues.length ? `יש להשלים ${issues.length} שדות לפני בנייה או העלאה.` : ''}${details}`.trim();
    } else {
      els.taxonomyAlert.hidden = true;
      els.taxonomyAlert.textContent = '';
    }
    els.taxonomyCategories.innerHTML = (state.taxonomy.categories || []).map(taxonomyCategoryMarkup).join('') || '<div class="taxonomy-empty">אין קטגוריות.</div>';
    els.taxonomySubcategories.innerHTML = (state.taxonomy.subcategories || []).map(taxonomySubcategoryMarkup).join('') || '<div class="taxonomy-empty">אין תתי־קטגוריות.</div>';
    onTaxonomyChanged();
  }

  /** @param {string} text @param {string} kind */
  function setTaxonomySaveStatus(text, kind) {
    els.taxonomySaveStatus.textContent = text;
    els.taxonomySaveStatus.className = `toast ${kind || ''}`;
  }

  function markTaxonomyUnsaved() {
    setTaxonomySaveStatus('יש שינויים שלא נשמרו בהגדרות הקטגוריות.', '');
  }

  /** @param {HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement} input @param {{commitRename?: boolean}} [options] */
  function updateTaxonomyField(input, { commitRename = false } = {}) {
    const row = input.closest('[data-taxonomy-kind]');
    if (!(row instanceof HTMLElement)) return;
    const kind = taxonomyKind(row.dataset.taxonomyKind);
    if (!kind) return;
    const index = Number(row.dataset.index);
    const collection = kind === 'category' ? state.taxonomy.categories : state.taxonomy.subcategories;
    const item = collection[index];
    const rawField = input.dataset.taxonomyField;
    if (!item || !rawField || !['name', 'slug', 'description', 'category', 'originalName', 'originalCategory'].includes(rawField)) return;
    const field = /** @type {keyof ControlTaxonomyItemDto} */ (rawField);
    const previous = item[field] || '';
    item[field] = input.value;
    if (commitRename && field === 'name' && groupKey(previous) !== groupKey(item.name)) {
      if (kind === 'category') {
        for (const subcategory of state.taxonomy.subcategories) {
          if (subcategory.category === previous) subcategory.category = item.name;
        }
        for (const catalog of state.catalogs) {
          if (groupKey(catalog.category) === groupKey(previous)) catalog.category = item.name;
        }
      } else {
        for (const catalog of state.catalogs) {
          if (groupKey(catalog.category) === groupKey(item.category) && groupKey(catalog.subcategory) === groupKey(previous)) catalog.subcategory = item.name;
        }
      }
      onCatalogsChanged();
      renderTaxonomyEditor();
    } else if (commitRename && kind === 'subcategory' && field === 'category' && previous !== item.category) {
      for (const catalog of state.catalogs) {
        if (groupKey(catalog.category) === groupKey(previous) && groupKey(catalog.subcategory) === groupKey(item.name)) catalog.category = item.category || '';
      }
      onCatalogsChanged();
      renderTaxonomyEditor();
    } else {
      const missing = (field === 'slug' || field === 'description') && !groupKey(item[field]);
      input.classList.toggle('missing-field', missing);
      row.classList.toggle('is-incomplete', !groupKey(item.slug) || !groupKey(item.description));
      const issues = taxonomyIssuesForState();
      state.taxonomy.issues = issues;
      state.counts.taxonomyMissing = issues.length;
      els.taxonomySummary.innerHTML = `<span class="taxonomy-status ${issues.length ? 'incomplete' : 'ready'}">${issues.length ? `דורש השלמה · ${issues.length} שדות` : 'מוכן לבנייה'}</span>`;
      onCountsChanged();
      onTaxonomyChanged();
    }
    markTaxonomyUnsaved();
  }

  /** @param {'category' | 'subcategory'} kind @param {number} index @param {'up' | 'down'} direction */
  function moveTaxonomyItem(kind, index, direction) {
    const collection = kind === 'category' ? state.taxonomy.categories : state.taxonomy.subcategories;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= collection.length) return;
    if (kind === 'subcategory' && collection[index].category !== collection[target].category) return;
    [collection[index], collection[target]] = [collection[target], collection[index]];
    renderTaxonomyEditor();
    markTaxonomyUnsaved();
  }

  /** @param {'category' | 'subcategory'} kind @param {number} index */
  function deleteTaxonomyItem(kind, index) {
    const collection = kind === 'category' ? state.taxonomy.categories : state.taxonomy.subcategories;
    const item = collection[index];
    if (!item) return;
    const usage = kind === 'category' ? taxonomyCategoryUsage(item.name) : taxonomySubcategoryUsage(item.category || '', item.name);
    if (usage) return;
    if (kind === 'category' && state.taxonomy.subcategories.some(sub => sub.category === item.name)) return;
    collection.splice(index, 1);
    renderTaxonomyEditor();
    markTaxonomyUnsaved();
  }

  function addTaxonomyCategory() {
    const name = groupKey(prompt('שם הקטגוריה החדשה:') || '');
    if (!name) return;
    if (state.taxonomy.categories.some(item => item.name === name)) {
      setTaxonomySaveStatus('קטגוריה בשם הזה כבר קיימת.', 'err');
      return;
    }
    state.taxonomy.categories.push({ name, slug: '', description: '', originalName: name });
    renderTaxonomyEditor();
    markTaxonomyUnsaved();
  }

  function addTaxonomySubcategory() {
    if (!state.taxonomy.categories.length) {
      setTaxonomySaveStatus('יש להוסיף קודם קטגוריה ראשית.', 'err');
      return;
    }
    const category = groupKey(prompt(`קטגוריית אב (${state.taxonomy.categories.map(item => item.name).join(', ')}):`, state.taxonomy.categories[0].name) || '');
    if (!state.taxonomy.categories.some(item => item.name === category)) {
      setTaxonomySaveStatus('קטגוריית האב אינה קיימת.', 'err');
      return;
    }
    const name = groupKey(prompt('שם תת־הקטגוריה החדשה:') || '');
    if (!name) return;
    if (state.taxonomy.subcategories.some(item => item.category === category && item.name === name)) {
      setTaxonomySaveStatus('תת־קטגוריה בשם הזה כבר קיימת בקטגוריית האב.', 'err');
      return;
    }
    state.taxonomy.subcategories.push({ category, name, slug: '', description: '', originalCategory: category, originalName: name });
    renderTaxonomyEditor();
    markTaxonomyUnsaved();
  }

  async function saveTaxonomy() {
    const taxonomyInputs = /** @type {Array<HTMLInputElement | HTMLSelectElement>} */ ([
      ...els.taxonomyCategories.querySelectorAll('input'),
      ...els.taxonomySubcategories.querySelectorAll('input, select')
    ]);
    const invalid = taxonomyInputs.find(input => !input.reportValidity());
    if (invalid) { invalid.focus(); return; }
    setTaxonomySaveStatus('שומר את הטקסונומיה ומעדכן את הפניות הקטלוגים...', '');
    els.taxonomySave.disabled = true;
    try {
      const payload = await controlApi.saveTaxonomy({ taxonomy: taxonomyPayload() });
      applyCanonicalState(payload.state);
      const warnings = payload.warnings || [];
      const routeLockUpdates = payload.routeLockUpdates || [];
      const routeLockText = routeLockUpdates.length
        ? ` נעילת כתובות SEO עודכנה אוטומטית עבור ${routeLockUpdates.length} נתיבים חדשים.`
        : '';
      setTaxonomySaveStatus(
        warnings.length
          ? `נשמר, אבל: ${warnings.join(' | ')}`
          : `הגדרות הקטגוריות נשמרו ועודכנו.${routeLockText}`,
        warnings.length ? 'err' : 'ok'
      );
    } catch (error) {
      setTaxonomySaveStatus(errorMessage(error), 'err');
    } finally {
      els.taxonomySave.disabled = false;
    }
  }


  /** @returns {Array<HTMLInputElement | HTMLTextAreaElement>} */

  /** @param {Event} event */
  function handleTaxonomyChange(event) {
    const input = eventElement(event)?.closest("[data-taxonomy-field]");
    if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) return;
    updateTaxonomyField(input, { commitRename: ["name", "category"].includes(input.dataset.taxonomyField || "") });
  }

  /** @param {Event} event */
  function handleTaxonomyClick(event) {
    const button = eventElement(event)?.closest("button");
    if (!(button instanceof HTMLButtonElement)) return;
    const row = button.closest("[data-taxonomy-kind]");
    if (!(row instanceof HTMLElement)) return;
    const kind = taxonomyKind(row.dataset.taxonomyKind);
    const index = Number(row.dataset.index);
    const direction = moveDirection(button.dataset.taxonomyMove);
    if (!kind) return;
    if (direction) moveTaxonomyItem(kind, index, direction);
    if (button.dataset.taxonomyDelete) deleteTaxonomyItem(kind, index);
  }

  function bind() {
    els.taxonomyCategories.addEventListener("input", event => {
      const input = eventElement(event)?.closest("[data-taxonomy-field]");
      if ((input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) && input.dataset.taxonomyField !== "name") updateTaxonomyField(input);
    });
    els.taxonomySubcategories.addEventListener("input", event => {
      const input = eventElement(event)?.closest("[data-taxonomy-field]");
      if ((input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) && !["name", "category"].includes(input.dataset.taxonomyField || "")) updateTaxonomyField(input);
    });
    els.taxonomyCategories.addEventListener("change", handleTaxonomyChange);
    els.taxonomySubcategories.addEventListener("change", handleTaxonomyChange);
    els.taxonomyCategories.addEventListener("click", handleTaxonomyClick);
    els.taxonomySubcategories.addEventListener("click", handleTaxonomyClick);
    els.taxonomyAddCategory.addEventListener("click", addTaxonomyCategory);
    els.taxonomyAddSubcategory.addEventListener("click", addTaxonomySubcategory);
    els.taxonomySave.addEventListener("click", saveTaxonomy);
  }

  function showLoadError() {
    setTaxonomySaveStatus("לא ניתן לטעון או לשמור טקסונומיה בלי שרת לוח השליטה.", "err");
    els.taxonomySave.disabled = true;
    els.taxonomyCategories.innerHTML = '<div class="taxonomy-empty">לא ניתן לטעון קטגוריות.</div>';
    els.taxonomySubcategories.innerHTML = '<div class="taxonomy-empty">לא ניתן לטעון תתי־קטגוריות.</div>';
  }

  /** @param {string} message */
  function showBlockingError(message) {
    setTaxonomySaveStatus(message, "err");
    elements.title.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return Object.freeze({
    bind,
    render: renderTaxonomyEditor,
    payload: taxonomyPayload,
    issues: taxonomyIssuesForState,
    reconcileFromCatalogs: reconcileTaxonomyDraftFromCatalogs,
    markUnsaved: markTaxonomyUnsaved,
    showBlockingError,
    showLoadError
  });
}
