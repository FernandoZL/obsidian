@echo off
setlocal
chcp 65001 >nul
title V4.6.8 - Reparar registro Obsidian

echo ============================================================
echo    V4.6.8 - REPARAR REGISTRO DE OBSIDIAN
echo ============================================================
echo.
echo Restaura la boveda principal en obsidian.json sin borrar
echo la boveda de prueba ni tocar notas personales.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\reparar_registro_obsidian_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] La reparacion no termino correctamente.
) else (
  echo.
  echo [OK] Registro de Obsidian reparado.
)

pause
exit /b %RC%
