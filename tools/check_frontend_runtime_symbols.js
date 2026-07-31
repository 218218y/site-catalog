#!/usr/bin/env node
"use strict";

/**
 * Fail when a generated route bundle references an identifier that is absent
 * from that route's esbuild output. This catches unresolved runtime references,
 * tree-shaking mistakes, and feature-boundary errors in the exact browser artifact.
 */
const path = require("node:path");
const {
  extractDiagnosticCodes,
  runTypeScriptCompiler,
} = require("./typescript_compiler_api.js");

const root = path.resolve(__dirname, "..");
const bundles = process.argv.slice(2);
const targets = bundles.length ? bundles : ["app-catalog.js", "app-favorites.js", "app-viewer.js", "app-payment.js"];
const ambientGlobals = path.join(root, "types", "frontend-runtime-globals.d.ts");
const failures = [];

const compilerArgs = [
  "--pretty", "false",
  "--allowJs",
  "--checkJs",
  "--noEmit",
  "--target", "ES2022",
  "--module", "ESNext",
  "--moduleResolution", "Bundler",
  "--lib", "ES2022,DOM,DOM.Iterable",
  "--skipLibCheck",
  "--noImplicitAny", "false",
];

for (const relativeBundle of targets) {
  const bundle = path.resolve(root, relativeBundle);
  const completed = runTypeScriptCompiler([...compilerArgs, ambientGlobals, bundle]);
  const diagnosticCodes = extractDiagnosticCodes(completed.output);
  const unresolvedLines = completed.output
    .split(/\r?\n/)
    .filter((line) => /\berror TS2304:/.test(line));

  const infrastructureDiagnostics = diagnosticCodes.filter(
    (code) => (code >= 5000 && code < 7000) || code >= 18000,
  );
  if (completed.status !== 0 && (!diagnosticCodes.length || infrastructureDiagnostics.length)) {
    const details = completed.output.trim() || `TypeScript exited with status ${completed.status}.`;
    throw new Error(`TypeScript 7 could not validate ${relativeBundle}:\n${details}`);
  }

  if (unresolvedLines.length) {
    failures.push(...unresolvedLines.map((line) => line.replaceAll(`${root}${path.sep}`, "")));
  }
}

if (failures.length) {
  console.error("Frontend route bundles contain unresolved runtime symbols:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Frontend runtime symbol check passed for ${targets.length} route bundles.`);
