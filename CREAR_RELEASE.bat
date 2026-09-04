@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"
for /f "usebackq delims=" %%V in ("VERSION") do set "VER=%%V"
set "OUTDIR=%CD%\release"
set "TMP=%TEMP%\Obsidian_Jarvis_Release_%RANDOM%"
set "ZIP=%OUTDIR%\Obsidian_Jarvis_V%VER%.zip"

if not exist "INSTALAR_JARVIS.bat" (echo [ERROR] Falta INSTALAR_JARVIS.bat.& exit /b 1)
if not exist "installer\INSTALAR_JARVIS_UNIVERSAL.bat" (echo [ERROR] Falta el instalador universal.& exit /b 1)
if not exist "installer\payload\.obsidian\plugins\jarvis-core\main.js" (echo [ERROR] Falta jarvis-core.& exit /b 1)
if not exist "installer\payload\.obsidian\plugins\jarvis-local-ai\vendor\pdf.worker.mjs" (echo [ERROR] Faltan dependencias vendor.& exit /b 1)

rmdir /s /q "%TMP%" >nul 2>nul
mkdir "%TMP%" >nul
mkdir "%OUTDIR%" >nul 2>nul

copy /Y "INSTALAR_JARVIS.bat" "%TMP%\INSTALAR_JARVIS.bat" >nul
copy /Y "README.md" "%TMP%\README.md" >nul
xcopy "installer\*" "%TMP%\installer\" /E /I /Y >nul
mkdir "%TMP%\docs" >nul 2>nul
copy /Y "docs\INSTALACION.md" "%TMP%\docs\INSTALACION.md" >nul
copy /Y "docs\OLLAMA.md" "%TMP%\docs\OLLAMA.md" >nul
copy /Y "docs\PRIMER_INICIO.md" "%TMP%\docs\PRIMER_INICIO.md" >nul
copy /Y "docs\SEGURIDAD_Y_DATOS.md" "%TMP%\docs\SEGURIDAD_Y_DATOS.md" >nul

if exist "%ZIP%" del /q "%ZIP%"
powershell -NoProfile -Command "Compress-Archive -Path '%TMP%\*' -DestinationPath '%ZIP%' -CompressionLevel Optimal -Force"
set "ERR=%ERRORLEVEL%"
rmdir /s /q "%TMP%" >nul 2>nul
if not "%ERR%"=="0" (echo [ERROR] No se pudo crear el release.& exit /b 1)
echo [OK] Release universal creado:
echo %ZIP%
exit /b 0
