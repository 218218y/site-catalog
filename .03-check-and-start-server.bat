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

echo Checking whether the local website matches the current source...
echo Web root: dist\site-local
echo.
%PYTHON_EXE% tools\serve_site.py --port 8080 --ensure-current ask
if errorlevel 1 (
  echo.
  echo The local site could not be checked, updated, or started. Read the exact error above.
  pause
  exit /b 1
)
exit /b 0
