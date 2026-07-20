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

const wranglerBin = process.platform === "win32"
  ? path.join(root, "node_modules", ".bin", "wrangler.cmd")
  : path.join(root, "node_modules", ".bin", "wrangler");
if (!fs.existsSync(wranglerBin)) {
  fail("The local Wrangler executable is missing.");
}
const wrangler = spawnSync(wranglerBin, ["--version"], {
  cwd: root,
  encoding: "utf8",
  shell: process.platform === "win32",
});
if (wrangler.error || wrangler.status !== 0) {
  fail("Wrangler/workerd could not start.", wrangler.error || new Error(wrangler.stderr || wrangler.stdout));
}
if (!`${wrangler.stdout}\n${wrangler.stderr}`.includes(packageJson.devDependencies.wrangler)) {
  fail(`Wrangler started, but did not report the pinned version ${packageJson.devDependencies.wrangler}.`);
}

console.log(`Node install-script runtimes verified: esbuild ${lockedVersion("esbuild")}, sharp ${lockedVersion("sharp")}, workerd ${lockedVersion("workerd")}, wrangler ${packageJson.devDependencies.wrangler}.`);
