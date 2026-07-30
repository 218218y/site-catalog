#!/usr/bin/env node
/** Minify deploy-only frontend assets with the project's pinned esbuild runtime. */
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { transform, version as esbuildVersion } from "esbuild";

const EXPECTED_ESBUILD_VERSION = "0.28.1";
const EXPECTED_PROFILE = "standard-minified-v1";
const SUPPORTED_KINDS = new Set(["css", "esm", "script"]);

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      throw new Error(`Invalid argument list near ${name || "<end>"}`);
    }
    values.set(name.slice(2), value);
  }
  for (const required of ["root", "manifest", "report"]) {
    if (!values.has(required)) throw new Error(`Missing required --${required}`);
  }
  return Object.fromEntries(values);
}

function isInsideRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function validateRelativeAssetPath(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Deploy asset path must be a non-empty string");
  const normalized = value.replaceAll("\\", "/");
  if (path.posix.isAbsolute(normalized) || normalized.split("/").some((part) => part === ".." || part === "")) {
    throw new Error(`Unsafe deploy asset path: ${value}`);
  }
  return normalized;
}

function sha256(contents) {
  return crypto.createHash("sha256").update(contents).digest("hex");
}

function transformOptions(kind, sourcefile) {
  const shared = {
    charset: "utf8",
    legalComments: "none",
    logLevel: "silent",
    sourcefile,
    sourcemap: false,
  };
  if (kind === "css") {
    return {
      ...shared,
      loader: "css",
      minify: true,
    };
  }
  return {
    ...shared,
    loader: "js",
    ...(kind === "esm" ? { format: "esm" } : {}),
    target: ["es2022"],
    minifySyntax: true,
    minifyWhitespace: true,
    minifyIdentifiers: true,
  };
}

const args = parseArguments(process.argv.slice(2));
if (esbuildVersion !== EXPECTED_ESBUILD_VERSION) {
  throw new Error(
    `Unsupported esbuild version ${esbuildVersion}; expected ${EXPECTED_ESBUILD_VERSION}. ` +
      "Run python tools/bootstrap_esbuild_offline.py (or npm ci for the full toolchain).",
  );
}

const root = path.resolve(args.root);
const rootReal = await fs.realpath(root);
const manifestPath = path.resolve(args.manifest);
const reportPath = path.resolve(args.report);
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
if (manifest?.profile !== EXPECTED_PROFILE || !Array.isArray(manifest.assets) || manifest.assets.length === 0) {
  throw new Error(`Invalid deploy optimization manifest; expected profile ${EXPECTED_PROFILE}`);
}

const seen = new Set();
const pending = [];
try {
  for (const [index, asset] of manifest.assets.entries()) {
    const relative = validateRelativeAssetPath(asset?.path);
    const kind = asset?.kind;
    if (!SUPPORTED_KINDS.has(kind)) throw new Error(`Unsupported deploy asset kind for ${relative}: ${kind}`);
    if (seen.has(relative)) throw new Error(`Duplicate deploy asset in optimization manifest: ${relative}`);
    seen.add(relative);

    const target = path.resolve(root, relative);
    if (!isInsideRoot(root, target)) throw new Error(`Deploy asset escapes optimization root: ${relative}`);
    const targetReal = await fs.realpath(target);
    if (!isInsideRoot(rootReal, targetReal)) {
      throw new Error(`Deploy asset symlink escapes optimization root: ${relative}`);
    }

    const source = await fs.readFile(target);
    const result = await transform(source.toString("utf8"), transformOptions(kind, relative));
    if (result.warnings.length) throw new Error(`esbuild emitted warnings while optimizing ${relative}`);
    if (result.map) throw new Error(`Unexpected source map emitted for ${relative}`);

    const output = Buffer.from(result.code.endsWith("\n") ? result.code : `${result.code}\n`, "utf8");
    if (output.includes(Buffer.from("sourceMappingURL="))) {
      throw new Error(`Source map reference leaked into optimized deploy asset: ${relative}`);
    }
    const temporary = `${target}.optimize-${process.pid}-${index}.tmp`;
    await fs.writeFile(temporary, output);
    pending.push({
      relative,
      kind,
      target,
      temporary,
      beforeBytes: source.length,
      afterBytes: output.length,
      beforeSha256: sha256(source),
      afterSha256: sha256(output),
    });
  }

  for (const item of pending) await fs.rename(item.temporary, item.target);
} catch (error) {
  await Promise.all(pending.map((item) => fs.rm(item.temporary, { force: true })));
  throw error;
}

const report = {
  profile: EXPECTED_PROFILE,
  esbuildVersion,
  assets: pending.map(({ relative, kind, beforeBytes, afterBytes, beforeSha256, afterSha256 }) => ({
    path: relative,
    kind,
    beforeBytes,
    afterBytes,
    beforeSha256,
    afterSha256,
  })),
};
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
