/**
 * Source module: 59-viewer-page-controller.js
 * Canonical Viewer page-movement and page-render command owner.
 *
 * Buttons, keyboard, rail, wheel, trackpad, and touch all converge here through
 * one page transition contract. The lifecycle composition root imports this
 * module, while this module never imports 60-viewer.js.
 */

/** @import { CatalogRecord } from "../../types/catalog-data.generated.js" */
/** @import { ViewerRefreshOptions, ViewerSetPageOptions } from "../../types/frontend-contracts.js" */

import { catalogFirstPage, catalogLastPage, catalogPageOrdinal } from "./06-catalog-page-numbering.js";
import { CATALOG_IMAGE_TIER_FULL, getFeatureInterface } from "./10-app-state.js";
import { viewerElements, viewerViewportState } from "./16-viewer-state.js";
import { VIEWER_NAVIGATION_SOURCE_PAGE_RAIL, VIEWER_NAVIGATION_SOURCE_PROGRAMMATIC, beginViewerPageTransitionCommand, createViewerNavigationCommand } from "./17-viewer-state-transitions.js";
import { activeCatalog, activePage, setActivePage } from "./18-navigation-feature.js";
import { catalogPagesShareAspectRatio, clampPage, clampValue } from "./20-shared-ui.js";
import { eventTargetElement } from "./02-dom-contracts.js";
import { isFavoritesLightboxMode } from "./30-favorites-share.js";
import { syncViewerInquiryUi } from "./32-shared-inquiry.js";
import { initLightboxSearchStatus } from "./50-search-ui.js";
import {
  activeSingleViewerImageLogicalSrc,
  activeSingleViewerImageTier,
  preloadNeighbors,
  setViewerLoading,
  showSingleLightboxImage,
  viewerPageImageRequest
} from "./53-viewer-image.js";
import {
  applyZoom,
  captureSingleImageRelativePosition,
  getAutomaticViewerFitMode,
  isAutoViewerZoom,
  primeLightboxFrameForCatalogPage,
  updateHash,
  viewerUsesAutomaticFitMode
} from "./54-viewer-geometry.js";
import {
  hideLightboxFloatingPreview,
  showPageRailTemporarily,
  syncLightboxModeUi,
  syncLightboxProgress,
  syncViewerMobileMoreMenuState,
  updateLightboxThumbs
} from "./56-viewer-shell.js";

/** @param {CatalogRecord} catalog @param {number} page */
function catalogPageProgress(catalog, page) {
  const displayTotal = catalogLastPage(catalog);
  return {
    current: catalogPageOrdinal(catalog, page),
    total: catalog.pages,
    title: `עמוד ${page} מתוך ${displayTotal}`,
    options: {
      label: "עמוד",
      displayCurrent: page,
      displayTotal
    }
  };
}

function reconcileAutomaticViewerFitModeForActivePage() {
  if (!viewerUsesAutomaticFitMode()) return false;
  const nextFitMode = getAutomaticViewerFitMode();
  if (nextFitMode === viewerViewportState.imageFitMode) return false;
  viewerViewportState.imageFitMode = nextFitMode;
  return true;
}

/** @param {ViewerRefreshOptions} [options] */
function updateLightbox(options = {}) {
  if (!activeCatalog()) return;
  const { thumbScrollIntoView = true, preserveCurrentImage = false } = options;
  let favoriteEntries = null;
  const favorites = getFeatureInterface("favorites");

  if (isFavoritesLightboxMode()) {
    favoriteEntries = favorites?.entries() || [];
    if (!favoriteEntries.length) {
      getFeatureInterface("viewer")?.close({ restoreFavorites: true });
      return;
    }

    const currentIndex = favorites?.findViewerEntryIndex(favoriteEntries, activeCatalog()?.id, activePage()) ?? -1;
    favorites?.selectViewerEntry(
      favoriteEntries,
      currentIndex >= 0 ? currentIndex : favorites.viewerIndex()
    );
  }

  const catalog = activeCatalog();
  if (!catalog) return;
  setActivePage(clampPage(activePage(), catalog));
  reconcileAutomaticViewerFitModeForActivePage();
  syncLightboxModeUi();
  syncViewerInquiryUi();
  syncViewerMobileMoreMenuState();

  viewerElements.lightboxTitle.textContent = catalog.title;
  if (favoriteEntries) {
    const favoriteViewerIndex = favorites?.viewerIndex() ?? 0;
    const current = favoriteViewerIndex + 1;
    const total = favoriteEntries.length;
    viewerElements.lightboxMeta.textContent = `מועדף ${current} מתוך ${total} · עמוד ${activePage()}`;
    syncLightboxProgress(current, total, `מועדף ${current} מתוך ${total} · עמוד ${activePage()}`, {
      label: "מועדף",
      detail: `עמוד ${activePage()}`
    });
    viewerElements.prevPageBtn.disabled = favoriteViewerIndex <= 0;
    viewerElements.nextPageBtn.disabled = favoriteViewerIndex >= total - 1;
  } else {
    const progress = catalogPageProgress(catalog, activePage());
    viewerElements.lightboxMeta.textContent = progress.title;
    syncLightboxProgress(progress.current, progress.total, progress.title, progress.options);
    viewerElements.prevPageBtn.disabled = activePage() <= catalogFirstPage(catalog);
    viewerElements.nextPageBtn.disabled = activePage() >= catalogLastPage(catalog);
  }

  favorites?.syncViewerButton();
  if (!favoriteEntries) initLightboxSearchStatus();

  const preserveFullResolutionTier = !isAutoViewerZoom()
    && activeSingleViewerImageTier() === CATALOG_IMAGE_TIER_FULL;
  const request = viewerPageImageRequest(catalog, activePage(), {
    forceFull: preserveFullResolutionTier
  });
  const src = request.primarySrc;
  const currentSrc = activeSingleViewerImageLogicalSrc();
  if (currentSrc !== src) {
    showSingleLightboxImage(catalog, activePage(), src, { imageRequest: request, preserveCurrentImage });
  } else {
    setViewerLoading(false);
    viewerElements.lightbox?.classList.remove("is-page-loading");
    applyZoom();
  }

  updateLightboxThumbs({ scrollIntoView: thumbScrollIntoView });
  preloadNeighbors();
  updateHash();
}

/**
 * @param {number} targetPage
 * @param {number} direction
 * @param {ViewerSetPageOptions} options
 */
function beginPageControllerTransition(targetPage, direction, options) {
  const command = options.navigationCommand || createViewerNavigationCommand(
    options.navigationSource || VIEWER_NAVIGATION_SOURCE_PROGRAMMATIC,
    direction
  );
  const relativePosition = command.positionMode === "relative"
    ? captureSingleImageRelativePosition()
    : null;
  beginViewerPageTransitionCommand(targetPage, command, relativePosition);
  return command;
}

/** @param {number} page @param {ViewerSetPageOptions} [options] */
function setLightboxPage(page, options = {}) {
  if (!activeCatalog()) return;
  const nextPage = clampPage(page, activeCatalog());
  if (nextPage === activePage()) return;

  const thumbScrollIntoView = options.thumbScrollIntoView !== false;
  const previousCatalog = activeCatalog();
  const previousPage = activePage();
  const direction = Math.sign(nextPage - previousPage);

  hideLightboxFloatingPreview();
  beginPageControllerTransition(nextPage, direction, options);
  setActivePage(nextPage);
  reconcileAutomaticViewerFitModeForActivePage();
  const currentCatalog = activeCatalog();
  const preserveCurrentGeometry = Boolean(
    currentCatalog
    && viewerElements.lightboxImage?.complete
    && viewerElements.lightboxImage.naturalWidth > 0
    && catalogPagesShareAspectRatio(previousCatalog, previousPage, currentCatalog, activePage())
  );
  const geometryPrimed = Boolean(currentCatalog && !preserveCurrentGeometry
    && primeLightboxFrameForCatalogPage(currentCatalog, activePage()));
  if (geometryPrimed) applyZoom();
  updateLightbox({ thumbScrollIntoView, preserveCurrentImage: preserveCurrentGeometry });
}

/** @param {number} index @param {ViewerSetPageOptions} [options] */
function setFavoriteViewerIndex(index, options = {}) {
  if (!isFavoritesLightboxMode()) return;
  const favorites = getFeatureInterface("favorites");
  const entries = favorites?.entries() || [];
  if (!entries.length) {
    getFeatureInterface("viewer")?.close({ restoreFavorites: true });
    return;
  }

  const currentFavoriteIndex = favorites?.viewerIndex() ?? 0;
  const nextIndex = clampValue(Number.parseInt(String(index), 10) || 0, 0, entries.length - 1);
  const entry = entries[nextIndex];
  const itemChanged = nextIndex !== currentFavoriteIndex || activeCatalog() !== entry.catalog || activePage() !== entry.page;
  if (!itemChanged) return;

  const thumbScrollIntoView = options.thumbScrollIntoView !== false;
  const previousCatalog = activeCatalog();
  const previousPage = activePage();
  const direction = Math.sign(nextIndex - currentFavoriteIndex);

  hideLightboxFloatingPreview();
  beginPageControllerTransition(entry.page, direction, options);
  favorites?.selectViewerEntry(entries, nextIndex);
  reconcileAutomaticViewerFitModeForActivePage();
  const currentCatalog = activeCatalog();
  const preserveCurrentGeometry = Boolean(
    currentCatalog
    && viewerElements.lightboxImage?.complete
    && viewerElements.lightboxImage.naturalWidth > 0
    && catalogPagesShareAspectRatio(previousCatalog, previousPage, currentCatalog, activePage())
  );
  const geometryPrimed = Boolean(currentCatalog && !preserveCurrentGeometry
    && primeLightboxFrameForCatalogPage(currentCatalog, activePage()));
  if (geometryPrimed) applyZoom();
  updateLightbox({ thumbScrollIntoView, preserveCurrentImage: preserveCurrentGeometry });
}

/** @param {number} delta @param {ViewerSetPageOptions} [options] */
function moveLightbox(delta, options = {}) {
  if (!activeCatalog()) return;
  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex((getFeatureInterface("favorites")?.viewerIndex() ?? 0) + delta, options);
    return;
  }
  setLightboxPage(activePage() + delta, options);
}

/** @param {MouseEvent} event */
function handleViewerPageRailClick(event) {
  const button = eventTargetElement(event.target)?.closest(".lightbox-page-thumb");
  if (!(button instanceof HTMLButtonElement) || !viewerElements.lightboxPageThumbs?.contains(button)) return;

  event.preventDefault();
  hideLightboxFloatingPreview();

  if (isFavoritesLightboxMode()) {
    setFavoriteViewerIndex(Number(button.dataset.favoriteIndex), { thumbScrollIntoView: false, navigationSource: VIEWER_NAVIGATION_SOURCE_PAGE_RAIL });
  } else {
    const targetPage = Number(button.dataset.page);
    if (!Number.isFinite(targetPage)) return;
    setLightboxPage(targetPage, { thumbScrollIntoView: false, navigationSource: VIEWER_NAVIGATION_SOURCE_PAGE_RAIL });
  }

  showPageRailTemporarily(1800, { scrollIntoView: false });
}

function attachViewerPageControllerEvents() {
  viewerElements.lightboxPageThumbs?.addEventListener("click", handleViewerPageRailClick);
}

/* TEST-ONLY EXPORTS: BEGIN */
if (typeof __BARGIG_TEST_EXPORTS__ !== "undefined") {
  __BARGIG_TEST_EXPORTS__["viewer-page-controller"] = Object.freeze({ catalogPageProgress });
}
/* TEST-ONLY EXPORTS: END */

export {
  attachViewerPageControllerEvents,
  moveLightbox,
  setFavoriteViewerIndex,
  setLightboxPage,
  updateLightbox
};
