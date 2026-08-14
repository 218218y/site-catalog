/**
 * Source module: 52-viewer-session.js
 * Browser Fullscreen API controller and Viewer fullscreen presentation.
 *
 * Lifecycle state transitions live in 51-viewer-session-state.js. This module
 * owns only browser fullscreen integration and may request higher-level layout
 * refreshes without becoming a state owner itself.
 */

import { homeDocumentUrl, navigateTo } from "./00-navigation.js";
import { getFeatureInterface } from "./10-app-state.js";
import { VIEWER_FULLSCREEN_ACTIVE, VIEWER_FULLSCREEN_ENTERING, VIEWER_FULLSCREEN_EXITING, VIEWER_FULLSCREEN_INACTIVE, viewerElements, viewerSessionState } from "./16-viewer-state.js";
import { flashActionButton, setTooltipText } from "./21-ui-runtime.js";
import { closeLightboxCatalogMenu, closeLightboxSearchScopeMenu } from "./50-search-ui.js";
import {
  isViewerFullscreenPending,
  isViewerSessionOpen,
  transitionViewerFullscreenPhase
} from "./51-viewer-session-state.js";
import { showTopUiTemporarily } from "./56-viewer-shell.js";

function getBrowserFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
}

function isBrowserFullscreenActive() {
  return Boolean(getBrowserFullscreenElement());
}

function isBrowserFullscreenSupported() {
  const root = document.documentElement;
  return Boolean(
    document.fullscreenEnabled
    || document.webkitFullscreenEnabled
    || document.mozFullScreenEnabled
    || document.msFullscreenEnabled
    || root?.requestFullscreen
    || root?.webkitRequestFullscreen
    || root?.mozRequestFullScreen
    || root?.msRequestFullscreen
  );
}

function reconcileViewerFullscreenPhase(reason = "browser-state") {
  transitionViewerFullscreenPhase(
    isBrowserFullscreenActive() ? VIEWER_FULLSCREEN_ACTIVE : VIEWER_FULLSCREEN_INACTIVE,
    reason
  );
}

function viewerUsesInDocumentFullscreenNavigation() {
  return isBrowserFullscreenActive();
}

function requestBrowserFullscreen() {
  const root = document.documentElement;
  const request = root?.requestFullscreen || root?.webkitRequestFullscreen || root?.mozRequestFullScreen || root?.msRequestFullscreen;
  if (!request) return Promise.reject(new Error("fullscreen-unsupported"));
  const result = request.call(root);
  return result && typeof result.then === "function" ? result : Promise.resolve();
}

function exitBrowserFullscreen() {
  const exit = document.exitFullscreen || document.webkitExitFullscreen || document.mozCancelFullScreen || document.msExitFullscreen;
  if (!exit) return Promise.reject(new Error("fullscreen-exit-unsupported"));
  const result = exit.call(document);
  return result && typeof result.then === "function" ? result : Promise.resolve();
}

function getFullscreenToggleButtons() {
  return viewerElements.fullscreenToggle ? [viewerElements.fullscreenToggle] : [];
}

function syncFullscreenButtonUi() {
  const buttons = getFullscreenToggleButtons();
  if (!buttons.length) return;

  const isActive = isBrowserFullscreenActive();
  const isSupported = isBrowserFullscreenSupported();
  const isPending = isViewerFullscreenPending();
  const label = isActive ? "יציאה ממסך מלא" : "כניסה למסך מלא";

  buttons.forEach((button) => {
    button.dataset.fullscreenActive = isActive ? "true" : "false";
    button.dataset.fullscreenPhase = viewerSessionState.viewerFullscreenPhase;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.setAttribute("aria-label", label);
    setTooltipText(button, label, { updateDefault: true });
    button.disabled = isPending || (!isSupported && !isActive);
    button.classList.toggle("hidden", !isSupported && !isActive);
  });
}

function handleBrowserFullscreenChange() {
  reconcileViewerFullscreenPhase("fullscreenchange");
  syncFullscreenButtonUi();
  if (isViewerSessionOpen()) {
    getFeatureInterface("viewer")?.handleResize?.();
    showTopUiTemporarily(1400);
  }
}

/** @param {Element|null} [sourceButton] */
async function toggleBrowserFullscreen(sourceButton = null) {
  const button = sourceButton || viewerElements.fullscreenToggle;
  if (isViewerFullscreenPending()) return;
  const wasActive = isBrowserFullscreenActive();

  transitionViewerFullscreenPhase(
    wasActive ? VIEWER_FULLSCREEN_EXITING : VIEWER_FULLSCREEN_ENTERING,
    wasActive ? "toggle-exit" : "toggle-enter"
  );
  syncFullscreenButtonUi();

  try {
    if (wasActive) {
      await exitBrowserFullscreen();
    } else {
      if (!isBrowserFullscreenSupported()) throw new Error("fullscreen-unsupported");
      await requestBrowserFullscreen();
    }
  } catch (error) {
    const message = wasActive ? "לא הצלחתי לצאת ממסך מלא" : "הדפדפן חסם מסך מלא";
    console.warn("Fullscreen toggle failed", error);
    flashActionButton(button, message);
  } finally {
    reconcileViewerFullscreenPhase("toggle-settled");
    syncFullscreenButtonUi();
    if (isViewerSessionOpen()) showTopUiTemporarily(1400);
  }
}

/** @param {Event|null} [event] */
function returnToMainSiteFromLightbox(event = null) {
  event?.preventDefault?.();
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();
  navigateTo(homeDocumentUrl());
}


export {
  exitBrowserFullscreen,
  handleBrowserFullscreenChange,
  isBrowserFullscreenActive,
  reconcileViewerFullscreenPhase,
  returnToMainSiteFromLightbox,
  syncFullscreenButtonUi,
  toggleBrowserFullscreen,
  viewerUsesInDocumentFullscreenNavigation
};
