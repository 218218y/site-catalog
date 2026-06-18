#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
source .venv/bin/activate
python tools/build_catalogs.py --format jpg --dpi 220 --max-width 2800 --max-height 2800 --thumb-size 420 --quality 94 --thumb-quality 88 --sharpen 1.0
