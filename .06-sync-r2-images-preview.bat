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

%PYTHON_EXE% tools\sync_r2_catalog_images.py --dry-run %*
if errorlevel 1 (
  echo.
  echo R2 preview failed. Check r2.env credentials, account id, bucket, and that assets\pages exists.
  pause
  exit /b 1
)

echo.
echo Preview finished. No files were uploaded or deleted.
echo To apply the same sync, run: .07-sync-r2-images.bat
pause
