#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const {
  resolvePlaywrightBrowserRuntime,
  runtimeDescription,
} = require("./playwright_browser_runtime");

const DEFAULT_DOWNLOAD_CONNECTION_TIMEOUT_MS = "120000";
const allowedArgs = new Set(["--with-deps"]);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

function pathIsFile(filePath, statSync = fs.statSync) {
  const stat = statSync(filePath, { throwIfNoEntry: false });
  return Boolean(stat?.isFile());
}

function resolvePlaywrightCli(resolveModule = require.resolve, statSync = fs.statSync) {
  let playwrightEntry;
  try {
    playwrightEntry = resolveModule("playwright");
  } catch (_error) {
    throw new Error("Playwright is not installed. Run `npm install` first.");
  }
  const cli = path.join(path.dirname(playwrightEntry), "cli.js");
  if (!pathIsFile(cli, statSync)) {
    throw new Error(`Playwright CLI was not found at: ${cli}`);
  }
  return cli;
}

function resolveManagedChromiumExecutable(requireModule = require) {
  let chromium;
  try {
    ({ chromium } = requireModule("playwright"));
  } catch (_error) {
    throw new Error("Playwright is not installed. Run `npm install` first.");
  }
  return chromium.executablePath();
}

function main() {
  const args = process.argv.slice(2);
  const unknownArgs = args.filter((arg) => !allowedArgs.has(arg));
  if (unknownArgs.length > 0) {
    fail(`Unknown argument(s): ${unknownArgs.join(", ")}`);
    return;
  }

  const withDeps = args.includes("--with-deps");
  let managedExecutablePath;
  try {
    managedExecutablePath = resolveManagedChromiumExecutable();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }

  const runtime = resolvePlaywrightBrowserRuntime({ managedExecutablePath });
  if (runtime.reason === "explicit-missing") {
    fail(runtimeDescription(runtime));
    return;
  }

  // A normal local setup does not need network access when a compatible
  // browser is already available. --with-deps intentionally still runs the
  // Playwright installer because that mode is responsible for OS packages too.
  if (!withDeps && runtime.kind !== "missing") {
    process.stdout.write(`${runtimeDescription(runtime)}\n`);
    if (runtime.kind === "system") {
      process.stdout.write("No Playwright browser download is required for this local machine.\n");
    }
    return;
  }

  let cli;
  try {
    cli = resolvePlaywrightCli();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
    return;
  }

  const env = { ...process.env };
  const configuredTimeout = String(env.PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT || "").trim();
  if (!configuredTimeout) {
    env.PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT = DEFAULT_DOWNLOAD_CONNECTION_TIMEOUT_MS;
  }

  const effectiveTimeout = env.PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT;
  process.stdout.write(`Playwright browser download connection timeout: ${effectiveTimeout} ms\n`);

  const installArgs = [cli, "install"];
  if (withDeps) installArgs.push("--with-deps");
  installArgs.push("chromium");

  const completed = spawnSync(process.execPath, installArgs, {
    cwd: process.cwd(),
    env,
    stdio: "inherit",
    windowsHide: true,
  });

  if (completed.error) {
    fail(`Failed to start Playwright browser installer: ${completed.error.message}`);
    return;
  }
  if (completed.signal) {
    fail(`Playwright browser installer stopped by signal ${completed.signal}.`);
    return;
  }
  if ((completed.status ?? 1) !== 0) {
    process.exitCode = completed.status ?? 1;
  }
}

module.exports = {
  DEFAULT_DOWNLOAD_CONNECTION_TIMEOUT_MS,
  pathIsFile,
  resolveManagedChromiumExecutable,
  resolvePlaywrightCli,
};

if (require.main === module) {
  main();
}
