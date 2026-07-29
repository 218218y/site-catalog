/**
 * Source module: 14-favorites-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

import { $requiredAnchor, $requiredButton, $requiredSelect, $requiredTextarea, requiredElement } from "./02-dom-contracts.js";

const FAVORITES_SHARE_PARAM = "selection";
const FAVORITES_SHARE_VERSION = 2;
const FAVORITES_NOTE_MAX_LENGTH = 280;

function getFavoritesStorage() {
  try {
    return window.localStorage;
  } catch (_error) {
    return null;
  }
}

/** @type {FavoritesStore|null} */
const favoritesStore = /** @type {FavoritesStore|null} */ (
  window.BargigFavorites?.createStore?.({ storage: getFavoritesStorage() }) || null
);
/** @type {FavoritesState} */
const favoritesState = {
  favoritesViewerIndex: 0,
  favoritesViewerOpeningHash: "",
  favoritesViewerPreviousCatalog: null,
  favoritesViewerPreviousPage: 1,
  favoritesOpen: false,
  favoritesReturnFocus: null,
  favoritesTransferPending: null,
  favoritesTransferReturnFocus: null,
  favoritesFilterCatalogId: "",
  favoritesSelectedKeys: new Set(),
  favoritesDragKey: "",
  favoriteNoteEditingKey: "",
  favoriteNoteReturnFocus: null,
};

/** @type {Readonly<{
 *   headerFavoritesButton: HTMLAnchorElement,
 *   headerFavoritesCount: HTMLElement,
 *   headerCopyLink: HTMLButtonElement,
 *   lightboxFavoritesButton: HTMLAnchorElement,
 *   lightboxFavoritesCount: HTMLElement,
 *   lightboxFavoritesSeparator: HTMLElement,
 *   favoritesPanel: HTMLElement,
 *   favoritesBackdrop: HTMLElement,
 *   favoritesCloseButton: HTMLButtonElement,
 *   favoritesClearButton: HTMLButtonElement,
 *   favoritesShareButton: HTMLButtonElement,
 *   favoritesShareLabel: HTMLElement,
 *   favoritesInquiryButton: HTMLButtonElement,
 *   favoritesInquiryLabel: HTMLElement,
 *   favoritesHeaderWorkspace: HTMLElement,
 *   favoritesGrid: HTMLElement,
 *   favoritesEmpty: HTMLElement,
 *   favoritesFilteredEmpty: HTMLElement,
 *   favoritesResetFilter: HTMLButtonElement,
 *   favoritesCatalogFilter: HTMLSelectElement,
 *   favoritesVisibleCount: HTMLElement,
 *   favoritesSelectionBar: HTMLElement,
 *   favoritesSelectionCount: HTMLElement,
 *   favoritesClearSelection: HTMLButtonElement,
 *   favoriteNoteOverlay: HTMLElement,
 *   favoriteNoteBackdrop: HTMLElement,
 *   favoriteNoteTitle: HTMLElement,
 *   favoriteNoteContext: HTMLElement,
 *   favoriteNoteInput: HTMLTextAreaElement,
 *   favoriteNoteCount: HTMLElement,
 *   favoriteNoteSave: HTMLButtonElement,
 *   favoriteNoteCancel: HTMLButtonElement,
 *   favoriteNoteClose: HTMLButtonElement,
 *   favoritesTransferOverlay: HTMLElement,
 *   favoritesTransferBackdrop: HTMLElement,
 *   favoritesTransferTitle: HTMLElement,
 *   favoritesTransferDescription: HTMLElement,
 *   favoritesTransferSummary: HTMLElement,
 *   favoritesTransferMerge: HTMLButtonElement,
 *   favoritesTransferReplace: HTMLButtonElement,
 *   favoritesTransferCancel: HTMLButtonElement,
 *   favoriteOpenCatalogButton: HTMLButtonElement,
 *   viewerFavoriteButton: HTMLButtonElement,
 *   viewerMobileFavoritesLink: HTMLAnchorElement
 * }>} */
const favoritesElements = Object.freeze({
  headerFavoritesButton: $requiredAnchor("headerFavoritesButton"),
  headerFavoritesCount: requiredElement("headerFavoritesCount"),
  headerCopyLink: $requiredButton("headerCopyLink"),
  lightboxFavoritesButton: $requiredAnchor("lightboxFavoritesButton"),
  lightboxFavoritesCount: requiredElement("lightboxFavoritesCount"),
  lightboxFavoritesSeparator: requiredElement("lightboxFavoritesSeparator"),
  favoritesPanel: requiredElement("favoritesPanel"),
  favoritesBackdrop: requiredElement("favoritesBackdrop"),
  favoritesCloseButton: $requiredButton("favoritesCloseButton"),
  favoritesClearButton: $requiredButton("favoritesClearButton"),
  favoritesShareButton: $requiredButton("favoritesShareButton"),
  favoritesShareLabel: requiredElement("favoritesShareLabel"),
  favoritesInquiryButton: $requiredButton("favoritesInquiryButton"),
  favoritesInquiryLabel: requiredElement("favoritesInquiryLabel"),
  favoritesHeaderWorkspace: requiredElement("favoritesHeaderWorkspace"),
  favoritesGrid: requiredElement("favoritesGrid"),
  favoritesEmpty: requiredElement("favoritesEmpty"),
  favoritesFilteredEmpty: requiredElement("favoritesFilteredEmpty"),
  favoritesResetFilter: $requiredButton("favoritesResetFilter"),
  favoritesCatalogFilter: $requiredSelect("favoritesCatalogFilter"),
  favoritesVisibleCount: requiredElement("favoritesVisibleCount"),
  favoritesSelectionBar: requiredElement("favoritesSelectionBar"),
  favoritesSelectionCount: requiredElement("favoritesSelectionCount"),
  favoritesClearSelection: $requiredButton("favoritesClearSelection"),
  favoriteNoteOverlay: requiredElement("favoriteNoteOverlay"),
  favoriteNoteBackdrop: requiredElement("favoriteNoteBackdrop"),
  favoriteNoteTitle: requiredElement("favoriteNoteTitle"),
  favoriteNoteContext: requiredElement("favoriteNoteContext"),
  favoriteNoteInput: $requiredTextarea("favoriteNoteInput"),
  favoriteNoteCount: requiredElement("favoriteNoteCount"),
  favoriteNoteSave: $requiredButton("favoriteNoteSave"),
  favoriteNoteCancel: $requiredButton("favoriteNoteCancel"),
  favoriteNoteClose: $requiredButton("favoriteNoteClose"),
  favoritesTransferOverlay: requiredElement("favoritesTransferOverlay"),
  favoritesTransferBackdrop: requiredElement("favoritesTransferBackdrop"),
  favoritesTransferTitle: requiredElement("favoritesTransferTitle"),
  favoritesTransferDescription: requiredElement("favoritesTransferDescription"),
  favoritesTransferSummary: requiredElement("favoritesTransferSummary"),
  favoritesTransferMerge: $requiredButton("favoritesTransferMerge"),
  favoritesTransferReplace: $requiredButton("favoritesTransferReplace"),
  favoritesTransferCancel: $requiredButton("favoritesTransferCancel"),
  favoriteOpenCatalogButton: $requiredButton("favoriteOpenCatalogButton"),
  viewerFavoriteButton: $requiredButton("viewerFavoriteButton"),
  viewerMobileFavoritesLink: $requiredAnchor("viewerMobileFavoritesLink"),
});

export { FAVORITES_NOTE_MAX_LENGTH, FAVORITES_SHARE_PARAM, FAVORITES_SHARE_VERSION, favoritesElements, favoritesState, favoritesStore };
