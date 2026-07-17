"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageLock = fs.readFileSync(path.join(root, "package-lock.json"), "utf8");
const config = fs.readFileSync(path.join(root, "playwright.config.js"), "utf8");
const spec = fs.readFileSync(path.join(root, "tests", "e2e", "site-catalog.spec.js"), "utf8");
const verifier = fs.readFileSync(path.join(root, "tools", "verify_project.py"), "utf8");

assert.match(packageJson.devDependencies?.["@playwright/test"] || "", /^\^?1\./);
assert.equal(packageJson.scripts["setup:browsers"], "playwright install chromium");
assert.equal(packageJson.scripts["test:e2e"], "playwright test");
assert.equal(packageJson.scripts["test:e2e:update"], "playwright test --update-snapshots");
assert.equal(packageJson.scripts["pretest:e2e:update"], "node tools/check_playwright_browser.js");
assert.doesNotMatch(packageLock, /applied-caas-gateway|internal\.api\.openai/i);
assert.equal(packageJson.scripts["test:js"], "python tools/verify_project.py --javascript-only");
assert.equal(packageJson.scripts["test:python"], "python tools/verify_project.py --python-only");
assert.equal(packageJson.scripts.build, "python tools/build_site_pages.py");

assert.match(config, /webServer/);
assert.match(config, /tests\/e2e/);
assert.match(config, /trace:\s*"retain-on-failure"/);
assert.match(config, /toHaveScreenshot/);
assert.match(spec, /opens a catalog and moves forward and backward/);
assert.match(spec, /opens the catalog preview and launches the selected page/);
assert.match(spec, /searches the OCR index/);
assert.match(spec, /persists a favorite through reload/);
assert.match(spec, /shares favorites to a clean browser context/);
assert.match(spec, /first-run viewer tour once/);
assert.match(spec, /shares the exact page/);
assert.match(spec, /offers direct Gmail, system sharing, email, and copying/);
assert.match(spec, /events\.filter\(\(event\) => event\.name === "search"\)\)\.toHaveLength\(0\)/);
assert.match(spec, /completedSearch\.action\)\.toBe\("result-open"\)/);
assert.match(spec, /#viewerMobileMoreToggle/);
assert.match(spec, /#viewerMobileMoreMenu/);
assert.match(spec, /fullscreen-safe in-document navigation/);
assert.match(spec, /keyboard navigation/);
assert.match(spec, /catalog image fails/);
assert.match(spec, /mobile home and viewer survive portrait and landscape orientation/);
assert.match(spec, /monitorRuntimeErrors/);
assert.match(spec, /privacy-safe operational telemetry/);
assert.match(spec, /restrictive security policy/);
assert.match(spec, /content security policy/);
assert.match(spec, /CATALOG_PAGES/);
assert.match(spec, /CATALOG_COUNT/);
assert.match(spec, /toHaveScreenshot/);
assert.match(verifier, /Playwright browser journeys/);

for (const relative of [
  "tools/e2e_server.js",
  "tools/check_playwright_browser.js",
  "tests/e2e/__screenshots__/catalog-card.png",
  "tests/e2e/__screenshots__/viewer-stage.png"
]) {
  assert.equal(fs.existsSync(path.join(root, relative)), true, `Missing ${relative}`);
}

console.log("browser_e2e_contract.test.js: PASS");
