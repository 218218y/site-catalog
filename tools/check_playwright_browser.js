#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

const args = new Set(process.argv.slice(2));
const unknownArgs = [...args].filter((arg) => arg !== "--launch");

function setupCommand() {
  return process.platform === "linux" ? "npm run setup:browsers:linux" : "npm run setup:browsers";
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write(`Run \`${setupCommand()}\` once, then retry.\n`);
  process.exitCode = 1;
}

function errorMessage(error) {
  if (error instanceof Error) return error.stack || error.message;
  return String(error);
}

async function main() {
  if (unknownArgs.length > 0) {
    fail(`Unknown argument(s): ${unknownArgs.join(", ")}`);
    return;
  }

  let chromium;
  try {
    ({ chromium } = require("@playwright/test"));
  } catch (_error) {
    fail("Playwright is not installed. Run `npm install` first.");
    return;
  }

  const override = String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "").trim();
  const executable = override || chromium.executablePath();
  if (!executable || !fs.existsSync(executable)) {
    fail(`Playwright Chromium is not available at: ${executable || "unknown path"}`);
    return;
  }

  process.stdout.write(`Playwright Chromium: ${executable}\n`);
  if (!args.has("--launch")) return;

  const launchOptions = {
    headless: true,
    args: ["--disable-dev-shm-usage"]
  };
  if (override) {
    launchOptions.executablePath = override;
    launchOptions.args.push("--no-sandbox");
  }

  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    fail(`Playwright Chromium exists but failed to launch:\n${errorMessage(error)}`);
    return;
  }

  try {
    process.stdout.write("Playwright Chromium launch: OK\n");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  fail(`Unexpected Playwright browser check failure:\n${errorMessage(error)}`);
});
