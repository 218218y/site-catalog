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
python tools\build_catalogs.py --format png --dpi 240 --max-width 3200 --max-height 3200 --thumb-size 460 --quality 100 --thumb-quality 100 --sharpen 1.0 --ocr auto --ocr-lang heb+eng --ocr-dpi 260
if errorlevel 1 goto error
echo.
echo Maximum-quality PNG conversion finished.
echo PNG files are larger, but very crisp.
echo.
pause
exit /b 0
:error
echo.
echo Conversion failed. Check the PDF names in assets\pdfs and catalogs.config.json
pause
exit /b 1
