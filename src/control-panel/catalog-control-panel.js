"use strict";

/** @type {ControlPanelState} */
const state = { apiVersion: 1, catalogs: [], taxonomy: { categories: [], subcategories: [], issues: [], complete: true, autoAdded: { categories: [], subcategories: [] } }, footer: {}, footerEditor: { groups: [] }, actions: [], counts: {}, pdfFiles: [], configuredMissingPdfs: [], mutation: {}, pdfUploadCatalogIndex: null, deleteDialogIndex: null, pendingAssetDeletes: [], activeJobId: null, polling: null };
/** @template {HTMLElement} T @param {string} id @param {{new(): T}} elementType @returns {T} */
function requiredElement(id, elementType) {
  const element = document.getElementById(id);
  if (!(element instanceof elementType)) {
    throw new Error(`Control panel markup #${id} must be a ${elementType.name}`);
  }
  return element;
}

/** @param {unknown} error @returns {string} */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || 'שגיאה לא ידועה');
}

/** @param {Event} event @returns {Element | null} */
function eventElement(event) {
  return event.target instanceof Element ? event.target : null;
}

/** @param {string | undefined} value @returns {'up' | 'down' | null} */
function moveDirection(value) {
  return value === 'up' || value === 'down' ? value : null;
}

/** @param {string | undefined} value @returns {'category' | 'subcategory' | null} */
function taxonomyKind(value) {
  return value === 'category' || value === 'subcategory' ? value : null;
}

/** @type {ControlElements} */
const els = {
  stats: requiredElement('stats', HTMLElement),
  rows: requiredElement('catalogRows', HTMLTableSectionElement),
  actions: requiredElement('actions', HTMLElement),
  filter: requiredElement('catalogFilter', HTMLInputElement),
  save: requiredElement('saveCatalogs', HTMLButtonElement),
  saveStatus: requiredElement('saveStatus', HTMLElement),
  footerSave: requiredElement('saveFooter', HTMLButtonElement),
  footerSaveStatus: requiredElement('footerSaveStatus', HTMLElement),
  footerEditorGroups: requiredElement('footerEditorGroups', HTMLElement),
  taxonomySummary: requiredElement('taxonomySummary', HTMLElement),
  taxonomyAlert: requiredElement('taxonomyAlert', HTMLElement),
  taxonomyCategories: requiredElement('taxonomyCategories', HTMLElement),
  taxonomySubcategories: requiredElement('taxonomySubcategories', HTMLElement),
  taxonomySave: requiredElement('saveTaxonomy', HTMLButtonElement),
  taxonomySaveStatus: requiredElement('taxonomySaveStatus', HTMLElement),
  taxonomyAddCategory: requiredElement('addTaxonomyCategory', HTMLButtonElement),
  taxonomyAddSubcategory: requiredElement('addTaxonomySubcategory', HTMLButtonElement),
  jobStatus: requiredElement('jobStatus', HTMLElement),
  cancelJob: requiredElement('cancelJob', HTMLButtonElement),
  jobLog: requiredElement('jobLog', HTMLElement),
  jobHistory: requiredElement('jobHistory', HTMLElement),
  refresh: requiredElement('refreshState', HTMLButtonElement),
  serverAlert: requiredElement('serverAlert', HTMLElement),
  pdfFileInput: requiredElement('pdfFileInput', HTMLInputElement),
  deleteCatalogBackdrop: requiredElement('deleteCatalogBackdrop', HTMLElement),
  deleteCatalogTitle: requiredElement('deleteCatalogTitle', HTMLElement),
  deleteCatalogSummary: requiredElement('deleteCatalogSummary', HTMLElement),
  deleteCatalogCancel: requiredElement('deleteCatalogCancel', HTMLButtonElement),
  deleteCatalogListOnly: requiredElement('deleteCatalogListOnly', HTMLButtonElement),
  deleteCatalogWithAssets: requiredElement('deleteCatalogWithAssets', HTMLButtonElement)
};

/** @param {unknown} value @returns {string} */
function escapeHtml(value) {
  const htmlEscapes = /** @type {Record<string, string>} */ ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'});
  return String(value ?? '').replace(/[&<>'"]/g, char => htmlEscapes[char] || char);
}

function controlServerHelp() {
  return 'הדף הזה נפתח בלי שרת לוח השליטה. אל תפתח אותו דרך .05-start-server.bat, npx serve או שרת האתר הראשי. הפעל את הקובץ .04-catalog-control-panel.bat, או פתח ישירות: http://127.0.0.1:8765/catalog-control-panel.html';
}

/** @param {string} message */
function setServerAlert(message) {
  els.serverAlert.innerHTML = message ? `${escapeHtml(message)}<br><span>הפקודה הנכונה: <code>.04-catalog-control-panel.bat</code></span>` : '';
  els.serverAlert.classList.toggle('show', Boolean(message));
}

/** @param {string} path @param {RequestInit} [options] @returns {Promise<ControlApiResponse>} */
async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      ...options
    });
  } catch (error) {
    throw new Error(`${controlServerHelp()} (${errorMessage(error)})`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    if (path.startsWith('/api/') && (response.status === 404 || response.status === 405)) {
      throw new Error(controlServerHelp());
    }
    throw new Error(data.error || 'בקשה נכשלה');
  }
  return data;
}

/** @param {ControlPanelStateDto | undefined} data @param {{clearPendingAssetDeletes?: boolean}} [options] */
function applyServerState(data, { clearPendingAssetDeletes = false } = {}) {
  if (!data || data.apiVersion !== 1) {
    throw new Error('גרסת API לא תואמת. רענן את לוח השליטה והפעל מחדש את השרת.');
  }
  state.apiVersion = data.apiVersion;
  state.catalogs = (data.catalogs || []).map(catalog => ({ ...catalog, originalId: catalog.originalId || catalog.id }));
  state.actions = data.actions || [];
  state.taxonomy = data.taxonomy || { categories: [], subcategories: [], issues: [], complete: true, autoAdded: { categories: [], subcategories: [] } };
  state.footer = data.footer || {};
  state.footerEditor = data.footerEditor || { groups: [] };
  state.counts = data.counts || {};
  state.pdfFiles = data.pdfFiles || [];
  state.configuredMissingPdfs = data.configuredMissingPdfs || [];
  state.mutation = data.mutation || {};
  if (clearPendingAssetDeletes) state.pendingAssetDeletes = [];
}

function renderCanonicalState() {
  renderStats(state.counts);
  renderCatalogs();
  renderTaxonomyEditor();
  renderFooterEditor();
  renderActions();
}

async function loadState() {
  const data = await api('/api/state');
  setServerAlert('');
  applyServerState(/** @type {ControlPanelStateDto} */ (data), { clearPendingAssetDeletes: true });
  renderCanonicalState();
  const jobs = data.jobs || [];
  renderJobHistory(jobs);
  const activeJob = jobs.find(job => ['running', 'canceling'].includes(job.status));
  if (activeJob && state.activeJobId !== activeJob.id) {
    state.activeJobId = activeJob.id;
    pollJob();
  } else if (!activeJob && !state.activeJobId) {
    syncJobCancelButton(null);
  }
}

/** @param {ControlCountsDto} counts */
function renderStats(counts) {
  const items = [
    ['קטלוגים', counts.catalogs ?? 0],
    ['PDFים בתיקייה', counts.pdfs ?? 0],
    ['PDFים שטרם נוספו לרשימה', counts.missingPdfs ?? 0],
    ['מקורות PDF חסרים', counts.configuredMissingPdfs ?? 0],
    ['מומרים', counts.converted ?? 0],
    ['OCR כבוי', counts.ocrDisabled ?? 0],
    ['שדות טקסונומיה חסרים', counts.taxonomyMissing ?? 0]
  ];
  els.stats.innerHTML = items.map(([label, value]) => `<div class="stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('');
}


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
  renderStats(state.counts);
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
  renderActions();
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
  const field = input.dataset.taxonomyField;
  if (!item || !field) return;
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
    renderCatalogs();
    renderTaxonomyEditor();
  } else if (commitRename && kind === 'subcategory' && field === 'category' && previous !== item.category) {
    for (const catalog of state.catalogs) {
      if (groupKey(catalog.category) === groupKey(previous) && groupKey(catalog.subcategory) === groupKey(item.name)) catalog.category = item.category || '';
    }
    renderCatalogs();
    renderTaxonomyEditor();
  } else {
    const missing = (field === 'slug' || field === 'description') && !groupKey(item[field]);
    input.classList.toggle('missing-field', missing);
    row.classList.toggle('is-incomplete', !groupKey(item.slug) || !groupKey(item.description));
    const issues = taxonomyIssuesForState();
    state.taxonomy.issues = issues;
    state.counts.taxonomyMissing = issues.length;
    els.taxonomySummary.innerHTML = `<span class="taxonomy-status ${issues.length ? 'incomplete' : 'ready'}">${issues.length ? `דורש השלמה · ${issues.length} שדות` : 'מוכן לבנייה'}</span>`;
    renderStats(state.counts);
    renderActions();
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
    const payload = await api('/api/taxonomy', {
      method: 'POST',
      body: JSON.stringify({ taxonomy: taxonomyPayload() })
    });
    applyServerState(payload.state);
    renderCanonicalState();
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
function footerFields() {
  return Array.from(els.footerEditorGroups.querySelectorAll('[data-footer-field]'));
}

/** @param {ControlFooterFieldDto} field @returns {string} */
function footerFieldMarkup(field) {
  const key = String(field.key || '');
  const inputId = `footer-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const direction = field.dir ? ` dir="${escapeHtml(field.dir)}"` : '';
  const required = field.required === false ? '' : ' required';
  const help = field.help ? `<small>${escapeHtml(field.help)}</small>` : '';
  return `<div class="footer-field">
    <label for="${escapeHtml(inputId)}">${escapeHtml(field.label || key)}</label>
    <input
      id="${escapeHtml(inputId)}"
      type="${escapeHtml(field.type || 'text')}"
      maxlength="${escapeHtml(field.maxLength || 240)}"
      data-footer-field="${escapeHtml(key)}"
      value="${escapeHtml(state.footer[key] ?? '')}"${direction}${required}
    />
    ${help}
  </div>`;
}

function renderFooterEditor() {
  const groups = Array.isArray(state.footerEditor && state.footerEditor.groups)
    ? state.footerEditor.groups
    : [];
  if (!groups.length) {
    els.footerEditorGroups.innerHTML = '<div class="notice">מבנה שדות הפוטר לא התקבל מהשרת. רענן את לוח הבקרה לאחר הפעלת .04-catalog-control-panel.bat.</div>';
    els.footerSave.disabled = true;
    setFooterSaveStatus('לא ניתן לערוך את הפוטר בלי סכמת שדות תקינה.', 'err');
    return;
  }

  els.footerEditorGroups.innerHTML = groups.map(group => `<fieldset class="footer-editor-group" data-footer-group="${escapeHtml(group.id || '')}">
    <legend>${escapeHtml(group.title || '')}</legend>
    <p class="footer-editor-group-description">${escapeHtml(group.description || '')}</p>
    <div class="footer-fields">${(group.fields || []).map(footerFieldMarkup).join('')}</div>
  </fieldset>`).join('');
  els.footerSave.disabled = false;
  setFooterSaveStatus('', '');
}

/** @returns {Record<string, string>} */
function collectFooterContent() {
  return Object.fromEntries(footerFields().map(input => [input.dataset.footerField, input.value]));
}

/** @param {string} text @param {string} kind */
function setFooterSaveStatus(text, kind) {
  els.footerSaveStatus.textContent = text;
  els.footerSaveStatus.className = `toast ${kind || ''}`;
}

async function saveFooter() {
  const invalid = footerFields().find(input => !input.reportValidity());
  if (invalid) {
    invalid.focus();
    return;
  }
  setFooterSaveStatus('בודק את התוכן ובונה מחדש את כל דפי האתר...', '');
  els.footerSave.disabled = true;
  try {
    const payload = await api('/api/footer', {
      method: 'POST',
      body: JSON.stringify({ footer: collectFooterContent() })
    });
    applyServerState(payload.state);
    renderCanonicalState();
    const count = (payload.updatedPages || []).length;
    setFooterSaveStatus(`נשמר בהצלחה ועודכנו ${count || 6} קובצי HTML.`, 'ok');
  } catch (error) {
    setFooterSaveStatus(errorMessage(error), 'err');
  } finally {
    els.footerSave.disabled = false;
  }
}

function isFilterActive() {
  return Boolean(els.filter.value.trim());
}

/** @param {string} [message] */
function markUnsaved(message = 'יש שינויים שלא נשמרו.') {
  setSaveStatus(message, '');
}

/** @param {unknown} value @returns {string} */
function groupKey(value) {
  return String(value ?? '').trim();
}

/** @param {unknown} value @param {string} fallback @returns {string} */
function groupLabel(value, fallback) {
  const label = groupKey(value);
  return label || fallback;
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

/** @param {File} file @returns {Promise<ControlApiResponse>} */
async function postPdfFile(file) {
  const formData = new FormData();
  formData.append('pdf', file, file.name);
  let response;
  try {
    response = await fetch('/api/pdf-upload', {
      method: 'POST',
      body: formData,
      cache: 'no-store'
    });
  } catch (error) {
    throw new Error(`${controlServerHelp()} (${errorMessage(error)})`);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    throw new Error(data.error || 'העלאת PDF נכשלה');
  }
  return data;
}

/** @param {ControlApiResponse} payload @param {number} index */
function applyPdfSelectionPayload(payload, index) {
  const pdfPath = payload.pdf && payload.pdf.path;
  if (!pdfPath) throw new Error('השרת לא החזיר נתיב PDF תקין');
  state.catalogs[index].pdf = pdfPath;
  state.pdfFiles = payload.pdfFiles || state.pdfFiles;
  if (payload.state && payload.state.counts) {
    state.counts = payload.state.counts;
    renderStats(state.counts);
  }
  renderCatalogs();
  const statusLabels = /** @type {Record<string, string>} */ ({
    selected: 'נבחר PDF מתוך assets/pdfs.',
    existing: 'נבחר PDF שכבר נמצא בתוך assets/pdfs.',
    copied: 'ה־PDF הועתק אל assets/pdfs.',
    created: 'ה־PDF נשמר בתוך assets/pdfs.'
  });
  const statusText = statusLabels[payload.pdf?.status || ''] || 'מקור ה־PDF עודכן.';
  markUnsaved(`${statusText} לחץ שמור שינויים כדי לעדכן את catalogs.config.json; אחר כך הרץ המרה רגילה כדי לבנות תמונות מה־PDF החדש.`);
}

/** @param {number} index */
async function pickPdfWithNativeDialog(index) {
  setSaveStatus('פותח חלון בחירת PDF בתוך assets/pdfs...', '');
  const payload = await api('/api/pdf-pick-native', {
    method: 'POST',
    body: JSON.stringify({ currentPdf: state.catalogs[index].pdf || '' })
  });
  if (payload.canceled) {
    setSaveStatus('בחירת PDF בוטלה.', '');
    return;
  }
  applyPdfSelectionPayload(payload, index);
}

/** @param {number} index */
async function openPdfFileDialog(index) {
  const catalog = state.catalogs[index];
  if (!catalog) return;
  try {
    await pickPdfWithNativeDialog(index);
  } catch (error) {
    state.pdfUploadCatalogIndex = index;
    els.pdfFileInput.value = '';
    setSaveStatus(`לא הצלחתי לפתוח חלון בחירה מקומי (${errorMessage(error)}). נפתח חלון בחירת קובץ רגיל של הדפדפן כגיבוי.`, 'err');
    els.pdfFileInput.click();
  }
}

async function uploadSelectedPdf() {
  const file = els.pdfFileInput.files && els.pdfFileInput.files[0];
  const index = state.pdfUploadCatalogIndex;
  state.pdfUploadCatalogIndex = null;
  if (!file || index === null || !Number.isInteger(index) || !state.catalogs[index]) return;
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    setSaveStatus('אפשר לבחור רק קובץ PDF.', 'err');
    return;
  }
  setSaveStatus(`שומר את ${file.name} בתוך assets/pdfs...`, '');
  try {
    const payload = await postPdfFile(file);
    applyPdfSelectionPayload(payload, index);
  } catch (error) {
    setSaveStatus(errorMessage(error), 'err');
  }
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
    state.catalogs[index][field] = input.value;
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
  renderStats(state.counts);
  markUnsaved(deleteAssets
    ? 'הקטלוג הוסר מהרשימה וסומנה מחיקה של ה־PDF ותיקיית התמונות. הפעולה הפיזית תתבצע בלחיצה על שמור שינויים.'
    : 'הקטלוג הוסר מהרשימה בלבד. לחץ שמור שינויים כדי לעדכן את הקובץ והאתר.');
}

function renderActions() {
  const incompleteTaxonomy = taxonomyIssuesForState().length > 0;
  els.actions.innerHTML = state.actions.map(action => {
    const taxonomyBlocked = incompleteTaxonomy && ['bundle_r2', 'cloudflare_pages_deploy'].includes(action.key);
    const disabled = Boolean(action.disabled || taxonomyBlocked);
    const reason = taxonomyBlocked ? 'יש להשלים את שדות הטקסונומיה לפני בנייה או העלאה.' : (action.disabledReason || '');
    return `<div class="action">
      <strong>${escapeHtml(action.label)}</strong>
      <p>${escapeHtml(action.description)}</p>
      ${reason ? `<p class="taxonomy-usage">${escapeHtml(reason)}</p>` : ''}
      <button type="button" data-action="${escapeHtml(action.key)}" ${disabled ? 'disabled' : ''}>הפעל</button>
    </div>`;
  }).join('');
}

async function saveCatalogs() {
  setSaveStatus('בודק שינויי ID, מחיקות נכסים ושומר בעסקה קנונית אחת...', '');
  els.save.disabled = true;
  try {
    reconcileTaxonomyDraftFromCatalogs({ render: false });
    const payload = await api('/api/catalogs', {
      method: 'POST',
      body: JSON.stringify({ catalogs: state.catalogs, taxonomy: taxonomyPayload(), assetDeletes: state.pendingAssetDeletes })
    });
    applyServerState(payload.state, { clearPendingAssetDeletes: true });
    renderCanonicalState();
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
function syncJobCancelButton(job) {
  const active = Boolean(job && ['running', 'canceling'].includes(job.status));
  els.cancelJob.hidden = !active;
  els.cancelJob.disabled = !active || job?.status === 'canceling';
  els.cancelJob.textContent = job?.status === 'canceling' ? 'עוצר ומחזיר מצב קודם…' : 'עצירת הפעולה';
}

async function cancelActiveJob() {
  if (!state.activeJobId || !confirm('לעצור את הפעולה הפעילה? אם התחילה עסקה, המערכת תחזיר את המצב הקודם לפני שתאפשר פעולה חדשה.')) return;
  els.cancelJob.disabled = true;
  els.cancelJob.textContent = 'עוצר ומחזיר מצב קודם…';
  try {
    const payload = await api(`/api/jobs/${state.activeJobId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    syncJobCancelButton(payload.job);
    pollJob();
  } catch (error) {
    els.jobStatus.textContent = errorMessage(error);
    els.jobStatus.className = 'toast err';
    els.cancelJob.disabled = false;
    els.cancelJob.textContent = 'עצירת הפעולה';
  }
}

/** @param {string} actionKey */
async function runAction(actionKey) {
  const action = state.actions.find(item => item.key === actionKey);
  if (!action) return;
  if (action.disabled || (['bundle_r2', 'cloudflare_pages_deploy'].includes(action.key) && taxonomyIssuesForState().length)) {
    setTaxonomySaveStatus(action.disabledReason || 'יש להשלים את שדות הטקסונומיה לפני בנייה או העלאה.', 'err');
    document.getElementById('taxonomyCategoriesTitle')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  let pruneMissingPdfs = false;
  const conversionActions = ['convert', 'convert_force', 'refresh_ocr'];
  if (conversionActions.includes(action.key) && state.configuredMissingPdfs.length) {
    const missingList = state.configuredMissingPdfs
      .map(item => `• ${item.title || item.id} — ${item.pdf}`)
      .join('\n');
    pruneMissingPdfs = confirm(
      `נמצאו ${state.configuredMissingPdfs.length} קטלוגים שמקור ה־PDF שלהם חסר:\n\n${missingList}\n\n` +
      'אישור יסיר במפורש את הקטלוגים החסרים מהרשימה, מהתמונות ומאינדקס החיפוש. ביטול יעצור בלי לשנות דבר.'
    );
    if (!pruneMissingPdfs) return;
  } else if (!confirm(`להפעיל: ${action.label}?`)) {
    return;
  }
  els.jobLog.textContent = 'מתחיל הרצה...';
  els.jobStatus.textContent = 'רץ...';
  els.jobStatus.className = 'toast status-running';
  try {
    const payload = await api('/api/run', {
      method: 'POST',
      body: JSON.stringify({
        action: actionKey,
        pruneMissingPdfs,
        confirmedMissingPdfIds: pruneMissingPdfs ? state.configuredMissingPdfs.map(item => item.id) : []
      })
    });
    if (!payload.job) throw new Error('השרת לא החזיר פרטי עבודה תקינים.');
    state.activeJobId = payload.job.id;
    syncJobCancelButton(payload.job);
    pollJob();
  } catch (error) {
    els.jobLog.textContent = errorMessage(error);
    els.jobStatus.textContent = 'נכשל בהתחלה';
    els.jobStatus.className = 'toast err';
  }
}

async function pollJob() {
  if (!state.activeJobId) return;
  if (state.polling !== null) clearTimeout(state.polling);
  try {
    const job = /** @type {ControlJobDto} */ (await api(`/api/jobs/${state.activeJobId}`));
    els.jobLog.textContent = (job.log || []).join('\n') || 'אין עדיין פלט.';
    els.jobLog.scrollTop = els.jobLog.scrollHeight;
    els.jobStatus.textContent = `${job.label} · ${statusText(job.status)}`;
    els.jobStatus.className = `toast status-${job.status}`;
    syncJobCancelButton(job);
    if (['running', 'canceling'].includes(job.status)) {
      state.polling = setTimeout(pollJob, 500);
    } else {
      state.activeJobId = null;
      syncJobCancelButton(null);
      await loadState();
    }
  } catch (error) {
    els.jobStatus.textContent = errorMessage(error);
    els.jobStatus.className = 'toast err';
  }
}

/** @param {string} status @returns {string} */
function statusText(status) {
  if (status === 'running') return 'רץ';
  if (status === 'canceling') return 'נעצר ומחזיר מצב קודם';
  if (status === 'canceled') return 'נעצר והמצב הקודם שוחזר';
  if (status === 'success') return 'הסתיים בהצלחה';
  if (status === 'failed') return 'נכשל';
  return status;
}

/** @param {ControlJobDto[]} jobs */
function renderJobHistory(jobs) {
  els.jobHistory.innerHTML = (jobs || []).slice(0, 5).map(job => `<div class="job-line">
    <strong>${escapeHtml(job.label)}</strong>
    <span class="status-${escapeHtml(job.status)}">${escapeHtml(statusText(job.status))}</span>
  </div>`).join('');
}

els.rows.addEventListener('input', event => {
  const input = eventElement(event)?.closest('input, textarea, select');
  if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) syncCatalogFromInput(input);
});
els.rows.addEventListener('change', event => {
  const input = eventElement(event)?.closest('input, textarea, select');
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) return;
  syncCatalogFromInput(input);
  if (input.dataset.field === 'category' || input.dataset.field === 'subcategory') {
    reconcileTaxonomyDraftFromCatalogs();
    markTaxonomyUnsaved();
  }
});
els.rows.addEventListener('click', event => {
  const button = eventElement(event)?.closest('button');
  if (!(button instanceof HTMLButtonElement)) return;
  const categoryDirection = moveDirection(button.dataset.moveCategory);
  if (categoryDirection) {
    moveCategoryBlock(Number(button.dataset.categoryBlockIndex), categoryDirection);
    return;
  }
  const subcategoryDirection = moveDirection(button.dataset.moveSubcategory);
  if (subcategoryDirection) {
    moveSubcategoryBlock(Number(button.dataset.subcategoryBlockIndex), subcategoryDirection, button);
    return;
  }
  const row = button.closest('tr');
  const index = Number(row && row.dataset.index);
  if (!Number.isInteger(index)) return;
  if (button.dataset.pdfSelect) {
    openPdfFileDialog(index);
    return;
  }
  const catalogDirection = moveDirection(button.dataset.move);
  if (catalogDirection) moveCatalog(index, catalogDirection);
  if (button.dataset.delete) openDeleteCatalogDialog(index);
});
els.cancelJob.addEventListener('click', cancelActiveJob);

els.actions.addEventListener('click', event => {
  const button = eventElement(event)?.closest('[data-action]');
  if (button instanceof HTMLElement && button.dataset.action) runAction(button.dataset.action);
});
els.filter.addEventListener('input', renderCatalogs);
els.save.addEventListener('click', saveCatalogs);
els.taxonomyCategories.addEventListener('input', event => {
  const input = eventElement(event)?.closest('[data-taxonomy-field]');
  if ((input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) && input.dataset.taxonomyField !== 'name') updateTaxonomyField(input);
});
els.taxonomySubcategories.addEventListener('input', event => {
  const input = eventElement(event)?.closest('[data-taxonomy-field]');
  if ((input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement) && !['name', 'category'].includes(input.dataset.taxonomyField || '')) updateTaxonomyField(input);
});
/** @param {Event} event */
function handleTaxonomyChange(event) {
  const input = eventElement(event)?.closest('[data-taxonomy-field]');
  if (!(input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement || input instanceof HTMLSelectElement)) return;
  updateTaxonomyField(input, { commitRename: ['name', 'category'].includes(input.dataset.taxonomyField || '') });
}
/** @param {Event} event */
function handleTaxonomyClick(event) {
  const button = eventElement(event)?.closest('button');
  if (!(button instanceof HTMLButtonElement)) return;
  const row = button.closest('[data-taxonomy-kind]');
  if (!(row instanceof HTMLElement)) return;
  const kind = taxonomyKind(row.dataset.taxonomyKind);
  const index = Number(row.dataset.index);
  const direction = moveDirection(button.dataset.taxonomyMove);
  if (!kind) return;
  if (direction) moveTaxonomyItem(kind, index, direction);
  if (button.dataset.taxonomyDelete) deleteTaxonomyItem(kind, index);
}
els.taxonomyCategories.addEventListener('change', handleTaxonomyChange);
els.taxonomySubcategories.addEventListener('change', handleTaxonomyChange);
els.taxonomyCategories.addEventListener('click', handleTaxonomyClick);
els.taxonomySubcategories.addEventListener('click', handleTaxonomyClick);
els.taxonomyAddCategory.addEventListener('click', addTaxonomyCategory);
els.taxonomyAddSubcategory.addEventListener('click', addTaxonomySubcategory);
els.taxonomySave.addEventListener('click', saveTaxonomy);
els.footerSave.addEventListener('click', saveFooter);
els.footerEditorGroups.addEventListener('input', event => {
  if (eventElement(event)?.closest('[data-footer-field]')) {
    setFooterSaveStatus('יש שינויים שלא נשמרו בפוטר.', '');
  }
});
els.refresh.addEventListener('click', () => {
  loadState().catch(showLoadError);
});
els.pdfFileInput.addEventListener('change', uploadSelectedPdf);
els.deleteCatalogCancel.addEventListener('click', closeDeleteCatalogDialog);
els.deleteCatalogListOnly.addEventListener('click', () => confirmDeleteCatalog(false));
els.deleteCatalogWithAssets.addEventListener('click', () => confirmDeleteCatalog(true));
els.deleteCatalogBackdrop.addEventListener('click', event => {
  if (event.target === els.deleteCatalogBackdrop) closeDeleteCatalogDialog();
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !els.deleteCatalogBackdrop.hidden) closeDeleteCatalogDialog();
});

/** @param {unknown} error */
function showLoadError(error) {
  const message = errorMessage(error) || 'שגיאה בטעינת מצב';
  setServerAlert(message);
  els.stats.innerHTML = '';
  els.rows.innerHTML = '<tr><td colspan="11">לא ניתן לטעון קטלוגים כי שרת ה־API של לוח השליטה לא פעיל.</td></tr>';
  els.actions.innerHTML = '<div class="notice">הפעל <span dir="ltr">.04-catalog-control-panel.bat</span> מתוך תיקיית הפרויקט, ואז הדף ייטען עם כל הקטלוגים והכפתורים.</div>';
  setTaxonomySaveStatus('לא ניתן לטעון או לשמור טקסונומיה בלי שרת לוח השליטה.', 'err');
  els.taxonomySave.disabled = true;
  els.taxonomyCategories.innerHTML = '<div class="taxonomy-empty">לא ניתן לטעון קטגוריות.</div>';
  els.taxonomySubcategories.innerHTML = '<div class="taxonomy-empty">לא ניתן לטעון תתי־קטגוריות.</div>';
  setFooterSaveStatus('לא ניתן לטעון או לשמור את הפוטר בלי שרת לוח השליטה.', 'err');
  els.footerSave.disabled = true;
  els.jobLog.textContent = message;
  els.jobStatus.textContent = 'שגיאה בטעינת מצב';
  els.jobStatus.className = 'toast err';
}

loadState().catch(showLoadError);
