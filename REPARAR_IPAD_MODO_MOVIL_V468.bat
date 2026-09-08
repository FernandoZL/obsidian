@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo      V4.6.8 - AJUSTAR MODO MOVIL PARA IPAD

echo ============================================================
echo.
echo Corrige el corte visual que hacia que el iPad se viera como PC.
echo NO toca notas ni documentos.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\reparar_ipad_modo_movil_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] No se pudo aplicar el modo movil de iPad.
  echo.
  pause
  exit /b %RC%
)

echo.
echo [OK] Modo movil de iPad preparado.
echo.
pause
exit /b 0
