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

echo Verifying that this catalog image release completed an R2 sync...
echo.
%PYTHON_EXE% tools\verify_r2_catalog_sync_state.py
if errorlevel 1 (
  echo.
  echo Cloudflare Pages deploy stopped because the current image release was not synced to R2.
  echo Run .07-sync-r2-images.bat and .01-bundle-site-r2.bat first.
  pause
  exit /b 1
)

echo Verifying the exact versioned image URLs through the public CDN...
echo This checks the URLs the browser will use, including cache-busting parameters.
echo.
%PYTHON_EXE% tools\verify_remote_catalog_assets.py --base-url "https://cdn.bargig-furniture.com" --versioned --workers 20
if errorlevel 1 (
  echo.
  echo Cloudflare Pages deploy stopped because one or more exact CDN image URLs failed.
  echo Do not publish until the R2 sync and CDN cache are healthy.
  pause
  exit /b 1
)

echo Validating the existing bundle and uploading it without rebuilding...
echo.
%PYTHON_EXE% tools\deploy_cloudflare_pages.py --dir dist/site-upload-r2 --seo-mode private %*
if errorlevel 1 (
  echo.
  echo The Cloudflare operation did not complete successfully. If sources changed, run .01-bundle-site-r2.bat first.
  pause
  exit /b 1
)

echo.
echo Cloudflare Pages deploy finished successfully.
echo.
pause
