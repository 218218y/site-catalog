@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install the version pinned in .nvmrc and run this file again.
  goto error
)

node tools\project_tasks.js server-check %*
if errorlevel 1 goto error
exit /b 0

:error
echo.
echo Command failed: server-check. Read the exact error above.
pause
exit /b 1
