@echo off
chcp 65001 >nul
setlocal
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

call upload-r2-assets-wrangler.bat "%R2_BUCKET%" --failed-only
