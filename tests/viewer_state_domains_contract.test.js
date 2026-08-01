"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript-5-8");

const root = path.resolve(__dirname, "..");
const statePath = path.join(root, "src", "js", "16-viewer-state.js");
const contractsPath = path.join(root, "types", "frontend-contracts.d.ts");
const stateSource = fs.readFileSync(statePath, "utf8");
const contractsSource = fs.readFileSync(contractsPath, "utf8");

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

function propertyNameText(name) {
  if (!name) return "";
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return name.getText();
}

function objectLiteralDomains(sourceText, filename) {
  const sourceFile = ts.createSourceFile(filename, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const domains = new Map();
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !expectedDomains[declaration.name.text]) continue;
      assert.ok(declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer), `${declaration.name.text} must be an object literal`);
      const properties = declaration.initializer.properties.map((property) => {
        assert.ok(ts.isPropertyAssignment(property), `${declaration.name.text} must use explicit property assignments`);
        return propertyNameText(property.name);
      });
      domains.set(declaration.name.text, properties);
    }
  }
  return domains;
}

function typeLiteralDomains(sourceText, filename) {
  const sourceFile = ts.createSourceFile(filename, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const result = new Map();
  const wanted = new Set(Object.values(expectedTypeNames));
  for (const statement of sourceFile.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || !wanted.has(statement.name.text)) continue;
    assert.ok(ts.isTypeLiteralNode(statement.type), `${statement.name.text} must remain a type literal`);
    result.set(statement.name.text, statement.type.members.map((member) => propertyNameText(member.name)));
  }
  return result;
}

const sourceDomains = objectLiteralDomains(stateSource, statePath);
const contractDomains = typeLiteralDomains(contractsSource, contractsPath);
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
assert.doesNotMatch(stateSource, /\bconst\s+viewerState\s*=/, "the former aggregate mutable state must not return");
assert.doesNotMatch(stateSource, /\bviewerStateDomains\b/, "the seven domains must not be re-aggregated behind another mutable facade");
assert.doesNotMatch(contractsSource, /\bexport type ViewerState\s*=/, "the former aggregate ViewerState contract must not return");

console.log("viewer_state_domains_contract.test.js: PASS");
