@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================================
echo    V4.6.8 - AUDITAR REGISTRO DE OBSIDIAN
echo ============================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\auditar_registro_obsidian_v468.ps1"
set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo [ERROR] La auditoria no termino correctamente.
) else (
  echo [OK] Auditoria terminada. No se modifico el registro.
)
echo.
pause
exit /b %RC%
