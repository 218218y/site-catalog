@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv\Scripts\activate.bat (
  echo Local Python environment was not found.
  echo Run .20-setup-windows.bat first.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
python tools\build_catalogs.py --force --no-clean --skip-existing --format webp --dpi 220 --max-width 2800 --max-height 2800 --thumb-size 420 --quality 84 --thumb-quality 76 --sharpen 0.8 --ocr auto --ocr-lang heb+eng --ocr-dpi 260 --ocr-min-confidence 65 --ocr-title-min-confidence 45 --ocr-max-words-per-page 180
if errorlevel 1 goto error
echo.
echo OCR/search index was refreshed with confidence-aware conservative OCR. Existing WebP page images were kept when possible.
echo Generated: catalogs.search.js
echo.
pause
exit /b 0
:error
echo.
echo OCR refresh failed. Check the PDF names in assets\pdfs and catalogs.config.json
echo.
pause
exit /b 1
