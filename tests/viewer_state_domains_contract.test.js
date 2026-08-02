"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { inventoryProjectFiles } = require("./helpers/frontend_ast.js");

const root = path.resolve(__dirname, "..");
const statePath = path.join(root, "src", "js", "16-viewer-state.js");
const contractsPath = path.join(root, "types", "frontend-contracts.d.ts");

const expectedDomains = Object.freeze({
  viewerSessionState: [
    "viewerPhase", "viewerPhaseReason", "viewerFullscreenPhase", "viewerFullscreenReason"
  ],
  viewerViewportState: [
    "zoom", "fitScale", "imageFitMode", "imageFitModeSource",
    "singleImageFitOriginPending", "singleImagePendingRelativePosition",
    "singleImagePendingPageTurnOrigin", "panX", "panY"
  ],
  viewerGestureState: [
    "dragStartX", "dragStartY", "dragStartPanX", "dragStartPanY",
    "lastTapAt", "lastTapX", "lastTapY", "lastTapSurface", "suppressNextDblClickUntil",
    "pinchStartDistance", "pinchStartZoom", "pinchLastMidX", "pinchLastMidY",
    "pointerGestureHadMultiplePointers", "pointerGestureConsumedPan", "pointers",
    "viewerTouchMomentumRaf", "viewerTouchMomentumVelocityX",
    "viewerTouchMomentumVelocityY", "viewerTouchMomentumLastTime"
  ],
  viewerChromeState: [
    "topUiPinned", "uiHideTimer", "pageRailHideTimer",
    "lastTouchLikeViewportInputAt", "lastTouchLikeRailInputAt",
    "zoomIndicatorHideTimer", "pageIndicatorHideTimer", "viewerMobileMoreOpen"
  ],
  viewerImageState: [
    "singleImageLoadToken", "singleImageAnimationTimer", "singleImageResolutionLoadToken",
    "singleImageResolutionStop", "singleImageResolutionImage",
    "singleImageResolutionTargetSrc", "singleImageResolutionTargetTier",
    "singleImageResolutionReady", "singleImageResolutionVisible",
    "singleImageResolutionCommitPending", "singleImageResolutionRetainedForSwap"
  ],
  viewerNavigationState: [
    "viewerPageWheelAccumulator", "viewerPageWheelBasePage", "viewerPageWheelTargetPage",
    "viewerPageWheelSettleTimer", "viewerPageWheelResetGestureActive",
    "viewerPageWheelResetLastEventAt", "viewerPageWheelResetLastDelta",
    "viewerPageWheelResetDirection"
  ],
  viewerOnboardingState: [
    "viewerOnboardingOpen", "viewerOnboardingShownThisSession", "viewerOnboardingStep",
    "viewerOnboardingTarget", "viewerOnboardingFloatingTargets", "viewerOnboardingRestoreUi",
    "viewerOnboardingLayoutRaf", "viewerOnboardingLayoutTimer"
  ]
});

const expectedTypeNames = Object.freeze({
  viewerSessionState: "ViewerSessionState",
  viewerViewportState: "ViewerViewportState",
  viewerGestureState: "ViewerGestureState",
  viewerChromeState: "ViewerChromeState",
  viewerImageState: "ViewerImageState",
  viewerNavigationState: "ViewerNavigationState",
  viewerOnboardingState: "ViewerOnboardingState"
});

const inventories = inventoryProjectFiles(root, [statePath, contractsPath]);
const stateInventory = inventories["src/js/16-viewer-state.js"];
const contractInventory = inventories["types/frontend-contracts.d.ts"];
const sourceDomains = new Map(
  Object.entries(stateInventory.objectDeclarations)
    .filter(([name]) => expectedDomains[name]),
);
const contractDomains = new Map(
  contractInventory.declarations
    .filter((declaration) => Object.values(expectedTypeNames).includes(declaration.name))
    .map((declaration) => [declaration.name, declaration.properties]),
);
const runtimeVariableNames = new Set(Object.keys(stateInventory.objectDeclarations));
const contractTypeNames = new Set(
  contractInventory.declarations
    .filter((declaration) => declaration.kind === "TypeAliasDeclaration")
    .map((declaration) => declaration.name),
);
assert.equal(sourceDomains.size, 7, "Viewer runtime state must have exactly seven domain owners");
assert.equal(contractDomains.size, 7, "Viewer type contracts must have exactly seven matching domain types");

const allFields = [];
for (const [domain, expectedFields] of Object.entries(expectedDomains)) {
  assert.deepEqual(sourceDomains.get(domain), expectedFields, `${domain} runtime ownership drifted`);
  assert.deepEqual(contractDomains.get(expectedTypeNames[domain]), expectedFields, `${expectedTypeNames[domain]} drifted from runtime ownership`);
  allFields.push(...expectedFields);
}
assert.equal(allFields.length, 68, "the Viewer domain partition must account for all 68 original state fields");
assert.equal(new Set(allFields).size, 68, "a Viewer state field is owned by more than one domain");
assert.equal(runtimeVariableNames.has("viewerState"), false, "the former aggregate mutable state must not return");
assert.equal(runtimeVariableNames.has("viewerStateDomains"), false, "the seven domains must not be re-aggregated behind another mutable facade");
assert.equal(contractTypeNames.has("ViewerState"), false, "the former aggregate ViewerState contract must not return");

console.log("viewer_state_domains_contract.test.js: PASS");
