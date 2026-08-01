/**
 * Source module: 55-viewer-zoom-controller.js
 * High-level Viewer zoom commands and their explicit presentation effects.
 *
 * Geometry remains a lower-level owner with no imports from image or shell.
 * This controller coordinates geometry, progressive resolution, and chrome UI
 * whenever a user action actually changes the zoom state.
 */

/** @import { PointLike, ViewerZoomChangeOptions, ViewerZoomOptions } from "../../types/frontend-contracts.js" */

import { AUTO_VIEWER_ZOOM, viewerElements, viewerState } from "./16-viewer-state.js";
import {
  refreshSingleViewerImageResolution,
  shouldWarmSingleViewerFullResolution
} from "./53-viewer-image.js";
import {
  applyZoom,
  clearSingleImagePendingPosition,
  getSafeViewerZoom,
  isAutoViewerZoom,
  resetImagePosition
} from "./54-viewer-geometry.js";
import {
  showTopUiTemporarily,
  showViewerZoomIndicator,
  syncViewerAutoZoomButtonUi
} from "./56-viewer-shell.js";

/** @param {number} value */
function clampViewerZoom(value) {
  return getSafeViewerZoom(value);
}

function getDefaultZoomFocalPoint() {
  const surface = viewerElements.stageCanvas;
  const rect = surface?.getBoundingClientRect?.();
  if (!rect) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
}

/** @param {number} nextZoom @param {PointLike|null} focal */
function adjustSinglePanForZoom(nextZoom, focal) {
  const stage = viewerElements.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !focal) return;

  const currentZoom = getSafeViewerZoom();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const contentX = (focal.x - centerX - viewerState.panX) / currentZoom;
  const contentY = (focal.y - centerY - viewerState.panY) / currentZoom;

  viewerState.panX = focal.x - centerX - contentX * nextZoom;
  viewerState.panY = focal.y - centerY - contentY * nextZoom;
}

/** @param {number} clientX @param {number} clientY @returns {PointLike|null} */
function getSingleContentPointFromClientPoint(clientX, clientY) {
  const stage = viewerElements.stageCanvas;
  const rect = stage?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;

  const currentZoom = getSafeViewerZoom();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;

  return {
    x: (clientX - centerX - viewerState.panX) / currentZoom,
    y: (clientY - centerY - viewerState.panY) / currentZoom
  };
}

/** @param {number} previousZoom @param {ViewerZoomChangeOptions} [options] */
function finalizeSingleViewerZoomChange(previousZoom, options = {}) {
  const { showUi = true } = options;
  applyZoom();
  syncViewerAutoZoomButtonUi();

  if (Math.abs(getSafeViewerZoom(viewerState.zoom) - getSafeViewerZoom(previousZoom)) > 0.001) {
    showViewerZoomIndicator(viewerState.zoom);
  }
  refreshSingleViewerImageResolution({
    warmFull: shouldWarmSingleViewerFullResolution(previousZoom)
  });
  if (showUi) showTopUiTemporarily(1600);
}

/** @param {PointLike|null} point @param {number} nextZoom */
function zoomSingleContentPointToViewportCenter(point, nextZoom) {
  if (!point) return false;
  const previousZoom = viewerState.zoom;
  const zoom = clampViewerZoom(nextZoom);
  if (isAutoViewerZoom(zoom)) {
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
    return true;
  }

  clearSingleImagePendingPosition();
  viewerState.zoom = zoom;
  viewerState.panX = -point.x * zoom;
  viewerState.panY = -point.y * zoom;
  finalizeSingleViewerZoomChange(previousZoom, { showUi: false });
  return true;
}

/** @param {number} nextZoom @param {number} clientX @param {number} clientY */
function zoomClientPointToViewportCenter(nextZoom, clientX, clientY) {
  return zoomSingleContentPointToViewportCenter(
    getSingleContentPointFromClientPoint(clientX, clientY),
    nextZoom
  );
}

/** @param {number} nextZoom @param {ViewerZoomOptions} [options] */
function setZoom(nextZoom, options = {}) {
  const {
    showUi = true,
    focalClientX = null,
    focalClientY = null
  } = options;
  const previousZoom = viewerState.zoom;
  const zoom = clampViewerZoom(nextZoom);
  const hasFocal = typeof focalClientX === "number" && Number.isFinite(focalClientX)
    && typeof focalClientY === "number" && Number.isFinite(focalClientY);
  const focal = hasFocal
    ? { x: /** @type {number} */ (focalClientX), y: /** @type {number} */ (focalClientY) }
    : getDefaultZoomFocalPoint();

  if (isAutoViewerZoom(zoom)) {
    viewerState.zoom = AUTO_VIEWER_ZOOM;
    resetImagePosition({ queueSingleFitOrigin: true });
  } else {
    clearSingleImagePendingPosition();
    if (focal && Math.abs(zoom - previousZoom) > 0.001) {
      adjustSinglePanForZoom(zoom, focal);
    }
    viewerState.zoom = zoom;
  }
  finalizeSingleViewerZoomChange(previousZoom, { showUi });
}

/** @param {number} clientX @param {number} clientY */
function toggleZoomAtPoint(clientX, clientY) {
  if (!isAutoViewerZoom()) {
    setZoom(AUTO_VIEWER_ZOOM, { showUi: false });
    return;
  }

  if (!zoomClientPointToViewportCenter(2, clientX, clientY)) {
    setZoom(2, { showUi: false, focalClientX: clientX, focalClientY: clientY });
  }
}

/* TEST-ONLY EXPORTS: BEGIN */
if (typeof __BARGIG_TEST_EXPORTS__ !== "undefined") {
  __BARGIG_TEST_EXPORTS__["viewer-zoom-controller"] = Object.freeze({
    finalizeSingleViewerZoomChange,
    zoomSingleContentPointToViewportCenter,
    zoomClientPointToViewportCenter,
    setZoom,
    toggleZoomAtPoint
  });
}
/* TEST-ONLY EXPORTS: END */

export { setZoom, toggleZoomAtPoint };
