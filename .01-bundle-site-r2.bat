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
  echo Site build stopped because the generated image release was not synced to R2.
  echo Run .07-sync-r2-images.bat, then run this file again.
  pause
  exit /b 1
)

%PYTHON_EXE% tools\build_deploy_bundle.py --out dist/site-upload-r2 --seo-mode private --external-assets-url "https://cdn.bargig-furniture.com" --skip-if-current --mirror-to dist/site-local --clean-legacy-artifacts %*
if errorlevel 1 (
  echo.
  echo Site bundle failed. Read the exact build error above.
  pause
  exit /b 1
)

%PYTHON_EXE% tools\clean_project_artifacts.py
if errorlevel 1 (
  echo.
  echo The site bundle is ready, but project artifact cleanup failed.
  pause
  exit /b 1
)

echo.
echo Ready to upload: dist\site-upload-r2
echo Ready for local preview: dist\site-local
echo Images are loaded from Cloudflare R2, not from the Cloudflare Pages upload folder.
echo.
pause
