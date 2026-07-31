#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
cd "$SCRIPT_DIR"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required. Install the version pinned in .nvmrc, then run this command again." >&2
  exit 1
fi

exec node tools/project_tasks.js "$@"
