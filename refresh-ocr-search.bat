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
python tools\build_catalogs.py --force --no-clean --skip-existing --format webp --dpi 240 --max-width 3200 --max-height 3200 --thumb-size 520 --quality 90 --thumb-quality 80 --sharpen 0.8 --ocr auto --ocr-lang heb+eng --ocr-dpi 260
if errorlevel 1 goto error
echo.
echo OCR/search index was refreshed with conservative OCR. Existing WebP page images were kept when possible.
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
