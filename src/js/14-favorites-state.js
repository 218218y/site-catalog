/**
 * Source module: 14-favorites-state.js
 * Feature-owned runtime state. Do not add properties owned by another feature.
 */

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

/** @type {Readonly<Record<string, HTMLElement | null>>} */
const favoritesElements = Object.freeze({
  lightboxFavoritesButton: $("lightboxFavoritesButton"),
  lightboxFavoritesCount: $("lightboxFavoritesCount"),
  lightboxFavoritesSeparator: $("lightboxFavoritesSeparator"),
  favoritesPanel: $("favoritesPanel"),
  favoritesBackdrop: $("favoritesBackdrop"),
  favoritesCloseButton: $("favoritesCloseButton"),
  favoritesClearButton: $("favoritesClearButton"),
  favoritesShareButton: $("favoritesShareButton"),
  favoritesShareLabel: $("favoritesShareLabel"),
  favoritesInquiryButton: $("favoritesInquiryButton"),
  favoritesInquiryLabel: $("favoritesInquiryLabel"),
  favoritesHeaderWorkspace: $("favoritesHeaderWorkspace"),
  favoritesGrid: $("favoritesGrid"),
  favoritesEmpty: $("favoritesEmpty"),
  favoritesFilteredEmpty: $("favoritesFilteredEmpty"),
  favoritesResetFilter: $("favoritesResetFilter"),
  favoritesCatalogFilter: $("favoritesCatalogFilter"),
  favoritesVisibleCount: $("favoritesVisibleCount"),
  favoritesSelectionBar: $("favoritesSelectionBar"),
  favoritesSelectionCount: $("favoritesSelectionCount"),
  favoritesClearSelection: $("favoritesClearSelection"),
  favoriteNoteOverlay: $("favoriteNoteOverlay"),
  favoriteNoteBackdrop: $("favoriteNoteBackdrop"),
  favoriteNoteTitle: $("favoriteNoteTitle"),
  favoriteNoteContext: $("favoriteNoteContext"),
  favoriteNoteInput: $("favoriteNoteInput"),
  favoriteNoteCount: $("favoriteNoteCount"),
  favoriteNoteSave: $("favoriteNoteSave"),
  favoriteNoteCancel: $("favoriteNoteCancel"),
  favoriteNoteClose: $("favoriteNoteClose"),
  favoritesTransferOverlay: $("favoritesTransferOverlay"),
  favoritesTransferBackdrop: $("favoritesTransferBackdrop"),
  favoritesTransferTitle: $("favoritesTransferTitle"),
  favoritesTransferDescription: $("favoritesTransferDescription"),
  favoritesTransferSummary: $("favoritesTransferSummary"),
  favoritesTransferMerge: $("favoritesTransferMerge"),
  favoritesTransferReplace: $("favoritesTransferReplace"),
  favoritesTransferCancel: $("favoritesTransferCancel"),
  favoriteOpenCatalogButton: $("favoriteOpenCatalogButton"),
  viewerFavoriteButton: $("viewerFavoriteButton"),
  viewerMobileFavoritesLink: $("viewerMobileFavoritesLink"),
});
