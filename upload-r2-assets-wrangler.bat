@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

set "R2_BUCKET=%~1"
if "%R2_BUCKET%"=="" (
  set /p "R2_BUCKET=Cloudflare R2 bucket name: "
)
if "%R2_BUCKET%"=="" (
  echo Bucket name is required.
  pause
  exit /b 1
)

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

if not exist "dist\r2-assets\assets\pages" (
  echo dist\r2-assets\assets\pages was not found.
  echo Run build-r2-assets.bat first.
  pause
  exit /b 1
)

echo.
echo Fallback upload using Wrangler --remote.
echo For large catalog uploads, use the faster sync-r2-assets-fast.bat instead.
echo Bucket: %R2_BUCKET%
echo.
echo If needed, first run: npx wrangler login
echo.

%PYTHON_EXE% tools\upload_r2_assets_wrangler.py "%R2_BUCKET%" %2 %3 %4 %5 %6 %7 %8 %9
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo Upload finished successfully.
) else if "%EXIT_CODE%"=="2" (
  echo Some files failed after retries.
  echo You do NOT need to upload everything again.
  echo Retry only failed files with:
  echo   upload-r2-assets-wrangler.bat %R2_BUCKET% --failed-only
) else (
  echo Upload failed before completion.
  echo Check Wrangler login, bucket name, permissions, and network connection.
)
echo.
pause
exit /b %EXIT_CODE%
