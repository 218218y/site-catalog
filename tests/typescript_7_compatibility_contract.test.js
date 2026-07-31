"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  analyzeCompilerResult,
  parseCompilerDiagnostics,
} = require("../tools/check_frontend_runtime_symbols.js");

const root = path.join(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const jsconfig = JSON.parse(fs.readFileSync(path.join(root, "jsconfig.json"), "utf8"));
const contracts = fs.readFileSync(path.join(root, "src", "js", "05-app-contracts.js"), "utf8");
const navigation = fs.readFileSync(path.join(root, "src", "js", "00-navigation.js"), "utf8");
const runtimeSymbolChecker = fs.readFileSync(path.join(root, "tools", "check_frontend_runtime_symbols.js"), "utf8");
const frontendTestModule = fs.readFileSync(path.join(root, "tests", "frontend_test_module.js"), "utf8");
const offlineBootstrap = fs.readFileSync(path.join(root, "tools", "bootstrap_typescript_offline.py"), "utf8");
const offlineRunner = fs.readFileSync(path.join(root, "tools", "run_typescript_offline.py"), "utf8");
const verifier = fs.readFileSync(path.join(root, "tools", "verify_project.py"), "utf8");

assert.equal(packageJson.devDependencies.typescript, "7.0.2");
assert.equal(packageJson.devDependencies.esbuild, "0.28.1");
assert.equal(packageJson.devDependencies["typescript-legacy-api"], undefined);
assert.equal(packageLock.packages[""].devDependencies.typescript, "7.0.2");
assert.equal(packageLock.packages[""].devDependencies["typescript-legacy-api"], undefined);
assert.equal(packageLock.packages["node_modules/typescript"].version, "7.0.2");
assert.equal(packageLock.packages["node_modules/typescript-legacy-api"], undefined);
assert.equal(packageLock.packages["node_modules/@typescript/typescript-win32-x64"].version, "7.0.2");
assert.equal(packageLock.packages["node_modules/@typescript/typescript-linux-x64"].version, "7.0.2");
assert.deepEqual(jsconfig.compilerOptions.types, []);
assert.equal(
  packageJson.scripts["setup:typescript:offline"],
  "node tools/run_project_python.js --system tools/bootstrap_typescript_offline.py",
);
assert.equal(
  packageJson.scripts["check:typescript:offline"],
  "node tools/run_project_python.js --system tools/bootstrap_typescript_offline.py --check",
);
assert.equal(
  packageJson.scripts["check:types"],
  "node tools/run_project_python.js --system tools/run_typescript_offline.py -p jsconfig.json --pretty false",
);
assert.equal(
  packageJson.scripts["test:js"],
  "node tools/run_project_python.js --system tools/verify_project.py --javascript-only",
);
assert.match(offlineBootstrap, /TYPESCRIPT_VERSION: Final = "7\.0\.2"/);
assert.match(offlineBootstrap, /package-lock\.json/);
assert.match(offlineBootstrap, /sri_sha512/);
assert.match(offlineBootstrap, /Unsafe npm archive member/);
assert.match(offlineBootstrap, /Path\("node_modules\/typescript"\)/);
assert.match(offlineBootstrap, /Path\("bin\/tsc"\)/);
assert.match(offlineRunner, /install_typescript\(base, quiet=True\)/);
assert.doesNotMatch(offlineRunner, /\bnpx\b|npm install|npm ci|shell=True/);
assert.match(verifier, /tools\/run_typescript_offline\.py/);

assert.match(contracts, /@typedef \{\{replace\?:boolean\}\} AppNavigationOptions/);
assert.doesNotMatch(contracts, /@typedef \{\{replace\?:boolean\}\} NavigationOptions/);
assert.equal((navigation.match(/@param \{AppNavigationOptions\} \[options\]/g) || []).length, 2);

assert.equal(fs.existsSync(path.join(root, "tools", "typescript_compiler_api.js")), false);
assert.match(runtimeSymbolChecker, /node_modules", "typescript", "package\.json"/);
assert.match(runtimeSymbolChecker, /expectedCompilerVersion = projectPackage\.devDependencies\.typescript/);
assert.match(runtimeSymbolChecker, /bootstrap_typescript_offline\.py/);
assert.match(runtimeSymbolChecker, /compilerProbeIsValid/);
assert.match(runtimeSymbolChecker, /shell: false/);
assert.match(runtimeSymbolChecker, /packageJson\.bin/);
assert.match(runtimeSymbolChecker, /spawnSync\(process\.execPath/);
assert.match(runtimeSymbolChecker, /"--ignoreConfig"/);
assert.match(runtimeSymbolChecker, /diagnostic\.code === 2304/);
assert.doesNotMatch(runtimeSymbolChecker, /require\(["']typescript(?:-legacy-api)?["']\)/);
assert.doesNotMatch(runtimeSymbolChecker, /\bcreateProgram\b|\bScriptTarget\b|\btranspileModule\b/);

assert.deepEqual(
  parseCompilerDiagnostics("a.js(1,2): error TS2304: Missing\nerror TS6053: File not found").map((item) => item.code),
  [2304, 6053],
);
assert.equal(
  analyzeCompilerResult(1, "a.js(1,2): error TS18047: Value is possibly null").infrastructureFailure,
  false,
);
assert.equal(
  analyzeCompilerResult(1, "error TS6053: File not found").infrastructureFailure,
  true,
);

assert.match(frontendTestModule, /require\("esbuild"\)/);
assert.match(frontendTestModule, /esbuild\.transformSync/);
assert.doesNotMatch(frontendTestModule, /typescript_compiler_api|require\(["']typescript(?:-legacy-api)?["']\)/);
assert.doesNotMatch(frontendTestModule, /\bcreateSourceFile\b|\btranspileModule\b|\bScriptTarget\b/);

console.log("typescript_7_compatibility_contract.test.js: PASS");
