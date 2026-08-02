"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const INVENTORY_TOOL = path.join(PROJECT_ROOT, "tools", "frontend_ast_inventory.js");

function normalizeRelative(root, filename) {
  const resolved = path.resolve(root, filename);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`AST source must be inside the project root: ${filename}`);
  }
  return relative.split(path.sep).join("/");
}

function runInventoryRequest(request) {
  const completed = spawnSync(process.execPath, [INVENTORY_TOOL], {
    cwd: PROJECT_ROOT,
    input: JSON.stringify(request),
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    windowsHide: true,
  });
  if (completed.error) throw completed.error;
  if (completed.status !== 0) {
    const detail = (completed.stderr || completed.stdout || "AST inventory failed").trim();
    const syntax = detail.includes("SyntaxError") || /:\d+:\s/.test(detail);
    const error = syntax ? new SyntaxError(detail) : new Error(detail);
    throw error;
  }
  try {
    return JSON.parse(completed.stdout || "{}");
  } catch (error) {
    throw new Error("TypeScript 7 AST inventory returned invalid JSON", { cause: error });
  }
}

function inventoryProjectFiles(root, filenames, project = "jsconfig.json") {
  const resolvedRoot = path.resolve(root);
  const files = filenames.map((filename) => normalizeRelative(resolvedRoot, filename));
  return runInventoryRequest({ root: resolvedRoot, project, files });
}

function inventorySources(sources) {
  const entries = Object.entries(sources);
  if (!entries.length) return {};
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "site-catalog-ast-"));
  try {
    const files = entries.map(([filename, source]) => {
      const relative = normalizeRelative(root, filename);
      const target = path.join(root, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, source, "utf8");
      return relative;
    });
    fs.writeFileSync(
      path.join(root, "jsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          allowJs: true,
          checkJs: false,
          noEmit: true,
          target: "ES2022",
          module: "ESNext",
          moduleResolution: "Bundler",
          types: [],
        },
        files,
      }),
      "utf8",
    );
    return runInventoryRequest({ root, project: "jsconfig.json", files });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function inventorySource(sourceText, filename = "source.js") {
  const normalized = filename.replaceAll("\\", "/");
  return inventorySources({ [normalized]: sourceText })[normalized];
}

function findCalls(inventory, callee) {
  return inventory.calls.filter((call) => call.callee === callee);
}

function hasPropertyPath(inventory, propertyPath) {
  return inventory.propertyAccesses.some((access) => access.path === propertyPath);
}

module.exports = {
  findCalls,
  hasPropertyPath,
  inventoryProjectFiles,
  inventorySource,
  inventorySources,
};
