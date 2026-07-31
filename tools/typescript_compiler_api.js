"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const compilerEntry = path.join(projectRoot, "node_modules", "typescript", "bin", "tsc");

/**
 * Run the TypeScript 7 native compiler through its supported command-line
 * boundary. TypeScript 7.0 intentionally does not expose the JavaScript
 * Compiler API, so project tooling must not import `typescript` as a library.
 *
 * @param {string[]} args
 * @param {{cwd?:string, maxBuffer?:number}} [options]
 */
function runTypeScriptCompiler(args, options = {}) {
  if (!fs.existsSync(compilerEntry)) {
    throw new Error(
      "TypeScript 7 is not installed. Run `npm ci` before executing project tools.",
    );
  }

  const completed = spawnSync(process.execPath, [compilerEntry, ...args], {
    cwd: options.cwd || projectRoot,
    encoding: "utf8",
    maxBuffer: options.maxBuffer || 16 * 1024 * 1024,
    windowsHide: true,
  });

  if (completed.error) {
    throw new Error("Could not start the TypeScript 7 compiler.", {
      cause: completed.error,
    });
  }
  if (completed.signal) {
    throw new Error(`TypeScript 7 was terminated by signal ${completed.signal}.`);
  }

  return Object.freeze({
    status: completed.status ?? 1,
    stdout: completed.stdout || "",
    stderr: completed.stderr || "",
    output: [completed.stdout, completed.stderr].filter(Boolean).join("\n"),
  });
}

/**
 * Extract numeric TypeScript diagnostic codes from non-pretty compiler output.
 *
 * @param {string} output
 * @returns {number[]}
 */
function extractDiagnosticCodes(output) {
  return Array.from(String(output || "").matchAll(/\berror TS(\d+):/g), (match) => Number(match[1]));
}

module.exports = {
  extractDiagnosticCodes,
  runTypeScriptCompiler,
};
