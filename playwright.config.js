"use strict";

const { defineConfig, chromium } = require("@playwright/test");
const {
  applyRuntimeToLaunchOptions,
  resolvePlaywrightBrowserRuntime,
  runtimeDescription,
} = require("./tools/playwright_browser_runtime");

const browserRuntime = resolvePlaywrightBrowserRuntime({
  managedExecutablePath: chromium.executablePath(),
});
if (browserRuntime.reason === "explicit-missing") {
  throw new Error(runtimeDescription(browserRuntime));
}
const launchOptions = applyRuntimeToLaunchOptions({
  args: ["--disable-dev-shm-usage"],
}, browserRuntime);

// E2E reuses the same validated private artifact as .05-start-server.bat. The
// currentness check is normally instant; a first or stale build can still take
// noticeably longer on Windows, so keep startup separate from per-test timeouts.
const webServerStartupTimeout = 5 * 60_000;

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
    contextOptions: {
      reducedMotion: "reduce"
    },
    actionTimeout: 7_000,
    navigationTimeout: 15_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
    launchOptions
  },
  webServer: {
    command: "npm run build:e2e && node tools/e2e_server.js --port 4173 --root dist/site-local",
    url: "http://127.0.0.1:4173/",
    reuseExistingServer: !process.env.CI,
    timeout: webServerStartupTimeout
  }
});
