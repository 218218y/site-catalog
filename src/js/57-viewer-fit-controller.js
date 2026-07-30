/**
 * Source module: 57-viewer-fit-controller.js
 * Viewer fit-mode command owner.
 *
 * Fit changes reset interaction state, update geometry, request the appropriate
 * image tier, and then synchronize the shell. Keeping those effects here leaves
 * 56-viewer-shell.js as a presentation owner and avoids reverse dependencies.
 */

import {
  AUTO_VIEWER_ZOOM,
  VIEWER_FIT_SOURCE_AUTO,
  VIEWER_FIT_SOURCE_MANUAL,
  viewerState
} from "./16-viewer-state.js";
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
  const shouldResetView = nextFitMode !== viewerState.imageFitMode;

  viewerState.imageFitModeSource = normalizeViewerFitModeSource(source);
  viewerState.imageFitMode = nextFitMode;
  if (shouldResetView) {
    clearViewerPageWheelGesture();
    viewerState.zoom = AUTO_VIEWER_ZOOM;
    resetImagePosition({ queueSingleFitOrigin: true });
    viewerState.pointers.clear();
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
  if (nextFitMode === viewerState.imageFitMode) return false;

  setViewerAutomaticFitMode(options);
  return true;
}

/* TEST-ONLY EXPORTS: BEGIN */
if (typeof __BARGIG_TEST_EXPORTS__ !== "undefined") {
  __BARGIG_TEST_EXPORTS__["viewer-fit-controller"] = Object.freeze({
    setViewerFitMode,
    setViewerAutomaticFitMode,
    syncAutomaticViewerFitMode
  });
}
/* TEST-ONLY EXPORTS: END */

export { setViewerAutomaticFitMode, setViewerFitMode, syncAutomaticViewerFitMode };
