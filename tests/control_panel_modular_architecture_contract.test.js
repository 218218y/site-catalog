"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const panelRoot = path.join(root, "src", "control-panel");
const entry = path.join(panelRoot, "catalog-control-panel.js");
const featureDir = path.join(panelRoot, "features");
const coreDir = path.join(panelRoot, "core");
const featureNames = ["catalogs", "taxonomy", "footer", "jobs", "pdf", "system"];
const coreNames = ["api", "dom", "format", "state"];
const moduleFiles = [
  entry,
  ...coreNames.map(name => path.join(coreDir, `${name}.js`)),
  ...featureNames.map(name => path.join(featureDir, `${name}.js`))
];

for (const filename of moduleFiles) {
  assert.equal(fs.existsSync(filename), true, `Missing control-panel module: ${path.relative(root, filename)}`);
}

const read = filename => fs.readFileSync(filename, "utf8");
const entrySource = read(entry);
for (const name of featureNames) {
  assert.match(entrySource, new RegExp(`from "\\./features/${name}\\.js"`));
}
for (const name of coreNames) {
  assert.match(entrySource, new RegExp(`from "\\./core/${name}\\.js"`));
}
assert.ok(entrySource.split(/\r?\n/).length <= 120, "The control-panel entry must remain a composition root");

const featureSources = new Map(featureNames.map(name => [name, read(path.join(featureDir, `${name}.js`))]));
for (const [name, source] of featureSources) {
  assert.doesNotMatch(source, /from ["'][^"']*\/features\//, `${name} must not import another feature`);
  assert.doesNotMatch(source, /document\.(?:getElementById|querySelector|querySelectorAll)\(/, `${name} must receive owned DOM from core/dom.js`);
  assert.doesNotMatch(source, /applyServerState/, `${name} must not replace canonical state directly`);
  assert.match(source, new RegExp(`export function create${name[0].toUpperCase()}${name.slice(1)}Feature\\(`));
  assert.ok(source.split(/\r?\n/).length <= 500, `${name} feature is growing into a new monolith`);
}

const domSource = read(path.join(coreDir, "dom.js"));
assert.match(domSource, /document\.getElementById\(id\)/);
for (const filename of moduleFiles.filter(filename => filename !== path.join(coreDir, "dom.js"))) {
  assert.doesNotMatch(read(filename), /document\.getElementById\(/, `${path.relative(root, filename)} bypasses the DOM owner`);
}

const stateSource = read(path.join(coreDir, "state.js"));
assert.match(stateSource, /export function applyServerState\(/);
assert.equal((moduleFiles.map(read).join("\n").match(/function applyServerState\(/g) || []).length, 1);
assert.equal((entrySource.match(/applyServerState\(data, options\)/g) || []).length, 1);

function importsFor(filename) {
  const source = read(filename);
  const imports = [];
  const pattern = /\b(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;
  for (const match of source.matchAll(pattern)) {
    if (!match[1].startsWith(".")) continue;
    imports.push(path.normalize(path.resolve(path.dirname(filename), match[1])));
  }
  return imports.filter(imported => moduleFiles.includes(imported));
}

const graph = new Map(moduleFiles.map(filename => [filename, importsFor(filename)]));
const visiting = new Set();
const visited = new Set();
function visit(filename, stack = []) {
  if (visiting.has(filename)) {
    const cycle = [...stack.slice(stack.indexOf(filename)), filename].map(item => path.relative(panelRoot, item));
    assert.fail(`Control-panel import cycle: ${cycle.join(" -> ")}`);
  }
  if (visited.has(filename)) return;
  visiting.add(filename);
  for (const dependency of graph.get(filename) || []) visit(dependency, [...stack, filename]);
  visiting.delete(filename);
  visited.add(filename);
}
for (const filename of moduleFiles) visit(filename);

console.log("control_panel_modular_architecture_contract.test.js: PASS");
