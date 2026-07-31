"use strict";

/**
 * Install and verify the system Tesseract runtime used by catalog OCR on
 * Debian/Ubuntu Linux. The project intentionally keeps this separate from the
 * Python virtual environment because Tesseract and its language data are OS
 * packages, not Python modules.
 */
const { spawnSync } = require("node:child_process");

const REQUIRED_LANGUAGES = Object.freeze(["eng", "heb"]);
const APT_PACKAGES = Object.freeze([
  "tesseract-ocr",
  "tesseract-ocr-eng",
  "tesseract-ocr-heb",
]);

function parseTesseractLanguages(output) {
  return new Set(
    String(output || "")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("List of available languages")),
  );
}

function missingRequiredLanguages(languages, required = REQUIRED_LANGUAGES) {
  return required.filter((language) => !languages.has(language));
}

function runCaptured(runner, command, args) {
  return runner(command, args, {
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    env: process.env,
  });
}

function inspectTesseract(runner = spawnSync) {
  const versionResult = runCaptured(runner, "tesseract", ["--version"]);
  if (versionResult.error || versionResult.status !== 0) {
    return {
      available: false,
      version: null,
      languages: new Set(),
      missingLanguages: [...REQUIRED_LANGUAGES],
    };
  }

  const languagesResult = runCaptured(runner, "tesseract", ["--list-langs"]);
  const languages = languagesResult.error || languagesResult.status !== 0
    ? new Set()
    : parseTesseractLanguages(languagesResult.stdout);
  return {
    available: true,
    version: String(versionResult.stdout || "").split(/\r?\n/u)[0].trim() || "tesseract",
    languages,
    missingLanguages: missingRequiredLanguages(languages),
  };
}

function commandAvailable(command, runner = spawnSync) {
  const result = runCaptured(runner, command, ["--version"]);
  return !result.error && result.status === 0;
}

function privilegedAptInvocation(aptArgs, { isRoot }) {
  const commonArgs = ["DEBIAN_FRONTEND=noninteractive", "apt-get", ...aptArgs];
  return isRoot
    ? { command: "env", args: commonArgs }
    : { command: "sudo", args: ["--", "env", ...commonArgs] };
}

function runChecked(runner, invocation, label) {
  const completed = runner(invocation.command, invocation.args, {
    cwd: process.cwd(),
    stdio: "inherit",
    shell: false,
    windowsHide: true,
    env: process.env,
  });
  if (completed.error) {
    throw new Error(`${label} could not start: ${completed.error.message}`);
  }
  if (completed.signal) {
    throw new Error(`${label} stopped by signal ${completed.signal}.`);
  }
  if (completed.status !== 0) {
    throw new Error(`${label} failed with exit code ${completed.status ?? "unknown"}.`);
  }
}

function ensureLinuxOcr({
  platform = process.platform,
  runner = spawnSync,
  getuid = typeof process.getuid === "function" ? () => process.getuid() : () => null,
  log = console.log,
} = {}) {
  if (platform !== "linux") {
    throw new Error("Automatic OCR system-package setup is supported only on Linux.");
  }

  const current = inspectTesseract(runner);
  if (current.available && current.missingLanguages.length === 0) {
    log(`Tesseract OCR verified: ${current.version}; languages: ${REQUIRED_LANGUAGES.join(", ")}.`);
    return current;
  }

  if (!commandAvailable("apt-get", runner)) {
    throw new Error(
      "apt-get was not found. Install Tesseract plus English and Hebrew language data " +
        "with your distribution package manager, or rerun setup with --skip-ocr-system-deps.",
    );
  }

  const isRoot = getuid() === 0;
  if (!isRoot && !commandAvailable("sudo", runner)) {
    throw new Error(
      "sudo was not found. Run setup as root, install sudo, or install these packages manually: " +
        APT_PACKAGES.join(" "),
    );
  }

  const missingDescription = current.available
    ? `missing language data: ${current.missingLanguages.join(", ")}`
    : "Tesseract executable not found";
  log(`${missingDescription}. Installing Ubuntu/Debian OCR packages: ${APT_PACKAGES.join(", ")}.`);

  runChecked(
    runner,
    privilegedAptInvocation(["update"], { isRoot }),
    "Updating apt package metadata",
  );
  runChecked(
    runner,
    privilegedAptInvocation(
      ["install", "-y", "--no-install-recommends", ...APT_PACKAGES],
      { isRoot },
    ),
    "Installing Tesseract OCR packages",
  );

  const verified = inspectTesseract(runner);
  if (!verified.available) {
    throw new Error("Tesseract was installed but the 'tesseract' command still cannot be executed.");
  }
  if (verified.missingLanguages.length > 0) {
    throw new Error(
      `Tesseract is installed, but required language data is still missing: ${verified.missingLanguages.join(", ")}.`,
    );
  }

  log(`Tesseract OCR verified: ${verified.version}; languages: ${REQUIRED_LANGUAGES.join(", ")}.`);
  return verified;
}

function main() {
  try {
    ensureLinuxOcr();
    return 0;
  } catch (error) {
    console.error(`\nLINUX OCR SETUP FAILED: ${error.message}`);
    return 1;
  }
}

module.exports = {
  APT_PACKAGES,
  REQUIRED_LANGUAGES,
  commandAvailable,
  ensureLinuxOcr,
  inspectTesseract,
  missingRequiredLanguages,
  parseTesseractLanguages,
  privilegedAptInvocation,
};

if (require.main === module) {
  process.exitCode = main();
}
