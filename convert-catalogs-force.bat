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
python tools\build_catalogs.py --force --format webp --dpi 220 --max-width 2800 --max-height 2800 --thumb-size 420 --quality 84 --thumb-quality 76 --sharpen 0.8 --ocr auto --ocr-lang heb+eng --ocr-dpi 260
if errorlevel 1 goto error
echo.
echo Forced WebP conversion finished. All available PDFs were rebuilt.
echo Existing converted catalogs whose PDF is missing were kept, not deleted.
echo.
pause
exit /b 0
:error
echo.
echo Conversion failed. Check the PDF names in assets\pdfs and catalogs.config.json
pause
exit /b 1
