@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where aws >nul 2>nul
if errorlevel 1 (
  echo AWS CLI was not found.
  echo Install AWS CLI v2, then run this file again:
  echo https://aws.amazon.com/cli/
  pause
  exit /b 1
)

echo.
echo This creates an AWS CLI profile named r2 for Cloudflare R2 uploads.
echo You need an R2 API token / access key with Object Read and Write permissions for bucket bargig-catalog.
echo.
echo When aws configure asks:
echo   AWS Access Key ID     = paste the R2 Access Key ID
echo   AWS Secret Access Key = paste the R2 Secret Access Key
echo   Default region name   = auto
echo   Default output format = json
echo.
aws configure --profile r2
if errorlevel 1 goto error

aws configure set region auto --profile r2
aws configure set output json --profile r2
aws configure set s3.max_concurrent_requests 32 --profile r2

echo.
echo Done. Now run:
echo   sync-r2-assets-fast.bat bargig-catalog
pause
exit /b 0

:error
echo.
echo AWS CLI profile setup failed.
pause
exit /b 1
