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

%PYTHON_EXE% tools\clean_project_artifacts.py
if errorlevel 1 (
  echo.
  echo Project cleanup failed. Read the exact error above.
  pause
  exit /b 1
)

echo.
echo Project caches and obsolete duplicate artifacts were cleaned.
pause
exit /b 0
