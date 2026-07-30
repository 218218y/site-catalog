# Repository execution guidance

This repository includes a verified, offline `esbuild` runtime under
`vendor/npm/esbuild`. For source review, focused frontend changes, and ordinary
frontend builds, **do not run `npm install`, `npm ci`, `npm run setup`, or any
Playwright browser installation**.

Use the repository-local bootstrap instead:

```bash
python tools/bootstrap_esbuild_offline.py
python tools/build_frontend_assets.py --check
```

`tools/build_frontend_assets.py` also bootstraps the matching local `esbuild`
binary automatically when it is missing. The bootstrap verifies the pinned
SHA-512 archives, selects Linux x64, Linux ARM64, or Windows x64, and modifies
only these paths:

- `node_modules/esbuild`
- `node_modules/@esbuild/<current-platform>`
- `node_modules/.bin/esbuild*`

Install the complete npm dependency tree only when the requested work genuinely
needs TypeScript, Wrangler, Playwright, or the full verification pipeline. Do
not install Playwright browsers unless browser tests are explicitly requested.
Prefer focused tests that cover the files changed in the current task.
