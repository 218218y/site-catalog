@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo Preparing Node.js development dependencies...
where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js and npm are required. Install Node.js 24 and run this file again.
  goto error
)
call npm ci
if errorlevel 1 goto error

where py >nul 2>&1
if not errorlevel 1 (
  set "PYTHON_EXE=py -3"
) else (
  where python >nul 2>&1
  if errorlevel 1 (
    echo Python 3 is required. Install it and run this file again.
    goto error
  )
  set "PYTHON_EXE=python"
)

echo.
echo Cleaning stale Python caches and obsolete local artifacts...
%PYTHON_EXE% tools\clean_project_artifacts.py
if errorlevel 1 goto error

echo.
echo Preparing the local Python environment...
%PYTHON_EXE% tools\setup_python_env.py
if errorlevel 1 goto error

echo.
echo Installing the Playwright Chromium browser used by real browser tests...
call npm run setup:browsers
if errorlevel 1 goto error

echo.
echo Done. Node dependencies, .venv and the Playwright browser are ready.
echo You can run npm test for quick checks or npm run verify for the complete suite.
echo.
echo Now put PDFs in assets\pdfs and run .10-convert-catalogs.bat
pause
exit /b 0

:error
echo.
echo Setup failed. Make sure Node.js, Python 3 and internet access are available, then try again.
pause
exit /b 1
