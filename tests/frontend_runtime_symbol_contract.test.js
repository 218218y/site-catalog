"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  analyzeCompilerResult,
  parseCompilerDiagnostics,
} = require("../tools/check_frontend_runtime_symbols.js");

const root = path.join(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const checker = fs.readFileSync(path.join(root, "tools", "check_frontend_runtime_symbols.js"), "utf8");
const verifier = fs.readFileSync(path.join(root, "tools", "verify_project.py"), "utf8");
const jsconfig = JSON.parse(fs.readFileSync(path.join(root, "jsconfig.json"), "utf8"));

assert.equal(packageJson.scripts["check:runtime-symbols"], "node tools/check_frontend_runtime_symbols.js");
assert.equal(
  packageJson.scripts["check:types"],
  "node tools/run_project_python.js --system tools/run_typescript_offline.py -p jsconfig.json --pretty false",
);
assert.equal(jsconfig.compilerOptions.checkJs, true);
assert.equal(jsconfig.compilerOptions.noEmit, true);
assert.match(checker, /\["app-catalog\.js", "app-favorites\.js", "app-viewer\.js", "app-payment\.js"\]/);
assert.match(checker, /"--ignoreConfig"/);
assert.match(checker, /sharedTypeContracts = path\.join\(root, "src", "js", "05-app-contracts\.js"\)/);
assert.match(checker, /ambientGlobals, sharedTypeContracts, bundle/);
assert.match(checker, /spawnSync\(process\.execPath/);
assert.match(checker, /diagnostic\.code === 2304/);
assert.doesNotMatch(checker, /typescript_compiler_api|\bcreateProgram\b|\bScriptTarget\b|\bModuleKind\b/);
assert.equal(fs.existsSync(path.join(root, "tools", "typescript_compiler_api.js")), false);
assert.match(verifier, /Frontend route runtime symbols/);

const semanticOnlyOutput = [
  "app-catalog.js(181,37): error TS2339: Property 'BARGIG_CATALOGS' does not exist on type 'Window & typeof globalThis'.",
  "app-catalog.js(303,3): error TS18047: 'targetUrl' is possibly 'null'.",
  "tooltip-manager.js(46,22): error TS2322: Type 'HTMLDivElement' is not assignable to type 'null'.",
].join("\n");
const semanticOnly = analyzeCompilerResult(1, semanticOnlyOutput);
assert.equal(semanticOnly.infrastructureFailure, false);
assert.equal(semanticOnly.unresolved.length, 0);
assert.deepEqual(parseCompilerDiagnostics(semanticOnlyOutput).map((item) => item.code), [2339, 18047, 2322]);

const unresolved = analyzeCompilerResult(
  1,
  "missing-runtime.js(2,7): error TS2304: Cannot find name 'MISSING_RUNTIME_SYMBOL'.",
);
assert.equal(unresolved.infrastructureFailure, false);
assert.equal(unresolved.unresolved.length, 1);
assert.equal(unresolved.unresolved[0].message, "Cannot find name 'MISSING_RUNTIME_SYMBOL'.");

const invalidInvocation = analyzeCompilerResult(1, "error TS5023: Unknown compiler option '--broken'.");
assert.equal(invalidInvocation.infrastructureFailure, true);
assert.deepEqual(invalidInvocation.globalDiagnostics.map((item) => item.code), [5023]);
assert.equal(analyzeCompilerResult(1, "native compiler crashed").infrastructureFailure, true);

const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "bargig-runtime-symbols-"));
try {
  const knownTypeFixture = path.join(fixtureDirectory, "known-project-type.js");
  fs.writeFileSync(
    knownTypeFixture,
    "/** @param {CatalogImageCandidate} candidate */\nfunction consumeCandidate(candidate) { return candidate.src; }\nconsumeCandidate({ src: '/page.webp', tier: 'full' });\n",
    "utf8",
  );
  const knownTypeCheck = spawnSync(
    process.execPath,
    ["tools/check_frontend_runtime_symbols.js", knownTypeFixture],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(knownTypeCheck.status, 0, knownTypeCheck.stderr || knownTypeCheck.stdout);

  const missingSymbolFixture = path.join(fixtureDirectory, "missing-runtime-symbol.js");
  fs.writeFileSync(missingSymbolFixture, "console.log(MISSING_RUNTIME_SYMBOL);\n", "utf8");
  const missingSymbolCheck = spawnSync(
    process.execPath,
    ["tools/check_frontend_runtime_symbols.js", missingSymbolFixture],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(missingSymbolCheck.status, 1, missingSymbolCheck.stdout);
  assert.match(missingSymbolCheck.stderr, /Cannot find name 'MISSING_RUNTIME_SYMBOL'/);
} finally {
  fs.rmSync(fixtureDirectory, { recursive: true, force: true });
}

console.log("frontend_runtime_symbol_contract.test.js: PASS");
