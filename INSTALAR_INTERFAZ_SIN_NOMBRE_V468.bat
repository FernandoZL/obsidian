@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo        V4.6.8 - INTERFAZ SIN NOMBRE VISIBLE
echo ============================================================
echo.
echo PC: Centro de control y asistente sin nombre propio.
echo Movil: captura, lectura, busqueda y filtros.
echo IDs tecnicos: se conservan internamente por compatibilidad.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\instalar_interfaz_sin_nombre_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] La interfaz sin nombre no termino correctamente.
) else (
  echo.
  echo [OK] Interfaz sin nombre instalada para prueba.
)

echo.
pause
exit /b %RC%
