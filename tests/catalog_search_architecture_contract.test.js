"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const compiler = fs.readFileSync(path.join(root, "tools/catalog_compiler.py"), "utf8");
const indexBuilder = fs.readFileSync(path.join(root, "tools/catalog_search_index.py"), "utf8");
const runtime = fs.readFileSync(path.join(root, "catalog-search.js"), "utf8");
const worker = fs.readFileSync(path.join(root, "catalog-search-worker.js"), "utf8");
const searchUi = fs.readFileSync(path.join(root, "src/js/50-search-ui.js"), "utf8");
const searchState = fs.readFileSync(path.join(root, "src/js/13-search-state.js"), "utf8");
const deploy = fs.readFileSync(path.join(root, "tools/build_deploy_bundle.py"), "utf8");
const schema = JSON.parse(fs.readFileSync(path.join(root, "schemas/catalogs.search-index.schema.json"), "utf8"));

assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
assert.match(compiler, /SEARCH_INDEX_FILE = "catalogs\.search-index\.json"/);
assert.match(compiler, /build_normalized_search_index\(generated, search\)/);
assert.match(indexBuilder, /postings: dict\[str, list\[int\]\]/);
assert.match(indexBuilder, /normalize_search_text/);
assert.match(indexBuilder, /"terms": normalized_postings/);

assert.match(runtime, /new Worker\(SEARCH_WORKER_SCRIPT_SRC/);
assert.match(runtime, /worker\.postMessage\(\{\s*type: "search"/);
assert.match(runtime, /latestRequestByChannel/);
assert.match(runtime, /SearchCancelledError/);
assert.doesNotMatch(runtime, /window\.BARGIG_CATALOG_SEARCH/);
assert.doesNotMatch(runtime, /searchIndex\(\)\.forEach/);

assert.match(worker, /async function resolveTokenDocuments/);
assert.match(worker, /intersectSorted/);
assert.match(worker, /excerptForField/);
assert.match(worker, /matchReason/);
assert.match(worker, /highlights/);
assert.match(worker, /yieldToWorkerQueue/);

assert.match(searchState, /const SEARCH_INPUT_DEBOUNCE_MS = 90;/);
assert.match(searchUi, /scheduleSearchRender\("global"/);
assert.match(searchUi, /scheduleSearchRender\("viewer"/);
assert.match(searchUi, /globalSearchRenderSequence/);
assert.match(searchUi, /lightboxSearchRenderSequence/);
assert.match(searchUi, /GLOBAL_SEARCH_INITIAL_RENDER_COUNT = 6/);
assert.match(searchUi, /GLOBAL_SEARCH_RENDER_CHUNK_SIZE = 6/);
assert.match(searchUi, /renderGlobalSearchResultsProgressively/);
assert.match(searchUi, /window\.setTimeout\(appendNextBatch, 0\)/);
assert.match(searchUi, /control\.isCurrent && !control\.isCurrent\(\)/);
const postIndexRefresh = searchUi.match(/function refreshSearchUiAfterIndexLoad\(\) \{([\s\S]*?)\n\}/)?.[1] || "";
assert.doesNotMatch(postIndexRefresh, /render(?:Lightbox)?SearchResults\(/);
assert.match(searchUi, /searchResultDetailsMarkup/);
assert.match(searchUi, /search-match-highlight/);
assert.match(searchUi, /עמוד \$\{page\}/);
assert.match(searchUi, /catalogSearch\?\.cancel\?\.\("global"\)/);
assert.match(searchUi, /catalogSearch\?\.cancel\?\.\("viewer"\)/);

assert.match(deploy, /fingerprint_search_runtime_assets/);
assert.match(deploy, /catalog-search-worker\.js/);
assert.match(deploy, /catalogs\.search-index\.json/);
assert.doesNotMatch(deploy.split("DEPLOY_FILES =", 2)[1].split("OPTIONAL_DEPLOY_FILES", 1)[0], /catalogs\.search\.js/);

console.log("catalog_search_architecture_contract.test.js: PASS");
