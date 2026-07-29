/**
 * Source module: 12-catalog-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

/** @type {CatalogState} */
const catalogState = {
  catalogLayoutColumns: 0,
  catalogLayoutResizeTimer: 0,
  catalogScrollTopButtonRaf: 0,
  categoryFocusTargetId: "",
  categoryFocusTimer: 0,
  categoryNavFitRaf: 0,
};

/** @type {Readonly<{
 *   categoryNav: HTMLElement,
 *   mobileCategoryMenuToggle: HTMLButtonElement,
 *   mobileCategoryMenu: HTMLElement,
 *   catalogCount: HTMLElement|null,
 *   pageCount: HTMLElement|null,
 *   catalogGrid: HTMLElement,
 *   catalogLoadStatus: HTMLElement,
 *   catalogDetail: HTMLElement,
 *   catalogTitle: HTMLElement,
 *   catalogDescription: HTMLElement,
 *   catalogMenuToggle: HTMLButtonElement,
 *   catalogMenuToggleText: HTMLElement,
 *   catalogMenu: HTMLElement,
 *   catalogCoverPreview: HTMLImageElement|null,
 *   pageGrid: HTMLElement,
 *   openCatalogEntryFromDetail: HTMLButtonElement,
 *   scrollToTopBtn: HTMLButtonElement|null
 * }>} */
const catalogElements = Object.freeze({
  categoryNav: requiredElement("categoryNav"),
  mobileCategoryMenuToggle: $requiredButton("mobileCategoryMenuToggle"),
  mobileCategoryMenu: requiredElement("mobileCategoryMenu"),
  catalogCount: $("catalogCount"),
  pageCount: $("pageCount"),
  catalogGrid: requiredElement("catalogGrid"),
  catalogLoadStatus: requiredElement("catalogLoadStatus"),
  catalogDetail: requiredElement("catalogDetail"),
  catalogTitle: requiredElement("catalogDetailTitle"),
  catalogDescription: requiredElement("catalogDescription"),
  catalogMenuToggle: $requiredButton("catalogMenuToggle"),
  catalogMenuToggleText: requiredElement("catalogMenuToggleText"),
  catalogMenu: requiredElement("catalogMenu"),
  catalogCoverPreview: $image("catalogCoverPreview"),
  pageGrid: requiredElement("pageGrid"),
  openCatalogEntryFromDetail: $requiredButton("openCatalogEntryFromDetail"),
  scrollToTopBtn: $requiredButton("scrollToTopBtn"),
});
