"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const supportedPlaywrightVersion = "1.61.1";
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
const nodeInstallCheck = fs.readFileSync(path.join(root, "tools", "check_node_install_scripts.js"), "utf8");
const requirements = fs.readFileSync(path.join(root, "tools", "requirements.txt"), "utf8");
const devRequirements = fs.readFileSync(path.join(root, "tools", "requirements-dev.txt"), "utf8");
const bundleSite = readLauncher(windowsLaunchers.bundleSite);
const cleanArtifactsBat = readLauncher(windowsLaunchers.cleanArtifacts);
const uploadSite = readLauncher(windowsLaunchers.uploadSite);
const ciWorkflow = fs.readFileSync(path.join(root, ".github", "workflows", "ci.yml"), "utf8");
const controlPanel = fs.readFileSync(path.join(root, "catalog-control-panel.html"), "utf8");
const controlPanelJobs = fs.readFileSync(path.join(root, "src", "control-panel", "features", "jobs.js"), "utf8");
const controlPanelApi = fs.readFileSync(path.join(root, "src", "control-panel", "core", "api.js"), "utf8");
const controlServer = fs.readFileSync(path.join(root, "tools", "catalog_control_server.py"), "utf8");
const projectTasks = fs.readFileSync(path.join(root, "tools", "project_tasks.js"), "utf8");
const pythonLauncher = fs.readFileSync(path.join(root, "tools", "run_project_python.js"), "utf8");
const linuxLauncher = fs.readFileSync(path.join(root, "site.sh"), "utf8");
const linuxSetup = fs.readFileSync(path.join(root, "setup-linux.sh"), "utf8");
const linuxDocs = fs.readFileSync(path.join(root, "docs", "linux-development.md"), "utf8");

assert.equal(packageJson.private, true);
assert.equal(packageJson.scripts["setup:python"], "node tools/run_project_python.js --system tools/setup_python_env.py");
assert.equal(packageJson.scripts["setup:browsers"], "playwright install chromium");
assert.equal(packageJson.scripts["setup:browsers:linux"], "playwright install --with-deps chromium");
assert.equal(packageJson.scripts.build, "npm run build:local");
assert.match(packageJson.scripts["build:local"], /--out dist\/site-upload-r2/);
assert.match(packageJson.scripts["build:local"], /--skip-if-current/);
assert.match(packageJson.scripts["build:local"], /--mirror-to dist\/site-local/);
assert.equal(packageJson.scripts.dev, "node tools/run_project_python.js tools/serve_site.py");
assert.equal(packageJson.scripts.serve, "node tools/run_project_python.js tools/serve_site.py");
assert.equal(packageJson.scripts["dev:check"], "node tools/run_project_python.js tools/serve_site.py --ensure-current ask");
assert.equal(packageJson.devDependencies["@playwright/test"], supportedPlaywrightVersion);
assert.equal(packageJson.devDependencies.wrangler, "4.112.0");
assert.equal(packageJson.scripts.postinstall, "node tools/check_node_install_scripts.js");
assert.equal(packageJson.scripts["check:node-tools"], "node tools/check_node_install_scripts.js");
assert.deepEqual(packageJson.allowScripts, {
  esbuild: true,
  sharp: true,
  workerd: true,
});
const lockfile = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
assert.equal(lockfile.packages[""].devDependencies["@playwright/test"], supportedPlaywrightVersion);
assert.equal(lockfile.packages["node_modules/@playwright/test"].version, supportedPlaywrightVersion);
assert.equal(lockfile.packages["node_modules/@playwright/test"].dependencies.playwright, supportedPlaywrightVersion);
assert.equal(lockfile.packages["node_modules/playwright"].version, supportedPlaywrightVersion);
assert.equal(lockfile.packages["node_modules/playwright"].dependencies["playwright-core"], supportedPlaywrightVersion);
assert.equal(lockfile.packages["node_modules/playwright-core"].version, supportedPlaywrightVersion);
assert.equal(lockfile.packages[""].devDependencies.wrangler, "4.112.0");
assert.equal(lockfile.packages["node_modules/esbuild"].version, "0.28.1");
assert.equal(lockfile.packages["node_modules/sharp"].version, "0.34.5");
assert.equal(lockfile.packages["node_modules/workerd"].version, "1.20260714.1");
assert.equal(fs.readFileSync(path.join(root, ".npmrc"), "utf8").trim(), "save-exact=true");
assert.equal(fs.readFileSync(path.join(root, ".nvmrc"), "utf8").trim(), "24.18.0");
assert.equal(fs.existsSync(path.join(root, "tools", "check_node_install_scripts.js")), true);
assert.match(nodeInstallCheck, /spawnSync\(process\.execPath, \[wranglerCli, "--version"\]/);
assert.match(nodeInstallCheck, /shell: false/);
assert.doesNotMatch(nodeInstallCheck, /path\.join\(root, "node_modules", "\.bin"|shell: process\.platform/);
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
assert.match(startServer, /node tools\\project_tasks\.js server %\*/);
assert.doesNotMatch(startServer, /--ensure-current|--build-first/);
assert.match(checkedStartServer, /node tools\\project_tasks\.js server-check %\*/);
assert.doesNotMatch(startServer, /catalog-control-panel/);
assert.doesNotMatch(startServer, /build_deploy_bundle/);
assert.doesNotMatch(startServer, /python -m http\.server/);
assert.match(bundleSite, /node tools\\project_tasks\.js bundle-site-r2 %\*/);
assert.doesNotMatch(bundleSite, /build_deploy_bundle|verify_r2_catalog_sync_state/);
assert.match(projectTasks, /"--clean-legacy-artifacts"/);
assert.match(projectTasks, /tools\/clean_project_artifacts\.py/);
assert.match(cleanArtifactsBat, /node tools\\project_tasks\.js clean %\*/);
assert.match(uploadSite, /node tools\\project_tasks\.js deploy-cloudflare %\*/);
assert.doesNotMatch(uploadSite, /--build-first/);
assert.doesNotMatch(uploadSite, /build_deploy_bundle/);
assert.equal(packageJson.scripts["test:js"], "node tools/run_project_python.js tools/verify_project.py --javascript-only");
assert.equal(packageJson.scripts["test:python"], "node tools/run_project_python.js tools/verify_project.py --python-only");
assert.equal(packageJson.scripts["test:e2e"], "playwright test");
assert.equal(packageJson.scripts.pretest, "node tools/run_project_python.js --system tools/setup_python_env.py --quiet");
assert.equal(packageJson.scripts.test, "node tools/run_project_python.js tools/verify_project.py --quick");
assert.match(packageJson.scripts.preverify, /check_playwright_browser\.js/);
assert.equal(packageJson.scripts.verify, "node tools/run_project_python.js tools/verify_project.py");
assert.equal(packageJson.scripts["check:seo-routes"], "node tools/run_project_python.js tools/seo_route_lock.py --check");
assert.equal(packageJson.scripts["seo:routes:update"], "node tools/run_project_python.js tools/seo_route_lock.py --update");
assert.equal(packageJson.scripts["verify:seo:public"], "node tools/run_project_python.js tools/verify_public_seo.py --out dist/site-public-preview --clean-legacy-artifacts");
assert.match(packageJson.scripts["verify:seo:public:full"], /--force-audit/);
assert.match(packageJson.scripts["verify:seo:public:rebuild"], /--force-rebuild/);
assert.match(packageJson.scripts["build:deploy:public"], /verify_public_seo\.py/);
assert.match(packageJson.scripts["build:deploy:public"], /--mirror-to dist\/site-upload-r2/);
assert.match(packageJson.scripts["build:deploy:public"], /--mirror-to dist\/site-local/);
assert.equal(packageJson.scripts["verify:seo:live"], "node tools/run_project_python.js tools/audit_public_seo.py --live");
assert.match(builder, /def validate_js_spec/);
assert.match(builder, /CAPABILITY_BOUNDARIES/);
assert.match(builder, /Disabled capability/);
assert.match(builder, /ESBUILD_RUNNER/);
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
assert.match(ciWorkflow, /Run complete verification[\s\S]*npm run verify/);
assert.match(ciWorkflow, /Upload public SEO preview[\s\S]*dist\/site-public-preview\//);
assert.equal(fs.existsSync(path.join(root, "seo-routes.lock.json")), true);
assert.equal(fs.existsSync(path.join(root, "tools", "audit_public_seo.py")), true);
assert.equal(fs.existsSync(path.join(root, "tools", "verify_public_seo.py")), true);
assert.equal(fs.existsSync(path.join(root, "tools", "run_with_project_python.py")), true);
assert.match(verifier, /sys\.dont_write_bytecode = True/);
assert.match(verifier, /PYTHONDONTWRITEBYTECODE/);
assert.match(architecture, /אין לפצל מודול רק בגלל מספר השורות/);
assert.match(controlPanel, /id="cancelJob"/);
assert.match(controlPanelJobs, /function cancelActiveJob/);
assert.match(controlPanelJobs, /controlApi\.cancelJob\(activeJobId\)/);
assert.match(controlPanelApi, /`\/api\/jobs\/\$\{encodeURIComponent\(jobId\)\}\/cancel`/);
assert.match(controlServer, /def cancel_job\(/);
assert.match(controlServer, /cancel_requested/);
assert.match(controlServer, /_recover_after_canceled_job/);
assert.match(controlServer, /BARGIG_CONTROL_E2E/);
assert.equal(fs.existsSync(path.join(root, "tests", "fixtures", "control_panel_interruptible_job.py")), true);

assert.equal(fs.existsSync(path.join(root, "tools", "project_tasks.js")), true);
assert.equal(fs.existsSync(path.join(root, "tools", "run_project_python.js")), true);
assert.equal(fs.existsSync(path.join(root, "site.sh")), true);
assert.equal(fs.existsSync(path.join(root, "setup-linux.sh")), true);
assert.equal(fs.existsSync(path.join(root, "docs", "linux-development.md")), true);
assert.match(linuxLauncher, /exec node tools\/project_tasks\.js "\$@"/);
assert.match(linuxSetup, /exec "\$SCRIPT_DIR\/site\.sh" setup "\$@"/);
assert.match(projectTasks, /const TASKS = Object\.freeze/);
assert.match(projectTasks, /case "bundle-site-r2":/);
assert.match(projectTasks, /case "deploy-cloudflare":/);
assert.match(projectTasks, /runPython\("tools\/verify_r2_catalog_sync_state\.py"/);
assert.match(projectTasks, /runPython\("tools\/build_deploy_bundle\.py"/);
assert.match(projectTasks, /runPython\("tools\/deploy_cloudflare_pages\.py"/);
assert.match(pythonLauncher, /Python 3 interpreter/);
assert.match(pythonLauncher, /tools\/run_with_project_python\.py/);
assert.match(pythonLauncher, /shell: false/);
assert.match(pythonLauncher, /PYTHONDONTWRITEBYTECODE/);
assert.match(linuxDocs, /אין צורך להריץ `source \.venv\/bin\/activate`/);
assert.match(linuxDocs, /\.\/site\.sh deploy-cloudflare --preview-branch test-name/);
assert.equal(packageJson.scripts.tasks, "node tools/project_tasks.js");
assert.equal(packageJson.scripts["catalogs:convert"], "node tools/project_tasks.js convert-catalogs");
assert.equal(packageJson.scripts["site:bundle:r2"], "node tools/project_tasks.js bundle-site-r2");
for (const [name, command] of Object.entries(packageJson.scripts)) {
  assert.doesNotMatch(command, /^python(?:3)?\s/u, `${name} must use the cross-platform Python launcher`);
}
for (const [taskName, launcherName] of Object.entries({
  "bundle-site-r2": windowsLaunchers.bundleSite,
  "deploy-cloudflare": windowsLaunchers.uploadSite,
  clean: windowsLaunchers.cleanArtifacts,
  "server-check": windowsLaunchers.checkedStartServer,
  "control-panel": windowsLaunchers.catalogControlPanel,
  server: windowsLaunchers.startServer,
  "r2-preview": windowsLaunchers.previewR2Sync,
  "r2-sync": windowsLaunchers.syncR2Images,
  "convert-catalogs": windowsLaunchers.convertCatalogs,
  "convert-catalogs-force": windowsLaunchers.convertCatalogsForce,
  "refresh-ocr-search": windowsLaunchers.refreshOcrSearch,
  setup: windowsLaunchers.setupWindows,
  "telemetry-report": windowsLaunchers.telemetryReport,
  "configure-r2-cors": windowsLaunchers.configureR2Cors,
  "sync-catalog-pdfs": windowsLaunchers.syncCatalogPdfs,
})) {
  const source = readLauncher(launcherName);
  assert.equal(
    source.includes(`node tools\\project_tasks.js ${taskName} %*`),
    true,
    `${launcherName} must delegate to ${taskName}`,
  );
  assert.doesNotMatch(source, /activate\.bat|\.venv\\Scripts|py -3|python tools\\/i);
}

assert.equal(fs.existsSync(path.join(root, "wp_logo_data.js")), false);
assert.equal(fs.existsSync(path.join(root, "brand-logo.js")), false);
for (const duplicate of ["social-share-default(2).png", "social-share-default(3).png", "social-share-default(4).png"]) {
  assert.equal(fs.existsSync(path.join(root, duplicate)), false, duplicate);
}

console.log("project_maintenance_contract.test.js: PASS");
