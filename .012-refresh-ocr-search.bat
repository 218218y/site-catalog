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
python tools\build_catalogs.py --profile ocr-refresh
if errorlevel 1 goto error
echo.
echo OCR/search index was refreshed with the canonical ocr-refresh profile.
echo Existing complete page images were preserved when possible.
echo Generated: catalogs.search-index.json
echo.
pause
exit /b 0
:error
echo.
echo OCR refresh failed. Check the PDF names in assets\pdfs and catalogs.config.json
echo.
pause
exit /b 1
