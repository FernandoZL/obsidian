@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo       V4.6.7 - PUENTE IA MOVIL ^(PRUEBA^)
echo ============================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\instalar_puente_ia_movil_v467.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo [ERROR] La instalacion del puente IA no termino correctamente.
) else (
  echo [OK] Puente IA instalado para prueba.
)
echo.
pause
exit /b %RC%
