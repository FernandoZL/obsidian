@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo    V4.6.8 - CORREGIR CODIFICACION DE LA BOVEDA
echo ============================================================
echo.
echo Corrige nombres con mojibake, por ejemplo:
echo   ProgramaciÃ³n  ^>  Programación
echo.
echo Crea respaldo antes de renombrar.
echo NO borra notas ni cambia contenido personal.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\corregir_codificacion_boveda_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] La correccion de codificacion no termino correctamente.
) else (
  echo.
  echo [OK] Correccion de codificacion completada.
)

echo.
pause
exit /b %RC%
