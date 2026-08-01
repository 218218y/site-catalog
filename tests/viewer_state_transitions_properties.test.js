"use strict";

const assert = require("node:assert/strict");
const { importFrontendTestModule } = require("./frontend_test_module");

const session = {};
const viewport = {};
const gesture = {};
const image = {};
const navigation = {};

function resetFixture() {
  Object.assign(session, {
    viewerPhase: "open", viewerPhaseReason: "property-test",
    viewerFullscreenPhase: "inactive", viewerFullscreenReason: "property-test",
  });
  Object.assign(viewport, {
    zoom: 1, fitScale: 1, imageFitMode: "height", imageFitModeSource: "auto",
    singleImageFitOriginPending: false, singleImagePendingRelativePosition: null,
    singleImagePendingPageTurnOrigin: null, panX: 0, panY: 0,
  });
  Object.assign(gesture, {
    dragStartX: 0, dragStartY: 0, dragStartPanX: 0, dragStartPanY: 0,
    lastTapAt: 0, lastTapX: 0, lastTapY: 0, lastTapSurface: "",
    suppressNextDblClickUntil: 0, pinchStartDistance: 0, pinchStartZoom: 1,
    pinchLastMidX: 0, pinchLastMidY: 0, pointerGestureHadMultiplePointers: false,
    pointerGestureConsumedPan: false, pointers: new Map(), viewerTouchMomentumRaf: 0,
    viewerTouchMomentumVelocityX: 0, viewerTouchMomentumVelocityY: 0,
    viewerTouchMomentumLastTime: 0,
  });
  Object.assign(image, {
    singleImageLoadToken: 0, singleImageAnimationTimer: 0,
    singleImageResolutionLoadToken: 0, singleImageResolutionStop: null,
    singleImageResolutionImage: null, singleImageResolutionTargetSrc: "",
    singleImageResolutionTargetTier: "", singleImageResolutionReady: false,
    singleImageResolutionVisible: false, singleImageResolutionCommitPending: false,
    singleImageResolutionRetainedForSwap: false,
  });
  Object.assign(navigation, {
    viewerPageWheelAccumulator: 0, viewerPageWheelBasePage: 0,
    viewerPageWheelTargetPage: 0, viewerPageWheelSettleTimer: 0,
    viewerPageWheelResetGestureActive: false, viewerPageWheelResetLastEventAt: 0,
    viewerPageWheelResetLastDelta: 0, viewerPageWheelResetDirection: 0,
  });
}

resetFixture();
Object.assign(globalThis, {
  AUTO_VIEWER_ZOOM: 1,
  viewerSessionState: session,
  viewerViewportState: viewport,
  viewerGestureState: gesture,
  viewerImageState: image,
  viewerNavigationState: navigation,
});
const api = importFrontendTestModule("src/js/17-viewer-state-transitions.js", "viewer-state-transitions");

const sources = [
  "button", "keyboard", "home-end", "page-rail", "programmatic",
  "horizontal-swipe", "continuous-reading", "vertical-swipe", "wheel",
  "boundary-pan", "momentum",
];

for (const source of sources) {
  for (const direction of [-100, -1, 1, 100]) {
    for (const manualZoom of [false, true]) {
      resetFixture();
      viewport.zoom = manualZoom ? 2.5 : 1;
      viewport.panX = 80;
      viewport.panY = -40;
      const command = api.createViewerNavigationCommand(source, direction, { manualZoom });
      const relative = command.positionMode === "relative" ? { xRatio: 0.75, yRatio: -0.25 } : undefined;
      api.beginViewerPageTransitionCommand(17, command, relative);
      api.assertViewerStateInvariants(`property:${source}`);

      const pendingModes = [
        viewport.singleImageFitOriginPending,
        viewport.singleImagePendingRelativePosition !== null,
        viewport.singleImagePendingPageTurnOrigin !== null,
      ].filter(Boolean);
      assert.equal(pendingModes.length, 1, `${source} must commit exactly one viewport mode`);
      assert.equal(command.direction, direction > 0 ? 1 : -1);
      if (command.zoomMode === "reset") assert.equal(viewport.zoom, 1);
      if (command.positionMode === "relative") {
        assert.deepEqual(viewport.singleImagePendingRelativePosition, {
          page: 17, xRatio: 0.75, yRatio: -0.25,
        });
      }
    }
  }
}

resetFixture();
const issuedTokens = [];
for (let index = 0; index < 200; index += 1) {
  issuedTokens.push(api.beginViewerImageSwapCommand());
}
assert.deepEqual(issuedTokens, [...issuedTokens].sort((left, right) => left - right));
assert.equal(new Set(issuedTokens).size, issuedTokens.length);
assert.equal(api.isViewerImageSwapCurrent(issuedTokens.at(-1)), true);
for (const staleToken of issuedTokens.slice(0, -1)) {
  assert.equal(api.isViewerImageSwapCurrent(staleToken), false);
}

resetFixture();
image.singleImageResolutionImage = {};
const resolutionTokens = [];
for (let index = 0; index < 100; index += 1) {
  resolutionTokens.push(api.beginViewerResolutionCommand(`image-${index}.webp`, "full", index % 2 === 0));
}
const currentToken = resolutionTokens.at(-1);
for (const staleToken of resolutionTokens.slice(0, -1)) {
  assert.equal(api.markViewerResolutionReadyCommand(staleToken), false);
  assert.equal(api.commitViewerResolutionCommand(staleToken), false);
}
assert.equal(api.markViewerResolutionReadyCommand(currentToken), true);
assert.equal(api.commitViewerResolutionCommand(currentToken), true);
api.assertViewerStateInvariants("property:resolution-current");

console.log("viewer_state_transitions_properties.test.js: PASS");
