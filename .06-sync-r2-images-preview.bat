@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install the version pinned in .nvmrc and run this file again.
  goto error
)

node tools\project_tasks.js r2-preview %*
if errorlevel 1 goto error

echo.
echo Preview finished. No files were uploaded or deleted.
pause
exit /b 0

:error
echo.
echo Command failed: r2-preview. Read the exact error above.
pause
exit /b 1
