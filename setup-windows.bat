@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo Preparing Node.js development dependencies...
where npm >nul 2>&1
if errorlevel 1 (
  echo Node.js and npm are required. Install the current Node.js LTS version and run this file again.
  goto error
)
call npm ci
if errorlevel 1 goto error

echo.
echo Preparing the local Python environment...
where py >nul 2>&1
if not errorlevel 1 (
  py -3 tools\setup_python_env.py
) else (
  python tools\setup_python_env.py
)
if errorlevel 1 goto error

echo.
echo Installing the Playwright Chromium browser used by real browser tests...
call npm run setup:browsers
if errorlevel 1 goto error

echo.
echo Done. Node dependencies, .venv and the Playwright browser are ready.
echo You can run npm test for quick checks or npm run verify for the complete suite.
echo.
echo Now put PDFs in assets\pdfs and run convert-catalogs.bat
pause
exit /b 0

:error
echo.
echo Setup failed. Make sure Node.js, Python 3 and internet access are available, then try again.
pause
exit /b 1
