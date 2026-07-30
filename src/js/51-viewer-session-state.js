/**
 * Source module: 51-viewer-session-state.js
 * Lowest-level Viewer lifecycle state owner.
 *
 * This module owns only legal state transitions and session visibility queries.
 * It deliberately has no imports from Viewer rendering, shell, input, image, or
 * lifecycle composition modules, so every Viewer submodule can depend on the
 * same state contract without creating an architectural cycle.
 */

import {
  VIEWER_FULLSCREEN_ACTIVE,
  VIEWER_FULLSCREEN_ENTERING,
  VIEWER_FULLSCREEN_EXITING,
  VIEWER_FULLSCREEN_INACTIVE,
  VIEWER_PHASE_CLOSED,
  VIEWER_PHASE_CLOSING,
  VIEWER_PHASE_OPEN,
  VIEWER_PHASE_OPENING,
  viewerState
} from "./16-viewer-state.js";

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

/**
 * @param {{current:string, next:string, transitions:Readonly<Record<string, Set<string>>>, label:string, reason:string}} options
 */
function transitionStatePhase({ current, next, transitions, label, reason }) {
  const allowed = transitions[current];
  if (!allowed?.has(next)) {
    console.warn(`Ignored invalid ${label} transition`, { current, next, reason });
    return false;
  }
  return true;
}

/** @param {string} nextPhase @param {string} [reason] */
function transitionViewerPhase(nextPhase, reason = "unspecified") {
  const currentPhase = viewerState.viewerPhase || VIEWER_PHASE_CLOSED;
  if (!transitionStatePhase({
    current: currentPhase,
    next: nextPhase,
    transitions: VIEWER_PHASE_TRANSITIONS,
    label: "viewer phase",
    reason
  })) return false;

  viewerState.viewerPhase = nextPhase;
  viewerState.viewerPhaseReason = String(reason || "unspecified");
  if (document.body) document.body.dataset.viewerPhase = nextPhase;
  return true;
}

function isViewerSessionOpen() {
  return viewerState.viewerPhase === VIEWER_PHASE_OPENING || viewerState.viewerPhase === VIEWER_PHASE_OPEN;
}

function isViewerSessionVisible() {
  return isViewerSessionOpen() || viewerState.viewerPhase === VIEWER_PHASE_CLOSING;
}

/** @param {string} nextPhase @param {string} [reason] */
function transitionViewerFullscreenPhase(nextPhase, reason = "unspecified") {
  const currentPhase = viewerState.viewerFullscreenPhase || VIEWER_FULLSCREEN_INACTIVE;
  if (!transitionStatePhase({
    current: currentPhase,
    next: nextPhase,
    transitions: VIEWER_FULLSCREEN_TRANSITIONS,
    label: "viewer fullscreen phase",
    reason
  })) return false;

  viewerState.viewerFullscreenPhase = nextPhase;
  viewerState.viewerFullscreenReason = String(reason || "unspecified");
  if (document.documentElement) document.documentElement.dataset.viewerFullscreenPhase = nextPhase;
  return true;
}

function isViewerFullscreenPending() {
  return viewerState.viewerFullscreenPhase === VIEWER_FULLSCREEN_ENTERING
    || viewerState.viewerFullscreenPhase === VIEWER_FULLSCREEN_EXITING;
}

/* TEST-ONLY EXPORTS: BEGIN */
if (typeof __BARGIG_TEST_EXPORTS__ !== "undefined") {
  __BARGIG_TEST_EXPORTS__["viewer-session-state"] = Object.freeze({
    transitionStatePhase,
    transitionViewerPhase,
    isViewerSessionOpen,
    isViewerSessionVisible,
    transitionViewerFullscreenPhase,
    isViewerFullscreenPending
  });
}
/* TEST-ONLY EXPORTS: END */

export {
  isViewerFullscreenPending,
  isViewerSessionOpen,
  isViewerSessionVisible,
  transitionViewerFullscreenPhase,
  transitionViewerPhase
};
