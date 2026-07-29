#!/usr/bin/env node
/** Bundle one route entrypoint with the project's pinned esbuild dependency. */
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { build, version as esbuildVersion } from "esbuild";

const EXPECTED_ESBUILD_VERSION = "0.28.1";

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
  for (const required of ["root", "entry", "outfile", "metafile", "capabilities"]) {
    if (!values.has(required)) throw new Error(`Missing required --${required}`);
  }
  return Object.fromEntries(values);
}

const args = parseArguments(process.argv.slice(2));
if (esbuildVersion !== EXPECTED_ESBUILD_VERSION) {
  throw new Error(
    `Unsupported esbuild version ${esbuildVersion}; expected ${EXPECTED_ESBUILD_VERSION}. Run npm ci.`,
  );
}

const root = path.resolve(args.root);
const entry = path.resolve(root, args.entry);
const outfile = path.resolve(args.outfile);
const metafilePath = path.resolve(args.metafile);
const capabilities = JSON.parse(args.capabilities);

const result = await build({
  absWorkingDir: root,
  entryPoints: [entry],
  bundle: true,
  write: false,
  metafile: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  charset: "utf8",
  treeShaking: true,
  minifySyntax: true,
  minifyWhitespace: false,
  minifyIdentifiers: false,
  legalComments: "inline",
  define: {
    __BARGIG_FEATURE_CAPABILITIES__: JSON.stringify(capabilities),
    __BARGIG_TEST_EXPORTS__: "undefined",
  },
  logLevel: "silent",
});

if (result.outputFiles.length !== 1) {
  throw new Error(`Expected one JavaScript output, received ${result.outputFiles.length}`);
}
await fs.mkdir(path.dirname(outfile), { recursive: true });
await fs.writeFile(outfile, result.outputFiles[0].contents);
await fs.writeFile(metafilePath, `${JSON.stringify(result.metafile, null, 2)}\n`, "utf8");
