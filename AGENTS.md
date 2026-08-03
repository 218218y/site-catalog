# Repository execution guidance

This repository supports two verified Linux x64/glibc offline modes for the
chat/CI container. Focused source review, frontend builds, JSDoc type checking
and the JavaScript contract suite can provision only esbuild and TypeScript:

```bash
python tools/bootstrap_esbuild_offline.py
python tools/bootstrap_typescript_offline.py
```

Both focused bootstraps resolve versions, tarball identities and SHA-512 values
from `package-lock.json`; they do not contain a second manually maintained
version manifest. They modify only their own package paths under `node_modules`
and never invoke npm or lifecycle scripts.

For work that also needs Wrangler, workerd, sharp, Playwright's Node runner or
any other npm dependency, use the complete lockfile-driven mirror:

```bash
npm run update:offline:linux      # online maintenance, after npm/lockfile updates
npm run check:offline:linux       # read-only verification
npm run setup:npm:offline:linux   # complete npm ci from local archives
```

The mirror contains only packages installable on Linux x64/glibc. Playwright's
npm packages are included, but Chromium and all other browser payloads are
intentionally excluded. Do not run `npm run setup:browsers` unless real browser
tests are explicitly requested. Windows, macOS, ARM64 and musl archives do not
belong in the mirror.

Useful focused commands:

```bash
python tools/build_frontend_assets.py --check
python tools/generate_catalog_data_types.py --check
python tools/run_typescript_offline.py -p jsconfig.json --pretty false
python tools/verify_project.py --javascript-only
```

The frontend builder bootstraps esbuild automatically. The TypeScript runner
and JavaScript verification workflow bootstrap the exact lockfile-selected
launcher/native compiler automatically. On non-target platforms, use the normal
package-lock-managed `npm ci` installation.

Install the complete npm dependency tree only when the requested work genuinely
needs Wrangler, Playwright, browser binaries, or another dependency not covered
by the focused offline toolchain. Python tests still require the pinned Python
packages from `tools/requirements*.txt`. Do not install Playwright browsers
unless browser tests are explicitly requested. Prefer focused tests that cover
the files changed in the current task.
