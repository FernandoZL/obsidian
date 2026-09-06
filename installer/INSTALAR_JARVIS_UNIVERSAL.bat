@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

set "JARVIS_VERSION="
for /f "usebackq delims=" %%V in ("%~dp0..\VERSION") do if not defined JARVIS_VERSION set "JARVIS_VERSION=%%V"
if not defined JARVIS_VERSION set "JARVIS_VERSION=4.6.6"

title JARVIS V%JARVIS_VERSION% - INSTALADOR UNIVERSAL

echo ============================================================
echo             JARVIS V%JARVIS_VERSION% - INSTALADOR UNIVERSAL
echo ============================================================
echo.

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Windows PowerShell.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalar_jarvis_universal.ps1"
set "ERR=%ERRORLEVEL%"

if not "%ERR%"=="0" goto :FIN

echo.
echo ============================================================
echo        CONFIRMANDO CARGA REAL DE JARVIS
echo ============================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0validar_activacion_jarvis.ps1"
set "ERR=%ERRORLEVEL%"

:FIN
echo.
if not "%ERR%"=="0" (
  echo [ERROR] La instalacion o validacion no termino correctamente.
) else (
  echo [OK] Instalacion y runtime Jarvis validados.
)
pause
exit /b %ERR%
