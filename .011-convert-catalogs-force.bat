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
python tools\build_catalogs.py --profile force
if errorlevel 1 goto error
echo.
echo Forced conversion finished with the canonical force profile.
echo Catalogs removed explicitly from catalogs.config.json were removed from assets\pages and the generated search index.
echo If a configured source PDF is missing, conversion stops without deleting anything.
echo Missing-PDF pruning requires an explicit reviewed confirmation in the control panel or a manual --prune-missing-pdfs flag.
echo.
pause
exit /b 0
:error
echo.
echo Conversion failed. Check the PDF names in assets\pdfs and catalogs.config.json
echo.
pause
exit /b 1
