"use strict";

/** @param {unknown} error @returns {string} */
export function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || "שגיאה לא ידועה");
}

/** @param {Event} event @returns {Element | null} */
export function eventElement(event) {
  return event.target instanceof Element ? event.target : null;
}

/** @param {string | undefined} value @returns {'up' | 'down' | null} */
export function moveDirection(value) {
  return value === "up" || value === "down" ? value : null;
}

/** @param {string | undefined} value @returns {'category' | 'subcategory' | null} */
export function taxonomyKind(value) {
  return value === "category" || value === "subcategory" ? value : null;
}

/** @param {unknown} value @returns {string} */
export function escapeHtml(value) {
  const escapes = /** @type {Record<string, string>} */ ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" });
  return String(value ?? "").replace(/[&<>'"]/g, char => escapes[char] || char);
}

/** @param {unknown} value @returns {string} */
export function groupKey(value) {
  return String(value ?? "").trim();
}

/** @param {unknown} value @param {string} fallback @returns {string} */
export function groupLabel(value, fallback) {
  const label = groupKey(value);
  return label || fallback;
}
