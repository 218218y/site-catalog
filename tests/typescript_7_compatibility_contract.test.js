"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  analyzeCompilerResult,
  parseCompilerDiagnostics,
  stripJSDocTypeComments,
} = require("../tools/check_frontend_runtime_symbols.js");

const root = path.join(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
const jsconfig = JSON.parse(read("jsconfig.json"));
const compatibilityMarker = read("src/js/05-app-contracts.js");
const navigation = read("src/js/00-navigation.js");
const contracts = read("types/frontend-contracts.d.ts");
const runtimeSymbolChecker = read("tools/check_frontend_runtime_symbols.js");
const frontendTestModule = read("tests/frontend_test_module.js");
const currentBootstrap = read("tools/bootstrap_typescript_offline.py");
const compatibilityBootstrap = read("tools/bootstrap_typescript_5_8_offline.py");
const currentRunner = read("tools/run_typescript_offline.py");
const matrixRunner = read("tools/run_typescript_matrix.py");
const verifier = read("tools/verify_project.py");

assert.equal(packageJson.devDependencies.typescript, "7.0.2");
assert.equal(packageJson.devDependencies["typescript-5-8"], "npm:typescript@5.8.3");
assert.equal(packageJson.devDependencies.esbuild, "0.28.1");
assert.equal(packageLock.packages[""].devDependencies.typescript, "7.0.2");
assert.equal(packageLock.packages[""].devDependencies["typescript-5-8"], "npm:typescript@5.8.3");
assert.equal(packageLock.packages["node_modules/typescript"].version, "7.0.2");
assert.equal(packageLock.packages["node_modules/typescript-5-8"].name, "typescript");
assert.equal(packageLock.packages["node_modules/typescript-5-8"].version, "5.8.3");
assert.equal(packageLock.packages["node_modules/@typescript/typescript-linux-x64"].version, "7.0.2");
assert.deepEqual(jsconfig.compilerOptions.types, []);

assert.equal(
  packageJson.scripts["check:types"],
  "node tools/run_project_python.js --system tools/run_typescript_matrix.py -p jsconfig.json --pretty false",
);
assert.equal(
  packageJson.scripts["check:types:5.8"],
  "node tools/run_project_python.js --system tools/bootstrap_typescript_5_8_offline.py --quiet && node node_modules/typescript-5-8/bin/tsc -p jsconfig.json --pretty false",
);
assert.equal(
  packageJson.scripts["check:types:7"],
  "node tools/run_project_python.js --system tools/run_typescript_offline.py -p jsconfig.json --pretty false",
);
assert.equal(
  packageJson.scripts["test:js"],
  "node tools/run_project_python.js tools/verify_project.py --javascript-only",
);

assert.match(currentBootstrap, /TYPESCRIPT_VERSION: Final = "7\.0\.2"/);
assert.match(currentBootstrap, /sri_sha512/);
assert.match(currentBootstrap, /Unsafe npm archive member/);
assert.doesNotMatch(currentBootstrap, /typescript-win32-x64|win32-x64-7\.0\.2\.tgz/);
assert.match(compatibilityBootstrap, /VERSION: Final = "5\.8\.3"/);
assert.match(compatibilityBootstrap, /DEPENDENCY_NAME: Final = "typescript-5-8"/);
assert.match(compatibilityBootstrap, /package-lock\.json/);
assert.match(compatibilityBootstrap, /sri_sha512/);
assert.match(compatibilityBootstrap, /directory_matches_archive/);
assert.match(compatibilityBootstrap, /Unsafe npm archive member/);
assert.doesNotMatch(compatibilityBootstrap, /\bnpm install\b|\bnpm ci\b|shell=True/);
assert.match(currentRunner, /ensure_typescript_available\(base, quiet=True\)/);
assert.match(matrixRunner, /ensure_typescript_5_8_available/);
assert.match(matrixRunner, /ensure_typescript_available/);
assert.match(matrixRunner, /TypeScript \{LEGACY_VERSION\}/);
assert.match(matrixRunner, /TypeScript \{CURRENT_VERSION\}/);
assert.match(verifier, /tools\/run_typescript_matrix\.py/);
assert.match(verifier, /Frontend JSDoc type compatibility matrix/);

assert.doesNotMatch(compatibilityMarker, /@typedef|@callback|@template/);
assert.match(compatibilityMarker, /intentionally declares no ambient names/);
assert.match(contracts, /export type AppNavigationOptions =/);
assert.doesNotMatch(contracts, /\btype NavigationOptions\b|\binterface NavigationOptions\b/);
assert.equal((navigation.match(/@param \{AppNavigationOptions\} \[options\]/g) || []).length, 2);
assert.match(navigation, /@import \{ AppNavigationOptions \} from "\.\.\/\.\.\/types\/frontend-contracts\.js"/);

assert.equal(fs.existsSync(path.join(root, "tools", "typescript_compiler_api.js")), false);
assert.match(runtimeSymbolChecker, /node_modules", "typescript", "package\.json"/);
assert.match(runtimeSymbolChecker, /expectedCompilerVersion = projectPackage\.devDependencies\.typescript/);
assert.match(runtimeSymbolChecker, /bootstrap_typescript_offline\.py/);
assert.match(runtimeSymbolChecker, /compilerProbeIsValid/);
assert.match(runtimeSymbolChecker, /stripJSDocTypeComments/);
assert.match(runtimeSymbolChecker, /ambientGlobals, sanitizedBundle/);
assert.match(runtimeSymbolChecker, /diagnostic\.code === 2304/);
assert.doesNotMatch(runtimeSymbolChecker, /require\(["']typescript(?:-legacy-api)?["']\)/);
assert.doesNotMatch(runtimeSymbolChecker, /\bcreateProgram\b|\bScriptTarget\b|\btranspileModule\b/);
assert.deepEqual(stripJSDocTypeComments("/** @type {MissingType} */\nvalue;").split("\n"), [" ".repeat(26), "value;"]);

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

console.log("typescript_7_compatibility_contract.test.js: PASS");
