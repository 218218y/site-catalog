"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { inventoryProjectFiles } = require("./helpers/frontend_ast.js");

const root = path.resolve(__dirname, "..");
const routeDocuments = ["index.html", "catalog.html", "favorites.html", "viewer.html", "site.template.html"];
const deploymentConfigModules = ["catalog-assets.config.js"];
const generatedDataModules = [
  "catalogs.generated.module.js",
  "catalog-taxonomy.generated.module.js",
];
const externalRuntimeAssets = [
  "catalog-search.js",
  "tooltip-manager.js",
  "favorites-store.js",
  "site-routes.js",
  "telemetry.js",
];
const routeApps = ["app-catalog.js", "app-favorites.js", "app-viewer.js"];
const javascriptFiles = [
  ...routeApps,
  "app-payment.js",
  ...deploymentConfigModules,
  "catalog-search.js",
  "catalog-snapshot.js",
  ...generatedDataModules,
  "src/js/31-viewer-share.js",
];
const ast = inventoryProjectFiles(root, javascriptFiles);

for (const documentName of routeDocuments) {
  const source = fs.readFileSync(path.join(root, documentName), "utf8");
  for (const asset of [...deploymentConfigModules, ...generatedDataModules]) {
    assert.doesNotMatch(source, new RegExp(`<script[^>]+src=["']${asset.replaceAll(".", "\\.")}["']`), `${documentName}: ${asset} is imported by ESM`);
  }
  for (const asset of externalRuntimeAssets) {
    assert.doesNotMatch(source, new RegExp(`<script src=["']${asset.replaceAll(".", "\\.")}["']></script>`), `${documentName}: ${asset} must be imported as ESM`);
  }
  assert.doesNotMatch(source, /catalogs\.search(?:\.js|\.json)/);
  assert.doesNotMatch(source, /<script[^>]+src=["']catalog-snapshot\.js["']/);
  assert.doesNotMatch(source, /(?:src|href)=["']app\.js["']/);
}

for (const retired of [
  "catalogs.search.js",
  "catalogs.search.json",
  "catalogs.generated.js",
  "catalog-taxonomy.generated.js",
]) {
  assert.equal(fs.existsSync(path.join(root, retired)), false, `${retired} must remain retired`);
}

const expectedExternalImports = new Set([
  ...deploymentConfigModules.map((name) => `./${name}`),
  ...externalRuntimeAssets.map((name) => `./${name}`),
  ...generatedDataModules.map((name) => `./${name}`),
]);
for (const appName of routeApps) {
  const imports = new Set(ast[appName].staticImports);
  assert.deepEqual(imports, expectedExternalImports, `${appName}: external module boundary`);
}

assert.deepEqual(ast["app-payment.js"].staticImports, [], "payment route stays runtime-module free");
assert.deepEqual(
  ast["catalog-search.js"].staticImports,
  ["./catalog-assets.config.js", "./catalogs.generated.module.js"],
);
assert.ok(
  ast["src/js/31-viewer-share.js"].staticImports.includes("../../catalog-snapshot.js"),
  "viewer sharing owns the catalog snapshot dependency",
);

const configAst = ast["catalog-assets.config.js"];
assert.deepEqual(
  configAst.variableDeclarations
    .filter((declaration) => declaration.exported)
    .map((declaration) => declaration.name),
  ["catalogAssetBaseUrl", "catalogImageDeliveryMode"],
  "deployment image config exposes only immutable ESM bindings",
);
assert.equal(configAst.staticImports.length, 0, "deployment image config must remain dependency-free");
assert.equal(
  configAst.assignmentTargets.some((target) => target.startsWith("window.")),
  false,
  "deployment image config must not publish window globals",
);

for (const [asset, exportedName] of [
  ["catalogs.generated.module.js", "catalogs"],
  ["catalog-taxonomy.generated.module.js", "catalogTaxonomy"],
]) {
  const exportedVariables = ast[asset].variableDeclarations
    .filter((declaration) => declaration.exported)
    .map((declaration) => declaration.name);
  assert.deepEqual(exportedVariables, [exportedName], `${asset}: canonical generated export`);
  assert.equal(ast[asset].staticImports.length, 0, `${asset}: generated data is dependency-free`);
  assert.equal(
    ast[asset].propertyAccesses.some((access) => /^(?:window|document|globalThis)\./.test(access.path)),
    false,
    `${asset}: generated data must remain runtime-neutral`,
  );
}

const snapshotAst = ast["catalog-snapshot.js"];
assert.ok(snapshotAst.exportStatementCount >= 1, "catalog snapshot must remain an ES module");
assert.equal(
  snapshotAst.assignmentTargets.some((target) => target.startsWith("window.") || target === "module.exports"),
  false,
  "catalog snapshot must not expose compatibility globals",
);

console.log("compatibility_artifact_inventory.test.js: PASS");
