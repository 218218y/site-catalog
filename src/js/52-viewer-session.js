/**
 * Source module: 52-viewer-session.js
 * Explicit viewer lifecycle and browser Fullscreen API state transitions.
 *
 * These source modules intentionally share one lexical scope and are concatenated
 * by tools/build_frontend_assets.py into the single browser file app.js.
 */

const VIEWER_PHASE_TRANSITIONS = Object.freeze({
  [VIEWER_PHASE_CLOSED]: new Set([VIEWER_PHASE_CLOSED, VIEWER_PHASE_OPENING]),
  [VIEWER_PHASE_OPENING]: new Set([VIEWER_PHASE_OPENING, VIEWER_PHASE_OPEN, VIEWER_PHASE_CLOSING, VIEWER_PHASE_CLOSED]),
  [VIEWER_PHASE_OPEN]: new Set([VIEWER_PHASE_OPEN, VIEWER_PHASE_OPENING, VIEWER_PHASE_CLOSING]),
  [VIEWER_PHASE_CLOSING]: new Set([VIEWER_PHASE_CLOSING, VIEWER_PHASE_CLOSED, VIEWER_PHASE_OPENING])
});

const VIEWER_FULLSCREEN_TRANSITIONS = Object.freeze({
  [VIEWER_FULLSCREEN_INACTIVE]: new Set([VIEWER_FULLSCREEN_INACTIVE, VIEWER_FULLSCREEN_ENTERING, VIEWER_FULLSCREEN_ACTIVE]),
  [VIEWER_FULLSCREEN_ENTERING]: new Set([VIEWER_FULLSCREEN_ENTERING, VIEWER_FULLSCREEN_ACTIVE, VIEWER_FULLSCREEN_INACTIVE, VIEWER_FULLSCREEN_EXITING]),
  [VIEWER_FULLSCREEN_ACTIVE]: new Set([VIEWER_FULLSCREEN_ACTIVE, VIEWER_FULLSCREEN_EXITING, VIEWER_FULLSCREEN_INACTIVE]),
  [VIEWER_FULLSCREEN_EXITING]: new Set([VIEWER_FULLSCREEN_EXITING, VIEWER_FULLSCREEN_INACTIVE, VIEWER_FULLSCREEN_ACTIVE, VIEWER_FULLSCREEN_ENTERING])
});

function transitionStatePhase({ current, next, transitions, label, reason }) {
  const allowed = transitions[current];
  if (!allowed?.has(next)) {
    console.warn(`Ignored invalid ${label} transition`, { current, next, reason });
    return false;
  }
  return true;
}

function transitionViewerPhase(nextPhase, reason = "unspecified") {
  const currentPhase = state.viewerPhase || VIEWER_PHASE_CLOSED;
  if (!transitionStatePhase({
    current: currentPhase,
    next: nextPhase,
    transitions: VIEWER_PHASE_TRANSITIONS,
    label: "viewer phase",
    reason
  })) return false;

  state.viewerPhase = nextPhase;
  state.viewerPhaseReason = String(reason || "unspecified");
  if (document.body) document.body.dataset.viewerPhase = nextPhase;
  return true;
}

function isViewerSessionOpen() {
  return state.viewerPhase === VIEWER_PHASE_OPENING || state.viewerPhase === VIEWER_PHASE_OPEN;
}

function isViewerSessionVisible() {
  return isViewerSessionOpen() || state.viewerPhase === VIEWER_PHASE_CLOSING;
}

function transitionViewerFullscreenPhase(nextPhase, reason = "unspecified") {
  const currentPhase = state.viewerFullscreenPhase || VIEWER_FULLSCREEN_INACTIVE;
  if (!transitionStatePhase({
    current: currentPhase,
    next: nextPhase,
    transitions: VIEWER_FULLSCREEN_TRANSITIONS,
    label: "viewer fullscreen phase",
    reason
  })) return false;

  state.viewerFullscreenPhase = nextPhase;
  state.viewerFullscreenReason = String(reason || "unspecified");
  if (document.documentElement) document.documentElement.dataset.viewerFullscreenPhase = nextPhase;
  return true;
}

function getBrowserFullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement || null;
}

function isBrowserFullscreenActive() {
  return Boolean(getBrowserFullscreenElement());
}

function isBrowserFullscreenSupported() {
  const root = document.documentElement;
  return Boolean(
    document.fullscreenEnabled ||
    document.webkitFullscreenEnabled ||
    document.mozFullScreenEnabled ||
    document.msFullscreenEnabled ||
    root?.requestFullscreen ||
    root?.webkitRequestFullscreen ||
    root?.mozRequestFullScreen ||
    root?.msRequestFullscreen
  );
}

function isViewerFullscreenPending() {
  return state.viewerFullscreenPhase === VIEWER_FULLSCREEN_ENTERING || state.viewerFullscreenPhase === VIEWER_FULLSCREEN_EXITING;
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
  return els.fullscreenToggle ? [els.fullscreenToggle] : [];
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
    button.dataset.fullscreenPhase = state.viewerFullscreenPhase;
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
    refreshLightboxLayoutForTopUiChange({ resetAutoSingleOrigin: false });
    showTopUiTemporarily(1400);
  }
}

async function toggleBrowserFullscreen(sourceButton = null) {
  const button = sourceButton || els.fullscreenToggle;
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

function returnToMainSiteFromLightbox(event = null) {
  event?.preventDefault?.();
  closeLightboxSearchScopeMenu();
  closeLightboxCatalogMenu();
  navigateTo(homeDocumentUrl());
}
