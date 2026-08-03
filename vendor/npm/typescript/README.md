# Legacy focused TypeScript archives

The focused TypeScript bootstrap recognizes verified archives in this legacy
directory for compatibility with existing project copies. It now resolves the
exact launcher/compiler version, URL and SHA-512 integrity directly from
`package-lock.json`; no package version is duplicated in the bootstrap source.

Generate the canonical Linux x64/glibc mirror after npm dependency updates:

```bash
npm run update:offline:linux
```

The updater reuses matching archives from here, copies them into
`vendor/npm/linux-x64-glibc`, downloads only missing lockfile packages, and
removes legacy or non-target tarballs. The mirror intentionally excludes
Windows, macOS, ARM64, musl and Playwright browser payloads.

Focused install and verification remain available:

```bash
npm run setup:typescript:offline
npm run check:typescript:offline
```
