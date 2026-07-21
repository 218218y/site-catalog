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
python tools\build_catalogs.py --force --format webp --dpi 220 --max-width 2800 --max-height 2800 --thumb-size 420 --quality 84 --thumb-quality 76 --sharpen 0.8 --ocr auto --ocr-lang heb+eng --ocr-dpi 260
if errorlevel 1 goto error
echo.
echo Forced high-quality WebP conversion finished. Every remaining PDF was rebuilt.
echo Catalogs removed from catalogs.config.json were removed from assets\pages and the generated search index.
echo Catalogs whose source PDF is missing were removed from catalogs.config.json, assets\pages and the generated search index.
echo.
pause
exit /b 0
:error
echo.
echo Conversion failed. Check the PDF names in assets\pdfs and catalogs.config.json
echo.
pause
exit /b 1
