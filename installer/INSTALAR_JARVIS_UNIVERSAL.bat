@echo off
setlocal EnableExtensions
chcp 65001 >nul
title JARVIS V4.6 - INSTALADOR UNIVERSAL
cd /d "%~dp0"
echo ============================================================
echo             JARVIS V4.6 - INSTALADOR UNIVERSAL
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
echo.
if not "%ERR%"=="0" (
  echo [ERROR] La instalacion no termino correctamente.
) else (
  echo [OK] Instalador finalizado.
)
pause
exit /b %ERR%
