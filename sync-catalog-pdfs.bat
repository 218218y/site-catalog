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
python tools\sync_catalog_pdfs.py
if errorlevel 1 goto error
echo.
echo PDF scan finished. New PDFs were added only to catalogs.config.json.
echo Edit the catalog details and OCR setting, then run convert-catalogs.bat to convert images.
echo You can also use catalog-control-panel.bat for this.
echo.
pause
exit /b 0
:error
echo.
echo PDF scan failed. Check assets\pdfs and catalogs.config.json
pause
exit /b 1
