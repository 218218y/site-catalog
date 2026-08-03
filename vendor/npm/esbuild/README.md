# Legacy focused esbuild archives

The focused esbuild bootstrap still recognizes verified archives in this
legacy directory so existing project copies keep working. Its version, URL and
SHA-512 contract are now read from `package-lock.json`; the Python source no
longer contains a separately maintained version manifest.

The canonical Linux x64/glibc mirror is generated under
`vendor/npm/linux-x64-glibc`:

```bash
npm run update:offline:linux
```

That command reuses matching files from this directory, copies them to the
canonical mirror, downloads other lockfile-required packages, and removes
legacy/ARM64/stale tarballs unless `--no-prune` is used. Do not add Windows,
macOS, ARM64 or musl archives.

Focused install and verification remain available:

```bash
npm run setup:esbuild:offline
npm run check:esbuild:offline
```
