@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo       V4.6.7 - INTERFAZ SIN MARCA VISIBLE
echo ============================================================
echo.
echo Quita el nombre visible del sistema sin renombrar IDs tecnicos.
echo Crea respaldo antes de tocar la configuracion de Obsidian.
echo NO hace commit ni push.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\aplicar_sin_marca_v467.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] La interfaz sin marca no termino correctamente.
) else (
  echo.
  echo [OK] Interfaz sin marca instalada para prueba.
)

echo.
pause
exit /b %RC%
