"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const routeDocuments = ["index.html", "catalog.html", "favorites.html", "viewer.html", "site.template.html"];
const classicConfigAssets = ["catalog-assets.config.js"];
const generatedDataModules = [
  "catalogs.generated.module.js",
  "catalog-taxonomy.generated.module.js",
];
const externalRuntimeAssets = [
  "catalog-search.js",
  "tooltip-manager.js",
  "favorites-store.js",
  "site-routes.js",
];

for (const documentName of routeDocuments) {
  const source = fs.readFileSync(path.join(root, documentName), "utf8");
  for (const asset of classicConfigAssets) {
    assert.match(source, new RegExp(`<script src=["']${asset.replaceAll(".", "\\.")}["']></script>`), `${documentName}: ${asset}`);
  }
  for (const asset of generatedDataModules) {
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

const deploy = fs.readFileSync(path.join(root, "tools", "build_deploy_bundle.py"), "utf8");
const deployFiles = deploy.split("DEPLOY_FILES =", 2)[1].split("OPTIONAL_DEPLOY_FILES", 1)[0];
assert.doesNotMatch(deployFiles, /catalogs\.search\.js/);
assert.doesNotMatch(deployFiles, /catalogs\.search\.json/);
assert.doesNotMatch(deployFiles, /catalog-snapshot\.js/);
assert.match(deploy, /fingerprint_external_modules/);
assert.match(deploy, /DEPLOY_EXTERNAL_MODULE_FILES/);

const frontendBuilder = fs.readFileSync(path.join(root, "tools", "build_frontend_assets.py"), "utf8");
const frontendRunner = fs.readFileSync(path.join(root, "tools", "build_frontend_esbuild.mjs"), "utf8");
const frontendContracts = fs.readFileSync(path.join(root, "tools", "check_frontend_contracts.py"), "utf8");
const sharedRuntimeSources = ["20-catalog-runtime.js", "21-ui-runtime.js"]
  .map((name) => fs.readFileSync(path.join(root, "src", "js", name), "utf8"))
  .join("\n");
const viewerShare = fs.readFileSync(path.join(root, "src", "js", "31-viewer-share.js"), "utf8");
const snapshotModule = fs.readFileSync(path.join(root, "catalog-snapshot.js"), "utf8");
assert.doesNotMatch(frontendBuilder, /OBSOLETE_GENERATED_FILES|remove_obsolete_generated_files|app\.js/);
assert.match(frontendBuilder, /RUNTIME_EXTERNAL_MODULES/);
assert.match(frontendBuilder, /GENERATED_DATA_EXTERNAL_MODULES/);
assert.doesNotMatch(frontendContracts, /obsolete compatibility loader remains|base \/ "app\.js"/);
assert.doesNotMatch(sharedRuntimeSources, /catalog-snapshot\.js|catalogSnapshotApi/);
assert.match(viewerShare, /import catalogSnapshotApi from "\.\.\/\.\.\/catalog-snapshot\.js";/);
assert.match(frontendRunner, /external:\s*true/);
assert.match(snapshotModule, /export default catalogSnapshotApi/);
assert.doesNotMatch(snapshotModule, /window\.CatalogSnapshot|module\.exports/);

for (const appName of ["app-catalog.js", "app-favorites.js", "app-viewer.js"]) {
  const app = fs.readFileSync(path.join(root, appName), "utf8");
  for (const asset of [...externalRuntimeAssets, ...generatedDataModules]) {
    assert.match(app, new RegExp(`from ["']\\./${asset.replaceAll(".", "\\.")}["']`), `${appName}: ${asset}`);
  }
}

const paymentApp = fs.readFileSync(path.join(root, "app-payment.js"), "utf8");
assert.match(paymentApp, /src\/entries\/payment\.js/);
for (const asset of [...externalRuntimeAssets, ...generatedDataModules]) {
  assert.doesNotMatch(paymentApp, new RegExp(`from ["']\\./${asset.replaceAll(".", "\\.")}["']`), `app-payment.js: ${asset} must remain absent`);
}

const searchRuntime = fs.readFileSync(path.join(root, "catalog-search.js"), "utf8");
assert.match(searchRuntime, /from ["']\.\/catalogs\.generated\.module\.js["']/);
assert.doesNotMatch(searchRuntime, /BARGIG_CATALOGS|BARGIG_CATALOG_TAXONOMY/);

for (const asset of generatedDataModules) {
  const source = fs.readFileSync(path.join(root, asset), "utf8");
  assert.match(source, /export const (?:catalogs|catalogTaxonomy) = Object\.freeze\(/);
  assert.doesNotMatch(source, /window\.|document\.|globalThis\./);
}

console.log("compatibility_artifact_inventory.test.js: PASS");
