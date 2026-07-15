@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

if exist ".venv\Scripts\python.exe" (
  set "PYTHON_EXE=.venv\Scripts\python.exe"
) else (
  set "PYTHON_EXE=python"
)

%PYTHON_EXE% tools\telemetry_report.py %*
if errorlevel 1 (
  echo.
  echo The telemetry report could not be created. Read the error above.
  pause
  exit /b 1
)

echo.
pause
