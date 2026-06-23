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
echo [1/3] Building or reusing WebP catalog metadata...
%PYTHON_EXE% tools\build_catalogs.py --format webp --dpi 220 --max-width 2800 --max-height 2800 --thumb-size 420 --quality 84 --thumb-quality 76 --sharpen 0.8 --ocr auto --ocr-lang heb+eng --ocr-dpi 260
if errorlevel 1 goto error

echo.
echo [2/3] Transcoding existing JPG/PNG catalog pages to WebP when needed...
%PYTHON_EXE% tools\transcode_catalog_images.py --format webp --quality 84 --thumb-quality 76 --skip-existing
if errorlevel 1 goto error

echo.
echo [3/3] Refreshing catalog metadata and preparing the R2 upload folder...
%PYTHON_EXE% tools\build_catalogs.py --format webp --dpi 220 --max-width 2800 --max-height 2800 --thumb-size 420 --quality 84 --thumb-quality 76 --sharpen 0.8 --ocr auto --ocr-lang heb+eng --ocr-dpi 260
if errorlevel 1 goto error

%PYTHON_EXE% tools\build_r2_assets_bundle.py --zip
if errorlevel 1 goto error

echo.
echo Ready for R2 upload: dist\r2-assets
echo Optional ZIP: dist\r2-assets.zip
echo.
echo After uploading, enable an R2 Public Development URL or Custom Domain.
echo Do NOT use the .r2.cloudflarestorage.com S3 API endpoint as the browser image URL.
echo Then run set-r2-public-url.bat with the public URL, run bundle-site-r2.bat,
echo and upload dist\site-upload.zip to Netlify.
echo.
pause
exit /b 0

:error
echo.
echo R2 asset build failed. Check the messages above.
pause
exit /b 1
