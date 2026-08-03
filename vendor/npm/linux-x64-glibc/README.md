# Linux x64/glibc npm offline mirror

This directory is generated from `package-lock.json` for the Linux x64/glibc
execution environment used by the chat/CI container.

Update it after any npm dependency or lockfile change:

```bash
npm run update:offline:linux
npm run check:offline:linux
```

The updater reads package names, versions, tarball URLs, platform constraints
and SHA-512 integrity values directly from lockfile version 3. It keeps only
packages installable on Linux x64/glibc, reuses already-vendored archives when
their integrity matches, downloads only missing archives, verifies package
identity, validates dependencies bundled inside another npm tarball, removes
stale canonical archives, and writes `manifest.json` atomically.

Install the complete npm dependency tree without network access:

```bash
npm run setup:npm:offline:linux
```

The installer verifies the manifest, seeds a repository-local npm cache from the
mirrored tarballs, and runs `npm ci --offline`. Playwright's npm packages are
included because the test runner imports them, but Chromium and all other
Playwright browser payloads are intentionally excluded. Install a browser only
for real E2E work with `npm run setup:browsers`.

Do not add Windows, macOS, ARM64, musl or Playwright browser files here. The
mirror target is intentionally narrow so routine project archives stay small.
