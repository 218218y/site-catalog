@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo מה לפתוח?
echo [1] main site only  - http://localhost:8080
echo [2] control panel only - http://127.0.0.1:8765/catalog-control-panel.html
echo [3] both
choice /C 123 /N /M "בחר 1/2/3: "
if errorlevel 3 goto both
if errorlevel 2 goto control
goto site

:site
echo Building and serving the complete private site artifact...
echo.
python tools\serve_site.py --port 8080
if errorlevel 1 (
  echo Local site build or server startup failed.
  pause
  exit /b 1
)
pause
exit /b

:control
call catalog-control-panel.bat
exit /b %errorlevel%

:both
echo Building the complete private site artifact and starting it in a separate window...
start "Catalog Website 8080" cmd /k "cd /d ""%~dp0"" && python tools\serve_site.py --port 8080"
echo Opening catalog control panel in this window...
call catalog-control-panel.bat
exit /b %errorlevel%
