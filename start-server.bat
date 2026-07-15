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
echo Building frontend modules and public pages...
python tools\build_site_pages.py
if errorlevel 1 (
  echo Frontend build failed.
  pause
  exit /b 1
)
echo.
echo Starting local website at http://localhost:8080
echo שים לב: לוח השליטה לא עובד דרך השרת הזה, כי אין כאן API.
echo כדי לפתוח את לוח השליטה הפעל catalog-control-panel.bat או בחר 2 בתפריט הזה.
echo.
python -m http.server 8080
pause
exit /b

:control
call catalog-control-panel.bat
exit /b %errorlevel%

:both
echo Building frontend modules and public pages...
python tools\build_site_pages.py
if errorlevel 1 (
  echo Frontend build failed.
  pause
  exit /b 1
)
echo.
echo Starting local website in a separate window at http://localhost:8080
start "Catalog Website 8080" cmd /k "cd /d ""%~dp0"" && echo Starting local website at http://localhost:8080 && python -m http.server 8080"
echo Opening catalog control panel in this window...
call catalog-control-panel.bat
exit /b %errorlevel%
