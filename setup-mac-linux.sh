#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r tools/requirements.txt
echo "Done. Put PDFs in assets/pdfs and run: ./convert-catalogs.sh"
echo "For PNG output use: python tools/build_catalogs.py --format png --dpi 240 --max-width 3200 --max-height 3200 --thumb-size 460"
