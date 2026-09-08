@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo        V4.6.8 R2 - INTERFAZ SIN NOMBRE VISIBLE
echo ============================================================
echo.
echo PC: Centro de control y asistente sin nombre propio.
echo Movil: captura, lectura, busqueda y filtros.
echo IDs tecnicos: se conservan internamente por compatibilidad.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\instalar_interfaz_sin_nombre_v468_r2.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] La interfaz sin nombre no termino correctamente.
  echo.
  pause
  exit /b %RC%
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\reparar_codificacion_plugins_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] La interfaz se instalo, pero no se pudo reparar la codificacion visible.
  echo.
  pause
  exit /b %RC%
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\aplicar_espacio_barra_movil_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] La interfaz se instalo, pero no se pudo corregir el espacio inferior movil.
  echo.
  pause
  exit /b %RC%
)

echo.
echo [OK] Interfaz sin nombre instalada para prueba.
echo [OK] Codificacion visible de complementos verificada.
echo [OK] Barra inferior movil compensada para que el ultimo elemento sea seleccionable.
echo.
pause
exit /b 0
