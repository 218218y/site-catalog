/**
 * Source module: 13-search-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

const SEARCH_INPUT_DEBOUNCE_MS = 90;
const SEARCH_INDEX_PRELOAD_DELAY_MS = 6000;
const MOBILE_READER_SEARCH_MEDIA = "(max-width: 760px)";
const SEARCH_PREVIEW_SCROLL_SUPPRESS_MS = 260;
/** @type {SearchState} */
const searchState = {
  globalSearchCategory: "",
  globalSearchOpen: false,
  lightboxSearchScope: "catalog",
  lightboxMobileSearchOpen: false,
  searchIndexLoadState: catalogSearch?.isReady?.() ? "ready" : "idle",
  searchIndexLoadPromise: null,
  searchIndexPreloadTimer: 0,
  searchPreviewSuppressUntil: 0,
  searchPreviewSuppressTimer: 0,
  searchPreviewPointerClientX: null,
  searchPreviewPointerClientY: null,
};

/** @type {Readonly<Record<string, HTMLElement | null>>} */
const searchElements = Object.freeze({
  catalogSearch: $("catalogSearch"),
  globalSearchOpen: $("globalSearchOpen"),
  globalSearchClose: $("globalSearchClose"),
  globalSearchInput: $("globalSearchInput"),
  globalSearchResults: $("globalSearchResults"),
  globalSearchClear: $("globalSearchClear"),
  globalSearchScopeToggle: $("globalSearchScopeToggle"),
  globalSearchScopeMenu: $("globalSearchScopeMenu"),
  searchFloatingPreview: $("searchFloatingPreview"),
  searchFloatingPreviewImage: $("searchFloatingPreviewImage"),
  searchFloatingPreviewPage: $("searchFloatingPreviewPage"),
  lightboxSearchInput: $("lightboxSearchInput"),
  lightboxSearchPanel: $("lightboxSearchPanel"),
  lightboxMobileSearchToggle: $("lightboxMobileSearchToggle"),
  lightboxMobileSearchClose: $("lightboxMobileSearchClose"),
  lightboxSearchResults: $("lightboxSearchResults"),
  lightboxSearchStatus: $("lightboxSearchStatus"),
  lightboxSearchClear: $("lightboxSearchClear"),
  lightboxSearchScopeToggle: $("lightboxSearchScopeToggle"),
  lightboxSearchScopeMenu: $("lightboxSearchScopeMenu"),
  lightboxCatalogMenuToggle: $("lightboxCatalogMenuToggle"),
  lightboxCatalogMenu: $("lightboxCatalogMenu"),
});
