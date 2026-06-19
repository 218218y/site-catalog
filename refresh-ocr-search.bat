@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist .venv\Scripts\activate.bat (
  echo Local Python environment was not found.
  echo Run setup-windows.bat first.
  pause
  exit /b 1
)
call .venv\Scripts\activate.bat
python tools\build_catalogs.py --force --no-clean --skip-existing --format jpg --dpi 220 --max-width 2800 --max-height 2800 --thumb-size 420 --quality 94 --thumb-quality 88 --sharpen 1.0 --ocr auto --ocr-lang heb+eng --ocr-dpi 260
if errorlevel 1 goto error
echo.
echo OCR/search index was refreshed. Existing page images were kept when possible.
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
