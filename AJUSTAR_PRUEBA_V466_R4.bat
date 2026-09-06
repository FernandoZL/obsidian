@echo off
setlocal EnableExtensions
chcp 65001 >nul
title JARVIS V4.6.6 R4 - PRUEBA DIRECTA
cd /d "%~dp0"

echo ============================================================
echo       JARVIS V4.6.6 R4 - PRUEBA DIRECTA
echo ============================================================
echo.
echo R4 reemplaza los parches R1/R2/R3 por una aplicacion directa.
echo Trabaja SOLO en v4.6.6-mobile-pendientes.
echo.
echo Corrige:
echo  - consultas de pendientes que se guardaban como tareas
echo  - recordatorios conversacionales incorrectos
echo  - texto duplicado de proyectos
echo  - modal de recordatorio en iPhone con teclado
echo  - safe-area y viewport movil
echo  - fecha legible segun region
echo  - Proximos compacto en movil
echo.
echo NO hace commit ni push.
echo NO toca main.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\aplicar_prueba_v466_r4.ps1"
set "ERR=%ERRORLEVEL%"
echo.
if not "%ERR%"=="0" (
  echo [ERROR] La prueba R4 no termino correctamente.
  echo NO haga commit ni push.
) else (
  echo [OK] R4 aplicada. Pruebe PC e iPhone.
)
echo.
pause
exit /b %ERR%
