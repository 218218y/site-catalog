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

%PYTHON_EXE% tools\build_deploy_bundle.py %*
if errorlevel 1 (
  echo.
  echo Bundle failed. Make sure you ran convert-catalogs.bat and assets\pages exists.
  pause
  exit /b 1
)

echo.
echo Ready to upload: dist\site-upload
echo.
pause
