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

%PYTHON_EXE% tools\build_deploy_bundle.py --external-assets-url "https://cdn.bargig-furniture.com" %*
if errorlevel 1 (
  echo.
  echo R2 bundle failed. Make sure catalogs.generated.js exists and the external image URL is correct.
  pause
  exit /b 1
)

echo.
echo Ready to upload: dist\site-upload-r2
echo Images are loaded from Cloudflare R2, not from the Netlify upload folder.
echo.
pause
