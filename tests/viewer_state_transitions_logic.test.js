"use strict";

const assert = require("node:assert/strict");
const { importFrontendModule } = require("./frontend_test_module");

const session = {};
const viewport = {};
const gesture = {};
const image = {};
const navigation = {};

function resetFixture() {
  Object.assign(session, {
    viewerPhase: "open",
    viewerPhaseReason: "test",
    viewerFullscreenPhase: "inactive",
    viewerFullscreenReason: "test"
  });
  Object.assign(viewport, {
    zoom: 1,
    fitScale: 1,
    imageFitMode: "height",
    imageFitModeSource: "auto",
    singleImageFitOriginPending: false,
    singleImagePendingRelativePosition: null,
    singleImagePendingPageTurnOrigin: null,
    panX: 0,
    panY: 0
  });
  Object.assign(gesture, {
    dragStartX: 0,
    dragStartY: 0,
    dragStartPanX: 0,
    dragStartPanY: 0,
    lastTapAt: 0,
    lastTapX: 0,
    lastTapY: 0,
    lastTapSurface: "",
    suppressNextDblClickUntil: 0,
    pinchStartDistance: 0,
    pinchStartZoom: 1,
    pinchLastMidX: 0,
    pinchLastMidY: 0,
    pointerGestureHadMultiplePointers: false,
    pointerGestureConsumedPan: false,
    pointers: new Map(),
    viewerTouchMomentumRaf: 0,
    viewerTouchMomentumVelocityX: 0,
    viewerTouchMomentumVelocityY: 0,
    viewerTouchMomentumLastTime: 0
  });
  Object.assign(image, {
    singleImageLoadToken: 0,
    singleImageAnimationTimer: 0,
    singleImageResolutionLoadToken: 0,
    singleImageResolutionStop: null,
    singleImageResolutionImage: null,
    singleImageResolutionTargetSrc: "",
    singleImageResolutionTargetTier: "",
    singleImageResolutionReady: false,
    singleImageResolutionVisible: false,
    singleImageResolutionCommitPending: false,
    singleImageResolutionRetainedForSwap: false
  });
  Object.assign(navigation, {
    viewerPageWheelAccumulator: 0,
    viewerPageWheelBasePage: 0,
    viewerPageWheelTargetPage: 0,
    viewerPageWheelSettleTimer: 0,
    viewerPageWheelResetGestureActive: false,
    viewerPageWheelResetLastEventAt: 0,
    viewerPageWheelResetLastDelta: 0,
    viewerPageWheelResetDirection: 0
  });
}

resetFixture();
Object.assign(globalThis, {
  AUTO_VIEWER_ZOOM: 1,
  viewerSessionState: session,
  viewerViewportState: viewport,
  viewerGestureState: gesture,
  viewerImageState: image,
  viewerNavigationState: navigation
});
const api = importFrontendModule("src/js/17-viewer-state-transitions.js");

function expectedCommand(source, direction, axis, zoomMode, positionMode, preservePointerInteraction = false) {
  return { source, direction, axis, zoomMode, positionMode, preservePointerInteraction };
}

// One policy owner defines all navigation semantics.
resetFixture();
assert.deepEqual(api.createViewerNavigationCommand("keyboard", 1, { manualZoom: false }),
  expectedCommand("keyboard", 1, "y", "preserve", "fit-origin"));
assert.deepEqual(api.createViewerNavigationCommand("keyboard", -4, { manualZoom: true, axis: "x" }),
  expectedCommand("keyboard", -1, "x", "preserve", "relative"));
assert.deepEqual(api.createViewerNavigationCommand("wheel", 1, { manualZoom: false }),
  expectedCommand("wheel", 1, "y", "preserve", "page-turn"));
assert.deepEqual(api.createViewerNavigationCommand("wheel", 1, { manualZoom: true }),
  expectedCommand("wheel", 1, "y", "reset", "fit-origin"));
assert.deepEqual(api.createViewerNavigationCommand("vertical-swipe", -1, { manualZoom: true }),
  expectedCommand("vertical-swipe", -1, "y", "reset", "fit-origin"));
assert.deepEqual(api.createViewerNavigationCommand("horizontal-swipe", 1, { manualZoom: true, axis: "y" }),
  expectedCommand("horizontal-swipe", 1, "x", "preserve", "page-turn"));
assert.deepEqual(api.createViewerNavigationCommand("continuous-reading", -1, { axis: "x" }),
  expectedCommand("continuous-reading", -1, "x", "preserve", "page-turn"));
assert.throws(() => api.createViewerNavigationCommand("mystery", 1), /Unknown Viewer navigation source/);
assert.throws(() => api.createViewerNavigationCommand("keyboard", Number.NaN), /direction must be finite/);
assert.throws(() => api.createViewerNavigationCommand("keyboard", 1, { axis: "z" }), /Invalid Viewer navigation axis/);
assert.throws(() => api.createViewerNavigationCommand("keyboard", 1, { manualZoom: "yes" }), /manualZoom must be boolean/);
assert.throws(() => api.createViewerNavigationCommand("keyboard", 1, { preservePointerInteraction: 1 }), /preservePointerInteraction must be boolean/);

// Fabricated commands cannot override the source-owned policy.
assert.throws(() => api.assertViewerNavigationCommand({
  source: "keyboard", direction: 1, axis: "y", zoomMode: "preserve",
  positionMode: "page-turn", preservePointerInteraction: false
}), /direct navigation policy was overridden/);
assert.throws(() => api.assertViewerNavigationCommand({
  source: "wheel", direction: 1, axis: "y", zoomMode: "reset",
  positionMode: "relative", preservePointerInteraction: false
}), /scroll navigation policy was overridden/);
assert.throws(() => api.assertViewerNavigationCommand({
  source: "horizontal-swipe", direction: 0, axis: "x", zoomMode: "preserve",
  positionMode: "page-turn", preservePointerInteraction: false
}), /page-turn direction must be non-zero/);

// Validation occurs before mutation, then exactly one pending viewport mode is committed.
resetFixture();
viewport.zoom = 2;
viewport.panX = 120;
viewport.panY = -80;
gesture.pointers.set(7, { x: 1 });
const relativeCommand = api.createViewerNavigationCommand("keyboard", 1, { manualZoom: true });
const beforeInvalid = { zoom: viewport.zoom, panX: viewport.panX, panY: viewport.panY, pointerCount: gesture.pointers.size };
assert.throws(() => api.beginViewerPageTransitionCommand(2, relativeCommand), /requires finite position ratios/);
assert.deepEqual({ zoom: viewport.zoom, panX: viewport.panX, panY: viewport.panY, pointerCount: gesture.pointers.size }, beforeInvalid,
  "invalid relative navigation must not partially mutate Viewer state");
assert.throws(() => api.beginViewerPageTransitionCommand("2x", relativeCommand, { xRatio: 0, yRatio: 0 }), /non-negative integer target/);
assert.throws(() => api.beginViewerPageTransitionCommand("2", relativeCommand, { xRatio: 0, yRatio: 0 }), /non-negative integer target/);

api.beginViewerPageTransitionCommand(2, relativeCommand, { xRatio: 4, yRatio: -3 });
assert.equal(viewport.zoom, 2);
assert.deepEqual(viewport.singleImagePendingRelativePosition, { page: 2, xRatio: 1, yRatio: -1 });
assert.equal(viewport.singleImageFitOriginPending, false);
assert.equal(viewport.singleImagePendingPageTurnOrigin, null);
assert.equal(gesture.pointers.size, 0);

resetFixture();
viewport.zoom = 2;
viewport.panX = 50;
viewport.panY = -60;
gesture.pointers.set(8, { x: 1 });
const pageTurnCommand = api.createViewerNavigationCommand("continuous-reading", -1, {
  axis: "y", preservePointerInteraction: true
});
api.beginViewerPageTransitionCommand(3, pageTurnCommand);
assert.deepEqual(viewport.singleImagePendingPageTurnOrigin, { page: 3, direction: -1, axis: "y" });
assert.equal(viewport.panX, 0);
assert.equal(viewport.panY, 0);
assert.equal(gesture.pointers.size, 1, "pointer ownership is preserved only when the command says so");

resetFixture();
viewport.zoom = 2.4;
viewport.panX = 33;
viewport.panY = -44;
api.beginViewerPageTransitionCommand(4, api.createViewerNavigationCommand("wheel", 1, { manualZoom: true }));
assert.equal(viewport.zoom, 1);
assert.equal(viewport.panX, 0);
assert.equal(viewport.panY, 0);
assert.equal(viewport.singleImageFitOriginPending, true);

// Invariants reject impossible viewport, gesture, session, and resolution combinations.
resetFixture();
viewport.singleImageFitOriginPending = true;
viewport.singleImagePendingRelativePosition = { page: 1, xRatio: 0, yRatio: 0 };
assert.throws(() => api.assertViewerStateInvariants("test-multiple-position"), /multiple pending position modes/);
resetFixture();
gesture.pointers.set(1, { x: 0 });
gesture.viewerTouchMomentumRaf = 10;
assert.throws(() => api.assertViewerStateInvariants("test-pointer-momentum"), /momentum and active pointers overlap/);
resetFixture();
session.viewerPhase = "closed";
gesture.pointers.set(1, { x: 0 });
assert.throws(() => api.assertViewerStateInvariants("test-closed-pointer"), /closed session retains active pointers/);
resetFixture();
session.viewerPhase = "closed";
image.singleImageResolutionImage = {};
image.singleImageResolutionTargetSrc = "full.webp";
image.singleImageResolutionTargetTier = "full";
image.singleImageResolutionCommitPending = true;
assert.throws(() => api.assertViewerStateInvariants("test-closed-resolution"), /closed session retains an active resolution lifecycle/);
resetFixture();
image.singleImageResolutionTargetSrc = "full.webp";
assert.throws(() => api.assertViewerStateInvariants("test-target-tier"), /source\/tier ownership diverged/);
resetFixture();
image.singleImageResolutionImage = {};
image.singleImageResolutionTargetSrc = "full.webp";
image.singleImageResolutionTargetTier = "full";
image.singleImageResolutionVisible = true;
assert.throws(() => api.assertViewerStateInvariants("test-visible-not-ready"), /visible resolution layer is not ready/);

// Image and resolution tokens make stale async completions harmless.
resetFixture();
const firstSwap = api.beginViewerImageSwapCommand();
assert.equal(api.isViewerImageSwapCurrent(firstSwap), true);
api.invalidateViewerImageSwapCommand();
assert.equal(api.isViewerImageSwapCurrent(firstSwap), false);

resetFixture();
image.singleImageResolutionImage = {};
let stopped = 0;
const firstResolution = api.beginViewerResolutionCommand("full-1.webp", "full", true);
assert.equal(api.attachViewerResolutionStopCommand(firstResolution, () => { stopped += 1; }), true);
const secondResolution = api.beginViewerResolutionCommand("full-2.webp", "full", false);
assert.equal(stopped, 1, "starting a new request cancels the previous loader exactly once");
assert.equal(api.markViewerResolutionReadyCommand(firstResolution), false, "stale resolution completion must be ignored");
assert.equal(api.attachViewerResolutionStopCommand(firstResolution, () => { stopped += 1; }), false);
assert.equal(stopped, 2, "a stale stop handle is retired immediately");
assert.equal(api.markViewerResolutionReadyCommand(secondResolution), true);
assert.equal(api.commitViewerResolutionCommand(secondResolution), true);
assert.equal(image.singleImageResolutionVisible, true);
api.retainViewerResolutionForSwapCommand();
assert.equal(image.singleImageResolutionRetainedForSwap, true);
assert.equal(image.singleImageResolutionTargetSrc, "");
assert.equal(image.singleImageResolutionReady, false);
assert.equal(api.releaseViewerRetainedResolutionCommand(), true);
assert.equal(api.releaseViewerRetainedResolutionCommand(), false);
assert.throws(() => api.beginViewerResolutionCommand("", "full", false), /requires a target source and tier/);
assert.throws(() => api.beginViewerResolutionCommand("full.webp", "full", "yes"), /requires string targets and a boolean commit policy/);

console.log("viewer_state_transitions_logic.test.js: PASS");
