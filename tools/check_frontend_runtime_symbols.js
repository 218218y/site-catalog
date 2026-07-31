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
const compilerPackagePath = path.join(root, "node_modules", "typescript", "package.json");

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

function resolveCompilerEntry() {
  if (!fs.existsSync(compilerPackagePath)) {
    throw new Error("TypeScript 7 is not installed. Run `npm ci` before executing project tools.");
  }

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(compilerPackagePath, "utf8"));
  } catch (error) {
    throw new Error("Could not read the installed TypeScript package metadata.", { cause: error });
  }

  if (!/^7\./.test(String(packageJson.version || ""))) {
    throw new Error(`Expected TypeScript 7, but found ${packageJson.version || "an unknown version"}. Run \`npm ci\`.`);
  }

  const bin = typeof packageJson.bin === "string" ? packageJson.bin : packageJson.bin?.tsc;
  if (typeof bin !== "string" || !bin) {
    throw new Error("The installed TypeScript package does not expose its `tsc` command.");
  }

  const compilerEntry = path.resolve(path.dirname(compilerPackagePath), bin);
  if (!fs.existsSync(compilerEntry)) {
    throw new Error(`The installed TypeScript compiler entry is missing: ${compilerEntry}`);
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

  const compilerEntry = resolveCompilerEntry();
  const targets = requestedTargets.length ? requestedTargets : defaultTargets;
  const failures = [];

  for (const relativeBundle of targets) {
    const bundle = path.resolve(root, relativeBundle);
    if (!fs.existsSync(bundle) || !fs.statSync(bundle).isFile()) {
      throw new Error(`Frontend route bundle is missing: ${relativeBundle}`);
    }

    const completed = runCompiler(compilerEntry, [...compilerArgs, ambientGlobals, bundle]);
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
