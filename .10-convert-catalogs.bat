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
python tools\build_catalogs.py --profile production
if errorlevel 1 goto error
echo.
echo Conversion finished with the canonical production profile (responsive WebP: thumb + medium + full).
echo Existing converted catalogs are skipped only when the source PDF or production profile did not change.
echo Catalogs removed explicitly from catalogs.config.json were removed from assets\pages and the generated search index.
echo If a configured source PDF is missing, conversion stops without deleting anything.
echo Use the control panel for an explicit reviewed removal, or pass --prune-missing-pdfs manually only after confirmation.
echo To rebuild every configured PDF, run .011-convert-catalogs-force.bat
echo Next run .07-sync-r2-images.bat. Only after the R2 sync succeeds, run .01-bundle-site-r2.bat
echo.
pause
exit /b 0
:error
echo.
echo Conversion failed. Check the PDF names in assets\pdfs and catalogs.config.json
echo.
pause
exit /b 1
