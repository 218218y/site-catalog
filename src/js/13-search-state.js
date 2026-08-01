/**
 * Source module: 13-search-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

/** @import { SearchState } from "../../types/frontend-contracts.js" */

import { $requiredButton, $requiredImage, $requiredInput, requiredElement } from "./02-dom-contracts.js";
import { catalogSearch } from "./03-runtime-context.js";

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
  searchIndexLoadState: catalogSearch.isReady() ? "ready" : "idle",
  searchIndexLoadPromise: null,
  searchIndexPreloadTimer: 0,
  searchPreviewSuppressUntil: 0,
  searchPreviewSuppressTimer: 0,
  searchPreviewPointerClientX: null,
  searchPreviewPointerClientY: null,
};

/** @type {Readonly<{
 *   catalogSearch: HTMLElement,
 *   globalSearchOpen: HTMLButtonElement,
 *   globalSearchClose: HTMLButtonElement,
 *   globalSearchInput: HTMLInputElement,
 *   globalSearchResults: HTMLElement,
 *   globalSearchClear: HTMLButtonElement,
 *   globalSearchScopeToggle: HTMLButtonElement,
 *   globalSearchScopeMenu: HTMLElement,
 *   searchFloatingPreview: HTMLElement,
 *   searchFloatingPreviewImage: HTMLImageElement,
 *   searchFloatingPreviewPage: HTMLElement,
 *   lightboxSearchInput: HTMLInputElement,
 *   lightboxSearchPanel: HTMLElement,
 *   lightboxMobileSearchToggle: HTMLButtonElement,
 *   lightboxMobileSearchClose: HTMLButtonElement,
 *   lightboxSearchResults: HTMLElement,
 *   lightboxSearchStatus: HTMLElement,
 *   lightboxSearchClear: HTMLButtonElement,
 *   lightboxSearchScopeToggle: HTMLButtonElement,
 *   lightboxSearchScopeMenu: HTMLElement,
 *   lightboxCatalogMenuToggle: HTMLButtonElement,
 *   lightboxCatalogMenu: HTMLElement
 * }>} */
const searchElements = Object.freeze({
  catalogSearch: requiredElement("catalogSearch"),
  globalSearchOpen: $requiredButton("globalSearchOpen"),
  globalSearchClose: $requiredButton("globalSearchClose"),
  globalSearchInput: $requiredInput("globalSearchInput"),
  globalSearchResults: requiredElement("globalSearchResults"),
  globalSearchClear: $requiredButton("globalSearchClear"),
  globalSearchScopeToggle: $requiredButton("globalSearchScopeToggle"),
  globalSearchScopeMenu: requiredElement("globalSearchScopeMenu"),
  searchFloatingPreview: requiredElement("searchFloatingPreview"),
  searchFloatingPreviewImage: $requiredImage("searchFloatingPreviewImage"),
  searchFloatingPreviewPage: requiredElement("searchFloatingPreviewPage"),
  lightboxSearchInput: $requiredInput("lightboxSearchInput"),
  lightboxSearchPanel: requiredElement("lightboxSearchPanel"),
  lightboxMobileSearchToggle: $requiredButton("lightboxMobileSearchToggle"),
  lightboxMobileSearchClose: $requiredButton("lightboxMobileSearchClose"),
  lightboxSearchResults: requiredElement("lightboxSearchResults"),
  lightboxSearchStatus: requiredElement("lightboxSearchStatus"),
  lightboxSearchClear: $requiredButton("lightboxSearchClear"),
  lightboxSearchScopeToggle: $requiredButton("lightboxSearchScopeToggle"),
  lightboxSearchScopeMenu: requiredElement("lightboxSearchScopeMenu"),
  lightboxCatalogMenuToggle: $requiredButton("lightboxCatalogMenuToggle"),
  lightboxCatalogMenu: requiredElement("lightboxCatalogMenu"),
});

export { MOBILE_READER_SEARCH_MEDIA, SEARCH_INDEX_PRELOAD_DELAY_MS, SEARCH_INPUT_DEBOUNCE_MS, SEARCH_PREVIEW_SCROLL_SUPPRESS_MS, searchElements, searchState };
