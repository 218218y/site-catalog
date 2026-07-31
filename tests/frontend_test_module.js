"use strict";

const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src", "js");

const ts = require("../tools/typescript_compiler_api.js");

/**
 * Compile one complete source-owned ES module as a CommonJS test harness.
 * Static imports are replaced by same-named explicit test ports on globalThis;
 * no function bodies are extracted and no production implementation is copied.
 * Production integration is separately verified through the real route bundles.
 *
 * @param {string} source
 * @param {string} filename
 */
function compileFrontendModuleForTest(source, filename) {
  const sourceFile = ts.createSourceFile(filename, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  /** @type {{start:number,end:number,text:string}[]} */
  const edits = [];

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const portDeclarations = [];
      if (clause?.name) portDeclarations.push(`const ${clause.name.text} = __frontendTestPort("default");`);
      if (clause?.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) {
          portDeclarations.push(`const ${clause.namedBindings.name.text} = __frontendTestPort("default");`);
        } else {
          for (const element of clause.namedBindings.elements) {
            const imported = element.propertyName?.text || element.name.text;
            portDeclarations.push(`const ${element.name.text} = __frontendTestPort(${JSON.stringify(imported)});`);
          }
        }
      }
      edits.push({
        start: statement.getFullStart(),
        end: statement.end,
        text: portDeclarations.length ? `\n${portDeclarations.join("\n")}` : "",
      });
      continue;
    }
    if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) {
      edits.push({ start: statement.getFullStart(), end: statement.end, text: "" });
      continue;
    }
    const modifiers = ts.canHaveModifiers(statement) ? ts.getModifiers(statement) : undefined;
    const exportModifier = modifiers?.find((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword);
    if (exportModifier) {
      edits.push({ start: exportModifier.getStart(sourceFile), end: exportModifier.end, text: "" });
    }
  }

  let transformed = source;
  for (const edit of edits.sort((left, right) => right.start - left.start)) {
    transformed = transformed.slice(0, edit.start) + edit.text + transformed.slice(edit.end);
  }
  const portHelper = `
function __frontendTestPort(name) {
  const hasOwnPort = Object.prototype.hasOwnProperty.call(globalThis, name);
  if (hasOwnPort && typeof globalThis[name] !== "function") return globalThis[name];
  const callable = function (...args) {
    const target = globalThis[name];
    if (typeof target !== "function") throw new TypeError("Missing frontend test port: " + name);
    return Reflect.apply(target, this, args);
  };
  return new Proxy(callable, {
    get(_target, property) { return globalThis[name]?.[property]; },
    set(_target, property, value) {
      if (globalThis[name] == null) globalThis[name] = {};
      globalThis[name][property] = value;
      return true;
    },
    apply(_target, thisArg, args) {
      const target = globalThis[name];
      if (typeof target !== "function") throw new TypeError("Missing frontend test port: " + name);
      return Reflect.apply(target, thisArg, args);
    },
    construct(_target, args, newTarget) {
      const target = globalThis[name];
      if (typeof target !== "function") throw new TypeError("Missing frontend test port: " + name);
      return Reflect.construct(target, args, newTarget);
    }
  });
}
`;
  return `${portHelper}\n${transformed}`;
}

/**
 * Load an explicit source-owned test API without parsing out or evaluating
 * individual functions. The whole owner module remains the implementation under
 * test, while imported dependencies are supplied as explicit test ports.
 *
 * @param {string} relativePath
 * @param {string} exportKey
 * @param {Record<string, unknown>} [globals]
 */
function importFrontendTestModule(relativePath, exportKey, globals = {}) {
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }

  const absolutePath = path.resolve(PROJECT_ROOT, relativePath);
  if (absolutePath !== SOURCE_ROOT && !absolutePath.startsWith(`${SOURCE_ROOT}${path.sep}`)) {
    throw new Error(`Frontend test modules must live under src/js: ${relativePath}`);
  }

  const registry = Object.create(null);
  Object.defineProperty(globalThis, "__BARGIG_TEST_EXPORTS__", {
    value: registry,
    writable: true,
    configurable: true,
  });

  try {
    const source = fs.readFileSync(absolutePath, "utf8");
    const compiledSource = compileFrontendModuleForTest(source, absolutePath);
    const testModule = new Module(`${absolutePath}.test-harness`, module);
    testModule.filename = absolutePath;
    testModule.paths = Module._nodeModulePaths(path.dirname(absolutePath));
    testModule._compile(compiledSource, absolutePath);
  } finally {
    delete globalThis.__BARGIG_TEST_EXPORTS__;
  }

  const api = registry[exportKey];
  if (!api || typeof api !== "object") {
    throw new Error(`Source module ${relativePath} did not register test API ${exportKey}`);
  }
  return api;
}

/**
 * Import a standalone source ES module through TypeScript's CommonJS
 * transpilation. This is reserved for dependency-free runtime owners under
 * src/runtime; route integration is still verified against the real ESM
 * bundles and deployment artifact.
 *
 * @param {string} relativePath
 * @param {Record<string, unknown>} [globals]
 */
function importStandaloneRuntimeModule(relativePath, globals = {}) {
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }

  const runtimeRoot = path.join(PROJECT_ROOT, "src", "runtime");
  const absolutePath = path.resolve(PROJECT_ROOT, relativePath);
  if (absolutePath !== runtimeRoot && !absolutePath.startsWith(`${runtimeRoot}${path.sep}`)) {
    throw new Error(`Standalone runtime test modules must live under src/runtime: ${relativePath}`);
  }

  const source = fs.readFileSync(absolutePath, "utf8");
  const sourceFile = ts.createSourceFile(absolutePath, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  if (sourceFile.statements.some((statement) => ts.isImportDeclaration(statement))) {
    throw new Error(`Standalone runtime module must not have source imports: ${relativePath}`);
  }
  const transpiled = ts.transpileModule(source, {
    fileName: absolutePath,
    reportDiagnostics: true,
    compilerOptions: {
      allowJs: true,
      checkJs: false,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  });
  if (transpiled.diagnostics?.length) {
    const diagnostics = ts.formatDiagnosticsWithColorAndContext(transpiled.diagnostics, {
      getCanonicalFileName: (name) => name,
      getCurrentDirectory: () => PROJECT_ROOT,
      getNewLine: () => "\n",
    });
    throw new Error(`Could not transpile runtime module ${relativePath}:\n${diagnostics}`);
  }

  const runtimeModule = new Module(`${absolutePath}.test-runtime`, module);
  runtimeModule.filename = absolutePath;
  runtimeModule.paths = Module._nodeModulePaths(path.dirname(absolutePath));
  runtimeModule._compile(transpiled.outputText, absolutePath);
  return runtimeModule.exports;
}

module.exports = { compileFrontendModuleForTest, importFrontendTestModule, importStandaloneRuntimeModule };
