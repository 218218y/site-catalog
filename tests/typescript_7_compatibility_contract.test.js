"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
const jsconfig = JSON.parse(fs.readFileSync(path.join(root, "jsconfig.json"), "utf8"));
const contracts = fs.readFileSync(path.join(root, "src", "js", "05-app-contracts.js"), "utf8");
const navigation = fs.readFileSync(path.join(root, "src", "js", "00-navigation.js"), "utf8");
const compilerBoundary = fs.readFileSync(path.join(root, "tools", "typescript_compiler_api.js"), "utf8");
const runtimeSymbolChecker = fs.readFileSync(path.join(root, "tools", "check_frontend_runtime_symbols.js"), "utf8");
const frontendTestModule = fs.readFileSync(path.join(root, "tests", "frontend_test_module.js"), "utf8");
const { extractDiagnosticCodes } = require("../tools/typescript_compiler_api.js");

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

assert.match(contracts, /@typedef \{\{replace\?:boolean\}\} AppNavigationOptions/);
assert.doesNotMatch(contracts, /@typedef \{\{replace\?:boolean\}\} NavigationOptions/);
assert.equal((navigation.match(/@param \{AppNavigationOptions\} \[options\]/g) || []).length, 2);

assert.match(compilerBoundary, /node_modules", "typescript", "bin", "tsc"/);
assert.match(compilerBoundary, /spawnSync\(process\.execPath/);
assert.doesNotMatch(compilerBoundary, /require\(["']typescript(?:-legacy-api)?["']\)/);
assert.doesNotMatch(compilerBoundary, /\bcreateProgram\b|\bScriptTarget\b|\btranspileModule\b/);
assert.deepEqual(
  extractDiagnosticCodes("a.js(1,2): error TS2304: Missing\nerror TS6053: File not found"),
  [2304, 6053],
);

assert.match(runtimeSymbolChecker, /runTypeScriptCompiler/);
assert.match(runtimeSymbolChecker, /error TS2304:/);
assert.doesNotMatch(runtimeSymbolChecker, /\bcreateProgram\b|\bScriptTarget\b|\bModuleKind\b/);
assert.doesNotMatch(runtimeSymbolChecker, /require\(["']typescript(?:-legacy-api)?["']\)/);

assert.match(frontendTestModule, /require\("esbuild"\)/);
assert.match(frontendTestModule, /esbuild\.transformSync/);
assert.doesNotMatch(frontendTestModule, /typescript_compiler_api|require\(["']typescript(?:-legacy-api)?["']\)/);
assert.doesNotMatch(frontendTestModule, /\bcreateSourceFile\b|\btranspileModule\b|\bScriptTarget\b/);

console.log("typescript_7_compatibility_contract.test.js: PASS");
