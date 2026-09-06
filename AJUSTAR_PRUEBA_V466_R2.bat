@echo off
setlocal EnableExtensions
chcp 65001 >nul
title JARVIS V4.6.6 R2 - MODAL MOVIL
cd /d "%~dp0"

echo ============================================================
echo       JARVIS V4.6.6 R2 - AJUSTE MODAL MOVIL
echo ============================================================
echo.
echo Corrige la prueba movil sin tocar main:
echo  - modal se adapta al viewport visible
echo  - botones quedan visibles con teclado
echo  - deja de depender de CSS :has para el recordatorio
echo  - filtra consultas conversacionales de pendientes
echo.
echo NO hace commit ni push.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\ajustar_prueba_v466_r2.ps1"
set "ERR=%ERRORLEVEL%"
echo.
if not "%ERR%"=="0" (
  echo [ERROR] El ajuste R2 no termino correctamente.
) else (
  echo [OK] Ajuste R2 aplicado. Pruebe Crear recordatorio en iPhone.
)
echo.
pause
exit /b %ERR%
