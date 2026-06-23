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

%PYTHON_EXE% tools\build_deploy_bundle.py --assets-mode r2 --zip --allow-missing-pages %*
if errorlevel 1 (
  echo.
  echo Bundle failed. Check that catalog-assets-config.js contains your R2 public URL.
  pause
  exit /b 1
)

echo.
echo Ready to upload to Netlify: dist\site-upload
echo ZIP: dist\site-upload.zip
echo.
pause
