"use strict";

const fs = require("node:fs");
const path = require("node:path");

const WINDOWS_CHANNELS = Object.freeze([
  { channel: "chrome", name: "Google Chrome", suffix: ["Google", "Chrome", "Application", "chrome.exe"] },
  { channel: "msedge", name: "Microsoft Edge", suffix: ["Microsoft", "Edge", "Application", "msedge.exe"] },
]);

const DARWIN_CHANNELS = Object.freeze([
  {
    channel: "chrome",
    name: "Google Chrome",
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  },
  {
    channel: "msedge",
    name: "Microsoft Edge",
    executablePath: "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  },
]);

function pathIsFile(filePath, statSync = fs.statSync) {
  if (!filePath) return false;
  try {
    const stat = statSync(filePath, { throwIfNoEntry: false });
    return Boolean(stat?.isFile());
  } catch (_error) {
    return false;
  }
}

function truthyEnvironmentValue(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Boolean(normalized) && !["0", "false", "no", "off"].includes(normalized);
}

function windowsRoots(env) {
  const roots = [
    env.LOCALAPPDATA,
    env.PROGRAMFILES,
    env["PROGRAMFILES(X86)"],
  ];
  const homeDrive = String(env.HOMEDRIVE || "").trim();
  if (homeDrive) {
    roots.push(path.win32.join(homeDrive, "Program Files"));
    roots.push(path.win32.join(homeDrive, "Program Files (x86)"));
  }
  return [...new Set(roots.map((value) => String(value || "").trim()).filter(Boolean))];
}

function localBrowserCandidates(platform = process.platform, env = process.env) {
  if (platform === "win32") {
    const candidates = [];
    for (const browser of WINDOWS_CHANNELS) {
      for (const root of windowsRoots(env)) {
        candidates.push({
          channel: browser.channel,
          name: browser.name,
          executablePath: path.win32.join(root, ...browser.suffix),
        });
      }
    }
    return candidates;
  }
  if (platform === "darwin") return DARWIN_CHANNELS.map((browser) => ({ ...browser }));
  return [];
}

function findLocalSystemBrowser({
  platform = process.platform,
  env = process.env,
  statSync = fs.statSync,
} = {}) {
  for (const candidate of localBrowserCandidates(platform, env)) {
    if (pathIsFile(candidate.executablePath, statSync)) return candidate;
  }
  return null;
}

function resolvePlaywrightBrowserRuntime({
  managedExecutablePath = "",
  env = process.env,
  platform = process.platform,
  statSync = fs.statSync,
} = {}) {
  const explicitExecutablePath = String(env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "").trim();
  if (explicitExecutablePath) {
    if (pathIsFile(explicitExecutablePath, statSync)) {
      return {
        kind: "explicit",
        executablePath: explicitExecutablePath,
      };
    }
    return {
      kind: "missing",
      reason: "explicit-missing",
      expectedPath: explicitExecutablePath,
    };
  }

  const managed = String(managedExecutablePath || "").trim();
  if (managed && pathIsFile(managed, statSync)) {
    return {
      kind: "managed",
      executablePath: managed,
    };
  }

  // Keep CI pinned to Playwright's managed Chromium for reproducibility and
  // canonical Linux visual baselines. Local Windows/macOS runs may use an
  // already-installed branded browser when the CDN-hosted bundle is absent.
  if (!truthyEnvironmentValue(env.CI)) {
    const localBrowser = findLocalSystemBrowser({ platform, env, statSync });
    if (localBrowser) {
      return {
        kind: "system",
        channel: localBrowser.channel,
        name: localBrowser.name,
        executablePath: localBrowser.executablePath,
      };
    }
  }

  return {
    kind: "missing",
    reason: "no-browser",
    expectedPath: managed,
  };
}

function applyRuntimeToLaunchOptions(launchOptions, runtime) {
  if (runtime.kind === "explicit") {
    launchOptions.executablePath = runtime.executablePath;
    launchOptions.args = [...(launchOptions.args || []), "--no-sandbox"];
  } else if (runtime.kind === "system") {
    launchOptions.channel = runtime.channel;
  }
  return launchOptions;
}

function runtimeDescription(runtime) {
  if (runtime.kind === "managed") return `Playwright Chromium: ${runtime.executablePath}`;
  if (runtime.kind === "explicit") return `Playwright Chromium override: ${runtime.executablePath}`;
  if (runtime.kind === "system") {
    return `Playwright local browser fallback: ${runtime.name} (${runtime.channel}) at ${runtime.executablePath}`;
  }
  if (runtime.reason === "explicit-missing") {
    return `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH does not point to a file: ${runtime.expectedPath}`;
  }
  return `Playwright managed Chromium is not available at: ${runtime.expectedPath || "unknown path"}`;
}

module.exports = {
  applyRuntimeToLaunchOptions,
  findLocalSystemBrowser,
  localBrowserCandidates,
  pathIsFile,
  resolvePlaywrightBrowserRuntime,
  runtimeDescription,
  truthyEnvironmentValue,
  windowsRoots,
};
