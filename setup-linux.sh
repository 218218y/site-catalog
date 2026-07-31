#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

if [ "$(uname -s 2>/dev/null || printf unknown)" != "Linux" ]; then
  echo "setup-linux.sh is intended for Linux. Use .20-setup-windows.bat on Windows." >&2
  exit 1
fi

exec "$SCRIPT_DIR/site.sh" setup "$@"
