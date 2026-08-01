# Repository execution guidance

This repository includes verified offline runtimes for `esbuild`, TypeScript
5.8.3, and TypeScript 7.0.2. For source review, focused frontend changes, JSDoc type checking,
ordinary frontend builds, and the JavaScript contract suite, **do not run
`npm install`, `npm ci`, `npm run setup`, or any Playwright browser
installation**.

Provision only the required local packages:

```bash
python tools/bootstrap_esbuild_offline.py
python tools/bootstrap_typescript_5_8_offline.py
python tools/bootstrap_typescript_offline.py
```

Useful focused commands:

```bash
python tools/build_frontend_assets.py --check
python tools/generate_catalog_data_types.py --check
python tools/run_typescript_matrix.py -p jsconfig.json --pretty false
python tools/verify_project.py --javascript-only
```

The frontend builder bootstraps `esbuild` automatically. The TypeScript matrix
and the JavaScript verification workflow bootstrap the exact 5.8 compatibility
compiler and the exact TypeScript 7 launcher/native compiler automatically. All
bootstraps verify pinned SHA-512 archives and modify only their own package paths
under `node_modules`.
They never invoke npm or lifecycle scripts.

Offline archives are intentionally Linux-only: Linux x64 and Linux ARM64.
On Windows, use the exact package-lock-managed `node_modules` installation from
`npm ci`; the build and typecheck runners accept that valid local installation
without looking for vendored Windows archives. If the Windows native package is
missing or damaged, repair it with `npm ci` rather than adding a Windows tarball
to the repository.

Install the complete npm dependency tree only when the requested work genuinely
needs Wrangler, Playwright, browser binaries, or another dependency not covered
by the focused offline toolchain. Python tests still require the pinned Python
packages from `tools/requirements*.txt`. Do not install Playwright browsers
unless browser tests are explicitly requested. Prefer focused tests that cover
the files changed in the current task.
