"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const generated = read("types/catalog-data.generated.d.ts");
const contracts = read("types/frontend-contracts.d.ts");
const globals = read("types/frontend-globals.d.ts");
const catalogDataModule = read("catalogs.generated.module.js");
const marker = read("src/js/05-app-contracts.js");
const sharedUi = read("src/js/20-shared-ui.js");
const packageJson = JSON.parse(read("package.json"));
const verifier = read("tools/verify_project.py");
const frontendContracts = read("tools/check_frontend_contracts.py");

assert.equal(
  packageJson.scripts["build:catalog-data-types"],
  "node tools/run_project_python.js --system tools/generate_catalog_data_types.py",
);
assert.equal(
  packageJson.scripts["check:catalog-data-types"],
  "node tools/run_project_python.js --system tools/generate_catalog_data_types.py --check",
);
assert.match(verifier, /Catalog data types are current/);
assert.match(verifier, /tools\/generate_catalog_data_types\.py/);
assert.match(frontendContracts, /types\/frontend-contracts\.d\.ts/);
assert.doesNotMatch(frontendContracts, /contracts = \(base \/ "src\/js\/05-app-contracts\.js"\)/);

assert.match(generated, /^\/\/ Generated from schemas\/catalogs\.generated\.schema\.json/m);
assert.match(generated, /export interface CatalogRecord \{/);
for (const requiredField of [
  "id", "title", "description", "category", "pages", "pageNumberStart",
  "dir", "cover", "imageExt", "assetVersion", "imageVariants",
]) {
  assert.match(generated, new RegExp(`^  ${requiredField}:`, "m"), requiredField);
}
for (const optionalField of ["subcategory", "pageSizes", "sort", "badge"]) {
  assert.match(generated, new RegExp(`^  ${optionalField}\\?:`, "m"), optionalField);
}
for (const nonCanonicalField of ["subCategory", "sub_category", "thumbDir", "mediumDir"]) {
  assert.doesNotMatch(generated, new RegExp(String.raw`\b${nonCanonicalField}\b`));
}
assert.equal(fs.existsSync(path.join(root, "types/catalog-legacy-input.d.ts")), false);
assert.doesNotMatch(sharedUi, /LegacyCatalogRecordInput|catalog-legacy-input|subCategory|sub_category|thumbDir|mediumDir/);
assert.match(
  sharedUi,
  /function catalogSubcategoryName\(catalog\) \{\s*return String\(catalog\?\.subcategory \|\| ""\)\.trim\(\);\s*\}/,
);

assert.match(contracts, /import type \{ CatalogImageVariant, CatalogRecord \} from "\.\/catalog-data\.generated\.js"/);
assert.match(contracts, /export type \{ CatalogImageVariant, CatalogRecord \} from "\.\/catalog-data\.generated\.js"/);
assert.match(contracts, /export type AppNavigationOptions =/);
assert.doesNotMatch(contracts, /declare global/);
assert.doesNotMatch(marker, /@typedef|@callback|@template|declare global/);
assert.match(globals, /declare global \{/);
assert.match(globals, /export \{\};/);
assert.doesNotMatch(globals, /CatalogRecord|BARGIG_CATALOGS|BARGIG_CATALOG_TAXONOMY/);
assert.match(catalogDataModule, /import\("\.\/types\/catalog-data\.generated\.js"\)\.CatalogRecord/);

const declarationSources = [contracts, generated].join("\n");
const sharedNames = new Set(
  [...declarationSources.matchAll(/^export (?:type|interface) ([A-Za-z_$][\w$]*)/gm)]
    .map((match) => match[1]),
);
const sourceFiles = [
  ...fs.readdirSync(path.join(root, "src", "js")).filter((name) => name.endsWith(".js")).map((name) => path.join(root, "src", "js", name)),
  ...fs.readdirSync(path.join(root, "src", "runtime")).filter((name) => name.endsWith(".js")).map((name) => path.join(root, "src", "runtime", name)),
];

for (const filename of sourceFiles) {
  const source = fs.readFileSync(filename, "utf8");
  assert.doesNotMatch(source, /^import .*types\//m, `${path.relative(root, filename)} has a runtime type import`);
  const imported = new Set();
  for (const match of source.matchAll(/@import\s*\{([^}]+)\}\s*from\s*"[^"\n]+"/g)) {
    for (const item of match[1].split(",")) imported.add(item.trim().split(/\s+as\s+/).at(-1));
  }
  const local = new Set(
    [...source.matchAll(/@typedef\s+[^\n]*\s([A-Za-z_$][\w$]*)\s*(?:\*\/)?$/gm)]
      .map((match) => match[1]),
  );
  const used = [...sharedNames].filter((name) => new RegExp(`\\b${name}\\b`).test(source));
  const missing = used.filter((name) => !imported.has(name) && !local.has(name));
  assert.deepEqual(missing, [], `${path.relative(root, filename)} relies on ambient shared contracts`);
}

console.log("frontend_type_contracts_contract.test.js: PASS");
