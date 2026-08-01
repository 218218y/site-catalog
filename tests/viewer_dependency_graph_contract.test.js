"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { findCalls, inventorySource } = require("./helpers/frontend_ast.js");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "src", "js");
const sourceNames = fs.readdirSync(sourceDir).filter((name) => name.endsWith(".js")).sort();
const sourceSet = new Set(sourceNames);
const inventories = new Map(sourceNames.map((name) => {
  const source = fs.readFileSync(path.join(sourceDir, name), "utf8");
  return [name, inventorySource(source, name)];
}));
const graph = new Map(sourceNames.map((name) => [name, new Set()]));

for (const [name, inventory] of inventories) {
  for (const specifier of inventory.staticImports) {
    if (!specifier.startsWith("./")) continue;
    const target = specifier.slice(2);
    if (sourceSet.has(target)) graph.get(name).add(target);
  }
}

let nextIndex = 0;
const indexes = new Map();
const lowLinks = new Map();
const stack = [];
const onStack = new Set();
const components = [];

function visit(name) {
  indexes.set(name, nextIndex);
  lowLinks.set(name, nextIndex);
  nextIndex += 1;
  stack.push(name);
  onStack.add(name);

  for (const dependency of graph.get(name)) {
    if (!indexes.has(dependency)) {
      visit(dependency);
      lowLinks.set(name, Math.min(lowLinks.get(name), lowLinks.get(dependency)));
    } else if (onStack.has(dependency)) {
      lowLinks.set(name, Math.min(lowLinks.get(name), indexes.get(dependency)));
    }
  }

  if (lowLinks.get(name) !== indexes.get(name)) return;
  const component = [];
  for (;;) {
    const current = stack.pop();
    onStack.delete(current);
    component.push(current);
    if (current === name) break;
  }
  components.push(component.sort());
}

for (const name of sourceNames) {
  if (!indexes.has(name)) visit(name);
}

const cycles = components.filter((component) => (
  component.length > 1 || graph.get(component[0]).has(component[0])
));
assert.deepEqual(cycles, [], "the frontend ES-module graph must remain acyclic without an allowlist");

const viewerRootImporters = sourceNames.filter((name) => graph.get(name).has("60-viewer.js"));
assert.deepEqual(viewerRootImporters, [], "no source module may import the Viewer composition root");

const functions = (name) => new Set(inventories.get(name).functionDeclarations);
const assignments = (name) => new Set(inventories.get(name).assignmentTargets);
const imports = (name) => new Set(inventories.get(name).staticImports);

assert.equal(inventories.get("16-viewer-state.js").objectDeclarations.viewerState, undefined);
for (const functionName of [
  "createViewerNavigationCommand",
  "beginViewerPageTransitionCommand",
  "assertViewerStateInvariants",
]) {
  assert.equal(functions("17-viewer-state-transitions.js").has(functionName), true);
}
assert.equal(
  [...imports("17-viewer-state-transitions.js")].some((specifier) => /^\.\/5[1-9]-viewer/.test(specifier)),
  false,
);
assert.equal(functions("51-viewer-session-state.js").has("transitionViewerPhase"), true);
assert.equal(functions("51-viewer-session-state.js").has("transitionViewerFullscreenPhase"), true);
assert.equal(functions("52-viewer-session.js").has("transitionViewerPhase"), false);
assert.equal(assignments("52-viewer-session.js").has("viewerSessionState.viewerPhase"), false);

assert.equal(imports("53-viewer-image.js").has("./56-viewer-shell.js"), false);
assert.equal(imports("54-viewer-geometry.js").has("./53-viewer-image.js"), false);
assert.equal(imports("54-viewer-geometry.js").has("./56-viewer-shell.js"), false);
for (const [filename, functionName] of [
  ["55-viewer-zoom-controller.js", "setZoom"],
  ["57-viewer-fit-controller.js", "setViewerFitMode"],
  ["59-viewer-page-controller.js", "setLightboxPage"],
  ["59-viewer-page-controller.js", "setFavoriteViewerIndex"],
  ["59-viewer-page-controller.js", "moveLightbox"],
  ["61-viewer-layout-controller.js", "refreshLightboxLayoutForTopUiChange"],
]) {
  assert.equal(functions(filename).has(functionName), true, `${filename} must own ${functionName}`);
}

const viewerRoot = inventories.get("60-viewer.js");
assert.equal(findCalls(viewerRoot, "registerFeatureInterface").some((call) => call.arguments[0] === "viewer"), true);
for (const forbidden of ["setLightboxPage", "setFavoriteViewerIndex", "moveLightbox", "setZoom", "setViewerFitMode"]) {
  assert.equal(functions("60-viewer.js").has(forbidden), false, `Viewer root must not implement ${forbidden}`);
}
assert.equal(viewerRoot.exportStatementCount, 0, "Viewer composition root must not expose a public module API");

console.log("viewer_dependency_graph_contract.test.js: PASS");
