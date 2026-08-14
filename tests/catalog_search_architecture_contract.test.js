"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { findCalls, inventoryProjectFiles, inventorySource } = require("./helpers/frontend_ast.js");

const root = path.resolve(__dirname, "..");
const compiler = fs.readFileSync(path.join(root, "tools/catalog_compiler.py"), "utf8");
const indexBuilder = fs.readFileSync(path.join(root, "tools/catalog_search_index.py"), "utf8");
const workerSource = fs.readFileSync(path.join(root, "catalog-search-worker.js"), "utf8");
const deploy = fs.readFileSync(path.join(root, "tools/build_deploy_bundle.py"), "utf8");
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/catalogs.search-index.schema.json"), "utf8"));

const javascriptFiles = [
  "src/runtime/catalog-search.js",
  "src/js/50-search-ui.js",
  "src/js/39-search-catalog-domain.js",
  "src/js/13-search-state.js",
];
const ast = inventoryProjectFiles(root, javascriptFiles);
const runtime = ast["src/runtime/catalog-search.js"];
const searchUi = ast["src/js/50-search-ui.js"];
const searchDomain = ast["src/js/39-search-catalog-domain.js"];
const searchState = ast["src/js/13-search-state.js"];
const worker = inventorySource(workerSource, "catalog-search-worker.js");
const functions = (inventory) => new Set(inventory.declarations.filter((entry) => entry.kind === "FunctionDeclaration").map((entry) => entry.name));
const identifiers = (inventory) => new Set(inventory.identifiers);

assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.match(compiler, /SEARCH_INDEX_FILE = "catalogs\.search-index\.json"/);
assert.match(compiler, /build_normalized_search_index\(generated, search\)/);
assert.match(indexBuilder, /postings: dict\[str, list\[int\]\]/);
assert.match(indexBuilder, /normalize_search_text/);
assert.match(indexBuilder, /"terms": normalized_postings/);

assert.equal(runtime.newExpressions.some((entry) => entry.callee === "Worker"), true);
assert.equal(findCalls(runtime, "activeWorker.postMessage").length > 0, true);
assert.equal(identifiers(runtime).has("latestRequestByChannel"), true);
assert.equal(runtime.stringLiterals.includes("SearchCancelledError"), true);
assert.equal(runtime.propertyAccesses.some((entry) => entry.path === "window.BargigCatalogSearch"), false);
assert.equal(runtime.exportStatementCount > 0, true);
assert.equal(findCalls(runtime, "searchIndex().forEach").length, 0);

for (const name of ["resolveTokenDocuments", "intersectSorted", "excerptForField", "yieldToWorkerQueue"]) {
  assert.equal(functions(worker).has(name), true, `search worker must own ${name}`);
}
assert.equal(identifiers(worker).has("matchReason"), true);
assert.equal(identifiers(worker).has("highlights"), true);
assert.equal(findCalls(worker, "yieldToWorkerQueue").length > 0, true);

assert.equal(searchState.literalDeclarations.SEARCH_INPUT_DEBOUNCE_MS, 90);
assert.equal(findCalls(searchUi, "scheduleSearchRender").some((call) => call.arguments[0] === "global"), true);
assert.equal(findCalls(searchUi, "scheduleSearchRender").some((call) => call.arguments[0] === "viewer"), true);
assert.equal(identifiers(searchUi).has("globalSearchRenderSequence"), true);
assert.equal(identifiers(searchUi).has("lightboxSearchRenderSequence"), true);
assert.equal(searchUi.literalDeclarations.GLOBAL_SEARCH_INITIAL_RENDER_COUNT, 3);
assert.equal(searchUi.literalDeclarations.GLOBAL_SEARCH_RENDER_CHUNK_SIZE, 3);
assert.equal(functions(searchUi).has("renderGlobalSearchResultsProgressively"), true);
assert.equal(findCalls(searchUi, "window.requestAnimationFrame").some((call) => call.enclosingFunction === "renderGlobalSearchResultsProgressively"), true);
assert.equal(findCalls(searchUi, "window.cancelAnimationFrame").length > 0, true);
assert.equal(findCalls(searchUi, "control.isCurrent").length > 0, true);
const postIndexRefreshCalls = searchUi.calls.filter((call) => call.enclosingFunction === "refreshSearchUiAfterIndexLoad");
assert.equal(postIndexRefreshCalls.some((call) => ["renderSearchResults", "renderLightboxSearchResults"].includes(call.callee)), false);
assert.equal(findCalls(searchUi, "searchCatalogDomain.searchResultDetailsMarkup").length > 0, true);
assert.equal(searchDomain.stringLiterals.some((value) => value.includes("search-match-highlight")), true);
assert.equal(searchDomain.stringLiterals.some((value) => value.includes("עמוד")), true);
assert.equal(findCalls(searchUi, "catalogSearch.cancel").some((call) => call.arguments[0] === "global"), true);
assert.equal(findCalls(searchUi, "catalogSearch.cancel").some((call) => call.arguments[0] === "viewer"), true);

assert.match(deploy, /fingerprint_search_runtime_assets/);
assert.match(deploy, /fingerprint_external_modules/);
assert.match(deploy, /catalog-search-worker\.js/);
assert.match(deploy, /catalogs\.search-index\.json/);
assert.doesNotMatch(deploy.split("DEPLOY_FILES =", 2)[1].split("OPTIONAL_DEPLOY_FILES", 1)[0], /catalogs\.search\.js/);

console.log("catalog_search_architecture_contract.test.js: PASS");
