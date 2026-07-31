"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "site catalog-בדיקה-\u200f\u200f-"));

function write(relativePath, content) {
  const target = path.join(fixtureRoot, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

try {
  fs.mkdirSync(path.join(fixtureRoot, "tools"), { recursive: true });
  fs.copyFileSync(
    path.join(root, "tools", "check_node_install_scripts.js"),
    path.join(fixtureRoot, "tools", "check_node_install_scripts.js"),
  );
  fs.copyFileSync(
    path.join(root, "tools", "run_project_python.js"),
    path.join(fixtureRoot, "tools", "run_project_python.js"),
  );
  write("tools/python_probe.py", 'print("python-launcher-ok")\n');
  write("package.json", JSON.stringify({
    devDependencies: { wrangler: "4.112.0" },
    allowScripts: { esbuild: true, sharp: true, workerd: true },
  }));
  write("package-lock.json", JSON.stringify({
    packages: {
      "node_modules/esbuild": { version: "0.28.1" },
      "node_modules/sharp": { version: "0.34.5" },
      "node_modules/workerd": { version: "1.20260714.1" },
    },
  }));
  write(
    "node_modules/esbuild/index.js",
    'exports.transformSync = () => ({ code: "const value = 2;" });\n',
  );
  write(
    "node_modules/sharp/index.js",
    'function sharp() {}\nsharp.versions = { sharp: "0.34.5" };\nmodule.exports = sharp;\n',
  );
  write(
    "node_modules/wrangler/package.json",
    JSON.stringify({ bin: { wrangler: "bin/wrangler.js" } }),
  );
  write("node_modules/wrangler/bin/wrangler.js", 'console.log("4.112.0");\n');

  const completed = spawnSync(
    process.execPath,
    [path.join(fixtureRoot, "tools", "check_node_install_scripts.js")],
    {
      cwd: fixtureRoot,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    },
  );

  assert.equal(
    completed.status,
    0,
    `toolchain check failed in a Unicode path:\n${completed.stderr}\n${completed.stdout}`,
  );
  assert.match(completed.stdout, /Node install-script runtimes verified/);
  assert.match(completed.stdout, /wrangler 4\.112\.0/);

  const pythonCompleted = spawnSync(
    process.execPath,
    [path.join(fixtureRoot, "tools", "run_project_python.js"), "--system", "tools/python_probe.py"],
    {
      cwd: fixtureRoot,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    },
  );
  assert.equal(
    pythonCompleted.status,
    0,
    `Python launcher failed in a Unicode path:\n${pythonCompleted.stderr}\n${pythonCompleted.stdout}`,
  );
  assert.match(pythonCompleted.stdout, /python-launcher-ok/);
} finally {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
}

console.log("node_toolchain_path_compatibility.test.js: PASS");
