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

/** @type {Readonly<Record<string, HTMLElement | null>>} */
const catalogElements = Object.freeze({
  catalogGrid: $("catalogGrid"),
  catalogLoadStatus: $("catalogLoadStatus"),
  catalogDetail: $("catalogDetail"),
  catalogTitle: $("catalogDetailTitle"),
  catalogDescription: $("catalogDescription"),
  catalogMenuToggle: $("catalogMenuToggle"),
  catalogMenuToggleText: $("catalogMenuToggleText"),
  catalogMenu: $("catalogMenu"),
  catalogCoverPreview: $("catalogCoverPreview"),
  pageGrid: $("pageGrid"),
  openCatalogEntryFromDetail: $("openCatalogEntryFromDetail"),
  scrollToTopBtn: $("scrollToTopBtn"),
});
