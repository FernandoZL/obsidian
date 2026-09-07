@echo off
chcp 65001 >nul
setlocal

echo ============================================================
echo    V4.6.8 - VALIDAR INSTALADOR UNIVERSAL
echo ============================================================
echo.

set "ROOT=%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%ROOT%installer\validar_instalador_universal_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] La validacion no termino correctamente.
  echo.
  pause
  exit /b %RC%
)

echo.
echo [OK] Paquete universal validado.
echo.
pause
exit /b 0
