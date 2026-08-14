"use strict";

const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const esbuild = require("esbuild");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const FRONTEND_SOURCE_ROOTS = Object.freeze([
  path.join(PROJECT_ROOT, "src", "js"),
  path.join(PROJECT_ROOT, "src", "runtime"),
]);

/**
 * Compile one complete browser ES module as CommonJS for Node-owned behavior
 * tests. esbuild is the production parser/lowering boundary; tests therefore
 * execute the owner's real named exports instead of a parallel test registry.
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
    throw new Error(`Could not compile frontend module ${filename} for test execution.`, {
      cause: error,
    });
  }
}

/**
 * Resolve one named dependency port lazily from globalThis. Function ports stay
 * live bindings so a fixture may replace a dependency after the owner loads.
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
 * Build the virtual CommonJS dependency namespace consumed by transformed
 * static imports. Dependencies remain explicit fixture ports while the module
 * under test is always the complete production owner.
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

/** @param {string} relativePath */
function resolveFrontendSourcePath(relativePath) {
  const absolutePath = path.resolve(PROJECT_ROOT, relativePath);
  const insideApprovedRoot = FRONTEND_SOURCE_ROOTS.some(
    (sourceRoot) => absolutePath === sourceRoot || absolutePath.startsWith(`${sourceRoot}${path.sep}`),
  );
  if (!insideApprovedRoot) {
    throw new Error(`Frontend test modules must live under src/js or src/runtime: ${relativePath}`);
  }
  return absolutePath;
}

/**
 * Import one complete browser source owner and return its real ES module
 * exports. Static imports are supplied by explicit fixture ports from globals;
 * production graph validation separately proves the reviewed browser graph.
 *
 * @param {string} relativePath
 * @param {Record<string, unknown>} [globals]
 */
function importFrontendModule(relativePath, globals = {}) {
  for (const [name, value] of Object.entries(globals)) {
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
  }

  const absolutePath = resolveFrontendSourcePath(relativePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  const compiledSource = compileFrontendModuleForTest(source, absolutePath);
  const testModule = new Module(`${absolutePath}.test-harness`, module);
  testModule.filename = absolutePath;
  testModule.paths = Module._nodeModulePaths(path.dirname(absolutePath));
  testModule.require = () => createFrontendTestPortModule();
  testModule._compile(compiledSource, absolutePath);
  return testModule.exports;
}

module.exports = { compileFrontendModuleForTest, importFrontendModule };
