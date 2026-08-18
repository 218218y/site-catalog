# Linux x64/glibc chat npm offline mirror

This directory is generated from `package-lock.json` for code checks in the
Linux x64/glibc chat/CI environment.

The mirror is intentionally a minimal profile rather than a full copy of the
project dependency tree. It retains dependencies reachable from the direct
project roots other than `wrangler`. At the current lockfile this means:

- `esbuild` and `@esbuild/linux-x64`
- `typescript` and `@typescript/typescript-linux-x64`
- `@playwright/test`, `playwright`, and `playwright-core`

Wrangler, workerd, miniflare, sharp/libvips, other Cloudflare dependencies, and
Playwright browser payloads are intentionally excluded. Use a normal `npm ci`
when deployment tooling is required.

Update and verify after any npm dependency or lockfile change:

```bash
npm run update:offline:linux
npm run check:offline:linux
```

The updater follows the selected dependency graph from lockfile metadata,
filters optional packages for Linux x64/glibc, authenticates every tarball, and
prunes archives no longer reachable from the chat roots. Versions are never
hard-coded in the Python tools. The manifest fingerprints this selected lock
projection rather than the entire canonical lockfile, so changes confined to
excluded deployment dependencies do not invalidate an unchanged chat toolchain.
Changes to any selected package record still invalidate the mirror.

Generated metadata:

- `manifest.json` records the profile, roots, exclusions, versions, hashes, and archives.
- `package-lock.offline.json` is a pruned lockfile with repository-local `file:` tarballs.
- `package.offline.json` is the matching minimal package descriptor without project lifecycle scripts.

The canonical `package.json` and `package-lock.json` are never edited.

Install without network access:

```bash
npm run check:npm:offline:linux
npm run setup:npm:offline:linux
```

Installation runs in a temporary staging project. npm performs `npm ci
--offline`; runtime probes then verify esbuild, TypeScript, and the Playwright
API without launching a browser. Existing `node_modules` is replaced only after
all probes pass, and temporary cache/staging data is always removed.

Do not add Windows, macOS, ARM64, musl, Wrangler-runtime, or Playwright browser
files here.
