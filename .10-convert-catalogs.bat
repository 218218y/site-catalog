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
python tools\build_catalogs.py --format webp --dpi 220 --max-width 2800 --max-height 2800 --thumb-size 420 --quality 84 --thumb-quality 76 --sharpen 0.8 --ocr auto --ocr-lang heb+eng --ocr-dpi 260
if errorlevel 1 goto error
echo.
echo Conversion finished in high-quality optimized WebP.
echo Existing converted catalogs are skipped only when the source PDF and settings did not change.
echo Catalogs removed from catalogs.config.json were removed from assets\pages and the generated search index.
echo Catalogs whose source PDF is missing were removed from catalogs.config.json, assets\pages and the generated search index.
echo To rebuild every remaining PDF, run convert-catalogs-force.bat
echo Run bundle-site-r2.bat to update the site, then start-server.bat to preview it
echo.
pause
exit /b 0
:error
echo.
echo Conversion failed. Check the PDF names in assets\pdfs and catalogs.config.json
echo.
pause
exit /b 1
