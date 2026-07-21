"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

if (process.platform !== "linux") {
  console.error("Visual snapshot baselines are canonical Linux Chromium artifacts.");
  console.error("Update them in Ubuntu/WSL or through the GitHub Actions environment, not on Windows or macOS.");
  process.exit(1);
}

const cli = path.join(__dirname, "..", "node_modules", "@playwright", "test", "cli.js");
if (!fs.existsSync(cli)) {
  console.error("Playwright is not installed. Run npm ci first.");
  process.exit(1);
}

const result = spawnSync(process.execPath, [cli, "test", "--update-snapshots"], {
  cwd: path.join(__dirname, ".."),
  env: { ...process.env, PLAYWRIGHT_VISUAL_BASELINE: "1" },
  stdio: "inherit"
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
