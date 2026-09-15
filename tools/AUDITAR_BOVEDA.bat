@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0.."
echo ============================================================
echo        SISTEMA OBSIDIAN - AUDITORIA DE BOVEDA (SOLO LECTURA)
echo ============================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\installer\auditar_boveda.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo [ERROR] La auditoria no termino correctamente.
) else (
  echo [OK] Auditoria terminada. Revise el reporte creado en el Escritorio.
)
echo.
pause
exit /b %RC%
