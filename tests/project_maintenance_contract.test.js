"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const builder = fs.readFileSync(path.join(root, "tools", "build_frontend_assets.py"), "utf8");
const verifier = fs.readFileSync(path.join(root, "tools", "verify_project.py"), "utf8");
const architecture = fs.readFileSync(path.join(root, "docs", "frontend-architecture.md"), "utf8");

assert.equal(packageJson.private, true);
assert.equal(packageJson.scripts.test, "python tools/verify_project.py --quick");
assert.equal(packageJson.scripts.verify, "python tools/verify_project.py");
assert.match(builder, /def validate_js_module_boundaries/);
assert.match(builder, /Duplicate top-level JavaScript declaration/);
assert.match(verifier, /discover_javascript_tests/);
assert.match(verifier, /build_deploy_bundle\.py/);
assert.match(architecture, /אין לפצל מודול רק בגלל מספר השורות/);

assert.equal(fs.existsSync(path.join(root, "wp_logo_data.js")), false);
assert.equal(fs.existsSync(path.join(root, "brand-logo.js")), false);

console.log("project_maintenance_contract.test.js: PASS");
