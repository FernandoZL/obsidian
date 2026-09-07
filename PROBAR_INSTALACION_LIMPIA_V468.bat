@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo    V4.6.8 - PRUEBA SEGURA DE INSTALACION LIMPIA
echo ============================================================
echo.
echo Crea una boveda de prueba separada de la boveda principal.
echo NO borra ni modifica notas personales de la boveda principal.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\probar_instalacion_limpia_v468.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo [ERROR] La prueba limpia no termino correctamente.
) else (
  echo [OK] Instalacion limpia preparada para validacion.
)
echo.
pause
exit /b %RC%
