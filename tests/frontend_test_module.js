"use strict";

const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(PROJECT_ROOT, "src", "js");

/**
 * Load an explicit source-owned test API without parsing or evaluating source
 * fragments. Production builds strip the registry block from every bundle.
 *
 * The source file itself remains the single implementation under test; this
 * loader only supplies declared globals and captures its intentionally narrow
 * test API before removing the registry from the process.
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
    configurable: true
  });

  try {
    const resolvedPath = require.resolve(absolutePath);
    delete require.cache[resolvedPath];
    require(resolvedPath);
  } finally {
    delete globalThis.__BARGIG_TEST_EXPORTS__;
  }

  const api = registry[exportKey];
  if (!api || typeof api !== "object") {
    throw new Error(`Source module ${relativePath} did not register test API ${exportKey}`);
  }
  return api;
}

module.exports = { importFrontendTestModule };
