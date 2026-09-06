@echo off
setlocal EnableExtensions
chcp 65001 >nul
title JARVIS V4.6.6 - PRUEBA EN RAMA
cd /d "%~dp0"

echo ============================================================
echo       JARVIS V4.6.6 - PRUEBA EN RAMA
echo ============================================================
echo.
echo Rama esperada: v4.6.6-mobile-pendientes
echo.
echo Corrige SOLO en esta rama de prueba:
echo  - consultas de pendientes no se guardan como tareas
echo  - limpia recordatorios conversacionales incorrectos
echo  - evita duplicar el nombre del proyecto en el panel
echo  - mejora el modal de recordatorio en movil
echo  - limita Proximos en movil
echo  - fecha legible segun region
echo.
echo Crea respaldo. NO hace commit ni push.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\aplicar_prueba_v466.ps1"
set "ERR=%ERRORLEVEL%"
echo.
if not "%ERR%"=="0" (
  echo [ERROR] La prueba V4.6.6 no termino correctamente.
  echo NO haga commit ni push.
) else (
  echo [OK] V4.6.6 aplicada localmente en la rama de prueba.
  echo Pruebe PC y movil antes de guardar la version.
)
echo.
pause
exit /b %ERR%
