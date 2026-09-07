@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo    V4.6.8 - VALIDAR BOVEDA DE PRUEBA
echo ============================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\validar_boveda_prueba_v468.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo [ERROR] La validacion de la boveda de prueba fallo.
) else (
  echo [OK] La boveda de prueba cumple la validacion base.
)
echo.
pause
exit /b %RC%
