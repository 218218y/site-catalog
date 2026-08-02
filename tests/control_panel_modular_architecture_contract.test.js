"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { findCalls, inventoryProjectFiles } = require("./helpers/frontend_ast.js");

const root = path.join(__dirname, "..");
const panelRoot = path.join(root, "src", "control-panel");
const entry = path.join(panelRoot, "catalog-control-panel.js");
const featureDir = path.join(panelRoot, "features");
const coreDir = path.join(panelRoot, "core");
const featureNames = ["catalogs", "taxonomy", "footer", "jobs", "pdf", "system"];
const coreNames = ["api", "dom", "format", "state"];
const moduleFiles = [
  entry,
  ...coreNames.map((name) => path.join(coreDir, `${name}.js`)),
  ...featureNames.map((name) => path.join(featureDir, `${name}.js`)),
];

for (const filename of moduleFiles) {
  assert.equal(fs.existsSync(filename), true, `Missing control-panel module: ${path.relative(root, filename)}`);
}

const read = (filename) => fs.readFileSync(filename, "utf8");
const projectInventories = inventoryProjectFiles(root, moduleFiles);
const inventories = new Map(moduleFiles.map((filename) => [
  filename,
  projectInventories[path.relative(root, filename).split(path.sep).join("/")],
]));
const entrySource = read(entry);
const entryInventory = inventories.get(entry);
for (const name of featureNames) {
  assert.equal(entryInventory.staticImports.includes(`./features/${name}.js`), true);
}
for (const name of coreNames) {
  assert.equal(entryInventory.staticImports.includes(`./core/${name}.js`), true);
}
assert.ok(entrySource.split(/\r?\n/).length <= 120, "The control-panel entry must remain a composition root");

for (const name of featureNames) {
  const filename = path.join(featureDir, `${name}.js`);
  const source = read(filename);
  const inventory = inventories.get(filename);
  assert.equal(
    inventory.staticImports.some((specifier) => specifier.includes("/features/")),
    false,
    `${name} must not import another feature`,
  );
  for (const callee of ["document.getElementById", "document.querySelector", "document.querySelectorAll"]) {
    assert.equal(findCalls(inventory, callee).length, 0, `${name} must receive owned DOM from core/dom.js`);
  }
  assert.equal(inventory.identifiers.includes("applyServerState"), false, `${name} must not replace canonical state directly`);
  const factoryName = `create${name[0].toUpperCase()}${name.slice(1)}Feature`;
  assert.equal(
    inventory.declarations.some((declaration) => declaration.name === factoryName && declaration.exported),
    true,
    `${name} must export ${factoryName}`,
  );
  assert.ok(source.split(/\r?\n/).length <= 500, `${name} feature is growing into a new monolith`);
}

const domFile = path.join(coreDir, "dom.js");
assert.equal(findCalls(inventories.get(domFile), "document.getElementById").length > 0, true);
for (const filename of moduleFiles.filter((candidate) => candidate !== domFile)) {
  assert.equal(
    findCalls(inventories.get(filename), "document.getElementById").length,
    0,
    `${path.relative(root, filename)} bypasses the DOM owner`,
  );
}

const stateFile = path.join(coreDir, "state.js");
const applyDeclarations = moduleFiles.flatMap((filename) => inventories.get(filename).declarations)
  .filter((declaration) => declaration.name === "applyServerState");
assert.equal(applyDeclarations.length, 1);
assert.equal(applyDeclarations[0].exported, true);
assert.equal(findCalls(entryInventory, "applyServerState").length, 1);

function importsFor(filename) {
  return inventories.get(filename).staticImports
    .filter((specifier) => specifier.startsWith("."))
    .map((specifier) => path.normalize(path.resolve(path.dirname(filename), specifier)))
    .filter((imported) => moduleFiles.includes(imported));
}

const graph = new Map(moduleFiles.map((filename) => [filename, importsFor(filename)]));
const visiting = new Set();
const visited = new Set();
function visit(filename, stack = []) {
  if (visiting.has(filename)) {
    const cycle = [...stack.slice(stack.indexOf(filename)), filename].map((item) => path.relative(panelRoot, item));
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
