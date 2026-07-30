"use strict";

import { state } from "../core/state.js";
import { errorMessage } from "../core/format.js";

/**
 * @param {{
 *   elements: ReturnType<typeof import("../core/dom.js").createControlPanelDom>["pdf"],
 *   controlApi: typeof import("../core/api.js").controlApi,
 *   catalogs: { catalogAt: (index: number) => ControlCatalogDto | undefined, applyPdfSelection: (payload: PdfSelectionResponseDto, index: number) => void, setSaveStatus: (text: string, kind: string) => void }
 * }} dependencies
 */
export function createPdfFeature({ elements, controlApi, catalogs }) {
  /** @param {number} index */
  async function pickPdfWithNativeDialog(index) {
    const catalog = catalogs.catalogAt(index);
    if (!catalog) return;
    catalogs.setSaveStatus("פותח חלון בחירת PDF בתוך assets/pdfs...", "");
    const payload = await controlApi.pickPdf({ currentPdf: catalog.pdf || "" });
    if (!("pdf" in payload)) {
      catalogs.setSaveStatus("בחירת PDF בוטלה.", "");
      return;
    }
    catalogs.applyPdfSelection(payload, index);
  }

  /** @param {number} index */
  async function open(index) {
    if (!catalogs.catalogAt(index)) return;
    try {
      await pickPdfWithNativeDialog(index);
    } catch (error) {
      state.pdfUploadCatalogIndex = index;
      elements.fileInput.value = "";
      catalogs.setSaveStatus(`לא הצלחתי לפתוח חלון בחירה מקומי (${errorMessage(error)}). נפתח חלון בחירת קובץ רגיל של הדפדפן כגיבוי.`, "err");
      elements.fileInput.click();
    }
  }

  async function uploadSelectedPdf() {
    const file = elements.fileInput.files && elements.fileInput.files[0];
    const index = state.pdfUploadCatalogIndex;
    state.pdfUploadCatalogIndex = null;
    if (!file || index === null || !Number.isInteger(index) || !catalogs.catalogAt(index)) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      catalogs.setSaveStatus("אפשר לבחור רק קובץ PDF.", "err");
      return;
    }
    catalogs.setSaveStatus(`שומר את ${file.name} בתוך assets/pdfs...`, "");
    try {
      const payload = await controlApi.uploadPdf(file);
      catalogs.applyPdfSelection(payload, index);
    } catch (error) {
      catalogs.setSaveStatus(errorMessage(error), "err");
    }
  }

  function bind() {
    elements.fileInput.addEventListener("change", uploadSelectedPdf);
  }

  return Object.freeze({ bind, open });
}
