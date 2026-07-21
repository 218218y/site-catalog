"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const windowsLaunchers = Object.freeze({
  bundleSite: ".01-bundle-site-r2.bat",
  convertCatalogsForce: ".011-convert-catalogs-force.bat",
  refreshOcrSearch: ".012-refresh-ocr-search.bat",
  uploadSite: ".02-bundle-site-r2-upload cloudflare.bat",
  cleanArtifacts: ".020-clean-project-artifacts.bat",
  checkedStartServer: ".03-check-and-start-server.bat",
  catalogControlPanel: ".04-catalog-control-panel.bat",
  startServer: ".05-start-server.bat",
  previewR2Sync: ".06-sync-r2-images-preview.bat",
  syncR2Images: ".07-sync-r2-images.bat",
  convertCatalogs: ".10-convert-catalogs.bat",
  setupWindows: ".20-setup-windows.bat",
  telemetryReport: ".20-telemetry-report.bat",
  configureR2Cors: "configure-r2-cors.bat",
  syncCatalogPdfs: "sync-catalog-pdfs.bat",
});

const launcherNames = Object.values(windowsLaunchers);
assert.equal(new Set(launcherNames).size, launcherNames.length, "Windows launcher names must be unique");
for (const launcherName of launcherNames) {
  assert.equal(fs.existsSync(path.join(root, launcherName)), true, `Missing Windows launcher: ${launcherName}`);
}

const readLauncher = (launcherName) => fs.readFileSync(path.join(root, launcherName), "utf8");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const builder = fs.readFileSync(path.join(root, "tools", "build_frontend_assets.py"), "utf8");
const verifier = fs.readFileSync(path.join(root, "tools", "verify_project.py"), "utf8");
const architecture = fs.readFileSync(path.join(root, "docs", "frontend-architecture.md"), "utf8");
const localServer = fs.readFileSync(path.join(root, "tools", "serve_site.py"), "utf8");
const startServer = readLauncher(windowsLaunchers.startServer);
const checkedStartServer = readLauncher(windowsLaunchers.checkedStartServer);
const deployTool = fs.readFileSync(path.join(root, "tools", "deploy_cloudflare_pages.py"), "utf8");
const requirements = fs.readFileSync(path.join(root, "tools", "requirements.txt"), "utf8");
const devRequirements = fs.readFileSync(path.join(root, "tools", "requirements-dev.txt"), "utf8");
const bundleSite = readLauncher(windowsLaunchers.bundleSite);
const cleanArtifactsBat = readLauncher(windowsLaunchers.cleanArtifacts);
const uploadSite = readLauncher(windowsLaunchers.uploadSite);
const ciWorkflow = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");

assert.equal(packageJson.private, true);
assert.equal(packageJson.scripts["setup:python"], "python tools/setup_python_env.py");
assert.equal(packageJson.scripts["setup:browsers"], "playwright install chromium");
assert.equal(packageJson.scripts.build, "npm run build:local");
assert.match(packageJson.scripts["build:local"], /--out dist\/site-upload-r2/);
assert.match(packageJson.scripts["build:local"], /--skip-if-current/);
assert.match(packageJson.scripts["build:local"], /--mirror-to dist\/site-local/);
assert.equal(packageJson.scripts.dev, "python tools/serve_site.py");
assert.equal(packageJson.scripts.serve, "python tools/serve_site.py");
assert.equal(packageJson.scripts["dev:check"], "python tools/serve_site.py --ensure-current ask");
assert.equal(packageJson.devDependencies["@playwright/test"], "1.55.1");
assert.equal(packageJson.devDependencies.wrangler, "4.112.0");
assert.equal(packageJson.scripts.postinstall, "node tools/check_node_install_scripts.js");
assert.equal(packageJson.scripts["check:node-tools"], "node tools/check_node_install_scripts.js");
assert.deepEqual(packageJson.allowScripts, {
  esbuild: true,
  sharp: true,
  workerd: true,
});
const lockfile = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
assert.equal(lockfile.packages[""].devDependencies.wrangler, "4.112.0");
assert.equal(lockfile.packages["node_modules/esbuild"].version, "0.28.1");
assert.equal(lockfile.packages["node_modules/sharp"].version, "0.34.5");
assert.equal(lockfile.packages["node_modules/workerd"].version, "1.20260714.1");
assert.equal(fs.readFileSync(path.join(root, ".npmrc"), "utf8").trim(), "save-exact=true");
assert.equal(fs.readFileSync(path.join(root, ".nvmrc"), "utf8").trim(), "24.18.0");
assert.equal(fs.existsSync(path.join(root, "tools", "check_node_install_scripts.js")), true);
assert.match(deployTool, /def find_local_wrangler\(/);
assert.doesNotMatch(deployTool, /def find_npx\(|npx was not found|--yes[\s\S]{0,40}wrangler/);
assert.match(requirements, /^PyMuPDF==1\.28\.0$/m);
assert.match(requirements, /^Pillow==12\.3\.0$/m);
assert.match(devRequirements, /^pytest==9\.1\.1$/m);
assert.match(devRequirements, /^iniconfig==2\.3\.0$/m);
assert.match(devRequirements, /^packaging==26\.2$/m);
assert.match(devRequirements, /^pluggy==1\.6\.0$/m);
assert.match(devRequirements, /^Pygments==2\.20\.0$/m);
assert.match(devRequirements, /^colorama==0\.4\.6; sys_platform == "win32"$/m);
assert.match(localServer, /--build-first/);
assert.match(localServer, /--ensure-current/);
assert.match(localServer, /dist\/site-local/);
assert.match(startServer, /tools\\serve_site\.py --port 8080/);
assert.doesNotMatch(startServer, /--ensure-current|--build-first/);
assert.match(checkedStartServer, /tools\\serve_site\.py --port 8080 --ensure-current ask/);
assert.doesNotMatch(startServer, /catalog-control-panel/);
assert.doesNotMatch(startServer, /build_deploy_bundle/);
assert.doesNotMatch(startServer, /python -m http\.server/);
assert.match(bundleSite, /--skip-if-current/);
assert.match(bundleSite, /--mirror-to dist\/site-local/);
assert.match(bundleSite, /--clean-legacy-artifacts/);
assert.match(bundleSite, /tools\\clean_project_artifacts\.py/);
assert.match(cleanArtifactsBat, /tools\\clean_project_artifacts\.py/);
assert.match(uploadSite, /deploy_cloudflare_pages\.py/);
assert.doesNotMatch(uploadSite, /--build-first/);
assert.doesNotMatch(uploadSite, /build_deploy_bundle/);
assert.equal(packageJson.scripts["test:js"], "python tools/verify_project.py --javascript-only");
assert.equal(packageJson.scripts["test:python"], "python tools/verify_project.py --python-only");
assert.equal(packageJson.scripts["test:e2e"], "playwright test");
assert.equal(packageJson.scripts.pretest, "python tools/setup_python_env.py --quiet");
assert.equal(packageJson.scripts.test, "python tools/verify_project.py --quick");
assert.match(packageJson.scripts.preverify, /check_playwright_browser\.js/);
assert.equal(packageJson.scripts.verify, "python tools/verify_project.py");
assert.equal(packageJson.scripts["check:seo-routes"], "python tools/seo_route_lock.py --check");
assert.equal(packageJson.scripts["seo:routes:update"], "python tools/seo_route_lock.py --update");
assert.equal(packageJson.scripts["verify:seo:public"], "python tools/run_with_project_python.py tools/verify_public_seo.py --out .artifacts/public-seo-preview");
assert.equal(packageJson.scripts["verify:seo:live"], "python tools/run_with_project_python.py tools/audit_public_seo.py --live");
assert.match(builder, /def validate_js_module_boundaries/);
assert.match(builder, /Duplicate top-level JavaScript declaration/);
assert.match(verifier, /discover_javascript_tests/);
assert.match(verifier, /resolve_project_python/);
assert.match(verifier, /npm run setup:python/);
assert.match(verifier, /build_deploy_bundle\.py/);
assert.match(verifier, /build_site_pages\.py/);
assert.match(verifier, /Playwright browser journeys/);
assert.equal(fs.existsSync(path.join(root, "tools", "requirements-dev.txt")), true);
assert.equal(fs.existsSync(path.join(root, "tools", "clean_project_artifacts.py")), true);
assert.match(ciWorkflow, /PYTHONDONTWRITEBYTECODE: "1"/);
assert.match(ciWorkflow, /node-version-file: \.nvmrc/);
assert.match(ciWorkflow, /Remove ephemeral source artifacts[\s\S]*clean_project_artifacts\.py(?! --check)/);
assert.match(ciWorkflow, /Verify tests left no source-tree caches[\s\S]*clean_project_artifacts\.py --check/);
assert.match(ciWorkflow, /Build and audit guarded public SEO preview[\s\S]*npm run verify:seo:public/);
assert.match(ciWorkflow, /Upload public SEO preview[\s\S]*public-seo-preview/);
assert.equal(fs.existsSync(path.join(root, "seo-routes.lock.json")), true);
assert.equal(fs.existsSync(path.join(root, "tools", "audit_public_seo.py")), true);
assert.equal(fs.existsSync(path.join(root, "tools", "verify_public_seo.py")), true);
assert.equal(fs.existsSync(path.join(root, "tools", "run_with_project_python.py")), true);
assert.match(verifier, /sys\.dont_write_bytecode = True/);
assert.match(verifier, /PYTHONDONTWRITEBYTECODE/);
assert.match(architecture, /אין לפצל מודול רק בגלל מספר השורות/);

assert.equal(fs.existsSync(path.join(root, "wp_logo_data.js")), false);
assert.equal(fs.existsSync(path.join(root, "brand-logo.js")), false);
for (const duplicate of ["social-share-default(2).png", "social-share-default(3).png", "social-share-default(4).png"]) {
  assert.equal(fs.existsSync(path.join(root, duplicate)), false, duplicate);
}

console.log("project_maintenance_contract.test.js: PASS");
