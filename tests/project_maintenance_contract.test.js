"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const exactNpmVersion = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
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
const lockfile = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const builder = fs.readFileSync(path.join(root, "tools", "build_frontend_assets.py"), "utf8");
const verifier = fs.readFileSync(path.join(root, "tools", "verify_project.py"), "utf8");
const architecture = fs.readFileSync(path.join(root, "docs", "frontend-architecture.md"), "utf8");
const localServer = fs.readFileSync(path.join(root, "tools", "serve_site.py"), "utf8");
const startServer = readLauncher(windowsLaunchers.startServer);
const checkedStartServer = readLauncher(windowsLaunchers.checkedStartServer);
const deployTool = fs.readFileSync(path.join(root, "tools", "deploy_cloudflare_pages.py"), "utf8");
const nodeInstallCheck = fs.readFileSync(path.join(root, "tools", "check_node_install_scripts.js"), "utf8");
const npmOffline = fs.readFileSync(path.join(root, "tools", "npm_offline_linux.py"), "utf8");
const npmOfflineSync = fs.readFileSync(path.join(root, "tools", "sync_npm_offline_linux.py"), "utf8");
const npmOfflineBootstrap = fs.readFileSync(path.join(root, "tools", "bootstrap_npm_offline_linux.py"), "utf8");
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
const linuxOcrSetup = fs.readFileSync(path.join(root, "tools", "setup_linux_ocr.js"), "utf8");
const pythonLauncher = fs.readFileSync(path.join(root, "tools", "run_project_python.js"), "utf8");
const pythonBaseline = fs.readFileSync(path.join(root, ".python-version"), "utf8").trim();
const pyproject = fs.readFileSync(path.join(root, "pyproject.toml"), "utf8");
const linuxLauncher = fs.readFileSync(path.join(root, "site.sh"), "utf8");
const linuxSetup = fs.readFileSync(path.join(root, "setup-linux.sh"), "utf8");
const linuxDocs = fs.readFileSync(path.join(root, "docs", "linux-development.md"), "utf8");

assert.equal(packageJson.private, true);
assert.equal(packageJson.scripts["setup:python"], "node tools/run_project_python.js --system tools/setup_python_env.py");
assert.equal(packageJson.scripts["update:python:offline:linux"], "node tools/run_project_python.js --system tools/sync_python_offline_linux.py");
assert.equal(packageJson.scripts["check:python:offline:linux"], "node tools/run_project_python.js --system tools/sync_python_offline_linux.py --check");
assert.equal(packageJson.scripts["setup:python:offline:linux"], "node tools/run_project_python.js --system tools/setup_python_env.py --offline");
assert.equal(packageJson.scripts["setup:browsers"], "playwright install chromium");
assert.equal(packageJson.scripts["update:offline:linux"], "node tools/run_project_python.js --system tools/sync_npm_offline_linux.py");
assert.equal(packageJson.scripts["check:offline:linux"], "node tools/run_project_python.js --system tools/sync_npm_offline_linux.py --check");
assert.equal(packageJson.scripts["setup:npm:offline:linux"], "node tools/run_project_python.js --system tools/bootstrap_npm_offline_linux.py");
assert.equal(packageJson.scripts["check:npm:offline:linux"], "node tools/run_project_python.js --system tools/bootstrap_npm_offline_linux.py --check");
assert.equal(packageJson.scripts["setup:browsers:linux"], "playwright install --with-deps chromium");
assert.equal(packageJson.scripts.build, "npm run build:local");
assert.match(packageJson.scripts["build:local"], /--out dist\/site-upload-r2/);
assert.match(packageJson.scripts["build:local"], /--skip-if-current/);
assert.match(packageJson.scripts["build:local"], /--mirror-to dist\/site-local/);
assert.equal(packageJson.scripts.dev, "node tools/run_project_python.js tools/serve_site.py");
assert.equal(packageJson.scripts.serve, "node tools/run_project_python.js tools/serve_site.py");
assert.equal(packageJson.scripts["dev:check"], "node tools/run_project_python.js tools/serve_site.py --ensure-current ask");
assert.equal(packageJson.scripts.postinstall, "node tools/check_node_install_scripts.js");
assert.equal(packageJson.scripts["check:node-tools"], "node tools/check_node_install_scripts.js");
assert.deepEqual(packageJson.allowScripts, {
  esbuild: true,
  sharp: true,
  workerd: true,
});

const lockedDevDependencies = lockfile.packages?.[""]?.devDependencies;
assert.deepEqual(
  lockedDevDependencies,
  packageJson.devDependencies,
  "package.json devDependencies must be synchronized with the lockfile root",
);
for (const [packageName, requestedVersion] of Object.entries(packageJson.devDependencies)) {
  assert.match(
    requestedVersion,
    exactNpmVersion,
    `${packageName} must use an exact version; package-lock.json provides reproducible transitive resolution`,
  );
  const lockedPackage = lockfile.packages?.[`node_modules/${packageName}`];
  assert.ok(lockedPackage, `${packageName} is missing from package-lock.json`);
  assert.equal(
    lockedPackage.version,
    requestedVersion,
    `${packageName} must resolve to the exact version requested by package.json`,
  );
}

const playwrightVersion = packageJson.devDependencies["@playwright/test"];
assert.equal(lockfile.packages["node_modules/@playwright/test"].dependencies.playwright, playwrightVersion);
assert.equal(lockfile.packages["node_modules/playwright"].version, playwrightVersion);
assert.equal(lockfile.packages["node_modules/playwright"].dependencies["playwright-core"], playwrightVersion);
assert.equal(lockfile.packages["node_modules/playwright-core"].version, playwrightVersion);

for (const packageName of Object.keys(packageJson.allowScripts)) {
  const installedByLockfile = lockfile.packages?.[`node_modules/${packageName}`];
  assert.ok(installedByLockfile, `${packageName} is approved for install scripts but absent from package-lock.json`);
  assert.match(installedByLockfile.version, exactNpmVersion, `${packageName} has an invalid locked version`);
}
const lockedWranglerBin = lockfile.packages["node_modules/wrangler"].bin;
const lockedWranglerEntryPoint = typeof lockedWranglerBin === "string"
  ? lockedWranglerBin
  : lockedWranglerBin?.wrangler;
assert.equal(typeof lockedWranglerEntryPoint, "string");
assert.equal(fs.readFileSync(path.join(root, ".npmrc"), "utf8").trim(), "save-exact=true");
assert.equal(fs.readFileSync(path.join(root, ".nvmrc"), "utf8").trim(), "24.18.0");
assert.equal(fs.existsSync(path.join(root, "tools", "check_node_install_scripts.js")), true);
assert.match(nodeInstallCheck, /spawnSync\(process\.execPath, \[wranglerCli, "--version"\]/);
assert.match(nodeInstallCheck, /shell: false/);
assert.match(nodeInstallCheck, /lockedWranglerVersion = lockedVersion\("wrangler"\)/);
assert.match(nodeInstallCheck, /wranglerPackage\.version !== lockedWranglerVersion/);
assert.doesNotMatch(nodeInstallCheck, /path\.join\(root, "node_modules", "\.bin"|shell: process\.platform/);
assert.match(npmOffline, /TARGET_KEY: Final = "linux-x64-glibc"/);
assert.match(npmOffline, /package-lock\.json lockfileVersion 3/);
assert.match(npmOffline, /playwrightBrowsersIncluded/);
assert.match(npmOffline, /def _npm_pack_exact/);
assert.match(npmOffline, /OFFLINE_LOCK_PATH: Final =/);
assert.match(npmOffline, /OFFLINE_PACKAGE_PATH: Final =/);
assert.match(npmOffline, /EXCLUDED_CHAT_ROOT_PACKAGES:[^\n]*wrangler/);
assert.match(npmOffline, /def _selected_install_paths/);
assert.match(npmOffline, /def build_offline_package/);
assert.match(npmOffline, /def build_profile_lock_projection/);
assert.match(npmOffline, /profileLockSha256/);
assert.doesNotMatch(npmOffline, /"lockfileSha256"/);
assert.match(npmOffline, /LEGACY_MIRROR_DIRECTORIES/);
assert.doesNotMatch(npmOffline, /resolve_bundle_owners|bundledPackageCount/);
assert.match(npmOfflineSync, /sync_mirror\(project_root\(\)/);
assert.match(npmOfflineBootstrap, /"ci",[\s\S]*"--offline"/);
assert.match(npmOfflineBootstrap, /PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD/);
assert.match(npmOfflineBootstrap, /INSTALL_STAGE_PREFIX/);
assert.match(npmOfflineBootstrap, /symlink_to\(root \/ "vendor"/);
assert.match(npmOfflineBootstrap, /TOOLCHAIN_PROBE/);
assert.doesNotMatch(npmOfflineBootstrap, /TEMPORARY_SHRINKWRAP|npm cache add|mirror-stamp/);
assert.equal(fs.existsSync(path.join(root, "vendor", "npm", "linux-x64-glibc", "README.md")), true);
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
assert.equal(packageJson.scripts["test:js"], "node tools/run_project_python.js --system tools/verify_project.py --javascript-only");
assert.equal(packageJson.scripts["test:python"], "node tools/run_project_python.js tools/verify_project.py --python-only");
assert.equal(packageJson.scripts["test:e2e"], "playwright test");
assert.equal(packageJson.scripts.pretest, "node tools/run_project_python.js --system tools/setup_python_env.py --quiet");
assert.equal(packageJson.scripts.test, "node tools/run_project_python.js tools/verify_project.py --quick");
assert.match(packageJson.scripts.preverify, /check_playwright_browser\.js/);
assert.equal(packageJson.scripts.verify, "node tools/run_project_python.js tools/verify_project.py");
assert.equal(
  packageJson.scripts["preverify:core"],
  "node tools/run_project_python.js --system tools/setup_python_env.py --quiet",
);
assert.equal(
  packageJson.scripts["verify:core"],
  "node tools/run_project_python.js tools/verify_project.py --skip-browser",
);
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
assert.match(verifier, /Linux npm offline mirror is current/);
assert.match(verifier, /tools\/sync_npm_offline_linux\.py[^\n]*--check/);
assert.match(verifier, /resolve_project_python/);
assert.match(verifier, /npm run setup:python/);
assert.match(verifier, /build_deploy_bundle\.py/);
assert.match(verifier, /build_site_pages\.py/);
assert.match(verifier, /Playwright browser journeys/);
assert.equal(fs.existsSync(path.join(root, "tools", "requirements-dev.txt")), true);
assert.equal(fs.existsSync(path.join(root, "tools", "clean_project_artifacts.py")), true);
assert.match(ciWorkflow, /PYTHONDONTWRITEBYTECODE: "1"/);
assert.match(ciWorkflow, /verification:\n\s+name: Source, unit, build and quality checks/);
assert.match(ciWorkflow, /playwright:\n\s+name: Playwright browser tests/);
assert.doesNotMatch(ciWorkflow, /^\s+needs:/mu);
assert.match(ciWorkflow, /runs-on: ubuntu-24\.04/);
assert.match(ciWorkflow, /uses: actions\/checkout@v7/);
assert.match(ciWorkflow, /uses: actions\/setup-node@v7/);
assert.match(ciWorkflow, /node-version-file: \.nvmrc/);
assert.match(ciWorkflow, /cache: npm[\s\S]{0,120}cache-dependency-path: package-lock\.json/);
assert.match(ciWorkflow, /id: python-setup/);
assert.match(ciWorkflow, /uses: actions\/setup-python@v7/);
assert.match(pythonBaseline, /^\d+\.\d+$/u);
assert.match(ciWorkflow, /python-version-file: \.python-version/);
assert.doesNotMatch(ciWorkflow, /python-version:\s*["']?3\./u);
assert.match(ciWorkflow, /Restore Python virtual environment[\s\S]{0,160}id: python-venv-cache/);
assert.match(ciWorkflow, /path: \.venv/);
assert.match(
  ciWorkflow,
  /key: python-venv-v2-\$\{\{ runner\.os \}\}-\$\{\{ runner\.arch \}\}-\$\{\{ steps\.python-setup\.outputs\.python-version \}\}-\$\{\{ hashFiles\('\.python-version', 'tools\/requirements\.txt', 'tools\/requirements-dev\.txt', 'tools\/setup_python_env\.py', 'tools\/python_toolchain\.py'\) \}\}/,
);
assert.match(ciWorkflow, /uses: actions\/cache\/restore@v6/);
assert.equal((ciWorkflow.match(/uses: actions\/cache\/save@v6/gu) || []).length, 1);
assert.match(
  ciWorkflow,
  /Save Python virtual environment[\s\S]{0,140}if: steps\.python-venv-cache\.outputs\.cache-hit != 'true'[\s\S]{0,180}cache-primary-key/,
);
const escapedPlaywrightVersion = playwrightVersion.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
assert.match(
  ciWorkflow,
  new RegExp(`image: mcr\\.microsoft\\.com/playwright:v${escapedPlaywrightVersion}-noble`, "u"),
);
assert.match(ciWorkflow, /options: --ipc=host/);
assert.equal((ciWorkflow.match(/mcr\.microsoft\.com\/playwright:/gu) || []).length, 1);
assert.doesNotMatch(ciWorkflow, /id: playwright-version/);
assert.doesNotMatch(ciWorkflow, /Restore Playwright browser cache/);
assert.doesNotMatch(ciWorkflow, /path: ~\/\.cache\/ms-playwright/);
assert.doesNotMatch(ciWorkflow, /playwright install-deps/);
assert.doesNotMatch(ciWorkflow, /playwright install(?: --with-deps)? chromium/);
assert.match(ciWorkflow, /Prepare Python environment[\s\S]{0,100}npm run setup:python/);
assert.match(ciWorkflow, /uses: actions\/upload-artifact@v7/);
assert.match(pyproject, new RegExp(`target-version = "py${pythonBaseline.replace(".", "")}"`, "u"));
assert.match(pyproject, new RegExp(`python_version = "${pythonBaseline.replace(".", "\\.")}"`, "u"));
assert.match(ciWorkflow, /Remove ephemeral source artifacts[\s\S]*clean_project_artifacts\.py(?! --check)/);
assert.match(ciWorkflow, /Verify tests left no source-tree caches[\s\S]*clean_project_artifacts\.py --check/);
assert.match(ciWorkflow, /Run non-browser verification[\s\S]{0,100}npm run verify:core/);
assert.match(ciWorkflow, /Run Playwright browser tests[\s\S]{0,100}npm run test:e2e/);
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
assert.equal(fs.existsSync(path.join(root, "tools", "setup_linux_ocr.js")), true);
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
assert.match(projectTasks, /tools\/setup_linux_ocr\.js/);
assert.match(projectTasks, /--skip-ocr-system-deps/);
assert.match(linuxOcrSetup, /"tesseract-ocr"/);
assert.match(linuxOcrSetup, /"tesseract-ocr-eng"/);
assert.match(linuxOcrSetup, /"tesseract-ocr-heb"/);
assert.match(linuxOcrSetup, /--no-install-recommends/);
assert.match(linuxOcrSetup, /shell: false/);
assert.match(pythonLauncher, /Python 3 interpreter/);
assert.match(pythonLauncher, /PYTHON_VERSION_FILE = "\.python-version"/);
assert.match(pythonLauncher, /add\("py", \["-3"\]\)/);
assert.match(pythonLauncher, /runtimeSatisfiesBaseline/);
assert.match(pythonLauncher, /major === baseline\.major && minor >= baseline\.minor/);
assert.doesNotMatch(pythonLauncher, /MINIMUM_PYTHON|Python 3\.10\+/);
assert.match(pythonLauncher, /tools\/run_with_project_python\.py/);
assert.match(pythonLauncher, /shell: false/);
assert.match(pythonLauncher, /PYTHONDONTWRITEBYTECODE/);
assert.match(linuxDocs, /Tesseract[\s\S]*אוטומט/);
assert.match(linuxDocs, /tesseract-ocr-eng/);
assert.match(linuxDocs, /tesseract-ocr-heb/);
assert.match(linuxDocs, /--skip-ocr-system-deps/);
assert.match(linuxDocs, /אין צורך להריץ `source \.venv\/bin\/activate`/);
assert.match(linuxDocs, /\.python-version/);
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
