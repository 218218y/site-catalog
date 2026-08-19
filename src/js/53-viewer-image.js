/**
 * Source module: 53-viewer-image.js
 * Viewer-only image swaps, resolution selection, and progressive upgrade lifecycle.
 */

/** @import { CatalogImageTier, CatalogRecord } from "../../types/catalog-data.generated.js" */
/** @import { CatalogImageCandidate, CatalogImageRequest, ViewerImageRequestOptions, ViewerFrameGeometryOptions, ViewerImageSwapOptions, ViewerPageSwapAnimationOptions, ViewerResolutionUpgradeOptions } from "../../types/frontend-contracts.js" */

import { catalogFirstPage, catalogLastPage } from "./06-catalog-page-numbering.js";
import { CATALOG_IMAGE_TIER_FULL, CATALOG_IMAGE_TIER_MEDIUM, CATALOG_IMAGE_TIER_THUMB, getFeatureInterface } from "./10-app-state.js";
import { telemetryCreateImageRequestContext } from "../runtime/telemetry.js";
import { AUTO_VIEWER_ZOOM, VIEWER_FIT_HEIGHT, VIEWER_FIT_WIDTH, VIEWER_FULL_RESOLUTION_WARMUP_ZOOM_EPSILON, VIEWER_FULL_RESOLUTION_ZOOM_THRESHOLD, VIEWER_MEDIUM_OVERSUBSCRIPTION_RATIO, VIEWER_NEIGHBOR_PRELOAD_SETTLE_MS, VIEWER_PAGE_SWAP_CLEANUP_MS, viewerElements, viewerImageState, viewerViewportState } from "./16-viewer-state.js";
import { attachViewerResolutionStopCommand, beginViewerImageSwapCommand, beginViewerResolutionCommand, cancelViewerResolutionCommand, commitViewerResolutionCommand, isViewerImageSwapCurrent, markViewerResolutionReadyCommand, releaseViewerRetainedResolutionCommand, retainViewerResolutionForSwapCommand } from "./17-viewer-state-transitions.js";
import { activeCatalog, activePage, isFavoritesLightboxMode } from "./18-navigation-feature.js";
import { applyCatalogImageDimensions, catalogImageTierMaxSide, catalogNeighborPreloadRadius, catalogPageImageSrc, catalogSupportsImageTier, isSaveDataEnabled, loadCatalogImageWithRecovery, networkEffectiveType, normalizeCatalogImageUrl, pageSize, prepareCatalogImage, prepareImagePlaceholder, syncImagePlaceholderState } from "./20-catalog-runtime.js";
import { pageSrc } from "./17-catalog-asset-urls.js";
import { isViewerSessionOpen } from "./51-viewer-session-state.js";
import { applyLightboxFrameGeometry, applyZoom } from "./54-viewer-geometry.js";

/** @param {boolean} isLoading */
function setViewerLoading(isLoading) {
  viewerElements.viewerLoading.classList.toggle("hidden", !isLoading);
}


/**
 * Keep the frame on the catalog compiler's authoritative page geometry. Image
 * tiers may be resized independently and can differ by a rounding pixel; using
 * their decoded dimensions for layout would reflow an already-primed frame.
 * Natural dimensions remain the safe fallback for legacy/incomplete records.
 * @param {CatalogRecord} catalog
 * @param {number} page
 * @param {HTMLImageElement} image
 * @param {ViewerFrameGeometryOptions} [options]
 */
function applyStableViewerPageGeometry(catalog, page, image, options = {}) {
  const declaredSize = pageSize(catalog, page);
  const width = Number(declaredSize?.width) || Number(image?.naturalWidth) || 0;
  const height = Number(declaredSize?.height) || Number(image?.naturalHeight) || 0;
  if (width <= 0 || height <= 0) return null;
  return applyLightboxFrameGeometry(width, height, options);
}

function cancelSingleViewerStagePreparation() {
  const controller = viewerImageState.singleImageStageAbortController;
  if (!controller) return false;
  viewerImageState.singleImageStageAbortController = null;
  controller.abort();
  return true;
}

function clearViewerNeighborPreloadSchedule() {
  window.clearTimeout(viewerImageState.neighborPreloadTimer);
  viewerImageState.neighborPreloadTimer = 0;
}

function clearViewerImagePreparations() {
  cancelSingleViewerStagePreparation();
  clearViewerNeighborPreloadSchedule();
}

/**
 * @param {HTMLElement|null|undefined} element
 * @param {ViewerPageSwapAnimationOptions} [options]
 */
function runViewerPageSwapAnimation(element, options = /** @type {ViewerPageSwapAnimationOptions} */ ({ timerKey: "singleImageAnimationTimer" })) {
  const { timerKey, root = element?.parentElement } = options;
  if (!element || !timerKey || !(timerKey in viewerImageState)) return;

  window.clearTimeout(viewerImageState[timerKey]);
  root?.querySelectorAll?.(".page-swap-enter")
    .forEach((animatedElement) => animatedElement.classList.remove("page-swap-enter"));

  // Restart the entrance animation only after the target page geometry and
  // positioning are ready, so the incoming single frame never animates from a
  // stale size or location.
  void element.offsetWidth;
  element.classList.add("page-swap-enter");
  viewerImageState[timerKey] = window.setTimeout(() => {
    element.classList.remove("page-swap-enter");
    viewerImageState[timerKey] = 0;
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
  if (!isViewerImageSwapCurrent(token)) return;
  setViewerLoading(false);
  viewerElements.lightbox?.classList.remove("is-page-loading");
  viewerElements.lightboxImageFrame?.classList.remove("is-preparing-swap");
  syncImagePlaceholderState(viewerElements.lightboxImage);
  applyZoom();
}

function ensureSingleViewerResolutionImage() {
  if (viewerImageState.singleImageResolutionImage?.isConnected) return viewerImageState.singleImageResolutionImage;
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
  viewerImageState.singleImageResolutionImage = image;
  return image;
}

function clearSingleViewerResolutionUpgrade() {
  cancelViewerResolutionCommand();
  viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading", "is-resolution-upgrade-ready");

  const image = viewerImageState.singleImageResolutionImage;
  if (!image) return;
  image.removeAttribute("src");
  delete image.dataset.resolutionRetainedForSwap;
  delete image.dataset.logicalSrc;
  delete image.dataset.loadedTier;
  delete image.dataset.loadedQuality;
  delete image.dataset.imageLoadPending;
}

function retainSingleViewerResolutionLayerForSwap() {
  const image = viewerImageState.singleImageResolutionImage;
  if (viewerImageState.singleImageResolutionRetainedForSwap) {
    return Boolean(image?.isConnected && image.naturalWidth > 0);
  }
  if (
    !viewerImageState.singleImageResolutionVisible
    || !viewerImageState.singleImageResolutionReady
    || !image?.isConnected
    || image.naturalWidth <= 0
  ) {
    return false;
  }

  // Freeze the already-decoded high-resolution layer as the visual front buffer.
  // Its ownership metadata is retired immediately, so it cannot be mistaken for
  // the target page, but its pixels remain painted until the next page is decoded.
  retainViewerResolutionForSwapCommand();
  image.dataset.resolutionRetainedForSwap = "true";
  viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading");
  viewerElements.lightboxImageFrame?.classList.add("is-resolution-upgrade-ready");
  return true;
}

function releaseSingleViewerRetainedResolutionLayer() {
  if (!viewerImageState.singleImageResolutionRetainedForSwap) return false;
  releaseViewerRetainedResolutionCommand();
  viewerElements.lightboxImageFrame?.classList.remove("is-resolution-upgrade-ready");

  const image = viewerImageState.singleImageResolutionImage;
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
  if (viewerImageState.singleImageResolutionVisible && viewerImageState.singleImageResolutionTargetSrc) {
    return viewerImageState.singleImageResolutionTargetSrc;
  }
  return normalizeCatalogImageUrl(viewerElements.lightboxImage?.dataset.logicalSrc || viewerElements.lightboxImage?.getAttribute("src") || "");
}

/** @returns {CatalogImageTier|""} */
function activeSingleViewerImageTier() {
  if (viewerImageState.singleImageResolutionRetainedForSwap) return CATALOG_IMAGE_TIER_FULL;
  if (viewerImageState.singleImageResolutionVisible && viewerImageState.singleImageResolutionTargetTier) {
    return viewerImageState.singleImageResolutionTargetTier;
  }
  const loadedTier = viewerElements.lightboxImage?.dataset.loadedTier || "";
  return loadedTier === CATALOG_IMAGE_TIER_THUMB || loadedTier === CATALOG_IMAGE_TIER_MEDIUM || loadedTier === CATALOG_IMAGE_TIER_FULL
    ? loadedTier
    : "";
}

function shouldWarmSingleViewerFullResolution(previousZoom = viewerViewportState.zoom) {
  if (isSaveDataEnabled()) return false;
  const effectiveType = networkEffectiveType();
  if (effectiveType === "slow-2g" || effectiveType === "2g" || effectiveType === "3g") return false;

  const zoom = Number(viewerViewportState.zoom) || AUTO_VIEWER_ZOOM;
  const previous = Number(previousZoom) || AUTO_VIEWER_ZOOM;
  return zoom > AUTO_VIEWER_ZOOM + VIEWER_FULL_RESOLUTION_WARMUP_ZOOM_EPSILON
    && zoom > previous + 0.001;
}

function commitSingleViewerResolutionUpgrade(token = viewerImageState.singleImageResolutionLoadToken) {
  if (!commitViewerResolutionCommand(token)) return false;

  requestAnimationFrame(() => {
    if (token !== viewerImageState.singleImageResolutionLoadToken || !viewerImageState.singleImageResolutionVisible) return;
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

  const sameTarget = viewerImageState.singleImageResolutionTargetSrc === targetSrc
    && viewerImageState.singleImageResolutionTargetTier === request.primaryTier;
  if (sameTarget) {
    if (options.commit) commitSingleViewerResolutionUpgrade();
    return true;
  }

  const image = ensureSingleViewerResolutionImage();
  if (!image) return false;

  const token = beginViewerResolutionCommand(targetSrc, request.primaryTier, Boolean(options.commit));
  viewerElements.lightboxImageFrame?.classList.add("is-resolution-loading");

  const stop = loadCatalogImageWithRecovery(image, {
    primarySrc: targetSrc,
    primaryTier: request.primaryTier,
    isCurrent: () => (
      token === viewerImageState.singleImageResolutionLoadToken
      && isViewerSessionOpen()
      && activeCatalog() === catalog
      && activePage() === page
      && viewerImageState.singleImageResolutionTargetSrc === targetSrc
    ),
    telemetryDetail: "viewer-resolution-upgrade",
    telemetrySurface: "viewer-resolution-upgrade",
    telemetryVisibility: "background",
    telemetryRequestedTier: request.primaryTier,
    onSuccess: /** @param {CatalogImageCandidate} candidate */ (candidate) => {
      const finishReady = () => {
        if (token !== viewerImageState.singleImageResolutionLoadToken || !image.naturalWidth) return;
        if (!markViewerResolutionReadyCommand(token)) return;
        image.dataset.logicalSrc = targetSrc;
        image.dataset.loadedTier = candidate.tier || request.primaryTier;
        image.dataset.loadedQuality = image.dataset.loadedTier;
        viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading");

        const preferredTier = preferredViewerImageTier(catalog, page);
        if (viewerImageState.singleImageResolutionCommitPending || preferredTier === CATALOG_IMAGE_TIER_FULL) {
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
      if (token !== viewerImageState.singleImageResolutionLoadToken) return;
      cancelViewerResolutionCommand();
      viewerElements.lightboxImageFrame?.classList.remove("is-resolution-loading", "is-resolution-upgrade-ready");
      image.removeAttribute("src");
    }
  });
  attachViewerResolutionStopCommand(token, stop);
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

  cancelSingleViewerStagePreparation();
  const token = beginViewerImageSwapCommand();
  const image = viewerElements.lightboxImage;
  const request = options.imageRequest || viewerPageImageRequest(catalog, page, {
    forceFull: Boolean(options.forceFull)
  });
  const primarySrc = normalizeCatalogImageUrl(src || request.primarySrc);
  if (!primarySrc) return;
  const currentLogicalSrc = image.dataset.logicalSrc || normalizeCatalogImageUrl(image.getAttribute("src") || "");
  if (!options.forceRefresh && currentLogicalSrc === primarySrc && image.complete && image.naturalWidth && image.dataset.loadedQuality !== "fallback") {
    applyStableViewerPageGeometry(catalog, page, image, { updateFitScale: false });
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
    isViewerImageSwapCurrent(token)
    && isViewerSessionOpen()
    && activeCatalog() === catalog
    && activePage() === page
  );
  /**
   * @param {number} [initialFailedAttempts]
   * @param {ReturnType<typeof telemetryCreateImageRequestContext>|null} [telemetryRequestContext]
   */
  const commitImageRequest = (initialFailedAttempts = 0, telemetryRequestContext = null) => {
    if (!requestIsCurrent()) return;
    loadCatalogImageWithRecovery(image, {
      primarySrc,
      primaryTier: request.primaryTier,
      fallbackCandidates: request.fallbackCandidates,
      forceRefresh: Boolean(options.forceRefresh),
      isCurrent: requestIsCurrent,
      telemetryDetail: "viewer-single",
      telemetrySurface: "viewer-stage",
      telemetryRequestedTier: request.primaryTier,
      telemetryRequestContext,
      initialFailedAttempts,
      onSuccess: /** @param {CatalogImageCandidate} candidate */ (candidate) => {
        delete image.dataset.placeholderIgnore;
        const loadedTier = candidate.tier || request.primaryTier || CATALOG_IMAGE_TIER_FULL;
        const degraded = catalogImageTierRank(loadedTier) < catalogImageTierRank(request.primaryTier);
        image.dataset.loadedTier = loadedTier;
        image.dataset.loadedQuality = degraded ? "fallback" : loadedTier;
        if (image.naturalWidth && image.naturalHeight) {
          applyStableViewerPageGeometry(catalog, page, image, { updateFitScale: false });
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
    const controller = new AbortController();
    viewerImageState.singleImageStageAbortController = controller;
    const telemetryRequestContext = telemetryCreateImageRequestContext(image, primarySrc, {
      detail: "viewer-single",
      surface: "viewer-stage",
      visibility: "visible",
      requestedTier: request.primaryTier
    });
    prepareCatalogImage(primarySrc, {
      priority: "high",
      detail: "viewer-single-stage",
      surface: "viewer-stage",
      visibility: "visible",
      failureAction: "stage",
      cache: false,
      signal: controller.signal,
      isCurrent: requestIsCurrent,
      terminalOnFailure: false,
      telemetryRequestContext,
      requestedTier: request.primaryTier
    })
      .then(() => ({ failedAttempts: 0 }))
      .catch((error) => {
        if (error?.name === "AbortError" || !requestIsCurrent()) return null;
        return { failedAttempts: 1 };
      })
      .then((result) => {
        if (!result) return;
        commitImageRequest(result.failedAttempts, telemetryRequestContext);
      })
      .finally(() => {
        if (viewerImageState.singleImageStageAbortController === controller) {
          viewerImageState.singleImageStageAbortController = null;
        }
      });
  } else {
    commitImageRequest();
  }
}

/** @param {CatalogRecord} catalog @param {number} page @param {number} [zoom] */
function renderedViewerPagePhysicalLongSide(catalog, page, zoom = viewerViewportState.zoom) {
  const frame = viewerElements.lightboxImageFrame || null;
  const rect = frame?.getBoundingClientRect?.();
  const dpr = Math.max(1, Number(window.devicePixelRatio) || 1);
  if (rect?.width && rect?.height) return Math.max(rect.width, rect.height) * dpr;

  const size = pageSize(catalog, page);
  const stageWidth = Math.max(1, viewerElements.stageCanvas?.clientWidth || window.innerWidth || 1);
  const stageHeight = Math.max(1, viewerElements.stageCanvas?.clientHeight || window.innerHeight || 1);
  if (!size) return Math.max(stageWidth, stageHeight) * dpr;

  const fitMode = String(viewerViewportState.imageFitMode || VIEWER_FIT_HEIGHT);
  const scale = fitMode === VIEWER_FIT_WIDTH
    ? stageWidth / size.width
    : fitMode === VIEWER_FIT_HEIGHT
      ? stageHeight / size.height
      : Math.min(stageWidth / size.width, stageHeight / size.height);
  return Math.max(size.width, size.height) * Math.max(0.01, scale) * dpr * Math.max(1, Number(zoom) || 1);
}

/** @param {CatalogRecord} catalog @param {number} page @param {ViewerImageRequestOptions} [options] @returns {CatalogImageTier} */
function preferredViewerImageTier(catalog, page, options = {}) {
  if (options.forceFull || !catalogSupportsImageTier(catalog, CATALOG_IMAGE_TIER_MEDIUM)) {
    return CATALOG_IMAGE_TIER_FULL;
  }
  if (options.preferMedium) return CATALOG_IMAGE_TIER_MEDIUM;

  const zoom = Number.isFinite(Number(options.zoom)) ? Number(options.zoom) : Number(viewerViewportState.zoom || 1);
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
  /** @type {Array<CatalogImageTier>} */
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

/** @param {CatalogImageTier|""} tier */
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
  if (viewerImageState.singleImageResolutionRetainedForSwap) return false;
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

  if (!viewerImageState.singleImageResolutionVisible && !viewerImageState.singleImageResolutionReady) {
    clearSingleViewerResolutionUpgrade();
  }
  return false;
}

/** @param {CatalogRecord} catalog @param {number} page @param {number} favoriteIndex */
function runViewerNeighborPreloads(catalog, page, favoriteIndex = -1) {
  const preferredTier = preferredViewerImageTier(catalog, page);
  const preloadFull = preferredTier === CATALOG_IMAGE_TIER_FULL;
  const radius = preloadFull ? 1 : catalogNeighborPreloadRadius();
  const requestOptions = preloadFull ? { forceFull: true } : { preferMedium: true };
  if (radius < 1) return;

  if (isFavoritesLightboxMode()) {
    const favorites = getFeatureInterface("favorites");
    const entries = favorites?.entries() || [];
    Array.from({ length: radius * 2 }, (_unused, index) => (
      index < radius
        ? favoriteIndex - (radius - index)
        : favoriteIndex + (index - radius + 1)
    ))
      .filter((index) => index >= 0 && index < entries.length)
      .forEach((index) => {
        const entry = entries[index];
        const request = viewerPageImageRequest(entry.catalog, entry.page, requestOptions);
        prepareCatalogImage(request.primarySrc, {
          priority: "low",
          detail: "viewer-neighbor-preload",
          surface: "viewer-favorites-neighbor-preload",
          visibility: "preload",
          requestedTier: request.primaryTier
        }).catch(() => {});
      });
    return;
  }

  Array.from({ length: radius * 2 }, (_unused, index) => (
    index < radius
      ? page - (radius - index)
      : page + (index - radius + 1)
  ))
    .filter((page) => page >= catalogFirstPage(catalog) && page <= catalogLastPage(catalog))
    .forEach((page) => {
      const request = viewerPageImageRequest(catalog, page, requestOptions);
      prepareCatalogImage(request.primarySrc, {
        priority: "low",
        detail: "viewer-neighbor-preload",
        surface: "viewer-neighbor-preload",
        visibility: "preload",
        requestedTier: request.primaryTier
      }).catch(() => {});
    });
}

function preloadNeighbors() {
  clearViewerNeighborPreloadSchedule();
  const catalog = activeCatalog();
  if (!catalog || !isViewerSessionOpen()) return;

  const page = activePage();
  const favoritesMode = isFavoritesLightboxMode();
  const favoriteIndex = favoritesMode
    ? (getFeatureInterface("favorites")?.viewerIndex() ?? 0)
    : -1;

  viewerImageState.neighborPreloadTimer = window.setTimeout(() => {
    viewerImageState.neighborPreloadTimer = 0;
    if (!isViewerSessionOpen() || activeCatalog() !== catalog || activePage() !== page) return;
    if (isFavoritesLightboxMode() !== favoritesMode) return;
    if (favoritesMode && (getFeatureInterface("favorites")?.viewerIndex() ?? 0) !== favoriteIndex) return;
    runViewerNeighborPreloads(catalog, page, favoriteIndex);
  }, VIEWER_NEIGHBOR_PRELOAD_SETTLE_MS);
}



export {
  activeSingleViewerImageLogicalSrc,
  activeSingleViewerImageTier,
  cancelSingleViewerStagePreparation,
  clearSingleViewerResolutionUpgrade,
  clearViewerImagePreparations,
  clearViewerNeighborPreloadSchedule,
  preferredViewerImageTier,
  preloadNeighbors,
  refreshSingleViewerImageResolution,
  releaseSingleViewerRetainedResolutionLayer,
  renderedViewerPagePhysicalLongSide,
  retainSingleViewerResolutionLayerForSwap,
  runViewerNeighborPreloads,
  setViewerLoading,
  shouldWarmSingleViewerFullResolution,
  showSingleLightboxImage,
  viewerPageImageRequest,
  viewerPageSrc
};
