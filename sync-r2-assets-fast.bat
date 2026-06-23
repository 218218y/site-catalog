@echo off
chcp 65001 >nul
setlocal EnableExtensions
cd /d "%~dp0"

set "R2_BUCKET=%~1"
set "EXTRA_ARGS=%2 %3 %4 %5 %6 %7 %8 %9"
if "%R2_BUCKET%"=="" (
  set "R2_BUCKET=bargig-catalog"
  set "EXTRA_ARGS="
) else if "%R2_BUCKET:~0,2%"=="--" (
  set "R2_BUCKET=bargig-catalog"
  set "EXTRA_ARGS=%*"
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
echo Fast Cloudflare R2 sync through the S3 API.
echo Bucket: %R2_BUCKET%
echo.
echo First-time setup only: run setup-r2-aws-profile.bat
echo.

%PYTHON_EXE% tools\sync_r2_assets_aws.py --bucket "%R2_BUCKET%" %EXTRA_ARGS%
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo Fast sync finished successfully.
) else (
  echo Fast sync failed. Check the message above.
)
echo.
pause
exit /b %EXIT_CODE%
