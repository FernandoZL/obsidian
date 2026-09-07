@echo off
chcp 65001 >nul
setlocal

echo ============================================================
echo       OBSIDIAN V4.6.8 - INSTALADOR UNIVERSAL
echo ============================================================
echo.
echo Instala el sistema en una boveda existente o nueva.
echo PC: Centro de control + IA local opcional.
echo Movil: captura, lectura, escritura, busqueda y filtros.
echo.

set "ROOT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%installer\instalar_obsidian_universal_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] La instalacion universal no termino correctamente.
  echo.
  pause
  exit /b %RC%
)

echo.
echo [OK] Instalacion universal finalizada.
echo.
pause
exit /b 0
