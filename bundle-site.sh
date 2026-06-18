#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

if [ -x ".venv/bin/python" ]; then
  PYTHON_EXE=".venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_EXE="python3"
else
  PYTHON_EXE="python"
fi

"$PYTHON_EXE" tools/build_deploy_bundle.py --zip "$@"
printf '\nReady to upload: dist/site-upload\nZIP file: dist/site-upload.zip\n'
