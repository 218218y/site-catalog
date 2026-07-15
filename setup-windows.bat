@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo Preparing the local Python environment...
where py >nul 2>&1
if not errorlevel 1 (
  py -3 tools\setup_python_env.py
) else (
  python tools\setup_python_env.py
)
if errorlevel 1 goto error

echo.
echo Done. The .venv environment now contains the build and test dependencies.
echo You can run npm test or npm run verify without activating it manually.
echo.
echo Now put PDFs in assets\pdfs and run convert-catalogs.bat
pause
exit /b 0

:error
echo.
echo Something failed. Make sure Python 3 and internet access are available, then try again.
pause
exit /b 1
