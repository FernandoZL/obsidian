@echo off
setlocal EnableExtensions
chcp 65001 >nul
title JARVIS V4.6.6 R3 - EJECUCION ROBUSTA
cd /d "%~dp0"

echo ============================================================
echo       JARVIS V4.6.6 R3 - EJECUCION ROBUSTA
echo ============================================================
echo.
echo Corrige el fallo de coincidencia CRLF/LF de R1 y R2.
echo Ejecuta ambos parches con saltos de linea normalizados.
echo.
echo NO toca main.
echo NO hace commit ni push.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\ejecutar_prueba_v466_r3.ps1"
set "ERR=%ERRORLEVEL%"
echo.
if not "%ERR%"=="0" (
  echo [ERROR] La prueba R3 no termino correctamente.
) else (
  echo [OK] V4.6.6 R3 aplicada. Pruebe en iPhone.
)
echo.
pause
exit /b %ERR%
