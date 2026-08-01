#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { inventorySource } = require("../tests/helpers/frontend_ast.js");

function main() {
  const request = JSON.parse(fs.readFileSync(0, "utf8"));
  const root = path.resolve(request.root || process.cwd());
  const files = Array.isArray(request.files) ? request.files : [];
  const result = Object.create(null);
  for (const relative of files) {
    const filename = path.resolve(root, relative);
    const normalized = path.relative(root, filename).split(path.sep).join("/");
    if (normalized.startsWith("../") || path.isAbsolute(normalized)) {
      throw new Error(`AST inventory path escapes project root: ${relative}`);
    }
    result[normalized] = inventorySource(fs.readFileSync(filename, "utf8"), normalized);
  }
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

try {
  main();
} catch (error) {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
}
