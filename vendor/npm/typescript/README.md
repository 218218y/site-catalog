# Offline TypeScript 7 archives

Place the exact npm tarballs required by the current machine in this directory.
Do not extract or rename them.

Always required:

- `typescript-7.0.2.tgz`
  - https://registry.npmjs.org/typescript/-/typescript-7.0.2.tgz

Linux x64 (the usual chat/CI container):

- `typescript-linux-x64-7.0.2.tgz`
  - https://registry.npmjs.org/@typescript/typescript-linux-x64/-/typescript-linux-x64-7.0.2.tgz

Windows x64:

- `typescript-win32-x64-7.0.2.tgz`
  - https://registry.npmjs.org/@typescript/typescript-win32-x64/-/typescript-win32-x64-7.0.2.tgz

Linux ARM64, only when needed:

- `typescript-linux-arm64-7.0.2.tgz`
  - https://registry.npmjs.org/@typescript/typescript-linux-arm64/-/typescript-linux-arm64-7.0.2.tgz

`tools/bootstrap_typescript_offline.py` verifies each archive against the exact
URL, version and SHA-512 integrity in `package-lock.json`, extracts only the
current platform, and installs no unrelated npm dependencies.
