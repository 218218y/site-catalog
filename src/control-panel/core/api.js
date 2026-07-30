"use strict";

import { errorMessage } from "./format.js";

function controlServerHelp() {
  return "הדף הזה נפתח בלי שרת לוח השליטה. אל תפתח אותו דרך .05-start-server.bat, npx serve או שרת האתר הראשי. הפעל את הקובץ .04-catalog-control-panel.bat, או פתח ישירות: http://127.0.0.1:8765/catalog-control-panel.html";
}

/** @template T @param {string} path @param {RequestInit} [options] @returns {Promise<T>} */
async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(path, { cache: "no-store", ...options });
  } catch (error) {
    throw new Error(`${controlServerHelp()} (${errorMessage(error)})`);
  }
  const data = /** @type {T & Partial<ErrorResponseDto>} */ (await response.json().catch(() => ({})));
  if (!response.ok || data.ok === false) {
    if (path.startsWith("/api/") && (response.status === 404 || response.status === 405)) {
      throw new Error(controlServerHelp());
    }
    throw new Error(data.error || "בקשה נכשלה");
  }
  return data;
}

/** @template T @param {string} path @param {unknown} body @returns {Promise<T>} */
function postJson(path, body) {
  return requestJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
}

export const controlApi = Object.freeze({
  /** @returns {Promise<ControlPanelStateDto>} */
  getState() {
    return requestJson("/api/state");
  },
  /** @param {CatalogSaveRequestDto} request @returns {Promise<CatalogSaveResponseDto>} */
  saveCatalogs(request) {
    return postJson("/api/catalogs", request);
  },
  /** @param {TaxonomySaveRequestDto} request @returns {Promise<TaxonomySaveResponseDto>} */
  saveTaxonomy(request) {
    return postJson("/api/taxonomy", request);
  },
  /** @param {FooterSaveRequestDto} request @returns {Promise<FooterSaveResponseDto>} */
  saveFooter(request) {
    return postJson("/api/footer", request);
  },
  /** @param {PdfPickRequestDto} request @returns {Promise<PdfPickResponseDto>} */
  pickPdf(request) {
    return postJson("/api/pdf-pick-native", request);
  },
  /** @param {File} file @returns {Promise<PdfUploadResponseDto>} */
  uploadPdf(file) {
    const formData = new FormData();
    formData.append("pdf", file, file.name);
    return requestJson("/api/pdf-upload", { method: "POST", body: formData });
  },
  /** @param {RunActionRequestDto} request @returns {Promise<RunActionResponseDto>} */
  runAction(request) {
    return postJson("/api/run", request);
  },
  /** @param {string} jobId @returns {Promise<ControlJobDto>} */
  getJob(jobId) {
    return requestJson(`/api/jobs/${encodeURIComponent(jobId)}`);
  },
  /** @param {string} jobId @returns {Promise<CancelJobResponseDto>} */
  cancelJob(jobId) {
    return postJson(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, {});
  }
});
