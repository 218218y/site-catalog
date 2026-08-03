# Linux x64/glibc npm offline mirror

This directory is generated from `package-lock.json` for the Linux x64/glibc
execution environment used by the chat/CI container.

Update it after any npm dependency or lockfile change:

```bash
npm run update:offline:linux
npm run check:offline:linux
```

The updater keeps only packages installable on Linux x64/glibc. Normal lockfile
entries are authenticated with their SHA-512 integrity. If npm omitted
`resolved` and `integrity` for an ordinary registry dependency, the updater
runs `npm pack <name>@<exact-version>`, verifies the tarball identity, and
records its computed SRI in `manifest.json`.

`package-lock.offline.json` is generated beside the manifest. It is a copy of
the canonical lockfile whose selected package entries point to repository-local
`file:` tarballs. The canonical `package-lock.json` is never edited.

Install the complete npm dependency tree without network access:

```bash
npm run setup:npm:offline:linux
```

The installer verifies every tarball and the generated lock, exposes it
temporarily as `npm-shrinkwrap.json`, and runs `npm ci --offline`. The temporary
shrinkwrap and npm cache are removed even if installation fails. Playwright's
npm packages are included, but Chromium and other browser payloads are not.

A successful update removes the obsolete duplicate trees
`vendor/npm/esbuild`, `vendor/npm/typescript`, and the old persistent
`.cache/npm-offline-linux` cache. Do not delete them before the first successful
update because their matching tarballs can be reused without downloading.

Do not add Windows, macOS, ARM64, musl or Playwright browser files here.
