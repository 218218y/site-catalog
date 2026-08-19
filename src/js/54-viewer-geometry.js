/**
 * Source module: 54-viewer-geometry.js
 * Viewer fit geometry, zoom, pan bounds, relative-position transfer, and edge-turn overscroll.
 *
 * Runtime dependencies are explicit ES module imports. Route entrypoints are
 * bundled by the pinned esbuild tool into stable browser asset names.
 */

/** @import { CatalogRecord } from "../../types/catalog-data.generated.js" */
/** @import { PointLike, ViewerFitMode, ViewerFitModeSource, ViewerFrameGeometryOptions, ViewerGeometryResetOptions, ViewerPanBoundsOptions, ViewerPointerPoint } from "../../types/frontend-contracts.js" */

import { catalogDocumentUrl, isAppPage, updateDocumentMetadata, viewerDocumentUrl } from "./00-navigation.js";
import { LIGHTBOX_SOURCE_CATALOG, LIGHTBOX_SOURCE_FAVORITES } from "./11-navigation-state.js";
import { AUTO_VIEWER_ZOOM, MAX_VIEWER_ZOOM, MIN_VIEWER_ZOOM, VIEWER_FIT_HEIGHT, VIEWER_FIT_SOURCE_AUTO, VIEWER_FIT_SOURCE_MANUAL, VIEWER_FIT_WIDTH, VIEWER_PAGE_TURN_BUFFER_MAX_PX, VIEWER_PAGE_TURN_BUFFER_MIN_PX, VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO, viewerElements, viewerGestureState, viewerViewportState } from "./16-viewer-state.js";
import { activeCatalog, activePage } from "./18-navigation-feature.js";
import { clampValue } from "./19-shared-pure.js";
import { pageSize } from "./20-catalog-runtime.js";
import { isFavoritesLightboxMode } from "./30-favorites-share.js";

function updateHash() {
  const catalog = activeCatalog();
  if (isAppPage("catalog") && catalog) {
    history.replaceState(history.state, "", catalogDocumentUrl(catalog.id));
  } else if (isAppPage("viewer") && catalog) {
    history.replaceState(history.state, "", viewerDocumentUrl(catalog.id, activePage(), {
      source: isFavoritesLightboxMode() ? LIGHTBOX_SOURCE_FAVORITES : LIGHTBOX_SOURCE_CATALOG
    }));
  }

  updateDocumentMetadata(catalog);
}

function getPointerList() {
  return Array.from(viewerGestureState.pointers.values());
}

/** @param {ViewerPointerPoint} first @param {ViewerPointerPoint} second */
function pointerDistance(first, second) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

/** @param {ViewerPointerPoint} first @param {ViewerPointerPoint} second @returns {PointLike} */
function pointerMidpoint(first, second) {
  return {
    x: (first.x + second.x) / 2,
    y: (first.y + second.y) / 2
  };
}

function getMinimumViewerZoom() {
  return MIN_VIEWER_ZOOM;
}

function isAutoViewerZoom(value = viewerViewportState.zoom) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && Math.abs(numeric - AUTO_VIEWER_ZOOM) <= 0.001;
}

function getSafeViewerZoom(value = viewerViewportState.zoom) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return AUTO_VIEWER_ZOOM;
  return clampValue(numeric, getMinimumViewerZoom(), MAX_VIEWER_ZOOM);
}

/** @param {unknown} fitMode @returns {ViewerFitMode} */
function normalizeViewerFitMode(fitMode) {
  return fitMode === VIEWER_FIT_WIDTH ? VIEWER_FIT_WIDTH : VIEWER_FIT_HEIGHT;
}

/** @param {unknown} source @returns {ViewerFitModeSource} */
function normalizeViewerFitModeSource(source) {
  return source === VIEWER_FIT_SOURCE_AUTO
    ? VIEWER_FIT_SOURCE_AUTO
    : VIEWER_FIT_SOURCE_MANUAL;
}

function viewerUsesAutomaticFitMode() {
  return normalizeViewerFitModeSource(viewerViewportState.imageFitModeSource) === VIEWER_FIT_SOURCE_AUTO;
}

function getViewerFitViewportSize() {
  const stageWidth = Number(viewerElements.stageCanvas?.clientWidth) || 0;
  const stageHeight = Number(viewerElements.stageCanvas?.clientHeight) || 0;
  if (stageWidth > 0 && stageHeight > 0) {
    return { width: stageWidth, height: stageHeight };
  }

  const visualWidth = Number(window.visualViewport?.width) || 0;
  const visualHeight = Number(window.visualViewport?.height) || 0;
  if (visualWidth > 0 && visualHeight > 0) {
    return { width: visualWidth, height: visualHeight };
  }

  return {
    width: Number(window.innerWidth) || Number(document.documentElement?.clientWidth) || 0,
    height: Number(window.innerHeight) || Number(document.documentElement?.clientHeight) || 0
  };
}

/** @returns {ViewerFitMode} */
function getAutomaticViewerFitMode() {
  const viewport = getViewerFitViewportSize();
  const naturalSize = getActiveSingleImageNaturalSize();
  if (
    naturalSize
    && viewport.width > 0
    && viewport.height > 0
    && naturalSize.width > 0
    && naturalSize.height > 0
  ) {
    const availableWidth = Math.max(1, viewport.width - 18);
    const availableHeight = Math.max(1, viewport.height - 18);
    const renderedWidthAtHeightFit = naturalSize.width * (availableHeight / naturalSize.height);
    return renderedWidthAtHeightFit <= availableWidth + 0.5
      ? VIEWER_FIT_HEIGHT
      : VIEWER_FIT_WIDTH;
  }

  // Before catalog/image dimensions are available, retain the historical
  // orientation fallback. A later page/image/layout reconciliation replaces it
  // with the dimension-aware decision above.
  return viewport.height > viewport.width ? VIEWER_FIT_WIDTH : VIEWER_FIT_HEIGHT;
}

function getActiveSingleImageNaturalSize() {
  const configuredSize = activeCatalog() ? pageSize(activeCatalog(), activePage()) : null;
  if (configuredSize) return configuredSize;

  const image = viewerElements.lightboxImage;
  if (image?.naturalWidth && image?.naturalHeight) {
    return { width: image.naturalWidth, height: image.naturalHeight };
  }

  return null;
}

function getSingleImageDisplayMetrics() {
  const naturalSize = getActiveSingleImageNaturalSize();
  const stage = viewerElements.stageCanvas;
  if (!naturalSize || !stage) return null;

  const safeZoom = getSafeViewerZoom();
  const width = naturalSize.width * viewerViewportState.fitScale * safeZoom;
  const height = naturalSize.height * viewerViewportState.fitScale * safeZoom;
  return {
    width,
    height,
    overflowX: Math.max(0, (width - stage.clientWidth) / 2),
    overflowY: Math.max(0, (height - stage.clientHeight) / 2)
  };
}

function singleImageCanPan() {
  const metrics = getSingleImageDisplayMetrics();
  return Boolean(metrics && (metrics.overflowX > 1 || metrics.overflowY > 1));
}

function viewerCanPan() {
  return singleImageCanPan();
}

function singleViewerUsesBoundaryPan() {
  return getSafeViewerZoom() > AUTO_VIEWER_ZOOM + 0.001 || singleImageCanPan();
}

function getViewerPageTurnBuffer(axis = "y") {
  const stage = viewerElements.stageCanvas;
  const viewportSize = axis === "x"
    ? (stage?.clientWidth || window.innerWidth || 0)
    : (stage?.clientHeight || window.innerHeight || 0);
  if (!Number.isFinite(viewportSize) || viewportSize <= 0) {
    return VIEWER_PAGE_TURN_BUFFER_MIN_PX;
  }

  return clampValue(
    viewportSize * VIEWER_PAGE_TURN_BUFFER_VIEWPORT_RATIO,
    VIEWER_PAGE_TURN_BUFFER_MIN_PX,
    VIEWER_PAGE_TURN_BUFFER_MAX_PX
  );
}

/** @param {ViewerPanBoundsOptions} [options] */
function getSinglePanBounds(options = {}) {
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return null;

  const allowPageTurnBuffer = options.allowPageTurnBuffer !== false && singleViewerUsesBoundaryPan();
  const bufferX = allowPageTurnBuffer ? getViewerPageTurnBuffer("x") : 0;
  const bufferY = allowPageTurnBuffer ? getViewerPageTurnBuffer("y") : 0;
  return {
    metrics,
    realLimitX: metrics.overflowX,
    realLimitY: metrics.overflowY,
    limitX: metrics.overflowX + bufferX,
    limitY: metrics.overflowY + bufferY,
    bufferX,
    bufferY
  };
}

/** @param {ViewerPanBoundsOptions} [options] */
function clampSinglePan(options = {}) {
  const bounds = getSinglePanBounds(options);
  if (!bounds) return null;

  viewerViewportState.panX = bounds.limitX <= 1 ? 0 : clampValue(viewerViewportState.panX, -bounds.limitX, bounds.limitX);
  viewerViewportState.panY = bounds.limitY <= 1 ? 0 : clampValue(viewerViewportState.panY, -bounds.limitY, bounds.limitY);
  return bounds;
}

function clearSingleImagePendingPosition() {
  viewerViewportState.singleImageFitOriginPending = false;
  viewerViewportState.singleImagePendingRelativePosition = null;
  viewerViewportState.singleImagePendingPageTurnOrigin = null;
}

function captureSingleImageRelativePosition() {
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return { xRatio: 0, yRatio: 0 };

  return {
    xRatio: metrics.overflowX > 1
      ? clampValue(viewerViewportState.panX / metrics.overflowX, -1, 1)
      : 0,
    yRatio: metrics.overflowY > 1
      ? clampValue(viewerViewportState.panY / metrics.overflowY, -1, 1)
      : 0
  };
}

/** @param {ViewerGeometryResetOptions} [options] */
function resetImagePosition(options = {}) {
  viewerViewportState.panX = 0;
  viewerViewportState.panY = 0;
  clearSingleImagePendingPosition();
  if (options.queueSingleFitOrigin) {
    viewerViewportState.singleImageFitOriginPending = true;
  }
}

function applyPendingSingleImagePosition() {
  const metrics = getSingleImageDisplayMetrics();
  if (!metrics) return false;

  const pageTurnOrigin = viewerViewportState.singleImagePendingPageTurnOrigin;
  if (pageTurnOrigin?.page === activePage()) {
    // Edge-driven navigation behaves like continuous reading: moving forward
    // opens the target at its top, while moving backward enters from its bottom.
    // Horizontal page turns still use the same vertical reading origin and keep
    // the image centered horizontally.
    viewerViewportState.panX = 0;
    viewerViewportState.panY = pageTurnOrigin.direction > 0 ? metrics.overflowY : -metrics.overflowY;
    viewerViewportState.singleImagePendingPageTurnOrigin = null;
    viewerViewportState.singleImagePendingRelativePosition = null;
    viewerViewportState.singleImageFitOriginPending = false;
    return true;
  }

  const relativePosition = viewerViewportState.singleImagePendingRelativePosition;
  if (relativePosition?.page === activePage()) {
    viewerViewportState.panX = metrics.overflowX * relativePosition.xRatio;
    viewerViewportState.panY = metrics.overflowY * relativePosition.yRatio;
    viewerViewportState.singleImagePendingRelativePosition = null;
    viewerViewportState.singleImagePendingPageTurnOrigin = null;
    viewerViewportState.singleImageFitOriginPending = false;
    return true;
  }

  if (!viewerViewportState.singleImageFitOriginPending) return false;

  viewerViewportState.panX = 0;
  viewerViewportState.panY = 0;
  if (viewerViewportState.imageFitMode === VIEWER_FIT_WIDTH && metrics.overflowY > 1) {
    viewerViewportState.panY = metrics.overflowY;
  }
  viewerViewportState.singleImageFitOriginPending = false;
  viewerViewportState.singleImagePendingRelativePosition = null;
  viewerViewportState.singleImagePendingPageTurnOrigin = null;
  return true;
}

/** @param {number} naturalWidth @param {number} naturalHeight */
function singleImageFitLayout(naturalWidth, naturalHeight) {
  const stage = viewerElements.stageCanvas;
  const width = Number(naturalWidth);
  const height = Number(naturalHeight);
  if (!stage || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;

  // The direct viewer route primes the frame while the fullscreen shell is
  // still hidden. Hidden descendants report zero client dimensions, so using
  // the stage box alone creates a small provisional frame that is resized on
  // the first visible animation frame. Fall back to the final visual viewport
  // dimensions so the very first geometry written is also the stable one.
  const viewportWidth = Math.max(0, Number(window.visualViewport?.width) || Number(window.innerWidth) || 0);
  const viewportHeight = Math.max(0, Number(window.visualViewport?.height) || Number(window.innerHeight) || 0);
  const stageWidth = Math.max(0, Number(stage.clientWidth) || viewportWidth);
  const stageHeight = Math.max(0, Number(stage.clientHeight) || viewportHeight);
  const availableWidth = Math.max(260, stageWidth - 18);
  const availableHeight = Math.max(260, stageHeight - 18);
  const widthScale = availableWidth / width;
  const heightScale = availableHeight / height;
  const fitScale = viewerViewportState.imageFitMode === VIEWER_FIT_WIDTH ? widthScale : heightScale;
  return {
    fitScale,
    width: Math.max(220, Math.round(width * fitScale)),
    height: Math.max(160, Math.round(height * fitScale))
  };
}

/** @param {number} naturalWidth @param {number} naturalHeight @param {ViewerFrameGeometryOptions} [options] */
function applyLightboxFrameGeometry(naturalWidth, naturalHeight, options = {}) {
  const frame = viewerElements.lightboxImageFrame;
  const image = viewerElements.lightboxImage;
  const layout = singleImageFitLayout(naturalWidth, naturalHeight);
  if (!frame || !image || !layout) return null;

  if (options.updateFitScale !== false) viewerViewportState.fitScale = layout.fitScale;
  const nextWidth = `${layout.width}px`;
  const nextHeight = `${layout.height}px`;
  const nextAspectRatio = `${naturalWidth} / ${naturalHeight}`;
  if (frame.style.width !== nextWidth) frame.style.width = nextWidth;
  if (frame.style.height !== nextHeight) frame.style.height = nextHeight;
  if (frame.style.aspectRatio !== nextAspectRatio) frame.style.aspectRatio = nextAspectRatio;
  if (image.style.width !== "100%") image.style.width = "100%";
  if (image.style.height !== "100%") image.style.height = "100%";
  return layout;
}

/** @param {CatalogRecord} catalog @param {number} page */
function primeLightboxFrameForCatalogPage(catalog, page) {
  const size = pageSize(catalog, page);
  if (!size) return false;
  return Boolean(applyLightboxFrameGeometry(size.width, size.height, { updateFitScale: true }));
}

function applySingleZoom() {
  const frame = viewerElements.lightboxImageFrame;
  const naturalSize = getActiveSingleImageNaturalSize();
  if (!naturalSize || !frame) return;

  applyLightboxFrameGeometry(naturalSize.width, naturalSize.height);
  if (!applyPendingSingleImagePosition() && isAutoViewerZoom() && !singleImageCanPan()) {
    viewerViewportState.panX = 0;
    viewerViewportState.panY = 0;
  }

  clampSinglePan();
  frame.style.setProperty("--single-pan-x", `${viewerViewportState.panX}px`);
  frame.style.setProperty("--single-pan-y", `${viewerViewportState.panY}px`);
  frame.style.setProperty("--single-zoom", String(viewerViewportState.zoom));
  frame.style.transform = `translate(-50%, -50%) translate(${viewerViewportState.panX}px, ${viewerViewportState.panY}px) scale(${viewerViewportState.zoom})`;
}

function applyZoom() {
  applySingleZoom();
  const isManualZoom = !isAutoViewerZoom();
  viewerElements.lightbox?.classList.toggle("is-zoomed", isManualZoom || viewerCanPan());
}

function consumeSingleViewerPanInput(deltaX = 0, deltaY = 0) {
  if (!singleViewerUsesBoundaryPan()) return null;

  const safeDeltaX = Number.isFinite(deltaX) ? deltaX : 0;
  const safeDeltaY = Number.isFinite(deltaY) ? deltaY : 0;
  const previousPanX = viewerViewportState.panX;
  const previousPanY = viewerViewportState.panY;

  viewerViewportState.panX = previousPanX - safeDeltaX;
  viewerViewportState.panY = previousPanY - safeDeltaY;
  const bounds = clampSinglePan({ allowPageTurnBuffer: true });
  if (!bounds) return null;

  const moved = Math.abs(viewerViewportState.panX - previousPanX) > 0.01 || Math.abs(viewerViewportState.panY - previousPanY) > 0.01;
  if (moved) {
    clearSingleImagePendingPosition();
    applySingleZoom();
  }

  const consumedDeltaX = previousPanX - viewerViewportState.panX;
  const consumedDeltaY = previousPanY - viewerViewportState.panY;
  return {
    moved,
    bounds,
    remainingDeltaX: safeDeltaX - consumedDeltaX,
    remainingDeltaY: safeDeltaY - consumedDeltaY
  };
}


/** @param {number} delta @param {number} deltaMode @param {number} [pageSize] */
function normalizeWheelDeltaToPixels(delta, deltaMode, pageSize = 0) {
  const lineMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_LINE : 1;
  const pageMode = typeof WheelEvent !== "undefined" ? WheelEvent.DOM_DELTA_PAGE : 2;

  if (deltaMode === lineMode) return delta * 36;
  if (deltaMode === pageMode) return delta * Math.max(1, pageSize);
  return delta;
}


export {
  applyLightboxFrameGeometry,
  applyPendingSingleImagePosition,
  applySingleZoom,
  applyZoom,
  captureSingleImageRelativePosition,
  clampSinglePan,
  clearSingleImagePendingPosition,
  consumeSingleViewerPanInput,
  getAutomaticViewerFitMode,
  getPointerList,
  getSafeViewerZoom,
  getSinglePanBounds,
  getViewerPageTurnBuffer,
  isAutoViewerZoom,
  normalizeViewerFitMode,
  normalizeViewerFitModeSource,
  normalizeWheelDeltaToPixels,
  pointerDistance,
  pointerMidpoint,
  primeLightboxFrameForCatalogPage,
  resetImagePosition,
  singleViewerUsesBoundaryPan,
  updateHash,
  viewerUsesAutomaticFitMode
};
