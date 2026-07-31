@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is required. Install the version pinned in .nvmrc and run this file again.
  goto error
)

node tools\project_tasks.js configure-r2-cors %*
if errorlevel 1 goto error

echo.
echo R2 CORS configuration finished successfully.
pause
exit /b 0

:error
echo.
echo Command failed: configure-r2-cors. Read the exact error above.
pause
exit /b 1
