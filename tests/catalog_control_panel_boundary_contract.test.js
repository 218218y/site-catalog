"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "catalog-control-panel.html"), "utf8");
const app = fs.readFileSync(path.join(root, "src", "control-panel", "catalog-control-panel.js"), "utf8");
const server = fs.readFileSync(path.join(root, "tools", "catalog_control_server.py"), "utf8");
const profiles = fs.readFileSync(path.join(root, "tools", "catalog_conversion_profiles.py"), "utf8");
const jsconfig = JSON.parse(fs.readFileSync(path.join(root, "jsconfig.json"), "utf8"));
const functionsPackage = JSON.parse(fs.readFileSync(path.join(root, "functions", "package.json"), "utf8"));

assert.match(html, /catalog-control-panel\.css/);
assert.match(html, /catalog-control-panel\.js/);
assert.doesNotMatch(html, /<style>|<script(?![^>]*src=)|\sstyle=/);
assert.ok(jsconfig.include.includes("src/control-panel/**/*.js"));
assert.ok(jsconfig.files.includes("types/control-panel-api.d.ts"));

assert.match(app, /function applyServerState/);
assert.match(app, /return error instanceof Error \? error\.message/);
assert.doesNotMatch(app, /return error instanceof Error \? errorMessage\(error\)/);
assert.doesNotMatch(app, /style=/);
assert.match(app, /applyServerState\(payload\.state/);
assert.doesNotMatch(app, /state\.catalogs\s*=\s*groupCatalogsByCategorySubcategory/);
assert.match(app, /confirmedMissingPdfIds/);
assert.match(server, /CatalogSaveRequest\.parse/);
assert.match(server, /TaxonomySaveRequest\.parse/);
assert.match(server, /FooterSaveRequest\.parse/);
assert.match(server, /RunActionRequest\.parse/);
assert.match(server, /MAX_PDF_UPLOAD_BYTES/);
assert.match(server, /Content-Security-Policy/);
assert.match(server, /--allow-remote/);
assert.match(server, /validate_missing_pdf_confirmation/);
assert.match(profiles, /"production": ConversionProfile/);
assert.match(profiles, /"force": ConversionProfile/);
assert.match(profiles, /"ocr-refresh": ConversionProfile/);

assert.deepEqual(functionsPackage, { private: true, type: "module" });
assert.notEqual(JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).type, "module");

console.log("catalog_control_panel_boundary_contract.test.js: PASS");
