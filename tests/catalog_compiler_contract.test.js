"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const tools = path.join(root, "tools");
const compiler = fs.readFileSync(path.join(tools, "catalog_compiler.py"), "utf8");
const schema = fs.readFileSync(path.join(tools, "catalog_schema.py"), "utf8");
const control = fs.readFileSync(path.join(tools, "catalog_control_server.py"), "utf8");
const converter = fs.readFileSync(path.join(tools, "build_catalogs.py"), "utf8");
const deploy = fs.readFileSync(path.join(tools, "build_deploy_bundle.py"), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const schemaNames = [
  "catalogs.config.schema.json",
  "catalog-taxonomy.config.schema.json",
  "catalogs.build-state.schema.json",
  "catalogs.generated.schema.json",
  "catalogs.search.schema.json",
  "catalogs.search-index.schema.json",
];
for (const name of schemaNames) {
  const fullPath = path.join(root, "schemas", name);
  assert.equal(fs.existsSync(fullPath), true, `Missing official schema: ${name}`);
  const payload = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  assert.equal(payload.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.match(payload.$id, new RegExp(`${name.replaceAll(".", "\\.")}$`));
}

assert.equal(fs.existsSync(path.join(root, "catalogs.build-state.json")), true);
assert.equal(packageJson.scripts["build:catalog-data"], "python tools/catalog_compiler.py");
assert.equal(packageJson.scripts["check:catalog-data"], "python tools/catalog_compiler.py --check");

assert.match(compiler, /class CompiledCatalogData/);
assert.match(compiler, /def compile_catalog_data\(/);
assert.match(compiler, /def compile_current_project_catalog_data\(/);
assert.match(compiler, /def verify_managed_outputs_reconstructable\(/);
assert.match(compiler, /BUILD_STATE_FILE = "catalogs\.build-state\.json"/);
assert.match(compiler, /SEARCH_INDEX_FILE = "catalogs\.search-index\.json"/);
assert.match(compiler, /build_normalized_search_index/);
assert.match(compiler, /def load_build_state\(root: Path, \*, allow_legacy_migration: bool = False\)/);
assert.match(compiler, /--migrate-legacy-state/);
assert.match(schema, /class SchemaValidationError/);
assert.match(schema, /Draft 2020-12/);
assert.equal(fs.existsSync(path.join(root, "docs", "catalog-data-compiler.md")), true);

assert.match(control, /from catalog_compiler import \(/);
assert.match(control, /compile_catalog_outputs_after_source_save/);
assert.match(control, /compile_and_write_catalog_data\(/);
assert.doesNotMatch(control, /def sync_generated_metadata_after_config_save/);
assert.doesNotMatch(control, /def write_catalogs_generated_files/);
assert.doesNotMatch(control, /def write_catalogs_search_files/);
assert.doesNotMatch(control, /window\.BARGIG_CATALOGS\s*=/);
assert.doesNotMatch(control, /window\.BARGIG_CATALOG_SEARCH\s*=/);

assert.match(converter, /build_state_from_artifacts/);
assert.match(converter, /compile_and_write_catalog_data\(/);
assert.doesNotMatch(converter, /def write_generated_files/);
assert.doesNotMatch(converter, /window\.BARGIG_CATALOGS\s*=/);
assert.doesNotMatch(converter, /window\.BARGIG_CATALOG_SEARCH\s*=/);
assert.match(deploy, /compile_current_project_catalog_data\(/);
assert.match(deploy, /"catalogs\.build-state\.json"/);
assert.match(deploy, /"schemas"/);
assert.match(deploy, /"tools\/catalog_compiler\.py"/);

const pythonFiles = fs.readdirSync(tools).filter((name) => name.endsWith(".py"));
const catalogWriters = pythonFiles.filter((name) => {
  const source = fs.readFileSync(path.join(tools, name), "utf8");
  return /window\.BARGIG_CATALOGS\s*=|window\.BARGIG_CATALOG_SEARCH\s*=/.test(source);
});
assert.deepEqual(catalogWriters, ["build_big_pages_viewer.py", "catalog_compiler.py"]);
assert.match(compiler, /render_updated_files_from_catalogs/);
assert.match(compiler, /catalog-big-pages-viewer-netfree\/catalog-big-pages-viewer\.html/);

assert.match(fs.readFileSync(path.join(root, "catalogs.generated.js"), "utf8"), /tools\/catalog_compiler\.py/);
assert.equal(fs.existsSync(path.join(root, "catalogs.search.json")), false);
assert.equal(fs.existsSync(path.join(root, "catalogs.search.js")), false);
assert.match(compiler, /LEGACY_SEARCH_JSON_FILE = "catalogs\.search\.json"/);
assert.match(compiler, /LEGACY_SEARCH_JS_FILE = "catalogs\.search\.js"/);
const normalizedSearchIndex = JSON.parse(fs.readFileSync(path.join(root, "catalogs.search-index.json"), "utf8"));
assert.equal(normalizedSearchIndex.version, 1);
assert.equal(normalizedSearchIndex.documents.length, normalizedSearchIndex.stats.pages);
assert.ok(normalizedSearchIndex.stats.tokens > 0);

console.log("catalog_compiler_contract.test.js: PASS");
