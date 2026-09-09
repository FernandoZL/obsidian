@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo      V4.6.8 - AJUSTAR MODO MOVIL PARA IPAD
echo ============================================================
echo.
echo Corrige el responsive y la lista final de resultados del iPad.
echo NO toca notas ni documentos.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\reparar_ipad_modo_movil_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] No se pudo aplicar el responsive de iPad.
  echo.
  pause
  exit /b %RC%
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\reparar_ipad_resultados_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] El responsive se aplico, pero fallo la correccion de resultados.
  echo.
  pause
  exit /b %RC%
)

echo.
echo [OK] Responsive e interfaz de resultados de iPad preparados.
echo.
pause
exit /b 0
