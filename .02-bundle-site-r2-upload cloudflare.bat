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

echo Validating the existing bundle and uploading it without rebuilding...
echo.
%PYTHON_EXE% tools\deploy_cloudflare_pages.py --dir dist/site-upload-r2 --seo-mode private %*
if errorlevel 1 (
  echo.
  echo The Cloudflare operation did not complete successfully. If sources changed, run bundle-site-r2.bat first.
  pause
  exit /b 1
)

echo.
echo Cloudflare Pages deploy finished successfully.
echo.
pause
