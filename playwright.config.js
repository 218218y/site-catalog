"use strict";

const fs = require("node:fs");
const { defineConfig } = require("@playwright/test");

const explicitExecutable = String(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "").trim();
const launchOptions = {
  args: ["--disable-dev-shm-usage"]
};
// The web-server startup includes a first-time static build. The generated SEO
// route graph can take noticeably longer on Windows than on a warm Linux CI
// runner, so keep this separate from the per-test timeout.
const webServerStartupTimeout = 5 * 60_000;
if (explicitExecutable && fs.existsSync(explicitExecutable)) {
  launchOptions.executablePath = explicitExecutable;
  launchOptions.args.push("--no-sandbox");
}

module.exports = defineConfig({
  testDir: "./tests/e2e",
  outputDir: ".artifacts/playwright-results",
  snapshotPathTemplate: "{testDir}/__screenshots__/{arg}{ext}",
  timeout: 30_000,
  expect: {
    timeout: 7_000,
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
      maxDiffPixelRatio: 0.04,
      scale: "css"
    }
  },
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: [
    ["line"],
    ["html", { outputFolder: ".artifacts/playwright-report", open: "never" }]
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    browserName: "chromium",
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    viewport: { width: 1440, height: 900 },
    colorScheme: "light",
    reducedMotion: "reduce",
    actionTimeout: 7_000,
    navigationTimeout: 15_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    launchOptions
  },
  webServer: {
    command: "npm run build:e2e && node tools/e2e_server.js --port 4173 --root dist/site-e2e",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: webServerStartupTimeout
  }
});
