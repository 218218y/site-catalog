# TypeScript 5.8 compatibility compiler

This directory vendors the exact `typescript@5.8.3` npm archive used by the
frontend compatibility gate. The archive is verified against the URL and
SHA-512 integrity pinned in `package-lock.json` before extraction.

The package is installed without lifecycle scripts into
`node_modules/typescript-5-8` by:

```bash
python tools/bootstrap_typescript_5_8_offline.py
```
