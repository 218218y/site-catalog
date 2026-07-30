"use strict";

import { state } from "../core/state.js";
import { errorMessage, escapeHtml, eventElement } from "../core/format.js";

/**
 * @param {{
 *   elements: ReturnType<typeof import("../core/dom.js").createControlPanelDom>["footer"],
 *   controlApi: typeof import("../core/api.js").controlApi,
 *   applyCanonicalState: (state: ControlPanelStateDto) => void
 * }} dependencies
 */
export function createFooterFeature({ elements, controlApi, applyCanonicalState }) {
  const els = {
    footerSave: elements.save,
    footerSaveStatus: elements.saveStatus,
    footerEditorGroups: elements.editorGroups
  };

  /** @returns {Array<HTMLInputElement | HTMLTextAreaElement>} */
  function footerFields() {
    return Array.from(els.footerEditorGroups.querySelectorAll('[data-footer-field]')).filter(input => input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement);
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
      const payload = await controlApi.saveFooter({ footer: collectFooterContent() });
      applyCanonicalState(payload.state);
      const count = (payload.updatedPages || []).length;
      setFooterSaveStatus(`נשמר בהצלחה ועודכנו ${count || 6} קובצי HTML.`, 'ok');
    } catch (error) {
      setFooterSaveStatus(errorMessage(error), 'err');
    } finally {
      els.footerSave.disabled = false;
    }
  }

  function bind() {
    els.footerSave.addEventListener("click", saveFooter);
    els.footerEditorGroups.addEventListener("input", event => {
      if (eventElement(event)?.closest("[data-footer-field]")) {
        setFooterSaveStatus("יש שינויים שלא נשמרו בפוטר.", "");
      }
    });
  }

  function showLoadError() {
    setFooterSaveStatus("לא ניתן לטעון או לשמור את הפוטר בלי שרת לוח השליטה.", "err");
    els.footerSave.disabled = true;
  }

  return Object.freeze({ bind, render: renderFooterEditor, showLoadError });
}
