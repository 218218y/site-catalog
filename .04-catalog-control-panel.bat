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

echo.
echo Opening catalog control panel server. Do not open catalog-control-panel.html through .05-start-server.bat or npx serve.
echo.
%PYTHON_EXE% tools\catalog_control_server.py
if errorlevel 1 (
  echo.
  echo Catalog control panel failed. If this is the first run, run .20-setup-windows.bat first.
  pause
  exit /b 1
)
