# Repository execution guidance

This repository includes verified offline runtimes for `esbuild` and
TypeScript 7. For source review, focused frontend changes, JSDoc type checking,
ordinary frontend builds, and the JavaScript contract suite, **do not run
`npm install`, `npm ci`, `npm run setup`, or any Playwright browser
installation**.

Provision only the required local packages:

```bash
python tools/bootstrap_esbuild_offline.py
python tools/bootstrap_typescript_offline.py
```

Useful focused commands:

```bash
python tools/build_frontend_assets.py --check
python tools/run_typescript_offline.py -p jsconfig.json --pretty false
python tools/verify_project.py --javascript-only
```

The frontend builder bootstraps `esbuild` automatically. The TypeScript runner
and the JavaScript verification workflow bootstrap the exact TypeScript 7
launcher and native compiler automatically. Both bootstraps verify the pinned
SHA-512 archives and modify only their own package paths under `node_modules`.
They never invoke npm or lifecycle scripts.

Offline TypeScript requires the core archive plus the current platform archive
under `vendor/npm/typescript`; see that directory's README for exact filenames
and download URLs. Supported offline targets are Linux x64, Linux ARM64, and
Windows x64.

Install the complete npm dependency tree only when the requested work genuinely
needs Wrangler, Playwright, browser binaries, or another dependency not covered
by the focused offline toolchain. Python tests still require the pinned Python
packages from `tools/requirements*.txt`. Do not install Playwright browsers
unless browser tests are explicitly requested. Prefer focused tests that cover
the files changed in the current task.
