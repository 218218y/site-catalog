"use strict";

/**
 * Resolve a usable Python 3 interpreter and run a project Python tool safely.
 *
 * By default the requested tool is executed through run_with_project_python.py,
 * which creates/validates the project-managed .venv before delegation. Pass
 * --system only for bootstrap tools that must run before the managed
 * environment exists, such as setup_python_env.py itself.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const MINIMUM_PYTHON = Object.freeze({ major: 3, minor: 10 });

function uniqueCandidates() {
  const candidates = [];
  const seen = new Set();
  const add = (command, prefix = []) => {
    if (!command) return;
    const key = JSON.stringify([command, prefix]);
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ command, prefix });
  };

  add(process.env.PYTHON, []);
  if (process.platform === "win32") {
    add("py", ["-3"]);
    add("python", []);
    add("python3", []);
  } else {
    add("python3", []);
    add("python", []);
  }
  return candidates;
}

function probePython(candidate) {
  const probe = spawnSync(
    candidate.command,
    [
      ...candidate.prefix,
      "-c",
      "import json,sys; print(json.dumps([sys.version_info.major, sys.version_info.minor, sys.executable]))",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      shell: false,
      windowsHide: true,
    },
  );
  if (probe.error || probe.status !== 0) return null;

  try {
    const [major, minor, executable] = JSON.parse((probe.stdout || "").trim());
    if (!Number.isInteger(major) || !Number.isInteger(minor) || typeof executable !== "string") {
      return null;
    }
    if (
      major < MINIMUM_PYTHON.major ||
      (major === MINIMUM_PYTHON.major && minor < MINIMUM_PYTHON.minor)
    ) {
      return null;
    }
    return Object.freeze({ ...candidate, major, minor, executable });
  } catch {
    return null;
  }
}

function resolvePython() {
  for (const candidate of uniqueCandidates()) {
    const resolved = probePython(candidate);
    if (resolved) return resolved;
  }
  throw new Error(
    `Python ${MINIMUM_PYTHON.major}.${MINIMUM_PYTHON.minor}+ was not found. ` +
      "Install Python 3, or set PYTHON to the full interpreter path.",
  );
}

function resolveProjectScript(value) {
  if (!value) throw new Error("A project-relative Python script is required.");
  const resolved = path.resolve(ROOT, value);
  const relative = path.relative(ROOT, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Python tool must be located inside the project directory.");
  }
  if (path.extname(resolved).toLowerCase() !== ".py") {
    throw new Error("Python tool must be a .py file.");
  }
  if (!fs.statSync(resolved, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Python tool does not exist: ${relative}`);
  }
  return { resolved, relative: relative.split(path.sep).join("/") };
}

function buildInvocation({ system = false, script, arguments: forwarded = [] }) {
  const python = resolvePython();
  const projectScript = resolveProjectScript(script);
  if (system) {
    return Object.freeze({
      command: python.command,
      args: [...python.prefix, projectScript.relative, ...forwarded],
      python,
    });
  }
  return Object.freeze({
    command: python.command,
    args: [
      ...python.prefix,
      "tools/run_with_project_python.py",
      projectScript.relative,
      ...forwarded,
    ],
    python,
  });
}

function runInvocation(invocation, options = {}) {
  const completed = spawnSync(invocation.command, invocation.args, {
    cwd: ROOT,
    stdio: options.stdio || "inherit",
    encoding: options.encoding,
    shell: false,
    windowsHide: true,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  if (completed.error) throw completed.error;
  if (completed.signal) {
    console.error(`Python tool stopped by signal ${completed.signal}.`);
    return 1;
  }
  return completed.status ?? 1;
}

function parseArguments(argv) {
  const values = [...argv];
  let system = false;
  if (values[0] === "--system") {
    system = true;
    values.shift();
  }
  const script = values.shift();
  if (values[0] === "--") values.shift();
  return { system, script, arguments: values };
}

function main(argv = process.argv.slice(2)) {
  try {
    const invocation = buildInvocation(parseArguments(argv));
    return runInvocation(invocation);
  } catch (error) {
    console.error(`\nPROJECT PYTHON LAUNCH FAILED: ${error.message}`);
    return 1;
  }
}

module.exports = {
  MINIMUM_PYTHON,
  ROOT,
  buildInvocation,
  main,
  parseArguments,
  probePython,
  resolveProjectScript,
  resolvePython,
  runInvocation,
};

if (require.main === module) {
  process.exitCode = main();
}
