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
python tools\build_catalogs.py --delete-unlisted --format webp --dpi 220 --max-width 2800 --max-height 2800 --thumb-size 420 --quality 84 --thumb-quality 76 --sharpen 0.8 --ocr auto --ocr-lang heb+eng --ocr-dpi 260
if errorlevel 1 goto error
echo.
echo Conversion finished in high-quality optimized WebP.
echo Existing converted catalogs are skipped only when the source PDF and settings did not change.
echo Converted catalog folders not listed in catalogs.config.json were deleted.
echo Existing converted catalogs whose PDF is missing but are still listed in catalogs.config.json were kept.
echo To rebuild everything and also delete unlisted catalogs, run convert-catalogs-deleteforce.bat
echo You can now delete the PDFs if you only want to keep the images.
echo Open index.html or run start-server.bat
echo.
pause
exit /b 0
:error
echo.
echo Conversion failed. Check the PDF names in assets\pdfs and catalogs.config.json
pause
exit /b 1
