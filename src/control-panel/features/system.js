"use strict";

import { escapeHtml } from "../core/format.js";

/** @param {ReturnType<typeof import("../core/dom.js").createControlPanelDom>["system"]} elements */
export function createSystemFeature(elements) {
  /** @param {ControlCountsDto} counts */
  function renderStats(counts) {
    const items = [
      ["קטלוגים", counts.catalogs], ["PDFים בתיקייה", counts.pdfs], ["PDFים שטרם נוספו לרשימה", counts.missingPdfs],
      ["מקורות PDF חסרים", counts.configuredMissingPdfs], ["מומרים", counts.converted], ["OCR כבוי", counts.ocrDisabled],
      ["שדות טקסונומיה חסרים", counts.taxonomyMissing]
    ];
    elements.stats.innerHTML = items.map(([label, value]) => `<div class="stat"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join("");
  }

  /** @param {() => void} onRefresh */
  function bind(onRefresh) {
    elements.refresh.addEventListener("click", onRefresh);
  }

  /** @param {string} message */
  function setServerAlert(message) {
    elements.serverAlert.innerHTML = message ? `${escapeHtml(message)}<br><span>הפקודה הנכונה: <code>.04-catalog-control-panel.bat</code></span>` : "";
    elements.serverAlert.classList.toggle("show", Boolean(message));
  }

  return Object.freeze({ bind, renderStats, setServerAlert, clearStats: () => { elements.stats.innerHTML = ""; } });
}
