/**
 * Source module: 47-search-preview.js
 * Shared hover preview and scroll-suppression behavior for search surfaces.
 */

/** @typedef {{restoreAfter?:boolean}} SearchPreviewSuppressionOptions */

import { tooltips } from "../runtime/tooltip-manager.js";
import { getFeatureInterface } from "./10-app-state.js";
import { searchElements, searchState, SEARCH_PREVIEW_SCROLL_SUPPRESS_MS } from "./13-search-state.js";
import { pageSrc } from "./17-catalog-asset-urls.js";
import { clampValue } from "./19-shared-pure.js";
import { hasHoverPointer, isTouchLikePointer } from "./21-ui-runtime.js";

function hideSearchFloatingPreview() {
  searchElements.searchFloatingPreview?.classList.remove("visible");
}

/** @param {MouseEvent|PointerEvent|WheelEvent} event */
function rememberSearchPreviewPointer(event) {
  const clientX = Number(event?.clientX);
  const clientY = Number(event?.clientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

  searchState.searchPreviewPointerClientX = clientX;
  searchState.searchPreviewPointerClientY = clientY;
}

/** @param {Element|null|undefined} target */
function searchPreviewTargetBelongsToOpenResults(target) {
  if (!target || !target.isConnected) return false;

  if (searchElements.globalSearchResults?.contains(target)) {
    return searchState.globalSearchOpen && !searchElements.globalSearchResults.classList.contains("hidden");
  }

  if (searchElements.lightboxSearchResults?.contains(target)) {
    return Boolean(getFeatureInterface("viewer")?.isViewerOpen?.()) && !searchElements.lightboxSearchResults.classList.contains("hidden");
  }

  return false;
}

/** @param {Element|null|undefined} target */
function isSearchPreviewBlockedByOpenMenu(target) {
  if (!(target instanceof Node)) return false;
  if (
    searchElements.globalSearchResults?.contains(target) &&
    searchElements.globalSearchScopeMenu &&
    !searchElements.globalSearchScopeMenu.classList.contains("hidden")
  ) return true;
  if (
    searchElements.lightboxSearchResults?.contains(target) &&
    searchElements.lightboxSearchScopeMenu &&
    !searchElements.lightboxSearchScopeMenu.classList.contains("hidden")
  ) return true;
  return false;
}

function getSearchPreviewTargetAtLastPointer() {
  const clientX = Number(searchState.searchPreviewPointerClientX);
  const clientY = Number(searchState.searchPreviewPointerClientY);
  if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
  if (clientX < 0 || clientY < 0 || clientX > window.innerWidth || clientY > window.innerHeight) return null;

  const element = document.elementFromPoint(clientX, clientY);
  const target = element?.closest?.("[data-search-preview-src]");
  return target instanceof HTMLElement && searchPreviewTargetBelongsToOpenResults(target) ? target : null;
}

function isSearchPreviewSuppressed() {
  return Date.now() < (searchState.searchPreviewSuppressUntil || 0);
}

function restoreSearchFloatingPreviewAfterSuppression() {
  if (isSearchPreviewSuppressed() || !hasHoverPointer()) return;

  const target = getSearchPreviewTargetAtLastPointer();
  if (!target || isSearchPreviewBlockedByOpenMenu(target)) return;

  showSearchFloatingPreview(target);
}

/** @param {number} [duration] @param {SearchPreviewSuppressionOptions} [options] */
function suppressSearchFloatingPreview(duration = SEARCH_PREVIEW_SCROLL_SUPPRESS_MS, options = {}) {
  const { restoreAfter = true } = options;
  const delay = Math.max(0, Number(duration) || 0);
  tooltips.suppress(delay, { restoreAfter });
  searchState.searchPreviewSuppressUntil = Math.max(
    searchState.searchPreviewSuppressUntil || 0,
    Date.now() + delay
  );
  hideSearchFloatingPreview();

  window.clearTimeout(searchState.searchPreviewSuppressTimer);
  searchState.searchPreviewSuppressTimer = window.setTimeout(() => {
    searchState.searchPreviewSuppressTimer = 0;
    if (restoreAfter) restoreSearchFloatingPreviewAfterSuppression();
  }, delay + 20);
}

/** @param {HTMLElement|null|undefined} target */
function positionSearchFloatingPreview(target) {
  const preview = searchElements.searchFloatingPreview;
  if (!preview || !target) return;

  const targetRect = target.getBoundingClientRect();
  const gap = 16;
  const safeMargin = 12;
  const fallbackWidth = Math.min(430, Math.max(180, window.innerWidth * 0.34));
  const fallbackHeight = Math.min(620, Math.max(180, window.innerHeight * 0.64));
  const previewRect = preview.getBoundingClientRect();
  const previewWidth = previewRect.width || fallbackWidth;
  const previewHeight = previewRect.height || fallbackHeight;

  let left;
  if (targetRect.left - gap - previewWidth >= safeMargin) {
    left = targetRect.left - gap - previewWidth;
  } else if (targetRect.right + gap + previewWidth <= window.innerWidth - safeMargin) {
    left = targetRect.right + gap;
  } else {
    left = targetRect.left + (targetRect.width / 2) - (previewWidth / 2);
  }

  const top = targetRect.top + (targetRect.height / 2) - (previewHeight / 2);
  preview.style.left = `${clampValue(left, safeMargin, Math.max(safeMargin, window.innerWidth - previewWidth - safeMargin))}px`;
  preview.style.top = `${clampValue(top, safeMargin, Math.max(safeMargin, window.innerHeight - previewHeight - safeMargin))}px`;
}

/** @param {HTMLElement|null|undefined} target */
function showSearchFloatingPreview(target) {
  if (!target || !searchElements.searchFloatingPreview || !searchElements.searchFloatingPreviewImage) return;
  if (!searchPreviewTargetBelongsToOpenResults(target)) return;
  if (isSearchPreviewSuppressed()) return;
  if (isSearchPreviewBlockedByOpenMenu(target)) return;

  const src = String(target.dataset.searchPreviewSrc || "").trim();
  if (!src) return;

  const label = String(target.dataset.searchPreviewTitle || "קטלוג").trim() || "קטלוג";
  const previewImage = searchElements.searchFloatingPreviewImage;
  previewImage.removeAttribute("width");
  previewImage.removeAttribute("height");
  previewImage.onload = () => positionSearchFloatingPreview(target);
  previewImage.src = src;
  searchElements.searchFloatingPreviewImage.alt = label;
  if (searchElements.searchFloatingPreviewPage) searchElements.searchFloatingPreviewPage.textContent = label;

  searchElements.searchFloatingPreview.classList.add("visible");
  positionSearchFloatingPreview(target);
}

/** @param {ParentNode|null|undefined} container */
function bindSearchFloatingPreviewEvents(container) {
  if (!container) return;

  container.querySelectorAll("[data-search-preview-src]").forEach((candidate) => {
    if (!(candidate instanceof HTMLElement)) return;
    const target = candidate;
    target.addEventListener("pointerenter", (event) => {
      rememberSearchPreviewPointer(event);
      if (!hasHoverPointer() || isTouchLikePointer(event) || isSearchPreviewSuppressed()) return;
      showSearchFloatingPreview(target);
    });
    target.addEventListener("pointermove", (event) => {
      rememberSearchPreviewPointer(event);
      if (!hasHoverPointer() || isTouchLikePointer(event)) return;
      if (isSearchPreviewSuppressed()) {
        hideSearchFloatingPreview();
        return;
      }
      positionSearchFloatingPreview(target);
    });
    target.addEventListener("pointerleave", (event) => {
      rememberSearchPreviewPointer(event);
      hideSearchFloatingPreview();
    });
    target.addEventListener("focus", () => showSearchFloatingPreview(target));
    target.addEventListener("blur", hideSearchFloatingPreview);
  });
}

/** @param {WheelEvent} event */
function handleSearchPreviewScrollIntent(event) {
  rememberSearchPreviewPointer(event);
  suppressSearchFloatingPreview();
}

export {
  bindSearchFloatingPreviewEvents,
  handleSearchPreviewScrollIntent,
  hideSearchFloatingPreview,
  positionSearchFloatingPreview,
  suppressSearchFloatingPreview
};
