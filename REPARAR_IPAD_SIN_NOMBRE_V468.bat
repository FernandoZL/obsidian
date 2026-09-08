@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo ============================================================
echo      V4.6.8 - REPARAR INTERFAZ NEUTRA EN IPAD
 echo ============================================================
echo.
echo Fuerza la copia actual del modo movil y reinicia solo el
echo workspace movil para eliminar titulos antiguos en iPad/iPhone.
echo NO borra notas, documentos ni configuracion de escritorio.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer\reparar_ipad_sin_nombre_v468.ps1"
set "RC=%ERRORLEVEL%"

if not "%RC%"=="0" (
  echo.
  echo [ERROR] La reparacion del iPad no termino correctamente.
  echo.
  pause
  exit /b %RC%
)

echo.
echo [OK] Reparacion movil preparada.
echo.
pause
exit /b 0
