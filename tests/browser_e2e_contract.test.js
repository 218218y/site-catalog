"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageLock = fs.readFileSync(path.join(root, "package-lock.json"), "utf8");
const config = fs.readFileSync(path.join(root, "playwright.config.js"), "utf8");
const vm = require("node:vm");
const configModule = { exports: {} };
vm.runInNewContext(config, {
  require(request) {
    if (request === "node:fs") return fs;
    if (request === "@playwright/test") return { defineConfig: (value) => value };
    throw new Error(`Unexpected playwright config dependency: ${request}`);
  },
  module: configModule,
  exports: configModule.exports,
  process: { env: {} }
}, { filename: "playwright.config.js" });
const playwrightConfig = configModule.exports;
const spec = fs.readFileSync(path.join(root, "tests", "e2e", "site-catalog.spec.js"), "utf8");
const visualSpec = fs.readFileSync(path.join(root, "tests", "e2e", "visual-components.spec.js"), "utf8");
const verifier = fs.readFileSync(path.join(root, "tools", "verify_project.py"), "utf8");
const prepublishGate = fs.readFileSync(path.join(root, "docs", "prepublish-quality-gate.md"), "utf8");

function pngDimensions(relativePath) {
  const buffer = fs.readFileSync(path.join(root, relativePath));
  assert.equal(buffer.toString("ascii", 1, 4), "PNG", `${relativePath} must be a PNG file`);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

assert.match(packageJson.devDependencies?.["@playwright/test"] || "", /^\^?1\./);
assert.equal(packageJson.scripts["setup:browsers"], "playwright install chromium");
assert.equal(packageJson.scripts["test:e2e"], "playwright test");
assert.equal(packageJson.scripts["test:e2e:update"], "node tools/update_visual_snapshots.js");
assert.equal(packageJson.scripts["pretest:e2e:update"], "node tools/check_playwright_browser.js");
assert.doesNotMatch(packageLock, /applied-caas-gateway|internal\.api\.openai/i);
assert.equal(packageJson.scripts["test:js"], "node tools/run_project_python.js --system tools/verify_project.py --javascript-only");
assert.equal(packageJson.scripts["test:python"], "node tools/run_project_python.js tools/verify_project.py --python-only");
assert.equal(packageJson.scripts.build, "npm run build:local");

assert.match(config, /webServer/);
assert.equal(packageJson.scripts["build:e2e"], "node tools/run_project_python.js tools/build_deploy_bundle.py --out dist/site-local --seo-mode private --skip-if-current --clean-legacy-artifacts");
assert.match(config, /npm run build:e2e/);
assert.match(config, /--root dist\/site-local/);
assert.doesNotMatch(config, /dist\/site-e2e/);
assert.match(
  fs.readFileSync(path.join(root, "tools", "e2e_server.js"), "utf8"),
  /DEFAULT_ROOT = path\.join\(PROJECT_ROOT, "dist", "site-local"\)/
);
assert.ok(playwrightConfig.webServer.timeout >= 180_000, "A first or stale shared E2E site build needs a Windows-safe startup timeout");
assert.match(config, /tests\/e2e/);
assert.match(config, /trace:\s*"retain-on-failure"/);
assert.match(config, /toHaveScreenshot/);
assert.match(spec, /opens a catalog and moves forward and backward/);
assert.match(spec, /opens the catalog preview and launches the selected page/);
assert.match(spec, /searches the OCR index/);
assert.match(spec, /keeps worker search responsive under 4x CPU slowdown and renders only the latest query/);
assert.match(spec, /reports memory-only favorites honestly when local storage is blocked/);
assert.match(spec, /completes a search and viewer journey using the keyboard only/);
assert.match(spec, /opens the largest real catalog and reaches its final page/);
assert.match(spec, /keeps LCP, INP, and CLS within the mobile 4x CPU budgets/);
assert.match(spec, /stops an active control-panel job and restores its transaction after reload/);
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
assert.match(spec, /Emulation\.setCPUThrottlingRate/);
assert.match(spec, /__BARGIG_ENABLE_VITALS_DIAGNOSTICS__/);
assert.match(spec, /enableTelemetry: Boolean\(telemetryEvents\) \|\| enableVitalsDiagnostics/);
assert.match(spec, /viewerOnboardingSkip/);
assert.match(spec, /blockLocalStorage/);
assert.match(visualSpec, /home catalog row preserves hierarchy and spacing/);
assert.match(visualSpec, /inquiry dialog retains the light visual system/);
assert.match(visualSpec, /favorites cards retain selection notes and ordering controls/);
assert.match(visualSpec, /viewer image error remains clear and actionable/);
assert.match(visualSpec, /COMPARE_CANONICAL_SCREENSHOTS/);
assert.match(visualSpec, /PLAYWRIGHT_VISUAL_BASELINE/);
assert.match(visualSpec, /expectVisualComponent/);
assert.match(visualSpec, /toHaveScreenshot/);
assert.match(verifier, /Playwright browser journeys/);
assert.match(prepublishGate, /סקירה חזותית ידנית על מכשירים אמיתיים/);
assert.match(prepublishGate, /LCP[\s\S]*INP[\s\S]*CLS/);
assert.match(prepublishGate, /אחסון חסום/);

for (const relative of [
  "tools/e2e_server.js",
  "tools/check_playwright_browser.js",
  "tools/update_visual_snapshots.js",
  "tests/e2e/__screenshots__/catalog-card.png",
  "tests/e2e/__screenshots__/viewer-stage.png",
  "tests/e2e/__screenshots__/home-catalog-row.png",
  "tests/e2e/__screenshots__/inquiry-dialog.png",
  "tests/e2e/__screenshots__/favorites-workspace.png",
  "tests/e2e/__screenshots__/viewer-image-error.png"
]) {
  assert.equal(fs.existsSync(path.join(root, relative)), true, `Missing ${relative}`);
}

// A stale pixel baseline with a different width cannot ever satisfy the visual
// fixture contract. Keep this cheap check platform-independent so Windows runs
// catch baseline drift before Linux CI performs the canonical pixel comparison.
assert.equal(
  pngDimensions("tests/e2e/__screenshots__/favorites-workspace.png").width,
  1120,
  "favorites workspace baseline must match VISUAL_FIXTURE_MAX_WIDTH"
);

console.log("browser_e2e_contract.test.js: PASS");
