#!/usr/bin/env node
"use strict";

/**
 * Fail when a generated route bundle references an identifier that is absent
 * from that bundle's lexical scope. This catches feature-boundary mistakes that
 * syntax checks cannot see (for example, a catalog bundle calling a Viewer-only
 * function behind a capability flag).
 */
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const bundles = process.argv.slice(2);
const targets = bundles.length ? bundles : ["app-catalog.js", "app-favorites.js", "app-viewer.js"];
const ambientGlobals = path.join(root, "types", "frontend-runtime-globals.d.ts");
const failures = [];

for (const relativeBundle of targets) {
  const bundle = path.resolve(root, relativeBundle);
  const program = ts.createProgram({
    rootNames: [ambientGlobals, bundle],
    options: {
      allowJs: true,
      checkJs: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
      lib: ["lib.es2022.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
      skipLibCheck: true,
      noImplicitAny: false,
    },
  });

  for (const diagnostic of ts.getPreEmitDiagnostics(program)) {
    if (diagnostic.code !== 2304) continue;
    const source = diagnostic.file;
    const position = source && diagnostic.start != null
      ? source.getLineAndCharacterOfPosition(diagnostic.start)
      : null;
    const location = position
      ? `${relativeBundle}:${position.line + 1}:${position.character + 1}`
      : relativeBundle;
    failures.push(`${location} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n")}`);
  }
}

if (failures.length) {
  console.error("Frontend route bundles contain unresolved runtime symbols:\n");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Frontend runtime symbol check passed for ${targets.length} route bundles.`);
