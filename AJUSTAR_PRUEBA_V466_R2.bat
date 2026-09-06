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
echo  - aplica automaticamente R1 si aun no esta instalada
echo  - modal se adapta al viewport visible
echo  - botones quedan visibles con teclado
echo  - deja de depender de CSS :has para el recordatorio
echo  - filtra consultas conversacionales de pendientes
echo.
echo NO hace commit ni push.
echo.

set "MAIN=%~dp0installer\payload\.obsidian\plugins\jarvis-core\main.js"

findstr /C:"jarvis-reminder-modal" "%MAIN%" >nul 2>nul
if errorlevel 1 goto :APLICAR_R1
findstr /C:"formatDateLong(" "%MAIN%" >nul 2>nul
if errorlevel 1 goto :APLICAR_R1
goto :R2

:APLICAR_R1
echo [..] La prueba R1 aun no esta aplicada. Se aplicara automaticamente.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\aplicar_prueba_v466.ps1"
if errorlevel 1 (
  echo.
  echo [ERROR] No se pudo aplicar R1. R2 no se ejecutara.
  pause
  exit /b 1
)
echo [OK] R1 aplicada automaticamente.
echo.

:R2
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
