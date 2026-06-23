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

set "R2_PUBLIC_URL=%~1"
if "%R2_PUBLIC_URL%"=="" (
  echo Paste the R2 public read URL, not the S3 API endpoint.
  echo Good examples:
  echo   https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
  echo   https://catalogs.example.com
  echo Bad example:
  echo   https://7d352c315748f2f8c6e723c5fc46f606.r2.cloudflarestorage.com
  echo.
  set /p "R2_PUBLIC_URL=R2 public URL: "
)

%PYTHON_EXE% tools\set_r2_public_url.py "%R2_PUBLIC_URL%"
if errorlevel 1 (
  echo.
  echo URL was not saved. Use an R2 Custom Domain or Public Development URL.
  pause
  exit /b 1
)

echo.
echo Now run bundle-site-r2.bat and upload dist\site-upload.zip to Netlify.
echo.
pause
