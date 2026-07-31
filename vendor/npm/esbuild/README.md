# Offline esbuild runtime

These Linux-only archives provide the exact `esbuild` version pinned by
`package.json` and `package-lock.json` without installing the repository's
complete npm dependency tree. Windows uses the normal `npm ci` installation and
does not require or expect a vendored Windows archive.

| Archive | npm package | Supported host |
| --- | --- | --- |
| `esbuild-0.28.1.tgz` | `esbuild@0.28.1` | All listed hosts |
| `linux-x64-0.28.1.tgz` | `@esbuild/linux-x64@0.28.1` | Linux x86-64 |
| `linux-arm64-0.28.1.tgz` | `@esbuild/linux-arm64@0.28.1` | Linux ARM64 |

Install or verify them through the repository tool; do not unpack them by hand:

```bash
python tools/bootstrap_esbuild_offline.py
python tools/bootstrap_esbuild_offline.py --check
```

The bootstrap verifies the SHA-512 values against both its locked manifest and
`package-lock.json`, validates the extracted package contents and platform
binary, and never invokes npm or accesses the network.

When updating esbuild, update `package.json`, `package-lock.json`, every archive,
the bootstrap manifest, and its contract tests in one reviewed change.
