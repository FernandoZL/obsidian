@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo        SISTEMA OBSIDIAN - LIMPIEZA SEGURA DE BOVEDA
echo ============================================================
echo.
echo Este proceso SOLO corrige residuos confirmados por la auditoria.
echo Crea respaldo antes de tocar cualquier archivo.
echo NO limpia plantillas, apuntes, tareas reales ni documentos personales.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\limpiar_boveda_segura.ps1"
set "RC=%ERRORLEVEL%"

echo.
if not "%RC%"=="0" (
  echo [ERROR] La limpieza no termino correctamente.
) else (
  echo [OK] Limpieza segura terminada.
)

echo.
pause
exit /b %RC%
