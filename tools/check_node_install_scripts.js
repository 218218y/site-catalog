"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const packageLock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));

function fail(message, error) {
  console.error(`\nNODE TOOLCHAIN CHECK FAILED: ${message}`);
  if (error && error.message) console.error(error.message);
  console.error("Run `npm ci` with the project's package.json allowScripts policy, then try again.");
  process.exit(1);
}

function lockedVersion(name) {
  const entry = packageLock.packages?.[`node_modules/${name}`];
  if (!entry || typeof entry.version !== "string") {
    fail(`The lockfile does not contain ${name}.`);
  }
  return entry.version;
}

for (const name of ["esbuild", "sharp", "workerd"]) {
  const version = lockedVersion(name);
  assert.equal(
    packageJson.allowScripts?.[name],
    true,
    `${name}@${version} must be explicitly approved in package.json allowScripts and pinned by package-lock.json`,
  );
}

try {
  const esbuild = require("esbuild");
  const result = esbuild.transformSync("const value = 1 + 1", { loader: "js" });
  assert.match(result.code, /value/);
} catch (error) {
  fail("esbuild's installed native binary is unavailable.", error);
}

try {
  const sharp = require("sharp");
  assert.equal(typeof sharp, "function");
  assert.ok(sharp.versions && sharp.versions.sharp, "sharp did not expose its native runtime versions");
} catch (error) {
  fail("sharp's installed native runtime is unavailable.", error);
}

const wranglerPackageDir = path.join(root, "node_modules", "wrangler");
const wranglerPackagePath = path.join(wranglerPackageDir, "package.json");
if (!fs.existsSync(wranglerPackagePath)) {
  fail("The local Wrangler package is missing.");
}

const requestedWranglerVersion = packageJson.devDependencies?.wrangler;
const lockedWranglerRequest = packageLock.packages?.[""]?.devDependencies?.wrangler;
const lockedWranglerVersion = lockedVersion("wrangler");
if (typeof requestedWranglerVersion !== "string" || !requestedWranglerVersion.trim()) {
  fail("package.json does not declare Wrangler as a devDependency.");
}
if (lockedWranglerRequest !== requestedWranglerVersion) {
  fail("package.json and package-lock.json disagree about the requested Wrangler version.");
}

let wranglerPackage;
try {
  wranglerPackage = JSON.parse(fs.readFileSync(wranglerPackagePath, "utf8"));
} catch (error) {
  fail("Wrangler's installed package metadata is unreadable.", error);
}
if (wranglerPackage.version !== lockedWranglerVersion) {
  fail(
    `The installed Wrangler version ${wranglerPackage.version || "<unknown>"} does not match `
      + `package-lock.json (${lockedWranglerVersion}).`,
  );
}
const wranglerBinRelative = typeof wranglerPackage.bin === "string"
  ? wranglerPackage.bin
  : wranglerPackage.bin?.wrangler;
if (typeof wranglerBinRelative !== "string" || !wranglerBinRelative.trim()) {
  fail("Wrangler's installed package does not declare its CLI entry point.");
}
const wranglerCli = path.resolve(wranglerPackageDir, wranglerBinRelative);
const wranglerCliRelative = path.relative(wranglerPackageDir, wranglerCli);
if (wranglerCliRelative.startsWith("..") || path.isAbsolute(wranglerCliRelative)) {
  fail("Wrangler's CLI entry point escapes its installed package directory.");
}
if (!fs.existsSync(wranglerCli)) {
  fail("Wrangler's local CLI entry point is missing.");
}

// Run the JavaScript entry point directly with this Node executable.  Invoking
// node_modules/.bin/wrangler.cmd through cmd.exe breaks on Windows project paths
// containing spaces, Hebrew or bidirectional Unicode marks.  shell:false keeps
// the executable and every argument as distinct OS-level values.
const wrangler = spawnSync(process.execPath, [wranglerCli, "--version"], {
  cwd: root,
  encoding: "utf8",
  shell: false,
  windowsHide: true,
});
if (wrangler.error || wrangler.status !== 0) {
  const details = [wrangler.error?.message, wrangler.stderr, wrangler.stdout]
    .filter(Boolean)
    .join("\n")
    .trim();
  fail("Wrangler/workerd could not start.", new Error(details || `Wrangler exited with status ${wrangler.status}.`));
}
if (!`${wrangler.stdout}\n${wrangler.stderr}`.trim()) {
  fail("Wrangler started, but its --version command produced no output.");
}

console.log(`Node install-script runtimes verified: esbuild ${lockedVersion("esbuild")}, sharp ${lockedVersion("sharp")}, workerd ${lockedVersion("workerd")}, wrangler ${lockedWranglerVersion}.`);
