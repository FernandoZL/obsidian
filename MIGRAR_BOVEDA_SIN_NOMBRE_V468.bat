@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo       V4.6.8 - MIGRAR BOVEDA A NOMBRE NEUTRO
echo ============================================================
echo.
echo Renombra de forma controlada la boveda fisica:
echo   Obsidian Jarvis  ^>  Obsidian
echo.
echo Actualiza el registro local de Obsidian en Windows.
echo NO borra notas, NO mueve el repositorio y NO hace commit/push.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\migrar_boveda_sin_nombre_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] La migracion de la boveda no termino correctamente.
) else (
  echo.
  echo [OK] Migracion de la boveda terminada.
)

pause
exit /b %RC%
