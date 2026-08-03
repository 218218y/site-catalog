# Linux Python offline wheelhouse

This directory is the Linux x64/glibc Python mirror used by the chat/test
profile. It is intentionally separate from the Windows development flow:
Windows keeps using the normal `pip install -r tools/requirements-dev.txt`
path, while Linux chat environments can install from local wheels only.

Generate or refresh the wheelhouse on a Linux x64/glibc machine with network
access:

```sh
npm run update:python:offline:linux
```

Verify the committed wheelhouse without network access:

```sh
npm run check:python:offline:linux
```

Install the project `.venv` from the committed wheelhouse:

```sh
npm run setup:python:offline:linux
```

The generated `wheels/` directory and `manifest.json` must be committed together.
The mirror must include the runtime/test packages and the Python quality gates
from `tools/requirements-dev.txt`, including `ruff` and `mypy`.
