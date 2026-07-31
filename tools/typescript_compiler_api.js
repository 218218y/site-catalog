"use strict";

/**
 * TypeScript 7 is the project compiler used by the `tsc` CLI, but it does not
 * currently expose the stable JavaScript Compiler API used by these build/test
 * tools. Keep that API behind one explicit, pinned compatibility dependency so
 * application type-checking remains on TypeScript 7 without relying on its
 * private native implementation details.
 */
let ts;
try {
  ts = require("typescript-legacy-api");
} catch (error) {
  const wrapped = new Error(
    "The pinned TypeScript Compiler API compatibility package is missing. Run `npm ci` before executing project tools.",
    { cause: error },
  );
  throw wrapped;
}

const requiredFunctions = [
  "createProgram",
  "createSourceFile",
  "flattenDiagnosticMessageText",
  "formatDiagnosticsWithColorAndContext",
  "getPreEmitDiagnostics",
  "isExportAssignment",
  "isExportDeclaration",
  "isImportDeclaration",
  "isNamespaceImport",
  "transpileModule",
  "canHaveModifiers",
  "getModifiers",
];
const missingFunctions = requiredFunctions.filter((name) => typeof ts[name] !== "function");
const requiredEnumMembers = [
  ["ModuleKind", "CommonJS"],
  ["ModuleKind", "ESNext"],
  ["ModuleResolutionKind", "Bundler"],
  ["ScriptKind", "JS"],
  ["ScriptTarget", "ES2022"],
  ["SyntaxKind", "ExportKeyword"],
];
const missingEnumMembers = requiredEnumMembers
  .filter(([enumName, memberName]) => ts[enumName]?.[memberName] === undefined)
  .map(([enumName, memberName]) => `${enumName}.${memberName}`);

if (missingFunctions.length || missingEnumMembers.length) {
  const missing = [...missingFunctions, ...missingEnumMembers].join(", ");
  throw new TypeError(
    `typescript-legacy-api does not expose the required stable Compiler API members: ${missing}`,
  );
}

module.exports = ts;
