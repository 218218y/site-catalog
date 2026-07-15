#!/usr/bin/env node
"use strict";

const fs = require("node:fs");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.stderr.write("Run `npm run setup:browsers` once, then retry.\n");
  process.exit(1);
}

let chromium;
try {
  ({ chromium } = require("@playwright/test"));
} catch (_error) {
  fail("Playwright is not installed. Run `npm install` first.");
}

const override = String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "").trim();
const executable = override || chromium.executablePath();
if (!executable || !fs.existsSync(executable)) {
  fail(`Playwright Chromium is not available at: ${executable || "unknown path"}`);
}

process.stdout.write(`Playwright Chromium: ${executable}\n`);
