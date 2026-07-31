"use strict";

const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const esbuild = require("esbuild");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src", "js");

/**
 * Compile one complete source-owned ES module as a CommonJS test harness.
 * esbuild is already the production bundler, so tests exercise the same parser
 * and JavaScript lowering boundary instead of depending on a legacy TypeScript
 * Compiler API. Production integration is separately verified through the real
 * route bundles.
 *
 * @param {string} source
 * @param {string} filename
 */
function compileFrontendModuleForTest(source, filename) {
  try {
    return esbuild.transformSync(source, {
      sourcefile: filename,
      loader: "js",
      format: "cjs",
      platform: "node",
      target: "es2022",
      legalComments: "none",
      sourcemap: false,
    }).code;
  } catch (error) {
    throw new Error(`Could not compile frontend test module ${filename}.`, {
      cause: error,
    });
  }
}

/**
 * Resolve one named test port lazily from globalThis. Function ports remain
 * live bindings so tests may replace them after the owner module is loaded.
 *
 * @param {string} name
 */
function frontendTestPort(name) {
  const hasOwnPort = Object.prototype.hasOwnProperty.call(globalThis, name);
  if (hasOwnPort && typeof globalThis[name] !== "function") return globalThis[name];

  const callable = function (...args) {
    const target = globalThis[name];
    if (typeof target !== "function") throw new TypeError(`Missing frontend test port: ${name}`);
    return Reflect.apply(target, this, args);
  };

  return new Proxy(callable, {
    get(_target, property) {
      return globalThis[name]?.[property];
    },
    set(_target, property, value) {
      if (globalThis[name] == null) globalThis[name] = {};
      globalThis[name][property] = value;
      return true;
    },
    apply(_target, thisArg, args) {
      const target = globalThis[name];
      if (typeof target !== "function") throw new TypeError(`Missing frontend test port: ${name}`);
      return Reflect.apply(target, thisArg, args);
    },
    construct(_target, args, newTarget) {
      const target = globalThis[name];
      if (typeof target !== "function") throw new TypeError(`Missing frontend test port: ${name}`);
      return Reflect.construct(target, args, newTarget);
    },
  });
}

/**
 * Build a virtual CommonJS dependency namespace for transformed static imports.
 * Source tests intentionally resolve imports by exported symbol name rather than
 * loading neighboring production modules, preserving explicit test ports.
 */
function createFrontendTestPortModule() {
  return new Proxy(Object.create(null), {
    get(_target, property) {
      if (property === "__esModule") return true;
      if (property === Symbol.toStringTag) return "Module";
      return frontendTestPort(String(property));
    },
    has(_target, property) {
      return property === "__esModule" || Object.prototype.hasOwnProperty.call(globalThis, property);
    },
    ownKeys() {
      return Array.from(new Set(["__esModule", "default", ...Object.getOwnPropertyNames(globalThis)]));
    },
    getOwnPropertyDescriptor(_target, property) {
      if (property === "__esModule") {
        return { configurable: true, enumerable: false, value: true };
      }
      if (typeof property === "symbol") return undefined;
      return {
        configurable: true,
        enumerable: true,
        value: frontendTestPort(property),
      };
    },
  });
}

/**
 * Load an explicit source-owned test API without extracting or copying
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
    testModule.require = () => createFrontendTestPortModule();
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
 * Import a standalone dependency-free ESM owner under src/runtime. esbuild
 * performs the ESM-to-CommonJS lowering through the same supported transform
 * API already used by this project.
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
  const compiledSource = compileFrontendModuleForTest(source, absolutePath);
  if (/\brequire\s*\(/.test(compiledSource)) {
    throw new Error(`Standalone runtime module must not have source imports: ${relativePath}`);
  }

  const runtimeModule = new Module(`${absolutePath}.test-runtime`, module);
  runtimeModule.filename = absolutePath;
  runtimeModule.paths = Module._nodeModulePaths(path.dirname(absolutePath));
  runtimeModule._compile(compiledSource, absolutePath);
  return runtimeModule.exports;
}

module.exports = { compileFrontendModuleForTest, importFrontendTestModule, importStandaloneRuntimeModule };
