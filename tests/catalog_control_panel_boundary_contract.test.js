"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { hasFunction, inventoryProjectFiles } = require("./helpers/frontend_ast");

const root = path.join(__dirname, "..");
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), "utf8");
const html = read("catalog-control-panel.html");
const bootstrap = read("src", "control-panel", "catalog-control-panel.js");
const api = read("src", "control-panel", "core", "api.js");
const state = read("src", "control-panel", "core", "state.js");
const server = read("tools", "catalog_control_server.py");
const requestBoundary = read("tools", "catalog_control_api.py");
const schema = JSON.parse(read("schemas", "control-panel-api.schema.json"));
const generatedTypes = read("types", "control-panel-api.d.ts");
const profiles = read("tools", "catalog_conversion_profiles.py");
const verifier = read("tools", "verify_project.py");
const packageJson = JSON.parse(read("package.json"));
const jsconfig = JSON.parse(read("jsconfig.json"));
const functionsPackage = JSON.parse(read("functions", "package.json"));
const frontendAst = inventoryProjectFiles(root, [
  'src/control-panel/catalog-control-panel.js',
  'src/control-panel/core/state.js',
]);
const bootstrapAst = frontendAst['src/control-panel/catalog-control-panel.js'];
const stateAst = frontendAst['src/control-panel/core/state.js'];

assert.match(html, /catalog-control-panel\.css/);
assert.match(html, /<script type="module" src="\/src\/control-panel\/catalog-control-panel\.js"><\/script>/);
assert.doesNotMatch(html, /<style>|<script(?![^>]*src=)|\sstyle=/);

assert.ok(jsconfig.include.includes("src/control-panel/**/*.js"));
assert.ok(jsconfig.files.includes("types/control-panel-api.d.ts"));
assert.ok(jsconfig.files.includes("types/control-panel-client.d.ts"));

assert.match(bootstrap, /import \{ applyServerState, state \} from "\.\/core\/state\.js"/);
assert.ok(hasFunction(bootstrapAst, 'applyCanonicalState'));
assert.match(bootstrap, /applyServerState\(data, options\)/);
assert.match(bootstrap, /renderCanonicalState\(\)/);
for (const implementationFunction of ['renderCatalogs', 'renderTaxonomyEditor', 'footerFieldMarkup', 'cancelActiveJob']) {
  assert.equal(hasFunction(bootstrapAst, implementationFunction), false);
}
assert.ok(bootstrap.split(/\r?\n/).length <= 120, "Control-panel bootstrap must remain a small composition root");

assert.ok(stateAst.declarations.some((declaration) => declaration.name === 'applyServerState' && declaration.kind === 'FunctionDeclaration' && declaration.exported));
assert.match(state, /state\.catalogs = data\.catalogs\.map/);
assert.match(state, /state\.taxonomy = \{[\s\S]*?categories: data\.taxonomy\.categories\.map[\s\S]*?subcategories: data\.taxonomy\.subcategories\.map/);
assert.match(api, /saveCatalogs\(request\)/);
assert.match(api, /saveTaxonomy\(request\)/);
assert.match(api, /saveFooter\(request\)/);
assert.match(api, /runAction\(request\)/);
assert.doesNotMatch(api, /ControlApiResponse/);

assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
for (const definition of [
  "ControlPanelStateDto",
  "CatalogSaveRequestDto",
  "CatalogSaveResponseDto",
  "TaxonomySaveRequestDto",
  "TaxonomySaveResponseDto",
  "FooterSaveRequestDto",
  "FooterSaveResponseDto",
  "RunActionRequestDto",
  "RunActionResponseDto"
]) {
  assert.ok(schema.$defs[definition], `Missing canonical API definition: ${definition}`);
}
assert.match(generatedTypes, /^\/\/ Generated from schemas\/control-panel-api\.schema\.json\. Do not edit manually\./);
assert.match(generatedTypes, /interface ControlPanelStateDto/);
assert.match(generatedTypes, /interface CatalogSaveRequestDto/);

assert.match(requestBoundary, /validate_control_panel_payload/);
assert.match(requestBoundary, /validate_request_payload\("CatalogSaveRequestDto", normalized\)/);
assert.match(requestBoundary, /validate_request_payload\("TaxonomySaveRequestDto", payload\)/);
assert.match(requestBoundary, /validate_request_payload\("FooterSaveRequestDto", payload\)/);
assert.match(requestBoundary, /validate_request_payload\("RunActionRequestDto", normalized\)/);
assert.match(server, /def send_contract_json\(/);
assert.match(server, /validate_control_panel_payload\(contract, payload\)/);
assert.match(server, /send_contract_json\("ControlPanelStateDto", state_payload\(\)\)/);
assert.match(server, /CONTROL_PANEL_STATIC_ROOT\.rglob\("\*"\)/);
assert.match(server, /MAX_PDF_UPLOAD_BYTES/);
assert.match(server, /Content-Security-Policy/);
assert.match(server, /--allow-remote/);
assert.match(server, /validate_missing_pdf_confirmation/);

assert.match(profiles, /"production": ConversionProfile/);
assert.match(profiles, /"force": ConversionProfile/);
assert.match(profiles, /"ocr-refresh": ConversionProfile/);

assert.equal(packageJson.scripts["build:control-panel-api-types"], "node tools/run_project_python.js tools/generate_control_panel_api_types.py");
assert.equal(packageJson.scripts["check:control-panel-api-types"], "node tools/run_project_python.js tools/generate_control_panel_api_types.py --check");
assert.match(verifier, /Control-panel API types are current/);
assert.match(verifier, /tools\/generate_control_panel_api_types\.py", "--check"/);
assert.deepEqual(functionsPackage, { private: true, type: "module" });
assert.notEqual(packageJson.type, "module");

console.log("catalog_control_panel_boundary_contract.test.js: PASS");
