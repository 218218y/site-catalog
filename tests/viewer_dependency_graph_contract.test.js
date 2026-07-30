"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "src", "js");
const sourceNames = fs.readdirSync(sourceDir).filter((name) => name.endsWith(".js")).sort();
const sourceSet = new Set(sourceNames);
const sources = new Map(sourceNames.map((name) => [name, fs.readFileSync(path.join(sourceDir, name), "utf8")]));
const graph = new Map(sourceNames.map((name) => [name, new Set()]));
const staticImport = /\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']\.\/([^"']+\.js)["']/gs;

for (const [name, source] of sources) {
  for (const match of source.matchAll(staticImport)) {
    if (sourceSet.has(match[1])) graph.get(name).add(match[1]);
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

const sessionState = sources.get("51-viewer-session-state.js");
const browserSession = sources.get("52-viewer-session.js");
const image = sources.get("53-viewer-image.js");
const geometry = sources.get("54-viewer-geometry.js");
const zoomController = sources.get("55-viewer-zoom-controller.js");
const fitController = sources.get("57-viewer-fit-controller.js");
const pageController = sources.get("59-viewer-page-controller.js");
const viewerRoot = sources.get("60-viewer.js");
const layoutController = sources.get("61-viewer-layout-controller.js");

assert.match(sessionState, /function transitionViewerPhase\(/);
assert.match(sessionState, /function transitionViewerFullscreenPhase\(/);
assert.doesNotMatch(browserSession, /function transitionViewerPhase\(/);
assert.doesNotMatch(browserSession, /viewerState\.viewerPhase\s*=/);

assert.doesNotMatch(image, /from "\.\/56-viewer-shell\.js"/);
assert.doesNotMatch(geometry, /from "\.\/(?:53-viewer-image|56-viewer-shell)\.js"/);
assert.match(zoomController, /function setZoom\(/);
assert.match(fitController, /function setViewerFitMode\(/);
assert.match(pageController, /function setLightboxPage\(/);
assert.match(pageController, /function setFavoriteViewerIndex\(/);
assert.match(pageController, /function moveLightbox\(/);
assert.match(layoutController, /function refreshLightboxLayoutForTopUiChange\(/);

assert.match(viewerRoot, /registerFeatureInterface\("viewer", \{/);
assert.doesNotMatch(viewerRoot, /function (?:setLightboxPage|setFavoriteViewerIndex|moveLightbox|setZoom|setViewerFitMode)\(/);
assert.doesNotMatch(viewerRoot, /\bexport\s+(?:\{|default|const|function|class)\b/);

console.log("viewer_dependency_graph_contract.test.js: PASS");
