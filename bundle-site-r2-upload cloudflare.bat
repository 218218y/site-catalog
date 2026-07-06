@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  set "PYTHON_EXE=.venv\Scripts\python.exe"
) else (
  where py >nul 2>nul
  if not errorlevel 1 (
    set "PYTHON_EXE=py -3"
  ) else (
    set "PYTHON_EXE=python"
  )
)

%PYTHON_EXE% tools\deploy_cloudflare_pages.py %*
if errorlevel 1 (
  echo.
  echo Cloudflare Pages deploy failed. Make sure dist\site-upload-r2 exists, Node.js/npm is installed, and Wrangler is logged in.
  pause
  exit /b 1
)

echo.
echo Cloudflare Pages deploy finished successfully.
echo.
pause
