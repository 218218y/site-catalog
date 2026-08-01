/**
 * Source module: 61-viewer-layout-controller.js
 * Viewer layout orchestration for top-bar safe area and pinned chrome.
 *
 * The shell owns presentation primitives; geometry owns frame calculations;
 * image owns progressive resolution. This controller coordinates those owners
 * without forcing any of them to import each other.
 */

/** @import { ViewerUiVisibilityOptions } from "../../types/frontend-contracts.js" */

import { viewerChromeState } from "./16-viewer-state.js";
import { isViewerSessionOpen } from "./51-viewer-session-state.js";
import { refreshSingleViewerImageResolution } from "./53-viewer-image.js";
import { applyZoom, isAutoViewerZoom, resetImagePosition } from "./54-viewer-geometry.js";
import {
  showTopUiTemporarily,
  syncLightboxTopSafeArea,
  syncTopUiPinnedUi
} from "./56-viewer-shell.js";

/** @param {ViewerUiVisibilityOptions} [options] */
function refreshLightboxLayoutForTopUiChange(options = {}) {
  if (!isViewerSessionOpen()) {
    syncLightboxTopSafeArea();
    return;
  }

  const { resetAutoSingleOrigin = true } = options;
  syncLightboxTopSafeArea();

  if (resetAutoSingleOrigin && isAutoViewerZoom()) {
    resetImagePosition({ queueSingleFitOrigin: true });
  }

  applyZoom();
  refreshSingleViewerImageResolution();
}

/** @param {boolean} pinned */
function setTopUiPinned(pinned) {
  viewerChromeState.topUiPinned = Boolean(pinned);
  syncTopUiPinnedUi();
  refreshLightboxLayoutForTopUiChange();
  if (!viewerChromeState.topUiPinned) showTopUiTemporarily(1400);
}

function toggleTopUiPinned() {
  setTopUiPinned(!viewerChromeState.topUiPinned);
}

export {
  refreshLightboxLayoutForTopUiChange,
  setTopUiPinned,
  toggleTopUiPinned
};
