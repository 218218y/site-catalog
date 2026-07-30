/**
 * Source module: 53-viewer-image.js
 * Viewer-only image swaps, resolution selection, and progressive upgrade lifecycle.
 */

import { catalogFirstPage, catalogLastPage } from "./06-catalog-page-numbering.js";
import { CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_MEDIUM, CATALOG_IMAGE_TIER_THUMB, getFeatureInterface } from "./10-app-state.js";
import { AUTO_VIEWER_ZOOM, VIEWER_FIT_HEIGHT, VIEWER_FIT_WIDTH, VIEWER_FULL_RESOLUTION_WARMUP_ZOOM_EPSILON, VIEWER_FULL_RESOLUTION_ZOOM_THRESHOLD, VIEWER_MEDIUM_OVERSUBSCRIPTION_RATIO, VIEWER_PAGE_SWAP_CLEANUP_MS, viewerElements, viewerState } from "./16-viewer-state.js";
import { activeCatalog, activePage } from "./18-navigation-feature.js";
import { applyCatalogImageDimensions, catalogImageTierMaxSide, catalogNeighborPreloadRadius, catalogPageImageSrc, catalogSupportsImageTier, isSaveDataEnabled, loadCatalogImageWithRecovery, networkEffectiveType, normalizeCatalogImageUrl, pageSize, pageSrc, prepareCatalogImage, prepareImagePlaceholder, syncImagePlaceholderState } from "./20-shared-ui.js";
import { isFavoritesLightboxMode } from "./30-favorites-share.js";
import { isViewerSessionOpen } from "./52-viewer-session.js";
import { applyLightboxFrameGeometry, applyZoom } from "./54-viewer-geometry.js";
import { setViewerLoading } from "./56-viewer-shell.js";

/**
 * @param {HTMLElement|null|undefined} element
 * @param {ViewerPageSwapAnimationOptions} [options]
 */
function runViewerPageSwapAnimation(element, options = /** @type {ViewerPageSwapAnimationOptions} */ ({ timerKey: "singleImageAnimationTimer" })) {
  const { timerKey, root = element?.parentElement } = options;
  if (!element || !timerKey || !(timerKey in viewerState)) return;

  window.clearTimeout(viewerState[timerKey]);
  root?.querySelectorAll?.(".page-swap-enter")
    .forEach((animatedElement) => animatedElement.classList.remove("page-swap-enter"));

  // Restart the entrance animation only after the target page geometry and
  // positioning are ready, so the incoming single frame never animates from a
  // stale size or location.
  void element.offsetWidth;
  element.classList.add("page-swap-enter");
  viewerState[timerKey] = window.setTimeout(() => {
    element.classList.remove("page-swap-enter");
    viewerState[timerKey] = 0;
  }, VIEWER_PAGE_SWAP_CLEANUP_MS);
}

function runSingleImageSwapAnimation() {
  runViewerPageSwapAnimation(viewerElements.lightboxImageFrame, {
    timerKey: "singleImageAnimationTimer",
    root: viewerElements.stageCanvas
  });
}


/** @param {number} token */
function finishSingleImageSwap(token) {
  if (token !== viewerState.singleImageLoadToken) return;
  setViewerLoading(false);
  viewerElements.lightbox?.classList.remove("is-page-loading");
  viewerElements.lightboxImageFrame?.classList.remove("is-preparing-swap");
  syncImagePlaceholderState(viewerElements.lightboxImage);
  applyZoom();
}

function ensureSingleViewerResolutionImage() {
  if (viewerState.singleImageResolutionImage?.isConnected) return viewerState.singleImageResolutionImage;
  if (!viewerElements.lightboxImageFrame) return null;

  const image = new Image();
  image.className = "lightbox-image lightbox-image-resolution";
  image.alt = "";
  image.draggable = false;
  image.decoding = "async";
  image.fetchPriority = "high";
  image.setAttribute("aria-hidden", "true");
  image.dataset.placeholderIgnore = "true";
  viewerElements.lightboxImageFrame.append(image);
  viewerState.singleImageResolutionImage = image;
  return image;
}

function clearSingleViewerResolutionUpgrade() {
  viewerState.singleImageResolutionLoadToken += 1;
  viewerState.singleImageResolutionStop?.();
  viewerState.singleImageResolutionStop = null;
  viewerState.singleImageResolutionTargetSrc = "";
  viewerState.singleImageResolutionTargetTier = "";
  viewerState.singleImageResolutionReady = false;
  viewerState.singleImageResolutionVisible = false;
  viewerState.singleImageResolutionCommitPending = false;
  viewerState.singleImageResolutionRetainedForSwap = false;
  viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading", "is-resolution-upgrade-ready");

  const image = viewerState.singleImageResolutionImage;
  if (!image) return;
  image.removeAttribute("src");
  delete image.dataset.resolutionRetainedForSwap;
  delete image.dataset.logicalSrc;
  delete image.dataset.loadedTier;
  delete image.dataset.loadedQuality;
  delete image.dataset.imageLoadPending;
}

function retainSingleViewerResolutionLayerForSwap() {
  const image = viewerState.singleImageResolutionImage;
  if (viewerState.singleImageResolutionRetainedForSwap) {
    return Boolean(image?.isConnected && image.naturalWidth > 0);
  }
  if (
    !viewerState.singleImageResolutionVisible
    || !viewerState.singleImageResolutionReady
    || !image?.isConnected
    || image.naturalWidth <= 0
  ) {
    return false;
  }

  // Freeze the already-decoded high-resolution layer as the visual front buffer.
  // Its ownership metadata is retired immediately, so it cannot be mistaken for
  // the target page, but its pixels remain painted until the next page is decoded.
  viewerState.singleImageResolutionLoadToken += 1;
  viewerState.singleImageResolutionStop?.();
  viewerState.singleImageResolutionStop = null;
  viewerState.singleImageResolutionTargetSrc = "";
  viewerState.singleImageResolutionTargetTier = "";
  viewerState.singleImageResolutionReady = false;
  viewerState.singleImageResolutionVisible = false;
  viewerState.singleImageResolutionCommitPending = false;
  viewerState.singleImageResolutionRetainedForSwap = true;
  image.dataset.resolutionRetainedForSwap = "true";
  viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading");
  viewerElements.lightboxImageFrame?.classList.add("is-resolution-upgrade-ready");
  return true;
}

function releaseSingleViewerRetainedResolutionLayer() {
  if (!viewerState.singleImageResolutionRetainedForSwap) return false;
  viewerState.singleImageResolutionRetainedForSwap = false;
  viewerElements.lightboxImageFrame?.classList.remove("is-resolution-upgrade-ready");

  const image = viewerState.singleImageResolutionImage;
  if (!image) return true;
  image.removeAttribute("src");
  delete image.dataset.resolutionRetainedForSwap;
  delete image.dataset.logicalSrc;
  delete image.dataset.loadedTier;
  delete image.dataset.loadedQuality;
  delete image.dataset.imageLoadPending;
  return true;
}

function activeSingleViewerImageLogicalSrc() {
  if (viewerState.singleImageResolutionVisible && viewerState.singleImageResolutionTargetSrc) {
    return viewerState.singleImageResolutionTargetSrc;
  }
  return normalizeCatalogImageUrl(viewerElements.lightboxImage?.dataset.logicalSrc || viewerElements.lightboxImage?.getAttribute("src") || "");
}

function activeSingleViewerImageTier() {
  if (viewerState.singleImageResolutionRetainedForSwap) return CATALOG_IMAGE_TIER_FULL;
  if (viewerState.singleImageResolutionVisible && viewerState.singleImageResolutionTargetTier) {
    return viewerState.singleImageResolutionTargetTier;
  }
  return String(viewerElements.lightboxImage?.dataset.loadedTier || "");
}

function shouldWarmSingleViewerFullResolution(previousZoom = viewerState.zoom) {
  if (isSaveDataEnabled()) return false;
  const effectiveType = networkEffectiveType();
  if (effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g") return false;

  const zoom = Number(viewerState.zoom) || AUTO_VIEWER_ZOOM;
  const previous = Number(previousZoom) || AUTO_VIEWER_ZOOM;
  return zoom > AUTO_VIEWER_ZOOM + VIEWER_FULL_RESOLUTION_WARMUP_ZOOM_EPSILON
    && zoom > previous + 0.001;
}

function commitSingleViewerResolutionUpgrade(token = viewerState.singleImageResolutionLoadToken) {
  if (token !== viewerState.singleImageResolutionLoadToken || !viewerState.singleImageResolutionReady) {
    viewerState.singleImageResolutionCommitPending = true;
    return false;
  }

  viewerState.singleImageResolutionCommitPending = false;
  viewerState.singleImageResolutionVisible = true;
  requestAnimationFrame(() => {
    if (token !== viewerState.singleImageResolutionLoadToken || !viewerState.singleImageResolutionVisible) return;
    viewerElements.lightboxImageFrame?.classList.add("is-resolution-upgrade-ready");
  });
  return true;
}

/**
 * @param {CatalogRecord} catalog
 * @param {number} page
 * @param {CatalogImageRequest} request
 * @param {ViewerResolutionUpgradeOptions} [options]
 */
function prepareSingleViewerResolutionUpgrade(catalog, page, request, options = {}) {
  if (!catalog || !request?.primarySrc || request.primaryTier !== CATALOG_IMAGE_TIER_FULL) return false;
  const targetSrc = normalizeCatalogImageUrl(request.primarySrc);
  if (!targetSrc) return false;

  const sameTarget = viewerState.singleImageResolutionTargetSrc === targetSrc
    && viewerState.singleImageResolutionTargetTier === request.primaryTier;
  if (sameTarget) {
    if (options.commit) {
      viewerState.singleImageResolutionCommitPending = true;
      if (viewerState.singleImageResolutionReady) commitSingleViewerResolutionUpgrade();
    }
    return true;
  }

  clearSingleViewerResolutionUpgrade();
  const image = ensureSingleViewerResolutionImage();
  if (!image) return false;

  const token = ++viewerState.singleImageResolutionLoadToken;
  viewerState.singleImageResolutionTargetSrc = targetSrc;
  viewerState.singleImageResolutionTargetTier = request.primaryTier;
  viewerState.singleImageResolutionCommitPending = Boolean(options.commit);
  viewerElements.lightboxImageFrame?.classList.add("is-resolution-loading");

  viewerState.singleImageResolutionStop = loadCatalogImageWithRecovery(image, {
    primarySrc: targetSrc,
    primaryTier: request.primaryTier,
    isCurrent: () => (
      token === viewerState.singleImageResolutionLoadToken
      && isViewerSessionOpen()
      && activeCatalog() === catalog
      && activePage() === page
      && viewerState.singleImageResolutionTargetSrc === targetSrc
    ),
    telemetryDetail: "viewer-resolution-upgrade",
    onSuccess: /** @param {CatalogImageCandidate} candidate */ (candidate) => {
      const finishReady = () => {
        if (token !== viewerState.singleImageResolutionLoadToken || !image.naturalWidth) return;
        viewerState.singleImageResolutionStop = null;
        viewerState.singleImageResolutionReady = true;
        image.dataset.logicalSrc = targetSrc;
        image.dataset.loadedTier = candidate.tier || request.primaryTier;
        image.dataset.loadedQuality = image.dataset.loadedTier;
        viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading");

        const preferredTier = preferredViewerImageTier(catalog, page);
        if (viewerState.singleImageResolutionCommitPending || preferredTier === CATALOG_IMAGE_TIER_FULL) {
          commitSingleViewerResolutionUpgrade(token);
        }
      };

      if (typeof image.decode === "function") {
        image.decode().catch(() => {}).then(finishReady);
      } else {
        finishReady();
      }
    },
    onExhausted: () => {
      if (token !== viewerState.singleImageResolutionLoadToken) return;
      viewerState.singleImageResolutionStop = null;
      viewerState.singleImageResolutionTargetSrc = "";
      viewerState.singleImageResolutionTargetTier = "";
      viewerState.singleImageResolutionReady = false;
      viewerState.singleImageResolutionVisible = false;
      viewerState.singleImageResolutionCommitPending = false;
      viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading", "is-resolution-upgrade-ready");
      image.removeAttribute("src");
    }
  });
  return true;
}

function setSingleViewerImageFeedback(mode = "", message = "") {
  const visible = Boolean(mode && message);
  const isError = mode === "error";
  viewerElements.viewerImageFeedback?.classList.toggle("hidden", !visible);
  if (viewerElements.viewerImageFeedback) {
    viewerElements.viewerImageFeedback.dataset.mode = visible ? mode : "";
    viewerElements.viewerImageFeedback.dataset.state = visible ? (isError ? "error" : "warning") : "";
    viewerElements.viewerImageFeedback.setAttribute("role", isError ? "alert" : "status");
    viewerElements.viewerImageFeedback.setAttribute("aria-live", isError ? "assertive" : "polite");
  }
  if (viewerElements.viewerImageFeedbackText) viewerElements.viewerImageFeedbackText.textContent = message;
  viewerElements.viewerImageRetry?.classList.toggle("hidden", !visible);
  viewerElements.lightboxImageFrame?.classList.toggle("image-fallback", mode === "fallback");
  if (mode !== "error") viewerElements.lightboxImageFrame?.classList.remove("image-terminal-error");
}

/**
 * @param {CatalogRecord} catalog
 * @param {number} page
 * @param {string} src
 * @param {ViewerImageSwapOptions} [options]
 */
function showSingleLightboxImage(catalog, page, src, options = {}) {
  if (!viewerElements.lightboxImage || !catalog) return;

  const token = ++viewerState.singleImageLoadToken;
  const image = viewerElements.lightboxImage;
  const request = options.imageRequest || viewerPageImageRequest(catalog, page, {
    forceFull: Boolean(options.forceFull)
  });
  const primarySrc = normalizeCatalogImageUrl(src || request.primarySrc);
  if (!primarySrc) return;
  const currentLogicalSrc = image.dataset.logicalSrc || normalizeCatalogImageUrl(image.getAttribute("src") || "");
  if (!options.forceRefresh && currentLogicalSrc === primarySrc && image.complete && image.naturalWidth && image.dataset.loadedQuality !== "fallback") {
    applyLightboxFrameGeometry(image.naturalWidth, image.naturalHeight, { updateFitScale: false });
    setSingleViewerImageFeedback();
    finishSingleImageSwap(token);
    return;
  }

  const preserveCurrentImage = Boolean(
    options.preserveCurrentImage
    && image.complete
    && image.naturalWidth > 0
    && !viewerElements.lightboxImageFrame?.classList.contains("image-terminal-error")
  );
  const retainedResolutionLayer = preserveCurrentImage
    && retainSingleViewerResolutionLayerForSwap();
  if (!retainedResolutionLayer) clearSingleViewerResolutionUpgrade();
  setViewerLoading(true);
  viewerElements.lightboxImageFrame?.setAttribute("aria-busy", "true");
  setSingleViewerImageFeedback();
  viewerElements.lightbox?.classList.add("is-page-loading");
  viewerElements.lightboxImageFrame?.classList.toggle("is-preparing-swap", !preserveCurrentImage);
  viewerElements.lightboxImageFrame?.classList.remove("image-terminal-error");
  if (preserveCurrentImage) {
    // Keep the decoded current page painted while the browser's pending image
    // request is replaced. The frame receives only a slight loading dim instead
    // of exposing the viewer background between pages.
    image.dataset.placeholderIgnore = "true";
  } else {
    prepareImagePlaceholder(image);
  }
  image.alt = `${catalog.title} - עמוד ${page}`;
  applyCatalogImageDimensions(image, catalog, page);
  image.decoding = "async";
  image.fetchPriority = "high";
  image.dataset.logicalSrc = primarySrc;

  const requestIsCurrent = () => (
    token === viewerState.singleImageLoadToken
    && isViewerSessionOpen()
    && activeCatalog() === catalog
    && activePage() === page
  );
  const commitImageRequest = () => {
    if (!requestIsCurrent()) return;
    loadCatalogImageWithRecovery(image, {
      primarySrc,
      primaryTier: request.primaryTier,
      fallbackCandidates: request.fallbackCandidates,
      forceRefresh: Boolean(options.forceRefresh),
      isCurrent: requestIsCurrent,
      telemetryDetail: "viewer-single",
      onSuccess: /** @param {CatalogImageCandidate} candidate */ (candidate) => {
        delete image.dataset.placeholderIgnore;
        const loadedTier = candidate.tier || request.primaryTier || CATALOG_IMAGE_TIER_FULL;
        const degraded = catalogImageTierRank(loadedTier) < catalogImageTierRank(request.primaryTier);
        image.dataset.loadedTier = loadedTier;
        image.dataset.loadedQuality = degraded ? "fallback" : loadedTier;
        if (image.naturalWidth && image.naturalHeight) {
          applyLightboxFrameGeometry(image.naturalWidth, image.naturalHeight, { updateFitScale: false });
        }
        releaseSingleViewerRetainedResolutionLayer();
        finishSingleImageSwap(token);
        viewerElements.lightboxImageFrame?.setAttribute("aria-busy", "false");
        runSingleImageSwapAnimation();
        if (degraded) {
          setSingleViewerImageFeedback("fallback", "שכבת התמונה המועדפת לא נטענה. מוצגת חלופה מוקטנת; אפשר לנסות שוב.");
        } else {
          setSingleViewerImageFeedback();
        }
      },
      onExhausted: () => {
        delete image.dataset.placeholderIgnore;
        delete image.dataset.loadedTier;
        delete image.dataset.loadedQuality;
        releaseSingleViewerRetainedResolutionLayer();
        finishSingleImageSwap(token);
        viewerElements.lightboxImageFrame?.setAttribute("aria-busy", "false");
        viewerElements.lightboxImageFrame?.classList.add("image-terminal-error");
        setSingleViewerImageFeedback("error", "התמונה לא הצליחה להיטען. אפשר לנסות שוב.");
      }
    });
  };

  if (preserveCurrentImage) {
    // Decode the target in a detached image first. Only then replace the visible
    // image source, so even browsers that clear an <img> during a src change can
    // reuse a decoded resource instead of exposing the viewer background.
    prepareCatalogImage(primarySrc, { priority: "high", detail: "viewer-page-stage" })
      .catch(() => null)
      .then(commitImageRequest);
  } else {
    commitImageRequest();
  }
}

/** @param {CatalogRecord} catalog @param {number} page @param {number} [zoom] */
function renderedViewerPagePhysicalLongSide(catalog, page, zoom = viewerState.zoom) {
  const frame = viewerElements.lightboxImageFrame || null;
  const rect = frame?.getBoundingClientRect?.();
  const dpr = Math.max(1, Number(window.devicePixelRatio) || 1);
  if (rect?.width && rect?.height) return Math.max(rect.width, rect.height) * dpr;

  const size = pageSize(catalog, page);
  const stageWidth = Math.max(1, viewerElements.stageCanvas?.clientWidth || window.innerWidth || 1);
  const stageHeight = Math.max(1, viewerElements.stageCanvas?.clientHeight || window.innerHeight || 1);
  if (!size) return Math.max(stageWidth, stageHeight) * dpr;

  const fitMode = String(viewerState.imageFitMode || VIEWER_FIT_HEIGHT);
  const scale = fitMode === VIEWER_FIT_WIDTH
    ? stageWidth / size.width
    : fitMode === VIEWER_FIT_HEIGHT
      ? stageHeight / size.height
      : Math.min(stageWidth / size.width, stageHeight / size.height);
  return Math.max(size.width, size.height) * Math.max(0.01, scale) * dpr * Math.max(1, Number(zoom) || 1);
}

/** @param {CatalogRecord} catalog @param {number} page @param {ViewerImageRequestOptions} [options] */
function preferredViewerImageTier(catalog, page, options = {}) {
  if (options.forceFull || !catalogSupportsImageTier(catalog, CATALOG_IMAGE_TIER_MEDIUM)) {
    return CATALOG_IMAGE_TIER_FULL;
  }
  if (options.preferMedium) return CATALOG_IMAGE_TIER_MEDIUM;

  const zoom = Number.isFinite(Number(options.zoom)) ? Number(options.zoom) : Number(viewerState.zoom || 1);
  if (zoom >= VIEWER_FULL_RESOLUTION_ZOOM_THRESHOLD) return CATALOG_IMAGE_TIER_FULL;

  if (!isSaveDataEnabled()) {
    const mediumMaxSide = catalogImageTierMaxSide(catalog, CATALOG_IMAGE_TIER_MEDIUM);
    const requiredPixels = renderedViewerPagePhysicalLongSide(catalog, page, zoom);
    if (requiredPixels > mediumMaxSide * VIEWER_MEDIUM_OVERSUBSCRIPTION_RATIO) {
      return CATALOG_IMAGE_TIER_FULL;
    }
  }
  return CATALOG_IMAGE_TIER_MEDIUM;
}

/** @param {CatalogRecord} catalog @param {number} page @param {ViewerImageRequestOptions} [options] @returns {CatalogImageRequest} */
function viewerPageImageRequest(catalog, page, options = {}) {
  const primaryTier = preferredViewerImageTier(catalog, page, options);
  const tierOrder = primaryTier === CATALOG_IMAGE_TIER_FULL
    ? [CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_MEDIUM, CATALOG_IMAGE_TIER_THUMB]
    : [CATALOG_IMAGE_TIER_MEDIUM, CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_THUMB];
  const candidates = tierOrder
    .filter((tier) => catalogSupportsImageTier(catalog, tier))
    .map((tier) => ({ tier, src: catalogPageImageSrc(catalog, page, tier) }))
    .filter((candidate) => candidate.src);
  const primary = candidates[0] || { tier: CATALOG_IMAGE_TIER_FULL, src: pageSrc(catalog, page) };
  return {
    primarySrc: primary.src,
    primaryTier: primary.tier,
    fallbackCandidates: candidates.slice(1).map((candidate, index) => ({
      ...candidate,
      role: `fallback-${index + 1}`
    }))
  };
}

/** @param {CatalogRecord} catalog @param {number} page @param {ViewerImageRequestOptions} [options] */
function viewerPageSrc(catalog, page, options = {}) {
  return viewerPageImageRequest(catalog, page, options).primarySrc;
}

/** @param {string} tier */
function catalogImageTierRank(tier) {
  if (tier === CATALOG_IMAGE_TIER_FULL) return 3;
  if (tier === CATALOG_IMAGE_TIER_MEDIUM) return 2;
  if (tier === CATALOG_IMAGE_TIER_THUMB) return 1;
  return 0;
}

/** @param {ViewerImageRequestOptions} [options] */
function refreshSingleViewerImageResolution(options = {}) {
  const catalog = activeCatalog();
  if (!isViewerSessionOpen() || !catalog || !viewerElements.lightboxImage) return false;
  if (viewerState.singleImageResolutionRetainedForSwap) return false;
  const page = activePage();
  const request = viewerPageImageRequest(catalog, page, options);

  if (options.warmFull && request.primaryTier !== CATALOG_IMAGE_TIER_FULL) {
    const fullRequest = viewerPageImageRequest(catalog, page, { forceFull: true });
    prepareSingleViewerResolutionUpgrade(catalog, page, fullRequest, { commit: false });
  }

  const currentSrc = activeSingleViewerImageLogicalSrc();
  const nextSrc = normalizeCatalogImageUrl(request.primarySrc);
  const loadedTier = activeSingleViewerImageTier();
  if (currentSrc === nextSrc) return Boolean(options.warmFull);
  if (catalogImageTierRank(loadedTier) > catalogImageTierRank(request.primaryTier)) return false;

  if (request.primaryTier === CATALOG_IMAGE_TIER_FULL) {
    return prepareSingleViewerResolutionUpgrade(catalog, page, request, { commit: true });
  }

  if (!viewerState.singleImageResolutionVisible && !viewerState.singleImageResolutionReady) {
    clearSingleViewerResolutionUpgrade();
  }
  return false;
}

function preloadNeighbors() {
  const catalog = activeCatalog();
  if (!catalog) return;
  const preferredTier = preferredViewerImageTier(catalog, activePage());
  const preloadFull = preferredTier === CATALOG_IMAGE_TIER_FULL;
  const radius = preloadFull ? 1 : catalogNeighborPreloadRadius();
  const requestOptions = preloadFull ? { forceFull: true } : { preferMedium: true };
  if (radius < 1) return;

  if (isFavoritesLightboxMode()) {
    const favorites = getFeatureInterface("favorites");
    const entries = favorites?.entries() || [];
    const viewerIndex = favorites?.viewerIndex() ?? 0;
    Array.from({ length: radius * 2 }, (_unused, index) => (
      index < radius
        ? viewerIndex - (radius - index)
        : viewerIndex + (index - radius + 1)
    ))
      .filter((index) => index >= 0 && index < entries.length)
      .forEach((index) => {
        const entry = entries[index];
        prepareCatalogImage(viewerPageSrc(entry.catalog, entry.page, requestOptions), { priority: "low" }).catch(() => {});
      });
    return;
  }

  Array.from({ length: radius * 2 }, (_unused, index) => (
    index < radius
      ? activePage() - (radius - index)
      : activePage() + (index - radius + 1)
  ))
    .filter((page) => page >= catalogFirstPage(catalog) && page <= catalogLastPage(catalog))
    .forEach((page) => {
      prepareCatalogImage(viewerPageSrc(catalog, page, requestOptions), { priority: "low" }).catch(() => {});
    });
}


/* TEST-ONLY EXPORTS: BEGIN */
if (typeof __BARGIG_TEST_EXPORTS__ !== "undefined") {
  __BARGIG_TEST_EXPORTS__["viewer-image"] = Object.freeze({
    retainSingleViewerResolutionLayerForSwap,
    releaseSingleViewerRetainedResolutionLayer,
    shouldWarmSingleViewerFullResolution,
    renderedViewerPagePhysicalLongSide,
    preferredViewerImageTier,
    viewerPageImageRequest
  });
}
/* TEST-ONLY EXPORTS: END */

export { activeSingleViewerImageLogicalSrc, activeSingleViewerImageTier, clearSingleViewerResolutionUpgrade, preloadNeighbors, refreshSingleViewerImageResolution, shouldWarmSingleViewerFullResolution, showSingleLightboxImage, viewerPageImageRequest, viewerPageSrc };
