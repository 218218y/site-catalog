@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo Installing local Python environment...
py -3 -m venv .venv
if errorlevel 1 goto error
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
python -m pip install -r tools\requirements.txt
if errorlevel 1 goto error
echo.
echo Done. Now put PDFs in assets\pdfs and run convert-catalogs.bat
echo For maximum quality PNG output, run convert-catalogs-png.bat
echo.
pause
exit /b 0
:error
echo.
echo Something failed. Make sure Python 3 is installed and try again.
pause
exit /b 1
