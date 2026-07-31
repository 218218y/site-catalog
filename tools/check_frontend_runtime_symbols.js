#!/usr/bin/env node
"use strict";

/**
 * Fail when a generated route bundle references a bare identifier that is absent
 * from that route's esbuild output. Each bundle is checked in isolation so a
 * declaration emitted into one route cannot accidentally satisfy another route.
 *
 * TypeScript 7's CLI reports every JSDoc/type diagnostic with a non-zero exit
 * status. This contract intentionally preserves the original Compiler API
 * behavior: only TS2304 ("Cannot find name") is a runtime-symbol failure.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const defaultTargets = ["app-catalog.js", "app-favorites.js", "app-viewer.js", "app-payment.js"];
const ambientGlobals = path.join(root, "types", "frontend-runtime-globals.d.ts");
const sharedTypeContracts = path.join(root, "src", "js", "05-app-contracts.js");
const compilerPackagePath = path.join(root, "node_modules", "typescript", "package.json");
const projectPackage = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const expectedCompilerVersion = projectPackage.devDependencies.typescript;
const offlineBootstrap = "tools/bootstrap_typescript_offline.py";
const pythonLauncher = path.join(root, "tools", "run_project_python.js");

const compilerArgs = [
  "--ignoreConfig",
  "--pretty", "false",
  "--allowJs",
  "--checkJs",
  "--noEmit",
  "--target", "ES2022",
  "--module", "ESNext",
  "--moduleResolution", "Bundler",
  "--lib", "ES2022,DOM,DOM.Iterable",
  "--skipLibCheck",
  "--strict", "false",
  "--noImplicitAny", "false",
];

/**
 * Parse the first line of each non-pretty TypeScript diagnostic.
 * Diagnostics without a file location are compiler/configuration failures;
 * file-scoped diagnostics are normal source diagnostics.
 *
 * @param {string} output
 * @returns {Array<{line:string, file:string, row:number|null, column:number|null, code:number, message:string}>}
 */
function parseCompilerDiagnostics(output) {
  const diagnostics = [];
  for (const line of String(output || "").split(/\r?\n/)) {
    const match = line.match(/^(?:(.+)\((\d+),(\d+)\): )?error TS(\d+): (.*)$/);
    if (!match) continue;
    diagnostics.push({
      line,
      file: match[1] || "",
      row: match[2] ? Number(match[2]) : null,
      column: match[3] ? Number(match[3]) : null,
      code: Number(match[4]),
      message: match[5],
    });
  }
  return diagnostics;
}

/**
 * Classify a TypeScript CLI result without treating ordinary JSDoc/type errors
 * as tool failures. A non-zero result is fatal only when the compiler produced
 * no parseable diagnostics or reported a global command/configuration error.
 *
 * @param {number} status
 * @param {string} output
 */
function analyzeCompilerResult(status, output) {
  const diagnostics = parseCompilerDiagnostics(output);
  const unresolved = diagnostics.filter((diagnostic) => diagnostic.code === 2304);
  const globalDiagnostics = diagnostics.filter((diagnostic) => !diagnostic.file);
  const infrastructureFailure = status !== 0 && (!diagnostics.length || globalDiagnostics.length > 0);
  return Object.freeze({ diagnostics, unresolved, globalDiagnostics, infrastructureFailure });
}

function readCompilerEntry() {
  if (!fs.existsSync(compilerPackagePath)) return null;

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(compilerPackagePath, "utf8"));
  } catch {
    return null;
  }

  if (packageJson.version !== expectedCompilerVersion) return null;
  const bin = typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.tsc;
  if (typeof bin !== "string" || !bin) return null;
  const compilerEntry = path.resolve(path.dirname(compilerPackagePath), bin);
  return fs.existsSync(compilerEntry) ? compilerEntry : null;
}

/** @param {string} compilerEntry */
function compilerProbeIsValid(compilerEntry) {
  const completed = spawnSync(process.execPath, [compilerEntry, "--version"], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
  });
  return (
    !completed.error &&
    !completed.signal &&
    completed.status === 0 &&
    String(completed.stdout || "").trim() === `Version ${expectedCompilerVersion}`
  );
}

function bootstrapCompiler() {
  if (process.platform !== "linux") {
    throw new Error(
      `Local TypeScript ${expectedCompilerVersion} is missing or unusable. ` +
      "Offline TypeScript archives are intentionally Linux-only; run `npm ci` on Windows " +
      "to restore the package-lock-managed native compiler.",
    );
  }

  const completed = spawnSync(
    process.execPath,
    [pythonLauncher, "--system", offlineBootstrap, "--quiet"],
    {
      cwd: root,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    },
  );
  if (completed.error) {
    throw new Error("Could not start the offline TypeScript bootstrap.", { cause: completed.error });
  }
  if (completed.signal) {
    throw new Error(`Offline TypeScript bootstrap stopped by signal ${completed.signal}.`);
  }
  if (completed.status !== 0) {
    const details = [completed.stdout, completed.stderr].filter(Boolean).join("\n").trim();
    throw new Error(
      `TypeScript ${expectedCompilerVersion} is unavailable and the offline bootstrap failed:\n${details}`,
    );
  }
}

function resolveCompilerEntry() {
  let compilerEntry = readCompilerEntry();
  if (!compilerEntry || !compilerProbeIsValid(compilerEntry)) {
    bootstrapCompiler();
    compilerEntry = readCompilerEntry();
  }
  if (!compilerEntry || !compilerProbeIsValid(compilerEntry)) {
    throw new Error(
      `Offline TypeScript bootstrap did not provide the exact compiler version ${expectedCompilerVersion}.`,
    );
  }
  return compilerEntry;
}

/** @param {string} compilerEntry @param {string[]} args */
function runCompiler(compilerEntry, args) {
  const completed = spawnSync(process.execPath, [compilerEntry, ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });

  if (completed.error) {
    throw new Error("Could not start the TypeScript 7 compiler.", { cause: completed.error });
  }
  if (completed.signal) {
    throw new Error(`TypeScript 7 was terminated by signal ${completed.signal}.`);
  }

  return Object.freeze({
    status: completed.status ?? 1,
    output: [completed.stdout, completed.stderr].filter(Boolean).join("\n"),
  });
}

/** @param {string[]} requestedTargets */
function checkRuntimeSymbols(requestedTargets) {
  if (!fs.existsSync(ambientGlobals)) {
    throw new Error(`Runtime globals declaration file is missing: ${ambientGlobals}`);
  }
  if (!fs.existsSync(sharedTypeContracts)) {
    throw new Error(`Shared frontend type contracts are missing: ${sharedTypeContracts}`);
  }

  const compilerEntry = resolveCompilerEntry();
  const targets = requestedTargets.length ? requestedTargets : defaultTargets;
  const failures = [];

  for (const relativeBundle of targets) {
    const bundle = path.resolve(root, relativeBundle);
    if (!fs.existsSync(bundle) || !fs.statSync(bundle).isFile()) {
      throw new Error(`Frontend route bundle is missing: ${relativeBundle}`);
    }

    // The generated bundle retains JSDoc references but esbuild correctly omits
    // the type-only contracts module from runtime output. Include that canonical
    // source contract in the isolated compiler program so TypeScript validates
    // real missing identifiers without misclassifying project-owned type names.
    const completed = runCompiler(
      compilerEntry,
      [...compilerArgs, ambientGlobals, sharedTypeContracts, bundle],
    );
    const analysis = analyzeCompilerResult(completed.status, completed.output);

    if (analysis.infrastructureFailure) {
      const details = completed.output.trim() || `TypeScript exited with status ${completed.status}.`;
      throw new Error(`TypeScript 7 could not validate ${relativeBundle}:\n${details}`);
    }

    failures.push(...analysis.unresolved.map((diagnostic) => {
      const location = diagnostic.file
        ? `${diagnostic.file}:${diagnostic.row}:${diagnostic.column}`
        : relativeBundle;
      return `${location.replaceAll(`${root}${path.sep}`, "")} ${diagnostic.message}`;
    }));
  }

  if (failures.length) {
    console.error("Frontend route bundles contain unresolved runtime symbols:\n");
    failures.forEach((failure) => console.error(`- ${failure}`));
    return 1;
  }

  console.log(`Frontend runtime symbol check passed for ${targets.length} route bundles.`);
  return 0;
}

if (require.main === module) {
  try {
    process.exitCode = checkRuntimeSymbols(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { analyzeCompilerResult, checkRuntimeSymbols, parseCompilerDiagnostics };
