"use strict";

/**
 * Canonical cross-platform command surface for the catalog project.
 *
 * Windows .bat files and the Linux site.sh launcher delegate here so command
 * sequencing, managed-Python behavior and argument forwarding cannot drift
 * between operating systems.
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const { ROOT } = require("./run_project_python.js");

const TASKS = Object.freeze({
  setup: "Install Node/Python dependencies and Playwright Chromium",
  "sync-catalog-pdfs": "Add unregistered PDFs to catalogs.config.json",
  "convert-catalogs": "Convert changed catalogs with the production profile",
  "convert-catalogs-force": "Force conversion of every configured catalog",
  "refresh-ocr-search": "Refresh OCR and search data while preserving page images",
  "r2-preview": "Preview the R2 image synchronization without changing remote files",
  "r2-sync": "Synchronize catalog images to R2",
  "bundle-site-r2": "Validate R2 state and build the deploy/local bundles",
  "deploy-cloudflare": "Validate the existing bundle and deploy it to Cloudflare Pages",
  "configure-r2-cors": "Apply the explicit R2 CORS configuration",
  server: "Serve the existing dist/site-local bundle",
  "server-check": "Check freshness and optionally rebuild before serving",
  "control-panel": "Open the local catalog control panel server",
  "telemetry-report": "Generate and open the telemetry report",
  clean: "Remove safe project caches and obsolete local artifacts",
});

const TASK_ALIASES = Object.freeze({
  build: "bundle-site-r2",
  deploy: "deploy-cloudflare",
  preview: "server",
  "verify-preview": "server-check",
  catalogs: "convert-catalogs",
});

function quote(value) {
  const text = String(value);
  return /[\s"'&|<>()[\]{};$`\\]/u.test(text) ? JSON.stringify(text) : text;
}

function commandText(command, args) {
  return [command, ...args].map(quote).join(" ");
}

function runCommand(command, args, context, options = {}) {
  if (context.dryRun) {
    console.log(`[dry-run] ${commandText(command, args)}`);
    return 0;
  }
  const completed = spawnSync(command, args, {
    cwd: ROOT,
    stdio: "inherit",
    shell: options.shell === true,
    windowsHide: true,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  if (completed.error) {
    console.error(`Failed to start ${command}: ${completed.error.message}`);
    return 1;
  }
  if (completed.signal) {
    console.error(`Command stopped by signal ${completed.signal}: ${commandText(command, args)}`);
    return 1;
  }
  return completed.status ?? 1;
}

function runNode(script, args, context) {
  return runCommand(process.execPath, [script, ...args], context);
}

function runPython(script, args, context, { system = false } = {}) {
  return runNode(
    "tools/run_project_python.js",
    [...(system ? ["--system"] : []), script, ...args],
    context,
  );
}

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function runNpm(args, context) {
  // npm is a .cmd shim on Windows and therefore must be launched through cmd.exe.
  // Arguments here are fixed project setup arguments, never untrusted shell text.
  return runCommand(npmCommand(), args, context, { shell: process.platform === "win32" });
}

function runSteps(steps, context) {
  for (const step of steps) {
    if (step.message) console.log(`\n${step.message}`);
    const status = step.run(context);
    if (status !== 0) return status;
  }
  return 0;
}

function expectedNodeVersion() {
  return fs.readFileSync(path.join(ROOT, ".nvmrc"), "utf8").trim().replace(/^v/u, "");
}

function validateNodeVersion({ allowMismatch = false } = {}) {
  const expected = expectedNodeVersion();
  const actual = process.versions.node;
  const expectedMajor = Number.parseInt(expected.split(".")[0], 10);
  const actualMajor = Number.parseInt(actual.split(".")[0], 10);
  if (expectedMajor !== actualMajor && !allowMismatch) {
    throw new Error(
      `Node.js ${expectedMajor}.x is required by .nvmrc (preferred ${expected}); found ${actual}. ` +
        "Run 'nvm install' and 'nvm use', or pass --allow-node-version-mismatch intentionally.",
    );
  }
  if (actual !== expected) {
    console.warn(`Warning: .nvmrc pins Node.js ${expected}; current runtime is ${actual}.`);
  }
}

function setupTask(arguments_, context) {
  const flags = new Set(arguments_);
  const allowed = new Set([
    "--skip-browsers",
    "--with-browser-deps",
    "--allow-node-version-mismatch",
  ]);
  const unknown = [...flags].filter((flag) => !allowed.has(flag));
  if (unknown.length) {
    console.error(`Unknown setup option(s): ${unknown.join(", ")}`);
    return 2;
  }
  try {
    validateNodeVersion({ allowMismatch: flags.has("--allow-node-version-mismatch") });
  } catch (error) {
    console.error(`\nSETUP FAILED: ${error.message}`);
    return 1;
  }

  const browserArgs = flags.has("--with-browser-deps")
    ? ["run", "setup:browsers:linux"]
    : ["run", "setup:browsers"];
  const steps = [
    {
      message: "Installing the exact Node.js dependency lockfile...",
      run: (ctx) => runNpm(["ci"], ctx),
    },
    {
      message: "Cleaning stale source-tree caches...",
      run: (ctx) => runPython("tools/clean_project_artifacts.py", [], ctx, { system: true }),
    },
    {
      message: "Creating or validating the isolated Python environment...",
      run: (ctx) => runPython("tools/setup_python_env.py", [], ctx, { system: true }),
    },
  ];
  if (!flags.has("--skip-browsers")) {
    steps.push({
      message: flags.has("--with-browser-deps")
        ? "Installing Chromium and its supported Linux system dependencies..."
        : "Installing the Playwright Chromium browser...",
      run: (ctx) => runNpm(browserArgs, ctx),
    });
  }
  const status = runSteps(steps, context);
  if (status === 0) {
    console.log("\nSetup complete. Run './site.sh help' on Linux or keep using the existing .bat files on Windows.");
  }
  return status;
}

function executeTask(task, arguments_, context) {
  const python = (script, fixed = [], options = {}) =>
    runPython(script, [...fixed, ...arguments_], context, options);

  switch (task) {
    case "setup":
      return setupTask(arguments_, context);
    case "sync-catalog-pdfs":
      return python("tools/sync_catalog_pdfs.py");
    case "convert-catalogs":
      return python("tools/build_catalogs.py", ["--profile", "production"]);
    case "convert-catalogs-force":
      return python("tools/build_catalogs.py", ["--profile", "force"]);
    case "refresh-ocr-search":
      return python("tools/build_catalogs.py", ["--profile", "ocr-refresh"]);
    case "r2-preview":
      return python("tools/sync_r2_catalog_images.py", ["--dry-run"]);
    case "r2-sync":
      return python("tools/sync_r2_catalog_images.py");
    case "bundle-site-r2":
      return runSteps([
        {
          message: "Checking the recorded R2 image release...",
          run: (ctx) => runPython("tools/verify_r2_catalog_sync_state.py", [], ctx),
        },
        {
          message: "Building the validated Cloudflare Pages and local-preview bundles...",
          run: (ctx) => runPython("tools/build_deploy_bundle.py", [
            "--out", "dist/site-upload-r2",
            "--seo-mode", "private",
            "--external-assets-url", "https://cdn.bargig-furniture.com",
            "--skip-if-current",
            "--mirror-to", "dist/site-local",
            "--clean-legacy-artifacts",
            ...arguments_,
          ], ctx),
        },
        {
          message: "Cleaning safe local artifacts after the build...",
          run: (ctx) => runPython("tools/clean_project_artifacts.py", [], ctx, { system: true }),
        },
      ], context);
    case "deploy-cloudflare":
      return runSteps([
        {
          message: "Checking the recorded R2 image release...",
          run: (ctx) => runPython("tools/verify_r2_catalog_sync_state.py", [], ctx),
        },
        {
          message: "Verifying exact versioned image URLs through the public CDN...",
          run: (ctx) => runPython("tools/verify_remote_catalog_assets.py", [
            "--base-url", "https://cdn.bargig-furniture.com",
            "--versioned",
            "--workers", "8",
            "--retries", "4",
            "--retry-workers", "3",
            "--allow-small-transient-network-failures",
          ], ctx),
        },
        {
          message: "Validating and deploying the existing bundle without rebuilding...",
          run: (ctx) => runPython("tools/deploy_cloudflare_pages.py", [
            "--dir", "dist/site-upload-r2",
            "--seo-mode", "private",
            ...arguments_,
          ], ctx),
        },
      ], context);
    case "configure-r2-cors":
      return python("tools/deploy_cloudflare_pages.py", ["--cors-only"]);
    case "server":
      return python("tools/serve_site.py", ["--port", "8080"]);
    case "server-check":
      return python("tools/serve_site.py", ["--port", "8080", "--ensure-current", "ask"]);
    case "control-panel":
      return python("tools/catalog_control_server.py");
    case "telemetry-report":
      return python("tools/telemetry_report.py", ["--open"]);
    case "clean":
      return runPython("tools/clean_project_artifacts.py", arguments_, context, { system: true });
    default:
      console.error(`Unknown task: ${task}`);
      return 2;
  }
}

function printHelp() {
  console.log("Usage: ./site.sh [--dry-run] <task> [task arguments]");
  console.log("       node tools/project_tasks.js [--dry-run] <task> [task arguments]\n");
  console.log("Tasks:");
  const width = Math.max(...Object.keys(TASKS).map((name) => name.length));
  for (const [name, description] of Object.entries(TASKS)) {
    console.log(`  ${name.padEnd(width)}  ${description}`);
  }
  console.log("\nUseful examples:");
  console.log("  ./setup-linux.sh");
  console.log("  ./setup-linux.sh --with-browser-deps");
  console.log("  ./site.sh convert-catalogs");
  console.log("  ./site.sh r2-sync --no-delete");
  console.log("  ./site.sh deploy-cloudflare --preview-branch test-name");
  console.log("  npm test");
  console.log("  npm run verify");
}

function parseCommandLine(argv) {
  const values = [...argv];
  const context = { dryRun: false };
  while (values[0] === "--dry-run") {
    context.dryRun = true;
    values.shift();
  }
  const requested = values.shift();
  if (!requested || requested === "help" || requested === "--help" || requested === "-h") {
    return { help: true, context, task: null, arguments: [] };
  }
  const task = TASK_ALIASES[requested] || requested;
  if (values[0] === "--") values.shift();
  return { help: false, context, task, arguments: values };
}

function main(argv = process.argv.slice(2)) {
  const parsed = parseCommandLine(argv);
  if (parsed.help) {
    printHelp();
    return 0;
  }
  if (!Object.hasOwn(TASKS, parsed.task)) {
    console.error(`Unknown task: ${parsed.task}\n`);
    printHelp();
    return 2;
  }
  return executeTask(parsed.task, parsed.arguments, parsed.context);
}

module.exports = {
  TASKS,
  TASK_ALIASES,
  executeTask,
  expectedNodeVersion,
  main,
  parseCommandLine,
  printHelp,
  validateNodeVersion,
};

if (require.main === module) {
  process.exitCode = main();
}
