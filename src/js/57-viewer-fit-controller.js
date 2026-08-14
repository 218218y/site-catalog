/**
 * Source module: 57-viewer-fit-controller.js
 * Viewer fit-mode command owner.
 *
 * Fit changes reset interaction state, update geometry, request the appropriate
 * image tier, and then synchronize the shell. Keeping those effects here leaves
 * 56-viewer-shell.js as a presentation owner and avoids reverse dependencies.
 */

/** @import { ViewerFitModeOptions } from "../../types/frontend-contracts.js" */

import { AUTO_VIEWER_ZOOM, VIEWER_FIT_SOURCE_AUTO, VIEWER_FIT_SOURCE_MANUAL, viewerViewportState } from "./16-viewer-state.js";
import { resetViewerGestureCommand } from "./17-viewer-state-transitions.js";
import { refreshSingleViewerImageResolution } from "./53-viewer-image.js";
import {
  applyZoom,
  getAutomaticViewerFitMode,
  normalizeViewerFitMode,
  normalizeViewerFitModeSource,
  resetImagePosition,
  viewerUsesAutomaticFitMode
} from "./54-viewer-geometry.js";
import {
  showTopUiTemporarily,
  syncViewerFitModeUi
} from "./56-viewer-shell.js";
import { clearViewerPageWheelGesture } from "./58-viewer-navigation.js";

/** @param {string} fitMode @param {ViewerFitModeOptions} [options] */
function setViewerFitMode(fitMode, options = {}) {
  const nextFitMode = normalizeViewerFitMode(fitMode);
  const {
    showUi = true,
    source = VIEWER_FIT_SOURCE_MANUAL,
    refreshLayout = true
  } = options;
  const shouldResetView = nextFitMode !== viewerViewportState.imageFitMode;

  viewerViewportState.imageFitModeSource = normalizeViewerFitModeSource(source);
  viewerViewportState.imageFitMode = nextFitMode;
  if (shouldResetView) {
    clearViewerPageWheelGesture();
    viewerViewportState.zoom = AUTO_VIEWER_ZOOM;
    resetImagePosition({ queueSingleFitOrigin: true });
    resetViewerGestureCommand();
  }

  syncViewerFitModeUi();
  if (refreshLayout) {
    applyZoom();
    refreshSingleViewerImageResolution();
  }
  if (showUi) showTopUiTemporarily(1600);
}

/** @param {ViewerFitModeOptions} [options] */
function setViewerAutomaticFitMode(options = {}) {
  setViewerFitMode(getAutomaticViewerFitMode(), {
    ...options,
    source: VIEWER_FIT_SOURCE_AUTO
  });
}

/** @param {ViewerFitModeOptions} [options] */
function syncAutomaticViewerFitMode(options = {}) {
  if (!viewerUsesAutomaticFitMode()) return false;

  const nextFitMode = getAutomaticViewerFitMode();
  if (nextFitMode === viewerViewportState.imageFitMode) return false;

  setViewerAutomaticFitMode(options);
  return true;
}


export { setViewerAutomaticFitMode, setViewerFitMode, syncAutomaticViewerFitMode };
