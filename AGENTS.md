# Repository execution guidance

This repository supports a verified minimal npm profile for the Linux
x64/glibc chat/CI container. The profile is generated from `package-lock.json`
and contains the packages needed for source review, frontend builds, JSDoc type
checking, JavaScript contracts, and Playwright API access without browsers:

- esbuild plus `@esbuild/linux-x64`
- TypeScript plus `@typescript/typescript-linux-x64`
- `@playwright/test`, `playwright`, and `playwright-core`

Wrangler is deliberately excluded from the chat profile together with workerd,
miniflare, sharp/libvips, and the rest of its deployment/runtime graph. Use a
normal lockfile-managed `npm ci` when Cloudflare deployment or local Wrangler
emulation is genuinely required.

```bash
npm run update:offline:linux      # recompute/prune after npm or lockfile updates
npm run check:offline:linux       # read-only mirror verification
npm run setup:npm:offline:linux   # isolated npm ci for the minimal chat profile
```

The updater follows dependency reachability from every direct project root
except `wrangler`, so new test/build dependencies are included automatically.
The installer works in a temporary staging project, probes esbuild, TypeScript,
and the Playwright API, and replaces `node_modules` only after success.
Playwright browsers are intentionally excluded. Do not run
`npm run setup:browsers` unless real browser tests are explicitly requested.
Windows, macOS, ARM64 and musl archives do not belong in the mirror.

Focused source work can still provision only esbuild and TypeScript:

```bash
python tools/bootstrap_esbuild_offline.py
python tools/bootstrap_typescript_offline.py
```

Both focused bootstraps resolve versions, tarball identities and SHA-512 values
from `package-lock.json`; they do not contain a second manually maintained
version manifest. They modify only their own package paths under `node_modules`
and never invoke npm or lifecycle scripts.

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

Python tests still require the pinned Python packages from
`tools/requirements*.txt`. Do not install Playwright browsers unless browser
tests are explicitly requested. Prefer focused tests that cover the files
changed in the current task.
