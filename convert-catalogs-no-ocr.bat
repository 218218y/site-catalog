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
python tools\build_catalogs.py --format webp --dpi 220 --max-width 2800 --max-height 2800 --thumb-size 420 --quality 84 --thumb-quality 76 --sharpen 0.8 --ocr never --ocr-lang heb+eng --ocr-dpi 260
if errorlevel 1 goto error
echo.
echo No-OCR conversion finished in high-quality optimized WebP.
echo Existing converted catalogs are skipped when the source PDF and image settings did not change.
echo Later regular conversion will not rebuild these catalogs just because OCR settings are different.
echo Open index.html or run start-server.bat
echo.
pause
exit /b 0
:error
echo.
echo No-OCR conversion failed. Check the PDF names in assets\pdfs and catalogs.config.json
pause
exit /b 1
