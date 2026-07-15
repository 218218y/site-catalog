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
assert.equal(packageJson.scripts["setup:python"], "python tools/setup_python_env.py");
assert.equal(packageJson.scripts["setup:browsers"], "playwright install chromium");
assert.equal(packageJson.scripts.build, "python tools/build_site_pages.py");
assert.equal(packageJson.scripts["test:js"], "python tools/verify_project.py --javascript-only");
assert.equal(packageJson.scripts["test:python"], "python tools/verify_project.py --python-only");
assert.equal(packageJson.scripts["test:e2e"], "playwright test");
assert.equal(packageJson.scripts.pretest, "python tools/setup_python_env.py --quiet");
assert.equal(packageJson.scripts.test, "python tools/verify_project.py --quick");
assert.match(packageJson.scripts.preverify, /check_playwright_browser\.js/);
assert.equal(packageJson.scripts.verify, "python tools/verify_project.py");
assert.match(builder, /def validate_js_module_boundaries/);
assert.match(builder, /Duplicate top-level JavaScript declaration/);
assert.match(verifier, /discover_javascript_tests/);
assert.match(verifier, /resolve_project_python/);
assert.match(verifier, /npm run setup:python/);
assert.match(verifier, /build_deploy_bundle\.py/);
assert.match(verifier, /build_site_pages\.py/);
assert.match(verifier, /Playwright browser journeys/);
assert.equal(fs.existsSync(path.join(root, "tools", "requirements-dev.txt")), true);
assert.match(architecture, /אין לפצל מודול רק בגלל מספר השורות/);

assert.equal(fs.existsSync(path.join(root, "wp_logo_data.js")), false);
assert.equal(fs.existsSync(path.join(root, "brand-logo.js")), false);

console.log("project_maintenance_contract.test.js: PASS");
