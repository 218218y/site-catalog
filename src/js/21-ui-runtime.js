/**
 * Source module: 21-ui-runtime.js
 * Cross-feature feedback, tooltip, document-lock, and top-layer coordination.
 */

import { tooltips } from "../runtime/tooltip-manager.js";
import { requiredElement } from "./02-dom-contracts.js";
import { featureInterfacesByEscapePriority, getFeatureInterface, uiRuntime } from "./10-app-state.js";

/** @typedef {{duration?:number, tone?:string}} ActionToastOptions */

/** @type {Readonly<{siteActionToast:HTMLElement}>} */
const uiElements = Object.freeze({
  siteActionToast: requiredElement("siteActionToast")
});

/** @param {unknown} value @returns {value is HTMLElement} */
function isHtmlElement(value) {
  return value instanceof HTMLElement;
}

/** @param {unknown} value @param {FocusOptions} [options] @returns {boolean} */
function focusHtmlElement(value, options) {
  if (!(value instanceof HTMLElement)) return false;
  value.focus(options);
  return true;
}

function hasHoverPointer() {
  if (typeof window.matchMedia !== "function") return true;
  const primaryFineHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const anyFineHover = window.matchMedia("(any-hover: hover) and (any-pointer: fine)").matches;
  return primaryFineHover || anyFineHover;
}

/** @param {Event|null|undefined} event */
function isTouchLikePointer(event) {
  return Boolean(
    event
    && "pointerType" in event
    && (event.pointerType === "touch" || event.pointerType === "pen")
  );
}

/** @param {Element|null|undefined} button */
function getTooltipText(button) {
  return tooltips.getText(button || null) || button?.getAttribute?.("title") || "";
}

/** @param {Element|null|undefined} button @param {string} text @param {Record<string, unknown>} [options] */
function setTooltipText(button, text, options = {}) {
  if (!button) return;
  tooltips.setText(button, text, options);
}

/** @param {Element|null|undefined} button @param {string} message */
function flashActionButton(button, message) {
  if (!(button instanceof HTMLElement) || !message) return;
  const originalTooltip = getTooltipText(button);
  setTooltipText(button, message);
  button.classList.remove("reader-icon-button-feedback");
  void button.offsetWidth;
  button.classList.add("reader-icon-button-done", "reader-icon-button-feedback");
  window.setTimeout(() => {
    setTooltipText(button, originalTooltip);
    button.classList.remove("reader-icon-button-done", "reader-icon-button-feedback");
  }, 1200);
}

/** @param {string} message */
function actionToastTone(message) {
  if (message === "נשמר" || message === "התמונה נשמרה") return "saved";
  if (message === "הוסר" || message.includes("הוסרו")) return "removed";
  if (message.includes("קישור")) return "link";
  return "info";
}

/** @param {string} message @param {number|ActionToastOptions} [options] */
function showActionToast(message, options = {}) {
  if (!uiElements.siteActionToast || !message) return;
  const normalizedOptions = typeof options === "number" ? { duration: options } : options;
  const duration = Math.max(1000, Number(normalizedOptions.duration) || 1000);

  window.clearTimeout(uiRuntime.actionToastTimer);
  uiElements.siteActionToast.textContent = message;
  uiElements.siteActionToast.dataset.tone = normalizedOptions.tone || actionToastTone(message);
  uiElements.siteActionToast.classList.remove("hidden", "visible");
  void uiElements.siteActionToast.offsetWidth;
  window.requestAnimationFrame(() => uiElements.siteActionToast.classList.add("visible"));
  uiRuntime.actionToastTimer = window.setTimeout(() => {
    uiElements.siteActionToast.classList.remove("visible");
    window.setTimeout(() => {
      if (!uiElements.siteActionToast.classList.contains("visible")) {
        uiElements.siteActionToast.classList.add("hidden");
      }
    }, 180);
  }, duration);
}

function syncDocumentLock() {
  const documentLocked = Boolean(
    getFeatureInterface("favorites")?.requiresDocumentLock() ||
    getFeatureInterface("inquiry")?.requiresDocumentLock() ||
    getFeatureInterface("viewer")?.requiresDocumentLock()
  );
  const viewerOpen = Boolean(getFeatureInterface("viewer")?.isViewerOpen());
  document.body.classList.toggle("no-scroll", documentLocked);
  document.documentElement.classList.toggle("viewer-open", viewerOpen);
}

/** @param {KeyboardEvent} event */
function handleTopLayerEscape(event) {
  if (event.key !== "Escape" || event.defaultPrevented) return false;

  for (const api of featureInterfacesByEscapePriority()) {
    if (api.closeTopLayer(event) !== true) continue;
    event.preventDefault();
    return true;
  }
  return false;
}

export {
  flashActionButton,
  focusHtmlElement,
  hasHoverPointer,
  handleTopLayerEscape,
  isHtmlElement,
  isTouchLikePointer,
  setTooltipText,
  showActionToast,
  syncDocumentLock
};
