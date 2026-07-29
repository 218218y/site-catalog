/**
 * Source module: 02-dom-contracts.js
 * Typed DOM lookup and event-target contracts shared by runtime owners.
 */

/** @param {string} id @returns {HTMLElement|null} */
const $ = (id) => document.getElementById(id);
/** @param {string} id @returns {HTMLImageElement|null} */
const $image = (id) => /** @type {HTMLImageElement|null} */ (document.getElementById(id));

/**
 * Resolve markup that is mandatory for a loaded route feature.
 * @param {string} id
 * @returns {HTMLElement}
 */
function requiredElement(id) {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Required application element is missing: #${id}`);
  return element;
}

/** @param {string} id @returns {HTMLButtonElement} */
const $requiredButton = (id) => /** @type {HTMLButtonElement} */ (requiredElement(id));
/** @param {string} id @returns {HTMLAnchorElement} */
const $requiredAnchor = (id) => /** @type {HTMLAnchorElement} */ (requiredElement(id));
/** @param {string} id @returns {HTMLInputElement} */
const $requiredInput = (id) => /** @type {HTMLInputElement} */ (requiredElement(id));
/** @param {string} id @returns {HTMLSelectElement} */
const $requiredSelect = (id) => /** @type {HTMLSelectElement} */ (requiredElement(id));
/** @param {string} id @returns {HTMLTextAreaElement} */
const $requiredTextarea = (id) => /** @type {HTMLTextAreaElement} */ (requiredElement(id));
/** @param {string} id @returns {HTMLImageElement} */
const $requiredImage = (id) => /** @type {HTMLImageElement} */ (requiredElement(id));

/** @param {EventTarget|null} target @returns {Element|null} */
function eventTargetElement(target) {
  return target instanceof Element ? target : null;
}

export { $, $image, $requiredAnchor, $requiredButton, $requiredImage, $requiredInput, $requiredSelect, $requiredTextarea, eventTargetElement, requiredElement };
